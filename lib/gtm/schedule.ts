/**
 * Spreads LinkedIn queue items across business hours so the worker
 * sends them at human-like intervals instead of all at once.
 *
 * LinkedIn's safe limit is ~20-25 connections/day. Items are spaced
 * evenly across a 9am–5pm window with ±3 min jitter.
 */

const BUSINESS_START_HOUR = 9   // 9am UTC
const BUSINESS_END_HOUR   = 17  // 5pm UTC
const WINDOW_MS = (BUSINESS_END_HOUR - BUSINESS_START_HOUR) * 60 * 60_000  // 8h in ms
const JITTER_MS = 3 * 60_000   // ±3 min

/**
 * Returns a scheduled_at timestamp for a LinkedIn queue item.
 *
 * @param slotIndexToday  0-based position among ALL items queued today
 *                        (already sent + this batch). Pass liEnqueuedToday + batchIndex.
 * @param dailyLimit      Campaign's daily LinkedIn limit (e.g. 20)
 */
export function spreadScheduledAt(
  slotIndexToday: number,
  dailyLimit: number,
): string {
  const now = new Date()

  // Start of business window today (UTC)
  const dayStart = new Date(now)
  dayStart.setUTCHours(BUSINESS_START_HOUR, 0, 0, 0)

  // ms per slot across the full 8-hour window
  const msPerSlot = WINDOW_MS / Math.max(dailyLimit, 1)

  // This item's ideal send time
  const idealMs = dayStart.getTime() + slotIndexToday * msPerSlot

  // Jitter so sends don't land on exact-minute boundaries
  const jitter = (Math.random() - 0.5) * 2 * JITTER_MS

  // Never schedule in the past — push to at least 1 minute from now
  const scheduledMs = Math.max(idealMs + jitter, now.getTime() + 60_000)

  return new Date(scheduledMs).toISOString()
}
