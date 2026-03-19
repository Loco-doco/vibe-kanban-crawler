import { useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { createSupplementaryJob } from '../api/jobs'
import type { SupplementaryType } from '../types'

interface Props {
  jobId: number
  suggestedType: SupplementaryType
  onClose: () => void
}

const SUPPLEMENT_OPTIONS: { type: SupplementaryType; label: string; description: string }[] = [
  {
    type: 'email_supplement',
    label: '이메일 보완 탐색',
    description: '이메일이 없거나 무효한 리드의 연락처를 추가 수집합니다.',
  },
  {
    type: 'audience_supplement',
    label: '영향력 보완 탐색',
    description: '구독자/팔로워 수가 미수집된 리드의 영향력 지표를 보완합니다.',
  },
  {
    type: 'meta_supplement',
    label: '보강 데이터 보완',
    description: '비즈니스 유형, 콘텐츠 주제 등 enrichment 데이터를 추가 수집합니다.',
  },
]

export default function SupplementarySearchModal({ jobId, suggestedType, onClose }: Props) {
  const [selectedType, setSelectedType] = useState<SupplementaryType>(suggestedType)
  const queryClient = useQueryClient()

  const mutation = useMutation({
    mutationFn: () => createSupplementaryJob(jobId, selectedType),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['jobs'] })
      onClose()
    },
  })

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-panel supplement-modal" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h3>보완 탐색 시작</h3>
          <button className="modal-close" onClick={onClose}>&times;</button>
        </div>

        <div className="modal-body">
          <p className="supplement-description">
            품질 분석 결과에 따라 부족한 데이터를 보완하는 추가 탐색을 시작합니다.
            원본 탐색의 설정을 복사하여 실행됩니다.
          </p>

          <div className="supplement-options">
            {SUPPLEMENT_OPTIONS.map(opt => (
              <label
                key={opt.type}
                className={`supplement-option${selectedType === opt.type ? ' selected' : ''}`}
              >
                <input
                  type="radio"
                  name="supplement-type"
                  value={opt.type}
                  checked={selectedType === opt.type}
                  onChange={() => setSelectedType(opt.type)}
                />
                <div className="supplement-option-content">
                  <span className="supplement-option-label">{opt.label}</span>
                  <span className="supplement-option-desc">{opt.description}</span>
                </div>
              </label>
            ))}
          </div>
        </div>

        <div className="modal-footer">
          <button className="btn btn-secondary" onClick={onClose} disabled={mutation.isPending}>
            취소
          </button>
          <button
            className="btn btn-primary"
            onClick={() => mutation.mutate()}
            disabled={mutation.isPending}
          >
            {mutation.isPending ? '생성 중...' : '보완 탐색 시작'}
          </button>
        </div>

        {mutation.isError && (
          <div className="supplement-error">
            보완 탐색 생성에 실패했습니다. 다시 시도해주세요.
          </div>
        )}
      </div>
    </div>
  )
}
