import { useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { createJob } from '../api/jobs'
import { SUGGESTED_CATEGORIES } from '../types'

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

export default function CollectionSetupForm({ onCreated }: Props) {
  const [keywordsText, setKeywordsText] = useState('')
  const [targetCount, setTargetCount] = useState('30')
  const [searchEffort, setSearchEffort] = useState(2)
  const [showOptions, setShowOptions] = useState(false)
  const [label, setLabel] = useState('')
  const [selectedCategories, setSelectedCategories] = useState<string[]>([])
  const [customCategory, setCustomCategory] = useState('')
  const [subscriberMin, setSubscriberMin] = useState('')
  const [subscriberMax, setSubscriberMax] = useState('')
  const [maxRetries, setMaxRetries] = useState('3')
  const [delayMs, setDelayMs] = useState('2000')

  const queryClient = useQueryClient()

  const mutation = useMutation({
    mutationFn: createJob,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['jobs'] })
      setKeywordsText('')
      setTargetCount('30')
      setSearchEffort(2)
      setLabel('')
      setSelectedCategories([])
      setCustomCategory('')
      setSubscriberMin('')
      setSubscriberMax('')
      setMaxRetries('3')
      setDelayMs('2000')
      onCreated?.()
    },
  })

  const toggleCategory = (cat: string) => {
    setSelectedCategories((prev) =>
      prev.includes(cat) ? prev.filter((c) => c !== cat) : [...prev, cat],
    )
  }

  const addCustomCategory = () => {
    const val = customCategory.trim()
    if (!val || selectedCategories.includes(val)) return
    setSelectedCategories((prev) => [...prev, val])
    setCustomCategory('')
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    const keywords = keywordsText.split(',').map((k) => k.trim()).filter(Boolean)
    if (keywords.length === 0) return

    mutation.mutate({
      job: {
        label: label || undefined,
        mode: 'discovery',
        targets: ['discovery'],
        keywords,
        platform: 'youtube',
        category_tags: selectedCategories.length > 0 ? selectedCategories : undefined,
        target_count: targetCount ? Number(targetCount) : 30,
        subscriber_min: subscriberMin ? Number(subscriberMin) : undefined,
        subscriber_max: subscriberMax ? Number(subscriberMax) : undefined,
        max_retries: Number(maxRetries) || 3,
        delay_ms: Number(delayMs) || 2000,
        max_depth: searchEffort,
      },
    })
  }

  const keywordCount = keywordsText.split(',').map((k) => k.trim()).filter(Boolean).length

  return (
    <form onSubmit={handleSubmit} className="setup-form">
      <div className="mode-desc">
        검색 키워드를 입력하면 YouTube에서 크리에이터를 자동으로 찾아 연락처를 수집합니다
      </div>

      {/* 필수 입력 */}
      <div className="setup-section">
        <label className="setup-label">
          검색 키워드
          {keywordCount > 0 && <span className="setup-url-count">{keywordCount}개 키워드</span>}
          <textarea
            className="setup-textarea"
            value={keywordsText}
            onChange={(e) => setKeywordsText(e.target.value)}
            rows={3}
            placeholder={'쉼표로 구분하여 입력\n예: 뷰티 유튜버, 화장품 리뷰, 스킨케어 추천'}
            required
          />
          <span className="setup-help">쉼표(,)로 여러 키워드를 구분하세요. 각 키워드로 크리에이터를 검색합니다</span>
        </label>

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

      {/* 추가 옵션 (접을 수 있는 섹션) */}
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

          <div className="setup-label" style={{ marginTop: 12 }}>
            카테고리 <span className="setup-hint">(복수 선택 가능)</span>
            <div className="category-selector">
              {SUGGESTED_CATEGORIES.map((cat) => (
                <button
                  key={cat}
                  type="button"
                  className={`category-chip${selectedCategories.includes(cat) ? ' active' : ''}`}
                  onClick={() => toggleCategory(cat)}
                >
                  {cat}
                </button>
              ))}
              {selectedCategories.filter((c) => !SUGGESTED_CATEGORIES.includes(c)).map((c) => (
                <span key={c} className="category-chip active custom">
                  {c}
                  <button type="button" className="chip-remove" onClick={() => toggleCategory(c)}>&times;</button>
                </span>
              ))}
            </div>
            <div className="inline-add">
              <input
                type="text"
                className="setup-input"
                value={customCategory}
                onChange={(e) => setCustomCategory(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addCustomCategory() } }}
                placeholder="직접 입력 (예: 반려동물, 게임)"
              />
              <button type="button" className="btn btn-secondary btn-sm" onClick={addCustomCategory}>추가</button>
            </div>
            <span className="setup-help">카테고리를 선택하면 키워드와 조합하여 더 정확한 검색을 합니다</span>
          </div>

          <div className="setup-row-2" style={{ marginTop: 12 }}>
            <label className="setup-label">
              최소 구독자
              <input
                type="number"
                className="setup-input"
                value={subscriberMin}
                onChange={(e) => setSubscriberMin(e.target.value)}
                placeholder="예: 1000"
                min={0}
              />
            </label>
            <label className="setup-label">
              최대 구독자
              <input
                type="number"
                className="setup-input"
                value={subscriberMax}
                onChange={(e) => setSubscriberMax(e.target.value)}
                placeholder="예: 100000"
                min={0}
              />
            </label>
          </div>

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

      <button type="submit" className="btn btn-primary setup-submit" disabled={mutation.isPending || keywordCount === 0}>
        {mutation.isPending ? '탐색 생성 중...' : '크리에이터 탐색 시작'}
      </button>

      {mutation.isError && (
        <p className="setup-error">오류가 발생했습니다: {(mutation.error as Error).message}</p>
      )}
    </form>
  )
}
