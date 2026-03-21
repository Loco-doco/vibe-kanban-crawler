import { useNavigate } from 'react-router-dom'
import JobMonitor from '../components/JobMonitor'

export default function SearchActive() {
  const navigate = useNavigate()

  return (
    <>
      <div className="page-header">
        <div>
          <h2>진행 중인 탐색</h2>
          <p className="page-header-sub">실행 중인 탐색의 진행 상태를 확인하세요</p>
        </div>
      </div>
      <JobMonitor onViewResults={(jobId) => navigate(`/review?jobId=${jobId}`)} />
    </>
  )
}
