"use client";
import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase/client";
import { PLATFORMS } from "@/lib/platforms";

export function useCampaignHistory(userId?: string) {
  const [pastCampaigns, setPastCampaigns] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchHistory = async (uid: string) => {
    setLoading(true);
    const { data, error } = await supabase
      .from("campaigns")
      .select("*")
      .eq("user_id", uid)
      .order("created_at", { ascending: false });
    if (error) {
      console.error("Campaign fetch error:", error);
    } else {
      setPastCampaigns(data || []);
    }
    setLoading(false);
  };

  useEffect(() => {
    if (userId) {
      fetchHistory(userId);
    }
  }, [userId]);

  // generated_content comes in two shapes: legacy rows store the bare campaign
  // array; newer rows store { campaign, email } so newsletters can be restored.
  const parseGeneratedContent = (raw: any): { campaign: any[]; email: string | null } => {
    let parsed = raw;
    if (typeof parsed === "string") {
      try { parsed = JSON.parse(parsed); } catch { parsed = null; }
    }
    if (Array.isArray(parsed)) return { campaign: parsed, email: null };
    return {
      campaign: Array.isArray(parsed?.campaign) ? parsed.campaign : [],
      email: typeof parsed?.email === "string" && parsed.email.trim() ? parsed.email : null,
    };
  };

  const restoreCampaign = (
    record: any,
    setInputs: any,
    setCampaign: any,
    setEmailContent?: (email: string | null) => void
  ) => {
    const isNewsletter = record.type === "newsletter";
    const { campaign, email } = parseGeneratedContent(record.generated_content);

    setInputs({
      url: record.source_url || "",
      text: record.source_notes || "",
      files: [],
      fileUrls: [],
      platforms: isNewsletter
        ? [PLATFORMS.EMAIL]
        : [PLATFORMS.X, PLATFORMS.LINKEDIN, PLATFORMS.DISCORD],
      tweetFormat: "single",
      campaignName: record.name || "",
      additionalInfo: "",
      personaId: "default",
    });
    setCampaign(campaign);
    setEmailContent?.(email);
  };

  return { pastCampaigns, loading, fetchHistory, restoreCampaign };
}
