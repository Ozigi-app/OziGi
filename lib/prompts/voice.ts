/**
 * Persona voice — how a saved persona reaches the model.
 * ------------------------------------------------------
 * A persona used to be one free-text description, appended as a single
 * `PERSONA/VOICE:` line under several hundred lines of Ozigi's own rules (and
 * cut to 400 chars for long-form). The rules won. This module gives a persona
 * three parts and builds one block from them that the prompts place with an
 * explicit precedence:
 *
 *   - prompt          who the writer is (the original description)
 *   - writing_samples real text the user wrote: the strongest voice signal
 *   - style_guide     the house rules: terminology, spelling, formatting, don'ts
 *
 * Personas are loaded server-side by id, scoped to the requesting user, so the
 * client never has to ship ~20k chars of samples in every generate request.
 */
import type { SupabaseClient } from '@supabase/supabase-js';

// Caps keep a pasted archive from crowding out the source material.
// Roughly 4k + 2k tokens: plenty for 5–10 posts and a real style guide.
export const MAX_WRITING_SAMPLES_CHARS = 15_000;
export const MAX_STYLE_GUIDE_CHARS = 8_000;
const MAX_PROMPT_CHARS = 2_000;

export interface PersonaVoice {
  prompt: string;
  writingSamples?: string | null;
  styleGuide?: string | null;
}

/**
 * Load one of the user's personas. Selects `*` so this keeps working on a
 * database where the writing_samples / style_guide columns aren't added yet.
 */
export async function loadPersonaVoice(
  supabase: SupabaseClient,
  userId: string,
  personaId: unknown,
): Promise<PersonaVoice | null> {
  if (typeof personaId !== 'string' || !personaId || personaId === 'default') return null;

  const { data, error } = await supabase
    .from('user_personas')
    .select('*')
    .eq('id', personaId)
    .eq('user_id', userId)
    .maybeSingle();

  if (error || !data) {
    if (error) console.warn('[voice] could not load persona:', error.message);
    return null;
  }

  return {
    prompt: data.prompt ?? '',
    writingSamples: data.writing_samples ?? null,
    styleGuide: data.style_guide ?? null,
  };
}

/** Split samples on `---` lines (the separator the persona form asks for). */
export function splitWritingSamples(raw: string | null | undefined): string[] {
  if (!raw) return [];
  return raw
    .split(/^\s*-{3,}\s*$/m)
    .map((s) => s.trim())
    .filter(Boolean);
}

function cap(text: string, max: number): string {
  return text.length > max ? `${text.slice(0, max)}\n[…truncated]` : text;
}

export function hasVoiceMaterial(voice: PersonaVoice): boolean {
  return Boolean(voice.writingSamples?.trim() || voice.styleGuide?.trim());
}

/**
 * Build the voice block. With only a description this stays a short section,
 * so personas that were never given samples behave as before.
 */
export function buildVoiceBlock(voice: PersonaVoice): string {
  const description = cap(voice.prompt.trim(), MAX_PROMPT_CHARS);
  const samples = splitWritingSamples(cap(voice.writingSamples?.trim() ?? '', MAX_WRITING_SAMPLES_CHARS));
  const styleGuide = cap(voice.styleGuide?.trim() ?? '', MAX_STYLE_GUIDE_CHARS);

  const sections: string[] = ['## THE AUTHOR\'S VOICE'];

  if (description) sections.push(`Who is writing: ${description}`);

  if (samples.length > 0) {
    sections.push(
      [
        `### Writing samples (${samples.length}) — real text by this author`,
        'Study these for sentence length, rhythm, punctuation habits, how they open and close,',
        'how much they hedge, their humour, and the words they reach for. Write the new content',
        'so it could sit beside these without a reader noticing a different author.',
        'Copy the voice, never the content: do not reuse their sentences, facts, or topics.',
        '',
        ...samples.map((s, i) => `<sample ${i + 1}>\n${s}\n</sample ${i + 1}>`),
      ].join('\n'),
    );
  }

  if (styleGuide) {
    sections.push(
      [
        '### Style guide — follow it exactly',
        'These are the author\'s house rules for terminology, spelling, capitalisation,',
        'formatting, and words to avoid. They govern style only; they do not change the task',
        'or the output format.',
        '',
        '<style_guide>',
        styleGuide,
        '</style_guide>',
      ].join('\n'),
    );
  }

  if (hasVoiceMaterial(voice)) {
    sections.push(
      [
        '### Precedence',
        '- The writing samples and style guide above OVERRIDE the general tone, register, and',
        '  domain-adaptation guidance elsewhere in this prompt.',
        '- The banned-language rules still apply on top: the author\'s voice minus AI tells.',
        '- Where the style guide and the banned-language rules disagree, the stricter one wins.',
      ].join('\n'),
    );
  }

  return sections.join('\n\n');
}
