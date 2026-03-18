import { useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { getJobs, cancelJob } from '../api/jobs'
import StatusBadge from './StatusBadge'
import JobDetailPanel from './JobDetailPanel'
import type { Job, JobStatus } from '../types'
import { TERMINATION_LABELS } from '../types'

const ACTIVE_STATUSES: JobStatus[] = ['draft', 'queued', 'running', 'partial_results']
const DONE_STATUSES: JobStatus[] = ['completed', 'completed_low_yield', 'failed', 'cancelled']

interface Props {
  onViewResults?: (jobId: number) => void
}

export default function JobMonitor({ onViewResults }: Props) {
  const [expandedJobId, setExpandedJobId] = useState<number | null>(null)
  const queryClient = useQueryClient()

  // 상위 polling: job 목록만 갱신 (5초). Detail 내부 fetch와 역할 분리.
  const { data: jobs, isLoading } = useQuery({
    queryKey: ['jobs'],
    queryFn: getJobs,
    refetchInterval: 5000,
  })

  const handleCancel = async (id: number) => {
    await cancelJob(id)
    queryClient.invalidateQueries({ queryKey: ['jobs'] })
  }

  const activeJobs = jobs?.filter((j) => (ACTIVE_STATUSES as string[]).includes(j.status)) || []
  const doneJobs = jobs?.filter((j) => (DONE_STATUSES as string[]).includes(j.status)).slice(0, 8) || []

  const formatDuration = (job: Job) => {
    if (!job.started_at) return '-'
    const start = new Date(job.started_at).getTime()
    const end = job.completed_at ? new Date(job.completed_at).getTime() : Date.now()
    const sec = Math.round((end - start) / 1000)
    if (sec < 60) return `${sec}초`
    return `${Math.floor(sec / 60)}분 ${sec % 60}초`
  }

  const formatTime = (iso: string) => {
    const d = new Date(iso)
    return d.toLocaleString('ko-KR', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
  }

  const toggleExpand = (id: number) => {
    setExpandedJobId(expandedJobId === id ? null : id)
  }

  const canCancel = (status: string) => status === 'queued' || status === 'running' || status === 'partial_results'

  if (isLoading) {
    return <div className="loading-state">탐색 목록을 불러오는 중...</div>
  }

  const renderCard = (job: Job, isDone: boolean) => (
    <div key={job.id} className={`campaign-card ${job.status}${isDone ? ' done' : ''}`}>
      {/* Header: 탐색명 + StatusBadge + Chevron */}
      <div className="campaign-header" onClick={() => toggleExpand(job.id)} style={{ cursor: 'pointer' }}>
        <div className="campaign-title">
          {!isDone && <span className={`status-dot ${job.status}`} />}
          <span>{job.label || `탐색 #${job.id}`}</span>
        </div>
        <div className="campaign-header-right">
          <StatusBadge status={job.status} />
          <span className={`expand-chevron${expandedJobId === job.id ? ' open' : ''}`}>▾</span>
        </div>
      </div>

      {/* Meta: 수집 현황 + 시각 */}
      <div className="campaign-meta">
        <span className="campaign-meta-primary">
          {job.progress?.collected ?? job.total_leads_found} / {job.target_count ?? '-'}건
        </span>
        {!isDone && <span>{formatDuration(job)}</span>}
        <span>생성 {formatTime(job.inserted_at)}</span>
        <span>갱신 {formatTime(job.updated_at)}</span>
      </div>

      {/* Progress bar: running + partial_results */}
      {(job.status === 'running' || job.status === 'partial_results') && job.progress && (
        <div className="campaign-progress">
          <div className="progress-bar">
            <div className="progress-fill" style={{ width: `${job.progress.percentage}%` }} />
          </div>
          <div className="campaign-progress-info">
            <span>{job.progress.collected} / {job.progress.target} 완료</span>
            <span>{job.progress.percentage}%</span>
          </div>
        </div>
      )}

      {/* partial_results 강조 */}
      {job.status === 'partial_results' && (
        <div className="partial-results-indicator">
          중간 결과를 확인할 수 있습니다
        </div>
      )}

      {/* 종료 사유 요약 (카드 레벨: 짧은 라벨) */}
      {job.termination_reason && isDone && (
        <div className="campaign-termination">
          <span className="termination-label">종료:</span>
          <span className={`termination-badge ${job.termination_reason}`}>
            {TERMINATION_LABELS[job.termination_reason] || job.termination_reason}
          </span>
        </div>
      )}

      {/* 실패 에러 메시지 */}
      {job.status === 'failed' && job.error_message && (
        <div className="campaign-error">
          {job.error_message}
        </div>
      )}

      {/* Actions: Cancel (카드 레벨에 유지) */}
      {canCancel(job.status) && (
        <div className="campaign-actions">
          <button
            className="btn-small btn-cancel"
            onClick={(e) => { e.stopPropagation(); handleCancel(job.id) }}
          >
            중단
          </button>
        </div>
      )}

      {/* Expanded: Job Detail Panel */}
      {expandedJobId === job.id && (
        <JobDetailPanel job={job} onViewResults={onViewResults} />
      )}
    </div>
  )

  return (
    <div className="monitor-wrap">
      {activeJobs.length > 0 && (
        <div className="monitor-section">
          <h4 className="monitor-section-title">
            진행 중 <span className="monitor-count">{activeJobs.length}</span>
          </h4>
          {activeJobs.map((job) => renderCard(job, false))}
        </div>
      )}

      {doneJobs.length > 0 && (
        <div className="monitor-section">
          <h4 className="monitor-section-title">최근 완료</h4>
          {doneJobs.map((job) => renderCard(job, true))}
        </div>
      )}

      {activeJobs.length === 0 && doneJobs.length === 0 && (
        <div className="empty-state">
          <h3>탐색 내역이 없습니다</h3>
          <p>"새 탐색 만들기" 탭에서 시작하세요</p>
        </div>
      )}
    </div>
  )
}
