import { useNavigate } from 'react-router-dom'

export default function Dashboard() {
  const navigate = useNavigate()

  return (
    <>
      {/* Quick Actions */}
      <div className="quick-actions">
        <button className="btn btn-primary" onClick={() => navigate('/campaigns')}>
          <span>{'\u2795'}</span> 새 캠페인 만들기
        </button>
        <button className="btn btn-secondary" onClick={() => navigate('/leads')}>
          <span>{'\u{1F465}'}</span> 리드 추가
        </button>
        <button className="btn btn-secondary" onClick={() => navigate('/jobs')}>
          <span>{'\u{1F50D}'}</span> 크롤링 시작
        </button>
        <button className="btn btn-secondary">
          <span>{'\u2B07\uFE0F'}</span> 리드 내보내기
        </button>
      </div>

      {/* KPI Metrics */}
      <div className="metrics-grid">
        <div className="metric-card">
          <div className="metric-header">
            <span className="metric-icon" style={{ background: 'var(--primary-50)', color: 'var(--primary-600)' }}>{'\u{1F465}'}</span>
            <span className="metric-trend up">{'\u2191'} 12%</span>
          </div>
          <div className="metric-value">1,247</div>
          <div className="metric-label">전체 리드</div>
          <div className="metric-sub">지난 30일 대비</div>
        </div>
        <div className="metric-card">
          <div className="metric-header">
            <span className="metric-icon" style={{ background: 'var(--success-light)', color: 'var(--success)' }}>{'\u2709\uFE0F'}</span>
            <span className="metric-trend up">{'\u2191'} 8%</span>
          </div>
          <div className="metric-value">3,582</div>
          <div className="metric-label">발송 이메일</div>
          <div className="metric-sub">이번 달</div>
        </div>
        <div className="metric-card">
          <div className="metric-header">
            <span className="metric-icon" style={{ background: 'var(--warning-light)', color: 'var(--warning)' }}>{'\u{1F4AC}'}</span>
            <span className="metric-trend down">{'\u2193'} 2%</span>
          </div>
          <div className="metric-value">24.5%</div>
          <div className="metric-label">응답률</div>
          <div className="metric-sub">지난 주 대비</div>
        </div>
        <div className="metric-card">
          <div className="metric-header">
            <span className="metric-icon" style={{ background: 'var(--purple-light)', color: 'var(--purple)' }}>{'\u{1F680}'}</span>
            <span className="metric-trend neutral">{'\u2192'} 0%</span>
          </div>
          <div className="metric-value">7</div>
          <div className="metric-label">활성 캠페인</div>
          <div className="metric-sub">현재 진행 중</div>
        </div>
      </div>

      {/* Dashboard Grid */}
      <div className="dashboard-grid">
        <div className="dashboard-col-main">
          {/* Recent Leads */}
          <div className="card">
            <div className="card-header">
              <h2 className="card-title">최근 수집된 리드</h2>
              <a className="card-link" onClick={() => navigate('/leads')} style={{ cursor: 'pointer' }}>전체 보기 {'\u2192'}</a>
            </div>
            <div className="table-wrap">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>이메일</th>
                    <th>플랫폼</th>
                    <th>채널명</th>
                    <th>정확도</th>
                    <th>상태</th>
                  </tr>
                </thead>
                <tbody>
                  <tr><td className="email-cell">creator1@gmail.com</td><td><span className="platform-badge youtube">YouTube</span></td><td>테크리뷰</td><td><span className="confidence high">92%</span></td><td><span className="status-badge verified">확인됨</span></td></tr>
                  <tr><td className="email-cell">beauty@naver.com</td><td><span className="platform-badge instagram">Instagram</span></td><td>뷰티하울</td><td><span className="confidence high">78%</span></td><td><span className="status-badge scraped">수집 완료</span></td></tr>
                  <tr><td className="email-cell">travel@blog.com</td><td><span className="platform-badge web">Web</span></td><td>여행블로그</td><td><span className="confidence mid">45%</span></td><td><span className="status-badge review">직접 확인 필요</span></td></tr>
                  <tr><td className="email-cell">food.kr@gmail.com</td><td><span className="platform-badge youtube">YouTube</span></td><td>먹방천국</td><td><span className="confidence high">88%</span></td><td><span className="status-badge contacted">연락함</span></td></tr>
                  <tr><td className="email-cell">style@email.com</td><td><span className="platform-badge instagram">Instagram</span></td><td>스타일링</td><td><span className="confidence low">35%</span></td><td><span className="status-badge scraped">수집 완료</span></td></tr>
                </tbody>
              </table>
            </div>
          </div>

          {/* Campaign Chart */}
          <div className="card">
            <div className="card-header">
              <h2 className="card-title">캠페인 성과</h2>
              <select className="select-sm">
                <option>최근 7일</option>
                <option>최근 30일</option>
                <option>최근 90일</option>
              </select>
            </div>
            <div className="chart-container">
              <div className="chart-bars">
                {[
                  { day: '월', s: 60, o: 40, r: 15 },
                  { day: '화', s: 80, o: 55, r: 22 },
                  { day: '수', s: 45, o: 30, r: 12 },
                  { day: '목', s: 90, o: 65, r: 28 },
                  { day: '금', s: 70, o: 48, r: 20 },
                  { day: '토', s: 35, o: 22, r: 8 },
                  { day: '일', s: 25, o: 18, r: 5 },
                ].map((d) => (
                  <div className="chart-bar-group" key={d.day}>
                    <div className="chart-bar-stack">
                      <div className="chart-bar sent" style={{ height: `${d.s}%` }}></div>
                      <div className="chart-bar opened" style={{ height: `${d.o}%` }}></div>
                      <div className="chart-bar replied-bar" style={{ height: `${d.r}%` }}></div>
                    </div>
                    <span className="chart-day">{d.day}</span>
                  </div>
                ))}
              </div>
              <div className="chart-legend">
                <span className="legend-item"><span className="legend-dot" style={{ background: 'var(--primary-600)' }}></span>발송</span>
                <span className="legend-item"><span className="legend-dot" style={{ background: 'var(--success)' }}></span>오픈</span>
                <span className="legend-item"><span className="legend-dot" style={{ background: 'var(--warning)' }}></span>응답</span>
              </div>
            </div>
          </div>
        </div>

        <div className="dashboard-col-side">
          {/* Activity Feed */}
          <div className="card">
            <div className="card-header">
              <h2 className="card-title">최근 활동</h2>
            </div>
            <div className="activity-feed">
              {[
                { icon: '\u2714\uFE0F', bg: 'var(--success-light)', color: 'var(--success)', text: <><strong>크롤링 작업 #42</strong> 완료</>, time: '5분 전' },
                { icon: '\u2709\uFE0F', bg: 'var(--primary-50)', color: 'var(--primary-600)', text: <>캠페인 <strong>"유튜버 협업"</strong> 이메일 23건 발송</>, time: '32분 전' },
                { icon: '\u{1F4AC}', bg: 'var(--warning-light)', color: 'var(--warning)', text: <><strong>creator@email.com</strong>에서 답변 도착</>, time: '1시간 전' },
                { icon: '\u{1F465}', bg: 'var(--purple-light)', color: 'var(--purple)', text: <>새 리드 <strong>15건</strong> 추가됨</>, time: '2시간 전' },
                { icon: '\u{1F680}', bg: 'var(--primary-50)', color: 'var(--primary-600)', text: <>캠페인 <strong>"인스타 뷰티"</strong> 시작</>, time: '3시간 전' },
                { icon: '\u{1F517}', bg: 'var(--success-light)', color: 'var(--success)', text: <><strong>Gmail 연동</strong> 갱신 완료</>, time: '5시간 전' },
              ].map((a, i) => (
                <div className="activity-item" key={i}>
                  <span className="activity-icon" style={{ background: a.bg, color: a.color }}>{a.icon}</span>
                  <div className="activity-content">
                    <p>{a.text}</p>
                    <span className="activity-time">{a.time}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Crawling Status */}
          <div className="card">
            <div className="card-header">
              <h2 className="card-title">크롤링 현황</h2>
              <a className="card-link" onClick={() => navigate('/jobs')} style={{ cursor: 'pointer' }}>전체 보기 {'\u2192'}</a>
            </div>
            <div className="job-status-list">
              <div className="job-status-item">
                <div className="job-status-info"><span className="status-dot running"></span><span>유튜브 테크 채널 수집</span></div>
                <div className="progress-bar"><div className="progress-fill" style={{ width: '67%' }}></div></div>
                <span className="job-status-meta">67% · 리드 34개 발견</span>
              </div>
              <div className="job-status-item">
                <div className="job-status-info"><span className="status-dot completed"></span><span>인스타 뷰티 인플루언서</span></div>
                <span className="job-status-meta">완료 · 리드 128개</span>
              </div>
              <div className="job-status-item">
                <div className="job-status-info"><span className="status-dot pending"></span><span>블로그 리뷰어 검색</span></div>
                <span className="job-status-meta">대기 중</span>
              </div>
            </div>
          </div>

          {/* Gmail Widget */}
          <div className="card">
            <div className="card-header">
              <h2 className="card-title">Gmail 연동</h2>
            </div>
            <div className="gmail-status">
              <div className="gmail-connected"><span className="status-dot connected"></span><span>연결됨: user@gmail.com</span></div>
              <div>
                <span className="quota-label">일일 발송 한도</span>
                <div className="progress-bar"><div className="progress-fill warning" style={{ width: '45%' }}></div></div>
                <span className="quota-text">225 / 500 사용</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  )
}
