/**
 * Audit Stage 4c: Code block audit
 * - Flags <COMPUTED_AT_VALIDATION> placeholders for human review
 * - Pattern-matches suspicious constants (known trivial/empty-input hashes)
 * - Runs basic structural linting (JSON validity, YAML structure)
 */

import type { AuditFlag } from '@/lib/types/longform';
import SUSPICIOUS_HASHES from '@/lib/longform/suspicious-hashes.json';

interface CodeBlock {
  language: string;
  code: string;
  offset: number;
}

const HASH_SET: Set<string> = new Set(
  (SUSPICIOUS_HASHES as { hashes: Array<{ hash: string }> }).hashes.map((h) =>
    h.hash.toLowerCase()
  )
);

function extractCodeBlocks(markdown: string): CodeBlock[] {
  const blocks: CodeBlock[] = [];
  const re = /```(\w*)\n([\s\S]*?)```/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(markdown)) !== null) {
    blocks.push({ language: m[1].toLowerCase(), code: m[2], offset: m.index });
  }
  return blocks;
}

function detectSuspiciousHashes(code: string): string[] {
  const found: string[] = [];
  // Match hex strings of length ≥ 32 (MD5 and above)
  const hexRe = /\b([0-9a-f]{32,128})\b/gi;
  let m: RegExpExecArray | null;
  while ((m = hexRe.exec(code)) !== null) {
    if (HASH_SET.has(m[1].toLowerCase())) {
      found.push(m[1]);
    }
  }
  return found;
}

function lintJson(code: string): string | null {
  try {
    JSON.parse(code);
    return null;
  } catch (e: any) {
    return e.message || 'Invalid JSON';
  }
}

function lintYaml(code: string): string | null {
  // Basic structural check: look for obvious YAML issues
  const lines = code.split('\n');
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    // Tabs are not valid YAML indentation
    if (/^\t/.test(line)) {
      return `Line ${i + 1}: tab indentation is invalid in YAML`;
    }
  }
  // Conflicting allow/deny on same resource (policy anti-pattern from the spec)
  if (/allow:/.test(code) && /deny:/.test(code)) {
    const resourceBlocks = code.match(/resource:[\s\S]*?(?=resource:|$)/g) || [];
    for (const block of resourceBlocks) {
      if (/allow:/.test(block) && /deny:/.test(block) && block.includes('*')) {
        return 'Incoherent policy: both allow and deny lists on a wildcard resource';
      }
    }
  }
  return null;
}

export function auditCode(draftMarkdown: string): AuditFlag[] {
  const flags: AuditFlag[] = [];
  const blocks = extractCodeBlocks(draftMarkdown);

  for (const block of blocks) {
    const { language, code, offset } = block;

    // Placeholder check
    if (code.includes('<COMPUTED_AT_VALIDATION>')) {
      flags.push({
        type: 'placeholder',
        severity: 'warning',
        message: 'Code block contains <COMPUTED_AT_VALIDATION> placeholder — replace with a real computed value before publishing',
        offset,
        details: code.slice(0, 200),
      });
    }

    // Suspicious hash check
    const badHashes = detectSuspiciousHashes(code);
    for (const hash of badHashes) {
      const entry = (SUSPICIOUS_HASHES as any).hashes.find(
        (h: any) => h.hash.toLowerCase() === hash.toLowerCase()
      );
      flags.push({
        type: 'suspicious-hash',
        severity: 'error',
        message: `Code block contains ${entry?.algorithm || 'hash'} of "${entry?.input ?? '?'}" (${hash.slice(0, 16)}…) — this is a trivial placeholder, not a real computed value`,
        offset,
        span_text: hash,
        details: `The value ${hash} is the ${entry?.algorithm} hash of ${JSON.stringify(entry?.input)} — a known AI placeholder`,
      });
    }

    // JSON linting
    if (language === 'json') {
      const err = lintJson(code);
      if (err) {
        flags.push({
          type: 'lint-error',
          severity: 'warning',
          message: `JSON block failed validation: ${err}`,
          offset,
        });
      }
    }

    // YAML linting
    if (language === 'yaml' || language === 'yml') {
      const err = lintYaml(code);
      if (err) {
        flags.push({
          type: 'lint-error',
          severity: 'warning',
          message: `YAML block failed validation: ${err}`,
          offset,
        });
      }
    }
  }

  return flags;
}
