import { NavLink } from 'react-router-dom'

interface NavItem {
  to: string
  icon: string
  label: string
  badge?: string
  badgeClass?: string
  disabled?: boolean
}

const navSections: { label: string; items: NavItem[] }[] = [
  {
    label: '',
    items: [
      { to: '/', icon: '\u{1F4CA}', label: '대시보드' },
    ],
  },
  {
    label: '탐색',
    items: [
      { to: '/search/new', icon: '\u2795', label: '새 탐색' },
      { to: '/search/active', icon: '\u{1F4E1}', label: '진행 중인 탐색' },
    ],
  },
  {
    label: '리드',
    items: [
      { to: '/review', icon: '\u{1F4CB}', label: '리드 검토' },
    ],
  },
  {
    label: '연락',
    items: [
      { to: '/contacts', icon: '\u2709\uFE0F', label: '연락 대상' },
      { to: '/campaigns', icon: '\u{1F4E8}', label: '캠페인', disabled: true },
      { to: '/templates', icon: '\u{1F4C4}', label: '템플릿', disabled: true },
    ],
  },
  {
    label: '운영',
    items: [
      { to: '/admin/leads', icon: '\u{1F465}', label: '전체 리드 DB' },
      { to: '/admin/import', icon: '\u{1F4C1}', label: '데이터 가져오기' },
      { to: '/admin/settings', icon: '\u2699\uFE0F', label: '시스템 설정' },
    ],
  },
]

const bottomItems = [
  { to: '/help', icon: '\u2753', label: '도움말' },
]

interface SidebarProps {
  open: boolean
  onClose: () => void
}

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
          <div className="nav-section" key={section.label || '_top'}>
            {section.label && (
              <span className="nav-section-label">{section.label}</span>
            )}
            {section.items.map((item) => (
              <NavLink
                key={item.to}
                to={item.disabled ? '#' : item.to}
                end={item.to === '/'}
                className={({ isActive }) =>
                  `nav-item${!item.disabled && isActive ? ' active' : ''}${item.disabled ? ' disabled' : ''}`
                }
                onClick={(e) => {
                  if (item.disabled) {
                    e.preventDefault()
                    return
                  }
                  onClose()
                }}
              >
                <span className="nav-icon">{item.icon}</span>
                <span className="nav-label">{item.label}</span>
                {item.disabled && (
                  <span className="nav-lock" title="곧 추가될 기능입니다">{'\u{1F512}'}</span>
                )}
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
