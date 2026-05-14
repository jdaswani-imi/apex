import { createClient } from '@/lib/supabase/server'
import { syncWhoopData } from '@/lib/whoop/sync'
import { NextRequest, NextResponse } from 'next/server'

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get('code')
  const returnedState = searchParams.get('state')

  const savedState = request.cookies.get('whoop_oauth_state')?.value

  if (!savedState || returnedState !== savedState) {
    return NextResponse.redirect(`${origin}/?error=whoop_state_mismatch`)
  }

  const whoopError = searchParams.get('error')
  const whoopErrorDescription = searchParams.get('error_description')

  if (!code) {
    const msg = whoopError
      ? `${whoopError}: ${whoopErrorDescription ?? 'no description'}`
      : 'whoop_no_code'
    console.error('Whoop callback missing code:', msg)
    return NextResponse.redirect(`${origin}/?error=${encodeURIComponent(msg)}`)
  }

  const tokenRes = await fetch('https://api.prod.whoop.com/oauth/oauth2/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'authorization_code',
      code,
      client_id: process.env.WHOOP_CLIENT_ID!,
      client_secret: process.env.WHOOP_CLIENT_SECRET!,
      redirect_uri: process.env.WHOOP_REDIRECT_URI!,
    }),
  })

  if (!tokenRes.ok) {
    // Log only the HTTP status — the response body may contain OAuth error details
    // that should not be written to logs in production.
    console.error('Whoop token exchange failed with status:', tokenRes.status)
    return NextResponse.redirect(`${origin}/?error=whoop_token_failed`)
  }

  const tokens = await tokenRes.json()

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.redirect(`${origin}/login`)

  const expiresAt = new Date(Date.now() + tokens.expires_in * 1000).toISOString()
  await supabase.from('whoop_tokens').upsert({
    user_id: user.id,
    access_token: tokens.access_token,
    refresh_token: tokens.refresh_token ?? null,
    expires_at: expiresAt,
    updated_at: new Date().toISOString(),
  })

  await syncWhoopData(user.id, 14).catch(() => {})

  const response = NextResponse.redirect(`${origin}/?whoop=connected`)
  response.cookies.delete('whoop_oauth_state')
  return response
}
