'use client'
import { useEffect, useRef } from 'react'
import { useGameStore } from '@/store/game'
import { Sound } from '@/lib/sound'

const NOMES = [
  'luan_fps', 'marina.07', 'CryptoKai', 'vipera', 'MaverickBR',
  'luma_neon', 'ghost_br', 'thalles99', 'Kobra', 'pixelwolf',
]

interface Bot {
  jogadorId: string
  nomeUsuario: string
  valorCentavos: number
  alvo: number   // multiplicador de cashout; Infinity = perde
}

function rnd(min: number, max: number) {
  return Math.floor(Math.random() * (max - min + 1)) + min
}

export function useBots() {
  const store = useGameStore()

  // timers agendados para esta fase de apostas
  const timers   = useRef<ReturnType<typeof setTimeout>[]>([])
  // bots desta rodada — mutável sem causar re-renders
  const bots     = useRef<Bot[]>([])
  // rodadaId capturado quando a fase de apostas abre
  const rodadaId = useRef('')
  const prevFase = useRef(store.fase)

  function limpar() {
    timers.current.forEach(clearTimeout)
    timers.current = []
    bots.current   = []
  }

  // ── Watcher de fase ─────────────────────────────────────────────────────────
  useEffect(() => {
    const prev = prevFase.current
    const curr = store.fase

    if (curr === 'APOSTAS_ABERTAS' && prev !== 'APOSTAS_ABERTAS') {
      limpar()
      rodadaId.current = store.rodadaId ?? ''

      // 5 a 10 bots por rodada
      const qtd    = rnd(5, 10)
      const nomes  = [...NOMES].sort(() => Math.random() - 0.5).slice(0, qtd)

      nomes.forEach(nome => {
        // Aparece entre 300ms e 8500ms dentro da janela de 10s de apostas
        const delay = rnd(300, 8500)
        // Valor arredondado a R$1 (parece mais humano do que centavos quebrados)
        const valor = Math.round(rnd(500, 15000) / 100) * 100
        // 62% de chance de ter alvo de cashout entre 1.15× e 8×
        const alvo  = Math.random() < 0.62
          ? parseFloat((Math.random() * 6.85 + 1.15).toFixed(2))
          : Infinity

        const bot: Bot = { jogadorId: `bot-${nome}`, nomeUsuario: nome, valorCentavos: valor, alvo }

        const t = setTimeout(() => {
          // Guarda de corrida: não adicionar se a fase já mudou
          const { fase, rodadaId: rid } = useGameStore.getState()
          if (fase !== 'APOSTAS_ABERTAS' || rid !== rodadaId.current) return

          bots.current.push(bot)
          store.addAposta({
            rodadaId: rodadaId.current,
            jogadorId: bot.jogadorId,
            nomeUsuario: nome,
            valorCentavos: valor.toString(),
          })
          Sound.bet()
        }, delay)

        timers.current.push(t)
      })
    }

    prevFase.current = curr
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [store.fase])

  // ── Watcher de tick — cashouts dos bots ─────────────────────────────────────
  useEffect(() => {
    if (store.fase !== 'RODANDO') return

    bots.current.forEach(bot => {
      if (bot.alvo !== Infinity && store.multiplicador >= bot.alvo) {
        const pago = Math.round(bot.valorCentavos * bot.alvo)
        store.setSaque({
          rodadaId: rodadaId.current,
          jogadorId: bot.jogadorId,
          pagamentoCentavos: pago.toString(),
          multiplicador: bot.alvo,
        })
        Sound.cashout()
        bot.alvo = Infinity   // marca como processado
      }
    })
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [store.multiplicador])

  // Cleanup ao desmontar
  useEffect(() => () => { limpar() }, [])
}
