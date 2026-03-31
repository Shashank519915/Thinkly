import { NextResponse } from "next/server"

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url)
  const userId = searchParams.get('userId')
  if (!userId) return NextResponse.json({ error: "Missing userId" }, { status: 400 })

  const clientId = process.env.GOOGLE_CLIENT_ID
  const redirectUri = `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/api/auth/google/callback`
  
  // Security Fix: Generate a cryptographically secure random string instead of raw userId
  const oauthState = crypto.randomUUID()
  
  // Scopes for Sheet and Gmail
  const scopes = [
    'https://www.googleapis.com/auth/spreadsheets',
    'https://www.googleapis.com/auth/gmail.send',
    'https://www.googleapis.com/auth/userinfo.email',
    'openid'
  ].join(' ')

  const url = `https://accounts.google.com/o/oauth2/v2/auth?` + 
    `client_id=${clientId}&` +
    `redirect_uri=${encodeURIComponent(redirectUri)}&` +
    `response_type=code&` +
    `scope=${encodeURIComponent(scopes)}&` +
    `access_type=offline&` +
    `state=${oauthState}&` +
    `prompt=consent`

  const response = NextResponse.json({ url })

  // Store state token securely in an HttpOnly cookie
  response.cookies.set('oauth_state', oauthState, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 15 * 60 // 15 minutes
  })

  return response
}
