import { createVertex } from "@ai-sdk/google-vertex";
import { ExternalAccountClient } from "google-auth-library";
import { getVercelOidcToken } from "@vercel/oidc";
import { CopilotRuntime, copilotRuntimeNextJSAppRouterEndpoint } from "@copilotkit/runtime";
import { BuiltInAgent } from "@copilotkit/runtime/v2";

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

  // Local dev — use the same service account key file as the rest of the app
  return createVertex({
    project: PROJECT_ID,
    location: "global",
    googleAuthOptions: { keyFilename: "gcp-service-account.json" },
  });
}

const vertex = buildVertex();

export function buildHandler() {
  const { handleRequest } = copilotRuntimeNextJSAppRouterEndpoint({
    runtime: new CopilotRuntime({
      agents: {
        default: new BuiltInAgent({
          model: vertex("gemini-3-flash-preview"),
          instructions: `You are an expert technical content engineering agent.
Your ONLY job is to generate highly structured, dense, filler-free technical briefs based on the user's notes.
You must absolutely avoid fluff, conversational filler, and generic introductions.
Always output: Audience, Outcome, and Suggested Structure (using H2s and H3s).
Explicitly note where internal/external links or code examples belong.`,
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
