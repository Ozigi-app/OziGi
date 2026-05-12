"use client";
import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase/client";

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

  const restoreCampaign = (record: any, setInputs: any, setCampaign: any) => {
    setInputs({
      url: record.source_url || "",
      text: record.source_notes || "",
      files: [],
      fileUrls: [],
      platforms: ["x", "linkedin", "discord", "email"],
      tweetFormat: "single",
      campaignName: record.name || "",
      additionalInfo: "",
      personaId: "default",
    });
    const content = Array.isArray(record.generated_content)
      ? record.generated_content
      : typeof record.generated_content === "string"
      ? (() => { try { const p = JSON.parse(record.generated_content); return Array.isArray(p) ? p : []; } catch { return []; } })()
      : [];
    setCampaign(content);
  };

  return { pastCampaigns, loading, fetchHistory, restoreCampaign };
}