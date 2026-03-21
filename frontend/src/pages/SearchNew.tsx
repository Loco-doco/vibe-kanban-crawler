import { useNavigate } from 'react-router-dom'
import CollectionSetupForm from '../components/CollectionSetupForm'

export default function SearchNew() {
  const navigate = useNavigate()

  return (
    <>
      <div className="page-header">
        <div>
          <h2>새 탐색</h2>
          <p className="page-header-sub">찾고 싶은 크리에이터 조건을 입력하고 탐색을 시작하세요</p>
        </div>
      </div>
      <CollectionSetupForm onCreated={() => navigate('/search/active')} />
    </>
  )
}
