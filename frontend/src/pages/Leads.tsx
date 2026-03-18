import { useState, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { getLeads, exportCsvUrl, updateLead } from '../api/leads'
import StatusBadge from '../components/StatusBadge'
import { formatDate } from '../utils/datetime'
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

const EMAIL_FILTERS = [
  { value: '', label: '전체' },
  { value: 'true', label: '이메일 있음' },
  { value: 'false', label: '이메일 없음' },
]

export default function Leads() {
  const [search, setSearch] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [platformFilter, setPlatformFilter] = useState('')
  const [emailFilter, setEmailFilter] = useState('')
  const [minConfidence, setMinConfidence] = useState('')
  const [sort, setSort] = useState('confidence_score')
  const [order, setOrder] = useState('desc')
  const [editingLeadId, setEditingLeadId] = useState<number | null>(null)
  const [editEmail, setEditEmail] = useState('')
  const queryClient = useQueryClient()

  const emailMutation = useMutation({
    mutationFn: ({ id, email }: { id: number; email: string }) =>
      updateLead(id, { email, status: 'scraped' } as Partial<Lead>),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['leads'] })
      setEditingLeadId(null)
      setEditEmail('')
    },
  })

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(search), 300)
    return () => clearTimeout(timer)
  }, [search])

  const { data: leads, isLoading } = useQuery({
    queryKey: ['leads', { search: debouncedSearch, status: statusFilter, platform: platformFilter, has_email: emailFilter, min_confidence: minConfidence, sort, order }],
    queryFn: () => getLeads({
      search: debouncedSearch || undefined,
      status: statusFilter || undefined,
      platform: platformFilter || undefined,
      has_email: emailFilter || undefined,
      min_confidence: minConfidence || undefined,
      sort,
      order,
      limit: 500,
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

  const emailCount = leads?.filter((l) => l.email).length || 0
  const totalCount = leads?.length || 0

  return (
    <>
      <div className="page-header">
        <div>
          <h2>전체 리드</h2>
          <p className="page-header-sub">
            수집된 모든 연락처를 관리하세요
            {totalCount > 0 && ` (${totalCount}건${emailFilter === '' ? `, 이메일 ${emailCount}건` : ''})`}
          </p>
        </div>
        <div className="page-header-actions">
          <button className="btn btn-secondary" onClick={handleExportCsv}>
            <span>{'\u2B07\uFE0F'}</span> CSV 내보내기
          </button>
        </div>
      </div>

      {/* Filter Bar */}
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

        {/* Status filters */}
        {STATUS_FILTERS.map((f) => (
          <span
            key={f.value}
            className={`filter-chip${statusFilter === f.value ? ' active' : ''}`}
            onClick={() => setStatusFilter(f.value)}
          >
            {f.label}
          </span>
        ))}

        <span className="filter-divider" />

        {/* Platform filters */}
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

        {/* Email presence filter */}
        {EMAIL_FILTERS.map((f) => (
          <span
            key={`email-${f.value}`}
            className={`filter-chip${emailFilter === f.value ? ' active' : ''}`}
            onClick={() => setEmailFilter(f.value)}
          >
            {f.label}
          </span>
        ))}

        <span className="filter-divider" />

        {/* Confidence filter */}
        <span
          className={`filter-chip${minConfidence === '0.7' ? ' active' : ''}`}
          onClick={() => setMinConfidence(minConfidence === '0.7' ? '' : '0.7')}
        >
          정확도 70%+
        </span>
      </div>

      <div className="card">
        {isLoading ? (
          <div className="loading-state">불러오는 중...</div>
        ) : !leads?.length ? (
          <div className="empty-state">
            <span className="empty-state-icon">{'\u{1F465}'}</span>
            <h3>리드가 없습니다</h3>
            <p>
              {statusFilter || platformFilter || emailFilter || minConfidence
                ? '현재 필터 조건에 맞는 리드가 없습니다. 필터를 변경해보세요.'
                : '리드 수집 페이지에서 키워드 탐색을 시작하세요'}
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
                    <td className="email-cell">
                      {editingLeadId === lead.id ? (
                        <span className="inline-email-edit">
                          <input
                            type="email"
                            className="inline-email-input"
                            value={editEmail}
                            onChange={(e) => setEditEmail(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter' && editEmail.trim()) {
                                emailMutation.mutate({ id: lead.id, email: editEmail.trim() })
                              }
                              if (e.key === 'Escape') setEditingLeadId(null)
                            }}
                            placeholder="이메일 입력 후 Enter"
                            autoFocus
                          />
                          <button
                            className="btn-small btn-view-results"
                            onClick={() => editEmail.trim() && emailMutation.mutate({ id: lead.id, email: editEmail.trim() })}
                          >저장</button>
                          <button
                            className="btn-small"
                            style={{ background: 'var(--gray-100)', color: 'var(--gray-600)' }}
                            onClick={() => setEditingLeadId(null)}
                          >취소</button>
                        </span>
                      ) : lead.email ? (
                        lead.email
                      ) : (
                        <span
                          className="add-email-btn"
                          onClick={() => { setEditingLeadId(lead.id); setEditEmail('') }}
                          title="클릭하여 이메일 직접 입력"
                        >
                          + 이메일 추가
                        </span>
                      )}
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
                    <td>
                      <span className={`confidence ${confidenceClass(lead.confidence_score)}`}>
                        {Math.round(lead.confidence_score * 100)}%
                      </span>
                    </td>
                    <td><StatusBadge status={lead.status} /></td>
                    <td style={{ color: 'var(--gray-400)', fontSize: '0.8rem' }}>
                      {formatDate(lead.inserted_at)}
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
