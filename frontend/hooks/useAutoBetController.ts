'use client'
import { useState, useRef, useCallback, useReducer } from 'react'
import { useGameStore } from '@/store/game'
import { centavosParaReais } from '@/lib/utils'
import { useGameStats } from './useGameStats'
import type { AutoBetCfg } from '@/components/AutoBetPanel'

interface Runtime {
  active:     boolean
  nextStake:  number
  pnl:        number
  roundsLeft: number | typeof Infinity
}

interface AutoBetController {
  cfg:           AutoBetCfg
  setCfg:        React.Dispatch<React.SetStateAction<AutoBetCfg>>
  abRef:         React.MutableRefObject<AutoBetCfg>
  abRun:         React.MutableRefObject<Runtime>
  stopAutoBet:   (motivo?: string) => void
  startAutoBet:  () => void
  toggleAutoBet: () => void
  resolveAutoBet: (bet: {
    status: string
    valorCentavos: number
    pagamentoCentavos?: number
    multiplicadorSaque?: number
  }) => void
}

const CFG_PADRAO: AutoBetCfg = {
  base:     1000,
  target:   2.0,
  strategy: 'fixed',
  onLoss:   2.0,
  rounds:   0,
  stopLoss: 0,
  stopWin:  0,
}

export function useAutoBetController(
  saldoRef:     React.MutableRefObject<number>,
  refetchWallet: () => void,
  regSaque:     (pago: number, mult: number) => void,
  handleBet:    (centavos: number, alvo: number, quiet: boolean) => void,
): AutoBetController {
  const store = useGameStore()

  const [cfg, setCfg] = useState<AutoBetCfg>(CFG_PADRAO)
  const abRef         = useRef(cfg)
  abRef.current       = cfg

  const abRun = useRef<Runtime>({
    active:     false,
    nextStake:  CFG_PADRAO.base,
    pnl:        0,
    roundsLeft: Infinity,
  })
  const [, dispararRender] = useReducer((n: number) => n + 1, 0)

  const stopAutoBet = useCallback((motivo?: string) => {
    if (!abRun.current.active) return
    const pnl = abRun.current.pnl
    abRun.current.active = false
    dispararRender()
    store.pushToast(
      motivo ? 'error' : 'info',
      'Auto-bet encerrado',
      `${motivo ? motivo + ' ' : ''}Resultado: ${pnl >= 0 ? '+' : '−'} R$ ${centavosParaReais(Math.abs(pnl))}.`,
    )
  }, [store])

  const resolveAutoBet = useCallback((bet: {
    status: string
    valorCentavos: number
    pagamentoCentavos?: number
    multiplicadorSaque?: number
  }) => {
    const c      = abRef.current
    const r      = abRun.current
    const ganhou = bet.status === 'SACOU'

    r.pnl += ganhou ? (bet.pagamentoCentavos ?? 0) - bet.valorCentavos : -bet.valorCentavos
    r.nextStake = ganhou
      ? c.base
      : c.strategy === 'martingale'
        ? Math.min(Math.round(bet.valorCentavos * c.onLoss), 100_000)
        : c.base
    r.roundsLeft = r.roundsLeft === Infinity ? Infinity : (r.roundsLeft as number) - 1
    dispararRender()

    if (ganhou) {
      regSaque(bet.pagamentoCentavos ?? 0, bet.multiplicadorSaque ?? 1)
      refetchWallet()
    }

    if ((r.roundsLeft as number) <= 0)          { stopAutoBet('Rodadas concluídas.'); return }
    if (c.stopWin  > 0 && r.pnl >= c.stopWin)   { stopAutoBet('Stop-win atingido.');  return }
    if (c.stopLoss > 0 && r.pnl <= -c.stopLoss)  { stopAutoBet('Stop-loss atingido.'); return }
    if (r.nextStake > saldoRef.current)           { stopAutoBet('Saldo insuficiente.'); return }
  }, [stopAutoBet, refetchWallet, regSaque, saldoRef])

  const startAutoBet = useCallback(() => {
    const c = abRef.current
    abRun.current = {
      active:     true,
      nextStake:  c.base,
      pnl:        0,
      roundsLeft: c.rounds > 0 ? c.rounds : Infinity,
    }
    dispararRender()
    store.pushToast(
      'info',
      'Auto-bet iniciado',
      `${c.strategy === 'martingale' ? 'Martingale' : 'Valor fixo'} · R$ ${centavosParaReais(c.base)} @ ${c.target.toFixed(2)}×`,
    )
  }, [store])

  const toggleAutoBet = useCallback(() => {
    if (abRun.current.active) stopAutoBet()
    else startAutoBet()
  }, [startAutoBet, stopAutoBet])

  return { cfg, setCfg, abRef, abRun, stopAutoBet, startAutoBet, toggleAutoBet, resolveAutoBet }
}
