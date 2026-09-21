import Link from 'next/link'

/** Shown in place of a page's data when the session has lapsed. The reassurance
 *  is the point — the failure mode this replaces looked like a wiped account. */
export default function SessionExpiredNotice() {
  return (
    <div className="mx-auto my-12 max-w-md rounded-xl border border-amber-300 bg-amber-50 px-6 py-6 text-center">
      <p className="m-0 font-bold text-amber-900">You&rsquo;ve been signed out</p>
      <p className="mt-2 mb-5 text-sm leading-relaxed text-amber-800/90">
        Your session expired. Nothing has been lost &mdash; sign in again to pick up where you left off.
      </p>
      <Link
        href="/"
        className="inline-block rounded-lg bg-accent px-4 py-2 text-sm font-bold text-white no-underline transition-colors hover:bg-accent/90"
      >
        Sign in
      </Link>
    </div>
  )
}
