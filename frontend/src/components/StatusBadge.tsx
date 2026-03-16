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

export default function StatusBadge({ status }: { status: string }) {
  const color = STATUS_COLORS[status] || '#6b7280'

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
      {status}
    </span>
  )
}
