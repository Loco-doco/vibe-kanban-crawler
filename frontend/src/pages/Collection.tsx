import { useState } from 'react'
import CollectionSetupForm from '../components/CollectionSetupForm'
import JobMonitor from '../components/JobMonitor'
import CollectionResults from '../components/CollectionResults'

const TABS = [
  { key: 'setup', label: '새 수집 설정', icon: '\u2795' },
  { key: 'monitor', label: '진행 중인 작업', icon: '\u{1F4E1}' },
  { key: 'results', label: '수집 결과', icon: '\u{1F4CA}' },
] as const

type TabKey = (typeof TABS)[number]['key']

export default function Collection() {
  const [activeTab, setActiveTab] = useState<TabKey>('setup')

  return (
    <>
      <div className="page-header">
        <div>
          <h2>리드 수집</h2>
          <p className="page-header-sub">크롤러를 이용해 크리에이터의 연락처를 수집하세요</p>
        </div>
      </div>

      <div className="collection-tabs">
        {TABS.map((tab) => (
          <button
            key={tab.key}
            className={`collection-tab${activeTab === tab.key ? ' active' : ''}`}
            onClick={() => setActiveTab(tab.key)}
          >
            <span className="collection-tab-icon">{tab.icon}</span>
            {tab.label}
          </button>
        ))}
      </div>

      <div className="collection-tab-content">
        {activeTab === 'setup' && (
          <CollectionSetupForm onCreated={() => setActiveTab('monitor')} />
        )}
        {activeTab === 'monitor' && <JobMonitor />}
        {activeTab === 'results' && <CollectionResults />}
      </div>
    </>
  )
}
