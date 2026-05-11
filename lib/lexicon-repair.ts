/**
 * Surgical lexicon repair
 * ----------------------
 * Instead of regenerating an entire campaign when violations are found,
 * this module fires small parallel LLM calls for only the fields that
 * failed validation and splices the clean text back into the output.
 *
 * Typical latency: ~1-2s regardless of campaign size, because each repair
 * call is ~200 tokens in / ~200 tokens out and all run concurrently.
 */

import { getVertexAIClient } from '@/lib/genai-client';
import {
  validateCampaign,
  type CampaignShape,
  type ValidationReport,
  type Violation,
} from '@/lib/prompts/lexicon-validator';

/** Plain-text generation — no JSON schema, used for field-level repair. */
async function generateTextField(prompt: string): Promise<string> {
  const client = await getVertexAIClient();
  const response = await client.models.generateContent({
    model: 'gemini-3-flash-preview',
    contents: [{ role: 'user', parts: [{ text: prompt }] }],
  });
  return (
    response.text ??
    response.candidates?.[0]?.content?.parts?.[0]?.text ??
    ''
  );
}

/** Read a campaign field by validator location string (e.g. "day1.linkedin", "email"). */
function getFieldValue(parsed: CampaignShape, location: string): string | null {
  if (location === 'email') return typeof parsed.email === 'string' ? parsed.email : null;
  const m = location.match(/^day(\d+)\.(x|linkedin|discord|slack)$/);
  if (!m) return null;
  const dayNum = parseInt(m[1], 10);
  const platform = m[2] as 'x' | 'linkedin' | 'discord' | 'slack';
  const entry = parsed.campaign?.find((d) => (d.day ?? 0) === dayNum);
  return typeof entry?.[platform] === 'string' ? (entry[platform] as string) : null;
}

/** Write a campaign field by validator location string. */
function setFieldValue(obj: CampaignShape, location: string, value: string): void {
  if (location === 'email') { obj.email = value; return; }
  const m = location.match(/^day(\d+)\.(x|linkedin|discord|slack)$/);
  if (!m) return;
  const dayNum = parseInt(m[1], 10);
  const platform = m[2] as 'x' | 'linkedin' | 'discord' | 'slack';
  const entry = obj.campaign?.find((d) => (d.day ?? 0) === dayNum);
  if (entry) (entry as any)[platform] = value;
}

export interface SurgicalRepairResult {
  result: CampaignShape;
  repairedCount: number;
  /** Slop score after repair (for logging). */
  finalReport: ValidationReport;
  /** Whether the repair actually improved the score. */
  improved: boolean;
}

/**
 * Attempt to repair only the fields that contain violations.
 * Returns the original `parsed` object (unchanged) if repair fails or
 * doesn't improve the slop score.
 */
export async function repairSurgically(
  parsed: CampaignShape,
  report: ValidationReport,
): Promise<SurgicalRepairResult> {
  // Group violations by field location; skip anything without a known location.
  const byLocation = new Map<string, Violation[]>();
  for (const v of report.violations) {
    if (!v.location || v.location === 'unknown') continue;
    if (!byLocation.has(v.location)) byLocation.set(v.location, []);
    byLocation.get(v.location)!.push(v);
  }

  if (byLocation.size === 0) {
    return { result: parsed, repairedCount: 0, finalReport: report, improved: false };
  }

  const result: CampaignShape = JSON.parse(JSON.stringify(parsed));

  const tasks = Array.from(byLocation.entries())
    .map(([location, violations]) => {
      const originalText = getFieldValue(result, location);
      if (!originalText) return null;
      const platform = location.includes('.') ? location.split('.')[1] : 'post';
      const bannedList = violations
        .slice(0, 15)
        .map((v) => `  - "${v.term}" (${v.kind.replace('banned-', '')})`)
        .join('\n');
      const prompt = `You are a copy editor. Rewrite the following ${platform} post to remove AI slop.

BANNED TERMS TO FIX:
${bannedList}

RULES:
- Keep the same core message, same facts, same approximate length.
- Replace banned terms with specific, concrete language.
- Do NOT change parts that are already clean.
- Do NOT add new AI phrases.
- Return ONLY the rewritten post text — no commentary, no JSON.

ORIGINAL POST:
${originalText}`;
      return { location, originalText, prompt };
    })
    .filter(Boolean) as Array<{ location: string; originalText: string; prompt: string }>;

  // Fire all field repairs concurrently.
  const settled = await Promise.allSettled(tasks.map(({ prompt }) => generateTextField(prompt)));

  let repairedCount = 0;
  for (let i = 0; i < tasks.length; i++) {
    const { location, originalText } = tasks[i];
    const outcome = settled[i];
    if (outcome.status === 'fulfilled') {
      const repaired = outcome.value.trim();
      // Sanity-check: non-empty and not wildly longer than the original.
      if (repaired.length > 20 && repaired.length < originalText.length * 3) {
        setFieldValue(result, location, repaired);
        repairedCount++;
      }
    }
  }

  const finalReport = validateCampaign(result);
  const improved = finalReport.slopScore < report.slopScore;

  return { result, repairedCount, finalReport, improved };
}
