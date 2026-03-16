export interface Job {
  id: number
  targets: string[]
  status: 'pending' | 'running' | 'completed' | 'failed' | 'cancelled'
  max_retries: number
  delay_ms: number
  max_depth: number
  total_leads_found: number
  error_message: string | null
  started_at: string | null
  completed_at: string | null
  inserted_at: string
  updated_at: string
}

export interface Lead {
  id: number
  email: string | null
  platform: 'youtube' | 'instagram' | 'web' | 'unknown'
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
    targets: string[]
    max_retries: number
    delay_ms: number
    max_depth: number
  }
}
