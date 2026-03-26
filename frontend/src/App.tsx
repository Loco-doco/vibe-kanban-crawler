import { Routes, Route, Navigate } from 'react-router-dom'
import Layout from './components/Layout'
import Dashboard from './pages/Dashboard'
import SearchNew from './pages/SearchNew'
import SearchActive from './pages/SearchActive'
import Review from './pages/Review'
import Contacts from './pages/Contacts'
import Campaigns from './pages/Campaigns'
import Templates from './pages/Templates'
import AdminLeads from './pages/AdminLeads'
import AdminImport from './pages/AdminImport'
import Settings from './pages/Settings'
import Help from './pages/Help'

export default function App() {
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route path="/" element={<Dashboard />} />

        {/* 탐색 */}
        <Route path="/search/new" element={<SearchNew />} />
        <Route path="/search/active" element={<SearchActive />} />

        {/* 리드 검토 */}
        <Route path="/review" element={<Review />} />

        {/* 연락 */}
        <Route path="/contacts" element={<Contacts />} />
        <Route path="/campaigns" element={<Campaigns />} />
        <Route path="/templates" element={<Templates />} />

        {/* 운영 */}
        <Route path="/admin/leads" element={<AdminLeads />} />
        <Route path="/admin/import" element={<AdminImport />} />
        <Route path="/admin/settings" element={<Settings />} />

        {/* 기타 */}
        <Route path="/help" element={<Help />} />

        {/* 하위 호환 리다이렉트 */}
        <Route path="/collection" element={<Navigate to="/search/new" replace />} />
        <Route path="/master-list" element={<Navigate to="/contacts" replace />} />
        <Route path="/leads" element={<Navigate to="/admin/leads" replace />} />
        <Route path="/settings" element={<Navigate to="/admin/settings" replace />} />
      </Route>
    </Routes>
  )
}
