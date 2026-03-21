import { useState, useRef } from 'react'
import { importEnrichments, importKeywords } from '../api/enrichments'

type ImportType = 'enrichments' | 'keywords'

interface EnrichmentEntry {
  lead_id: number
  business_summary?: string
  descriptor_keywords?: string[]
  content_topics?: string[]
  trend_summary?: string
  suggested_email?: string
  operator_notes?: string
}

interface KeywordEntry {
  job_id: number
  suggested_keywords?: string[]
  notes?: string
}

interface ImportResult {
  imported: number
  errors: Array<{ lead_id?: number; job_id?: number; error: string }>
}

export default function EnrichmentImport() {
  const [importType, setImportType] = useState<ImportType>('enrichments')
  const [fileData, setFileData] = useState<unknown>(null)
  const [fileName, setFileName] = useState('')
  const [preview, setPreview] = useState<EnrichmentEntry[] | KeywordEntry[] | null>(null)
  const [result, setResult] = useState<ImportResult | null>(null)
  const [error, setError] = useState('')
  const [isImporting, setIsImporting] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  const resetState = () => {
    setFileData(null)
    setFileName('')
    setPreview(null)
    setResult(null)
    setError('')
  }

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    resetState()
    setFileName(file.name)

    const reader = new FileReader()
    reader.onload = (ev) => {
      try {
        const parsed = JSON.parse(ev.target?.result as string)
        setFileData(parsed)

        if (importType === 'enrichments') {
          const items = parsed.enrichments || parsed
          if (!Array.isArray(items)) {
            setError('enrichments 배열을 찾을 수 없습니다.')
            return
          }
          setPreview(items as EnrichmentEntry[])
        } else {
          const items = parsed.job_keywords || parsed
          if (!Array.isArray(items)) {
            setError('job_keywords 배열을 찾을 수 없습니다.')
            return
          }
          setPreview(items as KeywordEntry[])
        }
      } catch {
        setError('JSON 파일 파싱에 실패했습니다.')
      }
    }
    reader.readAsText(file)
  }

  const handleImport = async () => {
    if (!fileData) return
    setIsImporting(true)
    setError('')
    setResult(null)

    try {
      if (importType === 'enrichments') {
        const payload = typeof fileData === 'object' && fileData !== null && 'enrichments' in fileData
          ? fileData
          : { enrichments: fileData }
        const res = await importEnrichments(payload)
        setResult(res)
      } else {
        const payload = typeof fileData === 'object' && fileData !== null && 'job_keywords' in fileData
          ? fileData
          : { job_keywords: fileData }
        const res = await importKeywords(payload)
        setResult(res)
      }
      setPreview(null)
    } catch {
      setError('가져오기 중 오류가 발생했습니다.')
    } finally {
      setIsImporting(false)
    }
  }

  const handleTypeChange = (type: ImportType) => {
    setImportType(type)
    resetState()
    if (fileRef.current) fileRef.current.value = ''
  }

  return (
    <div className="enrichment-import">
      <div className="enrichment-import-header">
        <h3>데이터 가져오기</h3>
        <p className="enrichment-import-desc">
          Claude Code 운영자가 생성한 JSON 파일을 업로드하여 리드 보강 데이터나 키워드 제안을 가져올 수 있습니다.
        </p>
      </div>

      {/* Type selector */}
      <div className="enrichment-type-selector">
        <button
          className={`enrichment-type-btn${importType === 'enrichments' ? ' active' : ''}`}
          onClick={() => handleTypeChange('enrichments')}
        >
          리드 보강 데이터
        </button>
        <button
          className={`enrichment-type-btn${importType === 'keywords' ? ' active' : ''}`}
          onClick={() => handleTypeChange('keywords')}
        >
          키워드 제안
        </button>
      </div>

      {/* File upload */}
      <div className="enrichment-upload-area">
        <input
          ref={fileRef}
          type="file"
          accept=".json"
          onChange={handleFileSelect}
          className="enrichment-file-input"
          id="enrichment-file"
        />
        <label htmlFor="enrichment-file" className="enrichment-upload-label">
          <span className="enrichment-upload-icon">{'\u{1F4C1}'}</span>
          <span>{fileName || '.json 파일을 선택하세요'}</span>
        </label>
      </div>

      {/* Error */}
      {error && <div className="campaign-error" style={{ marginTop: 12 }}>{error}</div>}

      {/* Preview */}
      {preview && preview.length > 0 && (
        <div className="enrichment-preview">
          <div className="enrichment-preview-header">
            <strong>{preview.length}건</strong> 미리보기
          </div>
          <div className="table-wrap">
            {importType === 'enrichments' ? (
              <table className="data-table enrichment-preview-table">
                <thead>
                  <tr>
                    <th>Lead ID</th>
                    <th>비즈니스 요약</th>
                    <th>키워드</th>
                    <th>이메일 제안</th>
                    <th>메모</th>
                  </tr>
                </thead>
                <tbody>
                  {(preview as EnrichmentEntry[]).slice(0, 20).map((item, i) => (
                    <tr key={i}>
                      <td>{item.lead_id}</td>
                      <td className="enrichment-preview-summary">
                        {item.business_summary
                          ? item.business_summary.length > 40
                            ? item.business_summary.slice(0, 40) + '...'
                            : item.business_summary
                          : '-'}
                      </td>
                      <td>
                        {item.descriptor_keywords?.slice(0, 3).map((k, j) => (
                          <span key={j} className="tag">{k}</span>
                        ))}
                      </td>
                      <td>{item.suggested_email || '-'}</td>
                      <td className="enrichment-preview-summary">
                        {item.operator_notes
                          ? item.operator_notes.length > 30
                            ? item.operator_notes.slice(0, 30) + '...'
                            : item.operator_notes
                          : '-'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <table className="data-table enrichment-preview-table">
                <thead>
                  <tr>
                    <th>Job ID</th>
                    <th>제안 키워드</th>
                    <th>메모</th>
                  </tr>
                </thead>
                <tbody>
                  {(preview as KeywordEntry[]).slice(0, 20).map((item, i) => (
                    <tr key={i}>
                      <td>{item.job_id}</td>
                      <td>
                        {item.suggested_keywords?.slice(0, 5).map((k, j) => (
                          <span key={j} className="tag">{k}</span>
                        ))}
                      </td>
                      <td className="enrichment-preview-summary">
                        {item.notes
                          ? item.notes.length > 50
                            ? item.notes.slice(0, 50) + '...'
                            : item.notes
                          : '-'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
          {preview.length > 20 && (
            <p className="enrichment-preview-more">... 외 {preview.length - 20}건</p>
          )}

          <div className="enrichment-import-actions">
            <button
              className="btn btn-primary"
              onClick={handleImport}
              disabled={isImporting}
            >
              {isImporting ? '가져오는 중...' : `${preview.length}건 가져오기 확인`}
            </button>
            <button
              className="btn btn-secondary"
              onClick={() => {
                resetState()
                if (fileRef.current) fileRef.current.value = ''
              }}
            >
              취소
            </button>
          </div>
        </div>
      )}

      {/* Result */}
      {result && (
        <div className="enrichment-result">
          <div className="enrichment-result-success">
            <strong>{result.imported}건</strong> 가져오기 완료
          </div>
          {result.errors.length > 0 && (
            <div className="enrichment-result-errors">
              <strong>{result.errors.length}건 오류:</strong>
              <ul>
                {result.errors.slice(0, 10).map((err, i) => (
                  <li key={i}>
                    {err.lead_id ? `Lead #${err.lead_id}` : `Job #${err.job_id}`}: {err.error}
                  </li>
                ))}
                {result.errors.length > 10 && <li>... 외 {result.errors.length - 10}건</li>}
              </ul>
            </div>
          )}
        </div>
      )}

      {/* Guide */}
      <div className="enrichment-guide">
        <h4>JSON 포맷 안내</h4>
        {importType === 'enrichments' ? (
          <pre className="enrichment-format-example">{`{
  "operator_id": "claude_code",
  "enrichments": [
    {
      "lead_id": 42,
      "business_summary": "비즈니스 요약",
      "descriptor_keywords": ["키워드1", "키워드2"],
      "content_topics": ["주제1", "주제2"],
      "trend_summary": "트렌드 요약",
      "suggested_email": "email@example.com",
      "operator_notes": "운영자 메모"
    }
  ]
}`}</pre>
        ) : (
          <pre className="enrichment-format-example">{`{
  "operator_id": "claude_code",
  "job_keywords": [
    {
      "job_id": 1,
      "suggested_keywords": ["키워드1", "키워드2"],
      "notes": "제안 사유"
    }
  ]
}`}</pre>
        )}
      </div>
    </div>
  )
}
