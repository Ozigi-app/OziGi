'use client'
import { useEffect, useState } from 'react'
import Link from 'next/link'
import {
  Mail, Send, Clock, CheckCircle, XCircle, RefreshCw, ChevronRight, Inbox,
} from 'lucide-react'
import GtmPageHeader from '@/components/gtm/GtmPageHeader'
import FreeAgentBanner from '@/components/gtm/FreeAgentBanner'

interface EmailRecord {
  id: string
  lead_id: string
  subject: string
  status: 'sent' | 'opened' | 'replied' | 'bounced' | 'scheduled'
  sent_at: string | null
  opened_at: string | null
  campaign_id: string
  campaign_name?: string
}

interface OutreachStats {
  sent: number
  openRate: string
  replies: number
  scheduled: number
}

const STATUS_CONFIG: Record<string, { label: string; color: string; Icon: React.ElementType }> = {
  sent:      { label: 'Sent',      color: 'text-foreground-muted', Icon: Send         },
  opened:    { label: 'Opened',    color: 'text-accent',           Icon: Mail         },
  replied:   { label: 'Replied',   color: 'text-green-600',        Icon: CheckCircle  },
  bounced:   { label: 'Bounced',   color: 'text-red-500',          Icon: XCircle      },
  scheduled: { label: 'Scheduled', color: 'text-amber-500',        Icon: Clock        },
}

export default function EmailOutreachPage() {
  const [emails, setEmails]         = useState<EmailRecord[]>([])
  const [loading, setLoading]       = useState(true)
  const [filter, setFilter]         = useState<string>('all')
  const [composing, setComposing]   = useState(false)

  const [toEmail, setToEmail]         = useState('')
  const [firstName, setFirstName]     = useState('')
  const [subject, setSubject]         = useState('')
  const [body, setBody]               = useState('')
  const [context, setContext]         = useState('')
  const [generating, setGenerating]   = useState(false)
  const [sending, setSending]         = useState(false)
  const [composeError, setComposeError] = useState('')
  const [composeSent, setComposeSent]   = useState(false)

  useEffect(() => {
    fetch('/api/gtm/outreach')
      .then(r => r.json())
      .then(d => { setEmails(d.emails ?? []); setLoading(false) })
      .catch(() => setLoading(false))
  }, [])

  const stats: OutreachStats = {
    sent:      emails.filter(e => e.status !== 'scheduled').length,
    openRate:  emails.length
      ? `${Math.round((emails.filter(e => e.status === 'opened' || e.status === 'replied').length / Math.max(emails.filter(e => e.status !== 'scheduled').length, 1)) * 100)}%`
      : '—',
    replies:   emails.filter(e => e.status === 'replied').length,
    scheduled: emails.filter(e => e.status === 'scheduled').length,
  }

  async function generateDraft() {
    if (!context.trim()) return
    setGenerating(true)
    setComposeError('')
    try {
      const res = await fetch('/api/gtm/campaigns/draft-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ context }),
      })
      if (res.ok) {
        const d = await res.json()
        setSubject(d.subject ?? '')
        setBody(d.body ?? '')
      }
    } catch {
      // draft generation is best-effort
    } finally {
      setGenerating(false)
    }
  }

  async function sendEmail(e: React.FormEvent) {
    e.preventDefault()
    if (!toEmail.trim() || !subject.trim() || !body.trim()) {
      setComposeError('Fill in recipient, subject, and body.')
      return
    }
    setSending(true)
    setComposeError('')
    try {
      const res = await fetch('/api/gtm/smtp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ to: toEmail, subject, body, firstName }),
      })
      if (!res.ok) {
        const d = await res.json().catch(() => ({}))
        setComposeError(d.error ?? 'Failed to send — check your email account is connected in Settings.')
      } else {
        setComposeSent(true)
        setToEmail(''); setFirstName(''); setSubject(''); setBody(''); setContext('')
        setTimeout(() => { setComposeSent(false); setComposing(false) }, 2000)
      }
    } catch {
      setComposeError('Network error — try again.')
    } finally {
      setSending(false)
    }
  }

  const visible = filter === 'all' ? emails : emails.filter(e => e.status === filter)

  return (
    <div>
      <GtmPageHeader title="Email Outreach" />
      <div className="px-8 py-7 max-w-[1100px]">

        {/* Header */}
        <div className="flex items-start justify-between mb-7">
          <div className="flex items-center gap-3">
            <Mail size={20} className="text-accent" />
            <div>
              <h1 className="text-2xl font-black text-foreground tracking-tight">Email Outreach</h1>
              <p className="text-foreground-subtle text-sm mt-0.5">All outbound emails across campaigns</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => { setComposing(true); setComposeSent(false); setComposeError('') }}
              className="flex items-center gap-2 px-3 py-2 text-foreground-subtle hover:text-foreground border border-border hover:border-border-strong text-xs font-semibold rounded-xl transition-colors"
            >
              <Send size={13} /> Compose Email
            </button>
            <a
              href="/dashboard/gtm/new"
              className="flex items-center gap-2 px-4 py-2.5 bg-accent hover:bg-accent/90 text-white font-bold text-sm rounded-xl transition-colors"
            >
              + New Campaign
            </a>
          </div>
        </div>

        <FreeAgentBanner />

        {/* Compose panel */}
        {composing && (
          <div className="bg-surface border border-border rounded-xl p-6 mb-7">
            <div className="flex items-center justify-between mb-5">
              <span className="font-semibold text-foreground text-sm">New Email</span>
              <button onClick={() => setComposing(false)} className="text-foreground-subtle hover:text-foreground text-lg leading-none transition-colors">✕</button>
            </div>

            {/* Context input */}
            <div className="mb-5 p-4 bg-bg border border-dashed border-border rounded-lg">
              <div className="text-foreground-subtle text-xs font-semibold uppercase tracking-widest mb-2">Context — AI draft generator</div>
              <textarea
                rows={3}
                value={context}
                onChange={e => setContext(e.target.value)}
                placeholder="Describe your product, the recipient's profile, and your goal…"
                className="w-full bg-transparent text-foreground text-sm placeholder-foreground-subtle resize-none outline-none leading-relaxed"
              />
              <div className="flex justify-end mt-3">
                <button
                  onClick={generateDraft}
                  disabled={generating || !context.trim()}
                  className="flex items-center gap-2 px-3 py-1.5 text-xs font-semibold bg-surface-2 border border-border text-accent hover:bg-bg rounded-lg transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  {generating ? <><RefreshCw size={11} className="animate-spin" /> Generating…</> : '✦ Generate draft'}
                </button>
              </div>
            </div>

            {/* Compose fields */}
            <form onSubmit={sendEmail} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-foreground-subtle text-xs font-semibold uppercase tracking-widest mb-1.5">To</label>
                  <input
                    type="email"
                    value={toEmail}
                    onChange={e => setToEmail(e.target.value)}
                    placeholder="recipient@company.com"
                    className="w-full bg-bg border border-border rounded-lg px-3 py-2.5 text-sm text-foreground placeholder-foreground-subtle outline-none focus:border-accent transition-colors"
                  />
                </div>
                <div>
                  <label className="block text-foreground-subtle text-xs font-semibold uppercase tracking-widest mb-1.5">First Name <span className="normal-case font-normal opacity-60">(replaces {'{'}{'{'}}first_name{'}'}{'}'} )</span></label>
                  <input
                    type="text"
                    value={firstName}
                    onChange={e => setFirstName(e.target.value)}
                    placeholder="Alex"
                    className="w-full bg-bg border border-border rounded-lg px-3 py-2.5 text-sm text-foreground placeholder-foreground-subtle outline-none focus:border-accent transition-colors"
                  />
                </div>
              </div>
              <div>
                <label className="block text-foreground-subtle text-xs font-semibold uppercase tracking-widest mb-1.5">Subject</label>
                <input
                  type="text"
                  value={subject}
                  onChange={e => setSubject(e.target.value)}
                  placeholder="Quick question about your growth stack"
                  className="w-full bg-bg border border-border rounded-lg px-3 py-2.5 text-sm text-foreground placeholder-foreground-subtle outline-none focus:border-accent transition-colors"
                />
              </div>
              <div>
                <label className="block text-foreground-subtle text-xs font-semibold uppercase tracking-widest mb-1.5">Body</label>
                <textarea
                  rows={8}
                  value={body}
                  onChange={e => setBody(e.target.value)}
                  placeholder={"Hi {{first_name}},\n\nI noticed you've been building in public…"}
                  className="w-full bg-bg border border-border rounded-lg px-3 py-2.5 text-sm text-foreground placeholder-foreground-subtle outline-none focus:border-accent transition-colors resize-y leading-relaxed"
                />
              </div>

              {composeError && <p className="text-red-500 text-xs">{composeError}</p>}
              {composeSent && (
                <p className="text-green-600 text-xs flex items-center gap-1.5">
                  <CheckCircle size={13} /> Email sent successfully
                </p>
              )}

              <div className="flex items-center gap-3 justify-end pt-1">
                <button type="button" onClick={() => setComposing(false)}
                  className="px-4 py-2 text-sm text-foreground-subtle hover:text-foreground border border-border rounded-lg transition-colors">
                  Cancel
                </button>
                <button type="submit" disabled={sending}
                  className="flex items-center gap-2 px-4 py-2 text-sm font-bold bg-accent hover:bg-accent/90 text-white rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed">
                  {sending ? <><RefreshCw size={13} className="animate-spin" /> Sending…</> : <><Send size={13} /> Send</>}
                </button>
              </div>
            </form>
          </div>
        )}

        {/* Stats strip */}
        <div className="grid grid-cols-4 gap-3 mb-6">
          {[
            { label: 'Emails Sent', value: stats.sent,      color: 'text-foreground'  },
            { label: 'Open Rate',   value: stats.openRate,  color: 'text-accent'       },
            { label: 'Replies',     value: stats.replies,   color: 'text-green-600'   },
            { label: 'Scheduled',   value: stats.scheduled, color: 'text-amber-500'   },
          ].map(s => (
            <div key={s.label} className="bg-surface border border-border rounded-xl p-4">
              <div className={`text-2xl font-black ${s.color}`}>{s.value}</div>
              <div className="text-foreground-subtle text-xs mt-0.5">{s.label}</div>
            </div>
          ))}
        </div>

        {/* Filter tabs + email list */}
        <div className="bg-surface border border-border rounded-xl overflow-hidden">
          <div className="flex items-center gap-1 px-5 py-3.5 border-b border-border overflow-x-auto">
            {['all', 'sent', 'opened', 'replied', 'bounced', 'scheduled'].map(f => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={`px-3 py-1 rounded-md text-xs font-semibold capitalize whitespace-nowrap transition-colors ${
                  filter === f
                    ? 'bg-surface-2 text-accent'
                    : 'text-foreground-subtle hover:text-foreground'
                }`}
              >
                {f}
              </button>
            ))}
            <div className="ml-auto">
              <Link href="/dashboard/gtm" className="flex items-center gap-1 text-foreground-subtle hover:text-accent text-xs transition-colors no-underline">
                View campaigns <ChevronRight size={12} />
              </Link>
            </div>
          </div>

          {loading ? (
            <div className="px-5 py-10 text-center text-foreground-subtle text-sm">Loading…</div>
          ) : visible.length === 0 ? (
            <div className="px-5 py-16 text-center">
              <Inbox size={32} className="text-border mx-auto mb-3" />
              <p className="text-foreground-subtle text-sm">No emails yet.</p>
              <p className="text-foreground-subtle text-xs mt-1">
                Emails sent through campaigns appear here automatically.{' '}
                <Link href="/dashboard/gtm/new" className="text-accent no-underline hover:underline">
                  Start a campaign →
                </Link>
              </p>
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-left">
                  {['Recipient', 'Subject', 'Campaign', 'Status', 'Sent'].map(h => (
                    <th key={h} className="px-5 py-3 text-foreground-subtle text-xs font-medium">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {visible.map(email => {
                  const cfg = STATUS_CONFIG[email.status] ?? STATUS_CONFIG.sent
                  const Icon = cfg.Icon
                  return (
                    <tr key={email.id} className="hover:bg-surface-2 transition-colors">
                      <td className="px-5 py-3 text-foreground text-xs font-mono">{email.lead_id.slice(0, 8)}…</td>
                      <td className="px-5 py-3 text-foreground-muted max-w-[220px] truncate">{email.subject}</td>
                      <td className="px-5 py-3 text-foreground-subtle text-xs">{email.campaign_name ?? '—'}</td>
                      <td className="px-5 py-3">
                        <span className={`flex items-center gap-1.5 ${cfg.color}`}>
                          <Icon size={12} /> {cfg.label}
                        </span>
                      </td>
                      <td className="px-5 py-3 text-foreground-subtle text-xs">
                        {email.sent_at ? new Date(email.sent_at).toLocaleDateString() : '—'}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  )
}
