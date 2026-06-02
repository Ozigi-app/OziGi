import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";
import { phCapture } from "@/lib/posthog";

// LinkedIn REST API version — YYYYMM format used by /rest/* endpoints.
// 202601 = January 2026 — ~5 months old, safely released and within LinkedIn's
// 12-month rolling support window. Avoid versions newer than ~2 months (may not
// be active yet) or older than 12 months (expired).
// https://learn.microsoft.com/en-us/linkedin/marketing/versioning
const LI_VERSION = "202601";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function refreshLinkedInToken(refreshToken: string) {
  const tokenUrl = "https://www.linkedin.com/oauth/v2/accessToken";
  const params = new URLSearchParams({
    grant_type: "refresh_token",
    refresh_token: refreshToken,
    client_id: process.env.LINKEDIN_CLIENT_ID!,
    client_secret: process.env.LINKEDIN_CLIENT_SECRET!,
  });

  const response = await fetch(tokenUrl, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: params.toString(),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Token refresh failed: ${response.status} ${errorText}`);
  }

  return await response.json();
}

export async function POST(req: Request) {
  try {
    const { text, userId, imageUrl, imageUrls, documentBase64, documentTitle, accessToken: providedToken } = await req.json();

    // Normalise: accept either `imageUrl` (legacy, single string) or `imageUrls` (array).
    // Deduplicate and cap at LinkedIn's 9-image limit.
    const rawImageList: string[] = imageUrls
      ? (Array.isArray(imageUrls) ? imageUrls : [imageUrls])
      : imageUrl
      ? [imageUrl]
      : [];
    const imageList = rawImageList.slice(0, 9);
    const authHeader = req.headers.get("Authorization");

    let linkedInToken: string | null = null;
    let refreshToken: string | null = null;

    // Token retrieval logic (unchanged)
    if (providedToken) {
      linkedInToken = providedToken;
    } else if (userId) {
      const { data: tokenData, error: tokenError } = await supabaseAdmin
        .from("user_tokens")
        .select("access_token, refresh_token")
        .eq("user_id", userId)
        .in("provider", ["linkedin", "linkedin_oidc"])
        .maybeSingle();
      if (tokenError || !tokenData) {
        return NextResponse.json({ error: `No LinkedIn token found for user ${userId}` }, { status: 401 });
      }
      linkedInToken = tokenData.access_token;
      refreshToken = tokenData.refresh_token;
    } else if (authHeader) {
      const supabase = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
        { global: { headers: { Authorization: authHeader } } }
      );
      const { data: { user }, error: authError } = await supabase.auth.getUser();
      if (authError || !user) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
      }
      const { data: tokenData, error: tokenError } = await supabase
        .from("user_tokens")
        .select("access_token, refresh_token")
        .eq("user_id", user.id)
        .in("provider", ["linkedin", "linkedin_oidc"])
        .maybeSingle();
      if (tokenError || !tokenData) {
        return NextResponse.json({ error: `No LinkedIn token found for user ${user.id}` }, { status: 401 });
      }
      linkedInToken = tokenData.access_token;
      refreshToken = tokenData.refresh_token;
    } else {
      return NextResponse.json({ error: "No token, user ID, or authorization header provided" }, { status: 401 });
    }

    if (!linkedInToken) {
      return NextResponse.json({ error: "Empty LinkedIn access token" }, { status: 401 });
    }

    // Convert each image URL to base64 (data URL). Fetch in parallel.
    const finalImageBase64List: string[] = (
      await Promise.all(
        imageList.map(async (url) => {
          if (url.startsWith("data:")) return url;
          const imageRes = await fetch(url);
          if (!imageRes.ok) {
            console.error(`Failed to fetch image ${url}: ${imageRes.status}`);
            return null;
          }
          const mimeType = imageRes.headers.get("content-type") || "image/jpeg";
          const buf = await imageRes.arrayBuffer();
          return `data:${mimeType};base64,${Buffer.from(buf).toString("base64")}`;
        })
      )
    ).filter((x): x is string => x !== null);

    // Helper to post to LinkedIn
    async function postToLinkedIn(token: string) {
      // Fetch user's LinkedIn profile
      const profileRes = await fetch("https://api.linkedin.com/v2/userinfo", {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!profileRes.ok) {
        throw new Error(`Failed to authenticate token with LinkedIn: ${profileRes.status}`);
      }
      const profileData = await profileRes.json();
      const authorUrn = `urn:li:person:${profileData.sub}`;

      const assetUrns: string[] = [];
      let isDocument = false;

      // Upload PDF document (carousel) if present
      if (documentBase64) {
        isDocument = true;

        let pdfBase64 = documentBase64;
        if (pdfBase64.includes("data:")) {
          pdfBase64 = pdfBase64.split(",")[1] || pdfBase64;
        }
        const pdfBuffer = Buffer.from(pdfBase64, "base64");

        // Step 1: Initialize upload using the correct document endpoint
        const initRes = await fetch(
          "https://api.linkedin.com/rest/documents?action=initializeUpload",
          {
            method: "POST",
            headers: {
              Authorization: `Bearer ${token}`,
              "Content-Type": "application/json",
              "LinkedIn-Version": LI_VERSION,
              "X-Restli-Protocol-Version": "2.0.0",
            },
            body: JSON.stringify({
              initializeUploadRequest: {
                owner: authorUrn,
              },
            }),
          }
        );

        if (!initRes.ok) {
          const errText = await initRes.text();
          throw new Error(
            `Failed to initialize document upload: ${initRes.status} ${errText}`
          );
        }

        const initData = await initRes.json();
        const uploadUrl = initData.value?.uploadUrl;
        const documentUrn = initData.value?.document;

        if (!uploadUrl || !documentUrn) {
          throw new Error("LinkedIn did not return an upload URL for the document.");
        }

        // Step 2: Upload the PDF bytes
        const uploadRes = await fetch(uploadUrl, {
          method: "PUT",
          headers: {
            "Content-Type": "application/octet-stream",
          },
          body: pdfBuffer,
        });

        if (!uploadRes.ok) {
          const errorText = await uploadRes.text();
          throw new Error(
            `Failed to upload document to LinkedIn: ${uploadRes.status} ${errorText}`
          );
        }

        // Step 3: Set assetUrns to the document URN for the post payload
        assetUrns.push(documentUrn);

        // LinkedIn needs time to process the document
        await new Promise((resolve) => setTimeout(resolve, 3000));
      }

      // Upload each image sequentially and collect asset URNs
      for (const imageBase64 of finalImageBase64List) {
        const base64Data = imageBase64.replace(/^data:image\/\w+;base64,/, "");
        const imageBuffer = Buffer.from(base64Data, "base64");

        const registerRes = await fetch(
          "https://api.linkedin.com/v2/assets?action=registerUpload",
          {
            method: "POST",
            headers: {
              Authorization: `Bearer ${token}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              registerUploadRequest: {
                recipes: ["urn:li:digitalmediaRecipe:feedshare-image"],
                owner: authorUrn,
                serviceRelationships: [
                  {
                    relationshipType: "OWNER",
                    identifier: "urn:li:userGeneratedContent",
                  },
                ],
              },
            }),
          }
        );

        const registerData = await registerRes.json();
        const uploadUrl =
          registerData.value.uploadMechanism[
            "com.linkedin.digitalmedia.uploading.MediaUploadHttpRequest"
          ].uploadUrl;
        const assetUrn = registerData.value.asset;

        const uploadRes = await fetch(uploadUrl, {
          method: "PUT",
          headers: { "Content-Type": "application/octet-stream" },
          body: imageBuffer,
        });

        if (!uploadRes.ok) {
          const errorText = await uploadRes.text();
          console.error("Image Upload Failed:", errorText);
          throw new Error("Failed to upload an image to LinkedIn's server.");
        }

        assetUrns.push(assetUrn);
        // Brief pause between uploads to avoid rate limits
        await new Promise((resolve) => setTimeout(resolve, 1000));
      }

      // After all images are uploaded, wait for LinkedIn to process them
      if (finalImageBase64List.length > 0) {
        await new Promise((resolve) => setTimeout(resolve, 2000));
      }

      // Create the post
      // Document posts must use the newer /rest/posts API; image/text posts use /v2/ugcPosts
      let postRes: Response;

      if (isDocument && assetUrns.length > 0) {
        // Use /rest/posts for document (carousel) posts
        const restPostPayload = {
          author: authorUrn,
          commentary: text,
          visibility: "PUBLIC",
          distribution: {
            feedDistribution: "MAIN_FEED",
            targetEntities: [],
            thirdPartyDistributionChannels: [],
          },
          content: {
            media: {
              title: documentTitle || "Carousel",
              id: assetUrns[0],
            },
          },
          lifecycleState: "PUBLISHED",
          isReshareDisabledByAuthor: false,
        };

        postRes = await fetch("https://api.linkedin.com/rest/posts", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
            "X-Restli-Protocol-Version": "2.0.0",
            "LinkedIn-Version": LI_VERSION,
          },
          body: JSON.stringify(restPostPayload),
        });
      } else {
        // Use /v2/ugcPosts for image (single or multi) or text-only posts
        let shareMediaCategory: string;
        let media: { status: string; media: string }[];

        if (assetUrns.length > 0) {
          shareMediaCategory = "IMAGE";
          media = assetUrns.map((urn) => ({ status: "READY", media: urn }));
        } else {
          shareMediaCategory = "NONE";
          media = [];
        }

        const ugcPostPayload = {
          author: authorUrn,
          lifecycleState: "PUBLISHED",
          specificContent: {
            "com.linkedin.ugc.ShareContent": {
              shareCommentary: { text },
              shareMediaCategory,
              media,
            },
          },
          visibility: { "com.linkedin.ugc.MemberNetworkVisibility": "PUBLIC" },
        };

        postRes = await fetch("https://api.linkedin.com/v2/ugcPosts", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
            "X-Restli-Protocol-Version": "2.0.0",
            "LinkedIn-Version": LI_VERSION,
          },
          body: JSON.stringify(ugcPostPayload),
        });
      }

      if (!postRes.ok) {
        const errText = await postRes.text();
        throw new Error(`Failed to create post: ${postRes.status} ${errText}`);
      }

      // /rest/posts returns 201 with no body; /v2/ugcPosts returns JSON
      let postData: any = {};
      const contentType = postRes.headers.get("content-type") || "";
      if (contentType.includes("application/json")) {
        postData = await postRes.json();
      }
      console.log("[v0] Post created successfully", { isDocument });
      return postData;
    }
    // Attempt to post
    let postResult;
    try {
      postResult = await postToLinkedIn(linkedInToken);
    } catch (error: any) {
      console.error("Post attempt failed:", error.message);
      if (error.message.includes("401") && refreshToken) {
        console.log("LinkedIn token expired, refreshing...");
        const newTokenData = await refreshLinkedInToken(refreshToken);
        await supabaseAdmin
          .from("user_tokens")
          .update({
            access_token: newTokenData.access_token,
            refresh_token: newTokenData.refresh_token || refreshToken,
            updated_at: new Date().toISOString(),
          })
          .eq("user_id", userId)
          .eq("provider", "linkedin_oidc");
        postResult = await postToLinkedIn(newTokenData.access_token);
      } else {
        throw error;
      }
    }

    await supabaseAdmin.rpc("increment_posts_published", { user_id_input: userId });

    phCapture(userId ?? 'unknown', 'content_published_linkedin', {
      hasImage: imageList.length > 0,
      imageCount: imageList.length,
      hasDocument: !!documentBase64,
      postType: documentBase64 ? 'carousel' : imageList.length > 0 ? 'image' : 'text',
      charCount: text?.length,
    }).catch(() => {})

    return NextResponse.json({
      success: true,
      postId: postResult?.id,
      message: "Post published successfully",
    });
  } catch (error: any) {
    console.error("LinkedIn API Error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
