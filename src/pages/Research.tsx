export default function Research() {
  const tools = [
    { icon: '\u{1F50D}', title: 'URL 크롤링', desc: '특정 웹사이트 URL을 입력하면 해당 페이지에서 이메일 주소를 자동으로 수집합니다.', ready: true },
    { icon: '\u{1F4F9}', title: 'YouTube 채널 검색', desc: 'YouTube 채널 URL을 입력하면 채널 정보와 연락처 이메일을 자동으로 찾아줍니다.', ready: true },
    { icon: '\u{1F4F7}', title: 'Instagram 프로필 검색', desc: 'Instagram 프로필에서 비즈니스 이메일과 연락처 정보를 수집합니다.', ready: true },
    { icon: '\u{1F310}', title: '대량 URL 검색', desc: '여러 URL을 한 번에 입력하여 대량으로 리드를 수집할 수 있습니다.', ready: false },
  ]

  return (
    <>
      <div className="page-header">
        <div>
          <h2>리서치 도구</h2>
          <p className="page-header-sub">리드 발굴을 위한 다양한 리서치 도구</p>
        </div>
      </div>
      <div className="card-grid">
        {tools.map((t) => (
          <div className="help-card" key={t.title} style={!t.ready ? { opacity: 0.6 } : undefined}>
            <span className="help-card-icon">{t.icon}</span>
            <h3>{t.title}</h3>
            <p>{t.desc}</p>
            <button className={`btn ${t.ready ? 'btn-primary' : 'btn-secondary'}`} style={{ marginTop: 16 }}>
              {t.ready ? '사용하기' : '준비 중'}
            </button>
          </div>
        ))}
      </div>
    </>
  )
}
