import { useState, useEffect, useMemo } from 'react'
import { 
  ArrowLeft, 
  Grid, 
  List, 
  Check, 
  X, 
  Search, 
  Download, 
  AlertCircle,
  HelpCircle
} from 'lucide-react'
import { TECHNIC_GROUPS } from '../../../shared/constants/technicGroups'
import CachedImage from '../components/CachedImage'

interface InventorySessionPageProps {
  sessionId: number
  onBackToHome: () => void
}

export default function InventorySessionPage({ 
  sessionId, 
  onBackToHome 
}: InventorySessionPageProps) {
  const [session, setSession] = useState<any>(null)
  const [items, setItems] = useState<any[]>([])
  const [progress, setProgress] = useState<any>(null)
  const [loading, setLoading] = useState(true)

  // Filters State
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid')
  const [selectedGroup, setSelectedGroup] = useState<number | null>(null) // null = all
  const [statusFilter, setStatusFilter] = useState<string>('all')
  const [sparesFilter, setSparesFilter] = useState<string>('all')
  const [searchQuery, setSearchQuery] = useState<string>('')
  const [sortField, setSortField] = useState<string>('group')
  const [visibleCount, setVisibleCount] = useState<number>(48)

  // Session notes state
  const [sessionNotes, setSessionNotes] = useState('')
  const [savingSessionNotes, setSavingSessionNotes] = useState(false)

  // Item note input state (keyed by item ID)
  const [activeNoteItemId, setActiveNoteItemId] = useState<number | null>(null)
  const [itemNoteText, setItemNoteText] = useState('')

  // Export Modal state
  const [isExportOpen, setIsExportOpen] = useState(false)
  const [exportFormat, setExportFormat] = useState<'csv' | 'json'>('csv')
  const [exportFilter, setExportFilter] = useState<'all_missing' | 'non_spares_missing' | 'spares_missing'>('all_missing')
  const [exporting, setExporting] = useState(false)

  const loadSession = async () => {
    try {
      const res = await window.api.getSession(sessionId)
      if (res.success) {
        setSession(res.session)
        setItems(res.items || [])
        setProgress(res.progress)
        setSessionNotes(res.session.notes || '')
      }
    } catch (e) {
      console.error('Failed to load session', e)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadSession()
  }, [sessionId])

  // Handle item quantity change
  const handleQtyChange = async (itemId: number, value: number | null) => {
    // Optimistic local state update for snappy UI
    const updatedItems = items.map(item => {
      if (item.id === itemId) {
        const expected = item.expected_qty
        const counted = value
        
        let status: any = 'not_checked'
        if (counted === null) status = 'not_checked'
        else if (counted === 0 && expected > 0) status = 'missing'
        else if (counted > 0 && counted < expected) status = 'partial'
        else if (counted === expected) status = 'complete'
        else status = 'extra'

        return {
          ...item,
          counted_qty: value,
          status
        }
      }
      return item
    })

    setItems(updatedItems)
    
    // Recalculate progress metrics locally
    recalculateLocalProgress(updatedItems)

    try {
      await window.api.updateCountedQty(itemId, value)
    } catch (e) {
      console.error('Failed to save quantity', e)
      loadSession() // Rollback
    }
  }

  // Recalculate session progress metrics locally to avoid layout flashes
  const recalculateLocalProgress = (currentItems: any[]) => {
    const totalRows = currentItems.length
    let checkedRows = 0
    let totalExpectedQty = 0
    let totalCountedQty = 0
    let totalMissingQty = 0
    let totalExtraQty = 0
    let missingRowsCount = 0
    let extraRowsCount = 0

    for (const item of currentItems) {
      const expected = item.expected_qty
      const counted = item.counted_qty

      totalExpectedQty += expected

      if (counted !== null) {
        checkedRows++
        totalCountedQty += counted
        const diff = counted - expected

        if (diff < 0) {
          totalMissingQty += Math.abs(diff)
          missingRowsCount++
        } else if (diff > 0) {
          totalExtraQty += diff
          extraRowsCount++
        }
      } else {
        totalMissingQty += expected
      }
    }

    const rowCompletionPct = totalRows > 0 ? Math.round((checkedRows / totalRows) * 100) : 0
    const qtyCompletionPct = totalExpectedQty > 0 ? Math.round((Math.min(totalCountedQty, totalExpectedQty) / totalExpectedQty) * 100) : 0

    setProgress({
      totalRows,
      checkedRows,
      uncheckedRows: totalRows - checkedRows,
      totalExpectedQty,
      totalCountedQty,
      totalMissingQty,
      totalExtraQty,
      missingRowsCount,
      extraRowsCount,
      rowCompletionPct,
      qtyCompletionPct
    })
  }

  // Handle item note save
  const handleSaveItemNote = async (itemId: number) => {
    const updatedItems = items.map(item => {
      if (item.id === itemId) {
        return { ...item, notes: itemNoteText || null }
      }
      return item
    })
    setItems(updatedItems)
    setActiveNoteItemId(null)

    try {
      await window.api.updateItemNotes(itemId, itemNoteText || null)
    } catch (e) {
      console.error('Failed to save item note', e)
      loadSession()
    }
  }

  // Handle session notes update
  const handleSaveSessionNotes = async () => {
    setSavingSessionNotes(true)
    try {
      await window.api.updateSessionNotes(sessionId, sessionNotes || null)
    } catch (e) {
      console.error('Failed to save session notes', e)
    } finally {
      setSavingSessionNotes(false)
    }
  }

  // Handle session status toggle
  const handleStatusToggle = async (status: string) => {
    setSession(prev => prev ? { ...prev, status } : null)
    try {
      await window.api.updateSessionStatus(sessionId, status)
    } catch (e) {
      console.error('Failed to update session status', e)
    }
  }

  // Handle setting 100% complete directly
  const handleQuickComplete = async () => {
    const confirmComplete = window.confirm(
      "Are you sure you want to mark all parts as 100% complete? This will set the counted quantity of all parts to their expected quantity and mark the session as completed."
    )
    if (!confirmComplete) return

    setLoading(true)
    try {
      const res = await window.api.quickCompleteSession(sessionId)
      if (res.success) {
        await loadSession()
      } else {
        alert(res.error || 'Failed to complete session.')
      }
    } catch (e: any) {
      alert(e.message || 'An error occurred.')
    } finally {
      setLoading(false)
    }
  }

  // Export missing parts dialog handler
  const handleExport = async () => {
    setExporting(true)
    try {
      const res = await window.api.exportMissingParts(sessionId, exportFormat, exportFilter)
      if (res.success && !res.canceled) {
        alert(`Successfully exported missing parts to ${res.filePath}`)
        setIsExportOpen(false)
      } else if (res.error) {
        alert(res.error)
      }
    } catch (e: any) {
      alert(e.message)
    } finally {
      setExporting(false)
    }
  }

  // Filter and Sort Items
  const filteredAndSortedItems = useMemo(() => {
    let result = [...items]

    // 1. Technic Group filter
    if (selectedGroup !== null) {
      result = result.filter(item => item.technic_group_id === selectedGroup)
    }

    // 2. Status Filter
    if (statusFilter !== 'all') {
      result = result.filter(item => item.status === statusFilter)
    }

    // 3. Spares filter
    if (sparesFilter === 'spares_only') {
      result = result.filter(item => item.is_spare)
    } else if (sparesFilter === 'no_spares') {
      result = result.filter(item => !item.is_spare)
    }

    // 4. Search Query filter (fuzzy match name or part number)
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase()
      result = result.filter(item => 
        item.part_num.toLowerCase().includes(q) || 
        (item.part_name && item.part_name.toLowerCase().includes(q))
      )
    }

    // 5. Sorting
    result.sort((a, b) => {
      if (sortField === 'group') {
        const diff = (a.technic_group_id || 99) - (b.technic_group_id || 99)
        if (diff !== 0) return diff
        return a.part_name?.localeCompare(b.part_name || '') || 0
      }
      if (sortField === 'part_num') {
        return a.part_num.localeCompare(b.part_num)
      }
      if (sortField === 'part_name') {
        return a.part_name?.localeCompare(b.part_name || '') || 0
      }
      if (sortField === 'color') {
        return a.color_name?.localeCompare(b.color_name || '') || 0
      }
      if (sortField === 'expected') {
        return b.expected_qty - a.expected_qty
      }
      if (sortField === 'counted') {
        return (b.counted_qty || 0) - (a.counted_qty || 0)
      }
      if (sortField === 'status') {
        return a.status.localeCompare(b.status)
      }
      return 0
    })

    return result
  }, [items, selectedGroup, statusFilter, sparesFilter, searchQuery, sortField])

  const visibleItems = useMemo(() => {
    return filteredAndSortedItems.slice(0, visibleCount)
  }, [filteredAndSortedItems, visibleCount])

  if (loading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', flex: 1 }}>
        <p style={{ color: 'var(--text-secondary)' }}>Loading inventory session...</p>
      </div>
    )
  }

  if (!session) {
    return (
      <div style={{ padding: '24px', textAlign: 'center', color: '#ef4444' }}>
        <AlertCircle size={48} style={{ margin: '0 auto 16px auto' }} />
        <h2>Session Not Found</h2>
        <button className="btn btn-secondary btn-sm" onClick={onBackToHome} style={{ marginTop: '12px' }}>
          <ArrowLeft size={16} />
          <span>Back to Dashboard</span>
        </button>
      </div>
    )
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: '100%' }}>
      {/* Header Bar */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '24px', gap: '16px' }}>
        <div style={{ display: 'flex', gap: '16px', alignItems: 'center' }}>
          <button className="btn btn-secondary btn-icon-only" onClick={onBackToHome}>
            <ArrowLeft size={18} />
          </button>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <h1 style={{ margin: 0, fontSize: '22px' }}>{session.name}</h1>
              <span className={`badge badge-${session.status === 'in_progress' ? 'partial' : 'complete'}`}>
                {session.status.replace('_', ' ')}
              </span>
            </div>
            <p style={{ color: '#64748b', fontSize: '13px', margin: 0 }}>
              LEGO Set: <strong style={{ color: 'var(--text-secondary)' }}>{session.set_num}</strong> • {session.set_name}
            </p>
          </div>
        </div>

        <div style={{ display: 'flex', gap: '12px' }}>
          {/* Status Select */}
          <select 
            className="form-input" 
            style={{ width: '140px', padding: '8px 12px', fontSize: '13px' }}
            value={session.status}
            onChange={(e) => handleStatusToggle(e.target.value)}
          >
            <option value="in_progress">In Progress</option>
            <option value="completed">Completed</option>
            <option value="abandoned">Abandoned</option>
          </select>

          {session.status !== 'completed' && (
            <button 
              className="btn btn-secondary btn-sm" 
              onClick={handleQuickComplete}
              style={{ background: 'rgba(16,185,129,0.15)', borderColor: 'rgba(16,185,129,0.2)', color: '#a7f3d0' }}
            >
              <Check size={14} />
              <span>Quick Complete</span>
            </button>
          )}

          <button className="btn btn-secondary btn-sm" onClick={() => setIsExportOpen(true)}>
            <Download size={14} />
            <span>Export Missing</span>
          </button>
        </div>
      </div>

      {/* Progress Cards */}
      {progress && (
        <div className="glass-panel session-summary">
          <div className="summary-item">
            <span className="summary-label">Progress</span>
            <span className="summary-value" style={{ color: 'var(--accent)' }}>{progress.rowCompletionPct}%</span>
            <span style={{ fontSize: '11px', color: '#64748b' }}>{progress.checkedRows} of {progress.totalRows} rows checked</span>
          </div>

          <div className="summary-item">
            <span className="summary-label">Quantity Completeness</span>
            <span className="summary-value" style={{ color: 'var(--status-complete)' }}>{progress.qtyCompletionPct}%</span>
            <span style={{ fontSize: '11px', color: '#64748b' }}>{progress.totalCountedQty} / {progress.totalExpectedQty} pieces</span>
          </div>

          <div className="summary-item">
            <span className="summary-label">Missing Pieces</span>
            <span className="summary-value" style={{ color: 'var(--status-missing)' }}>{progress.totalMissingQty}</span>
            <span style={{ fontSize: '11px', color: '#64748b' }}>across {progress.missingRowsCount} rows</span>
          </div>

          <div className="summary-item">
            <span className="summary-label">Extra Pieces</span>
            <span className="summary-value" style={{ color: 'var(--status-extra)' }}>{progress.totalExtraQty}</span>
            <span style={{ fontSize: '11px', color: '#64748b' }}>surplus parts counted</span>
          </div>
        </div>
      )}

      {/* Technic Group Tabs Navigator */}
      <div className="group-nav">
        <button 
          className={`group-tab ${selectedGroup === null ? 'active' : ''}`}
          onClick={() => { setSelectedGroup(null); setVisibleCount(48); }}
        >
          All Parts
        </button>
        {TECHNIC_GROUPS.map((group) => (
          <button 
            key={group.id}
            className={`group-tab ${selectedGroup === group.id ? 'active' : ''}`}
            onClick={() => { setSelectedGroup(group.id); setVisibleCount(48); }}
          >
            {group.name}
          </button>
        ))}
      </div>

      {/* Controls Bar: Filters & Display mode */}
      <div className="glass-panel filter-panel">
        {/* Search */}
        <div className="form-group" style={{ margin: 0 }}>
          <label className="form-label">Search part name/number</label>
          <div style={{ position: 'relative' }}>
            <input 
              type="text" 
              className="form-input" 
              placeholder="Filter list..."
              value={searchQuery}
              onChange={(e) => { setSearchQuery(e.target.value); setVisibleCount(48); }}
              style={{ paddingLeft: '36px', paddingTop: '8px', paddingBottom: '8px', borderRadius: '8px' }}
            />
            <Search size={14} style={{ position: 'absolute', left: '12px', top: '11px', color: '#64748b' }} />
          </div>
        </div>

        {/* Status Filter */}
        <div className="form-group" style={{ margin: 0 }}>
          <label className="form-label">Status</label>
          <select 
            className="form-input form-select" 
            style={{ paddingTop: '8px', paddingBottom: '8px', borderRadius: '8px' }}
            value={statusFilter}
            onChange={(e) => { setStatusFilter(e.target.value); setVisibleCount(48); }}
          >
            <option value="all">All Statuses</option>
            <option value="not_checked">Unchecked</option>
            <option value="complete">Complete</option>
            <option value="missing">Missing (0 counted)</option>
            <option value="partial">Partial (incomplete)</option>
            <option value="extra">Extra (surplus)</option>
          </select>
        </div>

        {/* Sort Filter */}
        <div className="form-group" style={{ margin: 0 }}>
          <label className="form-label">Sort By</label>
          <select 
            className="form-input form-select" 
            style={{ paddingTop: '8px', paddingBottom: '8px', borderRadius: '8px' }}
            value={sortField}
            onChange={(e) => setSortField(e.target.value)}
          >
            <option value="group">Technic Group</option>
            <option value="part_num">Part Number</option>
            <option value="part_name">Part Name</option>
            <option value="color">Color Name</option>
            <option value="expected">Expected Quantity</option>
            <option value="counted">Counted Quantity</option>
            <option value="status">Completeness Status</option>
          </select>
        </div>

        {/* View Toggle + Spares filter */}
        <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
          <div className="form-group" style={{ margin: 0, flex: 1 }}>
            <label className="form-label">Spares</label>
            <select 
              className="form-input form-select" 
              style={{ paddingTop: '8px', paddingBottom: '8px', borderRadius: '8px' }}
              value={sparesFilter}
              onChange={(e) => { setSparesFilter(e.target.value); setVisibleCount(48); }}
            >
              <option value="all">Show Spares</option>
              <option value="no_spares">Hide Spares</option>
              <option value="spares_only">Spares Only</option>
            </select>
          </div>

          <div style={{ display: 'flex', gap: '4px', border: '1px solid var(--border-glass)', borderRadius: '8px', padding: '4px', background: 'rgba(0,0,0,0.2)' }}>
            <button 
              className={`btn btn-secondary btn-icon-only btn-sm ${viewMode === 'grid' ? 'active' : ''}`}
              style={{ background: viewMode === 'grid' ? 'var(--primary)' : 'transparent', border: 'none', padding: '6px', borderRadius: '6px' }}
              onClick={() => setViewMode('grid')}
            >
              <Grid size={16} />
            </button>
            <button 
              className={`btn btn-secondary btn-icon-only btn-sm ${viewMode === 'list' ? 'active' : ''}`}
              style={{ background: viewMode === 'list' ? 'var(--primary)' : 'transparent', border: 'none', padding: '6px', borderRadius: '6px' }}
              onClick={() => setViewMode('list')}
            >
              <List size={16} />
            </button>
          </div>
        </div>
      </div>

      {/* Main Parts Grid/List scroll area */}
      <div style={{ flex: 1, marginBottom: '24px' }}>
        {filteredAndSortedItems.length === 0 ? (
          <div className="glass-panel" style={{ padding: '48px' }}>
            <div className="empty-slate">
              <Search />
              <p>No parts match the selected filters.</p>
            </div>
          </div>
        ) : viewMode === 'grid' ? (
          /* Card Grid View */
          <div className="parts-grid">
            {visibleItems.map(item => {
              const hasCounted = item.counted_qty !== null
              const isNotesActive = activeNoteItemId === item.id

              return (
                <div key={item.id} className="glass-panel part-card" style={{ borderColor: hasCounted ? 'rgba(255,255,255,0.08)' : 'rgba(59,130,246,0.3)' }}>
                  <div className="part-card-img-container">
                    {item.source_img_url ? (
                      <CachedImage url={item.source_img_url} alt={item.part_name} className="part-card-img" />
                    ) : (
                      <HelpCircle size={40} style={{ color: '#475569' }} />
                    )}
                    {item.is_spare && (
                      <span style={{ position: 'absolute', top: '8px', right: '8px', fontSize: '9px', background: 'rgba(245,158,11,0.15)', color: '#fde68a', padding: '1px 5px', borderRadius: '4px', fontWeight: 600 }}>
                        Spare
                      </span>
                    )}
                  </div>

                  <span className="part-card-num">{item.part_num}</span>
                  <h3 className="part-card-name" title={item.part_name}>{item.part_name || 'Unknown Part'}</h3>
                  
                  <div className="part-card-color">
                    <span className="color-swatch" style={{ backgroundColor: `#${item.color_rgb || 'FFFFFF'}` }}></span>
                    <span style={{ textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap', maxWidth: '160px' }}>
                      {item.color_name} {item.color_transparent ? '(Trans)' : ''}
                    </span>
                  </div>

                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                    <span className={`badge badge-${item.status}`}>
                      {item.status.replace('_', ' ')}
                    </span>
                    {item.notes && (
                      <span style={{ fontSize: '11px', color: '#f59e0b', maxWidth: '100px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={item.notes}>
                        📝 {item.notes}
                      </span>
                    )}
                  </div>

                  <div className="part-card-qtys">
                    <span className="part-card-qty-label">Expected: <strong>{item.expected_qty}</strong></span>
                    <span className="part-card-qty-label">
                      Counted: <strong style={{ color: hasCounted ? 'inherit' : '#64748b' }}>{hasCounted ? item.counted_qty : '—'}</strong>
                    </span>
                  </div>

                  {/* Quantity Actions */}
                  <div className="qty-controls" style={{ marginBottom: '12px' }}>
                    <button className="btn-qty" onClick={() => handleQtyChange(item.id, Math.max(0, (item.counted_qty || 0) - 1))}>
                      -
                    </button>
                    <input 
                      type="number"
                      className="qty-input-box"
                      value={item.counted_qty === null ? '' : item.counted_qty}
                      onChange={(e) => {
                        const val = e.target.value === '' ? null : parseInt(e.target.value, 10)
                        if (val === null || (!isNaN(val) && val >= 0)) {
                          handleQtyChange(item.id, val)
                        }
                      }}
                      placeholder="—"
                    />
                    <button className="btn-qty" onClick={() => handleQtyChange(item.id, (item.counted_qty || 0) + 1)}>
                      +
                    </button>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr 1fr', gap: '6px' }}>
                    <button 
                      className="btn btn-secondary btn-sm"
                      style={{ padding: '4px', fontSize: '11px', background: 'rgba(16,185,129,0.15)', borderColor: 'rgba(16,185,129,0.2)', color: '#a7f3d0' }}
                      onClick={() => handleQtyChange(item.id, item.expected_qty)}
                    >
                      OK
                    </button>
                    <button 
                      className="btn btn-secondary btn-sm"
                      style={{ padding: '4px', fontSize: '11px', background: 'rgba(239,68,68,0.15)', borderColor: 'rgba(239,68,68,0.2)', color: '#fca5a5' }}
                      onClick={() => handleQtyChange(item.id, 0)}
                    >
                      Miss
                    </button>
                    <button 
                      className="btn btn-secondary btn-sm"
                      style={{ padding: '4px', fontSize: '11px' }}
                      onClick={() => handleQtyChange(item.id, null)}
                    >
                      Reset
                    </button>
                  </div>

                  {/* Note editor button/input */}
                  {isNotesActive ? (
                    <div style={{ marginTop: '12px', display: 'flex', gap: '4px' }}>
                      <input 
                        type="text" 
                        className="form-input" 
                        style={{ padding: '4px 8px', fontSize: '12px' }}
                        value={itemNoteText}
                        onChange={(e) => setItemNoteText(e.target.value)}
                        placeholder="Add note..."
                        autoFocus
                      />
                      <button className="btn btn-primary btn-sm" style={{ padding: '4px 8px' }} onClick={() => handleSaveItemNote(item.id)}>
                        <Check size={12} />
                      </button>
                      <button className="btn btn-secondary btn-sm" style={{ padding: '4px 8px' }} onClick={() => setActiveNoteItemId(null)}>
                        <X size={12} />
                      </button>
                    </div>
                  ) : (
                    <button 
                      style={{ background: 'transparent', border: 'none', color: '#64748b', fontSize: '11px', marginTop: '10px', alignSelf: 'flex-start', cursor: 'pointer' }}
                      onClick={() => { setActiveNoteItemId(item.id); setItemNoteText(item.notes || ''); }}
                    >
                      {item.notes ? 'Edit note' : '+ Add item note'}
                    </button>
                  )}
                </div>
              )
            })}
          </div>
        ) : (
          /* List Row View */
          <div className="glass-panel" style={{ display: 'flex', flexDirection: 'column' }}>
            {/* Header row */}
            <div className="part-row" style={{ fontWeight: 700, color: '#64748b', borderBottom: '1px solid rgba(255,255,255,0.08)', fontSize: '12px', textTransform: 'uppercase' }}>
              <span>Image</span>
              <span>Number</span>
              <span>Name</span>
              <span>Color</span>
              <span>Expected</span>
              <span>Counted / Status</span>
              <span>Actions</span>
            </div>

            {visibleItems.map(item => {
              const hasCounted = item.counted_qty !== null
              const isNotesActive = activeNoteItemId === item.id

              return (
                <div key={item.id} className="part-row">
                  <div className="part-row-img">
                    {item.source_img_url ? (
                      <CachedImage url={item.source_img_url} alt={item.part_name} style={{ maxWidth: '85%', maxHeight: '85%', objectFit: 'contain' }} />
                    ) : (
                      <HelpCircle size={20} style={{ color: '#475569' }} />
                    )}
                  </div>

                  <span className="part-row-text" style={{ fontFamily: 'monospace' }}>{item.part_num}</span>
                  
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                    <span className="part-row-text" style={{ fontWeight: 600 }}>{item.part_name || 'Unknown Part'}</span>
                    <span style={{ fontSize: '11px', color: '#64748b' }}>{item.part_category_name || 'Category'} {item.is_spare ? '(Spare)' : ''}</span>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <span className="color-swatch" style={{ backgroundColor: `#${item.color_rgb || 'FFFFFF'}`, width: '10px', height: '10px' }}></span>
                    <span style={{ fontSize: '13px' }}>{item.color_name}</span>
                  </div>

                  <span className="part-row-text" style={{ fontWeight: 700, textAlign: 'center' }}>{item.expected_qty}</span>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <span className={`badge badge-${item.status}`} style={{ padding: '2px 8px', fontSize: '11px' }}>
                      {item.status.replace('_', ' ')}
                    </span>
                    <span style={{ fontWeight: 700, fontSize: '14px', color: hasCounted ? 'inherit' : '#64748b' }}>
                      {hasCounted ? item.counted_qty : '—'}
                    </span>
                  </div>

                  {/* Quantity and notes inputs */}
                  <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                    <div className="qty-controls" style={{ gap: '4px' }}>
                      <button className="btn-qty" style={{ width: '24px', height: '24px', borderRadius: '6px', fontSize: '12px' }} onClick={() => handleQtyChange(item.id, Math.max(0, (item.counted_qty || 0) - 1))}>
                        -
                      </button>
                      <input 
                        type="number"
                        className="qty-input-box"
                        style={{ width: '36px', padding: '2px 4px', fontSize: '12px', borderRadius: '4px' }}
                        value={item.counted_qty === null ? '' : item.counted_qty}
                        onChange={(e) => {
                          const val = e.target.value === '' ? null : parseInt(e.target.value, 10)
                          if (val === null || (!isNaN(val) && val >= 0)) {
                            handleQtyChange(item.id, val)
                          }
                        }}
                      />
                      <button className="btn-qty" style={{ width: '24px', height: '24px', borderRadius: '6px', fontSize: '12px' }} onClick={() => handleQtyChange(item.id, (item.counted_qty || 0) + 1)}>
                        +
                      </button>
                    </div>

                    <button 
                      className="btn btn-secondary btn-sm"
                      style={{ padding: '4px 8px', fontSize: '11px', background: 'rgba(16,185,129,0.15)', borderColor: 'rgba(16,185,129,0.2)', color: '#a7f3d0' }}
                      onClick={() => handleQtyChange(item.id, item.expected_qty)}
                    >
                      OK
                    </button>

                    <button 
                      className="btn btn-secondary btn-sm"
                      style={{ padding: '4px 8px', fontSize: '11px', background: 'rgba(239,68,68,0.15)', borderColor: 'rgba(239,68,68,0.2)', color: '#fca5a5' }}
                      onClick={() => handleQtyChange(item.id, 0)}
                    >
                      Miss
                    </button>

                    {isNotesActive ? (
                      <div style={{ display: 'flex', gap: '2px', alignItems: 'center' }}>
                        <input 
                          type="text" 
                          className="form-input" 
                          style={{ padding: '4px', fontSize: '11px', width: '80px' }}
                          value={itemNoteText}
                          onChange={(e) => setItemNoteText(e.target.value)}
                          placeholder="Note..."
                          autoFocus
                        />
                        <button className="btn btn-primary btn-sm" style={{ padding: '4px' }} onClick={() => handleSaveItemNote(item.id)}>
                          <Check size={10} />
                        </button>
                      </div>
                    ) : (
                      <button 
                        className="btn btn-secondary btn-sm"
                        style={{ padding: '4px 8px', fontSize: '11px' }}
                        onClick={() => { setActiveNoteItemId(item.id); setItemNoteText(item.notes || ''); }}
                      >
                        {item.notes ? '📝 Edit' : '+ Note'}
                      </button>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        )}

        {/* Load More scroll trigger */}
        {filteredAndSortedItems.length > visibleCount && (
          <div style={{ display: 'flex', justifyContent: 'center', marginTop: '24px' }}>
            <button className="btn btn-secondary" onClick={() => setVisibleCount(prev => prev + 48)}>
              Load More Parts ({filteredAndSortedItems.length - visibleCount} remaining)
            </button>
          </div>
        )}
      </div>

      {/* Session Notes Card */}
      <div className="glass-panel" style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
        <h3 style={{ fontSize: '15px', fontWeight: 700 }}>Session Notes</h3>
        <textarea 
          className="form-input"
          rows={3}
          value={sessionNotes}
          onChange={(e) => setSessionNotes(e.target.value)}
          placeholder="Add observations about this counting session..."
          style={{ fontFamily: 'inherit', resize: 'vertical' }}
        />
        <button 
          className="btn btn-secondary btn-sm" 
          onClick={handleSaveSessionNotes}
          style={{ alignSelf: 'flex-end' }}
          disabled={savingSessionNotes}
        >
          {savingSessionNotes ? 'Saving...' : 'Save Session Notes'}
        </button>
      </div>

      {/* Export Missing Parts Modal Overlay */}
      {isExportOpen && (
        <div className="modal-overlay">
          <div className="glass-panel modal-content">
            <h2 style={{ fontSize: '20px', fontWeight: 800, marginBottom: '20px' }}>Export Missing Parts</h2>
            
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div className="form-group">
                <label className="form-label">Export Format</label>
                <select 
                  className="form-input form-select"
                  value={exportFormat}
                  onChange={(e) => setExportFormat(e.target.value as any)}
                >
                  <option value="csv">CSV File (*.csv)</option>
                  <option value="json">JSON File (*.json)</option>
                </select>
              </div>

              <div className="form-group">
                <label className="form-label">Filter Parts</label>
                <select 
                  className="form-input form-select"
                  value={exportFilter}
                  onChange={(e) => setExportFilter(e.target.value as any)}
                >
                  <option value="all_missing">All Missing Parts (Includes spares)</option>
                  <option value="non_spares_missing">Required Build Parts Only (Excludes spares)</option>
                  <option value="spares_missing">Spares Only</option>
                </select>
              </div>

              <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end', marginTop: '12px' }}>
                <button className="btn btn-secondary" onClick={() => setIsExportOpen(false)} disabled={exporting}>
                  Cancel
                </button>
                <button className="btn btn-primary" onClick={handleExport} disabled={exporting}>
                  {exporting ? 'Exporting...' : 'Choose Save Location & Export'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
