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

type ConfirmAction = 'approved' | 'rejected' | 'held' | 'needs_review' | 'sync' | 'conflict_keep' | 'conflict_reject'

const ACTION_LABELS: Record<ConfirmAction, { verb: string; buttonLabel: string; description: string }> = {
  approved: { verb: '연락 대상으로 이동', buttonLabel: '연락 대상으로 이동', description: '선택한 리드를 연락 대상 목록으로 이동합니다. 중복/충돌 검사가 자동 실행됩니다.' },
  rejected: { verb: '제외', buttonLabel: '제외', description: '제외 목록으로 이동합니다. (복구 가능)' },
  held: { verb: '보류', buttonLabel: '보류', description: '나중에 다시 검토할 수 있도록 보류합니다.' },
  needs_review: { verb: '재검토', buttonLabel: '재검토', description: '검토 필요 상태로 되돌립니다.' },
  sync: { verb: '최종 반영', buttonLabel: '연락 대상 최종 반영', description: '연락 대상 리스트에 최종 반영합니다.' },
  conflict_keep: { verb: '충돌 무시', buttonLabel: '충돌 무시하고 이동', description: '충돌을 무시하고 연락 대상으로 이동합니다.' },
  conflict_reject: { verb: '제외', buttonLabel: '중복 제외', description: '중복으로 판단하여 제외합니다.' },
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

  const renderActionButtons = () => {
    if (activeQueue === 'synced') return null

    if (activeQueue === 'conflict_queue') {
      return (
        <div className="bulk-actions-buttons">
          <button className="btn btn-sm bulk-primary-cta" onClick={() => setConfirmAction('conflict_keep')} disabled={disabled}>
            충돌 무시하고 이동
          </button>
          <button className="btn btn-sm bulk-reject" onClick={() => setConfirmAction('conflict_reject')} disabled={disabled}>
            중복 제외
          </button>
        </div>
      )
    }

    if (activeQueue === 'ready_to_sync') {
      return (
        <div className="bulk-actions-buttons">
          <button className="btn btn-sm bulk-primary-cta" onClick={() => setConfirmAction('sync')} disabled={disabled}>
            연락 대상 최종 반영
          </button>
        </div>
      )
    }

    // "excluded" or "on_hold" — offer re-review
    if (activeQueue === 'excluded' || activeQueue === 'on_hold' || activeQueue === 'held') {
      return (
        <div className="bulk-actions-buttons">
          <button className="btn btn-sm bulk-approve" onClick={() => setConfirmAction('needs_review')} disabled={disabled}>
            재검토
          </button>
        </div>
      )
    }

    // Default review/contactable tabs — primary CTA is "연락 대상으로 이동"
    return (
      <div className="bulk-actions-buttons">
        <button className="btn btn-sm bulk-primary-cta" onClick={() => setConfirmAction('approved')} disabled={disabled}>
          연락 대상으로 이동
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

  const renderToastMessage = () => {
    if (!lastResult) return null
    let message = ''
    if (lastResult.synced != null) {
      message = `${lastResult.synced}건 연락 대상 반영 완료`
    } else if (lastResult.action === 'approved' && lastResult.ready != null) {
      message = `${lastResult.count}건 연락 대상으로 이동`
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

      {confirmAction && (
        <div className="bulk-confirm-overlay" onClick={() => setConfirmAction(null)}>
          <div className="bulk-confirm-modal" onClick={e => e.stopPropagation()}>
            <h3>{ACTION_LABELS[confirmAction].verb} 확인</h3>
            <p><strong>{selectedCount}건</strong>의 리드를 처리하시겠습니까?</p>
            <p className="bulk-confirm-description">{ACTION_LABELS[confirmAction].description}</p>
            <div className="bulk-confirm-actions">
              <button className="btn btn-sm btn-ghost" onClick={() => setConfirmAction(null)}>취소</button>
              <button
                className={`btn btn-sm ${confirmAction === 'approved' || confirmAction === 'sync' || confirmAction === 'conflict_keep' ? 'bulk-primary-cta' : confirmAction === 'rejected' || confirmAction === 'conflict_reject' ? 'bulk-reject' : 'bulk-hold'}`}
                onClick={handleConfirm}
              >
                {ACTION_LABELS[confirmAction].buttonLabel}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
