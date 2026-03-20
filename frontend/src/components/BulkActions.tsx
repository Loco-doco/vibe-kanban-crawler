import { useState } from 'react'
import type { ReviewStatus } from '../types'

interface Props {
  selectedCount: number
  totalFilteredCount: number
  onAction: (status: ReviewStatus) => void
  onSelectAll: () => void
  onDeselectAll: () => void
  disabled?: boolean
  lastResult?: BulkResult | null
}

export interface BulkResult {
  action: ReviewStatus
  count: number
}

type ConfirmAction = 'approved' | 'rejected' | 'held'

const ACTION_LABELS: Record<ConfirmAction, { verb: string; description: string }> = {
  approved: { verb: '승인', description: '마스터 반영 대기열로 보냅니다.' },
  rejected: { verb: '제외', description: '제외 큐로 이동합니다. (복구 가능)' },
  held: { verb: '보류', description: '보류 큐에 보관합니다.' },
}

export default function BulkActions({
  selectedCount, totalFilteredCount, onAction, onSelectAll, onDeselectAll, disabled, lastResult,
}: Props) {
  const [confirmAction, setConfirmAction] = useState<ConfirmAction | null>(null)

  const handleConfirm = () => {
    if (!confirmAction) return
    onAction(confirmAction)
    setConfirmAction(null)
  }

  return (
    <>
      {/* Bulk bar — always show when there are results to select */}
      <div className="bulk-actions-bar">
        <div className="bulk-actions-left">
          {selectedCount > 0 ? (
            <>
              <span className="bulk-actions-count">{selectedCount}건 선택</span>
              <button className="btn btn-sm btn-ghost" onClick={onDeselectAll}>선택 해제</button>
            </>
          ) : (
            <button className="btn btn-sm btn-ghost" onClick={onSelectAll}>
              전체 선택 ({totalFilteredCount}건)
            </button>
          )}
        </div>

        {selectedCount > 0 && (
          <div className="bulk-actions-buttons">
            <button
              className="btn btn-sm bulk-approve"
              onClick={() => setConfirmAction('approved')}
              disabled={disabled}
            >
              승인
            </button>
            <button
              className="btn btn-sm bulk-hold"
              onClick={() => setConfirmAction('held')}
              disabled={disabled}
            >
              보류
            </button>
            <button
              className="btn btn-sm bulk-reject"
              onClick={() => setConfirmAction('rejected')}
              disabled={disabled}
            >
              제외
            </button>
          </div>
        )}
      </div>

      {/* Result toast */}
      {lastResult && (
        <div className="bulk-result-toast">
          <span className="bulk-result-icon">{'\u2705'}</span>
          {lastResult.count}건 {ACTION_LABELS[lastResult.action as ConfirmAction]?.verb || lastResult.action} 완료
        </div>
      )}

      {/* Confirmation modal */}
      {confirmAction && (
        <div className="bulk-confirm-overlay" onClick={() => setConfirmAction(null)}>
          <div className="bulk-confirm-modal" onClick={e => e.stopPropagation()}>
            <h3>벌크 {ACTION_LABELS[confirmAction].verb} 확인</h3>
            <p>
              <strong>{selectedCount}건</strong>의 리드를 {ACTION_LABELS[confirmAction].verb}하시겠습니까?
            </p>
            <p className="bulk-confirm-description">
              {ACTION_LABELS[confirmAction].description}
            </p>
            <div className="bulk-confirm-actions">
              <button className="btn btn-sm btn-ghost" onClick={() => setConfirmAction(null)}>
                취소
              </button>
              <button
                className={`btn btn-sm bulk-${confirmAction === 'approved' ? 'approve' : confirmAction === 'rejected' ? 'reject' : 'hold'}`}
                onClick={handleConfirm}
              >
                {ACTION_LABELS[confirmAction].verb} 실행
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
