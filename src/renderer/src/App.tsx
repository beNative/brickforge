import { useState, useEffect } from 'react'
import { 
  Home, 
  Database, 
  Search, 
  Layers, 
  Hammer,
  Sun,
  Moon,
  BookOpen
} from 'lucide-react'

// Import Components
import TitleBar from './components/TitleBar'

// Import Pages
import HomePage from './pages/HomePage'
import ImportPage from './pages/ImportPage'
import SetSearchPage from './pages/SetSearchPage'
import InventorySessionPage from './pages/InventorySessionPage'
import CollectionOverviewPage from './pages/CollectionOverviewPage'
import HelpDocsPage from './pages/HelpDocsPage'

function App() {
  const [currentPage, setCurrentPage] = useState<string>('home')
  const [activeSessionId, setActiveSessionId] = useState<number | null>(null)
  const [activeSetNum, setActiveSetNum] = useState<string | null>(null)
  const [dbStats, setDbStats] = useState<{ catalogSetsCount: number; catalogPartsCount: number } | null>(null)
  const [theme, setTheme] = useState<'dark' | 'light'>(() => {
    const saved = localStorage.getItem('theme')
    return (saved === 'light' || saved === 'dark') ? saved : 'dark'
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

  const toggleTheme = () => {
    setTheme(prev => prev === 'dark' ? 'light' : 'dark')
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
  const isDbPopulated = dbStats && dbStats.catalogSetsCount > 0 && dbStats.catalogPartsCount > 0

  return (
    <>
      <TitleBar />
      <div className="app-container">
        {/* Sidebar Navigation */}
        <aside className="sidebar">
          <div className="brand">
            <div className="brand-icon">
              <Hammer size={20} className="text-white" />
            </div>
            <span className="brand-name">BrickForge</span>
          </div>

          <nav className="nav-links">
            <button 
              className={`nav-link ${currentPage === 'home' ? 'active' : ''}`}
              onClick={() => { setCurrentPage('home'); setActiveSessionId(null); }}
            >
              <Home />
              <span>Dashboard</span>
            </button>

            <button 
              className={`nav-link ${currentPage === 'search' ? 'active' : ''}`}
              onClick={() => { setCurrentPage('search'); setActiveSessionId(null); }}
            >
              <Search />
              <span>Search Sets</span>
            </button>

            <button 
              className={`nav-link ${currentPage === 'collection' ? 'active' : ''}`}
              onClick={() => { setCurrentPage('collection'); setActiveSessionId(null); }}
            >
              <Layers />
              <span>Collection</span>
            </button>

            <button 
              className={`nav-link ${currentPage === 'import' ? 'active' : ''}`}
              onClick={() => { setCurrentPage('import'); setActiveSessionId(null); }}
            >
              <Database />
              <span>Import Data</span>
            </button>

            <button 
              className={`nav-link ${currentPage === 'docs' ? 'active' : ''}`}
              onClick={() => { setCurrentPage('docs'); setActiveSessionId(null); }}
            >
              <BookOpen />
              <span>Help & Manual</span>
            </button>
          </nav>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginTop: 'auto' }}>
            {/* Theme Toggle Button */}
            <button 
              className="nav-link"
              onClick={toggleTheme}
              style={{ width: '100%' }}
              aria-label="Toggle Theme"
            >
              {theme === 'dark' ? <Sun /> : <Moon />}
              <span>{theme === 'dark' ? 'Light Mode' : 'Dark Mode'}</span>
            </button>

            {/* DB Connection Status Widget */}
            <div className="db-status">
              <div className="db-status-title">Database Status</div>
              <div className="db-status-value">
                <span className={`status-dot ${isDbPopulated ? 'green' : 'red'}`}></span>
                <span>{isDbPopulated ? 'Connected & Ready' : 'Data Missing'}</span>
              </div>
              {isDbPopulated && dbStats && (
                <div style={{ fontSize: '11px', color: '#64748b', marginTop: '6px' }}>
                  {dbStats.catalogSetsCount} Sets / {dbStats.catalogPartsCount} Parts
                </div>
              )}
            </div>
          </div>
        </aside>

        {/* Main Pages Content */}
        <main className="main-content">
          {currentPage === 'home' && (
            <HomePage 
              onNavigateToSession={navigateToSession}
              onNavigateToImport={() => setCurrentPage('import')}
              onNavigateToSearch={() => setCurrentPage('search')}
            />
          )}
          {currentPage === 'import' && (
            <ImportPage onImportSuccess={loadDbStats} />
          )}
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
              onBackToHome={() => { setCurrentPage('home'); setActiveSessionId(null); }}
            />
          )}
          {currentPage === 'collection' && (
            <CollectionOverviewPage 
              onNavigateToSession={navigateToSession}
            />
          )}
          {currentPage === 'docs' && (
            <HelpDocsPage />
          )}
        </main>
      </div>
    </>
  )
}

export default App
