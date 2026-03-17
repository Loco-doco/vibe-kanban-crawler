export interface Job {
  id: number
  label: string | null
  targets: string[]
  status: 'pending' | 'running' | 'completed' | 'failed' | 'cancelled'
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
  pending: '대기 중',
  running: '수집 중',
  completed: '완료',
  failed: '오류 발생',
  cancelled: '취소됨',
}

export const SUGGESTED_CATEGORIES = [
  '주식', '부업', '재테크', 'AI', '자기계발', '건강',
  '요리', '여행', '뷰티', '패션', '육아', '교육',
  '마케팅', '비즈니스', '부동산', '코칭', '운동',
]
