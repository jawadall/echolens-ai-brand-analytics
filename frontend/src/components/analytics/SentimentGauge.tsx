/**
 * SentimentGauge — Radial gauge showing sentiment score
 * Uses SVG for a premium, animated gauge visualization
 *
 * Layout (SVG Y-axis is inverted — positive Y goes DOWN):
 *
 *              0.0 (top)
 *           ╱‾‾‾‾‾‾‾╲
 *   -1.0  ╱             ╲  +1.0
 *        (left)       (right)
 *
 * -1.0 maps to the LEFT endpoint  (angle = 0°,   arc-angle = π)
 * +1.0 maps to the RIGHT endpoint (angle = 180°, arc-angle = 0)
 *  0.0 maps to the TOP            (angle = 90°,  arc-angle = π/2)
 */
import { motion } from 'framer-motion'

interface SentimentGaugeProps {
  score: number  // -1 to 1
  size?: number
  label?: string
}

export default function SentimentGauge({ score, size = 200, label = 'Sentiment Score' }: SentimentGaugeProps) {
  const normalizedScore = Math.max(-1, Math.min(1, score))
  const percentage = (normalizedScore + 1) / 2  // 0 (-1.0) → 1 (+1.0)
  const sweepDeg = percentage * 180  // how many degrees of arc to fill

  const cx = size / 2
  const cy = size / 2 + 10
  const radius = size / 2 - 22
  const strokeWidth = 14

  // ── helpers ────────────────────────────────────────────
  // Convert a "gauge angle" (0°=left, 90°=top, 180°=right) to SVG (x,y).
  // In SVG, Y is flipped, so we SUBTRACT sin.
  const gaugePoint = (deg: number, r: number) => {
    const rad = (Math.PI * deg) / 180
    return {
      x: cx - r * Math.cos(rad),   // cos(0)=1 → left;  cos(180)=-1 → right
      y: cy - r * Math.sin(rad),   // sin(90)=1 → top (subtract for SVG)
    }
  }

  // Background arc: full semi-circle from left (-1.0) to right (+1.0)
  const bgStart = gaugePoint(0, radius)
  const bgEnd   = gaugePoint(180, radius)
  const bgPath  = `M ${bgStart.x} ${bgStart.y} A ${radius} ${radius} 0 0 1 ${bgEnd.x} ${bgEnd.y}`

  // Value arc: from left to the score position
  const valEnd  = gaugePoint(sweepDeg, radius)
  const largeArc = sweepDeg > 180 ? 1 : 0
  const valuePath = `M ${bgStart.x} ${bgStart.y} A ${radius} ${radius} 0 ${largeArc} 1 ${valEnd.x} ${valEnd.y}`

  // Needle endpoint
  const needleTip = gaugePoint(sweepDeg, radius - 28)

  // ── color by score ─────────────────────────────────────
  const getColor = (s: number) => {
    if (s > 0.2)  return '#10b981'  // green
    if (s > 0.05) return '#34d399'  // light green
    if (s > -0.05) return '#f59e0b' // amber / neutral
    if (s > -0.2) return '#f97316'  // orange
    return '#ef4444'                 // red
  }

  const color = getColor(normalizedScore)
  const sentimentLabel =
    normalizedScore > 0.1 ? 'Positive' :
    normalizedScore < -0.1 ? 'Negative' : 'Neutral'

  // Tick marks for -0.5 and +0.5
  const tick1 = gaugePoint(45, radius)   // -0.5
  const tick2 = gaugePoint(90, radius)   // 0.0
  const tick3 = gaugePoint(135, radius)  // +0.5
  const tickInner1 = gaugePoint(45, radius - strokeWidth / 2 - 4)
  const tickInner2 = gaugePoint(90, radius - strokeWidth / 2 - 4)
  const tickInner3 = gaugePoint(135, radius - strokeWidth / 2 - 4)

  return (
    <div className="flex flex-col items-center">
      <svg width={size} height={size / 2 + 48} viewBox={`0 0 ${size} ${size / 2 + 48}`}>
        {/* Gradient definition */}
        <defs>
          <linearGradient id="gaugeGrad" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#ef4444" />
            <stop offset="25%" stopColor="#f97316" />
            <stop offset="50%" stopColor="#f59e0b" />
            <stop offset="75%" stopColor="#34d399" />
            <stop offset="100%" stopColor="#10b981" />
          </linearGradient>
        </defs>

        {/* Background arc — gradient to show the full spectrum */}
        <path d={bgPath} fill="none" stroke="url(#gaugeGrad)" strokeWidth={strokeWidth} strokeLinecap="round" opacity={0.15} />

        {/* Track arc — subtle border */}
        <path d={bgPath} fill="none" stroke="var(--border-primary)" strokeWidth={strokeWidth} strokeLinecap="round" opacity={0.3} />

        {/* Value arc (animated) */}
        <motion.path
          d={valuePath}
          fill="none"
          stroke={color}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          initial={{ pathLength: 0, opacity: 0 }}
          animate={{ pathLength: 1, opacity: 1 }}
          transition={{ duration: 1.2, ease: 'easeOut' }}
          style={{ filter: `drop-shadow(0 0 8px ${color}50)` }}
        />

        {/* Tick marks */}
        {[[tick1, tickInner1], [tick2, tickInner2], [tick3, tickInner3]].map(([outer, inner], i) => (
          <line key={i} x1={outer.x} y1={outer.y} x2={inner.x} y2={inner.y}
            stroke="var(--text-muted)" strokeWidth={1} opacity={0.3} />
        ))}

        {/* Needle */}
        <motion.g
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.8, duration: 0.5 }}
        >
          <line
            x1={cx} y1={cy}
            x2={needleTip.x} y2={needleTip.y}
            stroke={color} strokeWidth={2.5} strokeLinecap="round"
          />
          {/* Needle glow */}
          <line
            x1={cx} y1={cy}
            x2={needleTip.x} y2={needleTip.y}
            stroke={color} strokeWidth={5} strokeLinecap="round" opacity={0.2}
          />
        </motion.g>

        {/* Center dot */}
        <circle cx={cx} cy={cy} r={5} fill={color} />
        <circle cx={cx} cy={cy} r={3} fill="var(--bg-primary)" />

        {/* Score text */}
        <text x={cx} y={cy - 20} textAnchor="middle" fontSize="26" fontWeight="bold" fill={color}>
          {normalizedScore > 0 ? '+' : ''}{normalizedScore.toFixed(2)}
        </text>

        {/* Scale labels */}
        <text x={bgStart.x - 2} y={cy + 18} textAnchor="start" fontSize="10" fill="var(--text-muted)">-1.0</text>
        <text x={bgEnd.x + 2} y={cy + 18} textAnchor="end" fontSize="10" fill="var(--text-muted)">+1.0</text>
        <text x={cx} y={cy + 18} textAnchor="middle" fontSize="9" fill="var(--text-muted)">0</text>
      </svg>

      <div className="text-center -mt-2">
        <motion.span
          className="text-sm font-semibold"
          style={{ color }}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 1 }}
        >
          {sentimentLabel}
        </motion.span>
        <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>{label}</p>
      </div>
    </div>
  )
}
