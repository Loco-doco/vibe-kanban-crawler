import { NavLink } from 'react-router-dom'

interface SidebarProps {
  open: boolean
  onClose: () => void
}

const navSections = [
  {
    label: '메인',
    items: [
      { to: '/', icon: '\u{1F4CA}', label: '대시보드' },
      { to: '/leads', icon: '\u{1F465}', label: '리드 관리', badge: '1,247' },
    ],
  },
  {
    label: '아웃바운드',
    items: [
      { to: '/campaigns', icon: '\u2709\uFE0F', label: '이메일 캠페인' },
      { to: '/templates', icon: '\u{1F4C4}', label: '이메일 템플릿' },
      { to: '/sequences', icon: '\u{1F504}', label: '시퀀스' },
    ],
  },
  {
    label: '리서치',
    items: [
      { to: '/jobs', icon: '\u{1F50D}', label: '크롤링 작업', badge: '3 실행 중', badgeClass: 'success' },
      { to: '/research', icon: '\u{1F9F2}', label: '리서치 도구' },
    ],
  },
  {
    label: '분석',
    items: [
      { to: '/reports', icon: '\u{1F4C8}', label: '리포트' },
      { to: '/performance', icon: '\u{1F3AF}', label: '성과 분석' },
    ],
  },
]

const bottomItems = [
  { to: '/settings', icon: '\u2699\uFE0F', label: '설정' },
  { to: '/help', icon: '\u2753', label: '도움말' },
]

export default function Sidebar({ open, onClose }: SidebarProps) {
  return (
    <aside className={`sidebar${open ? ' open' : ''}`}>
      <div className="sidebar-brand">
        <span className="brand-icon">{'\u{1F4E8}'}</span>
        <div className="brand-text">
          <span className="brand-name">Outbound</span>
          <span className="brand-sub">Marketing CRM</span>
        </div>
      </div>

      <nav className="sidebar-nav">
        {navSections.map((section) => (
          <div className="nav-section" key={section.label}>
            <span className="nav-section-label">{section.label}</span>
            {section.items.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.to === '/'}
                className={({ isActive }) => `nav-item${isActive ? ' active' : ''}`}
                onClick={onClose}
              >
                <span className="nav-icon">{item.icon}</span>
                <span className="nav-label">{item.label}</span>
                {item.badge && (
                  <span className={`nav-badge${item.badgeClass ? ` ${item.badgeClass}` : ''}`}>
                    {item.badge}
                  </span>
                )}
              </NavLink>
            ))}
          </div>
        ))}
      </nav>

      <div className="sidebar-bottom">
        {bottomItems.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            className={({ isActive }) => `nav-item${isActive ? ' active' : ''}`}
            onClick={onClose}
          >
            <span className="nav-icon">{item.icon}</span>
            <span className="nav-label">{item.label}</span>
          </NavLink>
        ))}
      </div>

      <div className="sidebar-user">
        <div className="user-avatar">김</div>
        <div className="user-info">
          <span className="user-name">김건희</span>
          <span className="user-role">관리자</span>
        </div>
      </div>
    </aside>
  )
}
