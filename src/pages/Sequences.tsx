export default function Sequences() {
  return (
    <>
      <div className="page-header">
        <div>
          <h2>시퀀스</h2>
          <p className="page-header-sub">자동 팔로업 이메일 시퀀스를 설정하세요</p>
        </div>
        <div className="page-header-actions">
          <button className="btn btn-primary"><span>{'\u2795'}</span> 새 시퀀스</button>
        </div>
      </div>

      <div className="card">
        <div className="card-header">
          <h2 className="card-title">유튜버 협업 시퀀스</h2>
          <span className="status-badge verified">활성</span>
        </div>
        <div className="sequence-steps">
          <div className="sequence-step">
            <div className="sequence-step-number">1</div>
            <div className="sequence-step-content">
              <div className="sequence-step-title">첫 번째 협업 제안 발송</div>
              <div className="sequence-step-desc">템플릿 "첫 번째 협업 제안"을 사용하여 초기 이메일 발송</div>
            </div>
          </div>
          <div className="sequence-step">
            <div className="sequence-step-number">2</div>
            <div className="sequence-step-content">
              <div className="sequence-step-title">팔로업 이메일 (미응답 시)</div>
              <div className="sequence-step-desc">첫 메일에 응답이 없는 경우 팔로업 이메일 자동 발송</div>
              <div className="sequence-step-delay">{'\u23F0'} 3일 후 자동 발송</div>
            </div>
          </div>
          <div className="sequence-step">
            <div className="sequence-step-number">3</div>
            <div className="sequence-step-content">
              <div className="sequence-step-title">마지막 리마인드</div>
              <div className="sequence-step-desc">여전히 응답이 없는 경우 마지막 리마인드 이메일 발송</div>
              <div className="sequence-step-delay">{'\u23F0'} 5일 후 자동 발송</div>
            </div>
          </div>
        </div>
      </div>

      <div className="card">
        <div className="card-header">
          <h2 className="card-title">체험단 모집 시퀀스</h2>
          <span className="status-badge scraped">비활성</span>
        </div>
        <div className="sequence-steps">
          <div className="sequence-step">
            <div className="sequence-step-number">1</div>
            <div className="sequence-step-content">
              <div className="sequence-step-title">체험단 초대 발송</div>
              <div className="sequence-step-desc">체험단 모집 안내 템플릿으로 초대 이메일 발송</div>
            </div>
          </div>
          <div className="sequence-step">
            <div className="sequence-step-number">2</div>
            <div className="sequence-step-content">
              <div className="sequence-step-title">참여 확인 요청</div>
              <div className="sequence-step-desc">미응답자에게 참여 의사 확인 메일 발송</div>
              <div className="sequence-step-delay">{'\u23F0'} 2일 후 자동 발송</div>
            </div>
          </div>
        </div>
      </div>
    </>
  )
}
