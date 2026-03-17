import { useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { createJob } from '../api/jobs'
import { PLATFORM_LABELS, SUGGESTED_CATEGORIES } from '../types'

const PLATFORMS = Object.entries(PLATFORM_LABELS).filter(([k]) => k !== 'unknown')

interface Props {
  onCreated?: () => void
}

export default function CollectionSetupForm({ onCreated }: Props) {
  const [label, setLabel] = useState('')
  const [selectedPlatforms, setSelectedPlatforms] = useState<string[]>([])
  const [customPlatform, setCustomPlatform] = useState('')
  const [selectedCategories, setSelectedCategories] = useState<string[]>([])
  const [customCategory, setCustomCategory] = useState('')
  const [subscriberMin, setSubscriberMin] = useState('')
  const [subscriberMax, setSubscriberMax] = useState('')
  const [targetCount, setTargetCount] = useState('')
  const [urls, setUrls] = useState('')
  const [showAdvanced, setShowAdvanced] = useState(false)
  const [maxRetries, setMaxRetries] = useState(3)
  const [delaySec, setDelaySec] = useState(2)
  const [maxDepth, setMaxDepth] = useState(3)

  const queryClient = useQueryClient()

  const mutation = useMutation({
    mutationFn: createJob,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['jobs'] })
      setLabel('')
      setSelectedPlatforms([])
      setCustomPlatform('')
      setSelectedCategories([])
      setCustomCategory('')
      setSubscriberMin('')
      setSubscriberMax('')
      setTargetCount('')
      setUrls('')
      onCreated?.()
    },
  })

  const togglePlatform = (key: string) => {
    setSelectedPlatforms((prev) =>
      prev.includes(key) ? prev.filter((p) => p !== key) : [...prev, key],
    )
  }

  const addCustomPlatform = () => {
    const val = customPlatform.trim().toLowerCase()
    if (!val || selectedPlatforms.includes(val)) return
    setSelectedPlatforms((prev) => [...prev, val])
    setCustomPlatform('')
  }

  const removePlatform = (key: string) => {
    setSelectedPlatforms((prev) => prev.filter((p) => p !== key))
  }

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

  const isPresetPlatform = (key: string) => PLATFORMS.some(([k]) => k === key)

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    const targets = urls
      .split('\n')
      .map((u) => u.trim())
      .filter(Boolean)
    if (targets.length === 0) return

    mutation.mutate({
      job: {
        label: label || undefined,
        targets,
        platform: selectedPlatforms.length > 0 ? selectedPlatforms.join(',') : undefined,
        category_tags: selectedCategories.length > 0 ? selectedCategories : undefined,
        target_count: targetCount ? Number(targetCount) : undefined,
        subscriber_min: subscriberMin ? Number(subscriberMin) : undefined,
        subscriber_max: subscriberMax ? Number(subscriberMax) : undefined,
        max_retries: maxRetries,
        delay_ms: delaySec * 1000,
        max_depth: maxDepth,
      },
    })
  }

  const urlCount = urls.split('\n').map((u) => u.trim()).filter(Boolean).length

  return (
    <form onSubmit={handleSubmit} className="setup-form">
      {/* Section 1: 기본 정보 */}
      <div className="setup-section">
        <h4 className="setup-section-title">기본 정보</h4>
        <label className="setup-label">
          탐색 이름
          <input
            type="text"
            className="setup-input"
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            placeholder="예: 3월 뷰티 유튜버 탐색"
          />
        </label>

        <div className="setup-label">
          플랫폼 <span className="setup-hint">(복수 선택 가능)</span>
          <div className="platform-selector">
            {PLATFORMS.map(([key, name]) => (
              <button
                key={key}
                type="button"
                className={`platform-chip${selectedPlatforms.includes(key) ? ' active' : ''}`}
                onClick={() => togglePlatform(key)}
              >
                {name}
              </button>
            ))}
            {/* Custom platform chips */}
            {selectedPlatforms.filter((p) => !isPresetPlatform(p)).map((p) => (
              <span key={p} className="platform-chip active custom">
                {p}
                <button type="button" className="chip-remove" onClick={() => removePlatform(p)}>&times;</button>
              </span>
            ))}
          </div>
          <div className="inline-add">
            <input
              type="text"
              className="setup-input"
              value={customPlatform}
              onChange={(e) => setCustomPlatform(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addCustomPlatform() } }}
              placeholder="다른 플랫폼 직접 입력 (예: liveklass.com)"
            />
            <button type="button" className="btn btn-secondary btn-sm" onClick={addCustomPlatform}>추가</button>
          </div>
        </div>
      </div>

      {/* Section 2: 타겟 조건 */}
      <div className="setup-section">
        <h4 className="setup-section-title">타겟 조건</h4>
        <span className="setup-section-desc">수집 조건을 설정하면 해당 기준에 맞게 탐색 범위를 제한합니다</span>

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
            {/* Custom category chips */}
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
        </div>

        <div className="setup-row-2">
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
            <span className="setup-help">수집 후 필터링 기준으로 사용됩니다</span>
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

        <label className="setup-label">
          수집 목표 수
          <input
            type="number"
            className="setup-input"
            value={targetCount}
            onChange={(e) => setTargetCount(e.target.value)}
            placeholder="예: 50"
            min={1}
          />
          <span className="setup-help">이 수만큼 리드를 확보하면 탐색을 자동 중단합니다</span>
        </label>
      </div>

      {/* Section 3: 수집 대상 URL */}
      <div className="setup-section">
        <h4 className="setup-section-title">
          수집 대상
          {urlCount > 0 && <span className="setup-url-count">{urlCount}개 URL</span>}
        </h4>
        <label className="setup-label">
          채널/프로필 URL
          <textarea
            className="setup-textarea"
            value={urls}
            onChange={(e) => setUrls(e.target.value)}
            rows={4}
            placeholder={'한 줄에 하나씩 입력\nhttps://youtube.com/@채널이름\nhttps://instagram.com/아이디\nhttps://liveklass.com/creator/이름'}
            required
          />
          <span className="setup-help">크롤링할 크리에이터의 채널 주소를 입력하세요</span>
        </label>
      </div>

      {/* Section 4: 고급 설정 */}
      <div className="setup-section">
        <button
          type="button"
          className="btn-toggle"
          onClick={() => setShowAdvanced(!showAdvanced)}
        >
          고급 설정 {showAdvanced ? '접기' : '펼치기'}
          <span className={`toggle-arrow ${showAdvanced ? 'open' : ''}`}>&#9662;</span>
        </button>
        {showAdvanced && (
          <div className="setup-row-3">
            <label className="setup-label">
              재시도 횟수
              <input type="number" className="setup-input" value={maxRetries} onChange={(e) => setMaxRetries(Number(e.target.value))} min={0} max={10} />
            </label>
            <label className="setup-label">
              대기 시간(초)
              <input type="number" className="setup-input" value={delaySec} onChange={(e) => setDelaySec(Number(e.target.value))} min={0} max={30} />
            </label>
            <label className="setup-label">
              탐색 깊이
              <input type="number" className="setup-input" value={maxDepth} onChange={(e) => setMaxDepth(Number(e.target.value))} min={1} max={5} />
            </label>
          </div>
        )}
      </div>

      <button type="submit" className="btn btn-primary setup-submit" disabled={mutation.isPending}>
        {mutation.isPending ? '탐색 생성 중...' : '탐색 시작'}
      </button>

      {mutation.isError && (
        <p className="setup-error">오류가 발생했습니다: {(mutation.error as Error).message}</p>
      )}
    </form>
  )
}
