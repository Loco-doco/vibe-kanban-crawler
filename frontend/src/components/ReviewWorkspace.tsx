import { useState, useCallback, useMemo } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { getJobs, enrichSubscribers, enrichChannels, getEnrichmentRun } from '../api/jobs'
import { getLeads, getQuality, bulkReview, approveAndQueue, bulkResolveConflicts, syncToMaster } from '../api/leads'
import ReviewJobSidebar from './ReviewJobSidebar'
import ReviewKPICards from './ReviewKPICards'
import QualityBanner from './QualityBanner'
import FilterStatusBar from './FilterStatusBar'
import ReviewTable from './ReviewTable'
import BulkActions from './BulkActions'
import type { BulkResult } from './BulkActions'
import LeadDetailDrawer from './LeadDetailDrawer'
import LeadFullDetail from './LeadFullDetail'
import SupplementarySearchModal from './SupplementarySearchModal'
import type { Job, Lead, ReviewStatus, SupplementaryType } from '../types'

interface Props {
  initialJobId?: number | null
}

const FINISHED_STATUSES = ['completed', 'completed_low_yield', 'failed', 'cancelled']

type EnrichState = 'idle' | 'running' | 'done' | 'error'

// L1 Primary queue — the only mechanism that changes the result set
type ActionQueue = 'needs_verification' | 'contactable' | 'needs_correction' | 'held' | 'excluded'
  | 'conflict_queue' | 'ready_to_sync' | 'synced'

const REVIEW_TABS: { value: ActionQueue; label: string }[] = [
  { value: 'needs_verification', label: '검증 필요' },
  { value: 'contactable', label: '연락 대상' },
  { value: 'needs_correction', label: '데이터 보정 필요' },
  { value: 'held', label: '보류' },
  { value: 'excluded', label: '제외' },
]

const PIPELINE_TABS: { value: ActionQueue; label: string }[] = [
  { value: 'conflict_queue', label: '충돌 확인' },
  { value: 'ready_to_sync', label: '반영 대기' },
  { value: 'synced', label: '반영 완료' },
]

const QUEUE_LABELS: Record<ActionQueue, string> = {
  needs_verification: '검증 필요',
  contactable: '연락 대상',
  needs_correction: '데이터 보정 필요',
  held: '보류',
  excluded: '제외',
  conflict_queue: '충돌 확인',
  ready_to_sync: '반영 대기',
  synced: '반영 완료',
}

export default function ReviewWorkspace({ initialJobId }: Props) {
  const [selectedJobId, setSelectedJobId] = useState<number | null>(initialJobId ?? null)
  const [selectedLeadIds, setSelectedLeadIds] = useState<Set<number>>(new Set())
  const [drawerLeadId, setDrawerLeadId] = useState<number | null>(null)
  const [fullDetailLeadId, setFullDetailLeadId] = useState<number | null>(null)

  // L1 Primary queue (default: 검증 필요)
  const [activeQueue, setActiveQueue] = useState<ActionQueue>('needs_verification')

  // Sort (default: priority_score desc = 추천순)
  const [sortField, setSortField] = useState<string>('priority_score')

  // L2 Secondary filters (search text preserved across tab switches; dropdowns reset)
  const [searchText, setSearchText] = useState('')
  const [contactReadinessFilter, setContactReadinessFilter] = useState('')
  const [enrichmentStatusFilter, setEnrichmentStatusFilter] = useState('')
  const [audienceTierFilter, setAudienceTierFilter] = useState('')

  const [lastBulkResult, setLastBulkResult] = useState<BulkResult | null>(null)
  const [supplementModalType, setSupplementModalType] = useState<SupplementaryType | null>(null)

  // CTA states
  const [subscriberEnrichState, setSubscriberEnrichState] = useState<EnrichState>('idle')
  const [channelEnrichState, setChannelEnrichState] = useState<EnrichState>('idle')
  const [subscriberRunId, setSubscriberRunId] = useState<number | null>(null)
  const [channelRunId, setChannelRunId] = useState<number | null>(null)

  const queryClient = useQueryClient()

  // Jobs
  const { data: allJobs } = useQuery({ queryKey: ['jobs'], queryFn: getJobs, refetchInterval: 10000 })
  const finishedJobs = (allJobs || []).filter((j: Job) => FINISHED_STATUSES.includes(j.status))

  // Auto-select first job
  const activeJobId = selectedJobId ?? (finishedJobs.length > 0 ? finishedJobs[0].id : null)

  // Leads — L1 primary queue via action_queue param, L2 secondary via additional params
  const { data: leads, isLoading: leadsLoading } = useQuery({
    queryKey: ['leads', { job_id: activeJobId, action_queue: activeQueue, sort: sortField, search: searchText, contact_readiness: contactReadinessFilter, enrichment_status: enrichmentStatusFilter, audience_tier: audienceTierFilter }],
    queryFn: () => getLeads({
      job_id: activeJobId!,
      action_queue: activeQueue,
      sort: sortField,
      limit: 500,
      ...(searchText ? { search: searchText } : {}),
      ...(contactReadinessFilter ? { contact_readiness: contactReadinessFilter } : {}),
      ...(enrichmentStatusFilter ? { enrichment_status: enrichmentStatusFilter } : {}),
      ...(audienceTierFilter ? { audience_tier: audienceTierFilter } : {}),
    }),
    enabled: activeJobId !== null,
  })

  // Quality (always job-level, not affected by filters)
  const { data: quality } = useQuery({
    queryKey: ['quality', activeJobId],
    queryFn: () => getQuality(activeJobId!),
    enabled: activeJobId !== null,
  })

  // Enrichment run polling
  const { data: subscriberRun } = useQuery({
    queryKey: ['enrichment-run', subscriberRunId],
    queryFn: () => getEnrichmentRun(subscriberRunId!),
    enabled: subscriberRunId !== null && subscriberEnrichState === 'running',
    refetchInterval: 3000,
  })

  const { data: channelRun } = useQuery({
    queryKey: ['enrichment-run', channelRunId],
    queryFn: () => getEnrichmentRun(channelRunId!),
    enabled: channelRunId !== null && channelEnrichState === 'running',
    refetchInterval: 3000,
  })

  // Auto-complete enrichment states when runs finish
  if (subscriberRun && subscriberRun.status !== 'running' && subscriberEnrichState === 'running') {
    setSubscriberEnrichState(subscriberRun.status === 'completed' ? 'done' : 'error')
    queryClient.invalidateQueries({ queryKey: ['leads'] })
    queryClient.invalidateQueries({ queryKey: ['quality'] })
  }

  if (channelRun && channelRun.status !== 'running' && channelEnrichState === 'running') {
    setChannelEnrichState(channelRun.status === 'completed' ? 'done' : 'error')
    queryClient.invalidateQueries({ queryKey: ['leads'] })
    queryClient.invalidateQueries({ queryKey: ['quality'] })
  }

  // Bulk review mutation (held/rejected)
  const bulkMutation = useMutation({
    mutationFn: ({ ids, status }: { ids: number[]; status: ReviewStatus }) => bulkReview(ids, status),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['leads'] })
      queryClient.invalidateQueries({ queryKey: ['quality'] })
      setLastBulkResult({ action: variables.status, count: variables.ids.length })
      setSelectedLeadIds(new Set())
      setTimeout(() => setLastBulkResult(null), 4000)
    },
  })

  // Approve + queue for master (approval only)
  const approveMutation = useMutation({
    mutationFn: (ids: number[]) => approveAndQueue(ids),
    onSuccess: (result, ids) => {
      queryClient.invalidateQueries({ queryKey: ['leads'] })
      queryClient.invalidateQueries({ queryKey: ['quality'] })
      setLastBulkResult({
        action: 'approved',
        count: ids.length,
        ready: result.ready,
        conflicts: result.conflicts,
      })
      setSelectedLeadIds(new Set())
      setTimeout(() => setLastBulkResult(null), 5000)
    },
  })

  // Bulk resolve conflicts (conflict_queue → keep/reject)
  const resolveConflictsMutation = useMutation({
    mutationFn: ({ ids, resolution }: { ids: number[]; resolution: 'keep' | 'reject' }) =>
      bulkResolveConflicts(ids, resolution),
    onSuccess: (result, variables) => {
      queryClient.invalidateQueries({ queryKey: ['leads'] })
      queryClient.invalidateQueries({ queryKey: ['quality'] })
      setLastBulkResult({
        action: variables.resolution === 'keep' ? 'approved' : 'rejected',
        count: result.resolved,
      })
      setSelectedLeadIds(new Set())
      setTimeout(() => setLastBulkResult(null), 4000)
    },
  })

  // Final sync: ready_to_sync → synced
  const syncMutation = useMutation({
    mutationFn: (ids: number[]) => syncToMaster(ids),
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ['leads'] })
      queryClient.invalidateQueries({ queryKey: ['quality'] })
      setLastBulkResult({ action: 'approved', count: result.synced, synced: result.synced })
      setSelectedLeadIds(new Set())
      setTimeout(() => setLastBulkResult(null), 4000)
    },
  })

  // Derive drawer lead from fresh query data
  const drawerLead = drawerLeadId && leads ? leads.find(l => l.id === drawerLeadId) ?? null : null

  // Derive queue total from quality metrics (job-level, before secondary filters)
  const queueTotal = useMemo(() => {
    if (!quality) return 0
    switch (activeQueue) {
      case 'needs_verification': return quality.needs_verification_leads
      case 'contactable': return quality.contactable_leads
      case 'needs_correction': return quality.needs_correction_leads
      case 'held': return quality.held_leads
      case 'excluded': return quality.excluded_leads
      case 'conflict_queue': return quality.conflict_queue_leads
      case 'ready_to_sync': return quality.ready_to_sync_leads
      case 'synced': return quality.synced_leads
      default: return quality.total_leads
    }
  }, [quality, activeQueue])

  // Derive active secondary filters for FilterStatusBar
  const secondaryFilters = useMemo(() => {
    const filters: { label: string }[] = []
    if (searchText) filters.push({ label: `"${searchText}"` })
    if (contactReadinessFilter) {
      const labels: Record<string, string> = { contactable: '연락 가능', platform_suspect: '플랫폼 메일 의심', no_email: '이메일 없음', needs_verification: '검증 필요', user_confirmed: '사용자 확인' }
      filters.push({ label: labels[contactReadinessFilter] || contactReadinessFilter })
    }
    if (enrichmentStatusFilter) {
      const labels: Record<string, string> = { not_started: '미시작', completed: '완료', low_confidence: '신뢰도 낮음' }
      filters.push({ label: labels[enrichmentStatusFilter] || enrichmentStatusFilter })
    }
    if (audienceTierFilter) {
      filters.push({ label: `${audienceTierFilter.charAt(0).toUpperCase() + audienceTierFilter.slice(1)} 규모` })
    }
    return filters
  }, [searchText, contactReadinessFilter, enrichmentStatusFilter, audienceTierFilter])

  // Tab switch: reset dropdowns, keep search text
  const handleQueueChange = useCallback((queue: ActionQueue) => {
    setActiveQueue(queue)
    setSelectedLeadIds(new Set())
    setDrawerLeadId(null)
    // L2 dropdowns reset, search text preserved
    setContactReadinessFilter('')
    setEnrichmentStatusFilter('')
    setAudienceTierFilter('')
  }, [])

  // Clear all secondary filters (including search)
  const handleClearSecondaryFilters = useCallback(() => {
    setSearchText('')
    setContactReadinessFilter('')
    setEnrichmentStatusFilter('')
    setAudienceTierFilter('')
  }, [])

  const handleSelectJob = useCallback((jobId: number) => {
    setSelectedJobId(jobId)
    setSelectedLeadIds(new Set())
    setDrawerLeadId(null)
    setSearchText('')
    setActiveQueue('needs_verification')
    setContactReadinessFilter('')
    setEnrichmentStatusFilter('')
    setAudienceTierFilter('')
    setSubscriberEnrichState('idle')
    setChannelEnrichState('idle')
    setSubscriberRunId(null)
    setChannelRunId(null)
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

  const handleBulkAction = useCallback((status: ReviewStatus | 'sync' | 'conflict_keep' | 'conflict_reject') => {
    const ids = Array.from(selectedLeadIds)
    if (status === 'approved') {
      approveMutation.mutate(ids)
    } else if (status === 'sync') {
      syncMutation.mutate(ids)
    } else if (status === 'conflict_keep') {
      resolveConflictsMutation.mutate({ ids, resolution: 'keep' })
    } else if (status === 'conflict_reject') {
      resolveConflictsMutation.mutate({ ids, resolution: 'reject' })
    } else {
      bulkMutation.mutate({ ids, status })
    }
  }, [selectedLeadIds, bulkMutation, approveMutation, syncMutation, resolveConflictsMutation])

  const handleViewDetail = useCallback((lead: Lead) => {
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
      const resp = await enrichSubscribers(activeJobId)
      setSubscriberRunId(resp.run_id)
    } catch {
      setSubscriberEnrichState('error')
    }
  }, [activeJobId, subscriberEnrichState])

  const handleEnrichChannels = useCallback(async () => {
    if (!activeJobId || channelEnrichState === 'running') return
    setChannelEnrichState('running')
    try {
      const resp = await enrichChannels(activeJobId)
      setChannelRunId(resp.run_id)
    } catch {
      setChannelEnrichState('error')
    }
  }, [activeJobId, channelEnrichState])

  // Derive subscriber/channel enrich disabled reasons + progress
  const subscriberDisabledReason = (() => {
    if (subscriberEnrichState === 'running') {
      if (subscriberRun) return `${subscriberRun.processed}/${subscriberRun.total} 처리 중...`
      return '실행 중...'
    }
    if (subscriberEnrichState === 'done') {
      if (subscriberRun) return `완료: ${subscriberRun.updated}건 보정, ${subscriberRun.failed}건 실패`
      return '완료됨'
    }
    if (!quality) return null
    if (quality.audience_coverage_rate >= 1.0) return '보정 대상 없음'
    return null
  })()

  const channelDisabledReason = (() => {
    if (channelEnrichState === 'running') {
      if (channelRun) return `${channelRun.processed}/${channelRun.total} 처리 중...`
      return '실행 중...'
    }
    if (channelEnrichState === 'done') {
      if (channelRun) return `완료: ${channelRun.updated}건 보강, ${channelRun.failed}건 실패`
      return '완료됨'
    }
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
            {/* L0: KPI Cards — summary only, not clickable */}
            {quality && <ReviewKPICards quality={quality} />}

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

            {/* L1: Work Queue Tabs — primary queue, mutually exclusive */}
            <div className="review-queue-tabs">
              {REVIEW_TABS.map(tab => (
                <button
                  key={tab.value}
                  className={`queue-tab${activeQueue === tab.value ? ' active' : ''}`}
                  onClick={() => handleQueueChange(tab.value)}
                >
                  {tab.label}
                  {quality && (
                    <span className="queue-tab-count">
                      {tab.value === 'needs_verification' ? quality.needs_verification_leads
                        : tab.value === 'contactable' ? quality.contactable_leads
                        : tab.value === 'needs_correction' ? quality.needs_correction_leads
                        : tab.value === 'held' ? quality.held_leads
                        : tab.value === 'excluded' ? quality.excluded_leads
                        : 0}
                    </span>
                  )}
                </button>
              ))}
              <span className="queue-tab-divider" />
              {PIPELINE_TABS.map(tab => (
                <button
                  key={tab.value}
                  className={`queue-tab pipeline-tab${activeQueue === tab.value ? ' active' : ''}`}
                  onClick={() => handleQueueChange(tab.value)}
                >
                  {tab.label}
                  {quality && (
                    <span className="queue-tab-count">
                      {tab.value === 'conflict_queue' ? quality.conflict_queue_leads
                        : tab.value === 'ready_to_sync' ? quality.ready_to_sync_leads
                        : tab.value === 'synced' ? quality.synced_leads
                        : 0}
                    </span>
                  )}
                </button>
              ))}
            </div>

            {/* L2: Secondary Filter Bar */}
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
              <select
                className="review-filter-select review-sort-select"
                value={sortField}
                onChange={e => setSortField(e.target.value)}
              >
                <option value="priority_score">추천순</option>
                <option value="inserted_at">최신순</option>
                <option value="subscriber_count">영향력순</option>
              </select>
            </div>

            {/* Filter Status Bar */}
            <FilterStatusBar
              queueLabel={QUEUE_LABELS[activeQueue]}
              secondaryFilters={secondaryFilters}
              totalInQueue={queueTotal}
              filteredCount={leads?.length ?? 0}
              onClearFilters={handleClearSecondaryFilters}
            />

            {/* Bulk Actions */}
            <BulkActions
              selectedCount={selectedLeadIds.size}
              totalFilteredCount={leads?.length ?? 0}
              activeQueue={activeQueue}
              onAction={handleBulkAction}
              onSelectAll={handleToggleSelectAll}
              onDeselectAll={() => setSelectedLeadIds(new Set())}
              disabled={bulkMutation.isPending || approveMutation.isPending || syncMutation.isPending || resolveConflictsMutation.isPending}
              lastResult={lastBulkResult}
            />

            {/* Table */}
            {leadsLoading ? (
              <div className="loading-state">불러오는 중...</div>
            ) : !leads?.length ? (
              <QueueEmptyState
                queue={activeQueue}
                hasSecondaryFilters={secondaryFilters.length > 0}
                onClearFilters={handleClearSecondaryFilters}
                onSwitchQueue={handleQueueChange}
              />
            ) : (
              <ReviewTable
                leads={leads}
                selectedIds={selectedLeadIds}
                onToggleSelect={handleToggleSelect}
                onToggleSelectAll={handleToggleSelectAll}
                onViewDetail={handleViewDetail}
              />
            )}
          </>
        )}
      </div>

      {/* Lead Detail Drawer (Quick Detail) */}
      {drawerLead && (
        <LeadDetailDrawer
          lead={drawerLead}
          activeQueue={activeQueue}
          onClose={handleCloseDrawer}
          onUpdated={handleLeadUpdated}
          onOpenFullDetail={() => { setFullDetailLeadId(drawerLead.id); setDrawerLeadId(null) }}
        />
      )}

      {/* Full Detail Modal */}
      {fullDetailLeadId && leads && (() => {
        const fullLead = leads.find(l => l.id === fullDetailLeadId)
        return fullLead ? (
          <LeadFullDetail
            lead={fullLead}
            onClose={() => setFullDetailLeadId(null)}
            onUpdated={handleLeadUpdated}
          />
        ) : null
      })()}

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

/* 6-13: Queue-specific empty state component */
interface QueueEmptyProps {
  queue: ActionQueue
  hasSecondaryFilters: boolean
  onClearFilters: () => void
  onSwitchQueue: (queue: ActionQueue) => void
}

const QUEUE_EMPTY_CONFIG: Record<ActionQueue, { icon: string; title: string; description: string; actionLabel?: string; actionQueue?: ActionQueue }> = {
  needs_verification: {
    icon: '\u2705',
    title: '검증할 리드가 없습니다',
    description: '모든 리드가 이미 검증되었습니다.',
    actionLabel: '연락 대상 확인',
    actionQueue: 'contactable',
  },
  contactable: {
    icon: '\uD83D\uDCED',
    title: '연락 대상이 없습니다',
    description: '검증 필요 큐에서 리드를 승인해주세요.',
    actionLabel: '검증 필요 큐로 이동',
    actionQueue: 'needs_verification',
  },
  needs_correction: {
    icon: '\u2705',
    title: '보정할 리드가 없습니다',
    description: '모든 데이터가 확보되었습니다.',
  },
  held: {
    icon: '\uD83D\uDCCB',
    title: '보류 중인 리드가 없습니다',
    description: '보류된 리드가 없습니다.',
  },
  excluded: {
    icon: '\uD83D\uDDD1',
    title: '제외된 리드가 없습니다',
    description: '제외된 리드가 없습니다.',
  },
  conflict_queue: {
    icon: '\u2705',
    title: '충돌 리드가 없습니다',
    description: '모든 충돌이 해결되었거나 충돌이 감지된 리드가 없습니다.',
  },
  ready_to_sync: {
    icon: '\uD83D\uDCCB',
    title: '반영 대기 리드가 없습니다',
    description: '승인된 리드가 없거나 모두 반영되었습니다.',
    actionLabel: '검증 필요 큐로 이동',
    actionQueue: 'needs_verification',
  },
  synced: {
    icon: '\u2705',
    title: '반영된 리드가 없습니다',
    description: '아직 마스터에 반영된 리드가 없습니다.',
  },
}

function QueueEmptyState({ queue, hasSecondaryFilters, onClearFilters, onSwitchQueue }: QueueEmptyProps) {
  if (hasSecondaryFilters) {
    return (
      <div className="empty-state">
        <span className="empty-state-icon">{'\uD83D\uDD0D'}</span>
        <h3>조건에 맞는 리드가 없습니다</h3>
        <p>현재 필터를 변경하거나 해제해보세요.</p>
        <button className="empty-state-action-btn" onClick={onClearFilters}>
          필터 해제
        </button>
      </div>
    )
  }

  const config = QUEUE_EMPTY_CONFIG[queue]
  return (
    <div className="empty-state">
      <span className="empty-state-icon">{config.icon}</span>
      <h3>{config.title}</h3>
      <p>{config.description}</p>
      {config.actionLabel && config.actionQueue && (
        <button className="empty-state-action-btn" onClick={() => onSwitchQueue(config.actionQueue!)}>
          {config.actionLabel}
        </button>
      )}
    </div>
  )
}
