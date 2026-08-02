/**
 * WordCloud — Visual word cloud showing most frequent topics/keywords
 * Uses pure CSS/SVG with animated rendering (no external lib)
 */
import { motion } from 'framer-motion'
import { useMemo } from 'react'

interface WordCloudProps {
  posts: Array<{ content: string; topics?: string[] }>
  maxWords?: number
}

// Common stop words to filter
const STOP_WORDS = new Set([
  'the', 'a', 'an', 'is', 'are', 'was', 'were', 'be', 'been', 'being',
  'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would', 'shall', 'should',
  'may', 'might', 'can', 'could', 'must', 'to', 'of', 'in', 'for', 'on', 'with',
  'at', 'by', 'from', 'as', 'into', 'through', 'during', 'before', 'after',
  'above', 'below', 'between', 'out', 'off', 'over', 'under', 'again', 'further',
  'then', 'once', 'here', 'there', 'when', 'where', 'why', 'how', 'all', 'each',
  'every', 'both', 'few', 'more', 'most', 'other', 'some', 'such', 'no', 'nor',
  'not', 'only', 'own', 'same', 'so', 'than', 'too', 'very', 'just', 'because',
  'but', 'and', 'or', 'if', 'while', 'about', 'up', 'that', 'this', 'these',
  'those', 'it', 'its', 'he', 'she', 'they', 'them', 'we', 'you', 'i', 'me',
  'my', 'his', 'her', 'our', 'your', 'their', 'what', 'which', 'who', 'whom',
  'http', 'https', 'www', 'com', 'org', 'net', 'rt', 'amp', 'via', 'like',
  'get', 'got', 'go', 'going', 'also', 'much', 'many', 'said', 'one', 'two',
  'new', 'make', 'know', 'see', 'time', 'way', 'even', 'back', 'well', 'still',
])

const COLORS = [
  '#5a71f2', '#7b97f8', '#15b79e', '#2ed3b7', '#f59e0b',
  '#10b981', '#818cf8', '#f43f5e', '#8b5cf6', '#ec4899',
]

export default function WordCloud({ posts, maxWords = 40 }: WordCloudProps) {
  const words = useMemo(() => {
    const freq: Record<string, number> = {}

    posts.forEach((post) => {
      // Use topics if available
      if (post.topics && post.topics.length > 0) {
        post.topics.forEach((topic) => {
          const t = topic.toLowerCase().trim()
          if (t.length > 2) freq[t] = (freq[t] || 0) + 3
        })
      }

      // Also extract from content
      const words = post.content
        .replace(/https?:\/\/\S+/g, '')  // remove URLs
        .replace(/[^a-zA-Z\s]/g, ' ')     // remove special chars
        .toLowerCase()
        .split(/\s+/)
        .filter(w => w.length > 3 && !STOP_WORDS.has(w))

      words.forEach(w => { freq[w] = (freq[w] || 0) + 1 })
    })

    return Object.entries(freq)
      .sort((a, b) => b[1] - a[1])
      .slice(0, maxWords)
      .map(([word, count], index) => ({
        word,
        count,
        size: Math.max(12, Math.min(36, 12 + (count / Math.max(1, Object.values(freq)[0])) * 24)),
        color: COLORS[index % COLORS.length],
      }))
  }, [posts, maxWords])

  if (words.length === 0) {
    return (
      <div className="flex items-center justify-center py-12">
        <p className="text-sm" style={{ color: 'var(--text-muted)' }}>Not enough data for word cloud</p>
      </div>
    )
  }

  return (
    <div className="flex flex-wrap items-center justify-center gap-x-3 gap-y-1.5 py-4 px-2">
      {words.map((w, i) => (
        <motion.span
          key={w.word}
          className="inline-block cursor-default transition-all hover:scale-110"
          style={{
            fontSize: `${w.size}px`,
            color: w.color,
            fontWeight: w.size > 20 ? 700 : w.size > 16 ? 600 : 400,
            opacity: 0.7 + (w.size / 36) * 0.3,
          }}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 0.7 + (w.size / 36) * 0.3, y: 0 }}
          transition={{ delay: i * 0.02, duration: 0.4 }}
          whileHover={{ scale: 1.15, opacity: 1 }}
          title={`${w.word}: ${w.count} mentions`}
        >
          {w.word}
        </motion.span>
      ))}
    </div>
  )
}
