import { useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { getLeads } from '../api/leads'
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

function formatSubscribers(count: number | null): string {
  if (!count) return '-'
  if (count >= 10000) return `${(count / 10000).toFixed(count % 10000 === 0 ? 0 : 1)}만`
  if (count >= 1000) return `${(count / 1000).toFixed(count % 1000 === 0 ? 0 : 1)}천`
  return count.toLocaleString()
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
  const canViewResults = isDone && job.total_leads_found > 0

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
            <span className="job-detail-condition-label">수집 결과</span>
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

      {leads && leads.length === 0 && isDone && (
        <div className="job-detail-section">
          <div className="job-detail-empty">수집된 리드가 없습니다</div>
        </div>
      )}

      {/* 결과 보기 CTA */}
      {canViewResults && onViewResults && (
        <div className="job-detail-cta">
          <button
            className="btn btn-primary btn-small"
            onClick={() => onViewResults(job.id)}
          >
            결과 보기 →
          </button>
        </div>
      )}
    </div>
  )
}
