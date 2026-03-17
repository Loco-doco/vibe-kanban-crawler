import { useState, useEffect } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { getJobs } from '../api/jobs'
import { getLeads } from '../api/leads'
import { addToMasterList } from '../api/masterList'
import StatusBadge from './StatusBadge'
import type { Job, Lead, AddToMasterListResult } from '../types'
import { PLATFORM_LABELS } from '../types'

interface Props {
  initialJobId?: number | null
}

export default function CollectionResults({ initialJobId }: Props) {
  const [selectedJobId, setSelectedJobId] = useState<number | ''>('')
  const [addResult, setAddResult] = useState<AddToMasterListResult | null>(null)
  const [addError, setAddError] = useState('')
  const [isAdding, setIsAdding] = useState(false)
  const navigate = useNavigate()
  const queryClient = useQueryClient()

  useEffect(() => {
    if (initialJobId) setSelectedJobId(initialJobId)
  }, [initialJobId])

  // Clear add result when job changes
  useEffect(() => {
    setAddResult(null)
    setAddError('')
  }, [selectedJobId])

  const { data: jobs } = useQuery({ queryKey: ['jobs'], queryFn: getJobs })
  const finishedJobs = jobs?.filter((j: Job) => j.status === 'completed' || j.status === 'failed') || []

  const { data: leads, isLoading: leadsLoading } = useQuery({
    queryKey: ['leads', { job_id: selectedJobId }],
    queryFn: () => getLeads({ job_id: selectedJobId as number, limit: 500 }),
    enabled: selectedJobId !== '',
  })

  const handleExportCsv = () => {
    if (!selectedJobId) return
    window.open(`/api/leads/export/csv?job_id=${selectedJobId}`, '_blank')
  }

  const handleAddToMasterList = async () => {
    if (!selectedJobId) return
    setIsAdding(true)
    setAddError('')
    try {
      const result = await addToMasterList(selectedJobId as number)
      setAddResult(result)
      queryClient.invalidateQueries({ queryKey: ['masterList'] })
    } catch {
      setAddError('마스터 리스트 추가 중 오류가 발생했습니다.')
    } finally {
      setIsAdding(false)
    }
  }

  const formatSubscribers = (count: number | null) => {
    if (!count) return '-'
    if (count >= 10000) return `${(count / 10000).toFixed(1)}만`
    if (count >= 1000) return `${(count / 1000).toFixed(1)}천`
    return String(count)
  }

  const confidenceClass = (score: number) => {
    if (score >= 0.7) return 'high'
    if (score >= 0.4) return 'mid'
    return 'low'
  }

  const emailCount = leads?.filter((l: Lead) => l.email).length || 0
  const avgConfidence = leads?.length
    ? leads.reduce((sum: number, l: Lead) => sum + l.confidence_score, 0) / leads.length
    : 0

  return (
    <div className="results-wrap">
      {/* Job selector */}
      <div className="results-selector">
        <select
          className="results-select"
          value={selectedJobId}
          onChange={(e) => setSelectedJobId(e.target.value ? Number(e.target.value) : '')}
        >
          <option value="">탐색을 선택하세요</option>
          {finishedJobs.map((job: Job) => (
            <option key={job.id} value={job.id}>
              {job.label || `탐색 #${job.id}`} — 리드 {job.total_leads_found}건
              {job.status === 'failed' ? ' (실패)' : ''}
            </option>
          ))}
        </select>

        {selectedJobId && (
          <div className="results-actions">
            <button
              className="btn btn-primary"
              onClick={handleAddToMasterList}
              disabled={isAdding || !leads?.length}
            >
              {isAdding ? '추가 중...' : '\u{1F4CB} 마스터 리스트 추가'}
            </button>
            <button className="btn btn-secondary" onClick={handleExportCsv}>
              {'\u2B07\uFE0F'} CSV 내보내기
            </button>
          </div>
        )}
      </div>

      {/* Add Result Banner */}
      {addResult && (
        <div className="add-result-banner">
          <div className="add-result-info">
            <strong>{addResult.added}건</strong> 마스터 리스트에 추가됨
            {addResult.duplicates.length > 0 && (
              <span className="add-result-dup"> (중복 {addResult.duplicates.length}건 — 이미 등록된 리드)</span>
            )}
          </div>
          <button
            className="btn btn-primary btn-sm"
            onClick={() => navigate('/master-list')}
          >
            마스터 리스트 보기 {'\u2192'}
          </button>
        </div>
      )}

      {/* Add Error */}
      {addError && (
        <div className="campaign-error" style={{ marginBottom: 16 }}>{addError}</div>
      )}

      {!selectedJobId && (
        <div className="empty-state">
          <span className="empty-state-icon">{'\u{1F4C2}'}</span>
          <h3>탐색을 선택하세요</h3>
          <p>위 드롭다운에서 완료된 탐색을 선택하면 수집 결과를 확인할 수 있습니다</p>
        </div>
      )}

      {selectedJobId && (
        <>
          {/* Metrics */}
          <div className="results-metrics">
            <div className="results-metric">
              <span className="results-metric-value">{leads?.length || 0}</span>
              <span className="results-metric-label">총 수집</span>
            </div>
            <div className="results-metric">
              <span className="results-metric-value">{emailCount}</span>
              <span className="results-metric-label">이메일 확보</span>
            </div>
            <div className="results-metric">
              <span className="results-metric-value">
                {leads?.length ? Math.round((emailCount / leads.length) * 100) : 0}%
              </span>
              <span className="results-metric-label">이메일 확보율</span>
            </div>
            <div className="results-metric">
              <span className="results-metric-value">{Math.round(avgConfidence * 100)}%</span>
              <span className="results-metric-label">평균 정확도</span>
            </div>
          </div>

          {/* Table */}
          {leadsLoading ? (
            <div className="loading-state">불러오는 중...</div>
          ) : !leads?.length ? (
            <div className="empty-state">
              <span className="empty-state-icon">{'\u{1F50D}'}</span>
              <h3>수집된 리드가 없습니다</h3>
              <p>이 탐색에서는 리드가 발견되지 않았습니다</p>
            </div>
          ) : (
            <div className="card" style={{ marginTop: 0 }}>
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
                        <td className="email-cell">
                          {lead.email || <span style={{ color: 'var(--gray-400)', fontStyle: 'italic' }}>이메일 없음</span>}
                        </td>
                        <td>
                          <span className={`platform-badge ${lead.platform}`}>
                            {PLATFORM_LABELS[lead.platform] || lead.platform}
                          </span>
                        </td>
                        <td>
                          {lead.channel_url ? (
                            <a href={lead.channel_url} target="_blank" rel="noopener noreferrer" className="channel-link">
                              {lead.channel_name || '채널 보기'}
                              <span className="channel-link-icon">{'\u2197'}</span>
                            </a>
                          ) : (
                            lead.channel_name || '-'
                          )}
                        </td>
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
            </div>
          )}
        </>
      )}
    </div>
  )
}
