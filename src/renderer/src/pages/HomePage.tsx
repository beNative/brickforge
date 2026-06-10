import { useState, useEffect } from 'react'
import {
  Layers,
  CheckCircle,
  AlertTriangle,
  Play,
  ArrowRight,
  Database,
  Search,
  Clock
} from 'lucide-react'

interface HomePageProps {
  onNavigateToSession: (sessionId: number) => void
  onNavigateToImport: () => void
  onNavigateToSearch: () => void
}

export default function HomePage({
  onNavigateToSession,
  onNavigateToImport,
  onNavigateToSearch
}: HomePageProps) {
  const [stats, setStats] = useState<any>(null)
  const [recentSessions, setRecentSessions] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  const loadData = async () => {
    setLoading(true)
    try {
      const statsRes = await window.api.getGeneralStats()
      const sessionsRes = await window.api.getRecentSessions()

      if (statsRes.success) setStats(statsRes.stats)
      if (sessionsRes.success) setRecentSessions(sessionsRes.sessions || [])
    } catch (e) {
      console.error('Failed to load dashboard data', e)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadData()
  }, [])

  if (loading) {
    return (
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          height: '100%',
          flex: 1
        }}
      >
        <p style={{ color: 'var(--text-secondary)' }}>Loading dashboard data...</p>
      </div>
    )
  }

  const hasCatalogData = stats && stats.catalogSetsCount > 0 && stats.catalogPartsCount > 0

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', flex: 1 }}>
      <div>
        <h1 style={{ fontSize: '20px', margin: '0 0 4px 0' }}>Dashboard</h1>
        <p className="subtitle" style={{ margin: 0, fontSize: '13px' }}>
          Welcome to BrickForge — LEGO Technic Inventory Checker
        </p>
      </div>

      {/* Catalog Warning Callout */}
      {!hasCatalogData && (
        <div
          className="glass-panel"
          style={{ padding: '12px 16px', borderLeft: '3px solid var(--status-missing)' }}
        >
          <div style={{ display: 'flex', gap: '12px', alignItems: 'flex-start' }}>
            <AlertTriangle
              size={20}
              style={{ color: 'var(--status-missing)', flexShrink: 0, marginTop: '2px' }}
            />
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <h3 style={{ margin: 0, fontSize: '14px', fontWeight: 700 }}>
                Lego Catalog Data Missing
              </h3>
              <p
                style={{
                  color: 'var(--text-secondary)',
                  fontSize: '12px',
                  lineHeight: 1.5,
                  margin: 0
                }}
              >
                BrickForge runs fully offline. To get started, download catalog files from
                Rebrickable and import them.
              </p>
              <button
                className="btn btn-primary btn-sm"
                style={{
                  width: 'fit-content',
                  marginTop: '4px',
                  height: '28px',
                  padding: '4px 10px',
                  fontSize: '11px'
                }}
                onClick={onNavigateToImport}
              >
                <Database size={14} />
                <span>Go to Data Import</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Summary Cards */}
      <div className="home-grid">
        <div className="glass-panel home-card">
          <span className="home-card-title">Total Inventoried</span>
          <span className="home-card-value">{stats?.totalSets || 0}</span>
          <span
            style={{
              fontSize: '11px',
              color: '#64748b',
              display: 'flex',
              alignItems: 'center',
              gap: '4px'
            }}
          >
            <Layers size={12} /> sets checked
          </span>
        </div>

        <div className="glass-panel home-card">
          <span className="home-card-title">Complete Sets</span>
          <span className="home-card-value" style={{ color: 'var(--status-complete)' }}>
            {stats?.completeSets || 0}
          </span>
          <span
            style={{
              fontSize: '11px',
              color: '#64748b',
              display: 'flex',
              alignItems: 'center',
              gap: '4px'
            }}
          >
            <CheckCircle size={12} style={{ color: 'var(--status-complete)' }} /> 100% complete
          </span>
        </div>

        <div className="glass-panel home-card">
          <span className="home-card-title">Incomplete Sets</span>
          <span className="home-card-value" style={{ color: 'var(--status-partial)' }}>
            {stats?.incompleteSets || 0}
          </span>
          <span
            style={{
              fontSize: '11px',
              color: '#64748b',
              display: 'flex',
              alignItems: 'center',
              gap: '4px'
            }}
          >
            <AlertTriangle size={12} style={{ color: 'var(--status-partial)' }} /> missing parts
          </span>
        </div>

        <div className="glass-panel home-card">
          <span className="home-card-title">Sessions In Progress</span>
          <span className="home-card-value" style={{ color: 'var(--border-focus)' }}>
            {stats?.sessionsInProgress || 0}
          </span>
          <span
            style={{
              fontSize: '11px',
              color: '#64748b',
              display: 'flex',
              alignItems: 'center',
              gap: '4px'
            }}
          >
            <Clock size={12} style={{ color: 'var(--border-focus)' }} /> active checks
          </span>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '2.2fr 1fr', gap: '20px' }}>
        {/* Recent Sessions */}
        <div
          className="glass-panel"
          style={{
            padding: '16px',
            display: 'flex',
            flex: 'column',
            gap: '12px',
            flexDirection: 'column'
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h2 style={{ fontSize: '14px', fontWeight: 700, margin: 0 }}>
              Recent Inventory Sessions
            </h2>
            <button
              className="btn btn-secondary btn-sm"
              onClick={onNavigateToSearch}
              disabled={!hasCatalogData}
              style={{ height: '28px', padding: '4px 10px', fontSize: '11px' }}
            >
              <span>New Session</span>
              <ArrowRight size={12} />
            </button>
          </div>

          {recentSessions.length === 0 ? (
            <div className="empty-slate" style={{ padding: '32px 16px', gap: '8px' }}>
              <Clock size={24} style={{ opacity: 0.4 }} />
              <p style={{ margin: 0, fontSize: '13px', color: 'var(--text-secondary)' }}>
                No inventory sessions created yet.
              </p>
              {hasCatalogData ? (
                <button
                  className="btn btn-primary btn-sm"
                  onClick={onNavigateToSearch}
                  style={{
                    height: '28px',
                    padding: '4px 10px',
                    fontSize: '11px',
                    marginTop: '4px'
                  }}
                >
                  <Search size={14} />
                  <span>Search Sets to Begin</span>
                </button>
              ) : null}
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {recentSessions.map((session) => (
                <div
                  key={session.id}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '10px 12px',
                    background: 'var(--bg-surface-solid)',
                    borderRadius: '4px',
                    border: '1px solid var(--border-glass)'
                  }}
                >
                  <div
                    style={{
                      display: 'flex',
                      gap: '12px',
                      alignItems: 'center',
                      flex: 1,
                      minWidth: 0
                    }}
                  >
                    {session.set_image ? (
                      <img
                        src={session.set_image}
                        alt={session.set_name}
                        style={{
                          width: '40px',
                          height: '40px',
                          objectFit: 'contain',
                          borderRadius: '4px',
                          background: 'var(--bg-main)',
                          padding: '2px'
                        }}
                      />
                    ) : (
                      <div
                        style={{
                          width: '40px',
                          height: '40px',
                          background: 'var(--bg-main)',
                          borderRadius: '4px',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center'
                        }}
                      >
                        <Layers size={16} style={{ color: '#475569' }} />
                      </div>
                    )}
                    <div
                      style={{
                        display: 'flex',
                        gap: '12px',
                        alignItems: 'center',
                        flex: 1,
                        minWidth: 0
                      }}
                    >
                      <div
                        style={{
                          display: 'flex',
                          flexDirection: 'column',
                          gap: '2px',
                          flex: 1,
                          minWidth: 0
                        }}
                      >
                        <h4
                          style={{
                            margin: 0,
                            textOverflow: 'ellipsis',
                            overflow: 'hidden',
                            whiteSpace: 'nowrap',
                            fontSize: '13px',
                            fontWeight: 600
                          }}
                        >
                          {session.name}
                        </h4>
                        <div
                          style={{
                            display: 'flex',
                            gap: '8px',
                            fontSize: '11px',
                            color: 'var(--text-secondary)',
                            fontFamily: 'monospace'
                          }}
                        >
                          <span>Set: {session.set_num}</span>
                          <span>•</span>
                          <span>
                            {session.checked_rows}/{session.unique_rows} checked
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <div
                      style={{
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'flex-end',
                        gap: '2px'
                      }}
                    >
                      <span
                        className={`badge badge-${session.status === 'in_progress' ? 'partial' : 'complete'}`}
                        style={{ fontSize: '10px', padding: '1px 6px' }}
                      >
                        {session.status.replace('_', ' ')}
                      </span>
                      <span style={{ fontSize: '11px', fontWeight: 700, fontFamily: 'monospace' }}>
                        {session.qtyCompletionPct}% Complete
                      </span>
                    </div>

                    <button
                      className="btn btn-primary btn-sm btn-icon-only"
                      onClick={() => onNavigateToSession(session.id)}
                      style={{ width: '28px', height: '28px' }}
                    >
                      <Play size={12} fill="white" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Sidebar Info/Quick Actions */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <div className="glass-panel" style={{ padding: '16px' }}>
            <h3 style={{ fontSize: '14px', marginBottom: '8px', fontWeight: 700 }}>
              Last checked set
            </h3>
            {stats?.lastCheckedSet ? (
              <div>
                <p style={{ fontSize: '13px', fontWeight: 600, margin: 0 }}>
                  {stats.lastCheckedSet}
                </p>
                {stats.lastCheckedDate && (
                  <p
                    style={{
                      fontSize: '11px',
                      color: 'var(--text-secondary)',
                      marginTop: '4px',
                      margin: 0
                    }}
                  >
                    On {new Date(stats.lastCheckedDate).toLocaleDateString()}
                  </p>
                )}
              </div>
            ) : (
              <p style={{ color: 'var(--text-secondary)', fontSize: '12px', margin: 0 }}>
                No sets checked yet.
              </p>
            )}
          </div>

          <div
            className="glass-panel"
            style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: '8px' }}
          >
            <h3 style={{ fontSize: '14px', marginBottom: '4px', fontWeight: 700 }}>Quick Help</h3>
            <p
              style={{
                fontSize: '12px',
                color: 'var(--text-secondary)',
                lineHeight: 1.5,
                margin: 0
              }}
            >
              Sort and count parts by Technic categories on your desk, and type the numbers into
              BrickForge.
            </p>
            <p
              style={{
                fontSize: '12px',
                color: 'var(--text-secondary)',
                lineHeight: 1.5,
                margin: 0
              }}
            >
              Use filters like <strong>Missing parts only</strong> to quickly generate a parts list
              for orders.
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
