import type { Job } from '../types'
import { STATUS_LABELS } from '../types'

type EnrichState = 'idle' | 'running' | 'done' | 'error'

interface Props {
  jobs: Job[]
  selectedJobId: number | null
  onSelect: (jobId: number) => void
  subscriberEnrichState?: EnrichState
  channelEnrichState?: EnrichState
}

const ENRICH_LABELS: Record<string, { running: string; done: string; error: string }> = {
  subscriber: { running: '영향력 보정 실행 중...', done: '영향력 보정 완료', error: '영향력 보정 실패' },
  channel: { running: '프로필 보강 실행 중...', done: '프로필 보강 완료', error: '프로필 보강 실패' },
}

export default function ReviewJobSidebar({ jobs, selectedJobId, onSelect, subscriberEnrichState = 'idle', channelEnrichState = 'idle' }: Props) {
  // Group: parent jobs first, then their supplements underneath
  const parentJobs = jobs.filter(j => !j.parent_job_id)
  const parentIds = new Set(parentJobs.map(j => j.id))
  const supplementMap = new Map<number, Job[]>()
  const orphanedSupplements: Job[] = []

  jobs.filter(j => j.parent_job_id).forEach(j => {
    if (parentIds.has(j.parent_job_id!)) {
      const list = supplementMap.get(j.parent_job_id!) || []
      list.push(j)
      supplementMap.set(j.parent_job_id!, list)
    } else {
      orphanedSupplements.push(j)
    }
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
        {/* Orphaned supplement jobs (parent not in finished list) */}
        {orphanedSupplements.map(sub => (
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
        {jobs.length === 0 && (
          <div className="review-sidebar-empty">완료된 탐색이 없습니다</div>
        )}
      </div>
      {/* Activity log for enrichment (not new searches — P1) */}
      {selectedJobId && (subscriberEnrichState !== 'idle' || channelEnrichState !== 'idle') && (
        <div className="review-sidebar-activity">
          <div className="review-sidebar-activity-header">보정 이력</div>
          {subscriberEnrichState !== 'idle' && (
            <div className={`sidebar-activity-item ${subscriberEnrichState}`}>
              {ENRICH_LABELS.subscriber[subscriberEnrichState as 'running' | 'done' | 'error']}
            </div>
          )}
          {channelEnrichState !== 'idle' && (
            <div className={`sidebar-activity-item ${channelEnrichState}`}>
              {ENRICH_LABELS.channel[channelEnrichState as 'running' | 'done' | 'error']}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
