'use client'
import { useMemo } from 'react'
import type { GamePhase } from '@/store/game'

const W = 1000
const H = 562
const PAD_B = 8
const PAD_T = 40
// e^(0.06 * t_seconds) = e^(0.00006 * t_ms)
const GROWTH = 0.00006

interface Props {
  phase: GamePhase | null
  multiplier: number
}

export function CrashGraph({ phase, multiplier }: Props) {
  const { path, area, tip } = useMemo(() => {
    const M = Math.max(1.0001, multiplier)
    const elapsed = Math.log(M) / GROWTH
    const win = Math.max(elapsed / 0.8, 2600)
    const yMax = Math.max(1.9, M * 1.28)
    const N = 64
    const pts: [number, number][] = []

    for (let i = 0; i <= N; i++) {
      const t = (elapsed * i) / N
      const m = Math.exp(GROWTH * t)
      const x = (t / win) * W
      const y = H - PAD_B - ((m - 1) / (yMax - 1)) * (H - PAD_B - PAD_T)
      pts.push([x, y])
    }

    const last = pts[pts.length - 1]
    const d = pts.map((p, i) =>
      i === 0 ? `M ${p[0].toFixed(1)} ${p[1].toFixed(1)}` : `L ${p[0].toFixed(1)} ${p[1].toFixed(1)}`
    ).join(' ')
    const a = `${d} L ${last[0].toFixed(1)} ${H} L 0 ${H} Z`

    return { path: d, area: a, tip: last }
  }, [multiplier])

  const running = phase === 'RODANDO'
  const crashed = phase === 'CRASHADO'

  return (
    <svg className="curve" viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none">
      <defs>
        <linearGradient id="curveStroke" x1="0" y1="1" x2="1" y2="0">
          <stop offset="0%" stopColor="var(--accent-2)" />
          <stop offset="100%" stopColor="var(--accent)" />
        </linearGradient>
        <linearGradient id="curveArea" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="rgba(43,245,176,0.28)" />
          <stop offset="100%" stopColor="rgba(43,245,176,0)" />
        </linearGradient>
        <filter id="glow">
          <feGaussianBlur stdDeviation="6" result="b" />
          <feMerge><feMergeNode in="b" /><feMergeNode in="SourceGraphic" /></feMerge>
        </filter>
      </defs>

      {[0.25, 0.5, 0.75].map(f => (
        <line key={f} className="grid-line" x1="0" y1={H * f} x2={W} y2={H * f} />
      ))}

      {(running || crashed) && (
        <>
          <path d={area} fill="url(#curveArea)" />
          <path
            d={path} fill="none"
            stroke={crashed ? 'var(--danger)' : 'url(#curveStroke)'}
            strokeWidth="5" strokeLinecap="round" strokeLinejoin="round"
            filter="url(#glow)"
          />
          {running && (
            <g>
              <circle cx={tip[0]} cy={tip[1]} r="11" fill="var(--accent)" opacity="0.25" filter="url(#glow)" />
              <circle cx={tip[0]} cy={tip[1]} r="6" fill="var(--accent)" filter="url(#glow)" />
            </g>
          )}
          {crashed && (
            <circle cx={tip[0]} cy={tip[1]} r="8" fill="var(--danger)" filter="url(#glow)" />
          )}
        </>
      )}
    </svg>
  )
}
