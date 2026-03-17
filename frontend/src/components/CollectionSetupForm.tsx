import { useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { createJob } from '../api/jobs'
import { PLATFORM_LABELS, SUGGESTED_CATEGORIES } from '../types'

const PLATFORMS = Object.entries(PLATFORM_LABELS).filter(([k]) => k !== 'unknown')

const DISCOVERY_PLATFORMS: Record<string, boolean> = {
  youtube: true,
}

interface Props {
  onCreated?: () => void
}

export default function CollectionSetupForm({ onCreated }: Props) {
  const [label, setLabel] = useState('')

  // Discovery mode state (primary)
  const [keywordsText, setKeywordsText] = useState('')
  const [discoveryPlatform, setDiscoveryPlatform] = useState('youtube')

  // URL mode state (inside advanced)
  const [useUrlMode, setUseUrlMode] = useState(false)
  const [urls, setUrls] = useState('')

  // Shared state
  const [selectedCategories, setSelectedCategories] = useState<string[]>([])
  const [customCategory, setCustomCategory] = useState('')
  const [subscriberMin, setSubscriberMin] = useState('')
  const [subscriberMax, setSubscriberMax] = useState('')
  const [targetCount, setTargetCount] = useState('')
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
      setKeywordsText('')
      setSelectedCategories([])
      setCustomCategory('')
      setSubscriberMin('')
      setSubscriberMax('')
      setTargetCount('')
      setUrls('')
      setUseUrlMode(false)
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

    if (useUrlMode) {
      const targets = urls.split('\n').map((u) => u.trim()).filter(Boolean)
      if (targets.length === 0) return

      mutation.mutate({
        job: {
          label: label || undefined,
          mode: 'url',
          targets,
          category_tags: selectedCategories.length > 0 ? selectedCategories : undefined,
          target_count: targetCount ? Number(targetCount) : undefined,
          subscriber_min: subscriberMin ? Number(subscriberMin) : undefined,
          subscriber_max: subscriberMax ? Number(subscriberMax) : undefined,
          max_retries: maxRetries,
          delay_ms: delaySec * 1000,
          max_depth: maxDepth,
        },
      })
    } else {
      const keywords = keywordsText.split(',').map((k) => k.trim()).filter(Boolean)
      if (keywords.length === 0) return

      mutation.mutate({
        job: {
          label: label || undefined,
          mode: 'discovery',
          targets: ['discovery'],
          keywords,
          platform: discoveryPlatform,
          category_tags: selectedCategories.length > 0 ? selectedCategories : undefined,
          target_count: targetCount ? Number(targetCount) : 50,
          subscriber_min: subscriberMin ? Number(subscriberMin) : undefined,
          subscriber_max: subscriberMax ? Number(subscriberMax) : undefined,
          max_retries: maxRetries,
          delay_ms: delaySec * 1000,
          max_depth: maxDepth,
        },
      })
    }
  }

  const urlCount = urls.split('\n').map((u) => u.trim()).filter(Boolean).length
  const keywordCount = keywordsText.split(',').map((k) => k.trim()).filter(Boolean).length

  const canSubmit = useUrlMode ? urlCount > 0 : keywordCount > 0

  return (
    <form onSubmit={handleSubmit} className="setup-form">
      <div className="mode-desc">
        검색 키워드를 입력하면 해당 키워드로 크리에이터를 자동으로 찾아 연락처를 수집합니다
      </div>

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
      </div>

      {/* Section 2: 검색 설정 */}
      {!useUrlMode && (
        <div className="setup-section">
          <h4 className="setup-section-title">검색 설정</h4>

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

          <div className="setup-label">
            검색 플랫폼
            <div className="platform-selector">
              {PLATFORMS.map(([key, name]) => {
                const supported = DISCOVERY_PLATFORMS[key]
                return (
                  <button
                    key={key}
                    type="button"
                    className={`platform-chip${discoveryPlatform === key ? ' active' : ''}${!supported ? ' chip-disabled' : ''}`}
                    onClick={() => supported && setDiscoveryPlatform(key)}
                  >
                    {name}
                    {!supported && <span className="chip-soon">준비 중</span>}
                  </button>
                )
              })}
            </div>
          </div>
        </div>
      )}

      {/* Shared: 타겟 조건 */}
      <div className="setup-section">
        <h4 className="setup-section-title">타겟 조건</h4>
        <span className="setup-section-desc">
          {useUrlMode
            ? '수집 후 필터링 기준으로 사용됩니다'
            : '검색된 크리에이터를 아래 조건으로 필터링합니다'}
        </span>

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
            {!useUrlMode && (
              <span className="setup-help">이 수 이상의 구독자를 가진 채널만 수집합니다</span>
            )}
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
            placeholder="예: 30"
            min={1}
          />
          <span className="setup-help">이 수만큼 리드를 확보하면 탐색을 자동 중단합니다</span>
        </label>
      </div>

      {/* Section: 고급 설정 */}
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
          <>
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

            {/* URL 직접 입력 (고급) */}
            <div style={{ marginTop: 16, paddingTop: 16, borderTop: '1px solid var(--gray-100)' }}>
              <label className="setup-label" style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <input
                  type="checkbox"
                  checked={useUrlMode}
                  onChange={(e) => setUseUrlMode(e.target.checked)}
                />
                <span>URL 직접 입력 모드로 전환</span>
                <span className="setup-hint">(이미 알고 있는 채널 URL이 있을 때)</span>
              </label>
              {useUrlMode && (
                <label className="setup-label" style={{ marginTop: 8 }}>
                  채널/프로필 URL
                  {urlCount > 0 && <span className="setup-url-count">{urlCount}개 URL</span>}
                  <textarea
                    className="setup-textarea"
                    value={urls}
                    onChange={(e) => setUrls(e.target.value)}
                    rows={4}
                    placeholder={'한 줄에 하나씩 입력\nhttps://youtube.com/@채널이름\nhttps://instagram.com/아이디'}
                    required
                  />
                </label>
              )}
            </div>
          </>
        )}
      </div>

      <button type="submit" className="btn btn-primary setup-submit" disabled={mutation.isPending || !canSubmit}>
        {mutation.isPending
          ? '탐색 생성 중...'
          : useUrlMode
            ? '채널 수집 시작'
            : '크리에이터 탐색 시작'}
      </button>

      {mutation.isError && (
        <p className="setup-error">오류가 발생했습니다: {(mutation.error as Error).message}</p>
      )}
    </form>
  )
}
