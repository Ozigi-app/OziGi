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

  // Weekly-rotating session ID → same residential IP for 7 days, then fresh.
  // Daily rotation caused LinkedIn to see a new IP every morning and block it
  // immediately (BLANK_PAGE on every profile visit). Weekly keeps the same IP long
  // enough for LinkedIn to treat it as a trusted device, while still rotating before
  // the IP accumulates enough bot-signal to trigger ERR_CONNECTION_CLOSED.
  // Provider sticky format (proxy.smartproxy.net): {base_username}_area-US_session-{id}
  // area-US pins all residential IPs to the United States so LinkedIn always
  // shows an English UI and associates the session with one locale.
  // NOTE: this provider ignores the Decodo-style `_country-us` modifier (it
  // silently returns a random-geo IP) — `_area-US` is the syntax it honours,
  // verified 2026-07-14 after the subscription renewal.
  const shortUserId    = userId.replace(/[^a-z0-9]/gi, '').slice(0, 6).toLowerCase()
  const weekStamp      = Math.floor(Date.now() / (7 * 24 * 60 * 60 * 1000))  // changes weekly
  // Increment the epoch suffix to force a fresh residential IP when the current
  // week's IP gets blocked by LinkedIn. Keeps the weekly cadence intact.
  const PROXY_EPOCH    = 'b'
  const sessionId      = `${shortUserId}${weekStamp.toString(36)}${PROXY_EPOCH}`
  const stickyUsername = `${username}_area-US_session-${sessionId}`

  // Start (or reuse) the local HTTP→HTTP proxy tunnel that sends auth upfront
  const localPort = await startLocalProxy(host, socksPort, stickyUsername, password)

  console.log(`[proxy] routing through 127.0.0.1:${localPort} → http://${host}:${socksPort} as ${stickyUsername}:***`)

  return { server: `http://127.0.0.1:${localPort}` }
}
