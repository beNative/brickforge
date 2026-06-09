import React, { useState, useRef, useEffect } from 'react'
import ReactDOM from 'react-dom'

interface TooltipProps {
  content: React.ReactNode
  children: React.ReactElement
  delay?: number
  position?: 'top' | 'bottom' | 'left' | 'right'
}

export default function Tooltip({ content, children, delay = 150, position = 'top' }: TooltipProps) {
  const [active, setActive] = useState(false)
  const [coords, setCoords] = useState({ top: 0, left: 0 })
  const timer = useRef<NodeJS.Timeout | null>(null)
  const triggerRef = useRef<HTMLElement | null>(null)

  const showTooltip = () => {
    if (timer.current) clearTimeout(timer.current)
    timer.current = setTimeout(() => {
      if (triggerRef.current) {
        const rect = triggerRef.current.getBoundingClientRect()
        let top = 0
        let left = 0

        if (position === 'top') {
          top = rect.top + window.scrollY
          left = rect.left + rect.width / 2 + window.scrollX
        } else if (position === 'bottom') {
          top = rect.bottom + window.scrollY
          left = rect.left + rect.width / 2 + window.scrollX
        } else if (position === 'left') {
          top = rect.top + rect.height / 2 + window.scrollY
          left = rect.left + window.scrollX
        } else if (position === 'right') {
          top = rect.top + rect.height / 2 + window.scrollY
          left = rect.right + window.scrollX
        }

        setCoords({ top, left })
        setActive(true)
      }
    }, delay)
  }

  const hideTooltip = () => {
    if (timer.current) clearTimeout(timer.current)
    setActive(false)
  }

  useEffect(() => {
    return () => {
      if (timer.current) clearTimeout(timer.current)
    }
  }, [])

  const child = React.Children.only(children) as React.ReactElement<any>

  const clonedChild = React.cloneElement(child, {
    ref: (node: HTMLElement) => {
      triggerRef.current = node
      if (child && (child as any).ref) {
        if (typeof (child as any).ref === 'function') {
          ;(child as any).ref(node)
        } else if (typeof (child as any).ref === 'object') {
          ;(child as any).ref.current = node
        }
      }
    },
    onMouseEnter: (e: React.MouseEvent) => {
      if (child.props.onMouseEnter) child.props.onMouseEnter(e)
      showTooltip()
    },
    onMouseLeave: (e: React.MouseEvent) => {
      if (child.props.onMouseLeave) child.props.onMouseLeave(e)
      hideTooltip()
    },
    onClick: (e: React.MouseEvent) => {
      if (child.props.onClick) child.props.onClick(e)
      hideTooltip()
    }
  })

  return (
    <>
      {clonedChild}
      {active && content && ReactDOM.createPortal(
        <div 
          className={`custom-tooltip custom-tooltip-${position}`}
          style={{
            position: 'absolute',
            top: `${coords.top}px`,
            left: `${coords.left}px`,
            zIndex: 99999,
            pointerEvents: 'none'
          }}
        >
          <div className="custom-tooltip-content">
            {content}
          </div>
        </div>,
        document.body
      )}
    </>
  )
}
