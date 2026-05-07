import { NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { initiateGitHubConnection } from '@/lib/composio';

export async function POST(req: Request) {
  try {
    const cookieStore = await cookies();
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() { return cookieStore.getAll(); },
          setAll() { /* no-op */ },
        },
      },
    );
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Derive the app origin from the incoming request so this works correctly
    // in production even if NEXT_PUBLIC_APP_URL is misconfigured or missing.
    const reqUrl = new URL(req.url);
    const appOrigin =
      process.env.NEXT_PUBLIC_APP_URL ||
      `${reqUrl.protocol}//${reqUrl.host}`;
    const redirectUri = `${appOrigin}/api/composio/callback`;
    const redirectUrl = await initiateGitHubConnection(user.id, redirectUri);
    return NextResponse.json({ url: redirectUrl });
  } catch (error: any) {
    console.error('Composio auth error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}