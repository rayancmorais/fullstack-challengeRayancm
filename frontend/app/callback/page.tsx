'use client'
import { useEffect } from 'react'
import { useAuth } from 'react-oidc-context'
import { useRouter } from 'next/navigation'

export default function CallbackPage() {
  const { isLoading, isAuthenticated, error } = useAuth()
  const router = useRouter()

  useEffect(() => {
    if (!isLoading && isAuthenticated) router.replace('/')
    if (!isLoading && error) router.replace('/')
  }, [isLoading, isAuthenticated, error, router])

  return (
    <div className="app">
      <div className="bg-ambient" />
      <div style={{ flex: 1, display: 'grid', placeItems: 'center' }}>
        <div style={{ textAlign: 'center' }}>
          <div className="spinner" style={{ margin: '0 auto 20px' }} />
          <p className="mono" style={{ color: 'var(--fg-3)', letterSpacing: '0.2em', textTransform: 'uppercase', fontSize: 12 }}>
            {error ? 'Erro na autenticação…' : 'Autenticando…'}
          </p>
        </div>
      </div>
    </div>
  )
}
