import { useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { getJobs, cancelJob } from '../api/jobs'
import { getLeads } from '../api/leads'
import StatusBadge from './StatusBadge'
import type { Job, Lead } from '../types'
import { PLATFORM_LABELS } from '../types'

interface Props {
  onViewResults?: (jobId: number) => void
}

export default function JobMonitor({ onViewResults }: Props) {
  const [expandedJobId, setExpandedJobId] = useState<number | null>(null)
  const queryClient = useQueryClient()

  const { data: jobs, isLoading } = useQuery({
    queryKey: ['jobs'],
    queryFn: getJobs,
    refetchInterval: 5000,
  })

  const { data: previewLeads } = useQuery({
    queryKey: ['leads', { job_id: expandedJobId, limit: 5 }],
    queryFn: () => getLeads({ job_id: expandedJobId!, limit: 5, sort: 'inserted_at', order: 'desc' }),
    enabled: expandedJobId !== null,
    refetchInterval: expandedJobId !== null ? 5000 : false,
  })

  const handleCancel = async (id: number) => {
    await cancelJob(id)
    queryClient.invalidateQueries({ queryKey: ['jobs'] })
  }

  const activeJobs = jobs?.filter((j) => j.status === 'running' || j.status === 'pending') || []
  const doneJobs = jobs?.filter((j) => j.status === 'completed' || j.status === 'failed' || j.status === 'cancelled').slice(0, 8) || []

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

  if (isLoading) {
    return <div className="loading-state">탐색 목록을 불러오는 중...</div>
  }

  const renderCard = (job: Job, isDone: boolean) => (
    <div key={job.id} className={`campaign-card ${job.status}${isDone ? ' done' : ''}`}>
      <div className="campaign-header" onClick={() => toggleExpand(job.id)} style={{ cursor: 'pointer' }}>
        <div className="campaign-title">
          {!isDone && <span className={`status-dot ${job.status}`} />}
          <span>{job.label || `탐색 #${job.id}`}</span>
        </div>
        <StatusBadge status={job.status} />
      </div>

      <div className="campaign-meta">
        {job.mode === 'discovery' && <span className="campaign-tag" style={{ background: 'var(--primary-50)', color: 'var(--primary-600)' }}>키워드 탐색</span>}
        {job.platform && <span>{job.platform.split(',').map((p) => PLATFORM_LABELS[p] || p).join(', ')}</span>}
        {job.mode === 'discovery' && job.keywords?.length
          ? <span>{job.keywords.length}개 키워드</span>
          : <span>{job.targets.length}개 대상</span>}
        <span>리드 {job.total_leads_found}건</span>
        {isDone ? <span>{formatTime(job.inserted_at)}</span> : <span>{formatDuration(job)}</span>}
      </div>

      {job.status === 'running' && job.progress && (
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

      {job.category_tags?.length > 0 && (
        <div className="campaign-tags">
          {job.category_tags.map((tag) => (
            <span key={tag} className="campaign-tag">{tag}</span>
          ))}
        </div>
      )}

      {job.status === 'failed' && job.error_message && (
        <div className="campaign-error">
          {job.error_message}
        </div>
      )}

      {/* Actions */}
      <div className="campaign-actions">
        {(job.status === 'pending' || job.status === 'running') && (
          <button
            className="btn-small btn-cancel"
            onClick={(e) => { e.stopPropagation(); handleCancel(job.id) }}
          >
            중단
          </button>
        )}
        {(job.status === 'completed' || job.status === 'failed') && job.total_leads_found > 0 && onViewResults && (
          <button
            className="btn-small btn-view-results"
            onClick={(e) => { e.stopPropagation(); onViewResults(job.id) }}
          >
            결과 보기 {'\u2192'}
          </button>
        )}
      </div>

      {/* Expanded: lead preview */}
      {expandedJobId === job.id && (
        <div className="campaign-preview">
          <div className="campaign-preview-title">
            수집된 리드 미리보기 ({job.total_leads_found}건 중 최근 5건)
          </div>
          {!previewLeads?.length ? (
            <div className="campaign-preview-empty">아직 수집된 리드가 없습니다</div>
          ) : (
            <table className="mini-table">
              <thead>
                <tr>
                  <th>이메일</th>
                  <th>채널명</th>
                  <th>플랫폼</th>
                </tr>
              </thead>
              <tbody>
                {previewLeads.map((lead: Lead) => (
                  <tr key={lead.id}>
                    <td>{lead.email || '(확인 필요)'}</td>
                    <td>{lead.channel_name || '-'}</td>
                    <td>{PLATFORM_LABELS[lead.platform] || lead.platform}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
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
          <span className="empty-state-icon">{'\u{1F4E6}'}</span>
          <h3>탐색 내역이 없습니다</h3>
          <p>&ldquo;새 탐색 만들기&rdquo; 탭에서 시작하세요</p>
        </div>
      )}
    </div>
  )
}
