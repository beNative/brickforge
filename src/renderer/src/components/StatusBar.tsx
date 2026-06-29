import { useEffect, useState } from 'react'
import { Database, Info, Hammer, Terminal, Cloud } from 'lucide-react'

interface StatusBarProps {
  isDbPopulated: boolean
  dbStats: { catalogSetsCount: number; catalogPartsCount: number } | null
  isSessionActive: boolean
  onAboutClick: () => void
  isLogPanelOpen: boolean
  onToggleLogPanel: () => void
  logCounts: { warning: number; error: number }
  syncStatus?: 'idle' | 'syncing' | 'error' | 'conflict'
  onNavigateToSettings?: () => void
}

export default function StatusBar({
  isDbPopulated,
  dbStats,
  isSessionActive,
  onAboutClick,
  isLogPanelOpen,
  onToggleLogPanel,
  logCounts,
  syncStatus = 'idle',
  onNavigateToSettings
}: StatusBarProps) {
  const [version, setVersion] = useState<string>('1.8.0')

  useEffect(() => {
    window.api
      .getAppVersion()
      .then((ver) => {
        setVersion(ver)
      })
      .catch((err) => {
        console.error('Failed to get app version in statusbar:', err)
      })
  }, [])

  return (
    <footer className="statusbar">
      <div className="statusbar-left">
        <div className="statusbar-item" title="Database status">
          <Database size={12} />
          <span className={`statusbar-dot ${isDbPopulated ? '' : 'red'}`}></span>
          <span>{isDbPopulated ? 'DB Connected' : 'DB Data Missing'}</span>
        </div>

        {syncStatus && syncStatus !== 'idle' && (
          <div
            className="statusbar-item clickable"
            title={`Cloud Sync Status: ${syncStatus}. Click to open Settings.`}
            onClick={onNavigateToSettings}
            style={{
              cursor: 'pointer',
              color:
                syncStatus === 'conflict'
                  ? 'var(--status-missing)'
                  : syncStatus === 'error'
                    ? 'var(--status-missing)'
                    : 'var(--primary)'
            }}
          >
            <Cloud
              size={12}
              className={syncStatus === 'syncing' ? 'animate-spin' : ''}
              style={{
                color:
                  syncStatus === 'conflict'
                    ? 'var(--status-missing)'
                    : syncStatus === 'error'
                      ? 'var(--status-missing)'
                      : 'var(--primary)'
              }}
            />
            <span style={{ fontWeight: 600 }}>
              {syncStatus === 'conflict'
                ? 'Sync Conflict Detected'
                : syncStatus === 'error'
                  ? 'Sync Error'
                  : 'Syncing Cloud...'}
            </span>
          </div>
        )}

        {isDbPopulated && dbStats && (
          <div className="statusbar-item" title="Catalog counts">
            <span>
              {dbStats.catalogSetsCount.toLocaleString()} Sets /{' '}
              {dbStats.catalogPartsCount.toLocaleString()} Parts
            </span>
          </div>
        )}

        {isSessionActive && (
          <div className="statusbar-item" title="Active check in progress">
            <Hammer
              size={12}
              className="animate-pulse"
              style={{ color: 'var(--status-partial)' }}
            />
            <span style={{ color: 'rgba(255, 255, 255, 0.85)' }}>Inventory Check Active</span>
          </div>
        )}
      </div>

      <div className="statusbar-right">
        {/* Toggle Log Panel */}
        <div
          className={`statusbar-item clickable ${isLogPanelOpen ? 'active' : ''}`}
          onClick={onToggleLogPanel}
          title="Toggle Logs Console"
          style={{ marginRight: '8px' }}
        >
          <Terminal size={12} />
          <span>Logs</span>
          {(logCounts.warning > 0 || logCounts.error > 0) && (
            <span className="statusbar-log-badges">
              {logCounts.error > 0 && (
                <span className="statusbar-log-badge error" title={`${logCounts.error} Errors`}>
                  {logCounts.error}
                </span>
              )}
              {logCounts.warning > 0 && (
                <span
                  className="statusbar-log-badge warning"
                  title={`${logCounts.warning} Warnings`}
                >
                  {logCounts.warning}
                </span>
              )}
            </span>
          )}
        </div>

        <div className="statusbar-item clickable" onClick={onAboutClick} title="About BrickForge">
          <Info size={12} />
          <span>v{version}</span>
        </div>
      </div>
    </footer>
  )
}
