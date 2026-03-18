export type JobStatus = 'draft' | 'queued' | 'running' | 'partial_results' | 'completed' | 'completed_low_yield' | 'failed' | 'cancelled'

export type ReviewStatus = 'pending' | 'approved' | 'rejected' | 'held'
export type MasterSyncStatus = 'not_synced' | 'ready' | 'conflict' | 'synced'

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
}

export interface Lead {
  id: number
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
  review_status: ReviewStatus
  master_sync_status: MasterSyncStatus
  job_id: number
  inserted_at: string
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
  queued: '대기 중',
  running: '수집 중',
  partial_results: '부분 결과',
  completed: '완료',
  completed_low_yield: '저수율 완료',
  failed: '오류 발생',
  cancelled: '취소됨',
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
}

export const REVIEW_STATUS_LABELS: Record<string, string> = {
  pending: '검토 대기',
  approved: '승인',
  rejected: '제외',
  held: '보류',
}

export const MASTER_SYNC_LABELS: Record<string, string> = {
  not_synced: '미반영',
  ready: '반영 가능',
  conflict: '충돌',
  synced: '반영 완료',
}

export const SUGGESTED_CATEGORIES = [
  '주식', '부업', '재테크', 'AI', '자기계발', '건강',
  '요리', '여행', '뷰티', '패션', '육아', '교육',
  '마케팅', '비즈니스', '부동산', '코칭', '운동',
]
