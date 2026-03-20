import api from './client'
import type { Lead, QualityMetrics, EditHistoryEntry, ReviewStatus } from '../types'

interface LeadParams {
  job_id?: number
  action_queue?: string
  platform?: string
  status?: string
  search?: string
  has_email?: string
  min_confidence?: string
  email_status?: string
  contact_readiness?: string
  review_status?: string
  enrichment_status?: string
  audience_tier?: string
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

export async function bulkReview(leadIds: number[], reviewStatus: ReviewStatus): Promise<{ updated: number }> {
  const { data } = await api.post<{ updated: number }>('/leads/bulk-review', {
    lead_ids: leadIds,
    review_status: reviewStatus,
  })
  return data
}

export async function getQuality(jobId: number): Promise<QualityMetrics> {
  const { data } = await api.get<{ data: QualityMetrics }>(`/quality/jobs/${jobId}`)
  return data.data
}

export async function getEditHistory(leadId: number): Promise<EditHistoryEntry[]> {
  const { data } = await api.get<{ data: EditHistoryEntry[] }>(`/leads/${leadId}/edit-history`)
  return data.data
}

export function exportCsvUrl(params: LeadParams = {}): string {
  const searchParams = new URLSearchParams()
  Object.entries(params).forEach(([key, val]) => {
    if (val !== undefined && val !== null) searchParams.set(key, String(val))
  })
  return `/api/leads/export/csv?${searchParams.toString()}`
}
