import { createClient } from "@supabase/supabase-js"
import { decrypt, encrypt } from "@/lib/crypto"

export async function getGoogleAuth(userId: string) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!
  
  if (!supabaseServiceKey) throw new Error("Missing SUPABASE_SERVICE_ROLE_KEY in environment.")

  const supabase = createClient(supabaseUrl, supabaseServiceKey)

  // 1. Fetch encrypted tokens
  const { data: integ, error } = await supabase
    .from("user_integrations")
    .select("encrypted_secret")
    .eq("user_id", userId)
    .eq("service_name", "google")
    .maybeSingle()

  if (error || !integ) throw new Error("Google Workspace not connected.")

  // 2. Decrypt tokens
  const tokens = JSON.parse(decrypt(integ.encrypted_secret))

  // 3. Check expiry (simple buffer of 5 mins)
  // FIX: If expiry_date is missing (due to legacy bug), force a refresh if possible
  const isExpired = !tokens.expiry_date || (Date.now() > tokens.expiry_date - 300000)

  if (isExpired && tokens.refresh_token) {
    // 4. Refresh token
    const res = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: process.env.GOOGLE_CLIENT_ID!,
        client_secret: process.env.GOOGLE_CLIENT_SECRET!,
        refresh_token: tokens.refresh_token,
        grant_type: 'refresh_token'
      })
    })

    const newTokens = await res.json()
    if (!res.ok) throw new Error("Failed to refresh Google token")

    // Update with new data (keep the old refresh_token if not provided)
    const updatedTokens = {
      ...tokens,
      ...newTokens,
      expiry_date: Date.now() + (newTokens.expires_in * 1000)
    }

    // Save back to DB (encrypted)
    const encrypted = encrypt(JSON.stringify(updatedTokens))
    await supabase
      .from("user_integrations")
      .update({ encrypted_secret: encrypted })
      .eq("user_id", userId)
      .eq("service_name", "google")

    return updatedTokens.access_token
  }

  return tokens.access_token
}

export async function sendGmail(accessToken: string, to: string, subject: string, body: string) {
  const message = [
    `To: ${to}`,
    `Subject: ${subject}`,
    `Content-Type: text/plain; charset="UTF-8"`,
    '',
    body
  ].join('\n')

  const encodedMessage = Buffer.from(message)
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '')

  const res = await fetch(`https://gmail.googleapis.com/gmail/v1/users/me/messages/send`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ raw: encodedMessage })
  })

  if (!res.ok) {
    const err = await res.json()
    throw new Error(err.error?.message || "Gmail send failed")
  }

  return await res.json()
}

export async function appendToSheet(accessToken: string, spreadsheetId: string, range: string, values: any[][]) {
  const res = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${range}:append?valueInputOption=USER_ENTERED`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ values })
  })

  if (!res.ok) {
    const err = await res.json()
    throw new Error(err.error?.message || "Sheets append failed")
  }

  return await res.json()
}
