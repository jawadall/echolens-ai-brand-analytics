/**
 * FormattedText — Renders Gemini AI output with proper formatting.
 *
 * Handles:
 *  - **bold** → <strong>
 *  - 'quoted text' → <em> with quote styling
 *  - [URGENT] [HIGH] [MEDIUM] [LOW] → colored priority badges
 *  - Percentage numbers → highlighted
 *  - Line breaks
 */
import React from 'react'

const PRIORITY_STYLES: Record<string, { bg: string; text: string; border: string }> = {
  URGENT:    { bg: 'rgba(239,68,68,0.15)',   text: '#f87171', border: 'rgba(239,68,68,0.3)' },
  HIGH:      { bg: 'rgba(251,146,60,0.15)',  text: '#fb923c', border: 'rgba(251,146,60,0.3)' },
  MEDIUM:    { bg: 'rgba(250,204,21,0.12)',  text: '#facc15', border: 'rgba(250,204,21,0.25)' },
  LOW:       { bg: 'rgba(74,222,128,0.12)',  text: '#4ade80', border: 'rgba(74,222,128,0.25)' },
  'LONG-TERM': { bg: 'rgba(139,92,246,0.12)', text: '#a78bfa', border: 'rgba(139,92,246,0.25)' },
}

/**
 * Parse a string that may contain **bold**, 'quotes', and [PRIORITY] tags
 * into an array of React elements.
 */
function parseInline(text: string): React.ReactNode[] {
  const nodes: React.ReactNode[] = []
  // Regex: **bold** | 'single-quoted' | [PRIORITY] | percentages
  const rx = /(\*\*(.+?)\*\*)|(\[([A-Z-]+)\])|('([^']{2,80})')|(\b\d+\.?\d*%)/g
  let last = 0
  let match: RegExpExecArray | null

  while ((match = rx.exec(text)) !== null) {
    // Push plain text before this match
    if (match.index > last) {
      nodes.push(text.slice(last, match.index))
    }

    if (match[1]) {
      // **bold**
      nodes.push(
        <strong key={match.index} style={{ color: 'var(--text-primary)', fontWeight: 600 }}>
          {match[2]}
        </strong>
      )
    } else if (match[3]) {
      // [PRIORITY]
      const tag = match[4]
      const style = PRIORITY_STYLES[tag]
      if (style) {
        nodes.push(
          <span
            key={match.index}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              padding: '1px 8px',
              borderRadius: '4px',
              fontSize: '10px',
              fontWeight: 700,
              letterSpacing: '0.5px',
              background: style.bg,
              color: style.text,
              border: `1px solid ${style.border}`,
              marginRight: '6px',
              verticalAlign: 'middle',
            }}
          >
            {tag}
          </span>
        )
      } else {
        nodes.push(match[3])
      }
    } else if (match[5]) {
      // 'quoted text'
      nodes.push(
        <em
          key={match.index}
          style={{
            color: 'var(--text-primary)',
            fontStyle: 'italic',
            opacity: 0.9,
          }}
        >
          &lsquo;{match[6]}&rsquo;
        </em>
      )
    } else if (match[7]) {
      // percentage
      nodes.push(
        <span key={match.index} style={{ color: 'var(--text-primary)', fontWeight: 600 }}>
          {match[7]}
        </span>
      )
    }

    last = match.index + match[0].length
  }

  // Push remaining text
  if (last < text.length) {
    nodes.push(text.slice(last))
  }

  return nodes
}

interface FormattedTextProps {
  text: string
  className?: string
  style?: React.CSSProperties
}

export default function FormattedText({ text, className = '', style }: FormattedTextProps) {
  if (!text) return null
  return (
    <span className={className} style={{ ...style, lineHeight: '1.7' }}>
      {parseInline(text)}
    </span>
  )
}

/**
 * FormattedParagraph — renders a block of text, splitting on sentence boundaries
 * for better readability with line-height spacing.
 */
export function FormattedParagraph({ text, className = '', style }: FormattedTextProps) {
  if (!text) return null
  return (
    <p className={className} style={{ ...style, lineHeight: '1.75' }}>
      {parseInline(text)}
    </p>
  )
}

/**
 * FormattedRecommendation — renders a recommendation with priority badge extracted.
 * Input like: "[URGENT] **Do something:** details here"
 * Renders the badge separately from the text.
 */
export function FormattedRecommendation({ text, index }: { text: string; index: number }) {
  // Extract priority tag if present at the start
  const tagMatch = text.match(/^\[([A-Z-]+)\]\s*/)
  const priority = tagMatch ? tagMatch[1] : null
  const cleanText = tagMatch ? text.slice(tagMatch[0].length) : text
  const tagStyle = priority ? PRIORITY_STYLES[priority] : null

  return (
    <div
      className="flex items-start gap-3 p-3.5 rounded-lg transition-all duration-200"
      style={{
        background: tagStyle
          ? tagStyle.bg
          : 'var(--bg-elevated)',
        border: `1px solid ${tagStyle ? tagStyle.border : 'var(--border-primary)'}`,
      }}
    >
      {/* Number badge */}
      <div
        className="w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5"
        style={{
          background: tagStyle ? tagStyle.bg : 'rgba(99,102,241,0.15)',
          border: `1px solid ${tagStyle ? tagStyle.border : 'rgba(99,102,241,0.3)'}`,
        }}
      >
        <span
          className="text-[10px] font-bold"
          style={{ color: tagStyle ? tagStyle.text : '#818cf8' }}
        >
          {index + 1}
        </span>
      </div>

      <div className="flex-1 min-w-0">
        {/* Priority badge */}
        {priority && tagStyle && (
          <span
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              padding: '1px 8px',
              borderRadius: '4px',
              fontSize: '10px',
              fontWeight: 700,
              letterSpacing: '0.5px',
              background: tagStyle.bg,
              color: tagStyle.text,
              border: `1px solid ${tagStyle.border}`,
              marginRight: '8px',
              marginBottom: '4px',
            }}
          >
            {priority}
          </span>
        )}
        <span className="text-sm" style={{ color: 'var(--text-secondary)', lineHeight: '1.7' }}>
          {parseInline(cleanText)}
        </span>
      </div>
    </div>
  )
}
