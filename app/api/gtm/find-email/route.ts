import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getPlanStatus } from '@/lib/plan'
import { findEmail } from '@/lib/gtm/emailFinder'
import { reportFailure } from '@/lib/monitor'

export const maxDuration = 60

const HOSTNAME_RE = /^(?=.{4,253}$)([a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$/

/** Accept "acme.com", "https://www.acme.com/about", "Acme.com " ... return the bare host. */
function cleanDomain(raw: string): string | null {
  let d = raw.trim().toLowerCase().replace(/^[a-z]+:\/\//, '').split(/[/?#]/)[0].replace(/^www\./, '')
  d = d.replace(/:\d+$/, '')
  return HOSTNAME_RE.test(d) ? d : null
}

export async function POST(req: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const plan = await getPlanStatus(user.id)
  if (!plan.hasGtm) return NextResponse.json({ error: 'GTM access required' }, { status: 403 })

  const body = await req.json().catch(() => ({})) as { firstName?: string; lastName?: string; domain?: string }
  const domain = cleanDomain(body.domain ?? '')
  const firstName = (body.firstName ?? '').trim().slice(0, 60)
  const lastName = (body.lastName ?? '').trim().slice(0, 60)
  if (!domain) return NextResponse.json({ error: 'A valid company domain is required' }, { status: 400 })
  if (!firstName) return NextResponse.json({ error: 'firstName is required' }, { status: 400 })

  try {
    return NextResponse.json(await findEmail({ firstName, lastName, domain }))
  } catch (err) {
    await reportFailure('gtm.find_email', err, { userId: user.id })
    return NextResponse.json({ error: 'Lookup failed' }, { status: 500 })
  }
}
