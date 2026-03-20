import type { QualityMetrics } from '../types'

interface Props {
  quality: QualityMetrics
  activeFilter?: string
  onFilterClick?: (filter: string) => void
}

export default function ReviewKPICards({ quality, activeFilter, onFilterClick }: Props) {
  const pct = (val: number) => `${Math.round(val * 100)}%`

  const cards = [
    { key: '', label: '전체', value: quality.total_leads, variant: '' },
    { key: 'contactable', label: '직접 연락 가능', value: quality.contactable_leads, variant: 'positive' },
    { key: 'needs_review', label: '검토 대상', value: quality.needs_review_leads, variant: 'warning' },
    { key: 'needs_correction', label: '보정 대상', value: quality.needs_correction_leads, variant: 'info' },
    { key: 'excluded', label: '제외 후보', value: quality.excluded_leads, variant: 'muted' },
  ]

  return (
    <div className="review-kpi-section">
      <div className="review-kpi-grid">
        {cards.map(card => (
          <button
            key={card.key}
            className={`review-kpi-card${card.variant ? ` action-card ${card.variant}` : ''}${activeFilter === card.key ? ' active' : ''}`}
            onClick={() => onFilterClick?.(card.key)}
          >
            <span className="review-kpi-value">{card.value}</span>
            <span className="review-kpi-label">{card.label}</span>
          </button>
        ))}
      </div>
      <div className="review-kpi-sub">
        영향력 확인됨 {pct(quality.audience_coverage_rate)} · 프로필 보강 완료 {pct(quality.enrichment_coverage_rate)}
        {quality.platform_suspect_leads > 0 && ` · 플랫폼 메일 의심 ${quality.platform_suspect_leads}건`}
      </div>
    </div>
  )
}
