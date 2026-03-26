import { useMutation, useQueryClient } from '@tanstack/react-query'
import { updateLead, approveAndQueue, resolveConflict, syncToMaster } from '../api/leads'
import type { Lead } from '../types'
import {
  PLATFORM_LABELS,
  SUSPECT_REASON_LABELS,
  AUDIENCE_TIER_LABELS,
  AUDIENCE_DISPLAY_STATUS_LABELS,
  AUDIENCE_FAILURE_REASON_LABELS,
  REVIEW_STATUS_LABELS,
  MASTER_SYNC_LABELS,
  ENRICHMENT_STATUS_LABELS,
  SOURCE_TYPE_LABELS,
} from '../types'

interface Props {
  lead: Lead
  activeQueue: string
  onClose: () => void
  onUpdated: () => void
  onOpenFullDetail: () => void
}

/* ── Contact category derivation (same logic as ReviewTable for color unification) ── */
type ContactCategory = 'direct_contact' | 'shared_email' | 'platform_email' | 'needs_check'

const CONTACT_CATEGORY_LABELS: Record<ContactCategory, string> = {
  direct_contact: '직접 연락 가능',
  shared_email: '공용 메일',
  platform_email: '플랫폼 메일 의심',
  needs_check: '검증 필요',
}

const CONTACT_CATEGORY_VARIANTS: Record<ContactCategory, string> = {
  direct_contact: 'positive',
  shared_email: 'caution',
  platform_email: 'warning',
  needs_check: 'muted',
}

function deriveContactCategory(lead: Lead): ContactCategory {
  if (lead.contact_readiness === 'contactable' || lead.contact_readiness === 'user_confirmed')
    return 'direct_contact'
  if (lead.contact_readiness === 'platform_suspect' && lead.suspect_reason) {
    if (lead.suspect_reason.startsWith('prefix_')) return 'shared_email'
    return 'platform_email'
  }
  return 'needs_check'
}

/* ── Recommended action (same logic as ReviewTable) ── */
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

/* ── Select/exclude reasons ── */
function getSelectReasons(lead: Lead): string[] {
  const reasons: string[] = []
  if (lead.contact_readiness === 'contactable' || lead.contact_readiness === 'user_confirmed')
    reasons.push('유효한 이메일 확보됨')
  if (lead.effective_audience_tier === 'macro' || lead.effective_audience_tier === 'mega')
    reasons.push(`높은 영향력 (${AUDIENCE_TIER_LABELS[lead.effective_audience_tier]})`)
  if (lead.effective_audience_tier === 'mid')
    reasons.push(`중간 영향력 (${AUDIENCE_TIER_LABELS[lead.effective_audience_tier]})`)
  if (lead.confidence_score >= 0.8)
    reasons.push(`높은 발견 신뢰도 (${Math.round(lead.confidence_score * 100)}%)`)
  if (lead.enrichment && lead.enrichment.enrichment_confidence && lead.enrichment.enrichment_confidence >= 0.7)
    reasons.push(`프로필 보강 완료 (신뢰도 ${Math.round(lead.enrichment.enrichment_confidence * 100)}%)`)
  if (lead.normalized_tags.length > 0)
    reasons.push(`카테고리 매칭: ${lead.normalized_tags.slice(0, 3).join(', ')}`)
  return reasons
}

function getExcludeReasons(lead: Lead): string[] {
  const reasons: string[] = []
  if (lead.contact_readiness === 'no_email')
    reasons.push('이메일 없음')
  if (lead.contact_readiness === 'platform_suspect')
    reasons.push(`플랫폼/공용 메일 의심${lead.suspect_reason ? ` — ${SUSPECT_REASON_LABELS[lead.suspect_reason] || lead.suspect_reason}` : ''}`)
  if (lead.contact_readiness === 'needs_verification')
    reasons.push('이메일 형식 검증 필요')
  if (lead.audience_display_status === 'not_collected')
    reasons.push(`영향력 미수집${lead.audience_failure_reason ? ` (${AUDIENCE_FAILURE_REASON_LABELS[lead.audience_failure_reason] || lead.audience_failure_reason})` : ''}`)
  if (lead.enrichment_status === 'not_started' || lead.enrichment_status === 'failed')
    reasons.push(`프로필 보강 ${ENRICHMENT_STATUS_LABELS[lead.enrichment_status]}`)
  if (lead.confidence_score < 0.5)
    reasons.push(`낮은 발견 신뢰도 (${Math.round(lead.confidence_score * 100)}%)`)
  return reasons
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
  const contactCat = deriveContactCategory(lead)
  const selectReasons = getSelectReasons(lead)
  const excludeReasons = getExcludeReasons(lead)
  const email = lead.contact_email || lead.email
  const isPipelineTab = ['conflict_queue', 'ready_to_sync', 'synced'].includes(activeQueue)

  // Queue assignment reason
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
        {/* ── Header: 식별 정보 ── */}
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
          {/* ── Tier 1: 이메일/연락 상태 (최상위, 큼직하게) ── */}
          <div className="quick-detail-section drawer-email-hero">
            <div className="drawer-email-status-row">
              <span className={`contact-category-badge ${CONTACT_CATEGORY_VARIANTS[contactCat]}`}>
                {CONTACT_CATEGORY_LABELS[contactCat]}
              </span>
              {lead.suspect_reason && (
                <span className="suspect-reason-detail">
                  {SUSPECT_REASON_LABELS[lead.suspect_reason] || lead.suspect_reason}
                </span>
              )}
            </div>
            <div className="drawer-email-address">
              {email || <span className="text-muted">(이메일 없음)</span>}
            </div>
            {lead.contact_email && lead.email && lead.contact_email !== lead.email && (
              <div className="drawer-email-original">
                원본: {lead.email}
              </div>
            )}
            {lead.channel_url && (
              <a href={lead.channel_url} target="_blank" rel="noopener noreferrer" className="drawer-channel-link">
                {lead.channel_url.length > 50 ? lead.channel_url.slice(0, 50) + '...' : lead.channel_url}
                {' \u2197'}
              </a>
            )}
          </div>

          {/* ── Tier 2: 판단 근거 (evidence-first) ── */}
          <div className="quick-detail-section">
            <div className="quick-detail-section-title">
              <span className="quick-detail-icon">{'\u26A1'}</span>
              판단 근거
            </div>
            <div className="quick-detail-reason">{queueReason}</div>
            {!isPipelineTab && (
              <div className={`judgment-action action-${action.priority}`}>
                추천: {action.label}
              </div>
            )}

            {/* Select reasons */}
            {selectReasons.length > 0 && (
              <div className="drawer-evidence-block select-evidence">
                <div className="drawer-evidence-title">선택 근거</div>
                <ul className="drawer-evidence-list">
                  {selectReasons.map((r, i) => <li key={i}>{r}</li>)}
                </ul>
              </div>
            )}

            {/* Exclude reasons */}
            {excludeReasons.length > 0 && (
              <div className="drawer-evidence-block exclude-evidence">
                <div className="drawer-evidence-title">주의 사항</div>
                <ul className="drawer-evidence-list">
                  {excludeReasons.map((r, i) => <li key={i}>{r}</li>)}
                </ul>
              </div>
            )}
          </div>

          {/* ── Tier 3: 영향력 ── */}
          <div className="quick-detail-section">
            <div className="quick-detail-section-title">
              <span className="quick-detail-icon">{'\uD83D\uDCCA'}</span>
              영향력
            </div>
            <div className="quick-detail-field">
              <span className="quick-detail-label">규모</span>
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
                ) : (
                  <span className={`audience-status ${lead.audience_display_status}`}>
                    {lead.audience_failure_reason
                      ? (AUDIENCE_FAILURE_REASON_LABELS[lead.audience_failure_reason] || lead.audience_failure_reason)
                      : AUDIENCE_DISPLAY_STATUS_LABELS[lead.audience_display_status]}
                  </span>
                )}
              </span>
            </div>
            {lead.enrichment_status !== 'not_started' && (
              <div className="quick-detail-field">
                <span className="quick-detail-label">보강 상태</span>
                <span className="quick-detail-value">
                  {ENRICHMENT_STATUS_LABELS[lead.enrichment_status]}
                  {lead.enrichment?.enrichment_confidence != null && (
                    <span className="text-muted"> ({Math.round(lead.enrichment.enrichment_confidence * 100)}%)</span>
                  )}
                </span>
              </div>
            )}
          </div>

          {/* ── Tier 4: 소스 & 발견 ── */}
          <div className="quick-detail-section">
            <div className="quick-detail-section-title">
              <span className="quick-detail-icon">{'\uD83D\uDD0D'}</span>
              소스
            </div>
            {lead.discovery_keyword && (
              <div className="quick-detail-field">
                <span className="quick-detail-label">발견 키워드</span>
                <span className="quick-detail-value">{lead.discovery_keyword}</span>
              </div>
            )}
            {lead.normalized_tags.length > 0 && (
              <div className="quick-detail-field">
                <span className="quick-detail-label">카테고리</span>
                <span className="tag-chips">
                  {lead.normalized_tags.map(tag => (
                    <span key={tag} className="tag-chip">{tag}</span>
                  ))}
                </span>
              </div>
            )}
            <div className="quick-detail-field">
              <span className="quick-detail-label">신뢰도</span>
              <span className="quick-detail-value">{Math.round(lead.confidence_score * 100)}%</span>
            </div>
            {lead.source_type && (
              <div className="quick-detail-field">
                <span className="quick-detail-label">소스 유형</span>
                <span className="quick-detail-value">{SOURCE_TYPE_LABELS[lead.source_type] || lead.source_type}</span>
              </div>
            )}
            {lead.evidence_link && (
              <div className="quick-detail-field">
                <span className="quick-detail-label">증거</span>
                <a href={lead.evidence_link} target="_blank" rel="noopener noreferrer" className="quick-detail-link">
                  {lead.evidence_link.length > 40 ? lead.evidence_link.slice(0, 40) + '...' : lead.evidence_link}
                  {' \u2197'}
                </a>
              </div>
            )}
          </div>

          {/* ── Tier 5: 프로필 보강 정보 ── */}
          <div className="quick-detail-section">
            <div className="quick-detail-section-title">
              <span className="quick-detail-icon">{'\uD83D\uDCCB'}</span>
              프로필 보강
              <span className={`enrichment-status-badge ${lead.enrichment_status}`}>
                {ENRICHMENT_STATUS_LABELS[lead.enrichment_status] || lead.enrichment_status}
              </span>
            </div>
            {lead.enrichment_status === 'not_started' && (
              <div className="enrichment-empty">보강 대기 중 — 자동 실행 예정</div>
            )}
            {lead.enrichment && (
              <>
                {lead.enrichment.business_summary && (
                  <div className="quick-detail-field">
                    <span className="quick-detail-label">비즈니스</span>
                    <span className="quick-detail-value enrichment-text">{lead.enrichment.business_summary}</span>
                  </div>
                )}
                {lead.enrichment.profile_summary && (
                  <div className="quick-detail-field">
                    <span className="quick-detail-label">프로필</span>
                    <span className="quick-detail-value enrichment-text">{lead.enrichment.profile_summary}</span>
                  </div>
                )}
                {lead.enrichment.content_topics && lead.enrichment.content_topics.length > 0 && (
                  <div className="quick-detail-field">
                    <span className="quick-detail-label">주제</span>
                    <span className="quick-detail-value">
                      {lead.enrichment.content_topics.map((t, i) => (
                        <span key={i} className="enrichment-tag">{t}</span>
                      ))}
                    </span>
                  </div>
                )}
                {lead.enrichment.profile_tags && lead.enrichment.profile_tags.length > 0 && (
                  <div className="quick-detail-field">
                    <span className="quick-detail-label">태그</span>
                    <span className="quick-detail-value">
                      {lead.enrichment.profile_tags.map((t, i) => (
                        <span key={i} className="enrichment-tag">{t}</span>
                      ))}
                    </span>
                  </div>
                )}
                {lead.enrichment.enrichment_confidence != null && (
                  <div className="quick-detail-field">
                    <span className="quick-detail-label">신뢰도</span>
                    <span className="quick-detail-value">
                      {Math.round(lead.enrichment.enrichment_confidence * 100)}%
                    </span>
                  </div>
                )}
              </>
            )}
          </div>

          {/* ── Tier 6: Actions (context-dependent) ── */}
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
