import { NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"
import { encrypt } from "@/lib/crypto"

export async function GET(req: Request) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!
  
  if (!supabaseServiceKey) {
    return NextResponse.redirect(new URL('/?error=missing_supa_key', req.url))
  }

  const supabase = createClient(supabaseUrl, supabaseServiceKey)

  const { searchParams } = new URL(req.url)
  const code = searchParams.get('code')
  const state = searchParams.get('state') // This is our userId passed from the frontend
  
  if (!code) return NextResponse.redirect(new URL('/?error=no_code', req.url))

  try {
    // 1. Exchange code for tokens
    const clientId = process.env.GOOGLE_CLIENT_ID
    const clientSecret = process.env.GOOGLE_CLIENT_SECRET
    const redirectUri = `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/api/auth/google/callback`

    const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        code,
        client_id: clientId!,
        client_secret: clientSecret!,
        redirect_uri: redirectUri,
        grant_type: 'authorization_code'
      })
    })

    const tokenData = await tokenRes.json()
    if (!tokenRes.ok) throw new Error(tokenData.error_description || 'Token exchange failed')

    // 2. Identify the user
    // We try Supabase Auth first (cookies), then fallback to our 'state' param
    const { data: { user } } = await supabase.auth.getUser()
    const finalUserId = user?.id || state

    if (!finalUserId) {
      console.error("No user found in session or state")
      return NextResponse.redirect(new URL('/?error=unauthorized_integration', req.url))
    }

    // 3. Encrypt the token object
    const encrypted = encrypt(JSON.stringify(tokenData))

    // 4. Upsert into database
    const { error: dbError } = await supabase
      .from("user_integrations")
      .upsert({
        user_id: finalUserId,
        service_name: "google",
        encrypted_secret: encrypted,
        updated_at: new Date().toISOString()
      }, { onConflict: 'user_id,service_name' })

    if (dbError) throw dbError

    // 5. Success! Redirect back to integrations view
    return NextResponse.redirect(new URL('/?view=integrations&status=connected', req.url))

  } catch (err: any) {
    console.error("Google Callback Error:", err)
    return NextResponse.redirect(new URL(`/?error=${encodeURIComponent(err.message)}`, req.url))
  }
}
