import { useState, useEffect } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { getJobs } from '../api/jobs'
import { getLeads } from '../api/leads'
import { addToMasterList } from '../api/masterList'
import StatusBadge from './StatusBadge'
import type { Job, Lead, AddToMasterListResult } from '../types'
import { PLATFORM_LABELS, TERMINATION_LABELS, SOURCE_TYPE_LABELS } from '../types'

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
  const finishedJobs = jobs?.filter((j: Job) =>
    (['completed', 'completed_low_yield', 'failed', 'cancelled'] as string[]).includes(j.status)
  ) || []

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

  const selectedJob = finishedJobs.find((j: Job) => j.id === selectedJobId)
  const emailLeads = leads?.filter((l: Lead) => l.email) || []
  const manualReviewLeads = leads?.filter((l: Lead) => !l.email) || []
  const emailCount = emailLeads.length
  const avgConfidence = emailLeads.length
    ? emailLeads.reduce((sum: number, l: Lead) => sum + l.confidence_score, 0) / emailLeads.length
    : 0

  // Sort leads: email leads first (by confidence desc), then manual review
  const sortedLeads = leads ? [
    ...emailLeads.sort((a: Lead, b: Lead) => b.confidence_score - a.confidence_score),
    ...manualReviewLeads.sort((a: Lead, b: Lead) => b.confidence_score - a.confidence_score),
  ] : []

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
              {job.label || `탐색 #${job.id}`} — 이메일 {job.total_leads_found}건
              {job.status === 'failed' ? ' (실패)' : job.status === 'completed_low_yield' ? ' (목표 미달)' : job.status === 'cancelled' ? ' (취소)' : ''}
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
            <button className="btn btn-secondary" onClick={() => window.open(`/api/export/leads?job_id=${selectedJobId}`, '_blank')}>
              JSON 내보내기 (운영자용)
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
            <div className="results-metric results-metric-primary">
              <span className="results-metric-value">{emailCount}</span>
              <span className="results-metric-label">이메일 확보</span>
            </div>
            <div className="results-metric">
              <span className="results-metric-value">{manualReviewLeads.length}</span>
              <span className="results-metric-label">직접 확인 필요</span>
            </div>
            <div className="results-metric">
              <span className="results-metric-value">{leads?.length || 0}</span>
              <span className="results-metric-label">전체 채널</span>
            </div>
            <div className="results-metric">
              <span className="results-metric-value">{Math.round(avgConfidence * 100)}%</span>
              <span className="results-metric-label">평균 정확도</span>
            </div>
          </div>

          {/* Termination reason */}
          {selectedJob?.termination_reason && (
            <div className="termination-info" style={{
              padding: '10px 14px',
              marginBottom: '16px',
              borderRadius: '8px',
              background: selectedJob.termination_reason === 'target_reached' ? 'var(--green-50, #f0fdf4)' : 'var(--yellow-50, #fffbeb)',
              border: `1px solid ${selectedJob.termination_reason === 'target_reached' ? 'var(--green-200, #bbf7d0)' : 'var(--yellow-200, #fde68a)'}`,
              fontSize: '13px',
              color: 'var(--gray-700)',
            }}>
              <strong>종료 사유:</strong>{' '}
              {TERMINATION_LABELS[selectedJob.termination_reason] || selectedJob.termination_reason}
              {selectedJob.crawl_stats && (
                <span style={{ marginLeft: '12px', color: 'var(--gray-500)' }}>
                  | 키워드 {selectedJob.crawl_stats.keywords_tried}/{selectedJob.crawl_stats.keywords_total}개 탐색
                  | 채널 {selectedJob.crawl_stats.channels_discovered}개 발견
                  {selectedJob.crawl_stats.duplicates_skipped > 0 &&
                    ` | 중복 ${selectedJob.crawl_stats.duplicates_skipped}건 건너뜀`}
                </span>
              )}
            </div>
          )}

          {/* Table */}
          {leadsLoading ? (
            <div className="loading-state">불러오는 중...</div>
          ) : !sortedLeads.length ? (
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
                      <th>출처</th>
                      <th>상태</th>
                    </tr>
                  </thead>
                  <tbody>
                    {sortedLeads.map((lead: Lead) => (
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
                        <td>
                          {lead.source_type && (
                            <span className="source-badge" title={lead.source_url || undefined}>
                              {SOURCE_TYPE_LABELS[lead.source_type] || lead.source_type}
                            </span>
                          )}
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
