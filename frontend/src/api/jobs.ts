import api from './client'
import type { Job, CreateJobPayload, SupplementaryType } from '../types'

export async function getJobs(): Promise<Job[]> {
  const { data } = await api.get<{ data: Job[] }>('/jobs')
  return data.data
}

export async function getJob(id: number): Promise<Job> {
  const { data } = await api.get<{ data: Job }>(`/jobs/${id}`)
  return data.data
}

export async function createJob(payload: CreateJobPayload): Promise<Job> {
  const { data } = await api.post<{ data: Job }>('/jobs', payload)
  return data.data
}

export async function cancelJob(id: number): Promise<Job> {
  const { data } = await api.post<{ data: Job }>(`/jobs/${id}/cancel`)
  return data.data
}

export async function createSupplementaryJob(jobId: number, supplementaryType: SupplementaryType): Promise<Job> {
  const { data } = await api.post<{ data: Job }>(`/jobs/${jobId}/supplement`, {
    supplementary_type: supplementaryType,
  })
  return data.data
}

export interface EnrichmentRunResponse {
  status: string
  job_id: number
  run_id: number
}

export interface EnrichmentRun {
  id: number
  job_id: number
  run_type: 'subscribers' | 'channels'
  status: 'running' | 'completed' | 'failed'
  total: number
  processed: number
  updated: number
  failed: number
  inserted_at: string
  updated_at: string
}

export async function enrichSubscribers(jobId: number): Promise<EnrichmentRunResponse> {
  const { data } = await api.post<EnrichmentRunResponse>(`/jobs/${jobId}/enrich-subscribers`)
  return data
}

export async function enrichChannels(jobId: number): Promise<EnrichmentRunResponse> {
  const { data } = await api.post<EnrichmentRunResponse>(`/jobs/${jobId}/enrich-channels`)
  return data
}

export async function getEnrichmentRun(runId: number): Promise<EnrichmentRun> {
  const { data } = await api.get<{ data: EnrichmentRun }>(`/enrichment-runs/${runId}`)
  return data.data
}

export async function getEnrichmentRuns(jobId: number): Promise<EnrichmentRun[]> {
  const { data } = await api.get<{ data: EnrichmentRun[] }>(`/jobs/${jobId}/enrichment-runs`)
  return data.data
}

export interface ParsedPrompt {
  // V2 fields
  target_persona: string | null
  search_clues: string[]
  categories: string[]
  active_platforms: string[]
  exclude_conditions: string | null
  // Shared fields
  subscriber_min: number | null
  subscriber_max: number | null
  raw_prompt: string
  parse_mode?: string
  // Backward compat (present in API response, not used by new form)
  keywords?: string[]
  category_tags?: string[]
  platform_hints?: string[]
  semantic_expansions?: string[]
  extra_conditions?: string | null
}

export async function parsePrompt(prompt: string): Promise<ParsedPrompt> {
  const { data } = await api.post<{ data: ParsedPrompt }>('/parse-prompt', { prompt })
  return data.data
}
