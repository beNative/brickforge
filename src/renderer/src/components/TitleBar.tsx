import React from 'react'
import { Minus, Square, X } from 'lucide-react'
import Tooltip from './Tooltip'

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
        <Tooltip content="Minimize window" position="bottom">
          <button 
            className="titlebar-btn" 
            onClick={handleMinimize} 
            aria-label="Minimize"
          >
            <Minus size={14} />
          </button>
        </Tooltip>
        <Tooltip content="Maximize window" position="bottom">
          <button 
            className="titlebar-btn" 
            onClick={handleMaximize} 
            aria-label="Maximize"
          >
            <Square size={12} />
          </button>
        </Tooltip>
        <Tooltip content="Close application" position="bottom">
          <button 
            className="titlebar-btn close" 
            onClick={handleClose} 
            aria-label="Close"
          >
            <X size={14} />
          </button>
        </Tooltip>
      </div>
    </div>
  )
}
