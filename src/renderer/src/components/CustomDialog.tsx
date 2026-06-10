import React, { createContext, useContext, useState } from 'react'
import ReactDOM from 'react-dom'
import { AlertTriangle, Info } from 'lucide-react'

interface DialogConfig {
  type: 'alert' | 'confirm' | 'prompt'
  title: string
  message: string
  confirmText?: string
  cancelText?: string
  inputLabel?: string
  defaultValue?: string
  resolve: (value: boolean | string | null) => void
}

interface DialogContextType {
  alert: (message: string, title?: string) => Promise<boolean>
  confirm: (message: string, title?: string) => Promise<boolean>
  prompt: (
    message: string,
    defaultValue?: string,
    title?: string,
    inputLabel?: string
  ) => Promise<string | null>
}

const DialogContext = createContext<DialogContextType | null>(null)

export function useDialog() {
  const context = useContext(DialogContext)
  if (!context) {
    throw new Error('useDialog must be used within a CustomDialogProvider')
  }
  return context
}

export function CustomDialogProvider({ children }: { children: React.ReactNode }) {
  const [dialog, setDialog] = useState<DialogConfig | null>(null)

  const showAlert = (message: string, title: string = 'Notice') => {
    return new Promise<boolean>((resolve) => {
      setDialog({
        type: 'alert',
        title,
        message,
        confirmText: 'OK',
        resolve: (val) => {
          setDialog(null)
          resolve(Boolean(val))
        }
      })
    })
  }

  const showConfirm = (message: string, title: string = 'Confirmation') => {
    return new Promise<boolean>((resolve) => {
      setDialog({
        type: 'confirm',
        title,
        message,
        confirmText: 'Yes',
        cancelText: 'Cancel',
        resolve: (val) => {
          setDialog(null)
          resolve(Boolean(val))
        }
      })
    })
  }

  const showPrompt = (
    message: string,
    defaultValue: string = '',
    title: string = 'Input Required',
    inputLabel: string = 'Value'
  ) => {
    return new Promise<string | null>((resolve) => {
      setDialog({
        type: 'prompt',
        title,
        message,
        inputLabel,
        defaultValue,
        confirmText: 'Save',
        cancelText: 'Cancel',
        resolve: (val) => {
          setDialog(null)
          resolve(typeof val === 'string' ? val : null)
        }
      })
    })
  }

  return (
    <DialogContext.Provider value={{ alert: showAlert, confirm: showConfirm, prompt: showPrompt }}>
      {children}
      {dialog && <DialogModal config={dialog} />}
    </DialogContext.Provider>
  )
}

function DialogModal({ config }: { config: DialogConfig }) {
  const [inputValue, setInputValue] = useState(config.defaultValue || '')

  return ReactDOM.createPortal(
    <div className="modal-overlay" style={{ zIndex: 999999 }}>
      <div
        className="glass-panel modal-content"
        style={{
          maxWidth: '400px',
          padding: '24px',
          display: 'flex',
          flexDirection: 'column',
          gap: '16px',
          animation: 'modalScaleIn 0.2s cubic-bezier(0.34, 1.56, 0.64, 1)'
        }}
      >
        <div style={{ display: 'flex', gap: '14px', alignItems: 'flex-start' }}>
          <div
            style={{
              color: config.type === 'confirm' ? 'var(--status-partial)' : 'var(--primary)',
              background:
                config.type === 'confirm' ? 'var(--status-partial-bg)' : 'rgba(79, 70, 229, 0.1)',
              padding: '8px',
              borderRadius: '8px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0
            }}
          >
            {config.type === 'confirm' ? <AlertTriangle size={20} /> : <Info size={20} />}
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <h3 style={{ margin: '0 0 6px 0', fontSize: '16px', fontWeight: 700 }}>
              {config.title}
            </h3>
            <p
              style={{
                margin: 0,
                fontSize: '13px',
                color: 'var(--text-secondary)',
                lineHeight: 1.5
              }}
            >
              {config.message}
            </p>
          </div>
        </div>

        {config.type === 'prompt' && (
          <div className="form-group" style={{ margin: 0 }}>
            <label className="form-label">{config.inputLabel || 'Value'}</label>
            <input
              className="form-input"
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              autoFocus
              onKeyDown={(e) => {
                if (e.key === 'Enter' && inputValue.trim()) {
                  config.resolve(inputValue.trim())
                }
              }}
            />
          </div>
        )}

        <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end', marginTop: '4px' }}>
          {config.type !== 'alert' && (
            <button
              className="btn btn-secondary btn-sm"
              onClick={() => config.resolve(config.type === 'prompt' ? null : false)}
              style={{ minWidth: '80px', height: '32px' }}
            >
              {config.cancelText || 'Cancel'}
            </button>
          )}
          <button
            className="btn btn-primary btn-sm"
            onClick={() => config.resolve(config.type === 'prompt' ? inputValue.trim() : true)}
            disabled={config.type === 'prompt' && !inputValue.trim()}
            style={{ minWidth: '80px', height: '32px' }}
          >
            {config.confirmText || 'OK'}
          </button>
        </div>
      </div>
    </div>,
    document.body
  )
}
