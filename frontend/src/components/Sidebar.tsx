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
    label: '리서치',
    items: [
      { to: '/collection', icon: '\u{1F50D}', label: '리드 파이프라인' },
    ],
  },
  {
    label: '리드',
    items: [
      { to: '/leads', icon: '\u{1F465}', label: '전체 리드' },
      { to: '/master-list', icon: '\u{1F4CB}', label: '마스터 리스트' },
    ],
  },
  {
    label: '아웃리치',
    items: [
      { to: '/campaigns', icon: '\u2709\uFE0F', label: '캠페인', disabled: true },
      { to: '/templates', icon: '\u{1F4C4}', label: '템플릿', disabled: true },
      { to: '/sequences', icon: '\u{1F504}', label: '시퀀스', disabled: true },
    ],
  },
  {
    label: '분석',
    items: [
      { to: '/reports', icon: '\u{1F4C8}', label: '리포트', disabled: true },
      { to: '/performance', icon: '\u{1F3AF}', label: '성과 분석', disabled: true },
    ],
  },
]

const bottomItems = [
  { to: '/settings', icon: '\u2699\uFE0F', label: '설정' },
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
