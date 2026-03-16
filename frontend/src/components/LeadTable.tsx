import { useQuery } from '@tanstack/react-query'
import { getLeads } from '../api/leads'
import StatusBadge from './StatusBadge'
import type { Lead } from '../types'

interface Props {
  jobId: number | null
}

function confidenceLabel(score: number): string {
  if (score >= 0.7) return '높음'
  if (score >= 0.4) return '보통'
  return '낮음'
}

export default function LeadTable({ jobId }: Props) {
  const { data: leads, isLoading } = useQuery({
    queryKey: ['leads', jobId],
    queryFn: () => getLeads(jobId ? { job_id: jobId } : {}),
    refetchInterval: 5000,
  })

  if (isLoading) return <p>결과를 불러오는 중...</p>
  if (!leads?.length) {
    return (
      <div className="empty-state">
        <p>아직 수집된 결과가 없습니다</p>
        <p className="muted">
          왼쪽에서 크리에이터 채널 주소를 입력하고 '수집 시작'을 눌러보세요.
        </p>
      </div>
    )
  }

  return (
    <div className="lead-table-wrapper">
      <table className="lead-table">
        <thead>
          <tr>
            <th>이메일</th>
            <th>플랫폼</th>
            <th>채널명</th>
            <th>구독자 수</th>
            <th>정확도</th>
            <th>상태</th>
            <th>출처</th>
          </tr>
        </thead>
        <tbody>
          {leads.map((lead: Lead) => (
            <tr key={lead.id}>
              <td>{lead.email || <em className="muted">(이메일 없음)</em>}</td>
              <td>{lead.platform}</td>
              <td>
                {lead.channel_url ? (
                  <a href={lead.channel_url} target="_blank" rel="noopener noreferrer">
                    {lead.channel_name || '채널 보기'}
                  </a>
                ) : (
                  lead.channel_name || '-'
                )}
              </td>
              <td>{lead.subscriber_count?.toLocaleString('ko-KR') ?? '-'}</td>
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
                  {(lead.confidence_score * 100).toFixed(0)}% ({confidenceLabel(lead.confidence_score)})
                </span>
              </td>
              <td>
                <StatusBadge status={lead.status} />
              </td>
              <td>
                <a href={lead.evidence_link} target="_blank" rel="noopener noreferrer">
                  출처 보기
                </a>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
