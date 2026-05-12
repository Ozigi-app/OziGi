export type SupportType = 'brief_supplied' | 'needs_source' | 'general_knowledge' | 'opinion';
export type SourceStatus = 'resolved' | 'redirected' | 'dead' | 'paywalled';
export type ClaimSupport = 'YES' | 'NO' | 'UNCLEAR';
export type AuditFlagSeverity = 'error' | 'warning' | 'info';
export type AuditFlagType =
  | 'dead-link'
  | 'out-of-budget-url'
  | 'suspicious-hash'
  | 'lint-error'
  | 'fabricated-authority'
  | 'prose-list-of-three'
  | 'prose-not-x-but-y'
  | 'prose-uniform-length'
  | 'prose-section-closer'
  | 'placeholder'
  | 'source-not-supporting-claim'
  | 'high-dead-link-rate';

export interface OutlineSection {
  heading: string;
  summary: string;
}

export interface ClaimEntry {
  id: string;
  claim: string;
  section: string;
  support_type: SupportType;
  proposed_source: string | null;
}

export interface SourceBudgetEntry {
  url: string;
  justification: string;
  from_brief: boolean;
  supports_claims: string[];
  // Filled in after Stage 2 VERIFY
  status?: SourceStatus;
  final_url?: string;
  content_preview?: string;
  claim_support?: ClaimSupport;
  claim_support_reason?: string;
}

export interface LongformPlan {
  id: string;
  post_id: string | null;
  user_id: string;
  outline: OutlineSection[];
  claim_ledger: ClaimEntry[];
  source_budget: SourceBudgetEntry[];
  created_at: string;
}

export interface AuditFlag {
  type: AuditFlagType;
  severity: AuditFlagSeverity;
  message: string;
  offset?: number;
  length?: number;
  span_text?: string;
  url?: string;
  details?: string;
}

export interface ProseAuditScore {
  list_of_three_count: number;
  not_x_but_y_count: number;
  paragraph_length_cv: number;
  section_closer_count: number;
  flagged: boolean;
}

export interface AuditReport {
  id?: string;
  post_id: string;
  plan_id: string | null;
  flags: AuditFlag[];
  dead_link_rate: number;
  link_audit_passed: boolean;
  citation_audit_passed: boolean;
  code_audit_passed: boolean;
  prose_audit_score: ProseAuditScore;
  authority_audit_passed: boolean;
  created_at?: string;
}

export interface VerifySourcesResult {
  annotated_budget: SourceBudgetEntry[];
  dead_count: number;
  total_count: number;
  dead_rate: number;
  gate_triggered: boolean;
}
