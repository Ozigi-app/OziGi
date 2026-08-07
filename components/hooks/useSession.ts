"use client";
import { useState, useEffect, useRef } from "react";
import { supabase } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";

export function useSession() {
  const [session, setSession] = useState<any>(null);
  const [sessionLoading, setSessionLoading] = useState(true);
  const router = useRouter();
  const autoClaimedRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    // An AppSumo buyer whose license was never attached to their account — see
    // /api/appsumo/auto-claim. Fires at most once per user per tab, costs one
    // cheap read for everyone else, and never blocks sign-in.
    const maybeAutoClaim = async (userId: string) => {
      if (autoClaimedRef.current.has(userId)) return;
      autoClaimedRef.current.add(userId);

      const flag = `appsumo_autoclaim_${userId}`;
      try {
        if (sessionStorage.getItem(flag)) return;
      } catch {
        // Private mode / storage disabled — the in-memory ref still dedupes.
      }

      try {
        const res = await fetch("/api/appsumo/auto-claim", { method: "POST" });
        const data = await res.json();
        try { sessionStorage.setItem(flag, "1"); } catch {}
        // Plan-gated UI is read per-page on the client, so a reload is the
        // reliable way to show the upgrade. Only ever runs on a real claim.
        if (data?.claimed) window.location.reload();
      } catch {
        // Leave the flag unset so a later visit retries.
      }
    };

    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setSessionLoading(false);
      if (session?.user?.id) maybeAutoClaim(session.user.id);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (_event, session) => {
      setSession(session);

      if (session?.user?.id) maybeAutoClaim(session.user.id);

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