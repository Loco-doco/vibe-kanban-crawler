import { useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { createJob, parsePrompt, type ParsedPrompt } from '../api/jobs'
import {
  SUGGESTED_CATEGORIES,
  PLATFORM_OPTIONS,
  PARSE_CONFIDENCE_LABELS,
  CONFIDENCE_SIGNAL_LABELS,
} from '../types'
import type { CreateJobPayload, ParseConfidenceLevel } from '../types'

interface Props {
  onCreated?: () => void
}

const EFFORT_LEVELS = [
  { value: 1, label: '빠른 탐색', desc: 'YouTube 채널 정보만 확인. 빠르지만 이메일 확보율 낮음.', estimate: '약 2~5분' },
  { value: 2, label: '표준 탐색', desc: 'YouTube + 웹 검색으로 이메일 탐색. 대부분 추천.', estimate: '약 5~10분' },
  { value: 3, label: '심층 탐색', desc: 'YouTube + 웹 + 외부 사이트 전부 탐색. 시간 길지만 확보율 최고.', estimate: '약 10~20분' },
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

function buildPayload(form: SearchFormState): CreateJobPayload {
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

const PARSE_ERROR_TIPS = [
  '구체적인 카테고리 키워드를 포함해주세요 (예: 뷰티, 요리, 운동)',
  '구독자 범위를 명시해보세요 (예: 1만~10만)',
  '플랫폼 이름을 포함하면 더 정확합니다 (예: 유튜브)',
  '너무 짧거나 모호한 입력은 분석이 어렵습니다',
]

export default function CollectionSetupForm({ onCreated }: Props) {
  const [step, setStep] = useState<'form' | 'confirm'>('form')
  const [prompt, setPrompt] = useState('')
  const [form, setForm] = useState<SearchFormState>(defaultForm)
  const [parseError, setParseError] = useState('')
  const [newClue, setNewClue] = useState('')
  const [showAdvanced, setShowAdvanced] = useState(false)
  const [isParsing, setIsParsing] = useState(false)

  // B-5: Confidence tracking
  const [parseConfidence, setParseConfidence] = useState(0)
  const [confidenceLevel, setConfidenceLevel] = useState<ParseConfidenceLevel>('high')
  const [confidenceSignals, setConfidenceSignals] = useState<string[]>([])
  const [showComparison, setShowComparison] = useState(false)
  const [rawPrompt, setRawPrompt] = useState('')

  const queryClient = useQueryClient()

  const updateForm = (partial: Partial<SearchFormState>) => setForm(prev => ({ ...prev, ...partial }))

  // --- Mutations ---
  const parseMutation = useMutation({
    mutationFn: parsePrompt,
    onSuccess: (result: ParsedPrompt) => {
      setForm(prev => ({
        ...prev,
        target_persona: result.target_persona || prev.target_persona,
        search_clues: (result.search_clues || result.keywords || []).length > 0
          ? (result.search_clues || result.keywords || [])
          : prev.search_clues,
        categories: (result.categories || result.category_tags || []).length > 0
          ? (result.categories || result.category_tags || [])
          : prev.categories,
        primary_platform: (result.active_platforms || result.platform_hints || [])[0] || prev.primary_platform,
        exclude_conditions: result.exclude_conditions || prev.exclude_conditions,
        min_followers: result.subscriber_min ? String(result.subscriber_min) : prev.min_followers,
        max_followers: result.subscriber_max ? String(result.subscriber_max) : prev.max_followers,
      }))
      // B-5: Confidence
      setParseConfidence(result.parse_confidence ?? 0)
      setConfidenceLevel(result.confidence_level ?? 'medium')
      setConfidenceSignals(result.confidence_signals ?? [])
      setRawPrompt(result.raw_prompt || prompt)
      setShowComparison(result.confidence_level === 'low')
      setParseError('')
      setIsParsing(false)
    },
    onError: (err: Error) => {
      setParseError(err.message)
      setIsParsing(false)
    },
  })

  const createMutation = useMutation({
    mutationFn: createJob,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['jobs'] })
      setPrompt('')
      setForm(defaultForm)
      setParseConfidence(0)
      setConfidenceLevel('high')
      setConfidenceSignals([])
      setShowComparison(false)
      setRawPrompt('')
      setStep('form')
      onCreated?.()
    },
  })

  // --- Handlers ---
  const handleAnalyze = () => {
    if (!prompt.trim()) return
    setIsParsing(true)
    setParseError('')
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

  // B-5: Build parsed summary for comparison
  const buildParsedSummary = () => {
    const parts: string[] = []
    if (form.primary_platform) parts.push(`[플랫폼] ${PLATFORM_OPTIONS.find(p => p.value === form.primary_platform)?.label || form.primary_platform}`)
    if (form.search_clues.length > 0) parts.push(`[키워드] ${form.search_clues.join(', ')}`)
    if (form.categories.length > 0) parts.push(`[카테고리] ${form.categories.join(', ')}`)
    if (form.min_followers || form.max_followers) {
      const min = form.min_followers ? formatFollowers(form.min_followers) : '제한 없음'
      const max = form.max_followers ? formatFollowers(form.max_followers) : '제한 없음'
      parts.push(`[구독자] ${min} ~ ${max}`)
    }
    if (form.target_persona) parts.push(`[대상] ${form.target_persona}`)
    if (form.exclude_conditions) parts.push(`[제외] ${form.exclude_conditions}`)
    return parts.join('\n')
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
  const suggestedCategories = SUGGESTED_CATEGORIES.filter(c => !form.categories.includes(c))
  const isLowConfidence = confidenceLevel === 'low'
  const hasParsed = confidenceSignals.length > 0

  return (
    <div className="setup-form">

      {/* ==================== STEP: FORM (자연어 + 구조화 필터 통합) ==================== */}
      {step === 'form' && (
        <>
          {/* 자연어 입력 (선택) */}
          <div className="search-field-group">
            <label className="setup-label">
              자연어로 설명 <span className="setup-hint">(선택 — 아래 필터만으로도 시작 가능)</span>
              <textarea
                className="setup-textarea"
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                rows={2}
                placeholder="예: 뷰티 유튜버 중에서 구독자 5만~50만 사이, 스킨케어 리뷰 위주로 찾아줘"
                disabled={isParsing}
              />
            </label>
            {prompt.trim() && (
              <button
                type="button"
                className="btn btn-sm btn-secondary"
                onClick={handleAnalyze}
                disabled={isParsing}
                style={{ marginTop: 4 }}
              >
                {isParsing ? '해석 중...' : '자동 채우기'}
              </button>
            )}
          </div>

          {/* B-5: Parse error panel with retry guide */}
          {parseError && (
            <div className="parse-error-panel">
              <div className="parse-error-header">
                <span className="parse-error-icon">!</span>
                <strong>분석에 실패했습니다</strong>
              </div>
              <p className="parse-error-message">{parseError}</p>
              <div className="parse-error-tips">
                <span className="parse-error-tips-title">다시 시도하려면:</span>
                <ul className="parse-error-tips-list">
                  {PARSE_ERROR_TIPS.map((tip, i) => (
                    <li key={i}>{tip}</li>
                  ))}
                </ul>
              </div>
            </div>
          )}

          {/* B-5: Confidence badge + signals (shown after successful parse) */}
          {hasParsed && !parseError && (
            <div className="setup-section" style={{ paddingBottom: 12 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
                <span className={`confidence-badge confidence-${confidenceLevel}`}>
                  {PARSE_CONFIDENCE_LABELS[confidenceLevel]}
                  <span className="confidence-score">{Math.round(parseConfidence * 100)}%</span>
                </span>
                <button
                  type="button"
                  className="btn-text"
                  onClick={() => setShowComparison(!showComparison)}
                  style={{ fontSize: '0.75rem' }}
                >
                  {showComparison ? '비교 닫기' : '파싱 결과 비교'}
                </button>
              </div>
              <div className="confidence-signals">
                {['keywords_extracted', 'keywords_rich', 'category_detected', 'subscriber_range_detected', 'platform_detected', 'prompt_detailed'].map(sig => (
                  <span
                    key={sig}
                    className={`confidence-signal${confidenceSignals.includes(sig) ? ' active' : ''}`}
                  >
                    {confidenceSignals.includes(sig) ? '\u2713' : '\u2717'} {CONFIDENCE_SIGNAL_LABELS[sig] || sig}
                  </span>
                ))}
              </div>

              {/* B-5: Parse comparison (raw vs parsed) */}
              {showComparison && (
                <div className="parse-comparison" style={{ marginTop: 8 }}>
                  <div className="parse-comparison-col">
                    <span className="parse-comparison-label">입력 원문</span>
                    <div className="raw-prompt-box">{rawPrompt}</div>
                  </div>
                  <div className="parse-comparison-arrow">{'\u2192'}</div>
                  <div className="parse-comparison-col">
                    <span className="parse-comparison-label">추출된 조건</span>
                    <div className="parsed-prompt-box">{buildParsedSummary() || '(추출된 조건 없음)'}</div>
                  </div>
                </div>
              )}

              {/* B-5: Low confidence banner */}
              {isLowConfidence && (
                <div className="low-confidence-banner" style={{ marginTop: 10 }}>
                  <div className="low-confidence-header">
                    <strong>분석 신뢰도가 낮습니다</strong>
                  </div>
                  <p className="low-confidence-desc">
                    입력한 내용에서 충분한 검색 조건을 추출하지 못했습니다.
                    아래 필드를 직접 수정하거나, 더 구체적인 프롬프트로 다시 시도해주세요.
                  </p>
                </div>
              )}
            </div>
          )}

          <div className="search-form-divider">
            <span>탐색 조건</span>
          </div>

          {/* 검색 단서 */}
          <div className={`search-field-group${isLowConfidence && form.search_clues.length === 0 ? ' field-attention' : ''}`}>
            <span className="setup-label-inline">
              검색 키워드
              {isLowConfidence && form.search_clues.length === 0 && (
                <span className="field-attention-hint"> &mdash; 직접 추가해주세요</span>
              )}
            </span>
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
                    placeholder="+ 키워드 추가 (Enter)"
                    autoFocus={isLowConfidence && form.search_clues.length === 0}
                  />
                  {newClue.trim() && (
                    <button type="button" className="btn-small btn-view-results" onClick={addClue}>추가</button>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* 카테고리 */}
          <div className={`search-field-group${isLowConfidence && form.categories.length === 0 ? ' field-attention' : ''}`}>
            <span className="setup-label-inline">
              카테고리 / 니치
              {isLowConfidence && form.categories.length === 0 && (
                <span className="field-attention-hint"> &mdash; 카테고리를 선택하면 정확도가 높아집니다</span>
              )}
            </span>
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
            <div className="category-suggestions">
              {suggestedCategories.map(cat => (
                <button key={cat} type="button" className="category-chip" onClick={() => addCategory(cat)}>
                  {cat}
                </button>
              ))}
            </div>
          </div>

          {/* 플랫폼 + 팔로워 범위 + 수집 목표 (한 줄) */}
          <div className="search-field-group">
            <span className="setup-label-inline">플랫폼</span>
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

          <div className="search-field-group">
            <div className="setup-row-3">
              <label className="setup-label">
                최소 구독자
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
                최대 구독자
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
                  className="setup-input"
                  value={form.target_count}
                  onChange={e => updateForm({ target_count: e.target.value })}
                  placeholder="30"
                  min={1}
                />
                <span className="setup-help">이메일 보유 기준</span>
              </label>
            </div>
          </div>

          {/* 탐색 강도 */}
          <div className="search-field-group">
            <span className="setup-label-inline">탐색 강도</span>
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

          {/* 고급 옵션 */}
          <button type="button" className="btn-toggle" onClick={() => setShowAdvanced(!showAdvanced)}>
            <span className={`toggle-arrow${showAdvanced ? ' open' : ''}`}>{'\u25BC'}</span>
            고급 옵션
          </button>

          {showAdvanced && (
            <div className="setup-section" style={{ marginTop: 8 }}>
              <div className="search-field-group">
                <label className="setup-label">
                  대상 설명 <span className="setup-hint">(선택)</span>
                  <input type="text" className="setup-input" value={form.target_persona} onChange={e => updateForm({ target_persona: e.target.value })} placeholder="예: 뷰티 유튜버, 스킨케어 리뷰 위주" />
                </label>
              </div>
              <div className="search-field-group">
                <label className="setup-label">
                  필수 조건 <span className="setup-hint">(선택)</span>
                  <input type="text" className="setup-input" value={form.required_conditions} onChange={e => updateForm({ required_conditions: e.target.value })} placeholder="예: 강의 판매 경험이 있는 사람" />
                </label>
              </div>
              <div className="search-field-group">
                <label className="setup-label">
                  제외 조건 <span className="setup-hint">(선택)</span>
                  <input type="text" className="setup-input" value={form.exclude_conditions} onChange={e => updateForm({ exclude_conditions: e.target.value })} placeholder="예: 정치, 종교" />
                </label>
              </div>
              <div className="search-field-group">
                <label className="setup-label">
                  탐색 이름 <span className="setup-hint">(선택)</span>
                  <input type="text" className="setup-input" value={form.label} onChange={e => updateForm({ label: e.target.value })} placeholder="예: 3월 뷰티 유튜버 탐색" />
                </label>
              </div>
            </div>
          )}

          {/* Validation */}
          {validationErrors.length > 0 && (
            <div className="validation-errors">
              {validationErrors.map((err, i) => <span key={i} className="setup-error">{err}</span>)}
            </div>
          )}

          {/* CTA */}
          <div className="search-step-actions" style={{ marginTop: 16 }}>
            {canStart ? (
              <button type="button" className="btn btn-primary setup-submit" onClick={() => setStep('confirm')}>
                탐색 조건 확인
              </button>
            ) : (
              <p className="setup-hint" style={{ margin: 0 }}>검색 키워드, 카테고리, 또는 대상 설명 중 최소 1개를 입력하세요</p>
            )}
          </div>
        </>
      )}

      {/* ==================== STEP: CONFIRM ==================== */}
      {step === 'confirm' && (
        <>
          <div className="parsed-header">
            <h4 className="setup-section-title" style={{ margin: 0 }}>탐색 요약</h4>
            {/* B-5: Show confidence in confirm step too */}
            {hasParsed && (
              <span className={`confidence-badge confidence-${confidenceLevel}`}>
                {PARSE_CONFIDENCE_LABELS[confidenceLevel]}
                <span className="confidence-score">{Math.round(parseConfidence * 100)}%</span>
              </span>
            )}
          </div>

          <div className="search-summary-card">
            {form.target_persona && (
              <div className="crawl-preview-row">
                <span className="crawl-preview-label">대상</span>
                <span className="crawl-preview-value">{form.target_persona}</span>
              </div>
            )}
            <div className="crawl-preview-row">
              <span className="crawl-preview-label">검색 키워드</span>
              <span className="crawl-preview-value">{form.search_clues.length > 0 ? form.search_clues.join(', ') : '-'}</span>
            </div>
            {form.categories.length > 0 && (
              <div className="crawl-preview-row">
                <span className="crawl-preview-label">카테고리</span>
                <span className="crawl-preview-value">{form.categories.join(', ')}</span>
              </div>
            )}
            <div className="crawl-preview-row">
              <span className="crawl-preview-label">플랫폼</span>
              <span className="crawl-preview-value">{platformLabel}</span>
            </div>
            <div className="crawl-preview-row">
              <span className="crawl-preview-label">구독자 범위</span>
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
          </div>

          <p className="crawl-preview-note">
            위 조건으로 크리에이터를 검색하고 이메일을 수집합니다.
          </p>

          <div className="search-step-actions">
            <button type="button" className="btn btn-secondary" onClick={() => setStep('form')}>
              수정하기
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
      {createMutation.isError && (
        <p className="setup-error">
          탐색 생성 실패: {(createMutation.error as Error).message}
        </p>
      )}
    </div>
  )
}
