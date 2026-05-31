'use client'
import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'
import { iniciarLogin, trocarCodePorToken, renovarToken, lerClaims, loginDireto } from '@/lib/oidc'
import type { RespostaToken } from '@/lib/oidc'

interface Usuario {
  sub:      string
  username: string
  nome:     string
  roles:    string[]
}

interface AuthStore {
  accessToken:  string | null
  refreshToken: string | null
  idToken:      string | null
  expiraEm:     number | null   // epoch ms
  usuario:      Usuario | null
  autenticado:  boolean

  entrar:              () => Promise<void>
  loginComCredenciais: (usuario: string, senha: string) => Promise<void>
  tratarCallback:      (codigo: string, estado: string) => Promise<void>
  tokenValido:         () => Promise<string>
  sair:                () => void
}

function usuarioDeClaims(tokens: RespostaToken): Usuario {
  const c = lerClaims(tokens.access_token)
  return {
    sub:      c.sub,
    username: c.preferred_username,
    nome:     c.name,
    roles:    c.realm_access?.roles ?? [],
  }
}

export const useAuthStore = create<AuthStore>()(
  persist(
    (set, get) => ({
      accessToken:  null,
      refreshToken: null,
      idToken:      null,
      expiraEm:     null,
      usuario:      null,
      autenticado:  false,

      entrar: async () => {
        await iniciarLogin()
      },

      loginComCredenciais: async (usuario, senha) => {
        const tokens = await loginDireto(usuario, senha)
        set({
          accessToken:  tokens.access_token,
          refreshToken: tokens.refresh_token,
          idToken:      tokens.id_token,
          expiraEm:     Date.now() + tokens.expires_in * 1000,
          usuario:      usuarioDeClaims(tokens),
          autenticado:  true,
        })
      },

      tratarCallback: async (codigo, estado) => {
        const tokens = await trocarCodePorToken(codigo, estado)
        set({
          accessToken:  tokens.access_token,
          refreshToken: tokens.refresh_token,
          idToken:      tokens.id_token,
          expiraEm:     Date.now() + tokens.expires_in * 1000,
          usuario:      usuarioDeClaims(tokens),
          autenticado:  true,
        })
      },

      tokenValido: async () => {
        const s = get()
        if (!s.refreshToken || !s.expiraEm) { s.sair(); return '' }

        // token ainda válido por mais de 30 s
        if (s.expiraEm - Date.now() > 30_000) return s.accessToken!

        try {
          const tokens = await renovarToken(s.refreshToken)
          set({
            accessToken:  tokens.access_token,
            refreshToken: tokens.refresh_token,
            idToken:      tokens.id_token,
            expiraEm:     Date.now() + tokens.expires_in * 1000,
            usuario:      usuarioDeClaims(tokens),
          })
          return tokens.access_token
        } catch {
          s.sair()
          return ''
        }
      },

      sair: () => {
        const { idToken } = get()
        set({
          accessToken: null, refreshToken: null, idToken: null,
          expiraEm: null, usuario: null, autenticado: false,
        })
        const issuer = process.env.NEXT_PUBLIC_OIDC_ISSUER
        if (!issuer || typeof window === 'undefined') return
        const params = new URLSearchParams({
          post_logout_redirect_uri: `${window.location.origin}/login`,
          ...(idToken ? { id_token_hint: idToken } : {}),
        })
        window.location.href = `${issuer}/protocol/openid-connect/logout?${params}`
      },
    }),
    {
      name:    'crash_auth',
      storage: createJSONStorage(() => sessionStorage),
      partialize: (s) => ({
        accessToken:  s.accessToken,
        refreshToken: s.refreshToken,
        idToken:      s.idToken,
        expiraEm:     s.expiraEm,
        usuario:      s.usuario,
        autenticado:  s.autenticado,
      }),
    }
  )
)
