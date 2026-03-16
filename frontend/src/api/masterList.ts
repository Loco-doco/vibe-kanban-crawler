import api from './client'
import type { MasterListLead, AddToMasterListResult } from '../types'

export async function getMasterList(params: { search?: string; limit?: number; offset?: number } = {}): Promise<{ data: MasterListLead[]; total: number }> {
  const { data } = await api.get<{ data: MasterListLead[]; total: number }>('/master-list', { params })
  return data
}

export async function addToMasterList(jobId: number, leadIds?: number[]): Promise<AddToMasterListResult> {
  const payload: Record<string, unknown> = { job_id: jobId }
  if (leadIds) payload.lead_ids = leadIds
  const { data } = await api.post<AddToMasterListResult>('/master-list/add', payload)
  return data
}

export async function removeFromMasterList(leadId: number): Promise<void> {
  await api.delete(`/master-list/${leadId}`)
}

export async function resolveDuplicate(groupId: string, action: string, keepLeadId?: number): Promise<void> {
  await api.post('/master-list/duplicates/resolve', {
    group_id: groupId,
    action,
    keep_lead_id: keepLeadId,
  })
}
