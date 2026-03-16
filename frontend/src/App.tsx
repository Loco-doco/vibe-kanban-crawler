import { useState } from 'react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import JobForm from './components/JobForm'
import JobList from './components/JobList'
import LeadTable from './components/LeadTable'
import CsvDownloadButton from './components/CsvDownloadButton'
import './App.css'

const queryClient = new QueryClient()

function AppContent() {
  const [selectedJobId, setSelectedJobId] = useState<number | null>(null)

  return (
    <div className="app">
      <header className="app-header">
        <h1>크리에이터 연락처 수집기</h1>
        <p>유튜브, 인스타그램 등 크리에이터의 공개 이메일을 자동으로 찾아드립니다</p>
      </header>

      <div className="app-layout">
        <aside className="sidebar">
          <JobForm />
          <JobList selectedJobId={selectedJobId} onSelectJob={setSelectedJobId} />
        </aside>

        <main className="content">
          <div className="content-header">
            <h2>
              {selectedJobId ? `작업 #${selectedJobId} 결과` : '전체 수집 결과'}
            </h2>
            <CsvDownloadButton jobId={selectedJobId} />
          </div>
          <LeadTable jobId={selectedJobId} />
        </main>
      </div>
    </div>
  )
}

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AppContent />
    </QueryClientProvider>
  )
}
