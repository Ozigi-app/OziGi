/**
 * How many more outreach emails a user may send under their plan, tracked
 * through a cron run.
 *
 * The plan's usage counter is read once when a campaign starts and only
 * updated as sends complete, so checking it before the loop let a user at
 * 29/30 send a full batch (a free account was found at 35/30). The budget is
 * therefore taken once per user per run and decremented on every send.
 */
export function initialSendBudget(limit: number, used: number): number {
  return limit === -1 ? Infinity : Math.max(0, limit - used)
}
