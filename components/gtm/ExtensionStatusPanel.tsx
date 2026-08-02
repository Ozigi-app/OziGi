'use client'
import { useCallback, useEffect, useState } from 'react'
import { Puzzle, RefreshCw, Search, AlertTriangle, CheckCircle2 } from 'lucide-react'
import Link from 'next/link'

// Sending and searching both happen inside the browser extension now, which made
// them invisible from the app: an expired LinkedIn session, a disabled
// extension, and "nothing due today" all looked identical from here. This panel
// is the one place that says which.

interface Status {
  hasToken: boolean
  connected: boolean
  lastUsedAt: string | null
  lastSearchAt: string | null
  leadsFoundToday: number
  deferredMessages: number
  searchRequestedAt: string | null
}

function ago(iso: string | null): string {
  if (!iso) return 'never'
  const mins = Math.floor((Date.now() - new Date(iso).getTime()) / 60000)
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h ago`
  return `${Math.floor(hrs / 24)}d ago`
}

export default function ExtensionStatusPanel() {
  const [s, setS] = useState<Status | null>(null)
  const [requesting, setRequesting] = useState(false)
  const [note, setNote] = useState('')

  const load = useCallback(() => {
    fetch('/api/gtm/linkedin/extension-status')
      .then(r => r.json())
      .then(d => { if (!d.error) setS(d) })
      .catch(() => {})
  }, [])

  useEffect(() => {
    load()
    // The extension polls every 30s; match it so "connected" doesn't sit stale
    // while someone is watching the page waiting for it to come alive.
    const t = setInterval(load, 30_000)
    return () => clearInterval(t)
  }, [load])

  async function searchNow() {
    setRequesting(true)
    setNote('')
    try {
      const r = await fetch('/api/gtm/linkedin/extension-status', { method: 'POST' })
      setNote(r.ok
        ? 'Queued — the extension picks this up within 30 seconds.'
        : 'Could not queue the search.')
      load()
    } catch {
      setNote('Could not queue the search.')
    } finally {
      setRequesting(false)
    }
  }

  if (!s) return null

  // No token means the extension was never set up. Nothing else on this panel
  // is meaningful yet, so say the one thing that matters.
  if (!s.hasToken) {
    return (
      <div className="mb-6 rounded-xl border border-amber-300 bg-amber-50 dark:bg-amber-950/20 p-4">
        <div className="flex items-start gap-3">
          <AlertTriangle size={18} className="text-amber-600 mt-0.5 shrink-0" />
          <div className="text-sm">
            <p className="font-bold text-amber-900 dark:text-amber-200">The browser extension isn&rsquo;t set up</p>
            <p className="text-amber-800 dark:text-amber-300/90 mt-1">
              LinkedIn actions run from your own logged-in tab, so nothing sends or gets found until
              the extension is installed and connected.{' '}
              <Link href="/dashboard/gtm/settings" className="underline font-semibold">Set it up in Integrations</Link>.
            </p>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="mb-6 rounded-xl border border-border bg-surface p-4">
      <div className="flex items-center gap-3 mb-3">
        <Puzzle size={18} className="text-[#0a66c2] shrink-0" />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="font-bold text-sm text-foreground">Browser extension</span>
            {s.connected ? (
              <span className="inline-flex items-center gap-1 text-[11px] font-bold text-green-600">
                <CheckCircle2 size={12} /> Active
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 text-[11px] font-bold text-foreground-subtle">
                <span className="w-2 h-2 rounded-full bg-slate-400" /> Idle
              </span>
            )}
          </div>
          <p className="text-xs text-foreground-subtle mt-0.5">
            {s.connected
              ? 'Sending and searching from your LinkedIn tab'
              : `Last seen ${ago(s.lastUsedAt)} — open Chrome with a LinkedIn tab and the extension enabled`}
          </p>
        </div>
        <button
          onClick={searchNow}
          disabled={requesting}
          className="flex items-center gap-1.5 px-3 py-2 rounded-lg border border-border bg-background hover:border-foreground-subtle text-xs font-bold text-foreground disabled:opacity-50 transition-colors"
        >
          {requesting ? <RefreshCw size={13} className="animate-spin" /> : <Search size={13} />}
          Find leads now
        </button>
      </div>

      <div className="grid grid-cols-3 gap-3 text-center">
        <div className="rounded-lg bg-background border border-border py-2">
          <div className="text-lg font-bold text-foreground leading-tight">{s.leadsFoundToday}</div>
          <div className="text-[11px] text-foreground-subtle">Leads found today</div>
        </div>
        <div className="rounded-lg bg-background border border-border py-2">
          <div className="text-lg font-bold text-foreground leading-tight">{ago(s.lastSearchAt)}</div>
          <div className="text-[11px] text-foreground-subtle">Last search</div>
        </div>
        <div className="rounded-lg bg-background border border-border py-2">
          <div className="text-lg font-bold text-foreground leading-tight">{s.deferredMessages}</div>
          <div className="text-[11px] text-foreground-subtle">Message steps held</div>
        </div>
      </div>

      {s.deferredMessages > 0 && (
        // These aren't failures and aren't lost — but they will never send while
        // messaging is off, and a silently growing backlog is worse than a label.
        <p className="text-[11px] text-foreground-subtle mt-3 leading-relaxed">
          LinkedIn messaging is currently paused, so message and follow-up steps stay queued rather
          than sending. Connection requests are unaffected.
        </p>
      )}

      {note && <p className="text-[11px] text-foreground-subtle mt-2">{note}</p>}
    </div>
  )
}
