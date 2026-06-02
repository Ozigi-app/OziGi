'use client'
import { useEffect, useState } from 'react'
import { UserPlus, CheckCircle, Clock, XCircle } from 'lucide-react'
import GtmPageHeader from '@/components/gtm/GtmPageHeader'
import FreeAgentBanner from '@/components/gtm/FreeAgentBanner'
import Link from 'next/link'

interface QueueItem {
  id: string
  lead_id: string
  action: string
  status: string
  attempts: number
  error: string | null
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

export default function LinkedInOutreachPage() {
  const [items, setItems]       = useState<QueueItem[]>([])
  const [loading, setLoading]   = useState(true)

  useEffect(() => {
    // Fetch LinkedIn queue across all campaigns
    fetch('/api/gtm/linkedin/queue')
      .then(r => r.json())
      .then(d => { setItems(d.items ?? []); setLoading(false) })
      .catch(() => setLoading(false))
  }, [])

  const done    = items.filter(i => i.status === 'done').length
  const pending = items.filter(i => i.status === 'queued' || i.status === 'in_progress').length
  const failed  = items.filter(i => i.status === 'failed').length

  return (
    <div>
    <GtmPageHeader title="LinkedIn Outreach" />
    <div className="px-8 py-7 max-w-4xl">
      <div className="flex items-start justify-between mb-7">
        <div className="flex items-center gap-3">
          <UserPlus size={20} className="text-[#0a66c2]" />
          <div>
            <h1 className="text-2xl font-bold text-foreground tracking-tight">LinkedIn Outreach</h1>
            <p className="text-foreground-subtle text-sm mt-0.5">All LinkedIn actions across campaigns</p>
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
      <div className="grid grid-cols-3 gap-3 mb-6">
        {[
          { label: 'Completed', value: done,    color: 'text-green-600'  },
          { label: 'Pending',   value: pending, color: 'text-amber-600'  },
          { label: 'Failed',    value: failed,  color: 'text-red-500'    },
        ].map(s => (
          <div key={s.label} className="bg-surface border border-border rounded-xl p-4">
            <div className={`text-2xl font-bold ${s.color}`}>{s.value}</div>
            <div className="text-foreground-subtle text-xs mt-0.5">{s.label}</div>
          </div>
        ))}
      </div>

      {/* Queue table */}
      <div className="bg-surface border border-border rounded-xl overflow-hidden">
        <div className="px-5 py-4 border-b border-border">
          <span className="text-foreground font-semibold text-sm">Action Queue</span>
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
                {['Action', 'Status', 'Attempts', 'Processed', 'Error'].map(h => (
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
                      <span className="text-foreground-muted capitalize">{item.status}</span>
                    </span>
                  </td>
                  <td className="px-5 py-3 text-foreground-subtle">{item.attempts}</td>
                  <td className="px-5 py-3 text-foreground-subtle text-xs">
                    {item.processed_at ? new Date(item.processed_at).toLocaleString() : '—'}
                  </td>
                  <td className="px-5 py-3 text-red-500 text-xs max-w-[200px] truncate">
                    {item.error ?? '—'}
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
