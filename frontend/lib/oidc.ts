const EMISSOR   = process.env.NEXT_PUBLIC_OIDC_ISSUER!
const CLIENT_ID = process.env.NEXT_PUBLIC_OIDC_CLIENT_ID!
const REDIRECT  = process.env.NEXT_PUBLIC_OIDC_REDIRECT_URI!

function aleatorio(bytes: number): string {
  const arr = new Uint8Array(bytes)
  crypto.getRandomValues(arr)
  return Array.from(arr, b => b.toString(16).padStart(2, '0')).join('')
}

function base64url(buf: ArrayBuffer): string {
  return btoa(String.fromCharCode(...new Uint8Array(buf)))
    .replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

export async function iniciarLogin(): Promise<void> {
  const verificador = aleatorio(64)
  const estado      = aleatorio(16)
  sessionStorage.setItem('pkce_verificador', verificador)
  sessionStorage.setItem('pkce_estado', estado)

  const digest  = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(verificador))
  const desafio = base64url(digest)

  const params = new URLSearchParams({
    client_id:             CLIENT_ID,
    redirect_uri:          REDIRECT,
    response_type:         'code',
    scope:                 'openid profile email',
    state:                 estado,
    code_challenge:        desafio,
    code_challenge_method: 'S256',
  })
  window.location.href = `${EMISSOR}/protocol/openid-connect/auth?${params}`
}

export async function trocarCodePorToken(codigo: string, estado: string): Promise<RespostaToken> {
  const estadoSalvo = sessionStorage.getItem('pkce_estado')
  if (estado !== estadoSalvo) throw new Error('State CSRF inválido')

  const verificador = sessionStorage.getItem('pkce_verificador') ?? ''
  sessionStorage.removeItem('pkce_estado')
  sessionStorage.removeItem('pkce_verificador')

  const res = await fetch(`${EMISSOR}/protocol/openid-connect/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type:    'authorization_code',
      client_id:     CLIENT_ID,
      redirect_uri:  REDIRECT,
      code:          codigo,
      code_verifier: verificador,
    }),
  })
  if (!res.ok) {
    const corpo = await res.json().catch(() => ({}))
    throw new Error(corpo?.error_description ?? `Token error ${res.status}`)
  }
  return res.json()
}

export async function renovarToken(refreshToken: string): Promise<RespostaToken> {
  const res = await fetch(`${EMISSOR}/protocol/openid-connect/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type:    'refresh_token',
      client_id:     CLIENT_ID,
      refresh_token: refreshToken,
    }),
  })
  if (!res.ok) throw new Error(`Refresh error ${res.status}`)
  return res.json()
}

export function lerClaims(jwt: string): Claims {
  const parte = jwt.split('.')[1]
  return JSON.parse(atob(parte.replace(/-/g, '+').replace(/_/g, '/')))
}

export async function loginDireto(usuario: string, senha: string): Promise<RespostaToken> {
  const res = await fetch(`${EMISSOR}/protocol/openid-connect/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'password',
      client_id:  CLIENT_ID,
      username:   usuario,
      password:   senha,
    }),
  })
  if (!res.ok) {
    const corpo = await res.json().catch(() => ({}))
    throw new Error(corpo?.error_description ?? `Login error ${res.status}`)
  }
  return res.json()
}

export interface RespostaToken {
  access_token:  string
  refresh_token: string
  id_token:      string
  expires_in:    number
}

export interface Claims {
  sub:               string
  preferred_username: string
  name:              string
  realm_access?:     { roles: string[] }
  exp:               number
}
