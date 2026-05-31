'use client'
import { useMemo } from 'react'
import type { GamePhase } from '@/store/game'

const W = 1000
const H = 562
const PAD_B = 8
const PAD_T = 40
const CRESCIMENTO = 0.00006

interface Props {
  fase: GamePhase | null
  multiplicador: number
  sacadoEm: number | null
}

export function CrashGraph({ fase, multiplicador, sacadoEm }: Props) {
  const { path, area, tip, ang } = useMemo(() => {
    const M = Math.max(1.0001, multiplicador)
    const elapsed = Math.log(M) / CRESCIMENTO
    const win = Math.max(elapsed / 0.8, 2600)
    const yMax = Math.max(1.9, M * 1.28)
    const N = 64
    const pts: [number, number][] = []

    for (let i = 0; i <= N; i++) {
      const t = (elapsed * i) / N
      const m = Math.exp(CRESCIMENTO * t)
      const x = (t / win) * W
      const y = H - PAD_B - ((m - 1) / (yMax - 1)) * (H - PAD_B - PAD_T)
      pts.push([x, y])
    }

    const last = pts[pts.length - 1]
    const prev = pts[pts.length - 2] || ([0, H] as [number, number])
    const d = pts
      .map((p, i) => (i === 0 ? `M ${p[0].toFixed(1)} ${p[1].toFixed(1)}` : `L ${p[0].toFixed(1)} ${p[1].toFixed(1)}`))
      .join(' ')
    const a = `${d} L ${last[0].toFixed(1)} ${H} L 0 ${H} Z`
    const angulo = Math.atan2(last[1] - prev[1], last[0] - prev[0]) * 180 / Math.PI
    return { path: d, area: a, tip: last, ang: angulo }
  }, [multiplicador])

  const rodando  = fase === 'RODANDO'
  const crashado = fase === 'CRASHADO'
  const salvo    = rodando && sacadoEm != null

  // planeta: posição fixa upper-right
  const px = W * 0.84, py = H * 0.2, pr = 46

  // nível de desespero 0-3 conforme o asteroide se aproxima
  const dist = Math.hypot(tip[0] - px, tip[1] - py)
  const desp    = salvo ? 0 : dist >= 200 ? 0 : dist >= 140 ? 1 : dist >= 90 ? 2 : 3
  const impactou = crashado && dist < 72
  const aliviado = salvo || (crashado && !impactou)

  // --- rostos do planeta ---
  const olhoY = py - 7, lx = px - 15, rx = px + 15, bocaY = py + 17
  const corOlho = '#e8eef0', corPupila = '#0d1018'

  const faceFeliz = (
    <g>
      <path d={`M ${lx - 7} ${olhoY + 1} Q ${lx} ${olhoY - 7} ${lx + 7} ${olhoY + 1}`}
        stroke={corOlho} strokeWidth="2.6" fill="none" strokeLinecap="round" />
      <path d={`M ${rx - 7} ${olhoY + 1} Q ${rx} ${olhoY - 7} ${rx + 7} ${olhoY + 1}`}
        stroke={corOlho} strokeWidth="2.6" fill="none" strokeLinecap="round" />
      <path d={`M ${px - 12} ${bocaY - 2} Q ${px} ${bocaY + 10} ${px + 12} ${bocaY - 2}`}
        stroke={corOlho} strokeWidth="2.8" fill="none" strokeLinecap="round" />
    </g>
  )

  const ew  = [6, 7, 8.5, 10][desp]
  const pr2 = [3, 3, 3, 2.5][desp]
  const boca = desp <= 0
    ? <path d={`M ${px - 7} ${bocaY} Q ${px} ${bocaY + 3} ${px + 7} ${bocaY}`} stroke={corOlho} strokeWidth="2.2" fill="none" strokeLinecap="round" />
    : desp === 1
      ? <path d={`M ${px - 7} ${bocaY + 2} Q ${px} ${bocaY - 4} ${px + 7} ${bocaY + 2}`} stroke={corOlho} strokeWidth="2.4" fill="none" strokeLinecap="round" />
      : <ellipse cx={px} cy={bocaY + 1} rx={desp === 2 ? 5 : 7} ry={desp === 2 ? 5 : 9} fill={corPupila} stroke={corOlho} strokeWidth="1.6" />

  const faceMedo = (
    <g>
      {desp >= 2 && (<>
        <path d={`M ${lx - 8} ${olhoY - ew - 2} L ${lx + 6} ${olhoY - ew - 5}`} stroke={corOlho} strokeWidth="2" strokeLinecap="round" />
        <path d={`M ${rx + 8} ${olhoY - ew - 2} L ${rx - 6} ${olhoY - ew - 5}`} stroke={corOlho} strokeWidth="2" strokeLinecap="round" />
      </>)}
      <circle cx={lx} cy={olhoY} r={ew} fill={corOlho} />
      <circle cx={rx} cy={olhoY} r={ew} fill={corOlho} />
      <circle cx={lx} cy={olhoY - 2} r={pr2} fill={corPupila} />
      <circle cx={rx} cy={olhoY - 2} r={pr2} fill={corPupila} />
      {boca}
    </g>
  )

  const face = aliviado ? faceFeliz : faceMedo

  return (
    <svg className="curve" viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none">
      <defs>
        <linearGradient id="curveStroke" x1="0" y1="1" x2="1" y2="0">
          <stop offset="0%" stopColor="var(--accent-2)" />
          <stop offset="100%" stopColor="var(--accent)" />
        </linearGradient>
        <linearGradient id="curveArea" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="rgba(var(--accent-rgb),0.28)" />
          <stop offset="100%" stopColor="rgba(var(--accent-rgb),0)" />
        </linearGradient>
        <filter id="glow">
          <feGaussianBlur stdDeviation="6" result="b" />
          <feMerge><feMergeNode in="b" /><feMergeNode in="SourceGraphic" /></feMerge>
        </filter>
        <filter id="fireGlow" x="-80%" y="-80%" width="260%" height="260%">
          <feGaussianBlur stdDeviation="5" result="b" />
          <feMerge><feMergeNode in="b" /><feMergeNode in="SourceGraphic" /></feMerge>
        </filter>
        <radialGradient id="planetGrad" cx="38%" cy="34%" r="75%">
          <stop offset="0%" stopColor="#3a4a6b" />
          <stop offset="55%" stopColor="#222a44" />
          <stop offset="100%" stopColor="#121627" />
        </radialGradient>
        <radialGradient id="flameGrad" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="#eafff4" />
          <stop offset="35%" stopColor="var(--accent)" />
          <stop offset="100%" stopColor="rgba(var(--accent-rgb),0)" />
        </radialGradient>
        <radialGradient id="boomGrad" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="#fff" />
          <stop offset="30%" stopColor="var(--accent)" />
          <stop offset="70%" stopColor="var(--danger)" />
          <stop offset="100%" stopColor="rgba(var(--danger-rgb),0)" />
        </radialGradient>
      </defs>

      {[0.25, 0.5, 0.75].map(f => (
        <line key={f} className="grid-line" x1="0" y1={H * f} x2={W} y2={H * f} />
      ))}

      {/* planeta — aparece rodando ou crashado-sem-impacto */}
      {(rodando || (crashado && !impactou)) && (
        <g className={`cc-planet ${salvo ? 'saved' : aliviado ? 'safe' : 'd' + desp}`}>
          <circle cx={px} cy={py} r={pr + 12}
            fill={`rgba(var(--${rodando && desp >= 3 && !aliviado ? 'danger' : 'accent'}-rgb),0.08)`}
            filter="url(#glow)" />
          {salvo && (
            <circle className="cc-shield" cx={px} cy={py} r={pr + 16}
              fill="rgba(var(--accent-rgb),0.05)" stroke="var(--accent)" strokeWidth="2.5" />
          )}
          <circle cx={px} cy={py} r={pr} fill="url(#planetGrad)"
            stroke={aliviado ? 'var(--accent)' : desp >= 3 ? 'var(--danger)' : 'rgba(var(--accent-rgb),0.35)'}
            strokeWidth={!aliviado && desp >= 3 ? 2.5 : 1.5} />
          <ellipse cx={px} cy={py} rx={pr + 22} ry="9" fill="none"
            stroke="rgba(var(--accent-rgb),0.25)" strokeWidth="2"
            transform={`rotate(-18 ${px} ${py})`} />
          <circle cx={px - 22} cy={py + 18} r="6" fill="rgba(0,0,0,0.18)" />
          <circle cx={px + 20} cy={py + 20} r="4" fill="rgba(0,0,0,0.16)" />
          {face}
          {rodando && desp >= 3 && !salvo && (
            <g className="cc-sweat">
              <path d={`M ${px - pr + 6} ${py - 2} q -4 7 0 10 q 4 -3 0 -10 Z`} fill="#9fd8ff" />
              <path className="s2" d={`M ${px + pr - 6} ${py + 2} q -4 7 0 10 q 4 -3 0 -10 Z`} fill="#9fd8ff" />
            </g>
          )}
        </g>
      )}

      {/* badge "!" quando o asteroide está perto demais */}
      {rodando && !salvo && desp >= 3 && (
        <g className="cc-alert-badge" transform={`translate(${px + 38} ${py - 50})`}>
          <circle r="17" fill="var(--danger)" />
          <circle r="17" fill="none" stroke="var(--danger)" strokeWidth="2" className="cc-alert-ring" />
          <text x="0" y="6" textAnchor="middle" fontFamily="var(--font-mono)"
            fontWeight="800" fontSize="22" fill="#fff">!</text>
        </g>
      )}

      {(rodando || crashado) && (
        <>
          <path d={area} fill="url(#curveArea)" style={{ transition: 'none' }} />
          <path d={path} fill="none"
            stroke={crashado ? 'var(--danger)' : 'url(#curveStroke)'}
            strokeWidth="5" strokeLinecap="round" strokeLinejoin="round"
            filter="url(#glow)" style={{ transition: 'none' }} />

          {/* asteroide + rastro de fogo na ponta da curva */}
          {rodando && (
            <g transform={`translate(${tip[0]} ${tip[1]}) rotate(${ang})`} style={{ transition: 'none' }}>
              <g filter="url(#fireGlow)">
                <path className="cc-flame cc-flame-outer"
                  d="M 6 0 C -26 -16, -64 -9, -96 0 C -64 9, -26 16, 6 0 Z"
                  fill="url(#flameGrad)" />
                <path className="cc-flame cc-flame-inner"
                  d="M 4 0 C -16 -8, -40 -5, -58 0 C -40 5, -16 8, 4 0 Z"
                  fill="#eafff4" opacity="0.9" />
                <circle className="cc-ember e1" cx="-70" cy="-4" r="3.5" fill="var(--accent)" />
                <circle className="cc-ember e2" cx="-86" cy="5"  r="2.5" fill="#eafff4" />
                <circle className="cc-ember e3" cx="-58" cy="6"  r="2.5" fill="var(--accent)" />
              </g>
              {/* corpo do asteroide rotacionado para a borda de movimento liderar */}
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

          {/* explosão no ponto de crash (asteroide) */}
          {crashado && (
            <g transform={`translate(${tip[0]} ${tip[1]})`} className="cc-boom">
              <circle className="cc-boom-flash" r="70" fill="url(#boomGrad)" />
              <circle className="cc-boom-core"  r="38" fill="url(#boomGrad)" />
              <circle className="cc-boom-ring"  r="18" fill="none" stroke="var(--danger)" strokeWidth="4" />
              <circle className="cc-boom-ring r2" r="18" fill="none" stroke="var(--accent)" strokeWidth="2.5" />
              {[0, 40, 80, 120, 160, 200, 240, 280, 320].map((a, i) => (
                <rect key={'ad' + a} className="cc-boom-debris" x="-4" y="-4"
                  width={i % 3 === 0 ? 9 : 6} height={i % 3 === 0 ? 9 : 6} rx="2"
                  fill={i % 3 === 0 ? '#5b6470' : i % 3 === 1 ? 'var(--accent)' : 'var(--danger)'}
                  transform={`rotate(${a * 1.4})`}
                  style={{
                    '--dx': `${Math.cos(a * Math.PI / 180) * (72 + (i % 3) * 18)}px`,
                    '--dy': `${Math.sin(a * Math.PI / 180) * (72 + (i % 3) * 18)}px`,
                  } as React.CSSProperties} />
              ))}
            </g>
          )}

          {/* explosão no planeta (asteroide chegou) */}
          {impactou && (
            <g transform={`translate(${px} ${py})`} className="cc-boom">
              <circle className="cc-boom-flash" r="120" fill="url(#boomGrad)" />
              <circle className="cc-boom-core"  r="64"  fill="url(#boomGrad)" />
              <circle className="cc-boom-ring"     r="30" fill="none" stroke="var(--danger)" strokeWidth="5" />
              <circle className="cc-boom-ring r2"  r="30" fill="none" stroke="var(--accent)" strokeWidth="3" />
              <circle className="cc-boom-ring r3"  r="30" fill="none" stroke="#fff" strokeWidth="2" />
              {[[-40, -20, 26], [38, -28, 22], [-30, 30, 24], [44, 24, 20], [0, -48, 22], [8, 44, 24]].map(([sx, sy, sr], i) => (
                <circle key={'sm' + i} className="cc-boom-smoke" cx={sx} cy={sy} r={sr}
                  fill="rgba(40,46,58,0.55)"
                  style={{ '--sx': `${sx * 1.7}px`, '--sy': `${sy * 1.7}px` } as React.CSSProperties} />
              ))}
              {[0, 30, 60, 90, 120, 150, 180, 210, 240, 270, 300, 330].map((a, i) => (
                <rect key={'db' + a} className="cc-boom-debris" x="-5" y="-5"
                  width={i % 3 === 0 ? 11 : 7} height={i % 3 === 0 ? 11 : 7} rx="2"
                  fill={i % 3 === 0 ? 'var(--danger)' : i % 3 === 1 ? 'var(--accent)' : '#3a4a6b'}
                  transform={`rotate(${a * 1.3})`}
                  style={{
                    '--dx': `${Math.cos(a * Math.PI / 180) * (110 + (i % 4) * 22)}px`,
                    '--dy': `${Math.sin(a * Math.PI / 180) * (110 + (i % 4) * 22)}px`,
                  } as React.CSSProperties} />
              ))}
            </g>
          )}
        </>
      )}
    </svg>
  )
}
