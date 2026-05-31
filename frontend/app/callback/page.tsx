'use client'
import { Suspense, useEffect, useRef } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import { useAuthStore } from '@/store/auth'

function ConteudoCallback() {
  const params         = useSearchParams()
  const router         = useRouter()
  const tratarCallback = useAuthStore(s => s.tratarCallback)
  const rodou          = useRef(false)   // guard StrictMode

  const erro  = params.get('error')
  const codigo = params.get('code')
  const estado = params.get('state')

  useEffect(() => {
    if (rodou.current) return
    rodou.current = true

    if (erro || !codigo || !estado) return

    tratarCallback(codigo, estado)
      .then(() => router.replace('/'))
      .catch(() => router.replace('/login?erro=callback'))
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  if (erro) {
    return (
      <div style={{ textAlign: 'center', maxWidth: 360, padding: 24 }}>
        <p className="mono" style={{
          color: 'var(--danger)', letterSpacing: '0.1em',
          textTransform: 'uppercase', fontSize: 12, marginBottom: 20,
        }}>
          Erro de autenticação: {erro}
        </p>
        <button
          onClick={() => router.replace('/login')}
          style={{
            padding: '12px 24px', borderRadius: 'var(--r)',
            background: 'var(--panel-2)', border: '1px solid var(--border)',
            color: 'var(--fg-1)', fontWeight: 600, cursor: 'pointer',
          }}
        >
          Voltar ao login
        </button>
      </div>
    )
  }

  return (
    <>
      <div className="spinner" style={{ margin: '0 auto 20px' }} />
      <p className="mono" style={{ color: 'var(--fg-3)', letterSpacing: '0.2em', textTransform: 'uppercase', fontSize: 12 }}>
        Autenticando…
      </p>
    </>
  )
}

export default function PaginaCallback() {
  return (
    <div className="app">
      <div className="bg-ambient" />
      <div style={{ flex: 1, display: 'grid', placeItems: 'center' }}>
        <div style={{ textAlign: 'center' }}>
          <Suspense fallback={
            <>
              <div className="spinner" style={{ margin: '0 auto 20px' }} />
              <p className="mono" style={{ color: 'var(--fg-3)', letterSpacing: '0.2em', textTransform: 'uppercase', fontSize: 12 }}>
                Carregando…
              </p>
            </>
          }>
            <ConteudoCallback />
          </Suspense>
        </div>
      </div>
    </div>
  )
}
