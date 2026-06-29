import { useState, useEffect, useCallback, useMemo, useRef } from 'react'
import { Search, Loader2, ArrowRight, HelpCircle, X, ChevronLeft, ChevronRight } from 'lucide-react'
import CachedImage from '../components/CachedImage'
import Tooltip from '../components/Tooltip'

interface PartLookupPageProps {
  onNavigateToSet: (setNum: string) => void
}

export default function PartLookupPage({ onNavigateToSet }: PartLookupPageProps) {
  // Search parameters
  const [query, setQuery] = useState('')
  const [selectedGroup, setSelectedGroup] = useState<number | null>(null)
  const [technicGroups, setTechnicGroups] = useState<any[]>([])

  // Results state
  const [parts, setParts] = useState<any[]>([])
  const [totalCount, setTotalCount] = useState(0)
  const [page, setPage] = useState(1)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const limit = 24

  // Detail Modal state
  const [selectedPartNum, setSelectedPartNum] = useState<string | null>(null)
  const [selectedPartDetails, setSelectedPartDetails] = useState<any | null>(null)
  const [selectedPartXRefs, setSelectedPartXRefs] = useState<any[] | null>(null)
  const [detailsLoading, setDetailsLoading] = useState(false)
  const [detailsError, setDetailsError] = useState<string | null>(null)

  // Micro-interaction: local color filter inside details modal
  const [modalColorFilter, setModalColorFilter] = useState<number | null>(null)
  const [modalSetSearch, setModalSetSearch] = useState('')

  // Debounce helper
  const searchTimeoutRef = useRef<NodeJS.Timeout | null>(null)

  // Fetch technic groups for filter dropdown
  useEffect(() => {
    window.api
      .partsGetTechnicGroups()
      .then((res) => {
        if (res.success && res.groups) {
          setTechnicGroups(res.groups)
        }
      })
      .catch((err) => {
        console.error('Failed to load Technic groups:', err)
      })
  }, [])

  // Execute database search
  const performSearch = useCallback(
    async (searchQuery: string, groupId: number | null, activePage: number) => {
      setLoading(true)
      setError(null)
      const offset = (activePage - 1) * limit
      try {
        const res = await window.api.partsSearch(searchQuery.trim(), groupId, limit, offset)
        if (res.success && res.parts) {
          setParts(res.parts)
          setTotalCount(res.totalCount ?? 0)
        } else {
          setError(res.error || 'Failed to query parts catalog.')
        }
      } catch (err: any) {
        console.error('Error fetching parts:', err)
        setError(err.message || 'An error occurred during search.')
      } finally {
        setLoading(false)
      }
    },
    [limit]
  )

  // Trigger search on parameter change with debounce
  useEffect(() => {
    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current)
    }

    searchTimeoutRef.current = setTimeout(() => {
      performSearch(query, selectedGroup, page)
    }, 250)

    return () => {
      if (searchTimeoutRef.current) {
        clearTimeout(searchTimeoutRef.current)
      }
    }
  }, [query, selectedGroup, page, performSearch])

  // Trigger details load when a part is clicked
  const handleOpenDetails = async (partNum: string) => {
    setSelectedPartNum(partNum)
    setDetailsLoading(true)
    setDetailsError(null)
    setModalColorFilter(null)
    setModalSetSearch('')
    setSelectedPartDetails(null)
    setSelectedPartXRefs(null)

    try {
      const res = await window.api.partsGetDetails(partNum)
      if (res.success && res.part) {
        setSelectedPartDetails(res.part)
        setSelectedPartXRefs(res.crossReferences || [])
      } else {
        setDetailsError(res.error || 'Failed to retrieve part details.')
      }
    } catch (err: any) {
      console.error('Error loading part details:', err)
      setDetailsError(err.message || 'Error fetching part details.')
    } finally {
      setDetailsLoading(false)
    }
  }

  // Calculate unique colors from cross references
  const colorVariants = useMemo(() => {
    if (!selectedPartXRefs) return []
    const colorsMap = new Map<number, { name: string; rgb: string; count: number }>()

    for (const ref of selectedPartXRefs) {
      if (!colorsMap.has(ref.color_id)) {
        colorsMap.set(ref.color_id, {
          name: ref.color_name,
          rgb: ref.color_rgb || 'FFFFFF',
          count: 0
        })
      }
      colorsMap.get(ref.color_id)!.count++
    }

    return Array.from(colorsMap.entries()).map(([id, info]) => ({
      id,
      ...info
    }))
  }, [selectedPartXRefs])

  // Filter cross reference sets based on modal inputs (color select & text query)
  const filteredCrossReferences = useMemo(() => {
    if (!selectedPartXRefs) return []
    let result = [...selectedPartXRefs]

    if (modalColorFilter !== null) {
      result = result.filter((ref) => ref.color_id === modalColorFilter)
    }

    if (modalSetSearch.trim()) {
      const s = modalSetSearch.toLowerCase().trim()
      result = result.filter(
        (ref) =>
          ref.set_num.toLowerCase().includes(s) || ref.set_name.toLowerCase().includes(s)
      )
    }

    return result
  }, [selectedPartXRefs, modalColorFilter, modalSetSearch])

  // Pagination totals
  const totalPages = Math.max(1, Math.ceil(totalCount / limit))

  const handlePrevPage = () => {
    if (page > 1) {
      setPage((p) => p - 1)
    }
  }

  const handleNextPage = () => {
    if (page < totalPages) {
      setPage((p) => p + 1)
    }
  }

  return (
    <div className="page-container">
      {/* Header */}
      <div className="page-header">
        <div>
          <div className="page-badge">Catalog Finder</div>
          <h1 className="page-title">Reverse Part Lookup</h1>
        </div>
      </div>

      {/* Filter panel */}
      <div className="glass-panel filter-panel" style={{ marginBottom: '16px' }}>
        <div className="form-group" style={{ flex: 1, minWidth: '240px' }}>
          <label className="form-label">Search Part Name or Number</label>
          <div style={{ position: 'relative' }}>
            <input
              type="text"
              className="form-input"
              style={{ paddingLeft: '36px' }}
              placeholder="e.g. 32524, liftarm, axle..."
              value={query}
              onChange={(e) => {
                setQuery(e.target.value)
                setPage(1) // Reset page on query modify
              }}
            />
            <Search
              size={16}
              style={{
                position: 'absolute',
                left: '12px',
                top: '50%',
                transform: 'translateY(-50%)',
                color: 'var(--text-secondary)'
              }}
            />
          </div>
        </div>

        <div className="form-group" style={{ width: '220px' }}>
          <label className="form-label">Technic Group</label>
          <select
            className="form-input"
            value={selectedGroup === null ? '' : selectedGroup}
            onChange={(e) => {
              const val = e.target.value === '' ? null : parseInt(e.target.value, 10)
              setSelectedGroup(val)
              setPage(1)
            }}
          >
            <option value="">All Categories</option>
            {technicGroups.map((g) => (
              <option key={g.id} value={g.id}>
                {g.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Error state */}
      {error && (
        <div className="glass-panel" style={{ padding: '24px', borderColor: 'var(--status-error)' }}>
          <div style={{ color: 'var(--status-error)', fontWeight: 600 }}>{error}</div>
        </div>
      )}

      {/* Main Results Container */}
      {!error && (
        <div style={{ display: 'flex', flexDirection: 'column', flex: 1, gap: '16px' }}>
          {loading ? (
            <div
              className="glass-panel"
              style={{
                padding: '80px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flex: 1
              }}
            >
              <div className="empty-slate">
                <Loader2 className="animate-spin" size={32} style={{ color: 'var(--accent)' }} />
                <p>Searching parts catalog...</p>
              </div>
            </div>
          ) : parts.length === 0 ? (
            <div className="glass-panel" style={{ padding: '80px', flex: 1 }}>
              <div className="empty-slate">
                <Search size={32} style={{ color: 'var(--text-secondary)' }} />
                <p>No matching parts found in catalog. Try adjusting filters.</p>
              </div>
            </div>
          ) : (
            <div
              className="parts-grid parts-grid-md"
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fill, 210px)',
                gap: '16px',
                flex: 1
              }}
            >
              {parts.map((part) => (
                <div
                  key={part.part_num}
                  className="glass-panel part-card"
                  onClick={() => handleOpenDetails(part.part_num)}
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    cursor: 'pointer',
                    borderColor: 'rgba(255, 255, 255, 0.08)'
                  }}
                >
                  <div className="part-card-top" style={{ display: 'flex', gap: '12px' }}>
                    <div className="part-card-img-container">
                      {part.part_img_url ? (
                        <CachedImage
                          url={part.part_img_url}
                          alt={part.name}
                          className="part-card-img"
                        />
                      ) : (
                        <HelpCircle size={32} style={{ color: '#475569' }} />
                      )}
                    </div>
                    <div className="part-card-info" style={{ flex: 1, minWidth: 0 }}>
                      <span className="part-card-num">{part.part_num}</span>
                      <h3 className="part-card-name" title={part.name}>
                        {part.name}
                      </h3>
                      {part.technic_group_name && (
                        <span className="part-card-spare-badge" style={{ background: 'rgba(59,130,246,0.1)', color: 'rgb(96,165,250)', borderColor: 'rgba(59,130,246,0.2)' }}>
                          {part.technic_group_name}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Pagination */}
          {totalPages > 1 && (
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                padding: '12px 16px',
                marginTop: 'auto'
              }}
              className="glass-panel"
            >
              <button
                className="btn btn-secondary btn-sm"
                onClick={handlePrevPage}
                disabled={page === 1 || loading}
              >
                <ChevronLeft size={16} />
                <span>Prev</span>
              </button>
              <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-secondary)' }}>
                Page {page} of {totalPages} ({totalCount} items)
              </span>
              <button
                className="btn btn-secondary btn-sm"
                onClick={handleNextPage}
                disabled={page === totalPages || loading}
              >
                <span>Next</span>
                <ChevronRight size={16} />
              </button>
            </div>
          )}
        </div>
      )}

      {/* Part Details & Cross-Reference Explorer Modal */}
      {selectedPartNum && (
        <div className="modal-overlay" onClick={() => setSelectedPartNum(null)}>
          <div
            className="glass-panel set-details-modal"
            style={{ maxWidth: '1100px', height: '90vh' }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="set-details-header">
              <div>
                <span className="set-details-badge">Part Details & Cross-Refs</span>
                <h2 className="set-details-title" style={{ fontSize: '20px' }}>
                  {selectedPartDetails ? selectedPartDetails.name : `Part ${selectedPartNum}`}
                </h2>
              </div>
              <button
                className="btn btn-secondary btn-icon-only"
                onClick={() => setSelectedPartNum(null)}
              >
                <X size={16} />
              </button>
            </div>

            {/* Modal Body */}
            {detailsLoading ? (
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flex: 1
                }}
              >
                <Loader2 className="animate-spin" size={32} style={{ color: 'var(--accent)' }} />
              </div>
            ) : detailsError ? (
              <div style={{ color: 'var(--status-error)', padding: '24px', textAlign: 'center' }}>
                {detailsError}
              </div>
            ) : selectedPartDetails ? (
              <div
                className="set-details-grid"
                style={{
                  display: 'grid',
                  gridTemplateColumns: '320px 1fr',
                  gap: '20px',
                  flex: 1,
                  overflow: 'hidden'
                }}
              >
                {/* Left Column: Metadata & Core Details */}
                <div
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '16px',
                    borderRight: '1px solid var(--border-glass)',
                    paddingRight: '20px',
                    overflowY: 'auto'
                  }}
                >
                  <div
                    className="glass-panel"
                    style={{
                      padding: '24px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      background: 'rgba(255, 255, 255, 0.02)',
                      aspectRatio: '1',
                      borderRadius: '12px'
                    }}
                  >
                    {selectedPartDetails.part_img_url ? (
                      <CachedImage
                        url={selectedPartDetails.part_img_url}
                        alt={selectedPartDetails.name}
                        style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' }}
                      />
                    ) : (
                      <HelpCircle size={64} style={{ color: '#475569' }} />
                    )}
                  </div>

                  <div className="form-group">
                    <label className="form-label" style={{ marginBottom: '2px' }}>Part Number</label>
                    <div style={{ fontSize: '15px', fontWeight: 800, fontFamily: 'monospace' }}>
                      {selectedPartDetails.part_num}
                    </div>
                  </div>

                  <div className="form-group">
                    <label className="form-label" style={{ marginBottom: '2px' }}>Part Name</label>
                    <div style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text-secondary)' }}>
                      {selectedPartDetails.name}
                    </div>
                  </div>

                  <div className="form-group">
                    <label className="form-label" style={{ marginBottom: '2px' }}>Catalog Category</label>
                    <div style={{ fontSize: '13px', fontWeight: 600 }}>
                      {selectedPartDetails.part_category_name || '—'}
                    </div>
                  </div>

                  <div className="form-group">
                    <label className="form-label" style={{ marginBottom: '2px' }}>Technic Group</label>
                    <div style={{ display: 'inline-flex' }}>
                      <span className="badge badge-complete" style={{ background: 'rgba(6,182,212,0.1)', color: 'var(--accent)', borderColor: 'rgba(6,182,212,0.2)' }}>
                        {selectedPartDetails.technic_group_name || 'Other'}
                      </span>
                    </div>
                  </div>

                  {/* General Stats */}
                  <div
                    style={{
                      marginTop: 'auto',
                      padding: '12px',
                      background: 'rgba(255, 255, 255, 0.02)',
                      borderRadius: '8px',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '8px'
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px' }}>
                      <span style={{ color: 'var(--text-secondary)' }}>Unique Colors:</span>
                      <strong style={{ color: '#fff' }}>{colorVariants.length}</strong>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px' }}>
                      <span style={{ color: 'var(--text-secondary)' }}>Total Sets:</span>
                      <strong style={{ color: '#fff' }}>
                        {new Set(selectedPartXRefs?.map((x) => x.set_num)).size}
                      </strong>
                    </div>
                  </div>
                </div>

                {/* Right Column: Colors & Cross-Reference Sets */}
                <div
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '16px',
                    overflow: 'hidden'
                  }}
                >
                  {/* Colors Grid */}
                  <div>
                    <h3
                      style={{
                        fontSize: '13px',
                        fontWeight: 700,
                        textTransform: 'uppercase',
                        letterSpacing: '0.5px',
                        color: 'var(--text-secondary)',
                        marginBottom: '8px',
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center'
                      }}
                    >
                      <span>Color Variants ({colorVariants.length})</span>
                      {modalColorFilter !== null && (
                        <button
                          className="btn btn-secondary btn-sm"
                          style={{ padding: '2px 6px', fontSize: '11px', height: 'auto' }}
                          onClick={() => setModalColorFilter(null)}
                        >
                          Clear Color Filter
                        </button>
                      )}
                    </h3>
                    <div
                      style={{
                        display: 'flex',
                        flexWrap: 'wrap',
                        gap: '6px',
                        maxHeight: '100px',
                        overflowY: 'auto',
                        padding: '4px'
                      }}
                    >
                      {colorVariants.map((c) => {
                        const isActive = modalColorFilter === c.id
                        return (
                          <Tooltip key={c.id} content={`${c.name} (${c.count} sets)`}>
                            <button
                              onClick={() => setModalColorFilter(isActive ? null : c.id)}
                              style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: '6px',
                                padding: '4px 8px',
                                borderRadius: '6px',
                                border: '1px solid',
                                borderColor: isActive ? 'var(--accent)' : 'rgba(255, 255, 255, 0.08)',
                                background: isActive ? 'rgba(6, 182, 212, 0.12)' : 'rgba(255, 255, 255, 0.02)',
                                cursor: 'pointer',
                                fontSize: '11px',
                                color: isActive ? '#fff' : 'var(--text-secondary)',
                                transition: 'all 0.15s ease'
                              }}
                            >
                              <span
                                style={{
                                  display: 'block',
                                  width: '8px',
                                  height: '8px',
                                  borderRadius: '50%',
                                  backgroundColor: `#${c.rgb}`,
                                  border: '1px solid rgba(255,255,255,0.2)'
                                }}
                              ></span>
                              <span>{c.name}</span>
                            </button>
                          </Tooltip>
                        )
                      })}
                    </div>
                  </div>

                  {/* Sets List Header & Filters */}
                  <div
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      gap: '12px'
                    }}
                  >
                    <h3
                      style={{
                        fontSize: '13px',
                        fontWeight: 700,
                        textTransform: 'uppercase',
                        letterSpacing: '0.5px',
                        color: 'var(--text-secondary)',
                        margin: 0
                      }}
                    >
                      Sets Containing Part ({filteredCrossReferences.length})
                    </h3>
                    <input
                      type="text"
                      className="form-input form-input-sm"
                      style={{ maxWidth: '200px', height: '28px', fontSize: '12px' }}
                      placeholder="Search sets..."
                      value={modalSetSearch}
                      onChange={(e) => setModalSetSearch(e.target.value)}
                    />
                  </div>

                  {/* Scrollable Sets List */}
                  <div
                    style={{
                      flex: 1,
                      overflowY: 'auto',
                      border: '1px solid var(--border-glass)',
                      borderRadius: '8px',
                      background: 'rgba(0,0,0,0.1)'
                    }}
                  >
                    {filteredCrossReferences.length === 0 ? (
                      <div style={{ padding: '40px', color: 'var(--text-secondary)', textAlign: 'center' }}>
                        No sets match the active filters inside this modal.
                      </div>
                    ) : (
                      <table className="collection-table" style={{ width: '100%', borderCollapse: 'collapse' }}>
                        <thead>
                          <tr
                            style={{
                              borderBottom: '1px solid var(--border-glass)',
                              background: 'rgba(255,255,255,0.02)',
                              fontSize: '11px',
                              textTransform: 'uppercase',
                              color: 'var(--text-secondary)',
                              textAlign: 'left'
                            }}
                          >
                            <th style={{ padding: '8px 12px' }}>Set Image</th>
                            <th style={{ padding: '8px 12px' }}>Number / Name</th>
                            <th style={{ padding: '8px 12px' }}>Year</th>
                            <th style={{ padding: '8px 12px' }}>Color in Set</th>
                            <th style={{ padding: '8px 12px', textAlign: 'center' }}>Qty</th>
                            <th style={{ padding: '8px 12px', textAlign: 'center' }}>Spare?</th>
                            <th style={{ padding: '8px 12px', textAlign: 'center' }}>Action</th>
                          </tr>
                        </thead>
                        <tbody>
                          {filteredCrossReferences.map((ref, idx) => (
                            <tr
                              key={`${ref.set_num}-${ref.color_id}-${ref.is_spare}-${idx}`}
                              style={{
                                borderBottom: '1px solid rgba(255, 255, 255, 0.04)',
                                fontSize: '13px'
                              }}
                            >
                              <td style={{ padding: '8px 12px', width: '60px' }}>
                                <div
                                  style={{
                                    width: '40px',
                                    height: '40px',
                                    background: '#1e293b',
                                    borderRadius: '4px',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    overflow: 'hidden'
                                  }}
                                >
                                  {ref.set_img_url ? (
                                    <CachedImage
                                      url={ref.set_img_url}
                                      alt={ref.set_name}
                                      style={{ maxWidth: '90%', maxHeight: '90%', objectFit: 'contain' }}
                                    />
                                  ) : (
                                    <HelpCircle size={16} style={{ color: '#475569' }} />
                                  )}
                                </div>
                              </td>
                              <td style={{ padding: '8px 12px' }}>
                                <div style={{ fontWeight: 700, fontFamily: 'monospace' }}>
                                  {ref.set_num}
                                </div>
                                <div style={{ fontSize: '12px', color: 'var(--text-secondary)', maxWidth: '240px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                  {ref.set_name}
                                </div>
                              </td>
                              <td style={{ padding: '8px 12px', color: 'var(--text-secondary)' }}>
                                {ref.set_year || '—'}
                              </td>
                              <td style={{ padding: '8px 12px' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                  <span
                                    style={{
                                      display: 'inline-block',
                                      width: '10px',
                                      height: '10px',
                                      borderRadius: '50%',
                                      backgroundColor: `#${ref.color_rgb || 'FFFFFF'}`,
                                      border: '1px solid rgba(255,255,255,0.2)'
                                    }}
                                  ></span>
                                  <span>{ref.color_name}</span>
                                </div>
                              </td>
                              <td style={{ padding: '8px 12px', textAlign: 'center', fontWeight: 700 }}>
                                {ref.quantity}
                              </td>
                              <td style={{ padding: '8px 12px', textAlign: 'center' }}>
                                {ref.is_spare ? (
                                  <span className="badge badge-warning" style={{ fontSize: '10px', padding: '1px 4px' }}>Spare</span>
                                ) : (
                                  <span style={{ color: 'rgba(255,255,255,0.15)' }}>—</span>
                                )}
                              </td>
                              <td style={{ padding: '8px 12px', textAlign: 'center' }}>
                                <button
                                  className="btn btn-secondary btn-sm"
                                  style={{ padding: '2px 8px', height: 'auto', display: 'inline-flex', alignItems: 'center', gap: '4px' }}
                                  onClick={() => {
                                    setSelectedPartNum(null)
                                    onNavigateToSet(ref.set_num)
                                  }}
                                >
                                  <span>View Set</span>
                                  <ArrowRight size={10} />
                                </button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    )}
                  </div>
                </div>
              </div>
            ) : null}
          </div>
        </div>
      )}
    </div>
  )
}
