import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { getJobs } from '../api/jobs'
import CollectionSetupForm from '../components/CollectionSetupForm'
import JobMonitor from '../components/JobMonitor'
import CollectionResults from '../components/CollectionResults'
import EnrichmentImport from '../components/EnrichmentImport'
import type { Job } from '../types'

type TabKey = 'setup' | 'monitor' | 'results' | 'operator'

export default function Collection() {
  const [activeTab, setActiveTab] = useState<TabKey>('setup')
  const [resultJobId, setResultJobId] = useState<number | null>(null)

  const { data: jobs } = useQuery({ queryKey: ['jobs'], queryFn: getJobs, refetchInterval: 5000 })
  const activeCount = jobs?.filter((j: Job) => ['draft', 'queued', 'running', 'partial_results'].includes(j.status)).length || 0

  const handleViewResults = (jobId: number) => {
    setResultJobId(jobId)
    setActiveTab('results')
  }

  return (
    <>
      <div className="page-header">
        <div>
          <h2>리드 수집</h2>
          <p className="page-header-sub">크롤러를 이용해 크리에이터의 연락처를 탐색하고 수집하세요</p>
        </div>
      </div>

      <div className="collection-tabs">
        <button
          className={`collection-tab${activeTab === 'setup' ? ' active' : ''}`}
          onClick={() => setActiveTab('setup')}
        >
          <span className="collection-tab-icon">{'\u2795'}</span>
          새 탐색 만들기
        </button>
        <button
          className={`collection-tab${activeTab === 'monitor' ? ' active' : ''}`}
          onClick={() => setActiveTab('monitor')}
        >
          <span className="collection-tab-icon">{'\u{1F4E1}'}</span>
          진행 중인 탐색
          {activeCount > 0 && <span className="tab-badge">{activeCount}</span>}
        </button>
        <button
          className={`collection-tab${activeTab === 'results' ? ' active' : ''}`}
          onClick={() => setActiveTab('results')}
        >
          <span className="collection-tab-icon">{'\u{1F4CA}'}</span>
          탐색 결과
        </button>
        <button
          className={`collection-tab${activeTab === 'operator' ? ' active' : ''}`}
          onClick={() => setActiveTab('operator')}
        >
          <span className="collection-tab-icon">{'\u{1F6E0}\uFE0F'}</span>
          운영자 도구
        </button>
      </div>

      <div className="collection-tab-content">
        {activeTab === 'setup' && (
          <CollectionSetupForm onCreated={() => setActiveTab('monitor')} />
        )}
        {activeTab === 'monitor' && (
          <JobMonitor onViewResults={handleViewResults} />
        )}
        {activeTab === 'results' && (
          <CollectionResults initialJobId={resultJobId} />
        )}
        {activeTab === 'operator' && (
          <EnrichmentImport />
        )}
      </div>
    </>
  )
}
