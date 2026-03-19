import { useState, useCallback } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { getJobs } from '../api/jobs'
import { getLeads, getQuality, bulkReview } from '../api/leads'
import ReviewJobSidebar from './ReviewJobSidebar'
import ReviewKPICards from './ReviewKPICards'
import QualityBanner from './QualityBanner'
import ReviewTable from './ReviewTable'
import BulkActions from './BulkActions'
import LeadDetailDrawer from './LeadDetailDrawer'
import SupplementarySearchModal from './SupplementarySearchModal'
import type { Job, Lead, ReviewStatus, SupplementaryType } from '../types'

interface Props {
  initialJobId?: number | null
}

const FINISHED_STATUSES = ['completed', 'completed_low_yield', 'failed', 'cancelled']

export default function ReviewWorkspace({ initialJobId }: Props) {
  const [selectedJobId, setSelectedJobId] = useState<number | null>(initialJobId ?? null)
  const [selectedLeadIds, setSelectedLeadIds] = useState<Set<number>>(new Set())
  const [selectedLead, setSelectedLead] = useState<Lead | null>(null)
  const [searchText, setSearchText] = useState('')
  const [emailStatusFilter, setEmailStatusFilter] = useState('')
  const [reviewStatusFilter, setReviewStatusFilter] = useState('')
  const [enrichmentStatusFilter, setEnrichmentStatusFilter] = useState('')
  const [audienceTierFilter, setAudienceTierFilter] = useState('')
  const [supplementModalType, setSupplementModalType] = useState<SupplementaryType | null>(null)
  const queryClient = useQueryClient()

  // Jobs
  const { data: allJobs } = useQuery({ queryKey: ['jobs'], queryFn: getJobs, refetchInterval: 10000 })
  const finishedJobs = (allJobs || []).filter((j: Job) => FINISHED_STATUSES.includes(j.status))

  // Auto-select first job
  const activeJobId = selectedJobId ?? (finishedJobs.length > 0 ? finishedJobs[0].id : null)

  // Leads
  const { data: leads, isLoading: leadsLoading } = useQuery({
    queryKey: ['leads', { job_id: activeJobId, search: searchText, email_status: emailStatusFilter, review_status: reviewStatusFilter, enrichment_status: enrichmentStatusFilter, audience_tier: audienceTierFilter }],
    queryFn: () => getLeads({
      job_id: activeJobId!,
      limit: 500,
      ...(searchText ? { search: searchText } : {}),
      ...(emailStatusFilter ? { email_status: emailStatusFilter } : {}),
      ...(reviewStatusFilter ? { review_status: reviewStatusFilter } : {}),
      ...(enrichmentStatusFilter ? { enrichment_status: enrichmentStatusFilter } : {}),
      ...(audienceTierFilter ? { audience_tier: audienceTierFilter } : {}),
    }),
    enabled: activeJobId !== null,
  })

  // Quality
  const { data: quality } = useQuery({
    queryKey: ['quality', activeJobId],
    queryFn: () => getQuality(activeJobId!),
    enabled: activeJobId !== null,
  })

  // Bulk review mutation
  const bulkMutation = useMutation({
    mutationFn: ({ ids, status }: { ids: number[]; status: ReviewStatus }) => bulkReview(ids, status),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['leads'] })
      queryClient.invalidateQueries({ queryKey: ['quality'] })
      setSelectedLeadIds(new Set())
    },
  })

  const handleSelectJob = useCallback((jobId: number) => {
    setSelectedJobId(jobId)
    setSelectedLeadIds(new Set())
    setSelectedLead(null)
  }, [])

  const handleToggleSelect = useCallback((id: number) => {
    setSelectedLeadIds(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }, [])

  const handleToggleSelectAll = useCallback(() => {
    if (!leads) return
    if (selectedLeadIds.size === leads.length) {
      setSelectedLeadIds(new Set())
    } else {
      setSelectedLeadIds(new Set(leads.map(l => l.id)))
    }
  }, [leads, selectedLeadIds.size])

  const handleBulkAction = useCallback((status: ReviewStatus) => {
    bulkMutation.mutate({ ids: Array.from(selectedLeadIds), status })
  }, [selectedLeadIds, bulkMutation])

  const handleRowClick = useCallback((lead: Lead) => {
    setSelectedLead(lead)
  }, [])

  const handleCloseDrawer = useCallback(() => {
    setSelectedLead(null)
  }, [])

  const handleLeadUpdated = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ['leads'] })
    queryClient.invalidateQueries({ queryKey: ['quality'] })
  }, [queryClient])

  const handleSupplementarySearch = useCallback((type: string) => {
    setSupplementModalType(type as SupplementaryType)
  }, [])

  return (
    <div className="review-workspace">
      <ReviewJobSidebar
        jobs={finishedJobs}
        selectedJobId={activeJobId}
        onSelect={handleSelectJob}
      />

      <div className="review-main">
        {!activeJobId ? (
          <div className="empty-state">
            <span className="empty-state-icon">{'\u{1F4CA}'}</span>
            <h3>탐색을 선택하세요</h3>
            <p>왼쪽에서 완료된 탐색을 선택하면 결과를 검토할 수 있습니다</p>
          </div>
        ) : (
          <>
            {/* KPI Cards */}
            {quality && <ReviewKPICards quality={quality} />}

            {/* Quality Banner */}
            {quality && (
              <QualityBanner
                quality={quality}
                onSupplementarySearch={handleSupplementarySearch}
              />
            )}

            {/* Filter Bar */}
            <div className="review-filter-bar">
              <input
                type="text"
                className="review-search-input"
                placeholder="이름, 이메일 검색..."
                value={searchText}
                onChange={e => setSearchText(e.target.value)}
              />
              <select
                className="review-filter-select"
                value={emailStatusFilter}
                onChange={e => setEmailStatusFilter(e.target.value)}
              >
                <option value="">이메일 상태</option>
                <option value="valid_syntax">유효</option>
                <option value="invalid_syntax">무효</option>
                <option value="missing">없음</option>
                <option value="user_corrected">수정됨</option>
              </select>
              <select
                className="review-filter-select"
                value={reviewStatusFilter}
                onChange={e => setReviewStatusFilter(e.target.value)}
              >
                <option value="">리뷰 상태</option>
                <option value="pending">검토 대기</option>
                <option value="approved">승인</option>
                <option value="rejected">제외</option>
                <option value="held">보류</option>
              </select>
              <select
                className="review-filter-select"
                value={enrichmentStatusFilter}
                onChange={e => setEnrichmentStatusFilter(e.target.value)}
              >
                <option value="">보강 상태</option>
                <option value="not_started">미시작</option>
                <option value="completed">완료</option>
                <option value="low_confidence">신뢰도 낮음</option>
              </select>
              <select
                className="review-filter-select"
                value={audienceTierFilter}
                onChange={e => setAudienceTierFilter(e.target.value)}
              >
                <option value="">영향력 등급</option>
                <option value="nano">Nano</option>
                <option value="micro">Micro</option>
                <option value="mid">Mid</option>
                <option value="macro">Macro</option>
                <option value="mega">Mega</option>
              </select>
            </div>

            {/* Bulk Actions */}
            <BulkActions
              selectedCount={selectedLeadIds.size}
              onAction={handleBulkAction}
              disabled={bulkMutation.isPending}
            />

            {/* Table */}
            {leadsLoading ? (
              <div className="loading-state">불러오는 중...</div>
            ) : !leads?.length ? (
              <div className="empty-state">
                <span className="empty-state-icon">{'\u{1F50D}'}</span>
                <h3>수집된 리드가 없습니다</h3>
              </div>
            ) : (
              <ReviewTable
                leads={leads}
                selectedIds={selectedLeadIds}
                onToggleSelect={handleToggleSelect}
                onToggleSelectAll={handleToggleSelectAll}
                onRowClick={handleRowClick}
              />
            )}
          </>
        )}
      </div>

      {/* Lead Detail Drawer */}
      {selectedLead && (
        <LeadDetailDrawer
          lead={selectedLead}
          onClose={handleCloseDrawer}
          onUpdated={handleLeadUpdated}
        />
      )}

      {/* Supplementary Search Modal */}
      {supplementModalType && activeJobId && (
        <SupplementarySearchModal
          jobId={activeJobId}
          suggestedType={supplementModalType}
          onClose={() => setSupplementModalType(null)}
        />
      )}
    </div>
  )
}
