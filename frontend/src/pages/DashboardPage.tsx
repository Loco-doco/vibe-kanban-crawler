import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { getJobs, cancelJob } from '../api/jobs'
import type { Job } from '../types'
import { PLATFORM_LABELS, STATUS_LABELS } from '../types'

function formatNumber(n: number | null | undefined): string {
  if (n == null) return '-'
  return n.toLocaleString('ko-KR')
}

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleString('ko-KR', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function JobCard({ job }: { job: Job }) {
  const queryClient = useQueryClient()
  const cancelMutation = useMutation({
    mutationFn: () => cancelJob(job.id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['jobs'] }),
  })

  const isActive = job.status === 'running' || job.status === 'pending'
  const statusClass = `status-${job.status}`

  return (
    <Link to={`/jobs/${job.id}`} className={`job-card ${statusClass}`}>
      <div className="job-card-header">
        <h3 className="job-card-title">
          {job.label || `수집 작업 #${job.id}`}
        </h3>
        <span className={`status-badge ${statusClass}`}>
          {STATUS_LABELS[job.status] || job.status}
        </span>
      </div>

      {job.platform && (
        <div className="job-card-platform">
          {PLATFORM_LABELS[job.platform] || job.platform}
        </div>
      )}

      {job.category_tags && job.category_tags.length > 0 && (
        <div className="job-card-tags">
          {job.category_tags.slice(0, 3).map((tag) => (
            <span key={tag} className="tag">{tag}</span>
          ))}
          {job.category_tags.length > 3 && (
            <span className="tag tag-more">+{job.category_tags.length - 3}</span>
          )}
        </div>
      )}

      <div className="job-card-progress">
        <div className="progress-bar">
          <div
            className="progress-fill"
            style={{ width: `${job.progress.percentage}%` }}
          />
        </div>
        <div className="progress-text">
          <span>{formatNumber(job.progress.collected)}건 수집</span>
          {job.progress.target > 0 && (
            <span>목표 {formatNumber(job.progress.target)}건</span>
          )}
        </div>
      </div>

      <div className="job-card-footer">
        <span className="job-card-date">{formatDate(job.inserted_at)}</span>
        {isActive && (
          <button
            className="btn-cancel-small"
            onClick={(e) => {
              e.preventDefault()
              e.stopPropagation()
              cancelMutation.mutate()
            }}
          >
            중지
          </button>
        )}
      </div>
    </Link>
  )
}

export default function DashboardPage() {
  const { data: jobs = [], isLoading } = useQuery({
    queryKey: ['jobs'],
    queryFn: getJobs,
    refetchInterval: 3000,
  })

  const activeJobs = jobs.filter((j) => j.status === 'running' || j.status === 'pending')
  const completedJobs = jobs.filter((j) => j.status === 'completed')
  const totalCollected = jobs.reduce((sum, j) => sum + j.total_leads_found, 0)

  return (
    <div className="dashboard-page">
      <div className="dashboard-stats">
        <div className="stat-card">
          <div className="stat-value">{activeJobs.length}</div>
          <div className="stat-label">진행 중인 수집</div>
        </div>
        <div className="stat-card">
          <div className="stat-value">{completedJobs.length}</div>
          <div className="stat-label">완료된 수집</div>
        </div>
        <div className="stat-card">
          <div className="stat-value">{formatNumber(totalCollected)}</div>
          <div className="stat-label">총 수집된 리드</div>
        </div>
      </div>

      {isLoading ? (
        <div className="loading-state">불러오는 중...</div>
      ) : jobs.length === 0 ? (
        <div className="empty-state">
          <div className="empty-icon">📋</div>
          <h3>아직 수집 작업이 없습니다</h3>
          <p>새 수집을 시작해서 크리에이터 리스트를 만들어 보세요.</p>
          <Link to="/jobs/new" className="btn-primary">
            첫 수집 시작하기
          </Link>
        </div>
      ) : (
        <>
          {activeJobs.length > 0 && (
            <section className="dashboard-section">
              <h2 className="section-title">
                진행 중
                <span className="section-count">{activeJobs.length}</span>
              </h2>
              <div className="job-grid">
                {activeJobs.map((job) => (
                  <JobCard key={job.id} job={job} />
                ))}
              </div>
            </section>
          )}

          {completedJobs.length > 0 && (
            <section className="dashboard-section">
              <h2 className="section-title">
                완료
                <span className="section-count">{completedJobs.length}</span>
              </h2>
              <div className="job-grid">
                {completedJobs.map((job) => (
                  <JobCard key={job.id} job={job} />
                ))}
              </div>
            </section>
          )}

          {jobs.filter((j) => j.status === 'failed' || j.status === 'cancelled').length > 0 && (
            <section className="dashboard-section">
              <h2 className="section-title">기타</h2>
              <div className="job-grid">
                {jobs
                  .filter((j) => j.status === 'failed' || j.status === 'cancelled')
                  .map((job) => (
                    <JobCard key={job.id} job={job} />
                  ))}
              </div>
            </section>
          )}
        </>
      )}
    </div>
  )
}
