import { useMutation, useQueryClient } from '@tanstack/react-query'
import { updateLead } from '../api/leads'
import type { Lead } from '../types'
import {
  PLATFORM_LABELS,
  CONTACT_READINESS_LABELS,
  SUSPECT_REASON_LABELS,
  AUDIENCE_TIER_LABELS,
  AUDIENCE_DISPLAY_STATUS_LABELS,
  AUDIENCE_FAILURE_REASON_LABELS,
  REVIEW_STATUS_LABELS,
} from '../types'

interface Props {
  lead: Lead
  onClose: () => void
  onUpdated: () => void
  onOpenFullDetail: () => void
}

function getRecommendedAction(lead: Lead): { label: string; priority: 'high' | 'medium' | 'low' } {
  if (lead.contact_readiness === 'no_email')
    return { label: '이메일 확보 필요', priority: 'high' }
  if (lead.contact_readiness === 'platform_suspect')
    return { label: '이메일 검증 필요', priority: 'high' }
  if (lead.audience_display_status === 'not_collected')
    return { label: '영향력 보정 필요', priority: 'medium' }
  if (lead.enrichment_status === 'not_started')
    return { label: '프로필 보강 필요', priority: 'medium' }
  if (lead.contact_readiness === 'contactable' && (lead.review_status === 'auto_approved' || lead.review_status === 'approved'))
    return { label: '연락 가능', priority: 'low' }
  return { label: '검토 필요', priority: 'medium' }
}

export default function LeadDetailDrawer({ lead, onClose, onUpdated, onOpenFullDetail }: Props) {
  const queryClient = useQueryClient()

  const updateMutation = useMutation({
    mutationFn: (fields: Partial<Lead>) => updateLead(lead.id, fields),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['leads'] })
      queryClient.invalidateQueries({ queryKey: ['quality'] })
      onUpdated()
    },
  })

  const handleReviewAction = (status: string) => {
    updateMutation.mutate({ review_status: status } as Partial<Lead>)
  }

  const action = getRecommendedAction(lead)

  // Derive current issues for "현재 문제" section
  const issues: string[] = []
  if (lead.contact_readiness === 'platform_suspect')
    issues.push(`이메일: 플랫폼 메일 의심${lead.suspect_reason ? ` (${SUSPECT_REASON_LABELS[lead.suspect_reason] || lead.suspect_reason})` : ''}`)
  if (lead.contact_readiness === 'no_email')
    issues.push('이메일: 없음 — 수집 필요')
  if (lead.contact_readiness === 'needs_verification')
    issues.push('이메일: 검증 필요')
  if (lead.audience_display_status === 'not_collected')
    issues.push(`영향력: 미수집${lead.audience_failure_reason ? ` (${AUDIENCE_FAILURE_REASON_LABELS[lead.audience_failure_reason] || lead.audience_failure_reason})` : ''}`)
  if (lead.enrichment_status === 'not_started')
    issues.push('프로필 보강: 미시작')
  if (lead.enrichment_status === 'low_confidence')
    issues.push('프로필 보강: 신뢰도 낮음')

  // Queue assignment reason
  const queueReason = (() => {
    if (lead.contact_readiness === 'platform_suspect' || lead.contact_readiness === 'needs_verification')
      return '"검증 필요" 큐 — 이메일 검증이 필요합니다'
    if (lead.contact_readiness === 'no_email')
      return '"검증 필요" 큐 — 이메일 확보가 필요합니다'
    if (lead.contact_readiness === 'contactable' || lead.contact_readiness === 'user_confirmed')
      return '"연락 대상" 큐 — 연락 가능한 리드입니다'
    if (lead.review_status === 'held')
      return '"보류" 큐 — 추가 검토 보류 중'
    if (lead.review_status === 'rejected' || lead.review_status === 'auto_rejected')
      return '"제외" 큐 — 제외 처리됨'
    return '검토 대기'
  })()

  return (
    <div className="drawer-overlay" onClick={onClose}>
      <div className="drawer-panel" onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div className="drawer-header">
          <div className="drawer-header-info">
            <h2 className="drawer-title">{lead.effective_name || '(이름 없음)'}</h2>
            <div className="drawer-subtitle">
              <span className={`platform-badge ${lead.platform}`}>
                {PLATFORM_LABELS[lead.platform] || lead.platform}
              </span>
              <span className={`review-badge ${lead.review_status}`}>
                {REVIEW_STATUS_LABELS[lead.review_status]}
              </span>
            </div>
          </div>
          <button className="drawer-close" onClick={onClose}>&times;</button>
        </div>

        {updateMutation.isPending && (
          <div className="drawer-saving">저장 중...</div>
        )}

        <div className="drawer-body">
          {/* Tier 1: 왜 이 리드를 봐야 하는가 */}
          <div className="quick-detail-section">
            <div className="quick-detail-section-title">
              <span className="quick-detail-icon">{'\u26A1'}</span>
              이 리드를 봐야 하는 이유
            </div>
            <div className="quick-detail-reason">{queueReason}</div>
            <div className={`judgment-action action-${action.priority}`}>
              추천: {action.label}
            </div>
          </div>

          {/* Tier 2: 현재 문제 */}
          {issues.length > 0 && (
            <div className="quick-detail-section">
              <div className="quick-detail-section-title">
                <span className="quick-detail-icon">{'\u26A0\uFE0F'}</span>
                현재 문제
              </div>
              <ul className="quick-detail-issues">
                {issues.map((issue, i) => (
                  <li key={i}>{issue}</li>
                ))}
              </ul>
            </div>
          )}

          {/* Tier 3: 연락 정보 */}
          <div className="quick-detail-section">
            <div className="quick-detail-section-title">
              <span className="quick-detail-icon">{'\u2709\uFE0F'}</span>
              연락 정보
            </div>
            <div className="quick-detail-field">
              <span className="quick-detail-label">이메일</span>
              <span className="quick-detail-value">{lead.contact_email || lead.email || '(없음)'}</span>
            </div>
            <div className="quick-detail-field">
              <span className="quick-detail-label">상태</span>
              <span className={`contact-readiness-badge ${lead.contact_readiness}`}>
                {CONTACT_READINESS_LABELS[lead.contact_readiness] || lead.contact_readiness}
              </span>
            </div>
            {lead.channel_url && (
              <div className="quick-detail-field">
                <span className="quick-detail-label">채널</span>
                <a href={lead.channel_url} target="_blank" rel="noopener noreferrer" className="quick-detail-link">
                  {lead.channel_url.length > 40 ? lead.channel_url.slice(0, 40) + '...' : lead.channel_url}
                  {' \u2197'}
                </a>
              </div>
            )}
            <div className="quick-detail-field">
              <span className="quick-detail-label">영향력</span>
              <span className="quick-detail-value">
                {lead.audience_display_status === 'collected' ? (
                  <>
                    {lead.effective_audience_label || `${lead.effective_audience_size}`}
                    {lead.effective_audience_tier && (
                      <span className={`tier-badge-sm ${lead.effective_audience_tier}`}>
                        {AUDIENCE_TIER_LABELS[lead.effective_audience_tier]}
                      </span>
                    )}
                  </>
                ) : AUDIENCE_DISPLAY_STATUS_LABELS[lead.audience_display_status]}
              </span>
            </div>
          </div>

          {/* Tier 4: 다음 액션 */}
          <div className="quick-detail-section">
            <div className="judgment-actions">
              <button
                className="judgment-btn approve"
                onClick={() => handleReviewAction('approved')}
                disabled={lead.review_status === 'approved'}
              >승인</button>
              <button
                className="judgment-btn hold"
                onClick={() => handleReviewAction('held')}
                disabled={lead.review_status === 'held'}
              >보류</button>
              <button
                className="judgment-btn reject"
                onClick={() => handleReviewAction('rejected')}
                disabled={lead.review_status === 'rejected'}
              >제외</button>
            </div>
          </div>

          {/* Full Detail CTA */}
          <button className="full-detail-cta" onClick={onOpenFullDetail}>
            상세 보기 &rarr;
          </button>
        </div>
      </div>
    </div>
  )
}
