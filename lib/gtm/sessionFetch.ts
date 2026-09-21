/** Thrown when a GTM API route rejects the request because the session is gone.
 *  Callers must render this differently from an empty result: a 401 defaulted to
 *  `[]` renders as "No campaigns yet", which reads as a deleted account. */
export class SessionExpiredError extends Error {
  constructor() {
    super('Session expired')
    this.name = 'SessionExpiredError'
  }
}

export async function getJson<T>(url: string): Promise<T> {
  const res = await fetch(url)
  if (res.status === 401) throw new SessionExpiredError()
  if (!res.ok) throw new Error(`${url} failed (${res.status})`)
  return res.json() as Promise<T>
}
