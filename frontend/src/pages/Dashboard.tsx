import { useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { getJobs } from '../api/jobs'
import { getLeads } from '../api/leads'
import StatusBadge from '../components/StatusBadge'
import type { Job, Lead } from '../types'
import { PLATFORM_LABELS } from '../types'

export default function Dashboard() {
  const navigate = useNavigate()

  const { data: jobs, isLoading: jobsLoading } = useQuery({ queryKey: ['jobs'], queryFn: getJobs })
  const { data: leads, isLoading: leadsLoading } = useQuery({
    queryKey: ['leads-recent'],
    queryFn: () => getLeads({ limit: 5, sort: 'inserted_at', order: 'desc' }),
  })

  const runningJobs = jobs?.filter((j: Job) => j.status === 'running').length || 0
  const completedJobs = jobs?.filter((j: Job) => j.status === 'completed').length || 0
  const totalLeadsFound = jobs?.reduce((sum: number, j: Job) => sum + j.total_leads_found, 0) || 0

  const confidenceClass = (score: number) => {
    if (score >= 0.7) return 'high'
    if (score >= 0.4) return 'mid'
    return 'low'
  }

  return (
    <>
      {/* Quick Actions */}
      <div className="quick-actions">
        <button className="btn btn-primary" onClick={() => navigate('/collection')}>
          <span>{'\u{1F50D}'}</span> 새 탐색 시작
        </button>
        <button className="btn btn-secondary" onClick={() => navigate('/leads')}>
          <span>{'\u{1F465}'}</span> 전체 리드
        </button>
        <button className="btn btn-secondary" onClick={() => navigate('/master-list')}>
          <span>{'\u{1F4CB}'}</span> 마스터 리스트
        </button>
      </div>

      {/* KPI Metrics */}
      <div className="metrics-grid">
        <div className="metric-card">
          <div className="metric-header">
            <span className="metric-icon" style={{ background: 'var(--primary-50)', color: 'var(--primary-600)' }}>{'\u{1F465}'}</span>
          </div>
          <div className="metric-value">{jobsLoading ? '-' : totalLeadsFound}</div>
          <div className="metric-label">수집된 리드</div>
          <div className="metric-sub">전체 탐색 결과</div>
        </div>
        <div className="metric-card">
          <div className="metric-header">
            <span className="metric-icon" style={{ background: '#eff6ff', color: 'var(--info)' }}>{'\u{1F50D}'}</span>
          </div>
          <div className="metric-value">{jobsLoading ? '-' : runningJobs}</div>
          <div className="metric-label">진행 중 탐색</div>
          <div className="metric-sub">현재 탐색 진행 중</div>
        </div>
        <div className="metric-card">
          <div className="metric-header">
            <span className="metric-icon" style={{ background: 'var(--success-light)', color: 'var(--success)' }}>{'\u2714\uFE0F'}</span>
          </div>
          <div className="metric-value">{jobsLoading ? '-' : completedJobs}</div>
          <div className="metric-label">완료된 탐색</div>
          <div className="metric-sub">전체 완료 수</div>
        </div>
        <div className="metric-card">
          <div className="metric-header">
            <span className="metric-icon" style={{ background: 'var(--purple-light)', color: 'var(--purple)' }}>{'\u{1F4CA}'}</span>
          </div>
          <div className="metric-value">{jobsLoading ? '-' : (jobs?.length || 0)}</div>
          <div className="metric-label">전체 탐색 수</div>
          <div className="metric-sub">누적 탐색 수</div>
        </div>
      </div>

      {/* Dashboard Grid */}
      <div className="dashboard-grid">
        <div className="dashboard-col-main">
          {/* Recent Leads */}
          <div className="card">
            <div className="card-header">
              <h2 className="card-title">최근 수집된 리드</h2>
              <a className="card-link" onClick={() => navigate('/leads')} style={{ cursor: 'pointer' }}>전체 보기 {'\u2192'}</a>
            </div>
            {!leads?.length ? (
              <div className="empty-state">
                <span className="empty-state-icon">{'\u{1F465}'}</span>
                <h3>아직 수집된 리드가 없습니다</h3>
                <p>리드 수집 페이지에서 크롤링을 시작하세요</p>
              </div>
            ) : (
              <div className="table-wrap">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>이메일</th>
                      <th>플랫폼</th>
                      <th>채널명</th>
                      <th>정확도</th>
                      <th>상태</th>
                    </tr>
                  </thead>
                  <tbody>
                    {leads.map((lead: Lead) => (
                      <tr key={lead.id}>
                        <td className="email-cell">{lead.email || '-'}</td>
                        <td>
                          <span className={`platform-badge ${lead.platform}`}>
                            {PLATFORM_LABELS[lead.platform] || lead.platform}
                          </span>
                        </td>
                        <td>{lead.channel_name || '-'}</td>
                        <td>
                          <span className={`confidence ${confidenceClass(lead.confidence_score)}`}>
                            {Math.round(lead.confidence_score * 100)}%
                          </span>
                        </td>
                        <td><StatusBadge status={lead.status} /></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>

        <div className="dashboard-col-side">
          {/* Crawling Status */}
          <div className="card">
            <div className="card-header">
              <h2 className="card-title">탐색 현황</h2>
              <a className="card-link" onClick={() => navigate('/collection')} style={{ cursor: 'pointer' }}>전체 보기 {'\u2192'}</a>
            </div>
            {!jobs?.length ? (
              <div className="empty-state" style={{ padding: '24px 20px' }}>
                <p style={{ fontSize: '0.85rem' }}>아직 탐색 내역이 없습니다</p>
              </div>
            ) : (
              <div className="job-status-list">
                {jobs.slice(0, 5).map((job: Job) => (
                  <div className="job-status-item" key={job.id}>
                    <div className="job-status-info">
                      <span className={`status-dot ${job.status === 'running' ? 'running' : job.status === 'completed' ? 'completed' : 'pending'}`}></span>
                      <span>{job.label || `탐색 #${job.id}`} ({job.targets.length}개 대상)</span>
                    </div>
                    {job.status === 'running' && job.progress && (
                      <>
                        <div className="progress-bar">
                          <div className="progress-fill" style={{ width: `${job.progress.percentage}%` }}></div>
                        </div>
                        <span className="job-status-meta">{job.progress.percentage}% · 리드 {job.total_leads_found}개 발견</span>
                      </>
                    )}
                    {job.status !== 'running' && (
                      <span className="job-status-meta">
                        <StatusBadge status={job.status} /> · 리드 {job.total_leads_found}개
                      </span>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Coming Soon - Outreach */}
          <div className="card">
            <div className="card-header">
              <h2 className="card-title">아웃리치</h2>
              <span style={{ fontSize: '0.75rem', color: 'var(--gray-400)' }}>{'\u{1F512}'} 준비 중</span>
            </div>
            <div className="empty-state" style={{ padding: '24px 20px' }}>
              <span style={{ fontSize: '1.5rem', display: 'block', marginBottom: 8 }}>{'\u2709\uFE0F'}</span>
              <p style={{ fontSize: '0.85rem' }}>이메일 캠페인, 템플릿, 시퀀스 기능이 곧 추가됩니다</p>
            </div>
          </div>
        </div>
      </div>
    </>
  )
}
