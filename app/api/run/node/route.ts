import { NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"
import { decrypt } from "@/lib/crypto"
import { getGoogleAuth, sendGmail, appendToSheet } from "@/lib/ai/google"

export async function POST(req: Request) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!
  
  if (!supabaseServiceKey) {
    return NextResponse.json({ error: "Missing SUPABASE_SERVICE_ROLE_KEY in environment." }, { status: 500 })
  }

  const supabase = createClient(supabaseUrl, supabaseServiceKey)

  try {
    const { node, context } = await req.json()
    
    // 1. Auth check
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) throw new Error("Unauthorized")
    const { data: { user }, error: authError } = await supabase.auth.getUser(authHeader.replace('Bearer ', ''))
    if (authError || !user) throw new Error("Unauthorized")

    // 2. Resolve templates in node description
    const hydratedPrompt = resolveTemplates(node.description, context)

    // 3. Route to service
    let result: any = null

    switch (node.tool?.toLowerCase()) {
      case "openai":
      case "ai":
        result = await runOpenAI(supabase, user.id, hydratedPrompt)
        break
      
      case "gmail": {
        const accessToken = await getGoogleAuth(user.id)
        // Extract email address from description or context
        const emailMatch = hydratedPrompt.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/)
        const recipient = emailMatch ? emailMatch[0] : "user@example.com"
        result = await sendGmail(accessToken, recipient, "Thinkly Automation Alert", hydratedPrompt)
        break
      }

      case "googlesheets":
      case "sheets": {
        const accessToken = await getGoogleAuth(user.id)
        // Extract Sheet ID from description (e.g. from a URL or raw ID)
        const sheetIdMatch = hydratedPrompt.match(/\b([a-zA-Z0-9-_]{15,})\b/)
        const sheetId = node.apiEndpoint || (sheetIdMatch ? sheetIdMatch[0] : null)
        if (!sheetId) throw new Error("No Google Sheet ID found in node description.")
        
        result = await appendToSheet(accessToken, sheetId, "Sheet1!A:A", [[new Date().toISOString(), hydratedPrompt]])
        break
      }

      default:
        result = { message: `Executed ${node.label} successfully`, timestamp: new Date().toISOString() }
    }

    return NextResponse.json({ success: true, output: result })

  } catch (err: any) {
    console.error("Node Execution Error:", err)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}

function resolveTemplates(text: string, context: any): string {
  return text.replace(/\{\{(.+?)\}\}/g, (match, path) => {
    const parts = path.trim().split('.')
    let val: any = context
    for (const part of parts) {
      val = val?.[part]
    }
    return val !== undefined ? String(val) : match
  })
}

async function runOpenAI(supabase: any, userId: string, prompt: string) {
  // 1. Fetch encrypted key
  const { data: integ, error } = await supabase
    .from("user_integrations")
    .select("encrypted_secret")
    .eq("user_id", userId)
    .eq("service_name", "openai")
    .maybeSingle()

  if (error || !integ) throw new Error("OpenAI not connected in Integrations hub.")

  // 2. Decrypt
  const apiKey = decrypt(integ.encrypted_secret)

  // 3. Call OpenAI
  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${apiKey}`
    },
    body: JSON.stringify({
      model: "gpt-4o-mini",
      messages: [{ role: "user", content: prompt }],
      temperature: 0.7
    })
  })

  if (!res.ok) {
    const errData = await res.json()
    throw new Error(errData.error?.message || "OpenAI failed")
  }

  const data = await res.json()
  return data.choices[0].message.content
}
