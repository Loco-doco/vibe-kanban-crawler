import type { Lead } from '../types'
import {
  PLATFORM_LABELS,
  SUSPECT_REASON_LABELS,
  AUDIENCE_TIER_LABELS,
  AUDIENCE_DISPLAY_STATUS_LABELS,
  AUDIENCE_FAILURE_REASON_LABELS,
  REVIEW_STATUS_LABELS,
} from '../types'

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

interface Props {
  leads: Lead[]
  selectedIds: Set<number>
  onToggleSelect: (id: number) => void
  onToggleSelectAll: () => void
  onViewDetail: (lead: Lead) => void
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

function truncateEmail(email: string | null, max: number = 28): string {
  if (!email) return '(없음)'
  return email.length > max ? email.slice(0, max) + '...' : email
}

export default function ReviewTable({ leads, selectedIds, onToggleSelect, onToggleSelectAll, onViewDetail }: Props) {
  const allSelected = leads.length > 0 && selectedIds.size === leads.length

  return (
    <div className="table-wrap">
      <table className="data-table review-table">
        <thead>
          <tr>
            <th className="col-check">
              <input
                type="checkbox"
                checked={allSelected}
                onChange={onToggleSelectAll}
              />
            </th>
            <th>리드명</th>
            <th>이메일</th>
            <th>이메일 상태</th>
            <th>플랫폼 / 영향력</th>
            <th>카테고리</th>
            <th>리뷰</th>
            <th>다음 단계</th>
            <th className="col-detail"></th>
          </tr>
        </thead>
        <tbody>
          {leads.map(lead => {
            const action = getRecommendedAction(lead)
            const email = lead.contact_email || lead.email
            const contactCat = deriveContactCategory(lead)
            return (
              <tr
                key={lead.id}
                className={`review-row${selectedIds.has(lead.id) ? ' selected' : ''}`}
                onClick={() => onToggleSelect(lead.id)}
              >
                <td className="col-check">
                  <input
                    type="checkbox"
                    checked={selectedIds.has(lead.id)}
                    onChange={() => onToggleSelect(lead.id)}
                    onClick={e => e.stopPropagation()}
                  />
                </td>
                <td className="col-name">
                  <span className="lead-name-text">
                    {lead.effective_name || <span className="text-muted">(이름 없음)</span>}
                  </span>
                  {lead.channel_url && (
                    <a
                      href={lead.channel_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="channel-external-link"
                      title={lead.channel_url}
                      onClick={e => e.stopPropagation()}
                    >{'\u2197'}</a>
                  )}
                </td>
                <td className="col-email">
                  <span className="email-text" title={email || undefined}>
                    {truncateEmail(email)}
                  </span>
                </td>
                <td className="col-contact-category">
                  <span className={`contact-category-badge ${CONTACT_CATEGORY_VARIANTS[contactCat]}`}>
                    {CONTACT_CATEGORY_LABELS[contactCat]}
                  </span>
                  {lead.suspect_reason && (
                    <span className="suspect-info-icon" title={SUSPECT_REASON_LABELS[lead.suspect_reason] || lead.suspect_reason}>
                      {'\u24D8'}
                    </span>
                  )}
                </td>
                <td className="col-platform-audience">
                  <span className={`platform-badge ${lead.platform}`}>
                    {PLATFORM_LABELS[lead.platform] || lead.platform}
                  </span>
                  {' '}
                  {lead.audience_display_status === 'collected' ? (
                    <span className="audience-value-inline">
                      {lead.effective_audience_label || lead.effective_audience_size}
                    </span>
                  ) : (
                    <span
                      className={`audience-status ${lead.audience_display_status}`}
                      title={lead.audience_failure_reason ? (AUDIENCE_FAILURE_REASON_LABELS[lead.audience_failure_reason] || lead.audience_failure_reason) : undefined}
                    >
                      {lead.audience_failure_reason
                        ? (AUDIENCE_FAILURE_REASON_LABELS[lead.audience_failure_reason] || lead.audience_failure_reason)
                        : AUDIENCE_DISPLAY_STATUS_LABELS[lead.audience_display_status]}
                    </span>
                  )}
                  {lead.effective_audience_tier && (
                    <span className={`tier-badge-sm ${lead.effective_audience_tier}`}>
                      {AUDIENCE_TIER_LABELS[lead.effective_audience_tier]}
                    </span>
                  )}
                </td>
                <td className="col-tags">
                  {lead.normalized_tags.length > 0 ? (
                    <span className="tag-chips">
                      {lead.normalized_tags.map(tag => (
                        <span key={tag} className="tag-chip">{tag}</span>
                      ))}
                    </span>
                  ) : lead.discovery_keyword ? (
                    <span className="text-muted">{lead.discovery_keyword}</span>
                  ) : '-'}
                </td>
                <td>
                  <span className={`review-badge ${lead.review_status}`}>
                    {REVIEW_STATUS_LABELS[lead.review_status]}
                  </span>
                </td>
                <td>
                  <span className={`action-label ${action.priority}`} title={action.label}>
                    {action.label}
                  </span>
                </td>
                <td className="col-detail">
                  <button
                    className="detail-view-btn"
                    onClick={e => { e.stopPropagation(); onViewDetail(lead) }}
                    title="상세 보기"
                  >{'\uD83D\uDD0D'}</button>
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
