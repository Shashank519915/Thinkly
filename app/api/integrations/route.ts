import { NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"
import { encrypt } from "@/lib/crypto"

export async function POST(req: Request) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY! 

  if (!supabaseServiceKey) {
    return NextResponse.json({ error: "Missing SUPABASE_SERVICE_ROLE_KEY in environment variables." }, { status: 500 })
  }

  const supabase = createClient(supabaseUrl, supabaseServiceKey)

  try {
    const { service_name, api_key } = await req.json()
    
    // 1. Get user from Auth header (forwarded from client)
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) throw new Error("Unauthorized")

    const { data: { user }, error: authError } = await supabase.auth.getUser(authHeader.replace('Bearer ', ''))
    if (authError || !user) throw new Error("Unauthorized")

    // 2. Encrypt the key
    const encrypted = encrypt(api_key)

    // 3. Upsert into database
    const { error } = await supabase
      .from("user_integrations")
      .upsert({
        user_id: user.id,
        service_name,
        encrypted_secret: encrypted,
        is_active: true,
        updated_at: new Date().toISOString()
      }, { onConflict: 'user_id,service_name' })

    if (error) throw error

    return NextResponse.json({ success: true })

  } catch (err: any) {
    console.error("Integration Save Error:", err)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
