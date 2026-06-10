import { useState, useEffect } from 'react'
import { ImageOff } from 'lucide-react'

interface CachedImageProps {
  url: string | null
  alt: string
  className?: string
  style?: React.CSSProperties
  fallbackIconSize?: number
}

/**
 * Drop-in image component that first tries the brickforge:// protocol
 * (SQLite BLOB cache), then falls back to the original remote URL.
 * Shows a placeholder icon if both fail or url is null.
 */
export default function CachedImage({
  url,
  alt,
  className,
  style,
  fallbackIconSize = 40
}: CachedImageProps) {
  const [src, setSrc] = useState<string | null>(() => {
    if (!url) return null
    // Try cached version first via custom protocol
    return `brickforge://image?url=${encodeURIComponent(url)}`
  })

  useEffect(() => {
    setSrc(url ? `brickforge://image?url=${encodeURIComponent(url)}` : null)
  }, [url])

  const handleError = () => {
    if (src && src.startsWith('brickforge://') && url) {
      // First failure: try original remote URL as fallback
      setSrc(url)
    } else {
      // Both failed — show placeholder
      setSrc(null)
    }
  }

  if (!src) {
    return (
      <div
        className={className}
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: '#475569',
          ...style
        }}
      >
        <ImageOff size={fallbackIconSize} />
      </div>
    )
  }

  return (
    <img
      src={src}
      alt={alt}
      className={className}
      style={style}
      onError={handleError}
      loading="lazy"
    />
  )
}
