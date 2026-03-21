import { useState } from 'react'
import type { ReviewStatus } from '../types'

interface Props {
  selectedCount: number
  totalFilteredCount: number
  activeQueue: string
  onAction: (status: ReviewStatus | 'sync' | 'conflict_keep' | 'conflict_reject') => void
  onSelectAll: () => void
  onDeselectAll: () => void
  disabled?: boolean
  lastResult?: BulkResult | null
}

export interface BulkResult {
  action: ReviewStatus
  count: number
  ready?: number
  conflicts?: number
  synced?: number
}

type ConfirmAction = 'approved' | 'rejected' | 'held' | 'sync' | 'conflict_keep' | 'conflict_reject'

const ACTION_LABELS: Record<ConfirmAction, { verb: string; description: string }> = {
  approved: { verb: '승인', description: '마스터 반영 대기열로 보냅니다. 중복/충돌 검사가 자동 실행됩니다.' },
  rejected: { verb: '제외', description: '제외 큐로 이동합니다. (복구 가능)' },
  held: { verb: '보류', description: '보류 큐에 보관합니다.' },
  sync: { verb: '최종 반영', description: '마스터 리스트에 최종 반영합니다. 이후 변경이 어렵습니다.' },
  conflict_keep: { verb: '충돌 무시', description: '충돌을 무시하고 반영 대기열로 이동합니다.' },
  conflict_reject: { verb: '제외', description: '중복으로 판단하여 제외합니다.' },
}

export default function BulkActions({
  selectedCount, totalFilteredCount, activeQueue, onAction, onSelectAll, onDeselectAll, disabled, lastResult,
}: Props) {
  const [confirmAction, setConfirmAction] = useState<ConfirmAction | null>(null)

  const handleConfirm = () => {
    if (!confirmAction) return
    onAction(confirmAction)
    setConfirmAction(null)
  }

  // Determine which buttons to show based on active queue
  const renderActionButtons = () => {
    if (activeQueue === 'synced') return null // read-only tab

    if (activeQueue === 'conflict_queue') {
      return (
        <div className="bulk-actions-buttons">
          <button className="btn btn-sm bulk-approve" onClick={() => setConfirmAction('conflict_keep')} disabled={disabled}>
            충돌 무시
          </button>
          <button className="btn btn-sm bulk-reject" onClick={() => setConfirmAction('conflict_reject')} disabled={disabled}>
            제외
          </button>
        </div>
      )
    }

    if (activeQueue === 'ready_to_sync') {
      return (
        <div className="bulk-actions-buttons">
          <button className="btn btn-sm bulk-sync" onClick={() => setConfirmAction('sync')} disabled={disabled}>
            최종 반영
          </button>
        </div>
      )
    }

    // Default review tabs
    return (
      <div className="bulk-actions-buttons">
        <button className="btn btn-sm bulk-approve" onClick={() => setConfirmAction('approved')} disabled={disabled}>
          승인
        </button>
        <button className="btn btn-sm bulk-hold" onClick={() => setConfirmAction('held')} disabled={disabled}>
          보류
        </button>
        <button className="btn btn-sm bulk-reject" onClick={() => setConfirmAction('rejected')} disabled={disabled}>
          제외
        </button>
      </div>
    )
  }

  // Render result toast message
  const renderToastMessage = () => {
    if (!lastResult) return null

    let message = ''
    if (lastResult.synced != null) {
      message = `${lastResult.synced}건 마스터 반영 완료`
    } else if (lastResult.action === 'approved' && lastResult.ready != null) {
      message = `${lastResult.count}건 승인 → 대기열 이동`
      if (lastResult.conflicts != null && lastResult.conflicts > 0) {
        return (
          <div className="bulk-result-toast">
            <span className="bulk-result-icon">{'\u2705'}</span>
            {message}
            <span className="bulk-result-conflict"> (충돌 {lastResult.conflicts}건)</span>
          </div>
        )
      }
    } else {
      const verb = ACTION_LABELS[lastResult.action as ConfirmAction]?.verb || lastResult.action
      message = `${lastResult.count}건 ${verb} 완료`
    }

    return (
      <div className="bulk-result-toast">
        <span className="bulk-result-icon">{'\u2705'}</span>
        {message}
      </div>
    )
  }

  return (
    <>
      <div className="bulk-actions-bar">
        <div className="bulk-actions-left">
          {selectedCount > 0 ? (
            <>
              <span className="bulk-actions-count">{selectedCount}건 선택</span>
              <button className="btn btn-sm btn-ghost" onClick={onDeselectAll}>선택 해제</button>
            </>
          ) : activeQueue !== 'synced' ? (
            <button className="btn btn-sm btn-ghost" onClick={onSelectAll}>
              전체 선택 ({totalFilteredCount}건)
            </button>
          ) : (
            <span className="bulk-actions-count">{totalFilteredCount}건</span>
          )}
        </div>

        {selectedCount > 0 && renderActionButtons()}
      </div>

      {renderToastMessage()}

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
                className={`btn btn-sm ${confirmAction === 'sync' ? 'bulk-sync' : confirmAction.includes('keep') || confirmAction === 'approved' ? 'bulk-approve' : confirmAction.includes('reject') || confirmAction === 'rejected' ? 'bulk-reject' : 'bulk-hold'}`}
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
