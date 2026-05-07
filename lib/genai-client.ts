import { GoogleGenAI } from '@google/genai';
import { getVercelOidcToken } from '@vercel/oidc';
import { ExternalAccountClient } from 'google-auth-library';

export async function getVertexAIClient() {
  const projectId = process.env.GCP_PROJECT_ID || 'ozigi-489021';

  // Cloud Run sets K_SERVICE. Use Application Default Credentials (ADC) —
  // the service account attached to the Cloud Run service is used automatically.
  const isCloudRun = !!process.env.K_SERVICE;
  if (isCloudRun) {
    return new GoogleGenAI({
      vertexai: true,
      project: projectId,
      location: 'global',
    });
  }

  // Check for Vercel environment (production, preview, or v0 sandbox)
  const isVercelEnv = process.env.VERCEL || process.env.VERCEL_ENV || process.env.VERCEL_URL;

  if (isVercelEnv) {
    const projectNumber = process.env.GCP_PROJECT_NUMBER?.trim();
    const poolId = process.env.GCP_WORKLOAD_IDENTITY_POOL_ID?.trim();
    const providerId = process.env.GCP_WORKLOAD_IDENTITY_POOL_PROVIDER_ID?.trim();
    const saEmail = process.env.GCP_SERVICE_ACCOUNT_EMAIL?.trim();

    const audience = `//iam.googleapis.com/projects/${projectNumber}/locations/global/workloadIdentityPools/${poolId}/providers/${providerId}`;

    const authClient = ExternalAccountClient.fromJSON({
      type: 'external_account',
      audience,
      subject_token_type: 'urn:ietf:params:oauth:token-type:jwt',
      token_url: 'https://sts.googleapis.com/v1/token',
      service_account_impersonation_url: `https://iamcredentials.googleapis.com/v1/projects/-/serviceAccounts/${saEmail}:generateAccessToken`,
      subject_token_supplier: {
        getSubjectToken: async () => await getVercelOidcToken(),
      },
    });

    if (!authClient) {
      throw new Error('Failed to create external account client');
    }

    return new GoogleGenAI({
      vertexai: true,
      project: projectId,
      location: 'global',
      googleAuthOptions: {
        authClient,
      },
    });
  } else {
    // Local development – use service account key file
    return new GoogleGenAI({
      vertexai: true,
      project: projectId,
      location: 'global',
      googleAuthOptions: {
        keyFilename: 'gcp-service-account.json',
      },
    });
  }
}
