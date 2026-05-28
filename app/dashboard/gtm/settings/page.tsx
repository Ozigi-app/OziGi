'use client'
import { useEffect, useRef, useState, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import Link from 'next/link'

interface EmailAccount {
  id: string
  email_address: string
  display_name: string | null
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

function SettingsContent() {
  const searchParams = useSearchParams()

  // ── Gmail state ─────────────────────────────────────────────────────────────
  const [accounts, setAccounts] = useState<EmailAccount[]>([])
  const [gmailLoading, setGmailLoading] = useState(true)

  // ── LinkedIn state ───────────────────────────────────────────────────────────
  const [liSessions, setLiSessions] = useState<LinkedInSession[]>([])
  const [liEmail, setLiEmail] = useState('')
  const [liPassword, setLiPassword] = useState('')
  const [liConnecting, setLiConnecting] = useState(false)
  const [twoFaCode, setTwoFaCode] = useState('')
  const [twoFaSubmitting, setTwoFaSubmitting] = useState(false)
  const [liMsg, setLiMsg] = useState('')

  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const connected = searchParams.get('connected')
  const error = searchParams.get('error')

  // ── Load Gmail accounts ──────────────────────────────────────────────────────
  useEffect(() => {
    fetch('/api/gtm/gmail/accounts')
      .then(r => r.json())
      .then(d => { setAccounts(d.accounts ?? []); setGmailLoading(false) })
  }, [])

  // ── Load + poll LinkedIn sessions ────────────────────────────────────────────
  function loadLinkedIn() {
    return fetch('/api/gtm/linkedin/status')
      .then(r => r.json())
      .then(d => setLiSessions(d.sessions ?? []))
  }

  useEffect(() => {
    loadLinkedIn()
  }, [])

  // Poll every 5s when a login is in progress or pending 2FA
  useEffect(() => {
    const needsPoll = liSessions.some(s => s.status === 'logging_in' || s.status === 'pending_2fa')
    if (needsPoll && !pollRef.current) {
      pollRef.current = setInterval(loadLinkedIn, 5000)
    }
    if (!needsPoll && pollRef.current) {
      clearInterval(pollRef.current)
      pollRef.current = null
    }
    return () => {
      if (pollRef.current) clearInterval(pollRef.current)
    }
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
    } else {
      setLiMsg(`Error: ${d.error}`)
    }
    setLiConnecting(false)
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
    setLiMsg(d.message ?? d.error)
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
    <div style={{ padding: '2rem', fontFamily: 'monospace', maxWidth: 680 }}>
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
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
          <h2 style={{ fontWeight: 700 }}>Gmail</h2>
          <a href="/api/gtm/gmail/connect" style={{ padding: '0.4rem 0.9rem', background: '#111', color: '#fff', borderRadius: 6, textDecoration: 'none', fontSize: '0.9rem' }}>
            + Connect Gmail
          </a>
        </div>
        {gmailLoading && <p style={{ color: '#888' }}>Loading…</p>}
        {!gmailLoading && accounts.length === 0 && (
          <div style={{ border: '1px dashed #ccc', borderRadius: 8, padding: '2rem', textAlign: 'center', color: '#666', fontSize: '0.9rem' }}>
            No Gmail account connected yet.
          </div>
        )}
        {accounts.map(a => (
          <div key={a.id} style={{ border: '1px solid #eee', borderRadius: 8, padding: '1rem 1.25rem', marginBottom: '0.75rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <div style={{ fontWeight: 600 }}>{a.email_address}</div>
              <div style={{ fontSize: '0.8rem', color: '#888', marginTop: '0.2rem' }}>
                {a.is_active ? '● Active' : '○ Inactive'} · Sent today: {a.daily_send_count}
              </div>
            </div>
            <button onClick={() => disconnectGmail(a.id, a.email_address)} style={{ padding: '0.3rem 0.7rem', border: '1px solid #fca5a5', borderRadius: 5, background: 'white', color: '#dc2626', cursor: 'pointer', fontSize: '0.85rem' }}>
              Disconnect
            </button>
          </div>
        ))}
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
                {s.login_error && (
                  <div style={{ fontSize: '0.8rem', color: '#dc2626', marginTop: '0.25rem' }}>
                    ✗ {s.login_error}
                  </div>
                )}
              </div>
              {s.status === 'logging_in' && (
                <span style={{ fontSize: '0.8rem', color: '#888' }}>This may take up to a minute…</span>
              )}
            </div>
          </div>
        ))}

        {/* 2FA prompt — shown when worker is waiting for a code */}
        {pendingTwoFa && (
          <div style={{ border: '2px solid #fbbf24', borderRadius: 8, padding: '1.25rem', marginBottom: '1rem', background: '#fffbeb' }}>
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
          </div>
        )}

        {/* Connect form — shown if no active session */}
        {!activeSession && !pendingTwoFa && liSessions.every(s => s.status !== 'logging_in') && (
          <div style={{ border: '1px solid #eee', borderRadius: 8, padding: '1.25rem' }}>
            <div style={{ fontWeight: 600, marginBottom: '0.25rem' }}>Connect a LinkedIn account</div>
            <div style={{ fontSize: '0.82rem', color: '#666', marginBottom: '1rem', lineHeight: 1.6 }}>
              We log into LinkedIn on your behalf to send connection requests and messages.
              Your credentials are encrypted at rest and never shared.
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
    <Suspense fallback={<div style={{ padding: '2rem', fontFamily: 'monospace' }}>Loading…</div>}>
      <SettingsContent />
    </Suspense>
  )
}
