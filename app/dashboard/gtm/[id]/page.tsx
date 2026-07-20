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
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.35rem', alignItems: 'center', padding: '0.35rem 0.5rem', border: '1px solid #ddd', borderRadius: 6, background: '#fafafa', cursor: 'text' }}
      onClick={() => inputRef.current?.focus()}>
      {values.map(v => (
        <span key={v} style={{ display: 'inline-flex', alignItems: 'center', gap: '0.25rem', background: '#e0e7ff', color: '#3730a3', padding: '0.15rem 0.5rem', borderRadius: 12, fontSize: '0.8rem', fontWeight: 500 }}>
          {v}
          <button onClick={e => { e.stopPropagation(); onChange(values.filter(x => x !== v)) }}
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#6366f1', fontSize: '0.85rem', lineHeight: 1, padding: 0 }}>×</button>
        </span>
      ))}
      <input ref={inputRef} value={input} onChange={e => setInput(e.target.value)}
        onKeyDown={e => { if (e.key === 'Enter' || e.key === ',') { e.preventDefault(); add() } if (e.key === 'Backspace' && !input && values.length) onChange(values.slice(0, -1)) }}
        onBlur={add}
        placeholder={values.length === 0 ? 'Type and press Enter…' : ''}
        style={{ border: 'none', outline: 'none', background: 'transparent', fontSize: '0.85rem', minWidth: 120, flex: 1 }} />
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
    <div style={{ marginTop: '2rem', border: '1px solid #eee', borderRadius: 8, overflow: 'hidden' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.75rem 1rem', cursor: 'pointer', background: open ? '#fafafa' : 'white' }}
        onClick={() => setOpen(o => !o)}>
        <span style={{ fontWeight: 600, fontSize: '0.9rem' }}>
          ICP Config <span style={{ fontWeight: 400, color: '#888', fontSize: '0.8rem' }}>— controls LinkedIn &amp; GitHub search</span>
        </span>
        <span style={{ color: '#888', fontSize: '0.85rem' }}>{open ? '▲ collapse' : '▼ edit'}</span>
      </div>

      {open && (
        <div style={{ padding: '1rem', borderTop: '1px solid #eee' }}>
          <p style={{ margin: '0 0 1rem', fontSize: '0.82rem', color: '#666', background: '#fffbeb', border: '1px solid #fde68a', borderRadius: 6, padding: '0.5rem 0.75rem' }}>
            ⚠️ <strong>Keywords and Job Titles</strong> are used directly as LinkedIn search terms. Use words people actually write in their LinkedIn headline — avoid tool names like "GitHub" or "Dev.to".
          </p>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
            {ICP_FIELDS.map(({ key, label, hint }) => (
              <div key={key} style={{ display: 'flex', flexDirection: 'column', gap: '0.3rem' }}>
                <label style={{ fontSize: '0.8rem', fontWeight: 600, color: '#444' }}>{label}</label>
                <TagInput values={(config as unknown as Record<string, string[]>)[key] ?? []} onChange={val => setField(key, val)} />
                <span style={{ fontSize: '0.72rem', color: '#aaa' }}>{hint}</span>
              </div>
            ))}
          </div>
          <div style={{ marginTop: '1rem', display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <button onClick={save} disabled={saving} style={{ padding: '0.45rem 1.1rem', background: '#111', color: 'white', border: 'none', borderRadius: 6, fontWeight: 600, fontSize: '0.88rem', cursor: saving ? 'not-allowed' : 'pointer' }}>
              {saving ? 'Saving…' : 'Save ICP'}
            </button>
            {saved && <span style={{ color: '#16a34a', fontSize: '0.85rem' }}>✓ Saved — changes apply on next Scrape</span>}
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

  if (loading) return <div style={{ padding: '2rem' }}>Loading…</div>
  if (!data)   return <div style={{ padding: '2rem', color: 'red' }}>Campaign not found.</div>

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
    <div style={{ padding: '2rem', maxWidth: 960 }}>

      {/* ── Header ──────────────────────────────────────────────────────────── */}
      <div style={{ marginBottom: '1.5rem' }}>
        <Link href="/dashboard/gtm" style={{ color: '#666', textDecoration: 'none', fontSize: '0.9rem' }}>← Campaigns</Link>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '0.5rem' }}>
          <h1 style={{ fontSize: '1.4rem', fontWeight: 700 }}>{campaign.name}</h1>
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <button onClick={() => triggerAction('scrape')} style={{ padding: '0.4rem 0.8rem', border: '1px solid #ccc', borderRadius: 5, cursor: 'pointer', background: 'white', fontSize: '0.85rem' }}>
              Run Scrape
            </button>
            <button onClick={() => { setShowImport(true); setImportMsg('') }} style={{ padding: '0.4rem 0.8rem', border: '1px solid #ccc', borderRadius: 5, cursor: 'pointer', background: 'white', fontSize: '0.85rem' }}>
              Import CSV
            </button>
            <button onClick={previewEmails} disabled={previewing} style={{ padding: '0.4rem 0.8rem', border: '1px solid #6366f1', borderRadius: 5, cursor: 'pointer', background: previewing ? '#f5f3ff' : 'white', color: '#6366f1', fontSize: '0.85rem' }}>
              {previewing ? 'Generating…' : '👁 Preview emails'}
            </button>
            <button onClick={() => triggerAction('send')} style={{ padding: '0.4rem 0.8rem', border: '1px solid #ccc', borderRadius: 5, cursor: 'pointer', background: 'white', fontSize: '0.85rem' }}>
              Run Send
            </button>
            <button onClick={toggleStatus} style={{ padding: '0.4rem 0.8rem', border: '1px solid #ccc', borderRadius: 5, cursor: 'pointer', background: campaign.status === 'active' ? '#fef9c3' : '#dcfce7', fontSize: '0.85rem' }}>
              {campaign.status === 'active' ? 'Pause' : 'Resume'}
            </button>
          </div>
        </div>
        {actionMsg && <p style={{ marginTop: '0.5rem', fontSize: '0.85rem', color: '#555' }}>{actionMsg}</p>}
      </div>

      {/* ── Stats grid ──────────────────────────────────────────────────────── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '0.75rem', marginBottom: '1.5rem' }}>
        {[
          { label: 'Total leads',          value: leads.length,   sub: `${leadsWithLi} have LinkedIn` },
          { label: 'Emails sent',           value: emailSent,      sub: `${emailSends.filter(s=>s.status==='queued').length} queued` },
          { label: 'LinkedIn actions done', value: liDone,         sub: liPending > 0 ? `${liPending} pending` : liFailed > 0 ? `${liFailed} failed` : 'worker idle' },
          { label: 'Replied',               value: sends.filter(s=>s.status==='replied').length, sub: `${campaign.daily_email_limit} email/day limit` },
        ].map(s => (
          <div key={s.label} style={{ border: '1px solid #eee', borderRadius: 8, padding: '0.9rem 1rem' }}>
            <div style={{ fontSize: '1.6rem', fontWeight: 700 }}>{s.value}</div>
            <div style={{ fontSize: '0.78rem', color: '#666', marginTop: '0.15rem' }}>{s.label}</div>
            <div style={{ fontSize: '0.72rem', color: '#aaa', marginTop: '0.1rem' }}>{s.sub}</div>
          </div>
        ))}
      </div>

      {/* ── LinkedIn worker status banner ────────────────────────────────────── */}
      {liQueue.length > 0 && liPending > 0 && (
        <div style={{ background: '#fffbeb', border: '1px solid #fde68a', borderRadius: 8, padding: '0.75rem 1rem', marginBottom: '1.25rem', fontSize: '0.85rem', color: '#92400e' }}>
          ⏳ <strong>{liPending} LinkedIn action{liPending > 1 ? 's' : ''} queued</strong> — processing automatically, actions are spaced out to appear human.
        </div>
      )}
      {liFailed > 0 && (
        <div style={{ background: '#fff1f2', border: '1px solid #fecdd3', borderRadius: 8, padding: '0.75rem 1rem', marginBottom: '1.25rem', fontSize: '0.85rem', color: '#9f1239' }}>
          ✗ <strong>{liFailed} LinkedIn action{liFailed > 1 ? 's' : ''} failed</strong> — see the LinkedIn tab for details.
        </div>
      )}

      {/* ── Tabs ────────────────────────────────────────────────────────────── */}
      <div style={{ display: 'flex', gap: '0', marginBottom: '1.25rem', borderBottom: '2px solid #eee' }}>
        {([
          { key: 'leads',    label: `Leads (${leads.length})` },
          { key: 'email',    label: `Email (${emailSent} sent)` },
          { key: 'linkedin', label: `LinkedIn (${liDone} done${liPending > 0 ? `, ${liPending} pending` : ''})` },
        ] as { key: Tab; label: string }[]).map(t => (
          <button key={t.key} onClick={() => setTab(t.key)} style={{
            padding: '0.5rem 1.1rem', border: 'none', background: 'none', cursor: 'pointer',
            fontSize: '0.88rem',
            borderBottom: tab === t.key ? '2px solid #111' : '2px solid transparent',
            marginBottom: -2,
            fontWeight: tab === t.key ? 700 : 400,
            color: tab === t.key ? '#111' : '#666',
          }}>
            {t.label}
          </button>
        ))}
      </div>

      {/* ── Leads tab ───────────────────────────────────────────────────────── */}
      {tab === 'leads' && (
        leads.length === 0 ? (
          <p style={{ color: '#888' }}>No leads yet — run a scrape to discover leads.</p>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', minWidth: 640, borderCollapse: 'collapse', fontSize: '0.85rem' }}>
              <thead>
                <tr style={{ borderBottom: '2px solid #eee', textAlign: 'left' }}>
                  <th style={{ padding: '0.4rem 0.6rem' }}>Name</th>
                  <th style={{ padding: '0.4rem 0.6rem' }}>Email</th>
                  <th style={{ padding: '0.4rem 0.6rem' }}>LinkedIn</th>
                  <th style={{ padding: '0.4rem 0.6rem' }}>Score</th>
                  <th style={{ padding: '0.4rem 0.6rem' }}>Status</th>
                  <th style={{ padding: '0.4rem 0.6rem' }}>Company</th>
                </tr>
              </thead>
              <tbody>
                {leads.map(l => (
                  <tr key={l.id} style={{ borderBottom: '1px solid #f4f4f4' }}>
                    <td style={{ padding: '0.4rem 0.6rem' }}>
                      {l.github_username
                        ? <a href={`https://github.com/${l.github_username}`} target="_blank" rel="noreferrer" style={{ color: '#111' }}>{l.name}</a>
                        : l.name}
                    </td>
                    <td style={{ padding: '0.4rem 0.6rem', color: l.email ? '#111' : '#ccc' }}>
                      {l.email ?? '—'}
                    </td>
                    <td style={{ padding: '0.4rem 0.6rem' }}>
                      {l.linkedin_url
                        ? <a href={l.linkedin_url} target="_blank" rel="noreferrer" style={{ color: '#0a66c2', fontSize: '0.8rem' }}>in profile</a>
                        : <span style={{ color: '#ccc' }}>—</span>}
                    </td>
                    <td style={{ padding: '0.4rem 0.6rem' }}>
                      {l.icp_match_score != null ? (l.icp_match_score * 100).toFixed(0) + '%' : '—'}
                    </td>
                    <td style={{ padding: '0.4rem 0.6rem' }}>
                      <span style={{
                        padding: '0.15rem 0.5rem', borderRadius: 10, fontSize: '0.75rem',
                        background: l.status === 'contacted' ? '#dbeafe' : l.status === 'replied' ? '#dcfce7' : '#f3f4f6',
                      }}>{l.status}</span>
                    </td>
                    <td style={{ padding: '0.4rem 0.6rem', color: '#555' }}>{l.company ?? '—'}</td>
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
          <p style={{ color: '#888' }}>No emails sent yet — run Send to start the sequence.</p>
        ) : (
          <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', minWidth: 480, borderCollapse: 'collapse', fontSize: '0.85rem' }}>
            <thead>
              <tr style={{ borderBottom: '2px solid #eee', textAlign: 'left' }}>
                <th style={{ padding: '0.4rem 0.6rem' }}>Lead</th>
                <th style={{ padding: '0.4rem 0.6rem' }}>Step</th>
                <th style={{ padding: '0.4rem 0.6rem' }}>Status</th>
                <th style={{ padding: '0.4rem 0.6rem' }}>Sent at</th>
              </tr>
            </thead>
            <tbody>
              {emailSends.slice(0, 100).map(s => (
                <tr key={s.id} style={{ borderBottom: '1px solid #f4f4f4' }}>
                  <td style={{ padding: '0.4rem 0.6rem', color: '#555' }}>{leadMap[s.lead_id] ?? '—'}</td>
                  <td style={{ padding: '0.4rem 0.6rem' }}>Step {s.step}</td>
                  <td style={{ padding: '0.4rem 0.6rem' }}>
                    <span style={{
                      padding: '0.15rem 0.5rem', borderRadius: 10, fontSize: '0.75rem',
                      background: s.status === 'sent' ? '#dcfce7' : s.status === 'failed' ? '#fee2e2' : '#f3f4f6',
                    }}>{s.status}</span>
                  </td>
                  <td style={{ padding: '0.4rem 0.6rem', color: '#555' }}>
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
            <div style={{ border: '1px solid #eee', borderRadius: 8, padding: '1.5rem', color: '#666', fontSize: '0.88rem', lineHeight: 1.7 }}>
              <div style={{ fontWeight: 700, color: '#111', marginBottom: '0.5rem' }}>How LinkedIn outreach works</div>
              <ol style={{ paddingLeft: '1.25rem', margin: 0 }}>
                <li>Run Scrape → the LinkedIn worker finds profiles on LinkedIn matching your ICP and adds them as leads</li>
                <li>Run Send → the cron queues LinkedIn actions for those leads</li>
                <li>The LinkedIn worker (running locally or on Fly.io) picks them up every 30s</li>
                <li>It opens a browser session using your connected LinkedIn account and performs each action</li>
                <li>Results appear here — done, failed, and error details</li>
              </ol>
              <div style={{ marginTop: '0.9rem', padding: '0.6rem 0.8rem', background: '#f9f9f9', borderRadius: 6, fontSize: '0.82rem' }}>
                <strong>{leadsWithLi} of {leads.length} leads</strong> have a LinkedIn URL and are eligible for LinkedIn outreach.
                {leadsWithLi === 0 && campaign.sources?.includes('linkedin')
                  ? ' Run a scrape — the LinkedIn worker will find and add leads with LinkedIn profiles directly.'
                  : leadsWithLi === 0 ? ' GitHub profiles sometimes include LinkedIn URLs, but for direct LinkedIn sourcing add "linkedin" to your campaign sources.' : ''
                }
              </div>
            </div>
          )}

          {liQueue.length > 0 && (
            <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', minWidth: 640, borderCollapse: 'collapse', fontSize: '0.85rem' }}>
              <thead>
                <tr style={{ borderBottom: '2px solid #eee', textAlign: 'left' }}>
                  <th style={{ padding: '0.4rem 0.6rem' }}>Lead</th>
                  <th style={{ padding: '0.4rem 0.6rem' }}>Action</th>
                  <th style={{ padding: '0.4rem 0.6rem' }}>Status</th>
                  <th style={{ padding: '0.4rem 0.6rem' }}>Attempts</th>
                  <th style={{ padding: '0.4rem 0.6rem' }}>Processed</th>
                  <th style={{ padding: '0.4rem 0.6rem' }}>Error</th>
                </tr>
              </thead>
              <tbody>
                {liQueue.map(q => (
                  <tr key={q.id} style={{ borderBottom: '1px solid #f4f4f4' }}>
                    <td style={{ padding: '0.4rem 0.6rem' }}>{leadMap[q.lead_id] ?? '—'}</td>
                    <td style={{ padding: '0.4rem 0.6rem' }}>{ACTION_LABEL[q.action] ?? q.action}</td>
                    <td style={{ padding: '0.4rem 0.6rem' }}>
                      <span style={{ padding: '0.15rem 0.5rem', borderRadius: 10, fontSize: '0.75rem', background: LI_STATUS_COLOR[q.status] ?? '#f3f4f6' }}>
                        {q.status}
                      </span>
                    </td>
                    <td style={{ padding: '0.4rem 0.6rem', color: '#888' }}>{q.attempts}</td>
                    <td style={{ padding: '0.4rem 0.6rem', color: '#555' }}>
                      {q.processed_at ? new Date(q.processed_at).toLocaleString() : '—'}
                    </td>
                    <td style={{ padding: '0.4rem 0.6rem', color: '#dc2626', fontSize: '0.78rem', maxWidth: 200 }}>
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
            <details style={{ marginTop: '1.5rem', border: '1px solid #eee', borderRadius: 8, padding: '0.75rem 1rem' }}>
              <summary style={{ cursor: 'pointer', fontWeight: 600, fontSize: '0.88rem' }}>
                Sequence sends — LinkedIn ({liSends.length})
              </summary>
              <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', minWidth: 480, borderCollapse: 'collapse', fontSize: '0.82rem', marginTop: '0.75rem' }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid #eee', textAlign: 'left' }}>
                    <th style={{ padding: '0.3rem 0.5rem' }}>Lead</th>
                    <th style={{ padding: '0.3rem 0.5rem' }}>Step</th>
                    <th style={{ padding: '0.3rem 0.5rem' }}>Status</th>
                    <th style={{ padding: '0.3rem 0.5rem' }}>Sent at</th>
                  </tr>
                </thead>
                <tbody>
                  {liSends.map(s => (
                    <tr key={s.id} style={{ borderBottom: '1px solid #f9f9f9' }}>
                      <td style={{ padding: '0.3rem 0.5rem' }}>{leadMap[s.lead_id] ?? '—'}</td>
                      <td style={{ padding: '0.3rem 0.5rem' }}>Step {s.step}</td>
                      <td style={{ padding: '0.3rem 0.5rem' }}>
                        <span style={{ padding: '0.1rem 0.4rem', borderRadius: 8, fontSize: '0.72rem', background: s.status === 'sent' ? '#dcfce7' : s.status === 'failed' ? '#fee2e2' : '#f3f4f6' }}>
                          {s.status}
                        </span>
                      </td>
                      <td style={{ padding: '0.3rem 0.5rem', color: '#888' }}>
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
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 50, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem' }}>
          <div style={{ background: 'white', borderRadius: 12, maxWidth: 680, width: '100%', maxHeight: '90vh', overflow: 'auto', boxShadow: '0 20px 60px rgba(0,0,0,0.3)' }}>
            <div style={{ padding: '1.25rem 1.5rem', borderBottom: '1px solid #eee', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <div style={{ fontWeight: 700, fontSize: '1rem' }}>Import leads from CSV</div>
                <div style={{ fontSize: '0.82rem', color: '#666', marginTop: '0.2rem' }}>
                  Paste a CSV from Peerlist, Product Hunt, or any listing site. Leads are scored against your ICP automatically.
                </div>
              </div>
              <button onClick={() => { setShowImport(false); setCsvText(''); setParsedRows([]); setImportMsg('') }}
                style={{ border: 'none', background: 'none', fontSize: '1.3rem', cursor: 'pointer', color: '#888', lineHeight: 1 }}>✕</button>
            </div>

            <div style={{ padding: '1.25rem 1.5rem' }}>
              {/* Column hint */}
              <div style={{ background: '#f9fafb', border: '1px solid #e5e7eb', borderRadius: 6, padding: '0.6rem 0.8rem', fontSize: '0.78rem', color: '#555', marginBottom: '0.9rem', fontFamily: 'monospace' }}>
                Expected columns (any order, extra columns ignored):<br />
                <strong>name</strong>, email, company, linkedin_url, twitter_handle, bio, location
              </div>

              <textarea
                value={csvText}
                onChange={e => onCsvChange(e.target.value)}
                placeholder={'name,email,company\nJane Doe,jane@example.com,Acme\nJohn Smith,john@example.com,Startup Inc'}
                rows={10}
                style={{ width: '100%', fontFamily: 'monospace', fontSize: '0.8rem', padding: '0.6rem 0.8rem', border: '1px solid #ddd', borderRadius: 6, resize: 'vertical', boxSizing: 'border-box' }}
              />

              {parsedRows.length > 0 && (
                <div style={{ marginTop: '0.75rem' }}>
                  <div style={{ fontSize: '0.82rem', color: '#16a34a', marginBottom: '0.5rem', fontWeight: 600 }}>
                    ✓ {parsedRows.length} valid row{parsedRows.length !== 1 ? 's' : ''} detected
                    {parsedRows.length > 500 ? ' — capped at 500' : ''}
                  </div>
                  <div style={{ overflowX: 'auto', maxHeight: 180, overflowY: 'auto', border: '1px solid #eee', borderRadius: 6 }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.78rem' }}>
                      <thead>
                        <tr style={{ borderBottom: '1px solid #eee', background: '#fafafa', textAlign: 'left' }}>
                          {['Name', 'Email', 'Company', 'LinkedIn'].map(h => (
                            <th key={h} style={{ padding: '0.3rem 0.6rem', fontWeight: 600 }}>{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {parsedRows.slice(0, 10).map((r, i) => (
                          <tr key={i} style={{ borderBottom: '1px solid #f4f4f4' }}>
                            <td style={{ padding: '0.3rem 0.6rem' }}>{r.name || <span style={{ color: '#ccc' }}>—</span>}</td>
                            <td style={{ padding: '0.3rem 0.6rem', color: r.email ? '#111' : '#ccc' }}>{r.email || '—'}</td>
                            <td style={{ padding: '0.3rem 0.6rem', color: '#555' }}>{r.company || '—'}</td>
                            <td style={{ padding: '0.3rem 0.6rem' }}>
                              {r.linkedin_url ? <span style={{ color: '#0a66c2' }}>✓</span> : <span style={{ color: '#ccc' }}>—</span>}
                            </td>
                          </tr>
                        ))}
                        {parsedRows.length > 10 && (
                          <tr>
                            <td colSpan={4} style={{ padding: '0.3rem 0.6rem', color: '#888', fontStyle: 'italic' }}>
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
                <p style={{ marginTop: '0.75rem', fontSize: '0.85rem', color: importMsg.includes('✓') ? '#16a34a' : '#dc2626' }}>
                  {importMsg}
                </p>
              )}
            </div>

            <div style={{ padding: '1rem 1.5rem', borderTop: '1px solid #eee', display: 'flex', gap: '0.75rem', justifyContent: 'flex-end' }}>
              <button onClick={() => { setShowImport(false); setCsvText(''); setParsedRows([]); setImportMsg('') }}
                style={{ padding: '0.5rem 1rem', border: '1px solid #ccc', borderRadius: 6, background: 'white', cursor: 'pointer', fontSize: '0.9rem' }}>
                Cancel
              </button>
              <button onClick={handleImport} disabled={importing || parsedRows.length === 0}
                style={{ padding: '0.5rem 1.25rem', border: 'none', borderRadius: 6, background: parsedRows.length === 0 ? '#d1d5db' : '#111', color: 'white', cursor: parsedRows.length === 0 ? 'not-allowed' : 'pointer', fontSize: '0.9rem', fontWeight: 600 }}>
                {importing ? 'Importing…' : `Import ${Math.min(parsedRows.length, 500)} leads`}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Email preview modal ──────────────────────────────────────────────── */}
      {preview && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 50, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem' }}>
          <div style={{ background: 'white', borderRadius: 12, maxWidth: 720, width: '100%', maxHeight: '90vh', overflow: 'auto', boxShadow: '0 20px 60px rgba(0,0,0,0.3)' }}>
            {/* Modal header */}
            <div style={{ padding: '1.25rem 1.5rem', borderBottom: '1px solid #eee', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <div style={{ fontWeight: 700, fontSize: '1rem' }}>Email preview — Step {preview.step}</div>
                <div style={{ fontSize: '0.82rem', color: '#666', marginTop: '0.2rem' }}>
                  Showing 3 samples from {preview.total} leads due. If these look good, hit Run Send.
                </div>
              </div>
              <button onClick={() => setPreview(null)} style={{ border: 'none', background: 'none', fontSize: '1.3rem', cursor: 'pointer', color: '#888', lineHeight: 1 }}>✕</button>
            </div>

            {/* Samples */}
            <div style={{ padding: '1.25rem 1.5rem' }}>
              {preview.previews.map((p, i) => (
                <div key={p.lead.id} style={{ marginBottom: i < preview.previews.length - 1 ? '1.5rem' : 0 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                    <div style={{ fontWeight: 600, fontSize: '0.9rem' }}>
                      {p.lead.name ?? 'Unknown'} · <span style={{ color: '#888', fontWeight: 400 }}>{p.lead.email}</span>
                    </div>
                    <span style={{ fontSize: '0.75rem', color: '#888', background: '#f3f4f6', padding: '0.15rem 0.5rem', borderRadius: 8 }}>
                      ICP {p.lead.icp_match_score != null ? (p.lead.icp_match_score * 100).toFixed(0) + '%' : '—'}
                    </span>
                  </div>
                  {p.error ? (
                    <div style={{ color: '#dc2626', fontSize: '0.85rem', padding: '0.75rem', background: '#fee2e2', borderRadius: 6 }}>
                      {friendlyPreviewError(p.error)}
                    </div>
                  ) : (
                    <div style={{ border: '1px solid #e5e7eb', borderRadius: 8, overflow: 'hidden' }}>
                      <div style={{ padding: '0.6rem 0.9rem', background: '#f9fafb', borderBottom: '1px solid #e5e7eb', fontSize: '0.85rem' }}>
                        <span style={{ color: '#888' }}>Subject: </span>
                        <span style={{ fontWeight: 600 }}>{p.subject}</span>
                      </div>
                      <div
                        style={{ padding: '0.9rem', fontSize: '0.88rem', lineHeight: 1.7, maxHeight: 280, overflow: 'auto' }}
                        dangerouslySetInnerHTML={{ __html: p.body ?? '' }}
                      />
                    </div>
                  )}
                </div>
              ))}
            </div>

            {/* Modal footer */}
            <div style={{ padding: '1rem 1.5rem', borderTop: '1px solid #eee', display: 'flex', gap: '0.75rem', justifyContent: 'flex-end' }}>
              <button onClick={() => setPreview(null)} style={{ padding: '0.5rem 1rem', border: '1px solid #ccc', borderRadius: 6, background: 'white', cursor: 'pointer', fontSize: '0.9rem' }}>
                Close
              </button>
              <button onClick={previewEmails} style={{ padding: '0.5rem 1rem', border: '1px solid #6366f1', borderRadius: 6, background: 'white', color: '#6366f1', cursor: 'pointer', fontSize: '0.9rem' }}>
                ↺ Regenerate samples
              </button>
              <button
                onClick={() => { setPreview(null); triggerAction('send') }}
                style={{ padding: '0.5rem 1.25rem', border: 'none', borderRadius: 6, background: '#111', color: 'white', cursor: 'pointer', fontSize: '0.9rem', fontWeight: 600 }}>
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
