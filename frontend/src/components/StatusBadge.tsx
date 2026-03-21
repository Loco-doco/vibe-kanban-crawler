const STATUS_COLORS: Record<string, string> = {
  // Job statuses
  draft: '#9ca3af',
  queued: '#6b7280',
  running: '#3b82f6',
  partial_results: '#8b5cf6',
  completed: '#10b981',
  completed_low_yield: '#f59e0b',
  failed: '#ef4444',
  cancelled: '#9ca3af',
  // Lead statuses
  scraped: '#8b5cf6',
  verified: '#10b981',
  contacted: '#3b82f6',
  replied: '#059669',
  bounced: '#dc2626',
  manual_review: '#f97316',
}

const STATUS_LABELS: Record<string, string> = {
  // Job statuses — Phase 4 사용자 친화 레이블
  draft: '초안',
  queued: '실행 대기 중',
  running: '탐색 중',
  partial_results: '일부 결과 확보됨',
  completed: '목표 달성 완료',
  completed_low_yield: '탐색 종료(목표 미달)',
  failed: '실행 실패',
  cancelled: '사용자 취소',
  // Lead statuses
  scraped: '수집 완료',
  verified: '확인됨',
  contacted: '연락함',
  replied: '답변 받음',
  bounced: '이메일 오류',
  manual_review: '직접 확인 필요',
}

const STATUS_TOOLTIPS: Record<string, string> = {
  completed: '설정된 목표 수량에 도달하여 탐색이 정상 종료되었습니다.',
  completed_low_yield: '목표 수량에 미달했지만 탐색 가능한 소스가 모두 소진되었습니다.',
  partial_results: '아직 탐색이 진행 중이며, 중간 결과를 확인할 수 있습니다.',
  failed: '시스템 오류 또는 시간 초과로 탐색이 중단되었습니다.',
  cancelled: '사용자가 직접 탐색을 중단했습니다.',
  manual_review: '이메일을 자동으로 찾지 못했습니다. 채널 페이지에서 직접 확인이 필요합니다.',
  scraped: '크롤링으로 수집된 이메일입니다. 발송 전 확인을 권장합니다.',
  verified: '이메일 주소가 확인되었습니다.',
  bounced: '이메일 발송이 실패했습니다. 주소를 다시 확인하세요.',
}

export default function StatusBadge({ status }: { status: string }) {
  const color = STATUS_COLORS[status] || '#6b7280'
  const label = STATUS_LABELS[status] || status
  const tooltip = STATUS_TOOLTIPS[status]

  return (
    <span
      style={{
        display: 'inline-block',
        padding: '2px 8px',
        borderRadius: '12px',
        fontSize: '12px',
        fontWeight: 600,
        color: '#fff',
        backgroundColor: color,
        cursor: tooltip ? 'help' : undefined,
      }}
      title={tooltip}
    >
      {label}
    </span>
  )
}
