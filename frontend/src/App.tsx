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
        <h1>Creator Lead Researcher</h1>
        <p>Multi-platform creator contact discovery</p>
      </header>

      <div className="app-layout">
        <aside className="sidebar">
          <JobForm />
          <JobList selectedJobId={selectedJobId} onSelectJob={setSelectedJobId} />
        </aside>

        <main className="content">
          <div className="content-header">
            <h2>
              {selectedJobId ? `Job #${selectedJobId} Leads` : 'All Leads'}
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
