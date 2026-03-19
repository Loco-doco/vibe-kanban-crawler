import type { QualityMetrics } from '../types'

interface Props {
  quality: QualityMetrics
}

export default function ReviewKPICards({ quality }: Props) {
  const pct = (val: number) => `${Math.round(val * 100)}%`

  return (
    <div className="review-kpi-grid">
      <div className="review-kpi-card">
        <span className="review-kpi-value">{quality.reviewable_leads}</span>
        <span className="review-kpi-label">전체 리드</span>
      </div>
      <div className="review-kpi-card">
        <span className="review-kpi-value">{quality.contact_present_leads}</span>
        <span className="review-kpi-label">이메일 확보</span>
        <span className="review-kpi-rate">{pct(quality.contact_coverage_rate)}</span>
      </div>
      <div className="review-kpi-card">
        <span className="review-kpi-value">{quality.valid_email_leads}</span>
        <span className="review-kpi-label">유효 이메일</span>
        <span className="review-kpi-rate">{pct(quality.valid_email_coverage_rate)}</span>
      </div>
      <div className="review-kpi-card">
        <span className="review-kpi-value">{quality.audience_present_leads}</span>
        <span className="review-kpi-label">영향력 수집</span>
        <span className="review-kpi-rate">{pct(quality.audience_coverage_rate)}</span>
      </div>
      <div className="review-kpi-card">
        <span className="review-kpi-value">{quality.enrichment_completed_leads}</span>
        <span className="review-kpi-label">보강 완료</span>
        <span className="review-kpi-rate">{pct(quality.enrichment_coverage_rate)}</span>
      </div>
      {quality.invalid_email_leads > 0 && (
        <div className="review-kpi-card warning">
          <span className="review-kpi-value">{quality.invalid_email_leads}</span>
          <span className="review-kpi-label">무효 이메일</span>
          <span className="review-kpi-rate">{pct(quality.invalid_email_rate)}</span>
        </div>
      )}
    </div>
  )
}
