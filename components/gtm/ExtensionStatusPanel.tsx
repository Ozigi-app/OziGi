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
  queuedConnects: number
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
            <p className="font-bold text-amber-900 dark:text-amber-200">Your LinkedIn pipeline isn&rsquo;t set up yet</p>
            <p className="text-amber-800 dark:text-amber-300/90 mt-1">
              LinkedIn runs entirely in your own browser — the Ozigi extension finds people matching
              your ICP and sends them connection requests. Until it&rsquo;s installed, no LinkedIn
              leads are found and nothing is sent.{' '}
              <Link href="/dashboard/gtm/settings" className="underline font-semibold">Set it up in Integrations</Link>.
            </p>
          </div>
        </div>
      </div>
    )
  }

  return (
    // Idle is not a neutral state: the extension IS the LinkedIn pipeline, so
    // while it's asleep nothing is being found and nothing is being sent. The
    // panel says so rather than sitting quietly like an optional integration.
    <div className={`mb-6 rounded-xl border p-5 ${
      s.connected ? 'border-border bg-surface' : 'border-amber-300 bg-amber-50/60 dark:bg-amber-950/20'
    }`}>
      <div className="flex items-center gap-3 mb-4">
        <Puzzle size={20} className="text-[#0a66c2] shrink-0" />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="font-bold text-base text-foreground">Your LinkedIn pipeline</span>
            {s.connected ? (
              <span className="inline-flex items-center gap-1 text-[11px] font-bold text-green-600">
                <CheckCircle2 size={12} /> Running
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 text-[11px] font-bold text-amber-700 dark:text-amber-400">
                <span className="w-2 h-2 rounded-full bg-amber-500" /> Paused
              </span>
            )}
          </div>
          <p className="text-xs text-foreground-subtle mt-0.5">
            {s.connected
              ? 'Finding leads and sending connection requests from your LinkedIn tab'
              : `Nothing is being found or sent. Last active ${ago(s.lastUsedAt)} — open Chrome with a LinkedIn tab and the extension switched on.`}
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
          <div className="text-lg font-bold text-foreground leading-tight">{s.queuedConnects}</div>
          <div className="text-[11px] text-foreground-subtle">Requests queued</div>
        </div>
      </div>

      {note && <p className="text-[11px] text-foreground-subtle mt-2">{note}</p>}
    </div>
  )
}
