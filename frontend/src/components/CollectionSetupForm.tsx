import { useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { createJob, parsePrompt, type ParsedPrompt } from '../api/jobs'
import { SUGGESTED_CATEGORIES } from '../types'

interface Props {
  onCreated?: () => void
}

const EFFORT_LEVELS = [
  {
    value: 1,
    label: '빠른 탐색',
    desc: 'YouTube 채널 정보만 확인. 빠르지만 이메일 확보율 낮음.',
    estimate: '약 2~5분',
  },
  {
    value: 2,
    label: '표준 탐색',
    desc: 'YouTube + 웹 검색으로 이메일 탐색. 대부분 추천.',
    estimate: '약 5~10분',
  },
  {
    value: 3,
    label: '심층 탐색',
    desc: 'YouTube + 웹 + 외부 사이트 전부 탐색. 시간 길지만 확보율 최고.',
    estimate: '약 10~20분',
  },
]

const EXAMPLE_PROMPTS = [
  '뷰티 유튜버 중에서 구독자 5만~50만 사이, 스킨케어 리뷰 위주로 찾아줘',
  '요리 레시피 채널인데 구독자 1만 이상인 곳',
  '자기계발, 독서 관련 유튜버',
  '부동산 투자, 재테크 관련 크리에이터 중 소규모 채널',
]

export default function CollectionSetupForm({ onCreated }: Props) {
  // Step management
  const [step, setStep] = useState<'input' | 'parsing' | 'confirm'>('input')

  // Input step
  const [prompt, setPrompt] = useState('')

  // Editable parsed fields (populated by parser, editable by user)
  const [keywords, setKeywords] = useState<string[]>([])
  const [categoryTags, setCategoryTags] = useState<string[]>([])
  const [subscriberMin, setSubscriberMin] = useState('')
  const [subscriberMax, setSubscriberMax] = useState('')
  const [newKeyword, setNewKeyword] = useState('')
  const [extraConditions, setExtraConditions] = useState<string | null>(null)

  // Search Intent Parser Recovery fields
  const [rawPrompt, setRawPrompt] = useState('')
  const [platformHints, setPlatformHints] = useState<Record<string, boolean>>({})
  const [semanticExpansions, setSemanticExpansions] = useState<Record<string, boolean>>({})

  // Settings
  const [targetCount, setTargetCount] = useState('30')
  const [searchEffort, setSearchEffort] = useState(2)
  const [label, setLabel] = useState('')
  const [showOptions, setShowOptions] = useState(false)
  const [maxRetries, setMaxRetries] = useState('3')
  const [delayMs, setDelayMs] = useState('2000')

  // Error
  const [parseError, setParseError] = useState('')

  const queryClient = useQueryClient()

  const parseMutation = useMutation({
    mutationFn: parsePrompt,
    onSuccess: (result: ParsedPrompt) => {
      // Populate editable fields from AI result
      setKeywords(result.keywords)
      setCategoryTags(result.category_tags)
      setSubscriberMin(result.subscriber_min ? String(result.subscriber_min) : '')
      setSubscriberMax(result.subscriber_max ? String(result.subscriber_max) : '')
      setExtraConditions(result.extra_conditions || null)
      // Search Intent Parser Recovery fields
      setRawPrompt(result.raw_prompt || '')
      // Platform hints: default ON
      const hints: Record<string, boolean> = {}
      for (const h of result.platform_hints || []) hints[h] = true
      setPlatformHints(hints)
      // Semantic expansions: default OFF
      const exps: Record<string, boolean> = {}
      for (const e of result.semantic_expansions || []) exps[e] = false
      setSemanticExpansions(exps)
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
      // Reset all
      setPrompt('')
      setKeywords([])
      setCategoryTags([])
      setSubscriberMin('')
      setSubscriberMax('')
      setNewKeyword('')
      setExtraConditions(null)
      setRawPrompt('')
      setPlatformHints({})
      setSemanticExpansions({})
      setTargetCount('30')
      setSearchEffort(2)
      setLabel('')
      setMaxRetries('3')
      setDelayMs('2000')
      setShowOptions(false)
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
    if (keywords.length === 0) return

    // Merge toggled-on semantic expansions into keywords
    const activeExpansions = Object.entries(semanticExpansions)
      .filter(([, on]) => on)
      .map(([kw]) => kw)
    const mergedKeywords = [...keywords, ...activeExpansions.filter(e => !keywords.includes(e))]

    // Determine platform from active platform hints (first active, or default 'youtube')
    const activePlatforms = Object.entries(platformHints)
      .filter(([, on]) => on)
      .map(([p]) => p)
    const platform = activePlatforms.length > 0 ? activePlatforms[0] : 'youtube'

    createMutation.mutate({
      job: {
        label: label || undefined,
        mode: 'discovery',
        targets: ['discovery'],
        keywords: mergedKeywords,
        platform,
        category_tags: categoryTags.length > 0 ? categoryTags : undefined,
        target_count: targetCount ? Number(targetCount) : 30,
        subscriber_min: subscriberMin ? Number(subscriberMin) : undefined,
        subscriber_max: subscriberMax ? Number(subscriberMax) : undefined,
        extra_conditions: extraConditions || undefined,
        max_retries: Number(maxRetries) || 3,
        delay_ms: Number(delayMs) || 2000,
        max_depth: searchEffort,
      },
    })
  }

  const handleBack = () => {
    setStep('input')
  }

  // Keyword management
  const removeKeyword = (index: number) => {
    setKeywords(keywords.filter((_, i) => i !== index))
  }

  const addKeyword = () => {
    const kw = newKeyword.trim()
    if (kw && !keywords.includes(kw) && keywords.length < 5) {
      setKeywords([...keywords, kw])
      setNewKeyword('')
    }
  }

  const handleKeywordKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault()
      addKeyword()
    }
  }

  // Category toggle
  const toggleCategory = (cat: string) => {
    setCategoryTags(
      categoryTags.includes(cat)
        ? categoryTags.filter((c) => c !== cat)
        : [...categoryTags, cat]
    )
  }

  // Platform hint toggle
  const togglePlatformHint = (platform: string) => {
    setPlatformHints(prev => ({ ...prev, [platform]: !prev[platform] }))
  }

  // Semantic expansion toggle
  const toggleExpansion = (expansion: string) => {
    setSemanticExpansions(prev => ({ ...prev, [expansion]: !prev[expansion] }))
  }

  const PLATFORM_DISPLAY: Record<string, string> = {
    youtube: '유튜브',
    instagram: '인스타그램',
    liveklass: '라이브클래스',
    classu: '클래수',
    class101: 'Class101',
    taling: '탈잉',
    classting: '클래스팅',
  }

  const formatSubscribers = (val: string) => {
    const num = Number(val)
    if (!num) return ''
    if (num >= 10000) return `${(num / 10000).toFixed(num % 10000 === 0 ? 0 : 1)}만명`
    if (num >= 1000) return `${(num / 1000).toFixed(num % 1000 === 0 ? 0 : 1)}천명`
    return `${num}명`
  }

  const isProcessing = parseMutation.isPending || createMutation.isPending
  const effortLabel = EFFORT_LEVELS.find((l) => l.value === searchEffort)

  // Validation
  const validationErrors: string[] = []
  if (step === 'confirm') {
    if (keywords.length === 0) validationErrors.push('최소 1개의 키워드가 필요합니다')
    if (keywords.length > 5) validationErrors.push('키워드는 최대 5개까지 가능합니다')
    if (subscriberMin && subscriberMax && Number(subscriberMin) > Number(subscriberMax)) {
      validationErrors.push('최소 구독자가 최대 구독자보다 클 수 없습니다')
    }
    if (targetCount && Number(targetCount) < 1) validationErrors.push('수집 목표는 1건 이상이어야 합니다')
    if (!targetCount) validationErrors.push('수집 목표를 입력해주세요')
  }
  const hasErrors = validationErrors.length > 0

  return (
    <form onSubmit={handleAnalyze} className="setup-form">
      {/* Step 1: 프롬프트 입력 */}
      <div className="setup-section">
        <label className="setup-label">
          어떤 크리에이터를 찾고 싶나요?
          <textarea
            className="setup-textarea"
            value={prompt}
            onChange={(e) => { setPrompt(e.target.value); if (step === 'confirm') setStep('input') }}
            rows={3}
            placeholder="예: 뷰티 유튜버 중에서 구독자 5만~50만 사이, 스킨케어 리뷰 위주로 찾아줘"
            disabled={step === 'parsing'}
          />
        </label>
        {step === 'input' && !prompt && (
          <div className="prompt-examples">
            {EXAMPLE_PROMPTS.map((ex, i) => (
              <button key={i} type="button" className="prompt-example-chip" onClick={() => setPrompt(ex)}>
                {ex}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* AI 분석 버튼 (input 단계에서만) */}
      {step !== 'confirm' && (
        <button
          type="submit"
          className="btn btn-primary setup-submit"
          disabled={isProcessing || !prompt.trim()}
          style={{ marginBottom: 16 }}
        >
          {step === 'parsing' ? '분석 중...' : '검색 조건 분석'}
        </button>
      )}

      {/* Step 2: 편집 가능한 분석 결과 + 설정 */}
      {step === 'confirm' && (
        <>
          {/* 분석 결과 헤더 */}
          <div className="parsed-header">
            <h4 className="setup-section-title" style={{ margin: 0 }}>
              검색 조건 분석 결과
            </h4>
            <button type="button" className="btn-text" onClick={handleBack}>
              다시 입력
            </button>
          </div>

          {/* 원문 프롬프트 */}
          {rawPrompt && (
            <div className="setup-section">
              <span className="setup-label-inline">원문</span>
              <div className="raw-prompt-box">{rawPrompt}</div>
            </div>
          )}

          {/* 감지된 플랫폼 힌트 (toggleable, default ON) */}
          {Object.keys(platformHints).length > 0 && (
            <div className="setup-section">
              <span className="setup-label-inline">감지된 플랫폼 <span className="setup-hint">(클릭하여 ON/OFF)</span></span>
              <div className="editable-chips">
                {Object.entries(platformHints).map(([platform, active]) => (
                  <button
                    key={platform}
                    type="button"
                    className={`category-chip toggle-chip${active ? ' active' : ''}`}
                    onClick={() => togglePlatformHint(platform)}
                  >
                    {PLATFORM_DISPLAY[platform] || platform}
                    <span className="chip-toggle-indicator">{active ? 'ON' : 'OFF'}</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* 편집 가능: 검색 키워드 */}
          <div className="setup-section">
            <span className="setup-label-inline">검색 키워드</span>
            <div className="editable-chips">
              {keywords.map((kw, i) => (
                <span key={i} className="category-chip active editable-chip">
                  {kw}
                  <button type="button" className="chip-remove" onClick={() => removeKeyword(i)} title="삭제">&times;</button>
                </span>
              ))}
              {keywords.length < 5 && (
                <div className="chip-add-wrap">
                  <input
                    type="text"
                    className="chip-add-input"
                    value={newKeyword}
                    onChange={(e) => setNewKeyword(e.target.value)}
                    onKeyDown={handleKeywordKeyDown}
                    placeholder="+ 키워드 추가"
                  />
                  {newKeyword.trim() && (
                    <button type="button" className="chip-add-btn" onClick={addKeyword}>추가</button>
                  )}
                </div>
              )}
              {keywords.length >= 5 && (
                <span className="setup-help" style={{ alignSelf: 'center' }}>최대 5개</span>
              )}
            </div>
            {keywords.length === 0 && (
              <span className="setup-error" style={{ marginTop: 4 }}>최소 1개의 키워드가 필요합니다</span>
            )}
          </div>

          {/* 편집 가능: 카테고리 */}
          <div className="setup-section">
            <span className="setup-label-inline">카테고리 태그 <span className="setup-hint">(선택)</span></span>
            <div className="category-selector">
              {SUGGESTED_CATEGORIES.map((cat) => (
                <button
                  key={cat}
                  type="button"
                  className={`category-chip${categoryTags.includes(cat) ? ' active' : ''}`}
                  onClick={() => toggleCategory(cat)}
                >
                  {cat}
                </button>
              ))}
            </div>
          </div>

          {/* 연관 키워드 제안 (toggleable, default OFF) */}
          {Object.keys(semanticExpansions).length > 0 && (
            <div className="setup-section">
              <span className="setup-label-inline">연관 키워드 제안 <span className="setup-hint">(OFF 기본, 클릭하여 추가)</span></span>
              <div className="editable-chips">
                {Object.entries(semanticExpansions).map(([expansion, active]) => (
                  <button
                    key={expansion}
                    type="button"
                    className={`category-chip toggle-chip${active ? ' active' : ''}`}
                    onClick={() => toggleExpansion(expansion)}
                  >
                    {expansion}
                    <span className="chip-toggle-indicator">{active ? 'ON' : 'OFF'}</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* AI가 추출한 비즈니스 조건 (검색 키워드에 반영 불가능한 조건) */}
          {extraConditions && (
            <div className="setup-section">
              <span className="setup-label-inline">리뷰 참고 조건</span>
              <div className="extra-conditions-box">
                <p className="extra-conditions-text">{extraConditions}</p>
                <span className="extra-conditions-hint">
                  이 조건은 검색 키워드에 직접 반영되지 않습니다. 수집 후 리드를 리뷰할 때 참고 기준으로 활용됩니다.
                </span>
              </div>
            </div>
          )}

          {/* 편집 가능: 구독자 범위 + 수집 목표 */}
          <div className="setup-section">
            <div className="setup-row-3">
              <label className="setup-label">
                최소 구독자
                <input
                  type="number"
                  className={`setup-input${subscriberMin && subscriberMax && Number(subscriberMin) > Number(subscriberMax) ? ' input-error' : ''}`}
                  value={subscriberMin}
                  onChange={(e) => setSubscriberMin(e.target.value)}
                  placeholder="제한 없음"
                  min={0}
                />
                {subscriberMin && <span className="setup-help">{formatSubscribers(subscriberMin)}</span>}
              </label>
              <label className="setup-label">
                최대 구독자
                <input
                  type="number"
                  className={`setup-input${subscriberMin && subscriberMax && Number(subscriberMin) > Number(subscriberMax) ? ' input-error' : ''}`}
                  value={subscriberMax}
                  onChange={(e) => setSubscriberMax(e.target.value)}
                  placeholder="제한 없음"
                  min={0}
                />
                {subscriberMax && <span className="setup-help">{formatSubscribers(subscriberMax)}</span>}
              </label>
              <label className="setup-label">
                수집 목표
                <input
                  type="number"
                  className={`setup-input${!targetCount || Number(targetCount) < 1 ? ' input-error' : ''}`}
                  value={targetCount}
                  onChange={(e) => setTargetCount(e.target.value)}
                  placeholder="30"
                  min={1}
                />
                <span className="setup-help">이메일 보유 리드 기준</span>
              </label>
            </div>
            {subscriberMin && subscriberMax && Number(subscriberMin) > Number(subscriberMax) && (
              <span className="setup-error" style={{ marginTop: 4 }}>최소 구독자가 최대 구독자보다 클 수 없습니다</span>
            )}
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
                  <div className="effort-option-top">
                    <span className="effort-option-label">{level.label}</span>
                    <span className="effort-option-estimate">{level.estimate}</span>
                  </div>
                  <span className="effort-option-desc">{level.desc}</span>
                </button>
              ))}
            </div>
          </div>

          {/* 추가 옵션 */}
          <button type="button" className="btn-toggle" onClick={() => setShowOptions(!showOptions)}>
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

          {/* 탐색 요약 프리뷰 */}
          <div className="crawl-preview">
            <h4 className="crawl-preview-title">탐색 요약</h4>
            <div className="crawl-preview-body">
              <div className="crawl-preview-row">
                <span className="crawl-preview-label">검색 키워드</span>
                <span className="crawl-preview-value">
                  {keywords.join(', ') || '-'}
                  {Object.entries(semanticExpansions).some(([, on]) => on) && (
                    <span className="crawl-preview-extra">
                      {' + '}
                      {Object.entries(semanticExpansions).filter(([, on]) => on).map(([kw]) => kw).join(', ')}
                    </span>
                  )}
                </span>
              </div>
              {Object.keys(platformHints).length > 0 && (
                <div className="crawl-preview-row">
                  <span className="crawl-preview-label">플랫폼</span>
                  <span className="crawl-preview-value">
                    {Object.entries(platformHints)
                      .filter(([, on]) => on)
                      .map(([p]) => PLATFORM_DISPLAY[p] || p)
                      .join(', ') || 'youtube'}
                  </span>
                </div>
              )}
              {categoryTags.length > 0 && (
                <div className="crawl-preview-row">
                  <span className="crawl-preview-label">카테고리</span>
                  <span className="crawl-preview-value">{categoryTags.join(', ')}</span>
                </div>
              )}
              <div className="crawl-preview-row">
                <span className="crawl-preview-label">구독자 범위</span>
                <span className="crawl-preview-value">
                  {subscriberMin ? formatSubscribers(subscriberMin) : '제한 없음'}
                  {' ~ '}
                  {subscriberMax ? formatSubscribers(subscriberMax) : '제한 없음'}
                </span>
              </div>
              <div className="crawl-preview-row">
                <span className="crawl-preview-label">수집 목표</span>
                <span className="crawl-preview-value">{targetCount || 30}건 (이메일 보유 리드)</span>
              </div>
              <div className="crawl-preview-row">
                <span className="crawl-preview-label">탐색 방식</span>
                <span className="crawl-preview-value">{effortLabel?.label} ({effortLabel?.estimate})</span>
              </div>
              {extraConditions && (
                <div className="crawl-preview-row">
                  <span className="crawl-preview-label">리뷰 참고 조건</span>
                  <span className="crawl-preview-value">{extraConditions}</span>
                </div>
              )}
              {label && (
                <div className="crawl-preview-row">
                  <span className="crawl-preview-label">탐색 이름</span>
                  <span className="crawl-preview-value">{label}</span>
                </div>
              )}
            </div>
            <p className="crawl-preview-note">
              위 조건으로 YouTube에서 크리에이터를 검색하고, 이메일을 수집합니다.
              목표 수량 달성 또는 모든 소스 탐색 시 자동 종료됩니다.
            </p>
          </div>

          {/* Validation errors */}
          {hasErrors && (
            <div className="validation-errors">
              {validationErrors.map((err, i) => (
                <span key={i} className="setup-error">{err}</span>
              ))}
            </div>
          )}

          {/* 탐색 시작 버튼 */}
          <button
            type="button"
            className="btn btn-primary setup-submit"
            disabled={isProcessing || hasErrors}
            onClick={handleStartCrawl}
          >
            {createMutation.isPending ? '탐색 생성 중...' : '크리에이터 탐색 시작'}
          </button>
        </>
      )}

      {/* Errors */}
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
