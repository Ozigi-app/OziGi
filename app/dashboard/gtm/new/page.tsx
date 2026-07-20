'use client'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
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

const CHANNEL_CARD_CLS: Record<Channel, string> = {
  email:    'border-green-300 bg-green-50',
  linkedin: 'border-blue-300 bg-blue-50',
}

const DEFAULT_STEPS: SequenceStep[] = [
  { step: 1, channel: 'email',    delay_days: 0 },
  { step: 2, channel: 'email',    delay_days: 3 },
  { step: 3, channel: 'email',    delay_days: 7 },
  { step: 4, channel: 'linkedin', delay_days: 0 },
]

const inputCls = 'w-full px-3 py-2 bg-bg border border-border rounded-lg text-sm text-foreground placeholder-foreground-subtle outline-none focus:border-accent/50 transition-colors'
const labelCls = 'flex flex-col gap-1.5'
const labelTextCls = 'text-sm font-semibold text-foreground'
const hintCls = 'text-xs text-foreground-subtle leading-relaxed'
// min-w-0 overrides the fieldset default of min-inline-size: min-content so it can shrink on mobile
const fieldsetCls = 'bg-surface border border-border rounded-xl px-5 py-4 min-w-0'
const legendCls = 'font-bold text-sm text-foreground px-1.5'

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
  // Sources are always all — no picker shown to users
  const sources = ['github', 'devto', 'linkedin', 'hackernews', 'npm']
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
      <GtmPageHeader title="New Outreach Campaign" />
      <div className="px-4 sm:px-8 py-7 max-w-2xl">
      <h1 className="text-2xl font-black text-foreground tracking-tight mb-6">New Outreach Campaign</h1>

      {/* ── URL Analyser ─────────────────────────────────────────────────── */}
      <div className={`rounded-xl p-5 mb-6 border ${analysed ? 'border-green-300 bg-green-50' : 'border-border bg-surface-2'}`}>
        <div className={`font-bold text-sm mb-1 ${analysed ? 'text-green-900' : 'text-foreground'}`}>
          ✦ Auto-fill from your website
        </div>
        <div className={`text-xs mb-3.5 leading-relaxed ${analysed ? 'text-green-800/80' : 'text-foreground-muted'}`}>
          Paste your product URL and Gemini reads the page to fill in all the fields below automatically.
        </div>
        <form onSubmit={analyseUrl} className="flex gap-2">
          <input
            type="url"
            value={websiteUrl}
            onChange={e => { setWebsiteUrl(e.target.value); setAnalysed(false) }}
            placeholder="https://yourproduct.com"
            className={`${inputCls} flex-1 ${analysed ? 'bg-white text-slate-900' : ''}`}
          />
          <button
            type="submit"
            disabled={analysing || !websiteUrl.trim()}
            className="px-4 py-2 bg-accent hover:bg-accent/90 text-white text-sm font-bold rounded-lg transition-colors disabled:opacity-50 whitespace-nowrap">
            {analysing ? 'Analysing…' : analysed ? '↺ Re-analyse' : 'Analyse'}
          </button>
        </form>
        {analyseError && <p className="text-red-600 text-xs mt-2">{analyseError}</p>}
        {analysed && <p className="text-green-700 text-xs mt-2">✓ Fields filled — review and edit below before creating.</p>}
      </div>

      <form onSubmit={handleSubmit} className="flex flex-col gap-6">

        {/* ── Sender & product ───────────────────────────────────────────── */}
        <fieldset className={fieldsetCls}>
          <legend className={legendCls}>Sender &amp; product</legend>
          <div className="flex flex-col gap-4 mt-2">

            <div className="flex flex-col sm:flex-row gap-3">
              <label className={`${labelCls} flex-1`}>
                <span className={labelTextCls}>Your name <span className="text-red-500">*</span></span>
                <input value={senderName} onChange={e => setSenderName(e.target.value)}
                  placeholder="Dumebi" className={inputCls} />
              </label>
              <label className={`${labelCls} flex-1`}>
                <span className={labelTextCls}>Your title</span>
                <input value={senderTitle} onChange={e => setSenderTitle(e.target.value)}
                  placeholder="Founder @ Ozigi" className={inputCls} />
              </label>
            </div>

            <label className={labelCls}>
              <span className={labelTextCls}>Product name <span className="text-red-500">*</span></span>
              <input value={productName} onChange={e => setProductName(e.target.value)}
                placeholder="Ozigi" className={inputCls} />
            </label>

            <label className={labelCls}>
              <span className={labelTextCls}>What does it do? <span className="text-red-500">*</span></span>
              <span className={hintCls}>1-2 sentences. Gemini uses this to write every email and message.</span>
              <textarea value={productDescription} onChange={e => setProductDescription(e.target.value)}
                rows={3}
                placeholder="AI-powered outbound platform that scrapes leads from GitHub and Dev.to and sends personalised email + LinkedIn sequences automatically."
                className={`${inputCls} resize-y`} />
            </label>

            <label className={labelCls}>
              <span className={labelTextCls}>AI knowledge base</span>
              <span className={hintCls}>
                Auto-filled from your website. This is what Gemini reads to write specific, compelling messages —
                the more detail here, the better the copy. Edit freely.
              </span>
              <textarea
                value={productContext}
                onChange={e => setProductContext(e.target.value)}
                rows={6}
                placeholder="Paste your website URL above and click Analyse — Gemini will generate a rich product brief here automatically. Or write it yourself: describe the core problem you solve, key features, concrete outcomes users get, what makes you different, and any social proof or numbers."
                className={`${inputCls} resize-y text-xs leading-relaxed`}
              />
            </label>

            <label className={labelCls}>
              <span className={labelTextCls}>CTA link</span>
              <input value={ctaUrl} onChange={e => setCtaUrl(e.target.value)}
                placeholder="https://yourproduct.com" className={inputCls} />
            </label>
          </div>
        </fieldset>

        {/* ── Target audience ────────────────────────────────────────────── */}
        <fieldset className={fieldsetCls}>
          <legend className={legendCls}>Target audience</legend>
          <div className="flex flex-col gap-4 mt-2">

            <label className={labelCls}>
              <span className={labelTextCls}>Campaign name</span>
              <input value={name} onChange={e => setName(e.target.value)}
                placeholder="Ozigi – Dev Tool Founders – Jun 2026" className={inputCls} />
            </label>

            <label className={labelCls}>
              <span className={labelTextCls}>Who are you targeting? <span className="text-red-500">*</span></span>
              <span className={hintCls}>Plain English. Gemini extracts the structured ICP from this.</span>
              <textarea value={icpDescription} onChange={e => setIcpDescription(e.target.value)}
                rows={4}
                placeholder="e.g. Software engineers and technical founders building SaaS products or dev tools. Active on GitHub, early-stage startups (1–50 people), care about shipping fast. Seniority: senior engineer to CTO."
                className={`${inputCls} resize-y`} />
            </label>

          </div>
        </fieldset>

        {/* ── Sequence ───────────────────────────────────────────────────── */}
        <fieldset className={fieldsetCls}>
          <legend className={legendCls}>Sequence</legend>
          <div className="mt-2">

            <div className="text-xs text-foreground-muted mb-4 leading-relaxed bg-surface-2 rounded-lg px-3 py-2.5">
              Email and LinkedIn steps run <strong className="text-foreground">in parallel</strong> on the same leads.
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
                    <div className="flex items-center ml-3">
                      <div className="w-0.5 h-4 bg-border ml-[19px]" />
                    </div>
                  )}
                  <div className={`flex items-center gap-2.5 px-3 py-2.5 border rounded-lg ${CHANNEL_CARD_CLS[s.channel]}`}>
                    {/* Step number */}
                    <span className="font-bold text-slate-400 text-xs w-4 shrink-0">
                      {i + 1}
                    </span>

                    {/* Channel badge */}
                    <select
                      value={s.channel}
                      onChange={e => updateStep(i, 'channel', e.target.value as Channel)}
                      className="px-2 py-1 border border-slate-300 rounded-md text-xs bg-white text-slate-900 font-semibold cursor-pointer outline-none">
                      <option value="email">✉ Email</option>
                      <option value="linkedin">in LinkedIn</option>
                    </select>

                    {/* Action label — computed, read-only */}
                    <span className="flex-1 min-w-0 text-sm font-semibold text-slate-700 truncate">
                      {actionLabel}
                    </span>

                    {/* Delay */}
                    <span className="text-xs text-slate-500 shrink-0">
                      {i === 0 ? 'Day 0' : (
                        <>
                          +
                          <input
                            type="number"
                            min={1}
                            max={60}
                            value={s.delay_days}
                            onChange={e => updateStep(i, 'delay_days', Number(e.target.value))}
                            className="w-11 px-1 py-0.5 mx-1 border border-slate-300 rounded text-xs text-center bg-white text-slate-900 outline-none"
                          />
                          days
                        </>
                      )}
                    </span>

                    {/* Remove */}
                    {steps.length > 1 && (
                      <button type="button" onClick={() => removeStep(i)}
                        className="px-1.5 py-0.5 border border-red-300 rounded bg-white text-red-600 text-xs shrink-0 hover:bg-red-50 transition-colors">
                        ✕
                      </button>
                    )}
                  </div>
                </div>
              )
            })}

            {/* Add step buttons */}
            <div className="flex gap-2 mt-3">
              <button type="button"
                onClick={() => setSteps(prev => {
                  const n = prev.length + 1
                  return [...prev, { step: n, channel: 'email', delay_days: 7 }]
                })}
                className="px-3 py-1.5 border border-dashed border-green-400 rounded-lg bg-green-50 text-green-700 text-xs font-semibold hover:bg-green-100 transition-colors">
                + Email step
              </button>
              <button type="button"
                onClick={() => setSteps(prev => {
                  const n = prev.length + 1
                  return [...prev, { step: n, channel: 'linkedin', delay_days: 3 }]
                })}
                className="px-3 py-1.5 border border-dashed border-blue-400 rounded-lg bg-blue-50 text-blue-700 text-xs font-semibold hover:bg-blue-100 transition-colors">
                + LinkedIn step
              </button>
            </div>
          </div>
        </fieldset>

        {/* ── Email persona / writing voice ──────────────────────────────── */}
        {personas.length > 0 && (
          <fieldset className={fieldsetCls}>
            <legend className={legendCls}>Email writing voice</legend>
            <div className="text-xs text-foreground-muted mb-3.5 mt-2 leading-relaxed">
              Pick a persona to shape the tone of all outbound emails in this campaign. Leave as Default for a neutral professional voice.
            </div>
            <select
              value={personaId}
              onChange={e => setPersonaId(e.target.value)}
              className={`${inputCls} max-w-xs`}
            >
              <option value="default">Default — neutral professional</option>
              {personas.map(p => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>
          </fieldset>
        )}

        {/* ── Limits ─────────────────────────────────────────────────────── */}
        <fieldset className={fieldsetCls}>
          <legend className={legendCls}>Daily limits</legend>
          <div className="flex gap-8 mt-2 flex-wrap">
            <label className="flex items-center gap-3">
              <span className="text-sm font-semibold text-foreground">Emails / day</span>
              <input type="number" min={1} max={200} value={dailyEmailLimit}
                onChange={e => setDailyEmailLimit(Number(e.target.value))}
                className="w-[70px] px-2.5 py-1.5 bg-bg border border-border rounded-lg text-sm text-foreground outline-none focus:border-accent/50" />
            </label>
            <label className="flex items-center gap-3">
              <span className="text-sm font-semibold text-foreground">LinkedIn actions / day</span>
              <input type="number" min={1} max={50} value={dailyLinkedInLimit}
                onChange={e => setDailyLinkedInLimit(Number(e.target.value))}
                className="w-[70px] px-2.5 py-1.5 bg-bg border border-border rounded-lg text-sm text-foreground outline-none focus:border-accent/50" />
            </label>
          </div>
        </fieldset>

        {error && <p className="text-red-600 text-sm m-0">{error}</p>}

        <button type="submit" disabled={loading}
          className="px-6 py-2.5 bg-accent hover:bg-accent/90 text-white text-base font-bold rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed self-start">
          {loading ? 'Creating campaign…' : 'Create Campaign'}
        </button>
      </form>
    </div>
    </div>
  )
}
