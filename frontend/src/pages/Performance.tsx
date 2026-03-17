import ComingSoonBanner from '../components/ComingSoonBanner'

export default function Performance() {
  return (
    <>
      <ComingSoonBanner />
      <div className="page-header">
        <div>
          <h2>성과 분석</h2>
          <p className="page-header-sub">전체 아웃바운드 마케팅 성과를 한눈에 파악하세요</p>
        </div>
      </div>

      <div className="metrics-grid">
        <div className="metric-card">
          <div className="metric-header">
            <span className="metric-icon" style={{ background: 'var(--primary-50)', color: 'var(--primary-600)' }}>{'\u{1F3AF}'}</span>
            <span className="metric-trend up">{'\u2191'} 15%</span>
          </div>
          <div className="metric-value">24.5%</div>
          <div className="metric-label">전체 응답률</div>
          <div className="metric-sub">업계 평균 18%</div>
        </div>
        <div className="metric-card">
          <div className="metric-header">
            <span className="metric-icon" style={{ background: 'var(--success-light)', color: 'var(--success)' }}>{'\u{1F91D}'}</span>
            <span className="metric-trend up">{'\u2191'} 23%</span>
          </div>
          <div className="metric-value">58</div>
          <div className="metric-label">성사된 협업</div>
          <div className="metric-sub">이번 달</div>
        </div>
        <div className="metric-card">
          <div className="metric-header">
            <span className="metric-icon" style={{ background: 'var(--warning-light)', color: 'var(--warning)' }}>{'\u23F1'}</span>
            <span className="metric-trend down">{'\u2193'} 8%</span>
          </div>
          <div className="metric-value">2.3일</div>
          <div className="metric-label">평균 응답 시간</div>
          <div className="metric-sub">지난 달 2.5일</div>
        </div>
        <div className="metric-card">
          <div className="metric-header">
            <span className="metric-icon" style={{ background: 'var(--purple-light)', color: 'var(--purple)' }}>{'\u{1F4B0}'}</span>
            <span className="metric-trend up">{'\u2191'} 32%</span>
          </div>
          <div className="metric-value">{'\u20A9'}12.4M</div>
          <div className="metric-label">예상 매출 기여</div>
          <div className="metric-sub">이번 분기</div>
        </div>
      </div>

      <div className="card">
        <div className="card-header"><h2 className="card-title">플랫폼별 성과 비교</h2></div>
        <div className="table-wrap">
          <table className="data-table">
            <thead><tr><th>플랫폼</th><th>수집 리드</th><th>발송</th><th>오픈률</th><th>응답률</th><th>협업 성사</th></tr></thead>
            <tbody>
              <tr><td><span className="platform-badge youtube">YouTube</span></td><td>523</td><td>412</td><td><span className="confidence high">72%</span></td><td><span className="confidence high">28%</span></td><td>32</td></tr>
              <tr><td><span className="platform-badge instagram">Instagram</span></td><td>489</td><td>380</td><td><span className="confidence high">68%</span></td><td><span className="confidence mid">22%</span></td><td>18</td></tr>
              <tr><td><span className="platform-badge web">Web/블로그</span></td><td>235</td><td>198</td><td><span className="confidence mid">55%</span></td><td><span className="confidence mid">18%</span></td><td>8</td></tr>
            </tbody>
          </table>
        </div>
      </div>
    </>
  )
}
