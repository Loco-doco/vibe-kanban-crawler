import { useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { createJob } from '../api/jobs'
import { SUGGESTED_CATEGORIES } from '../types'
import type { CreateJobPayload } from '../types'

const PLATFORMS = [
  { id: 'youtube', label: '유튜브', icon: '▶', desc: 'YouTube 크리에이터' },
  { id: 'instagram', label: '인스타그램', icon: '📷', desc: 'Instagram 인플루언서' },
  { id: 'class101', label: 'Class101', icon: '🎓', desc: 'Class101 강사' },
  { id: 'liveklass', label: '라이브클래스', icon: '📺', desc: '라이브클래스 강사' },
]

export default function JobSetupPage() {
  const navigate = useNavigate()
  const queryClient = useQueryClient()

  const [label, setLabel] = useState('')
  const [platform, setPlatform] = useState('')
  const [subscriberMin, setSubscriberMin] = useState('')
  const [subscriberMax, setSubscriberMax] = useState('')
  const [categoryTags, setCategoryTags] = useState<string[]>([])
  const [customTag, setCustomTag] = useState('')
  const [targetCount, setTargetCount] = useState('50')
  const [extraConditions, setExtraConditions] = useState('')
  const [showAdvanced, setShowAdvanced] = useState(false)
  const [maxRetries, setMaxRetries] = useState(3)
  const [delayMs, setDelayMs] = useState(2000)
  const [maxDepth, setMaxDepth] = useState(3)
  const [error, setError] = useState('')

  const mutation = useMutation({
    mutationFn: (payload: CreateJobPayload) => createJob(payload),
    onSuccess: (job) => {
      queryClient.invalidateQueries({ queryKey: ['jobs'] })
      navigate(`/jobs/${job.id}`)
    },
    onError: () => setError('수집 작업을 시작하지 못했습니다. 다시 시도해 주세요.'),
  })

  const toggleCategory = (tag: string) => {
    setCategoryTags((prev) =>
      prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag]
    )
  }

  const addCustomTag = () => {
    const trimmed = customTag.trim()
    if (trimmed && !categoryTags.includes(trimmed)) {
      setCategoryTags((prev) => [...prev, trimmed])
      setCustomTag('')
    }
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    setError('')

    if (!platform) {
      setError('수집할 플랫폼을 선택해 주세요.')
      return
    }

    const targets = platform ? [`platform:${platform}`] : []

    const payload: CreateJobPayload = {
      job: {
        label: label || undefined,
        targets,
        platform,
        category_tags: categoryTags.length > 0 ? categoryTags : undefined,
        target_count: parseInt(targetCount) || 50,
        subscriber_min: subscriberMin ? parseInt(subscriberMin) : undefined,
        subscriber_max: subscriberMax ? parseInt(subscriberMax) : undefined,
        extra_conditions: extraConditions || undefined,
        max_retries: maxRetries,
        delay_ms: delayMs,
        max_depth: maxDepth,
      },
    }

    mutation.mutate(payload)
  }

  return (
    <div className="setup-page">
      <div className="setup-container">
        <div className="setup-header">
          <h2>새 수집 작업 설정</h2>
          <p>수집하고 싶은 크리에이터 조건을 설정하세요. 조건에 맞는 크리에이터를 자동으로 찾아드립니다.</p>
        </div>

        <form onSubmit={handleSubmit} className="setup-form">
          {/* 작업 이름 */}
          <div className="form-section">
            <label className="form-label">작업 이름 (선택)</label>
            <p className="form-hint">나중에 구분하기 쉽도록 이름을 지어주세요</p>
            <input
              type="text"
              className="form-input"
              placeholder="예: 재테크 유튜버 1차 수집"
              value={label}
              onChange={(e) => setLabel(e.target.value)}
            />
          </div>

          {/* 플랫폼 선택 */}
          <div className="form-section">
            <label className="form-label">
              플랫폼 선택 <span className="required">*</span>
            </label>
            <p className="form-hint">어떤 플랫폼에서 크리에이터를 찾을까요?</p>
            <div className="platform-grid">
              {PLATFORMS.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  className={`platform-card ${platform === p.id ? 'selected' : ''}`}
                  onClick={() => setPlatform(p.id)}
                >
                  <span className="platform-icon">{p.icon}</span>
                  <span className="platform-name">{p.label}</span>
                  <span className="platform-desc">{p.desc}</span>
                </button>
              ))}
            </div>
          </div>

          {/* 구독자 범위 */}
          <div className="form-section">
            <label className="form-label">구독자/팔로워 수 범위 (선택)</label>
            <p className="form-hint">원하는 규모의 크리에이터만 수집합니다</p>
            <div className="range-inputs">
              <div className="range-field">
                <label>최소</label>
                <input
                  type="text"
                  className="form-input"
                  placeholder="예: 1000"
                  value={subscriberMin}
                  onChange={(e) => setSubscriberMin(e.target.value.replace(/[^0-9]/g, ''))}
                />
                <span className="range-unit">명 이상</span>
              </div>
              <span className="range-separator">~</span>
              <div className="range-field">
                <label>최대</label>
                <input
                  type="text"
                  className="form-input"
                  placeholder="예: 100000"
                  value={subscriberMax}
                  onChange={(e) => setSubscriberMax(e.target.value.replace(/[^0-9]/g, ''))}
                />
                <span className="range-unit">명 이하</span>
              </div>
            </div>
          </div>

          {/* 카테고리 */}
          <div className="form-section">
            <label className="form-label">관심 카테고리 (선택)</label>
            <p className="form-hint">수집할 크리에이터의 분야를 선택하세요. 여러 개 선택 가능합니다.</p>
            <div className="category-tags">
              {SUGGESTED_CATEGORIES.map((tag) => (
                <button
                  key={tag}
                  type="button"
                  className={`tag-btn ${categoryTags.includes(tag) ? 'selected' : ''}`}
                  onClick={() => toggleCategory(tag)}
                >
                  {tag}
                </button>
              ))}
            </div>
            <div className="custom-tag-input">
              <input
                type="text"
                className="form-input"
                placeholder="직접 입력..."
                value={customTag}
                onChange={(e) => setCustomTag(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault()
                    addCustomTag()
                  }
                }}
              />
              <button type="button" className="btn-secondary" onClick={addCustomTag}>
                추가
              </button>
            </div>
          </div>

          {/* 목표 수집 수 */}
          <div className="form-section">
            <label className="form-label">
              목표 수집 수 <span className="required">*</span>
            </label>
            <p className="form-hint">
              이 숫자만큼 크리에이터를 찾을 때까지 수집이 계속됩니다
            </p>
            <input
              type="number"
              className="form-input form-input-short"
              min="1"
              max="10000"
              value={targetCount}
              onChange={(e) => setTargetCount(e.target.value)}
            />
            <span className="input-suffix">명</span>
          </div>

          {/* 추가 조건 */}
          <div className="form-section">
            <label className="form-label">추가 조건 (선택)</label>
            <p className="form-hint">특별히 원하는 조건이 있다면 자유롭게 적어주세요</p>
            <textarea
              className="form-textarea"
              placeholder="예: 유튜브 채널 운영하면서 스마트스토어도 같이 하는 사업자, 최근 3개월 이내 영상 업로드한 채널만"
              value={extraConditions}
              onChange={(e) => setExtraConditions(e.target.value)}
              rows={3}
            />
          </div>

          {/* 고급 설정 */}
          <div className="form-section">
            <button
              type="button"
              className="advanced-toggle"
              onClick={() => setShowAdvanced(!showAdvanced)}
            >
              상세 설정 {showAdvanced ? '▲' : '▼'}
            </button>
            {showAdvanced && (
              <div className="advanced-settings">
                <div className="advanced-row">
                  <label>재시도 횟수</label>
                  <input
                    type="number"
                    min={0}
                    max={10}
                    value={maxRetries}
                    onChange={(e) => setMaxRetries(Number(e.target.value))}
                    className="form-input form-input-tiny"
                  />
                </div>
                <div className="advanced-row">
                  <label>요청 간 대기 시간 (초)</label>
                  <input
                    type="number"
                    min={0}
                    max={30}
                    value={delayMs / 1000}
                    onChange={(e) => setDelayMs(Number(e.target.value) * 1000)}
                    className="form-input form-input-tiny"
                  />
                </div>
                <div className="advanced-row">
                  <label>탐색 깊이</label>
                  <input
                    type="number"
                    min={1}
                    max={5}
                    value={maxDepth}
                    onChange={(e) => setMaxDepth(Number(e.target.value))}
                    className="form-input form-input-tiny"
                  />
                </div>
              </div>
            )}
          </div>

          {error && <div className="form-error">{error}</div>}

          <div className="form-actions">
            <button
              type="button"
              className="btn-secondary"
              onClick={() => navigate('/')}
            >
              취소
            </button>
            <button
              type="submit"
              className="btn-primary btn-large"
              disabled={mutation.isPending}
            >
              {mutation.isPending ? '시작하는 중...' : '수집 시작'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
