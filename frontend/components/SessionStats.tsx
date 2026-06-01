'use client'
import { fmt } from '@/lib/utils'
import type { Stats } from '@/hooks/useGameStats'

const IconCoins = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ width: 14, height: 14, color: 'var(--accent)' }}>
    <circle cx="8" cy="8" r="6"/>
    <path d="M18.09 10.37A6 6 0 1 1 10.34 18"/>
    <path d="M7 6h1v4"/>
    <path d="m16.71 13.88.7.71-2.82 2.82"/>
  </svg>
)

interface Props {
  stats: Stats
}

export function SessionStats({ stats }: Props) {
  return (
    <div className="card card-pad">
      <div className="card-title">
        <h3><IconCoins /> Sua sessão</h3>
      </div>
      <div className="stat-grid">
        <div className="stat-box">
          <div className="k">Lucro / Prejuízo</div>
          <div className={`v ${stats.pnl >= 0 ? 'pos' : 'neg'}`}>
            {stats.pnl >= 0 ? '+' : '−'}R$ {fmt(Math.abs(stats.pnl) / 100)}
          </div>
        </div>
        <div className="stat-box">
          <div className="k">Rodadas</div>
          <div className="v">{stats.rodadas}</div>
        </div>
        <div className="stat-box">
          <div className="k">Melhor saque</div>
          <div className="v pos">{stats.melhorSaque > 0 ? stats.melhorSaque.toFixed(2) + '×' : '—'}</div>
        </div>
        <div className="stat-box">
          <div className="k">Total apostado</div>
          <div className="v">R$ {fmt(stats.totalApostado / 100)}</div>
        </div>
      </div>
    </div>
  )
}
