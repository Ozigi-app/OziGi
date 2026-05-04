import { createClient } from "@supabase/supabase-js";
import { NextRequest, NextResponse } from "next/server";

export async function GET(req: NextRequest) {
  try {
    const authHeader = req.headers.get("authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const token = authHeader.substring(7);

    // Use anon client only to verify the token / identify the user
    const supabaseAuth = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    );

    const {
      data: { user },
      error: userError,
    } = await supabaseAuth.auth.getUser(token);

    if (userError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Use the service-role admin client for the DB query so RLS cannot
    // block rows that were written by the same admin client during generation.
    const supabaseAdmin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    // Fetch all long-form generations for this user.
    // Filter by is_longform=true (platform='long-form' is not in the check constraint).
    const { data: articles, error: fetchError } = await supabaseAdmin
      .from("scheduled_posts")
      .select("id, subject, content, longform_sections, created_at")
      .eq("user_id", user.id)
      .eq("is_longform", true)
      .order("created_at", { ascending: false })
      .limit(50);

    console.log("[LongForm History] Fetch query - user_id:", user.id);
    console.log("[LongForm History] Fetch result - articles count:", articles?.length);
    console.log("[LongForm History] Fetch error:", fetchError);

    if (fetchError) {
      console.error("[LongForm History] Fetch error:", fetchError);
      return NextResponse.json(
        { error: "Failed to fetch history" },
        { status: 500 }
      );
    }

    // Parse and format the articles
    const formattedArticles = (articles || []).map((article: any) => {
      let sections: any[] = [];
      let meta: any = {};
      try {
        if (article.longform_sections && Array.isArray(article.longform_sections)) {
          // First element may be the embedded __meta object (written by generate route)
          const [first, ...rest] = article.longform_sections;
          if (first?.__meta) {
            meta = first;
            sections = rest;
          } else {
            sections = article.longform_sections;
          }
        }
      } catch (e) {
        console.error("[LongForm History] Parse error:", e);
      }

      return {
        id: article.id,
        title: article.subject,
        subtitle: meta.subtitle,
        content: article.content,
        totalWordCount: meta.totalWordCount || 0,
        tone: meta.tone || "unknown",
        structure: meta.structure || "unknown",
        depth: meta.depth,
        webResearch: meta.webResearch ?? false,
        references: Array.isArray(meta.references) ? meta.references : [],
        researchQueries: Array.isArray(meta.researchQueries) ? meta.researchQueries : [],
        sections,
        createdAt: article.created_at,
      };
    });

    console.log("[LongForm History] Formatted articles:", {
      count: formattedArticles.length,
      sample: formattedArticles[0] ? {
        title: formattedArticles[0].title,
        sections_count: formattedArticles[0].sections.length,
      } : null,
    });

    return NextResponse.json({
      success: true,
      articles: formattedArticles,
      count: formattedArticles.length,
    });
  } catch (error: any) {
    console.error("[LongForm History] Error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
