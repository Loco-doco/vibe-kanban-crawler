import { useState, useCallback } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { getJobs, enrichSubscribers, enrichChannels } from '../api/jobs'
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

type EnrichState = 'idle' | 'running' | 'done' | 'error'

export default function ReviewWorkspace({ initialJobId }: Props) {
  const [selectedJobId, setSelectedJobId] = useState<number | null>(initialJobId ?? null)
  const [selectedLeadIds, setSelectedLeadIds] = useState<Set<number>>(new Set())
  const [drawerLeadId, setDrawerLeadId] = useState<number | null>(null)
  const [searchText, setSearchText] = useState('')
  const [contactReadinessFilter, setContactReadinessFilter] = useState('')
  const [reviewStatusFilter, setReviewStatusFilter] = useState('needs_review')
  const [enrichmentStatusFilter, setEnrichmentStatusFilter] = useState('')
  const [audienceTierFilter, setAudienceTierFilter] = useState('')
  const [supplementModalType, setSupplementModalType] = useState<SupplementaryType | null>(null)
  const [activeKPIFilter, setActiveKPIFilter] = useState<string>('needs_review')

  // CTA states
  const [subscriberEnrichState, setSubscriberEnrichState] = useState<EnrichState>('idle')
  const [channelEnrichState, setChannelEnrichState] = useState<EnrichState>('idle')

  const queryClient = useQueryClient()

  // Jobs
  const { data: allJobs } = useQuery({ queryKey: ['jobs'], queryFn: getJobs, refetchInterval: 10000 })
  const finishedJobs = (allJobs || []).filter((j: Job) => FINISHED_STATUSES.includes(j.status))

  // Auto-select first job
  const activeJobId = selectedJobId ?? (finishedJobs.length > 0 ? finishedJobs[0].id : null)

  // Leads
  const { data: leads, isLoading: leadsLoading } = useQuery({
    queryKey: ['leads', { job_id: activeJobId, search: searchText, contact_readiness: contactReadinessFilter, review_status: reviewStatusFilter, enrichment_status: enrichmentStatusFilter, audience_tier: audienceTierFilter }],
    queryFn: () => getLeads({
      job_id: activeJobId!,
      limit: 500,
      ...(searchText ? { search: searchText } : {}),
      ...(contactReadinessFilter ? { contact_readiness: contactReadinessFilter } : {}),
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

  // Derive drawer lead from fresh query data (not stale snapshot)
  const drawerLead = drawerLeadId && leads ? leads.find(l => l.id === drawerLeadId) ?? null : null

  const handleSelectJob = useCallback((jobId: number) => {
    setSelectedJobId(jobId)
    setSelectedLeadIds(new Set())
    setDrawerLeadId(null)
    setSearchText('')
    setContactReadinessFilter('')
    setReviewStatusFilter('needs_review')
    setEnrichmentStatusFilter('')
    setAudienceTierFilter('')
    setActiveKPIFilter('needs_review')
    setSubscriberEnrichState('idle')
    setChannelEnrichState('idle')
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
    setDrawerLeadId(lead.id)
  }, [])

  const handleCloseDrawer = useCallback(() => {
    setDrawerLeadId(null)
  }, [])

  const handleLeadUpdated = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ['leads'] })
    queryClient.invalidateQueries({ queryKey: ['quality'] })
    queryClient.invalidateQueries({ queryKey: ['edit-history'] })
  }, [queryClient])

  const handleSupplementarySearch = useCallback((type: string) => {
    setSupplementModalType(type as SupplementaryType)
  }, [])

  const handleEnrichSubscribers = useCallback(async () => {
    if (!activeJobId || subscriberEnrichState === 'running') return
    setSubscriberEnrichState('running')
    try {
      await enrichSubscribers(activeJobId)
      setSubscriberEnrichState('done')
      queryClient.invalidateQueries({ queryKey: ['leads'] })
      queryClient.invalidateQueries({ queryKey: ['quality'] })
    } catch {
      setSubscriberEnrichState('error')
    }
  }, [activeJobId, subscriberEnrichState, queryClient])

  const handleEnrichChannels = useCallback(async () => {
    if (!activeJobId || channelEnrichState === 'running') return
    setChannelEnrichState('running')
    try {
      await enrichChannels(activeJobId)
      setChannelEnrichState('done')
      queryClient.invalidateQueries({ queryKey: ['leads'] })
      queryClient.invalidateQueries({ queryKey: ['quality'] })
    } catch {
      setChannelEnrichState('error')
    }
  }, [activeJobId, channelEnrichState, queryClient])

  const handleKPIFilterClick = useCallback((filter: string) => {
    setActiveKPIFilter(filter)
    // Reset all filters then apply KPI-specific filter
    setContactReadinessFilter('')
    setEnrichmentStatusFilter('')
    setAudienceTierFilter('')

    if (filter === 'needs_review') {
      setReviewStatusFilter('needs_review')
    } else if (filter === 'excluded') {
      setReviewStatusFilter('auto_rejected')
    } else if (filter === 'contactable') {
      setReviewStatusFilter('')
      setContactReadinessFilter('contactable')
    } else if (filter === 'needs_correction') {
      setReviewStatusFilter('')
      setEnrichmentStatusFilter('not_started')
    } else {
      // 전체
      setReviewStatusFilter('')
    }
  }, [])

  // Derive subscriber/channel enrich disabled reasons
  const subscriberDisabledReason = (() => {
    if (subscriberEnrichState === 'running') return '실행 중...'
    if (subscriberEnrichState === 'done') return '완료됨'
    if (!quality) return null
    if (quality.audience_coverage_rate >= 1.0) return '보정 대상 없음'
    return null
  })()

  const channelDisabledReason = (() => {
    if (channelEnrichState === 'running') return '실행 중...'
    if (channelEnrichState === 'done') return '완료됨'
    if (!quality) return null
    if (quality.enrichment_coverage_rate >= 1.0) return '보강 대상 없음'
    return null
  })()

  return (
    <div className="review-workspace">
      <ReviewJobSidebar
        jobs={finishedJobs}
        selectedJobId={activeJobId}
        onSelect={handleSelectJob}
        subscriberEnrichState={subscriberEnrichState}
        channelEnrichState={channelEnrichState}
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
            {quality && (
              <ReviewKPICards
                quality={quality}
                activeFilter={activeKPIFilter}
                onFilterClick={handleKPIFilterClick}
              />
            )}

            {/* Quality Banner with CTA states */}
            {quality && (
              <QualityBanner
                quality={quality}
                onSupplementarySearch={handleSupplementarySearch}
                onEnrichSubscribers={handleEnrichSubscribers}
                subscriberEnrichState={subscriberEnrichState}
                subscriberDisabledReason={subscriberDisabledReason}
                onEnrichChannels={handleEnrichChannels}
                channelEnrichState={channelEnrichState}
                channelDisabledReason={channelDisabledReason}
              />
            )}

            {/* Queue Tabs — uses different labels from KPI cards */}
            <div className="review-queue-tabs">
              {[
                { value: '', label: '전체' },
                { value: 'needs_review', label: '검토 큐' },
                { value: 'auto_approved', label: '자동 승인' },
                { value: 'auto_rejected', label: '자동 제외' },
                { value: 'approved', label: '수동 승인' },
                { value: 'rejected', label: '수동 제외' },
                { value: 'held', label: '보류' },
              ].map(tab => (
                <button
                  key={tab.value}
                  className={`queue-tab${reviewStatusFilter === tab.value ? ' active' : ''}`}
                  onClick={() => {
                    setReviewStatusFilter(tab.value)
                    setActiveKPIFilter('')
                  }}
                >
                  {tab.label}
                </button>
              ))}
            </div>

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
                value={contactReadinessFilter}
                onChange={e => setContactReadinessFilter(e.target.value)}
              >
                <option value="">연락 가능성</option>
                <option value="contactable">연락 가능</option>
                <option value="platform_suspect">플랫폼 메일 의심</option>
                <option value="no_email">이메일 없음</option>
                <option value="needs_verification">검증 필요</option>
                <option value="user_confirmed">사용자 확인</option>
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
                <option value="">영향력 규모</option>
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
      {drawerLead && (
        <LeadDetailDrawer
          lead={drawerLead}
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
