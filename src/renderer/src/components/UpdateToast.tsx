import { useState, useEffect, useRef } from 'react'
import { Download, RefreshCw, AlertCircle, CheckCircle, Sparkles, X } from 'lucide-react'

export default function UpdateToast() {
  const [show, setShow] = useState(false)
  const [status, setStatus] = useState<'available' | 'downloading' | 'downloaded' | 'error'>(
    'available'
  )
  const [version, setVersion] = useState('')
  const [progress, setProgress] = useState(0)
  const [errorMsg, setErrorMsg] = useState('')

  const showRef = useRef(show)
  useEffect(() => {
    showRef.current = show
  }, [show])

  useEffect(() => {
    let errorTimer: NodeJS.Timeout | null = null

    // 1. Update available in background
    const unsubscribeAvailable = window.api.onUpdateAvailable((info) => {
      setVersion(info.version)
      setStatus('available')
      setShow(true)
    })

    // 2. Download progress updates
    const unsubscribeProgress = window.api.onUpdateProgress((data) => {
      setStatus('downloading')
      setProgress(data.percent)
      setShow(true)
    })

    // 3. Update finished downloading
    const unsubscribeDownloaded = window.api.onUpdateDownloaded((info) => {
      setVersion(info.version)
      setStatus('downloaded')
      setShow(true)
    })

    // 4. Update error occurred
    const unsubscribeError = window.api.onUpdateError((msg) => {
      // Only show error toast if we were already showing an update notice (downloading, etc.)
      if (showRef.current) {
        setErrorMsg(msg)
        setStatus('error')
        setShow(true)

        if (errorTimer) clearTimeout(errorTimer)
        errorTimer = setTimeout(() => {
          setShow(false)
        }, 8000)
      }
    })

    return () => {
      unsubscribeAvailable()
      unsubscribeProgress()
      unsubscribeDownloaded()
      unsubscribeError()
      if (errorTimer) clearTimeout(errorTimer)
    }
  }, [])

  const handleRelaunch = (): void => {
    window.api.triggerUpdateRelaunch()
  }

  if (!show) return null

  return (
    <div className="update-toast-container">
      <div className={`update-toast-card glass-panel ${status}`}>
        <button
          className="update-toast-close"
          onClick={() => setShow(false)}
          aria-label="Close notification"
        >
          <X size={14} />
        </button>

        <div className="update-toast-header">
          {status === 'available' && (
            <>
              <div className="update-toast-icon available animate-pulse">
                <Sparkles size={16} />
              </div>
              <div className="update-toast-info">
                <span className="update-toast-title">New Version Available!</span>
                <span className="update-toast-desc">
                  BrickForge v{version} is ready to download.
                </span>
              </div>
            </>
          )}

          {status === 'downloading' && (
            <>
              <div className="update-toast-icon downloading">
                <Download size={16} className="bounce-animation" />
              </div>
              <div className="update-toast-info">
                <span className="update-toast-title">Downloading Update</span>
                <span className="update-toast-desc">Downloading BrickForge v{version}...</span>
              </div>
            </>
          )}

          {status === 'downloaded' && (
            <>
              <div className="update-toast-icon downloaded">
                <CheckCircle size={16} />
              </div>
              <div className="update-toast-info">
                <span className="update-toast-title">Update Ready!</span>
                <span className="update-toast-desc">
                  Version v{version} downloaded successfully.
                </span>
              </div>
            </>
          )}

          {status === 'error' && (
            <>
              <div className="update-toast-icon error">
                <AlertCircle size={16} />
              </div>
              <div className="update-toast-info">
                <span className="update-toast-title">Update Failed</span>
                <span className="update-toast-desc">{errorMsg}</span>
              </div>
            </>
          )}
        </div>

        {status === 'downloading' && (
          <div className="update-toast-progress-container">
            <div className="update-toast-progress-track">
              <div className="update-toast-progress-bar" style={{ width: `${progress}%` }}></div>
            </div>
            <span className="update-toast-progress-percent">{progress}%</span>
          </div>
        )}

        {status === 'downloaded' && (
          <div className="update-toast-actions">
            <button className="btn btn-primary btn-sm update-relaunch-btn" onClick={handleRelaunch}>
              <RefreshCw size={12} style={{ marginRight: '6px' }} />
              <span>Relaunch App</span>
            </button>
            <span className="update-toast-silent-hint">Or applies automatically on exit</span>
          </div>
        )}
      </div>
    </div>
  )
}
