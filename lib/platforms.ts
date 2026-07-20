// Platform constants to avoid magic strings throughout the codebase
// Use these instead of hardcoding platform names

export const PLATFORMS = {
  X: "x",
  LINKEDIN: "linkedin",
  DISCORD: "discord",
  SLACK: "slack",
  EMAIL: "email",
} as const;

export type PlatformKey = typeof PLATFORMS[keyof typeof PLATFORMS];

// Platform metadata for UI display and features
export const PLATFORM_METADATA = [
  {
    id: PLATFORMS.X,
    shortLabel: "X",
    fullName: "X (Twitter)",
    tooltip: "Opens tweet intent in new tab",
  },
  {
    id: PLATFORMS.LINKEDIN,
    shortLabel: "LI",
    fullName: "LinkedIn",
    tooltip: "Direct OAuth post with image support",
  },
  {
    id: PLATFORMS.DISCORD,
    shortLabel: "DC",
    fullName: "Discord",
    tooltip: "Send via webhook (configure in Settings)",
  },
  {
    id: PLATFORMS.SLACK,
    shortLabel: "SL",
    fullName: "Slack",
    tooltip: "Send via webhook (configure in Settings)",
  },
  {
    id: PLATFORMS.EMAIL,
    shortLabel: "EM",
    fullName: "Email",
    tooltip: "Send newsletter to your subscribers",
  },
] as const;

// API endpoint mappings for each platform
export const PLATFORM_API_ENDPOINTS = {
  [PLATFORMS.X]: "/api/publish/x",
  [PLATFORMS.LINKEDIN]: "/api/publish/linkedin",
  [PLATFORMS.DISCORD]: "/api/post-discord",
  [PLATFORMS.SLACK]: "/api/publish/slack",
  [PLATFORMS.EMAIL]: "/api/schedule",
} as const;

// OAuth provider names (may differ from platform IDs)
export const OAUTH_PROVIDERS = {
  X: "x",
  LINKEDIN: "linkedin_oidc",
} as const;

// Provider scopes for OAuth
export const OAUTH_SCOPES = {
  X: "tweet.read tweet.write users.read offline.access",
  LINKEDIN: "w_member_social openid profile email",
} as const;

// Platform categories
export const PLATFORM_CATEGORIES = {
  SOCIAL: [PLATFORMS.X, PLATFORMS.LINKEDIN],
  WEBHOOK: [PLATFORMS.DISCORD, PLATFORMS.SLACK],
  DIRECT: [PLATFORMS.EMAIL],
} as const;

// Helper functions
export function getPlatformMetadata(platformId: PlatformKey) {
  return PLATFORM_METADATA.find((p) => p.id === platformId);
}

export function getPlatformLabel(platformId: PlatformKey): string {
  return getPlatformMetadata(platformId)?.fullName || platformId;
}

export function getPlatformShortLabel(platformId: PlatformKey): string {
  return getPlatformMetadata(platformId)?.shortLabel || platformId.toUpperCase();
}

export function getApiEndpoint(platformId: PlatformKey): string {
  return PLATFORM_API_ENDPOINTS[platformId] || "";
}

export function isWebhookPlatform(
  platformId: PlatformKey
): platformId is typeof PLATFORMS.DISCORD | typeof PLATFORMS.SLACK {
  return (PLATFORM_CATEGORIES.WEBHOOK as readonly PlatformKey[]).includes(platformId);
}

export function isSocialPlatform(
  platformId: PlatformKey
): platformId is typeof PLATFORMS.X | typeof PLATFORMS.LINKEDIN {
  return (PLATFORM_CATEGORIES.SOCIAL as readonly PlatformKey[]).includes(platformId);
}

export function isOAuthPlatform(
  platformId: PlatformKey
): platformId is typeof PLATFORMS.X | typeof PLATFORMS.LINKEDIN {
  return platformId === PLATFORMS.X || platformId === PLATFORMS.LINKEDIN;
}

export function getOAuthScope(provider: (typeof OAUTH_PROVIDERS)[keyof typeof OAUTH_PROVIDERS]): string {
  if (provider === OAUTH_PROVIDERS.X) return OAUTH_SCOPES.X;
  if (provider === OAUTH_PROVIDERS.LINKEDIN) return OAUTH_SCOPES.LINKEDIN;
  return "";
}
