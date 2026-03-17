import { Routes, Route } from 'react-router-dom'
import Layout from './components/Layout'
import Dashboard from './pages/Dashboard'
import Collection from './pages/Collection'
import Leads from './pages/Leads'
import MasterList from './pages/MasterList'
import Campaigns from './pages/Campaigns'
import Templates from './pages/Templates'
import Sequences from './pages/Sequences'
import Reports from './pages/Reports'
import Performance from './pages/Performance'
import Settings from './pages/Settings'
import Help from './pages/Help'

export default function App() {
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route path="/" element={<Dashboard />} />
        <Route path="/collection" element={<Collection />} />
        <Route path="/leads" element={<Leads />} />
        <Route path="/master-list" element={<MasterList />} />
        <Route path="/campaigns" element={<Campaigns />} />
        <Route path="/templates" element={<Templates />} />
        <Route path="/sequences" element={<Sequences />} />
        <Route path="/reports" element={<Reports />} />
        <Route path="/performance" element={<Performance />} />
        <Route path="/settings" element={<Settings />} />
        <Route path="/help" element={<Help />} />
      </Route>
    </Routes>
  )
}
