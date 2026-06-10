import { useState, useEffect } from 'react'
import {
  AlertTriangle,
  CheckCircle,
  Database,
  FolderOpen,
  Loader2,
  Search,
  XCircle
} from 'lucide-react'
import { useDialog } from '../components/CustomDialog'

interface TableImportState {
  name: string
  key: string
  required: boolean
  filePath: string | null
  status: 'idle' | 'importing' | 'completed' | 'failed'
  progress: number
  successCount: number
  errorCount: number
  errors: string[]
}

interface ImportPageProps {
  onImportSuccess: () => void
}

export default function ImportPage({ onImportSuccess }: ImportPageProps) {
  const dialog = useDialog()
  const [searchQuery, setSearchQuery] = useState('')
  const [tables, setTables] = useState<TableImportState[]>([
    {
      name: 'Colors (colors.csv)',
      key: 'colors',
      required: true,
      filePath: null,
      status: 'idle',
      progress: 0,
      successCount: 0,
      errorCount: 0,
      errors: []
    },
    {
      name: 'Part Categories (part_categories.csv)',
      key: 'part_categories',
      required: true,
      filePath: null,
      status: 'idle',
      progress: 0,
      successCount: 0,
      errorCount: 0,
      errors: []
    },
    {
      name: 'Parts (parts.csv)',
      key: 'parts',
      required: true,
      filePath: null,
      status: 'idle',
      progress: 0,
      successCount: 0,
      errorCount: 0,
      errors: []
    },
    {
      name: 'Themes (themes.csv)',
      key: 'themes',
      required: false,
      filePath: null,
      status: 'idle',
      progress: 0,
      successCount: 0,
      errorCount: 0,
      errors: []
    },
    {
      name: 'Sets (sets.csv)',
      key: 'sets',
      required: true,
      filePath: null,
      status: 'idle',
      progress: 0,
      successCount: 0,
      errorCount: 0,
      errors: []
    },
    {
      name: 'Inventories (inventories.csv)',
      key: 'inventories',
      required: true,
      filePath: null,
      status: 'idle',
      progress: 0,
      successCount: 0,
      errorCount: 0,
      errors: []
    },
    {
      name: 'Inventory Parts (inventory_parts.csv)',
      key: 'inventory_parts',
      required: true,
      filePath: null,
      status: 'idle',
      progress: 0,
      successCount: 0,
      errorCount: 0,
      errors: []
    }
  ])

  const [globalImporting, setGlobalImporting] = useState(false)
  const [cacheStats, setCacheStats] = useState<{
    totalImages: number
    totalSizeBytes: number
  } | null>(null)
  const [clearingCache, setClearingCache] = useState(false)
  const [expandedErrors, setExpandedErrors] = useState<Record<string, boolean>>({})

  const loadCacheStats = async () => {
    try {
      const res = await window.api.getImageCacheStats()
      if (res.success && res.stats) {
        setCacheStats(res.stats)
      }
    } catch (e) {
      console.error('Failed to load cache stats', e)
    }
  }

  useEffect(() => {
    loadCacheStats()
  }, [])

  const handleClearCache = async () => {
    if (
      !(await dialog.confirm(
        'Are you sure you want to clear the entire image cache? All cached offline images will be permanently deleted.'
      ))
    ) {
      return
    }
    setClearingCache(true)
    try {
      const res = await window.api.clearImageCache()
      if (res.success) {
        await dialog.alert('Image cache cleared successfully.')
        loadCacheStats()
      } else {
        await dialog.alert('Failed to clear image cache: ' + res.error)
      }
    } catch (e: any) {
      await dialog.alert('Error: ' + e.message)
    } finally {
      setClearingCache(false)
    }
  }

  const handleAutoDetectFolder = async () => {
    try {
      const filePath = await window.api.selectCsvFile()
      if (!filePath) return

      const lastSlashIndex = Math.max(filePath.lastIndexOf('\\'), filePath.lastIndexOf('/'))
      if (lastSlashIndex === -1) return
      const dirPath = filePath.substring(0, lastSlashIndex + 1)

      const fileNamesMap: Record<string, string> = {
        colors: 'colors.csv',
        part_categories: 'part_categories.csv',
        parts: 'parts.csv',
        themes: 'themes.csv',
        sets: 'sets.csv',
        inventories: 'inventories.csv',
        inventory_parts: 'inventory_parts.csv'
      }

      setTables((prev) =>
        prev.map((t) => {
          const expectedName = fileNamesMap[t.key]
          if (!expectedName) return t

          return {
            ...t,
            filePath: `${dirPath}${expectedName}`,
            status: 'idle',
            progress: 0,
            successCount: 0,
            errorCount: 0,
            errors: []
          }
        })
      )
    } catch (e: any) {
      await dialog.alert('Failed to auto-detect files: ' + e.message)
    }
  }

  const handleClearAllSelections = () => {
    setTables((prev) =>
      prev.map((t) => ({
        ...t,
        filePath: null,
        status: 'idle',
        progress: 0,
        successCount: 0,
        errorCount: 0,
        errors: []
      }))
    )
  }

  // Register progress listener
  useEffect(() => {
    const unsubscribe = window.api.onImportProgress((data) => {
      setTables((prev) =>
        prev.map((t) => {
          if (t.key === data.type) {
            return { ...t, progress: data.current }
          }
          return t
        })
      )
    })

    return () => unsubscribe()
  }, [])

  const handleSelectFile = async (key: string) => {
    try {
      const filePath = await window.api.selectCsvFile()
      if (!filePath) return

      setTables((prev) =>
        prev.map((t) => {
          if (t.key === key) {
            return {
              ...t,
              filePath: filePath,
              status: 'idle',
              progress: 0,
              successCount: 0,
              errorCount: 0,
              errors: []
            }
          }
          return t
        })
      )
    } catch (e) {
      console.error('Failed to select file', e)
    }
  }

  const triggerImport = async (key: string) => {
    const table = tables.find((t) => t.key === key)
    if (!table || !table.filePath) return

    setTables((prev) =>
      prev.map((t) => (t.key === key ? { ...t, status: 'importing', progress: 0 } : t))
    )

    try {
      const res = await window.api.importCsv(table.filePath, key)
      if (res.success && res.result) {
        setTables((prev) =>
          prev.map((t) => {
            if (t.key === key) {
              return {
                ...t,
                status: 'completed',
                progress: 100,
                successCount: res.result.successCount,
                errorCount: res.result.errorCount,
                errors: res.result.errors
              }
            }
            return t
          })
        )
      } else {
        setTables((prev) =>
          prev.map((t) => {
            if (t.key === key) {
              return {
                ...t,
                status: 'failed',
                errors: [res.error || 'Import failed with unknown error.']
              }
            }
            return t
          })
        )
      }
    } catch (e: any) {
      setTables((prev) =>
        prev.map((t) => {
          if (t.key === key) {
            return {
              ...t,
              status: 'failed',
              errors: [e.message]
            }
          }
          return t
        })
      )
    }
  }

  const handleImportAll = async () => {
    const selectedTables = tables.filter((t) => t.filePath && t.status !== 'completed')
    if (selectedTables.length === 0) return

    setGlobalImporting(true)

    for (const table of selectedTables) {
      await triggerImport(table.key)
    }

    setGlobalImporting(false)
    onImportSuccess()
  }

  const filteredTables = tables.filter(
    (t) =>
      t.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      t.key.toLowerCase().includes(searchQuery.toLowerCase())
  )

  const activeSelections = tables.filter((t) => t.filePath !== null).length
  const requiredTables = tables.filter((t) => t.required)
  const selectedRequiredCount = requiredTables.filter((t) => t.filePath !== null).length
  const completedCount = tables.filter((t) => t.status === 'completed').length
  const failedCount = tables.filter((t) => t.status === 'failed').length
  const importingTable = tables.find((t) => t.status === 'importing')
  const importProgress =
    activeSelections > 0 ? Math.round((completedCount / activeSelections) * 100) : 0

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', flex: 1 }}>
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '12px'
        }}
      >
        <div>
          <h1 style={{ fontSize: '20px', margin: '0 0 4px 0' }}>Import LEGO Catalog Data</h1>
          <p className="subtitle" style={{ margin: 0, fontSize: '13px' }}>
            Select and import the Rebrickable CSV files into the local database.
          </p>
        </div>

        {activeSelections > 0 && (
          <button
            className="btn btn-primary"
            onClick={handleImportAll}
            disabled={globalImporting}
            style={{ height: '32px', padding: '6px 12px', fontSize: '12px' }}
          >
            {globalImporting ? (
              <>
                <Loader2 className="animate-spin" size={14} />
                <span>Importing Selected...</span>
              </>
            ) : (
              <>
                <Database size={14} />
                <span>Import {activeSelections} Selected Files</span>
              </>
            )}
          </button>
        )}
      </div>

      <div className="import-checklist-summary">
        <div className="glass-panel import-step-card recommended">
          <div className="import-step-icon">
            <FolderOpen size={16} />
          </div>
          <div>
            <span className="import-step-title">1. Select files</span>
            <span className="import-step-meta">
              {selectedRequiredCount}/{requiredTables.length} required files selected
            </span>
          </div>
        </div>
        <div className="glass-panel import-step-card">
          <div className="import-step-icon">
            <Database size={16} />
          </div>
          <div>
            <span className="import-step-title">2. Import catalog</span>
            <span className="import-step-meta">
              {completedCount}/{activeSelections || tables.length} selected files complete
            </span>
          </div>
        </div>
        <div className={`glass-panel import-step-card ${failedCount > 0 ? 'error' : ''}`}>
          <div className="import-step-icon">
            {failedCount > 0 ? <AlertTriangle size={16} /> : <CheckCircle size={16} />}
          </div>
          <div>
            <span className="import-step-title">3. Verify results</span>
            <span className="import-step-meta">
              {failedCount > 0
                ? `${failedCount} file imports need review`
                : 'No import failures reported'}
            </span>
          </div>
        </div>
      </div>

      {globalImporting && (
        <div className="glass-panel import-progress-summary">
          <div>
            <strong>Importing catalog data</strong>
            <span>
              {importingTable ? `Current file: ${importingTable.name}` : 'Preparing next file...'}
            </span>
          </div>
          <div className="import-progress-meter">
            <span>{importProgress}%</span>
            <div className="progress-track">
              <div className="progress-bar" style={{ width: `${importProgress}%` }}></div>
            </div>
          </div>
        </div>
      )}

      <div className="import-section">
        {/* Main Panel with global controls and grid */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {/* Global Controls Panel */}
          <div
            className="glass-panel"
            style={{
              padding: '8px 12px',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              gap: '12px',
              flexWrap: 'wrap'
            }}
          >
            <div
              style={{
                display: 'flex',
                gap: '8px',
                alignItems: 'center',
                flex: 1,
                minWidth: '200px'
              }}
            >
              <Search size={14} style={{ color: 'var(--text-secondary)' }} />
              <input
                type="text"
                className="form-input"
                placeholder="Filter files..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                style={{
                  padding: '5px 10px',
                  fontSize: '12px',
                  borderRadius: '4px',
                  width: '100%',
                  maxWidth: '240px',
                  height: '28px'
                }}
              />
              {searchQuery && (
                <button
                  className="btn btn-secondary btn-sm"
                  onClick={() => setSearchQuery('')}
                  style={{ padding: '2px 8px', fontSize: '11px', height: '24px' }}
                >
                  Clear
                </button>
              )}
            </div>

            <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
              <button
                className="btn btn-secondary btn-sm"
                onClick={handleAutoDetectFolder}
                style={{ height: '28px', fontSize: '11px', padding: '4px 10px' }}
              >
                <span>Auto-Fill from Folder</span>
              </button>
              {activeSelections > 0 && (
                <button
                  className="btn btn-secondary btn-sm btn-danger"
                  onClick={handleClearAllSelections}
                  style={{ height: '28px', fontSize: '11px', padding: '4px 10px' }}
                >
                  <span>Clear All</span>
                </button>
              )}
            </div>
          </div>

          {/* Cards Grid */}
          {filteredTables.length === 0 ? (
            <div
              className="glass-panel empty-slate"
              style={{
                padding: '32px 16px',
                gap: '8px',
                borderStyle: 'dashed',
                borderRadius: '4px'
              }}
            >
              <Database size={24} style={{ opacity: 0.4 }} />
              <p style={{ margin: 0, fontSize: '13px', color: 'var(--text-secondary)' }}>
                No catalog tables match your search filter.
              </p>
            </div>
          ) : (
            <div className="shortcut-grid">
              {filteredTables.map((table) => {
                const isRequired = table.required

                return (
                  <div key={table.key} className="shortcut-card">
                    <div>
                      <div className="shortcut-card-header">
                        <div className="shortcut-card-title-container">
                          <span className="shortcut-card-title">{table.name.split(' ')[0]}</span>
                          <span className="shortcut-card-filename">
                            {table.name.substring(table.name.indexOf('('))}
                          </span>
                        </div>
                        <span
                          className={`shortcut-card-badge ${isRequired ? 'shortcut-card-badge-required' : 'shortcut-card-badge-optional'}`}
                        >
                          {isRequired ? 'required' : 'optional'}
                        </span>
                      </div>

                      <div style={{ marginTop: '10px' }}>
                        {table.filePath ? (
                          <div className="shortcut-card-path" title={table.filePath}>
                            <FolderOpen size={12} />
                            <span>{table.filePath.split(/[\\/]/).pop()}</span>
                          </div>
                        ) : (
                          <div className="shortcut-card-empty-path">No file selected</div>
                        )}
                      </div>
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                      {/* Progress bar or stats logs */}
                      {table.status === 'importing' && (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                          <div
                            style={{
                              display: 'flex',
                              justifyContent: 'space-between',
                              fontSize: '10px',
                              color: 'var(--text-secondary)'
                            }}
                          >
                            <span>Importing...</span>
                            <span>{table.progress}%</span>
                          </div>
                          <div
                            className="progress-track"
                            style={{ height: '4px', margin: 0, borderRadius: '2px' }}
                          >
                            <div
                              className="progress-bar"
                              style={{ width: `${table.progress}%` }}
                            ></div>
                          </div>
                        </div>
                      )}

                      {table.status === 'completed' && (
                        <div className="import-card-result">
                          <span className="success">
                            <CheckCircle size={12} /> {table.successCount} rows
                          </span>
                          {table.errorCount > 0 && (
                            <span className="error">
                              <AlertTriangle size={12} /> {table.errorCount} errors
                            </span>
                          )}
                        </div>
                      )}

                      {table.status === 'failed' && (
                        <div className="import-card-failed">
                          <XCircle size={12} />
                          <span>{table.errors[0] || 'Import failed'}</span>
                        </div>
                      )}

                      {/* Import Errors Box */}
                      {table.errors.length > 0 && (
                        <div className="import-error-details">
                          <button
                            type="button"
                            className="import-error-toggle"
                            onClick={() =>
                              setExpandedErrors((prev) => ({
                                ...prev,
                                [table.key]: !prev[table.key]
                              }))
                            }
                          >
                            <AlertTriangle size={12} />
                            <span>
                              {expandedErrors[table.key] ? 'Hide' : 'Show'} import details (
                              {table.errors.length})
                            </span>
                          </button>
                          {expandedErrors[table.key] && (
                            <div className="import-error-list">
                              {table.errors.map((err, idx) => (
                                <div key={idx}>{err}</div>
                              ))}
                            </div>
                          )}
                        </div>
                      )}

                      <div className="shortcut-card-actions">
                        <button
                          className="btn btn-secondary btn-sm"
                          onClick={() => handleSelectFile(table.key)}
                          disabled={globalImporting || table.status === 'importing'}
                          style={{ padding: '4px 8px', fontSize: '11px', height: '26px' }}
                        >
                          Browse...
                        </button>

                        {table.filePath &&
                          table.status !== 'importing' &&
                          table.status !== 'completed' && (
                            <button
                              className="btn btn-primary btn-sm"
                              onClick={() => triggerImport(table.key)}
                              disabled={globalImporting}
                              style={{ padding: '4px 8px', fontSize: '11px', height: '26px' }}
                            >
                              Import
                            </button>
                          )}
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>

        {/* Sidebar Help Card */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <div className="glass-panel" style={{ padding: '16px' }}>
            <h3 style={{ fontSize: '14px', marginBottom: '8px', fontWeight: 700 }}>
              Where to get files?
            </h3>
            <p
              style={{
                fontSize: '12px',
                color: 'var(--text-secondary)',
                lineHeight: 1.5,
                marginBottom: '8px'
              }}
            >
              You can download official database dumps directly from Rebrickable downloads page:
            </p>
            <a
              href="https://rebrickable.com/downloads/"
              target="_blank"
              rel="noreferrer"
              style={{
                color: 'var(--accent)',
                textDecoration: 'none',
                fontWeight: 600,
                fontSize: '12px',
                display: 'inline-block'
              }}
            >
              Rebrickable CSV Downloads
            </a>
          </div>

          <div className="glass-panel" style={{ padding: '16px' }}>
            <h3 style={{ fontSize: '14px', marginBottom: '8px', fontWeight: 700 }}>Notice</h3>
            <p
              style={{
                fontSize: '12px',
                color: 'var(--text-secondary)',
                lineHeight: 1.5,
                margin: 0
              }}
            >
              The importer parses CSV tables inside transaction batches. Streaming files like{' '}
              <strong>inventory_parts.csv</strong> can take 10-20 seconds.
            </p>
          </div>

          <div
            className="glass-panel"
            style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: '8px' }}
          >
            <h3 style={{ fontSize: '14px', marginBottom: '4px', fontWeight: 700 }}>
              Offline Image Cache
            </h3>
            <p
              style={{
                fontSize: '12px',
                color: 'var(--text-secondary)',
                lineHeight: 1.5,
                marginBottom: '4px'
              }}
            >
              Images for sets and parts in your collection can be cached locally inside SQLite for
              offline access.
            </p>
            {cacheStats ? (
              <div
                style={{
                  fontSize: '12px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '4px',
                  marginBottom: '8px'
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: 'var(--text-secondary)' }}>Cached Images:</span>
                  <span style={{ fontWeight: 600 }}>{cacheStats.totalImages}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: 'var(--text-secondary)' }}>Disk Usage:</span>
                  <span style={{ fontWeight: 600 }}>
                    {(cacheStats.totalSizeBytes / (1024 * 1024)).toFixed(2)} MB
                  </span>
                </div>
              </div>
            ) : (
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  fontSize: '12px',
                  color: 'var(--text-secondary)',
                  marginBottom: '8px'
                }}
              >
                <Loader2 className="animate-spin" size={12} />
                <span>Loading cache stats...</span>
              </div>
            )}
            <div style={{ display: 'flex', gap: '8px' }}>
              <button
                className="btn btn-secondary btn-sm"
                onClick={loadCacheStats}
                disabled={clearingCache}
                style={{ flex: 1, height: '28px', fontSize: '11px' }}
              >
                Refresh
              </button>
              <button
                className="btn btn-secondary btn-sm"
                onClick={handleClearCache}
                disabled={clearingCache || !cacheStats || cacheStats.totalImages === 0}
                style={{
                  flex: 1,
                  borderColor: '#ef4444',
                  color: '#fca5a5',
                  height: '28px',
                  fontSize: '11px'
                }}
              >
                {clearingCache ? 'Clearing...' : 'Clear Cache'}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
