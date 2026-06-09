import { useState, useEffect } from 'react'
import { Database, CheckCircle, AlertCircle, Loader2 } from 'lucide-react'

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
  const [tables, setTables] = useState<TableImportState[]>([
    { name: 'Colors (colors.csv)', key: 'colors', required: true, filePath: null, status: 'idle', progress: 0, successCount: 0, errorCount: 0, errors: [] },
    { name: 'Part Categories (part_categories.csv)', key: 'part_categories', required: true, filePath: null, status: 'idle', progress: 0, successCount: 0, errorCount: 0, errors: [] },
    { name: 'Parts (parts.csv)', key: 'parts', required: true, filePath: null, status: 'idle', progress: 0, successCount: 0, errorCount: 0, errors: [] },
    { name: 'Themes (themes.csv)', key: 'themes', required: false, filePath: null, status: 'idle', progress: 0, successCount: 0, errorCount: 0, errors: [] },
    { name: 'Sets (sets.csv)', key: 'sets', required: true, filePath: null, status: 'idle', progress: 0, successCount: 0, errorCount: 0, errors: [] },
    { name: 'Inventories (inventories.csv)', key: 'inventories', required: true, filePath: null, status: 'idle', progress: 0, successCount: 0, errorCount: 0, errors: [] },
    { name: 'Inventory Parts (inventory_parts.csv)', key: 'inventory_parts', required: true, filePath: null, status: 'idle', progress: 0, successCount: 0, errorCount: 0, errors: [] }
  ])

  const [globalImporting, setGlobalImporting] = useState(false)
  const [cacheStats, setCacheStats] = useState<{ totalImages: number; totalSizeBytes: number } | null>(null)
  const [clearingCache, setClearingCache] = useState(false)

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
    if (!window.confirm('Are you sure you want to clear the entire image cache? All cached offline images will be permanently deleted.')) {
      return
    }
    setClearingCache(true)
    try {
      const res = await window.api.clearImageCache()
      if (res.success) {
        alert('Image cache cleared successfully.')
        loadCacheStats()
      } else {
        alert('Failed to clear image cache: ' + res.error)
      }
    } catch (e: any) {
      alert('Error: ' + e.message)
    } finally {
      setClearingCache(false)
    }
  }

  // Register progress listener
  useEffect(() => {
    const unsubscribe = window.api.onImportProgress((data) => {
      setTables(prev => prev.map(t => {
        if (t.key === data.type) {
          return { ...t, progress: data.current }
        }
        return t
      }))
    })

    return () => unsubscribe()
  }, [])

  const handleSelectFile = async (key: string) => {
    try {
      const filePath = await window.api.selectCsvFile()
      if (!filePath) return

      setTables(prev => prev.map(t => {
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
      }))
    } catch (e) {
      console.error('Failed to select file', e)
    }
  }

  const triggerImport = async (key: string) => {
    const table = tables.find(t => t.key === key)
    if (!table || !table.filePath) return

    setTables(prev => prev.map(t => t.key === key ? { ...t, status: 'importing', progress: 0 } : t))

    try {
      const res = await window.api.importCsv(table.filePath, key)
      if (res.success && res.result) {
        setTables(prev => prev.map(t => {
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
        }))
      } else {
        setTables(prev => prev.map(t => {
          if (t.key === key) {
            return {
              ...t,
              status: 'failed',
              errors: [res.error || 'Import failed with unknown error.']
            }
          }
          return t
        }))
      }
    } catch (e: any) {
      setTables(prev => prev.map(t => {
        if (t.key === key) {
          return {
            ...t,
            status: 'failed',
            errors: [e.message]
          }
        }
        return t
      }))
    }
  }

  const handleImportAll = async () => {
    const selectedTables = tables.filter(t => t.filePath && t.status !== 'completed')
    if (selectedTables.length === 0) return

    setGlobalImporting(true)

    for (const table of selectedTables) {
      await triggerImport(table.key)
    }

    setGlobalImporting(false)
    onImportSuccess()
  }

  const activeSelections = tables.filter(t => t.filePath !== null).length

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '32px', flex: 1 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h1>Import LEGO Catalog Data</h1>
          <p className="subtitle">Select and import the Rebrickable CSV files into the local database.</p>
        </div>
        
        {activeSelections > 0 && (
          <button 
            className="btn btn-primary"
            onClick={handleImportAll}
            disabled={globalImporting}
          >
            {globalImporting ? (
              <>
                <Loader2 className="animate-spin" size={16} />
                <span>Importing Selected...</span>
              </>
            ) : (
              <>
                <Database size={16} />
                <span>Import Selected Files</span>
              </>
            )}
          </button>
        )}
      </div>

      <div className="import-section">
        {/* Files Selection list */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {tables.map(table => (
            <div key={table.key} className="glass-panel" style={{ padding: '20px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', flex: 1 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span style={{ fontWeight: 700 }}>{table.name}</span>
                    {table.required && (
                      <span style={{ fontSize: '10px', background: 'rgba(239, 68, 68, 0.15)', color: '#fca5a5', padding: '2px 6px', borderRadius: '4px', fontWeight: 600 }}>
                        Required
                      </span>
                    )}
                  </div>
                  {table.filePath && (
                    <span style={{ fontSize: '12px', color: '#3b82f6', textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap', maxWidth: '400px' }}>
                      Selected: {table.filePath}
                    </span>
                  )}
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                  {/* Status Badge */}
                  {table.status === 'completed' && (
                    <span style={{ display: 'flex', alignItems: 'center', gap: '4px', color: 'var(--status-complete)', fontSize: '14px', fontWeight: 600 }}>
                      <CheckCircle size={16} />
                      Done
                    </span>
                  )}
                  {table.status === 'failed' && (
                    <span style={{ display: 'flex', alignItems: 'center', gap: '4px', color: 'var(--status-missing)', fontSize: '14px', fontWeight: 600 }}>
                      <AlertCircle size={16} />
                      Failed
                    </span>
                  )}
                  {table.status === 'importing' && (
                    <span style={{ display: 'flex', alignItems: 'center', gap: '6px', color: 'var(--text-secondary)', fontSize: '14px' }}>
                      <Loader2 className="animate-spin" size={16} />
                      {table.progress}%
                    </span>
                  )}

                  {/* Browse Button */}
                  <button 
                    className="btn btn-secondary btn-sm"
                    onClick={() => handleSelectFile(table.key)}
                    disabled={globalImporting || table.status === 'importing'}
                  >
                    Browse...
                  </button>

                  {table.filePath && table.status !== 'importing' && table.status !== 'completed' && (
                    <button 
                      className="btn btn-primary btn-sm"
                      onClick={() => triggerImport(table.key)}
                      disabled={globalImporting}
                    >
                      Import
                    </button>
                  )}
                </div>
              </div>

              {/* Progress Bar */}
              {table.status === 'importing' && (
                <div className="progress-track" style={{ marginTop: '12px' }}>
                  <div className="progress-bar" style={{ width: `${table.progress}%` }}></div>
                </div>
              )}

              {/* Stats Log */}
              {table.status === 'completed' && (
                <div style={{ marginTop: '12px', fontSize: '12px', color: '#64748b', display: 'flex', gap: '16px', borderTop: '1px solid rgba(255,255,255,0.03)', paddingTop: '8px' }}>
                  <span style={{ color: 'var(--status-complete)' }}>Success: {table.successCount} rows</span>
                  {table.errorCount > 0 && <span style={{ color: 'var(--status-missing)' }}>Errors: {table.errorCount} rows</span>}
                </div>
              )}

              {/* Error messages log */}
              {table.errors.length > 0 && (
                <div style={{ marginTop: '12px', padding: '10px', background: 'rgba(239, 68, 68, 0.05)', borderRadius: '8px', border: '1px solid rgba(239, 68, 68, 0.2)' }}>
                  <span style={{ fontSize: '12px', fontWeight: 600, color: '#fca5a5', display: 'block', marginBottom: '4px' }}>Import Errors:</span>
                  <div style={{ maxHeight: '80px', overflowY: 'auto', fontSize: '11px', color: '#ef4444', fontFamily: 'monospace', display: 'flex', flexDirection: 'column', gap: '2px' }}>
                    {table.errors.slice(0, 10).map((err, idx) => (
                      <div key={idx}>• {err}</div>
                    ))}
                    {table.errors.length > 10 && <div>• and {table.errors.length - 10} more errors...</div>}
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>

        {/* Sidebar Help Card */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          <div className="glass-panel" style={{ padding: '24px' }}>
            <h3 style={{ fontSize: '15px', marginBottom: '12px', fontWeight: 700 }}>Where to get files?</h3>
            <p style={{ fontSize: '13px', color: 'var(--text-secondary)', lineHeight: 1.6, marginBottom: '12px' }}>
              You can download official database dumps directly from Rebrickable downloads page:
            </p>
            <a 
              href="https://rebrickable.com/downloads/" 
              target="_blank" 
              rel="noreferrer"
              style={{ color: 'var(--accent)', textDecoration: 'none', fontWeight: 600, fontSize: '13px', display: 'inline-block' }}
            >
              Rebrickable CSV Downloads
            </a>
          </div>

          <div className="glass-panel" style={{ padding: '24px' }}>
            <h3 style={{ fontSize: '15px', marginBottom: '12px', fontWeight: 700 }}>Notice</h3>
            <p style={{ fontSize: '13px', color: 'var(--text-secondary)', lineHeight: 1.6 }}>
              The importer parses CSV tables inside transaction batches. This process is very fast, but files like <strong>inventory_parts.csv</strong> can contain millions of rows and take about 10-20 seconds to stream.
            </p>
          </div>

          <div className="glass-panel" style={{ padding: '24px' }}>
            <h3 style={{ fontSize: '15px', marginBottom: '12px', fontWeight: 700 }}>Offline Image Cache</h3>
            <p style={{ fontSize: '13px', color: 'var(--text-secondary)', lineHeight: 1.6, marginBottom: '12px' }}>
              Images for sets and parts in your collection can be cached locally inside the SQLite database for offline access.
            </p>
            {cacheStats ? (
              <div style={{ fontSize: '13px', display: 'flex', flexDirection: 'column', gap: '6px', marginBottom: '16px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: 'var(--text-secondary)' }}>Cached Images:</span>
                  <span style={{ fontWeight: 600 }}>{cacheStats.totalImages}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: 'var(--text-secondary)' }}>Disk Usage:</span>
                  <span style={{ fontWeight: 600 }}>{(cacheStats.totalSizeBytes / (1024 * 1024)).toFixed(2)} MB</span>
                </div>
              </div>
            ) : (
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px', color: 'var(--text-secondary)', marginBottom: '16px' }}>
                <Loader2 className="animate-spin" size={14} />
                <span>Loading cache stats...</span>
              </div>
            )}
            <div style={{ display: 'flex', gap: '10px' }}>
              <button
                className="btn btn-secondary btn-sm"
                onClick={loadCacheStats}
                disabled={clearingCache}
                style={{ flex: 1 }}
              >
                Refresh
              </button>
              <button
                className="btn btn-secondary btn-sm"
                onClick={handleClearCache}
                disabled={clearingCache || !cacheStats || cacheStats.totalImages === 0}
                style={{ flex: 1, borderColor: '#ef4444', color: '#fca5a5' }}
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
