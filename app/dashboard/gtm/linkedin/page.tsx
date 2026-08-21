'use client'
import { useEffect, useState, useCallback } from 'react'
import { UserPlus, CheckCircle, Clock, RefreshCw } from 'lucide-react'
import GtmPageHeader from '@/components/gtm/GtmPageHeader'
import FreeAgentBanner from '@/components/gtm/FreeAgentBanner'
import ExtensionStatusPanel from '@/components/gtm/ExtensionStatusPanel'
import Link from 'next/link'

interface QueueItem {
  id: string
  lead_id: string
  action: string
  status: string
  scheduled_at: string
  processed_at: string | null
  campaign_id: string
  leadName: string | null
  leadUrl: string | null
  leadHeadline: string | null
}

const STATUS_ICON: Record<string, React.ReactNode> = {
  done:        <CheckCircle size={14} className="text-green-500" />,
  queued:      <Clock       size={14} className="text-amber-500" />,
  in_progress: <Clock       size={14} className="text-accent"    />,
}

function formatScheduled(iso: string): string {
  const d = new Date(iso)
  const now = new Date()
  if (d <= now) return 'ASAP'
  const todayStr = now.toDateString()
  if (d.toDateString() === todayStr) {
    return `Today ${d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`
  }
  const tomorrow = new Date(now); tomorrow.setDate(tomorrow.getDate() + 1)
  if (d.toDateString() === tomorrow.toDateString()) {
    return `Tomorrow ${d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`
  }
  return d.toLocaleDateString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
}

export default function LinkedInOutreachPage() {
  const [items, setItems]     = useState<QueueItem[]>([])
  const [loading, setLoading] = useState(true)
  // Whether the extension is set up yet — it's the actual pipeline, so until
  // it has a token, sending someone to create another ICP campaign gets them
  // no closer to a connection request going out. null while unknown (first load).
  const [hasExtensionToken, setHasExtensionToken] = useState<boolean | null>(null)

  const load = useCallback(() => {
    return fetch('/api/gtm/linkedin/queue')
      .then(r => r.json())
      .then(d => { setItems(d.items ?? []); setLoading(false) })
      .catch(() => setLoading(false))
  }, [])

  useEffect(() => { load() }, [load])

  useEffect(() => {
    fetch('/api/gtm/linkedin/extension-status')
      .then(r => r.json())
      .then(d => setHasExtensionToken(!!d.hasToken))
      .catch(() => setHasExtensionToken(true)) // fail open — don't block the normal CTA on a status-check hiccup
  }, [])

  const today = new Date().toDateString()
  const sentToday  = items.filter(i => i.status === 'done' && i.processed_at && new Date(i.processed_at).toDateString() === today).length
  const scheduled  = items.filter(i => i.status === 'queued' || i.status === 'in_progress').length
  const totalSent  = items.filter(i => i.status === 'done').length

  const nextItem = items
    .filter(i => i.status === 'queued')
    .sort((a, b) => new Date(a.scheduled_at).getTime() - new Date(b.scheduled_at).getTime())[0]
  const nextSend = nextItem ? formatScheduled(nextItem.scheduled_at) : null

  return (
    <div>
      <GtmPageHeader title="LinkedIn Outreach" />
      <div className="px-8 py-7 max-w-4xl mx-auto">
        <div className="flex items-start justify-between mb-6">
          <div className="flex items-center gap-3">
            <UserPlus size={20} className="text-[#0a66c2]" />
            <div>
              <h1 className="text-2xl font-bold text-foreground tracking-tight">LinkedIn</h1>
              <p className="text-foreground-subtle text-sm mt-0.5">
                Finds leads and sends connection requests from your own browser, at a human pace
              </p>
            </div>
          </div>
          {/* Without the extension there's nothing to send a connection request from,
              no matter how many campaigns exist — so that's the closer next step
              until it's set up. Once it's connected, adding an ICP-defined campaign
              is what actually finds more leads. */}
          <Link
            href={hasExtensionToken === false ? '/dashboard/gtm/settings#linkedin' : '/dashboard/gtm/linkedin/new'}
            className="flex items-center gap-2 px-4 py-2.5 border border-border hover:border-foreground-subtle text-foreground font-bold text-sm rounded-xl transition-colors no-underline"
          >
            {hasExtensionToken === false ? 'Set up the extension' : '+ New campaign'}
          </Link>
        </div>

        {/* The extension is the pipeline, so it leads the page. Everything below
            is the record of what it has done. */}
        <ExtensionStatusPanel />

        {/* Stats */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-6">
          <div className="bg-surface border border-border rounded-xl p-4">
            <div className="text-2xl font-bold text-green-600">{sentToday}</div>
            <div className="text-foreground-subtle text-xs mt-0.5">Requests sent today</div>
          </div>
          <div className="bg-surface border border-border rounded-xl p-4">
            <div className="text-2xl font-bold text-amber-600">{scheduled}</div>
            <div className="text-foreground-subtle text-xs mt-0.5">
              Waiting to send
              {nextSend && <span className="ml-1 text-foreground-subtle">· next: {nextSend}</span>}
            </div>
          </div>
          <div className="bg-surface border border-border rounded-xl p-4">
            <div className="text-2xl font-bold text-foreground">{totalSent}</div>
            <div className="text-foreground-subtle text-xs mt-0.5">Total requests sent</div>
          </div>
        </div>

        {/* Queue table */}
        <div className="bg-surface border border-border rounded-xl overflow-hidden">
          <div className="px-5 py-4 border-b border-border flex items-center justify-between">
            <span className="text-foreground font-semibold text-sm">Connection requests</span>
            <button onClick={load} className="text-foreground-subtle hover:text-foreground">
              <RefreshCw size={14} />
            </button>
          </div>

          {loading ? (
            <div className="px-5 py-10 text-center text-foreground-subtle text-sm">Loading…</div>
          ) : items.length === 0 ? (
            <div className="px-5 py-10 text-center text-foreground-subtle text-sm">
              Nothing here yet. Once the extension is running it finds people matching your ICP and
              sends them connection requests — they&rsquo;ll appear here as it goes.
            </div>
          ) : (
            <div className="overflow-x-auto">
            <table className="w-full min-w-[480px] text-sm">
              <thead>
                <tr className="border-b border-border text-left">
                  {['Lead', 'Status', 'Scheduled / Sent'].map(h => (
                    <th key={h} className="px-5 py-3 text-foreground-subtle text-xs font-medium">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {items.map(item => (
                  <tr key={item.id} className="hover:bg-surface-2 transition-colors">
                    <td className="px-5 py-3">
                      {item.leadUrl ? (
                        <a href={item.leadUrl} target="_blank" rel="noreferrer"
                           className="text-foreground font-medium hover:text-accent no-underline">
                          {item.leadName || 'View profile'}
                        </a>
                      ) : (
                        <span className="text-foreground font-medium">{item.leadName || '—'}</span>
                      )}
                      {item.leadHeadline && (
                        <div className="text-foreground-subtle text-xs truncate max-w-[280px]">{item.leadHeadline}</div>
                      )}
                    </td>
                    <td className="px-5 py-3">
                      <span className="flex items-center gap-1.5">
                        {STATUS_ICON[item.status] ?? null}
                        <span className="text-foreground-muted capitalize">{item.status.replace('_', ' ')}</span>
                      </span>
                    </td>
                    <td className="px-5 py-3 text-foreground-subtle text-xs">
                      {item.status === 'done'
                        ? item.processed_at ? new Date(item.processed_at).toLocaleString() : '—'
                        : item.status === 'queued'
                          ? formatScheduled(item.scheduled_at)
                          : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            </div>
          )}
        </div>

        {/* Unrelated to the pipeline — a separate open-source project. Kept at the
            bottom so it doesn't read as an alternative to the extension. */}
        <div className="mt-8 pt-2 opacity-80">
          <FreeAgentBanner />
        </div>
      </div>
    </div>
  )
}
