import { useState, useEffect } from 'react'
import {
  Layers,
  Search,
  Trash2,
  Copy,
  Play,
  Plus,
  X,
  Loader2,
  Check,
  CheckCircle,
  FileText,
  Download,
  AlertTriangle,
  RotateCcw
} from 'lucide-react'
import CachedImage from '../components/CachedImage'
import Tooltip from '../components/Tooltip'
import { useDialog } from '../components/CustomDialog'

interface CollectionOverviewPageProps {
  onNavigateToSession: (sessionId: number) => void
}

export default function CollectionOverviewPage({
  onNavigateToSession
}: CollectionOverviewPageProps) {
  const dialog = useDialog()
  const [collection, setCollection] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  // Image download state
  const [imageDownloading, setImageDownloading] = useState(false)
  const [imageProgress, setImageProgress] = useState<{ completed: number; total: number } | null>(
    null
  )

  // Filters state (Main Dashboard)
  const [searchQuery, setSearchQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')

  // Add Set Modal state
  const [isAddModalOpen, setIsAddModalOpen] = useState(false)
  const [addSearchQuery, setAddSearchQuery] = useState('')
  const [addSearchResults, setAddSearchResults] = useState<any[]>([])
  const [addLoading, setAddLoading] = useState(false)
  const [addError, setAddError] = useState<string | null>(null)

  // Set Details Modal state
  const [selectedSetDetails, setSelectedSetDetails] = useState<any | null>(null)
  const [detailsModalOpen, setDetailsModalOpen] = useState(false)
  const [detailsTab, setDetailsTab] = useState<'sessions' | 'parts'>('sessions')
  const [detailsParts, setDetailsParts] = useState<any[]>([])
  const [partsLoading, setPartsLoading] = useState(false)
  const [partsSearchQuery, setPartsSearchQuery] = useState('')
  const [partsGroupFilter, setPartsGroupFilter] = useState('all')
  const [partsColorFilter, setPartsColorFilter] = useState('all')
  const [detailsNotes, setDetailsNotes] = useState('')
  const [savingDetailsNotes, setSavingDetailsNotes] = useState(false)
  const [visiblePartsCount, setVisiblePartsCount] = useState(50)

  // New Session Creation inside Details Modal state
  const [newSessionName, setNewSessionName] = useState('')
  const [newSessionIncludeSpares, setNewSessionIncludeSpares] = useState(false)
  const [creatingSession, setCreatingSession] = useState(false)


  const loadCollection = async (showLoading = true): Promise<any[]> => {
    if (showLoading) setLoading(true)
    try {
      const res = await window.api.getCollectionOverview()
      if (res.success && res.collection) {
        setCollection(res.collection)
        return res.collection
      }
    } catch (e) {
      console.error('Failed to load collection', e)
    } finally {
      if (showLoading) setLoading(false)
    }
    return []
  }

  useEffect(() => {
    loadCollection()
  }, [])

  const handleOpenDetails = async (set: any) => {
    setSelectedSetDetails(set)
    setDetailsNotes('')
    setDetailsModalOpen(true)
    setDetailsTab('sessions')
    setPartsLoading(true)
    setDetailsParts([])

    setNewSessionName(`${set.set_num} - ${set.name} - Inventory Check`)
    setNewSessionIncludeSpares(false)

    // Load set details (sessions, notes)
    try {
      const res = await window.api.getSetDetails(set.set_num)
      if (res.success && res.details) {
        setSelectedSetDetails((prev) =>
          prev
            ? {
                ...prev,
                ...res.details,
                notes: res.details.notes || '',
                sessions: res.details.sessions || []
              }
            : null
        )
        setDetailsNotes(res.details.notes || '')
      }
    } catch (e) {
      console.error('Failed to load set details', e)
    }

    // Load parts
    try {
      const partsRes = await window.api.getSetParts(set.set_num)
      if (partsRes.success && partsRes.parts) {
        setDetailsParts(partsRes.parts)
      }
    } catch (e) {
      console.error('Failed to load set parts', e)
    } finally {
      setPartsLoading(false)
    }
  }

  const handleSaveDetailsNotes = async () => {
    if (!selectedSetDetails) return
    setSavingDetailsNotes(true)
    try {
      const res = await window.api.saveSetNotes(selectedSetDetails.set_num, detailsNotes)
      if (res.success) {
        setSelectedSetDetails((prev) => (prev ? { ...prev, notes: detailsNotes } : null))
        // Refresh collection page overview notes count if applicable
        loadCollection()
      }
    } catch (err) {
      console.error('Failed to save details set notes', err)
    } finally {
      setSavingDetailsNotes(false)
    }
  }

  const handleDeleteSession = async (e: React.MouseEvent, sessionId: number) => {
    e.stopPropagation()
    if (
      !(await dialog.confirm(
        'Are you sure you want to delete this session? All count records will be permanently lost.'
      ))
    )
      return

    try {
      const res = await window.api.deleteSession(sessionId)
      if (res.success) {
        // Reload details history
        if (selectedSetDetails) {
          const histRes = await window.api.getSetDetails(selectedSetDetails.set_num)
          if (histRes.success && histRes.details) {
            setSelectedSetDetails((prev) =>
              prev
                ? {
                    ...prev,
                    sessions: histRes.details.sessions || []
                  }
                : null
            )
          }
        }
        // Reload collection overview
        loadCollection()
      }
    } catch (err) {
      console.error('Failed to delete session', err)
    }
  }

  const handleDuplicateSession = async (
    e: React.MouseEvent,
    sessionId: number,
    currentName: string
  ) => {
    e.stopPropagation()
    const newName = await dialog.prompt(
      'Enter a name for the duplicated counting session.',
      `Copy of ${currentName}`,
      'Duplicate Session',
      'Session name'
    )
    if (!newName || !newName.trim()) return

    try {
      const res = await window.api.duplicateSession(sessionId, newName)
      if (res.success) {
        // Reload details history
        if (selectedSetDetails) {
          const histRes = await window.api.getSetDetails(selectedSetDetails.set_num)
          if (histRes.success && histRes.details) {
            setSelectedSetDetails((prev) =>
              prev
                ? {
                    ...prev,
                    sessions: histRes.details.sessions || []
                  }
                : null
            )
          }
        }
        // Reload collection overview
        loadCollection()
      }
    } catch (err) {
      console.error('Failed to duplicate session', err)
    }
  }

  const handleCreateSessionInDetails = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedSetDetails) return
    setCreatingSession(true)
    try {
      const res = await window.api.createSession({
        set_num: selectedSetDetails.set_num,
        name: newSessionName,
        include_spares: newSessionIncludeSpares,
        notes: ''
      })
      if (res.success && res.sessionId) {
        setDetailsModalOpen(false)
        onNavigateToSession(res.sessionId)
      } else {
        await dialog.alert(res.error || 'Failed to create session')
      }
    } catch (err: any) {
      await dialog.alert(err.message)
    } finally {
      setCreatingSession(false)
    }
  }

  const handleRemoveFromCollection = async (e: React.MouseEvent, setNum: string) => {
    e.stopPropagation()
    if (
      !(await dialog.confirm(
        'Are you sure you want to remove this set from your collection? This will not delete any active counting sessions.'
      ))
    )
      return

    try {
      const res = await window.api.removeFromCollection(setNum)
      if (res.success) {
        if (selectedSetDetails?.set_num === setNum) {
          setDetailsModalOpen(false)
        }
        loadCollection()
      } else {
        await dialog.alert(res.error || 'Failed to remove set from collection.')
      }
    } catch (err) {
      console.error('Failed to remove from collection', err)
    }
  }

  const handleSetManualComplete = async (
    e: React.MouseEvent,
    setNum: string,
    complete: boolean
  ) => {
    e.stopPropagation()
    const confirmed = await dialog.confirm(
      complete
        ? 'Mark this set as 100% complete without creating a counting session? Use this for sealed or boxed sets you trust are complete.'
        : 'Clear the manual 100% complete marker for this set? The collection will return to session-derived completeness.',
      complete ? 'Mark Set Complete' : 'Clear Manual Complete'
    )
    if (!confirmed) return

    try {
      const res = await window.api.setCollectionManualComplete(setNum, complete)
      if (res.success) {
        const refreshedCollection = await loadCollection(false)
        if (selectedSetDetails?.set_num === setNum) {
          const refreshedSet = refreshedCollection.find((set) => set.set_num === setNum)
          if (refreshedSet) {
            setSelectedSetDetails((prev) => (prev ? { ...prev, ...refreshedSet } : null))
          }
        }
      } else {
        await dialog.alert(res.error || 'Failed to update manual completeness.')
      }
    } catch (err: any) {
      await dialog.alert(err.message || 'Failed to update manual completeness.')
    }
  }

  const handleSearchCatalog = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!addSearchQuery.trim()) return

    setAddLoading(true)
    setAddError(null)
    try {
      const res = await window.api.searchSets(addSearchQuery)
      if (res.success && res.sets) {
        setAddSearchResults(res.sets)
        if (res.sets.length === 0) {
          setAddError('No sets found matching query.')
        }
      } else {
        setAddError(res.error || 'Failed to search catalog.')
      }
    } catch (err: any) {
      setAddError(err.message)
    } finally {
      setAddLoading(false)
    }
  }

  const handleToggleCollectionInAddModal = async (setNum: string) => {
    const isAlreadyIn = collection.some((s) => s.set_num === setNum)
    try {
      if (isAlreadyIn) {
        const res = await window.api.removeFromCollection(setNum)
        if (res.success) {
          await loadCollection()
        }
      } else {
        const res = await window.api.addToCollection(setNum)
        if (res.success) {
          await loadCollection()
          // Auto-download images for the newly added set
          window.api.downloadSetImages(setNum).catch(() => {})
        }
      }
    } catch (err: any) {
      await dialog.alert(err.message)
    }
  }

  // Filtered Collection Dashboard
  const filteredCollection = collection.filter((set) => {
    const matchesSearch =
      set.set_num.toLowerCase().includes(searchQuery.toLowerCase()) ||
      set.name.toLowerCase().includes(searchQuery.toLowerCase())

    if (!matchesSearch) return false

    if (statusFilter === 'all') return true
    if (statusFilter === 'complete')
      return set.completion_percentage === 100 && set.unchecked_count === 0
    if (statusFilter === 'incomplete')
      return set.completion_percentage < 100 || set.unchecked_count > 0
    if (statusFilter === 'missing') return set.missing_required_count > 0

    return true
  })

  // Filtered Parts Catalog inside Details View
  const filteredParts = detailsParts.filter((p) => {
    const matchesSearch =
      p.part_num.toLowerCase().includes(partsSearchQuery.toLowerCase()) ||
      p.part_name.toLowerCase().includes(partsSearchQuery.toLowerCase())

    const matchesGroup = partsGroupFilter === 'all' || p.technic_group_name === partsGroupFilter

    const matchesColor = partsColorFilter === 'all' || p.color_name === partsColorFilter

    return matchesSearch && matchesGroup && matchesColor
  })

  // Reset page count when filters change
  useEffect(() => {
    setVisiblePartsCount(50)
  }, [partsSearchQuery, partsGroupFilter, partsColorFilter])

  // Extract unique colors and groups from the parts details
  const uniqueColors = Array.from(
    new Set(detailsParts.map((p) => p.color_name).filter(Boolean))
  ).sort()
  const uniqueGroups = Array.from(
    new Set(detailsParts.map((p) => p.technic_group_name).filter(Boolean))
  ).sort()
  const collectionStats = {
    total: collection.length,
    complete: collection.filter(
      (set) => set.completion_percentage === 100 && set.unchecked_count === 0
    ).length,
    incomplete: collection.filter(
      (set) => set.completion_percentage < 100 || set.unchecked_count > 0
    ).length,
    missing: collection.filter((set) => set.missing_required_count > 0).length
  }

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
        <p style={{ color: 'var(--text-secondary)' }}>Loading collection overview...</p>
      </div>
    )
  }

  return (
    <div className="page-container">
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '16px'
        }}
      >
        <div>
          <h1>Personal Collection</h1>
          <p className="subtitle" style={{ marginBottom: 0 }}>
            Overview of inventoried sets and their respective completeness statistics.
          </p>
        </div>
        <button
          className="btn btn-primary"
          onClick={() => {
            setIsAddModalOpen(true)
            setAddSearchResults([])
            setAddSearchQuery('')
            setAddError(null)
          }}
        >
          <Plus size={16} />
          <span>Add Set</span>
        </button>
        <button
          className="btn btn-secondary"
          onClick={async () => {
            setImageDownloading(true)
            setImageProgress(null)
            const unsub = window.api.onCollectionImageDownloadProgress((data) => {
              setImageProgress({ completed: data.completedSets, total: data.totalSets })
            })
            try {
              await window.api.downloadCollectionImages()
            } finally {
              unsub()
              setImageDownloading(false)
              setImageProgress(null)
            }
          }}
          disabled={imageDownloading}
        >
          <Download size={16} />
          <span>
            {imageDownloading
              ? `Downloading${imageProgress ? ` (${imageProgress.completed}/${imageProgress.total})` : '...'}`
              : 'Download Images'}
          </span>
        </button>
      </div>

      <div className="page-content-scroll">
        <div className="collection-summary-grid">
          <div className="glass-panel collection-summary-card">
            <span className="collection-summary-label">Total Sets</span>
            <strong>{collectionStats.total}</strong>
            <span>in collection</span>
          </div>
          <div className="glass-panel collection-summary-card complete">
            <span className="collection-summary-label">Complete</span>
            <strong>{collectionStats.complete}</strong>
            <span>fully checked</span>
          </div>
          <div className="glass-panel collection-summary-card partial">
            <span className="collection-summary-label">Incomplete</span>
            <strong>{collectionStats.incomplete}</strong>
            <span>need attention</span>
          </div>
          <div className="glass-panel collection-summary-card missing">
            <span className="collection-summary-label">Missing Parts</span>
            <strong>{collectionStats.missing}</strong>
            <span>sets affected</span>
          </div>
        </div>

        {/* Filters bar */}
        <div className="glass-panel filter-panel" style={{ gridTemplateColumns: '2fr 1fr' }}>
          <div className="form-group" style={{ margin: 0 }}>
            <label className="form-label">Search collection</label>
            <div style={{ position: 'relative' }}>
              <input
                type="text"
                className="form-input"
                placeholder="Search by set number or name..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                style={{
                  paddingLeft: '36px',
                  paddingTop: '8px',
                  paddingBottom: '8px',
                  borderRadius: '8px'
                }}
              />
              <Search
                size={14}
                style={{ position: 'absolute', left: '12px', top: '11px', color: '#64748b' }}
              />
            </div>
          </div>

          <div className="form-group" style={{ margin: 0 }}>
            <label className="form-label">Completeness Filter</label>
            <select
              className="form-input form-select"
              style={{ paddingTop: '8px', paddingBottom: '8px', borderRadius: '8px' }}
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
            >
              <option value="all">All Sets</option>
              <option value="complete">100% Complete</option>
              <option value="incomplete">Incomplete</option>
              <option value="missing">Missing Required Parts</option>
            </select>
          </div>
        </div>

        {/* Main Table */}
        {filteredCollection.length === 0 ? (
          <div className="glass-panel" style={{ padding: '48px' }}>
            <div className="empty-slate">
              <Layers />
              <p>Your collection is empty or no sets match the current filter.</p>
              <button className="btn btn-primary btn-sm" onClick={() => setIsAddModalOpen(true)}>
                <Search size={16} />
                <span>Search Sets to Add</span>
              </button>
            </div>
          </div>
        ) : (
          <div className="glass-panel" style={{ flex: 1, minHeight: 0, overflow: 'auto' }}>
            <table className="collection-table">
              <thead>
                <tr>
                  <th>Set</th>
                  <th>Completeness</th>
                  <th>Missing / Extra</th>
                  <th>Last Checked</th>
                  <th>Status</th>
                  <th style={{ textAlign: 'right' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredCollection.map((set) => {
                  const isComplete = set.completion_percentage === 100 && set.unchecked_count === 0

                  return (
                    <tr
                      key={set.set_num}
                      style={{ cursor: 'pointer' }}
                      onClick={() => handleOpenDetails(set)}
                    >
                      <td>
                        <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
                          {set.image_url ? (
                            <CachedImage
                              url={set.image_url}
                              alt={set.name}
                              style={{
                                width: '40px',
                                height: '40px',
                                objectFit: 'contain',
                                background: 'rgba(0,0,0,0.3)',
                                padding: '2px',
                                borderRadius: '4px'
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
                              <Layers size={18} />
                            </div>
                          )}
                          <div>
                            <span
                              style={{
                                fontSize: '11px',
                                fontWeight: 700,
                                color: 'var(--accent)',
                                fontFamily: 'monospace'
                              }}
                            >
                              {set.set_num}
                            </span>
                            <span style={{ display: 'block', fontSize: '14px', fontWeight: 600 }}>
                              {set.name}
                            </span>
                          </div>
                        </div>
                      </td>
                      <td>
                        <div style={{ display: 'flex', alignItems: 'center' }}>
                          <div className="collection-bar-container">
                            <div
                              className={`collection-bar ${isComplete ? '' : 'partial'}`}
                              style={{ width: `${set.completion_percentage}%` }}
                            ></div>
                          </div>
                          <span style={{ fontSize: '13px', fontWeight: 700 }}>
                            {set.completion_percentage}%
                          </span>
                        </div>
                      </td>
                      <td>
                        <div
                          style={{
                            display: 'flex',
                            flexDirection: 'column',
                            gap: '2px',
                            fontSize: '12px'
                          }}
                        >
                          {set.session_status === 'not_started' ? (
                            <span style={{ color: 'var(--text-secondary)' }}>Not started yet</span>
                          ) : (
                            <>
                              {set.missing_required_count > 0 && (
                                <span className="collection-status-line missing">
                                  <X size={12} /> {set.missing_required_count} missing parts
                                </span>
                              )}
                              {set.missing_spares_count > 0 && (
                                <span className="collection-status-line partial">
                                  <AlertTriangle size={12} /> {set.missing_spares_count} missing
                                  spares
                                </span>
                              )}
                              {set.extra_count > 0 && (
                                <span className="collection-status-line extra">
                                  <Plus size={12} /> {set.extra_count} extra parts
                                </span>
                              )}
                              {set.missing_required_count === 0 &&
                                set.missing_spares_count === 0 && (
                                  <span className="collection-status-line complete">
                                    <Check size={12} /> All parts accounted for
                                  </span>
                                )}
                            </>
                          )}
                        </div>
                      </td>
                      <td style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>
                        {set.last_checked_date
                          ? new Date(set.last_checked_date).toLocaleDateString()
                          : 'N/A'}
                      </td>
                      <td>
                        <span
                          className={`badge badge-${
                            set.session_status === 'in_progress'
                              ? 'partial'
                              : set.session_status === 'not_started'
                                ? 'not_checked'
                                : 'complete'
                          }`}
                        >
                          {set.session_status.replace('_', ' ')}
                        </span>
                      </td>
                      <td style={{ textAlign: 'right' }}>
                        <div
                          style={{ display: 'inline-flex', gap: '6px' }}
                          onClick={(e) => e.stopPropagation()}
                        >
                          <Tooltip
                            content={
                              set.manual_complete
                                ? 'Clear manual complete'
                                : 'Mark boxed set complete'
                            }
                          >
                            <button
                              className={`btn btn-secondary btn-sm btn-icon-only ${set.manual_complete ? '' : 'btn-manual-complete'}`}
                              onClick={(e) =>
                                handleSetManualComplete(e, set.set_num, !set.manual_complete)
                              }
                            >
                              {set.manual_complete ? (
                                <RotateCcw size={14} />
                              ) : (
                                <CheckCircle size={14} />
                              )}
                            </button>
                          </Tooltip>
                          <Tooltip content="View Details">
                            <button
                              className="btn btn-secondary btn-sm btn-icon-only"
                              onClick={() => handleOpenDetails(set)}
                            >
                              <FileText size={14} />
                            </button>
                          </Tooltip>
                          <Tooltip content="Remove from Collection">
                            <button
                              className="btn btn-secondary btn-sm btn-icon-only btn-danger"
                              onClick={(e) => handleRemoveFromCollection(e, set.set_num)}
                            >
                              <Trash2 size={14} />
                            </button>
                          </Tooltip>
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Add Set Modal Overlay */}
      {isAddModalOpen && (
        <div className="modal-overlay">
          <div
            className="glass-panel modal-content"
            style={{
              maxWidth: '650px',
              width: '90%',
              maxHeight: '80vh',
              display: 'flex',
              flexDirection: 'column',
              padding: '24px'
            }}
          >
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                marginBottom: '16px'
              }}
            >
              <h2 style={{ fontSize: '20px', fontWeight: 800, margin: 0 }}>
                Add Lego Set to Collection
              </h2>
              <button
                className="btn btn-secondary btn-sm btn-icon-only"
                onClick={() => setIsAddModalOpen(false)}
              >
                <X size={16} />
              </button>
            </div>

            <form
              onSubmit={handleSearchCatalog}
              style={{ display: 'flex', gap: '10px', marginBottom: '16px' }}
            >
              <input
                type="text"
                className="form-input"
                placeholder="Search catalog by number, name, or year..."
                value={addSearchQuery}
                onChange={(e) => setAddSearchQuery(e.target.value)}
                required
                style={{ padding: '10px 14px', borderRadius: '8px' }}
              />
              <button type="submit" className="btn btn-primary" disabled={addLoading}>
                {addLoading ? <Loader2 className="animate-spin" size={16} /> : 'Search'}
              </button>
            </form>

            {addError && (
              <p style={{ color: 'var(--status-missing)', fontSize: '13px', margin: '0 0 16px 0' }}>
                {addError}
              </p>
            )}

            <div
              style={{
                flex: 1,
                overflowY: 'auto',
                display: 'flex',
                flexDirection: 'column',
                gap: '12px',
                paddingRight: '4px'
              }}
            >
              {addSearchResults.map((s) => {
                const inCollection = collection.some((c) => c.set_num === s.set_num)

                return (
                  <div
                    key={s.set_num}
                    style={{
                      display: 'flex',
                      gap: '16px',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '12px',
                      background: 'var(--bg-main)',
                      border: '1px solid var(--border-glass)',
                      borderRadius: '10px'
                    }}
                  >
                    <div
                      style={{
                        display: 'flex',
                        gap: '12px',
                        alignItems: 'center',
                        minWidth: 0,
                        flex: 1
                      }}
                    >
                      {s.image_url ? (
                        <CachedImage
                          url={s.image_url}
                          alt={s.name}
                          style={{
                            width: '48px',
                            height: '48px',
                            objectFit: 'contain',
                            background: 'rgba(0,0,0,0.2)',
                            padding: '2px',
                            borderRadius: '6px'
                          }}
                        />
                      ) : (
                        <div
                          style={{
                            width: '48px',
                            height: '48px',
                            background: 'var(--border-glass)',
                            borderRadius: '6px',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center'
                          }}
                        >
                          <Layers size={18} />
                        </div>
                      )}
                      <div style={{ minWidth: 0 }}>
                        <span
                          style={{
                            fontSize: '11px',
                            color: 'var(--accent)',
                            fontWeight: 700,
                            fontFamily: 'monospace'
                          }}
                        >
                          {s.set_num}
                        </span>
                        <h4
                          style={{
                            fontSize: '14px',
                            fontWeight: 600,
                            margin: '2px 0',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap'
                          }}
                        >
                          {s.name}
                        </h4>
                        <span style={{ fontSize: '11px', color: '#64748b' }}>
                          {s.num_parts} parts • {s.year} • {s.theme_name}
                        </span>
                      </div>
                    </div>

                    <button
                      className={`btn btn-sm ${inCollection ? 'btn-secondary' : 'btn-primary'}`}
                      onClick={() => handleToggleCollectionInAddModal(s.set_num)}
                      style={{ padding: '6px 12px', height: '32px' }}
                    >
                      {inCollection ? <Check size={14} /> : <Plus size={14} />}
                      <span style={{ marginLeft: '4px' }}>{inCollection ? 'Added' : 'Add'}</span>
                    </button>
                  </div>
                )
              })}
            </div>
          </div>
        </div>
      )}

      {/* Detailed Set View Modal Overlay */}
      {detailsModalOpen && selectedSetDetails && (
        <div className="modal-overlay" onClick={() => setDetailsModalOpen(false)}>
          <div className="glass-panel set-details-modal" onClick={(e) => e.stopPropagation()}>
            {/* Modal Header */}
            <div className="set-details-header">
              <div style={{ display: 'flex', gap: '16px', alignItems: 'center' }}>
                <div>
                  <span className="set-details-badge">{selectedSetDetails.set_num}</span>
                  <h2 className="set-details-title" style={{ marginTop: '2px' }}>
                    {selectedSetDetails.name}
                  </h2>
                </div>
              </div>
              <Tooltip content="Close details">
                <button
                  className="set-details-close-btn"
                  onClick={() => setDetailsModalOpen(false)}
                >
                  <X size={16} />
                </button>
              </Tooltip>
            </div>

            {/* Modal Body Grid */}
            <div className="set-details-body">
              {/* Left Column (Info Panel) */}
              <div className="set-details-sidebar">
                {selectedSetDetails.image_url ? (
                  <div
                    style={{
                      width: '100%',
                      height: '180px',
                      background: '#ffffff',
                      borderRadius: '8px',
                      border: '1px solid var(--border-glass)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      overflow: 'hidden',
                      position: 'relative',
                      marginBottom: '4px'
                    }}
                  >
                    <CachedImage
                      url={selectedSetDetails.image_url}
                      alt={selectedSetDetails.name}
                      style={{
                        maxWidth: '100%',
                        maxHeight: '100%',
                        objectFit: 'contain',
                        padding: '8px'
                      }}
                    />
                  </div>
                ) : (
                  <div
                    style={{
                      width: '100%',
                      height: '180px',
                      background: 'var(--border-glass)',
                      borderRadius: '8px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      marginBottom: '4px'
                    }}
                  >
                    <Layers size={48} style={{ color: 'var(--text-secondary)', opacity: 0.3 }} />
                  </div>
                )}

                {/* Flat Metadata List */}
                <div style={{ display: 'flex', flexDirection: 'column' }}>
                  <div className="set-details-info-row">
                    <span className="set-details-info-label">Release Year</span>
                    <span
                      className="set-details-info-value set-details-value-with-icon"
                      style={{ color: 'var(--accent)' }}
                    >
                      <FileText size={13} />
                      {selectedSetDetails.year || 'N/A'}
                    </span>
                  </div>
                  <div className="set-details-info-row">
                    <span className="set-details-info-label">Parts Count</span>
                    <span className="set-details-info-value set-details-value-with-icon">
                      <Layers size={13} />
                      {selectedSetDetails.expected_parts || selectedSetDetails.num_parts || 0}
                    </span>
                  </div>
                  <div className="set-details-info-row">
                    <span className="set-details-info-label">Unique Catalog Rows</span>
                    <span className="set-details-info-value set-details-value-with-icon">
                      <Layers size={13} />
                      {selectedSetDetails.uniquePartsCount || 0} items
                    </span>
                  </div>

                  {selectedSetDetails.session_status !== 'not_started' && (
                    <>
                      <div className="set-details-info-row">
                        <span className="set-details-info-label">Completeness</span>
                        <span
                          className="set-details-info-value set-details-value-with-icon"
                          style={{ color: 'var(--status-complete)' }}
                        >
                          <Check size={13} />
                          {selectedSetDetails.completion_percentage}%
                        </span>
                      </div>
                      <div className="set-details-info-row">
                        <span className="set-details-info-label">Missing Parts</span>
                        <span
                          className="set-details-info-value set-details-value-with-icon"
                          style={{
                            color:
                              selectedSetDetails.missing_required_count > 0
                                ? 'var(--status-missing)'
                                : 'var(--status-complete)'
                          }}
                        >
                          <AlertTriangle size={13} />
                          {selectedSetDetails.missing_required_count}
                        </span>
                      </div>
                    </>
                  )}
                </div>

                <div
                  className={`manual-complete-panel ${selectedSetDetails.manual_complete ? 'active' : ''}`}
                >
                  <div>
                    <span>
                      {selectedSetDetails.manual_complete
                        ? 'Manual complete'
                        : 'Boxed set shortcut'}
                    </span>
                    <p>
                      {selectedSetDetails.manual_complete
                        ? 'This set is treated as 100% complete without a counting session.'
                        : 'Mark sealed or boxed sets as 100% complete without creating count rows.'}
                    </p>
                  </div>
                  <button
                    className={`btn btn-sm ${selectedSetDetails.manual_complete ? 'btn-secondary' : 'btn-primary'}`}
                    onClick={(e) =>
                      handleSetManualComplete(
                        e,
                        selectedSetDetails.set_num,
                        !selectedSetDetails.manual_complete
                      )
                    }
                  >
                    {selectedSetDetails.manual_complete ? (
                      <RotateCcw size={13} />
                    ) : (
                      <CheckCircle size={13} />
                    )}
                    <span>{selectedSetDetails.manual_complete ? 'Clear' : 'Mark 100%'}</span>
                  </button>
                </div>

                {/* Set Custom Notes */}
                <div className="form-group" style={{ marginBottom: 0, marginTop: '4px' }}>
                  <label
                    className="form-label"
                    style={{
                      fontSize: '11px',
                      fontWeight: 700,
                      textTransform: 'uppercase',
                      letterSpacing: '0.5px'
                    }}
                  >
                    Set Notes
                  </label>
                  <div style={{ position: 'relative' }}>
                    <textarea
                      className="form-input"
                      rows={5}
                      placeholder="General notes about set details..."
                      value={detailsNotes}
                      onChange={(e) => setDetailsNotes(e.target.value)}
                      style={{
                        fontSize: '13px',
                        resize: 'none',
                        background: 'var(--bg-main)',
                        border: '1px solid var(--border-glass)',
                        paddingBottom: '36px',
                        borderRadius: '10px'
                      }}
                    />
                    <button
                      className="btn btn-primary btn-sm"
                      onClick={handleSaveDetailsNotes}
                      style={{
                        position: 'absolute',
                        right: '8px',
                        bottom: '8px',
                        padding: '4px 12px',
                        fontSize: '11px',
                        borderRadius: '6px',
                        height: '24px',
                        fontWeight: 700
                      }}
                      disabled={savingDetailsNotes}
                    >
                      {savingDetailsNotes ? 'Saving...' : 'Save'}
                    </button>
                  </div>
                </div>
              </div>

              {/* Right Column (Tabs Panel) */}
              <div className="set-details-main">
                {/* Tabs bar */}
                <div className="set-details-tabs-nav">
                  <button
                    className={`set-details-tab-btn ${detailsTab === 'sessions' ? 'active' : ''}`}
                    onClick={() => setDetailsTab('sessions')}
                  >
                    Counting Sessions ({selectedSetDetails.sessions?.length || 0})
                  </button>
                  <button
                    className={`set-details-tab-btn ${detailsTab === 'parts' ? 'active' : ''}`}
                    onClick={() => setDetailsTab('parts')}
                  >
                    Set Inventory Parts ({filteredParts.length})
                  </button>
                </div>

                {/* Tab content wrapper */}
                <div
                  style={{
                    flex: 1,
                    display: 'flex',
                    flexDirection: 'column',
                    minHeight: 0,
                    overflow: 'hidden'
                  }}
                >
                  {/* SESSIONS TAB */}
                  {detailsTab === 'sessions' && (
                    <div
                      style={{
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '20px',
                        flex: 1,
                        overflowY: 'auto'
                      }}
                    >
                      {/* Existing sessions list */}
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                        <h3
                          style={{
                            fontSize: '12px',
                            margin: 0,
                            fontWeight: 700,
                            color: 'var(--text-secondary)',
                            textTransform: 'uppercase',
                            letterSpacing: '0.8px'
                          }}
                        >
                          Active Counting Sessions
                        </h3>
                        {!selectedSetDetails.sessions ||
                        selectedSetDetails.sessions.length === 0 ? (
                          <div
                            style={{
                              display: 'flex',
                              flexDirection: 'column',
                              alignItems: 'center',
                              justifyContent: 'center',
                              padding: '48px 16px',
                              background: 'rgba(100, 116, 139, 0.02)',
                              border: '1px dashed var(--border-glass)',
                              borderRadius: '16px',
                              textAlign: 'center',
                              color: 'var(--text-secondary)'
                            }}
                          >
                            <Play
                              size={24}
                              style={{
                                opacity: 0.4,
                                marginBottom: '10px',
                                color: 'var(--primary)'
                              }}
                            />
                            <span style={{ fontSize: '13px', fontWeight: 700 }}>
                              No Active Counting Sessions
                            </span>
                            <span style={{ fontSize: '11px', opacity: 0.7, marginTop: '4px' }}>
                              Create a new checklist session below to begin.
                            </span>
                          </div>
                        ) : (
                          selectedSetDetails.sessions.map((s: any) => (
                            <div key={s.id} className="session-item-row">
                              <div>
                                <span
                                  style={{ fontWeight: 600, display: 'block', fontSize: '14px' }}
                                >
                                  {s.name}
                                </span>
                                <span
                                  style={{
                                    fontSize: '11px',
                                    color: 'var(--text-secondary)',
                                    display: 'flex',
                                    gap: '12px',
                                    marginTop: '4px'
                                  }}
                                >
                                  <span>
                                    Modified: {new Date(s.updated_at).toLocaleDateString()}
                                  </span>
                                  <span>•</span>
                                  <span>Spares: {s.include_spares ? 'Yes' : 'No'}</span>
                                </span>
                              </div>

                              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                <span
                                  className={`badge badge-${s.status === 'in_progress' ? 'partial' : 'complete'}`}
                                >
                                  {s.status.replace('_', ' ')}
                                </span>

                                <div style={{ display: 'flex', gap: '6px' }}>
                                  <Tooltip content="Open Session">
                                    <button
                                      className="btn btn-secondary btn-sm"
                                      onClick={() => {
                                        setDetailsModalOpen(false)
                                        onNavigateToSession(s.id)
                                      }}
                                      style={{ padding: '6px 10px' }}
                                    >
                                      <Play size={12} fill="currentColor" />
                                    </button>
                                  </Tooltip>
                                  <Tooltip content="Duplicate Session">
                                    <button
                                      className="btn btn-secondary btn-sm"
                                      onClick={(e) => handleDuplicateSession(e, s.id, s.name)}
                                      style={{ padding: '6px 10px' }}
                                    >
                                      <Copy size={12} />
                                    </button>
                                  </Tooltip>
                                  <Tooltip content="Delete Session">
                                    <button
                                      className="btn btn-secondary btn-sm btn-danger"
                                      onClick={(e) => handleDeleteSession(e, s.id)}
                                      style={{ padding: '6px 10px' }}
                                    >
                                      <Trash2 size={12} />
                                    </button>
                                  </Tooltip>
                                </div>
                              </div>
                            </div>
                          ))
                        )}
                      </div>

                      {/* Start new session form */}
                      <form
                        onSubmit={handleCreateSessionInDetails}
                        className="session-create-panel"
                      >
                        <h4
                          style={{
                            fontSize: '12px',
                            fontWeight: 700,
                            margin: 0,
                            color: 'var(--text-secondary)',
                            textTransform: 'uppercase',
                            letterSpacing: '0.8px'
                          }}
                        >
                          Start New Counting Session
                        </h4>

                        <div
                          style={{
                            display: 'grid',
                            gridTemplateColumns: '2fr 1fr',
                            gap: '16px',
                            alignItems: 'end'
                          }}
                        >
                          <div
                            className="form-group"
                            style={{ marginBottom: 0, gap: '4px', flex: 1 }}
                          >
                            <label
                              className="form-label"
                              style={{
                                fontSize: '10px',
                                fontWeight: 700,
                                textTransform: 'uppercase',
                                letterSpacing: '0.5px'
                              }}
                            >
                              Session Name
                            </label>
                            <input
                              type="text"
                              className="form-input"
                              style={{
                                padding: '8px 12px',
                                borderRadius: '8px',
                                fontSize: '13px',
                                background: 'var(--bg-main)'
                              }}
                              placeholder="Name of counting verification session..."
                              value={newSessionName}
                              onChange={(e) => setNewSessionName(e.target.value)}
                              required
                            />
                          </div>

                          <div
                            style={{
                              display: 'flex',
                              gap: '12px',
                              alignItems: 'center',
                              height: '36px'
                            }}
                          >
                            <div
                              className="custom-checkbox-container"
                              onClick={() => setNewSessionIncludeSpares(!newSessionIncludeSpares)}
                            >
                              <input
                                type="checkbox"
                                id="includeSparesDetails"
                                checked={newSessionIncludeSpares}
                                onChange={(e) => setNewSessionIncludeSpares(e.target.checked)}
                                style={{ width: '15px', height: '15px', cursor: 'pointer' }}
                              />
                              <label
                                htmlFor="includeSparesDetails"
                                style={{
                                  fontSize: '12px',
                                  fontWeight: 600,
                                  cursor: 'pointer',
                                  color: 'var(--text-secondary)'
                                }}
                              >
                                Include Spares
                              </label>
                            </div>

                            <button
                              type="submit"
                              className="btn btn-primary btn-sm"
                              disabled={creatingSession}
                              style={{
                                marginLeft: 'auto',
                                padding: '8px 16px',
                                fontSize: '12px',
                                height: '34px',
                                fontWeight: 700
                              }}
                            >
                              {creatingSession ? 'Starting...' : 'Start Counting'}
                            </button>
                          </div>
                        </div>
                      </form>
                    </div>
                  )}

                  {/* PARTS TAB */}
                  {detailsTab === 'parts' && (
                    <div
                      style={{ display: 'flex', flexDirection: 'column', minHeight: 0, flex: 1 }}
                    >
                      {/* Search and Filters panel */}
                      <div
                        className="glass-panel"
                        style={{
                          padding: '12px 16px',
                          marginBottom: '16px',
                          display: 'grid',
                          gridTemplateColumns: '2fr 1fr 1fr',
                          gap: '12px',
                          background: 'var(--bg-main)'
                        }}
                      >
                        <div className="form-group" style={{ margin: 0, gap: '4px' }}>
                          <label className="form-label" style={{ fontSize: '11px' }}>
                            Search Parts
                          </label>
                          <div style={{ position: 'relative' }}>
                            <input
                              type="text"
                              className="form-input"
                              placeholder="Search by ID or name..."
                              value={partsSearchQuery}
                              onChange={(e) => setPartsSearchQuery(e.target.value)}
                              style={{
                                padding: '6px 12px 6px 32px',
                                fontSize: '13px',
                                borderRadius: '6px'
                              }}
                            />
                            <Search
                              size={12}
                              style={{
                                position: 'absolute',
                                left: '10px',
                                top: '10px',
                                color: '#64748b'
                              }}
                            />
                          </div>
                        </div>

                        <div className="form-group" style={{ margin: 0, gap: '4px' }}>
                          <label className="form-label" style={{ fontSize: '11px' }}>
                            Technic Group
                          </label>
                          <select
                            className="form-input form-select"
                            style={{ padding: '6px 12px', fontSize: '13px', borderRadius: '6px' }}
                            value={partsGroupFilter}
                            onChange={(e) => setPartsGroupFilter(e.target.value)}
                          >
                            <option value="all">All Groups ({uniqueGroups.length})</option>
                            {uniqueGroups.map((g) => (
                              <option key={g} value={g}>
                                {g}
                              </option>
                            ))}
                          </select>
                        </div>

                        <div className="form-group" style={{ margin: 0, gap: '4px' }}>
                          <label className="form-label" style={{ fontSize: '11px' }}>
                            Color
                          </label>
                          <select
                            className="form-input form-select"
                            style={{ padding: '6px 12px', fontSize: '13px', borderRadius: '6px' }}
                            value={partsColorFilter}
                            onChange={(e) => setPartsColorFilter(e.target.value)}
                          >
                            <option value="all">All Colors ({uniqueColors.length})</option>
                            {uniqueColors.map((c) => (
                              <option key={c} value={c}>
                                {c}
                              </option>
                            ))}
                          </select>
                        </div>
                      </div>

                      {/* Parts list container */}
                      {partsLoading ? (
                        <div
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            flex: 1
                          }}
                        >
                          <Loader2
                            className="animate-spin"
                            size={24}
                            style={{ color: 'var(--text-secondary)' }}
                          />
                          <span style={{ marginLeft: '8px', color: 'var(--text-secondary)' }}>
                            Loading catalog parts...
                          </span>
                        </div>
                      ) : filteredParts.length === 0 ? (
                        <div
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            flex: 1,
                            color: 'var(--text-secondary)',
                            fontSize: '13px'
                          }}
                        >
                          No parts in this set match the current filters.
                        </div>
                      ) : (
                        <div className="parts-table-scroll">
                          <div className="parts-table-row parts-table-header-row">
                            <span>Img</span>
                            <span>Part Detail</span>
                            <span>Color</span>
                            <span>Category / Group</span>
                            <span style={{ textAlign: 'right' }}>Qty</span>
                          </div>

                          {filteredParts.slice(0, visiblePartsCount).map((p, index) => (
                            <div
                              key={`${p.part_num}-${p.color_id}-${p.is_spare}-${index}`}
                              className="parts-table-row"
                            >
                              {/* Part Image */}
                              <div
                                style={{
                                  width: '40px',
                                  height: '40px',
                                  background: 'rgba(255,255,255,0.02)',
                                  border: '1px solid var(--border-glass)',
                                  borderRadius: '6px',
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'center',
                                  overflow: 'hidden'
                                }}
                              >
                                {p.img_url ? (
                                  <CachedImage
                                    url={p.img_url}
                                    alt={p.part_name}
                                    style={{
                                      maxWidth: '90%',
                                      maxHeight: '90%',
                                      objectFit: 'contain'
                                    }}
                                  />
                                ) : (
                                  <Layers
                                    size={16}
                                    style={{ color: 'var(--text-secondary)', opacity: 0.5 }}
                                  />
                                )}
                              </div>

                              {/* Part Name & Number */}
                              <div style={{ minWidth: 0 }}>
                                <Tooltip content={p.part_name}>
                                  <span
                                    style={{
                                      fontWeight: 600,
                                      display: 'block',
                                      textOverflow: 'ellipsis',
                                      overflow: 'hidden',
                                      whiteSpace: 'nowrap',
                                      cursor: 'help'
                                    }}
                                  >
                                    {p.part_name}
                                  </span>
                                </Tooltip>
                                <span
                                  style={{
                                    fontSize: '11px',
                                    color: 'var(--text-secondary)',
                                    fontFamily: 'monospace'
                                  }}
                                >
                                  {p.part_num}
                                </span>
                              </div>

                              {/* Color Swatch & name */}
                              <div
                                style={{
                                  display: 'flex',
                                  alignItems: 'center',
                                  gap: '8px',
                                  minWidth: 0
                                }}
                              >
                                {p.color_rgb && (
                                  <Tooltip content={p.color_name}>
                                    <span
                                      className="color-swatch"
                                      style={{
                                        backgroundColor: `#${p.color_rgb}`,
                                        flexShrink: 0,
                                        cursor: 'help'
                                      }}
                                    />
                                  </Tooltip>
                                )}
                                <Tooltip content={p.color_name}>
                                  <span
                                    style={{
                                      textOverflow: 'ellipsis',
                                      overflow: 'hidden',
                                      whiteSpace: 'nowrap',
                                      cursor: 'help'
                                    }}
                                  >
                                    {p.color_name}
                                  </span>
                                </Tooltip>
                              </div>

                              {/* Group & Category */}
                              <div style={{ minWidth: 0 }}>
                                <Tooltip content={p.technic_group_name || 'Other'}>
                                  <span className="parts-group-label">
                                    <Layers size={12} />
                                    <span>{p.technic_group_name || 'Other'}</span>
                                  </span>
                                </Tooltip>
                                <Tooltip content={p.part_category_name}>
                                  <span
                                    style={{
                                      fontSize: '11px',
                                      color: 'var(--text-secondary)',
                                      textOverflow: 'ellipsis',
                                      overflow: 'hidden',
                                      whiteSpace: 'nowrap',
                                      display: 'block',
                                      cursor: 'help'
                                    }}
                                  >
                                    {p.part_category_name}
                                  </span>
                                </Tooltip>
                              </div>

                              {/* Quantity and Spare tag */}
                              <div
                                style={{
                                  textAlign: 'right',
                                  display: 'flex',
                                  flexDirection: 'column',
                                  alignItems: 'flex-end',
                                  gap: '4px'
                                }}
                              >
                                <span style={{ fontWeight: 700, fontSize: '14px' }}>
                                  {p.quantity}
                                </span>
                                {p.is_spare && (
                                  <span
                                    style={{
                                      fontSize: '9px',
                                      background: 'var(--status-partial-bg)',
                                      color: 'var(--status-partial)',
                                      padding: '1px 4px',
                                      borderRadius: '4px',
                                      fontWeight: 700,
                                      textTransform: 'uppercase'
                                    }}
                                  >
                                    Spare
                                  </span>
                                )}
                              </div>
                            </div>
                          ))}

                          {/* Load More Button */}
                          {filteredParts.length > visiblePartsCount && (
                            <button
                              className="btn btn-secondary btn-sm"
                              onClick={() => setVisiblePartsCount((prev) => prev + 50)}
                              style={{ width: '100%', padding: '10px', marginTop: '8px' }}
                            >
                              Load More Parts (+50)
                            </button>
                          )}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
