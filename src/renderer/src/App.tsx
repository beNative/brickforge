import { useState, useEffect } from 'react'
import { Home, Database, Search, Layers, BookOpen, Settings } from 'lucide-react'

// Import Components
import TitleBar from './components/TitleBar'
import { CustomDialogProvider } from './components/CustomDialog'
import UpdateToast from './components/UpdateToast'
import StatusBar from './components/StatusBar'
import AboutDialog from './components/AboutDialog'
import logo from './assets/logo.png'

// Import Pages
import HomePage from './pages/HomePage'
import ImportPage from './pages/ImportPage'
import SetSearchPage from './pages/SetSearchPage'
import InventorySessionPage from './pages/InventorySessionPage'
import CollectionOverviewPage from './pages/CollectionOverviewPage'
import HelpDocsPage from './pages/HelpDocsPage'
import SettingsPage from './pages/SettingsPage'
import LogPanel, { LogMessage } from './components/LogPanel'

function App() {
  const [currentPage, setCurrentPage] = useState<string>('home')
  const [activeSessionId, setActiveSessionId] = useState<number | null>(null)
  const [activeSetNum, setActiveSetNum] = useState<string | null>(null)
  const [dbStats, setDbStats] = useState<{
    catalogSetsCount: number
    catalogPartsCount: number
  } | null>(null)
  const [isAboutOpen, setIsAboutOpen] = useState(false)
  const [isLogPanelOpen, setIsLogPanelOpen] = useState(false)
  const [logs, setLogs] = useState<LogMessage[]>([])
  const [theme, setTheme] = useState<'dark' | 'light'>(() => {
    const saved = localStorage.getItem('theme')
    return saved === 'light' || saved === 'dark' ? saved : 'dark'
  })

  // Toggle theme class on body
  useEffect(() => {
    if (theme === 'light') {
      document.body.classList.add('light-theme')
    } else {
      document.body.classList.remove('light-theme')
    }
    localStorage.setItem('theme', theme)
  }, [theme])

  // Setup logging subscriber
  useEffect(() => {
    window.api
      .getLogs()
      .then((res) => {
        if (res.success && res.logs) {
          setLogs(res.logs)
        }
      })
      .catch((err) => {
        console.error('Failed to get initial logs:', err)
      })

    const unsubscribeLog = window.api.onLogMessage((newLog) => {
      setLogs((prev) => [...prev, newLog])
    })

    const unsubscribeCleared = window.api.onLogsCleared(() => {
      setLogs([])
    })

    return () => {
      unsubscribeLog()
      unsubscribeCleared()
    }
  }, [])

  // Calculate log counts for warnings/errors
  const logCounts = (() => {
    let warning = 0
    let error = 0
    logs.forEach((l) => {
      if (l.level === 'WARNING') warning++
      else if (l.level === 'ERROR') error++
    })
    return { warning, error }
  })()

  const handleClearLogs = async () => {
    try {
      await window.api.clearLogs()
    } catch (err) {
      console.error('Failed to clear logs:', err)
    }
  }

  const toggleTheme = () => {
    setTheme((prev) => (prev === 'dark' ? 'light' : 'dark'))
  }

  // Load database stats to display connection status
  const loadDbStats = async () => {
    try {
      const res = await window.api.getGeneralStats()
      if (res.success && res.stats) {
        setDbStats({
          catalogSetsCount: res.stats.catalogSetsCount,
          catalogPartsCount: res.stats.catalogPartsCount
        })
      }
    } catch (e) {
      console.error('Failed to load DB stats', e)
    }
  }

  useEffect(() => {
    loadDbStats()
  }, [currentPage])

  const navigateToSession = (sessionId: number) => {
    setActiveSessionId(sessionId)
    setCurrentPage('session')
  }

  // Database is populated if there are sets and parts in the catalog
  const isDbPopulated = !!(dbStats && dbStats.catalogSetsCount > 0 && dbStats.catalogPartsCount > 0)

  return (
    <CustomDialogProvider>
      <TitleBar theme={theme} onToggleTheme={toggleTheme} />
      <UpdateToast />
      <div className="app-container">
        {/* Sidebar Navigation */}
        <aside className="sidebar">
          <div
            className="brand"
            onClick={() => setIsAboutOpen(true)}
            style={{ cursor: 'pointer' }}
            title="About BrickForge"
          >
            <div className="brand-icon" style={{ padding: '2px', background: 'transparent' }}>
              <img
                src={logo}
                alt="BrickForge Logo"
                style={{ width: '100%', height: '100%', objectFit: 'contain' }}
              />
            </div>
            <span className="brand-name">BrickForge</span>
          </div>

          <nav className="nav-links">
            <button
              className={`nav-link ${currentPage === 'home' ? 'active' : ''}`}
              onClick={() => {
                setCurrentPage('home')
                setActiveSessionId(null)
              }}
            >
              <Home />
              <span>Dashboard</span>
            </button>

            <button
              className={`nav-link ${currentPage === 'search' ? 'active' : ''}`}
              onClick={() => {
                setCurrentPage('search')
                setActiveSessionId(null)
              }}
            >
              <Search />
              <span>Search Sets</span>
            </button>

            <button
              className={`nav-link ${currentPage === 'collection' ? 'active' : ''}`}
              onClick={() => {
                setCurrentPage('collection')
                setActiveSessionId(null)
              }}
            >
              <Layers />
              <span>Collection</span>
            </button>

            <button
              className={`nav-link ${currentPage === 'import' ? 'active' : ''}`}
              onClick={() => {
                setCurrentPage('import')
                setActiveSessionId(null)
              }}
            >
              <Database />
              <span>Import Data</span>
            </button>

            <button
              className={`nav-link ${currentPage === 'docs' ? 'active' : ''}`}
              onClick={() => {
                setCurrentPage('docs')
                setActiveSessionId(null)
              }}
            >
              <BookOpen />
              <span>Help & Manual</span>
            </button>

            <button
              className={`nav-link ${currentPage === 'settings' ? 'active' : ''}`}
              onClick={() => {
                setCurrentPage('settings')
                setActiveSessionId(null)
              }}
            >
              <Settings />
              <span>Settings</span>
            </button>
          </nav>

          <div className="sidebar-footer">
            {/* DB Connection Status Widget */}
            <div className="db-status">
              <div className="db-status-title">Database Status</div>
              <div className="db-status-value">
                <span className={`status-dot ${isDbPopulated ? 'green' : 'red'}`}></span>
                <span>{isDbPopulated ? 'Connected & Ready' : 'Data Missing'}</span>
              </div>
              {isDbPopulated && dbStats && (
                <div className="db-status-meta">
                  {dbStats.catalogSetsCount} Sets / {dbStats.catalogPartsCount} Parts
                </div>
              )}
            </div>
          </div>
        </aside>

        {/* Main Pages Content */}
        <main className="main-content">
          <div className="main-page-wrapper">
            {currentPage === 'home' && (
              <HomePage
                onNavigateToSession={navigateToSession}
                onNavigateToImport={() => setCurrentPage('import')}
                onNavigateToSearch={() => setCurrentPage('search')}
              />
            )}
            {currentPage === 'import' && <ImportPage onImportSuccess={loadDbStats} />}
            {currentPage === 'search' && (
              <SetSearchPage
                preselectedSetNum={activeSetNum}
                onSessionStart={navigateToSession}
                onClearPreselected={() => setActiveSetNum(null)}
              />
            )}
            {currentPage === 'session' && activeSessionId !== null && (
              <InventorySessionPage
                sessionId={activeSessionId}
                onBackToHome={() => {
                  setCurrentPage('home')
                  setActiveSessionId(null)
                }}
              />
            )}
            {currentPage === 'collection' && (
              <CollectionOverviewPage onNavigateToSession={navigateToSession} />
            )}
            {currentPage === 'docs' && <HelpDocsPage />}
            {currentPage === 'settings' && (
              <SettingsPage
                onSettingsSaved={async () => {
                  loadDbStats()
                }}
              />
            )}
          </div>
          {isLogPanelOpen && (
            <LogPanel
              logs={logs}
              onClose={() => setIsLogPanelOpen(false)}
              onClear={handleClearLogs}
            />
          )}
        </main>
      </div>

      <StatusBar
        isDbPopulated={isDbPopulated}
        dbStats={dbStats}
        isSessionActive={currentPage === 'session' && activeSessionId !== null}
        onAboutClick={() => setIsAboutOpen(true)}
        isLogPanelOpen={isLogPanelOpen}
        onToggleLogPanel={() => setIsLogPanelOpen((prev) => !prev)}
        logCounts={logCounts}
      />
      <AboutDialog isOpen={isAboutOpen} onClose={() => setIsAboutOpen(false)} />
    </CustomDialogProvider>
  )
}

export default App
