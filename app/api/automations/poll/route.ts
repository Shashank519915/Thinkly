import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { AutomationRunner } from '@/lib/engine/runner';
import { decrypt } from '@/lib/crypto';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

export async function POST(req: NextRequest) {
  try {
    const supabase = createClient(supabaseUrl, supabaseKey);
    const { instanceId, userId, nodes, edges } = await req.json();

    if (!instanceId || !nodes || !userId) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    // 1. Fetch Google Integration Token
    const { data: integrations } = await supabase
      .from('user_integrations')
      .select('*')
      .eq('user_id', userId)
      .eq('service_name', 'google');

    if (!integrations || integrations.length === 0) {
      return NextResponse.json({ triggered: false, message: "Google integration missing" });
    }

    const googleToken = decrypt(integrations[0].encrypted_secret);

    // 2. Look for trigger node
    const triggerNode = nodes.find((n: any) => n.type === 'trigger');
    if (!triggerNode || !triggerNode.tool?.includes("Gmail")) {
      return NextResponse.json({ triggered: false, message: "No Gmail trigger found" });
    }

    // Resolve 'from' configuration just in case it's hardcoded (ignoring $input for simplicity in poll query)
    const fromAddr = triggerNode.config?.from;
    // If fromAddr contains a handlebars template like {{...}}, it will break the query, so ignore it.
    let q = `is:unread`;
    if (fromAddr && !fromAddr.includes('{{')) {
       q += ` from:${fromAddr}`;
    }

    console.log(`[POLL] Checking Gmail for instance ${instanceId}. Query: ${q}`);

    // 3. Poll Gmail API
    const gmailRes = await fetch(`https://gmail.googleapis.com/gmail/v1/users/me/messages?q=${encodeURIComponent(q)}&maxResults=1`, {
      method: "GET",
      headers: { "Authorization": `Bearer ${googleToken}` }
    });

    if (!gmailRes.ok) {
       console.error("Gmail fetch error:", await gmailRes.text());
       return NextResponse.json({ triggered: false, message: "Failed to fetch from Gmail" });
    }

    const gmailData = await gmailRes.json();
    if (!gmailData.messages || gmailData.messages.length === 0) {
      return NextResponse.json({ triggered: false, message: "No new emails" });
    }

    const msgId = gmailData.messages[0].id;
    const threadId = gmailData.messages[0].threadId;

    // Fetch full message details
    const msgRes = await fetch(`https://gmail.googleapis.com/gmail/v1/users/me/messages/${msgId}?format=full`, {
      headers: { "Authorization": `Bearer ${googleToken}` }
    });
    const msgFull = await msgRes.json();

    // Extract headers
    let subject = "No Subject";
    let messageIdHeader = "";
    let date = "";
    msgFull.payload?.headers?.forEach((h: any) => {
      if (h.name.toLowerCase() === 'subject') subject = h.value;
      if (h.name.toLowerCase() === 'message-id') messageIdHeader = h.value;
      if (h.name.toLowerCase() === 'date') date = h.value;
    });

    // Extract body
    let bodyText = "";
    if (msgFull.payload?.parts) {
      const part = msgFull.payload.parts.find((p: any) => p.mimeType === "text/plain");
      if (part && part.body?.data) {
        bodyText = Buffer.from(part.body.data, 'base64url').toString('utf-8');
      }
    } else if (msgFull.payload?.body?.data) {
      bodyText = Buffer.from(msgFull.payload.body.data, 'base64url').toString('utf-8');
    }

    const payload = {
      body: { plainText: bodyText },
      receivedDate: date,
      from: { email: fromAddr || 'unknown@example.com', name: 'Unknown' },
      subject: subject,
      threadId: threadId,
      headers: { "Message-ID": messageIdHeader }
    };

    // Mark as read so we don't trigger again
    await fetch(`https://gmail.googleapis.com/gmail/v1/users/me/messages/${msgId}/modify`, {
      method: "POST",
      headers: { "Authorization": `Bearer ${googleToken}`, "Content-Type": "application/json" },
      body: JSON.stringify({ removeLabelIds: ["UNREAD"] })
    });

    // 4. Update the instance in DB
    const { data: currentInstance } = await supabase.from('automation_instances').select('trigger_data').eq('id', instanceId).single();
    const existingObj = (currentInstance as any)?.trigger_data || {};
    
    // Merge new trigger payload with whatever setupData (e.g. spreadsheetId) they provided, if any.
    // Actually, inputData has the spreadsheetId! TriggerData just has the trigger output.
    await supabase.from('automation_instances').update({
      trigger_data: { ...existingObj, ...payload },
      status: 'running',
    }).eq('id', instanceId);

    // 5. Fire runner
    const runner = new AutomationRunner(instanceId, userId, nodes, edges);
    runner.run().catch(err => console.error("Poll Trigger Runner Error:", err));

    return NextResponse.json({ 
      triggered: true, 
      message: "Email found and automation started",
      subject: subject
    });

  } catch (err: any) {
    console.error("Poll API Error:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
