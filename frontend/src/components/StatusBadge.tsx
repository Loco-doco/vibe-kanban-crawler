const STATUS_COLORS: Record<string, string> = {
  pending: '#6b7280',
  running: '#3b82f6',
  completed: '#10b981',
  failed: '#ef4444',
  cancelled: '#f59e0b',
  scraped: '#8b5cf6',
  verified: '#10b981',
  contacted: '#3b82f6',
  replied: '#059669',
  bounced: '#dc2626',
  manual_review: '#f97316',
}

const STATUS_LABELS: Record<string, string> = {
  pending: '대기 중',
  running: '수집 중',
  completed: '완료',
  failed: '실패',
  cancelled: '중단됨',
  scraped: '수집 완료',
  verified: '확인됨',
  contacted: '연락함',
  replied: '답변 받음',
  bounced: '이메일 오류',
  manual_review: '직접 확인 필요',
}

export default function StatusBadge({ status }: { status: string }) {
  const color = STATUS_COLORS[status] || '#6b7280'
  const label = STATUS_LABELS[status] || status

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
      }}
    >
      {label}
    </span>
  )
}
