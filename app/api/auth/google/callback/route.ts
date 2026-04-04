import { NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"
import { encrypt } from "@/lib/crypto"
import { cookies } from "next/headers"

export async function GET(req: Request) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!
  
  if (!supabaseServiceKey) {
    return NextResponse.redirect(new URL('/?error=missing_supa_key', req.url))
  }

  const supabase = createClient(supabaseUrl, supabaseServiceKey)

  const { searchParams } = new URL(req.url)
  const code = searchParams.get('code')
  const state = searchParams.get('state')
  
  if (!code) return NextResponse.redirect(new URL('/?error=no_code', req.url))

  // 1. Verify CSRF state token
  const cookieStore = await cookies()
  const savedState = cookieStore.get('oauth_state')?.value

  if (!state || !savedState || state !== savedState) {
    console.error("OAuth CSRF failure: state mismatch")
    return NextResponse.redirect(new URL('/?error=invalid_state', req.url))
  }

  // 1.1 Verify userId binding
  const [nonce, stateUserId] = state.split('.')
  
  try {
    // 2. Exchange code for tokens
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

    // FIX 1-HOUR REFRESH BUG: Add explicit expiry_date based on Google's expires_in
    if (tokenData.expires_in) {
      tokenData.expiry_date = Date.now() + (tokenData.expires_in * 1000)
    }

    // 3. Identify the user strictly via Session (no fake state fallbacks allowed!)
    const { data: { user } } = await supabase.auth.getUser()
    
    if (!user || user.id !== stateUserId) {
      console.error("OAuth session mismatch: State userId does not match session user.")
      return NextResponse.redirect(new URL('/?error=unauthorized_integration', req.url))
    }

    // 4. Encrypt the token object
    const encrypted = encrypt(JSON.stringify(tokenData))

    // 5. Upsert into database
    const { error: dbError } = await supabase
      .from("user_integrations")
      .upsert({
        user_id: user.id,
        service_name: "google",
        encrypted_secret: encrypted,
        updated_at: new Date().toISOString()
      }, { onConflict: 'user_id,service_name' })

    if (dbError) throw dbError

    // 6. Success! Redirect back to integrations view
    const response = NextResponse.redirect(new URL('/?view=integrations&status=connected', req.url))
    response.cookies.delete('oauth_state')
    return response

  } catch (err: any) {
    console.error("Google Callback Error:", err)
    return NextResponse.redirect(new URL(`/?error=${encodeURIComponent(err.message)}`, req.url))
  }
}
