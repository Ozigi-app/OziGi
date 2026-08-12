/**
 * Audit Stage 4c: Code block audit
 * --------------------------------
 * Everything a reader hits when they copy a snippet out of the article and
 * paste it into a terminal:
 *
 *  - Placeholders left behind (<COMPUTED_AT_VALIDATION>, "rest of code", TODO)
 *  - Known trivial/empty-input hashes passed off as computed values
 *  - Structural lint (JSON validity, YAML structure)
 *  - Leaked credentials and injectable SQL
 *  - Smart quotes and em dashes inside code: the snippet looks right and fails
 *    on paste, which is the worst failure mode of the set
 *  - Missing language labels (no highlighting, no copy-button language hint)
 *  - Per-language conventions for the languages we ship most often
 *
 * NOTE: every non-ASCII character in this file is written as a \\u escape on
 * purpose. The detectors here match smart quotes and dashes, so a tool that
 * re-encodes the source would silently break exactly the checks that catch
 * encoding damage elsewhere.
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

/** Fences that hold prose or drawings, not executable code. */
const NON_CODE_LANGUAGES = new Set([
  '', 'diagram', 'text', 'txt', 'ascii', 'markdown', 'md', 'plaintext',
]);

const LANGUAGE_ALIASES: Record<string, string> = {
  js: 'javascript', jsx: 'javascript', mjs: 'javascript', cjs: 'javascript',
  ts: 'typescript', tsx: 'typescript',
  py: 'python', python3: 'python',
  sh: 'bash', shell: 'bash', zsh: 'bash', console: 'bash',
  yml: 'yaml',
  docker: 'dockerfile',
  postgres: 'sql', postgresql: 'sql', mysql: 'sql',
};

function normalizeLanguage(raw: string): string {
  const lower = raw.toLowerCase();
  return LANGUAGE_ALIASES[lower] ?? lower;
}

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
  // Match hex strings of length >= 32 (MD5 and above)
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

// ---------------------------------------------------------------------------
// Secrets
// ---------------------------------------------------------------------------

/** Values that are obviously stand-ins, not leaked material. */
const PLACEHOLDER_RE =
  /[<>{}$]|\b(?:your|my|the)[-_]|x{4,}|\*{3,}|\.{3}|changeme|example|placeholder|redacted|dummy|sample|insert[-_]|replace[-_]|abc123|123456/i;

const SECRET_PATTERNS: Array<{ re: RegExp; label: string }> = [
  { re: /\bsk-[A-Za-z0-9_-]{20,}\b/g, label: 'OpenAI-style secret key' },
  { re: /\bAKIA[0-9A-Z]{16}\b/g, label: 'AWS access key ID' },
  { re: /\bgh[pousr]_[A-Za-z0-9]{20,}\b/g, label: 'GitHub token' },
  { re: /\bxox[baprs]-[A-Za-z0-9-]{10,}\b/g, label: 'Slack token' },
  { re: /\bAIza[0-9A-Za-z_-]{35}\b/g, label: 'Google API key' },
  { re: /-----BEGIN (?:RSA |EC |DSA |OPENSSH )?PRIVATE KEY-----/g, label: 'private key block' },
  { re: /\beyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\b/g, label: 'JWT' },
];

const ASSIGNED_SECRET_RE =
  /\b(password|passwd|pwd|secret|api[_-]?key|apikey|access[_-]?token|auth[_-]?token|client[_-]?secret|private[_-]?key|connection[_-]?string)\s*[:=]\s*(["'`])([^"'`\n]{8,})\2/gi;

function detectSecrets(code: string): Array<{ label: string; match: string }> {
  const hits: Array<{ label: string; match: string }> = [];

  for (const { re, label } of SECRET_PATTERNS) {
    for (const m of code.matchAll(re)) {
      hits.push({ label, match: m[0] });
    }
  }

  for (const m of code.matchAll(ASSIGNED_SECRET_RE)) {
    const value = m[3];
    if (PLACEHOLDER_RE.test(value)) continue;
    // A bare env-var read is the correct pattern, not a leak.
    if (/process\.env|os\.environ|getenv|ENV\[/i.test(value)) continue;
    hits.push({
      label: `hardcoded ${m[1].toLowerCase()}`,
      match: `${m[1]} = "${value.slice(0, 12)}..."`,
    });
  }

  return hits;
}

// ---------------------------------------------------------------------------
// SQL injection
// ---------------------------------------------------------------------------

const SQL_INTERPOLATION_RE =
  /["'`][^"'`\n]*\b(?:SELECT|INSERT\s+INTO|UPDATE|DELETE\s+FROM)\b[^"'`\n]*(?:\$\{[^}\n]*\}|\{[A-Za-z_]\w*\}|%s\b)/i;

const SQL_CONCAT_RE =
  /["'`][^"'`\n]*\b(?:WHERE|VALUES|SET|FROM)\b[^"'`\n]*["'`]\s*\+\s*[A-Za-z_$]/i;

function detectSqlInjection(code: string): string | null {
  if (SQL_INTERPOLATION_RE.test(code)) {
    return 'SQL string built by interpolation - use a parameterized query';
  }
  if (SQL_CONCAT_RE.test(code)) {
    return 'SQL string built by concatenation - use a parameterized query';
  }
  return null;
}

// ---------------------------------------------------------------------------
// Typography - the copy-paste killers
// ---------------------------------------------------------------------------

/** Curly single and double quotes. */
const SMART_QUOTE_RE = /[‘’“”]/g;
/** En dash and em dash, which break CLI flags like --verbose. */
const CODE_DASH_RE = /[–—]/g;
/** Non-breaking / narrow / figure spaces and the BOM: invisible, fatal on paste. */
const NBSP_RE = /[   ﻿]/g;

// ---------------------------------------------------------------------------
// Completeness
// ---------------------------------------------------------------------------

const ELISION_RE = /^\s*(?:\/\/|#|--|\/\*)?\s*\.{3}\s*(?:rest|remaining|more|etc)?[^\n]{0,40}$/im;
const HANDWAVE_RE =
  /\b(?:rest\s+of\s+(?:the\s+)?code|your\s+code\s+here|implementation\s+(?:goes\s+)?here|add\s+your\s+logic|TODO|FIXME|XXX)\b/i;
const LOWERCASE_PLACEHOLDER_RE =
  /\b(?:your|my)[-_](?:api[-_]?key|token|secret|password|username|domain|project[-_]id)\b/i;

// ---------------------------------------------------------------------------
// Per-language conventions
// ---------------------------------------------------------------------------

interface Convention {
  test: (code: string) => boolean;
  message: string;
  severity: 'warning' | 'info';
}

function nonEmptyLines(code: string): string[] {
  return code.split('\n').filter((l) => l.trim().length > 0);
}

const JS_CONVENTIONS: Convention[] = [
  {
    test: (c) => /\bvar\s+[A-Za-z_$]/.test(c),
    message: '`var` used - prefer `const`, or `let` when reassigned',
    severity: 'warning',
  },
  {
    test: (c) => /[^=!<>]==[^=]/.test(c),
    message: 'Loose equality (`==`) - use `===` so the example does not teach coercion bugs',
    severity: 'warning',
  },
  {
    test: (c) => /\bfetch\s*\(/.test(c) && !/\.ok\b/.test(c) && !/catch\s*\(/.test(c),
    message: '`fetch()` result is used without checking `response.ok` or catching - a 500 will parse as success',
    severity: 'warning',
  },
];

const CONVENTIONS: Record<string, Convention[]> = {
  bash: [
    {
      test: (c) => nonEmptyLines(c).length >= 3 && !/^#!/.test(c.trimStart()),
      message: 'Multi-line shell script has no shebang - add `#!/usr/bin/env bash`',
      severity: 'info',
    },
    {
      test: (c) =>
        nonEmptyLines(c).length >= 3 && /^#!/.test(c.trimStart()) && !/\bset\s+-[euo]/.test(c),
      message: 'Shell script does not `set -euo pipefail` - it will keep running after a failed command',
      severity: 'warning',
    },
    {
      test: (c) =>
        /(?:^|[\s|;])(?:rm|cp|mv|cat|cd|mkdir|source|export|chmod|chown)\s+(?:-\w+\s+)*\$[A-Za-z_]\w*(?![\w"'])/m.test(c),
      message: 'Unquoted variable passed to a command - quote it as "$VAR" or it word-splits on spaces',
      severity: 'warning',
    },
  ],
  dockerfile: [
    {
      test: (c) => /^\s*FROM\s+\S+:latest/im.test(c) || /^\s*FROM\s+[^\s:@]+\s*$/im.test(c),
      message: 'Base image is unpinned (`:latest` or no tag) - pin a version so the example stays reproducible',
      severity: 'warning',
    },
    {
      test: (c) => /^\s*ADD\s+(?!https?:)/im.test(c),
      message: '`ADD` used for a local path - prefer `COPY` unless you need archive extraction',
      severity: 'info',
    },
  ],
  javascript: JS_CONVENTIONS,
  typescript: [
    ...JS_CONVENTIONS,
    {
      test: (c) => /:\s*any\b/.test(c),
      message: '`any` in a TypeScript example - annotate the real type so readers can copy the pattern',
      severity: 'info',
    },
  ],
  python: [
    {
      test: (c) => /\bexcept\s*:/.test(c) || /\bexcept\s+Exception\s*:/.test(c),
      message: 'Broad `except` - catch the specific exception so real failures are not swallowed',
      severity: 'warning',
    },
    {
      test: (c) => /[!=]=\s*None\b/.test(c),
      message: 'Comparing to None with `==`/`!=` - use `is None` / `is not None`',
      severity: 'info',
    },
    {
      test: (c) => /\bdef\s+\w+\s*\([^)]*=\s*(?:\[\s*\]|\{\s*\})/.test(c),
      message: 'Mutable default argument - it is shared across every call; default to `None` and build inside',
      severity: 'warning',
    },
    {
      test: (c) => /\bopen\s*\(/.test(c) && !/\bwith\s+open\s*\(/.test(c),
      message: '`open()` outside a `with` block - the file handle leaks if the next line raises',
      severity: 'info',
    },
  ],
  sql: [
    {
      test: (c) => /\bSELECT\s+\*/i.test(c),
      message: '`SELECT *` - name the columns so the example survives a schema change',
      severity: 'info',
    },
  ],
  yaml: [
    {
      test: (c) => /^\s*[\w.-]+:\s*\d+\.\d+\s*$/m.test(c),
      message: 'Version-like value is unquoted - YAML parses `3.10` as the number 3.1; quote it as "3.10"',
      severity: 'warning',
    },
  ],
};

/** First line of `code` matching `re`, trimmed for display. */
function firstLineContaining(code: string, re: RegExp): string | undefined {
  const probe = new RegExp(re.source, re.flags.replace('g', ''));
  const line = code.split('\n').find((l) => probe.test(l));
  return line?.trim().slice(0, 120);
}

// ---------------------------------------------------------------------------
// Orchestrator
// ---------------------------------------------------------------------------

export function auditCode(draftMarkdown: string): AuditFlag[] {
  const flags: AuditFlag[] = [];
  const blocks = extractCodeBlocks(draftMarkdown);

  for (const block of blocks) {
    const { language: rawLanguage, code, offset } = block;
    const language = normalizeLanguage(rawLanguage);
    const isExecutable = !NON_CODE_LANGUAGES.has(language);

    // --- Placeholder check ------------------------------------------------
    if (code.includes('<COMPUTED_AT_VALIDATION>')) {
      flags.push({
        type: 'placeholder',
        severity: 'warning',
        message:
          'Code block contains <COMPUTED_AT_VALIDATION> placeholder - replace with a real computed value before publishing',
        offset,
        details: code.slice(0, 200),
      });
    }

    // --- Suspicious hash check --------------------------------------------
    const badHashes = detectSuspiciousHashes(code);
    for (const hash of badHashes) {
      const entry = (SUSPICIOUS_HASHES as any).hashes.find(
        (h: any) => h.hash.toLowerCase() === hash.toLowerCase()
      );
      flags.push({
        type: 'suspicious-hash',
        severity: 'error',
        message: `Code block contains ${entry?.algorithm || 'hash'} of "${entry?.input ?? '?'}" (${hash.slice(0, 16)}...) - this is a trivial placeholder, not a real computed value`,
        offset,
        span_text: hash,
        details: `The value ${hash} is the ${entry?.algorithm} hash of ${JSON.stringify(entry?.input)} - a known AI placeholder`,
      });
    }

    // --- Missing language label -------------------------------------------
    if (rawLanguage === '') {
      flags.push({
        type: 'code-missing-language',
        severity: 'warning',
        message:
          'Fenced block has no language label - no syntax highlighting, and readers cannot tell what they are looking at',
        offset,
        details: code.split('\n').slice(0, 2).join('\n').slice(0, 120),
      });
    }

    // --- Typography (copy-paste breakage) ---------------------------------
    if (isExecutable) {
      const smartQuotes = code.match(SMART_QUOTE_RE);
      if (smartQuotes) {
        flags.push({
          type: 'code-typography',
          severity: 'error',
          message: `Code block contains ${smartQuotes.length} smart quote(s) - this fails the moment a reader pastes it. Replace with straight quotes.`,
          offset,
          span_text: firstLineContaining(code, SMART_QUOTE_RE),
        });
      }

      const nbsp = code.match(NBSP_RE);
      if (nbsp) {
        flags.push({
          type: 'code-typography',
          severity: 'error',
          message: `Code block contains ${nbsp.length} non-breaking or zero-width space(s) - invisible on the page, a syntax error on paste`,
          offset,
        });
      }

      const dashes = code.match(CODE_DASH_RE);
      if (dashes) {
        flags.push({
          type: 'code-typography',
          severity: 'warning',
          message: `Code block contains ${dashes.length} en/em dash(es) where a hyphen belongs - CLI flags like \`--verbose\` silently stop working`,
          offset,
          span_text: firstLineContaining(code, CODE_DASH_RE),
        });
      }
    }

    // --- Secrets ----------------------------------------------------------
    for (const hit of detectSecrets(code)) {
      flags.push({
        type: 'code-security',
        severity: 'error',
        message: `Code block contains a ${hit.label} - replace with an environment variable before publishing`,
        offset,
        span_text: hit.match.slice(0, 60),
      });
    }

    // --- SQL injection ----------------------------------------------------
    const sqlIssue = detectSqlInjection(code);
    if (sqlIssue) {
      flags.push({
        type: 'code-security',
        severity: 'error',
        message: `${sqlIssue}. Readers copy this pattern into production.`,
        offset,
      });
    }

    // --- Completeness -----------------------------------------------------
    if (isExecutable) {
      if (ELISION_RE.test(code)) {
        flags.push({
          type: 'code-incomplete',
          severity: 'warning',
          message: '`...` used as a placeholder inside runnable code - show the real lines or split the example',
          offset,
        });
      }

      const handwave = code.match(HANDWAVE_RE);
      if (handwave) {
        flags.push({
          type: 'code-incomplete',
          severity: 'warning',
          message: `Code block still contains "${handwave[0]}" - the reader cannot run this as printed`,
          offset,
        });
      }

      const lowerPlaceholder = code.match(LOWERCASE_PLACEHOLDER_RE);
      if (lowerPlaceholder) {
        flags.push({
          type: 'code-incomplete',
          severity: 'info',
          message: `Placeholder "${lowerPlaceholder[0]}" is easy to miss - use the <SCREAMING_SNAKE_CASE> form so it is obviously a blank to fill in`,
          offset,
        });
      }
    }

    // --- Structural lint --------------------------------------------------
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

    if (language === 'yaml') {
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

    // --- Per-language conventions -----------------------------------------
    for (const convention of CONVENTIONS[language] ?? []) {
      if (convention.test(code)) {
        flags.push({
          type: 'code-convention',
          severity: convention.severity,
          message: `${language}: ${convention.message}`,
          offset,
        });
      }
    }
  }

  return flags;
}
