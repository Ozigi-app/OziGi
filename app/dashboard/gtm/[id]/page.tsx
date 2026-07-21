'use client'
import { useEffect, useState, useRef } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import GtmPageHeader from '@/components/gtm/GtmPageHeader'
import type { Campaign, Lead } from '@/lib/types/gtm'

// ── Friendly error messages — never expose raw backend errors to users ─────────
function friendlyActionError(raw: string): string {
  if (raw.includes('credits'))           return 'No credits remaining — purchase a bundle to continue.'
  if (raw.includes('limit'))             return 'Monthly send limit reached — upgrade your plan.'
  if (raw.includes('GTM features'))      return 'Lead outreach requires a Growth or Pro plan.'
  if (raw.includes('No active Gmail') || raw.includes('email account')) return 'No email account connected — check Settings.'
  return 'Something went wrong — please try again.'
}

function friendlyLiError(raw: string): string {
  if (raw.includes('already connected') || raw.includes('Message button'))  return 'Already connected'
  if (raw.includes('pending'))           return 'Invite already pending'
  if (raw.includes('Creator profile'))   return 'Follow-only profile'
  if (raw.includes('private'))           return 'Private profile'
  if (raw.includes('Timeout') || raw.includes('timeout')) return 'Page timed out — will retry'
  if (raw.includes('session expired') || raw.includes('no active')) return 'LinkedIn session expired — reconnect in Settings'
  if (raw.includes('Connect button not found')) return 'Could not find Connect button — will retry'
  return 'Action failed — will retry'
}

function friendlyPreviewError(raw: string): string {
  if (raw.includes('no leads') || raw.includes('No leads')) return 'No leads available to preview — run a scrape first.'
  if (raw.includes('sequence') || raw.includes('steps'))    return 'No email steps configured in this campaign.'
  return 'Could not generate preview — please try again.'
}

// ── ICP Editor ────────────────────────────────────────────────────────────────
type IcpConfig = Campaign['icp_config']

const ICP_FIELDS: { key: keyof IcpConfig; label: string; hint: string }[] = [
  { key: 'job_titles',      label: 'Job Titles',      hint: 'e.g. Founder, CTO, Head of Growth — titles people use on LinkedIn' },
  { key: 'industries',      label: 'Industries',      hint: 'e.g. SaaS, Developer Tools, B2B Software' },
  { key: 'keywords',        label: 'Keywords',        hint: 'Words in a LinkedIn headline/bio — e.g. early-stage, startup, outbound. Avoid tool names like GitHub.' },
  { key: 'company_sizes',   label: 'Company Sizes',   hint: 'e.g. 1-10, 11-50' },
  { key: 'seniority_levels',label: 'Seniority',       hint: 'e.g. founder, senior, lead — optional' },
  { key: 'locations',       label: 'Locations',       hint: 'e.g. United States, Europe — leave empty for global' },
]

function TagInput({ values, onChange }: { values: string[]; onChange: (v: string[]) => void }) {
  const [input, setInput] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)

  function add() {
    const v = input.trim()
    if (v && !values.includes(v)) onChange([...values, v])
    setInput('')
  }

  return (
    <div className="flex flex-wrap gap-1.5 items-center px-2 py-1.5 border border-border rounded-lg bg-bg cursor-text"
      onClick={() => inputRef.current?.focus()}>
      {values.map(v => (
        <span key={v} className="inline-flex items-center gap-1 bg-indigo-100 text-indigo-800 px-2 py-0.5 rounded-full text-xs font-medium">
          {v}
          <button onClick={e => { e.stopPropagation(); onChange(values.filter(x => x !== v)) }}
            className="bg-transparent border-none cursor-pointer text-indigo-500 text-sm leading-none p-0">×</button>
        </span>
      ))}
      <input ref={inputRef} value={input} onChange={e => setInput(e.target.value)}
        onKeyDown={e => { if (e.key === 'Enter' || e.key === ',') { e.preventDefault(); add() } if (e.key === 'Backspace' && !input && values.length) onChange(values.slice(0, -1)) }}
        onBlur={add}
        placeholder={values.length === 0 ? 'Type and press Enter…' : ''}
        className="border-none outline-none bg-transparent text-sm text-foreground placeholder-foreground-subtle min-w-[120px] flex-1" />
    </div>
  )
}

function IcpEditor({ campaignId, icp, onSaved }: { campaignId: string; icp: IcpConfig; onSaved: (fresh: IcpConfig) => void }) {
  const [config, setConfig] = useState<IcpConfig>(icp ?? {})
  const [saving, setSaving] = useState(false)
  const [saved, setSaved]   = useState(false)
  const [open, setOpen]     = useState(false)

  function setField(key: keyof IcpConfig, val: string[]) {
    setConfig(prev => ({ ...prev, [key]: val }))
    setSaved(false)
  }

  async function save() {
    setSaving(true)
    await fetch(`/api/gtm/campaigns/${campaignId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ icp_config: config }),
    })
    setSaving(false)
    setSaved(true)
    onSaved(config)
    setTimeout(() => setSaved(false), 3000)
  }

  return (
    <div className="mt-8 bg-surface border border-border rounded-xl overflow-hidden">
      <div className={`flex justify-between items-center px-4 py-3 cursor-pointer ${open ? 'bg-surface-2' : ''}`}
        onClick={() => setOpen(o => !o)}>
        <span className="font-semibold text-sm text-foreground">
          ICP Config <span className="font-normal text-foreground-subtle text-xs">— controls LinkedIn &amp; GitHub search</span>
        </span>
        <span className="text-foreground-subtle text-sm">{open ? '▲ collapse' : '▼ edit'}</span>
      </div>

      {open && (
        <div className="p-4 border-t border-border">
          <p className="mb-4 text-xs text-amber-800 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
            ⚠️ <strong>Keywords and Job Titles</strong> are used directly as LinkedIn search terms. Use words people actually write in their LinkedIn headline — avoid tool names like "GitHub" or "Dev.to".
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {ICP_FIELDS.map(({ key, label, hint }) => (
              <div key={key} className="flex flex-col gap-1">
                <label className="text-xs font-semibold text-foreground">{label}</label>
                <TagInput values={(config as unknown as Record<string, string[]>)[key] ?? []} onChange={val => setField(key, val)} />
                <span className="text-[11px] text-foreground-subtle">{hint}</span>
              </div>
            ))}
          </div>
          <div className="mt-4 flex items-center gap-3">
            <button onClick={save} disabled={saving} className="px-4 py-2 bg-accent hover:bg-accent/90 text-white text-sm font-bold rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed">
              {saving ? 'Saving…' : 'Save ICP'}
            </button>
            {saved && <span className="text-green-600 text-sm">✓ Saved — changes apply on next Scrape</span>}
          </div>
        </div>
      )}
    </div>
  )
}

interface Send {
  id: string
  step: number
  channel: string
  status: string
  sent_at: string | null
  lead_id: string
}

interface EmailPreview {
  lead: { id: string; name: string | null; email: string | null; icp_match_score: number | null }
  subject?: string
  body?: string
  error?: string
}

interface PreviewResult {
  step: number
  total: number
  previews: EmailPreview[]
}

interface LiQueueItem {
  id: string
  lead_id: string
  action: 'connect' | 'message' | 'follow_up'
  status: 'queued' | 'in_progress' | 'done' | 'failed' | 'skipped'
  attempts: number
  error: string | null
  scheduled_at: string
  processed_at: string | null
}

interface PageData {
  campaign: Campaign
  leads: Lead[]
  sends: Send[]
  liQueue: LiQueueItem[]
}

const ACTION_LABEL: Record<string, string> = {
  connect:    'Connect request',
  message:    'Direct message',
  follow_up:  'Follow-up',
}

const LI_STATUS_COLOR: Record<string, string> = {
  queued:      '#f3f4f6',
  in_progress: '#fef9c3',
  done:        '#dcfce7',
  failed:      '#fee2e2',
  skipped:     '#f3f4f6',
}

type Tab = 'email' | 'linkedin' | 'leads'

// ── CSV parser ────────────────────────────────────────────────────────────────
// Handles quoted fields and common delimiters (comma or tab).
function parseCSV(text: string): Record<string, string>[] {
  const lines = text.trim().split(/\r?\n/)
  if (lines.length < 2) return []

  const delimiter = lines[0].includes('\t') ? '\t' : ','

  function splitLine(line: string): string[] {
    const fields: string[] = []
    let cur = ''
    let inQuote = false
    for (let i = 0; i < line.length; i++) {
      const ch = line[i]
      if (ch === '"') { inQuote = !inQuote }
      else if (ch === delimiter && !inQuote) { fields.push(cur.trim()); cur = '' }
      else { cur += ch }
    }
    fields.push(cur.trim())
    return fields
  }

  const headers = splitLine(lines[0]).map(h => h.toLowerCase().replace(/\s+/g, '_'))
  return lines.slice(1)
    .filter(l => l.trim())
    .map(l => {
      const vals = splitLine(l)
      return Object.fromEntries(headers.map((h, i) => [h, vals[i] ?? '']))
    })
}

// Map flexible column names to our schema fields
function normaliseRow(row: Record<string, string>) {
  const get = (...keys: string[]) => keys.map(k => row[k]).find(v => v) ?? ''
  return {
    name:          get('name', 'full_name', 'contact_name'),
    email:         get('email', 'email_address'),
    company:       get('company', 'company_name', 'organisation', 'organization'),
    linkedin_url:  get('linkedin_url', 'linkedin', 'linkedin_profile'),
    twitter_handle:get('twitter_handle', 'twitter', 'x_handle'),
    bio:           get('bio', 'about', 'description', 'headline'),
    location:      get('location', 'city', 'country'),
  }
}

export default function CampaignDetailPage() {
  const { id } = useParams<{ id: string }>()
  const [data, setData]       = useState<PageData | null>(null)
  const [loading, setLoading] = useState(true)
  const [actionMsg, setActionMsg] = useState('')
  const [tab, setTab]         = useState<Tab>('leads')
  const [preview, setPreview] = useState<PreviewResult | null>(null)
  const [previewing, setPreviewing] = useState(false)

  // CSV import state
  const [showImport, setShowImport]   = useState(false)
  const [csvText, setCsvText]         = useState('')
  const [parsedRows, setParsedRows]   = useState<ReturnType<typeof normaliseRow>[]>([])
  const [importing, setImporting]     = useState(false)
  const [importMsg, setImportMsg]     = useState('')

  useEffect(() => {
    fetch(`/api/gtm/campaigns/${id}`)
      .then(r => r.json())
      .then(d => { setData(d); setLoading(false) })
  }, [id])

  async function triggerAction(action: 'scrape' | 'send') {
    setActionMsg(`Running ${action}…`)
    const res = await fetch(`/api/gtm/campaigns/${id}/trigger`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action }),
    })
    const d = await res.json()
    if (!res.ok) { setActionMsg(friendlyActionError(d.error ?? '')); return }

    const before = action === 'scrape' ? data?.leads.length ?? 0 : data?.sends.length ?? 0
    let attempts = 0
    const poll = setInterval(async () => {
      attempts++
      const fresh = await fetch(`/api/gtm/campaigns/${id}`).then(r => r.json()) as PageData
      const after = action === 'scrape' ? fresh.leads.length : fresh.sends.length
      if (after > before || attempts >= 36) {
        clearInterval(poll)
        setData(fresh)
        setActionMsg(after > before
          ? `${action} complete — ${after - before} new ${action === 'scrape' ? 'leads' : 'sends'} added ✓`
          : `${action} finished (no new records added)`)
        setTimeout(() => setActionMsg(''), 4000)
      } else {
        setActionMsg(`Running ${action}… (${attempts * 5}s)`)
      }
    }, 5000)
  }

  async function previewEmails() {
    setPreviewing(true)
    setPreview(null)
    const res = await fetch(`/api/gtm/campaigns/${id}/preview-emails`, { method: 'POST' })
    const d = await res.json()
    if (res.ok) setPreview(d)
    else setActionMsg(friendlyPreviewError(d.error ?? ''))
    setPreviewing(false)
  }

  async function toggleStatus() {
    if (!data) return
    const next = data.campaign.status === 'active' ? 'paused' : 'active'
    const res = await fetch(`/api/gtm/campaigns/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: next }),
    })
    const d = await res.json()
    setData(prev => prev ? { ...prev, campaign: d.campaign } : prev)
  }

  function onCsvChange(text: string) {
    setCsvText(text)
    setImportMsg('')
    if (!text.trim()) { setParsedRows([]); return }
    const raw = parseCSV(text)
    const rows = raw.map(normaliseRow).filter(r => r.name)
    setParsedRows(rows)
  }

  async function handleImport() {
    if (!parsedRows.length) return
    setImporting(true)
    setImportMsg('Scoring leads against your ICP…')
    const res = await fetch(`/api/gtm/campaigns/${id}/import`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ rows: parsedRows }),
    })
    const d = await res.json()
    setImporting(false)
    if (!res.ok) { setImportMsg(d.error ?? 'Import failed'); return }
    setImportMsg(`Done — ${d.inserted} of ${d.total} leads added ✓`)
    // Refresh leads list
    const fresh = await fetch(`/api/gtm/campaigns/${id}`).then(r => r.json()) as PageData
    setData(fresh)
    setTimeout(() => { setShowImport(false); setCsvText(''); setParsedRows([]); setImportMsg('') }, 2000)
  }

  if (loading) return <div className="p-8 text-foreground-subtle text-sm">Loading…</div>
  if (!data)   return <div className="p-8 text-red-600 text-sm">Campaign not found.</div>

  const { campaign, leads, sends, liQueue } = data

  // ── Derived stats ────────────────────────────────────────────────────────────
  const emailSends    = sends.filter(s => s.channel === 'email')
  const liSends       = sends.filter(s => s.channel === 'linkedin')
  const emailSent     = emailSends.filter(s => s.status === 'sent').length
  const liDone        = liQueue.filter(q => q.status === 'done').length
  const liPending     = liQueue.filter(q => q.status === 'queued' || q.status === 'in_progress').length
  const liFailed      = liQueue.filter(q => q.status === 'failed').length
  const leadsWithLi   = leads.filter(l => l.linkedin_url).length

  // Build a map of lead_id → lead name for queue display
  const leadMap = Object.fromEntries(leads.map(l => [l.id, l.name ?? l.id.slice(0, 8)]))

  return (
    <div>
      <GtmPageHeader title={campaign.name} />
    <div className="px-4 sm:px-8 py-7 max-w-[960px] mx-auto">

      {/* ── Header ──────────────────────────────────────────────────────────── */}
      <div className="mb-6">
        <Link href="/dashboard/gtm" className="text-foreground-subtle hover:text-accent text-sm no-underline transition-colors">← Outreach Campaigns</Link>
        <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-3 mt-2">
          <h1 className="text-2xl font-black text-foreground tracking-tight">{campaign.name}</h1>
          <div className="flex gap-2 flex-wrap">
            <button onClick={() => triggerAction('scrape')} className="px-3 py-1.5 border border-border rounded-lg bg-surface text-sm text-foreground-muted hover:text-foreground hover:border-border-strong transition-colors">
              Run Scrape
            </button>
            <button onClick={() => { setShowImport(true); setImportMsg('') }} className="px-3 py-1.5 border border-border rounded-lg bg-surface text-sm text-foreground-muted hover:text-foreground hover:border-border-strong transition-colors">
              Import CSV
            </button>
            <button onClick={previewEmails} disabled={previewing} className="px-3 py-1.5 border border-indigo-400 rounded-lg bg-surface text-sm text-indigo-600 hover:bg-indigo-50 transition-colors disabled:opacity-60">
              {previewing ? 'Generating…' : '👁 Preview emails'}
            </button>
            <button onClick={() => triggerAction('send')} className="px-3 py-1.5 border border-border rounded-lg bg-surface text-sm text-foreground-muted hover:text-foreground hover:border-border-strong transition-colors">
              Run Send
            </button>
            <button onClick={toggleStatus} className={`px-3 py-1.5 border rounded-lg text-sm font-semibold transition-colors ${campaign.status === 'active' ? 'border-amber-300 bg-amber-50 text-amber-800 hover:bg-amber-100' : 'border-green-300 bg-green-50 text-green-700 hover:bg-green-100'}`}>
              {campaign.status === 'active' ? 'Pause' : 'Resume'}
            </button>
          </div>
        </div>
        {actionMsg && <p className="mt-2 text-sm text-foreground-muted">{actionMsg}</p>}
      </div>

      {/* ── Stats grid ──────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
        {[
          { label: 'Total leads',          value: leads.length,   sub: `${leadsWithLi} have LinkedIn` },
          { label: 'Emails sent',           value: emailSent,      sub: `${emailSends.filter(s=>s.status==='queued').length} queued` },
          { label: 'LinkedIn actions done', value: liDone,         sub: liPending > 0 ? `${liPending} pending` : liFailed > 0 ? `${liFailed} failed` : 'worker idle' },
          { label: 'Replied',               value: sends.filter(s=>s.status==='replied').length, sub: `${campaign.daily_email_limit} email/day limit` },
        ].map(s => (
          <div key={s.label} className="bg-surface border border-border rounded-xl px-4 py-3.5">
            <div className="text-2xl font-bold text-foreground tabular-nums">{s.value}</div>
            <div className="text-xs text-foreground-muted mt-0.5">{s.label}</div>
            <div className="text-[11px] text-foreground-subtle mt-0.5">{s.sub}</div>
          </div>
        ))}
      </div>

      {/* ── LinkedIn worker status banner ────────────────────────────────────── */}
      {liQueue.length > 0 && liPending > 0 && (
        <div className="bg-amber-50 border border-amber-200 text-amber-800 rounded-lg px-4 py-3 mb-5 text-sm">
          ⏳ <strong>{liPending} LinkedIn action{liPending > 1 ? 's' : ''} queued</strong> — processing automatically, actions are spaced out to appear human.
        </div>
      )}
      {liFailed > 0 && (
        <div className="bg-rose-50 border border-rose-200 text-rose-800 rounded-lg px-4 py-3 mb-5 text-sm">
          ✗ <strong>{liFailed} LinkedIn action{liFailed > 1 ? 's' : ''} failed</strong> — see the LinkedIn tab for details.
        </div>
      )}

      {/* ── Tabs ────────────────────────────────────────────────────────────── */}
      <div className="flex mb-5 border-b-2 border-border overflow-x-auto">
        {([
          { key: 'leads',    label: `Leads (${leads.length})` },
          { key: 'email',    label: `Email (${emailSent} sent)` },
          { key: 'linkedin', label: `LinkedIn (${liDone} done${liPending > 0 ? `, ${liPending} pending` : ''})` },
        ] as { key: Tab; label: string }[]).map(t => (
          <button key={t.key} onClick={() => setTab(t.key)}
            className={`px-4 py-2 text-sm whitespace-nowrap -mb-0.5 border-b-2 transition-colors ${
              tab === t.key
                ? 'border-accent text-foreground font-bold'
                : 'border-transparent text-foreground-muted hover:text-foreground'
            }`}>
            {t.label}
          </button>
        ))}
      </div>

      {/* ── Leads tab ───────────────────────────────────────────────────────── */}
      {tab === 'leads' && (
        leads.length === 0 ? (
          <p className="text-foreground-subtle text-sm">No leads yet — run a scrape to discover leads.</p>
        ) : (
          <div className="overflow-x-auto bg-surface border border-border rounded-xl">
            <table className="w-full min-w-[640px] text-sm">
              <thead>
                <tr className="border-b border-border text-left">
                  {['Name', 'Email', 'LinkedIn', 'Score', 'Status', 'Company'].map(h => (
                    <th key={h} className="px-3 py-2.5 text-foreground-subtle text-xs font-medium">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {leads.map(l => (
                  <tr key={l.id} className="hover:bg-surface-2 transition-colors">
                    <td className="px-3 py-2.5 text-foreground">
                      {l.github_username
                        ? <a href={`https://github.com/${l.github_username}`} target="_blank" rel="noreferrer" className="text-foreground hover:text-accent">{l.name}</a>
                        : l.name}
                    </td>
                    <td className={`px-3 py-2.5 ${l.email ? 'text-foreground' : 'text-foreground-subtle'}`}>
                      {l.email ?? '—'}
                    </td>
                    <td className="px-3 py-2.5">
                      {l.linkedin_url
                        ? <a href={l.linkedin_url} target="_blank" rel="noreferrer" className="text-[#0a66c2] text-xs hover:underline">in profile</a>
                        : <span className="text-foreground-subtle">—</span>}
                    </td>
                    <td className="px-3 py-2.5 text-foreground-muted tabular-nums">
                      {l.icp_match_score != null ? (l.icp_match_score * 100).toFixed(0) + '%' : '—'}
                    </td>
                    <td className="px-3 py-2.5">
                      <span className={`px-2 py-0.5 rounded-full text-xs ${
                        l.status === 'contacted' ? 'bg-blue-100 text-blue-800' : l.status === 'replied' ? 'bg-green-100 text-green-800' : 'bg-surface-2 text-foreground-muted'
                      }`}>{l.status}</span>
                    </td>
                    <td className="px-3 py-2.5 text-foreground-muted">{l.company ?? '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )
      )}

      {/* ── Email tab ───────────────────────────────────────────────────────── */}
      {tab === 'email' && (
        emailSends.length === 0 ? (
          <p className="text-foreground-subtle text-sm">No emails sent yet — run Send to start the sequence.</p>
        ) : (
          <div className="overflow-x-auto bg-surface border border-border rounded-xl">
          <table className="w-full min-w-[480px] text-sm">
            <thead>
              <tr className="border-b border-border text-left">
                {['Lead', 'Step', 'Status', 'Sent at'].map(h => (
                  <th key={h} className="px-3 py-2.5 text-foreground-subtle text-xs font-medium">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {emailSends.slice(0, 100).map(s => (
                <tr key={s.id} className="hover:bg-surface-2 transition-colors">
                  <td className="px-3 py-2.5 text-foreground-muted">{leadMap[s.lead_id] ?? '—'}</td>
                  <td className="px-3 py-2.5 text-foreground">Step {s.step}</td>
                  <td className="px-3 py-2.5">
                    <span className={`px-2 py-0.5 rounded-full text-xs ${
                      s.status === 'sent' ? 'bg-green-100 text-green-800' : s.status === 'failed' ? 'bg-red-100 text-red-800' : 'bg-surface-2 text-foreground-muted'
                    }`}>{s.status}</span>
                  </td>
                  <td className="px-3 py-2.5 text-foreground-muted text-xs">
                    {s.sent_at ? new Date(s.sent_at).toLocaleString() : '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          </div>
        )
      )}

      {/* ── LinkedIn tab ────────────────────────────────────────────────────── */}
      {tab === 'linkedin' && (
        <div>
          {/* How it works explainer — shown when queue is empty */}
          {liQueue.length === 0 && (
            <div className="bg-surface border border-border rounded-xl p-6 text-foreground-muted text-sm leading-relaxed">
              <div className="font-bold text-foreground mb-2">How LinkedIn outreach works</div>
              <ol className="pl-5 m-0 list-decimal space-y-1">
                <li>Run Scrape → the LinkedIn worker finds profiles on LinkedIn matching your ICP and adds them as leads</li>
                <li>Run Send → the cron queues LinkedIn actions for those leads</li>
                <li>The LinkedIn worker (running locally or on Fly.io) picks them up every 30s</li>
                <li>It opens a browser session using your connected LinkedIn account and performs each action</li>
                <li>Results appear here — done, failed, and error details</li>
              </ol>
              <div className="mt-3.5 px-3 py-2.5 bg-surface-2 rounded-lg text-xs">
                <strong className="text-foreground">{leadsWithLi} of {leads.length} leads</strong> have a LinkedIn URL and are eligible for LinkedIn outreach.
                {leadsWithLi === 0 && campaign.sources?.includes('linkedin')
                  ? ' Run a scrape — the LinkedIn worker will find and add leads with LinkedIn profiles directly.'
                  : leadsWithLi === 0 ? ' GitHub profiles sometimes include LinkedIn URLs, but for direct LinkedIn sourcing add "linkedin" to your campaign sources.' : ''
                }
              </div>
            </div>
          )}

          {liQueue.length > 0 && (
            <div className="overflow-x-auto bg-surface border border-border rounded-xl">
            <table className="w-full min-w-[640px] text-sm">
              <thead>
                <tr className="border-b border-border text-left">
                  {['Lead', 'Action', 'Status', 'Attempts', 'Processed', 'Error'].map(h => (
                    <th key={h} className="px-3 py-2.5 text-foreground-subtle text-xs font-medium">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {liQueue.map(q => (
                  <tr key={q.id} className="hover:bg-surface-2 transition-colors">
                    <td className="px-3 py-2.5 text-foreground">{leadMap[q.lead_id] ?? '—'}</td>
                    <td className="px-3 py-2.5 text-foreground-muted">{ACTION_LABEL[q.action] ?? q.action}</td>
                    <td className="px-3 py-2.5">
                      <span className="px-2 py-0.5 rounded-full text-xs text-slate-700" style={{ background: LI_STATUS_COLOR[q.status] ?? '#f3f4f6' }}>
                        {q.status}
                      </span>
                    </td>
                    <td className="px-3 py-2.5 text-foreground-subtle tabular-nums">{q.attempts}</td>
                    <td className="px-3 py-2.5 text-foreground-muted text-xs">
                      {q.processed_at ? new Date(q.processed_at).toLocaleString() : '—'}
                    </td>
                    <td className="px-3 py-2.5 text-red-600 text-xs max-w-[200px]">
                      {q.error ? friendlyLiError(q.error) : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            </div>
          )}

          {/* Sequence steps summary */}
          {liSends.length > 0 && (
            <details className="mt-6 bg-surface border border-border rounded-xl px-4 py-3">
              <summary className="cursor-pointer font-semibold text-sm text-foreground">
                Sequence sends — LinkedIn ({liSends.length})
              </summary>
              <div className="overflow-x-auto">
              <table className="w-full min-w-[480px] text-xs mt-3">
                <thead>
                  <tr className="border-b border-border text-left">
                    {['Lead', 'Step', 'Status', 'Sent at'].map(h => (
                      <th key={h} className="px-2 py-1.5 text-foreground-subtle font-medium">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {liSends.map(s => (
                    <tr key={s.id}>
                      <td className="px-2 py-1.5 text-foreground">{leadMap[s.lead_id] ?? '—'}</td>
                      <td className="px-2 py-1.5 text-foreground-muted">Step {s.step}</td>
                      <td className="px-2 py-1.5">
                        <span className={`px-1.5 py-0.5 rounded text-[11px] ${
                          s.status === 'sent' ? 'bg-green-100 text-green-800' : s.status === 'failed' ? 'bg-red-100 text-red-800' : 'bg-surface-2 text-foreground-muted'
                        }`}>
                          {s.status}
                        </span>
                      </td>
                      <td className="px-2 py-1.5 text-foreground-subtle">
                        {s.sent_at ? new Date(s.sent_at).toLocaleString() : '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              </div>
            </details>
          )}
        </div>
      )}

      {/* ── ICP config editor ───────────────────────────────────────────────── */}
      <IcpEditor campaignId={id} icp={campaign.icp_config} onSaved={fresh => setData(prev => prev ? { ...prev, campaign: { ...prev.campaign, icp_config: fresh } } : prev)} />

      {/* ── CSV import modal ─────────────────────────────────────────────────── */}
      {showImport && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-surface rounded-2xl max-w-2xl w-full max-h-[90vh] overflow-auto shadow-2xl border border-border">
            <div className="px-6 py-5 border-b border-border flex justify-between items-center">
              <div>
                <div className="font-bold text-base text-foreground">Import leads from CSV</div>
                <div className="text-xs text-foreground-muted mt-0.5">
                  Paste a CSV from Peerlist, Product Hunt, or any listing site. Leads are scored against your ICP automatically.
                </div>
              </div>
              <button onClick={() => { setShowImport(false); setCsvText(''); setParsedRows([]); setImportMsg('') }}
                className="text-foreground-subtle hover:text-foreground text-xl leading-none transition-colors">✕</button>
            </div>

            <div className="px-6 py-5">
              {/* Column hint */}
              <div className="bg-surface-2 border border-border rounded-lg px-3 py-2.5 text-xs text-foreground-muted mb-3.5 font-mono">
                Expected columns (any order, extra columns ignored):<br />
                <strong className="text-foreground">name</strong>, email, company, linkedin_url, twitter_handle, bio, location
              </div>

              <textarea
                value={csvText}
                onChange={e => onCsvChange(e.target.value)}
                placeholder={'name,email,company\nJane Doe,jane@example.com,Acme\nJohn Smith,john@example.com,Startup Inc'}
                rows={10}
                className="w-full font-mono text-xs px-3 py-2.5 bg-bg border border-border rounded-lg text-foreground placeholder-foreground-subtle resize-y outline-none focus:border-accent/50 box-border"
              />

              {parsedRows.length > 0 && (
                <div className="mt-3">
                  <div className="text-xs text-green-600 mb-2 font-semibold">
                    ✓ {parsedRows.length} valid row{parsedRows.length !== 1 ? 's' : ''} detected
                    {parsedRows.length > 500 ? ' — capped at 500' : ''}
                  </div>
                  <div className="overflow-x-auto max-h-[180px] overflow-y-auto border border-border rounded-lg">
                    <table className="w-full text-xs">
                      <thead>
                        <tr className="border-b border-border bg-surface-2 text-left">
                          {['Name', 'Email', 'Company', 'LinkedIn'].map(h => (
                            <th key={h} className="px-2.5 py-1.5 font-semibold text-foreground-muted">{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-border">
                        {parsedRows.slice(0, 10).map((r, i) => (
                          <tr key={i}>
                            <td className="px-2.5 py-1.5 text-foreground">{r.name || <span className="text-foreground-subtle">—</span>}</td>
                            <td className={`px-2.5 py-1.5 ${r.email ? 'text-foreground' : 'text-foreground-subtle'}`}>{r.email || '—'}</td>
                            <td className="px-2.5 py-1.5 text-foreground-muted">{r.company || '—'}</td>
                            <td className="px-2.5 py-1.5">
                              {r.linkedin_url ? <span className="text-[#0a66c2]">✓</span> : <span className="text-foreground-subtle">—</span>}
                            </td>
                          </tr>
                        ))}
                        {parsedRows.length > 10 && (
                          <tr>
                            <td colSpan={4} className="px-2.5 py-1.5 text-foreground-subtle italic">
                              …and {parsedRows.length - 10} more
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {importMsg && (
                <p className={`mt-3 text-sm ${importMsg.includes('✓') ? 'text-green-600' : 'text-red-600'}`}>
                  {importMsg}
                </p>
              )}
            </div>

            <div className="px-6 py-4 border-t border-border flex gap-3 justify-end">
              <button onClick={() => { setShowImport(false); setCsvText(''); setParsedRows([]); setImportMsg('') }}
                className="px-4 py-2 border border-border rounded-lg bg-surface text-sm text-foreground-muted hover:text-foreground transition-colors">
                Cancel
              </button>
              <button onClick={handleImport} disabled={importing || parsedRows.length === 0}
                className="px-5 py-2 bg-accent hover:bg-accent/90 text-white text-sm font-bold rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed">
                {importing ? 'Importing…' : `Import ${Math.min(parsedRows.length, 500)} leads`}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Email preview modal ──────────────────────────────────────────────── */}
      {preview && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-surface rounded-2xl max-w-3xl w-full max-h-[90vh] overflow-auto shadow-2xl border border-border">
            {/* Modal header */}
            <div className="px-6 py-5 border-b border-border flex justify-between items-center">
              <div>
                <div className="font-bold text-base text-foreground">Email preview — Step {preview.step}</div>
                <div className="text-xs text-foreground-muted mt-0.5">
                  Showing 3 samples from {preview.total} leads due. If these look good, hit Run Send.
                </div>
              </div>
              <button onClick={() => setPreview(null)} className="text-foreground-subtle hover:text-foreground text-xl leading-none transition-colors">✕</button>
            </div>

            {/* Samples */}
            <div className="px-6 py-5">
              {preview.previews.map((p, i) => (
                <div key={p.lead.id} className={i < preview.previews.length - 1 ? 'mb-6' : ''}>
                  <div className="flex justify-between items-center mb-2">
                    <div className="font-semibold text-sm text-foreground">
                      {p.lead.name ?? 'Unknown'} · <span className="text-foreground-subtle font-normal">{p.lead.email}</span>
                    </div>
                    <span className="text-xs text-foreground-subtle bg-surface-2 px-2 py-0.5 rounded-lg">
                      ICP {p.lead.icp_match_score != null ? (p.lead.icp_match_score * 100).toFixed(0) + '%' : '—'}
                    </span>
                  </div>
                  {p.error ? (
                    <div className="text-red-700 text-sm p-3 bg-red-50 border border-red-200 rounded-lg">
                      {friendlyPreviewError(p.error)}
                    </div>
                  ) : (
                    <div className="border border-border rounded-xl overflow-hidden">
                      <div className="px-3.5 py-2.5 bg-surface-2 border-b border-border text-sm">
                        <span className="text-foreground-subtle">Subject: </span>
                        <span className="font-semibold text-foreground">{p.subject}</span>
                      </div>
                      <div
                        className="p-3.5 text-sm leading-relaxed max-h-[280px] overflow-auto text-foreground"
                        dangerouslySetInnerHTML={{ __html: p.body ?? '' }}
                      />
                    </div>
                  )}
                </div>
              ))}
            </div>

            {/* Modal footer */}
            <div className="px-6 py-4 border-t border-border flex flex-wrap gap-3 justify-end">
              <button onClick={() => setPreview(null)} className="px-4 py-2 border border-border rounded-lg bg-surface text-sm text-foreground-muted hover:text-foreground transition-colors">
                Close
              </button>
              <button onClick={previewEmails} className="px-4 py-2 border border-indigo-400 rounded-lg bg-surface text-sm text-indigo-600 hover:bg-indigo-50 transition-colors">
                ↺ Regenerate samples
              </button>
              <button
                onClick={() => { setPreview(null); triggerAction('send') }}
                className="px-5 py-2 bg-accent hover:bg-accent/90 text-white text-sm font-bold rounded-lg transition-colors">
                ✓ Looks good — Send {preview.total} emails
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
    </div>
  )
}
