export const maxDuration = 60; // Cap streaming AI sessions to 60s on Hobby plan

import { streamText } from "ai";
import { createVertex } from "@ai-sdk/google-vertex";
import { ExternalAccountClient } from "google-auth-library";
import { getVercelOidcToken } from "@vercel/oidc";
import { CopilotRuntime, copilotRuntimeNextJSAppRouterEndpoint } from "@copilotkit/runtime";
import { BuiltInAgent, convertMessagesToVercelAISDKMessages } from "@copilotkit/runtime/v2";

const PROJECT_ID = process.env.GCP_PROJECT_ID || "ozigi-489021";

function buildVertex() {
  const isVercelEnv = process.env.VERCEL || process.env.VERCEL_ENV || process.env.VERCEL_URL;

  if (isVercelEnv) {
    const projectNumber = process.env.GCP_PROJECT_NUMBER?.trim();
    const poolId = process.env.GCP_WORKLOAD_IDENTITY_POOL_ID?.trim();
    const providerId = process.env.GCP_WORKLOAD_IDENTITY_POOL_PROVIDER_ID?.trim();
    const saEmail = process.env.GCP_SERVICE_ACCOUNT_EMAIL?.trim();
    const audience = `//iam.googleapis.com/projects/${projectNumber}/locations/global/workloadIdentityPools/${poolId}/providers/${providerId}`;

    const authClient = ExternalAccountClient.fromJSON({
      type: "external_account",
      audience,
      subject_token_type: "urn:ietf:params:oauth:token-type:jwt",
      token_url: "https://sts.googleapis.com/v1/token",
      service_account_impersonation_url: `https://iamcredentials.googleapis.com/v1/projects/-/serviceAccounts/${saEmail}:generateAccessToken`,
      subject_token_supplier: {
        getSubjectToken: async () => await getVercelOidcToken(),
      },
    });

    return createVertex({
      project: PROJECT_ID,
      location: "global",
      googleAuthOptions: { authClient: authClient! },
    });
  }

  return createVertex({
    project: PROJECT_ID,
    location: "global",
    googleAuthOptions: { keyFilename: "gcp-service-account.json" },
  });
}

const vertex = buildVertex();

const SYSTEM_PROMPT = `You are a principal technical content strategist who writes editorial briefs for engineering blogs read by senior developers and practitioners.

MISSION: Convert rough user notes/topics into dense, publication-ready technical briefs that senior writers use as blueprints. Every brief must be immediately actionable — a writer should be able to produce a fully-formed draft from it with zero additional research prompts.

ABSOLUTE RULES:
1. Output Markdown headings (## and ###) ONLY. Do NOT wrap your output in code fences.
2. Every bullet point must be substantive — no vague placeholders like "discuss X" or "explore Y". Write what specifically to say, with specific technical depth.
3. Zero filler. Zero generic sentences. Zero phrases like "In this article we will explore" or "Introduction to".
4. Name specific tools, APIs, packages, versions, patterns, and failure modes relevant to the topic.
5. Mark where code examples belong with [Code example: <description of what to show>].
6. Mark internal link placements with [Internal link: <topic>] and external links with [External link: <URL or description>].
7. If web search results are available to you, incorporate real, specific URLs in the Research Anchors section. Do not make up URLs.

REQUIRED OUTPUT STRUCTURE — always output all five sections:

## Audience
Who specifically reads this: their exact role and seniority level, their current tool stack, their active pain points, and what technical knowledge is assumed. Be specific enough that a writer could picture a real person.

## Outcome
What readers can CONCRETELY do, avoid, or implement after reading. Not "understand X" — instead: "be able to implement X pattern in Y context without Z failure mode".

## Key Arguments
3–5 core intellectual claims that are the thesis of the article. Each is a single, assertive sentence — a claim, not a topic summary. These are the "aha moments" the article must deliver.

## Suggested Structure
Full breakdown of H2s and H3s with 3–5 substantive bullets under each heading describing what to actually write — not what topic to cover, but what to say. Include:
- An opening hook suggestion under the Introduction heading
- [Code example: X] callouts where code belongs
- [Internal link: X] / [External link: X] callouts at the right spots
- Specific tools, APIs, or patterns to reference in each section

## Research Anchors
5–10 specific, real sources (official docs, papers, blog posts, GitHub repos, RFCs) the writer must read before writing. Format each as:
[Source name] — [URL] — [Why it's essential for this specific article]
Prioritize sources found via web search. Do not fabricate URLs.`;


export function buildHandler() {
  const { handleRequest } = copilotRuntimeNextJSAppRouterEndpoint({
    runtime: new CopilotRuntime({
      agents: {
        // Factory mode: we own the streamText call — no state tools are injected,
        // so the output streams directly as chat text into CopilotSidebar.
        default: new BuiltInAgent({
          type: "aisdk",
          factory: async ({ input, abortSignal }) => {
            const sdkMessages = convertMessagesToVercelAISDKMessages(input.messages);
            return streamText({
              model: vertex("gemini-3-flash-preview"),
              system: SYSTEM_PROMPT,
              messages: sdkMessages,
              abortSignal,
              tools: {
                googleSearch: vertex.tools.googleSearch({}),
              },
            });
          },
        }),
      },
    }),
    endpoint: "/api/copilotkit",
  });
  return handleRequest;
}

const handler = buildHandler();
export const GET = handler;
export const POST = handler;
