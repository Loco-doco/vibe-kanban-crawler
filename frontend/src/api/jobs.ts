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

export interface ParsedPrompt {
  keywords: string[]
  category_tags: string[]
  subscriber_min: number | null
  subscriber_max: number | null
  extra_conditions: string | null
  parse_mode?: string
  raw_prompt: string
  platform_hints: string[]
  semantic_expansions: string[]
  parse_confidence: number
  confidence_level: 'high' | 'medium' | 'low'
  confidence_signals: string[]
}

export async function parsePrompt(prompt: string): Promise<ParsedPrompt> {
  const { data } = await api.post<{ data: ParsedPrompt }>('/parse-prompt', { prompt })
  return data.data
}
