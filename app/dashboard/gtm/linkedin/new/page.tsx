'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import GtmPageHeader from '@/components/gtm/GtmPageHeader'

const inputCls = 'w-full px-3 py-2 bg-bg border border-border rounded-lg text-sm text-foreground placeholder-foreground-subtle outline-none focus:border-accent/50 transition-colors'
const labelCls = 'flex flex-col gap-1.5'
const labelTextCls = 'text-sm font-semibold text-foreground'
const hintCls = 'text-xs text-foreground-subtle leading-relaxed'
// min-w-0 overrides the fieldset default of min-inline-size: min-content so it can shrink on mobile
const fieldsetCls = 'bg-surface border border-border rounded-xl px-5 py-4 min-w-0'
const legendCls = 'font-bold text-sm text-foreground px-1.5'

export default function NewLinkedInCampaignPage() {
  const router = useRouter()

  // ── URL analyser ─────────────────────────────────────────────────────────────
  const [websiteUrl, setWebsiteUrl]     = useState('')
  const [analysing, setAnalysing]       = useState(false)
  const [analyseError, setAnalyseError] = useState('')
  const [analysed, setAnalysed]         = useState(false)

  // ── Sender ────────────────────────────────────────────────────────────────────
  const [senderName, setSenderName]   = useState('')
  const [senderTitle, setSenderTitle] = useState('')

  // ── Campaign ─────────────────────────────────────────────────────────────────
  const [name, setName]                     = useState('')
  const [icpDescription, setIcpDescription] = useState('')
  const [dailyLinkedInLimit, setDailyLinkedInLimit] = useState(20)

  const [loading, setLoading] = useState(false)
  const [error, setError]     = useState('')

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
    setSenderName(extracted.company_name ?? '')
    setIcpDescription(extracted.icp_description ?? '')
    setName(extracted.campaign_name ?? '')
    setAnalysed(true)
    setAnalysing(false)
  }

  // ── Submit ───────────────────────────────────────────────────────────────────
  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!name.trim() || !icpDescription.trim()) {
      setError('Fill in all required fields.')
      return
    }
    if (!senderName.trim()) {
      setError('Enter your name — it signs every connection note.')
      return
    }
    setLoading(true)
    setError('')

    try {
      const res = await fetch('/api/gtm/campaigns', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name,
          icp_description: icpDescription,
          // LinkedIn is the only lead source that can produce a linkedin_url —
          // the other scrapers (github/devto/npm/hackernews) can never be connected to.
          sources: ['linkedin'],
          daily_email_limit: 0,
          daily_linkedin_limit: dailyLinkedInLimit,
          sequence_steps: [{ step: 1, channel: 'linkedin', delay_days: 0 }],
          sender_name: senderName,
          sender_title: senderTitle,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Failed to create campaign — please try again.')
      router.push(`/dashboard/gtm/${data.campaign.id}`)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong')
      setLoading(false)
    }
  }

  return (
    <div>
      <GtmPageHeader title="New LinkedIn Campaign" />
      <div className="px-4 sm:px-8 py-7 max-w-2xl mx-auto">
        <Link href="/dashboard/gtm/linkedin" className="text-foreground-subtle hover:text-accent text-sm no-underline transition-colors">← Back to LinkedIn</Link>
        <h1 className="text-2xl font-black text-foreground tracking-tight mt-2 mb-6">New LinkedIn Campaign</h1>

        {/* ── URL Analyser ─────────────────────────────────────────────────── */}
        <div className={`rounded-xl p-5 mb-6 border ${analysed ? 'border-green-300 bg-green-50' : 'border-border bg-surface-2'}`}>
          <div className={`font-bold text-sm mb-1 ${analysed ? 'text-green-900' : 'text-foreground'}`}>
            ✦ Auto-fill from your website
          </div>
          <div className={`text-xs mb-3.5 leading-relaxed ${analysed ? 'text-green-800/80' : 'text-foreground-muted'}`}>
            Paste your product URL and Gemini reads the page to fill in your target audience below.
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

          {/* ── About you ───────────────────────────────────────────────────── */}
          <fieldset className={fieldsetCls}>
            <legend className={legendCls}>About you</legend>
            <div className="flex flex-col sm:flex-row gap-3 mt-2">
              <label className={`${labelCls} flex-1`}>
                <span className={labelTextCls}>Your name <span className="text-red-500">*</span></span>
                <span className={hintCls}>Signs every connection note it sends.</span>
                <input value={senderName} onChange={e => setSenderName(e.target.value)}
                  placeholder="Dumebi" className={inputCls} />
              </label>
              <label className={`${labelCls} flex-1`}>
                <span className={labelTextCls}>Your title</span>
                <input value={senderTitle} onChange={e => setSenderTitle(e.target.value)}
                  placeholder="Founder @ Ozigi" className={inputCls} />
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
                  placeholder="LinkedIn – Dev Tool Founders – Jun 2026" className={inputCls} />
              </label>

              <label className={labelCls}>
                <span className={labelTextCls}>Who are you targeting? <span className="text-red-500">*</span></span>
                <span className={hintCls}>Plain English. Gemini extracts the structured ICP from this and searches LinkedIn for matches.</span>
                <textarea value={icpDescription} onChange={e => setIcpDescription(e.target.value)}
                  rows={4}
                  placeholder="e.g. Software engineers and technical founders building SaaS products or dev tools. Active on GitHub, early-stage startups (1–50 people), care about shipping fast. Seniority: senior engineer to CTO."
                  className={`${inputCls} resize-y`} />
              </label>

            </div>
          </fieldset>

          {/* ── How it sends ───────────────────────────────────────────────── */}
          <div className="text-xs text-foreground-muted leading-relaxed bg-surface-2 border border-border rounded-xl px-4 py-3">
            Ozigi finds people matching your ICP and sends each one a single personalised{' '}
            <strong className="text-foreground">connection request</strong> from your own LinkedIn tab, at a human pace.
            LinkedIn doesn&rsquo;t support automated follow-up messages, so there&rsquo;s no sequence to configure —
            just make sure the extension is running from{' '}
            <Link href="/dashboard/gtm/settings" className="text-accent no-underline hover:underline">Settings</Link>.
          </div>

          {/* ── Limits ─────────────────────────────────────────────────────── */}
          <fieldset className={fieldsetCls}>
            <legend className={legendCls}>Daily limit</legend>
            <div className="mt-2">
              <label className="flex items-center gap-3">
                <span className="text-sm font-semibold text-foreground">Connection requests / day</span>
                <input type="number" min={1} max={50} value={dailyLinkedInLimit}
                  onChange={e => setDailyLinkedInLimit(Number(e.target.value))}
                  className="w-[70px] px-2.5 py-1.5 bg-bg border border-border rounded-lg text-sm text-foreground outline-none focus:border-accent/50" />
              </label>
            </div>
          </fieldset>

          {error && <p className="text-red-600 text-sm m-0">{error}</p>}

          <button type="submit" disabled={loading}
            className="px-6 py-2.5 bg-[#0a66c2] hover:bg-[#004182] text-white text-base font-bold rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed self-start">
            {loading ? 'Creating campaign…' : 'Create LinkedIn Campaign'}
          </button>
        </form>
      </div>
    </div>
  )
}
