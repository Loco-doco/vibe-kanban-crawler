import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { getMasterList, removeFromMasterList } from '../api/masterList'
import StatusBadge from '../components/StatusBadge'
import type { MasterListLead } from '../types'
import { PLATFORM_LABELS } from '../types'

const PLATFORM_FILTERS = [
  { value: '', label: '전체 플랫폼' },
  { value: 'youtube', label: 'YouTube' },
  { value: 'instagram', label: 'Instagram' },
  { value: 'web', label: 'Web' },
]

type SortField = 'inserted_at' | 'email' | 'subscriber_count' | 'channel_name'

export default function MasterList() {
  const [search, setSearch] = useState('')
  const [platformFilter, setPlatformFilter] = useState('')
  const [emailFilter, setEmailFilter] = useState<'' | 'has' | 'no'>('')
  const [sortField, setSortField] = useState<SortField>('inserted_at')
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

  const formatSubscribers = (count: number | null) => {
    if (!count) return '-'
    if (count >= 10000) return `${(count / 10000).toFixed(1)}만`
    if (count >= 1000) return `${(count / 1000).toFixed(1)}천`
    return String(count)
  }

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

  if (emailFilter === 'has') {
    leads = leads.filter((l) => l.email)
  } else if (emailFilter === 'no') {
    leads = leads.filter((l) => !l.email)
  }

  leads = [...leads].sort((a, b) => {
    let cmp = 0
    switch (sortField) {
      case 'email':
        cmp = (a.email || '').localeCompare(b.email || '')
        break
      case 'subscriber_count':
        cmp = (a.subscriber_count || 0) - (b.subscriber_count || 0)
        break
      case 'channel_name':
        cmp = (a.channel_name || '').localeCompare(b.channel_name || '')
        break
      case 'inserted_at':
      default:
        cmp = new Date(a.inserted_at).getTime() - new Date(b.inserted_at).getTime()
        break
    }
    return sortOrder === 'asc' ? cmp : -cmp
  })

  const emailCount = leads.filter((l) => l.email).length

  const handleExportCsv = () => {
    const headers = ['이메일', '플랫폼', '채널명', '구독자', '상태', '추가일']
    const rows = leads.map((l) => [
      l.email || '',
      PLATFORM_LABELS[l.platform] || l.platform,
      l.channel_name || '',
      l.subscriber_count || '',
      l.status,
      new Date(l.inserted_at).toLocaleDateString('ko-KR'),
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
            중복 제거된 최종 리드 목록 ({total}건{emailCount < total ? `, 이메일 ${emailCount}건` : ''})
          </p>
        </div>
        <div className="page-header-actions">
          <button className="btn btn-secondary" onClick={handleExportCsv} disabled={leads.length === 0}>
            <span>{'\u2B07\uFE0F'}</span> CSV 내보내기
          </button>
        </div>
      </div>

      <div className="filter-bar" style={{ flexWrap: 'wrap' }}>
        <div className="search-input-box">
          <span style={{ color: 'var(--gray-400)', marginRight: 4 }}>{'\u{1F50E}'}</span>
          <input
            type="text"
            placeholder="이메일, 채널명으로 검색..."
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

        <span
          className={`filter-chip${emailFilter === '' ? ' active' : ''}`}
          onClick={() => setEmailFilter('')}
        >전체</span>
        <span
          className={`filter-chip${emailFilter === 'has' ? ' active' : ''}`}
          onClick={() => setEmailFilter('has')}
        >이메일 있음</span>
        <span
          className={`filter-chip${emailFilter === 'no' ? ' active' : ''}`}
          onClick={() => setEmailFilter('no')}
        >이메일 없음</span>
      </div>

      <div className="card">
        {isLoading ? (
          <div className="loading-state">불러오는 중...</div>
        ) : !leads.length ? (
          <div className="empty-state">
            <span className="empty-state-icon">{'\u{1F4CB}'}</span>
            <h3>
              {platformFilter || emailFilter
                ? '필터 조건에 맞는 리드가 없습니다'
                : '마스터 리스트가 비어있습니다'}
            </h3>
            <p>
              {platformFilter || emailFilter
                ? '필터를 변경해보세요'
                : '탐색 결과 페이지에서 리드를 마스터 리스트에 추가하세요'}
            </p>
          </div>
        ) : (
          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th onClick={() => handleSort('email')} style={{ cursor: 'pointer' }}>
                    이메일{sortIcon('email')}
                  </th>
                  <th>플랫폼</th>
                  <th onClick={() => handleSort('channel_name')} style={{ cursor: 'pointer' }}>
                    채널명{sortIcon('channel_name')}
                  </th>
                  <th onClick={() => handleSort('subscriber_count')} style={{ cursor: 'pointer' }}>
                    구독자{sortIcon('subscriber_count')}
                  </th>
                  <th>상태</th>
                  <th onClick={() => handleSort('inserted_at')} style={{ cursor: 'pointer' }}>
                    추가일{sortIcon('inserted_at')}
                  </th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {leads.map((lead: MasterListLead) => (
                  <tr key={lead.id}>
                    <td className="email-cell">
                      {lead.email || <span style={{ color: 'var(--gray-400)', fontStyle: 'italic' }}>이메일 없음</span>}
                    </td>
                    <td>
                      <span className={`platform-badge ${lead.platform}`}>
                        {PLATFORM_LABELS[lead.platform] || lead.platform}
                      </span>
                    </td>
                    <td>
                      {lead.channel_url ? (
                        <a href={lead.channel_url} target="_blank" rel="noopener noreferrer" className="channel-link">
                          {lead.channel_name || '채널 보기'}
                          <span className="channel-link-icon">{'\u2197'}</span>
                        </a>
                      ) : (
                        lead.channel_name || '-'
                      )}
                    </td>
                    <td>{formatSubscribers(lead.subscriber_count)}</td>
                    <td><StatusBadge status={lead.status} /></td>
                    <td style={{ color: 'var(--gray-400)', fontSize: '0.8rem' }}>
                      {new Date(lead.inserted_at).toLocaleDateString('ko-KR')}
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
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </>
  )
}
