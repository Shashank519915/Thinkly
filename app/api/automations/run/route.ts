import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { AutomationRunner } from '@/lib/engine/runner';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

export async function POST(req: NextRequest) {
  try {
    if (!supabaseKey) {
      return NextResponse.json({ error: "SUPABASE_SERVICE_ROLE_KEY is required" }, { status: 500 });
    }

    const supabase = createClient(supabaseUrl, supabaseKey);
    const { workflowId, workflowName, nodes, edges, userId, triggerData, inputData } = await req.json();

    if (!workflowId || !nodes || !userId) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    // 1. Create the instance
    const { data: instance, error: instanceError } = await supabase
      .from('automation_instances')
      .insert({
        user_id: userId,
        workflow_id: workflowId,
        workflow_name: workflowName || 'Untitled Workflow',
        status: 'pending',
        logs: [],
        current_step_id: null,
        trigger_data: triggerData || {},
        input_data: inputData || {}
      })
      .select()
      .single();

    if (instanceError) throw instanceError;

    // 2. Start the runner or pause it
    const firstNode = nodes[0];
    const isTrigger = firstNode?.type === 'trigger';

    if (isTrigger) {
      await supabase.from('automation_instances').update({ status: 'paused' }).eq('id', instance.id);
      return NextResponse.json({ 
        success: true, 
        instanceId: instance.id,
        message: "Automation deployed and paused" 
      });
    }

    const runner = new AutomationRunner(instance.id, userId, nodes, edges);
    runner.run().catch(err => console.error("Async runner error:", err));

    return NextResponse.json({ 
      success: true, 
      instanceId: instance.id,
      message: "Automation started" 
    });

  } catch (err: any) {
    console.error("Run API Error:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
