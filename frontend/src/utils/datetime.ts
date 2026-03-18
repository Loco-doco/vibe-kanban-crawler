const KR_TZ = 'Asia/Seoul'
const KR_LOCALE = 'ko-KR'

/**
 * 날짜 + 시간 + 타임존
 * 예: "3월 18일 오후 01:34 (KST)"
 */
export function formatDateTime(iso: string | null | undefined): string {
  if (!iso) return '-'
  const d = new Date(iso)
  if (isNaN(d.getTime())) return '-'
  const main = d.toLocaleString(KR_LOCALE, {
    timeZone: KR_TZ,
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
  })
  return `${main} (KST)`
}

/**
 * 날짜만
 * 예: "2026년 3월 18일 (KST)"
 */
export function formatDate(iso: string | null | undefined): string {
  if (!iso) return '-'
  const d = new Date(iso)
  if (isNaN(d.getTime())) return '-'
  return d.toLocaleDateString(KR_LOCALE, {
    timeZone: KR_TZ,
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  }) + ' (KST)'
}

/**
 * 시간만 (초 포함)
 * 예: "오후 01:34:22 (KST)"
 */
export function formatTime(iso: string | null | undefined): string {
  if (!iso) return '-'
  const d = new Date(iso)
  if (isNaN(d.getTime())) return '-'
  const main = d.toLocaleString(KR_LOCALE, {
    timeZone: KR_TZ,
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: true,
  })
  return `${main} (KST)`
}

/**
 * 짧은 날짜+시간 (카드 메타용)
 * 예: "3월 18일 13:34"
 */
export function formatDateTimeShort(iso: string | null | undefined): string {
  if (!iso) return '-'
  const d = new Date(iso)
  if (isNaN(d.getTime())) return '-'
  return d.toLocaleString(KR_LOCALE, {
    timeZone: KR_TZ,
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  })
}
