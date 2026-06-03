'use client'
import { useEffect, useRef, useState, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import Link from 'next/link'
import GtmPageHeader from '@/components/gtm/GtmPageHeader'
import { usePlanStatus } from '@/components/hooks/usePlanStatus'

interface CrmConnection {
  id: string
  provider: 'hubspot' | 'zoho'
  zoho_client_id: string | null
  is_active: boolean
  created_at: string
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

  // ── LinkedIn state ───────────────────────────────────────────────────────────
  const [liSessions, setLiSessions] = useState<LinkedInSession[]>([])
  const [liEmail, setLiEmail] = useState('')
  const [liPassword, setLiPassword] = useState('')
  const [liConnecting, setLiConnecting] = useState(false)
  const [twoFaCode, setTwoFaCode] = useState('')
  const [twoFaSubmitting, setTwoFaSubmitting] = useState(false)
  const [liMsg, setLiMsg] = useState('')
  const [liMode, setLiMode] = useState<'password' | 'cookie'>('cookie')
  const [liCookieValue, setLiCookieValue] = useState('')
  const [liCookieEmail, setLiCookieEmail] = useState('')

  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null)

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
    if (!confirm(`Disconnect ${provider === 'hubspot' ? 'HubSpot' : 'Zoho CRM'}?`)) return
    await fetch(`/api/gtm/crm/connections/${id}`, { method: 'DELETE' })
    setCrmConnections(prev => prev.filter(c => c.id !== id))
  }

  // ── Load + poll LinkedIn sessions ────────────────────────────────────────────
  function loadLinkedIn() {
    return fetch('/api/gtm/linkedin/status')
      .then(r => r.json())
      .then(d => setLiSessions(d.sessions ?? []))
  }

  function startPolling() {
    if (!pollRef.current) {
      pollRef.current = setInterval(loadLinkedIn, 3000)
    }
  }

  function stopPolling() {
    if (pollRef.current) {
      clearInterval(pollRef.current)
      pollRef.current = null
    }
  }

  useEffect(() => {
    loadLinkedIn()
  }, [])

  // Stop polling once we reach a terminal state (active or needs_login / expired)
  useEffect(() => {
    const inProgress = liSessions.some(
      s => s.status === 'logging_in' || s.status === 'pending_2fa'
    )
    // If no session is in-progress and polling is running, stop it
    if (!inProgress && pollRef.current) {
      stopPolling()
    }
    return () => stopPolling()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [liSessions])

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
      startPolling()
    } else {
      setLiMsg('Could not start LinkedIn login — please check your credentials and try again.')
    }
    setLiConnecting(false)
  }

  async function connectLinkedInCookie(e: React.FormEvent) {
    e.preventDefault()
    setLiConnecting(true)
    setLiMsg('')
    const res = await fetch('/api/gtm/linkedin/cookie', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ li_at: liCookieValue, linkedin_email: liCookieEmail }),
    })
    const d = await res.json()
    if (res.ok) {
      setLiMsg('LinkedIn connected via session cookie.')
      setLiCookieValue('')
      loadLinkedIn()
    } else {
      setLiMsg(d.error ?? 'Failed to save cookie — please try again.')
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
    stopPolling()
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
        <Link href="/dashboard/gtm" style={{ color: '#666', textDecoration: 'none', fontSize: '0.9rem' }}>← Campaigns</Link>
        <h1 style={{ fontSize: '1.4rem', fontWeight: 700, marginTop: '0.5rem' }}>GTM Settings</h1>
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
          {!planStatus?.hasMultiInbox && accounts.length >= 1 ? (
            <Link href="/pricing" style={{ padding: '0.4rem 0.9rem', background: '#f1f5f9', color: '#475569', borderRadius: 6, textDecoration: 'none', fontSize: '0.9rem', border: '1px solid #e2e8f0' }}>
              🔒 Pro required for 2nd inbox
            </Link>
          ) : (
            <a href="/api/gtm/gmail/connect" style={{ padding: '0.4rem 0.9rem', background: '#111', color: '#fff', borderRadius: 6, textDecoration: 'none', fontSize: '0.9rem' }}>
              + Connect Gmail
            </a>
          )}
        </div>
        <div style={{ fontSize: '0.82rem', background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: 8, padding: '0.85rem 1rem', marginBottom: '1rem', lineHeight: 1.6 }}>
          <div style={{ fontWeight: 700, marginBottom: '0.3rem', color: '#1e40af' }}>📋 Heads up before you connect</div>
          <div style={{ color: '#1e3a8a' }}>
            Ozigi&apos;s Google integration is <strong>pending verification</strong> — we&apos;ve submitted our application and are waiting on Google&apos;s review. When you click <em>Connect Gmail</em>, Google will show an &quot;unverified app&quot; warning screen. <strong>This is expected and safe to proceed past.</strong>
          </div>
          <div style={{ marginTop: '0.5rem', color: '#1e3a8a' }}>
            To continue: click <strong>&quot;Advanced&quot;</strong> on the warning screen, then <strong>&quot;Go to Ozigi (unsafe)&quot;</strong>. Your credentials are encrypted and we only request the permissions shown. We&apos;ll remove this notice once Google approves the app.
          </div>
        </div>
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
                  ? <>SMTP{a.smtp_host ? ` · ${a.smtp_host}` : ''} · Sent today: {a.daily_send_count}</>
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
          Connect your CRM via OAuth — no API keys needed. Leads are synced automatically when first contacted.
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
                {{ hubspot: 'HubSpot', zoho: 'Zoho CRM', salesforce: 'Salesforce', pipedrive: 'Pipedrive' }[c.provider] ?? c.provider}
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
                {s.status === 'active' ? 'Disconnect' : 'Reconnect'}
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
            <div style={{ fontWeight: 600, marginBottom: '0.25rem' }}>Connect a LinkedIn account</div>

            {/* Mode toggle */}
            <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1rem', marginTop: '0.75rem' }}>
              {(['cookie', 'password'] as const).map(mode => (
                <button
                  key={mode}
                  type="button"
                  onClick={() => setLiMode(mode)}
                  style={{
                    padding: '0.3rem 0.8rem', borderRadius: 5, fontSize: '0.82rem', fontWeight: 600, cursor: 'pointer',
                    border: liMode === mode ? '1px solid #0a66c2' : '1px solid #ccc',
                    background: liMode === mode ? '#eff6ff' : 'white',
                    color: liMode === mode ? '#0a66c2' : '#555',
                  }}
                >
                  {mode === 'cookie' ? 'Session cookie (recommended)' : 'Email & password'}
                </button>
              ))}
            </div>

            {liMode === 'cookie' ? (
              <>
                <div style={{ fontSize: '0.82rem', color: '#555', marginBottom: '1rem', lineHeight: 1.7, background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 6, padding: '0.75rem 1rem' }}>
                  <strong>How to get your session cookie:</strong>
                  <ol style={{ margin: '0.4rem 0 0 1.2rem', padding: 0 }}>
                    <li>Open <strong>LinkedIn.com</strong> in your browser and make sure you&apos;re logged in.</li>
                    <li>Press <strong>F12</strong> (or right-click → Inspect) to open DevTools.</li>
                    <li>Go to <strong>Application</strong> → <strong>Cookies</strong> → <strong>https://www.linkedin.com</strong>.</li>
                    <li>Find the cookie named <strong>li_at</strong> and copy its <strong>Value</strong>.</li>
                  </ol>
                </div>
                <form onSubmit={connectLinkedInCookie} style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                  <input
                    type="email"
                    value={liCookieEmail}
                    onChange={e => setLiCookieEmail(e.target.value)}
                    placeholder="Your LinkedIn email address"
                    style={{ padding: '0.5rem 0.75rem', border: '1px solid #ccc', borderRadius: 5, fontSize: '0.95rem' }}
                  />
                  <input
                    type="text"
                    value={liCookieValue}
                    onChange={e => setLiCookieValue(e.target.value)}
                    placeholder="Paste li_at cookie value here"
                    style={{ padding: '0.5rem 0.75rem', border: '1px solid #ccc', borderRadius: 5, fontSize: '0.85rem', fontFamily: 'monospace' }}
                  />
                  <button
                    type="submit"
                    disabled={liConnecting || !liCookieEmail || !liCookieValue}
                    style={{ padding: '0.55rem 1.25rem', background: liConnecting ? '#999' : '#0a66c2', color: '#fff', border: 'none', borderRadius: 5, cursor: 'pointer', fontSize: '0.95rem', alignSelf: 'flex-start' }}
                  >
                    {liConnecting ? 'Saving…' : 'Connect LinkedIn'}
                  </button>
                </form>
              </>
            ) : (
              <>
                <div style={{ fontSize: '0.82rem', color: '#666', marginBottom: '1rem', lineHeight: 1.6 }}>
                  We log into LinkedIn on your behalf using your credentials.
                  Your password is encrypted at rest and never shared.
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
              </>
            )}
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
