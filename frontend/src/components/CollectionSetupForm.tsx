import { useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { createJob, parsePrompt, type ParsedPrompt } from '../api/jobs'
import { SUGGESTED_CATEGORIES, PLATFORM_OPTIONS } from '../types'
import type { CreateJobPayload } from '../types'

interface Props {
  onCreated?: () => void
}

const EFFORT_LEVELS = [
  { value: 1, label: '빠른 탐색', desc: 'YouTube 채널 정보만 확인. 빠르지만 이메일 확보율 낮음.', estimate: '약 2~5분' },
  { value: 2, label: '표준 탐색', desc: 'YouTube + 웹 검색으로 이메일 탐색. 대부분 추천.', estimate: '약 5~10분' },
  { value: 3, label: '심층 탐색', desc: 'YouTube + 웹 + 외부 사이트 전부 탐색. 시간 길지만 확보율 최고.', estimate: '약 10~20분' },
]

const EXAMPLE_PROMPTS = [
  '뷰티 유튜버 중에서 구독자 5만~50만 사이, 스킨케어 리뷰 위주로 찾아줘',
  '재테크/주식 크리에이터 중 유튜브에서 활동하고 강의 판매 경험이 있는 사람',
  '클래스101이나 라이브클래스에서 강의하는 교육 크리에이터를 찾고 싶어',
]

interface SearchFormState {
  target_persona: string
  categories: string[]
  primary_platform: string
  search_clues: string[]
  required_conditions: string
  exclude_conditions: string
  min_followers: string
  max_followers: string
  target_count: string
  search_effort: number
  label: string
  max_retries: string
  delay_ms: string
}

const defaultForm: SearchFormState = {
  target_persona: '',
  categories: [],
  primary_platform: 'youtube',
  search_clues: [],
  required_conditions: '',
  exclude_conditions: '',
  min_followers: '',
  max_followers: '',
  target_count: '30',
  search_effort: 2,
  label: '',
  max_retries: '3',
  delay_ms: '2000',
}

type Step = 'input' | 'parsing' | 'edit' | 'confirm'

function buildPayload(form: SearchFormState): CreateJobPayload {
  // Build runtime keywords: search_clues > target_persona > categories
  let keywords = [...form.search_clues]
  if (keywords.length === 0 && form.target_persona.trim()) {
    keywords = [form.target_persona.trim()]
  }
  if (keywords.length === 0 && form.categories.length > 0) {
    keywords = [...form.categories]
  }

  const extraParts: string[] = []
  if (form.target_persona.trim()) extraParts.push(`대상: ${form.target_persona.trim()}`)
  if (form.required_conditions.trim()) extraParts.push(`필수: ${form.required_conditions.trim()}`)
  if (form.exclude_conditions.trim()) extraParts.push(`제외: ${form.exclude_conditions.trim()}`)

  return {
    job: {
      label: form.label || undefined,
      mode: 'discovery',
      targets: ['discovery'],
      keywords,
      platform: form.primary_platform || 'youtube',
      category_tags: form.categories.length > 0 ? form.categories : undefined,
      target_count: Number(form.target_count) || 30,
      subscriber_min: form.min_followers ? Number(form.min_followers) : undefined,
      subscriber_max: form.max_followers ? Number(form.max_followers) : undefined,
      extra_conditions: extraParts.length > 0 ? extraParts.join(' | ') : undefined,
      max_retries: Number(form.max_retries) || 3,
      delay_ms: Number(form.delay_ms) || 2000,
      max_depth: form.search_effort,
    },
  }
}

function formatFollowers(val: string) {
  const num = Number(val)
  if (!num) return ''
  if (num >= 10000) return `${(num / 10000).toFixed(num % 10000 === 0 ? 0 : 1)}만명`
  if (num >= 1000) return `${(num / 1000).toFixed(num % 1000 === 0 ? 0 : 1)}천명`
  return `${num}명`
}

export default function CollectionSetupForm({ onCreated }: Props) {
  const [step, setStep] = useState<Step>('input')
  const [prompt, setPrompt] = useState('')
  const [form, setForm] = useState<SearchFormState>(defaultForm)
  const [parseError, setParseError] = useState('')
  const [newClue, setNewClue] = useState('')
  const [showOptions, setShowOptions] = useState(false)
  const queryClient = useQueryClient()

  const updateForm = (partial: Partial<SearchFormState>) => setForm(prev => ({ ...prev, ...partial }))

  // --- Mutations ---
  const parseMutation = useMutation({
    mutationFn: parsePrompt,
    onSuccess: (result: ParsedPrompt) => {
      setForm({
        ...defaultForm,
        target_persona: result.target_persona || '',
        search_clues: result.search_clues || result.keywords || [],
        categories: result.categories || result.category_tags || [],
        primary_platform: (result.active_platforms || result.platform_hints || [])[0] || 'youtube',
        exclude_conditions: result.exclude_conditions || '',
        min_followers: result.subscriber_min ? String(result.subscriber_min) : '',
        max_followers: result.subscriber_max ? String(result.subscriber_max) : '',
      })
      setParseError('')
      setStep('edit')
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
      setForm(defaultForm)
      setStep('input')
      onCreated?.()
    },
  })

  // --- Handlers ---
  const handleAnalyze = (e: React.FormEvent) => {
    e.preventDefault()
    if (!prompt.trim()) return
    setStep('parsing')
    parseMutation.mutate(prompt.trim())
  }

  const handleStartCrawl = () => {
    if (!canStart) return
    createMutation.mutate(buildPayload(form))
  }

  const addClue = () => {
    const val = newClue.trim()
    if (val && form.search_clues.length < 10 && !form.search_clues.includes(val)) {
      updateForm({ search_clues: [...form.search_clues, val] })
      setNewClue('')
    }
  }

  const removeClue = (index: number) => {
    updateForm({ search_clues: form.search_clues.filter((_, i) => i !== index) })
  }

  const addCategory = (cat: string) => {
    if (!form.categories.includes(cat)) {
      updateForm({ categories: [...form.categories, cat] })
    }
  }

  const removeCategory = (cat: string) => {
    updateForm({ categories: form.categories.filter(c => c !== cat) })
  }

  // --- Validation ---
  const canStart = form.search_clues.length > 0 || form.target_persona.trim() !== '' || form.categories.length > 0
  const validationErrors: string[] = []
  if (form.min_followers && form.max_followers && Number(form.min_followers) > Number(form.max_followers)) {
    validationErrors.push('최소 팔로워가 최대 팔로워보다 클 수 없습니다')
  }
  if (form.target_count && Number(form.target_count) < 1) {
    validationErrors.push('수집 목표는 1건 이상이어야 합니다')
  }

  const isProcessing = parseMutation.isPending || createMutation.isPending
  const effortLabel = EFFORT_LEVELS.find(l => l.value === form.search_effort)
  const platformLabel = PLATFORM_OPTIONS.find(p => p.value === form.primary_platform)?.label || form.primary_platform

  // --- Suggested categories (not yet selected) ---
  const suggestedCategories = SUGGESTED_CATEGORIES.filter(c => !form.categories.includes(c))

  return (
    <form onSubmit={handleAnalyze} className="setup-form">

      {/* ==================== STEP: INPUT ==================== */}
      {(step === 'input' || step === 'parsing') && (
        <>
          <div className="setup-section">
            <label className="setup-label">
              어떤 크리에이터를 찾고 싶나요?
              <textarea
                className="setup-textarea"
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
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

          <button
            type="submit"
            className="btn btn-primary setup-submit"
            disabled={isProcessing || !prompt.trim()}
            style={{ marginBottom: 16 }}
          >
            {step === 'parsing' ? '조건 해석 중...' : '조건 해석하기'}
          </button>
        </>
      )}

      {/* ==================== STEP: EDIT ==================== */}
      {step === 'edit' && (
        <>
          <div className="parsed-header">
            <h4 className="setup-section-title" style={{ margin: 0 }}>탐색 조건 편집</h4>
            <div style={{ display: 'flex', gap: 8 }}>
              <button type="button" className="btn-text" onClick={() => setStep('input')}>
                원문 다시 작성
              </button>
              <button type="button" className="btn-text" onClick={() => { setStep('parsing'); parseMutation.mutate(prompt.trim()) }}>
                다시 해석하기
              </button>
            </div>
          </div>

          {/* 대상 페르소나 */}
          <div className="search-field-group">
            <label className="setup-label">
              대상
              <input
                type="text"
                className="setup-input"
                value={form.target_persona}
                onChange={e => updateForm({ target_persona: e.target.value })}
                placeholder="예: 뷰티 유튜버, 스킨케어 리뷰 위주"
              />
              <span className="setup-hint">어떤 유형의 크리에이터를 찾는지 설명하세요</span>
            </label>
          </div>

          {/* 검색 단서 */}
          <div className="search-field-group">
            <span className="setup-label-inline">검색 단서</span>
            <div className="search-clue-list">
              {form.search_clues.map((clue, i) => (
                <div key={i} className="search-clue-item">
                  <input
                    type="text"
                    className="setup-input"
                    value={clue}
                    onChange={e => {
                      const updated = [...form.search_clues]
                      updated[i] = e.target.value
                      updateForm({ search_clues: updated })
                    }}
                  />
                  <button type="button" className="btn-small btn-cancel" onClick={() => removeClue(i)}>삭제</button>
                </div>
              ))}
              {form.search_clues.length < 10 && (
                <div className="search-clue-item">
                  <input
                    type="text"
                    className="setup-input"
                    value={newClue}
                    onChange={e => setNewClue(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addClue() } }}
                    placeholder="+ 단서 추가"
                  />
                  {newClue.trim() && (
                    <button type="button" className="btn-small btn-view-results" onClick={addClue}>추가</button>
                  )}
                </div>
              )}
            </div>
            <span className="setup-hint">탐색에 사용할 검색어를 입력하세요</span>
          </div>

          {/* 카테고리 */}
          <div className="search-field-group">
            <span className="setup-label-inline">카테고리</span>
            {form.categories.length > 0 && (
              <div className="category-selected-tags">
                {form.categories.map(cat => (
                  <span key={cat} className="category-chip active">
                    {cat}
                    <button type="button" className="chip-remove" onClick={() => removeCategory(cat)}>&times;</button>
                  </span>
                ))}
              </div>
            )}
            {suggestedCategories.length > 0 && (
              <div className="category-suggestions">
                {suggestedCategories.slice(0, 10).map(cat => (
                  <button key={cat} type="button" className="category-chip" onClick={() => addCategory(cat)}>
                    {cat}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* 주요 플랫폼 */}
          <div className="search-field-group">
            <span className="setup-label-inline">주요 플랫폼</span>
            <div className="platform-selector">
              {PLATFORM_OPTIONS.map(p => (
                <button
                  key={p.value}
                  type="button"
                  className={`category-chip${form.primary_platform === p.value ? ' active' : ''}`}
                  onClick={() => updateForm({ primary_platform: p.value })}
                >
                  {p.label}
                </button>
              ))}
            </div>
          </div>

          {/* 팔로워 범위 + 수집 목표 */}
          <div className="search-field-group">
            <div className="setup-row-3">
              <label className="setup-label">
                최소 팔로워
                <input
                  type="number"
                  className={`setup-input${form.min_followers && form.max_followers && Number(form.min_followers) > Number(form.max_followers) ? ' input-error' : ''}`}
                  value={form.min_followers}
                  onChange={e => updateForm({ min_followers: e.target.value })}
                  placeholder="제한 없음"
                  min={0}
                />
                {form.min_followers && <span className="setup-help">{formatFollowers(form.min_followers)}</span>}
              </label>
              <label className="setup-label">
                최대 팔로워
                <input
                  type="number"
                  className={`setup-input${form.min_followers && form.max_followers && Number(form.min_followers) > Number(form.max_followers) ? ' input-error' : ''}`}
                  value={form.max_followers}
                  onChange={e => updateForm({ max_followers: e.target.value })}
                  placeholder="제한 없음"
                  min={0}
                />
                {form.max_followers && <span className="setup-help">{formatFollowers(form.max_followers)}</span>}
              </label>
              <label className="setup-label">
                수집 목표
                <input
                  type="number"
                  className={`setup-input${form.target_count && Number(form.target_count) < 1 ? ' input-error' : ''}`}
                  value={form.target_count}
                  onChange={e => updateForm({ target_count: e.target.value })}
                  placeholder="30"
                  min={1}
                />
                <span className="setup-help">이메일 보유 리드 기준</span>
              </label>
            </div>
          </div>

          {/* 필수 조건 */}
          <div className="search-field-group">
            <label className="setup-label">
              필수 조건 <span className="setup-hint">(선택)</span>
              <input
                type="text"
                className="setup-input"
                value={form.required_conditions}
                onChange={e => updateForm({ required_conditions: e.target.value })}
                placeholder="예: 강의 판매 경험이 있는 사람"
              />
            </label>
          </div>

          {/* 제외 조건 */}
          <div className="search-field-group">
            <label className="setup-label">
              제외 조건 <span className="setup-hint">(선택)</span>
              <input
                type="text"
                className="setup-input"
                value={form.exclude_conditions}
                onChange={e => updateForm({ exclude_conditions: e.target.value })}
                placeholder="예: 정치, 종교"
              />
            </label>
          </div>

          {/* 탐색 강도 */}
          <div className="search-field-group">
            <h4 className="setup-section-title">탐색 강도</h4>
            <div className="effort-selector">
              {EFFORT_LEVELS.map(level => (
                <button
                  key={level.value}
                  type="button"
                  className={`effort-option${form.search_effort === level.value ? ' active' : ''}`}
                  onClick={() => updateForm({ search_effort: level.value })}
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
                <input type="text" className="setup-input" value={form.label} onChange={e => updateForm({ label: e.target.value })} placeholder="예: 3월 뷰티 유튜버 탐색" />
              </label>
              <div className="setup-row-2" style={{ marginTop: 12 }}>
                <label className="setup-label">
                  재시도 횟수
                  <input type="number" className="setup-input" value={form.max_retries} onChange={e => updateForm({ max_retries: e.target.value })} min={1} max={10} />
                </label>
                <label className="setup-label">
                  요청 대기 시간
                  <div className="input-with-unit">
                    <input type="number" className="setup-input" value={Math.round(Number(form.delay_ms) / 1000)} onChange={e => updateForm({ delay_ms: String(Number(e.target.value) * 1000) })} min={1} max={10} />
                    <span className="input-unit">초</span>
                  </div>
                </label>
              </div>
            </div>
          )}

          {/* Validation errors */}
          {validationErrors.length > 0 && (
            <div className="validation-errors">
              {validationErrors.map((err, i) => <span key={i} className="setup-error">{err}</span>)}
            </div>
          )}

          {/* 요약 확인 */}
          <div className="search-step-actions" style={{ marginTop: 16 }}>
            <button
              type="button"
              className="btn btn-primary setup-submit"
              disabled={!canStart}
              onClick={() => setStep('confirm')}
            >
              요약 확인
            </button>
          </div>
        </>
      )}

      {/* ==================== STEP: CONFIRM ==================== */}
      {step === 'confirm' && (
        <>
          <div className="parsed-header">
            <h4 className="setup-section-title" style={{ margin: 0 }}>탐색 요약</h4>
          </div>

          <div className="search-summary-card">
            {form.target_persona && (
              <div className="crawl-preview-row">
                <span className="crawl-preview-label">대상</span>
                <span className="crawl-preview-value">{form.target_persona}</span>
              </div>
            )}
            <div className="crawl-preview-row">
              <span className="crawl-preview-label">검색 단서</span>
              <span className="crawl-preview-value">{form.search_clues.length > 0 ? form.search_clues.join(', ') : '-'}</span>
            </div>
            {form.categories.length > 0 && (
              <div className="crawl-preview-row">
                <span className="crawl-preview-label">카테고리</span>
                <span className="crawl-preview-value">{form.categories.join(', ')}</span>
              </div>
            )}
            <div className="crawl-preview-row">
              <span className="crawl-preview-label">주요 플랫폼</span>
              <span className="crawl-preview-value">{platformLabel}</span>
            </div>
            <div className="crawl-preview-row">
              <span className="crawl-preview-label">팔로워 범위</span>
              <span className="crawl-preview-value">
                {form.min_followers ? formatFollowers(form.min_followers) : '제한 없음'}
                {' ~ '}
                {form.max_followers ? formatFollowers(form.max_followers) : '제한 없음'}
              </span>
            </div>
            <div className="crawl-preview-row">
              <span className="crawl-preview-label">수집 목표</span>
              <span className="crawl-preview-value">{form.target_count || 30}건</span>
            </div>
            <div className="crawl-preview-row">
              <span className="crawl-preview-label">탐색 강도</span>
              <span className="crawl-preview-value">{effortLabel?.label} ({effortLabel?.estimate})</span>
            </div>
            {form.required_conditions && (
              <div className="crawl-preview-row">
                <span className="crawl-preview-label">필수 조건</span>
                <span className="crawl-preview-value">{form.required_conditions}</span>
              </div>
            )}
            {form.exclude_conditions && (
              <div className="crawl-preview-row">
                <span className="crawl-preview-label">제외 조건</span>
                <span className="crawl-preview-value">{form.exclude_conditions}</span>
              </div>
            )}
            {form.label && (
              <div className="crawl-preview-row">
                <span className="crawl-preview-label">탐색 이름</span>
                <span className="crawl-preview-value">{form.label}</span>
              </div>
            )}
          </div>

          <p className="crawl-preview-note">
            위 조건으로 크리에이터를 검색하고 이메일을 수집합니다.
            목표 수량 달성 또는 모든 소스 탐색 시 자동 종료됩니다.
          </p>

          {!canStart && (
            <p className="setup-error">검색 단서, 대상, 카테고리 중 최소 1개를 입력해야 합니다.</p>
          )}

          <div className="search-step-actions">
            <button type="button" className="btn btn-secondary" onClick={() => setStep('edit')}>
              수정하기
            </button>
            <button type="button" className="btn-text" onClick={() => setStep('input')}>
              원문 다시 작성
            </button>
            <button
              type="button"
              className="btn btn-primary"
              disabled={isProcessing || !canStart || validationErrors.length > 0}
              onClick={handleStartCrawl}
            >
              {createMutation.isPending ? '탐색 생성 중...' : '탐색 시작'}
            </button>
          </div>
        </>
      )}

      {/* ==================== ERRORS ==================== */}
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
