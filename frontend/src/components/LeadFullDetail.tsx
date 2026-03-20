import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { updateLead, getEditHistory } from '../api/leads'
import EditableField from './EditableField'
import type { Lead, EditHistoryEntry } from '../types'
import {
  PLATFORM_LABELS,
  CONTACT_READINESS_LABELS,
  SUSPECT_REASON_LABELS,
  EMAIL_STATUS_LABELS,
  AUDIENCE_TIER_LABELS,
  AUDIENCE_DISPLAY_STATUS_LABELS,
  AUDIENCE_FAILURE_REASON_LABELS,
  ENRICHMENT_STATUS_LABELS,
  REVIEW_STATUS_LABELS,
  SOURCE_TYPE_LABELS,
} from '../types'

interface Props {
  lead: Lead
  onClose: () => void
  onUpdated: () => void
}

type TabId = 'profile' | 'contact' | 'source' | 'history'

const TABS: { id: TabId; label: string }[] = [
  { id: 'profile', label: '프로필' },
  { id: 'contact', label: '연락처 / 영향력' },
  { id: 'source', label: '출처 · 근거' },
  { id: 'history', label: '보정 이력' },
]

function formatDateTime(iso: string | null) {
  if (!iso) return '-'
  const d = new Date(iso)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`
}

export default function LeadFullDetail({ lead, onClose, onUpdated }: Props) {
  const [activeTab, setActiveTab] = useState<TabId>('profile')
  const queryClient = useQueryClient()

  const updateMutation = useMutation({
    mutationFn: (fields: Partial<Lead>) => updateLead(lead.id, fields),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['leads'] })
      queryClient.invalidateQueries({ queryKey: ['quality'] })
      onUpdated()
    },
  })

  const { data: editHistory } = useQuery({
    queryKey: ['edit-history', lead.id],
    queryFn: () => getEditHistory(lead.id),
  })

  const handleFieldSave = (field: string, value: string) => {
    const payload: Record<string, string | number | null> = {}
    if (field === 'audience_size_override') {
      payload[field] = value ? parseInt(value, 10) : null
    } else {
      payload[field] = value.trim() || null
    }
    updateMutation.mutate(payload as Partial<Lead>)
  }

  const enrichment = lead.enrichment

  return (
    <div className="full-detail-overlay" onClick={onClose}>
      <div className="full-detail-modal" onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div className="full-detail-header">
          <div className="full-detail-header-info">
            <h2>{lead.effective_name || '(이름 없음)'}</h2>
            <div className="full-detail-header-badges">
              <span className={`platform-badge ${lead.platform}`}>
                {PLATFORM_LABELS[lead.platform] || lead.platform}
              </span>
              <span className={`review-badge ${lead.review_status}`}>
                {REVIEW_STATUS_LABELS[lead.review_status]}
              </span>
            </div>
          </div>
          <button className="drawer-close" onClick={onClose}>&times;</button>
        </div>

        {updateMutation.isPending && (
          <div className="drawer-saving">저장 중...</div>
        )}

        {/* Tabs */}
        <div className="full-detail-tabs">
          {TABS.map(tab => (
            <button
              key={tab.id}
              className={`full-detail-tab${activeTab === tab.id ? ' active' : ''}`}
              onClick={() => setActiveTab(tab.id)}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Tab Content */}
        <div className="full-detail-content">
          {activeTab === 'profile' && (
            <div className="full-detail-tab-content">
              <EditableField
                label="리드명 (표시)"
                value={lead.display_name || lead.channel_name}
                rawValue={lead.channel_name}
                onSave={val => handleFieldSave('display_name', val)}
                placeholder="채널/크리에이터 이름"
              />
              <div className="drawer-field-readonly">
                <span className="drawer-field-label">채널 URL</span>
                <span className="drawer-field-value">
                  {lead.channel_url ? (
                    <a href={lead.channel_url} target="_blank" rel="noopener noreferrer">{lead.channel_url}</a>
                  ) : '(없음)'}
                </span>
              </div>
              {enrichment?.business_type && (
                <div className="drawer-field-readonly">
                  <span className="drawer-field-label">비즈니스 유형</span>
                  <span className="drawer-field-value">{enrichment.business_type}</span>
                </div>
              )}
              {enrichment?.profile_summary && (
                <div className="drawer-field-readonly">
                  <span className="drawer-field-label">프로필 요약</span>
                  <span className="drawer-field-value text-sm">{enrichment.profile_summary}</span>
                </div>
              )}
              {enrichment?.business_summary && (
                <div className="drawer-field-readonly">
                  <span className="drawer-field-label">비즈니스 요약</span>
                  <span className="drawer-field-value text-sm">{enrichment.business_summary}</span>
                </div>
              )}
              {lead.normalized_tags.length > 0 && (
                <div className="drawer-field-readonly">
                  <span className="drawer-field-label">카테고리</span>
                  <div className="drawer-tag-list">
                    {lead.normalized_tags.map((tag, i) => (
                      <span key={i} className="tag-chip">{tag}</span>
                    ))}
                  </div>
                </div>
              )}
              {lead.discovery_keywords.length > 0 && (
                <div className="drawer-field-readonly">
                  <span className="drawer-field-label">발견 키워드</span>
                  <div className="drawer-tag-list">
                    {lead.discovery_keywords.map((kw, i) => (
                      <span key={i} className="tag-chip discovery">{kw}</span>
                    ))}
                  </div>
                </div>
              )}
              {enrichment?.profile_tags && enrichment.profile_tags.length > 0 && (
                <div className="drawer-field-readonly">
                  <span className="drawer-field-label">프로필 태그</span>
                  <div className="drawer-tag-list">
                    {enrichment.profile_tags.map((tag, i) => (
                      <span key={i} className="tag-chip profile">{tag}</span>
                    ))}
                  </div>
                </div>
              )}
              {enrichment?.recent_activity_summary && (
                <div className="drawer-field-readonly">
                  <span className="drawer-field-label">최근 활동</span>
                  <span className="drawer-field-value text-sm">{enrichment.recent_activity_summary}</span>
                </div>
              )}
              {enrichment?.content_topics && enrichment.content_topics.length > 0 && (
                <div className="drawer-field-readonly">
                  <span className="drawer-field-label">콘텐츠 주제</span>
                  <div className="drawer-tag-list">
                    {enrichment.content_topics.map((t, i) => (
                      <span key={i} className="drawer-tag">{t}</span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {activeTab === 'contact' && (
            <div className="full-detail-tab-content">
              <EditableField
                label="연락처 이메일"
                value={lead.contact_email || lead.email}
                rawValue={lead.email}
                onSave={val => handleFieldSave('contact_email', val)}
                placeholder="이메일 주소"
              />
              <div className="drawer-field-readonly">
                <span className="drawer-field-label">연락 가능성</span>
                <span className={`contact-readiness-badge ${lead.contact_readiness}`}>
                  {CONTACT_READINESS_LABELS[lead.contact_readiness] || lead.contact_readiness}
                </span>
                {lead.suspect_reason && (
                  <span className="suspect-detail-label">
                    {SUSPECT_REASON_LABELS[lead.suspect_reason] || lead.suspect_reason}
                  </span>
                )}
              </div>
              <div className="drawer-field-readonly">
                <span className="drawer-field-label">이메일 상태</span>
                <span className={`email-status-badge ${lead.email_status}`}>
                  {EMAIL_STATUS_LABELS[lead.email_status] || lead.email_status}
                </span>
              </div>
              {enrichment?.suggested_email && (
                <div className="drawer-field-readonly">
                  <span className="drawer-field-label">보강 제안 이메일</span>
                  <span className="drawer-field-value">{enrichment.suggested_email}</span>
                </div>
              )}
              <div className="drawer-field-readonly">
                <span className="drawer-field-label">영향력 상태</span>
                <span className="drawer-field-value">
                  {lead.audience_display_status === 'collected'
                    ? lead.effective_audience_label || `${lead.effective_audience_size}`
                    : AUDIENCE_DISPLAY_STATUS_LABELS[lead.audience_display_status]}
                </span>
                {lead.audience_failure_reason && (
                  <span className="suspect-detail-label">
                    {AUDIENCE_FAILURE_REASON_LABELS[lead.audience_failure_reason] || lead.audience_failure_reason}
                  </span>
                )}
              </div>
              <EditableField
                label="영향력 (수동 보정)"
                value={lead.audience_size_override?.toString() || ''}
                rawValue={lead.subscriber_count?.toString() || null}
                onSave={val => handleFieldSave('audience_size_override', val)}
                type="number"
                placeholder="구독자/팔로워 수"
              />
              <div className="drawer-field-readonly">
                <span className="drawer-field-label">영향력 규모 구간</span>
                <span className="drawer-field-value">
                  {lead.effective_audience_tier ? (
                    <span className={`tier-badge ${lead.effective_audience_tier}`}>
                      {AUDIENCE_TIER_LABELS[lead.effective_audience_tier]}
                    </span>
                  ) : '미분류'}
                </span>
              </div>
              {enrichment?.secondary_platforms && enrichment.secondary_platforms.length > 0 && (
                <div className="drawer-field-readonly">
                  <span className="drawer-field-label">기타 플랫폼</span>
                  <div className="drawer-tag-list">
                    {enrichment.secondary_platforms.map((p, i) => (
                      <span key={i} className="drawer-tag">{p}</span>
                    ))}
                  </div>
                </div>
              )}
              {enrichment?.contact_channels && enrichment.contact_channels.length > 0 && (
                <div className="drawer-field-readonly">
                  <span className="drawer-field-label">추가 연락 채널</span>
                  <div className="drawer-tag-list">
                    {enrichment.contact_channels.map((ch, i) => (
                      <span key={i} className="drawer-tag">{ch}</span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {activeTab === 'source' && (
            <div className="full-detail-tab-content">
              <div className="drawer-field-readonly">
                <span className="drawer-field-label">근거 링크</span>
                <span className="drawer-field-value">
                  {lead.evidence_link ? (
                    <a href={lead.evidence_link} target="_blank" rel="noopener noreferrer">
                      {lead.evidence_link.length > 80 ? lead.evidence_link.slice(0, 80) + '...' : lead.evidence_link}
                    </a>
                  ) : '(없음)'}
                </span>
              </div>
              <div className="drawer-field-readonly">
                <span className="drawer-field-label">출처 유형</span>
                <span className="drawer-field-value">{SOURCE_TYPE_LABELS[lead.source_type || ''] || lead.source_type || '-'}</span>
              </div>
              <div className="drawer-field-readonly">
                <span className="drawer-field-label">출처 URL</span>
                <span className="drawer-field-value">
                  {lead.source_url ? (
                    <a href={lead.source_url} target="_blank" rel="noopener noreferrer">
                      {lead.source_url.length > 80 ? lead.source_url.slice(0, 80) + '...' : lead.source_url}
                    </a>
                  ) : '-'}
                </span>
              </div>
              <div className="drawer-field-readonly">
                <span className="drawer-field-label">크롤러 이메일</span>
                <span className="drawer-field-value">{lead.email || '(수집 안 됨)'}</span>
              </div>
              <div className="drawer-field-readonly">
                <span className="drawer-field-label">크롤러 채널명</span>
                <span className="drawer-field-value">{lead.channel_name || '(없음)'}</span>
              </div>
              <div className="drawer-field-readonly">
                <span className="drawer-field-label">크롤러 구독자 수</span>
                <span className="drawer-field-value">{lead.subscriber_count ?? '(미수집)'}</span>
              </div>
              <div className="drawer-field-readonly">
                <span className="drawer-field-label">신뢰도</span>
                <span className="drawer-field-value">{(lead.confidence_score * 100).toFixed(0)}%</span>
              </div>
              <div className="drawer-field-readonly">
                <span className="drawer-field-label">보강 상태</span>
                <span className={`enrichment-status-badge ${lead.enrichment_status}`}>
                  {ENRICHMENT_STATUS_LABELS[lead.enrichment_status]}
                </span>
              </div>
              {/* Evidence metadata */}
              {enrichment?.evidence_url && (
                <div className="drawer-field-readonly">
                  <span className="drawer-field-label">Evidence URL</span>
                  <span className="drawer-field-value">
                    <a href={enrichment.evidence_url} target="_blank" rel="noopener noreferrer">
                      {enrichment.evidence_url.length > 80 ? enrichment.evidence_url.slice(0, 80) + '...' : enrichment.evidence_url}
                    </a>
                  </span>
                </div>
              )}
              {enrichment?.extraction_method && (
                <div className="drawer-field-readonly">
                  <span className="drawer-field-label">추출 방법</span>
                  <span className="drawer-field-value">{enrichment.extraction_method}</span>
                </div>
              )}
              {enrichment?.coverage_score != null && (
                <div className="drawer-field-readonly">
                  <span className="drawer-field-label">커버리지 점수</span>
                  <span className="drawer-field-value">{(enrichment.coverage_score * 100).toFixed(0)}%</span>
                </div>
              )}
            </div>
          )}

          {activeTab === 'history' && (
            <div className="full-detail-tab-content">
              {editHistory && editHistory.length > 0 ? (
                <div className="edit-history-list">
                  {editHistory.map((entry: EditHistoryEntry, i: number) => (
                    <div key={i} className="edit-history-entry">
                      <div className="edit-history-meta">
                        <span className="edit-history-field">{FIELD_LABELS[entry.field_name] || entry.field_name}</span>
                        <span className="edit-history-time">{formatDateTime(entry.edited_at)}</span>
                      </div>
                      <div className="edit-history-values">
                        <span className="edit-history-old">{entry.old_value || '(없음)'}</span>
                        <span className="edit-history-arrow">&rarr;</span>
                        <span className="edit-history-new">{entry.new_value || '(없음)'}</span>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="drawer-empty-section">보정 이력 없음</div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

const FIELD_LABELS: Record<string, string> = {
  display_name: '리드명',
  contact_email: '연락처 이메일',
  audience_size_override: '영향력 (수동 보정)',
  audience_tier_override: '영향력 규모 (수동 보정)',
  email_status: '이메일 상태',
  review_status: '리뷰 상태',
}
