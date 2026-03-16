import { Routes, Route, NavLink, useLocation } from 'react-router-dom'
import DashboardPage from './pages/DashboardPage'
import JobSetupPage from './pages/JobSetupPage'
import JobDetailPage from './pages/JobDetailPage'
import MasterListPage from './pages/MasterListPage'
import './App.css'

function NavHeader() {
  const location = useLocation()
  const isSetupPage = location.pathname === '/jobs/new'

  return (
    <header className="nav-header">
      <div className="nav-header-inner">
        <div className="nav-logo">
          <h1>크리에이터 리서처</h1>
        </div>
        <nav className="nav-links">
          <NavLink to="/" end className={({ isActive }) => isActive ? 'nav-link active' : 'nav-link'}>
            대시보드
          </NavLink>
          <NavLink to="/master-list" className={({ isActive }) => isActive ? 'nav-link active' : 'nav-link'}>
            최종 리스트
          </NavLink>
        </nav>
        {!isSetupPage && (
          <NavLink to="/jobs/new" className="nav-cta">
            + 새 수집 시작
          </NavLink>
        )}
      </div>
    </header>
  )
}

export default function App() {
  return (
    <div className="app">
      <NavHeader />
      <main className="app-main">
        <Routes>
          <Route path="/" element={<DashboardPage />} />
          <Route path="/jobs/new" element={<JobSetupPage />} />
          <Route path="/jobs/:id" element={<JobDetailPage />} />
          <Route path="/master-list" element={<MasterListPage />} />
        </Routes>
      </main>
    </div>
  )
}
