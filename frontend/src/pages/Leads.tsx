export default function Leads() {
  return (
    <>
      <div className="page-header">
        <div>
          <h2>리드 관리</h2>
          <p className="page-header-sub">수집된 모든 연락처를 관리하고 상태를 업데이트하세요</p>
        </div>
        <div className="page-header-actions">
          <button className="btn btn-secondary"><span>{'\u2B07\uFE0F'}</span> CSV 내보내기</button>
          <button className="btn btn-primary"><span>{'\u2795'}</span> 리드 추가</button>
        </div>
      </div>
      <div className="filter-bar">
        <div className="search-input-box">
          <span style={{ color: 'var(--gray-400)', marginRight: 4 }}>{'\u{1F50E}'}</span>
          <input type="text" placeholder="이메일, 채널명으로 검색..." />
        </div>
        <span className="filter-chip active">전체 1,247</span>
        <span className="filter-chip">확인됨 312</span>
        <span className="filter-chip">수집 완료 687</span>
        <span className="filter-chip">연락함 156</span>
        <span className="filter-chip">답변 받음 58</span>
        <span className="filter-chip">직접 확인 34</span>
      </div>
      <div className="card">
        <div className="table-wrap">
          <table className="data-table">
            <thead>
              <tr><th>이메일</th><th>플랫폼</th><th>채널명</th><th>구독자</th><th>정확도</th><th>상태</th><th>수집일</th></tr>
            </thead>
            <tbody>
              <tr><td className="email-cell">creator1@gmail.com</td><td><span className="platform-badge youtube">YouTube</span></td><td>테크리뷰</td><td>52만</td><td><span className="confidence high">92%</span></td><td><span className="status-badge verified">확인됨</span></td><td style={{ color: 'var(--gray-400)', fontSize: '0.8rem' }}>2026-03-15</td></tr>
              <tr><td className="email-cell">beauty@naver.com</td><td><span className="platform-badge instagram">Instagram</span></td><td>뷰티하울</td><td>28만</td><td><span className="confidence high">78%</span></td><td><span className="status-badge scraped">수집 완료</span></td><td style={{ color: 'var(--gray-400)', fontSize: '0.8rem' }}>2026-03-15</td></tr>
              <tr><td className="email-cell">travel@blog.com</td><td><span className="platform-badge web">Web</span></td><td>여행블로그</td><td>-</td><td><span className="confidence mid">45%</span></td><td><span className="status-badge review">직접 확인 필요</span></td><td style={{ color: 'var(--gray-400)', fontSize: '0.8rem' }}>2026-03-14</td></tr>
              <tr><td className="email-cell">food.kr@gmail.com</td><td><span className="platform-badge youtube">YouTube</span></td><td>먹방천국</td><td>120만</td><td><span className="confidence high">88%</span></td><td><span className="status-badge contacted">연락함</span></td><td style={{ color: 'var(--gray-400)', fontSize: '0.8rem' }}>2026-03-14</td></tr>
              <tr><td className="email-cell">style@email.com</td><td><span className="platform-badge instagram">Instagram</span></td><td>스타일링</td><td>8.5만</td><td><span className="confidence low">35%</span></td><td><span className="status-badge scraped">수집 완료</span></td><td style={{ color: 'var(--gray-400)', fontSize: '0.8rem' }}>2026-03-13</td></tr>
              <tr><td className="email-cell">game@gmail.com</td><td><span className="platform-badge youtube">YouTube</span></td><td>겜돌이</td><td>340만</td><td><span className="confidence high">95%</span></td><td><span className="status-badge replied">답변 받음</span></td><td style={{ color: 'var(--gray-400)', fontSize: '0.8rem' }}>2026-03-12</td></tr>
              <tr><td className="email-cell">cook@blog.kr</td><td><span className="platform-badge web">Web</span></td><td>요리왕</td><td>-</td><td><span className="confidence mid">52%</span></td><td><span className="status-badge verified">확인됨</span></td><td style={{ color: 'var(--gray-400)', fontSize: '0.8rem' }}>2026-03-12</td></tr>
              <tr><td className="email-cell">fitness@naver.com</td><td><span className="platform-badge instagram">Instagram</span></td><td>헬스타그램</td><td>15만</td><td><span className="confidence high">81%</span></td><td><span className="status-badge contacted">연락함</span></td><td style={{ color: 'var(--gray-400)', fontSize: '0.8rem' }}>2026-03-11</td></tr>
            </tbody>
          </table>
        </div>
      </div>
    </>
  )
}
