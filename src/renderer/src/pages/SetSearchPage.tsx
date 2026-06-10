import { useState, useEffect } from 'react'
import { Search, Layers, Play, AlertCircle, Loader2, Plus, Check } from 'lucide-react'
import CachedImage from '../components/CachedImage'
import Tooltip from '../components/Tooltip'
import { useDialog } from '../components/CustomDialog'

interface SetSearchPageProps {
  preselectedSetNum: string | null
  onSessionStart: (sessionId: number) => void
  onClearPreselected: () => void
}

export default function SetSearchPage({
  preselectedSetNum,
  onSessionStart,
  onClearPreselected
}: SetSearchPageProps) {
  const dialog = useDialog()
  const [query, setQuery] = useState('')
  const [sets, setSets] = useState<any[]>([])
  const [selectedSet, setSelectedSet] = useState<any | null>(null)
  const [loading, setLoading] = useState(false)
  const [selectedSetLoading, setSelectedSetLoading] = useState(false)
  const [hasSearched, setHasSearched] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Session Creation Modal state
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [sessionName, setSessionName] = useState('')
  const [includeSpares, setIncludeSpares] = useState(false)
  const [sessionNotes, setSessionNotes] = useState('')
  const [creatingSession, setCreatingSession] = useState(false)

  // Notes state
  const [setNotes, setSetNotes] = useState('')
  const [savingNotes, setSavingNotes] = useState(false)

  // Collection state
  const [isInCollection, setIsInCollection] = useState(false)
  const [checkingCollection, setCheckingCollection] = useState(false)

  const handleSearch = async (e?: React.FormEvent) => {
    if (e) e.preventDefault()
    if (!query.trim()) return

    setLoading(true)
    setHasSearched(true)
    setError(null)
    setSelectedSet(null)

    try {
      const res = await window.api.searchSets(query)
      if (res.success && res.sets) {
        setSets(res.sets)
        if (res.sets.length === 0) {
          setError('No matching sets found.')
        }
      } else {
        setError(res.error || 'Failed to search sets.')
      }
    } catch (err: any) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  const handleSelectSet = async (setNum: string) => {
    setSelectedSetLoading(true)
    setError(null)
    try {
      const res = await window.api.getSetDetails(setNum)
      if (res.success && res.details) {
        setSelectedSet(res.details)
        setSetNotes(res.details.notes || '')

        // Check if set is in user collection
        const collRes = await window.api.isSetInCollection(setNum)
        if (collRes.success) {
          setIsInCollection(!!collRes.isIn)
        }
      } else {
        setError(res.error || 'Failed to load set details.')
      }
    } catch (err: any) {
      setError(err.message)
    } finally {
      setSelectedSetLoading(false)
    }
  }

  const handleToggleCollection = async () => {
    if (!selectedSet) return
    setCheckingCollection(true)
    try {
      if (isInCollection) {
        const res = await window.api.removeFromCollection(selectedSet.set_num)
        if (res.success) {
          setIsInCollection(false)
        } else {
          await dialog.alert(res.error || 'Failed to remove set from collection.')
        }
      } else {
        const res = await window.api.addToCollection(selectedSet.set_num)
        if (res.success) {
          setIsInCollection(true)
          // Auto-download images for the newly added set
          window.api.downloadSetImages(selectedSet.set_num).catch(() => {})
        } else {
          await dialog.alert(res.error || 'Failed to add set to collection.')
        }
      }
    } catch (err: any) {
      await dialog.alert(err.message)
    } finally {
      setCheckingCollection(false)
    }
  }

  // Pre-selected set logic (navigating from other pages)
  useEffect(() => {
    if (preselectedSetNum) {
      setQuery(preselectedSetNum)
      handleSelectSet(preselectedSetNum)
      onClearPreselected()
    }
  }, [preselectedSetNum])

  const openStartSessionModal = () => {
    if (!selectedSet) return
    setSessionName(`${selectedSet.set_num} - ${selectedSet.name} - Inventory Check`)
    setIncludeSpares(false)
    setSessionNotes('')
    setIsModalOpen(true)
  }

  const handleCreateSession = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedSet) return

    setCreatingSession(true)
    try {
      const res = await window.api.createSession({
        set_num: selectedSet.set_num,
        name: sessionName,
        include_spares: includeSpares,
        notes: sessionNotes
      })

      if (res.success && res.sessionId) {
        setIsModalOpen(false)
        onSessionStart(res.sessionId)
      } else {
        await dialog.alert(res.error || 'Failed to create inventory session')
      }
    } catch (err: any) {
      await dialog.alert(err.message)
    } finally {
      setCreatingSession(false)
    }
  }

  const handleSaveSetNotes = async () => {
    if (!selectedSet) return
    setSavingNotes(true)
    try {
      await window.api.saveSetNotes(selectedSet.set_num, setNotes)
      // Update selected set notes local state
      setSelectedSet((prev) => (prev ? { ...prev, notes: setNotes } : null))
    } catch (err) {
      console.error('Failed to save set notes', err)
    } finally {
      setSavingNotes(false)
    }
  }

  return (
    <div className="page-container">
      <div>
        <h1>Search LEGO Sets</h1>
        <p className="subtitle">
          Locate a set to view catalog details or start an inventory verification session.
        </p>
      </div>

      {/* Search Input bar */}
      <form onSubmit={handleSearch} style={{ display: 'flex', gap: '12px' }}>
        <div style={{ position: 'relative', flex: 1 }}>
          <input
            type="text"
            className="form-input"
            placeholder="Search by Set Number (e.g. 42043-1), name, or year..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            style={{ paddingLeft: '44px' }}
          />
          <Search
            size={18}
            style={{ position: 'absolute', left: '16px', top: '14px', color: '#64748b' }}
          />
        </div>
        <button type="submit" className="btn btn-primary" disabled={loading}>
          {loading ? <Loader2 className="animate-spin" size={16} /> : 'Search'}
        </button>
      </form>

      {error && (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            color: 'var(--status-missing)',
            fontSize: '14px'
          }}
        >
          <AlertCircle size={16} />
          <span>{error}</span>
        </div>
      )}

      {/* Grid Layout: Search Results vs Details Sidebar */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: selectedSet ? '1.5fr 1fr' : '1fr',
          gap: '32px',
          alignItems: 'start',
          flex: 1,
          minHeight: 0,
          overflow: 'hidden'
        }}
      >
        {/* Results grid */}
        {sets.length === 0 && !loading && !error ? (
          <div className="glass-panel empty-slate search-empty-state">
            <Search size={28} />
            <p>
              {hasSearched
                ? 'No sets match the current search.'
                : 'Search by set number, name, or release year to start.'}
            </p>
          </div>
        ) : (
          <div style={{ overflowY: 'auto', height: '100%', paddingRight: '4px' }}>
            <div className="search-grid">
              {sets.map((set) => (
                <div
                  key={set.set_num}
                  className={`glass-panel set-card ${selectedSet?.set_num === set.set_num ? 'active' : ''}`}
                  style={{
                    cursor: 'pointer',
                    borderColor:
                      selectedSet?.set_num === set.set_num ? 'var(--primary)' : 'var(--border-glass)'
                  }}
                  onClick={() => handleSelectSet(set.set_num)}
                >
                  <div className="set-card-img-container">
                    {set.image_url ? (
                      <CachedImage url={set.image_url} alt={set.name} className="set-card-img" />
                    ) : (
                      <Layers size={48} style={{ color: '#475569' }} />
                    )}
                  </div>
                  <div className="set-card-details">
                    <span className="set-card-num">{set.set_num}</span>
                    <h3 className="set-card-name">{set.name}</h3>
                    <div className="set-card-meta">
                      <span>{set.num_parts} parts</span>
                      <span>{set.year}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Selected Set Details Panel */}
        {selectedSet && (
          <div className="set-inspector-panel">
            {selectedSetLoading && (
              <div className="set-inspector-loading">
                <Loader2 className="animate-spin" size={16} />
                <span>Updating set details...</span>
              </div>
            )}
            {selectedSet.image_url ? (
              <div style={{
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
                marginBottom: '8px'
              }}>
                <CachedImage
                  url={selectedSet.image_url}
                  alt={selectedSet.name}
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
                  marginBottom: '8px'
                }}
              >
                <Layers size={48} style={{ color: 'var(--text-secondary)', opacity: 0.3 }} />
              </div>
            )}
            <div style={{ minWidth: 0 }}>
              <span
                style={{
                  fontSize: '12px',
                  fontWeight: 700,
                  color: 'var(--accent)',
                  fontFamily: 'monospace'
                }}
              >
                {selectedSet.set_num}
              </span>
              <h2
                style={{
                  fontSize: '18px',
                  fontWeight: 800,
                  margin: '4px 0 0 0',
                  lineHeight: 1.3,
                  color: 'var(--text-primary)'
                }}
                title={selectedSet.name}
              >
                {selectedSet.name}
              </h2>
            </div>

            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                gap: '6px',
                borderTop: '1px solid var(--border-glass)',
                paddingTop: '10px'
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px' }}>
                <span style={{ color: 'var(--text-secondary)' }}>Theme:</span>
                <span style={{ fontWeight: 600 }}>{selectedSet.theme_name || 'N/A'}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px' }}>
                <span style={{ color: 'var(--text-secondary)' }}>Release Year:</span>
                <span style={{ fontWeight: 600 }}>{selectedSet.year || 'N/A'}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px' }}>
                <span style={{ color: 'var(--text-secondary)' }}>Parts Count:</span>
                <span style={{ fontWeight: 600 }}>{selectedSet.num_parts || 0}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px' }}>
                <span style={{ color: 'var(--text-secondary)' }}>Unique Rows:</span>
                <span style={{ fontWeight: 600 }}>{selectedSet.uniquePartsCount || 0}</span>
              </div>
            </div>

            {/* Set Notes Editor */}
            <div
              className="form-group"
              style={{
                borderTop: '1px solid var(--border-glass)',
                paddingTop: '10px',
                margin: 0,
                gap: '4px'
              }}
            >
              <label className="form-label" style={{ fontSize: '11px' }}>
                Set Notes (Custom)
              </label>
              <textarea
                className="form-input"
                rows={2}
                placeholder="E.g., Bought second hand..."
                value={setNotes}
                onChange={(e) => setSetNotes(e.target.value)}
                style={{
                  fontSize: '12px',
                  padding: '8px',
                  borderRadius: '6px',
                  fontFamily: 'inherit',
                  resize: 'none'
                }}
              />
              <button
                className="btn btn-secondary btn-sm"
                onClick={handleSaveSetNotes}
                style={{
                  alignSelf: 'flex-end',
                  marginTop: '2px',
                  padding: '4px 10px',
                  fontSize: '11px',
                  height: '24px'
                }}
                disabled={savingNotes}
              >
                {savingNotes ? 'Saving...' : 'Save Notes'}
              </button>
            </div>

            {/* Existing Sessions List */}
            {selectedSet.sessions && selectedSet.sessions.length > 0 && (
              <div style={{ borderTop: '1px solid var(--border-glass)', paddingTop: '10px' }}>
                <h4
                  style={{
                    fontSize: '11px',
                    fontWeight: 700,
                    color: '#64748b',
                    textTransform: 'uppercase',
                    marginBottom: '6px'
                  }}
                >
                  Existing Sessions
                </h4>
                <div
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '4px',
                    maxHeight: '140px',
                    overflowY: 'auto'
                  }}
                >
                  {selectedSet.sessions.map((s: any) => (
                    <div
                      key={s.id}
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        padding: '6px 4px',
                        borderBottom: '1px solid rgba(255,255,255,0.03)'
                      }}
                    >
                      <div
                        style={{ display: 'flex', flexDirection: 'column', minWidth: 0, flex: 1 }}
                      >
                        <span
                          style={{
                            fontSize: '12px',
                            fontWeight: 600,
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap'
                          }}
                        >
                          {s.name}
                        </span>
                        <span style={{ fontSize: '10px', color: '#64748b' }}>
                          Modified: {new Date(s.updated_at).toLocaleDateString()}
                        </span>
                      </div>
                      <Tooltip content="Resume session">
                        <button
                          className="btn btn-primary btn-sm btn-icon-only"
                          onClick={() => onSessionStart(s.id)}
                          style={{ padding: '4px', borderRadius: '6px' }}
                        >
                          <Play size={10} fill="white" />
                        </button>
                      </Tooltip>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="set-inspector-actions">
              <button
                type="button"
                className="btn btn-primary btn-sm"
                onClick={openStartSessionModal}
              >
                <Play size={14} fill="currentColor" />
                <span>Start Counting</span>
              </button>

              <button
                type="button"
                className="btn btn-secondary btn-sm"
                onClick={handleToggleCollection}
                disabled={checkingCollection}
              >
                {isInCollection ? <Check size={14} /> : <Plus size={14} />}
                <span>{isInCollection ? 'In Collection' : 'Add to Collection'}</span>
              </button>
            </div>
          </div>
        )}
      </div>

      {/* New Session Creation Modal Overlay */}
      {isModalOpen && selectedSet && (
        <div className="modal-overlay">
          <div className="glass-panel modal-content">
            <h2 style={{ fontSize: '20px', fontWeight: 800, marginBottom: '20px' }}>
              Start Inventory Session
            </h2>

            <form
              onSubmit={handleCreateSession}
              style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}
            >
              <div className="form-group">
                <label className="form-label">Session Name</label>
                <input
                  type="text"
                  className="form-input"
                  value={sessionName}
                  onChange={(e) => setSessionName(e.target.value)}
                  required
                />
              </div>

              {/* Include Spares Toggle */}
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '12px',
                  padding: '12px',
                  background: 'var(--bg-main)',
                  borderRadius: '8px',
                  border: '1px solid var(--border-glass)'
                }}
              >
                <input
                  type="checkbox"
                  id="includeSpares"
                  checked={includeSpares}
                  onChange={(e) => setIncludeSpares(e.target.checked)}
                  style={{ width: '18px', height: '18px', cursor: 'pointer' }}
                />
                <label
                  htmlFor="includeSpares"
                  style={{ fontSize: '13px', fontWeight: 600, cursor: 'pointer' }}
                >
                  Include Spare Parts in checklist
                </label>
              </div>

              <div className="form-group">
                <label className="form-label">Session Notes (Optional)</label>
                <textarea
                  className="form-input"
                  rows={3}
                  value={sessionNotes}
                  onChange={(e) => setSessionNotes(e.target.value)}
                  placeholder="Notes specific to this check session..."
                  style={{ fontFamily: 'inherit', resize: 'vertical' }}
                />
              </div>

              <div
                style={{
                  display: 'flex',
                  gap: '12px',
                  justifyContent: 'flex-end',
                  marginTop: '12px'
                }}
              >
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => setIsModalOpen(false)}
                  disabled={creatingSession}
                >
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary" disabled={creatingSession}>
                  {creatingSession ? 'Creating...' : 'Create Session'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
