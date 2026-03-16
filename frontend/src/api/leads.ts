import api from './client'
import type { Lead } from '../types'

interface LeadParams {
  job_id?: number
  platform?: string
  status?: string
  min_confidence?: number
  search?: string
  sort?: string
  order?: string
  limit?: number
  offset?: number
}

export async function getLeads(params: LeadParams = {}): Promise<Lead[]> {
  const { data } = await api.get<{ data: Lead[] }>('/leads', { params })
  return data.data
}

export async function getJobLeads(jobId: number, params: LeadParams = {}): Promise<Lead[]> {
  return getLeads({ ...params, job_id: jobId })
}

export function exportCsvUrl(params: LeadParams = {}): string {
  const searchParams = new URLSearchParams()
  Object.entries(params).forEach(([key, val]) => {
    if (val !== undefined && val !== null) searchParams.set(key, String(val))
  })
  return `/api/leads/export/csv?${searchParams.toString()}`
}
