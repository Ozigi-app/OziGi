import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'
import { phCapture } from '@/lib/posthog'

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get('code')
  const next = searchParams.get('next') ?? '/dashboard'

console.log("Auth callback called, code present:", !!code);
  if (code) {
    const cookieStore = await cookies()
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() {
            return cookieStore.getAll()
          },
          setAll(cookiesToSet) {
            try {
              cookiesToSet.forEach(({ name, value, options }) =>
                cookieStore.set(name, value, options)
              )
            } catch {
              // Ignored if middleware handles it
            }
          },
        },
      }
    )

    const { data, error } = await supabase.auth.exchangeCodeForSession(code)
    console.log("Exchange result:", { data, error });

    if (!error && data.user) {
      const user = data.user
      console.log("User signed in:", user.email);

      // Only send welcome email on first-ever sign-up.
      // Compare created_at to now — new accounts are created within the last 30s.
      const createdAt = new Date(user.created_at).getTime();
      const isNewUser = Date.now() - createdAt < 30_000;

      if (isNewUser) {
        const userEmail = user.email
        const userName = user.user_metadata?.full_name || userEmail?.split('@')[0] || 'there'

        fetch(`${origin}/api/send-welcome`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-internal-secret': process.env.CRON_SECRET ?? '',
          },
          body: JSON.stringify({ email: userEmail, name: userName }),
        }).catch(err => console.error('Welcome email fetch error:', err))

        phCapture(user.id, 'user_signed_up', {
          email: user.email,
          provider: user.app_metadata?.provider,
          name: user.user_metadata?.full_name,
        }).catch(() => {})
      } else {
        phCapture(user.id, 'user_signed_in', {
          email: user.email,
          provider: user.app_metadata?.provider,
        }).catch(() => {})
      }

      return NextResponse.redirect(`${origin}${next}`)
    }
  }

  console.error("Exchange failed, redirecting to error");
  return NextResponse.redirect(`${origin}/auth-error`)
}