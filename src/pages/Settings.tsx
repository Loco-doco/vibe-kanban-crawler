import { useState } from 'react'

function Toggle({ defaultOn = false }: { defaultOn?: boolean }) {
  const [on, setOn] = useState(defaultOn)
  return <button className={`toggle-switch${on ? ' on' : ''}`} onClick={() => setOn(!on)} />
}

export default function Settings() {
  return (
    <>
      <div className="page-header">
        <div>
          <h2>설정</h2>
          <p className="page-header-sub">계정 및 연동 설정을 관리하세요</p>
        </div>
      </div>

      <div className="settings-section">
        <div className="settings-section-header">{'\u2709\uFE0F'} Gmail 연동</div>
        <div className="settings-row">
          <div className="settings-row-label"><span>연결 상태</span><span>user@gmail.com</span></div>
          <span className="status-badge verified">연결됨</span>
        </div>
        <div className="settings-row">
          <div className="settings-row-label"><span>일일 발송 한도</span><span>하루 최대 500건까지 발송할 수 있습니다</span></div>
          <span style={{ fontWeight: 600, color: 'var(--gray-900)' }}>500건</span>
        </div>
        <div className="settings-row">
          <div className="settings-row-label"><span>발송 간격</span><span>이메일 사이의 대기 시간을 설정합니다</span></div>
          <select className="select-sm"><option>30초</option><option>1분</option><option>2분</option><option>5분</option></select>
        </div>
      </div>

      <div className="settings-section">
        <div className="settings-section-header">{'\u{1F464}'} 프로필</div>
        <div className="settings-row">
          <div className="settings-row-label"><span>이름</span><span>발신자 이름으로 사용됩니다</span></div>
          <span style={{ color: 'var(--gray-700)' }}>김건희</span>
        </div>
        <div className="settings-row">
          <div className="settings-row-label"><span>회사명</span><span>이메일 템플릿에서 {'{company}'}로 사용됩니다</span></div>
          <span style={{ color: 'var(--gray-700)' }}>Outbound Corp.</span>
        </div>
      </div>

      <div className="settings-section">
        <div className="settings-section-header">{'\u{1F514}'} 알림</div>
        <div className="settings-row">
          <div className="settings-row-label"><span>새 응답 알림</span><span>리드에게서 답변이 오면 알림을 받습니다</span></div>
          <Toggle defaultOn />
        </div>
        <div className="settings-row">
          <div className="settings-row-label"><span>크롤링 완료 알림</span><span>크롤링 작업이 완료되면 알림을 받습니다</span></div>
          <Toggle defaultOn />
        </div>
        <div className="settings-row">
          <div className="settings-row-label"><span>일일 리포트</span><span>매일 아침 전날의 성과 요약을 받습니다</span></div>
          <Toggle />
        </div>
      </div>

      <div className="settings-section">
        <div className="settings-section-header">{'\u{1F6E1}\uFE0F'} 크롤링 설정</div>
        <div className="settings-row">
          <div className="settings-row-label"><span>요청 간격</span><span>크롤링 요청 사이의 대기 시간</span></div>
          <select className="select-sm"><option>1초</option><option>2초</option><option>3초</option><option>5초</option></select>
        </div>
        <div className="settings-row">
          <div className="settings-row-label"><span>최대 탐색 깊이</span><span>링크를 따라가는 최대 깊이</span></div>
          <select className="select-sm"><option>1단계</option><option>2단계</option><option>3단계</option><option>5단계</option></select>
        </div>
        <div className="settings-row">
          <div className="settings-row-label"><span>최대 재시도 횟수</span><span>실패한 요청을 다시 시도하는 횟수</span></div>
          <select className="select-sm"><option>1회</option><option>2회</option><option>3회</option><option>5회</option></select>
        </div>
      </div>
    </>
  )
}
