import ComingSoonBanner from '../components/ComingSoonBanner'

export default function Campaigns() {
  const campaigns = [
    { status: '진행 중', statusClass: 'verified', date: '3월 10일 시작', title: '유튜버 협업 제안', desc: '테크 분야 유튜버 대상 제품 리뷰 협업 제안 캠페인. 1차 발송 완료, 2차 팔로업 진행 중.', sent: 23, open: '15건 (65%)', reply: '4건 (17%)' },
    { status: '진행 중', statusClass: 'verified', date: '3월 8일 시작', title: '인스타 뷰티 인플루언서', desc: '뷰티/화장품 분야 인스타그램 인플루언서 대상 제품 협찬 제안.', sent: 45, open: '32건 (71%)', reply: '8건 (18%)' },
    { status: '준비 중', statusClass: 'scraped', date: '미발송', title: '블로그 리뷰어 아웃리치', desc: '네이버/티스토리 블로그 리뷰어 대상 체험단 모집 이메일.', sent: null, open: null, reply: null },
    { status: '완료', statusClass: 'contacted', date: '2월 20일', title: '신제품 런칭 알림', desc: '기존 협업 인플루언서 대상 신제품 출시 알림 및 재협업 제안.', sent: 89, open: '72건 (81%)', reply: '23건 (26%)' },
  ]

  return (
    <>
      <ComingSoonBanner />
      <div className="page-header">
        <div>
          <h2>캠페인</h2>
          <p className="page-header-sub">아웃바운드 이메일 캠페인을 만들고 관리하세요</p>
        </div>
        <div className="page-header-actions">
          <button className="btn btn-primary"><span>{'\u2795'}</span> 새 캠페인</button>
        </div>
      </div>
      <div className="card-grid">
        {campaigns.map((c) => (
          <div className="template-card" key={c.title}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
              <span className={`status-badge ${c.statusClass}`}>{c.status}</span>
              <span style={{ fontSize: '0.75rem', color: 'var(--gray-400)' }}>{c.date}</span>
            </div>
            <div className="template-card-title">{c.title}</div>
            <div className="template-card-preview">{c.desc}</div>
            <div className="template-card-meta">
              <span>{c.sent ? `발송: ${c.sent}건` : `대상: 34명`}</span>
              <span>{c.open || '템플릿: 선택됨'}</span>
              <span>{c.reply || '예약: 미설정'}</span>
            </div>
          </div>
        ))}
      </div>
    </>
  )
}
