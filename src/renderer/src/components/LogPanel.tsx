import { useEffect, useRef, useState, useMemo } from 'react'
import { X, FolderOpen, Trash2, ShieldAlert, Terminal, ArrowDown } from 'lucide-react'

export interface LogMessage {
  id: number
  timestamp: string
  level: 'DEBUG' | 'INFO' | 'WARNING' | 'ERROR'
  message: string
}

interface LogPanelProps {
  logs: LogMessage[]
  onClose: () => void
  onClear: () => void
}

export default function LogPanel({ logs, onClose, onClear }: LogPanelProps) {
  const [selectedLevels, setSelectedLevels] = useState<Record<string, boolean>>({
    DEBUG: true,
    INFO: true,
    WARNING: true,
    ERROR: true
  })
  const [searchQuery, setSearchQuery] = useState('')
  const [autoScroll, setAutoScroll] = useState(true)
  const logContainerRef = useRef<HTMLDivElement>(null)

  const [height, setHeight] = useState<number>(() => {
    const saved = localStorage.getItem('log-panel-height')
    const parsed = saved ? parseInt(saved, 10) : 220
    return isNaN(parsed) ? 220 : Math.max(100, Math.min(parsed, 600))
  })

  const isResizingRef = useRef(false)
  const startYRef = useRef(0)
  const startHeightRef = useRef(0)

  const handleMouseDown = (e: React.MouseEvent) => {
    e.preventDefault()
    isResizingRef.current = true
    startYRef.current = e.clientY
    startHeightRef.current = height
    document.addEventListener('mousemove', handleMouseMove)
    document.addEventListener('mouseup', handleMouseUp)
    document.body.style.cursor = 'ns-resize'
    document.body.style.userSelect = 'none'
  }

  const handleMouseMove = (e: MouseEvent) => {
    if (!isResizingRef.current) return
    const deltaY = e.clientY - startYRef.current
    const newHeight = startHeightRef.current - deltaY
    const clampedHeight = Math.max(100, Math.min(newHeight, window.innerHeight - 150))
    setHeight(clampedHeight)
    localStorage.setItem('log-panel-height', clampedHeight.toString())
  }

  const handleMouseUp = () => {
    isResizingRef.current = false
    document.removeEventListener('mousemove', handleMouseMove)
    document.removeEventListener('mouseup', handleMouseUp)
    document.body.style.cursor = ''
    document.body.style.userSelect = ''
  }

  useEffect(() => {
    return () => {
      document.removeEventListener('mousemove', handleMouseMove)
      document.removeEventListener('mouseup', handleMouseUp)
      document.body.style.cursor = ''
      document.body.style.userSelect = ''
    }
  }, [])

  // Auto scroll to bottom
  useEffect(() => {
    if (autoScroll && logContainerRef.current) {
      logContainerRef.current.scrollTop = logContainerRef.current.scrollHeight
    }
  }, [logs, autoScroll, selectedLevels, searchQuery])

  // Count logs by level
  const counts = useMemo(() => {
    const total = { DEBUG: 0, INFO: 0, WARNING: 0, ERROR: 0 }
    logs.forEach((log) => {
      if (log.level in total) {
        total[log.level]++
      }
    })
    return total
  }, [logs])

  // Filter logs
  const filteredLogs = useMemo(() => {
    return logs.filter((log) => {
      if (!selectedLevels[log.level]) return false
      if (searchQuery) {
        return log.message.toLowerCase().includes(searchQuery.toLowerCase())
      }
      return true
    })
  }, [logs, selectedLevels, searchQuery])

  const toggleLevel = (level: string) => {
    setSelectedLevels((prev) => ({
      ...prev,
      [level]: !prev[level]
    }))
  }

  const handleOpenFolder = async () => {
    try {
      await window.api.openLogFolder()
    } catch (err) {
      console.error('Failed to open logs folder:', err)
    }
  }

  return (
    <div className="log-panel" style={{ height: `${height}px`, minHeight: `${height}px` }}>
      <div className="log-panel-splitter" onMouseDown={handleMouseDown} />
      <div className="log-panel-header">
        <div className="log-panel-title">
          <Terminal size={14} />
          <span>Logs Console</span>
          <span className="log-panel-count">({filteredLogs.length} shown)</span>
        </div>

        {/* Level Filters */}
        <div className="log-panel-filters">
          <button
            className={`log-filter-btn debug ${selectedLevels.DEBUG ? 'active' : ''}`}
            onClick={() => toggleLevel('DEBUG')}
            title="Toggle DEBUG logs"
          >
            <span className="log-dot debug"></span>
            <span>DEBUG ({counts.DEBUG})</span>
          </button>
          <button
            className={`log-filter-btn info ${selectedLevels.INFO ? 'active' : ''}`}
            onClick={() => toggleLevel('INFO')}
            title="Toggle INFO logs"
          >
            <span className="log-dot info"></span>
            <span>INFO ({counts.INFO})</span>
          </button>
          <button
            className={`log-filter-btn warning ${selectedLevels.WARNING ? 'active' : ''}`}
            onClick={() => toggleLevel('WARNING')}
            title="Toggle WARNING logs"
          >
            <span className="log-dot warning"></span>
            <span>WARNING ({counts.WARNING})</span>
          </button>
          <button
            className={`log-filter-btn error ${selectedLevels.ERROR ? 'active' : ''}`}
            onClick={() => toggleLevel('ERROR')}
            title="Toggle ERROR logs"
          >
            <span className="log-dot error"></span>
            <span>ERROR ({counts.ERROR})</span>
          </button>
        </div>

        {/* Search & Actions */}
        <div className="log-panel-actions">
          <input
            type="text"
            className="log-search-input"
            placeholder="Search logs..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />

          <button
            className={`log-action-btn ${autoScroll ? 'active' : ''}`}
            onClick={() => setAutoScroll((prev) => !prev)}
            title="Toggle Auto-scroll to bottom"
          >
            <ArrowDown size={14} />
            <span>AutoScroll</span>
          </button>

          <button className="log-action-btn" onClick={handleOpenFolder} title="Open Logs Directory">
            <FolderOpen size={14} />
            <span>Folder</span>
          </button>

          <button
            className="log-action-btn clear"
            onClick={onClear}
            title="Clear Logs Console and File"
          >
            <Trash2 size={14} />
            <span>Clear</span>
          </button>

          <div className="log-panel-divider"></div>

          <button className="log-panel-close-btn" onClick={onClose} title="Close Panel">
            <X size={16} />
          </button>
        </div>
      </div>

      {/* Logs View */}
      <div className="log-panel-body" ref={logContainerRef}>
        {filteredLogs.length === 0 ? (
          <div className="log-panel-empty">
            <ShieldAlert size={24} style={{ color: 'var(--text-secondary)' }} />
            <p>No log records match the selected level filters or search criteria.</p>
          </div>
        ) : (
          <div className="log-rows-container">
            {filteredLogs.map((log) => (
              <div key={log.id} className={`log-row ${log.level.toLowerCase()}`}>
                <span className="log-row-time">{log.timestamp.split(' ')[1]}</span>
                <span className={`log-row-badge ${log.level.toLowerCase()}`}>{log.level}</span>
                <span className="log-row-message">{log.message}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
