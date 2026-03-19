import type { Lead } from '../types'
import {
  PLATFORM_LABELS,
  EMAIL_STATUS_LABELS,
  AUDIENCE_TIER_LABELS,
  AUDIENCE_DISPLAY_STATUS_LABELS,
  SOURCE_TYPE_LABELS,
  REVIEW_STATUS_LABELS,
  ENRICHMENT_STATUS_LABELS,
} from '../types'

interface Props {
  leads: Lead[]
  selectedIds: Set<number>
  onToggleSelect: (id: number) => void
  onToggleSelectAll: () => void
  onRowClick: (lead: Lead) => void
}

function formatTime(iso: string) {
  const d = new Date(iso)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`
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
            <th>이메일 상태</th>
            <th>플랫폼</th>
            <th>영향력</th>
            <th>등급</th>
            <th>키워드</th>
            <th>출처</th>
            <th>리뷰</th>
            <th>보강</th>
            <th>갱신</th>
          </tr>
        </thead>
        <tbody>
          {leads.map(lead => (
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
                {lead.effective_email || <span className="text-muted">이메일 없음</span>}
              </td>
              <td>
                <span className={`email-status-badge ${lead.email_status}`}>
                  {EMAIL_STATUS_LABELS[lead.email_status] || lead.email_status}
                </span>
              </td>
              <td>
                <span className={`platform-badge ${lead.platform}`}>
                  {PLATFORM_LABELS[lead.platform] || lead.platform}
                </span>
              </td>
              <td className="col-audience">
                {lead.audience_display_status === 'collected' ? (
                  <span className="audience-value">
                    {lead.effective_audience_label || lead.effective_audience_size}
                  </span>
                ) : (
                  <span className={`audience-status ${lead.audience_display_status}`}>
                    {AUDIENCE_DISPLAY_STATUS_LABELS[lead.audience_display_status]}
                  </span>
                )}
              </td>
              <td>
                {lead.effective_audience_tier ? (
                  <span className={`tier-badge ${lead.effective_audience_tier}`}>
                    {AUDIENCE_TIER_LABELS[lead.effective_audience_tier]}
                  </span>
                ) : null}
              </td>
              <td className="col-keyword">
                {lead.discovery_keyword || '-'}
              </td>
              <td>
                {lead.source_type ? (
                  <span className="source-badge-sm">
                    {SOURCE_TYPE_LABELS[lead.source_type] || lead.source_type}
                  </span>
                ) : '-'}
              </td>
              <td>
                <span className={`review-badge ${lead.review_status}`}>
                  {REVIEW_STATUS_LABELS[lead.review_status]}
                </span>
              </td>
              <td>
                <span className={`enrichment-status-badge ${lead.enrichment_status}`}>
                  {ENRICHMENT_STATUS_LABELS[lead.enrichment_status]}
                </span>
              </td>
              <td className="col-time">
                {lead.updated_at ? formatTime(lead.updated_at) : '-'}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
