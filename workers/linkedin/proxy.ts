/**
 * Builds a per-user proxy config for Playwright.
 *
 * Chromium cannot do SOCKS5 with auth, so we run a local HTTP CONNECT proxy
 * (local-proxy.ts) that handles SOCKS5 auth to IPRoyal internally.
 * Chromium connects to 127.0.0.1:<port> — no auth needed for localhost.
 *
 * Required env vars:
 *   PROXY_HOST     — e.g. geo.iproyal.com
 *   PROXY_PORT     — SOCKS5 port from your dashboard (e.g. 12322)
 *   PROXY_USERNAME — your proxy username
 *   PROXY_PASSWORD — your proxy password
 */
import net from 'net'
import { startLocalProxy } from './local-proxy'

async function testTcpConnectivity(host: string, port: number): Promise<boolean> {
  return new Promise(resolve => {
    const socket = new net.Socket()
    socket.setTimeout(5_000)
    socket.connect(port, host, () => { socket.destroy(); resolve(true) })
    socket.on('error',   () => resolve(false))
    socket.on('timeout', () => { socket.destroy(); resolve(false) })
  })
}

export async function getProxyConfig(
  userId: string,
): Promise<{ server: string } | undefined> {
  const host     = process.env.PROXY_HOST
  const port     = process.env.PROXY_PORT
  const username = process.env.PROXY_USERNAME
  const password = process.env.PROXY_PASSWORD

  if (!host || !port || !username || !password) {
    if (process.env.NODE_ENV === 'production') {
      console.warn('[proxy] PROXY_HOST/PORT/USERNAME/PASSWORD not set — LinkedIn will likely block datacenter IP')
    }
    return undefined
  }

  const socksPort = Number(port)

  const reachable = await testTcpConnectivity(host, socksPort)
  if (!reachable) {
    console.error(`[proxy] ✗ cannot reach ${host}:${socksPort} — check firewall or port`)
    return undefined
  }
  console.log(`[proxy] ✓ ${host}:${socksPort} is reachable`)

  // Daily-rotating session ID → fresh residential IP each day, stable within the day.
  // A fixed session ID meant the same IP was reused indefinitely — LinkedIn flags it
  // after enough profile visits, causing ERR_CONNECTION_CLOSED on all /in/ navigations.
  // Rotating daily gives a clean IP each morning while keeping the fingerprint consistent
  // within any single worker run.
  // Smartproxy sticky format: {base_username}_session-{id}
  const shortUserId    = userId.replace(/[^a-z0-9]/gi, '').slice(0, 6).toLowerCase()
  const dayStamp       = Math.floor(Date.now() / (24 * 60 * 60 * 1000))  // changes at UTC midnight
  const sessionId      = `${shortUserId}${dayStamp.toString(36)}`          // e.g. "abc123kqf"
  const stickyUsername = `${username}_session-${sessionId}`

  // Start (or reuse) the local HTTP→HTTP proxy tunnel that sends auth upfront
  const localPort = await startLocalProxy(host, socksPort, stickyUsername, password)

  console.log(`[proxy] routing through 127.0.0.1:${localPort} → http://${host}:${socksPort} as ${stickyUsername}:***`)

  return { server: `http://127.0.0.1:${localPort}` }
}
