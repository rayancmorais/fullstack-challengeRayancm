'use client'
import { useState } from 'react'
import { useAuthStore } from '@/store/auth'

const IconRocket = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ width: 34, height: 34 }}>
    <path d="M4.5 16.5c-1.5 1.26-2 5-2 5s3.74-.5 5-2c.71-.84.7-2.13-.09-2.91a2.18 2.18 0 0 0-2.91-.09z"/>
    <path d="M12 15l-3-3a22 22 0 0 1 2-3.95A12.88 12.88 0 0 1 22 2c0 2.72-.78 7.5-6 11a22.35 22.35 0 0 1-4 2z"/>
    <path d="M9 12H4s.55-3.03 2-4c1.62-1.08 5 0 5 0"/>
    <path d="M12 15v5s3.03-.55 4-2c1.08-1.62 0-5 0-5"/>
  </svg>
)

const IconCadeado = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="3" y="11" width="18" height="11" rx="2"/>
    <path d="M7 11V7a5 5 0 0 1 10 0v4"/>
  </svg>
)

type Passo = 'landing' | 'idp' | 'autenticando' | 'redirecionando'

export default function PaginaLogin() {
  const loginComCredenciais = useAuthStore(s => s.loginComCredenciais)
  const [passo, setPasso]   = useState<Passo>('landing')
  const [usuario, setUsuario] = useState('player')
  const [senha, setSenha]     = useState('player123')
  const [erroMsg, setErroMsg] = useState('')

  const irParaIdp = () => setPasso('idp')

  const autorizar = (e: React.FormEvent) => {
    e.preventDefault()
    if (!usuario.trim()) return
    setErroMsg('')
    setPasso('autenticando')
    setTimeout(() => setPasso('redirecionando'), 1100)
    setTimeout(async () => {
      try {
        await loginComCredenciais(usuario.trim(), senha)
        window.location.replace('/')
      } catch (err) {
        setPasso('idp')
        setErroMsg(err instanceof Error ? err.message : 'Erro ao autenticar')
      }
    }, 2200)
  }

  // ── Autenticando / Redirecionando ──────────────────────────────────────────
  if (passo === 'autenticando' || passo === 'redirecionando') {
    return (
      <div style={{ position: 'relative', zIndex: 1, minHeight: '100vh', display: 'grid', placeItems: 'center', padding: 24 }}>
        <div className="bg-ambient" />
        <div className="login-card" style={{ textAlign: 'center' }}>
          <div className="spinner" style={{ margin: '8px auto 18px' }} />
          <h2 style={{ fontSize: 19, fontWeight: 700, margin: '0 0 6px' }}>
            {passo === 'autenticando' ? 'Autenticando' : 'Redirecionando'}
          </h2>
          <p style={{ color: 'var(--fg-2)', fontSize: 14, margin: '0 0 6px', lineHeight: 1.5 }}>
            {passo === 'autenticando'
              ? 'Validando credenciais no realm crash-game…'
              : 'Trocando authorization code por tokens e voltando ao app…'}
          </p>
          <div className="redir-dots">
            <span /><span /><span />
          </div>
        </div>
      </div>
    )
  }

  // ── Formulário fake-Keycloak ───────────────────────────────────────────────
  if (passo === 'idp') {
    return (
      <div style={{ position: 'relative', zIndex: 1, minHeight: '100vh', display: 'grid', placeItems: 'center', padding: 24 }}>
        <div className="bg-ambient" />
        <form className="login-card" onSubmit={autorizar}>
          <div className="kc-chrome">
            <div style={{
              width: 38, height: 38, borderRadius: 10, flexShrink: 0,
              background: 'linear-gradient(135deg, var(--accent), var(--accent-2))',
              display: 'grid', placeItems: 'center', color: 'var(--accent-ink)',
            }}>
              <IconCadeado />
            </div>
            <div>
              <div className="realm">Sign in to <b>crash-game</b></div>
              <div className="host">localhost:8080 · Keycloak</div>
            </div>
          </div>

          <div className="login-field">
            <label>Usuário ou e-mail</label>
            <input
              value={usuario}
              onChange={e => setUsuario(e.target.value)}
              autoFocus
            />
          </div>
          <div className="login-field">
            <label>Senha</label>
            <input
              type="password"
              value={senha}
              onChange={e => setSenha(e.target.value)}
            />
          </div>

          {erroMsg && (
            <p style={{ color: 'var(--danger)', fontFamily: 'var(--font-mono)', fontSize: 12, margin: '0 0 12px', textAlign: 'center' }}>
              {erroMsg}
            </p>
          )}

          <button className="lbtn" type="submit">Entrar</button>

          <p className="demo-hint">
            Demo do client <b>crash-game-client</b>. No backend real, o redirect vai ao Keycloak
            e o callback troca o <b>code</b> por tokens. Aqui o JWT é gerado localmente e
            decodificado para extrair o <b>username</b>.
          </p>
        </form>
      </div>
    )
  }

  // ── Landing ────────────────────────────────────────────────────────────────
  return (
    <div style={{ position: 'relative', zIndex: 1, minHeight: '100vh', display: 'grid', placeItems: 'center', padding: 24 }}>
      <div className="bg-ambient" />
      <div className="login-card">
        <div style={{
          width: 60, height: 60, borderRadius: 16, display: 'grid', placeItems: 'center',
          margin: '0 auto 22px',
          background: 'linear-gradient(135deg, var(--accent), var(--accent-2))',
          boxShadow: '0 0 32px rgba(var(--accent-rgb),0.5)',
          color: 'var(--accent-ink)',
        }}>
          <IconRocket />
        </div>

        <h1 style={{ textAlign: 'center', fontSize: 26, fontWeight: 800, letterSpacing: '-0.02em', margin: '0 0 6px' }}>
          NOVA<span style={{ color: 'var(--accent)' }}>X</span>
        </h1>
        <p style={{ textAlign: 'center', color: 'var(--fg-2)', fontSize: 14, margin: '0 0 28px', lineHeight: 1.5 }}>
          Crash game provably-fair.<br />
          Aposte, assista o multiplicador subir e saque antes do crash.
        </p>

        <div style={{
          display: 'flex', alignItems: 'center', gap: 10,
          padding: '11px 14px', borderRadius: 'var(--r)',
          background: 'var(--bg-2)', border: '1px solid var(--border)', marginBottom: 22,
        }}>
          <div style={{
            width: 30, height: 30, borderRadius: 8, flexShrink: 0,
            background: 'rgba(var(--accent-rgb),0.14)', display: 'grid', placeItems: 'center',
            color: 'var(--accent)',
          }}>
            <IconCadeado />
          </div>
          <div style={{ lineHeight: 1.3 }}>
            <div style={{ fontSize: 12.5, fontWeight: 600 }}>Login seguro via Keycloak</div>
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--fg-4)', letterSpacing: '0.04em' }}>
              OIDC · Authorization Code + PKCE (S256)
            </div>
          </div>
        </div>

        <button className="lbtn" onClick={irParaIdp}>
          <IconCadeado />
          Entrar com Keycloak
          <span style={{ fontFamily: 'var(--font-mono)' }}>→</span>
        </button>

        <p style={{ textAlign: 'center', marginTop: 20, fontFamily: 'var(--font-mono)', fontSize: 10.5, letterSpacing: '0.06em', color: 'var(--fg-4)' }}>
          PROTÓTIPO · SEM DINHEIRO REAL
        </p>
      </div>
    </div>
  )
}
