import { useSearchParams } from 'react-router-dom'
import ReviewWorkspace from '../components/ReviewWorkspace'

export default function Review() {
  const [searchParams] = useSearchParams()
  const jobIdParam = searchParams.get('jobId')
  const initialJobId = jobIdParam ? Number(jobIdParam) : null

  return (
    <>
      <div className="page-header">
        <div>
          <h2>리드 검토</h2>
          <p className="page-header-sub">수집된 리드를 검토하고 연락 대상을 선별하세요</p>
        </div>
      </div>
      <ReviewWorkspace initialJobId={initialJobId} />
    </>
  )
}
