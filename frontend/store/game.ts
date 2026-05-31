'use client'
import { create } from 'zustand'

export type GamePhase = 'APOSTAS_ABERTAS' | 'RODANDO' | 'CRASHADO'
export type FaseDoJogo = 'BETTING' | 'RUNNING' | 'CRASHED'

export interface BetEntry {
  jogadorId: string
  nomeUsuario: string
  valorCentavos: number
  status: 'PENDENTE' | 'SACOU' | 'PERDEU' | 'CANCELADA'
  pagamentoCentavos?: number
  multiplicadorSaque?: number
}

export interface HistoryEntry {
  rodadaId: string
  pontoCrash: number
}

export interface Toast {
  id: string
  kind: 'success' | 'error' | 'gold' | 'info'
  title: string
  desc?: string
  out?: boolean
}

interface GameStore {
  fase: GamePhase | null
  faseDoJogo: FaseDoJogo | null      // alias EN para AnimacaoAsteroide
  crescimento: number                 // constante da curva exponencial
  sacadoEm: number | null            // multiplicador em que o jogador atual sacou
  multiplicador: number
  rodadaId: string | null
  hashSeedServidor: string | null
  seedServidor: string | null
  pontoCrash: number | null
  encerraEm: Date | null
  apostas: BetEntry[]
  historico: HistoryEntry[]
  toasts: Toast[]

  rodadaIniciadaEm: number | null   // timestamp ms do evento rodada:iniciada

  // WS actions
  setFaseApostas: (d: { rodadaId: string; hashSeedServidor: string; encerraEm: string }) => void
  setRodandoIniciada: (d: { rodadaId: string; iniciadoEm?: string }) => void
  setTick: (multiplicador: number) => void
  setCrash: (d: { rodadaId: string; pontoCrash: number; seedServidor: string }) => void
  addAposta: (d: { rodadaId: string; jogadorId: string; nomeUsuario: string; valorCentavos: string }) => void
  setSaque: (d: { rodadaId: string; jogadorId: string; pagamentoCentavos: string; multiplicador: number }) => void
  cancelarAposta: (jogadorId: string) => void

  // Initial load
  setFromCurrentRound: (d: {
    id: string; status: GamePhase; hashSeedServidor: string; seedServidor?: string;
    pontoCrash?: number; multiplicadorAtual?: number;
    apostas: { jogadorId: string; nomeUsuario: string; valorCentavos: string; status: string; pagamentoCentavos?: string; multiplicadorSaque?: number }[]
  }) => void
  setHistorico: (entries: HistoryEntry[]) => void

  setSacadoEm: (mult: number | null) => void
  conectar: (url: string) => void   // no-op — WS gerenciado por useGameSocket

  // Toast
  pushToast: (kind: Toast['kind'], title: string, desc?: string) => void
  dismissToast: (id: string) => void

  // Som
  somAtivo: boolean
  toggleSom: () => void
}

export const useGameStore = create<GameStore>((set) => ({
  fase: null,
  faseDoJogo: null,
  crescimento: 0.00006,
  sacadoEm: null,
  multiplicador: 1.0,
  rodadaId: null,
  rodadaIniciadaEm: null,
  hashSeedServidor: null,
  seedServidor: null,
  pontoCrash: null,
  encerraEm: null,
  apostas: [],
  historico: [],
  toasts: [],

  setFaseApostas: (d) => set({
    fase: 'APOSTAS_ABERTAS',
    faseDoJogo: 'BETTING',
    sacadoEm: null,
    rodadaId: d.rodadaId,
    hashSeedServidor: d.hashSeedServidor,
    encerraEm: new Date(d.encerraEm),
    multiplicador: 1.0,
    apostas: [],
    seedServidor: null,
    pontoCrash: null,
    rodadaIniciadaEm: null,
  }),

  setRodandoIniciada: (d) => set({
    fase: 'RODANDO',
    faseDoJogo: 'RUNNING',
    rodadaIniciadaEm: d.iniciadoEm ? new Date(d.iniciadoEm).getTime() : Date.now(),
  }),

  setTick: (multiplicador) => set({ multiplicador }),

  setCrash: (d) => set((s) => ({
    fase: 'CRASHADO',
    faseDoJogo: 'CRASHED',
    pontoCrash: d.pontoCrash,
    seedServidor: d.seedServidor,
    multiplicador: d.pontoCrash,
    historico: [{ rodadaId: d.rodadaId, pontoCrash: d.pontoCrash }, ...s.historico.slice(0, 19)],
    apostas: s.apostas.map(a => a.status === 'PENDENTE' ? { ...a, status: 'PERDEU' as const } : a),
  })),

  addAposta: (d) => set((s) => ({
    apostas: [
      ...s.apostas.filter(a => a.jogadorId !== d.jogadorId),
      { jogadorId: d.jogadorId, nomeUsuario: d.nomeUsuario, valorCentavos: Number(d.valorCentavos), status: 'PENDENTE' as const },
    ],
  })),

  setSaque: (d) => set((s) => ({
    apostas: s.apostas.map(a =>
      a.jogadorId === d.jogadorId
        ? { ...a, status: 'SACOU' as const, pagamentoCentavos: Number(d.pagamentoCentavos), multiplicadorSaque: d.multiplicador }
        : a
    ),
  })),

  cancelarAposta: (jogadorId) => set((s) => ({
    apostas: s.apostas.map(a => a.jogadorId === jogadorId ? { ...a, status: 'CANCELADA' as const } : a),
  })),

  setFromCurrentRound: (d) => set({
    fase: d.status,
    faseDoJogo: d.status === 'RODANDO' ? 'RUNNING' : d.status === 'CRASHADO' ? 'CRASHED' : 'BETTING',
    rodadaId: d.id,
    hashSeedServidor: d.hashSeedServidor,
    seedServidor: d.seedServidor,
    pontoCrash: d.pontoCrash,
    multiplicador: d.multiplicadorAtual || 1.0,
    apostas: d.apostas.map(a => ({
      jogadorId: a.jogadorId,
      nomeUsuario: a.nomeUsuario,
      valorCentavos: Number(a.valorCentavos),
      status: a.status as BetEntry['status'],
      pagamentoCentavos: a.pagamentoCentavos ? Number(a.pagamentoCentavos) : undefined,
      multiplicadorSaque: a.multiplicadorSaque,
    })),
    encerraEm: null,
  }),

  setHistorico: (entries) => set({ historico: entries }),

  setSacadoEm: (mult) => set({ sacadoEm: mult }),
  conectar: () => {},  // WS já gerenciado por useGameSocket

  pushToast: (kind, title, desc) => {
    const id = Math.random().toString(36).slice(2)
    set((s) => ({ toasts: [...s.toasts, { id, kind, title, desc }] }))
    setTimeout(() => {
      set((s) => ({ toasts: s.toasts.map(t => t.id === id ? { ...t, out: true } : t) }))
      setTimeout(() => set((s) => ({ toasts: s.toasts.filter(t => t.id !== id) })), 320)
    }, 4200)
  },

  dismissToast: (id) => {
    set((s) => ({ toasts: s.toasts.map(t => t.id === id ? { ...t, out: true } : t) }))
    setTimeout(() => set((s) => ({ toasts: s.toasts.filter(t => t.id !== id) })), 320)
  },

  somAtivo: typeof window !== 'undefined' ? localStorage.getItem('som') !== 'false' : true,
  toggleSom: () => set((s) => {
    const novo = !s.somAtivo
    if (typeof window !== 'undefined') localStorage.setItem('som', String(novo))
    return { somAtivo: novo }
  }),
}))
