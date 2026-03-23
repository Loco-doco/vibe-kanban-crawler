import { useState, useCallback } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { getJobs, enrichSubscribers, enrichChannels, getEnrichmentRun } from '../api/jobs'
import { getLeads, getQuality, bulkReview, approveAndQueue, bulkResolveConflicts, syncToMaster } from '../api/leads'
import ReviewJobSidebar from './ReviewJobSidebar'
import QualityBanner from './QualityBanner'
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

type ActionQueue = 'all' | 'unreviewed' | 'needs_enrichment' | 'contactable'
  | 'excluded' | 'on_hold' | 'synced'
  | 'ready_to_sync' | 'conflict_queue'

// --- Inbox tabs: mutually exclusive workflow states ---
type InboxTabId = 'all' | 'unreviewed' | 'needs_enrichment' | 'contactable' | 'excluded' | 'synced'

interface InboxTab {
  id: InboxTabId
  label: string
  primaryQueue: ActionQueue
  subQueues?: { value: ActionQueue; label: string }[]
}

const INBOX_TABS: InboxTab[] = [
  { id: 'all', label: '전체', primaryQueue: 'all' },
  { id: 'unreviewed', label: '미검토', primaryQueue: 'unreviewed' },
  { id: 'needs_enrichment', label: '보강 필요', primaryQueue: 'needs_enrichment' },
  {
    id: 'contactable', label: '연락 가능',
    primaryQueue: 'contactable',
    subQueues: [
      { value: 'contactable', label: '연락 가능' },
      { value: 'ready_to_sync', label: '반영 대기' },
      { value: 'conflict_queue', label: '충돌 확인' },
    ],
  },
  {
    id: 'excluded', label: '제외·보류',
    primaryQueue: 'excluded',
    subQueues: [
      { value: 'excluded', label: '제외' },
      { value: 'on_hold', label: '보류' },
    ],
  },
  { id: 'synced', label: '반영 완료', primaryQueue: 'synced' },
]

import type { QualityMetrics } from '../types'

function getQueueCount(quality: QualityMetrics, q: ActionQueue): number {
  switch (q) {
    case 'all': return quality.total_leads
    case 'unreviewed': return quality.unreviewed_leads
    case 'needs_enrichment': return quality.needs_enrichment_leads
    case 'contactable': return quality.contactable_leads
    case 'excluded': return quality.excluded_leads
    case 'on_hold': return quality.on_hold_leads
    case 'synced': return quality.synced_leads
    case 'ready_to_sync': return quality.ready_to_sync_leads
    case 'conflict_queue': return quality.conflict_queue_leads
    default: return 0
  }
}

export default function ReviewWorkspace({ initialJobId }: Props) {
  const [selectedJobId, setSelectedJobId] = useState<number | null>(initialJobId ?? null)
  const [selectedLeadIds, setSelectedLeadIds] = useState<Set<number>>(new Set())
  const [drawerLeadId, setDrawerLeadId] = useState<number | null>(null)
  const [fullDetailLeadId, setFullDetailLeadId] = useState<number | null>(null)

  const [activeTabId, setActiveTabId] = useState<InboxTabId>('all')
  const [activeQueue, setActiveQueue] = useState<ActionQueue>('all')
  const [sortField, setSortField] = useState<string>('priority_score')

  const [searchText, setSearchText] = useState('')
  const [showFilters, setShowFilters] = useState(false)
  const [contactReadinessFilter, setContactReadinessFilter] = useState('')
  const [enrichmentStatusFilter, setEnrichmentStatusFilter] = useState('')
  const [audienceTierFilter, setAudienceTierFilter] = useState('')

  const [lastBulkResult, setLastBulkResult] = useState<BulkResult | null>(null)
  const [supplementModalType, setSupplementModalType] = useState<SupplementaryType | null>(null)

  const [subscriberEnrichState, setSubscriberEnrichState] = useState<EnrichState>('idle')
  const [channelEnrichState, setChannelEnrichState] = useState<EnrichState>('idle')
  const [subscriberRunId, setSubscriberRunId] = useState<number | null>(null)
  const [channelRunId, setChannelRunId] = useState<number | null>(null)

  const queryClient = useQueryClient()

  const { data: allJobs } = useQuery({ queryKey: ['jobs'], queryFn: getJobs, refetchInterval: 10000 })
  const finishedJobs = (allJobs || []).filter((j: Job) => FINISHED_STATUSES.includes(j.status))
  const activeJobId = selectedJobId ?? (finishedJobs.length > 0 ? finishedJobs[0].id : null)
  const activeJob = finishedJobs.find((j: Job) => j.id === activeJobId)

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

  const { data: quality } = useQuery({
    queryKey: ['quality', activeJobId],
    queryFn: () => getQuality(activeJobId!),
    enabled: activeJobId !== null,
  })

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

  // --- Mutations ---
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

  const approveMutation = useMutation({
    mutationFn: (ids: number[]) => approveAndQueue(ids),
    onSuccess: (result, ids) => {
      queryClient.invalidateQueries({ queryKey: ['leads'] })
      queryClient.invalidateQueries({ queryKey: ['quality'] })
      setLastBulkResult({ action: 'approved', count: ids.length, ready: result.ready, conflicts: result.conflicts })
      setSelectedLeadIds(new Set())
      setTimeout(() => setLastBulkResult(null), 5000)
    },
  })

  const resolveConflictsMutation = useMutation({
    mutationFn: ({ ids, resolution }: { ids: number[]; resolution: 'keep' | 'reject' }) => bulkResolveConflicts(ids, resolution),
    onSuccess: (result, variables) => {
      queryClient.invalidateQueries({ queryKey: ['leads'] })
      queryClient.invalidateQueries({ queryKey: ['quality'] })
      setLastBulkResult({ action: variables.resolution === 'keep' ? 'approved' : 'rejected', count: result.resolved })
      setSelectedLeadIds(new Set())
      setTimeout(() => setLastBulkResult(null), 4000)
    },
  })

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

  // --- Derived ---
  const drawerLead = drawerLeadId && leads ? leads.find(l => l.id === drawerLeadId) ?? null : null
  const activeInboxTab = INBOX_TABS.find(t => t.id === activeTabId)!
  const hasSecondaryFilters = searchText !== '' || contactReadinessFilter !== '' || enrichmentStatusFilter !== '' || audienceTierFilter !== ''

  // --- Handlers ---
  const handleTabChange = useCallback((tabId: InboxTabId) => {
    const tab = INBOX_TABS.find(t => t.id === tabId)!
    setActiveTabId(tabId)
    setActiveQueue(tab.primaryQueue)
    setSelectedLeadIds(new Set())
    setDrawerLeadId(null)
    setContactReadinessFilter('')
    setEnrichmentStatusFilter('')
    setAudienceTierFilter('')
  }, [])

  const handleSubQueueChange = useCallback((queue: ActionQueue) => {
    setActiveQueue(queue)
    setSelectedLeadIds(new Set())
    setDrawerLeadId(null)
  }, [])

  const handleClearFilters = useCallback(() => {
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
    setActiveTabId('all')
    setActiveQueue('all')
    setContactReadinessFilter('')
    setEnrichmentStatusFilter('')
    setAudienceTierFilter('')
    setSubscriberEnrichState('idle')
    setChannelEnrichState('idle')
    setSubscriberRunId(null)
    setChannelRunId(null)
  }, [])

  const handleToggleSelect = useCallback((id: number) => {
    setSelectedLeadIds(prev => { const n = new Set(prev); if (n.has(id)) n.delete(id); else n.add(id); return n })
  }, [])

  const handleToggleSelectAll = useCallback(() => {
    if (!leads) return
    setSelectedLeadIds(prev => prev.size === leads.length ? new Set() : new Set(leads.map(l => l.id)))
  }, [leads])

  const handleBulkAction = useCallback((status: ReviewStatus | 'sync' | 'conflict_keep' | 'conflict_reject') => {
    const ids = Array.from(selectedLeadIds)
    if (status === 'approved') approveMutation.mutate(ids)
    else if (status === 'sync') syncMutation.mutate(ids)
    else if (status === 'conflict_keep') resolveConflictsMutation.mutate({ ids, resolution: 'keep' })
    else if (status === 'conflict_reject') resolveConflictsMutation.mutate({ ids, resolution: 'reject' })
    else bulkMutation.mutate({ ids, status })
  }, [selectedLeadIds, bulkMutation, approveMutation, syncMutation, resolveConflictsMutation])

  const handleViewDetail = useCallback((lead: Lead) => { setDrawerLeadId(lead.id) }, [])
  const handleCloseDrawer = useCallback(() => { setDrawerLeadId(null) }, [])
  const handleLeadUpdated = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ['leads'] })
    queryClient.invalidateQueries({ queryKey: ['quality'] })
    queryClient.invalidateQueries({ queryKey: ['edit-history'] })
  }, [queryClient])
  const handleSupplementarySearch = useCallback((type: string) => { setSupplementModalType(type as SupplementaryType) }, [])

  const handleEnrichSubscribers = useCallback(async () => {
    if (!activeJobId || subscriberEnrichState === 'running') return
    setSubscriberEnrichState('running')
    try { const r = await enrichSubscribers(activeJobId); setSubscriberRunId(r.run_id) }
    catch { setSubscriberEnrichState('error') }
  }, [activeJobId, subscriberEnrichState])

  const handleEnrichChannels = useCallback(async () => {
    if (!activeJobId || channelEnrichState === 'running') return
    setChannelEnrichState('running')
    try { const r = await enrichChannels(activeJobId); setChannelRunId(r.run_id) }
    catch { setChannelEnrichState('error') }
  }, [activeJobId, channelEnrichState])

  const subscriberDisabledReason = (() => {
    if (subscriberEnrichState === 'running') return subscriberRun ? `${subscriberRun.processed}/${subscriberRun.total} 처리 중...` : '실행 중...'
    if (subscriberEnrichState === 'done') return subscriberRun ? `완료: ${subscriberRun.updated}건 보정` : '완료됨'
    if (!quality) return null
    if (quality.audience_coverage_rate >= 1.0) return '보정 대상 없음'
    return null
  })()

  const channelDisabledReason = (() => {
    if (channelEnrichState === 'running') return channelRun ? `${channelRun.processed}/${channelRun.total} 처리 중...` : '실행 중...'
    if (channelEnrichState === 'done') return channelRun ? `완료: ${channelRun.updated}건 보강` : '완료됨'
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
            <span className="empty-state-icon">{'\u{1F4CB}'}</span>
            <h3>탐색을 선택하세요</h3>
            <p>왼쪽에서 완료된 탐색을 선택하면 결과를 검토할 수 있습니다</p>
          </div>
        ) : (
          <>
            {/* Context Bar — replaces KPI cards */}
            <div className="review-context-bar">
              <span className="review-context-job">{activeJob?.label || `탐색 #${activeJobId}`}</span>
              {quality && (
                <span className="review-context-stats">
                  전체 {quality.total_leads}건 · 미검토 {quality.unreviewed_leads}건 · 보강 필요 {quality.needs_enrichment_leads}건 · 연락 가능 {quality.contactable_leads}건
                </span>
              )}
              {hasSecondaryFilters && (
                <button className="review-context-clear" onClick={handleClearFilters}>필터 해제</button>
              )}
            </div>

            {/* Quality Banner — on review-related tabs when data quality is low */}
            {quality && (activeTabId === 'all' || activeTabId === 'unreviewed' || activeTabId === 'needs_enrichment') && (
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

            {/* Inbox Tabs — mutually exclusive workflow states */}
            <div className="review-queue-tabs">
              {INBOX_TABS.slice(0, 5).map(tab => (
                <button
                  key={tab.id}
                  className={`inbox-tab${activeTabId === tab.id ? ' active' : ''}`}
                  onClick={() => handleTabChange(tab.id)}
                >
                  {tab.label}
                  {quality && <span className="queue-tab-count">{getQueueCount(quality, tab.primaryQueue)}</span>}
                </button>
              ))}
              <span className="queue-tab-divider" />
              <button
                className={`inbox-tab archive-tab${activeTabId === 'synced' ? ' active' : ''}`}
                onClick={() => handleTabChange('synced')}
              >
                {INBOX_TABS[5].label}
                {quality && <span className="queue-tab-count">{getQueueCount(quality, 'synced')}</span>}
              </button>
            </div>

            {/* Sub-queue filter */}
            {activeInboxTab.subQueues && activeInboxTab.subQueues.length > 1 && (
              <div className="inbox-sub-filter">
                {activeInboxTab.subQueues.map(sq => {
                  const count = quality ? getQueueCount(quality, sq.value) : 0
                  return (
                    <button
                      key={sq.value}
                      className={`inbox-sub-btn${activeQueue === sq.value ? ' active' : ''}`}
                      onClick={() => handleSubQueueChange(sq.value)}
                    >
                      {sq.label} {count > 0 && <span className="inbox-sub-count">{count}</span>}
                    </button>
                  )
                })}
              </div>
            )}

            {/* Filter row */}
            <div className="review-filter-bar">
              <input type="text" className="review-search-input" placeholder="이름, 이메일 검색..." value={searchText} onChange={e => setSearchText(e.target.value)} />
              <select className="review-filter-select review-sort-select" value={sortField} onChange={e => setSortField(e.target.value)}>
                <option value="priority_score">추천순</option>
                <option value="inserted_at">최신순</option>
                <option value="subscriber_count">영향력순</option>
              </select>
              <button className="btn btn-sm btn-ghost" onClick={() => setShowFilters(!showFilters)}>
                {showFilters ? '필터 접기' : '상세 필터'}
              </button>
            </div>
            {showFilters && (
              <div className="review-filter-bar" style={{ paddingTop: 0 }}>
                <select className="review-filter-select" value={contactReadinessFilter} onChange={e => setContactReadinessFilter(e.target.value)}>
                  <option value="">연락 가능성</option>
                  <option value="contactable">연락 가능</option>
                  <option value="platform_suspect">플랫폼 메일 의심</option>
                  <option value="no_email">이메일 없음</option>
                  <option value="needs_verification">검증 필요</option>
                </select>
                <select className="review-filter-select" value={enrichmentStatusFilter} onChange={e => setEnrichmentStatusFilter(e.target.value)}>
                  <option value="">보강 상태</option>
                  <option value="not_started">미시작</option>
                  <option value="completed">완료</option>
                  <option value="low_confidence">신뢰도 낮음</option>
                </select>
                <select className="review-filter-select" value={audienceTierFilter} onChange={e => setAudienceTierFilter(e.target.value)}>
                  <option value="">영향력 규모</option>
                  <option value="nano">Nano</option>
                  <option value="micro">Micro</option>
                  <option value="mid">Mid</option>
                  <option value="macro">Macro</option>
                  <option value="mega">Mega</option>
                </select>
              </div>
            )}

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
              <InboxEmptyState tabId={activeTabId} queue={activeQueue} hasFilters={hasSecondaryFilters} onClearFilters={handleClearFilters} onSwitchTab={handleTabChange} />
            ) : (
              <ReviewTable leads={leads} selectedIds={selectedLeadIds} onToggleSelect={handleToggleSelect} onToggleSelectAll={handleToggleSelectAll} onViewDetail={handleViewDetail} />
            )}
          </>
        )}
      </div>

      {drawerLead && (
        <LeadDetailDrawer lead={drawerLead} activeQueue={activeQueue} onClose={handleCloseDrawer} onUpdated={handleLeadUpdated} onOpenFullDetail={() => { setFullDetailLeadId(drawerLead.id); setDrawerLeadId(null) }} />
      )}

      {fullDetailLeadId && leads && (() => {
        const fl = leads.find(l => l.id === fullDetailLeadId)
        return fl ? <LeadFullDetail lead={fl} onClose={() => setFullDetailLeadId(null)} onUpdated={handleLeadUpdated} /> : null
      })()}

      {supplementModalType && activeJobId && (
        <SupplementarySearchModal jobId={activeJobId} suggestedType={supplementModalType} onClose={() => setSupplementModalType(null)} />
      )}
    </div>
  )
}

/* --- Inbox Empty State --- */
function InboxEmptyState({ tabId, queue, hasFilters, onClearFilters, onSwitchTab }: {
  tabId: InboxTabId; queue: ActionQueue; hasFilters: boolean; onClearFilters: () => void; onSwitchTab: (id: InboxTabId) => void
}) {
  if (hasFilters) {
    return (
      <div className="empty-state">
        <span className="empty-state-icon">{'\uD83D\uDD0D'}</span>
        <h3>현재 조건에 맞는 리드가 없습니다</h3>
        <p>필터를 초기화하거나 다른 조건을 시도해보세요.</p>
        <button className="empty-state-action-btn" onClick={onClearFilters}>필터 초기화</button>
      </div>
    )
  }
  if (tabId === 'all') return (
    <div className="empty-state">
      <span className="empty-state-icon">{'\u{1F4CB}'}</span>
      <h3>수집된 리드가 없습니다</h3>
      <p>새 탐색을 시작하여 리드를 수집하세요.</p>
    </div>
  )
  if (tabId === 'unreviewed') return (
    <div className="empty-state">
      <span className="empty-state-icon">{'\u2705'}</span>
      <h3>미검토 리드가 없습니다</h3>
      <p>모든 리드가 분류되었습니다.</p>
      <button className="empty-state-action-btn" onClick={() => onSwitchTab('contactable')}>연락 가능 확인</button>
    </div>
  )
  if (tabId === 'needs_enrichment') return (
    <div className="empty-state">
      <span className="empty-state-icon">{'\u2705'}</span>
      <h3>보강이 필요한 리드가 없습니다</h3>
      <p>모든 데이터가 확보되었습니다.</p>
    </div>
  )
  if (tabId === 'contactable') return (
    <div className="empty-state">
      <span className="empty-state-icon">{'\u2709\uFE0F'}</span>
      <h3>연락 가능한 리드가 아직 없습니다</h3>
      <p>미검토 탭에서 리드를 먼저 분류하세요.</p>
      <button className="empty-state-action-btn" onClick={() => onSwitchTab('unreviewed')}>미검토 탭으로 이동</button>
    </div>
  )
  if (tabId === 'excluded') {
    const label = queue === 'on_hold' ? '보류 중인' : '제외된'
    return (
      <div className="empty-state">
        <span className="empty-state-icon">{'\uD83D\uDCCB'}</span>
        <h3>{label} 리드가 없습니다</h3>
        <p>{label} 리드가 없습니다.</p>
      </div>
    )
  }
  return (
    <div className="empty-state">
      <span className="empty-state-icon">{'\u2705'}</span>
      <h3>반영된 리드가 없습니다</h3>
      <p>아직 연락 대상으로 반영된 리드가 없습니다.</p>
    </div>
  )
}
