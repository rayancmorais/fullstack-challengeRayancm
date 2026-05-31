'use client'
import { useState, useEffect, useRef, useMemo } from 'react'
import type { GamePhase } from '@/store/game'

// Constante do backend: e^(0.06 * t_segundos) = e^(0.00006 * t_ms)
const GROWTH = 0.00006
const W = 1000
const H = 562
const PAD_B = 8
const PAD_T = 40

// Planeta fixo: canto superior direito, destino do asteroide
const PX = W * 0.84  // 840
const PY = H * 0.2   // 112.4
const PR = 46        // raio

interface Props {
  phase: GamePhase | null
  multiplier: number
  cashedOutAt?: number | null
  roundStartedAt?: number | null  // timestamp ms do servidor
}

// Calcula geometria da curva a partir do multiplicador atual
function computeCurve(M: number) {
  const m = Math.max(1.0001, M)
  const elapsed = Math.log(m) / GROWTH
  const win = Math.max(elapsed / 0.8, 2600)
  const yMax = Math.max(1.9, m * 1.28)
  const pts: [number, number][] = []
  for (let i = 0; i <= 64; i++) {
    const t = (elapsed * i) / 64
    const x = (t / win) * W
    const y = H - PAD_B - ((Math.exp(GROWTH * t) - 1) / (yMax - 1)) * (H - PAD_B - PAD_T)
    pts.push([x, y])
  }
  const last = pts[64]
  const prev = pts[63] ?? ([0, H] as [number, number])
  const d = pts
    .map((p, i) => (i === 0 ? `M ${p[0].toFixed(1)} ${p[1].toFixed(1)}` : `L ${p[0].toFixed(1)} ${p[1].toFixed(1)}`))
    .join(' ')
  const area = `${d} L ${last[0].toFixed(1)} ${H} L 0 ${H} Z`
  const ang = (Math.atan2(last[1] - prev[1], last[0] - prev[0]) * 180) / Math.PI
  return { path: d, area, tip: last, ang }
}

export function CrashChart({ phase, multiplier, cashedOutAt, roundStartedAt }: Props) {
  const running = phase === 'RODANDO'
  const crashed = phase === 'CRASHADO'

  // RAF loop — interpola suavemente entre ticks do servidor (100ms → 60fps)
  const [localMult, setLocalMult] = useState(multiplier)
  const rafRef = useRef<number | null>(null)

  useEffect(() => {
    if (rafRef.current) cancelAnimationFrame(rafRef.current)

    if (!running || !roundStartedAt) {
      setLocalMult(crashed ? multiplier : 1.0)
      return
    }

    const loop = () => {
      const ms = Date.now() - roundStartedAt
      setLocalMult(Math.exp(GROWTH * ms))
      rafRef.current = requestAnimationFrame(loop)
    }
    rafRef.current = requestAnimationFrame(loop)
    return () => { if (rafRef.current) cancelAnimationFrame(rafRef.current) }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [running, roundStartedAt])

  // Multiplicador de exibição: RAF quando rodando, server quando crashou
  const displayMult = crashed ? multiplier : localMult

  const { path, area, tip, ang } = useMemo(() => computeCurve(displayMult), [displayMult])

  // ── Lógica do planeta ──────────────────────────────────────────────────────
  const dist = Math.hypot(tip[0] - PX, tip[1] - PY)
  const saved = running && cashedOutAt != null
  const desp: 0 | 1 | 2 | 3 = saved ? 0 : dist >= 200 ? 0 : dist >= 140 ? 1 : dist >= 90 ? 2 : 3
  const hit = crashed && dist < 72             // asteroide alcançou o planeta
  const relieved = saved || (crashed && !hit)  // planeta sobreviveu → alívio

  // ── Rosto do planeta ───────────────────────────────────────────────────────
  const eyeY = PY - 7
  const lx = PX - 15
  const rx = PX + 15
  const my = PY + 17
  const eyeFill = '#e8eef0'
  const pupilFill = '#0d1018'
  const ew = ([6, 7, 8.5, 10] as const)[desp]
  const pr = ([3, 3, 3, 2.5] as const)[desp]

  const happyFace = (
    <g>
      <path d={`M ${lx - 7} ${eyeY + 1} Q ${lx} ${eyeY - 7} ${lx + 7} ${eyeY + 1}`}
        stroke={eyeFill} strokeWidth="2.6" fill="none" strokeLinecap="round" />
      <path d={`M ${rx - 7} ${eyeY + 1} Q ${rx} ${eyeY - 7} ${rx + 7} ${eyeY + 1}`}
        stroke={eyeFill} strokeWidth="2.6" fill="none" strokeLinecap="round" />
      <path d={`M ${PX - 12} ${my - 2} Q ${PX} ${my + 10} ${PX + 12} ${my - 2}`}
        stroke={eyeFill} strokeWidth="2.8" fill="none" strokeLinecap="round" />
    </g>
  )

  const mouth = desp === 0
    ? <path d={`M ${PX - 7} ${my} Q ${PX} ${my + 3} ${PX + 7} ${my}`}
        stroke={eyeFill} strokeWidth="2.2" fill="none" strokeLinecap="round" />
    : desp === 1
    ? <path d={`M ${PX - 7} ${my + 2} Q ${PX} ${my - 4} ${PX + 7} ${my + 2}`}
        stroke={eyeFill} strokeWidth="2.4" fill="none" strokeLinecap="round" />
    : <ellipse cx={PX} cy={my + 1} rx={desp === 2 ? 5 : 7} ry={desp === 2 ? 5 : 9}
        fill={pupilFill} stroke={eyeFill} strokeWidth="1.6" />

  const fearFace = (
    <g>
      {desp >= 2 && (
        <>
          <path d={`M ${lx - 8} ${eyeY - ew - 2} L ${lx + 6} ${eyeY - ew - 5}`}
            stroke={eyeFill} strokeWidth="2" strokeLinecap="round" />
          <path d={`M ${rx + 8} ${eyeY - ew - 2} L ${rx - 6} ${eyeY - ew - 5}`}
            stroke={eyeFill} strokeWidth="2" strokeLinecap="round" />
        </>
      )}
      <circle cx={lx} cy={eyeY} r={ew} fill={eyeFill} />
      <circle cx={rx} cy={eyeY} r={ew} fill={eyeFill} />
      <circle cx={lx} cy={eyeY - 2} r={pr} fill={pupilFill} />
      <circle cx={rx} cy={eyeY - 2} r={pr} fill={pupilFill} />
      {mouth}
    </g>
  )

  const face = relieved ? happyFace : fearFace
  const planetClass = `cc-planet ${saved ? 'saved' : relieved ? 'safe' : 'd' + desp}`
  const planetStroke = running && desp >= 3 && !relieved ? 'var(--danger)' : relieved ? 'var(--accent)' : 'rgba(var(--accent-rgb),0.35)'

  // ── Debris do crash ────────────────────────────────────────────────────────
  const asteroideDebris = [0, 40, 80, 120, 160, 200, 240, 280, 320].map((a, i) => {
    const rad = a * Math.PI / 180
    return (
      <rect key={'ad' + a} className="cc-boom-debris"
        x="-4" y="-4"
        width={i % 3 === 0 ? 9 : 6} height={i % 3 === 0 ? 9 : 6}
        rx="2"
        fill={i % 3 === 0 ? '#5b6470' : i % 3 === 1 ? 'var(--accent)' : 'var(--danger)'}
        transform={`rotate(${a * 1.4})`}
        style={{
          ['--dx' as string]: `${Math.cos(rad) * (72 + (i % 3) * 18)}px`,
          ['--dy' as string]: `${Math.sin(rad) * (72 + (i % 3) * 18)}px`,
        }}
      />
    )
  })

  const planetaDebris = [0, 30, 60, 90, 120, 150, 180, 210, 240, 270, 300, 330].map((a, i) => {
    const rad = a * Math.PI / 180
    return (
      <rect key={'db' + a} className="cc-boom-debris"
        x="-5" y="-5"
        width={i % 3 === 0 ? 11 : 7} height={i % 3 === 0 ? 11 : 7}
        rx="2"
        fill={i % 3 === 0 ? 'var(--danger)' : i % 3 === 1 ? 'var(--accent)' : '#3a4a6b'}
        transform={`rotate(${a * 1.3})`}
        style={{
          ['--dx' as string]: `${Math.cos(rad) * (110 + (i % 4) * 22)}px`,
          ['--dy' as string]: `${Math.sin(rad) * (110 + (i % 4) * 22)}px`,
        }}
      />
    )
  })

  const smokeItems: [number, number, number][] = [[-40, -20, 26], [38, -28, 22], [-30, 30, 24], [44, 24, 20], [0, -48, 22], [8, 44, 24]]

  return (
    <svg className="curve" viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none">
      <defs>
        <linearGradient id="ccStroke" x1="0" y1="1" x2="1" y2="0">
          <stop offset="0%" stopColor="var(--accent-2)" />
          <stop offset="100%" stopColor="var(--accent)" />
        </linearGradient>
        <linearGradient id="ccArea" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="rgba(var(--accent-rgb),0.28)" />
          <stop offset="100%" stopColor="rgba(var(--accent-rgb),0)" />
        </linearGradient>
        <filter id="ccGlow">
          <feGaussianBlur stdDeviation="6" result="b" />
          <feMerge><feMergeNode in="b" /><feMergeNode in="SourceGraphic" /></feMerge>
        </filter>
        <filter id="ccFireGlow" x="-80%" y="-80%" width="260%" height="260%">
          <feGaussianBlur stdDeviation="5" result="b" />
          <feMerge><feMergeNode in="b" /><feMergeNode in="SourceGraphic" /></feMerge>
        </filter>
        <radialGradient id="ccPlanet" cx="38%" cy="34%" r="75%">
          <stop offset="0%"   stopColor="#3a4a6b" />
          <stop offset="55%"  stopColor="#222a44" />
          <stop offset="100%" stopColor="#121627" />
        </radialGradient>
        <radialGradient id="ccFlame" cx="50%" cy="50%" r="50%">
          <stop offset="0%"   stopColor="#eafff4" />
          <stop offset="35%"  stopColor="var(--accent)" />
          <stop offset="100%" stopColor="rgba(var(--accent-rgb),0)" />
        </radialGradient>
        <radialGradient id="ccBoom" cx="50%" cy="50%" r="50%">
          <stop offset="0%"   stopColor="#fff" />
          <stop offset="30%"  stopColor="var(--accent)" />
          <stop offset="70%"  stopColor="var(--danger)" />
          <stop offset="100%" stopColor="rgba(var(--danger-rgb),0)" />
        </radialGradient>
      </defs>

      {/* grid horizontal */}
      {[0.25, 0.5, 0.75].map(f => (
        <line key={f} className="grid-line" x1="0" y1={H * f} x2={W} y2={H * f} />
      ))}

      {/* planeta — sempre visível enquanto não explodiu */}
      {(running || (crashed && !hit)) && (
        <g className={planetClass}>
          {/* aura */}
          <circle cx={PX} cy={PY} r={PR + 12}
            fill={`rgba(var(--${running && desp >= 3 && !relieved ? 'danger' : 'accent'}-rgb),0.08)`}
            filter="url(#ccGlow)"
          />
          {/* escudo quando sacou */}
          {saved && (
            <circle className="cc-shield" cx={PX} cy={PY} r={PR + 16}
              fill="rgba(var(--accent-rgb),0.05)" stroke="var(--accent)" strokeWidth="2.5"
            />
          )}
          {/* corpo */}
          <circle cx={PX} cy={PY} r={PR}
            fill="url(#ccPlanet)"
            stroke={planetStroke}
            strokeWidth={!relieved && desp >= 3 ? 2.5 : 1.5}
          />
          {/* anel orbital */}
          <ellipse cx={PX} cy={PY} rx={PR + 22} ry="9"
            fill="none" stroke="rgba(var(--accent-rgb),0.25)" strokeWidth="2"
            transform={`rotate(-18 ${PX} ${PY})`}
          />
          {/* crateras */}
          <circle cx={PX - 22} cy={PY + 18} r="6" fill="rgba(0,0,0,0.18)" />
          <circle cx={PX + 20} cy={PY + 20} r="4" fill="rgba(0,0,0,0.16)" />
          {/* rosto */}
          {face}
          {/* suor — nível 3 */}
          {running && desp >= 3 && !saved && (
            <g className="cc-sweat">
              <path d={`M ${PX - PR + 6} ${PY - 2} q -4 7 0 10 q 4 -3 0 -10 Z`} fill="#9fd8ff" />
              <path className="s2" d={`M ${PX + PR - 6} ${PY + 2} q -4 7 0 10 q 4 -3 0 -10 Z`} fill="#9fd8ff" />
            </g>
          )}
        </g>
      )}

      {/* badge "!" — proximidade nível 3 */}
      {running && !saved && desp >= 3 && (
        <g className="cc-alert-badge" transform={`translate(${PX + 38} ${PY - 50})`}>
          <circle r="17" fill="var(--danger)" />
          <circle r="17" fill="none" stroke="var(--danger)" strokeWidth="2" className="cc-alert-ring" />
          <text x="0" y="6" textAnchor="middle"
            fontFamily="var(--font-mono)" fontWeight="800" fontSize="22" fill="#fff">!</text>
        </g>
      )}

      {/* curva + asteroide */}
      {(running || crashed) && (
        <>
          <path d={area} fill="url(#ccArea)" style={{ transition: 'none' }} />
          <path d={path} fill="none"
            stroke={crashed ? 'var(--danger)' : 'url(#ccStroke)'}
            strokeWidth="5" strokeLinecap="round" strokeLinejoin="round"
            filter="url(#ccGlow)" style={{ transition: 'none' }}
          />

          {/* asteroide na ponta da curva */}
          {running && (
            <g transform={`translate(${tip[0]} ${tip[1]}) rotate(${ang})`} style={{ transition: 'none' }}>
              <g filter="url(#ccFireGlow)">
                {/* chama externa */}
                <path className="cc-flame cc-flame-outer"
                  d="M 6 0 C -26 -16, -64 -9, -96 0 C -64 9, -26 16, 6 0 Z"
                  fill="url(#ccFlame)"
                />
                {/* chama interna */}
                <path className="cc-flame cc-flame-inner"
                  d="M 4 0 C -16 -8, -40 -5, -58 0 C -40 5, -16 8, 4 0 Z"
                  fill="#eafff4" opacity="0.9"
                />
                {/* brasas */}
                <circle className="cc-ember e1" cx="-70" cy="-4" r="3.5" fill="var(--accent)" />
                <circle className="cc-ember e2" cx="-86" cy="5"  r="2.5" fill="#eafff4" />
                <circle className="cc-ember e3" cx="-58" cy="6"  r="2.5" fill="var(--accent)" />
              </g>
              {/* corpo rochoso — rotacionado 90° para a borda de ataque liderar */}
              <g transform="rotate(-90)">
                <path d="M -13 -7 L -3 -14 L 9 -12 L 16 -3 L 13 9 L 2 15 L -10 11 L -16 1 Z"
                  fill="#5b6470" stroke="rgba(var(--accent-rgb),0.9)" strokeWidth="1.5" />
                <path d="M -13 -7 L -3 -14 L 9 -12 L 16 -3 Z" fill="#6e7682" />
                <circle cx="-3" cy="2"  r="3.2" fill="#3c434d" />
                <circle cx="6"  cy="-3" r="2.2" fill="#3c434d" />
                <circle cx="-7" cy="-4" r="1.6" fill="#444c56" />
                <circle cx="4"  cy="7"  r="1.8" fill="#3c434d" />
              </g>
            </g>
          )}

          {/* explosão do asteroide no crash */}
          {crashed && (
            <g transform={`translate(${tip[0]} ${tip[1]})`} className="cc-boom">
              <circle className="cc-boom-flash" r="70" fill="url(#ccBoom)" />
              <circle className="cc-boom-core"  r="38" fill="url(#ccBoom)" />
              <circle className="cc-boom-ring"      r="18" fill="none" stroke="var(--danger)" strokeWidth="4" />
              <circle className="cc-boom-ring r2"   r="18" fill="none" stroke="var(--accent)" strokeWidth="2.5" />
              {asteroideDebris}
            </g>
          )}

          {/* explosão do planeta (só quando o asteroide o alcançou) */}
          {hit && (
            <g transform={`translate(${PX} ${PY})`} className="cc-boom">
              <circle className="cc-boom-flash" r="120" fill="url(#ccBoom)" />
              <circle className="cc-boom-core"  r="64"  fill="url(#ccBoom)" />
              <circle className="cc-boom-ring"      r="30" fill="none" stroke="var(--danger)" strokeWidth="5" />
              <circle className="cc-boom-ring r2"   r="30" fill="none" stroke="var(--accent)" strokeWidth="3" />
              <circle className="cc-boom-ring r3"   r="30" fill="none" stroke="#fff" strokeWidth="2" />
              {smokeItems.map(([sx, sy, sr], i) => (
                <circle key={'sm' + i} className="cc-boom-smoke" cx={sx} cy={sy} r={sr}
                  fill="rgba(40,46,58,0.55)"
                  style={{ ['--sx' as string]: `${sx * 1.7}px`, ['--sy' as string]: `${sy * 1.7}px` }}
                />
              ))}
              {planetaDebris}
            </g>
          )}
        </>
      )}
    </svg>
  )
}
