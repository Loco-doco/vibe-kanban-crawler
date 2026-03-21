import type { QualityMetrics } from '../types'

interface Props {
  quality: QualityMetrics
}

export default function ReviewKPICards({ quality }: Props) {
  const pct = (val: number) => `${Math.round(val * 100)}%`

  const cards = [
    { label: '전체 리드', value: quality.total_leads, variant: '' },
    { label: '바로 연락 가능', value: quality.contactable_leads, variant: 'positive' },
    { label: '검증 필요', value: quality.needs_verification_leads, variant: 'warning' },
    { label: '데이터 보정 필요', value: quality.needs_correction_leads, variant: 'info' },
    { label: '제외됨', value: quality.excluded_leads, variant: 'muted' },
  ]

  return (
    <div className="review-kpi-section">
      <div className="review-kpi-grid">
        {cards.map(card => (
          <div
            key={card.label}
            className={`review-kpi-card summary-only${card.variant ? ` ${card.variant}` : ''}`}
          >
            <span className="review-kpi-value">{card.value}</span>
            <span className="review-kpi-label">{card.label}</span>
          </div>
        ))}
      </div>
      <div className="review-kpi-sub">
        영향력 확인됨 {pct(quality.audience_coverage_rate)} · 프로필 보강 완료 {pct(quality.enrichment_coverage_rate)}
        {quality.platform_suspect_leads > 0 && ` · 플랫폼 메일 의심 ${quality.platform_suspect_leads}건`}
      </div>
    </div>
  )
}
