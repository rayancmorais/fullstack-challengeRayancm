'use client'
import { useEffect, useRef } from 'react'
import { useGameStore } from '@/store/game'
import { Sound } from '@/lib/sound'

export function useSonsDoJogo() {
  const fase = useGameStore(s => s.fase)
  const prevFase = useRef(fase)

  useEffect(() => {
    const prev = prevFase.current
    const curr = fase

    if (curr === 'RODANDO' && prev !== 'RODANDO') {
      Sound.iniciarSubida()
    }

    if (prev === 'RODANDO' && curr !== 'RODANDO') {
      Sound.tocarExplosao()
    }

    prevFase.current = curr
  }, [fase])

  useEffect(() => () => { Sound.pararSubida() }, [])
}
