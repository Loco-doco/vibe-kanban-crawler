interface ActiveFilter {
  label: string
}

interface Props {
  queueLabel: string
  secondaryFilters: ActiveFilter[]
  totalInQueue: number
  filteredCount: number
  onClearFilters: () => void
}

export default function FilterStatusBar({ queueLabel, secondaryFilters, totalInQueue, filteredCount, onClearFilters }: Props) {
  const hasSecondary = secondaryFilters.length > 0

  return (
    <div className="filter-status-bar">
      <div className="filter-status-primary">
        현재 보기: <strong>{queueLabel}</strong>
        {!hasSecondary && <span className="filter-status-count"> · {totalInQueue}건</span>}
      </div>
      {hasSecondary && (
        <>
          <div className="filter-status-secondary">
            추가 필터: {secondaryFilters.map(f => f.label).join(' · ')}
          </div>
          <div className="filter-status-result">
            <span>결과: {totalInQueue}건 중 {filteredCount}건 표시</span>
            <button className="filter-status-clear" onClick={onClearFilters}>전체 해제</button>
          </div>
        </>
      )}
    </div>
  )
}
