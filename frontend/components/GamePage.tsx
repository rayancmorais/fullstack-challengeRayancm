'use client'
import { useState, useEffect, useCallback, useRef } from 'react'
import { useAuth } from 'react-oidc-context'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useGameStore } from '@/store/game'
import { useGameSocket } from '@/hooks/useGameSocket'
import { Topbar } from './Topbar'
import { Stage } from './Stage'
import { HistoryRail } from './HistoryRail'
import { BetControls } from './BetControls'
import { BetsList } from './BetsList'
import { SessionStats } from './SessionStats'
import { Toasts } from './Toasts'
import { FairModal } from './FairModal'
import { placeBet, cashout, getWallet, getCurrentRound, getRoundHistory, createWallet } from '@/lib/api'
import { centavosParaReais } from '@/lib/utils'
import type { Stats } from './SessionStats'

export function GamePage() {
  const auth = useAuth()

  // Redirect to Keycloak if not authenticated
  useEffect(() => {
    if (!auth.isLoading && !auth.isAuthenticated) {
      auth.signinRedirect()
    }
  }, [auth.isLoading, auth.isAuthenticated, auth])

  if (auth.isLoading) return <BootScreen label="Carregando sessão…" />
  if (!auth.isAuthenticated) return <BootScreen label="Redirecionando para login…" />

  return <Game />
}

function Game() {
  const auth = useAuth()
  const qc = useQueryClient()
  const store = useGameStore()
  useGameSocket()

  const token = auth.user?.access_token || ''
  const playerJogadorId = auth.user?.profile.sub || ''
  const username = (auth.user?.profile.preferred_username as string) || 'jogador'

  const [showFair, setShowFair] = useState(false)
  const [cashFlash, setCashFlash] = useState(0)
  const [auto, setAuto] = useState(false)
  const [autoTarget, setAutoTarget] = useState(2.0)
  const [stats, setStats] = useState<Stats>({ pnl: 0, rodadas: 0, melhorSaque: 0, totalApostado: 0 })
  const autoRef = useRef({ auto, autoTarget })
  autoRef.current = { auto, autoTarget }

  // Wallet query
  const { data: wallet, refetch: refetchWallet } = useQuery({
    queryKey: ['wallet'],
    queryFn: async () => {
      try { return await getWallet(token) }
      catch { return await createWallet(token) }
    },
    enabled: !!token,
    refetchInterval: 8_000,
  })

  const saldo = wallet ? Number(wallet.saldo) : 0

  // Seed initial round state from REST
  useEffect(() => {
    if (!token) return
    Promise.all([getCurrentRound(), getRoundHistory()])
      .then(([round, history]) => {
        store.setFromCurrentRound(round)
        store.setHistorico(history.map(r => ({ rodadaId: r.id, pontoCrash: r.pontoCrash })))
      })
      .catch(() => {})
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token])

  const playerBet = store.apostas.find(a => a.jogadorId === playerJogadorId) || null

  // Auto cashout trigger
  useEffect(() => {
    const { auto, autoTarget } = autoRef.current
    if (!auto) return
    if (!playerBet || playerBet.status !== 'PENDENTE') return
    if (store.fase !== 'RODANDO') return
    if (store.multiplicador >= autoTarget) {
      handleCashOut()
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [store.multiplicador])

  const handleBet = useCallback(async (centavos: number) => {
    try {
      await placeBet(centavos, token)
      setStats(s => ({ ...s, pnl: s.pnl - centavos, totalApostado: s.totalApostado + centavos }))
      store.pushToast('success', 'Aposta confirmada', `R$ ${centavosParaReais(centavos)} na rodada atual.`)
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Erro ao apostar'
      store.pushToast('error', 'Aposta rejeitada', msg)
    }
  }, [token, store])

  const handleCancel = useCallback(async () => {
    if (!playerBet) return
    // No backend endpoint for cancel — remove from local state only (bet will be cancelled via RabbitMQ on debit.failed)
    store.pushToast('info', 'Aguardando confirmação', 'O cancelamento depende da confirmação do débito.')
  }, [playerBet, store])

  const handleCashOut = useCallback(async () => {
    try {
      const result = await cashout(token)
      const pago = Number(result.valorCentavos)
      setCashFlash(pago)
      setTimeout(() => setCashFlash(0), 1800)
      await refetchWallet()
      qc.invalidateQueries({ queryKey: ['wallet'] })
      const mult = playerBet?.multiplicadorSaque || store.multiplicador
      setStats(s => ({
        ...s,
        pnl: s.pnl + pago,
        melhorSaque: Math.max(s.melhorSaque, mult),
        rodadas: s.rodadas + 1,
      }))
      store.pushToast('gold', `Sacou em ${mult.toFixed(2)}×`, `+ R$ ${centavosParaReais(pago)} creditado.`)
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Erro ao sacar'
      store.pushToast('error', 'Não foi possível sacar', msg)
    }
  }, [token, playerBet, store, refetchWallet, qc])

  // Track round completions for stats
  const prevFase = useRef(store.fase)
  useEffect(() => {
    if (store.fase === 'CRASHADO' && prevFase.current === 'RODANDO') {
      if (playerBet && playerBet.status === 'PERDEU') {
        setStats(s => ({ ...s, rodadas: s.rodadas + 1 }))
        store.pushToast('error', `Crash em ${store.pontoCrash?.toFixed(2)}×`, `Você perdeu R$ ${centavosParaReais(playerBet.valorCentavos)}.`)
      }
    }
    prevFase.current = store.fase
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
            onBet={handleBet}
            onCancel={handleCancel}
            onCashOut={handleCashOut}
          />
        </div>

        <div className="side-col">
          <SessionStats stats={stats} />
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
