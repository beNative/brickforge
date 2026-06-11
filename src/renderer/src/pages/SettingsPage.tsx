import { useEffect, useState } from 'react'
import { FolderOpen, Save, Database, RefreshCw, FileArchive, AlertCircle, Cloud, Info } from 'lucide-react'
import ConflictResolutionModal from '../components/ConflictResolutionModal'

interface AppSettings {
  dbFolder: string
  dbName: string
}

interface SettingsPageProps {
  onSettingsSaved: () => void
}

export default function SettingsPage({ onSettingsSaved }: SettingsPageProps) {
  const [settings, setSettings] = useState<AppSettings>({ dbFolder: '', dbName: '' })
  const [loading, setLoading] = useState<boolean>(true)
  const [saving, setSaving] = useState<boolean>(false)
  const [message, setMessage] = useState<{ type: 'success' | 'error' | 'info'; text: string } | null>(null)
  
  // Maintenance states
  const [vacuuming, setVacuuming] = useState<boolean>(false)
  const [reindexing, setReindexing] = useState<boolean>(false)
  const [backingUp, setBackingUp] = useState<boolean>(false)
  const [restoring, setRestoring] = useState<boolean>(false)

  // Cloud Sync states
  const [syncConfig, setSyncConfig] = useState<{
    syncEnabled: boolean
    clientId: string
    clientSecret: string
    email: string | null
    syncAutoOnOpenClose: boolean
    conflictResolution: 'ask' | 'prefer-local' | 'prefer-cloud'
    lastCompletedAt: string | null
    syncDatabaseName: string
  }>({
    syncEnabled: false,
    clientId: '',
    clientSecret: '',
    email: null,
    syncAutoOnOpenClose: false,
    conflictResolution: 'ask',
    lastCompletedAt: null,
    syncDatabaseName: 'brickforge.db'
  })

  const [isConnecting, setIsConnecting] = useState(false)
  const [isDisconnecting, setIsDisconnecting] = useState(false)
  const [isSyncing, setIsSyncing] = useState(false)
  const [syncStatusMsg, setSyncStatusMsg] = useState<string | null>(null)
  const [syncStatusTone, setSyncStatusTone] = useState<'info' | 'success' | 'error'>('info')
  const [showSetupGuide, setShowSetupGuide] = useState(false)

  const [remoteDbs, setRemoteDbs] = useState<{ name: string; id: string; modifiedTime: string }[]>([])
  const [isLoadingDbs, setIsLoadingDbs] = useState(false)
  const [selectedDbName, setSelectedDbName] = useState('brickforge.db')
  const [customDbNameInput, setCustomDbNameInput] = useState('')
  const [isCustomNaming, setIsCustomNaming] = useState(false)
  const [dbNameError, setDbNameError] = useState<string | null>(null)

  const [conflictData, setConflictData] = useState<{
    localStats: any
    remoteStats: any
  } | null>(null)

  const loadSettings = async () => {
    try {
      setLoading(true)
      const res = await window.api.getSettings()
      if (res.success && res.settings) {
        setSettings(res.settings)
      } else {
        setMessage({ type: 'error', text: res.error || 'Failed to load settings.' })
      }
    } catch (e: any) {
      console.error(e)
      setMessage({ type: 'error', text: e.message || 'Error fetching settings.' })
    } finally {
      setLoading(false)
    }
  }

  const loadSyncConfig = async () => {
    try {
      const config = await window.api.syncGetConfig()
      setSyncConfig(config)
      if (config.syncDatabaseName) {
        setSelectedDbName(config.syncDatabaseName)
      }
      if (config.email) {
        fetchRemoteDbs(config)
      }
    } catch (err) {
      console.error('Failed to load sync config:', err)
    }
  }

  const fetchRemoteDbs = async (configOverride?: any) => {
    const activeConfig = configOverride || syncConfig
    if (!activeConfig.email) return
    setIsLoadingDbs(true)
    try {
      const result = await window.api.syncListRemoteDatabases()
      if (result.success && result.files) {
        setRemoteDbs(result.files)
      } else {
        console.warn('Failed to fetch remote databases:', result.error)
      }
    } catch (err) {
      console.error('Error fetching remote databases:', err)
    } finally {
      setIsLoadingDbs(false)
    }
  }

  useEffect(() => {
    loadSettings()
    loadSyncConfig()

    const unsubscribe = window.api.onSyncStatus((payload) => {
      if (payload.status === 'syncing') {
        setIsSyncing(true)
        setSyncStatusTone('info')
        setSyncStatusMsg(payload.message || 'Syncing...')
      } else if (payload.status === 'conflict') {
        setIsSyncing(false)
        setSyncStatusTone('error')
        setSyncStatusMsg('Sync conflict detected.')
      } else if (payload.status === 'error') {
        setIsSyncing(false)
        setSyncStatusTone('error')
        setSyncStatusMsg(payload.message || 'Sync failed.')
      } else {
        setIsSyncing(false)
        setSyncStatusTone('success')
        setSyncStatusMsg(payload.message || 'Sync complete.')
        loadSyncConfig()
      }
    })

    return unsubscribe
  }, [])

  const handleConnect = async () => {
    if (!syncConfig.clientId.trim() || !syncConfig.clientSecret.trim()) {
      setMessage({ type: 'error', text: 'Client ID and Client Secret are required to connect.' })
      return
    }

    setIsConnecting(true)
    setSyncStatusMsg('Connecting to Google Drive...')
    setSyncStatusTone('info')

    try {
      const result = await window.api.syncGoogleConnect(
        syncConfig.clientId.trim(),
        syncConfig.clientSecret.trim()
      )
      if (result.success && result.email) {
        setSyncConfig((prev) => ({
          ...prev,
          syncEnabled: true,
          email: result.email ?? null,
          clientId: syncConfig.clientId.trim(),
          clientSecret: syncConfig.clientSecret.trim()
        }))
        setSyncStatusTone('success')
        setSyncStatusMsg(`Successfully connected to ${result.email}`)
        const updatedConfig = { ...syncConfig, email: result.email }
        fetchRemoteDbs(updatedConfig)
      } else {
        const errorMsg = result.error || 'Connection failed.'
        setSyncStatusTone('error')
        setSyncStatusMsg(errorMsg)
      }
    } catch (err: any) {
      setSyncStatusTone('error')
      setSyncStatusMsg(err.message || 'Connection failed.')
    } finally {
      setIsConnecting(false)
    }
  }

  const handleDisconnect = async () => {
    setIsDisconnecting(true)
    try {
      const result = await window.api.syncGoogleDisconnect()
      if (result.success) {
        setSyncConfig((prev) => ({
          ...prev,
          syncEnabled: false,
          email: null,
          lastCompletedAt: null
        }))
        setSyncStatusMsg('Disconnected successfully.')
        setSyncStatusTone('success')
        setRemoteDbs([])
      } else {
        setSyncStatusTone('error')
        setSyncStatusMsg(result.error || 'Failed to disconnect.')
      }
    } catch (err: any) {
      setSyncStatusTone('error')
      setSyncStatusMsg(err.message || 'Disconnection failed.')
    } finally {
      setIsDisconnecting(false)
    }
  }

  const handleSaveSyncConfig = async (updatedFields: Partial<typeof syncConfig>) => {
    const newConfig = { ...syncConfig, ...updatedFields }
    setSyncConfig(newConfig)
    try {
      const res = await window.api.syncSaveConfig(newConfig)
      if (!res.success) {
        setMessage({ type: 'error', text: res.error || 'Failed to save sync configuration.' })
      }
    } catch (err: any) {
      setMessage({ type: 'error', text: err.message || 'Error saving sync configuration.' })
    }
  }

  const handleSyncNow = async () => {
    setIsSyncing(true)
    setSyncStatusMsg('Synchronizing...')
    setSyncStatusTone('info')

    try {
      const result = await window.api.syncRun()
      if (result.success) {
        if (result.code === 'conflict' && result.localStats && result.remoteStats) {
          setConflictData({
            localStats: result.localStats,
            remoteStats: result.remoteStats
          })
          setSyncStatusMsg('Conflict detected between local and cloud databases.')
          setSyncStatusTone('error')
        } else {
          setSyncStatusTone('success')
          setSyncStatusMsg(result.message || 'Sync completed successfully.')
          loadSyncConfig()
        }
      } else {
        setSyncStatusTone('error')
        setSyncStatusMsg(result.error || 'Synchronization failed.')
      }
    } catch (err: any) {
      setSyncStatusTone('error')
      setSyncStatusMsg(err.message || 'Sync execution failed.')
    } finally {
      setIsSyncing(false)
    }
  }

  const handleResolveConflict = async (resolution: 'local' | 'remote') => {
    setIsSyncing(true)
    setConflictData(null)
    setSyncStatusMsg(`Resolving conflict using ${resolution} database...`)
    setSyncStatusTone('info')

    try {
      const result = await window.api.syncResolveConflict(resolution)
      if (result.success) {
        setSyncStatusTone('success')
        setSyncStatusMsg(result.message || 'Conflict resolved successfully.')
        loadSyncConfig()
      } else {
        setSyncStatusTone('error')
        setSyncStatusMsg(result.error || 'Failed to resolve conflict.')
      }
    } catch (err: any) {
      setSyncStatusTone('error')
      setSyncStatusMsg(err.message || 'Failed to resolve conflict.')
    } finally {
      setIsSyncing(false)
    }
  }

  const handleBrowseFolder = async () => {
    try {
      const selected = await window.api.selectDbFolder()
      if (selected) {
        setSettings((prev) => ({ ...prev, dbFolder: selected }))
      }
    } catch (e: any) {
      console.error(e)
    }
  }

  const handleSaveSettings = async () => {
    if (!settings.dbFolder.trim()) {
      setMessage({ type: 'error', text: 'Database folder cannot be empty.' })
      return
    }
    if (!settings.dbName.trim()) {
      setMessage({ type: 'error', text: 'Database name cannot be empty.' })
      return
    }
    if (!settings.dbName.endsWith('.db')) {
      setMessage({ type: 'error', text: 'Database file name must end with .db extension.' })
      return
    }

    try {
      setSaving(true)
      setMessage(null)
      const res = await window.api.updateSettings(settings)
      if (res.success) {
        setMessage({ type: 'success', text: 'Settings saved successfully. Database reconnected!' })
        onSettingsSaved()
      } else {
        setMessage({ type: 'error', text: res.error || 'Failed to update settings.' })
      }
    } catch (e: any) {
      console.error(e)
      setMessage({ type: 'error', text: e.message || 'Error saving settings.' })
    } finally {
      setSaving(false)
    }
  }

  const handleVacuum = async () => {
    try {
      setVacuuming(true)
      setMessage({ type: 'info', text: 'Optimizing database size...' })
      const res = await window.api.vacuumDatabase()
      if (res.success) {
        setMessage({ type: 'success', text: 'Database vacuum completed successfully!' })
      } else {
        setMessage({ type: 'error', text: res.error || 'VACUUM command failed.' })
      }
    } catch (e: any) {
      setMessage({ type: 'error', text: e.message || 'Error executing vacuum.' })
    } finally {
      setVacuuming(false)
    }
  }

  const handleReindex = async () => {
    try {
      setReindexing(true)
      setMessage({ type: 'info', text: 'Rebuilding database indexes...' })
      const res = await window.api.reindexDatabase()
      if (res.success) {
        setMessage({ type: 'success', text: 'Database indexes rebuilt successfully!' })
      } else {
        setMessage({ type: 'error', text: res.error || 'REINDEX command failed.' })
      }
    } catch (e: any) {
      setMessage({ type: 'error', text: e.message || 'Error executing reindex.' })
    } finally {
      setReindexing(false)
    }
  }

  const handleBackup = async () => {
    try {
      setBackingUp(true)
      setMessage(null)
      const res = await window.api.backupDatabase()
      if (res.success) {
        setMessage({ type: 'success', text: 'Database backup ZIP archive generated successfully!' })
      } else if (res.error) {
        setMessage({ type: 'error', text: res.error })
      }
    } catch (e: any) {
      setMessage({ type: 'error', text: e.message || 'Error during database backup.' })
    } finally {
      setBackingUp(false)
    }
  }

  const handleRestore = async () => {
    try {
      const confirmRestore = confirm(
        'WARNING: Restoring a database will overwrite your current active database. Are you sure you want to proceed?'
      )
      if (!confirmRestore) return

      setRestoring(true)
      setMessage(null)
      const res = await window.api.restoreDatabase()
      if (res.success) {
        setMessage({ type: 'success', text: 'Database restored successfully from backup ZIP!' })
        onSettingsSaved()
      } else if (res.error) {
        setMessage({ type: 'error', text: res.error })
      }
    } catch (e: any) {
      setMessage({ type: 'error', text: e.message || 'Error during database restore.' })
    } finally {
      setRestoring(false)
    }
  }

  if (loading) {
    return (
      <div className="flex-center" style={{ height: '300px' }}>
        <RefreshCw className="animate-spin" size={24} />
        <span style={{ marginLeft: '10px' }}>Loading settings...</span>
      </div>
    )
  }

  return (
    <div className="page-container animate-fade-in" style={{ maxWidth: '800px' }}>
      <div>
        <h1>Application Settings</h1>
        <p className="subtitle">Configure database location, perform backups, and optimize settings.</p>
      </div>

      <div className="page-content-scroll" style={{ gap: '20px' }}>
        {message && (
        <div className={`settings-alert ${message.type}`}>
          <AlertCircle size={14} style={{ marginTop: '2px', flexShrink: 0 }} />
          <span>{message.text}</span>
        </div>
      )}

      {/* Database Location Configuration */}
      <div className="glass-panel settings-card">
        <h2 className="settings-section-title">
          <Database size={13} style={{ marginRight: '6px', verticalAlign: 'middle' }} />
          Database Connection
        </h2>

        <div className="settings-row">
          <label className="form-label">Database Directory Path</label>
          <div className="settings-input-group">
            <input
              type="text"
              className="form-input"
              value={settings.dbFolder}
              onChange={(e) => setSettings((prev) => ({ ...prev, dbFolder: e.target.value }))}
              placeholder="e.g. C:\Users\name\AppData\Roaming\brickforge"
            />
            <button className="btn btn-secondary" onClick={handleBrowseFolder} title="Browse database folder">
              <FolderOpen size={14} />
              <span>Browse</span>
            </button>
          </div>
        </div>

        <div className="settings-row" style={{ marginBottom: '24px' }}>
          <label className="form-label">Database File Name</label>
          <input
            type="text"
            className="form-input"
            value={settings.dbName}
            onChange={(e) => setSettings((prev) => ({ ...prev, dbName: e.target.value }))}
            placeholder="e.g. brickforge.db"
          />
        </div>

        <div className="settings-actions">
          <button className="btn btn-primary" onClick={handleSaveSettings} disabled={saving}>
            <Save size={14} />
            <span>{saving ? 'Applying...' : 'Apply & Reconnect'}</span>
          </button>
        </div>
      </div>

      {/* Backup and Restore */}
      <div className="glass-panel settings-card">
        <h2 className="settings-section-title">
          <FileArchive size={13} style={{ marginRight: '6px', verticalAlign: 'middle' }} />
          Backup & Restore
        </h2>
        <p className="subtitle" style={{ marginBottom: '16px' }}>
          Export or import your complete database (including sessions, parts checklist, cache) using native ZIP archives.
        </p>

        <div className="maintenance-grid">
          <div className="maintenance-card">
            <div>
              <div className="maintenance-card-title">Database Backup</div>
              <div className="maintenance-card-desc">
                Creates a backup of the database in a compressed ZIP file. Perfect for sharing or manual safety backups.
              </div>
            </div>
            <button className="btn btn-secondary btn-sm" onClick={handleBackup} disabled={backingUp}>
              {backingUp ? <RefreshCw className="animate-spin" size={12} /> : null}
              <span>Backup to ZIP</span>
            </button>
          </div>

          <div className="maintenance-card">
            <div>
              <div className="maintenance-card-title">Database Restore</div>
              <div className="maintenance-card-desc">
                Restores a database file from a previously saved ZIP backup. Overwrites the current active database!
              </div>
            </div>
            <button className="btn btn-danger btn-sm" onClick={handleRestore} disabled={restoring}>
              {restoring ? <RefreshCw className="animate-spin" size={12} /> : null}
              <span>Restore from ZIP</span>
            </button>
          </div>
        </div>
      </div>

      {/* Database Maintenance */}
      <div className="glass-panel settings-card">
        <h2 className="settings-section-title">
          <RefreshCw size={13} style={{ marginRight: '6px', verticalAlign: 'middle' }} />
          Database Maintenance
        </h2>
        <p className="subtitle" style={{ marginBottom: '16px' }}>
          Execute SQL maintenance commands directly on the database to improve query speed and clean up deleted records.
        </p>

        <div className="maintenance-grid">
          <div className="maintenance-card">
            <div>
              <div className="maintenance-card-title">Optimize DB (VACUUM)</div>
              <div className="maintenance-card-desc">
                Cleans up unused database space, shrinks the size of the database file on disk, and defragments storage.
              </div>
            </div>
            <button className="btn btn-secondary btn-sm" onClick={handleVacuum} disabled={vacuuming}>
              {vacuuming ? <RefreshCw className="animate-spin" size={12} /> : null}
              <span>Optimize Database</span>
            </button>
          </div>

          <div className="maintenance-card">
            <div>
              <div className="maintenance-card-title">Rebuild Indexes (REINDEX)</div>
              <div className="maintenance-card-desc">
                Rebuilds the database indexes. Execute this if search queries feel slow or database index corruption is suspected.
              </div>
            </div>
            <button className="btn btn-secondary btn-sm" onClick={handleReindex} disabled={reindexing}>
              {reindexing ? <RefreshCw className="animate-spin" size={12} /> : null}
              <span>Rebuild Indexes</span>
            </button>
          </div>
        </div>
      </div>

      {/* Cloud Synchronization Section */}
      <div className="glass-panel settings-card">
        <h2 className="settings-section-title">
          <Cloud size={13} style={{ marginRight: '6px', verticalAlign: 'middle' }} />
          Cloud Database Sync (Google Drive)
        </h2>
        <p className="subtitle" style={{ marginBottom: '16px' }}>
          Securely backup and synchronize your database to a private application folder on Google Drive.
        </p>

        {/* Collapsible Guide */}
        <div style={{
          marginBottom: '20px',
          padding: '12px',
          background: 'rgba(255, 255, 255, 0.02)',
          border: '1px solid var(--border-glass)',
          borderRadius: '4px',
          fontSize: '11px'
        }}>
          <div
            onClick={() => setShowSetupGuide(!showSetupGuide)}
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              cursor: 'pointer',
              fontWeight: 600,
              color: 'var(--text-secondary)'
            }}
          >
            <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <Info size={13} style={{ color: 'var(--primary)' }} />
              First-Time Google Drive API Setup Guide
            </span>
            <span style={{ fontSize: '10px', textTransform: 'uppercase', opacity: 0.8 }}>
              {showSetupGuide ? 'Hide' : 'Show'}
            </span>
          </div>

          {showSetupGuide && (
            <div style={{ marginTop: '12px', borderTop: '1px solid var(--border-glass)', paddingTop: '10px', color: 'var(--text-secondary)', lineHeight: 1.5 }}>
              <p style={{ marginBottom: '8px' }}>
                BrickForge uses your own Google Cloud Console credentials to sync your SQLite database to a secure private sandbox on your Google Drive:
              </p>
              <ol style={{ paddingLeft: '16px', margin: '0 0 10px 0', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <li>Go to the <a href="https://console.cloud.google.com/" target="_blank" rel="noopener noreferrer" style={{ color: 'var(--primary)', textDecoration: 'underline' }}>Google Cloud Console</a> and create a project.</li>
                <li>Search for <strong>Google Drive API</strong> in the API Library and enable it for your project.</li>
                <li>Go to OAuth Consent Screen, set up an External screen, add scope <code style={{ background: 'rgba(0,0,0,0.3)', padding: '1px 4px', borderRadius: '3px' }}>.../auth/drive.appdata</code>, and add your email as a Test User.</li>
                <li>Go to Credentials, click Create Credentials &gt; OAuth Client ID. Choose <strong>Desktop Application</strong> as the type.</li>
                <li>Copy the generated Client ID and Client Secret, paste them below, and click Connect Account.</li>
              </ol>
              <div style={{ background: 'rgba(0, 122, 204, 0.05)', padding: '8px 12px', borderRadius: '3px', borderLeft: '3px solid var(--primary)' }}>
                <strong>🔒 Sandbox Security:</strong> BrickForge has zero access to your other Google Drive files. It works entirely within an isolated application data space.
              </div>
            </div>
          )}
        </div>

        {/* Credentials row */}
        <div className="settings-row">
          <label className="form-label">Google Client ID</label>
          <input
            type="text"
            className="form-input"
            value={syncConfig.clientId}
            onChange={(e) => setSyncConfig(prev => ({ ...prev, clientId: e.target.value }))}
            disabled={isConnecting || isDisconnecting || isSyncing || !!syncConfig.email}
            placeholder="Enter OAuth Client ID"
            style={{ padding: '8px 12px', fontSize: '12px' }}
          />
        </div>

        <div className="settings-row" style={{ marginBottom: '20px' }}>
          <label className="form-label">Google Client Secret</label>
          <input
            type="password"
            className="form-input"
            value={syncConfig.clientSecret}
            onChange={(e) => setSyncConfig(prev => ({ ...prev, clientSecret: e.target.value }))}
            disabled={isConnecting || isDisconnecting || isSyncing || !!syncConfig.email}
            placeholder="Enter OAuth Client Secret"
            style={{ padding: '8px 12px', fontSize: '12px' }}
          />
        </div>

        {/* OAuth Authentication Connection Status */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px', borderTop: '1px solid var(--border-glass)', paddingTop: '16px' }}>
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            <span className="form-label" style={{ fontSize: '12px', marginBottom: '2px' }}>Authentication Status</span>
            <span style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>
              {syncConfig.email ? (
                <span className="badge badge-complete" style={{ fontSize: '10px', textTransform: 'none' }}>
                  Connected: {syncConfig.email}
                </span>
              ) : (
                'Not connected to Google Drive'
              )}
            </span>
          </div>
          <div>
            {syncConfig.email ? (
              <button
                className="btn btn-secondary btn-sm"
                onClick={handleDisconnect}
                disabled={isDisconnecting || isSyncing}
              >
                {isDisconnecting ? 'Disconnecting...' : 'Disconnect Account'}
              </button>
            ) : (
              <button
                className="btn btn-primary btn-sm"
                onClick={handleConnect}
                disabled={isConnecting || !syncConfig.clientId.trim() || !syncConfig.clientSecret.trim()}
              >
                {isConnecting ? 'Connecting...' : 'Connect Account'}
              </button>
            )}
          </div>
        </div>

        {/* Sync Controls (Visible only when connected) */}
        {syncConfig.email && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', borderTop: '1px solid var(--border-glass)', paddingTop: '16px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <span className="form-label" style={{ display: 'block', fontSize: '12px' }}>Enable Cloud Sync</span>
                <span style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>
                  Keep cloud synchronization active and auto-update metadata.
                </span>
              </div>
              <input
                type="checkbox"
                checked={syncConfig.syncEnabled}
                onChange={(e) => handleSaveSyncConfig({ syncEnabled: e.target.checked })}
                style={{ width: '18px', height: '18px', cursor: 'pointer' }}
              />
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start' }}>
              <div style={{ maxWidth: '65%' }}>
                <span className="form-label" style={{ display: 'block', fontSize: '12px' }}>Google Drive Database File</span>
                <span style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>
                  Select the database filename to sync with or create a custom name.
                </span>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', width: '200px' }}>
                {!isCustomNaming ? (
                  <div style={{ display: 'flex', gap: '6px' }}>
                    <select
                      className="form-select"
                      value={selectedDbName}
                      onChange={(e) => {
                        const val = e.target.value
                        if (val === '__custom__') {
                          setIsCustomNaming(true)
                          setCustomDbNameInput('')
                          setDbNameError('Database name must end with .db')
                        } else {
                          setSelectedDbName(val)
                          handleSaveSyncConfig({ syncDatabaseName: val })
                        }
                      }}
                      style={{ padding: '6px 10px', fontSize: '11px', height: '32px', borderRadius: '4px' }}
                    >
                      <option value="brickforge.db">brickforge.db (Default)</option>
                      {selectedDbName !== 'brickforge.db' && !remoteDbs.some(d => d.name === selectedDbName) && (
                        <option value={selectedDbName}>{selectedDbName} (Configured)</option>
                      )}
                      {remoteDbs.map((d) => {
                        if (d.name === 'brickforge.db') return null
                        return (
                          <option key={d.id} value={d.name}>
                            {d.name} (Cloud)
                          </option>
                        )
                      })}
                      <option value="__custom__">+ Custom name...</option>
                    </select>
                    <button
                      className="btn btn-secondary btn-sm"
                      onClick={() => fetchRemoteDbs()}
                      disabled={isLoadingDbs}
                      title="Refresh remote database files list"
                      style={{ width: '32px', height: '32px', padding: 0 }}
                    >
                      {isLoadingDbs ? <RefreshCw className="animate-spin" size={12} /> : '🔄'}
                    </button>
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                    <div style={{ display: 'flex', gap: '4px' }}>
                      <input
                        type="text"
                        className="form-input"
                        value={customDbNameInput}
                        onChange={(e) => {
                          const val = e.target.value
                          setCustomDbNameInput(val)
                          if (!val.trim()) {
                            setDbNameError('Name cannot be empty')
                          } else if (!val.toLowerCase().endsWith('.db')) {
                            setDbNameError('Must end with .db')
                          } else {
                            setDbNameError(null)
                          }
                        }}
                        placeholder="e.g. brickforge-sync.db"
                        style={{ padding: '6px 10px', fontSize: '11px', height: '32px', borderRadius: '4px' }}
                      />
                      <button
                        className="btn btn-primary btn-sm"
                        onClick={() => {
                          if (!dbNameError && customDbNameInput.trim()) {
                            const name = customDbNameInput.trim()
                            setSelectedDbName(name)
                            handleSaveSyncConfig({ syncDatabaseName: name })
                            setIsCustomNaming(false)
                          }
                        }}
                        disabled={!!dbNameError || !customDbNameInput.trim()}
                        style={{ height: '32px' }}
                      >
                        Apply
                      </button>
                      <button
                        className="btn btn-secondary btn-sm"
                        onClick={() => setIsCustomNaming(false)}
                        style={{ height: '32px' }}
                      >
                        X
                      </button>
                    </div>
                    {dbNameError && (
                      <span style={{ fontSize: '9px', color: 'var(--status-missing)' }}>
                        {dbNameError}
                      </span>
                    )}
                  </div>
                )}
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <span className="form-label" style={{ display: 'block', fontSize: '12px' }}>Sync on Startup & Shutdown</span>
                <span style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>
                  Automatically sync changes when opening or closing BrickForge.
                </span>
              </div>
              <input
                type="checkbox"
                checked={syncConfig.syncAutoOnOpenClose}
                onChange={(e) => handleSaveSyncConfig({ syncAutoOnOpenClose: e.target.checked })}
                style={{ width: '18px', height: '18px', cursor: 'pointer' }}
              />
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <span className="form-label" style={{ display: 'block', fontSize: '12px' }}>Conflict Resolution Policy</span>
                <span style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>
                  Preferred action when database versions diverge on local and cloud.
                </span>
              </div>
              <select
                className="form-select"
                value={syncConfig.conflictResolution}
                onChange={(e) => handleSaveSyncConfig({ conflictResolution: e.target.value as any })}
                style={{ width: '180px', padding: '6px 10px', fontSize: '11px', height: '32px', borderRadius: '4px' }}
              >
                <option value="ask">Ask (Show dialog)</option>
                <option value="prefer-local">Prefer Local</option>
                <option value="prefer-cloud">Prefer Cloud</option>
              </select>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '10px', borderTop: '1px solid var(--border-glass)', paddingTop: '16px' }}>
              <div style={{ display: 'flex', flexDirection: 'column' }}>
                <span className="form-label" style={{ fontSize: '12px', marginBottom: '2px' }}>Manual Sync</span>
                <span style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>
                  {syncConfig.lastCompletedAt
                    ? `Last synced: ${new Date(syncConfig.lastCompletedAt).toLocaleString()}`
                    : 'Never synchronized before'}
                </span>
              </div>
              <div>
                <button
                  className="btn btn-secondary btn-sm"
                  onClick={handleSyncNow}
                  disabled={isSyncing || !syncConfig.syncEnabled}
                >
                  {isSyncing ? <RefreshCw className="animate-spin" size={12} style={{ marginRight: '4px' }} /> : null}
                  <span>Sync Now</span>
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Sync Status Logs / Messages */}
        {syncStatusMsg && (
          <div
            className={`settings-alert ${syncStatusTone === 'error' ? 'error' : syncStatusTone === 'success' ? 'success' : 'info'}`}
            style={{ margin: '16px 0 0 0', padding: '10px 14px', fontSize: '12px', borderRadius: '4px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}
          >
            <span>{syncStatusMsg}</span>
            {isSyncing && <RefreshCw className="animate-spin" size={12} />}
          </div>
        )}
      </div>

      {conflictData && (
        <ConflictResolutionModal
          localStats={conflictData.localStats}
          remoteStats={conflictData.remoteStats}
          onResolve={handleResolveConflict}
          onClose={() => setConflictData(null)}
        />
      )}
      </div>
    </div>
  )
}
