import api from './client'
import type { Job, CreateJobPayload } from '../types'

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
