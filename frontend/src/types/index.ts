export type JobStatus = 'draft' | 'queued' | 'running' | 'partial_results' | 'completed' | 'completed_low_yield' | 'failed' | 'cancelled'

export type ReviewStatus = 'pending' | 'auto_approved' | 'auto_rejected' | 'needs_review' | 'approved' | 'rejected' | 'held'
export type MasterSyncStatus = 'not_synced' | 'master_review_queue' | 'ready_to_sync' | 'conflict_queue' | 'synced'
export type EmailStatus = 'missing' | 'unverified' | 'valid_syntax' | 'invalid_syntax' | 'user_corrected'
export type AudienceMetricType = 'subscriber' | 'follower' | 'member' | 'unknown'
export type AudienceTier = 'nano' | 'micro' | 'mid' | 'macro' | 'mega'
export type AudienceDisplayStatus = 'collected' | 'not_collected' | 'not_applicable'
export type ContactReadiness = 'contactable' | 'no_email' | 'platform_suspect' | 'needs_verification' | 'user_confirmed'
export type EnrichmentStatus = 'not_started' | 'completed' | 'low_confidence' | 'failed'
export type QualityJudgment = 'healthy' | 'low_email_coverage' | 'high_invalid_email_rate' | 'low_audience_coverage'
export type SupplementaryType = 'email_supplement' | 'audience_supplement' | 'meta_supplement'
export type AudienceFailureReason = 'fetch_failed' | 'parse_failed' | 'login_required' | 'unsupported_platform' | 'page_structure_changed' | 'rate_limited'

export interface Job {
  id: number
  label: string | null
  targets: string[]
  status: JobStatus
  mode: 'url' | 'discovery'
  platform: string | null
  category_tags: string[]
  keywords: string[] | null
  target_count: number | null
  subscriber_min: number | null
  subscriber_max: number | null
  extra_conditions: string | null
  max_retries: number
  delay_ms: number
  max_depth: number
  total_leads_found: number
  error_message: string | null
  started_at: string | null
  completed_at: string | null
  inserted_at: string
  updated_at: string
  termination_reason: string | null
  crawl_stats: {
    termination_reason: string
    qualified_count: number
    total_emitted: number
    target_count: number
    keywords_tried: number
    keywords_total: number
    channels_discovered: number
    channels_no_email: number
    duplicates_skipped: number
  } | null
  progress: {
    collected: number
    target: number
    percentage: number
  }
  parent_job_id: number | null
  supplementary_type: SupplementaryType | null
}

export interface LeadEnrichment {
  business_summary: string | null
  business_type: string | null
  descriptor_keywords: string[]
  content_topics: string[]
  trend_summary: string | null
  profile_summary: string | null
  recent_activity_summary: string | null
  secondary_platforms: string[]
  monetization_signals: string[]
  contact_channels: string[]
  enrichment_confidence: number | null
  profile_tags: string[]
  suggested_email: string | null
  operator_notes: string | null
  source: 'operator' | 'system'
  operator_id: string | null
  enriched_at: string
  // Evidence metadata (5B-4)
  evidence_url: string | null
  extraction_method: string | null
  evidence_fields: Record<string, { method: string; confidence: number; fragment: string }> | null
  extracted_at: string | null
  coverage_score: number | null
}

export interface Lead {
  id: number
  // Raw crawler fields (read-only evidence)
  email: string | null
  email_verified: boolean
  platform: 'youtube' | 'instagram' | 'class101' | 'liveklass' | 'web' | 'unknown'
  channel_name: string | null
  channel_url: string | null
  evidence_link: string
  confidence_score: number
  subscriber_count: number | null
  status: 'scraped' | 'verified' | 'contacted' | 'replied' | 'bounced' | 'manual_review'
  last_contacted_at: string | null
  notes: string | null
  source_platform: string | null
  source_type: string | null
  source_url: string | null
  discovery_keyword: string | null
  discovery_keywords: string[]
  normalized_tags: string[]
  review_status: ReviewStatus
  master_sync_status: MasterSyncStatus
  // Phase 5 fields
  email_status: EmailStatus
  audience_metric_type: AudienceMetricType
  audience_tier: AudienceTier | null
  audience_source: string
  display_name: string | null
  contact_email: string | null
  audience_size_override: number | null
  audience_tier_override: AudienceTier | null
  enrichment_status: EnrichmentStatus
  contact_readiness: ContactReadiness
  suspect_reason: string | null
  audience_failure_reason: AudienceFailureReason | null
  priority_score: number
  conflict_details: ConflictDetail[] | null
  // Computed effective values
  effective_name: string | null
  effective_email: string | null
  effective_audience_size: number | null
  effective_audience_tier: AudienceTier | null
  effective_audience_label: string | null
  audience_display_status: AudienceDisplayStatus
  // Relations
  enrichment: LeadEnrichment | null
  job_id: number
  inserted_at: string
  updated_at: string
}

export interface QualityMetrics {
  total_leads: number
  reviewable_leads: number
  contact_present_leads: number
  valid_email_leads: number
  invalid_email_leads: number
  user_corrected_leads: number
  contact_coverage_rate: number
  valid_email_coverage_rate: number
  invalid_email_rate: number
  audience_present_leads: number
  audience_coverage_rate: number
  enrichment_completed_leads: number
  enrichment_coverage_rate: number
  judgment: QualityJudgment
  suggested_supplement: SupplementaryType | null
  platform_suspect_leads: number
  no_email_leads: number
  // Workflow state counts (mutually exclusive)
  unreviewed_leads: number
  needs_enrichment_leads: number
  contactable_leads: number
  on_hold_leads: number
  excluded_leads: number
  synced_leads: number
  conflict_queue_leads: number
  ready_to_sync_leads: number
  // Backward compat aliases
  needs_review_leads: number
  held_leads: number
  needs_verification_leads: number
  needs_correction_leads: number
}

export interface EditHistoryEntry {
  field_name: string
  old_value: string | null
  new_value: string | null
  edited_by: string
  edited_at: string
}

export interface CreateJobPayload {
  job: {
    label?: string
    mode?: 'url' | 'discovery'
    targets: string[]
    keywords?: string[]
    platform?: string
    category_tags?: string[]
    target_count?: number
    subscriber_min?: number
    subscriber_max?: number
    extra_conditions?: string
    max_retries: number
    delay_ms: number
    max_depth: number
  }
}

export interface ConflictDetail {
  rule: 'channel_url' | 'handle' | 'contact_email' | 'platform_name'
  existing_lead_id: number
  value: string
  reason_label?: string
  similarity_score?: number
}

export interface ApproveAndQueueResult {
  ready: number
  conflicts: number
  conflict_leads: { lead_id: number; conflicts: ConflictDetail[] }[]
}

export interface DuplicateGroup {
  group_id: string
  reason: string
  new_lead: Lead
  existing_lead: Lead
}

export interface AddToMasterListResult {
  added: number
  duplicates: DuplicateGroup[]
}

export interface MasterListLead {
  id: number
  email: string | null
  email_verified: boolean
  platform: string
  channel_name: string | null
  channel_url: string | null
  evidence_link: string
  subscriber_count: number | null
  status: string
  notes: string | null
  job_id: number | null
  inserted_at: string
}

export const PLATFORM_LABELS: Record<string, string> = {
  youtube: '유튜브',
  instagram: '인스타그램',
  class101: 'Class101',
  liveklass: '라이브클래스',
  web: '웹사이트',
  unknown: '기타',
}

export const STATUS_LABELS: Record<string, string> = {
  draft: '초안',
  queued: '실행 대기 중',
  running: '탐색 중',
  partial_results: '일부 결과 확보됨',
  completed: '목표 달성 완료',
  completed_low_yield: '탐색 종료(목표 미달)',
  failed: '실행 실패',
  cancelled: '사용자 취소',
}

export const TERMINATION_LABELS: Record<string, string> = {
  target_reached: '목표 수량 달성',
  sources_exhausted: '모든 소스 탐색 완료',
  duplicate_heavy: '중복 비율 과다',
  insufficient_contact_coverage: '연락처 확보율 부족',
  timeout: '시간 초과',
  user_cancelled: '사용자 중단',
  system_error: '시스템 오류',
}

export const SOURCE_TYPE_LABELS: Record<string, string> = {
  profile_page: '프로필',
  about_page: '소개',
  search_result: '검색결과',
  external_site: '외부사이트',
  contact_page: '연락처',
  social_profile: '소셜 프로필',
  domain_guess: '도메인 추측',
  bio_link: '바이오 링크',
}

export const REVIEW_STATUS_LABELS: Record<string, string> = {
  pending: '검토 대기',
  auto_approved: '자동 승인',
  auto_rejected: '자동 제외',
  needs_review: '검토 필요',
  approved: '승인',
  rejected: '제외',
  held: '보류',
}

export const MASTER_SYNC_LABELS: Record<string, string> = {
  not_synced: '미반영',
  master_review_queue: '대기열',
  ready_to_sync: '반영 가능',
  conflict_queue: '충돌 확인',
  synced: '반영 완료',
}

export const EMAIL_STATUS_LABELS: Record<string, string> = {
  missing: '없음',
  unverified: '미검증',
  valid_syntax: '유효',
  invalid_syntax: '무효',
  user_corrected: '수정됨',
}

export const AUDIENCE_TIER_LABELS: Record<string, string> = {
  nano: 'Nano',
  micro: 'Micro',
  mid: 'Mid',
  macro: 'Macro',
  mega: 'Mega',
}

export const CONTACT_READINESS_LABELS: Record<string, string> = {
  contactable: '연락 가능',
  no_email: '이메일 없음',
  platform_suspect: '플랫폼 메일 의심',
  needs_verification: '검증 필요',
  user_confirmed: '사용자 확인',
}

export const SUSPECT_REASON_LABELS: Record<string, string> = {
  prefix_support: 'support@ 계열 공용 메일',
  prefix_cs: 'cs@ 계열 공용 메일',
  prefix_help: 'help@ 계열 공용 메일',
  prefix_admin: 'admin@ 계열 공용 메일',
  prefix_info: 'info@ 계열 공용 메일',
  prefix_contact: 'contact@ 계열 공용 메일',
  prefix_noreply: 'noreply@ 수신 불가 메일',
  prefix_service: 'service@ 계열 공용 메일',
  prefix_sales: 'sales@ 계열 공용 메일',
  prefix_marketing: 'marketing@ 계열 공용 메일',
  prefix_team: 'team@ 계열 공용 메일',
  platform_domain_fanding_kr: '팬딩 플랫폼 도메인',
  platform_domain_youtube_com: 'YouTube 도메인',
  platform_domain_google_com: 'Google 도메인',
  platform_domain_naver_com: 'Naver 도메인',
  generic_footer_webmaster: 'webmaster 시스템 메일',
  generic_footer_postmaster: 'postmaster 시스템 메일',
}

export const ENRICHMENT_STATUS_LABELS: Record<string, string> = {
  not_started: '미시작',
  completed: '완료',
  low_confidence: '신뢰도 낮음',
  failed: '실패',
}

export const AUDIENCE_DISPLAY_STATUS_LABELS: Record<string, string> = {
  collected: '',
  not_collected: '미수집',
  not_applicable: '해당 없음',
}

export const AUDIENCE_FAILURE_REASON_LABELS: Record<string, string> = {
  fetch_failed: '페이지 로딩 실패',
  parse_failed: '구독자 수 파싱 실패',
  login_required: '로그인 필요',
  unsupported_platform: '미지원 플랫폼',
  page_structure_changed: '페이지 구조 변경',
  rate_limited: '요청 제한',
}

export const QUALITY_JUDGMENT_LABELS: Record<string, string> = {
  healthy: '이메일 확보율 양호',
  low_email_coverage: '이메일 확보율이 낮아 보완 탐색이 권장됩니다.',
  high_invalid_email_rate: '이메일 품질이 낮아 검토 전 보완이 필요합니다.',
  low_audience_coverage: '영향력 지표 미수집 비율이 높습니다.',
}

export const TERMINATION_SENTENCES: Record<string, string> = {
  target_reached: '목표 수량 달성 후 탐색이 종료되었습니다.',
  sources_exhausted: '더 이상 탐색 가능한 소스를 찾지 못해 종료되었습니다.',
  duplicate_heavy: '중복 비율이 높아 유효 리드 확보 효율이 낮아 종료되었습니다.',
  insufficient_contact_coverage: '이메일/연락처 보유 리드가 부족해 목표 수량에 도달하지 못했습니다.',
  timeout: '제한 시간 내 탐색이 완료되지 못했습니다.',
  system_error: '시스템 오류로 탐색이 중단되었습니다.',
  user_cancelled: '사용자가 탐색을 중단했습니다.',
}

export const SUGGESTED_CATEGORIES = [
  '주식', '부업', '재테크', 'AI', '자기계발', '건강',
  '요리', '여행', '뷰티', '패션', '육아', '교육',
  '마케팅', '비즈니스', '부동산', '코칭', '운동',
]

export const PLATFORM_OPTIONS: { value: string; label: string }[] = [
  { value: 'youtube', label: '유튜브' },
  { value: 'instagram', label: '인스타그램' },
  { value: 'class101', label: 'Class101' },
  { value: 'liveklass', label: '라이브클래스' },
  { value: 'taling', label: '탈잉' },
]
