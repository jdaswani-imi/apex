import { NextResponse } from 'next/server'

export async function GET() {
  const state = crypto.randomUUID()

  const params = new URLSearchParams({
    client_id: process.env.WHOOP_CLIENT_ID!,
    redirect_uri: process.env.WHOOP_REDIRECT_URI!,
    response_type: 'code',
    scope: 'read:recovery read:cycles read:sleep read:workout read:profile read:body_measurement',
    state,
  })

  const url = `https://api.prod.whoop.com/oauth/oauth2/auth?${params.toString()}`
  const response = NextResponse.redirect(url)

  response.cookies.set('whoop_oauth_state', state, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 600,
    path: '/',
  })

  return response
}
