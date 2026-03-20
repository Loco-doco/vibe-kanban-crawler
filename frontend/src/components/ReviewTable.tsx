import type { Lead } from '../types'
import {
  PLATFORM_LABELS,
  CONTACT_READINESS_LABELS,
  AUDIENCE_TIER_LABELS,
  AUDIENCE_DISPLAY_STATUS_LABELS,
  REVIEW_STATUS_LABELS,
} from '../types'

interface Props {
  leads: Lead[]
  selectedIds: Set<number>
  onToggleSelect: (id: number) => void
  onToggleSelectAll: () => void
  onRowClick: (lead: Lead) => void
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

export default function ReviewTable({ leads, selectedIds, onToggleSelect, onToggleSelectAll, onRowClick }: Props) {
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
            <th>플랫폼 / 영향력</th>
            <th>카테고리</th>
            <th>리뷰</th>
            <th>다음 단계</th>
          </tr>
        </thead>
        <tbody>
          {leads.map(lead => {
            const action = getRecommendedAction(lead)
            const email = lead.contact_email || lead.email
            return (
              <tr
                key={lead.id}
                className={`review-row${selectedIds.has(lead.id) ? ' selected' : ''}`}
                onClick={() => onRowClick(lead)}
              >
                <td className="col-check" onClick={e => e.stopPropagation()}>
                  <input
                    type="checkbox"
                    checked={selectedIds.has(lead.id)}
                    onChange={() => onToggleSelect(lead.id)}
                  />
                </td>
                <td className="col-name">
                  {lead.effective_name || <span className="text-muted">(이름 없음)</span>}
                </td>
                <td className="col-email">
                  <span className="email-text" title={email || undefined}>
                    {truncateEmail(email)}
                  </span>
                  {email && (
                    <span className={`contact-mini-badge ${lead.contact_readiness}`}>
                      {CONTACT_READINESS_LABELS[lead.contact_readiness] || lead.contact_readiness}
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
                    <span className={`audience-status ${lead.audience_display_status}`}>
                      {AUDIENCE_DISPLAY_STATUS_LABELS[lead.audience_display_status]}
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
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
