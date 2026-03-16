import { useState } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { getJob, cancelJob } from '../api/jobs'
import { getLeads, updateLead, deleteLead, exportCsvUrl } from '../api/leads'
import { addToMasterList } from '../api/masterList'
import type { Lead, Job, DuplicateGroup } from '../types'
import { PLATFORM_LABELS, STATUS_LABELS } from '../types'

function formatNumber(n: number | null | undefined): string {
  if (n == null) return '-'
  return n.toLocaleString('ko-KR')
}

function EmailBadge({ lead }: { lead: Lead }) {
  const isVerified = lead.email_verified || (lead.email && lead.confidence_score >= 0.9)
  if (isVerified) {
    return <span className="email-badge verified">확인됨</span>
  }
  return <span className="email-badge needs-check">확인 필요</span>
}

function LeadEditModal({ lead, onClose, onSave }: {
  lead: Lead
  onClose: () => void
  onSave: (id: number, data: Partial<Lead>) => void
}) {
  const [email, setEmail] = useState(lead.email || '')
  const [channelName, setChannelName] = useState(lead.channel_name || '')
  const [channelUrl, setChannelUrl] = useState(lead.channel_url || '')
  const [notes, setNotes] = useState(lead.notes || '')
  const [emailVerified, setEmailVerified] = useState(lead.email_verified)

  const handleSave = () => {
    onSave(lead.id, {
      email: email || null,
      channel_name: channelName || null,
      channel_url: channelUrl || null,
      notes: notes || null,
      email_verified: emailVerified,
    })
    onClose()
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <h3>정보 수정</h3>

        <div className="modal-field">
          <label>이메일</label>
          <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} className="form-input" />
        </div>

        <div className="modal-field">
          <label>브랜드/채널명</label>
          <input type="text" value={channelName} onChange={(e) => setChannelName(e.target.value)} className="form-input" />
        </div>

        <div className="modal-field">
          <label>채널 링크</label>
          <div className="input-with-action">
            <input type="url" value={channelUrl} onChange={(e) => setChannelUrl(e.target.value)} className="form-input" />
            {channelUrl && (
              <a href={channelUrl} target="_blank" rel="noopener noreferrer" className="btn-link">
                열기
              </a>
            )}
          </div>
        </div>

        <div className="modal-field">
          <label>메모</label>
          <textarea value={notes} onChange={(e) => setNotes(e.target.value)} className="form-textarea" rows={2} />
        </div>

        <div className="modal-field checkbox-field">
          <label>
            <input type="checkbox" checked={emailVerified} onChange={(e) => setEmailVerified(e.target.checked)} />
            이메일 확인 완료
          </label>
        </div>

        <div className="modal-actions">
          <button onClick={onClose} className="btn-secondary">취소</button>
          <button onClick={handleSave} className="btn-primary">저장</button>
        </div>
      </div>
    </div>
  )
}

function DuplicateResultModal({ duplicates, onClose }: {
  duplicates: DuplicateGroup[]
  onClose: () => void
}) {
  if (duplicates.length === 0) return null

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content modal-wide" onClick={(e) => e.stopPropagation()}>
        <h3>중복 항목 발견</h3>
        <p className="modal-desc">
          아래 항목들이 최종 리스트에 이미 존재하는 항목과 중복됩니다.
          최종 리스트 페이지에서 중복을 관리할 수 있습니다.
        </p>
        <div className="duplicate-list">
          {duplicates.map((dup) => (
            <div key={dup.group_id} className="duplicate-item">
              <div className="dup-reason">{dup.reason}</div>
              <div className="dup-compare">
                <div className="dup-card">
                  <div className="dup-label">기존</div>
                  <div>{dup.existing_lead.email || '(이메일 없음)'}</div>
                  <div>{dup.existing_lead.channel_name || '-'}</div>
                </div>
                <div className="dup-arrow">↔</div>
                <div className="dup-card">
                  <div className="dup-label">신규</div>
                  <div>{dup.new_lead.email || '(이메일 없음)'}</div>
                  <div>{dup.new_lead.channel_name || '-'}</div>
                </div>
              </div>
            </div>
          ))}
        </div>
        <div className="modal-actions">
          <Link to="/master-list" className="btn-primary">최종 리스트에서 관리</Link>
          <button onClick={onClose} className="btn-secondary">닫기</button>
        </div>
      </div>
    </div>
  )
}

export default function JobDetailPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const jobId = Number(id)

  const [editingLead, setEditingLead] = useState<Lead | null>(null)
  const [duplicateResult, setDuplicateResult] = useState<DuplicateGroup[] | null>(null)
  const [searchTerm, setSearchTerm] = useState('')

  const { data: job, isLoading: jobLoading } = useQuery({
    queryKey: ['job', jobId],
    queryFn: () => getJob(jobId),
    refetchInterval: (query) => {
      const j = query.state.data as Job | undefined
      return j && (j.status === 'running' || j.status === 'pending') ? 3000 : false
    },
  })

  const { data: leads = [] } = useQuery({
    queryKey: ['leads', jobId, searchTerm],
    queryFn: () => getLeads({ job_id: jobId, search: searchTerm || undefined, limit: 500 }),
    refetchInterval: job?.status === 'running' ? 5000 : false,
  })

  const cancelMutation = useMutation({
    mutationFn: () => cancelJob(jobId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['job', jobId] })
      queryClient.invalidateQueries({ queryKey: ['jobs'] })
    },
  })

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: Partial<Lead> }) => updateLead(id, data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['leads', jobId] }),
  })

  const deleteMutation = useMutation({
    mutationFn: (leadId: number) => deleteLead(leadId),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['leads', jobId] }),
  })

  const addToMasterMutation = useMutation({
    mutationFn: () => addToMasterList(jobId),
    onSuccess: (result) => {
      if (result.duplicates.length > 0) {
        setDuplicateResult(result.duplicates)
      } else {
        alert(`${result.added}건이 최종 리스트에 추가되었습니다.`)
      }
      queryClient.invalidateQueries({ queryKey: ['master-list'] })
    },
    onError: () => alert('최종 리스트 추가에 실패했습니다.'),
  })

  if (jobLoading || !job) {
    return <div className="loading-state">불러오는 중...</div>
  }

  const isActive = job.status === 'running' || job.status === 'pending'

  return (
    <div className="detail-page">
      {/* 상단 헤더 */}
      <div className="detail-header">
        <button onClick={() => navigate('/')} className="btn-back">← 대시보드</button>
        <div className="detail-title-row">
          <h2>{job.label || `수집 작업 #${job.id}`}</h2>
          <span className={`status-badge status-${job.status}`}>
            {STATUS_LABELS[job.status]}
          </span>
        </div>
      </div>

      {/* 진행 상황 */}
      <div className="detail-progress-section">
        <div className="detail-progress-bar">
          <div className="progress-bar progress-bar-large">
            <div className="progress-fill" style={{ width: `${job.progress.percentage}%` }} />
          </div>
          <div className="progress-detail">
            <span className="progress-main">
              {formatNumber(job.progress.collected)}건 수집
              {job.progress.target > 0 && ` / 목표 ${formatNumber(job.progress.target)}건`}
            </span>
            {job.progress.target > 0 && (
              <span className="progress-pct">{job.progress.percentage}%</span>
            )}
          </div>
        </div>

        <div className="detail-meta">
          {job.platform && (
            <div className="meta-item">
              <span className="meta-label">플랫폼</span>
              <span>{PLATFORM_LABELS[job.platform] || job.platform}</span>
            </div>
          )}
          {job.category_tags?.length > 0 && (
            <div className="meta-item">
              <span className="meta-label">카테고리</span>
              <span>{job.category_tags.join(', ')}</span>
            </div>
          )}
          {(job.subscriber_min || job.subscriber_max) && (
            <div className="meta-item">
              <span className="meta-label">구독자 범위</span>
              <span>
                {job.subscriber_min ? `${formatNumber(job.subscriber_min)}명` : '제한없음'}
                {' ~ '}
                {job.subscriber_max ? `${formatNumber(job.subscriber_max)}명` : '제한없음'}
              </span>
            </div>
          )}
          {job.extra_conditions && (
            <div className="meta-item">
              <span className="meta-label">추가 조건</span>
              <span>{job.extra_conditions}</span>
            </div>
          )}
        </div>
      </div>

      {/* 액션 버튼들 */}
      <div className="detail-actions">
        {isActive && (
          <button className="btn-danger" onClick={() => cancelMutation.mutate()} disabled={cancelMutation.isPending}>
            수집 중지
          </button>
        )}
        {job.status === 'completed' && (
          <button
            className="btn-primary"
            onClick={() => addToMasterMutation.mutate()}
            disabled={addToMasterMutation.isPending}
          >
            {addToMasterMutation.isPending ? '추가 중...' : '최종 리스트에 추가'}
          </button>
        )}
        <a href={exportCsvUrl({ job_id: jobId })} className="btn-secondary" download>
          CSV 다운로드
        </a>
      </div>

      {/* 리드 테이블 */}
      <div className="lead-section">
        <div className="lead-section-header">
          <h3>수집된 리드 ({leads.length}건)</h3>
          <input
            type="text"
            className="form-input search-input"
            placeholder="이메일 또는 채널명으로 검색..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>

        {leads.length === 0 ? (
          <div className="empty-state">
            {isActive ? (
              <>
                <div className="empty-icon">⏳</div>
                <p>수집 진행 중입니다. 잠시 후 결과가 나타납니다.</p>
              </>
            ) : (
              <>
                <div className="empty-icon">📭</div>
                <p>수집된 리드가 없습니다.</p>
              </>
            )}
          </div>
        ) : (
          <div className="table-wrapper">
            <table className="lead-table">
              <thead>
                <tr>
                  <th>이메일</th>
                  <th>브랜드명</th>
                  <th>구독자 수</th>
                  <th>수집 출처</th>
                  <th>채널 링크</th>
                  <th>확인 상태</th>
                  <th>메모</th>
                  <th>작업</th>
                </tr>
              </thead>
              <tbody>
                {leads.map((lead) => (
                  <tr key={lead.id}>
                    <td className="td-email">{lead.email || <span className="text-muted">(없음)</span>}</td>
                    <td>{lead.channel_name || '-'}</td>
                    <td className="td-number">{formatNumber(lead.subscriber_count)}</td>
                    <td>{PLATFORM_LABELS[lead.platform] || lead.platform}</td>
                    <td>
                      {lead.channel_url ? (
                        <a href={lead.channel_url} target="_blank" rel="noopener noreferrer" className="link-external">
                          바로가기
                        </a>
                      ) : '-'}
                    </td>
                    <td><EmailBadge lead={lead} /></td>
                    <td className="td-notes">{lead.notes || '-'}</td>
                    <td className="td-actions">
                      <button className="btn-icon" onClick={() => setEditingLead(lead)} title="수정">✏️</button>
                      <button
                        className="btn-icon btn-icon-danger"
                        onClick={() => {
                          if (confirm('이 리드를 삭제하시겠습니까?')) {
                            deleteMutation.mutate(lead.id)
                          }
                        }}
                        title="삭제"
                      >🗑️</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {editingLead && (
        <LeadEditModal
          lead={editingLead}
          onClose={() => setEditingLead(null)}
          onSave={(id, data) => updateMutation.mutate({ id, data })}
        />
      )}

      {duplicateResult && (
        <DuplicateResultModal
          duplicates={duplicateResult}
          onClose={() => setDuplicateResult(null)}
        />
      )}
    </div>
  )
}
