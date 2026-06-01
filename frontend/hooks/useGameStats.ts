'use client'
import { useState } from 'react'

export interface Stats {
  pnl:           number
  rodadas:       number
  melhorSaque:   number
  totalApostado: number
}

export function useGameStats() {
  const [stats, setStats] = useState<Stats>({
    pnl: 0, rodadas: 0, melhorSaque: 0, totalApostado: 0,
  })

  const registrarAposta = (centavos: number) =>
    setStats(s => ({ ...s, totalApostado: s.totalApostado + centavos }))

  const registrarSaque = (lucroCentavos: number, multiplicadorSaque: number) =>
    setStats(s => ({
      ...s,
      pnl:         s.pnl + lucroCentavos,
      melhorSaque: Math.max(s.melhorSaque, multiplicadorSaque),
      rodadas:     s.rodadas + 1,
    }))

  const registrarPerda = (centavos: number) =>
    setStats(s => ({ ...s, pnl: s.pnl - centavos, rodadas: s.rodadas + 1 }))

  return { stats, registrarAposta, registrarSaque, registrarPerda }
}
