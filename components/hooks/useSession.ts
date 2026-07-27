"use client";
import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";

export function useSession() {
  const [session, setSession] = useState<any>(null);
  const [sessionLoading, setSessionLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setSessionLoading(false);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (_event, session) => {
      setSession(session);
      
      // Save OAuth tokens to user_tokens table
      if (session?.provider_token) {
        const identities = session.user.identities || [];
        const latestIdentity = identities.reduce((prev, current) =>
          new Date(prev.updated_at || 0).getTime() > new Date(current.updated_at || 0).getTime() ? prev : current
        );
        const provider = latestIdentity ? latestIdentity.provider : session.user.app_metadata.provider;

        // LinkedIn is handled by the custom OAuth flow (/api/linkedin/oauth/*),
        // which stores a refresh token. Never let a Supabase login overwrite that
        // row with a refresh-less token — it would break auto-renewal.
        if (provider === "linkedin_oidc" || provider === "linkedin") {
          return;
        }

        await supabase.from("user_tokens").upsert(
          {
            user_id: session.user.id,
            provider: provider,
            access_token: session.provider_token,
            refresh_token: session.provider_refresh_token || null,
            updated_at: new Date().toISOString(),
          },
          { onConflict: "user_id, provider" }
        );
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (!sessionLoading && !session) {
      router.push('/');
    }
  }, [sessionLoading, session, router]);

  return { session, sessionLoading };
}