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

  return (
    <div style={{ padding: '2rem', maxWidth: 680 }}>
      <div style={{ marginBottom: '1.5rem' }}>
        <Link href="/dashboard/gtm/new" style={{ color: '#666', textDecoration: 'none', fontSize: '0.9rem' }}>← Back to Outreach</Link>
        <h1 style={{ fontSize: '1.4rem', fontWeight: 700, marginTop: '0.5rem' }}>Outreach Settings</h1>
      </div>

      {connected === 'gmail' && (
        <div style={{ background: '#dcfce7', border: '1px solid #86efac', borderRadius: 6, padding: '0.75rem 1rem', marginBottom: '1rem', fontSize: '0.9rem', color: '#166534' }}>
          Gmail connected successfully.
        </div>
      )}
      {error && (
        <div style={{ background: '#fee2e2', border: '1px solid #fca5a5', borderRadius: 6, padding: '0.75rem 1rem', marginBottom: '1rem', fontSize: '0.9rem', color: '#991b1b' }}>
          {errorMessages[error] ?? `Error: ${error}`}
        </div>
      )}

      {/* ── Gmail ─────────────────────────────────────────────────────────── */}
      <section style={{ marginBottom: '2.5rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
          <h2 style={{ fontWeight: 700 }}>Gmail</h2>
          {!planStatus?.hasMultiInbox && accounts.length >= 1 && (
            <Link href="/pricing" style={{ padding: '0.4rem 0.9rem', background: '#f1f5f9', color: '#475569', borderRadius: 6, textDecoration: 'none', fontSize: '0.9rem', border: '1px solid #e2e8f0' }}>
              🔒 Pro required for 2nd inbox
            </Link>
          )}
        </div>

        <div style={{ fontSize: '0.82rem', background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: 8, padding: '0.85rem 1rem', marginBottom: '1rem', lineHeight: 1.6, color: '#1e3a8a' }}>
          <strong>Get your App Password:</strong>
          <ol style={{ margin: '0.5rem 0 0', paddingLeft: '1.2rem' }}>
            <li>Turn on <a href="https://myaccount.google.com/signinoptions/two-step-verification" target="_blank" rel="noopener noreferrer" style={{ color: '#1e40af' }}>2-Step Verification</a> (Google requires it first).</li>
            <li>Open <a href="https://myaccount.google.com/apppasswords" target="_blank" rel="noopener noreferrer" style={{ color: '#1e40af' }}>App Passwords</a>, type a name like &quot;Ozigi&quot;, and click Create.</li>
            <li>Copy the 16-character password and paste it below with your Gmail address.</li>
          </ol>
        </div>

        {gmailFormMsg && (
          <div style={{ background: gmailFormMsg.type === 'success' ? '#dcfce7' : '#fee2e2', border: `1px solid ${gmailFormMsg.type === 'success' ? '#86efac' : '#fca5a5'}`, borderRadius: 6, padding: '0.75rem 1rem', marginBottom: '1rem', fontSize: '0.9rem', color: gmailFormMsg.type === 'success' ? '#166534' : '#991b1b' }}>
            {gmailFormMsg.text}
          </div>
        )}

        {(planStatus?.hasMultiInbox || accounts.length === 0) && (
          <form onSubmit={connectGmailAppPassword} style={{ border: '1px solid #eee', borderRadius: 8, padding: '1.25rem', display: 'flex', flexDirection: 'column', gap: '0.75rem', marginBottom: '1rem' }}>
            <label style={{ display: 'flex', flexDirection: 'column', gap: '0.3rem' }}>
              <span style={{ fontSize: '0.85rem', fontWeight: 600 }}>Gmail address</span>
              <input type="email" value={gmailAddress} onChange={e => setGmailAddress(e.target.value)} placeholder="you@gmail.com"
                style={{ padding: '0.45rem 0.7rem', border: '1px solid #ccc', borderRadius: 5, fontSize: '0.9rem' }} />
            </label>
            <label style={{ display: 'flex', flexDirection: 'column', gap: '0.3rem' }}>
              <span style={{ fontSize: '0.85rem', fontWeight: 600 }}>App Password</span>
              <input type="password" value={gmailAppPass} onChange={e => setGmailAppPass(e.target.value)} placeholder="16-character app password"
                style={{ padding: '0.45rem 0.7rem', border: '1px solid #ccc', borderRadius: 5, fontSize: '0.9rem' }} />
            </label>
            <label style={{ display: 'flex', flexDirection: 'column', gap: '0.3rem' }}>
              <span style={{ fontSize: '0.85rem', fontWeight: 600 }}>Display name (from)</span>
              <input value={gmailFrom} onChange={e => setGmailFrom(e.target.value)} placeholder="Dumebi from Ozigi"
                style={{ padding: '0.45rem 0.7rem', border: '1px solid #ccc', borderRadius: 5, fontSize: '0.9rem' }} />
            </label>
            <button type="submit" disabled={gmailSaving || !gmailAddress || !gmailAppPass}
              style={{ padding: '0.55rem 1.25rem', background: gmailSaving ? '#999' : '#111', color: '#fff', border: 'none', borderRadius: 5, cursor: 'pointer', fontSize: '0.95rem', alignSelf: 'flex-start' }}>
              {gmailSaving ? 'Testing & saving…' : 'Connect Gmail'}
            </button>
          </form>
        )}

        {gmailLoading && <p style={{ color: '#888' }}>Loading…</p>}
        {!gmailLoading && accounts.length === 0 && (
          <div style={{ border: '1px dashed #ccc', borderRadius: 8, padding: '2rem', textAlign: 'center', color: '#666', fontSize: '0.9rem' }}>
            No email accounts connected yet.
          </div>
        )}
        {accounts.map(a => (
          <div key={a.id} style={{ border: '1px solid #eee', borderRadius: 8, padding: '1rem 1.25rem', marginBottom: '0.75rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <div style={{ fontWeight: 600 }}>{a.email_address}</div>
              <div style={{ fontSize: '0.8rem', color: '#888', marginTop: '0.2rem' }}>
                {a.provider === 'smtp'
                  ? <>{a.smtp_host === 'smtp.gmail.com' ? 'Gmail (App Password)' : `SMTP${a.smtp_host ? ` · ${a.smtp_host}` : ''}`} · Sent today: {a.daily_send_count}</>
                  : <>{a.is_active ? '● Active' : '○ Inactive'} · Sent today: {a.daily_send_count}</>
                }
              </div>
            </div>
            <button onClick={() => disconnectGmail(a.id, a.email_address)} style={{ padding: '0.3rem 0.7rem', border: '1px solid #fca5a5', borderRadius: 5, background: 'white', color: '#dc2626', cursor: 'pointer', fontSize: '0.85rem' }}>
              Disconnect
            </button>
          </div>
        ))}
      </section>

      {/* ── SMTP (non-Google) ────────────────────────────────────────────── */}
      <section style={{ marginBottom: '2.5rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
          <h2 style={{ fontWeight: 700 }}>Other email (SMTP)</h2>
          <button onClick={() => setShowSmtp(v => !v)} style={{ padding: '0.4rem 0.9rem', background: 'white', border: '1px solid #ccc', borderRadius: 6, cursor: 'pointer', fontSize: '0.9rem' }}>
            {showSmtp ? 'Cancel' : '+ Connect SMTP'}
          </button>
        </div>

        {smtpMsg && (
          <div style={{ background: smtpMsg.type === 'success' ? '#dcfce7' : '#fee2e2', border: `1px solid ${smtpMsg.type === 'success' ? '#86efac' : '#fca5a5'}`, borderRadius: 6, padding: '0.75rem 1rem', marginBottom: '1rem', fontSize: '0.9rem', color: smtpMsg.type === 'success' ? '#166534' : '#991b1b' }}>
            {smtpMsg.text}
          </div>
        )}

        <div style={{ fontSize: '0.82rem', color: '#555', marginBottom: '0.75rem', lineHeight: 1.6 }}>
          Use this for Yahoo, Outlook, Microsoft 365, custom domains, or transactional providers (SendGrid, Mailgun). Your password is encrypted at rest.
        </div>

        {showSmtp && (
          <form onSubmit={saveSmtpAccount} style={{ border: '1px solid #eee', borderRadius: 8, padding: '1.25rem', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            {/* Preset picker */}
            <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap' as const }}>
              {Object.entries({ outlook: 'Outlook', yahoo: 'Yahoo', zohomail: 'Zoho Mail', fastmail: 'Fastmail', sendgrid: 'SendGrid', custom: 'Custom' }).map(([k, label]) => (
                <button key={k} type="button" onClick={() => applyPreset(k)}
                  style={{ padding: '0.3rem 0.7rem', borderRadius: 5, border: '1px solid #ccc', background: smtpPreset === k ? '#111' : 'white', color: smtpPreset === k ? '#fff' : '#333', cursor: 'pointer', fontSize: '0.82rem' }}>
                  {label}
                </button>
              ))}
            </div>

            <div style={{ display: 'flex', gap: '0.75rem' }}>
              <label style={{ display: 'flex', flexDirection: 'column', gap: '0.3rem', flex: 2 }}>
                <span style={{ fontSize: '0.85rem', fontWeight: 600 }}>SMTP host</span>
                <input value={smtpHost} onChange={e => setSmtpHost(e.target.value)} placeholder="smtp.office365.com"
                  style={{ padding: '0.45rem 0.7rem', border: '1px solid #ccc', borderRadius: 5, fontSize: '0.9rem' }} />
              </label>
              <label style={{ display: 'flex', flexDirection: 'column', gap: '0.3rem', flex: 0.6 }}>
                <span style={{ fontSize: '0.85rem', fontWeight: 600 }}>Port</span>
                <input type="number" value={smtpPort} onChange={e => setSmtpPort(Number(e.target.value))}
                  style={{ padding: '0.45rem 0.7rem', border: '1px solid #ccc', borderRadius: 5, fontSize: '0.9rem' }} />
              </label>
            </div>

            <label style={{ display: 'flex', flexDirection: 'column', gap: '0.3rem' }}>
              <span style={{ fontSize: '0.85rem', fontWeight: 600 }}>Email / username</span>
              <input type="email" value={smtpUser} onChange={e => setSmtpUser(e.target.value)} placeholder="you@yourcompany.com"
                style={{ padding: '0.45rem 0.7rem', border: '1px solid #ccc', borderRadius: 5, fontSize: '0.9rem' }} />
            </label>

            <label style={{ display: 'flex', flexDirection: 'column', gap: '0.3rem' }}>
              <span style={{ fontSize: '0.85rem', fontWeight: 600 }}>Password / app password</span>
              <input type="password" value={smtpPass} onChange={e => setSmtpPass(e.target.value)} placeholder="••••••••"
                style={{ padding: '0.45rem 0.7rem', border: '1px solid #ccc', borderRadius: 5, fontSize: '0.9rem' }} />
            </label>

            <label style={{ display: 'flex', flexDirection: 'column', gap: '0.3rem' }}>
              <span style={{ fontSize: '0.85rem', fontWeight: 600 }}>Display name (from)</span>
              <input value={smtpFrom} onChange={e => setSmtpFrom(e.target.value)} placeholder="Dumebi from Ozigi"
                style={{ padding: '0.45rem 0.7rem', border: '1px solid #ccc', borderRadius: 5, fontSize: '0.9rem' }} />
            </label>

            <button type="submit" disabled={smtpSaving || !smtpHost || !smtpUser || !smtpPass}
              style={{ padding: '0.55rem 1.25rem', background: smtpSaving ? '#999' : '#111', color: '#fff', border: 'none', borderRadius: 5, cursor: 'pointer', fontSize: '0.95rem', alignSelf: 'flex-start' }}>
              {smtpSaving ? 'Testing & saving…' : 'Connect'}
            </button>
          </form>
        )}
      </section>

      {/* ── CRM ──────────────────────────────────────────────────────────── */}
      <section style={{ marginBottom: '2.5rem' }}>
        <h2 style={{ fontWeight: 700, marginBottom: '0.35rem' }}>CRM</h2>
        <p style={{ fontSize: '0.82rem', color: '#666', marginBottom: '1rem', lineHeight: 1.6 }}>
          Connect your CRM via OAuth, or paste an API key for CRMs that don&apos;t support it. Leads are synced automatically when first contacted.
        </p>

        {crmMsg && (
          <div style={{ background: crmMsg.type === 'success' ? '#dcfce7' : '#fee2e2', border: `1px solid ${crmMsg.type === 'success' ? '#86efac' : '#fca5a5'}`, borderRadius: 6, padding: '0.75rem 1rem', marginBottom: '1rem', fontSize: '0.9rem', color: crmMsg.type === 'success' ? '#166534' : '#991b1b' }}>
            {crmMsg.text}
          </div>
        )}

        {/* Connected CRMs */}
        {crmConnections.map(c => (
          <div key={c.id} style={{ border: '1px solid #eee', borderRadius: 8, padding: '1rem 1.25rem', marginBottom: '0.75rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <div style={{ fontWeight: 600 }}>
                {CRM_LABELS[c.provider] ?? c.provider}
              </div>
              <div style={{ fontSize: '0.8rem', color: '#888', marginTop: '0.2rem' }}>
                {c.is_active ? '● Connected via OAuth' : '○ Inactive'}
              </div>
            </div>
            <button onClick={() => disconnectCrm(c.id, c.provider)} style={{ padding: '0.3rem 0.7rem', border: '1px solid #fca5a5', borderRadius: 5, background: 'white', color: '#dc2626', cursor: 'pointer', fontSize: '0.85rem' }}>
              Disconnect
            </button>
          </div>
        ))}

        {/* OAuth connect buttons — only CRMs with Composio Managed credentials */}
        {!planStatus?.hasCrmSync && (
          <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 8, padding: '1rem', marginBottom: '1rem', fontSize: '0.85rem', color: '#475569' }}>
            🔒 CRM sync is available on <Link href="/pricing" style={{ color: '#e8320a', fontWeight: 600 }}>Growth and Pro plans</Link>.
          </div>
        )}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
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
                style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem',
                  padding: '0.65rem 1rem',
                  border: `1px solid ${already ? '#86efac' : locked ? '#e2e8f0' : '#e5e7eb'}`,
                  borderRadius: 8,
                  background: already ? '#f0fdf4' : locked ? '#f8fafc' : 'white',
                  color: already ? '#166534' : locked ? '#94a3b8' : '#111',
                  cursor: already || locked ? 'default' : busy ? 'wait' : 'pointer',
                  fontSize: '0.9rem', fontWeight: 600,
                  opacity: busy ? 0.7 : 1,
                  transition: 'all 0.15s',
                }}
              >
                <span style={{ width: 8, height: 8, borderRadius: '50%', background: already ? '#22c55e' : locked ? '#cbd5e1' : color, flexShrink: 0 }} />
                {busy ? 'Redirecting…' : already ? `${label} ✓` : locked ? `🔒 ${label}` : `Connect ${label}`}
              </button>
            )
          })}
        </div>

        {/* Swipe One — no OAuth support, manual API key */}
        {!crmConnections.some(c => c.provider === 'swipeone' && c.is_active) && (
          <div style={{ marginTop: '0.75rem' }}>
            <button
              type="button"
              onClick={() => planStatus?.hasCrmSync && setShowSwipeone(v => !v)}
              disabled={!planStatus?.hasCrmSync}
              style={{ padding: '0.4rem 0.9rem', background: 'white', border: '1px solid #ccc', borderRadius: 6, cursor: planStatus?.hasCrmSync ? 'pointer' : 'default', fontSize: '0.9rem', opacity: planStatus?.hasCrmSync ? 1 : 0.5 }}
            >
              {showSwipeone ? 'Cancel' : '+ Connect Swipe One'}
            </button>

            {showSwipeone && (
              <form onSubmit={connectSwipeOne} style={{ border: '1px solid #eee', borderRadius: 8, padding: '1.25rem', marginTop: '0.75rem', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                <div style={{ fontSize: '0.82rem', color: '#666', lineHeight: 1.6 }}>
                  Swipe One doesn&apos;t support OAuth — paste your API key from Swipe One → Settings → API.
                </div>
                <label style={{ display: 'flex', flexDirection: 'column', gap: '0.3rem' }}>
                  <span style={{ fontSize: '0.85rem', fontWeight: 600 }}>API key</span>
                  <input
                    type="password"
                    value={swipeoneApiKey}
                    onChange={e => setSwipeoneApiKey(e.target.value)}
                    placeholder="Paste your Swipe One API key"
                    style={{ padding: '0.45rem 0.7rem', border: '1px solid #ccc', borderRadius: 5, fontSize: '0.9rem' }}
                  />
                </label>
                <button
                  type="submit"
                  disabled={swipeoneSaving || !swipeoneApiKey}
                  style={{ padding: '0.55rem 1.25rem', background: swipeoneSaving ? '#999' : '#111', color: '#fff', border: 'none', borderRadius: 5, cursor: 'pointer', fontSize: '0.95rem', alignSelf: 'flex-start' }}
                >
                  {swipeoneSaving ? 'Testing & saving…' : 'Connect'}
                </button>
              </form>
            )}
          </div>
        )}
      </section>

      {/* ── LinkedIn ──────────────────────────────────────────────────────── */}
      <section style={{ marginBottom: '2.5rem' }}>
        <h2 style={{ fontWeight: 700, marginBottom: '1rem' }}>LinkedIn</h2>

        {liMsg && (
          <div style={{ background: '#f0f9ff', border: '1px solid #bae6fd', borderRadius: 6, padding: '0.75rem 1rem', marginBottom: '1rem', fontSize: '0.9rem', color: '#0369a1' }}>
            {liMsg}
          </div>
        )}

        {/* Existing sessions */}
        {liSessions.map(s => (
          <div key={s.id} style={{ border: '1px solid #eee', borderRadius: 8, padding: '1rem 1.25rem', marginBottom: '0.75rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <div style={{ fontWeight: 600 }}>{s.linkedin_email}</div>
                <div style={{ fontSize: '0.82rem', color: '#666', marginTop: '0.2rem' }}>
                  {STATUS_LABEL[s.status] ?? s.status}
                </div>
                {s.login_error && s.login_error !== '__push_notification__' && (
                  <div style={{ fontSize: '0.8rem', color: '#dc2626', marginTop: '0.25rem' }}>
                    ✗ {friendlyLoginError(s.login_error)}
                  </div>
                )}
              </div>
              <button
                onClick={() => disconnectLinkedIn(s.id)}
                style={{ padding: '0.3rem 0.7rem', border: '1px solid #fca5a5', borderRadius: 5, background: 'white', color: '#dc2626', cursor: 'pointer', fontSize: '0.85rem', flexShrink: 0 }}
              >
                {s.status === 'active' ? 'Disconnect' : 'Remove'}
              </button>
            </div>
          </div>
        ))}

        {/* 2FA prompt — shown when worker is waiting for verification */}
        {pendingTwoFa && (() => {
          const isPush = pendingTwoFa.login_error === '__push_notification__'
          return (
            <div style={{ border: '2px solid #fbbf24', borderRadius: 8, padding: '1.25rem', marginBottom: '1rem', background: '#fffbeb' }}>
              {isPush ? (
                <>
                  <div style={{ fontWeight: 700, marginBottom: '0.5rem' }}>📱 Approve the sign-in on your LinkedIn app</div>
                  <div style={{ fontSize: '0.88rem', color: '#555', lineHeight: 1.6 }}>
                    LinkedIn sent a push notification to your phone. Open your <strong>LinkedIn app</strong> and tap <strong>Yes</strong> to approve the sign-in.
                    This page will update automatically once approved.
                  </div>
                  <div style={{ marginTop: '0.75rem', fontSize: '0.82rem', color: '#888' }}>
                    No notification? Try the code method instead — disconnect and reconnect, then use a verification code sent to your email.
                  </div>
                </>
              ) : (
                <>
                  <div style={{ fontWeight: 700, marginBottom: '0.5rem' }}>🔐 LinkedIn sent you a verification code</div>
                  <div style={{ fontSize: '0.88rem', color: '#555', marginBottom: '1rem', lineHeight: 1.6 }}>
                    Check your email or phone for a code from LinkedIn. Enter it below — you have 5 minutes.
                  </div>
                  <form onSubmit={submitTwoFa} style={{ display: 'flex', gap: '0.5rem' }}>
                    <input
                      value={twoFaCode}
                      onChange={e => setTwoFaCode(e.target.value)}
                      placeholder="Enter verification code"
                      style={{ flex: 1, padding: '0.5rem 0.75rem', border: '1px solid #ccc', borderRadius: 5, fontSize: '1rem', letterSpacing: '0.1em' }}
                      autoFocus
                    />
                    <button
                      type="submit"
                      disabled={twoFaSubmitting || !twoFaCode}
                      style={{ padding: '0.5rem 1rem', background: '#111', color: '#fff', border: 'none', borderRadius: 5, cursor: 'pointer' }}
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
          <div style={{ border: '1px solid #eee', borderRadius: 8, padding: '1.25rem' }}>
            <div style={{ fontWeight: 600, marginBottom: '0.5rem' }}>Connect a LinkedIn account</div>
            <div style={{ fontSize: '0.82rem', color: '#666', marginBottom: '1rem', lineHeight: 1.6 }}>
              We log into LinkedIn on your behalf using your credentials. Your password is encrypted at rest and never shared.
            </div>
            <form onSubmit={connectLinkedIn} style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              <input
                type="email"
                value={liEmail}
                onChange={e => setLiEmail(e.target.value)}
                placeholder="LinkedIn email"
                style={{ padding: '0.5rem 0.75rem', border: '1px solid #ccc', borderRadius: 5, fontSize: '0.95rem' }}
              />
              <input
                type="password"
                value={liPassword}
                onChange={e => setLiPassword(e.target.value)}
                placeholder="LinkedIn password"
                style={{ padding: '0.5rem 0.75rem', border: '1px solid #ccc', borderRadius: 5, fontSize: '0.95rem' }}
              />
              <button
                type="submit"
                disabled={liConnecting || !liEmail || !liPassword}
                style={{ padding: '0.55rem 1.25rem', background: liConnecting ? '#999' : '#0a66c2', color: '#fff', border: 'none', borderRadius: 5, cursor: 'pointer', fontSize: '0.95rem', alignSelf: 'flex-start' }}
              >
                {liConnecting ? 'Connecting…' : 'Connect LinkedIn'}
              </button>
            </form>
          </div>
        )}
      </section>
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
    <Suspense fallback={<div style={{ padding: '2rem' }}>Loading…</div>}>
      <SettingsContent />
    </Suspense>
  )
}
