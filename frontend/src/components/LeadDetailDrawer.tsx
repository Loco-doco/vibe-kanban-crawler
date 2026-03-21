import { useMutation, useQueryClient } from '@tanstack/react-query'
import { updateLead, approveAndQueue, resolveConflict, syncToMaster } from '../api/leads'
import type { Lead } from '../types'
import {
  PLATFORM_LABELS,
  CONTACT_READINESS_LABELS,
  SUSPECT_REASON_LABELS,
  AUDIENCE_TIER_LABELS,
  AUDIENCE_DISPLAY_STATUS_LABELS,
  AUDIENCE_FAILURE_REASON_LABELS,
  REVIEW_STATUS_LABELS,
  MASTER_SYNC_LABELS,
} from '../types'

interface Props {
  lead: Lead
  activeQueue: string
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

export default function LeadDetailDrawer({ lead, activeQueue, onClose, onUpdated, onOpenFullDetail }: Props) {
  const queryClient = useQueryClient()

  const invalidateAll = () => {
    queryClient.invalidateQueries({ queryKey: ['leads'] })
    queryClient.invalidateQueries({ queryKey: ['quality'] })
    onUpdated()
  }

  const updateMutation = useMutation({
    mutationFn: (fields: Partial<Lead>) => updateLead(lead.id, fields),
    onSuccess: invalidateAll,
  })

  const approveMutation = useMutation({
    mutationFn: () => approveAndQueue([lead.id]),
    onSuccess: invalidateAll,
  })

  const resolveConflictMutation = useMutation({
    mutationFn: (resolution: 'keep' | 'reject') => resolveConflict(lead.id, resolution),
    onSuccess: invalidateAll,
  })

  const syncMutation = useMutation({
    mutationFn: () => syncToMaster([lead.id]),
    onSuccess: invalidateAll,
  })

  const handleReviewAction = (status: string) => {
    if (status === 'approved') {
      approveMutation.mutate()
    } else {
      updateMutation.mutate({ review_status: status } as Partial<Lead>)
    }
  }

  const isPending = updateMutation.isPending || approveMutation.isPending ||
    resolveConflictMutation.isPending || syncMutation.isPending

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

  // Queue assignment reason — varies by active queue
  const queueReason = (() => {
    if (activeQueue === 'conflict_queue')
      return '"충돌 확인" 큐 — 기존 리드와 중복 가능성이 감지되었습니다'
    if (activeQueue === 'ready_to_sync')
      return '"반영 대기" 큐 — 충돌 없이 마스터 반영 대기 중입니다'
    if (activeQueue === 'synced')
      return '"반영 완료" — 마스터 리스트에 반영되었습니다'
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

  // Render action buttons based on queue context
  const renderActions = () => {
    if (activeQueue === 'conflict_queue') {
      return (
        <div className="quick-detail-section">
          {/* Conflict details */}
          {lead.conflict_details && lead.conflict_details.length > 0 && (
            <div className="conflict-details-section">
              <div className="quick-detail-section-title">
                <span className="quick-detail-icon">{'\u26A0\uFE0F'}</span>
                충돌 사유
              </div>
              <ul className="quick-detail-issues">
                {lead.conflict_details.map((c, i) => (
                  <li key={i}>
                    <strong>{c.reason_label || c.rule}</strong>
                    {' — '}
                    <span className="conflict-value">{c.value}</span>
                    {c.similarity_score != null && (
                      <span className="conflict-score"> (유사도 {c.similarity_score})</span>
                    )}
                    <span className="conflict-existing"> (기존 #{c.existing_lead_id})</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
          <div className="judgment-actions">
            <button
              className="judgment-btn approve"
              onClick={() => resolveConflictMutation.mutate('keep')}
              disabled={isPending}
            >충돌 무시 → 반영 대기</button>
            <button
              className="judgment-btn reject"
              onClick={() => resolveConflictMutation.mutate('reject')}
              disabled={isPending}
            >제외</button>
          </div>
        </div>
      )
    }

    if (activeQueue === 'ready_to_sync') {
      return (
        <div className="quick-detail-section">
          <div className="judgment-actions">
            <button
              className="judgment-btn approve"
              onClick={() => syncMutation.mutate()}
              disabled={isPending}
            >최종 반영</button>
          </div>
        </div>
      )
    }

    if (activeQueue === 'synced') {
      return (
        <div className="quick-detail-section">
          <div className="quick-detail-field">
            <span className="quick-detail-label">상태</span>
            <span className="sync-badge synced">{MASTER_SYNC_LABELS['synced']}</span>
          </div>
        </div>
      )
    }

    // Default review tabs
    return (
      <div className="quick-detail-section">
        <div className="judgment-actions">
          <button
            className="judgment-btn approve"
            onClick={() => handleReviewAction('approved')}
            disabled={lead.review_status === 'approved' || lead.master_sync_status !== 'not_synced'}
          >승인 + 대기열</button>
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
    )
  }

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
              {lead.master_sync_status !== 'not_synced' && (
                <span className={`sync-badge ${lead.master_sync_status}`}>
                  {MASTER_SYNC_LABELS[lead.master_sync_status]}
                </span>
              )}
            </div>
          </div>
          <button className="drawer-close" onClick={onClose}>&times;</button>
        </div>

        {isPending && (
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
            {activeQueue !== 'conflict_queue' && activeQueue !== 'ready_to_sync' && activeQueue !== 'synced' && (
              <div className={`judgment-action action-${action.priority}`}>
                추천: {action.label}
              </div>
            )}
          </div>

          {/* Tier 2: 현재 문제 (not shown for pipeline tabs) */}
          {issues.length > 0 && activeQueue !== 'synced' && (
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

          {/* Tier 4: Actions (context-dependent) */}
          {renderActions()}

          {/* Full Detail CTA */}
          <button className="full-detail-cta" onClick={onOpenFullDetail}>
            상세 보기 &rarr;
          </button>
        </div>
      </div>
    </div>
  )
}
