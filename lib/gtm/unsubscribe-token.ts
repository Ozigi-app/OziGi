import crypto from 'crypto'

function getKey(): string {
  const k = process.env.GTM_ENCRYPTION_KEY
  if (!k) throw new Error('GTM_ENCRYPTION_KEY not set')
  return k
}

/**
 * Creates a signed, URL-safe token encoding leadId + campaignId.
 * Token format (base64url): leadId:campaignId:hmac
 */
export function createUnsubscribeToken(leadId: string, campaignId: string): string {
  const payload = `${leadId}:${campaignId}`
  const hmac = crypto
    .createHmac('sha256', getKey())
    .update(payload)
    .digest('hex')
  return Buffer.from(`${payload}:${hmac}`).toString('base64url')
}

/**
 * Verifies the token and returns the encoded IDs.
 * Returns null if the token is invalid or tampered with.
 */
export function verifyUnsubscribeToken(
  token: string
): { leadId: string; campaignId: string } | null {
  try {
    const decoded = Buffer.from(token, 'base64url').toString('utf8')
    // UUIDs contain only hex + hyphens, so split on last two colons
    const lastColon  = decoded.lastIndexOf(':')
    const secondLast = decoded.lastIndexOf(':', lastColon - 1)
    if (lastColon < 0 || secondLast < 0) return null

    const leadId     = decoded.slice(0, secondLast)
    const campaignId = decoded.slice(secondLast + 1, lastColon)
    const hmac       = decoded.slice(lastColon + 1)

    const expected = crypto
      .createHmac('sha256', getKey())
      .update(`${leadId}:${campaignId}`)
      .digest('hex')

    if (!crypto.timingSafeEqual(Buffer.from(hmac), Buffer.from(expected))) return null
    return { leadId, campaignId }
  } catch {
    return null
  }
}
