import api from './client'
import type { Lead } from '../types'

interface LeadParams {
  job_id?: number
  platform?: string
  status?: string
  search?: string
  has_email?: string
  min_confidence?: string
  sort?: string
  order?: string
  limit?: number
  offset?: number
}

export async function getLeads(params: LeadParams = {}): Promise<Lead[]> {
  const { data } = await api.get<{ data: Lead[] }>('/leads', { params })
  return data.data
}

export async function getLead(id: number): Promise<Lead> {
  const { data } = await api.get<{ data: Lead }>(`/leads/${id}`)
  return data.data
}

export async function updateLead(id: number, lead: Partial<Lead>): Promise<Lead> {
  const { data } = await api.put<{ data: Lead }>(`/leads/${id}`, { lead })
  return data.data
}

export async function deleteLead(id: number): Promise<void> {
  await api.delete(`/leads/${id}`)
}

export function exportCsvUrl(params: LeadParams = {}): string {
  const searchParams = new URLSearchParams()
  Object.entries(params).forEach(([key, val]) => {
    if (val !== undefined && val !== null) searchParams.set(key, String(val))
  })
  return `/api/leads/export/csv?${searchParams.toString()}`
}
