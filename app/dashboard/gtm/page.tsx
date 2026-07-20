'use client'
import { useEffect, useState } from 'react'
import Link from 'next/link'
import { Megaphone, Play, Pause, ChevronRight, Plus } from 'lucide-react'
import GtmPageHeader from '@/components/gtm/GtmPageHeader'
import FreeAgentBanner from '@/components/gtm/FreeAgentBanner'

interface Campaign {
  id: string
  name: string
  status: 'active' | 'paused' | 'completed' | 'draft'
  created_at: string
  daily_email_limit: number
  leads: [{ count: number }]
  sequence_sends: [{ count: number }]
}

const STATUS_STYLE: Record<string, { label: string; bg: string; color: string }> = {
  active:    { label: 'Active',    bg: '#dcfce7', color: '#15803d' },
  paused:    { label: 'Paused',    bg: '#fef9c3', color: '#a16207' },
  completed: { label: 'Completed', bg: '#e0e7ff', color: '#4338ca' },
  draft:     { label: 'Draft',     bg: '#f3f4f6', color: '#6b7280' },
}

export default function CampaignsPage() {
  const [campaigns, setCampaigns] = useState<Campaign[]>([])
  const [loading, setLoading]     = useState(true)
  const [toggling, setToggling]   = useState<string | null>(null)

  useEffect(() => {
    fetch('/api/gtm/campaigns')
      .then(r => r.json())
      .then(d => { setCampaigns(d.campaigns ?? []); setLoading(false) })
      .catch(() => setLoading(false))
  }, [])

  async function toggleStatus(campaign: Campaign) {
    const next = campaign.status === 'active' ? 'paused' : 'active'
    setToggling(campaign.id)
    const res = await fetch(`/api/gtm/campaigns/${campaign.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: next }),
    })
    if (res.ok) {
      setCampaigns(prev =>
        prev.map(c => c.id === campaign.id ? { ...c, status: next } : c)
      )
    }
    setToggling(null)
  }

  return (
    <div>
      <GtmPageHeader title="Campaigns" />
      <div className="px-8 py-7 max-w-[1100px]">

        {/* Header */}
        <div className="flex items-start justify-between mb-7">
          <div className="flex items-center gap-3">
            <Megaphone size={20} className="text-accent" />
            <div>
              <h1 className="text-2xl font-black text-foreground tracking-tight">Campaigns</h1>
              <p className="text-foreground-subtle text-sm mt-0.5">All your outreach campaigns — email and LinkedIn</p>
            </div>
          </div>
          <Link
            href="/dashboard/gtm/new"
            className="flex items-center gap-2 px-4 py-2.5 bg-accent hover:bg-accent/90 text-white font-bold text-sm rounded-xl transition-colors no-underline"
          >
            <Plus size={15} /> New Campaign
          </Link>
        </div>

        <FreeAgentBanner />

        {/* Campaign list */}
        <div className="bg-surface border border-border rounded-xl overflow-hidden mt-6">
          {loading ? (
            <div className="px-5 py-12 text-center text-foreground-subtle text-sm">Loading…</div>
          ) : campaigns.length === 0 ? (
            <div className="px-5 py-16 text-center">
              <Megaphone size={32} className="text-border mx-auto mb-3" />
              <p className="text-foreground-subtle text-sm">No campaigns yet.</p>
              <p className="text-foreground-subtle text-xs mt-1">
                <Link href="/dashboard/gtm/new" className="text-accent no-underline hover:underline">
                  Create your first campaign →
                </Link>
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
            <table className="w-full min-w-[720px] text-sm">
              <thead>
                <tr className="border-b border-border text-left">
                  {['Campaign', 'Status', 'Leads', 'Emails Sent', 'Daily Limit', 'Created', ''].map(h => (
                    <th key={h} className="px-5 py-3 text-foreground-subtle text-xs font-medium">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {campaigns.map(c => {
                  const st = STATUS_STYLE[c.status] ?? STATUS_STYLE.draft
                  const leadsCount = c.leads?.[0]?.count ?? 0
                  const sendsCount = c.sequence_sends?.[0]?.count ?? 0
                  const isToggling = toggling === c.id

                  return (
                    <tr key={c.id} className="hover:bg-surface-2 transition-colors">
                      <td className="px-5 py-3.5">
                        <Link
                          href={`/dashboard/gtm/${c.id}`}
                          className="font-semibold text-foreground hover:text-accent transition-colors no-underline"
                        >
                          {c.name}
                        </Link>
                      </td>
                      <td className="px-5 py-3.5">
                        <span
                          className="px-2 py-0.5 rounded-full text-xs font-semibold"
                          style={{ background: st.bg, color: st.color }}
                        >
                          {st.label}
                        </span>
                      </td>
                      <td className="px-5 py-3.5 text-foreground-muted">{leadsCount}</td>
                      <td className="px-5 py-3.5 text-foreground-muted">{sendsCount}</td>
                      <td className="px-5 py-3.5 text-foreground-subtle text-xs">{c.daily_email_limit}/day</td>
                      <td className="px-5 py-3.5 text-foreground-subtle text-xs">
                        {new Date(c.created_at).toLocaleDateString()}
                      </td>
                      <td className="px-5 py-3.5">
                        <div className="flex items-center gap-2 justify-end">
                          {(c.status === 'active' || c.status === 'paused') && (
                            <button
                              onClick={() => toggleStatus(c)}
                              disabled={isToggling}
                              title={c.status === 'active' ? 'Pause campaign' : 'Resume campaign'}
                              className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg border border-border text-xs font-semibold text-foreground-subtle hover:text-foreground hover:border-border-strong transition-colors disabled:opacity-40"
                            >
                              {isToggling ? (
                                '…'
                              ) : c.status === 'active' ? (
                                <><Pause size={11} /> Pause</>
                              ) : (
                                <><Play size={11} /> Resume</>
                              )}
                            </button>
                          )}
                          <Link
                            href={`/dashboard/gtm/${c.id}`}
                            className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-surface-2 hover:bg-accent hover:text-white text-xs font-semibold text-foreground-subtle transition-colors no-underline"
                          >
                            Open <ChevronRight size={11} />
                          </Link>
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
