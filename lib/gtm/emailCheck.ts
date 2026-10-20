/**
 * Deliverability checks for outreach: validate a recipient domain before
 * sending, and recognise bounces afterwards.
 *
 * Bounces damage the sender's own inbox reputation (Gmail/Outlook flag the
 * account), which is the user's real asset, so we stop sending to dead
 * addresses rather than learning from the damage.
 */
import { promises as dns } from 'dns'

export type DomainCheck = { ok: true } | { ok: false; reason: 'bad_syntax' | 'no_mail_server' }

const DNS_TIMEOUT_MS = 4000
const NO_RECORDS = new Set(['ENOTFOUND', 'ENODATA'])

function withTimeout<T>(p: Promise<T>): Promise<T> {
  return Promise.race([
    p,
    new Promise<T>((_, reject) =>
      setTimeout(() => reject(Object.assign(new Error('dns timeout'), { code: 'ETIMEOUT' })), DNS_TIMEOUT_MS),
    ),
  ])
}

/**
 * True when the domain can plausibly receive mail. Only a definitive "no such
 * domain / no records" fails a lead. A DNS timeout or SERVFAIL says nothing
 * about the address, so those pass: dropping good leads over a flaky resolver
 * is worse than letting one through.
 *
 * `cache` is per-run (domain -> result) so 50 leads at gmail.com cost one lookup.
 */
export async function checkEmailDomain(
  email: string,
  cache: Map<string, DomainCheck> = new Map(),
): Promise<DomainCheck> {
  const addr = email.trim().toLowerCase()
  const match = /^[^\s@]+@([^\s@]+\.[^\s@.]+)$/.exec(addr)
  if (!match || addr.length > 254) return { ok: false, reason: 'bad_syntax' }

  const domain = match[1]
  const cached = cache.get(domain)
  if (cached) return cached

  let result: DomainCheck = { ok: true }
  try {
    const mx = await withTimeout(dns.resolveMx(domain))
    // RFC 7505 "null MX": the domain explicitly says it accepts no mail.
    const acceptsMail = mx.some(r => r.exchange && r.exchange !== '.')
    if (!acceptsMail) result = { ok: false, reason: 'no_mail_server' }
  } catch (err) {
    const code = (err as NodeJS.ErrnoException).code
    if (code && NO_RECORDS.has(code)) {
      // No MX record: RFC 5321 falls back to the domain's own A/AAAA record.
      try {
        await withTimeout(dns.resolve4(domain))
      } catch (err4) {
        const code4 = (err4 as NodeJS.ErrnoException).code
        if (code4 && NO_RECORDS.has(code4)) {
          try {
            await withTimeout(dns.resolve6(domain))
          } catch (err6) {
            const code6 = (err6 as NodeJS.ErrnoException).code
            if (code6 && NO_RECORDS.has(code6)) result = { ok: false, reason: 'no_mail_server' }
          }
        }
      }
    }
    // Any other error (timeout, SERVFAIL): unknown, so allow.
  }

  cache.set(domain, result)
  return result
}

export type ThreadMessageKind = 'reply' | 'bounce' | 'ignore'

/**
 * A bounce arrives in the same Gmail thread as the original send, so "any
 * later message in the thread" counts a bounce as a reply. Tell them apart by
 * sender: delivery-status notifications come from mailer-daemon/postmaster.
 * "Delayed" notices are retries in progress, not failures: ignore them.
 */
export function classifyThreadMessage(from: string, subject: string): ThreadMessageKind {
  const isDaemon = /mailer-daemon|postmaster|mail delivery (sub)?system/i.test(from)
  if (!isDaemon) return 'reply'
  if (/delay|warning/i.test(subject)) return 'ignore'
  return 'bounce'
}

/**
 * A synchronous refusal from the recipient's server that says the mailbox does
 * not exist. Deliberately narrow: 5xx also covers our own auth failures and
 * spam/policy blocks, which are not the lead's fault and must not mark them
 * bounced.
 */
export function isHardBounceError(err: unknown): boolean {
  const e = err as { responseCode?: number; response?: string; message?: string }
  const text = `${e?.response ?? ''} ${e?.message ?? ''}`
  const code = e?.responseCode
  if (typeof code !== 'number' || code < 500 || code > 599) return false
  if (/spam|blocked|blacklist|block ?list|policy|reputation|rate|auth|relay|denied|dmarc|spf/i.test(text)) return false
  if (/\b5\.1\.[1-3]\b/.test(text)) return true
  return (
    [550, 551, 553].includes(code) &&
    /user unknown|no such user|unknown user|does not exist|invalid (recipient|address|mailbox)|mailbox (unavailable|not found)|recipient (address )?rejected/i.test(text)
  )
}
