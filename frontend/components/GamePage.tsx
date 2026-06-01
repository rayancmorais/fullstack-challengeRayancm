'use client'
import { useState, useEffect, useCallback, useRef, useMemo } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useAuthStore } from '@/store/auth'
import { useGameStore } from '@/store/game'
import { useGameSocket } from '@/hooks/useGameSocket'
import { useBots } from '@/hooks/useBots'
import { useSonsDoJogo } from '@/hooks/useSonsDoJogo'
import { useGameStats } from '@/hooks/useGameStats'
import { Topbar } from './Topbar'
import { Stage } from './Stage'
import { HistoryRail } from './HistoryRail'
import { BetControls } from './BetControls'
import { BetsList } from './BetsList'
import { SessionStats } from './SessionStats'
import { Toasts } from './Toasts'
import { FairModal } from './FairModal'
import { AutoBetPanel } from './AutoBetPanel'
import { Leaderboard } from './Leaderboard'
import { placeBet, cashout, getWallet, getCurrentRound, getRoundHistory, createWallet, resetarSaldo } from '@/lib/api'
import { centavosParaReais } from '@/lib/utils'
import { Sound } from '@/lib/sound'
import type { Stats } from '@/hooks/useGameStats'
import type { AutoBetCfg } from './AutoBetPanel'

export function GamePage() {
  // GuardaAuth garante autenticado=true antes de chegar aqui
  return <Game />
}

function Game() {
  const { usuario, tokenValido, sair } = useAuthStore()
  const qc    = useQueryClient()
  const store = useGameStore()
  useGameSocket()
  useBots()
  useSonsDoJogo()

  const playerJogadorId = usuario?.sub      || ''
  const username        = usuario?.username || 'jogador'

  const [showFair, setShowFair] = useState(false)
  const [cashFlash, setCashFlash] = useState(0)

  // auto-cashout manual (toggle no BetControls)
  const [auto, setAuto] = useState(false)
  const [autoTarget, setAutoTarget] = useState(2.0)
  const autoRef = useRef({ auto, autoTarget })
  autoRef.current = { auto, autoTarget }

  const { stats, registrarAposta: regAposta, registrarSaque: regSaque, registrarPerda: regPerda } = useGameStats()

  // ── Auto-bet ──────────────────────────────────────────────────────────────
  const [ab, setAb] = useState<AutoBetCfg>({
    base: 1000,       // R$10,00 em centavos
    target: 2.0,
    strategy: 'fixed',
    onLoss: 2.0,
    rounds: 0,        // 0 = infinito
    stopLoss: 0,
    stopWin: 0,
  })
  const abRef = useRef(ab)
  abRef.current = ab

  // runtime fica em ref para não gerar re-renders no tick (só setAbTick faz render)
  const abRun = useRef({ active: false, nextStake: 1000, pnl: 0, roundsLeft: Infinity })
  const [, setAbTick] = useState(0)
  const [showAutoBet, setShowAutoBet] = useState(false)

  // refs lidas em efeitos sem causarem re-execução desnecessária
  const saldoRef       = useRef(0)
  const playerBetRef   = useRef<ReturnType<(typeof store.apostas)['find']> | null>(null)
  const audioLiberado  = useRef(false)

  const destravarAudio = () => {
    if (audioLiberado.current) return
    audioLiberado.current = true
    Sound.iniciarSubida()
    Sound.pararSubida()
  }

  // Sound
  useEffect(() => { Sound.init() }, [])
  useEffect(() => {
    Sound.on = store.somAtivo
    if (store.somAtivo) {
      Sound.ensure()
      // se estiver em rodada, reinicia a subida ao desmutar
      if (store.fase === 'RODANDO') Sound.iniciarSubida()
    } else {
      // para imediatamente o loop de subida ao mutar
      Sound.pararSubida()
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [store.somAtivo])

  // Wallet
  const { data: wallet, refetch: refetchWallet } = useQuery({
    queryKey: ['wallet'],
    queryFn: async () => {
      const tk = await tokenValido()
      try { return await getWallet(tk) }
      catch { return await createWallet(tk) }
    },
    enabled: !!usuario,
    refetchInterval: 8_000,
  })

  const saldo = wallet ? Number(wallet.saldo) : 0
  saldoRef.current = saldo

  // Seed estado inicial + reset de saldo ao entrar no jogo
  useEffect(() => {
    if (!usuario) return
    tokenValido().then(tk => {
      Promise.all([
        getCurrentRound(),
        getRoundHistory(),
        resetarSaldo(tk).catch(() => {}),  // falha silenciosa se carteira ainda não existe
      ]).then(([round, history]) => {
        store.setFromCurrentRound(round)
        store.setHistorico(history.map(r => ({ rodadaId: r.id, pontoCrash: r.pontoCrash })))
      }).catch(() => {})
    })
  // tokenValido é estável (referência do store Zustand não muda entre renders)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [usuario, tokenValido])

  const playerBet = store.apostas.find(a => a.jogadorId === playerJogadorId) || null
  playerBetRef.current = playerBet

  // campeão da rodada — computado para TODOS os viewers após o crash
  const campeaoDaRodada = useMemo(() => {
    if (store.fase !== 'CRASHADO') return null
    const saques = store.apostas.filter(a => a.status === 'SACOU' && a.multiplicadorSaque != null)
    if (saques.length === 0) return null
    const melhor = saques.reduce((b, a) => (a.multiplicadorSaque! > b.multiplicadorSaque! ? a : b))
    if ((melhor.multiplicadorSaque ?? 0) < 1.5) return null   // só mostra se sacou em pelo menos 1.5×
    return {
      mult:      melhor.multiplicadorSaque!,
      nome:      melhor.nomeUsuario,
      pagamento: melhor.pagamentoCentavos ?? 0,
      eu:        melhor.jogadorId === playerJogadorId,
    }
  }, [store.fase, store.apostas, playerJogadorId])

  // sincroniza sacadoEm no store para AnimacaoAsteroide ler diretamente
  useEffect(() => {
    if (store.fase === 'RODANDO' && playerBet?.status === 'SACOU') {
      store.setSacadoEm(playerBet.multiplicadorSaque ?? null)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [playerBet?.status, playerBet?.multiplicadorSaque, store.fase])

  // ── handleBet ─────────────────────────────────────────────────────────────
  // autoCashoutOverride: se definido, usa esse valor em vez de autoRef.current
  // quiet: suprime toast (usado pelo auto-bet para não poluir notificações)
  const handleBet = useCallback(async (centavos: number, autoCashoutOverride?: number, quiet = false) => {
    destravarAudio()
    try {
      const { auto: autoOn, autoTarget: at } = autoRef.current
      const autoCashout = autoCashoutOverride !== undefined ? autoCashoutOverride : (autoOn ? at : undefined)
      const tk = await tokenValido()
      await placeBet(centavos, tk, autoCashout)
      regAposta(centavos)
      if (!quiet) {
        const sufixo = autoCashout ? ` · auto-cashout em ${autoCashout.toFixed(2)}×` : ''
        store.pushToast('success', 'Aposta confirmada', `R$ ${centavosParaReais(centavos)} na rodada atual.${sufixo}`)
      }
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Erro ao apostar'
      store.pushToast('error', 'Aposta rejeitada', msg)
      // auto-bet: aposta falhou — encerrar sessão para não entrar num loop
      if (abRun.current.active) stopAutoBet('Aposta falhou.')
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tokenValido, store])

  // ── handleCashOut ─────────────────────────────────────────────────────────
  const handleCashOut = useCallback(async () => {
    try {
      const tk = await tokenValido()
      const result = await cashout(tk)
      const pago = Number(result.valorCentavos)
      setCashFlash(pago)
      setTimeout(() => setCashFlash(0), 1800)
      await refetchWallet()
      qc.invalidateQueries({ queryKey: ['wallet'] })
      const mult = playerBetRef.current?.multiplicadorSaque ?? store.multiplicador
      regSaque(pago, mult)
      store.pushToast('gold', `Sacou em ${mult.toFixed(2)}×`, `+ R$ ${centavosParaReais(pago)} creditado.`)
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Erro ao sacar'
      store.pushToast('error', 'Não foi possível sacar', msg)
    }
  }, [tokenValido, store, refetchWallet, qc])

  const handleCancel = useCallback(async () => {
    store.pushToast('info', 'Aguardando confirmação', 'O cancelamento depende da confirmação do débito.')
  }, [store])

  // ── Controlador auto-bet ──────────────────────────────────────────────────

  const stopAutoBet = useCallback((motivo?: string) => {
    if (!abRun.current.active) return
    const pnl = abRun.current.pnl
    abRun.current.active = false
    setAbTick(x => x + 1)
    store.pushToast(
      motivo ? 'error' : 'info',
      'Auto-bet encerrado',
      `${motivo ? motivo + ' ' : ''}Resultado: ${pnl >= 0 ? '+' : '−'} R$ ${centavosParaReais(Math.abs(pnl))}.`,
    )
  }, [store])

  const resolveAutoBet = useCallback((bet: { status: string; valorCentavos: number; pagamentoCentavos?: number; multiplicadorSaque?: number }) => {
    const c = abRef.current
    const r = abRun.current
    const ganhou = bet.status === 'SACOU'
    const roundPnl = ganhou ? (bet.pagamentoCentavos ?? 0) - bet.valorCentavos : -bet.valorCentavos
    r.pnl += roundPnl

    // calcular próxima aposta conforme estratégia
    r.nextStake = ganhou
      ? c.base
      : c.strategy === 'martingale'
        ? Math.min(Math.round(bet.valorCentavos * c.onLoss), 100_000)
        : c.base

    r.roundsLeft = r.roundsLeft === Infinity ? Infinity : r.roundsLeft - 1
    setAbTick(x => x + 1)

    // atualizar stats visuais para vitórias (perdas são atualizadas no useEffect de crash)
    if (ganhou) {
      const mult = bet.multiplicadorSaque ?? 1
      regSaque(bet.pagamentoCentavos ?? 0, mult)
      refetchWallet()
    }

    // verificar condições de parada
    if (r.roundsLeft <= 0) { stopAutoBet('Rodadas concluídas.'); return }
    if (c.stopWin > 0 && r.pnl >= c.stopWin) { stopAutoBet('Stop-win atingido.'); return }
    if (c.stopLoss > 0 && r.pnl <= -c.stopLoss) { stopAutoBet('Stop-loss atingido.'); return }
    if (r.nextStake > saldoRef.current) { stopAutoBet('Saldo insuficiente.'); return }
  }, [stopAutoBet, refetchWallet])

  const startAutoBet = useCallback(() => {
    const c = abRef.current
    abRun.current = {
      active: true,
      nextStake: c.base,
      pnl: 0,
      roundsLeft: c.rounds > 0 ? c.rounds : Infinity,
    }
    setAbTick(x => x + 1)
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

  // ── Watcher de fase ───────────────────────────────────────────────────────
  const prevFase = useRef(store.fase)
  useEffect(() => {
    const prev = prevFase.current
    const curr = store.fase

    // Nova fase de apostas: colocar aposta automática
    if (curr === 'APOSTAS_ABERTAS' && prev !== 'APOSTAS_ABERTAS') {
      if (abRun.current.active && !playerBetRef.current) {
        const stake = abRun.current.nextStake
        if (stake > saldoRef.current) {
          stopAutoBet('Saldo insuficiente para a próxima aposta.')
        } else {
          // pequeno delay — garante que a fase de apostas já abriu no servidor
          setTimeout(() => {
            if (abRun.current.active) {
              handleBet(stake, abRef.current.target, true)
            }
          }, 400)
        }
      }
    }

    // Crash: resolver resultado e registrar estatísticas
    if (curr === 'CRASHADO' && prev === 'RODANDO') {
      const pb = playerBetRef.current
      if (pb) {
        if (pb.status === 'PERDEU') {
          regPerda()
          store.pushToast(
            'error',
            `Crash em ${store.pontoCrash?.toFixed(2)}×`,
            `Você perdeu R$ ${centavosParaReais(pb.valorCentavos)}.`,
          )
        }
        if (abRun.current.active) resolveAutoBet(pb)
      }
    }

    prevFase.current = curr
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [store.fase])

  return (
    <div className="app">
      <div className="bg-ambient" />
      <Topbar username={username} saldo={saldo} />

      <div className="layout">
        <div className="stage-col">
          <HistoryRail historico={store.historico} />
          <Stage
            phase={store.fase}
            multiplier={store.multiplicador}
            hashSeedServidor={store.hashSeedServidor}
            encerraEm={store.encerraEm}
            rodadaId={store.rodadaId}
            cashFlash={cashFlash}
            pagamentoCentavos={playerBet?.pagamentoCentavos ?? 0}
            apostaPerda={store.fase === 'CRASHADO' && playerBet?.status === 'PERDEU' ? playerBet.valorCentavos : 0}
            campeaoDaRodada={campeaoDaRodada}
            onOpenFair={() => setShowFair(true)}
          />
        </div>

        <div className="controls-col">
          <BetControls
            phase={store.fase}
            saldo={saldo}
            playerBet={playerBet}
            multiplicador={store.multiplicador}
            auto={auto}
            autoTarget={autoTarget}
            onAuto={setAuto}
            onAutoTarget={setAutoTarget}
            onBet={centavos => { handleBet(centavos) }}
            onCancel={handleCancel}
            onCashOut={handleCashOut}
          />

          <div style={{ marginTop: 12 }}>
            <button
              className={`ab-show-btn ${showAutoBet ? 'on' : ''}`}
              onClick={() => setShowAutoBet(v => !v)}
            >
              <span>Auto-bet</span>
              <span className="mono" style={{ fontSize: 10, opacity: 0.6 }}>
                {abRun.current.active ? 'rodando' : showAutoBet ? '▲' : '▼'}
              </span>
            </button>
          </div>

          {showAutoBet && (
            <div style={{ marginTop: 10 }}>
              <AutoBetPanel
                cfg={ab}
                setCfg={setAb}
                running={abRun.current.active}
                runtime={abRun.current}
                onToggle={toggleAutoBet}
                saldo={saldo}
              />
            </div>
          )}
        </div>

        <div className="side-col">
          <SessionStats stats={stats} />
          <Leaderboard
            playerJogadorId={playerJogadorId}
            nomeUsuario={username}
            sessionPnl={stats.pnl}
          />
          <BetsList
            apostas={store.apostas}
            phase={store.fase}
            playerJogadorId={playerJogadorId}
          />
        </div>
      </div>

      <Toasts toasts={store.toasts} onDismiss={store.dismissToast} />
      {showFair && (
        <FairModal
          rodadaId={store.rodadaId}
          hashSeedServidor={store.hashSeedServidor}
          seedServidor={store.seedServidor}
          pontoCrash={store.pontoCrash}
          onClose={() => setShowFair(false)}
        />
      )}
    </div>
  )
}

function BootScreen({ label }: { label: string }) {
  return (
    <div className="app">
      <div className="bg-ambient" />
      <div style={{ flex: 1, display: 'grid', placeItems: 'center' }}>
        <div style={{ textAlign: 'center' }}>
          <div className="spinner" style={{ margin: '0 auto 20px' }} />
          <p className="mono" style={{ color: 'var(--fg-3)', letterSpacing: '0.2em', textTransform: 'uppercase', fontSize: 12 }}>{label}</p>
        </div>
      </div>
    </div>
  )
}
