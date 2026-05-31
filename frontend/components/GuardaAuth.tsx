'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useAuthStore } from '@/store/auth'

export function GuardaAuth({ children }: { children: React.ReactNode }) {
  const autenticado = useAuthStore(s => s.autenticado)
  const router      = useRouter()
  const [hidratado, setHidratado] = useState(false)

  // aguarda o Zustand persist terminar de ler o sessionStorage
  useEffect(() => {
    if (useAuthStore.persist.hasHydrated()) {
      setHidratado(true)
      return
    }
    const unsub = useAuthStore.persist.onFinishHydration(() => setHidratado(true))
    return unsub
  }, [])

  useEffect(() => {
    if (hidratado && !autenticado) router.replace('/login')
  }, [hidratado, autenticado, router])

  if (!hidratado) return (
    <div className="app">
      <div className="bg-ambient" />
      <div style={{ flex: 1, display: 'grid', placeItems: 'center' }}>
        <div className="spinner" />
      </div>
    </div>
  )

  if (!autenticado) return null

  return <>{children}</>
}
