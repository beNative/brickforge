import { useState, useEffect, useMemo, useRef, useCallback } from 'react'
import {
  ArrowLeft,
  Grid,
  List,
  Check,
  X,
  Minus,
  Plus,
  RotateCcw,
  Search,
  Download,
  AlertCircle,
  HelpCircle,
  StickyNote
} from 'lucide-react'
import { TECHNIC_GROUPS } from '../../../shared/constants/technicGroups'
import CachedImage from '../components/CachedImage'
import Tooltip from '../components/Tooltip'
import { useDialog } from '../components/CustomDialog'

interface InventorySessionPageProps {
  sessionId: number
  onBackToHome: () => void
}

export default function InventorySessionPage({
  sessionId,
  onBackToHome
}: InventorySessionPageProps) {
  const dialog = useDialog()
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
  const [notesOpen, setNotesOpen] = useState(false)

  // Item note input state (keyed by item ID)
  const [activeNoteItemId, setActiveNoteItemId] = useState<number | null>(null)
  const [itemNoteText, setItemNoteText] = useState('')

  // Export Modal state
  const [isExportOpen, setIsExportOpen] = useState(false)
  const [exportFormat, setExportFormat] = useState<'csv' | 'json' | 'xml'>('csv')
  const [exportFilter, setExportFilter] = useState<
    'all_missing' | 'non_spares_missing' | 'spares_missing'
  >('all_missing')
  const [exporting, setExporting] = useState(false)

  // Hide Completed & Grid Scale state (persisted to localStorage)
  const [hideCompleted, setHideCompleted] = useState<boolean>(() => {
    return localStorage.getItem('brickforge_hide_completed') === 'true'
  })
  const [gridScale, setGridScale] = useState<'sm' | 'md' | 'lg'>(() => {
    return (localStorage.getItem('brickforge_grid_scale') as any) || 'md'
  })

  useEffect(() => {
    localStorage.setItem('brickforge_hide_completed', String(hideCompleted))
  }, [hideCompleted])

  useEffect(() => {
    localStorage.setItem('brickforge_grid_scale', gridScale)
  }, [gridScale])

  // Keyboard navigation & focus state
  const [focusedIndex, setFocusedIndex] = useState<number | null>(null)
  const gridRef = useRef<HTMLDivElement>(null)
  const listRef = useRef<HTMLDivElement>(null)

  const loadSession = useCallback(async () => {
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
  }, [sessionId])

  useEffect(() => {
    loadSession()
  }, [sessionId, loadSession])

  // Handle item quantity change
  const handleQtyChange = useCallback(
    async (itemId: number, value: number | null) => {
      // Optimistic local state update for snappy UI
      const updatedItems = items.map((item) => {
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
    },
    [items, loadSession]
  )

  // Handle expected quantity override
  const handleOverrideExpected = useCallback(
    async (itemId: number, currentExpected: number) => {
      const res = await dialog.prompt(
        'Enter new expected count for this part (this will also update the global catalog count for this set):',
        String(currentExpected),
        'Override Expected Quantity',
        'Expected Quantity'
      )
      if (res === null) return // Canceled

      const parsed = parseInt(res, 10)
      if (isNaN(parsed) || parsed < 0) {
        await dialog.alert('Please enter a valid non-negative integer.')
        return
      }

      // Optimistic local state update for snappy UI
      const updatedItems = items.map((item) => {
        if (item.id === itemId) {
          const expected = parsed
          const counted = item.counted_qty

          let status: any = 'not_checked'
          if (counted === null) status = 'not_checked'
          else if (counted === 0 && expected > 0) status = 'missing'
          else if (counted > 0 && counted < expected) status = 'partial'
          else if (counted === expected) status = 'complete'
          else status = 'extra'

          return {
            ...item,
            expected_qty: expected,
            status
          }
        }
        return item
      })

      setItems(updatedItems)

      // Recalculate progress metrics locally
      recalculateLocalProgress(updatedItems)

      try {
        const response = await window.api.updateExpectedQty(itemId, parsed)
        if (!response.success) {
          throw new Error(response.error || 'Failed to update expected quantity')
        }
      } catch (e: any) {
        console.error('Failed to save expected quantity', e)
        await dialog.alert(e.message || 'Failed to save expected quantity')
        loadSession() // Rollback
      }
    },
    [items, loadSession, dialog]
  )

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
    const qtyCompletionPct =
      totalExpectedQty > 0
        ? Math.round((Math.min(totalCountedQty, totalExpectedQty) / totalExpectedQty) * 100)
        : 0

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
    const updatedItems = items.map((item) => {
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
    setSession((prev) => (prev ? { ...prev, status } : null))
    try {
      await window.api.updateSessionStatus(sessionId, status)
    } catch (e) {
      console.error('Failed to update session status', e)
    }
  }

  // Handle setting 100% complete directly
  const handleQuickComplete = async () => {
    const confirmComplete = await dialog.confirm(
      'Are you sure you want to mark all parts as 100% complete? This will set the counted quantity of all parts to their expected quantity and mark the session as completed.'
    )
    if (!confirmComplete) return

    setLoading(true)
    try {
      const res = await window.api.quickCompleteSession(sessionId)
      if (res.success) {
        await loadSession()
      } else {
        await dialog.alert(res.error || 'Failed to complete session.')
      }
    } catch (e: any) {
      await dialog.alert(e.message || 'An error occurred.')
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
        await dialog.alert(`Successfully exported missing parts to ${res.filePath}`)
        setIsExportOpen(false)
      } else if (res.error) {
        await dialog.alert(res.error)
      }
    } catch (e: any) {
      await dialog.alert(e.message)
    } finally {
      setExporting(false)
    }
  }

  // Filter and Sort Items
  const filteredAndSortedItems = useMemo(() => {
    let result = [...items]

    // 1. Technic Group filter
    if (selectedGroup !== null) {
      result = result.filter((item) => item.technic_group_id === selectedGroup)
    }

    // 2. Status Filter
    if (statusFilter === 'to_count') {
      // Show unchecked, partial, and missing (expected not matched by counted)
      result = result.filter((item) => item.status !== 'complete' && item.status !== 'extra')
    } else if (statusFilter === 'checked_active') {
      // Show anything that is checked (any status other than unchecked)
      result = result.filter((item) => item.status !== 'not_checked')
    } else if (statusFilter !== 'all') {
      result = result.filter((item) => item.status === statusFilter)
    }

    // Hide Completed toggle
    if (hideCompleted) {
      result = result.filter((item) => item.status !== 'complete')
    }

    // 3. Spares filter
    if (sparesFilter === 'spares_only') {
      result = result.filter((item) => item.is_spare)
    } else if (sparesFilter === 'no_spares') {
      result = result.filter((item) => !item.is_spare)
    }

    // 4. Search Query filter (fuzzy match name or part number)
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase()
      result = result.filter(
        (item) =>
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
  }, [items, selectedGroup, statusFilter, sparesFilter, searchQuery, sortField, hideCompleted])

  const visibleItems = useMemo(() => {
    return filteredAndSortedItems.slice(0, visibleCount)
  }, [filteredAndSortedItems, visibleCount])

  // Reset focus when filters or viewMode changes
  useEffect(() => {
    setFocusedIndex(null)
  }, [selectedGroup, statusFilter, sparesFilter, searchQuery, sortField, viewMode, hideCompleted])

  // Keydown listener for keyboard-driven counting
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const activeEl = document.activeElement as HTMLElement
      const isInputFocused =
        activeEl &&
        (activeEl.tagName === 'INPUT' || activeEl.tagName === 'TEXTAREA') &&
        !activeEl.classList.contains('qty-input-box')

      if (isInputFocused || notesOpen || isExportOpen) {
        return
      }

      const totalVisible = visibleItems.length
      if (totalVisible === 0) return

      const focusWrapper = (index: number) => {
        setFocusedIndex(index)
        setTimeout(() => {
          const focusedEl = document.querySelector(
            viewMode === 'grid' ? '.part-card.keyboard-focused' : '.part-row.keyboard-focused'
          )
          if (focusedEl) {
            focusedEl.scrollIntoView({ block: 'nearest', behavior: 'smooth' })
          }
        }, 30)
      }

      const isQtyInputActive = activeEl && activeEl.classList.contains('qty-input-box')

      if (isQtyInputActive) {
        if (e.key === 'Enter') {
          e.preventDefault()
          activeEl.blur()
          const parentWrapper = activeEl.closest(
            viewMode === 'grid' ? '.part-card' : '.part-row'
          ) as HTMLElement
          if (parentWrapper) {
            parentWrapper.focus()
          }
        }
        return
      }

      const navKeys = [
        'ArrowLeft',
        'ArrowRight',
        'ArrowUp',
        'ArrowDown',
        'a',
        'd',
        'w',
        's',
        'A',
        'D',
        'W',
        'S'
      ]

      if (focusedIndex === null) {
        if (navKeys.includes(e.key)) {
          e.preventDefault()
          focusWrapper(0)
        }
        return
      }

      if (e.key === 'ArrowLeft' || e.key === 'a' || e.key === 'A') {
        e.preventDefault()
        const nextIdx = Math.max(0, focusedIndex - 1)
        focusWrapper(nextIdx)
      } else if (e.key === 'ArrowRight' || e.key === 'd' || e.key === 'D') {
        e.preventDefault()
        const nextIdx = Math.min(totalVisible - 1, focusedIndex + 1)
        if (nextIdx === totalVisible - 1 && filteredAndSortedItems.length > visibleCount) {
          setVisibleCount((prev) => prev + 48)
        }
        focusWrapper(nextIdx)
      } else if (e.key === 'ArrowUp' || e.key === 'w' || e.key === 'W') {
        e.preventDefault()
        if (viewMode === 'list') {
          const nextIdx = Math.max(0, focusedIndex - 1)
          focusWrapper(nextIdx)
        } else {
          let cols = 1
          if (gridRef.current) {
            const computedStyle = window.getComputedStyle(gridRef.current)
            cols = computedStyle.gridTemplateColumns.split(' ').length || 1
          }
          const nextIdx = Math.max(0, focusedIndex - cols)
          focusWrapper(nextIdx)
        }
      } else if (e.key === 'ArrowDown' || e.key === 's' || e.key === 'S') {
        e.preventDefault()
        if (viewMode === 'list') {
          const nextIdx = Math.min(totalVisible - 1, focusedIndex + 1)
          if (nextIdx === totalVisible - 1 && filteredAndSortedItems.length > visibleCount) {
            setVisibleCount((prev) => prev + 48)
          }
          focusWrapper(nextIdx)
        } else {
          let cols = 1
          if (gridRef.current) {
            const computedStyle = window.getComputedStyle(gridRef.current)
            cols = computedStyle.gridTemplateColumns.split(' ').length || 1
          }
          const nextIdx = Math.min(totalVisible - 1, focusedIndex + cols)
          if (nextIdx >= totalVisible - cols && filteredAndSortedItems.length > visibleCount) {
            setVisibleCount((prev) => prev + 48)
          }
          focusWrapper(nextIdx)
        }
      }

      const currentItem = visibleItems[focusedIndex]
      if (!currentItem) return

      if (e.key === ' ') {
        e.preventDefault()
        handleQtyChange(currentItem.id, currentItem.expected_qty)
      } else if (e.key.toLowerCase() === 'x' || e.key === 'Delete' || e.key === 'Backspace') {
        e.preventDefault()
        handleQtyChange(currentItem.id, 0)
      } else if (e.key.toLowerCase() === 'r') {
        e.preventDefault()
        handleQtyChange(currentItem.id, null)
      } else if (e.key === '+' || e.key === '=') {
        e.preventDefault()
        handleQtyChange(currentItem.id, (currentItem.counted_qty || 0) + 1)
      } else if (e.key === '-') {
        e.preventDefault()
        handleQtyChange(currentItem.id, Math.max(0, (currentItem.counted_qty || 0) - 1))
      } else if (e.key === 'Enter') {
        e.preventDefault()
        const focusedEl = document.querySelector(
          viewMode === 'grid' ? '.part-card.keyboard-focused' : '.part-row.keyboard-focused'
        )
        if (focusedEl) {
          const qtyInput = focusedEl.querySelector('.qty-input-box') as HTMLInputElement
          if (qtyInput) {
            qtyInput.focus()
            qtyInput.select()
          }
        }
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => {
      window.removeEventListener('keydown', handleKeyDown)
    }
  }, [
    focusedIndex,
    visibleItems,
    viewMode,
    filteredAndSortedItems,
    visibleCount,
    notesOpen,
    isExportOpen,
    handleQtyChange
  ])

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
        <p style={{ color: 'var(--text-secondary)' }}>Loading inventory session...</p>
      </div>
    )
  }

  if (!session) {
    return (
      <div style={{ padding: '24px', textAlign: 'center', color: '#ef4444' }}>
        <AlertCircle size={48} style={{ margin: '0 auto 16px auto' }} />
        <h2>Session Not Found</h2>
        <button
          className="btn btn-secondary btn-sm"
          onClick={onBackToHome}
          style={{ marginTop: '12px' }}
        >
          <ArrowLeft size={16} />
          <span>Back to Dashboard</span>
        </button>
      </div>
    )
  }

  return (
    <div className="inventory-page">
      <div className="inventory-sticky-shell">
        {/* Header Bar */}
        <div className="inventory-header">
          <div className="inventory-title-row">
            <Tooltip content="Back to Dashboard">
              <button className="btn btn-secondary btn-icon-only" onClick={onBackToHome}>
                <ArrowLeft size={18} />
              </button>
            </Tooltip>
            <div className="inventory-title-block">
              <div className="inventory-title-line">
                <h1>{session.name}</h1>
                <span
                  className={`badge badge-${session.status === 'in_progress' ? 'partial' : 'complete'}`}
                >
                  {session.status.replace('_', ' ')}
                </span>
              </div>
              <p>
                LEGO Set: <strong>{session.set_num}</strong> - {session.set_name}
              </p>
            </div>
          </div>

          <div className="inventory-header-actions">
            {/* Status Select */}
            <select
              className="form-input"
              style={{ width: '140px' }}
              value={session.status}
              onChange={(e) => handleStatusToggle(e.target.value)}
            >
              <option value="in_progress">In Progress</option>
              <option value="completed">Completed</option>
              <option value="abandoned">Abandoned</option>
            </select>

            {session.status !== 'completed' && (
              <Tooltip content="Set all parts present & complete session">
                <button
                  className="btn btn-secondary btn-sm"
                  onClick={handleQuickComplete}
                  style={{
                    background: 'var(--status-complete-bg)',
                    borderColor: 'rgba(16,185,129,0.2)',
                    color: 'var(--status-complete)'
                  }}
                >
                  <Check size={14} />
                  <span>Quick Complete</span>
                </button>
              </Tooltip>
            )}

            <Tooltip content="Export list of missing parts">
              <button className="btn btn-secondary btn-sm" onClick={() => setIsExportOpen(true)}>
                <Download size={14} />
                <span>Export Missing</span>
              </button>
            </Tooltip>

            <Tooltip content="Edit session notes">
              <button className="btn btn-secondary btn-sm" onClick={() => setNotesOpen(true)}>
                <StickyNote size={14} />
                <span>Notes</span>
              </button>
            </Tooltip>
          </div>
        </div>

        {/* Progress Cards */}
        {progress && (
          <div className="session-summary inventory-summary">
            <div className="summary-item">
              <span className="summary-label">Progress</span>
              <span className="summary-value" style={{ color: 'var(--accent)' }}>
                {progress.rowCompletionPct}%
              </span>
              <span>
                {progress.checkedRows} of {progress.totalRows} rows checked
              </span>
            </div>

            <div className="summary-item">
              <span className="summary-label">Quantity</span>
              <span className="summary-value" style={{ color: 'var(--status-complete)' }}>
                {progress.qtyCompletionPct}%
              </span>
              <span>
                {progress.totalCountedQty} / {progress.totalExpectedQty} pieces
              </span>
            </div>

            <div className="summary-item">
              <span className="summary-label">Missing</span>
              <span className="summary-value" style={{ color: 'var(--status-missing)' }}>
                {progress.totalMissingQty}
              </span>
              <span>across {progress.missingRowsCount} rows</span>
            </div>

            <div className="summary-item">
              <span className="summary-label">Extra</span>
              <span className="summary-value" style={{ color: 'var(--status-extra)' }}>
                {progress.totalExtraQty}
              </span>
              <span>surplus parts counted</span>
            </div>
          </div>
        )}

        {/* Technic Group Tabs Navigator */}
        <div className="group-nav inventory-group-nav">
          <button
            className={`group-tab ${selectedGroup === null ? 'active' : ''}`}
            onClick={() => {
              setSelectedGroup(null)
              setVisibleCount(48)
            }}
          >
            All Parts
          </button>
          {TECHNIC_GROUPS.map((group) => (
            <button
              key={group.id}
              className={`group-tab ${selectedGroup === group.id ? 'active' : ''}`}
              onClick={() => {
                setSelectedGroup(group.id)
                setVisibleCount(48)
              }}
            >
              {group.name}
            </button>
          ))}
        </div>

        {/* Controls Bar: Filters & Display mode */}
        <div className="filter-panel inventory-filter-panel">
          {/* Search */}
          <div className="form-group">
            <label className="form-label">Search part name/number</label>
            <div className="input-with-icon">
              <Search size={14} />
              <input
                type="text"
                className="form-input"
                placeholder="Filter list..."
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value)
                  setVisibleCount(48)
                }}
              />
            </div>
          </div>

          {/* Status Filter */}
          <div className="form-group">
            <label className="form-label">Status</label>
            <select
              className="form-input form-select"
              value={statusFilter}
              onChange={(e) => {
                setStatusFilter(e.target.value)
                setVisibleCount(48)
              }}
            >
              <option value="all">All Statuses</option>
              <option value="to_count">To Count (Unchecked/Partial)</option>
              <option value="checked_active">Checked (Active)</option>
              <option value="not_checked">Unchecked Only</option>
              <option value="complete">Complete Only</option>
              <option value="missing">Missing Only (0 counted)</option>
              <option value="partial">Partial Only (incomplete)</option>
              <option value="extra">Extra Only (surplus)</option>
            </select>
          </div>

          {/* Sort Filter */}
          <div className="form-group">
            <label className="form-label">Sort By</label>
            <select
              className="form-input form-select"
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

          {/* Spares Filter */}
          <div className="form-group">
            <label className="form-label">Spares</label>
            <select
              className="form-input form-select"
              value={sparesFilter}
              onChange={(e) => {
                setSparesFilter(e.target.value)
                setVisibleCount(48)
              }}
            >
              <option value="all">Show Spares</option>
              <option value="no_spares">Hide Spares</option>
              <option value="spares_only">Spares Only</option>
            </select>
          </div>

          {/* Scalable Size Control (Grid only) */}
          {viewMode === 'grid' && (
            <div className="form-group" style={{ minWidth: '100px' }}>
              <label className="form-label">Tile Size</label>
              <div className="segmented-icon-control">
                <button
                  className={`btn btn-secondary btn-sm ${gridScale === 'sm' ? 'active' : ''}`}
                  style={{
                    minWidth: '32px',
                    padding: '4px 8px',
                    fontSize: '11px',
                    fontWeight: 700
                  }}
                  onClick={() => setGridScale('sm')}
                >
                  S
                </button>
                <button
                  className={`btn btn-secondary btn-sm ${gridScale === 'md' ? 'active' : ''}`}
                  style={{
                    minWidth: '32px',
                    padding: '4px 8px',
                    fontSize: '11px',
                    fontWeight: 700
                  }}
                  onClick={() => setGridScale('md')}
                >
                  M
                </button>
                <button
                  className={`btn btn-secondary btn-sm ${gridScale === 'lg' ? 'active' : ''}`}
                  style={{
                    minWidth: '32px',
                    padding: '4px 8px',
                    fontSize: '11px',
                    fontWeight: 700
                  }}
                  onClick={() => setGridScale('lg')}
                >
                  L
                </button>
              </div>
            </div>
          )}

          {/* View Toggle */}
          <div className="form-group" style={{ minWidth: '76px' }}>
            <label className="form-label">View</label>
            <div className="segmented-icon-control">
              <Tooltip content="Grid view">
                <button
                  className={`btn btn-secondary btn-icon-only btn-sm ${viewMode === 'grid' ? 'active' : ''}`}
                  onClick={() => setViewMode('grid')}
                >
                  <Grid size={16} />
                </button>
              </Tooltip>
              <Tooltip content="List view">
                <button
                  className={`btn btn-secondary btn-icon-only btn-sm ${viewMode === 'list' ? 'active' : ''}`}
                  onClick={() => setViewMode('list')}
                >
                  <List size={16} />
                </button>
              </Tooltip>
            </div>
          </div>

          {/* Hide Completed Checkbox */}
          <div className="form-group checkbox-group" style={{ minWidth: '120px' }}>
            <label className="form-label" style={{ userSelect: 'none' }}>
              &nbsp;
            </label>
            <div
              className="checkbox-control-wrapper"
              style={{ display: 'flex', alignItems: 'center', height: '34px', gap: '8px' }}
            >
              <input
                type="checkbox"
                id="hide-completed-toggle"
                className="form-checkbox"
                checked={hideCompleted}
                onChange={(e) => {
                  setHideCompleted(e.target.checked)
                  setVisibleCount(48)
                }}
                style={{ width: '16px', height: '16px', cursor: 'pointer' }}
              />
              <label
                htmlFor="hide-completed-toggle"
                style={{
                  margin: 0,
                  cursor: 'pointer',
                  userSelect: 'none',
                  fontWeight: 600,
                  fontSize: '13px',
                  color: 'var(--text-secondary)'
                }}
              >
                Hide Completed
              </label>
            </div>
          </div>
        </div>
      </div>

      {/* Main Parts Grid/List scroll area */}
      <div className="inventory-parts-area">
        {filteredAndSortedItems.length === 0 ? (
          <div className="glass-panel" style={{ padding: '48px' }}>
            <div className="empty-slate">
              <Search />
              <p>No parts match the selected filters.</p>
            </div>
          </div>
        ) : viewMode === 'grid' ? (
          /* Card Grid View */
          <div
            className={`parts-grid parts-grid-${gridScale}`}
            ref={gridRef}
            style={
              {
                '--card-min-width':
                  gridScale === 'sm' ? '150px' : gridScale === 'lg' ? '270px' : '210px'
              } as React.CSSProperties
            }
          >
            {visibleItems.map((item, idx) => {
              const hasCounted = item.counted_qty !== null
              const isNotesActive = activeNoteItemId === item.id
              const isKeyboardFocused = focusedIndex === idx

              return (
                <div
                  key={item.id}
                  className={`glass-panel part-card part-card-${item.status} ${isKeyboardFocused ? 'keyboard-focused' : ''} ${item.notes ? 'has-notes' : ''}`}
                  onClick={() => setFocusedIndex(idx)}
                  tabIndex={-1}
                  style={{
                    borderColor: hasCounted ? 'rgba(255,255,255,0.08)' : 'rgba(59,130,246,0.3)'
                  }}
                >
                  {/* Absolute positioned Note Button in top right */}
                  {!isNotesActive && (
                    <Tooltip content={item.notes ? 'Edit note' : 'Add note'}>
                      <button
                        className={`btn btn-secondary btn-sm part-card-note-btn ${item.notes ? 'has-notes' : ''}`}
                        onClick={(e) => {
                          e.stopPropagation()
                          setActiveNoteItemId(item.id)
                          setItemNoteText(item.notes || '')
                        }}
                      >
                        <StickyNote size={12} />
                      </button>
                    </Tooltip>
                  )}

                  {/* Top block: Image (left) + Info (right) */}
                  <div className="part-card-top">
                    <div className="part-card-img-container">
                      {item.source_img_url ? (
                        <CachedImage
                          url={item.source_img_url}
                          alt={item.part_name}
                          className="part-card-img"
                        />
                      ) : (
                        <HelpCircle size={32} style={{ color: '#475569' }} />
                      )}
                      {item.is_spare && <span className="part-card-spare-badge">Spare</span>}
                    </div>

                    <div className="part-card-info">
                      <span className="part-card-num">{item.part_num}</span>
                      <Tooltip content={item.part_name || 'Unknown Part'}>
                        <h3 className="part-card-name" style={{ cursor: 'help' }}>
                          {item.part_name || 'Unknown Part'}
                        </h3>
                      </Tooltip>
                      <div className="part-card-color">
                        <span
                          className="color-swatch"
                          style={{ backgroundColor: `#${item.color_rgb || 'FFFFFF'}` }}
                        ></span>
                        <span className="color-name-text">
                          {item.color_name} {item.color_transparent ? '(Trans)' : ''}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Middle block: Quantities & Status badge */}
                  <div className="part-card-middle">
                    <div className="part-card-qtys-compact">
                      <span>
                        Exp:{' '}
                        <Tooltip content="Click to override expected quantity">
                          <strong
                            style={{
                              cursor: 'pointer',
                              textDecoration: 'underline dotted var(--accent)',
                              color: 'var(--accent)'
                            }}
                            onClick={() => handleOverrideExpected(item.id, item.expected_qty)}
                          >
                            {item.expected_qty}
                          </strong>
                        </Tooltip>
                      </span>
                      <span>
                        Count:{' '}
                        <strong style={{ color: hasCounted ? 'inherit' : '#64748b' }}>
                          {hasCounted ? item.counted_qty : '—'}
                        </strong>
                      </span>
                    </div>
                    <div className="part-card-status-badge-container">
                      <span className={`badge badge-${item.status}`}>
                        {item.status.replace('_', ' ')}
                      </span>
                    </div>
                  </div>

                  {/* Bottom block: Qty controls, Quick actions */}
                  <div className="part-card-bottom">
                    <div className="qty-controls part-count-controls">
                      <Tooltip content="Decrease count">
                        <button
                          className="btn-qty"
                          onClick={() =>
                            handleQtyChange(item.id, Math.max(0, (item.counted_qty || 0) - 1))
                          }
                        >
                          <Minus size={12} />
                        </button>
                      </Tooltip>
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
                      <Tooltip content="Increase count">
                        <button
                          className="btn-qty"
                          onClick={() => handleQtyChange(item.id, (item.counted_qty || 0) + 1)}
                        >
                          <Plus size={12} />
                        </button>
                      </Tooltip>
                    </div>

                    <div className="part-quick-actions">
                      <Tooltip content="All present">
                        <button
                          className="btn btn-secondary btn-sm part-action-ok"
                          onClick={() => handleQtyChange(item.id, item.expected_qty)}
                        >
                          <Check size={12} />
                          <span>OK</span>
                        </button>
                      </Tooltip>
                      <Tooltip content="All missing">
                        <button
                          className="btn btn-secondary btn-sm part-action-miss"
                          onClick={() => handleQtyChange(item.id, 0)}
                        >
                          <X size={12} />
                          <span>Missing</span>
                        </button>
                      </Tooltip>
                      <Tooltip content="Reset count">
                        <button
                          className="btn btn-secondary btn-sm part-action-reset"
                          onClick={() => handleQtyChange(item.id, null)}
                        >
                          <RotateCcw size={12} />
                          <span>Reset</span>
                        </button>
                      </Tooltip>
                    </div>
                  </div>

                  {/* Note editor input */}
                  {isNotesActive && (
                    <div className="part-card-note-edit-row">
                      <input
                        type="text"
                        className="form-input"
                        value={itemNoteText}
                        onChange={(e) => setItemNoteText(e.target.value)}
                        placeholder="Add note..."
                        autoFocus
                      />
                      <button
                        className="btn btn-primary btn-sm btn-icon-only"
                        onClick={() => handleSaveItemNote(item.id)}
                      >
                        <Check size={12} />
                      </button>
                      <button
                        className="btn btn-secondary btn-sm btn-icon-only"
                        onClick={() => setActiveNoteItemId(null)}
                      >
                        <X size={12} />
                      </button>
                    </div>
                  )}

                  {/* Display note preview if any notes are saved and not editing */}
                  {!isNotesActive && item.notes && (
                    <div className="part-card-note-preview">
                      <StickyNote size={11} />
                      <span className="note-text">{item.notes}</span>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        ) : (
          /* List Row View */
          <div className="glass-panel inventory-list-panel" ref={listRef}>
            {/* Header row */}
            <div className="part-row part-row-header">
              <span>Image</span>
              <span>Number</span>
              <span>Name</span>
              <span>Color</span>
              <span>Expected</span>
              <span>Counted / Status</span>
              <span>Actions</span>
            </div>

            {visibleItems.map((item, idx) => {
              const hasCounted = item.counted_qty !== null
              const isNotesActive = activeNoteItemId === item.id
              const isKeyboardFocused = focusedIndex === idx

              return (
                <div
                  key={item.id}
                  className={`part-row part-row-${item.status} ${isKeyboardFocused ? 'keyboard-focused' : ''}`}
                  onClick={() => setFocusedIndex(idx)}
                  tabIndex={-1}
                >
                  <div className="part-row-img">
                    {item.source_img_url ? (
                      <CachedImage
                        url={item.source_img_url}
                        alt={item.part_name}
                        style={{ maxWidth: '85%', maxHeight: '85%', objectFit: 'contain' }}
                      />
                    ) : (
                      <HelpCircle size={20} style={{ color: '#475569' }} />
                    )}
                  </div>

                  <span className="part-row-text" style={{ fontFamily: 'monospace' }}>
                    {item.part_num}
                  </span>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                    <span className="part-row-text" style={{ fontWeight: 600 }}>
                      {item.part_name || 'Unknown Part'}
                    </span>
                    <span style={{ fontSize: '11px', color: '#64748b' }}>
                      {item.part_category_name || 'Category'} {item.is_spare ? '(Spare)' : ''}
                    </span>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <span
                      className="color-swatch"
                      style={{
                        backgroundColor: `#${item.color_rgb || 'FFFFFF'}`,
                        width: '10px',
                        height: '10px'
                      }}
                    ></span>
                    <span style={{ fontSize: '13px' }}>{item.color_name}</span>
                  </div>

                  <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
                    <Tooltip content="Click to override expected quantity">
                      <span
                        className="part-row-text"
                        style={{
                          fontWeight: 700,
                          textAlign: 'center',
                          cursor: 'pointer',
                          textDecoration: 'underline dotted var(--accent)',
                          color: 'var(--accent)'
                        }}
                        onClick={() => handleOverrideExpected(item.id, item.expected_qty)}
                      >
                        {item.expected_qty}
                      </span>
                    </Tooltip>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <span
                      className={`badge badge-${item.status}`}
                      style={{ padding: '2px 8px', fontSize: '11px' }}
                    >
                      {item.status.replace('_', ' ')}
                    </span>
                    <span
                      style={{
                        fontWeight: 700,
                        fontSize: '14px',
                        color: hasCounted ? 'inherit' : '#64748b'
                      }}
                    >
                      {hasCounted ? item.counted_qty : '—'}
                    </span>
                  </div>

                  {/* Quantity and notes inputs */}
                  <div className="part-row-actions">
                    <div className="qty-controls qty-controls-compact">
                      <Tooltip content="Decrease count">
                        <button
                          className="btn-qty"
                          onClick={() =>
                            handleQtyChange(item.id, Math.max(0, (item.counted_qty || 0) - 1))
                          }
                        >
                          <Minus size={12} />
                        </button>
                      </Tooltip>
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
                      />
                      <Tooltip content="Increase count">
                        <button
                          className="btn-qty"
                          onClick={() => handleQtyChange(item.id, (item.counted_qty || 0) + 1)}
                        >
                          <Plus size={12} />
                        </button>
                      </Tooltip>
                    </div>

                    <Tooltip content="All present">
                      <button
                        className="btn btn-secondary btn-sm part-action-ok"
                        onClick={() => handleQtyChange(item.id, item.expected_qty)}
                      >
                        <Check size={12} />
                        <span>OK</span>
                      </button>
                    </Tooltip>

                    <Tooltip content="All missing">
                      <button
                        className="btn btn-secondary btn-sm part-action-miss"
                        onClick={() => handleQtyChange(item.id, 0)}
                      >
                        <X size={12} />
                        <span>Miss</span>
                      </button>
                    </Tooltip>

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
                        <Tooltip content="Save note">
                          <button
                            className="btn btn-primary btn-sm btn-icon-only"
                            onClick={() => handleSaveItemNote(item.id)}
                          >
                            <Check size={10} />
                          </button>
                        </Tooltip>
                      </div>
                    ) : (
                      <Tooltip content={item.notes ? 'Edit note' : 'Add note'}>
                        <button
                          className="btn btn-secondary btn-sm"
                          onClick={() => {
                            setActiveNoteItemId(item.id)
                            setItemNoteText(item.notes || '')
                          }}
                        >
                          <StickyNote size={12} />
                          <span>{item.notes ? 'Edit' : 'Note'}</span>
                        </button>
                      </Tooltip>
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
            <button
              className="btn btn-secondary"
              onClick={() => setVisibleCount((prev) => prev + 48)}
            >
              Load More Parts ({filteredAndSortedItems.length - visibleCount} remaining)
            </button>
          </div>
        )}
      </div>

      {notesOpen && (
        <div className="notes-drawer-overlay" onClick={() => setNotesOpen(false)}>
          <aside className="notes-drawer glass-panel" onClick={(e) => e.stopPropagation()}>
            <div className="notes-drawer-header">
              <div>
                <h3>Session Notes</h3>
                <p>
                  {session.set_num} - {session.set_name}
                </p>
              </div>
              <Tooltip content="Close notes">
                <button
                  className="btn btn-secondary btn-icon-only"
                  onClick={() => setNotesOpen(false)}
                >
                  <X size={16} />
                </button>
              </Tooltip>
            </div>
            <textarea
              className="form-input notes-drawer-textarea"
              value={sessionNotes}
              onChange={(e) => setSessionNotes(e.target.value)}
              placeholder="Add observations about this counting session..."
            />
            <div className="notes-drawer-actions">
              <button
                className="btn btn-secondary btn-sm"
                onClick={() => setNotesOpen(false)}
                disabled={savingSessionNotes}
              >
                Cancel
              </button>
              <button
                className="btn btn-primary btn-sm"
                onClick={async () => {
                  await handleSaveSessionNotes()
                  setNotesOpen(false)
                }}
                disabled={savingSessionNotes}
              >
                {savingSessionNotes ? 'Saving...' : 'Save Notes'}
              </button>
            </div>
          </aside>
        </div>
      )}

      {/* Export Missing Parts Modal Overlay */}
      {isExportOpen && (
        <div className="modal-overlay">
          <div className="glass-panel modal-content">
            <h2 style={{ fontSize: '20px', fontWeight: 800, marginBottom: '20px' }}>
              Export Missing Parts
            </h2>

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
                  <option value="xml">BrickLink Wanted List XML (*.xml)</option>
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
                  <option value="non_spares_missing">
                    Required Build Parts Only (Excludes spares)
                  </option>
                  <option value="spares_missing">Spares Only</option>
                </select>
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
                  className="btn btn-secondary"
                  onClick={() => setIsExportOpen(false)}
                  disabled={exporting}
                >
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
