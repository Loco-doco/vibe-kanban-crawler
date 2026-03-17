import { useLocation } from 'react-router-dom'

const pageTitles: Record<string, string> = {
  '/': '대시보드',
  '/collection': '리드 수집',
  '/leads': '전체 리드',
  '/master-list': '마스터 리스트',
  '/campaigns': '캠페인',
  '/templates': '템플릿',
  '/sequences': '시퀀스',
  '/reports': '리포트',
  '/performance': '성과 분석',
  '/settings': '설정',
  '/help': '도움말',
}

interface TopbarProps {
  onMenuToggle: () => void
}

export default function Topbar({ onMenuToggle }: TopbarProps) {
  const location = useLocation()
  const title = pageTitles[location.pathname] || '대시보드'

  return (
    <header className="topbar">
      <button className="menu-toggle" onClick={onMenuToggle}>{'\u2630'}</button>
      <h1 className="page-title">{title}</h1>
      <div className="search-bar">
        <span className="search-icon">{'\u{1F50E}'}</span>
        <input type="text" placeholder="리드, 캠페인, 작업 검색..." className="search-input" />
      </div>
      <div className="topbar-actions">
        <button className="topbar-btn" title="새 캠페인">
          <span>{'\u2795'}</span>
        </button>
        <button className="topbar-btn" title="알림">
          <span>{'\u{1F514}'}</span>
          <span className="notification-dot"></span>
        </button>
        <div className="topbar-divider"></div>
        <button className="topbar-btn">
          <div className="user-avatar-sm">김</div>
        </button>
      </div>
    </header>
  )
}
