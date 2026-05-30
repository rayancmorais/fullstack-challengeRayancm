'use client'
import { create } from 'zustand'

export type GamePhase = 'APOSTAS_ABERTAS' | 'RODANDO' | 'CRASHADO'

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
  multiplicador: number
  rodadaId: string | null
  hashSeedServidor: string | null
  seedServidor: string | null
  pontoCrash: number | null
  encerraEm: Date | null
  apostas: BetEntry[]
  historico: HistoryEntry[]
  toasts: Toast[]

  // WS actions
  setFaseApostas: (d: { rodadaId: string; hashSeedServidor: string; encerraEm: string }) => void
  setRodandoIniciada: (d: { rodadaId: string }) => void
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

  // Toast
  pushToast: (kind: Toast['kind'], title: string, desc?: string) => void
  dismissToast: (id: string) => void
}

export const useGameStore = create<GameStore>((set) => ({
  fase: null,
  multiplicador: 1.0,
  rodadaId: null,
  hashSeedServidor: null,
  seedServidor: null,
  pontoCrash: null,
  encerraEm: null,
  apostas: [],
  historico: [],
  toasts: [],

  setFaseApostas: (d) => set({
    fase: 'APOSTAS_ABERTAS',
    rodadaId: d.rodadaId,
    hashSeedServidor: d.hashSeedServidor,
    encerraEm: new Date(d.encerraEm),
    multiplicador: 1.0,
    apostas: [],
    seedServidor: null,
    pontoCrash: null,
  }),

  setRodandoIniciada: () => set({ fase: 'RODANDO' }),

  setTick: (multiplicador) => set({ multiplicador }),

  setCrash: (d) => set((s) => ({
    fase: 'CRASHADO',
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
}))
