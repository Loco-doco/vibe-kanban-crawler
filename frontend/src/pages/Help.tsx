export default function Help() {
  const guides = [
    { icon: '\u{1F680}', title: '시작하기', desc: '처음 사용하시나요? 기본 설정부터 첫 캠페인까지 단계별로 안내합니다.' },
    { icon: '\u{1F50D}', title: '리드 수집 방법', desc: '크롤링 도구를 사용하여 YouTube, Instagram 등에서 리드를 수집하는 방법을 알아보세요.' },
    { icon: '\u2709\uFE0F', title: '이메일 캠페인 만들기', desc: '효과적인 아웃바운드 이메일 캠페인을 만들고 발송하는 방법을 안내합니다.' },
    { icon: '\u{1F517}', title: 'Gmail 연동하기', desc: 'Gmail 계정을 연결하여 이메일을 발송하고 응답을 추적하는 방법을 안내합니다.' },
    { icon: '\u{1F4C4}', title: '템플릿 활용법', desc: '변수를 활용한 맞춤형 이메일 템플릿을 만들고 관리하는 방법을 알아보세요.' },
    { icon: '\u{1F4C8}', title: '성과 분석 보기', desc: '리포트와 성과 분석을 통해 캠페인 효과를 측정하는 방법을 안내합니다.' },
  ]

  return (
    <>
      <div className="page-header">
        <div>
          <h2>도움말</h2>
          <p className="page-header-sub">Outbound Marketing CRM 사용 가이드</p>
        </div>
      </div>
      <div className="help-grid">
        {guides.map((g) => (
          <div className="help-card" key={g.title}>
            <span className="help-card-icon">{g.icon}</span>
            <h3>{g.title}</h3>
            <p>{g.desc}</p>
          </div>
        ))}
      </div>
    </>
  )
}
