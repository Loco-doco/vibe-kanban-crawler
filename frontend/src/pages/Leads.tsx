import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { getLeads, exportCsvUrl } from '../api/leads'
import StatusBadge from '../components/StatusBadge'
import type { Lead } from '../types'
import { PLATFORM_LABELS } from '../types'

const STATUS_FILTERS = [
  { value: '', label: '전체' },
  { value: 'scraped', label: '수집 완료' },
  { value: 'verified', label: '확인됨' },
  { value: 'contacted', label: '연락함' },
  { value: 'replied', label: '답변 받음' },
  { value: 'bounced', label: '바운스' },
  { value: 'manual_review', label: '직접 확인' },
]

const PLATFORM_FILTERS = [
  { value: '', label: '전체 플랫폼' },
  { value: 'youtube', label: 'YouTube' },
  { value: 'instagram', label: 'Instagram' },
  { value: 'web', label: 'Web' },
]

export default function Leads() {
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [platformFilter, setPlatformFilter] = useState('')
  const [sort, setSort] = useState('confidence_score')
  const [order, setOrder] = useState('desc')

  const { data: leads, isLoading } = useQuery({
    queryKey: ['leads', { search, status: statusFilter, platform: platformFilter, sort, order }],
    queryFn: () => getLeads({
      search: search || undefined,
      status: statusFilter || undefined,
      platform: platformFilter || undefined,
      sort,
      order,
    }),
  })

  const handleExportCsv = () => {
    const url = exportCsvUrl({
      search: search || undefined,
      status: statusFilter || undefined,
      platform: platformFilter || undefined,
    })
    window.open(url, '_blank')
  }

  const handleSort = (field: string) => {
    if (sort === field) {
      setOrder(order === 'asc' ? 'desc' : 'asc')
    } else {
      setSort(field)
      setOrder('desc')
    }
  }

  const sortIcon = (field: string) => {
    if (sort !== field) return ''
    return order === 'asc' ? ' \u2191' : ' \u2193'
  }

  const confidenceClass = (score: number) => {
    if (score >= 0.7) return 'high'
    if (score >= 0.4) return 'mid'
    return 'low'
  }

  const formatSubscribers = (count: number | null) => {
    if (!count) return '-'
    if (count >= 10000) return `${(count / 10000).toFixed(1)}만`
    if (count >= 1000) return `${(count / 1000).toFixed(1)}천`
    return String(count)
  }

  return (
    <>
      <div className="page-header">
        <div>
          <h2>전체 리드</h2>
          <p className="page-header-sub">수집된 모든 연락처를 관리하고 상태를 업데이트하세요</p>
        </div>
        <div className="page-header-actions">
          <button className="btn btn-secondary" onClick={handleExportCsv}>
            <span>{'\u2B07\uFE0F'}</span> CSV 내보내기
          </button>
        </div>
      </div>

      <div className="filter-bar">
        <div className="search-input-box">
          <span style={{ color: 'var(--gray-400)', marginRight: 4 }}>{'\u{1F50E}'}</span>
          <input
            type="text"
            placeholder="이메일, 채널명으로 검색..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        {STATUS_FILTERS.map((f) => (
          <span
            key={f.value}
            className={`filter-chip${statusFilter === f.value ? ' active' : ''}`}
            onClick={() => setStatusFilter(f.value)}
          >
            {f.label}
          </span>
        ))}
      </div>

      <div className="filter-bar" style={{ marginTop: -12 }}>
        {PLATFORM_FILTERS.map((f) => (
          <span
            key={f.value}
            className={`filter-chip${platformFilter === f.value ? ' active' : ''}`}
            onClick={() => setPlatformFilter(f.value)}
          >
            {f.label}
          </span>
        ))}
      </div>

      <div className="card">
        {isLoading ? (
          <div className="loading-state">불러오는 중...</div>
        ) : !leads?.length ? (
          <div className="empty-state">
            <span className="empty-state-icon">{'\u{1F465}'}</span>
            <h3>리드가 없습니다</h3>
            <p>리드 수집 페이지에서 크롤링 작업을 시작하세요</p>
          </div>
        ) : (
          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th onClick={() => handleSort('email')} style={{ cursor: 'pointer' }}>
                    이메일{sortIcon('email')}
                  </th>
                  <th onClick={() => handleSort('platform')} style={{ cursor: 'pointer' }}>
                    플랫폼{sortIcon('platform')}
                  </th>
                  <th>채널명</th>
                  <th onClick={() => handleSort('subscriber_count')} style={{ cursor: 'pointer' }}>
                    구독자{sortIcon('subscriber_count')}
                  </th>
                  <th onClick={() => handleSort('confidence_score')} style={{ cursor: 'pointer' }}>
                    정확도{sortIcon('confidence_score')}
                  </th>
                  <th>상태</th>
                  <th>수집일</th>
                </tr>
              </thead>
              <tbody>
                {leads.map((lead: Lead) => (
                  <tr key={lead.id}>
                    <td className="email-cell">{lead.email || '-'}</td>
                    <td>
                      <span className={`platform-badge ${lead.platform}`}>
                        {PLATFORM_LABELS[lead.platform] || lead.platform}
                      </span>
                    </td>
                    <td>{lead.channel_name || '-'}</td>
                    <td>{formatSubscribers(lead.subscriber_count)}</td>
                    <td>
                      <span className={`confidence ${confidenceClass(lead.confidence_score)}`}>
                        {Math.round(lead.confidence_score * 100)}%
                      </span>
                    </td>
                    <td><StatusBadge status={lead.status} /></td>
                    <td style={{ color: 'var(--gray-400)', fontSize: '0.8rem' }}>
                      {new Date(lead.inserted_at).toLocaleDateString('ko-KR')}
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
