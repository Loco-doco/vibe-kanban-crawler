import type { ReviewStatus } from '../types'

interface Props {
  selectedCount: number
  onAction: (status: ReviewStatus) => void
  disabled?: boolean
}

export default function BulkActions({ selectedCount, onAction, disabled }: Props) {
  if (selectedCount === 0) return null

  return (
    <div className="bulk-actions-bar">
      <span className="bulk-actions-count">{selectedCount}건 선택</span>
      <div className="bulk-actions-buttons">
        <button
          className="btn btn-sm bulk-approve"
          onClick={() => onAction('approved')}
          disabled={disabled}
        >
          승인
        </button>
        <button
          className="btn btn-sm bulk-reject"
          onClick={() => onAction('rejected')}
          disabled={disabled}
        >
          제외
        </button>
        <button
          className="btn btn-sm bulk-hold"
          onClick={() => onAction('held')}
          disabled={disabled}
        >
          보류
        </button>
      </div>
    </div>
  )
}
