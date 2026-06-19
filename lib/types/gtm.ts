export type CampaignStatus = 'active' | 'paused' | 'completed' | 'draft'
export type LeadSource = 'github' | 'devto' | 'linkedin' | 'hackernews' | 'npm' | 'manual'
export type LeadStatus = 'pending' | 'contacted' | 'replied' | 'bounced' | 'opted_out' | 'not_qualified'
export type SendChannel = 'email' | 'linkedin'
export type SendStatus = 'queued' | 'sent' | 'failed' | 'opened' | 'clicked' | 'replied'
export type EmailProvider = 'gmail' | 'smtp' | 'zoho'
export type LinkedInSessionStatus = 'active' | 'expired' | 'needs_login'
export type LinkedInAction = 'connect' | 'message' | 'follow_up'
export type LinkedInQueueStatus = 'queued' | 'in_progress' | 'done' | 'failed' | 'skipped'

export interface IcpConfig {
  job_titles: string[]
  industries: string[]
  company_sizes: string[]   // e.g. ['1-10', '11-50', '51-200']
  keywords: string[]
  locations?: string[]
  seniority_levels?: string[]
}

export interface SequenceStep {
  step: number
  channel: SendChannel
  delay_days: number
}

export interface Campaign {
  id: string
  user_id: string
  name: string
  icp_description: string
  icp_config: IcpConfig
  sources: LeadSource[]
  daily_email_limit: number
  daily_linkedin_limit: number
  sequence_steps: SequenceStep[]
  status: CampaignStatus
  // Sender / product details used by Gemini to compose outreach
  sender_name: string
  sender_title: string
  product_name: string
  product_description: string
  cta_url: string
  persona_voice: string | null   // writing style/tone for AI email composition
  product_context: string | null // rich AI-generated brief: features, pain points, outcomes — fed to composer
  created_at: string
  updated_at: string
}

export interface Lead {
  id: string
  campaign_id: string
  user_id: string
  source: LeadSource
  source_id: string
  name: string | null
  email: string | null
  github_username: string | null
  linkedin_url: string | null
  linkedin_profile_id: string | null
  twitter_handle: string | null
  bio: string | null
  company: string | null
  location: string | null
  tags: string[]
  icp_match_score: number | null
  status: LeadStatus
  created_at: string
  updated_at: string
}

export interface SequenceSend {
  id: string
  lead_id: string
  campaign_id: string
  user_id: string
  step: number
  channel: SendChannel
  subject: string | null
  body: string | null
  status: SendStatus
  sent_at: string | null
  opened_at: string | null
  replied_at: string | null
  error: string | null
  created_at: string
}

export interface EmailAccount {
  id: string
  user_id: string
  provider: EmailProvider
  email_address: string
  display_name: string | null
  smtp_host: string | null
  smtp_port: number | null
  smtp_username: string | null
  smtp_password_enc: string | null
  oauth_refresh_token_enc: string | null
  oauth_access_token_enc: string | null
  oauth_token_expires_at: string | null
  is_active: boolean
  daily_send_count: number
  last_send_date: string | null
  created_at: string
  updated_at: string
}

export interface LinkedInSession {
  id: string
  user_id: string
  linkedin_email: string
  session_cookies: string | null
  status: LinkedInSessionStatus
  last_used_at: string | null
  created_at: string
  updated_at: string
}

export interface LinkedInQueueItem {
  id: string
  lead_id: string
  campaign_id: string
  user_id: string
  action: LinkedInAction
  message: string | null
  status: LinkedInQueueStatus
  attempts: number
  scheduled_at: string
  processed_at: string | null
  error: string | null
  created_at: string
}
