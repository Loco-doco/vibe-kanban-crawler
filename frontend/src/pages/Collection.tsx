import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import JobForm from '../components/JobForm'
import JobList from '../components/JobList'
import { getLeads } from '../api/leads'
import { addToMasterList } from '../api/masterList'
import StatusBadge from '../components/StatusBadge'
import type { Lead } from '../types'
import { PLATFORM_LABELS } from '../types'

export default function Collection() {
  const [selectedJobId, setSelectedJobId] = useState<number | null>(null)

  const { data: leads, isLoading: leadsLoading } = useQuery({
    queryKey: ['leads', { job_id: selectedJobId }],
    queryFn: () => getLeads({ job_id: selectedJobId! }),
    enabled: selectedJobId !== null,
  })

  const handleExportCsv = () => {
    if (!selectedJobId) return
    const url = `/api/leads/export/csv?job_id=${selectedJobId}`
    window.open(url, '_blank')
  }

  const handleAddToMasterList = async () => {
    if (!selectedJobId) return
    try {
      const result = await addToMasterList(selectedJobId)
      alert(`마스터 리스트에 ${result.added}건 추가되었습니다.${result.duplicates.length > 0 ? ` (중복 ${result.duplicates.length}건)` : ''}`)
    } catch {
      alert('마스터 리스트 추가 중 오류가 발생했습니다.')
    }
  }

  const confidenceClass = (score: number) => {
    if (score >= 0.7) return 'high'
    if (score >= 0.4) return 'mid'
    return 'low'
  }

  const formatSubscribers = (count: number | null) => {
    if (!count) return '-'
    if (count >= 10000) return `${(count / 10000).toFixed(1)}만`
    if (count >= 1000) return `${(count / 1000).toFixed(1)}천`
    return String(count)
  }

  return (
    <>
      <div className="page-header">
        <div>
          <h2>리드 수집</h2>
          <p className="page-header-sub">크롤러를 이용해 크리에이터의 연락처를 수집하세요</p>
        </div>
      </div>

      <div className="collection-layout">
        <JobForm />
        <JobList selectedJobId={selectedJobId} onSelectJob={setSelectedJobId} />
      </div>

      {selectedJobId && (
        <div className="card">
          <div className="card-header">
            <div className="collection-results-header">
              <h2 className="card-title">작업 #{selectedJobId} 수집 결과</h2>
              <div className="collection-results-actions">
                <button className="btn btn-secondary" onClick={handleAddToMasterList}>
                  {'\u{1F4CB}'} 마스터 리스트에 추가
                </button>
                <button className="btn btn-secondary" onClick={handleExportCsv}>
                  {'\u2B07\uFE0F'} CSV 내보내기
                </button>
              </div>
            </div>
          </div>

          {leadsLoading ? (
            <div className="loading-state">불러오는 중...</div>
          ) : !leads?.length ? (
            <div className="empty-state">
              <span className="empty-state-icon">{'\u{1F50D}'}</span>
              <h3>아직 수집된 리드가 없습니다</h3>
              <p>작업이 완료되면 수집된 리드가 여기에 표시됩니다</p>
            </div>
          ) : (
            <div className="table-wrap">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>이메일</th>
                    <th>플랫폼</th>
                    <th>채널명</th>
                    <th>구독자</th>
                    <th>정확도</th>
                    <th>상태</th>
                  </tr>
                </thead>
                <tbody>
                  {leads.map((lead: Lead) => (
                    <tr key={lead.id}>
                      <td className="email-cell">{lead.email || '-'}</td>
                      <td>
                        <span className={`platform-badge ${lead.platform}`}>
                          {PLATFORM_LABELS[lead.platform] || lead.platform}
                        </span>
                      </td>
                      <td>{lead.channel_name || '-'}</td>
                      <td>{formatSubscribers(lead.subscriber_count)}</td>
                      <td>
                        <span className={`confidence ${confidenceClass(lead.confidence_score)}`}>
                          {Math.round(lead.confidence_score * 100)}%
                        </span>
                      </td>
                      <td><StatusBadge status={lead.status} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {!selectedJobId && (
        <div className="card">
          <div className="empty-state">
            <span className="empty-state-icon">{'\u{1F449}'}</span>
            <h3>작업을 선택하세요</h3>
            <p>왼쪽에서 새 수집 작업을 만들거나, 오른쪽 목록에서 작업을 클릭하면 수집 결과를 확인할 수 있습니다</p>
          </div>
        </div>
      )}
    </>
  )
}
