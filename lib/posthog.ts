/**
 * Shared PostHog server-side utility.
 *
 * Usage:
 *   import { phCapture } from '@/lib/posthog'
 *   await phCapture(userId, 'my_event', { foo: 'bar' })
 *
 * Each call creates and immediately shuts down a PostHog client.
 * This is the correct pattern for short-lived serverless/edge functions.
 */
import { PostHog } from 'posthog-node'

function makeClient() {
  return new PostHog(process.env.NEXT_PUBLIC_POSTHOG_KEY!, {
    host: process.env.NEXT_PUBLIC_POSTHOG_HOST || 'https://us.i.posthog.com',
  })
}

/**
 * Fire a single PostHog event and flush immediately.
 * Safe to await or fire-and-forget (.catch(() => {})).
 */
export async function phCapture(
  distinctId: string,
  event: string,
  properties?: Record<string, unknown>,
): Promise<void> {
  try {
    const ph = makeClient()
    ph.capture({ distinctId, event, properties })
    await ph.shutdown()
  } catch {
    // Never let analytics errors surface to users
  }
}
