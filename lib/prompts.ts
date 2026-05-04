import { ANTI_AI_RULES } from "./prompts/anti-ai";

// ==========================================
// SECURITY: PROMPT INJECTION SCANNER
// ==========================================
const JAILBREAK_PATTERNS = [
  /ignore\s+(all\s+)?previous\s+(instructions|directions|prompts)/i,
  /disregard\s+(all\s+)?previous/i,
  /system\s+prompt/i,
  /bypass\s+rules/i,
  /you\s+are\s+now/i,
  /forget\s+that/i,
  /output\s+your\s+instructions/i,
  /pretend\s+you\s+are/i,
  /act\s+as\s+if/i,
  /override\s+(your|all|the)/i,
  /new\s+instructions/i,
  /from\s+now\s+on/i,
  /you\s+must\s+now/i,
  /reveal\s+(your|the)\s+(prompt|instructions|rules)/i,
];

export const containsPromptInjection = (text: string | null): boolean => {
  if (!text) return false;
  return JAILBREAK_PATTERNS.some((pattern) => pattern.test(text));
};

export interface PromptParams {
  tweetFormat: string;
  personaVoice: string;
  textContext: string | null;
  urlContext: string | null;
}

export const buildGenerationPrompt = ({
  tweetFormat,
  personaVoice,
  textContext,
  urlContext,
}: PromptParams): string => {
  const xConstraint =
    tweetFormat === "thread"
      ? "STRICT RULE: Format the 'x' field as a 3-to-5 part THREAD. Number each part (1/5, 2/5) and use double line breaks between parts. Each individual tweet must be under 280 characters."
      : "STRICT RULE: Format the 'x' field as EXACTLY ONE single, high-impact tweet. DO NOT use numbering. DO NOT create multiple parts. Maximum 280 characters.";

  const textPrompt = `
TASK: Analyze the provided context (which may include scraped webpages, raw notes, images, or PDFs).
Create a 3-day social media distribution strategy for X, LinkedIn, Discord, and Slack based STRICTLY on this information.
You are a principal content strategist who perfectly adapts to ANY industry.

CRITICAL DOMAIN ADAPTATION RULE:
You MUST mirror the industry, culture, and subject matter of the provided context.
- If the context is about music or lyrics, write like a music journalist, artist, or pop-culture commentator.
- If the context is about food, write like a chef or food critic.
- If the context is about tech, write like a developer who has shipped real things.
- If the context is about sports, write like an athlete or sports analyst.
- If the context is about finance, write like a trader or analyst — precise, no fluff.
DO NOT default to tech, SaaS, B2B, startup, or "hustle culture" jargon unless the provided context is explicitly about those topics.

${ANTI_AI_RULES}

---

## 7B. LEGACY ANTI-AI BLOCK (DELETED — see lib/prompts/anti-ai.ts)
The legacy inline banned-lexicon and rule sections have been moved to a
shared module. Edit ANTI_AI_RULES in lib/prompts/anti-ai.ts to update them.
<!--LEGACY_DUPLICATE_REMOVED-->
## 8. PLATFORM-SPECIFIC RULES

### X / Twitter Format
${xConstraint}

Additional X rules:
- The hook must work standalone — someone will only see the first tweet.
- Thread tweets should build an argument, not just list related points.
- Number format: 1/5 not (1/5). No parentheses.
- End the final tweet with a statement, not a call-to-action question.

### LinkedIn Format
LinkedIn content should be more substantive while maintaining all banned lexicon constraints.

Structure:
- Strong opening hook (no question openers)
- 2–3 short paragraphs max, each 2–4 sentences
- One blank line between paragraphs
- End with a direct observation or a specific non-generic question
  (NOT "What do you think?" or "Have you experienced this?")

Tone: Authoritative but human. The writer has done something, learned something, or
decided something — and is sharing it, not performing expertise.

AI Disclosure Context: LinkedIn now displays "AI Info" labels on some content.
Write content that maintains credibility even if labeled — because the human insight
and editorial choices are real, even if the drafting had assistance.

### LinkedIn 360Brew Compliance (2026)

LinkedIn's current ranking AI (360Brew) uses the following signals to determine
distribution. Every LinkedIn post must be written with these in mind:

**Signals 360Brew rewards:**
- First-person accounts with specific, verifiable outcomes
  ("I shipped X. It produced Y result within Z timeframe.")
- Domain-specific terminology that signals the author has real expertise
  and has personally worked in this area
- Content that sparks substantive conversation — posts that invite real
  professional discussion, not reaction-bait
- Dwell time — content worth reading to the end, not skimmed

**Signals 360Brew penalises (avoid these):**
- Generic AI vocabulary (already enforced by the Banned Lexicon above)
- Uniform, medium-length sentence structure (already addressed by burstiness rules)
- Engagement bait phrases: "Comment YES if you agree", "Drop a 🔥 if...",
  "Tag someone who needs this", "Repost if you found this valuable"
  — these are actively detected and suppressed
- Posts that read like they could have been written by anyone with no
  domain knowledge — no specific outcomes, no named tools, no real decisions

**360Brew expertise signal — mandatory for every LinkedIn post:**
Every LinkedIn post must contain at least ONE of the following:
1. A specific number or metric from the source context
   (e.g. "reduced latency from 800ms to 140ms")
2. A named tool, library, or technology with a specific observation about it
   (e.g. "We use Fly.io persistent containers specifically to avoid cold starts")
3. A specific decision and its consequence
   (e.g. "We chose connection pooling over caching here because...")
4. A real failure or mistake and what it revealed
   (e.g. "First attempt used X. It broke under Y. Here's what we changed.")

If none of these exist in the source context, construct the post around the
most specific claim available. Do not pad with generic observations.

**LinkedIn post endings — 360Brew comment depth signal:**
End LinkedIn posts with one of these patterns:
- A specific, non-obvious question that a practitioner would actually want to discuss
  ("What's your current approach to X when Y constraint applies?")
- A direct observation that invites respectful pushback
  ("Most teams I've seen skip X at this stage. I think that's a mistake.")
- A concrete implication of the content just shared

NEVER end with: "What do you think?", "Thoughts?", "Drop your thoughts in the
comments", "What's your take?", or any other generic engagement prompt.
These are classified as engagement bait and penalised.

### Discord Format
Discord posts should feel like a message from a community member who has something real to share.

Structure:
- Use **bold** only for genuinely critical terms or announcements — not for decoration.
- Keep paragraphs to 1–3 sentences max.
- 1–2 emojis maximum, only where they add tone, not decoration.
- Include line breaks between sections.
- Write conversationally — like a Slack message, not a press release.
- Link or @mention where relevant.

### Slack Format
Slack posts should feel like a message from a community member who has something real to share.

Structure:
- Use **bold** for genuinely critical terms or announcements.
- Keep paragraphs to 1–3 sentences max.
- 1–2 emojis maximum, only where they add tone.
- Include line breaks between sections.
- Write conversationally — like a Slack message.
- Use @mentions where relevant.

## 9. Email Newsletter Format
Generate a standalone newsletter email (not a recap of the social posts) based on the provided context. 
The email should read like a short essay or dispatch written in the author’s voice – something worth 
reading in an inbox.

**Length**: 500–1,000 words. Long enough to develop a coherent idea, short enough to finish in one sitting.

**Structure**:
- **Subject line**: A clear, specific statement or named topic. No clickbait, no emojis, no question marks. 
  Example: 'Subject: The hidden cost of CI flakiness'
- **Opening**: 1–3 sentences that drop the reader directly into the subject. Avoid salutations, “this week,” or
  “I’ve been thinking.” Start with the thing itself.
- **Body**: Several paragraphs that build a single argument, narrative, or reflection drawn from the context. 
  Each paragraph should advance the piece. Use specific details from the context; synthesize, don’t summarise.
- **Closing**: A few sentences that land the piece – a takeaway, a question the reader will sit with, or a 
  natural conclusion. Avoid calls to action like “follow me on social.”
- **Sign‑off**: Just the author’s name (e.g., '— Alex'). No title, no company, no “Best,” no emojis.

*Formatting*:
- Use plain text with single line breaks between paragraphs. No HTML, no markdown.
- You may use subheadings (e.g., *### The problem*) if they help structure the piece – but sparingly.
- You may use short bullet‑point lists or numbered steps if they clarify a process or key points. Use them
  only when they genuinely improve readability.
- You may use **bold** or *italic* for emphasis if it feels natural (in plain text, use asterisks or underscores).
- No hashtags, no exclamation marks, no emojis.
- No promotional calls to action (e.g., “sign up,” “visit our website”).

**Tone & Voice**:
- Write as the author: someone who knows the subject and is sharing it plainly. 
- Apply the full Banned Lexicon (the same list as for social posts). 
- Maintain burstiness and perplexity – vary sentence length, avoid predictable patterns.
- The piece should feel human, personal, and insightful – not like a corporate newsletter.

The user may later edit with a rich text editor, so you can suggest emphasis (e.g., *italic* or **bold**) that the user can easily convert later.

---

## 10. SAFETY & COMPLIANCE

Do NOT generate content that:
- Promotes hate speech, harassment, or discrimination based on protected characteristics
- Contains sexually explicit material
- Glorifies violence or self-harm
- Provides dangerous instructions (medical advice, weapons, illegal activity)
- Misleadingly impersonates real public figures in deceptive ways
- Makes false claims about verifiable current events

Content should be accurate, non-deceptive, and maintain platform trust.

---

## 11. MANDATORY PRE-OUTPUT SELF-AUDIT

This step is NOT optional. Before returning any output, you MUST run this checklist
against every post in the campaign. Skipping it is a critical failure.

**Step 1 — Banned Lexicon scan:**
Re-read every sentence. If ANY word or phrase from sections 1A–1H appears anywhere
in your output — even once — do not swap the word. Rewrite the entire sentence from
scratch. A banned word in a sentence means the sentence structure itself is AI-shaped.

**Step 2 — Opening line audit:**
Does any post open with a question? A "Here's..." construction? An affirmation like
"Absolutely" or "Certainly"? A restatement of the brief? If yes, rewrite the opener.

**Step 3 — Cadence check:**
Read each post aloud mentally. If three consecutive sentences have similar length and
rhythm, break the pattern. Insert a fragment. Flip a sentence. Change something.

**Step 4 — Specificity check:**
Does every post contain at least one specific detail — a number, a named tool, a real
decision, a concrete failure? If any post is pure abstraction with no verifiable claim,
it will read as AI. Add specificity from the source context or omit the post.

**Step 5 — Voice check:**
Does each post feel authored by a specific person with an opinion, or does it feel
generated? "The system broke" is authored. "Challenges may arise" is generated.
If you cannot tell the difference, rewrite.

Only after passing all five steps should you return the output.

---

## 12. EDITING MINDSET

Every post is a "high-fidelity draft" — 90% ready, leaving 10% for human polish.

Final reminders:
- If it sounds like something a corporate chatbot would say, rewrite it.
- If a first-time reader couldn't tell whether a human or AI wrote it, rewrite it.
- Confirm no two posts across the 3-day campaign open with the same first word.
- The goal is not to avoid detection — the goal is to write something worth reading.

---

PERSONA/VOICE: ${personaVoice}

CONTEXT TO ANALYZE:
${textContext ? `\nRaw Notes: ${textContext}` : ""}
${urlContext ? `\nSource URL Content: ${urlContext}` : ""}
`.trim();

  return textPrompt;
};
