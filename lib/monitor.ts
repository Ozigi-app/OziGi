import { PostHog } from 'posthog-node';

/**
 * Failure reporting via PostHog Error Tracking.
 *
 * Routes here catch their own errors and return JSON, so nothing escapes to
 * a framework-level handler. Call this from the catch block instead.
 *
 * Deliberately NOT a product event: captureException lands in PostHog's Error
 * Tracking tab, where repeats are grouped into one issue, so it does not add
 * event names to the main event stream. `area` (e.g. "publish.linkedin") is
 * the only dimension to filter on.
 */
function makeClient() {
  return new PostHog(process.env.NEXT_PUBLIC_POSTHOG_KEY!, {
    host: process.env.NEXT_PUBLIC_POSTHOG_HOST || 'https://us.i.posthog.com',
  });
}

export async function reportFailure(
  area: string,
  error: unknown,
  extra: Record<string, unknown> = {},
): Promise<void> {
  console.error(`[${area}]`, error);
  try {
    const ph = makeClient();
    const { userId, ...rest } = extra;
    ph.captureException(
      error instanceof Error ? error : new Error(String(error)),
      typeof userId === 'string' ? userId : 'system',
      { area, ...rest },
    );
    await ph.shutdown();
  } catch {
    // Monitoring must never break the request it is observing.
  }
}

/**
 * For failures the user has to fix themselves (an expired LinkedIn token):
 * expected, but worth counting. One event name for all of them, split by `area`.
 */
export async function reportWarning(
  area: string,
  message: string,
  extra: Record<string, unknown> = {},
): Promise<void> {
  try {
    const ph = makeClient();
    const { userId, ...rest } = extra;
    ph.capture({
      distinctId: typeof userId === 'string' ? userId : 'system',
      event: 'ops_warning',
      properties: { area, message, ...rest },
    });
    await ph.shutdown();
  } catch {
    // see reportFailure
  }
}
