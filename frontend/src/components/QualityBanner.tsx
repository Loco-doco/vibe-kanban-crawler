import type { QualityMetrics, QualityJudgment } from '../types'
import { QUALITY_JUDGMENT_LABELS } from '../types'

type EnrichState = 'idle' | 'running' | 'done' | 'error'

interface Props {
  quality: QualityMetrics
  onSupplementarySearch: (type: string) => void
  onEnrichSubscribers?: () => void
  subscriberEnrichState?: EnrichState
  subscriberDisabledReason?: string | null
  onEnrichChannels?: () => void
  channelEnrichState?: EnrichState
  channelDisabledReason?: string | null
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

function EnrichButton({ label, onClick, state = 'idle', disabledReason }: {
  label: string
  onClick?: () => void
  state?: EnrichState
  disabledReason?: string | null
}) {
  const isDisabled = !!disabledReason || state === 'running' || state === 'done'

  if (state === 'done') {
    return <span className="quality-banner-cta done">{label} — 완료</span>
  }
  if (state === 'error') {
    return (
      <button className="quality-banner-cta error" onClick={onClick}>
        {label} — 재시도
      </button>
    )
  }

  return (
    <span className="quality-banner-cta-wrap">
      <button
        className={`quality-banner-cta${state === 'running' ? ' running' : ''}`}
        onClick={onClick}
        disabled={isDisabled}
        title={disabledReason || undefined}
      >
        {state === 'running' ? (
          <>{label} 실행 중...</>
        ) : (
          label
        )}
      </button>
      {disabledReason && state === 'idle' && (
        <span className="cta-disabled-reason">{disabledReason}</span>
      )}
    </span>
  )
}

export default function QualityBanner({
  quality,
  onSupplementarySearch,
  onEnrichSubscribers,
  subscriberEnrichState = 'idle',
  subscriberDisabledReason,
  onEnrichChannels,
  channelEnrichState = 'idle',
  channelDisabledReason,
}: Props) {
  const isHealthy = quality.judgment === 'healthy'
  const style = JUDGMENT_STYLE[quality.judgment]
  const label = isHealthy ? '데이터 품질 양호' : QUALITY_JUDGMENT_LABELS[quality.judgment]
  const isAudienceGap = quality.suggested_supplement === 'audience_supplement'

  // Always show enrichment buttons so user can manually trigger
  const hasEnrichActions = onEnrichSubscribers || onEnrichChannels || quality.suggested_supplement

  if (isHealthy && !hasEnrichActions) return null

  return (
    <div className={`quality-banner ${style}`}>
      <span className="quality-banner-text">{label}</span>
      <div className="quality-banner-actions">
        {/* 영향력 보정 — 항상 표시 */}
        {onEnrichSubscribers && (
          <EnrichButton
            label="영향력 보정"
            onClick={onEnrichSubscribers}
            state={subscriberEnrichState}
            disabledReason={subscriberDisabledReason}
          />
        )}
        {/* 프로필 보강 — 항상 표시 */}
        {onEnrichChannels && (
          <EnrichButton
            label="프로필 보강"
            onClick={onEnrichChannels}
            state={channelEnrichState}
            disabledReason={channelDisabledReason}
          />
        )}
        {/* 보완 탐색 — 추천 시에만 */}
        {quality.suggested_supplement && !isAudienceGap && (
          <button
            className="quality-banner-cta"
            onClick={() => onSupplementarySearch(quality.suggested_supplement!)}
          >
            {SUPPLEMENT_CTA[quality.suggested_supplement] || '보완 탐색'}
          </button>
        )}
      </div>
    </div>
  )
}
