import { useQuery } from '@tanstack/react-query'
import { getLeads } from '../api/leads'
import StatusBadge from './StatusBadge'
import type { Lead } from '../types'

interface Props {
  jobId: number | null
}

export default function LeadTable({ jobId }: Props) {
  const { data: leads, isLoading } = useQuery({
    queryKey: ['leads', jobId],
    queryFn: () => getLeads(jobId ? { job_id: jobId } : {}),
    refetchInterval: 5000,
  })

  if (isLoading) return <p>Loading leads...</p>
  if (!leads?.length) return <p className="muted">No leads found</p>

  return (
    <div className="lead-table-wrapper">
      <table className="lead-table">
        <thead>
          <tr>
            <th>Email</th>
            <th>Platform</th>
            <th>Channel</th>
            <th>Subscribers</th>
            <th>Confidence</th>
            <th>Status</th>
            <th>Evidence</th>
          </tr>
        </thead>
        <tbody>
          {leads.map((lead: Lead) => (
            <tr key={lead.id}>
              <td>{lead.email || <em className="muted">N/A</em>}</td>
              <td>{lead.platform}</td>
              <td>
                {lead.channel_url ? (
                  <a href={lead.channel_url} target="_blank" rel="noopener noreferrer">
                    {lead.channel_name || 'Link'}
                  </a>
                ) : (
                  lead.channel_name || '-'
                )}
              </td>
              <td>{lead.subscriber_count?.toLocaleString() ?? '-'}</td>
              <td>
                <span
                  style={{
                    color:
                      lead.confidence_score >= 0.7
                        ? '#10b981'
                        : lead.confidence_score >= 0.4
                        ? '#f59e0b'
                        : '#ef4444',
                    fontWeight: 600,
                  }}
                >
                  {(lead.confidence_score * 100).toFixed(0)}%
                </span>
              </td>
              <td>
                <StatusBadge status={lead.status} />
              </td>
              <td>
                <a href={lead.evidence_link} target="_blank" rel="noopener noreferrer">
                  View
                </a>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
