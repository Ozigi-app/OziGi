import { supabaseAdmin } from '@/lib/supabase/admin'

export const NO_EMAIL_ACCOUNT_MESSAGE =
  'Connect an email account before running this campaign. Go to GTM settings, connect Gmail or SMTP, then try again.'

/**
 * A campaign with email steps can't send without an active inbox. The send cron
 * only discovers this at run time (and logs an ops_warning), so the entry points
 * that start a campaign check here first and tell the user instead.
 */
export async function missingEmailAccount(
  userId: string,
  steps: { channel?: string }[] | null | undefined,
): Promise<boolean> {
  if (!(steps ?? []).some(s => s?.channel === 'email')) return false
  const { count } = await supabaseAdmin
    .from('email_accounts')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', userId)
    .eq('is_active', true)
  return (count ?? 0) === 0
}
