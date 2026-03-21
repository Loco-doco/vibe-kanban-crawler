import EnrichmentImport from '../components/EnrichmentImport'

export default function AdminImport() {
  return (
    <>
      <div className="page-header">
        <div>
          <h2>데이터 가져오기</h2>
          <p className="page-header-sub">외부 보강 데이터나 키워드 제안을 시스템에 가져옵니다</p>
        </div>
      </div>
      <EnrichmentImport />
    </>
  )
}
