'use client'
import { useState, useMemo } from 'react'
import { fmt, parseBrazilian, centavosParaReais } from '@/lib/utils'
import type { GamePhase, BetEntry } from '@/store/game'

const MIN_CENTAVOS = 100
const MAX_CENTAVOS = 100_000

interface Props {
  phase: GamePhase | null
  saldo: number
  playerBet: BetEntry | null
  multiplicador: number
  auto: boolean
  autoTarget: number
  onAuto: (v: boolean) => void
  onAutoTarget: (v: number) => void
  onBet: (centavos: number) => void
  onCancel: () => void
  onCashOut: () => void
}

export function BetControls({
  phase, saldo, playerBet, multiplicador,
  auto, autoTarget, onAuto, onAutoTarget,
  onBet, onCancel, onCashOut,
}: Props) {
  const [amount, setAmount] = useState('10,00')

  const parsed = useMemo(() => {
    const n = parseBrazilian(amount)
    return isNaN(n) ? 0 : n
  }, [amount])

  const centavos = Math.round(parsed * 100)

  const err = useMemo(() => {
    if (phase !== 'APOSTAS_ABERTAS' || playerBet) return ''
    if (centavos < MIN_CENTAVOS) return `Mínimo R$ 1,00`
    if (centavos > MAX_CENTAVOS) return `Máximo R$ 1.000,00`
    if (centavos > saldo) return 'Saldo insuficiente'
    return ''
  }, [centavos, phase, playerBet, saldo])

  const setAmt = (n: number) => {
    const clamped = Math.max(0, Math.min(MAX_CENTAVOS / 100, n))
    setAmount(fmt(clamped))
  }
  const step = (d: number) => setAmt(parsed + d)

  const betting = phase === 'APOSTAS_ABERTAS'
  const running = phase === 'RODANDO'
  const crashed = phase === 'CRASHADO'
  const canBet = betting && !playerBet && !err && centavos >= MIN_CENTAVOS
  const hasActive = playerBet?.status === 'PENDENTE'
  const cashed = playerBet?.status === 'SACOU'
  const locked = !betting || !!playerBet

  const potential = hasActive && playerBet ? (playerBet.valorCentavos * multiplicador) : 0

  let actionBtn: React.ReactNode
  if (running && hasActive) {
    actionBtn = (
      <button className="action-btn btn-cashout" onClick={onCashOut}>
        <span>Cash Out</span>
        <span className="sub">R$ {centavosParaReais(potential)} · {multiplicador.toFixed(2)}×</span>
      </button>
    )
  } else if (running && cashed) {
    actionBtn = (
      <button className="action-btn btn-placed" disabled>
        <span>Sacou em {playerBet!.multiplicadorSaque?.toFixed(2)}×</span>
        <span className="sub">+ R$ {centavosParaReais(playerBet!.pagamentoCentavos || 0)}</span>
      </button>
    )
  } else if (running) {
    actionBtn = (
      <button className="action-btn btn-waiting" disabled>
        <span>Rodada em andamento</span>
        <span className="sub">aguarde para apostar</span>
      </button>
    )
  } else if (crashed) {
    actionBtn = (
      <button className="action-btn btn-waiting" disabled>
        <span>Próxima rodada</span>
        <span className="sub">preparando…</span>
      </button>
    )
  } else if (betting && playerBet) {
    actionBtn = (
      <button className="action-btn btn-placed" onClick={onCancel}>
        <span>Aposta confirmada · R$ {centavosParaReais(playerBet.valorCentavos)}</span>
        <span className="sub">toque para cancelar</span>
      </button>
    )
  } else {
    actionBtn = (
      <button className="action-btn btn-bet" disabled={!canBet} onClick={() => onBet(centavos)}>
        <span>Apostar</span>
        <span className="sub">
          R$ {fmt(parsed)}
          {auto ? ` · auto ${autoTarget.toFixed(2)}×` : ''}
        </span>
      </button>
    )
  }

  const quickBtns: [string, () => void][] = [
    ['½', () => setAmt(parsed / 2)],
    ['2×', () => setAmt(parsed * 2)],
    ['+10', () => setAmt(parsed + 10)],
    ['+50', () => setAmt(parsed + 50)],
    ['Máx', () => setAmt(Math.min(MAX_CENTAVOS / 100, saldo / 100))],
  ]

  return (
    <div className="card card-pad bet-panel">

      {/* ── 1. Botão principal — em destaque no topo ── */}
      {actionBtn}

      {/* ── 2. Controles de valor + auto cashout ── */}
      <div className="bet-top" style={{ marginTop: 14 }}>
        <div className="field">
          <label>Valor da aposta</label>
          <div className={`amount-input ${err ? 'invalid' : ''}`}>
            <span className="cur">R$</span>
            <input
              inputMode="decimal"
              value={amount}
              disabled={locked}
              onChange={e => setAmount(e.target.value.replace(/[^0-9.,]/g, ''))}
              onBlur={() => setAmt(parsed)}
            />
            <button className="step-btn" disabled={locked} onClick={() => step(-1)}>−</button>
            <button className="step-btn" disabled={locked} onClick={() => step(1)}>+</button>
          </div>
          <div className="err-text">{err}</div>
          <div className="quick-row">
            {quickBtns.map(([l, fn]) => (
              <button key={l} className="quick-btn" disabled={locked} onClick={fn}>{l}</button>
            ))}
          </div>
        </div>

        <div className="field" style={{ flex: '0 1 160px' }}>
          <label>Auto cash out</label>
          <div className="auto-row" style={{ marginBottom: 10 }}>
            <button className={`switch ${auto ? 'on' : ''}`} onClick={() => onAuto(!auto)}>
              <span className="knob" />
            </button>
            <span className="mono" style={{ fontSize: 12, color: auto ? 'var(--accent)' : 'var(--fg-4)' }}>
              {auto ? 'Ativo' : 'Manual'}
            </span>
          </div>
          <div className="amount-input" style={{ opacity: auto ? 1 : 0.5 }}>
            <input
              className="auto-input"
              inputMode="decimal"
              disabled={!auto || !!locked}
              value={autoTarget.toFixed(2)}
              onChange={e => {
                const v = parseFloat(e.target.value.replace(',', '.'))
                if (!isNaN(v)) onAutoTarget(Math.max(1.01, v))
              }}
              style={{ fontSize: 18 }}
            />
            <span className="cur" style={{ paddingRight: 10, paddingLeft: 0 }}>×</span>
          </div>
        </div>
      </div>

      {/* ── 3. Saldo ── */}
      <div className="bet-status">
        <span className="k">SALDO</span>
        <span className="v mono">R$ {centavosParaReais(saldo)}</span>
      </div>
    </div>
  )
}
