/**
 * Stage 2: VERIFY
 * Resolves every URL in the source budget before the draft is written.
 * No model calls except: one Gemini claim-support check per resolved source,
 * and one corroborating-source check for personal-website patterns.
 *
 * Hard gate: if >20% of sources are dead/NO, returns gate_triggered=true
 * and the caller must surface the report to the user before proceeding.
 */

import { getVertexAIClient } from '@/lib/genai-client';
import type { SourceBudgetEntry, SourceStatus, ClaimSupport, VerifySourcesResult } from '@/lib/types/longform';

const FETCH_TIMEOUT_MS = 10_000;
const MAX_CONTENT_CHARS = 4_000;
const DEAD_RATE_GATE = 0.20;

// Heuristic: personal website patterns that trigger the "Derrick Weil" check
const PERSONAL_SITE_PATTERN = /^(?:www\.)?([a-z]+[-.]?[a-z]+)\.(com|io|me|co|net|org)$/i;
const PERSONAL_NAME_PATTERN = /^[A-Z][a-z]+ [A-Z][a-z]+/;

function withFetchTimeout(url: string): Promise<Response | null> {
  return new Promise((resolve) => {
    const timer = setTimeout(() => resolve(null), FETCH_TIMEOUT_MS);
    fetch(url, {
      headers: { 'User-Agent': 'OzigiVerifier/1.0' },
      redirect: 'follow',
    })
      .then((r) => { clearTimeout(timer); resolve(r); })
      .catch(() => { clearTimeout(timer); resolve(null); });
  });
}

async function fetchPageText(url: string): Promise<{ status: SourceStatus; finalUrl: string; body: string }> {
  const resp = await withFetchTimeout(url);
  if (!resp) return { status: 'dead', finalUrl: url, body: '' };

  const finalUrl = resp.url || url;

  if (!resp.ok) {
    return { status: resp.status >= 400 ? 'dead' : 'dead', finalUrl, body: '' };
  }

  let body = '';
  try {
    body = (await resp.text()).slice(0, MAX_CONTENT_CHARS);
  } catch {
    return { status: 'dead', finalUrl, body: '' };
  }

  // Paywall heuristic: short body + sign-in tokens
  const lower = body.toLowerCase();
  if (
    body.length < 800 &&
    (lower.includes('sign in') || lower.includes('subscribe') || lower.includes('log in'))
  ) {
    return { status: 'paywalled', finalUrl, body };
  }

  // Treat 3xx-chain-ending-2xx as redirected
  const status: SourceStatus = finalUrl !== url ? 'redirected' : 'resolved';
  return { status, finalUrl, body };
}

async function checkClaimSupport(
  claim: string,
  pageContent: string
): Promise<{ support: ClaimSupport; reason: string }> {
  try {
    const client = await getVertexAIClient();
    const response = await client.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: [
        {
          role: 'user',
          parts: [
            {
              text: `Does the following web page content support the claim below?
Answer with exactly one word: YES, NO, or UNCLEAR, followed by a single sentence of justification.

CLAIM: "${claim}"

PAGE CONTENT (first 3000 chars):
${pageContent.slice(0, 3000)}

Answer:`,
            },
          ],
        },
      ],
      config: { temperature: 0.1, maxOutputTokens: 128 },
    });

    let text = '';
    if ((response as any).text) {
      const t = (response as any).text;
      text = typeof t === 'function' ? t() : String(t);
    } else if (response.candidates?.[0]?.content?.parts?.[0]?.text) {
      text = response.candidates[0].content.parts[0].text;
    }

    text = text.trim();
    const verdict = text.toUpperCase().startsWith('YES')
      ? 'YES'
      : text.toUpperCase().startsWith('NO')
      ? 'NO'
      : 'UNCLEAR';

    const reason = text.replace(/^(YES|NO|UNCLEAR)[.:\s]*/i, '').trim() || text;
    return { support: verdict as ClaimSupport, reason };
  } catch {
    return { support: 'UNCLEAR', reason: 'Claim support check failed' };
  }
}

function isPersonalWebsite(url: string): boolean {
  try {
    const { hostname } = new URL(url);
    return PERSONAL_SITE_PATTERN.test(hostname);
  } catch {
    return false;
  }
}

function pageHasPersonName(body: string): boolean {
  // Rough heuristic: <title> or <h1> contains "Firstname Lastname"
  const titleMatch = body.match(/<title[^>]*>([^<]*)<\/title>/i);
  const h1Match = body.match(/<h1[^>]*>([^<]*)<\/h1>/i);
  const candidate = `${titleMatch?.[1] || ''} ${h1Match?.[1] || ''}`;
  return PERSONAL_NAME_PATTERN.test(candidate.trim());
}

async function verifyCorroborating(
  personDomain: string,
  personClaim: string
): Promise<boolean> {
  // Quick corroboration: search for the domain/person name in one independent source
  // We do a simple fetch of a DuckDuckGo HTML result — purely heuristic
  try {
    const query = encodeURIComponent(`"${personDomain}" ${personClaim}`);
    const ddgUrl = `https://html.duckduckgo.com/html/?q=${query}`;
    const resp = await withFetchTimeout(ddgUrl);
    if (!resp || !resp.ok) return false;
    const body = await resp.text();
    // If the domain name appears in at least 2 different result snippets, consider corroborated
    const occurrences = (body.match(new RegExp(personDomain.replace('.', '\\.'), 'gi')) || []).length;
    return occurrences >= 2;
  } catch {
    return false;
  }
}

/**
 * Verify all URLs in a source budget. Returns an annotated budget with
 * status + claim_support fields, plus gate metadata.
 */
export async function verifySources(
  sourceBudget: SourceBudgetEntry[]
): Promise<VerifySourcesResult> {
  if (sourceBudget.length === 0) {
    return {
      annotated_budget: [],
      dead_count: 0,
      total_count: 0,
      dead_rate: 0,
      gate_triggered: false,
    };
  }

  const annotated: SourceBudgetEntry[] = await Promise.all(
    sourceBudget.map(async (entry): Promise<SourceBudgetEntry> => {
      const { status, finalUrl, body } = await fetchPageText(entry.url);

      const updated: SourceBudgetEntry = {
        ...entry,
        status,
        final_url: finalUrl !== entry.url ? finalUrl : undefined,
        content_preview: body.slice(0, 400) || undefined,
      };

      if (status === 'resolved' || status === 'redirected') {
        // Claim support check for the first claim this source supports
        const firstClaimId = entry.supports_claims[0];
        if (firstClaimId) {
          const { support, reason } = await checkClaimSupport(firstClaimId, body);
          updated.claim_support = support;
          updated.claim_support_reason = reason;
        }

        // Fabricated-authority check for personal websites
        if (isPersonalWebsite(entry.url) && pageHasPersonName(body)) {
          const hostname = new URL(entry.url).hostname.replace(/^www\./, '');
          const corroborated = await verifyCorroborating(hostname, entry.justification);
          if (!corroborated) {
            // Drop: mark as dead so hard-gate logic picks it up
            updated.status = 'dead';
            updated.claim_support = 'NO';
            updated.claim_support_reason =
              'Personal site with no independent corroborating source — likely hallucinated authority';
          }
        }
      }

      return updated;
    })
  );

  const dead_count = annotated.filter(
    (e) => e.status === 'dead' || e.claim_support === 'NO'
  ).length;
  const total_count = annotated.length;
  const dead_rate = total_count > 0 ? dead_count / total_count : 0;

  return {
    annotated_budget: annotated,
    dead_count,
    total_count,
    dead_rate,
    gate_triggered: dead_rate > DEAD_RATE_GATE,
  };
}
