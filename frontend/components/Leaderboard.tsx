'use client'
import { useState, useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { getLeaderboard } from '@/lib/api'
import { initials, fmt } from '@/lib/utils'
import type { LeaderboardEntry } from '@/lib/api'

// Profits em centavos — mesma escala dos dados reais
const MOCK_PLAYERS = [
  { name: 'pixelwolf',   profit: 642_900, rounds: 48 },
  { name: 'CryptoKai',  profit: 379_700, rounds: 35 },
  { name: 'vipera',     profit: 265_100, rounds: 41 },
  { name: 'MaverickBR', profit: 209_600, rounds: 29 },
  { name: 'luma_neon',  profit: 167_500, rounds: 33 },
  { name: 'node_runner', profit: 146_100, rounds: 27 },
  { name: 'ghost_br',   profit: 122_800, rounds: 22 },
  { name: 'Renata_S',   profit: 113_000, rounds: 19 },
]

interface EntradaDisplay {
  key: string
  nomeUsuario: string
  pnl: number         // centavos
  rodadas: number
  posicao: number
  isMe: boolean
  mock: boolean
}

interface Props {
  playerJogadorId: string
  nomeUsuario: string
  sessionPnl: number   // centavos da sessão atual
}

const IconCoins = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="var(--accent)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ width: 14, height: 14, flexShrink: 0 }}>
    <circle cx="8" cy="8" r="6"/>
    <path d="M18.09 10.37A6 6 0 1 1 10.34 18"/>
    <path d="M7 6h1v4"/>
    <path d="m16.71 13.88.7.71-2.82 2.82"/>
  </svg>
)

function construirLista(
  reais: LeaderboardEntry[],
  playerJogadorId: string,
  nomeUsuario: string,
  sessionPnl: number,
  period: '24h' | 'week',
): EntradaDisplay[] {
  // Escala os mocks para a semana como o bonus.jsx faz (×4.2)
  const fator = period === 'week' ? 4.2 : 1
  const fatRounds = period === 'week' ? 6 : 1

  // Nomes já presentes nos dados reais — não duplicar com mocks
  const nomesReais = new Set(reais.map(r => r.nomeUsuario.toLowerCase()))
  const idsReais   = new Set(reais.map(r => r.jogadorId))

  // Entradas reais do banco
  const entradas: EntradaDisplay[] = reais.map(r => ({
    key: r.jogadorId,
    nomeUsuario: r.nomeUsuario,
    pnl: Number(r.pnl),
    rodadas: r.rodadas,
    posicao: 0,
    isMe: r.jogadorId === playerJogadorId,
    mock: false,
  }))

  // Completar com mocks até 8 posições (excluindo nomes já presentes)
  const slots = Math.max(0, 8 - entradas.length)
  MOCK_PLAYERS
    .filter(m => !nomesReais.has(m.name.toLowerCase()))
    .slice(0, slots)
    .forEach(m => {
      entradas.push({
        key: `mock-${m.name}`,
        nomeUsuario: m.name,
        pnl: Math.round(m.profit * fator),
        rodadas: Math.round(m.rounds * fatRounds),
        posicao: 0,
        isMe: false,
        mock: true,
      })
    })

  // Injetar jogador atual se não está na lista e tem PnL não-zero na sessão
  const playerNaLista = idsReais.has(playerJogadorId)
  if (!playerNaLista && sessionPnl !== 0) {
    entradas.push({
      key: playerJogadorId,
      nomeUsuario: nomeUsuario,
      pnl: sessionPnl,
      rodadas: 0,
      posicao: 0,
      isMe: true,
      mock: false,
    })
  }

  // Ordenar por PnL desc, atribuir posições
  return entradas
    .sort((a, b) => b.pnl - a.pnl)
    .slice(0, 8)
    .map((e, i) => ({ ...e, posicao: i + 1 }))
}

export function Leaderboard({ playerJogadorId, nomeUsuario, sessionPnl }: Props) {
  const [period, setPeriod] = useState<'24h' | 'week'>('24h')

  const { data: reais = [], isLoading } = useQuery({
    queryKey: ['leaderboard', period],
    queryFn: () => getLeaderboard(period),
    refetchInterval: 30_000,
    staleTime: 20_000,
  })

  const lista = useMemo(
    () => construirLista(reais, playerJogadorId, nomeUsuario, sessionPnl, period),
    // sessionPnl arredondado a R$1 para não re-calcular em todo tick
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [reais, playerJogadorId, nomeUsuario, Math.round(sessionPnl / 100), period],
  )

  const rankClass = (pos: number) =>
    pos === 1 ? 'r1' : pos === 2 ? 'r2' : pos === 3 ? 'r3' : ''

  return (
    <div className="card card-pad">
      <div className="card-title">
        <h3><IconCoins /> Leaderboard</h3>
        <div className="seg seg-sm">
          {([['24h', '24h'], ['week', 'Semana']] as const).map(([k, l]) => (
            <button
              key={k}
              className={`seg-btn ${period === k ? 'on' : ''}`}
              onClick={() => setPeriod(k)}
            >
              {l}
            </button>
          ))}
        </div>
      </div>

      <div className="lb-list">
        {isLoading && lista.length === 0 && (
          <div className="lb-empty">carregando…</div>
        )}

        {lista.map(r => (
          <div key={r.key} className={`lb-row ${r.isMe ? 'me' : ''}`}>
            <span className={`lb-rank ${rankClass(r.posicao)}`}>{r.posicao}</span>
            <span className="lb-ava">{initials(r.nomeUsuario)}</span>
            <span className="lb-name">
              {r.nomeUsuario}
              {r.isMe && <span className="me-tag">VOCÊ</span>}
            </span>
            <span className={`lb-profit ${r.pnl >= 0 ? 'pos' : 'neg'}`}>
              {r.pnl >= 0 ? '+' : '−'}R$ {fmt(Math.abs(r.pnl) / 100)}
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}
