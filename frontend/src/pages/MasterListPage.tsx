import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { getJobs } from '../api/jobs'
import { getMasterList, addToMasterList, removeFromMasterList, resolveDuplicate } from '../api/masterList'
import { updateLead } from '../api/leads'
import type { Lead, Job, MasterListLead, DuplicateGroup } from '../types'
import { PLATFORM_LABELS } from '../types'

function formatNumber(n: number | null | undefined): string {
  if (n == null) return '-'
  return n.toLocaleString('ko-KR')
}

function DuplicateReviewModal({ duplicates, onClose, onResolve }: {
  duplicates: DuplicateGroup[]
  onClose: () => void
  onResolve: (groupId: string, action: string, keepLeadId?: number) => void
}) {
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content modal-wide" onClick={(e) => e.stopPropagation()}>
        <h3>중복 항목 확인</h3>
        <p className="modal-desc">
          다음 항목들이 기존 리스트와 중복될 수 있습니다. 각 항목을 확인해 주세요.
        </p>

        {duplicates.map((dup) => (
          <div key={dup.group_id} className="duplicate-review-card">
            <div className="dup-reason-badge">{dup.reason}</div>
            <div className="dup-compare">
              <div className="dup-card">
                <div className="dup-label">기존 항목</div>
                <div className="dup-detail">
                  <div><strong>이메일:</strong> {dup.existing_lead.email || '(없음)'}</div>
                  <div><strong>채널:</strong> {dup.existing_lead.channel_name || '-'}</div>
                  <div><strong>구독자:</strong> {formatNumber(dup.existing_lead.subscriber_count)}</div>
                </div>
              </div>
              <div className="dup-arrow">↔</div>
              <div className="dup-card">
                <div className="dup-label">새 항목</div>
                <div className="dup-detail">
                  <div><strong>이메일:</strong> {dup.new_lead.email || '(없음)'}</div>
                  <div><strong>채널:</strong> {dup.new_lead.channel_name || '-'}</div>
                  <div><strong>구독자:</strong> {formatNumber(dup.new_lead.subscriber_count)}</div>
                </div>
              </div>
            </div>
            <div className="dup-actions">
              <button
                className="btn-secondary"
                onClick={() => onResolve(dup.group_id, 'keep', dup.existing_lead.id)}
              >
                기존 유지
              </button>
              <button
                className="btn-secondary"
                onClick={() => onResolve(dup.group_id, 'keep', dup.new_lead.id)}
              >
                새 항목으로 교체
              </button>
              <button
                className="btn-outline"
                onClick={() => onResolve(dup.group_id, 'skip')}
              >
                건너뛰기
              </button>
            </div>
          </div>
        ))}

        <div className="modal-actions">
          <button onClick={onClose} className="btn-primary">완료</button>
        </div>
      </div>
    </div>
  )
}

function LeadEditModal({ lead, onClose, onSave }: {
  lead: MasterListLead
  onClose: () => void
  onSave: (id: number, data: Partial<Lead>) => void
}) {
  const [email, setEmail] = useState(lead.email || '')
  const [channelName, setChannelName] = useState(lead.channel_name || '')
  const [notes, setNotes] = useState(lead.notes || '')
  const [emailVerified, setEmailVerified] = useState(lead.email_verified)

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
          <button onClick={() => {
            onSave(lead.id, { email: email || null, channel_name: channelName || null, notes: notes || null, email_verified: emailVerified })
            onClose()
          }} className="btn-primary">저장</button>
        </div>
      </div>
    </div>
  )
}

export default function MasterListPage() {
  const queryClient = useQueryClient()
  const [searchTerm, setSearchTerm] = useState('')
  const [showMergePanel, setShowMergePanel] = useState(false)
  const [selectedJobIds, setSelectedJobIds] = useState<number[]>([])
  const [duplicates, setDuplicates] = useState<DuplicateGroup[] | null>(null)
  const [editingLead, setEditingLead] = useState<MasterListLead | null>(null)

  const { data: masterData } = useQuery({
    queryKey: ['master-list', searchTerm],
    queryFn: () => getMasterList({ search: searchTerm || undefined }),
  })

  const { data: jobs = [] } = useQuery({
    queryKey: ['jobs'],
    queryFn: getJobs,
  })

  const completedJobs = jobs.filter((j: Job) => j.status === 'completed')
  const entries = masterData?.data || []
  const total = masterData?.total || 0

  const addMutation = useMutation({
    mutationFn: async () => {
      const allDuplicates: DuplicateGroup[] = []
      let totalAdded = 0
      for (const jobId of selectedJobIds) {
        const result = await addToMasterList(jobId)
        totalAdded += result.added
        allDuplicates.push(...result.duplicates)
      }
      return { added: totalAdded, duplicates: allDuplicates }
    },
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ['master-list'] })
      if (result.duplicates.length > 0) {
        setDuplicates(result.duplicates)
      } else {
        alert(`${result.added}건이 최종 리스트에 추가되었습니다.`)
      }
      setSelectedJobIds([])
      setShowMergePanel(false)
    },
    onError: () => alert('추가에 실패했습니다. 다시 시도해 주세요.'),
  })

  const removeMutation = useMutation({
    mutationFn: (leadId: number) => removeFromMasterList(leadId),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['master-list'] }),
  })

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: Partial<Lead> }) => updateLead(id, data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['master-list'] }),
  })

  const resolveMutation = useMutation({
    mutationFn: ({ groupId, action, keepLeadId }: { groupId: string; action: string; keepLeadId?: number }) =>
      resolveDuplicate(groupId, action, keepLeadId),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['master-list'] }),
  })

  const toggleJobSelection = (jobId: number) => {
    setSelectedJobIds((prev) =>
      prev.includes(jobId) ? prev.filter((id) => id !== jobId) : [...prev, jobId]
    )
  }

  return (
    <div className="master-list-page">
      <div className="master-list-header">
        <div>
          <h2>최종 리스트</h2>
          <p className="header-subtitle">모든 수집 결과를 모아 관리하는 최종 리드 리스트입니다. ({total}건)</p>
        </div>
        <div className="header-actions">
          <button className="btn-primary" onClick={() => setShowMergePanel(!showMergePanel)}>
            {showMergePanel ? '닫기' : '수집 결과 추가'}
          </button>
          {total > 0 && (
            <a href="/api/leads/export/csv?source=master_list" className="btn-secondary" download>
              CSV 다운로드
            </a>
          )}
        </div>
      </div>

      {/* 수집 결과 병합 패널 */}
      {showMergePanel && (
        <div className="merge-panel">
          <h3>수집 작업 결과 추가</h3>
          <p className="merge-desc">완료된 수집 작업을 선택하여 최종 리스트에 추가하세요. 중복되는 항목은 자동으로 감지됩니다.</p>
          {completedJobs.length === 0 ? (
            <p className="text-muted">완료된 수집 작업이 없습니다.</p>
          ) : (
            <>
              <div className="merge-job-list">
                {completedJobs.map((job: Job) => (
                  <label key={job.id} className={`merge-job-card ${selectedJobIds.includes(job.id) ? 'selected' : ''}`}>
                    <input
                      type="checkbox"
                      checked={selectedJobIds.includes(job.id)}
                      onChange={() => toggleJobSelection(job.id)}
                    />
                    <div className="merge-job-info">
                      <div className="merge-job-name">{job.label || `수집 작업 #${job.id}`}</div>
                      <div className="merge-job-meta">
                        {job.platform && PLATFORM_LABELS[job.platform]}
                        {' · '}
                        {job.total_leads_found}건 수집
                      </div>
                    </div>
                  </label>
                ))}
              </div>
              <button
                className="btn-primary"
                disabled={selectedJobIds.length === 0 || addMutation.isPending}
                onClick={() => addMutation.mutate()}
              >
                {addMutation.isPending ? '추가 중...' : `선택한 ${selectedJobIds.length}개 작업 결과 추가`}
              </button>
            </>
          )}
        </div>
      )}

      {/* 검색 */}
      <div className="search-bar">
        <input
          type="text"
          className="form-input search-input"
          placeholder="이메일 또는 브랜드명으로 검색..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
        />
      </div>

      {/* 테이블 */}
      {entries.length === 0 ? (
        <div className="empty-state">
          <div className="empty-icon">📋</div>
          <h3>최종 리스트가 비어 있습니다</h3>
          <p>수집 작업이 완료된 후, 결과를 이 리스트에 추가할 수 있습니다.</p>
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
              {entries.map((lead) => {
                const isVerified = lead.email_verified || (lead.email != null)
                return (
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
                    <td>
                      <span className={`email-badge ${isVerified ? 'verified' : 'needs-check'}`}>
                        {isVerified ? '확인됨' : '확인 필요'}
                      </span>
                    </td>
                    <td className="td-notes">{lead.notes || '-'}</td>
                    <td className="td-actions">
                      <button className="btn-icon" onClick={() => setEditingLead(lead)} title="수정">✏️</button>
                      <button
                        className="btn-icon btn-icon-danger"
                        onClick={() => {
                          if (confirm('최종 리스트에서 이 항목을 제거하시겠습니까?')) {
                            removeMutation.mutate(lead.id)
                          }
                        }}
                        title="제거"
                      >🗑️</button>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      {editingLead && (
        <LeadEditModal
          lead={editingLead}
          onClose={() => setEditingLead(null)}
          onSave={(id, data) => updateMutation.mutate({ id, data })}
        />
      )}

      {duplicates && (
        <DuplicateReviewModal
          duplicates={duplicates}
          onClose={() => setDuplicates(null)}
          onResolve={(groupId, action, keepLeadId) =>
            resolveMutation.mutate({ groupId, action, keepLeadId })
          }
        />
      )}
    </div>
  )
}
