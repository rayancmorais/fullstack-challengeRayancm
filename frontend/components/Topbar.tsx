'use client'
import { centavosParaReais, initials } from '@/lib/utils'
import { useGameStore } from '@/store/game'
import { useAuthStore } from '@/store/auth'

const IconAsteroide = () => (
  <svg viewBox="0 0 24 24" fill="currentColor">
    {/* corpo rochoso do asteroide */}
    <path d="M14.5 3.5 Q17 2 19 4 Q21.5 5.5 21 8.5 Q20.5 12 17.5 13.5 Q15 14.5 12.5 13 L7 18.5 Q5.5 20 3.5 19.5 Q2 19 2 17.5 Q2 15.5 3.5 14 L9 8.5 Q7.5 6 8.5 3.5 Q9.5 1 12 1 Q13.5 1 14.5 3.5 Z" opacity="0.9"/>
    {/* cratera */}
    <ellipse cx="13.5" cy="8.5" rx="2.2" ry="1.5" transform="rotate(-35 13.5 8.5)" fill="none" stroke="currentColor" strokeWidth="1.2" opacity="0.7"/>
    {/* rastro de brilho (cauda do cometa) */}
    <line x1="3" y1="9" x2="7" y2="13" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" opacity="0.5"/>
    <line x1="2" y1="12" x2="5" y2="15" stroke="currentColor" strokeWidth="1" strokeLinecap="round" opacity="0.35"/>
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
        <img src="/favicon.svg" className="logo" style={{ background: 'none', padding: 0 }} alt="NovaX" />
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
