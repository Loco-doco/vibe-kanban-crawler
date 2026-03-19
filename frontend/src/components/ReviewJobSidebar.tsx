import type { Job } from '../types'
import { STATUS_LABELS } from '../types'

interface Props {
  jobs: Job[]
  selectedJobId: number | null
  onSelect: (jobId: number) => void
}

export default function ReviewJobSidebar({ jobs, selectedJobId, onSelect }: Props) {
  // Group: parent jobs first, then their supplements underneath
  const parentJobs = jobs.filter(j => !j.parent_job_id)
  const supplementMap = new Map<number, Job[]>()
  jobs.filter(j => j.parent_job_id).forEach(j => {
    const list = supplementMap.get(j.parent_job_id!) || []
    list.push(j)
    supplementMap.set(j.parent_job_id!, list)
  })

  return (
    <div className="review-sidebar">
      <div className="review-sidebar-header">
        <h3>완료된 탐색</h3>
        <span className="review-sidebar-count">{jobs.length}건</span>
      </div>
      <div className="review-sidebar-list">
        {parentJobs.map(job => (
          <div key={job.id}>
            <button
              className={`review-sidebar-item${selectedJobId === job.id ? ' active' : ''}`}
              onClick={() => onSelect(job.id)}
            >
              <div className="review-sidebar-item-title">
                {job.label || `탐색 #${job.id}`}
              </div>
              <div className="review-sidebar-item-meta">
                <span className={`review-sidebar-status ${job.status}`}>
                  {STATUS_LABELS[job.status] || job.status}
                </span>
                <span className="review-sidebar-item-count">
                  {job.total_leads_found}건
                </span>
              </div>
            </button>
            {/* Supplementary jobs */}
            {supplementMap.get(job.id)?.map(sub => (
              <button
                key={sub.id}
                className={`review-sidebar-item supplement${selectedJobId === sub.id ? ' active' : ''}`}
                onClick={() => onSelect(sub.id)}
              >
                <div className="review-sidebar-item-title">
                  <span className="supplement-badge">보완</span>
                  {sub.label || `보완 #${sub.id}`}
                </div>
                <div className="review-sidebar-item-meta">
                  <span className={`review-sidebar-status ${sub.status}`}>
                    {STATUS_LABELS[sub.status] || sub.status}
                  </span>
                  <span className="review-sidebar-item-count">
                    {sub.total_leads_found}건
                  </span>
                </div>
              </button>
            ))}
          </div>
        ))}
        {jobs.length === 0 && (
          <div className="review-sidebar-empty">완료된 탐색이 없습니다</div>
        )}
      </div>
    </div>
  )
}
