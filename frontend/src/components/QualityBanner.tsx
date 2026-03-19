import type { QualityMetrics, QualityJudgment } from '../types'
import { QUALITY_JUDGMENT_LABELS } from '../types'

interface Props {
  quality: QualityMetrics
  onSupplementarySearch: (type: string) => void
}

const JUDGMENT_STYLE: Record<QualityJudgment, string> = {
  healthy: 'positive',
  low_email_coverage: 'warning',
  high_invalid_email_rate: 'error',
  low_audience_coverage: 'warning',
}

const SUPPLEMENT_CTA: Record<string, string> = {
  email_supplement: '이메일 보완 탐색',
  audience_supplement: '영향력 보완 탐색',
  meta_supplement: '메타정보 보완 탐색',
}

export default function QualityBanner({ quality, onSupplementarySearch }: Props) {
  // Don't show banner when quality is healthy (no action needed)
  if (quality.judgment === 'healthy') return null

  const style = JUDGMENT_STYLE[quality.judgment]
  const label = QUALITY_JUDGMENT_LABELS[quality.judgment]

  return (
    <div className={`quality-banner ${style}`}>
      <span className="quality-banner-text">{label}</span>
      {quality.suggested_supplement && (
        <button
          className="quality-banner-cta"
          onClick={() => onSupplementarySearch(quality.suggested_supplement!)}
        >
          {SUPPLEMENT_CTA[quality.suggested_supplement] || '보완 탐색'}
        </button>
      )}
    </div>
  )
}
