'use client'
import { useState, useEffect } from 'react'

const BETTING_MS = 10_000
const R = 58
const C = 2 * Math.PI * R

interface Props {
  encerraEm: Date | null
}

export function CountdownOverlay({ encerraEm }: Props) {
  const [now, setNow] = useState(Date.now())

  useEffect(() => {
    let raf: number
    const tick = () => { setNow(Date.now()); raf = requestAnimationFrame(tick) }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [])

  const remain = encerraEm ? Math.max(0, encerraEm.getTime() - now) : 0
  const frac = Math.max(0, Math.min(1, remain / BETTING_MS))

  return (
    <div className="betting-overlay">
      <div className="count-ring">
        <svg viewBox="0 0 132 132">
          <circle className="track" cx="66" cy="66" r={R} />
          <circle
            className="prog" cx="66" cy="66" r={R}
            strokeDasharray={C}
            strokeDashoffset={C * (1 - frac)}
          />
        </svg>
        <div className="count-num">{(remain / 1000).toFixed(1)}</div>
      </div>
      <div className="betting-label">Faça sua aposta</div>
    </div>
  )
}
