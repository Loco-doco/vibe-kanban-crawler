import { useState } from 'react'
import { Outlet } from 'react-router-dom'
import Sidebar from './Sidebar'
import Topbar from './Topbar'

export default function Layout() {
  const [sidebarOpen, setSidebarOpen] = useState(false)

  return (
    <div className="app-layout">
      <Sidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)} />
      {sidebarOpen && <div className="sidebar-overlay active" onClick={() => setSidebarOpen(false)} />}
      <div className="main-wrapper">
        <Topbar onMenuToggle={() => setSidebarOpen(!sidebarOpen)} />
        <main className="content">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
