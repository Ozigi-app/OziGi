'use client'
import { useEffect, useState, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import Link from 'next/link'
import GtmPageHeader from '@/components/gtm/GtmPageHeader'
import { usePlanStatus } from '@/components/hooks/usePlanStatus'

interface CrmConnection {
  id: string
  provider: 'hubspot' | 'zoho' | 'salesforce' | 'swipeone'
  zoho_client_id: string | null
  is_active: boolean
  created_at: string
}

const CRM_LABELS: Record<string, string> = {
  hubspot: 'HubSpot', zoho: 'Zoho CRM', salesforce: 'Salesforce', pipedrive: 'Pipedrive', swipeone: 'Swipe One',
}

interface EmailAccount {
  id: string
  email_address: string
  display_name: string | null
  provider: 'gmail' | 'smtp' | 'zoho'
  smtp_host: string | null
  is_active: boolean
  daily_send_count: number
  last_send_date: string | null
  created_at: string
}

interface LinkedInSession {
  id: string
  linkedin_email: string
  status: 'active' | 'logging_in' | 'pending_2fa' | 'needs_login' | 'expired'
  login_error: string | null
  last_used_at: string | null
  created_at: string
}

const STATUS_LABEL: Record<string, string> = {
  active:      '● Connected',
  logging_in:  '⏳ Logging in…',
  pending_2fa: '🔐 Waiting for verification code',
  needs_login: '○ Not connected',
  expired:     '⚠ Session expired',
}

function friendlyLoginError(raw: string): string {
  if (raw.includes('credentials') || raw.includes('wrong') || raw.includes('blocked')) return 'Login failed — check your email and password.'
  if (raw.includes('Timed out') || raw.includes('timeout') || raw.includes('Timeout'))  return 'Login timed out — please try again.'
  if (raw.includes('credentials found'))  return 'No credentials saved — enter your LinkedIn email and password below.'
  if (raw.includes('2FA') || raw.includes('verify') || raw.includes('checkpoint'))      return 'Verification required — enter the code sent to your email or phone.'
  return 'Login failed — please try again.'
}

function SettingsContent() {
  const searchParams = useSearchParams()
  const { planStatus } = usePlanStatus()

  // ── Gmail state ─────────────────────────────────────────────────────────────
  const [accounts, setAccounts] = useState<EmailAccount[]>([])
  const [gmailLoading, setGmailLoading] = useState(true)
  const [gmailAddress, setGmailAddress]   = useState('')
  const [gmailAppPass, setGmailAppPass]   = useState('')
  const [gmailFrom, setGmailFrom]         = useState('')
  const [gmailSaving, setGmailSaving]     = useState(false)
  const [gmailFormMsg, setGmailFormMsg]   = useState<{ type: 'success' | 'error'; text: string } | null>(null)

  // ── SMTP state ──────────────────────────────────────────────────────────────
  const [smtpPreset, setSmtpPreset]   = useState('outlook')
  const [smtpHost, setSmtpHost]       = useState('smtp.office365.com')
  const [smtpPort, setSmtpPort]       = useState(587)
  const [smtpUser, setSmtpUser]       = useState('')
  const [smtpPass, setSmtpPass]       = useState('')
  const [smtpFrom, setSmtpFrom]       = useState('')
  const [smtpSaving, setSmtpSaving]   = useState(false)
  const [smtpMsg, setSmtpMsg]         = useState<{ type: 'success' | 'error'; text: string } | null>(null)
  const [showSmtp, setShowSmtp]       = useState(false)

  // ── CRM state ───────────────────────────────────────────────────────────────
  const [crmConnections, setCrmConnections] = useState<CrmConnection[]>([])
  const [crmConnecting, setCrmConnecting]   = useState<string | null>(null)
  const [crmMsg, setCrmMsg]                 = useState<{ type: 'success' | 'error'; text: string } | null>(null)

  // ── Swipe One (manual API key — no OAuth support) ───────────────────────────
  const [showSwipeone, setShowSwipeone]         = useState(false)
  const [swipeoneApiKey, setSwipeoneApiKey]     = useState('')
  const [swipeoneSaving, setSwipeoneSaving]     = useState(false)

  // ── LinkedIn state ───────────────────────────────────────────────────────────
  const [liSessions, setLiSessions] = useState<LinkedInSession[]>([])
  const [liEmail, setLiEmail] = useState('')
  const [liPassword, setLiPassword] = useState('')
  const [liConnecting, setLiConnecting] = useState(false)
  const [twoFaCode, setTwoFaCode] = useState('')
  const [twoFaSubmitting, setTwoFaSubmitting] = useState(false)
  const [liMsg, setLiMsg] = useState('')

  // Timestamp of when we started polling for login progress, or null when idle.
  // Drives the polling interval below — state (not a ref) so the interval
  // lifecycle is owned by a single effect and survives unrelated re-renders.
  const [liPollingSince, setLiPollingSince] = useState<number | null>(null)

  const connected = searchParams.get('connected')
  const error = searchParams.get('error')

  // ── Load Gmail accounts ──────────────────────────────────────────────────────
  useEffect(() => {
    fetch('/api/gtm/gmail/accounts')
      .then(r => r.json())
      .then(d => { setAccounts(d.accounts ?? []); setGmailLoading(false) })
  }, [])

  // ── Load CRM connections ──────────────────────────────────────────────────────
  useEffect(() => {
    fetch('/api/gtm/crm/connections')
      .then(r => r.json())
      .then(d => setCrmConnections(d.connections ?? []))
  }, [])

  const SMTP_PRESETS: Record<string, { host: string; port: number }> = {
    outlook:  { host: 'smtp.office365.com', port: 587 },
    yahoo:    { host: 'smtp.mail.yahoo.com', port: 587 },
    zohomail: { host: 'smtp.zoho.com',       port: 587 },
    fastmail: { host: 'smtp.fastmail.com',   port: 587 },
    sendgrid: { host: 'smtp.sendgrid.net',   port: 587 },
    custom:   { host: '',                    port: 587 },
  }

  function applyPreset(preset: string) {
    setSmtpPreset(preset)
    const p = SMTP_PRESETS[preset]
    if (p) { setSmtpHost(p.host); setSmtpPort(p.port) }
  }

  async function connectGmailAppPassword(e: React.FormEvent) {
    e.preventDefault()
    setGmailSaving(true); setGmailFormMsg(null)
    const res = await fetch('/api/gtm/smtp/connect', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        host: 'smtp.gmail.com',
        port: 587,
        username: gmailAddress,
        password: gmailAppPass,
        from_email: gmailFrom,
      }),
    })
    const d = await res.json()
    if (res.ok) {
      setGmailFormMsg({ type: 'success', text: 'Gmail connected.' })
      setGmailAddress(''); setGmailAppPass(''); setGmailFrom('')
      const updated = await fetch('/api/gtm/gmail/accounts').then(r => r.json())
      setAccounts(updated.accounts ?? [])
    } else {
      setGmailFormMsg({ type: 'error', text: d.error ?? 'Failed to connect.' })
    }
    setGmailSaving(false)
  }

  async function saveSmtpAccount(e: React.FormEvent) {
    e.preventDefault()
    setSmtpSaving(true); setSmtpMsg(null)
    const res = await fetch('/api/gtm/smtp/connect', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ host: smtpHost, port: smtpPort, username: smtpUser, password: smtpPass, from_email: smtpFrom }),
    })
    const d = await res.json()
    if (res.ok) {
      setSmtpMsg({ type: 'success', text: 'SMTP account connected.' })
      setSmtpUser(''); setSmtpPass(''); setShowSmtp(false)
      const updated = await fetch('/api/gtm/gmail/accounts').then(r => r.json())
      setAccounts(updated.accounts ?? [])
    } else {
      setSmtpMsg({ type: 'error', text: d.error ?? 'Failed to connect.' })
    }
    setSmtpSaving(false)
  }

  async function connectCrmOAuth(provider: string) {
    setCrmConnecting(provider)
    setCrmMsg(null)
    const res = await fetch('/api/gtm/crm/composio', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ provider }),
    })
    const d = await res.json()
    if (res.ok && d.redirectUrl) {
      window.location.href = d.redirectUrl
    } else {
      setCrmMsg({ type: 'error', text: d.error ?? 'Failed to start OAuth flow.' })
      setCrmConnecting(null)
    }
  }

  async function disconnectCrm(id: string, provider: string) {
    if (!confirm(`Disconnect ${CRM_LABELS[provider] ?? provider}?`)) return
    await fetch(`/api/gtm/crm/connections/${id}`, { method: 'DELETE' })
    setCrmConnections(prev => prev.filter(c => c.id !== id))
  }

  async function connectSwipeOne(e: React.FormEvent) {
    e.preventDefault()
    setSwipeoneSaving(true); setCrmMsg(null)
    const res = await fetch('/api/gtm/crm/connections', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ provider: 'swipeone', api_key: swipeoneApiKey }),
    })
    const d = await res.json()
    if (res.ok) {
      setCrmMsg({ type: 'success', text: 'Swipe One connected.' })
      setSwipeoneApiKey(''); setShowSwipeone(false)
      const updated = await fetch('/api/gtm/crm/connections').then(r => r.json())
      setCrmConnections(updated.connections ?? [])
    } else {
      setCrmMsg({ type: 'error', text: d.error ?? 'Failed to connect.' })
    }
    setSwipeoneSaving(false)
  }

  // ── Load + poll LinkedIn sessions ────────────────────────────────────────────
  function loadLinkedIn() {
    return fetch('/api/gtm/linkedin/status')
      .then(r => r.json())
      .then(d => setLiSessions(d.sessions ?? []))
  }

  useEffect(() => {
    loadLinkedIn()
  }, [])

  // Poll while a login is in flight. The interval is owned by this one effect:
  // it starts when liPollingSince is set and is only torn down when it goes
  // back to null (or on unmount) — session updates don't touch it.
  useEffect(() => {
    if (liPollingSince === null) return
    const iv = setInterval(loadLinkedIn, 3000)
    return () => clearInterval(iv)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [liPollingSince])

  // Decide when to stop polling, on every status response:
  //  - a session went active → success, tell the user
  //  - a login failed (error present, nothing in flight) → stop and show it,
  //    but only after a grace period: the worker takes a few seconds to flip
  //    the row to 'logging_in', and until then the row still holds the stale
  //    pre-login status, which must not be read as a result
  //  - hard timeout → stop with a "check back" message instead of hanging
  useEffect(() => {
    if (liPollingSince === null) {
      // Page opened (or refreshed) while a login is already in flight —
      // resume polling so the user still sees the outcome.
      if (liSessions.some(s => s.status === 'logging_in' || s.status === 'pending_2fa')) {
        setLiPollingSince(Date.now())
      }
      return
    }

    const GRACE_MS   = 20_000       // worker pickup time before statuses are trusted
    const TIMEOUT_MS = 6 * 60_000   // covers login + the 5-minute 2FA window

    const elapsed    = Date.now() - liPollingSince
    const active     = liSessions.find(s => s.status === 'active')
    const inProgress = liSessions.some(s => s.status === 'logging_in' || s.status === 'pending_2fa')
    const failed     = liSessions.find(
      s => (s.status === 'needs_login' || s.status === 'expired') && s.login_error
    )

    if (active) {
      setLiPollingSince(null)
      setLiMsg(`✓ LinkedIn connected as ${active.linkedin_email}. Outreach will resume automatically.`)
    } else if (!inProgress && failed && elapsed > GRACE_MS) {
      setLiPollingSince(null)
      setLiMsg('')  // the session card renders the login error itself
    } else if (elapsed > TIMEOUT_MS) {
      setLiPollingSince(null)
      setLiMsg('Login is taking longer than expected — refresh this page in a minute to check the status.')
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [liSessions, liPollingSince])

  async function connectLinkedIn(e: React.FormEvent) {
    e.preventDefault()
    setLiConnecting(true)
    setLiMsg('')
    const res = await fetch('/api/gtm/linkedin/connect', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ linkedin_email: liEmail, linkedin_password: liPassword }),
    })
    const d = await res.json()
    if (res.ok) {
      setLiMsg(d.message)
      setLiPassword('') // clear password from state
      loadLinkedIn()
      // Start polling immediately — don't wait to see 'logging_in' in DB first
      setLiPollingSince(Date.now())
    } else {
      setLiMsg('Could not start LinkedIn login — please check your credentials and try again.')
    }
    setLiConnecting(false)
  }

  async function disconnectLinkedIn(sessionId: string) {
    if (!confirm('Disconnect this LinkedIn account? You can reconnect at any time.')) return
    await fetch('/api/gtm/linkedin/disconnect', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sessionId }),
    })
    setLiPollingSince(null)
    loadLinkedIn()
  }

  async function submitTwoFa(e: React.FormEvent) {
    e.preventDefault()
    setTwoFaSubmitting(true)
    const res = await fetch('/api/gtm/linkedin/verify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ code: twoFaCode }),
    })
    const d = await res.json()
    setLiMsg(d.ok ? 'Verification code submitted.' : 'Invalid or expired code — please try again.')
    setTwoFaCode('')
    setTwoFaSubmitting(false)
  }

  async function disconnectGmail(accountId: string, email: string) {
    if (!confirm(`Disconnect ${email}?`)) return
    await fetch('/api/gtm/gmail/disconnect', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ accountId }),
    })
    setAccounts(prev => prev.filter(a => a.id !== accountId))
  }

  const pendingTwoFa = liSessions.find(s => s.status === 'pending_2fa')
  const activeSession = liSessions.find(s => s.status === 'active')

  const inputCls = "px-3 py-2 bg-bg border border-border rounded-lg text-sm text-foreground placeholder-foreground-subtle outline-none focus:border-accent/50 transition-colors"
  const labelCls = "flex flex-col gap-1.5"
  const labelTextCls = "text-xs font-semibold text-foreground"
  const primaryBtnCls = "px-4 py-2 bg-accent hover:bg-accent/90 text-white text-sm font-bold rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed self-start"
  const dangerBtnCls = "px-2.5 py-1 border border-red-300 text-red-600 hover:bg-red-50 rounded-lg text-xs font-semibold bg-surface transition-colors shrink-0"
  const cardCls = "bg-surface border border-border rounded-xl px-5 py-4 mb-3"

  return (
    <div>
      <GtmPageHeader title="Outreach Settings" />
      <div className="px-4 sm:px-8 py-7 max-w-2xl">
      <div className="mb-6">
        <Link href="/dashboard/gtm" className="text-foreground-subtle hover:text-accent text-sm no-underline transition-colors">← Back to Outreach Campaigns</Link>
        <h1 className="text-2xl font-black text-foreground tracking-tight mt-2">Outreach Settings</h1>
        <p className="text-foreground-subtle text-sm mt-0.5">Email accounts, CRM, and LinkedIn used for cold outreach</p>
      </div>

      {connected === 'gmail' && (
        <div className="bg-green-50 border border-green-200 text-green-700 rounded-lg px-4 py-3 mb-4 text-sm">
          Gmail connected successfully.
        </div>
      )}
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 rounded-lg px-4 py-3 mb-4 text-sm">
          {errorMessages[error] ?? `Error: ${error}`}
        </div>
      )}

      {/* ── Gmail ─────────────────────────────────────────────────────────── */}
      <section className="mb-10">
        <div className="flex justify-between items-center mb-3">
          <h2 className="text-base font-bold text-foreground">Gmail</h2>
          {!planStatus?.hasMultiInbox && accounts.length >= 1 && (
            <Link href="/pricing" className="px-3 py-1.5 bg-surface-2 text-foreground-muted border border-border rounded-lg text-sm no-underline hover:text-foreground transition-colors">
              🔒 Pro required for 2nd inbox
            </Link>
          )}
        </div>

        <div className="text-xs bg-surface-2 border border-border rounded-xl px-4 py-3.5 mb-4 leading-relaxed text-foreground-muted">
          <strong className="text-foreground">Get your App Password:</strong>
          <ol className="mt-2 pl-5 list-decimal space-y-1">
            <li>Turn on <a href="https://myaccount.google.com/signinoptions/two-step-verification" target="_blank" rel="noopener noreferrer" className="text-accent hover:underline">2-Step Verification</a> (Google requires it first).</li>
            <li>Open <a href="https://myaccount.google.com/apppasswords" target="_blank" rel="noopener noreferrer" className="text-accent hover:underline">App Passwords</a>, type a name like &quot;Ozigi&quot;, and click Create.</li>
            <li>Copy the 16-character password and paste it below with your Gmail address.</li>
          </ol>
        </div>

        {gmailFormMsg && (
          <div className={`rounded-lg px-4 py-3 mb-4 text-sm border ${gmailFormMsg.type === 'success' ? 'bg-green-50 border-green-200 text-green-700' : 'bg-red-50 border-red-200 text-red-700'}`}>
            {gmailFormMsg.text}
          </div>
        )}

        {(planStatus?.hasMultiInbox || accounts.length === 0) && (
          <form onSubmit={connectGmailAppPassword} className="bg-surface border border-border rounded-xl p-5 flex flex-col gap-3 mb-4">
            <label className={labelCls}>
              <span className={labelTextCls}>Gmail address</span>
              <input type="email" value={gmailAddress} onChange={e => setGmailAddress(e.target.value)} placeholder="you@gmail.com" className={inputCls} />
            </label>
            <label className={labelCls}>
              <span className={labelTextCls}>App Password</span>
              <input type="password" value={gmailAppPass} onChange={e => setGmailAppPass(e.target.value)} placeholder="16-character app password" className={inputCls} />
            </label>
            <label className={labelCls}>
              <span className={labelTextCls}>Display name (from)</span>
              <input value={gmailFrom} onChange={e => setGmailFrom(e.target.value)} placeholder="Dumebi from Ozigi" className={inputCls} />
            </label>
            <button type="submit" disabled={gmailSaving || !gmailAddress || !gmailAppPass} className={primaryBtnCls}>
              {gmailSaving ? 'Testing & saving…' : 'Connect Gmail'}
            </button>
          </form>
        )}

        {gmailLoading && <p className="text-foreground-subtle text-sm">Loading…</p>}
        {!gmailLoading && accounts.length === 0 && (
          <div className="border border-dashed border-border rounded-xl p-8 text-center text-foreground-subtle text-sm">
            No email accounts connected yet.
          </div>
        )}
        {accounts.map(a => (
          <div key={a.id} className={`${cardCls} flex justify-between items-center`}>
            <div>
              <div className="font-semibold text-foreground text-sm">{a.email_address}</div>
              <div className="text-xs text-foreground-subtle mt-0.5">
                {a.provider === 'smtp'
                  ? <>{a.smtp_host === 'smtp.gmail.com' ? 'Gmail (App Password)' : `SMTP${a.smtp_host ? ` · ${a.smtp_host}` : ''}`} · Sent today: {a.daily_send_count}</>
                  : <>{a.is_active ? '● Active' : '○ Inactive'} · Sent today: {a.daily_send_count}</>
                }
              </div>
            </div>
            <button onClick={() => disconnectGmail(a.id, a.email_address)} className={dangerBtnCls}>
              Disconnect
            </button>
          </div>
        ))}
      </section>

      {/* ── SMTP (non-Google) ────────────────────────────────────────────── */}
      <section className="mb-10">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-base font-bold text-foreground">Other email (SMTP)</h2>
          <button onClick={() => setShowSmtp(v => !v)} className="px-3 py-1.5 bg-surface border border-border rounded-lg text-sm text-foreground-muted hover:text-foreground hover:border-border-strong transition-colors">
            {showSmtp ? 'Cancel' : '+ Connect SMTP'}
          </button>
        </div>

        {smtpMsg && (
          <div className={`rounded-lg px-4 py-3 mb-4 text-sm border ${smtpMsg.type === 'success' ? 'bg-green-50 border-green-200 text-green-700' : 'bg-red-50 border-red-200 text-red-700'}`}>
            {smtpMsg.text}
          </div>
        )}

        <div className="text-xs text-foreground-muted mb-3 leading-relaxed">
          Use this for Yahoo, Outlook, Microsoft 365, custom domains, or transactional providers (SendGrid, Mailgun). Your password is encrypted at rest.
        </div>

        {showSmtp && (
          <form onSubmit={saveSmtpAccount} className="bg-surface border border-border rounded-xl p-5 flex flex-col gap-3">
            {/* Preset picker */}
            <div className="flex gap-1.5 flex-wrap">
              {Object.entries({ outlook: 'Outlook', yahoo: 'Yahoo', zohomail: 'Zoho Mail', fastmail: 'Fastmail', sendgrid: 'SendGrid', custom: 'Custom' }).map(([k, label]) => (
                <button key={k} type="button" onClick={() => applyPreset(k)}
                  className={`px-2.5 py-1 rounded-lg border text-xs font-semibold transition-colors ${smtpPreset === k ? 'bg-accent border-accent text-white' : 'bg-bg border-border text-foreground-muted hover:text-foreground'}`}>
                  {label}
                </button>
              ))}
            </div>

            <div className="flex gap-3">
              <label className={`${labelCls} flex-[2]`}>
                <span className={labelTextCls}>SMTP host</span>
                <input value={smtpHost} onChange={e => setSmtpHost(e.target.value)} placeholder="smtp.office365.com" className={inputCls} />
              </label>
              <label className={`${labelCls} flex-[0.6]`}>
                <span className={labelTextCls}>Port</span>
                <input type="number" value={smtpPort} onChange={e => setSmtpPort(Number(e.target.value))} className={inputCls} />
              </label>
            </div>

            <label className={labelCls}>
              <span className={labelTextCls}>Email / username</span>
              <input type="email" value={smtpUser} onChange={e => setSmtpUser(e.target.value)} placeholder="you@yourcompany.com" className={inputCls} />
            </label>

            <label className={labelCls}>
              <span className={labelTextCls}>Password / app password</span>
              <input type="password" value={smtpPass} onChange={e => setSmtpPass(e.target.value)} placeholder="••••••••" className={inputCls} />
            </label>

            <label className={labelCls}>
              <span className={labelTextCls}>Display name (from)</span>
              <input value={smtpFrom} onChange={e => setSmtpFrom(e.target.value)} placeholder="Dumebi from Ozigi" className={inputCls} />
            </label>

            <button type="submit" disabled={smtpSaving || !smtpHost || !smtpUser || !smtpPass} className={primaryBtnCls}>
              {smtpSaving ? 'Testing & saving…' : 'Connect'}
            </button>
          </form>
        )}
      </section>

      {/* ── CRM ──────────────────────────────────────────────────────────── */}
      <section className="mb-10">
        <h2 className="text-base font-bold text-foreground mb-1">CRM</h2>
        <p className="text-xs text-foreground-muted mb-4 leading-relaxed">
          Connect your CRM via OAuth, or paste an API key for CRMs that don&apos;t support it. Leads are synced automatically when first contacted.
        </p>

        {crmMsg && (
          <div className={`rounded-lg px-4 py-3 mb-4 text-sm border ${crmMsg.type === 'success' ? 'bg-green-50 border-green-200 text-green-700' : 'bg-red-50 border-red-200 text-red-700'}`}>
            {crmMsg.text}
          </div>
        )}

        {/* Connected CRMs */}
        {crmConnections.map(c => (
          <div key={c.id} className={`${cardCls} flex justify-between items-center`}>
            <div>
              <div className="font-semibold text-foreground text-sm">
                {CRM_LABELS[c.provider] ?? c.provider}
              </div>
              <div className="text-xs text-foreground-subtle mt-0.5">
                {c.is_active ? '● Connected via OAuth' : '○ Inactive'}
              </div>
            </div>
            <button onClick={() => disconnectCrm(c.id, c.provider)} className={dangerBtnCls}>
              Disconnect
            </button>
          </div>
        ))}

        {/* OAuth connect buttons — only CRMs with Composio Managed credentials */}
        {!planStatus?.hasCrmSync && (
          <div className="bg-surface-2 border border-border rounded-xl p-4 mb-4 text-sm text-foreground-muted">
            🔒 CRM sync is available on <Link href="/pricing" className="text-accent font-semibold no-underline hover:underline">Growth and Pro plans</Link>.
          </div>
        )}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {[
            { provider: 'hubspot',    label: 'HubSpot',    color: '#ff7a59' },
            { provider: 'zoho',       label: 'Zoho CRM',   color: '#e42527' },
            { provider: 'salesforce', label: 'Salesforce', color: '#00a1e0' },
          ].map(({ provider, label, color }) => {
            const already = crmConnections.some(c => c.provider === provider && c.is_active)
            const busy = crmConnecting === provider
            const locked = !planStatus?.hasCrmSync
            return (
              <button
                key={provider}
                onClick={() => locked ? void 0 : !already && connectCrmOAuth(provider)}
                disabled={already || busy || locked}
                className={[
                  'flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl border text-sm font-semibold transition-all',
                  already
                    ? 'border-green-300 bg-green-50 text-green-700 cursor-default'
                    : locked
                    ? 'border-border bg-surface-2 text-foreground-subtle cursor-default'
                    : 'border-border bg-surface text-foreground hover:border-border-strong',
                  busy ? 'opacity-70 cursor-wait' : '',
                ].join(' ')}
              >
                <span className="w-2 h-2 rounded-full shrink-0" style={{ background: already ? '#22c55e' : locked ? '#cbd5e1' : color }} />
                {busy ? 'Redirecting…' : already ? `${label} ✓` : locked ? `🔒 ${label}` : `Connect ${label}`}
              </button>
            )
          })}
        </div>

        {/* Swipe One — no OAuth support, manual API key */}
        {!crmConnections.some(c => c.provider === 'swipeone' && c.is_active) && (
          <div className="mt-3">
            <button
              type="button"
              onClick={() => planStatus?.hasCrmSync && setShowSwipeone(v => !v)}
              disabled={!planStatus?.hasCrmSync}
              className="px-3 py-1.5 bg-surface border border-border rounded-lg text-sm text-foreground-muted hover:text-foreground hover:border-border-strong transition-colors disabled:opacity-50 disabled:cursor-default"
            >
              {showSwipeone ? 'Cancel' : '+ Connect Swipe One'}
            </button>

            {showSwipeone && (
              <form onSubmit={connectSwipeOne} className="bg-surface border border-border rounded-xl p-5 mt-3 flex flex-col gap-3">
                <div className="text-xs text-foreground-muted leading-relaxed">
                  Swipe One doesn&apos;t support OAuth — paste your API key from Swipe One → Settings → API.
                </div>
                <label className={labelCls}>
                  <span className={labelTextCls}>API key</span>
                  <input
                    type="password"
                    value={swipeoneApiKey}
                    onChange={e => setSwipeoneApiKey(e.target.value)}
                    placeholder="Paste your Swipe One API key"
                    className={inputCls}
                  />
                </label>
                <button type="submit" disabled={swipeoneSaving || !swipeoneApiKey} className={primaryBtnCls}>
                  {swipeoneSaving ? 'Testing & saving…' : 'Connect'}
                </button>
              </form>
            )}
          </div>
        )}
      </section>

      {/* ── LinkedIn ──────────────────────────────────────────────────────── */}
      <section className="mb-10">
        <h2 className="text-base font-bold text-foreground mb-4">LinkedIn</h2>

        {liMsg && (
          <div className="bg-sky-50 border border-sky-200 text-sky-800 rounded-lg px-4 py-3 mb-4 text-sm">
            {liMsg}
          </div>
        )}

        {/* Existing sessions */}
        {liSessions.map(s => (
          <div key={s.id} className={cardCls}>
            <div className="flex justify-between items-center">
              <div>
                <div className="font-semibold text-foreground text-sm">{s.linkedin_email}</div>
                <div className="text-xs text-foreground-muted mt-0.5">
                  {STATUS_LABEL[s.status] ?? s.status}
                </div>
                {s.login_error && s.login_error !== '__push_notification__' && (
                  <div className="text-xs text-red-600 mt-1">
                    ✗ {friendlyLoginError(s.login_error)}
                  </div>
                )}
              </div>
              <button onClick={() => disconnectLinkedIn(s.id)} className={dangerBtnCls}>
                {s.status === 'active' ? 'Disconnect' : 'Remove'}
              </button>
            </div>
          </div>
        ))}

        {/* 2FA prompt — shown when worker is waiting for verification */}
        {pendingTwoFa && (() => {
          const isPush = pendingTwoFa.login_error === '__push_notification__'
          return (
            <div className="border-2 border-amber-300 bg-amber-50 rounded-xl p-5 mb-4">
              {isPush ? (
                <>
                  <div className="font-bold text-amber-900 mb-2">📱 Approve the sign-in on your LinkedIn app</div>
                  <div className="text-sm text-amber-900/80 leading-relaxed">
                    LinkedIn sent a push notification to your phone. Open your <strong>LinkedIn app</strong> and tap <strong>Yes</strong> to approve the sign-in.
                    This page will update automatically once approved.
                  </div>
                  <div className="mt-3 text-xs text-amber-800/70">
                    No notification? Try the code method instead — disconnect and reconnect, then use a verification code sent to your email.
                  </div>
                </>
              ) : (
                <>
                  <div className="font-bold text-amber-900 mb-2">🔐 LinkedIn sent you a verification code</div>
                  <div className="text-sm text-amber-900/80 mb-4 leading-relaxed">
                    Check your email or phone for a code from LinkedIn. Enter it below — you have 5 minutes.
                  </div>
                  <form onSubmit={submitTwoFa} className="flex gap-2">
                    <input
                      value={twoFaCode}
                      onChange={e => setTwoFaCode(e.target.value)}
                      placeholder="Enter verification code"
                      className="flex-1 px-3 py-2 bg-white border border-amber-300 rounded-lg text-base tracking-widest text-slate-900 outline-none focus:border-amber-500"
                      autoFocus
                    />
                    <button
                      type="submit"
                      disabled={twoFaSubmitting || !twoFaCode}
                      className="px-4 py-2 bg-accent hover:bg-accent/90 text-white text-sm font-bold rounded-lg transition-colors disabled:opacity-50"
                    >
                      {twoFaSubmitting ? 'Submitting…' : 'Submit'}
                    </button>
                  </form>
                </>
              )}
            </div>
          )
        })()}

        {/* Connect form — shown if no active session */}
        {!activeSession && !pendingTwoFa && liSessions.every(s => s.status !== 'logging_in') && (
          <div className="bg-surface border border-border rounded-xl p-5">
            <div className="font-semibold text-foreground text-sm mb-2">Connect a LinkedIn account</div>
            <div className="text-xs text-foreground-muted mb-4 leading-relaxed">
              We log into LinkedIn on your behalf using your credentials. Your password is encrypted at rest and never shared.
            </div>
            <form onSubmit={connectLinkedIn} className="flex flex-col gap-3">
              <input
                type="email"
                value={liEmail}
                onChange={e => setLiEmail(e.target.value)}
                placeholder="LinkedIn email"
                className={inputCls}
              />
              <input
                type="password"
                value={liPassword}
                onChange={e => setLiPassword(e.target.value)}
                placeholder="LinkedIn password"
                className={inputCls}
              />
              <button
                type="submit"
                disabled={liConnecting || !liEmail || !liPassword}
                className="px-4 py-2 bg-[#0a66c2] hover:bg-[#004182] text-white text-sm font-bold rounded-lg transition-colors disabled:opacity-50 self-start"
              >
                {liConnecting ? 'Connecting…' : 'Connect LinkedIn'}
              </button>
            </form>
          </div>
        )}
      </section>
      </div>
    </div>
  )
}

const errorMessages: Record<string, string> = {
  gmail_denied: 'You declined the Gmail permission. Try connecting again.',
  gmail_invalid: 'Invalid OAuth response from Google.',
  gmail_expired: 'OAuth session expired. Please try again.',
  gmail_csrf: 'Security check failed. Please try again.',
  gmail_no_refresh_token: 'Google did not return a refresh token. Revoke Ozigi\'s access in your Google account and try again.',
  gmail_failed: 'Something went wrong connecting Gmail. Please try again.',
}

export default function SettingsPage() {
  return (
    <Suspense fallback={<div className="p-8 text-foreground-subtle text-sm">Loading…</div>}>
      <SettingsContent />
    </Suspense>
  )
}
