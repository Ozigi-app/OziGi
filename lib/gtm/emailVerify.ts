/**
 * Mailbox verification through a third-party verifier. We do not probe mail
 * servers ourselves: serverless hosts block outbound port 25, many servers
 * accept everything (catch-all) or greylist strangers, and probing from our own
 * IPs would damage the reputation we need for sending.
 *
 * Provider is chosen by whichever key is set. With none set, verification is
 * 'unavailable' and the finder never reports a guess as usable.
 *
 * NOTE: response shapes below follow each vendor's public docs from memory and
 * have not been exercised against the live APIs. Check with one real call
 * before relying on them.
 */
export type VerifyStatus = 'valid' | 'invalid' | 'catch_all' | 'unknown' | 'unavailable'

export function verifierConfigured(): boolean {
  return !!(process.env.MILLIONVERIFIER_API_KEY || process.env.ZEROBOUNCE_API_KEY)
}

export async function verifyEmail(email: string): Promise<VerifyStatus> {
  try {
    if (process.env.MILLIONVERIFIER_API_KEY) {
      const url = `https://api.millionverifier.com/api/v3/?api=${encodeURIComponent(process.env.MILLIONVERIFIER_API_KEY)}&email=${encodeURIComponent(email)}&timeout=10`
      const res = await fetch(url, { signal: AbortSignal.timeout(15000) })
      if (!res.ok) return 'unknown'
      const { result } = await res.json() as { result?: string }
      if (result === 'ok') return 'valid'
      if (result === 'invalid' || result === 'disposable') return 'invalid'
      if (result === 'catch_all') return 'catch_all'
      return 'unknown'
    }
    if (process.env.ZEROBOUNCE_API_KEY) {
      const url = `https://api.zerobounce.net/v2/validate?api_key=${encodeURIComponent(process.env.ZEROBOUNCE_API_KEY)}&email=${encodeURIComponent(email)}`
      const res = await fetch(url, { signal: AbortSignal.timeout(15000) })
      if (!res.ok) return 'unknown'
      const { status } = await res.json() as { status?: string }
      if (status === 'valid') return 'valid'
      if (status === 'invalid' || status === 'spamtrap' || status === 'abuse' || status === 'do_not_mail') return 'invalid'
      if (status === 'catch-all') return 'catch_all'
      return 'unknown'
    }
  } catch {
    return 'unknown'
  }
  return 'unavailable'
}
