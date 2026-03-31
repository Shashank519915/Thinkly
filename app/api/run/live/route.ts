import { NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"
import { AutomationRunner } from "@/lib/engine/runner"

export async function POST(req: Request) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!
  
  if (!supabaseServiceKey) {
    return NextResponse.json({ error: "Missing SUPABASE_SERVICE_ROLE_KEY in environment." }, { status: 500 })
  }

  const supabase = createClient(supabaseUrl, supabaseServiceKey)

  try {
    const { nodes, edges } = await req.json()
    
    // 1. Auth check
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) throw new Error("Unauthorized")
    const { data: { user }, error: authError } = await supabase.auth.getUser(authHeader.replace('Bearer ', ''))
    if (authError || !user) throw new Error("Unauthorized")

    // 2. Create an instance id
    const instanceId = `live_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`

    // 3. Insert into automation_instances
    const { error: dbError } = await supabase
      .from('automation_instances')
      .insert({
        id: instanceId,
        user_id: user.id,
        status: 'pending',
        logs: [],
        trigger_data: {},
        input_data: {},
        created_at: new Date().toISOString()
      })

    if (dbError) throw dbError

    // 4. Run the automation Engine Server-Side
    const runner = new AutomationRunner(instanceId, user.id, nodes, edges || [])
    await runner.run()

    // 5. Fetch final instance data to return to client
    const { data: finalInstance } = await supabase
      .from('automation_instances')
      .select('status, logs')
      .eq('id', instanceId)
      .single()

    return NextResponse.json({ 
      success: true, 
      instanceId, 
      status: finalInstance?.status, 
      logs: finalInstance?.logs 
    })

  } catch (err: any) {
    console.error("Live Run Error:", err)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
