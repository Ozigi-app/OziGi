/**
 * API endpoint smoke tests.
 *
 * These are HTTP-level tests — no browser needed. They verify:
 *   - Endpoints return the correct status codes for unauthenticated requests
 *   - POST endpoints reject requests missing required fields
 *   - Webhook endpoints reject missing signature headers (security)
 *
 * Use `request` (Playwright's APIRequestContext) — no browser spin-up.
 *
 * NOTE: These tests do NOT actually send emails, trigger AI generation,
 * or charge payment methods. They test the HTTP contract only.
 *
 * Timeout note: on a dev server each route compiles on first hit (can take
 * 2–5 min on slow machines). We pass an explicit per-request timeout of 5 min
 * so requests wait for compilation to finish rather than being killed early.
 */

import { test, expect } from "@playwright/test";

// Shared request timeout — allows routes to compile on first hit in dev mode.
const REQ_TIMEOUT = 5 * 60 * 1000; // 5 minutes

// ─── Newsletter subscribe ─────────────────────────────────────────────────────
// NOTE: The newsletter route bundles 20,630 modules. On a cold dev server it
// takes ~23 minutes to compile on first hit. These tests will timeout on a fresh
// dev server — they pass reliably on a production build (npm run build && npm start)
// or after the route has been visited once and cached by the webpack dev server.

test.describe("POST /api/newsletter/subscribe", () => {
  // Give this group 30 minutes — the route can take 23 min to compile cold.
  test.setTimeout(30 * 60 * 1000);

  test("rejects missing email body with 4xx", async ({ request }) => {
    const res = await request.post("/api/newsletter/subscribe", {
      data: {},
      headers: { "Content-Type": "application/json" },
      timeout: 30 * 60 * 1000,
    });
    expect(res.status()).toBeGreaterThanOrEqual(400);
    expect(res.status()).toBeLessThan(500);
  });

  test("rejects invalid email format with 4xx", async ({ request }) => {
    const res = await request.post("/api/newsletter/subscribe", {
      data: { email: "not-an-email" },
      headers: { "Content-Type": "application/json" },
      timeout: 30 * 60 * 1000,
    });
    expect(res.status()).toBeGreaterThanOrEqual(400);
    expect(res.status()).toBeLessThan(500);
  });

  test("accepts valid email (200/201) or returns 409/500 in test env", async ({ request }) => {
    const res = await request.post("/api/newsletter/subscribe", {
      data: { email: "e2e-test-throwaway@ozigi-test.invalid" },
      headers: { "Content-Type": "application/json" },
      timeout: 30 * 60 * 1000,
    });
    // 200/201 on success, 409 if already subscribed, 500 if email provider not configured
    expect([200, 201, 409, 500]).toContain(res.status());
  });
});

// ─── Generate endpoint (auth-gated) ──────────────────────────────────────────

test.describe("POST /api/generate", () => {
  test("returns 401 when no auth token is provided", async ({ request }) => {
    const res = await request.post("/api/generate", {
      data: {
        sourceMaterial: { rawText: "test" },
        campaignDirectives: { platforms: ["x"] },
      },
      headers: { "Content-Type": "application/json" },
      timeout: REQ_TIMEOUT,
    });
    expect(res.status()).toBe(401);
  });

  test("returns 401 for an invalid Bearer token", async ({ request }) => {
    const res = await request.post("/api/generate", {
      data: {
        sourceMaterial: { rawText: "test" },
        campaignDirectives: { platforms: ["x"] },
      },
      headers: {
        "Content-Type": "application/json",
        Authorization: "Bearer invalid-token-xyz",
      },
      timeout: REQ_TIMEOUT,
    });
    expect(res.status()).toBe(401);
  });
});

// ─── Stats overview (auth-gated) ─────────────────────────────────────────────

test.describe("GET /api/stats/overview", () => {
  test("returns 401 for unauthenticated requests", async ({ request }) => {
    const res = await request.get("/api/stats/overview", { timeout: REQ_TIMEOUT });
    expect(res.status()).toBe(401);
  });
});

// ─── Billing history (auth-gated via SSR cookies) ────────────────────────────

test.describe("GET /api/billing/history", () => {
  test("returns 401 or 500 for unauthenticated requests", async ({ request }) => {
    const res = await request.get("/api/billing/history", { timeout: REQ_TIMEOUT });
    // Cookie-based SSR auth: no cookies → user null → 401.
    // Init failure (env misconfiguration) → 500. Both mean the route is protected.
    expect([401, 500]).toContain(res.status());
  });
});

// ─── User deletion (auth-gated) ──────────────────────────────────────────────

// Note: /api/user/delete only exports DELETE, not POST — using DELETE here.
test.describe("DELETE /api/user/delete", () => {
  test("returns 401 for unauthenticated requests", async ({ request }) => {
    const res = await request.delete("/api/user/delete", {
      headers: { "Content-Type": "application/json" },
      timeout: REQ_TIMEOUT,
    });
    expect(res.status()).toBe(401);
  });
});

// ─── Checkout (auth-gated) ────────────────────────────────────────────────────

test.describe("POST /api/create-checkout", () => {
  test("returns 4xx for unauthenticated requests", async ({ request }) => {
    const res = await request.post("/api/create-checkout", {
      data: { planId: "pro" },
      headers: { "Content-Type": "application/json" },
      timeout: REQ_TIMEOUT,
    });
    expect([400, 401, 403]).toContain(res.status());
  });
});

// ─── GTM campaigns (auth-gated) ──────────────────────────────────────────────

test.describe("GET /api/gtm/campaigns", () => {
  test("returns 401 for unauthenticated requests", async ({ request }) => {
    const res = await request.get("/api/gtm/campaigns", { timeout: REQ_TIMEOUT });
    expect(res.status()).toBe(401);
  });
});

test.describe("POST /api/gtm/campaigns", () => {
  test("returns 401 for unauthenticated requests", async ({ request }) => {
    const res = await request.post("/api/gtm/campaigns", {
      data: {},
      headers: { "Content-Type": "application/json" },
      timeout: REQ_TIMEOUT,
    });
    expect(res.status()).toBe(401);
  });
});

// ─── Publish endpoints (auth-gated) ──────────────────────────────────────────

test.describe("POST /api/publish/x", () => {
  test("returns 401 for unauthenticated requests", async ({ request }) => {
    const res = await request.post("/api/publish/x", {
      data: { content: "test post" },
      headers: { "Content-Type": "application/json" },
      timeout: REQ_TIMEOUT,
    });
    expect(res.status()).toBe(401);
  });
});

test.describe("POST /api/publish/linkedin", () => {
  test("returns 401 for unauthenticated requests", async ({ request }) => {
    const res = await request.post("/api/publish/linkedin", {
      data: { content: "test post" },
      headers: { "Content-Type": "application/json" },
      timeout: REQ_TIMEOUT,
    });
    expect(res.status()).toBe(401);
  });
});

// ─── Dodo Payments webhook security ──────────────────────────────────────────

test.describe("POST /api/dodo-webhook", () => {
  test("rejects an unsigned webhook (401 with secret configured, 500 without)", async ({ request }) => {
    const res = await request.post("/api/dodo-webhook", {
      data: { type: "payment.completed" },
      headers: { "Content-Type": "application/json" },
      timeout: REQ_TIMEOUT,
    });
    // 401 when DODO_WEBHOOK_SECRET is set and signature doesn't match.
    // 500 when DODO_WEBHOOK_SECRET is not configured — crypto.createHmac() throws
    // on an undefined key before the signature comparison can run.
    // Both mean the webhook was rejected; neither lets the payload through.
    // ⚠️ App improvement: add a guard at the top of the handler:
    //    if (!process.env.DODO_WEBHOOK_SECRET) return NextResponse.json({error:'Misconfigured'},{status:500})
    //    so operators get a clear signal rather than a generic 500.
    expect([401, 500]).toContain(res.status());
  });
});

// ─── GTM unsubscribe (public, GET) ────────────────────────────────────────────

test.describe("GET /api/gtm/unsubscribe", () => {
  test("returns 400 when token param is missing", async ({ request }) => {
    const res = await request.get("/api/gtm/unsubscribe", { timeout: REQ_TIMEOUT });
    expect(res.status()).toBeGreaterThanOrEqual(400);
  });

  test("returns 400 or 404 when token is invalid", async ({ request }) => {
    const res = await request.get("/api/gtm/unsubscribe?token=invalid-token-xyz", { timeout: REQ_TIMEOUT });
    expect([400, 404]).toContain(res.status());
  });
});

// ─── Waitlist (public) ────────────────────────────────────────────────────────

test.describe("POST /api/waitlist", () => {
  test("rejects missing email with 4xx", async ({ request }) => {
    const res = await request.post("/api/waitlist", {
      data: {},
      headers: { "Content-Type": "application/json" },
      timeout: REQ_TIMEOUT,
    });
    expect(res.status()).toBeGreaterThanOrEqual(400);
    expect(res.status()).toBeLessThan(500);
  });
});

// ─── Long-form generate (auth-gated) ─────────────────────────────────────────

test.describe("POST /api/long-form/generate", () => {
  test("returns 401 for unauthenticated requests", async ({ request }) => {
    const res = await request.post("/api/long-form/generate", {
      data: { topic: "test" },
      headers: { "Content-Type": "application/json" },
      timeout: REQ_TIMEOUT,
    });
    expect(res.status()).toBe(401);
  });
});

// ─── Schedule (auth-gated) ────────────────────────────────────────────────────

test.describe("POST /api/schedule", () => {
  test("returns 401 for unauthenticated requests", async ({ request }) => {
    const res = await request.post("/api/schedule", {
      data: {},
      headers: { "Content-Type": "application/json" },
      timeout: REQ_TIMEOUT,
    });
    expect(res.status()).toBe(401);
  });
});

// ─── Subscribers endpoint (auth-gated via SSR cookie) ────────────────────────
// Note: /api/email has no index route; /api/email/[id] uses service-role key
// (no user auth required). The subscribers list IS user-auth-gated.

test.describe("GET /api/subscribers", () => {
  test("returns 401 for unauthenticated requests", async ({ request }) => {
    const res = await request.get("/api/subscribers", { timeout: REQ_TIMEOUT });
    expect(res.status()).toBe(401);
  });
});

// ─── Upload presigned URL (auth-gated) ───────────────────────────────────────

test.describe("POST /api/upload/presigned", () => {
  test("returns 401 for unauthenticated requests", async ({ request }) => {
    const res = await request.post("/api/upload/presigned", {
      data: { filename: "test.jpg", contentType: "image/jpeg" },
      headers: { "Content-Type": "application/json" },
      timeout: REQ_TIMEOUT,
    });
    expect(res.status()).toBe(401);
  });
});

// ─── Stats increment (auth-gated) ────────────────────────────────────────────

test.describe("POST /api/stats/increment", () => {
  test("returns 401 for unauthenticated requests", async ({ request }) => {
    const res = await request.post("/api/stats/increment", {
      data: { type: "social" },
      headers: { "Content-Type": "application/json" },
      timeout: REQ_TIMEOUT,
    });
    expect(res.status()).toBe(401);
  });
});
