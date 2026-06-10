import { useEffect, useState } from 'react'
import { FolderOpen, Save, Database, RefreshCw, FileArchive, AlertCircle } from 'lucide-react'

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

  useEffect(() => {
    loadSettings()
  }, [])

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
      </div>
    </div>
  )
}
