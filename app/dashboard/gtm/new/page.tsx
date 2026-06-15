'use client'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import GtmPageHeader from '@/components/gtm/GtmPageHeader'

type Channel = 'email' | 'linkedin'

interface SequenceStep {
  step: number
  channel: Channel
  delay_days: number
}

const EMAIL_ACTIONS   = ['Cold intro', 'Follow-up', 'Breakup email', 'Follow-up 2', 'Follow-up 3']
const LINKEDIN_ACTIONS = ['Connect request', 'Direct message', 'Follow-up', 'Close the loop']

/** Returns the human-readable action label for a step */
function getStepLabel(step: SequenceStep, allSteps: SequenceStep[]): string {
  const channelSteps = allSteps.filter(s => s.channel === step.channel)
  const pos = channelSteps.findIndex(s => s.step === step.step)
  if (step.channel === 'email')    return EMAIL_ACTIONS[pos]    ?? `Email ${pos + 1}`
  if (step.channel === 'linkedin') return LINKEDIN_ACTIONS[pos] ?? `Follow-up ${pos}`
  return ''
}

const CHANNEL_COLORS: Record<Channel, string> = {
  email:    '#f0fdf4',
  linkedin: '#eff6ff',
}
const CHANNEL_BORDER: Record<Channel, string> = {
  email:    '#86efac',
  linkedin: '#93c5fd',
}

const DEFAULT_STEPS: SequenceStep[] = [
  { step: 1, channel: 'email',    delay_days: 0 },
  { step: 2, channel: 'email',    delay_days: 3 },
  { step: 3, channel: 'email',    delay_days: 7 },
  { step: 4, channel: 'linkedin', delay_days: 0 },
]

const inp = { padding: '0.5rem 0.75rem', border: '1px solid #ccc', borderRadius: 6, fontSize: '0.95rem', width: '100%', boxSizing: 'border-box' as const }
const lbl = { display: 'flex' as const, flexDirection: 'column' as const, gap: '0.35rem' }

export default function NewCampaignPage() {
  const router = useRouter()

  // ── URL analyser ─────────────────────────────────────────────────────────────
  const [websiteUrl, setWebsiteUrl]   = useState('')
  const [analysing, setAnalysing]     = useState(false)
  const [analyseError, setAnalyseError] = useState('')
  const [analysed, setAnalysed]       = useState(false)

  // ── Sender / product ─────────────────────────────────────────────────────────
  const [senderName, setSenderName]               = useState('')
  const [senderTitle, setSenderTitle]             = useState('')
  const [productName, setProductName]             = useState('')
  const [productDescription, setProductDescription] = useState('')
  const [productContext, setProductContext]       = useState('')
  const [ctaUrl, setCtaUrl]                       = useState('')

  // ── Campaign ─────────────────────────────────────────────────────────────────
  const [name, setName]                   = useState('')
  const [icpDescription, setIcpDescription] = useState('')
  // Sources are always all three — no picker shown to users
  const sources = ['github', 'devto', 'linkedin']
  const [dailyEmailLimit, setDailyEmailLimit] = useState(40)
  const [dailyLinkedInLimit, setDailyLinkedInLimit] = useState(20)
  const [steps, setSteps]                 = useState<SequenceStep[]>(DEFAULT_STEPS)

  const [loading, setLoading]   = useState(false)
  const [error, setError]       = useState('')

  // ── Personas ──────────────────────────────────────────────────────────────────
  const [personas, setPersonas] = useState<{ id: string; name: string; prompt?: string }[]>([])
  const [personaId, setPersonaId] = useState<string>('default')
  useEffect(() => {
    fetch('/api/personas').then(r => r.ok ? r.json() : { personas: [] }).then(d => setPersonas(d.personas ?? []))
  }, [])

  // ── Analyse URL ───────────────────────────────────────────────────────────────
  async function analyseUrl(e: React.FormEvent) {
    e.preventDefault()
    if (!websiteUrl.trim()) return
    setAnalysing(true)
    setAnalyseError('')

    const res = await fetch('/api/gtm/analyse-url', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url: websiteUrl }),
    })
    const d = await res.json()

    if (!res.ok) {
      setAnalyseError("Couldn't analyse that URL — make sure it's a public page and try again.")
      setAnalysing(false)
      return
    }

    const { extracted } = d
    setProductName(extracted.product_name ?? '')
    setProductDescription(extracted.product_description ?? '')
    setProductContext(extracted.product_context ?? '')
    setSenderName(extracted.company_name ?? '')
    setCtaUrl(extracted.cta_url ?? websiteUrl)
    setIcpDescription(extracted.icp_description ?? '')
    setName(extracted.campaign_name ?? '')
    setAnalysed(true)
    setAnalysing(false)
  }

  // ── Sequence step helpers ────────────────────────────────────────────────────
  function updateStep(index: number, field: keyof SequenceStep, value: string | number) {
    setSteps(prev => prev.map((s, i) =>
      i === index ? { ...s, [field]: value } : s
    ))
  }

  function addStep() {
    setSteps(prev => {
      const last = prev[prev.length - 1]
      return [...prev, { step: last.step + 1, channel: 'email', delay_days: 7 }]
    })
  }

  function removeStep(index: number) {
    setSteps(prev => prev
      .filter((_, i) => i !== index)
      .map((s, i) => ({ ...s, step: i + 1 }))
    )
  }

// ── Submit ───────────────────────────────────────────────────────────────────
  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!name.trim() || !icpDescription.trim()) {
      setError('Fill in all required fields.')
      return
    }
    if (!senderName.trim() || !productName.trim() || !productDescription.trim()) {
      setError('Fill in your sender and product details (or use Analyse to auto-fill).')
      return
    }
    setLoading(true)
    setError('')

    try {
      const selectedPersona = personaId !== 'default'
        ? personas.find(p => p.id === personaId)
        : null

      const res = await fetch('/api/gtm/campaigns', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name,
          icp_description: icpDescription,
          sources,
          daily_email_limit: dailyEmailLimit,
          daily_linkedin_limit: dailyLinkedInLimit,
          sequence_steps: steps,
          sender_name: senderName,
          sender_title: senderTitle,
          product_name: productName,
          product_description: productDescription,
          product_context: productContext || null,
          cta_url: ctaUrl,
          persona_voice: selectedPersona?.prompt ?? null,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error('Failed to create campaign — please try again.')
      router.push(`/dashboard/gtm/${data.campaign.id}`)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong')
      setLoading(false)
    }
  }

  return (
    <div>
      <GtmPageHeader title="New Campaign" />
      <div style={{ padding: '2rem', maxWidth: 680 }}>
      <h1 style={{ fontSize: '1.4rem', fontWeight: 700, marginBottom: '1.5rem' }}>New Campaign</h1>

      {/* ── URL Analyser ─────────────────────────────────────────────────── */}
      <div style={{ border: analysed ? '1px solid #86efac' : '1px solid #e0e7ff', background: analysed ? '#f0fdf4' : '#f8f9ff', borderRadius: 8, padding: '1.25rem', marginBottom: '1.5rem' }}>
        <div style={{ fontWeight: 700, fontSize: '0.95rem', marginBottom: '0.4rem' }}>
          ✦ Auto-fill from your website
        </div>
        <div style={{ fontSize: '0.82rem', color: '#555', marginBottom: '0.9rem', lineHeight: 1.5 }}>
          Paste your product URL and Gemini reads the page to fill in all the fields below automatically.
        </div>
        <form onSubmit={analyseUrl} style={{ display: 'flex', gap: '0.5rem' }}>
          <input
            type="url"
            value={websiteUrl}
            onChange={e => { setWebsiteUrl(e.target.value); setAnalysed(false) }}
            placeholder="https://yourproduct.com"
            style={{ ...inp, flex: 1 }}
          />
          <button
            type="submit"
            disabled={analysing || !websiteUrl.trim()}
            style={{ padding: '0.5rem 1.1rem', background: analysing ? '#999' : '#4f46e5', color: '#fff', border: 'none', borderRadius: 6, cursor: 'pointer', fontSize: '0.9rem', whiteSpace: 'nowrap' as const }}>
            {analysing ? 'Analysing…' : analysed ? '↺ Re-analyse' : 'Analyse'}
          </button>
        </form>
        {analyseError && <p style={{ color: '#dc2626', fontSize: '0.82rem', marginTop: '0.5rem' }}>{analyseError}</p>}
        {analysed && <p style={{ color: '#16a34a', fontSize: '0.82rem', marginTop: '0.5rem' }}>✓ Fields filled — review and edit below before creating.</p>}
      </div>

      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>

        {/* ── Sender & product ───────────────────────────────────────────── */}
        <fieldset style={{ border: '1px solid #eee', borderRadius: 8, padding: '1rem 1.25rem' }}>
          <legend style={{ fontWeight: 700, fontSize: '0.95rem', padding: '0 0.4rem' }}>Sender &amp; product</legend>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.9rem', marginTop: '0.5rem' }}>

            <div style={{ display: 'flex', gap: '0.75rem' }}>
              <label style={{ ...lbl, flex: 1 }}>
                <span style={{ fontWeight: 600, fontSize: '0.9rem' }}>Your name <span style={{ color: 'red' }}>*</span></span>
                <input value={senderName} onChange={e => setSenderName(e.target.value)}
                  placeholder="Dumebi" style={inp} />
              </label>
              <label style={{ ...lbl, flex: 1 }}>
                <span style={{ fontWeight: 600, fontSize: '0.9rem' }}>Your title</span>
                <input value={senderTitle} onChange={e => setSenderTitle(e.target.value)}
                  placeholder="Founder @ Ozigi" style={inp} />
              </label>
            </div>

            <label style={lbl}>
              <span style={{ fontWeight: 600, fontSize: '0.9rem' }}>Product name <span style={{ color: 'red' }}>*</span></span>
              <input value={productName} onChange={e => setProductName(e.target.value)}
                placeholder="Ozigi" style={inp} />
            </label>

            <label style={lbl}>
              <span style={{ fontWeight: 600, fontSize: '0.9rem' }}>What does it do? <span style={{ color: 'red' }}>*</span></span>
              <span style={{ fontSize: '0.8rem', color: '#666' }}>1-2 sentences. Gemini uses this to write every email and message.</span>
              <textarea value={productDescription} onChange={e => setProductDescription(e.target.value)}
                rows={3}
                placeholder="AI-powered outbound platform that scrapes leads from GitHub and Dev.to and sends personalised email + LinkedIn sequences automatically."
                style={{ ...inp, resize: 'vertical' as const }} />
            </label>

            <label style={lbl}>
              <span style={{ fontWeight: 600, fontSize: '0.9rem' }}>AI knowledge base</span>
              <span style={{ fontSize: '0.8rem', color: '#666' }}>
                Auto-filled from your website. This is what Gemini reads to write specific, compelling messages —
                the more detail here, the better the copy. Edit freely.
              </span>
              <textarea
                value={productContext}
                onChange={e => setProductContext(e.target.value)}
                rows={6}
                placeholder="Paste your website URL above and click Analyse — Gemini will generate a rich product brief here automatically. Or write it yourself: describe the core problem you solve, key features, concrete outcomes users get, what makes you different, and any social proof or numbers."
                style={{ ...inp, resize: 'vertical' as const, fontFamily: 'inherit', fontSize: '0.85rem', lineHeight: 1.6 }}
              />
            </label>

            <label style={lbl}>
              <span style={{ fontWeight: 600, fontSize: '0.9rem' }}>CTA link</span>
              <input value={ctaUrl} onChange={e => setCtaUrl(e.target.value)}
                placeholder="https://yourproduct.com" style={inp} />
            </label>
          </div>
        </fieldset>

        {/* ── Target audience ────────────────────────────────────────────── */}
        <fieldset style={{ border: '1px solid #eee', borderRadius: 8, padding: '1rem 1.25rem' }}>
          <legend style={{ fontWeight: 700, fontSize: '0.95rem', padding: '0 0.4rem' }}>Target audience</legend>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.9rem', marginTop: '0.5rem' }}>

            <label style={lbl}>
              <span style={{ fontWeight: 600, fontSize: '0.9rem' }}>Campaign name</span>
              <input value={name} onChange={e => setName(e.target.value)}
                placeholder="Ozigi – Dev Tool Founders – Jun 2026" style={inp} />
            </label>

            <label style={lbl}>
              <span style={{ fontWeight: 600, fontSize: '0.9rem' }}>Who are you targeting? <span style={{ color: 'red' }}>*</span></span>
              <span style={{ fontSize: '0.8rem', color: '#666' }}>Plain English. Gemini extracts the structured ICP from this.</span>
              <textarea value={icpDescription} onChange={e => setIcpDescription(e.target.value)}
                rows={4}
                placeholder="e.g. Software engineers and technical founders building SaaS products or dev tools. Active on GitHub, early-stage startups (1–50 people), care about shipping fast. Seniority: senior engineer to CTO."
                style={{ ...inp, resize: 'vertical' as const }} />
            </label>

          </div>
        </fieldset>

        {/* ── Sequence ───────────────────────────────────────────────────── */}
        <fieldset style={{ border: '1px solid #eee', borderRadius: 8, padding: '1rem 1.25rem' }}>
          <legend style={{ fontWeight: 700, fontSize: '0.95rem', padding: '0 0.4rem' }}>Sequence</legend>
          <div style={{ marginTop: '0.5rem' }}>

            <div style={{ fontSize: '0.82rem', color: '#555', marginBottom: '1rem', lineHeight: 1.6, background: '#fafafa', borderRadius: 6, padding: '0.6rem 0.8rem' }}>
              Email and LinkedIn steps run <strong>in parallel</strong> on the same leads.
              The <em>delay</em> on each step is how many days after the <em>previous step of the same channel</em> it fires.
              Step 1 and the first LinkedIn step both fire on day 0.
            </div>

            {steps.map((s, i) => {
              const actionLabel = getStepLabel(s, steps)
              const isFirst = i === 0
              return (
                <div key={i}>
                  {/* Connector line */}
                  {!isFirst && (
                    <div style={{ display: 'flex', alignItems: 'center', marginLeft: 12, marginBottom: 0 }}>
                      <div style={{ width: 2, height: 16, background: '#e5e7eb', marginLeft: 19 }} />
                    </div>
                  )}
                  <div style={{
                    display: 'flex', alignItems: 'center', gap: '0.6rem', marginBottom: 0,
                    padding: '0.6rem 0.75rem',
                    border: `1px solid ${CHANNEL_BORDER[s.channel]}`,
                    borderRadius: 8,
                    background: CHANNEL_COLORS[s.channel],
                  }}>
                    {/* Step number */}
                    <span style={{ fontWeight: 700, color: '#888', fontSize: '0.8rem', width: 18, flexShrink: 0 }}>
                      {i + 1}
                    </span>

                    {/* Channel badge */}
                    <select
                      value={s.channel}
                      onChange={e => updateStep(i, 'channel', e.target.value as Channel)}
                      style={{ padding: '0.3rem 0.5rem', border: '1px solid #d1d5db', borderRadius: 5, fontSize: '0.82rem', background: 'white', fontWeight: 600, cursor: 'pointer' }}>
                      <option value="email">✉ Email</option>
                      <option value="linkedin">in LinkedIn</option>
                    </select>

                    {/* Action label — computed, read-only */}
                    <span style={{ flex: 1, fontSize: '0.88rem', fontWeight: 600, color: '#374151' }}>
                      {actionLabel}
                    </span>

                    {/* Delay */}
                    <span style={{ fontSize: '0.8rem', color: '#6b7280', flexShrink: 0 }}>
                      {i === 0 ? 'Day 0' : (
                        <>
                          +
                          <input
                            type="number"
                            min={1}
                            max={60}
                            value={s.delay_days}
                            onChange={e => updateStep(i, 'delay_days', Number(e.target.value))}
                            style={{ width: 44, padding: '0.2rem 0.3rem', border: '1px solid #d1d5db', borderRadius: 4, fontSize: '0.82rem', textAlign: 'center', margin: '0 0.25rem' }}
                          />
                          days
                        </>
                      )}
                    </span>

                    {/* Remove */}
                    {steps.length > 1 && (
                      <button type="button" onClick={() => removeStep(i)}
                        style={{ padding: '0.15rem 0.45rem', border: '1px solid #fca5a5', borderRadius: 4, background: 'white', color: '#dc2626', cursor: 'pointer', fontSize: '0.78rem', flexShrink: 0 }}>
                        ✕
                      </button>
                    )}
                  </div>
                </div>
              )
            })}

            {/* Add step buttons */}
            <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.8rem' }}>
              <button type="button"
                onClick={() => setSteps(prev => {
                  const n = prev.length + 1
                  return [...prev, { step: n, channel: 'email', delay_days: 7 }]
                })}
                style={{ padding: '0.35rem 0.8rem', border: '1px dashed #86efac', borderRadius: 5, background: '#f0fdf4', color: '#166534', cursor: 'pointer', fontSize: '0.82rem' }}>
                + Email step
              </button>
              <button type="button"
                onClick={() => setSteps(prev => {
                  const n = prev.length + 1
                  return [...prev, { step: n, channel: 'linkedin', delay_days: 3 }]
                })}
                style={{ padding: '0.35rem 0.8rem', border: '1px dashed #93c5fd', borderRadius: 5, background: '#eff6ff', color: '#1d4ed8', cursor: 'pointer', fontSize: '0.82rem' }}>
                + LinkedIn step
              </button>
            </div>
          </div>
        </fieldset>

        {/* ── Email persona / writing voice ──────────────────────────────── */}
        {personas.length > 0 && (
          <fieldset style={{ border: '1px solid #eee', borderRadius: 8, padding: '1rem 1.25rem' }}>
            <legend style={{ fontWeight: 700, fontSize: '0.95rem', padding: '0 0.4rem' }}>Email writing voice</legend>
            <div style={{ fontSize: '0.82rem', color: '#555', marginBottom: '0.9rem', lineHeight: 1.5 }}>
              Pick a persona to shape the tone of all outbound emails in this campaign. Leave as Default for a neutral professional voice.
            </div>
            <select
              value={personaId}
              onChange={e => setPersonaId(e.target.value)}
              style={{ ...inp, maxWidth: 320 }}
            >
              <option value="default">Default — neutral professional</option>
              {personas.map(p => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>
          </fieldset>
        )}

        {/* ── Limits ─────────────────────────────────────────────────────── */}
        <fieldset style={{ border: '1px solid #eee', borderRadius: 8, padding: '1rem 1.25rem' }}>
          <legend style={{ fontWeight: 700, fontSize: '0.95rem', padding: '0 0.4rem' }}>Daily limits</legend>
          <div style={{ display: 'flex', gap: '2rem', marginTop: '0.5rem', flexWrap: 'wrap' as const }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
              <span style={{ fontSize: '0.9rem', fontWeight: 600 }}>Emails / day</span>
              <input type="number" min={1} max={200} value={dailyEmailLimit}
                onChange={e => setDailyEmailLimit(Number(e.target.value))}
                style={{ width: 70, padding: '0.4rem 0.6rem', border: '1px solid #ccc', borderRadius: 6 }} />
            </label>
            <label style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
              <span style={{ fontSize: '0.9rem', fontWeight: 600 }}>LinkedIn actions / day</span>
              <input type="number" min={1} max={50} value={dailyLinkedInLimit}
                onChange={e => setDailyLinkedInLimit(Number(e.target.value))}
                style={{ width: 70, padding: '0.4rem 0.6rem', border: '1px solid #ccc', borderRadius: 6 }} />
            </label>
          </div>
        </fieldset>

        {error && <p style={{ color: 'red', fontSize: '0.9rem', margin: 0 }}>{error}</p>}

        <button type="submit" disabled={loading}
          style={{ padding: '0.65rem 1.5rem', background: loading ? '#999' : '#111', color: '#fff', border: 'none', borderRadius: 6, fontSize: '1rem', cursor: loading ? 'not-allowed' : 'pointer', alignSelf: 'flex-start' }}>
          {loading ? 'Creating campaign…' : 'Create Campaign'}
        </button>
      </form>
    </div>
    </div>
  )
}
