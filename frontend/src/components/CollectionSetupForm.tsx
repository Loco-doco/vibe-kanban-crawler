import { useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { createJob, parsePrompt, type ParsedPrompt } from '../api/jobs'

interface Props {
  onCreated?: () => void
}

const EFFORT_LEVELS = [
  {
    value: 1,
    label: '빠른 탐색',
    desc: 'YouTube 채널 정보만 확인합니다. 빠르지만 이메일을 못 찾을 확률이 높습니다.',
  },
  {
    value: 2,
    label: '표준 탐색',
    desc: 'YouTube + 웹 검색을 통해 이메일을 찾습니다. 대부분의 경우 이 설정을 추천합니다.',
  },
  {
    value: 3,
    label: '심층 탐색',
    desc: 'YouTube, 웹 검색, 외부 사이트까지 모두 탐색합니다. 시간이 더 걸리지만 이메일 확보율이 가장 높습니다.',
  },
]

const EXAMPLE_PROMPTS = [
  '뷰티 유튜버 중에서 구독자 5만~50만 사이, 스킨케어 리뷰 위주로 찾아줘',
  '요리 레시피 채널인데 구독자 1만 이상인 곳',
  '자기계발, 독서 관련 유튜버',
  '부동산 투자, 재테크 관련 크리에이터 중 소규모 채널',
]

export default function CollectionSetupForm({ onCreated }: Props) {
  const [prompt, setPrompt] = useState('')
  const [targetCount, setTargetCount] = useState('30')
  const [searchEffort, setSearchEffort] = useState(2)
  const [showOptions, setShowOptions] = useState(false)
  const [label, setLabel] = useState('')
  const [maxRetries, setMaxRetries] = useState('3')
  const [delayMs, setDelayMs] = useState('2000')
  const [parsedResult, setParsedResult] = useState<ParsedPrompt | null>(null)
  const [parseError, setParseError] = useState('')
  const [step, setStep] = useState<'input' | 'parsing' | 'confirm'>('input')

  const queryClient = useQueryClient()

  const parseMutation = useMutation({
    mutationFn: parsePrompt,
    onSuccess: (result) => {
      setParsedResult(result)
      setParseError('')
      setStep('confirm')
    },
    onError: (err: Error) => {
      setParseError(err.message)
      setStep('input')
    },
  })

  const createMutation = useMutation({
    mutationFn: createJob,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['jobs'] })
      setPrompt('')
      setTargetCount('30')
      setSearchEffort(2)
      setLabel('')
      setMaxRetries('3')
      setDelayMs('2000')
      setParsedResult(null)
      setStep('input')
      onCreated?.()
    },
  })

  const handleAnalyze = (e: React.FormEvent) => {
    e.preventDefault()
    if (!prompt.trim()) return
    setStep('parsing')
    parseMutation.mutate(prompt.trim())
  }

  const handleStartCrawl = () => {
    if (!parsedResult) return

    createMutation.mutate({
      job: {
        label: label || undefined,
        mode: 'discovery',
        targets: ['discovery'],
        keywords: parsedResult.keywords,
        platform: 'youtube',
        category_tags: parsedResult.category_tags.length > 0 ? parsedResult.category_tags : undefined,
        target_count: targetCount ? Number(targetCount) : 30,
        subscriber_min: parsedResult.subscriber_min ?? undefined,
        subscriber_max: parsedResult.subscriber_max ?? undefined,
        max_retries: Number(maxRetries) || 3,
        delay_ms: Number(delayMs) || 2000,
        max_depth: searchEffort,
      },
    })
  }

  const handleBack = () => {
    setParsedResult(null)
    setStep('input')
  }

  const isProcessing = parseMutation.isPending || createMutation.isPending

  return (
    <form onSubmit={handleAnalyze} className="setup-form">
      <div className="mode-desc">
        찾고 싶은 크리에이터를 자유롭게 설명하면, AI가 분석해서 자동으로 검색합니다
      </div>

      {/* 프롬프트 입력 */}
      <div className="setup-section">
        <label className="setup-label">
          어떤 크리에이터를 찾고 싶나요?
          <textarea
            className="setup-textarea"
            value={prompt}
            onChange={(e) => { setPrompt(e.target.value); if (step === 'confirm') setStep('input') }}
            rows={4}
            placeholder="예: 뷰티 유튜버 중에서 구독자 5만~50만 사이, 스킨케어 리뷰 위주로 찾아줘"
            disabled={step === 'parsing'}
          />
        </label>
        {step === 'input' && !prompt && (
          <div className="prompt-examples">
            {EXAMPLE_PROMPTS.map((ex, i) => (
              <button
                key={i}
                type="button"
                className="prompt-example-chip"
                onClick={() => setPrompt(ex)}
              >
                {ex}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* AI 분석 결과 */}
      {step === 'confirm' && parsedResult && (
        <div className="setup-section parsed-result">
          <h4 className="setup-section-title">AI 분석 결과</h4>
          <div className="parsed-tags">
            <div className="parsed-row">
              <span className="parsed-label">검색 키워드</span>
              <div className="parsed-values">
                {parsedResult.keywords.map((kw, i) => (
                  <span key={i} className="category-chip active">{kw}</span>
                ))}
              </div>
            </div>
            {parsedResult.category_tags.length > 0 && (
              <div className="parsed-row">
                <span className="parsed-label">카테고리</span>
                <div className="parsed-values">
                  {parsedResult.category_tags.map((cat, i) => (
                    <span key={i} className="category-chip">{cat}</span>
                  ))}
                </div>
              </div>
            )}
            {(parsedResult.subscriber_min || parsedResult.subscriber_max) && (
              <div className="parsed-row">
                <span className="parsed-label">구독자 범위</span>
                <span className="parsed-value-text">
                  {parsedResult.subscriber_min ? `${(parsedResult.subscriber_min).toLocaleString()}명` : '제한 없음'}
                  {' ~ '}
                  {parsedResult.subscriber_max ? `${(parsedResult.subscriber_max).toLocaleString()}명` : '제한 없음'}
                </span>
              </div>
            )}
          </div>
          <button type="button" className="btn-text" onClick={handleBack}>
            다시 입력하기
          </button>
        </div>
      )}

      {/* 수집 설정 */}
      <div className="setup-section">
        <div className="setup-row-2">
          <label className="setup-label">
            수집 목표 수
            <input
              type="number"
              className="setup-input"
              value={targetCount}
              onChange={(e) => setTargetCount(e.target.value)}
              placeholder="30"
              min={1}
            />
            <span className="setup-help">이 수만큼 리드를 확보하면 탐색을 자동 중단합니다</span>
          </label>
        </div>
      </div>

      {/* 탐색 강도 */}
      <div className="setup-section">
        <h4 className="setup-section-title">탐색 강도</h4>
        <div className="effort-selector">
          {EFFORT_LEVELS.map((level) => (
            <button
              key={level.value}
              type="button"
              className={`effort-option${searchEffort === level.value ? ' active' : ''}`}
              onClick={() => setSearchEffort(level.value)}
            >
              <span className="effort-option-label">{level.label}</span>
              <span className="effort-option-desc">{level.desc}</span>
            </button>
          ))}
        </div>
      </div>

      {/* 추가 옵션 */}
      <button
        type="button"
        className="btn-toggle"
        onClick={() => setShowOptions(!showOptions)}
      >
        <span className={`toggle-arrow${showOptions ? ' open' : ''}`}>{'\u25BC'}</span>
        추가 옵션
      </button>

      {showOptions && (
        <div className="setup-section" style={{ marginTop: 8 }}>
          <label className="setup-label">
            탐색 이름 <span className="setup-hint">(선택)</span>
            <input
              type="text"
              className="setup-input"
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              placeholder="예: 3월 뷰티 유튜버 탐색"
            />
          </label>
          <div className="setup-row-2" style={{ marginTop: 12 }}>
            <label className="setup-label">
              재시도 횟수
              <input
                type="number"
                className="setup-input"
                value={maxRetries}
                onChange={(e) => setMaxRetries(e.target.value)}
                min={1}
                max={10}
              />
            </label>
            <label className="setup-label">
              요청 대기 시간
              <div className="input-with-unit">
                <input
                  type="number"
                  className="setup-input"
                  value={Math.round(Number(delayMs) / 1000)}
                  onChange={(e) => setDelayMs(String(Number(e.target.value) * 1000))}
                  min={1}
                  max={10}
                />
                <span className="input-unit">초</span>
              </div>
            </label>
          </div>
        </div>
      )}

      {/* 액션 버튼 */}
      {step === 'confirm' && parsedResult ? (
        <button
          type="button"
          className="btn btn-primary setup-submit"
          disabled={isProcessing}
          onClick={handleStartCrawl}
        >
          {createMutation.isPending ? '탐색 생성 중...' : '크리에이터 탐색 시작'}
        </button>
      ) : (
        <button
          type="submit"
          className="btn btn-primary setup-submit"
          disabled={isProcessing || !prompt.trim()}
        >
          {step === 'parsing' ? 'AI 분석 중...' : 'AI로 검색 조건 분석'}
        </button>
      )}

      {(parseError || parseMutation.isError) && (
        <p className="setup-error">
          {parseError || (parseMutation.error as Error).message}
        </p>
      )}
      {createMutation.isError && (
        <p className="setup-error">
          탐색 생성 실패: {(createMutation.error as Error).message}
        </p>
      )}
    </form>
  )
}
