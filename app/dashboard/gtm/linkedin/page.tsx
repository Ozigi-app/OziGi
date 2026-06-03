'use client'
import { useEffect, useState, useCallback } from 'react'
import { UserPlus, CheckCircle, Clock, XCircle, RefreshCw } from 'lucide-react'
import GtmPageHeader from '@/components/gtm/GtmPageHeader'
import FreeAgentBanner from '@/components/gtm/FreeAgentBanner'
import Link from 'next/link'

interface QueueItem {
  id: string
  lead_id: string
  action: string
  status: string
  scheduled_at: string
  processed_at: string | null
  campaign_id: string
}

const STATUS_ICON: Record<string, React.ReactNode> = {
  done:        <CheckCircle size={14} className="text-green-500"  />,
  queued:      <Clock       size={14} className="text-amber-500"  />,
  in_progress: <Clock       size={14} className="text-accent"     />,
  failed:      <XCircle     size={14} className="text-red-500"    />,
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
  const [items, setItems]         = useState<QueueItem[]>([])
  const [loading, setLoading]     = useState(true)
  const [retrying, setRetrying]   = useState(false)

  const load = useCallback(() => {
    fetch('/api/gtm/linkedin/queue')
      .then(r => r.json())
      .then(d => { setItems(d.items ?? []); setLoading(false) })
      .catch(() => setLoading(false))
  }, [])

  useEffect(() => { load() }, [load])

  const today = new Date().toDateString()
  const sentToday  = items.filter(i => i.status === 'done' && i.processed_at && new Date(i.processed_at).toDateString() === today).length
  const scheduled  = items.filter(i => i.status === 'queued').length
  const inProgress = items.filter(i => i.status === 'in_progress').length
  const failed     = items.filter(i => i.status === 'failed').length
  const done       = items.filter(i => i.status === 'done').length

  // Next scheduled send
  const nextItem = items
    .filter(i => i.status === 'queued')
    .sort((a, b) => new Date(a.scheduled_at).getTime() - new Date(b.scheduled_at).getTime())[0]
  const nextSend = nextItem ? formatScheduled(nextItem.scheduled_at) : null

  async function retryFailed() {
    setRetrying(true)
    await fetch('/api/gtm/linkedin/retry-failed', { method: 'POST' })
    await load()
    setRetrying(false)
  }

  return (
    <div>
      <GtmPageHeader title="LinkedIn Outreach" />
      <div className="px-8 py-7 max-w-4xl">
        <div className="flex items-start justify-between mb-7">
          <div className="flex items-center gap-3">
            <UserPlus size={20} className="text-[#0a66c2]" />
            <div>
              <h1 className="text-2xl font-bold text-foreground tracking-tight">LinkedIn Outreach</h1>
              <p className="text-foreground-subtle text-sm mt-0.5">Actions are spread across business hours automatically</p>
            </div>
          </div>
          <Link
            href="/dashboard/gtm/new"
            className="flex items-center gap-2 px-4 py-2.5 bg-accent hover:bg-accent/90 text-white font-bold text-sm rounded-xl transition-colors no-underline"
          >
            + New Campaign
          </Link>
        </div>

        <FreeAgentBanner />

        {/* Stats */}
        <div className="grid grid-cols-2 gap-3 mb-3">
          <div className="bg-surface border border-border rounded-xl p-4">
            <div className="text-2xl font-bold text-green-600">{sentToday}</div>
            <div className="text-foreground-subtle text-xs mt-0.5">Sent today</div>
          </div>
          <div className="bg-surface border border-border rounded-xl p-4">
            <div className="text-2xl font-bold text-amber-600">{scheduled + inProgress}</div>
            <div className="text-foreground-subtle text-xs mt-0.5">
              Scheduled
              {nextSend && <span className="ml-1 text-foreground-subtle">· next: {nextSend}</span>}
            </div>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3 mb-6">
          <div className="bg-surface border border-border rounded-xl p-4">
            <div className="text-2xl font-bold text-foreground">{done}</div>
            <div className="text-foreground-subtle text-xs mt-0.5">Total sent</div>
          </div>
          <div className="bg-surface border border-border rounded-xl p-4 flex items-center justify-between">
            <div>
              <div className="text-2xl font-bold text-red-500">{failed}</div>
              <div className="text-foreground-subtle text-xs mt-0.5">Failed</div>
            </div>
            {failed > 0 && (
              <button
                onClick={retryFailed}
                disabled={retrying}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium border border-border rounded-lg hover:bg-surface-2 transition-colors disabled:opacity-50"
              >
                <RefreshCw size={12} className={retrying ? 'animate-spin' : ''} />
                Retry all
              </button>
            )}
          </div>
        </div>

        {/* Queue table */}
        <div className="bg-surface border border-border rounded-xl overflow-hidden">
          <div className="px-5 py-4 border-b border-border flex items-center justify-between">
            <span className="text-foreground font-semibold text-sm">Action Queue</span>
            <button onClick={load} className="text-foreground-subtle hover:text-foreground">
              <RefreshCw size={14} />
            </button>
          </div>

          {loading ? (
            <div className="px-5 py-10 text-center text-foreground-subtle text-sm">Loading…</div>
          ) : items.length === 0 ? (
            <div className="px-5 py-10 text-center text-foreground-subtle text-sm">
              No LinkedIn actions yet. Run a campaign with LinkedIn steps to populate this queue.
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-left">
                  {['Action', 'Status', 'Scheduled / Processed'].map(h => (
                    <th key={h} className="px-5 py-3 text-foreground-subtle text-xs font-medium">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {items.map(item => (
                  <tr key={item.id} className="hover:bg-surface-2 transition-colors">
                    <td className="px-5 py-3 text-foreground capitalize">{item.action.replace('_', ' ')}</td>
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
          )}
        </div>
      </div>
    </div>
  )
}
