import type { QualityMetrics } from '../types'

interface Props {
  quality: QualityMetrics
  onFilterClick?: (filter: string) => void
}

export default function ReviewKPICards({ quality, onFilterClick }: Props) {
  const pct = (val: number) => `${Math.round(val * 100)}%`

  return (
    <div className="review-kpi-section">
      <div className="review-kpi-grid">
        <div className="review-kpi-card">
          <span className="review-kpi-value">{quality.total_leads}</span>
          <span className="review-kpi-label">전체 리드</span>
        </div>
        <div
          className="review-kpi-card action-card positive"
          onClick={() => onFilterClick?.('contactable')}
        >
          <span className="review-kpi-value">{quality.contactable_leads}</span>
          <span className="review-kpi-label">직접 연락 가능</span>
        </div>
        <div
          className="review-kpi-card action-card warning"
          onClick={() => onFilterClick?.('needs_review')}
        >
          <span className="review-kpi-value">{quality.needs_review_leads}</span>
          <span className="review-kpi-label">검토 필요</span>
        </div>
        <div
          className="review-kpi-card action-card info"
          onClick={() => onFilterClick?.('needs_correction')}
        >
          <span className="review-kpi-value">{quality.needs_correction_leads}</span>
          <span className="review-kpi-label">보정 필요</span>
        </div>
        <div
          className="review-kpi-card action-card muted"
          onClick={() => onFilterClick?.('excluded')}
        >
          <span className="review-kpi-value">{quality.excluded_leads}</span>
          <span className="review-kpi-label">제외 후보</span>
        </div>
      </div>
      <div className="review-kpi-sub">
        영향력 확인됨 {pct(quality.audience_coverage_rate)} · 프로필 보강 완료 {pct(quality.enrichment_coverage_rate)}
        {quality.platform_suspect_leads > 0 && ` · 플랫폼 메일 의심 ${quality.platform_suspect_leads}건`}
      </div>
    </div>
  )
}
