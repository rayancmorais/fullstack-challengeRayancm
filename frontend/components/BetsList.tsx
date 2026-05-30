'use client'
import { useMemo } from 'react'
import { fmt, initials, centavosParaReais } from '@/lib/utils'
import type { BetEntry, GamePhase } from '@/store/game'

const IconUsers = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ width: 14, height: 14, color: 'var(--accent)' }}>
    <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
    <circle cx="9" cy="7" r="4"/>
    <path d="M23 21v-2a4 4 0 0 0-3-3.87"/>
  </svg>
)

interface Props {
  apostas: BetEntry[]
  phase: GamePhase | null
  playerJogadorId: string
}

export function BetsList({ apostas, phase, playerJogadorId }: Props) {
  const sorted = useMemo(() => {
    const rank = (a: BetEntry) => (a.status === 'SACOU' ? 2 : a.status === 'PENDENTE' ? 1 : 0)
    return [...apostas].sort((a, b) => {
      if (a.jogadorId === playerJogadorId) return -1
      if (b.jogadorId === playerJogadorId) return 1
      if (rank(b) !== rank(a)) return rank(b) - rank(a)
      return b.valorCentavos - a.valorCentavos
    })
  }, [apostas, playerJogadorId])

  const total = apostas.reduce((s, b) => s + b.valorCentavos, 0)
  const wonCount = apostas.filter(b => b.status === 'SACOU').length

  return (
    <div className="card card-pad">
      <div className="card-title">
        <h3><IconUsers /> Apostas da rodada</h3>
        <span className="hint">{apostas.length} jogadores</span>
      </div>
      <div className="bets-summary" style={{ marginBottom: 12 }}>
        <span>Total apostado <b className="mono">R$ {centavosParaReais(total)}</b></span>
        <span>Sacaram <b className="mono">{wonCount}</b></span>
      </div>
      <div className="bets-list">
        {apostas.length === 0
          ? [...Array(5)].map((_, i) => (
              <div key={i} className="bet-row" style={{ opacity: 0.5 }}>
                <div className="skel" style={{ width: 26, height: 26, borderRadius: 50 }} />
                <div className="skel" style={{ height: 12, width: '60%' }} />
                <div className="skel" style={{ height: 12, width: 44 }} />
                <div className="skel" style={{ height: 18, width: 48, borderRadius: 100 }} />
              </div>
            ))
          : sorted.map(b => {
              const isMe = b.jogadorId === playerJogadorId
              const won = b.status === 'SACOU'
              return (
                <div key={b.jogadorId} className={`bet-row ${isMe ? 'you' : ''} ${won ? 'won' : ''}`}>
                  <div className="ava">{initials(b.nomeUsuario)}</div>
                  <div className="nm">
                    {b.nomeUsuario}
                    {isMe && <span className="me">VOCÊ</span>}
                  </div>
                  <div className="amt">R$ {fmt(b.valorCentavos / 100)}</div>
                  {won ? (
                    <div className="mult-tag won">
                      {b.multiplicadorSaque?.toFixed(2)}× · +{fmt((b.pagamentoCentavos || 0) / 100)}
                    </div>
                  ) : b.status === 'PERDEU' ? (
                    <div className="mult-tag lost">perdeu</div>
                  ) : (
                    <div className="mult-tag placed">
                      {phase === 'RODANDO' ? 'em jogo' : 'apostou'}
                    </div>
                  )}
                </div>
              )
            })}
      </div>
    </div>
  )
}
