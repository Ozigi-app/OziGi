"use client";
import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase/client';

export interface PlanStatus {
  plan: 'free' | 'starter' | 'growth' | 'pro' | 'enterprise';
  // Content engine
  canGenerate: boolean;
  generationsUsed: number;
  generationsLimit: number;
  imageGenUsed: number;
  imageGenLimit: number;
  emailSendsUsed: number;
  emailSendsLimit: number;
  hasCopilot: boolean;
  hasLongForm: boolean;
  longFormUsed: number;
  longFormLimit: number;
  hasScheduling: boolean;
  newsletterSendingEnabled: boolean;
  // GTM / outbound
  hasGtm: boolean;
  canRunCampaigns: boolean;
  activeCampaignsUsed: number;
  activeCampaignsLimit: number;
  creditsUsed: number;
  creditsLimit: number;
  creditsBalance: number;
  sequenceSendsUsed: number;
  sequenceSendsLimit: number;
  hasLinkedInOutreach: boolean;
  hasCrmSync: boolean;
  hasMultiInbox: boolean;
  hasReplyDetection: boolean;
  isEnterprise: boolean;
}

const CACHE_KEY = "ozigi_plan_status";
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

export function usePlanStatus() {
  const [planStatus, setPlanStatus] = useState<PlanStatus | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchPlanStatus = async () => {
      setLoading(true);
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) {
        setLoading(false);
        return;
      }
      try {
        const res = await fetch("/api/user/stats", {
          headers: { Authorization: `Bearer ${session.access_token}` },
        });
        if (res.ok) {
          const data = await res.json();
          setPlanStatus(data);
          localStorage.setItem(CACHE_KEY, JSON.stringify({ data, timestamp: Date.now() }));
        }
      } catch (err) {
        console.error("Failed to fetch plan status", err);
      } finally {
        setLoading(false);
      }
    };

    const cached = localStorage.getItem(CACHE_KEY);
    if (cached) {
      try {
        const { data, timestamp } = JSON.parse(cached);
        if (Date.now() - timestamp < CACHE_TTL) {
          setPlanStatus(data);
          setLoading(false);
          return;
        }
      } catch {}
    }

    fetchPlanStatus();
  }, []);

  return { planStatus, loading };
}
