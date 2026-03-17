import { useQuery, useQueryClient } from '@tanstack/react-query'
import { getJobs, cancelJob } from '../api/jobs'
import StatusBadge from './StatusBadge'
import type { Job } from '../types'
import { PLATFORM_LABELS, STATUS_LABELS } from '../types'

export default function JobMonitor() {
  const queryClient = useQueryClient()
  const { data: jobs, isLoading } = useQuery({
    queryKey: ['jobs'],
    queryFn: getJobs,
    refetchInterval: 5000,
  })

  const handleCancel = async (id: number) => {
    await cancelJob(id)
    queryClient.invalidateQueries({ queryKey: ['jobs'] })
  }

  const runningJobs = jobs?.filter((j) => j.status === 'running' || j.status === 'pending') || []
  const recentJobs = jobs?.filter((j) => j.status === 'completed' || j.status === 'failed' || j.status === 'cancelled').slice(0, 5) || []

  const formatTime = (iso: string) => {
    const d = new Date(iso)
    return d.toLocaleString('ko-KR', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
  }

  const formatDuration = (job: Job) => {
    if (!job.started_at) return '-'
    const start = new Date(job.started_at).getTime()
    const end = job.completed_at ? new Date(job.completed_at).getTime() : Date.now()
    const sec = Math.round((end - start) / 1000)
    if (sec < 60) return `${sec}초`
    return `${Math.floor(sec / 60)}분 ${sec % 60}초`
  }

  if (isLoading) {
    return <div className="loading-state">작업 목록을 불러오는 중...</div>
  }

  return (
    <div className="monitor-wrap">
      {/* Active jobs */}
      {runningJobs.length > 0 && (
        <div className="monitor-section">
          <h4 className="monitor-section-title">
            진행 중 <span className="monitor-count">{runningJobs.length}</span>
          </h4>
          {runningJobs.map((job) => (
            <div key={job.id} className={`campaign-card ${job.status}`}>
              <div className="campaign-header">
                <div className="campaign-title">
                  <span className={`status-dot ${job.status}`} />
                  <span>{job.label || `작업 #${job.id}`}</span>
                </div>
                <StatusBadge status={job.status} />
              </div>

              <div className="campaign-meta">
                {job.platform && <span>{PLATFORM_LABELS[job.platform] || job.platform}</span>}
                <span>{job.targets.length}개 대상</span>
                <span>{formatDuration(job)}</span>
              </div>

              {job.status === 'running' && job.progress && (
                <div className="campaign-progress">
                  <div className="progress-bar">
                    <div
                      className="progress-fill"
                      style={{ width: `${job.progress.percentage}%` }}
                    />
                  </div>
                  <div className="campaign-progress-info">
                    <span>{job.progress.collected} / {job.progress.target} 완료</span>
                    <span>{job.progress.percentage}%</span>
                  </div>
                </div>
              )}

              <div className="campaign-stats">
                <div className="campaign-stat">
                  <span className="campaign-stat-value">{job.total_leads_found}</span>
                  <span className="campaign-stat-label">발견된 리드</span>
                </div>
                {job.category_tags?.length > 0 && (
                  <div className="campaign-tags">
                    {job.category_tags.map((tag) => (
                      <span key={tag} className="campaign-tag">{tag}</span>
                    ))}
                  </div>
                )}
              </div>

              <button
                className="btn-small btn-cancel"
                onClick={() => handleCancel(job.id)}
              >
                중단
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Recent completed jobs */}
      {recentJobs.length > 0 && (
        <div className="monitor-section">
          <h4 className="monitor-section-title">최근 완료</h4>
          {recentJobs.map((job) => (
            <div key={job.id} className={`campaign-card done ${job.status}`}>
              <div className="campaign-header">
                <div className="campaign-title">
                  <span>{job.label || `작업 #${job.id}`}</span>
                </div>
                <StatusBadge status={job.status} />
              </div>
              <div className="campaign-meta">
                {job.platform && <span>{PLATFORM_LABELS[job.platform] || job.platform}</span>}
                <span>{job.targets.length}개 대상</span>
                <span>리드 {job.total_leads_found}건</span>
                <span>{formatTime(job.inserted_at)}</span>
              </div>
            </div>
          ))}
        </div>
      )}

      {runningJobs.length === 0 && recentJobs.length === 0 && (
        <div className="empty-state">
          <span className="empty-state-icon">{'\u{1F4E6}'}</span>
          <h3>수집 작업이 없습니다</h3>
          <p>&ldquo;새 수집 설정&rdquo; 탭에서 작업을 시작하세요</p>
        </div>
      )}
    </div>
  )
}
