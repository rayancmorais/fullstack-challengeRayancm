'use client'
import { useState, useRef, useEffect } from 'react'
import { CrashGraph } from './CrashGraph'
import { CountdownOverlay } from './CountdownOverlay'
import { fmt } from '@/lib/utils'
import type { GamePhase } from '@/store/game'

const IconShield = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ width: 11, height: 11, verticalAlign: -1, marginRight: 4 }}>
    <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
  </svg>
)

interface Props {
  phase: GamePhase | null
  multiplier: number
  hashSeedServidor: string | null
  encerraEm: Date | null
  rodadaId: string | null
  cashFlash: number
  onOpenFair: () => void
}

export function Stage({ phase, multiplier, hashSeedServidor, encerraEm, rodadaId, cashFlash, onOpenFair }: Props) {
  const [shakeKey, setShakeKey] = useState(0)
  const prevPhase = useRef(phase)

  useEffect(() => {
    if (phase === 'CRASHADO' && prevPhase.current === 'RODANDO') setShakeKey(k => k + 1)
    prevPhase.current = phase
  }, [phase])

  const running = phase === 'RODANDO'
  const crashed = phase === 'CRASHADO'
  const betting = phase === 'APOSTAS_ABERTAS'

  return (
    <div className={`stage ${crashed ? 'is-crashed flash-crash' : ''}`} key={shakeKey}>
      <button className="fair-badge" onClick={onOpenFair} title="Provably fair — verificar">
        <span className="dot" />
        <span className="txt">
          <IconShield />
          SEED <span className="hash">{hashSeedServidor ? hashSeedServidor.slice(0, 10) + '…' : '——'}</span>
        </span>
      </button>

      <div className="live-badge">
        <span className={`pulse ${betting ? 'betting' : ''}`} />
        <span className="txt">
          {betting ? 'Apostas' : running ? 'Ao vivo' : rodadaId ? `Rodada` : '—'}
        </span>
      </div>

      <CrashGraph phase={phase} multiplier={multiplier} />

      {betting ? (
        <CountdownOverlay encerraEm={encerraEm} />
      ) : (
        <div className="mult-readout">
          <div className={`mult-value ${running ? 'running' : ''} ${crashed ? 'crashed' : ''}`}>
            {multiplier.toFixed(2)}<span style={{ fontSize: '0.5em' }}>×</span>
          </div>
          <div className={`mult-caption ${crashed ? 'crashed' : ''}`}>
            {crashed ? 'Crash!' : running ? 'Subindo' : '—'}
          </div>
          {cashFlash > 0 && running && (
            <div className="cashout-flash">+ R$ {fmt(cashFlash / 100)} sacado!</div>
          )}
        </div>
      )}
    </div>
  )
}
