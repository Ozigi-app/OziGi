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
  // Structural AI tells — cadence and rhythm patterns a model can't synonym its
  // way out of, unlike the word-level bans in lib/prompts/anti-ai.ts.
  | 'prose-em-dash'
  | 'prose-rhetorical-question'
  | 'prose-passive-voice'
  | 'prose-hedging'
  | 'prose-repeated-opener'
  | 'prose-sentence-uniformity'
  | 'prose-repeated-word'
  | 'prose-repeated-theme'
  | 'prose-narrated-code'
  | 'prose-meta-reference'
  | 'prose-formatting-tell'
  | 'prose-marketing-tell'
  | 'prose-no-contractions'
  // Code block audit
  | 'code-security'
  | 'code-typography'
  | 'code-missing-language'
  | 'code-incomplete'
  | 'code-convention'
  // Calibration
  | 'mode-boundary'
  | 'audience-mismatch'
  | 'placeholder'
  | 'source-not-supporting-claim'
  | 'high-dead-link-rate';

/**
 * Reader the article is calibrated for. Drives prompt construction
 * (lib/prompts/audience.ts) and the post-generation calibration audit
 * (lib/longform/audit-audience.ts).
 */
export type LongFormAudience =
  | 'developer'
  | 'practitioner'
  | 'technical-writer'
  | 'beginner'
  | 'mixed';

/**
 * Generation parameters echoed back into the audit so calibration checks know
 * what the draft was *supposed* to be. All fields optional: audits degrade to
 * their context-free subset when a field is absent (e.g. old persisted posts).
 */
export interface AuditContext {
  tone?: string;
  structure?: string;
  audience?: string;
}

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
  // --- v2 structural detectors ---
  em_dash_per_1000: number;
  rhetorical_question_count: number;
  passive_voice_ratio: number;
  hedge_count: number;
  repeated_opener_count: number;
  sentence_uniformity_runs: number;
  repeated_word_count: number;
  repeated_theme_count: number;
  narrated_code_count: number;
  meta_reference_count: number;
  formatting_tell_count: number;
  marketing_tell_count: number;
  contraction_count: number;
  /** 0-100. 100 = no structural tells detected; drops as detectors fire. */
  structural_score: number;
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
