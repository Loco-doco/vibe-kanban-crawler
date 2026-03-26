import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { getMasterList, removeFromMasterList } from '../api/masterList'
import { formatDate } from '../utils/datetime'
import type { MasterListLead } from '../types'
import {
  PLATFORM_LABELS,
  EMAIL_STATUS_LABELS,
  CONTACT_READINESS_LABELS,
  ENRICHMENT_STATUS_LABELS,
  AUDIENCE_TIER_LABELS,
} from '../types'

const PLATFORM_FILTERS = [
  { value: '', label: '전체 플랫폼' },
  { value: 'youtube', label: 'YouTube' },
  { value: 'instagram', label: 'Instagram' },
  { value: 'web', label: 'Web' },
]

const READINESS_FILTERS = [
  { value: '', label: '연락 상태' },
  { value: 'contactable', label: '연락 가능' },
  { value: 'platform_suspect', label: '의심' },
  { value: 'no_email', label: '이메일 없음' },
  { value: 'user_confirmed', label: '확인됨' },
]

type SortField = 'synced_at' | 'email' | 'subscriber_count' | 'channel_name' | 'priority_score'

export default function MasterList() {
  const [search, setSearch] = useState('')
  const [platformFilter, setPlatformFilter] = useState('')
  const [readinessFilter, setReadinessFilter] = useState('')
  const [sortField, setSortField] = useState<SortField>('synced_at')
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc')
  const queryClient = useQueryClient()

  const { data, isLoading } = useQuery({
    queryKey: ['master-list', { search }],
    queryFn: () => getMasterList({ search: search || undefined }),
  })

  const removeMutation = useMutation({
    mutationFn: removeFromMasterList,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['master-list'] }),
  })

  const formatSubscribers = (lead: MasterListLead) => {
    const size = lead.audience_size_override || lead.subscriber_count
    if (!size) return '-'
    if (size >= 10000) return `${(size / 10000).toFixed(1)}만`
    if (size >= 1000) return `${(size / 1000).toFixed(1)}천`
    return String(size)
  }

  const getEffectiveEmail = (lead: MasterListLead) => lead.contact_email || lead.email
  const getEffectiveName = (lead: MasterListLead) => lead.display_name || lead.channel_name
  const getEffectiveTier = (lead: MasterListLead) => lead.audience_tier_override || lead.audience_tier

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')
    } else {
      setSortField(field)
      setSortOrder('desc')
    }
  }

  const sortIcon = (field: SortField) => {
    if (sortField !== field) return ''
    return sortOrder === 'asc' ? ' \u2191' : ' \u2193'
  }

  // Client-side filtering and sorting
  let leads = data?.data || []
  const total = data?.total || 0

  if (platformFilter) {
    leads = leads.filter((l) => l.platform === platformFilter)
  }

  if (readinessFilter) {
    leads = leads.filter((l) => l.contact_readiness === readinessFilter)
  }

  leads = [...leads].sort((a, b) => {
    let cmp = 0
    switch (sortField) {
      case 'email':
        cmp = (getEffectiveEmail(a) || '').localeCompare(getEffectiveEmail(b) || '')
        break
      case 'subscriber_count':
        cmp = (a.audience_size_override || a.subscriber_count || 0) - (b.audience_size_override || b.subscriber_count || 0)
        break
      case 'channel_name':
        cmp = (getEffectiveName(a) || '').localeCompare(getEffectiveName(b) || '')
        break
      case 'priority_score':
        cmp = (a.priority_score || 0) - (b.priority_score || 0)
        break
      case 'synced_at':
      default:
        cmp = new Date(a.synced_at).getTime() - new Date(b.synced_at).getTime()
        break
    }
    return sortOrder === 'asc' ? cmp : -cmp
  })

  const emailCount = leads.filter((l) => getEffectiveEmail(l)).length
  const contactableCount = leads.filter((l) => l.contact_readiness === 'contactable').length

  const handleExportCsv = () => {
    const headers = ['이름', '이메일', '플랫폼', '채널명', '채널URL', '구독자', '영향력', '연락상태', '이메일상태', '보강상태', '반영일']
    const rows = leads.map((l) => [
      getEffectiveName(l) || '',
      getEffectiveEmail(l) || '',
      PLATFORM_LABELS[l.platform] || l.platform,
      l.channel_name || '',
      l.channel_url || '',
      l.audience_size_override || l.subscriber_count || '',
      getEffectiveTier(l) ? AUDIENCE_TIER_LABELS[getEffectiveTier(l)!] : '',
      CONTACT_READINESS_LABELS[l.contact_readiness] || l.contact_readiness,
      EMAIL_STATUS_LABELS[l.email_status] || l.email_status,
      ENRICHMENT_STATUS_LABELS[l.enrichment_status] || l.enrichment_status,
      formatDate(l.synced_at),
    ])
    const csv = [headers, ...rows].map((r) => r.map((c) => `"${c}"`).join(',')).join('\n')
    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `master-list-${new Date().toISOString().slice(0, 10)}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <>
      <div className="page-header">
        <div>
          <h2>마스터 리스트</h2>
          <p className="page-header-sub">
            승인 완료된 최종 연락 대상 ({total}건, 이메일 {emailCount}건, 연락 가능 {contactableCount}건)
          </p>
        </div>
        <div className="page-header-actions">
          <button className="btn btn-secondary" onClick={handleExportCsv} disabled={leads.length === 0}>
            CSV 내보내기
          </button>
        </div>
      </div>

      <div className="filter-bar" style={{ flexWrap: 'wrap' }}>
        <div className="search-input-box">
          <input
            type="text"
            placeholder="이름, 이메일, 채널명 검색..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        {PLATFORM_FILTERS.map((f) => (
          <span
            key={f.value}
            className={`filter-chip${platformFilter === f.value ? ' active' : ''}`}
            onClick={() => setPlatformFilter(f.value)}
          >
            {f.label}
          </span>
        ))}

        <span className="filter-divider" />

        {READINESS_FILTERS.map((f) => (
          <span
            key={f.value}
            className={`filter-chip${readinessFilter === f.value ? ' active' : ''}`}
            onClick={() => setReadinessFilter(f.value)}
          >
            {f.label}
          </span>
        ))}
      </div>

      <div className="card">
        {isLoading ? (
          <div className="loading-state">불러오는 중...</div>
        ) : !leads.length ? (
          <div className="empty-state">
            <span className="empty-state-icon">{'\u{1F4CB}'}</span>
            <h3>
              {platformFilter || readinessFilter
                ? '필터 조건에 맞는 리드가 없습니다'
                : '마스터 리스트가 비어있습니다'}
            </h3>
            <p>
              {platformFilter || readinessFilter
                ? '필터를 변경해보세요'
                : '검토 화면에서 리드를 승인하고 "최종 반영"하면 여기에 표시됩니다'}
            </p>
          </div>
        ) : (
          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th onClick={() => handleSort('channel_name')} style={{ cursor: 'pointer' }}>
                    이름{sortIcon('channel_name')}
                  </th>
                  <th onClick={() => handleSort('email')} style={{ cursor: 'pointer' }}>
                    이메일{sortIcon('email')}
                  </th>
                  <th>플랫폼</th>
                  <th onClick={() => handleSort('subscriber_count')} style={{ cursor: 'pointer' }}>
                    영향력{sortIcon('subscriber_count')}
                  </th>
                  <th>연락 상태</th>
                  <th>보강</th>
                  <th onClick={() => handleSort('priority_score')} style={{ cursor: 'pointer' }}>
                    우선순위{sortIcon('priority_score')}
                  </th>
                  <th onClick={() => handleSort('synced_at')} style={{ cursor: 'pointer' }}>
                    반영일{sortIcon('synced_at')}
                  </th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {leads.map((lead: MasterListLead) => {
                  const effectiveEmail = getEffectiveEmail(lead)
                  const effectiveName = getEffectiveName(lead)
                  const effectiveTier = getEffectiveTier(lead)

                  return (
                    <tr key={lead.id}>
                      <td>
                        {lead.channel_url ? (
                          <a href={lead.channel_url} target="_blank" rel="noopener noreferrer" className="channel-link">
                            {effectiveName || '채널 보기'}
                            <span className="channel-link-icon">{'\u2197'}</span>
                          </a>
                        ) : (
                          effectiveName || '-'
                        )}
                      </td>
                      <td className="email-cell">
                        {effectiveEmail ? (
                          <span>
                            {effectiveEmail}
                            {lead.email_status === 'user_corrected' && (
                              <span className="badge badge-info" style={{ marginLeft: 4, fontSize: '0.7rem' }}>수정</span>
                            )}
                          </span>
                        ) : (
                          <span style={{ color: 'var(--gray-400)', fontStyle: 'italic' }}>없음</span>
                        )}
                      </td>
                      <td>
                        <span className={`platform-badge ${lead.platform}`}>
                          {PLATFORM_LABELS[lead.platform] || lead.platform}
                        </span>
                      </td>
                      <td>
                        <span>{formatSubscribers(lead)}</span>
                        {effectiveTier && (
                          <span className="badge badge-neutral" style={{ marginLeft: 4, fontSize: '0.7rem' }}>
                            {AUDIENCE_TIER_LABELS[effectiveTier]}
                          </span>
                        )}
                      </td>
                      <td>
                        <ContactReadinessBadge readiness={lead.contact_readiness} />
                      </td>
                      <td>
                        <EnrichmentBadge status={lead.enrichment_status} />
                      </td>
                      <td style={{ textAlign: 'center', fontVariantNumeric: 'tabular-nums' }}>
                        {lead.priority_score > 0 ? lead.priority_score.toFixed(0) : '-'}
                      </td>
                      <td style={{ color: 'var(--gray-400)', fontSize: '0.8rem' }}>
                        {formatDate(lead.synced_at)}
                      </td>
                      <td>
                        <button
                          className="btn-small btn-cancel"
                          onClick={() => removeMutation.mutate(lead.id)}
                          title="마스터 리스트에서 제거"
                        >
                          제거
                        </button>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </>
  )
}

function ContactReadinessBadge({ readiness }: { readiness: string }) {
  const colors: Record<string, string> = {
    contactable: 'var(--green-600)',
    user_confirmed: 'var(--blue-600)',
    needs_verification: 'var(--yellow-600)',
    platform_suspect: 'var(--orange-600)',
    no_email: 'var(--gray-400)',
  }
  return (
    <span style={{ color: colors[readiness] || 'var(--gray-400)', fontSize: '0.85rem' }}>
      {CONTACT_READINESS_LABELS[readiness] || readiness}
    </span>
  )
}

function EnrichmentBadge({ status }: { status: string }) {
  const colors: Record<string, string> = {
    completed: 'var(--green-600)',
    low_confidence: 'var(--yellow-600)',
    not_started: 'var(--gray-400)',
    failed: 'var(--red-600)',
  }
  return (
    <span style={{ color: colors[status] || 'var(--gray-400)', fontSize: '0.85rem' }}>
      {ENRICHMENT_STATUS_LABELS[status] || status}
    </span>
  )
}
