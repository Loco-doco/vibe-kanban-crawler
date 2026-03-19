import type { QualityMetrics, QualityJudgment } from '../types'
import { QUALITY_JUDGMENT_LABELS } from '../types'

interface Props {
  quality: QualityMetrics
  onSupplementarySearch: (type: string) => void
  onEnrichSubscribers?: () => void
  onEnrichChannels?: () => void
}

const JUDGMENT_STYLE: Record<QualityJudgment, string> = {
  healthy: 'positive',
  low_email_coverage: 'warning',
  high_invalid_email_rate: 'error',
  low_audience_coverage: 'warning',
}

const SUPPLEMENT_CTA: Record<string, string> = {
  email_supplement: '이메일 보완 탐색',
  meta_supplement: '메타정보 보완 탐색',
}

export default function QualityBanner({ quality, onSupplementarySearch, onEnrichSubscribers, onEnrichChannels }: Props) {
  // Don't show banner when quality is healthy (no action needed)
  if (quality.judgment === 'healthy') return null

  const style = JUDGMENT_STYLE[quality.judgment]
  const label = QUALITY_JUDGMENT_LABELS[quality.judgment]

  // For low_audience_coverage, show "영향력 보정 실행" (updates existing leads, not new search)
  const isAudienceGap = quality.suggested_supplement === 'audience_supplement'

  return (
    <div className={`quality-banner ${style}`}>
      <span className="quality-banner-text">{label}</span>
      {isAudienceGap && onEnrichSubscribers ? (
        <button
          className="quality-banner-cta"
          onClick={onEnrichSubscribers}
        >
          영향력 보정 실행
        </button>
      ) : quality.suggested_supplement && !isAudienceGap ? (
        <button
          className="quality-banner-cta"
          onClick={() => onSupplementarySearch(quality.suggested_supplement!)}
        >
          {SUPPLEMENT_CTA[quality.suggested_supplement] || '보완 탐색'}
        </button>
      ) : null}
      {onEnrichChannels && quality.enrichment_coverage_rate < 0.3 && (
        <button
          className="quality-banner-cta secondary"
          onClick={onEnrichChannels}
        >
          프로필 보강 실행
        </button>
      )}
    </div>
  )
}
