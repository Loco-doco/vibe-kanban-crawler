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

export async function enrichSubscribers(jobId: number): Promise<{ status: string; job_id: number }> {
  const { data } = await api.post<{ status: string; job_id: number }>(`/jobs/${jobId}/enrich-subscribers`)
  return data
}

export async function enrichChannels(jobId: number): Promise<{ status: string; job_id: number }> {
  const { data } = await api.post<{ status: string; job_id: number }>(`/jobs/${jobId}/enrich-channels`)
  return data
}

export interface ParsedPrompt {
  keywords: string[]
  category_tags: string[]
  subscriber_min: number | null
  subscriber_max: number | null
  extra_conditions: string | null
  parse_mode?: string
}

export async function parsePrompt(prompt: string): Promise<ParsedPrompt> {
  const { data } = await api.post<{ data: ParsedPrompt }>('/parse-prompt', { prompt })
  return data.data
}
