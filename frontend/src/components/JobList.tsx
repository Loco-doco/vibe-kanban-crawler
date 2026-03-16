import { useQuery } from '@tanstack/react-query'
import { getJobs, cancelJob } from '../api/jobs'
import StatusBadge from './StatusBadge'
import type { Job } from '../types'

interface Props {
  selectedJobId: number | null
  onSelectJob: (id: number | null) => void
}

export default function JobList({ selectedJobId, onSelectJob }: Props) {
  const { data: jobs, isLoading } = useQuery({
    queryKey: ['jobs'],
    queryFn: getJobs,
    refetchInterval: 5000,
  })

  if (isLoading) return <p>Loading jobs...</p>

  return (
    <div className="job-list">
      <h3>Jobs</h3>
      {!jobs?.length && <p className="muted">No jobs yet</p>}
      {jobs?.map((job: Job) => (
        <div
          key={job.id}
          className={`job-card ${selectedJobId === job.id ? 'selected' : ''}`}
          onClick={() => onSelectJob(selectedJobId === job.id ? null : job.id)}
        >
          <div className="job-header">
            <span>#{job.id}</span>
            <StatusBadge status={job.status} />
          </div>
          <div className="job-meta">
            <span>{job.targets.length} URL(s)</span>
            <span>{job.total_leads_found} leads</span>
          </div>
          <div className="job-meta">
            <span className="muted">
              {new Date(job.inserted_at).toLocaleString()}
            </span>
          </div>
          {(job.status === 'pending' || job.status === 'running') && (
            <button
              className="btn-small btn-cancel"
              onClick={(e) => {
                e.stopPropagation()
                cancelJob(job.id)
              }}
            >
              Cancel
            </button>
          )}
        </div>
      ))}
    </div>
  )
}
