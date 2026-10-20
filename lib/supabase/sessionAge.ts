// Absolute session lifetime. Supabase's own "time-box" setting is Pro-only, so
// we enforce it ourselves: each browser remembers when it first saw a session
// and signs out once that is older than MAX_SESSION_DAYS.
export const MAX_SESSION_DAYS = 15;

const KEY = "ozigi_session_started_at";
const MAX_MS = MAX_SESSION_DAYS * 24 * 60 * 60 * 1000;

/** Call when a session exists. Returns true if it has outlived the limit. */
export function isSessionExpired(): boolean {
  try {
    const raw = localStorage.getItem(KEY);
    const started = raw ? Number(raw) : NaN;
    if (!Number.isFinite(started)) {
      // First sight of this session (including sessions that predate this
      // check) — start the clock now.
      localStorage.setItem(KEY, String(Date.now()));
      return false;
    }
    return Date.now() - started > MAX_MS;
  } catch {
    return false; // storage unavailable — never lock anyone out because of it
  }
}

export function clearSessionStart(): void {
  try { localStorage.removeItem(KEY); } catch {}
}
