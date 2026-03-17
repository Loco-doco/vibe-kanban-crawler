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

const EFFORT_LEVELS = [
  {
    value: 1,
    label: '\uBE60\uB978 \uD0D0\uC0C9',
    desc: 'YouTube \uCC44\uB110 \uC815\uBCF4\uB9CC \uD655\uC778\uD569\uB2C8\uB2E4. \uBE60\uB974\uC9C0\uB9CC \uC774\uBA54\uC77C\uC744 \uBABB \uCC3E\uC744 \uD655\uB960\uC774 \uB192\uC2B5\uB2C8\uB2E4.',
  },
  {
    value: 2,
    label: '\uD45C\uC900 \uD0D0\uC0C9',
    desc: 'YouTube + \uC6F9 \uAC80\uC0C9\uC744 \uD1B5\uD574 \uC774\uBA54\uC77C\uC744 \uCC3E\uC2B5\uB2C8\uB2E4. \uB300\uBD80\uBD84\uC758 \uACBD\uC6B0 \uC774 \uC124\uC815\uC744 \uCD94\uCC9C\uD569\uB2C8\uB2E4.',
  },
  {
    value: 3,
    label: '\uC2EC\uCE35 \uD0D0\uC0C9',
    desc: 'YouTube, \uC6F9 \uAC80\uC0C9, \uC678\uBD80 \uC0AC\uC774\uD2B8\uAE4C\uC9C0 \uBAA8\uB450 \uD0D0\uC0C9\uD569\uB2C8\uB2E4. \uC2DC\uAC04\uC774 \uB354 \uAC78\uB9AC\uC9C0\uB9CC \uC774\uBA54\uC77C \uD655\uBCF4\uC728\uC774 \uAC00\uC7A5 \uB192\uC2B5\uB2C8\uB2E4.',
  },
]

export default function CollectionSetupForm({ onCreated }: Props) {
  const [label, setLabel] = useState('')
  const [keywordsText, setKeywordsText] = useState('')
  const [discoveryPlatform, setDiscoveryPlatform] = useState('youtube')
  const [selectedCategories, setSelectedCategories] = useState<string[]>([])
  const [customCategory, setCustomCategory] = useState('')
  const [subscriberMin, setSubscriberMin] = useState('')
  const [subscriberMax, setSubscriberMax] = useState('')
  const [targetCount, setTargetCount] = useState('')
  const [searchEffort, setSearchEffort] = useState(2)
  const [showAdvanced, setShowAdvanced] = useState(false)
  const [maxRetries, setMaxRetries] = useState('3')
  const [delayMs, setDelayMs] = useState('2000')

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
      setSearchEffort(2)
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
        platform: discoveryPlatform,
        category_tags: selectedCategories.length > 0 ? selectedCategories : undefined,
        target_count: targetCount ? Number(targetCount) : 50,
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

      {/* 타겟 조건 */}
      <div className="setup-section">
        <h4 className="setup-section-title">타겟 조건</h4>
        <span className="setup-section-desc">검색된 크리에이터를 아래 조건으로 필터링합니다</span>

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
            <span className="setup-help">이 수 이상의 구독자를 가진 채널만 수집합니다</span>
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

      {/* 탐색 강도 & 고급 설정 */}
      <div className="setup-section">
        <h4 className="setup-section-title">탐색 강도</h4>
        <span className="setup-section-desc">이메일을 찾기 위해 얼마나 다양한 경로를 탐색할지 설정합니다</span>

        <div className="effort-selector" style={{ marginTop: 12 }}>
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

        <button
          type="button"
          className="btn-toggle"
          onClick={() => setShowAdvanced(!showAdvanced)}
          style={{ marginTop: 16 }}
        >
          <span className={`toggle-arrow${showAdvanced ? ' open' : ''}`}>{'\u25BC'}</span>
          세부 설정
        </button>

        {showAdvanced && (
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
              <span className="setup-help">
                페이지 로딩에 실패했을 때 다시 시도하는 횟수입니다. 서버 오류나 네트워크 불안정 시 자동으로 재시도합니다.
              </span>
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
              <span className="setup-help">
                각 페이지 요청 사이의 대기 시간입니다. 너무 짧으면 사이트에서 차단될 수 있고, 너무 길면 수집이 느려집니다.
              </span>
            </label>
          </div>
        )}
      </div>

      <button type="submit" className="btn btn-primary setup-submit" disabled={mutation.isPending || keywordCount === 0}>
        {mutation.isPending ? '탐색 생성 중...' : '크리에이터 탐색 시작'}
      </button>

      {mutation.isError && (
        <p className="setup-error">오류가 발생했습니다: {(mutation.error as Error).message}</p>
      )}
    </form>
  )
}
