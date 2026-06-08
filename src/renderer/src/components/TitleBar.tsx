import React from 'react'
import { Minus, Square, X } from 'lucide-react'

export default function TitleBar(): React.JSX.Element {
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
        <button 
          className="titlebar-btn" 
          onClick={handleMinimize} 
          title="Minimize"
          aria-label="Minimize"
        >
          <Minus size={14} />
        </button>
        <button 
          className="titlebar-btn" 
          onClick={handleMaximize} 
          title="Maximize"
          aria-label="Maximize"
        >
          <Square size={12} />
        </button>
        <button 
          className="titlebar-btn close" 
          onClick={handleClose} 
          title="Close"
          aria-label="Close"
        >
          <X size={14} />
        </button>
      </div>
    </div>
  )
}
