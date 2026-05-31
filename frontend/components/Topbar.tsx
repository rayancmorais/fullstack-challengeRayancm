'use client'
import { centavosParaReais, initials } from '@/lib/utils'
import { useGameStore } from '@/store/game'
import { useAuthStore } from '@/store/auth'

const IconRocket = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M4.5 16.5c-1.5 1.26-2 5-2 5s3.74-.5 5-2c.71-.84.7-2.13-.09-2.91a2.18 2.18 0 0 0-2.91-.09z"/>
    <path d="M12 15l-3-3a22 22 0 0 1 2-3.95A12.88 12.88 0 0 1 22 2c0 2.72-.78 7.5-6 11a22.35 22.35 0 0 1-4 2z"/>
    <path d="M9 12H4s.55-3.03 2-4c1.62-1.08 5 0 5 0"/>
    <path d="M12 15v5s3.03-.55 4-2c1.08-1.62 0-5 0-5"/>
  </svg>
)

const IconSomAtivo = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ width: 17, height: 17 }}>
    <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/>
    <path d="M15.54 8.46a5 5 0 0 1 0 7.07"/>
    <path d="M19.07 4.93a10 10 0 0 1 0 14.14"/>
  </svg>
)

const IconSomMudo = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ width: 17, height: 17 }}>
    <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/>
    <line x1="23" y1="9" x2="17" y2="15"/>
    <line x1="17" y1="9" x2="23" y2="15"/>
  </svg>
)

const IconLogout = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ width: 17, height: 17 }}>
    <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/>
    <polyline points="16 17 21 12 16 7"/>
    <line x1="21" y1="12" x2="9" y2="12"/>
  </svg>
)

interface Props {
  username: string
  saldo: number
}

export function Topbar({ username, saldo }: Props) {
  const sair = useAuthStore(s => s.sair)
  const { somAtivo, toggleSom } = useGameStore()

  return (
    <header className="topbar">
      <div className="brand">
        <span className="logo"><IconRocket /></span>
        <span>NOVA<span className="x">X</span></span>
      </div>
      <div className="topbar-right">
        <div className="balance-chip">
          <div>
            <div className="bal-label">Saldo</div>
            <div className="bal-val"><span className="cur">R$</span>{centavosParaReais(saldo)}</div>
          </div>
          <div className="avatar">{initials(username)}</div>
          <div className="user-meta">
            <span className="uname">{username}</span>
            <span className="ulabel">via JWT</span>
          </div>
        </div>
        <button
          className="logout-btn"
          title={somAtivo ? 'Silenciar' : 'Ativar som'}
          onClick={toggleSom}
          style={{ opacity: somAtivo ? 1 : 0.45 }}
        >
          {somAtivo ? <IconSomAtivo /> : <IconSomMudo />}
        </button>
        <button className="logout-btn" title="Sair" onClick={sair}>
          <IconLogout />
        </button>
      </div>
    </header>
  )
}
