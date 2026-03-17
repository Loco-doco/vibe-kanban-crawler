import ComingSoonBanner from '../components/ComingSoonBanner'

export default function Templates() {
  const templates = [
    { title: '첫 번째 협업 제안', preview: '안녕하세요, {channel_name} 채널을 운영하고 계신 {name}님. 저희는 {company}에서 연락드립니다. {name}님의 콘텐츠를 통해 저희 제품을 소개해주실 의향이 있으신지 문의드립니다...', used: 156, openRate: '68%', modified: '3일 전' },
    { title: '팔로업 (미응답)', preview: '안녕하세요 {name}님, 지난번 보내드린 메일 확인하셨는지 궁금합니다. 바쁘신 와중에 죄송하지만, 간단히 회신 부탁드려도 될까요...', used: 89, openRate: '54%', modified: '1주 전' },
    { title: '체험단 모집 안내', preview: '{name}님 안녕하세요! 저희 {product} 체험단을 모집하고 있습니다. {name}님의 채널과 잘 맞을 것 같아 안내드립니다. 관심 있으시면...', used: 67, openRate: '72%', modified: '2주 전' },
    { title: '감사 인사 + 재협업', preview: '{name}님, 지난 협업에 감사드립니다. {name}님 덕분에 좋은 성과를 거둘 수 있었습니다. 이번에 새로운 프로젝트가 있어 다시 한번...', used: 34, openRate: '82%', modified: '1달 전' },
  ]

  return (
    <>
      <ComingSoonBanner />
      <div className="page-header">
        <div>
          <h2>템플릿</h2>
          <p className="page-header-sub">자주 사용하는 이메일 양식을 저장하고 재사용하세요</p>
        </div>
        <div className="page-header-actions">
          <button className="btn btn-primary"><span>{'\u2795'}</span> 새 템플릿</button>
        </div>
      </div>
      <div className="card-grid">
        {templates.map((t) => (
          <div className="template-card" key={t.title}>
            <div className="template-card-title">{t.title}</div>
            <div className="template-card-preview">{t.preview}</div>
            <div className="template-card-meta">
              <span>사용: {t.used}회</span>
              <span>오픈율: {t.openRate}</span>
              <span>수정: {t.modified}</span>
            </div>
          </div>
        ))}
      </div>
    </>
  )
}
