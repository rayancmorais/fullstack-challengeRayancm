'use client'
import { useEffect, useRef } from 'react'
import { io, Socket } from 'socket.io-client'
import { useGameStore } from '@/store/game'

const WS_URL = process.env.NEXT_PUBLIC_WS_URL || 'http://localhost:4001'

export function useGameSocket() {
  const store = useGameStore()
  const socketRef = useRef<Socket | null>(null)

  useEffect(() => {
    if (socketRef.current) return

    const socket = io(`${WS_URL}/jogo`, {
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionDelay: 1000,
      reconnectionAttempts: Infinity,
    })

    socket.on('rodada:apostas', store.setFaseApostas)
    socket.on('rodada:iniciada', store.setRodandoIniciada)
    socket.on('rodada:tick', ({ multiplicador }: { multiplicador: number }) => store.setTick(multiplicador))
    socket.on('rodada:crash', store.setCrash)
    socket.on('aposta:registrada', store.addAposta)
    socket.on('aposta:saque', store.setSaque)
    socket.on('aposta:cancelada', ({ jogadorId }: { jogadorId: string }) => store.cancelarAposta(jogadorId))

    socketRef.current = socket
    return () => {
      socket.disconnect()
      socketRef.current = null
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return socketRef.current
}
