import { useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { getLeads } from '../api/leads'
import { formatDateTime } from '../utils/datetime'
import type { Job, Lead } from '../types'
import {
  PLATFORM_LABELS,
  TERMINATION_SENTENCES,
  TERMINATION_LABELS,
  SOURCE_TYPE_LABELS,
} from '../types'

interface Props {
  job: Job
  onViewResults?: (jobId: number) => void
}

const TERMINATION_STYLES: Record<string, string> = {
  target_reached: 'positive',
  sources_exhausted: 'warning',
  duplicate_heavy: 'warning',
  insufficient_contact_coverage: 'warning',
  timeout: 'error',
  system_error: 'error',
  user_cancelled: 'neutral',
}

const PREVIEW_LIMIT = 10

function formatSubscribers(count: number | null): string {
  if (!count) return '-'
  if (count >= 10000) return `${(count / 10000).toFixed(count % 10000 === 0 ? 0 : 1)}만`
  if (count >= 1000) return `${(count / 1000).toFixed(count % 1000 === 0 ? 0 : 1)}천`
  return count.toLocaleString()
}

function formatLeadTime(iso: string): string {
  return formatDateTime(iso)
}

export default function JobDetailPanel({ job, onViewResults }: Props) {
  // Fetch leads for source breakdown
  // TODO: 장기적으로는 aggregate API 또는 job detail 응답에 breakdown 포함 방식으로 전환
  const { data: leads } = useQuery({
    queryKey: ['leads', { job_id: job.id, limit: 500 }],
    queryFn: () => getLeads({ job_id: job.id, limit: 500 }),
    staleTime: 10000,
  })

  const sourceBreakdown = useMemo(() => {
    if (!leads?.length) return []
    const counts: Record<string, number> = {}
    leads.forEach((lead: Lead) => {
      const key = lead.source_type || 'unknown'
      counts[key] = (counts[key] || 0) + 1
    })
    return Object.entries(counts)
      .map(([type, count]) => ({
        type,
        count,
        label: SOURCE_TYPE_LABELS[type] || type,
        percentage: Math.round((count / leads.length) * 100),
      }))
      .sort((a, b) => b.count - a.count)
  }, [leads])

  const isDone = ['completed', 'completed_low_yield', 'failed', 'cancelled'].includes(job.status)
  const isActive = ['running', 'partial_results'].includes(job.status)
  const hasLeads = (leads?.length || 0) > 0

  // CTA rules
  const ctaLabel = (() => {
    if (!hasLeads) return null
    if (isActive) return '중간 결과 보기 →'
    if (isDone) return '결과 보기 →'
    return null
  })()

  // Recent leads for preview (most recent first, limit to PREVIEW_LIMIT)
  const recentLeads = useMemo(() => {
    if (!leads?.length) return []
    return [...leads]
      .sort((a: Lead, b: Lead) => new Date(b.inserted_at).getTime() - new Date(a.inserted_at).getTime())
      .slice(0, PREVIEW_LIMIT)
  }, [leads])

  const keywords: string[] = job.keywords || []
  const categoryTags: string[] = job.category_tags || []

  return (
    <div className="job-detail-panel">
      {/* 탐색 조건 요약 */}
      <div className="job-detail-section">
        <div className="job-detail-section-title">탐색 조건</div>

        {keywords.length > 0 && (
          <div className="job-detail-row">
            <span className="job-detail-row-label">키워드</span>
            <div className="job-detail-keywords">
              {keywords.map((kw) => (
                <span key={kw} className="job-detail-keyword">{kw}</span>
              ))}
            </div>
          </div>
        )}

        {categoryTags.length > 0 && (
          <div className="job-detail-row">
            <span className="job-detail-row-label">카테고리</span>
            <div className="job-detail-keywords">
              {categoryTags.map((tag) => (
                <span key={tag} className="job-detail-keyword category">{tag}</span>
              ))}
            </div>
          </div>
        )}

        {job.extra_conditions && (
          <div className="job-detail-row">
            <span className="job-detail-row-label">리뷰 참고 조건</span>
            <span className="job-detail-extra-conditions">{job.extra_conditions}</span>
          </div>
        )}

        <div className="job-detail-conditions">
          {(job.subscriber_min || job.subscriber_max) && (
            <div className="job-detail-condition">
              <span className="job-detail-condition-label">구독자 범위</span>
              <span className="job-detail-condition-value">
                {formatSubscribers(job.subscriber_min)} ~ {formatSubscribers(job.subscriber_max)}
              </span>
            </div>
          )}
          <div className="job-detail-condition">
            <span className="job-detail-condition-label">수집 목표</span>
            <span className="job-detail-condition-value">
              {job.target_count ?? '-'}건
            </span>
          </div>
          {job.platform && (
            <div className="job-detail-condition">
              <span className="job-detail-condition-label">플랫폼</span>
              <span className="job-detail-condition-value">
                {job.platform.split(',').map((p) => PLATFORM_LABELS[p] || p).join(', ')}
              </span>
            </div>
          )}
          <div className="job-detail-condition">
            <span className="job-detail-condition-label">이메일 확보</span>
            <span className="job-detail-condition-value">
              {job.total_leads_found} / {job.target_count ?? '-'}건
            </span>
          </div>
        </div>
      </div>

      {/* 종료 사유 */}
      {job.termination_reason && isDone && (
        <div className="job-detail-section">
          <div className="job-detail-section-title">종료 사유</div>
          <div className={`termination-sentence ${TERMINATION_STYLES[job.termination_reason] || 'neutral'}`}>
            <span className="termination-sentence-label">
              {TERMINATION_LABELS[job.termination_reason] || job.termination_reason}
            </span>
            <p className="termination-sentence-text">
              {TERMINATION_SENTENCES[job.termination_reason] || job.termination_reason}
            </p>
          </div>
        </div>
      )}

      {/* Crawl Stats */}
      {job.crawl_stats && (
        <div className="job-detail-section">
          <div className="job-detail-section-title">탐색 통계</div>
          <div className="crawl-stats-grid">
            <div className="crawl-stat-item">
              <span className="crawl-stat-value">{job.crawl_stats.channels_discovered}</span>
              <span className="crawl-stat-label">발견 채널</span>
            </div>
            <div className="crawl-stat-item">
              <span className="crawl-stat-value">
                {job.crawl_stats.keywords_tried}/{job.crawl_stats.keywords_total}
              </span>
              <span className="crawl-stat-label">키워드 탐색</span>
            </div>
            <div className="crawl-stat-item">
              <span className="crawl-stat-value">{job.crawl_stats.qualified_count}</span>
              <span className="crawl-stat-label">적격 리드</span>
            </div>
            <div className="crawl-stat-item">
              <span className="crawl-stat-value">{job.crawl_stats.channels_no_email}</span>
              <span className="crawl-stat-label">이메일 미보유</span>
            </div>
            <div className="crawl-stat-item">
              <span className="crawl-stat-value">{job.crawl_stats.duplicates_skipped}</span>
              <span className="crawl-stat-label">중복 건너뜀</span>
            </div>
          </div>
        </div>
      )}

      {/* Source Breakdown */}
      {sourceBreakdown.length > 0 && (
        <div className="job-detail-section">
          <div className="job-detail-section-title">소스 분포</div>
          <div className="source-breakdown">
            {sourceBreakdown.map(({ type, count, label, percentage }) => (
              <div key={type} className="source-breakdown-row">
                <span className="source-breakdown-label">{label}</span>
                <div className="source-breakdown-bar">
                  <div className="source-breakdown-fill" style={{ width: `${percentage}%` }} />
                </div>
                <span className="source-breakdown-count">{count}건 ({percentage}%)</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 현재 확보 리드 미리보기 (running/partial_results, 읽기 전용) */}
      {!isDone && leads && leads.length > 0 && (
        <div className="job-detail-section">
          <div className="job-detail-section-title">
            현재 확보 리드
            <span className="job-detail-section-count">
              {leads.length > PREVIEW_LIMIT
                ? `총 ${leads.length}건 중 최근 ${PREVIEW_LIMIT}건 표시`
                : `${leads.length}건`}
            </span>
          </div>
          <div className="lead-preview-table-wrap">
            <table className="lead-preview-table">
              <thead>
                <tr>
                  <th>채널명</th>
                  <th>이메일</th>
                  <th>출처</th>
                  <th>키워드</th>
                  <th>수집 시각</th>
                </tr>
              </thead>
              <tbody>
                {recentLeads.map((lead: Lead) => (
                  <tr key={lead.id} className={lead.email ? '' : 'lead-no-email'}>
                    <td>
                      {lead.channel_url ? (
                        <a href={lead.channel_url} target="_blank" rel="noopener noreferrer" className="channel-link">
                          {lead.channel_name || '채널 보기'}
                        </a>
                      ) : (
                        lead.channel_name || '-'
                      )}
                    </td>
                    <td className="lead-email-cell">
                      {lead.email
                        ? <span className="lead-email-badge has-email">확보</span>
                        : <span className="lead-email-badge no-email">미확보</span>}
                    </td>
                    <td>
                      {lead.source_type && (
                        <span className="source-badge-sm">
                          {SOURCE_TYPE_LABELS[lead.source_type] || lead.source_type}
                        </span>
                      )}
                    </td>
                    <td className="lead-keyword-cell">
                      {lead.discovery_keyword || '-'}
                    </td>
                    <td className="lead-time-cell">
                      {formatLeadTime(lead.inserted_at)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {leads && leads.length === 0 && isDone && (
        <div className="job-detail-section">
          <div className="job-detail-empty">수집된 리드가 없습니다</div>
        </div>
      )}

      {/* CTA: 상태/리드 수 조건별 */}
      {(ctaLabel || isDone) && (
        <div className="job-detail-cta">
          {ctaLabel && onViewResults && (
            <button
              className="btn btn-primary btn-small"
              onClick={() => onViewResults(job.id)}
            >
              {ctaLabel}
            </button>
          )}
          {isDone && hasLeads && (
            <button
              className="btn btn-secondary btn-small"
              onClick={() => window.open(`/api/export/jobs/${job.id}`, '_blank')}
            >
              JSON 내보내기
            </button>
          )}
        </div>
      )}
    </div>
  )
}
