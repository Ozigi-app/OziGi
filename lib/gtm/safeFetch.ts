/**
 * Fetch for URLs we did not choose (a user supplies the domain). A plain
 * fetch() here would let anyone point the crawler at our own network:
 * localhost, the cloud metadata service (169.254.169.254), internal hosts.
 *
 * Every hop is checked, including redirects. Known limit: we resolve the
 * hostname to vet it and fetch() resolves it again, so a hostile DNS server
 * could answer differently the second time (DNS rebinding). Closing that needs
 * a pinned-IP dispatcher; the checks below stop the realistic attacks.
 */
import { promises as dns } from 'dns'
import net from 'net'

export const BOT_USER_AGENT = 'OzigiBot/1.0 (+https://ozigi.app/bot)'

const MAX_REDIRECTS = 3
const TIMEOUT_MS = 6000
const MAX_BYTES = 400_000

export function isPrivateAddress(ip: string): boolean {
  if (net.isIPv4(ip)) {
    const [a, b] = ip.split('.').map(Number)
    return (
      a === 0 || a === 10 || a === 127 ||
      (a === 100 && b >= 64 && b <= 127) ||    // carrier-grade NAT
      (a === 169 && b === 254) ||              // link-local, cloud metadata
      (a === 172 && b >= 16 && b <= 31) ||
      (a === 192 && b === 168) ||
      a >= 224                                  // multicast, reserved
    )
  }
  if (net.isIPv6(ip)) {
    const v = ip.toLowerCase()
    const mapped = /^::ffff:(\d+\.\d+\.\d+\.\d+)$/.exec(v)
    if (mapped) return isPrivateAddress(mapped[1])
    return v === '::' || v === '::1' || /^f[cd]/.test(v) || /^fe[89ab]/.test(v)
  }
  return true // not an IP at all: refuse
}

async function assertPublicHost(hostname: string): Promise<void> {
  if (net.isIP(hostname)) {
    if (isPrivateAddress(hostname)) throw new Error('blocked: private address')
    return
  }
  const addrs = await dns.lookup(hostname, { all: true })
  if (!addrs.length || addrs.some(a => isPrivateAddress(a.address))) {
    throw new Error('blocked: resolves to a private address')
  }
}

export interface SafeFetchResult {
  status: number
  url: string
  body: string
}

/** `allowPrivate` exists only so tests can hit a local server. Never expose it. */
export async function safeFetch(
  rawUrl: string,
  opts: { allowPrivate?: boolean } = {},
): Promise<SafeFetchResult> {
  let url = new URL(rawUrl)
  for (let hop = 0; hop <= MAX_REDIRECTS; hop++) {
    if (url.protocol !== 'http:' && url.protocol !== 'https:') throw new Error('blocked: protocol')
    if (!opts.allowPrivate) await assertPublicHost(url.hostname)

    const res = await fetch(url, {
      redirect: 'manual',
      signal: AbortSignal.timeout(TIMEOUT_MS),
      headers: { 'User-Agent': BOT_USER_AGENT, Accept: 'text/html,text/plain;q=0.9,*/*;q=0.1' },
    })

    if (res.status >= 300 && res.status < 400 && res.headers.get('location')) {
      url = new URL(res.headers.get('location')!, url)
      continue
    }

    const type = res.headers.get('content-type') ?? ''
    if (res.ok && type && !/text\/|html|xml/i.test(type)) {
      return { status: res.status, url: url.toString(), body: '' }
    }

    // Read at most MAX_BYTES, so a huge or endless response cannot tie us up.
    const reader = res.body?.getReader()
    let received = 0
    const chunks: Uint8Array[] = []
    while (reader) {
      const { done, value } = await reader.read()
      if (done) break
      received += value.length
      chunks.push(value)
      if (received >= MAX_BYTES) { await reader.cancel(); break }
    }
    return {
      status: res.status,
      url: url.toString(),
      body: Buffer.concat(chunks).toString('utf8').slice(0, MAX_BYTES),
    }
  }
  throw new Error('blocked: too many redirects')
}
