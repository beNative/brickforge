import { useState, useEffect, useMemo } from 'react'
import { BookOpen, FileText, Search, ChevronRight, AlertCircle, Loader2 } from 'lucide-react'

type DocTab = 'manual' | 'changelog'

/**
 * Lightweight regex-based Markdown-to-HTML renderer.
 * Handles: headings, bold, italic, inline code, code blocks,
 * unordered / ordered lists, blockquotes (GitHub-style alerts),
 * horizontal rules, links, and images.
 */
function renderMarkdown(raw: string): string {
  let html = ''
  const lines = raw.replace(/\r/g, '').split('\n')
  let inCodeBlock = false
  let codeBuffer: string[] = []
  let inList: 'ul' | 'ol' | null = null
  let inBlockquote = false
  let blockquoteBuffer: string[] = []

  const flushList = () => {
    if (inList) {
      html += inList === 'ul' ? '</ul>\n' : '</ol>\n'
      inList = null
    }
  }

  const flushBlockquote = () => {
    if (inBlockquote) {
      const content = blockquoteBuffer.join('\n')
      // Check for GitHub-style alert syntax: > [!NOTE], > [!TIP], etc.
      const alertMatch = content.match(/^\[!(NOTE|TIP|IMPORTANT|WARNING|CAUTION)\]\s*\n?([\s\S]*)$/)
      if (alertMatch) {
        const alertType = alertMatch[1].toLowerCase()
        const alertText = inlineFormat(alertMatch[2].trim())
        const iconMap: Record<string, string> = {
          note: '📘',
          tip: '💡',
          important: '🔵',
          warning: '⚠️',
          caution: '🔴'
        }
        html += `<div class="md-alert md-alert-${alertType}"><span class="md-alert-icon">${iconMap[alertType] || '💡'}</span><div><strong class="md-alert-title">${alertType.charAt(0).toUpperCase() + alertType.slice(1)}</strong><p>${alertText}</p></div></div>\n`
      } else {
        html += `<blockquote class="md-blockquote">${inlineFormat(content)}</blockquote>\n`
      }
      blockquoteBuffer = []
      inBlockquote = false
    }
  }

  const escapeHtml = (s: string) =>
    s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')

  const inlineFormat = (text: string): string => {
    let s = text
    // Links: [text](url)
    s = s.replace(
      /\[([^\]]+)\]\(([^)]+)\)/g,
      '<a href="$2" class="md-link" target="_blank" rel="noopener">$1</a>'
    )
    // Images
    s = s.replace(/!\[([^\]]*)\]\(([^)]+)\)/g, '<img src="$2" alt="$1" class="md-img" />')
    // Bold + Italic
    s = s.replace(/\*\*\*(.+?)\*\*\*/g, '<strong><em>$1</em></strong>')
    // Bold
    s = s.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    // Italic
    s = s.replace(/\*(.+?)\*/g, '<em>$1</em>')
    // Inline code
    s = s.replace(/`([^`]+)`/g, '<code class="md-inline-code">$1</code>')
    return s
  }

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]

    // ——— Fenced code blocks ———
    if (line.trim().startsWith('```')) {
      if (inCodeBlock) {
        html += `<pre class="md-code-block"><code>${escapeHtml(codeBuffer.join('\n'))}</code></pre>\n`
        codeBuffer = []
        inCodeBlock = false
      } else {
        flushList()
        flushBlockquote()
        inCodeBlock = true
      }
      continue
    }
    if (inCodeBlock) {
      codeBuffer.push(line)
      continue
    }

    // ——— Horizontal rule ———
    if (/^---+$/.test(line.trim())) {
      flushList()
      flushBlockquote()
      html += '<hr class="md-hr" />\n'
      continue
    }

    // ——— Blockquotes ———
    if (line.startsWith('>')) {
      flushList()
      inBlockquote = true
      blockquoteBuffer.push(line.replace(/^>\s?/, ''))
      continue
    } else if (inBlockquote) {
      flushBlockquote()
    }

    // ——— Headings ———
    const headingMatch = line.match(/^(#{1,6})\s+(.*)$/)
    if (headingMatch) {
      flushList()
      const level = headingMatch[1].length
      const text = inlineFormat(headingMatch[2])
      const id = headingMatch[2]
        .toLowerCase()
        .replace(/[^\w]+/g, '-')
        .replace(/^-|-$/g, '')
      html += `<h${level} id="${id}" class="md-h${level}">${text}</h${level}>\n`
      continue
    }

    // ——— Unordered list ———
    const ulMatch = line.match(/^(\s*)[*\-+]\s+(.*)$/)
    if (ulMatch) {
      if (inList !== 'ul') {
        flushList()
        html += '<ul class="md-ul">\n'
        inList = 'ul'
      }
      html += `<li>${inlineFormat(ulMatch[2])}</li>\n`
      continue
    }

    // ——— Ordered list ———
    const olMatch = line.match(/^(\s*)\d+\.\s+(.*)$/)
    if (olMatch) {
      if (inList !== 'ol') {
        flushList()
        html += '<ol class="md-ol">\n'
        inList = 'ol'
      }
      html += `<li>${inlineFormat(olMatch[2])}</li>\n`
      continue
    }

    // ——— Paragraph / blank ———
    flushList()
    if (line.trim() === '') {
      continue
    }
    html += `<p class="md-p">${inlineFormat(line)}</p>\n`
  }

  // Flush remaining
  if (inCodeBlock) {
    html += `<pre class="md-code-block"><code>${escapeHtml(codeBuffer.join('\n'))}</code></pre>\n`
  }
  flushList()
  flushBlockquote()

  return html
}

export default function HelpDocsPage() {
  const [activeTab, setActiveTab] = useState<DocTab>('manual')
  const [manualContent, setManualContent] = useState<string>('')
  const [changelogContent, setChangelogContent] = useState<string>('')
  const [searchQuery, setSearchQuery] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const loadDocs = async () => {
      setLoading(true)
      setError(null)
      try {
        const [manRes, clRes] = await Promise.all([
          window.api.readDocument('manual'),
          window.api.readDocument('changelog')
        ])
        if (manRes.success && manRes.content) setManualContent(manRes.content)
        else setError(manRes.error || 'Failed to load User Manual')
        if (clRes.success && clRes.content) setChangelogContent(clRes.content)
        else if (!error) setError(clRes.error || 'Failed to load Version Log')
      } catch (e: any) {
        setError(e.message || 'Unexpected error loading documents')
      } finally {
        setLoading(false)
      }
    }
    loadDocs()
  }, [])

  const rawContent = activeTab === 'manual' ? manualContent : changelogContent

  // Filter paragraphs by search query
  const filteredHtml = useMemo(() => {
    const html = renderMarkdown(rawContent)
    if (!searchQuery.trim()) return html

    const query = searchQuery.trim().toLowerCase()
    // Split into block-level elements and keep only those containing the query
    const blocks = html.split(/(?=<(?:h[1-6]|p |p>|ul|ol|pre|div|blockquote|hr))/i)
    const filtered = blocks.filter((block) => {
      // Always keep headings and HRs for context
      if (/^<h[1-6]/.test(block) || /^<hr/.test(block)) return true
      // Check if block text matches
      const textOnly = block.replace(/<[^>]*>/g, '').toLowerCase()
      return textOnly.includes(query)
    })

    // Highlight matching text
    if (filtered.length === 0)
      return '<p class="md-p" style="color:var(--text-secondary)">No matching content found.</p>'

    const escaped = searchQuery.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    const re = new RegExp(`(${escaped})`, 'gi')
    return filtered.join('').replace(re, '<mark class="md-highlight">$1</mark>')
  }, [rawContent, searchQuery])

  return (
    <div className="help-docs-page">
      {/* Header */}
      <div className="help-header">
        <div>
          <h1 style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <BookOpen size={28} />
            Help &amp; Documentation
          </h1>
          <p className="subtitle">Browse the user manual and release notes</p>
        </div>
      </div>

      {/* Tab Bar & Search */}
      <div className="help-toolbar glass-panel">
        <div className="help-tabs">
          <button
            className={`help-tab ${activeTab === 'manual' ? 'active' : ''}`}
            onClick={() => setActiveTab('manual')}
          >
            <BookOpen size={16} />
            User Manual
          </button>
          <button
            className={`help-tab ${activeTab === 'changelog' ? 'active' : ''}`}
            onClick={() => setActiveTab('changelog')}
          >
            <FileText size={16} />
            Release Notes
          </button>
        </div>

        <div className="help-search-box">
          <Search size={16} />
          <input
            type="text"
            placeholder="Search documentation..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="form-input"
          />
        </div>
      </div>

      {/* Document Content */}
      <div className="help-content glass-panel">
        {loading ? (
          <div className="help-loading">
            <Loader2 size={32} className="spin-icon" />
            <span>Loading documentation...</span>
          </div>
        ) : error ? (
          <div className="help-error">
            <AlertCircle size={32} />
            <span>{error}</span>
          </div>
        ) : (
          <div className="md-body" dangerouslySetInnerHTML={{ __html: filteredHtml }} />
        )}
      </div>

      {/* Breadcrumb trail */}
      <div className="help-breadcrumb">
        <span>BrickForge</span>
        <ChevronRight size={14} />
        <span>Help</span>
        <ChevronRight size={14} />
        <span className="active">{activeTab === 'manual' ? 'User Manual' : 'Release Notes'}</span>
      </div>
    </div>
  )
}
