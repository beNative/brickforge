import React from 'react'
import { Moon, Sun, Minus, Square, X } from 'lucide-react'
import Tooltip from './Tooltip'

interface TitleBarProps {
  theme: 'dark' | 'light'
  onToggleTheme: () => void
}

export default function TitleBar({ theme, onToggleTheme }: TitleBarProps): React.JSX.Element {
  const handleMinimize = () => {
    window.api.minimizeWindow()
  }

  const handleMaximize = () => {
    window.api.maximizeWindow()
  }

  const handleClose = () => {
    window.api.closeWindow()
  }

  return (
    <div className="titlebar">
      <div className="titlebar-drag-region">
        <span className="titlebar-title">BrickForge</span>
      </div>
      <div className="titlebar-controls">
        <Tooltip
          content={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
          position="bottom"
        >
          <button
            className="titlebar-btn theme"
            onClick={onToggleTheme}
            aria-label={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
          >
            {theme === 'dark' ? <Sun size={13} /> : <Moon size={13} />}
          </button>
        </Tooltip>
        <Tooltip content="Minimize window" position="bottom">
          <button className="titlebar-btn" onClick={handleMinimize} aria-label="Minimize">
            <Minus size={14} />
          </button>
        </Tooltip>
        <Tooltip content="Maximize window" position="bottom">
          <button className="titlebar-btn" onClick={handleMaximize} aria-label="Maximize">
            <Square size={12} />
          </button>
        </Tooltip>
        <Tooltip content="Close application" position="bottom">
          <button className="titlebar-btn close" onClick={handleClose} aria-label="Close">
            <X size={14} />
          </button>
        </Tooltip>
      </div>
    </div>
  )
}
