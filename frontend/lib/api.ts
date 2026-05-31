const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API_URL}${path}`, init)
  if (!res.ok) {
    const body = await res.json().catch(() => ({}))
    throw new Error(body?.message || `HTTP ${res.status}`)
  }
  return res.json()
}

function authHeaders(token: string, json = false): HeadersInit {
  const h: Record<string, string> = { Authorization: `Bearer ${token}` }
  if (json) h['Content-Type'] = 'application/json'
  return h
}

export interface WalletData {
  id: string
  jogadorId: string
  nomeUsuario: string
  saldo: string
}

export interface RoundData {
  id: string
  status: 'APOSTAS_ABERTAS' | 'RODANDO' | 'CRASHADO'
  hashSeedServidor: string
  seedServidor?: string
  pontoCrash?: number
  multiplicadorAtual?: number
  apostas: {
    jogadorId: string
    nomeUsuario: string
    valorCentavos: string
    status: string
    pagamentoCentavos?: string
    multiplicadorSaque?: number
  }[]
}

export interface HistoryRound {
  id: string
  pontoCrash: number
}

export interface BetResult {
  id: string
  status: string
  valorCentavos: string
}

export const getWallet = (token: string) =>
  request<WalletData>('/wallets/me', { headers: authHeaders(token) })

export const createWallet = (token: string) =>
  request<WalletData>('/wallets', { method: 'POST', headers: authHeaders(token) })

export const getCurrentRound = () =>
  request<RoundData>('/games/rounds/current')

export const getRoundHistory = () =>
  request<HistoryRound[]>('/games/rounds/history?limit=20')

export const placeBet = (valorCentavos: number, token: string, autoCashout?: number) =>
  request<BetResult>('/games/bet', {
    method: 'POST',
    headers: authHeaders(token, true),
    body: JSON.stringify({ valorCentavos, ...(autoCashout !== undefined ? { autoCashout } : {}) }),
  })

export const cashout = (token: string) =>
  request<BetResult>('/games/bet/cashout', {
    method: 'POST',
    headers: authHeaders(token),
  })

export const getVerify = (roundId: string) =>
  request<{ hashSeedServidor: string; seedServidor?: string; pontoCrash?: number; id: string }>(
    `/games/rounds/${roundId}/verify`
  )

export interface LeaderboardEntry {
  posicao: number
  jogadorId: string
  nomeUsuario: string
  pnl: string       // centavos como string (pode ser negativo)
  rodadas: number
}

export const getLeaderboard = (period: '24h' | 'week') =>
  request<LeaderboardEntry[]>(`/games/leaderboard?period=${period}`)
