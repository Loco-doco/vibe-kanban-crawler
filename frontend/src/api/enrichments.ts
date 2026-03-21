import api from './client'

export async function importEnrichments(data: unknown): Promise<{ imported: number; errors: Array<{ lead_id: number; error: string }> }> {
  const res = await api.post('/import/enrichments', data)
  return res.data
}

export async function importKeywords(data: unknown): Promise<{ imported: number; errors: Array<{ job_id: number; error: string }> }> {
  const res = await api.post('/import/keywords', data)
  return res.data
}
