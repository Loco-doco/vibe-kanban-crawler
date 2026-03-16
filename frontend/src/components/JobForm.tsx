import { useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { createJob } from '../api/jobs'

export default function JobForm() {
  const [urls, setUrls] = useState('')
  const [maxRetries, setMaxRetries] = useState(3)
  const [delaySec, setDelaySec] = useState(2)
  const [maxDepth, setMaxDepth] = useState(3)
  const [showAdvanced, setShowAdvanced] = useState(false)
  const queryClient = useQueryClient()

  const mutation = useMutation({
    mutationFn: createJob,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['jobs'] })
      setUrls('')
    },
  })

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    const targets = urls
      .split('\n')
      .map((u) => u.trim())
      .filter(Boolean)
    if (targets.length === 0) return

    mutation.mutate({
      job: {
        targets,
        max_retries: maxRetries,
        delay_ms: delaySec * 1000,
        max_depth: maxDepth,
      },
    })
  }

  return (
    <form onSubmit={handleSubmit} className="job-form">
      <h3>새 수집 작업</h3>
      <p className="form-guide">
        수집할 크리에이터의 채널/프로필 주소를 아래에 입력하고 '수집 시작'을 누르세요.
      </p>

      <label>
        크리에이터 채널 주소
        <textarea
          value={urls}
          onChange={(e) => setUrls(e.target.value)}
          rows={5}
          placeholder={'유튜브, 인스타그램 등 채널 주소를 한 줄에 하나씩 입력하세요\n\n예: https://youtube.com/@채널이름\n예: https://instagram.com/아이디\n예: https://크리에이터사이트.com'}
          required
        />
      </label>

      <div className="advanced-toggle">
        <button
          type="button"
          className="btn-toggle"
          onClick={() => setShowAdvanced(!showAdvanced)}
        >
          {showAdvanced ? '고급 설정 접기' : '고급 설정 펼치기'}
          <span className={`toggle-arrow ${showAdvanced ? 'open' : ''}`}>&#9662;</span>
        </button>
      </div>

      {showAdvanced && (
        <div className="advanced-settings">
          <div className="form-row">
            <label>
              재시도 횟수
              <input
                type="number"
                value={maxRetries}
                onChange={(e) => setMaxRetries(Number(e.target.value))}
                min={0}
                max={10}
              />
              <span className="help-text">접속 실패 시 다시 시도하는 횟수</span>
            </label>

            <label>
              대기 시간(초)
              <input
                type="number"
                value={delaySec}
                onChange={(e) => setDelaySec(Number(e.target.value))}
                min={0}
                max={30}
                step={1}
              />
              <span className="help-text">재시도 사이 기다리는 시간</span>
            </label>

            <label>
              탐색 깊이
              <input
                type="number"
                value={maxDepth}
                onChange={(e) => setMaxDepth(Number(e.target.value))}
                min={1}
                max={5}
              />
              <span className="help-text">링크를 따라가는 단계 수 (보통 3이면 충분)</span>
            </label>
          </div>
        </div>
      )}

      <button type="submit" disabled={mutation.isPending}>
        {mutation.isPending ? '작업 생성 중...' : '수집 시작'}
      </button>

      {mutation.isError && (
        <p className="error">오류가 발생했습니다: {(mutation.error as Error).message}</p>
      )}
    </form>
  )
}
