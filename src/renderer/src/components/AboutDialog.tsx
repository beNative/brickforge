import { useEffect, useState } from 'react'
import ReactDOM from 'react-dom'
import { ExternalLink, X } from 'lucide-react'
import logo from '../assets/logo.png'

interface AboutDialogProps {
  isOpen: boolean
  onClose: () => void
}

export default function AboutDialog({ isOpen, onClose }: AboutDialogProps) {
  const [version, setVersion] = useState<string>('1.4.0')

  useEffect(() => {
    if (isOpen) {
      window.api
        .getAppVersion()
        .then((ver) => {
          setVersion(ver)
        })
        .catch((err) => {
          console.error('Failed to get app version:', err)
        })
    }
  }, [isOpen])

  if (!isOpen) return null

  return ReactDOM.createPortal(
    <div className="modal-overlay" style={{ zIndex: 999999 }} onClick={onClose}>
      <div
        className="glass-panel modal-content"
        style={{
          maxWidth: '360px',
          padding: '24px',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          animation: 'modalScaleIn 0.2s cubic-bezier(0.34, 1.56, 0.64, 1)'
        }}
        onClick={(e) => e.stopPropagation()} // Prevent closing when clicking dialog content
      >
        <button
          className="update-toast-close"
          onClick={onClose}
          aria-label="Close about dialog"
          style={{
            position: 'absolute',
            top: '12px',
            right: '12px',
            background: 'transparent',
            border: 'none',
            cursor: 'pointer',
            color: 'var(--text-secondary)'
          }}
        >
          <X size={16} />
        </button>

        <div className="about-dialog-container">
          <div className="about-dialog-logo">
            <img src={logo} alt="BrickForge Logo" />
          </div>

          <h2 className="about-dialog-name">BrickForge</h2>
          <span className="about-dialog-version">v{version}</span>

          <p className="about-dialog-desc">
            A premium inventory checker and collection manager designed specifically for LEGO
            Technic sets.
          </p>

          <div className="about-dialog-links">
            <a
              href="https://github.com/beNative/brickforge"
              target="_blank"
              rel="noopener noreferrer"
              className="about-dialog-link"
            >
              <ExternalLink size={14} />
              <span>GitHub Repository</span>
            </a>
          </div>

          <button className="btn btn-secondary btn-sm about-dialog-close-btn" onClick={onClose}>
            Close
          </button>
        </div>
      </div>
    </div>,
    document.body
  )
}
