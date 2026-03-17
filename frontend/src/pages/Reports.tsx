const ComingSoonBanner = () => (
  <div className="coming-soon-banner">
    <span className="coming-soon-banner-icon">{'\u{1F6A7}'}</span>
    <span>이 기능은 현재 개발 중입니다. 아래는 UI 미리보기입니다.</span>
  </div>
)

export default function Reports() {
  return (
    <>
      <ComingSoonBanner />
      <div className="page-header">
        <div>
          <h2>리포트</h2>
          <p className="page-header-sub">아웃바운드 활동에 대한 상세 리포트를 확인하세요</p>
        </div>
        <div className="page-header-actions">
          <select className="select-sm"><option>최근 7일</option><option>최근 30일</option><option>최근 90일</option></select>
        </div>
      </div>

      <div className="metrics-grid">
        <div className="metric-card">
          <div className="metric-header"><span className="metric-icon" style={{ background: 'var(--primary-50)', color: 'var(--primary-600)' }}>{'\u2709\uFE0F'}</span></div>
          <div className="metric-value">3,582</div>
          <div className="metric-label">총 발송</div>
        </div>
        <div className="metric-card">
          <div className="metric-header"><span className="metric-icon" style={{ background: 'var(--success-light)', color: 'var(--success)' }}>{'\u{1F4E8}'}</span></div>
          <div className="metric-value">2,340</div>
          <div className="metric-label">오픈 (65.3%)</div>
        </div>
        <div className="metric-card">
          <div className="metric-header"><span className="metric-icon" style={{ background: 'var(--warning-light)', color: 'var(--warning)' }}>{'\u{1F4AC}'}</span></div>
          <div className="metric-value">878</div>
          <div className="metric-label">응답 (24.5%)</div>
        </div>
        <div className="metric-card">
          <div className="metric-header"><span className="metric-icon" style={{ background: 'var(--danger-light)', color: 'var(--danger)' }}>{'\u26A0\uFE0F'}</span></div>
          <div className="metric-value">42</div>
          <div className="metric-label">바운스 (1.2%)</div>
        </div>
      </div>

      <div className="dashboard-grid">
        <div>
          <div className="card">
            <div className="card-header"><h2 className="card-title">일별 발송 추이</h2></div>
            <div className="chart-container">
              <div className="chart-bars">
                {[
                  { d: '3/10', s: 55, o: 35 }, { d: '3/11', s: 72, o: 50 }, { d: '3/12', s: 85, o: 58 },
                  { d: '3/13', s: 60, o: 42 }, { d: '3/14', s: 90, o: 65 }, { d: '3/15', s: 78, o: 52 },
                  { d: '3/16', s: 40, o: 28 },
                ].map((b) => (
                  <div className="chart-bar-group" key={b.d}>
                    <div className="chart-bar-stack">
                      <div className="chart-bar sent" style={{ height: `${b.s}%` }}></div>
                      <div className="chart-bar opened" style={{ height: `${b.o}%` }}></div>
                    </div>
                    <span className="chart-day">{b.d}</span>
                  </div>
                ))}
              </div>
              <div className="chart-legend">
                <span className="legend-item"><span className="legend-dot" style={{ background: 'var(--primary-600)' }}></span>발송</span>
                <span className="legend-item"><span className="legend-dot" style={{ background: 'var(--success)' }}></span>오픈</span>
              </div>
            </div>
          </div>
        </div>
        <div>
          <div className="card">
            <div className="card-header"><h2 className="card-title">캠페인별 성과</h2></div>
            <div style={{ padding: '16px 20px' }}>
              {[
                { name: '유튜버 협업', pct: 65, open: '65%', reply: '17%' },
                { name: '인스타 뷰티', pct: 71, open: '71%', reply: '18%' },
                { name: '신제품 런칭', pct: 81, open: '81%', reply: '26%' },
              ].map((c) => (
                <div className="job-status-item" key={c.name}>
                  <div className="job-status-info"><span style={{ fontWeight: 600 }}>{c.name}</span></div>
                  <div className="progress-bar"><div className={`progress-fill${c.pct > 70 ? ' success' : ''}`} style={{ width: `${c.pct}%` }}></div></div>
                  <span className="job-status-meta">오픈률 {c.open} · 응답률 {c.reply}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </>
  )
}
