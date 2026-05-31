'use client'
import { useMemo } from 'react'
import { fmt, centavosParaReais, parseBrazilian } from '@/lib/utils'

export interface AutoBetCfg {
  base: number       // centavos
  target: number     // multiplicador do cashout alvo (ex: 2.0 = 2×)
  strategy: 'fixed' | 'martingale'
  onLoss: number     // fator de multiplicação na perda (Martingale)
  rounds: number     // 0 = infinito
  stopLoss: number   // centavos (0 = desativado)
  stopWin: number    // centavos (0 = desativado)
}

export interface AutoBetRuntime {
  active: boolean
  nextStake: number   // centavos
  pnl: number         // centavos (pode ser negativo)
  roundsLeft: number  // pode ser Infinity
}

interface Props {
  cfg: AutoBetCfg
  setCfg: (cfg: AutoBetCfg) => void
  running: boolean
  runtime: AutoBetRuntime
  onToggle: () => void
  saldo: number
}

const MIN_CENTAVOS = 100
const MAX_CENTAVOS = 100_000

export function AutoBetPanel({ cfg, setCfg, running, runtime, onToggle, saldo }: Props) {
  const set = <K extends keyof AutoBetCfg>(k: K, v: AutoBetCfg[K]) =>
    setCfg({ ...cfg, [k]: v })

  const parseNum = (v: string, fb: number) => {
    const n = parseFloat(parseBrazilian(v).toString())
    return isNaN(n) ? fb : n
  }

  const baseErr = useMemo(() => {
    if (cfg.base < MIN_CENTAVOS) return `mín ${centavosParaReais(MIN_CENTAVOS)}`
    if (cfg.base > MAX_CENTAVOS) return `máx ${centavosParaReais(MAX_CENTAVOS)}`
    if (cfg.base > saldo) return 'sem saldo'
    return ''
  }, [cfg.base, saldo])

  const pnlPos = runtime.pnl >= 0
  const rodadasStr = runtime.roundsLeft === Infinity ? '∞' : String(runtime.roundsLeft)

  return (
    <div className="card card-pad">
      <div className="card-title">
        <h3>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
            <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" />
          </svg>
          Auto-bet
        </h3>
        <span className="hint">
          {running ? `rodando · ${rodadasStr}` : 'estratégia'}
        </span>
      </div>

      {/* Seletor de estratégia */}
      <div className="seg" style={{ marginBottom: 14 }}>
        {([['fixed', 'Valor fixo'], ['martingale', 'Martingale']] as const).map(([k, l]) => (
          <button
            key={k}
            className={`seg-btn ${cfg.strategy === k ? 'on' : ''}`}
            disabled={running}
            onClick={() => set('strategy', k)}
          >
            {l}
          </button>
        ))}
      </div>

      {/* Grade de campos */}
      <div className="ab-grid">
        <div className="ab-field">
          <label>Aposta base</label>
          <div className={`mini-input ${baseErr ? 'invalid' : ''}`}>
            <span className="cur">R$</span>
            <input
              inputMode="decimal"
              disabled={running}
              value={fmt(cfg.base / 100)}
              onChange={e => set('base', Math.round(parseNum(e.target.value, cfg.base / 100) * 100))}
            />
          </div>
          {baseErr && <div className="ab-hint err">{baseErr}</div>}
        </div>

        <div className="ab-field">
          <label>Cash out alvo</label>
          <div className="mini-input">
            <input
              inputMode="decimal"
              disabled={running}
              value={cfg.target.toFixed(2)}
              onChange={e => {
                const v = parseFloat(e.target.value.replace(',', '.'))
                if (!isNaN(v)) set('target', Math.max(1.01, v))
              }}
            />
            <span className="cur" style={{ paddingLeft: 0, paddingRight: 6 }}>×</span>
          </div>
        </div>

        {cfg.strategy === 'martingale' && (
          <div className="ab-field">
            <label>Multipl. na perda</label>
            <div className="mini-input">
              <input
                inputMode="decimal"
                disabled={running}
                value={cfg.onLoss.toFixed(2)}
                onChange={e => {
                  const v = parseFloat(e.target.value.replace(',', '.'))
                  if (!isNaN(v)) set('onLoss', Math.max(1, v))
                }}
              />
              <span className="cur" style={{ paddingLeft: 0, paddingRight: 6 }}>×</span>
            </div>
          </div>
        )}

        <div className="ab-field">
          <label>Rodadas {cfg.rounds === 0 ? '(∞)' : ''}</label>
          <div className="mini-input">
            <input
              inputMode="numeric"
              disabled={running}
              value={cfg.rounds}
              onChange={e => {
                const v = parseInt(e.target.value)
                set('rounds', isNaN(v) ? 0 : Math.max(0, v))
              }}
            />
          </div>
        </div>

        <div className="ab-field">
          <label>Stop-loss</label>
          <div className="mini-input">
            <span className="cur">R$</span>
            <input
              inputMode="decimal"
              disabled={running}
              value={cfg.stopLoss === 0 ? '0,00' : fmt(cfg.stopLoss / 100)}
              onChange={e => set('stopLoss', Math.max(0, Math.round(parseNum(e.target.value, 0) * 100)))}
            />
          </div>
        </div>

        <div className="ab-field">
          <label>Stop-win</label>
          <div className="mini-input">
            <span className="cur">R$</span>
            <input
              inputMode="decimal"
              disabled={running}
              value={cfg.stopWin === 0 ? '0,00' : fmt(cfg.stopWin / 100)}
              onChange={e => set('stopWin', Math.max(0, Math.round(parseNum(e.target.value, 0) * 100)))}
            />
          </div>
        </div>
      </div>

      {/* Linha de status da sessão */}
      {running && (
        <div className="ab-runline">
          <span>Sessão</span>
          <span className={`mono ${pnlPos ? 'pos' : 'neg'}`}>
            {pnlPos ? '+' : '−'} R$ {centavosParaReais(Math.abs(runtime.pnl))}
          </span>
          <span className="mono" style={{ color: 'var(--fg-4)' }}>
            próx. R$ {centavosParaReais(runtime.nextStake)}
          </span>
        </div>
      )}

      {/* Botão iniciar/parar */}
      <button
        className={`ab-toggle ${running ? 'stop' : 'start'}`}
        disabled={!running && !!baseErr}
        onClick={onToggle}
      >
        {running ? 'Parar auto-bet' : 'Iniciar auto-bet'}
      </button>

      <p className="ab-note">
        {cfg.strategy === 'martingale'
          ? 'Martingale dobra a aposta após cada perda e reseta ao ganhar. Alto risco.'
          : 'Aposta o mesmo valor a cada rodada com saque automático no alvo.'}
      </p>
    </div>
  )
}
