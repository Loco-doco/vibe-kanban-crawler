export default function Jobs() {
  const jobs = [
    { id: 45, target: '유튜브 테크 채널', status: '수집 중', statusClass: 'contacted', leads: 34, pct: 67, time: '오늘 14:30' },
    { id: 44, target: '유튜브 뷰티 채널', status: '수집 중', statusClass: 'contacted', leads: 12, pct: 23, time: '오늘 14:15' },
    { id: 43, target: '인스타 패션 인플루언서', status: '수집 중', statusClass: 'contacted', leads: 8, pct: 15, time: '오늘 13:50' },
    { id: 42, target: '인스타 뷰티 인플루언서', status: '완료', statusClass: 'verified', leads: 128, pct: 100, time: '오늘 10:20' },
    { id: 41, target: '블로그 리뷰어 검색', status: '대기 중', statusClass: '', leads: null, pct: 0, time: '-' },
    { id: 40, target: '유튜브 먹방 채널', status: '완료', statusClass: 'verified', leads: 87, pct: 100, time: '어제 16:45' },
  ]

  return (
    <>
      <div className="page-header">
        <div>
          <h2>크롤링 작업</h2>
          <p className="page-header-sub">리드 수집을 위한 크롤링 작업을 관리하세요</p>
        </div>
        <div className="page-header-actions">
          <button className="btn btn-primary"><span>{'\u{1F50D}'}</span> 새 크롤링 시작</button>
        </div>
      </div>
      <div className="card">
        <div className="table-wrap">
          <table className="data-table">
            <thead>
              <tr><th>#</th><th>대상</th><th>상태</th><th>발견 리드</th><th>진행률</th><th>시작 시간</th></tr>
            </thead>
            <tbody>
              {jobs.map((j) => (
                <tr key={j.id}>
                  <td style={{ color: 'var(--gray-400)' }}>#{j.id}</td>
                  <td>{j.target}</td>
                  <td>
                    <span className={`status-badge ${j.statusClass}`} style={!j.statusClass ? { background: 'var(--gray-100)', color: 'var(--gray-500)' } : j.status === '수집 중' ? { background: '#eff6ff' } : undefined}>
                      {j.status === '수집 중' && '\u25CF '}{j.status}
                    </span>
                  </td>
                  <td>{j.leads ?? '-'}</td>
                  <td>
                    {j.pct > 0 ? (
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
                        <span className="progress-bar" style={{ width: 120, display: 'inline-block', verticalAlign: 'middle' }}>
                          <span className={`progress-fill${j.pct === 100 ? ' success' : ''}`} style={{ width: `${j.pct}%`, display: 'block', height: '100%', borderRadius: 3 }}></span>
                        </span>
                        <span style={{ fontSize: '0.8rem', color: 'var(--gray-500)' }}>{j.pct}%</span>
                      </span>
                    ) : (
                      <span style={{ fontSize: '0.8rem', color: 'var(--gray-400)' }}>대기</span>
                    )}
                  </td>
                  <td style={{ color: 'var(--gray-400)', fontSize: '0.8rem' }}>{j.time}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </>
  )
}
