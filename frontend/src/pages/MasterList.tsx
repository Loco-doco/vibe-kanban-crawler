import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { getMasterList, removeFromMasterList } from '../api/masterList'
import { exportCsvUrl } from '../api/leads'
import StatusBadge from '../components/StatusBadge'
import type { MasterListLead } from '../types'
import { PLATFORM_LABELS } from '../types'

export default function MasterList() {
  const [search, setSearch] = useState('')
  const queryClient = useQueryClient()

  const { data, isLoading } = useQuery({
    queryKey: ['master-list', { search }],
    queryFn: () => getMasterList({ search: search || undefined }),
  })

  const removeMutation = useMutation({
    mutationFn: removeFromMasterList,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['master-list'] }),
  })

  const handleExportCsv = () => {
    window.open(exportCsvUrl(), '_blank')
  }

  const formatSubscribers = (count: number | null) => {
    if (!count) return '-'
    if (count >= 10000) return `${(count / 10000).toFixed(1)}만`
    if (count >= 1000) return `${(count / 1000).toFixed(1)}천`
    return String(count)
  }

  const leads = data?.data || []
  const total = data?.total || 0

  return (
    <>
      <div className="page-header">
        <div>
          <h2>마스터 리스트</h2>
          <p className="page-header-sub">중복 제거된 최종 리드 목록 ({total}건)</p>
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
      </div>

      <div className="card">
        {isLoading ? (
          <div className="loading-state">불러오는 중...</div>
        ) : !leads.length ? (
          <div className="empty-state">
            <span className="empty-state-icon">{'\u{1F4CB}'}</span>
            <h3>마스터 리스트가 비어있습니다</h3>
            <p>리드 수집 페이지에서 작업 결과를 마스터 리스트에 추가하세요</p>
          </div>
        ) : (
          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>이메일</th>
                  <th>플랫폼</th>
                  <th>채널명</th>
                  <th>구독자</th>
                  <th>상태</th>
                  <th>추가일</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {leads.map((lead: MasterListLead) => (
                  <tr key={lead.id}>
                    <td className="email-cell">{lead.email || '-'}</td>
                    <td>
                      <span className={`platform-badge ${lead.platform}`}>
                        {PLATFORM_LABELS[lead.platform] || lead.platform}
                      </span>
                    </td>
                    <td>{lead.channel_name || '-'}</td>
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
