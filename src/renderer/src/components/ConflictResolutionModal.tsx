import { AlertTriangle } from 'lucide-react'

interface DbStats {
  fileSize: string
  userCollectionCount: number
  checkSessionsCount: number
  setNotesCount: number
  modifiedTime: string
}

interface ConflictResolutionModalProps {
  localStats: DbStats
  remoteStats: DbStats
  onResolve: (resolution: 'local' | 'remote') => void
  onClose: () => void
}

export default function ConflictResolutionModal({
  localStats,
  remoteStats,
  onResolve,
  onClose
}: ConflictResolutionModalProps) {
  const localDate = new Date(localStats.modifiedTime)
  const remoteDate = new Date(remoteStats.modifiedTime)

  const isLocalNewer = localDate.getTime() > remoteDate.getTime()
  const isRemoteNewer = remoteDate.getTime() > localDate.getTime()

  return (
    <div className="modal-overlay" style={{ zIndex: 999999 }}>
      <div
        className="glass-panel modal-content"
        style={{
          maxWidth: '650px',
          width: '90%',
          padding: '24px',
          display: 'flex',
          flexDirection: 'column',
          gap: '20px',
          animation: 'modalScaleIn 0.2s cubic-bezier(0.34, 1.56, 0.64, 1)'
        }}
      >
        {/* Title */}
        <div style={{ display: 'flex', gap: '14px', alignItems: 'center' }}>
          <div
            style={{
              color: 'var(--status-partial)',
              background: 'var(--status-partial-bg)',
              padding: '8px',
              borderRadius: '8px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0
            }}
          >
            <AlertTriangle size={24} />
          </div>
          <div>
            <h3 style={{ margin: 0, fontSize: '18px', fontWeight: 700 }}>
              Database Sync Conflict Detected
            </h3>
            <p style={{ margin: '4px 0 0 0', fontSize: '12px', color: 'var(--text-secondary)' }}>
              Both your local database and the cloud database have been modified independently.
            </p>
          </div>
        </div>

        {/* Warning Alert */}
        <div
          className="settings-alert info"
          style={{ padding: '10px 14px', margin: 0, fontSize: '12px', borderRadius: '4px' }}
        >
          <span>
            Please select which version you would like to keep. The other version will be overwritten.
          </span>
        </div>

        {/* Comparison grid */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: '1fr 1fr',
            gap: '16px',
            marginTop: '4px'
          }}
        >
          {/* Local Stats */}
          <div
            className="glass-panel"
            style={{
              padding: '16px',
              borderRadius: '6px',
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'between',
              border: isLocalNewer ? '1px solid var(--primary)' : '1px solid var(--border-glass)',
              background: isLocalNewer ? 'rgba(0, 122, 204, 0.05)' : 'var(--bg-surface-solid)'
            }}
          >
            <div>
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  marginBottom: '14px'
                }}
              >
                <h4 style={{ margin: 0, fontSize: '14px', fontWeight: 600 }}>Local Database</h4>
                {isLocalNewer && (
                  <span
                    className="badge badge-complete"
                    style={{ fontSize: '9px', padding: '1px 5px' }}
                  >
                    Newer
                  </span>
                )}
              </div>

              <ul style={{ listStyle: 'none', padding: 0, margin: 0, fontSize: '12px' }}>
                <li
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    padding: '8px 0',
                    borderBottom: '1px solid rgba(255,255,255,0.05)'
                  }}
                >
                  <span style={{ color: 'var(--text-secondary)' }}>Last Modified:</span>
                  <span style={{ fontWeight: 600 }}>{localDate.toLocaleString()}</span>
                </li>
                <li
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    padding: '8px 0',
                    borderBottom: '1px solid rgba(255,255,255,0.05)'
                  }}
                >
                  <span style={{ color: 'var(--text-secondary)' }}>File Size:</span>
                  <span style={{ fontWeight: 600 }}>{localStats.fileSize}</span>
                </li>
                <li
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    padding: '8px 0',
                    borderBottom: '1px solid rgba(255,255,255,0.05)'
                  }}
                >
                  <span style={{ color: 'var(--text-secondary)' }}>Sets in Collection:</span>
                  <span style={{ fontWeight: 600 }}>{localStats.userCollectionCount}</span>
                </li>
                <li
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    padding: '8px 0',
                    borderBottom: '1px solid rgba(255,255,255,0.05)'
                  }}
                >
                  <span style={{ color: 'var(--text-secondary)' }}>Check Sessions:</span>
                  <span style={{ fontWeight: 600 }}>{localStats.checkSessionsCount}</span>
                </li>
                <li
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    padding: '8px 0'
                  }}
                >
                  <span style={{ color: 'var(--text-secondary)' }}>Notes Count:</span>
                  <span style={{ fontWeight: 600 }}>{localStats.setNotesCount}</span>
                </li>
              </ul>
            </div>

            <button
              className={`btn ${isLocalNewer ? 'btn-primary' : 'btn-secondary'}`}
              style={{ width: '100%', marginTop: '20px', height: '34px' }}
              onClick={() => onResolve('local')}
            >
              Keep Local (Overwrite Cloud)
            </button>
          </div>

          {/* Cloud Stats */}
          <div
            className="glass-panel"
            style={{
              padding: '16px',
              borderRadius: '6px',
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'between',
              border: isRemoteNewer ? '1px solid var(--primary)' : '1px solid var(--border-glass)',
              background: isRemoteNewer ? 'rgba(0, 122, 204, 0.05)' : 'var(--bg-surface-solid)'
            }}
          >
            <div>
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  marginBottom: '14px'
                }}
              >
                <h4 style={{ margin: 0, fontSize: '14px', fontWeight: 600 }}>Cloud Database</h4>
                {isRemoteNewer && (
                  <span
                    className="badge badge-complete"
                    style={{ fontSize: '9px', padding: '1px 5px' }}
                  >
                    Newer
                  </span>
                )}
              </div>

              <ul style={{ listStyle: 'none', padding: 0, margin: 0, fontSize: '12px' }}>
                <li
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    padding: '8px 0',
                    borderBottom: '1px solid rgba(255,255,255,0.05)'
                  }}
                >
                  <span style={{ color: 'var(--text-secondary)' }}>Last Modified:</span>
                  <span style={{ fontWeight: 600 }}>{remoteDate.toLocaleString()}</span>
                </li>
                <li
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    padding: '8px 0',
                    borderBottom: '1px solid rgba(255,255,255,0.05)'
                  }}
                >
                  <span style={{ color: 'var(--text-secondary)' }}>File Size:</span>
                  <span style={{ fontWeight: 600 }}>{remoteStats.fileSize}</span>
                </li>
                <li
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    padding: '8px 0',
                    borderBottom: '1px solid rgba(255,255,255,0.05)'
                  }}
                >
                  <span style={{ color: 'var(--text-secondary)' }}>Sets in Collection:</span>
                  <span style={{ fontWeight: 600 }}>{remoteStats.userCollectionCount}</span>
                </li>
                <li
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    padding: '8px 0',
                    borderBottom: '1px solid rgba(255,255,255,0.05)'
                  }}
                >
                  <span style={{ color: 'var(--text-secondary)' }}>Check Sessions:</span>
                  <span style={{ fontWeight: 600 }}>{remoteStats.checkSessionsCount}</span>
                </li>
                <li
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    padding: '8px 0'
                  }}
                >
                  <span style={{ color: 'var(--text-secondary)' }}>Notes Count:</span>
                  <span style={{ fontWeight: 600 }}>{remoteStats.setNotesCount}</span>
                </li>
              </ul>
            </div>

            <button
              className={`btn ${isRemoteNewer ? 'btn-primary' : 'btn-secondary'}`}
              style={{ width: '100%', marginTop: '20px', height: '34px' }}
              onClick={() => onResolve('remote')}
            >
              Keep Cloud (Overwrite Local)
            </button>
          </div>
        </div>

        {/* Footer */}
        <div
          style={{
            display: 'flex',
            justifyContent: 'flex-end',
            marginTop: '8px',
            borderTop: '1px solid var(--border-glass)',
            paddingTop: '16px'
          }}
        >
          <button
            className="btn btn-secondary"
            style={{ height: '34px', minWidth: '100px' }}
            onClick={onClose}
          >
            Resolve Later
          </button>
        </div>
      </div>
    </div>
  )
}
