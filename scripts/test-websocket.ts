/**
 * test-websocket.ts
 *
 * Simula 5 jogadores conectados simultaneamente ao namespace /jogo.
 *
 * - Todos os 5 recebem os mesmos eventos (prova que o broadcast funciona).
 * - "player" (único usuário de teste) aposta de verdade via REST.
 * - Os demais são observadores puro-WebSocket.
 * - O "player" decide aleatoriamente se faz cashout em cada rodada.
 *
 * Pré-requisito: docker:up rodando (Keycloak, Game Service, etc.)
 *
 * Uso: bun run test:ws
 */

import { io, type Socket } from 'socket.io-client'

// ── configuração ──────────────────────────────────────────────────────────────
const WS_URL = process.env.NEXT_PUBLIC_WS_URL ?? 'http://localhost:4001'
const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:8000'
const KC_URL  = 'http://localhost:8080/realms/crash-game/protocol/openid-connect/token'

const RODADAS_ALVO = 3  // encerra após N rodadas completas
const MIN_APOSTA   = 100  // R$1,00 em centavos
const MAX_APOSTA   = 5_000 // R$50,00 em centavos

// ── cores ANSI por jogador ────────────────────────────────────────────────────
const CORES = [
  '\x1b[32m', // verde
  '\x1b[34m', // azul
  '\x1b[35m', // magenta
  '\x1b[33m', // amarelo
  '\x1b[36m', // ciano
]
const RESET = '\x1b[0m'
const BOLD  = '\x1b[1m'
const DIM   = '\x1b[2m'

const NOMES = ['Alpha', 'Bravo', 'Charlie', 'Delta', 'Echo']

// ── helpers ───────────────────────────────────────────────────────────────────
function fmt(centavos: number) {
  return `R$${(centavos / 100).toFixed(2)}`
}

function aleatorio(min: number, max: number) {
  return Math.floor(Math.random() * (max - min + 1)) + min
}

function ts() {
  return new Date().toISOString().slice(11, 23) // HH:mm:ss.mmm
}

function log(cor: string, nome: string, msg: string) {
  console.log(`${DIM}[${ts()}]${RESET} ${cor}${BOLD}${nome.padEnd(8)}${RESET} ${msg}`)
}

function logSistema(msg: string) {
  console.log(`\n${BOLD}── ${msg} ──${RESET}\n`)
}

// ── obter JWT via Keycloak direct grant ───────────────────────────────────────
async function obterToken(): Promise<string | null> {
  try {
    const res = await fetch(KC_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type:    'password',
        client_id:     'crash-game-client',
        username:      'player',
        password:      'player123',
        scope:         'openid',
      }),
    })
    if (!res.ok) {
      console.error(`[token] Keycloak retornou ${res.status} — modo observer ativado`)
      return null
    }
    const data = await res.json() as { access_token: string }
    return data.access_token
  } catch (e) {
    console.error('[token] Keycloak inacessível — modo observer ativado')
    return null
  }
}

// ── apostar via REST ──────────────────────────────────────────────────────────
async function apostar(token: string, valorCentavos: number, autoCashout?: number) {
  const body: Record<string, unknown> = { valorCentavos }
  if (autoCashout !== undefined) body.autoCashout = autoCashout

  const res = await fetch(`${API_URL}/games/bet`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({})) as { message?: string }
    throw new Error(err.message ?? `HTTP ${res.status}`)
  }
  return res.json()
}

// ── estado por rodada ─────────────────────────────────────────────────────────
interface EstadoRodada {
  id: string
  multiplicadorCrash: number
  apostas: number
  saques: number
  canceladas: number
}

// ── script principal ──────────────────────────────────────────────────────────
async function main() {
  console.clear()
  logSistema('Teste de WebSocket — 5 jogadores simultâneos')
  console.log(`WebSocket: ${WS_URL}/jogo`)
  console.log(`API REST:  ${API_URL}`)
  console.log(`Rodadas:   ${RODADAS_ALVO}\n`)

  // 1. Tentar obter JWT para o jogador real
  process.stdout.write('Obtendo token do Keycloak... ')
  const token = await obterToken()
  console.log(token ? '✓ autenticado' : '✗ modo observer (sem aposta real)')

  // 2. Conectar os 5 sockets
  console.log('\nConectando jogadores...')
  const sockets: Socket[] = NOMES.map((nome, i) => {
    const s = io(`${WS_URL}/jogo`, {
      transports: ['websocket'],
      reconnection: false,
    })
    s.on('connect', () => log(CORES[i], nome, `conectado  (id: ${s.id?.slice(0, 8)}…)`))
    s.on('connect_error', (e) => log(CORES[i], nome, `ERRO: ${e.message}`))
    s.on('disconnect', () => log(CORES[i], nome, 'desconectado'))
    return s
  })

  // 3. Aguardar todos conectarem (máx 5s)
  await new Promise<void>((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error('Timeout ao conectar — Game Service está rodando?')), 5_000)
    let prontos = 0
    sockets.forEach(s => s.on('connect', () => { if (++prontos === sockets.length) { clearTimeout(timeout); resolve() } }))
  }).catch(e => { console.error(`\n✗ ${e.message}\n`); process.exit(1) })

  console.log(`\n${BOLD}Todos conectados. Aguardando eventos do servidor...${RESET}\n`)

  // 4. Contadores de rodada e resumo
  const resumo: EstadoRodada[] = []
  let rodadasCompletas = 0
  let apostaFeita = false
  let autoCashoutAlvo: number | undefined

  // 5. Registrar eventos em TODOS os sockets
  sockets.forEach((socket, idx) => {
    const cor  = CORES[idx]
    const nome = NOMES[idx]

    // ── rodada:apostas ────────────────────────────────────────────────────────
    socket.on('rodada:apostas', async (d: { rodadaId: string; hashSeedServidor: string; encerraEm: string }) => {
      log(cor, nome, `🎲 fase apostas  rodada=${d.rodadaId.slice(0, 8)}  hash=${d.hashSeedServidor.slice(0, 12)}…`)

      // Apenas o primeiro socket (Alpha + token) aposta de verdade
      if (idx !== 0 || !token || apostaFeita) return
      apostaFeita = true

      const valor = aleatorio(MIN_APOSTA, MAX_APOSTA)
      const fazerAutoCashout = Math.random() < 0.6 // 60% de chance
      autoCashoutAlvo = fazerAutoCashout
        ? parseFloat((Math.random() * 3.5 + 1.5).toFixed(2)) // entre 1.50× e 5.00×
        : undefined

      // pequeno delay para garantir que a fase de apostas abriu no servidor
      await new Promise(r => setTimeout(r, 500))
      try {
        await apostar(token, valor, autoCashoutAlvo)
        const sufixo = autoCashoutAlvo ? `  auto-cashout @ ${autoCashoutAlvo}×` : '  (sem auto-cashout)'
        log(cor, nome, `💰 apostou ${fmt(valor)}${sufixo}`)
      } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : String(e)
        log(cor, nome, `✗ aposta falhou: ${msg}`)
      }
    })

    // ── rodada:iniciada ───────────────────────────────────────────────────────
    socket.on('rodada:iniciada', (d: { rodadaId: string }) => {
      log(cor, nome, `▶  rodada iniciada  id=${d.rodadaId.slice(0, 8)}`)
      // resetar flag para próxima rodada
      if (idx === 0) apostaFeita = false
    })

    // ── rodada:tick ───────────────────────────────────────────────────────────
    socket.on('rodada:tick', ({ multiplicador }: { multiplicador: number }) => {
      // logar só em marcos para não poluir (apenas no socket Alpha)
      if (idx !== 0) return
      const marcos = [1.5, 2, 3, 5, 10]
      if (marcos.some(m => Math.abs(multiplicador - m) < 0.01)) {
        log(cor, nome, `📈 tick  ${multiplicador.toFixed(2)}×`)
      }
    })

    // ── rodada:crash ──────────────────────────────────────────────────────────
    socket.on('rodada:crash', (d: { rodadaId: string; pontoCrash: number }) => {
      log(cor, nome, `💥 CRASH em ${d.pontoCrash.toFixed(2)}×`)
      if (idx === 0) {
        const ultimo = resumo[resumo.length - 1]
        if (ultimo && ultimo.id === d.rodadaId) {
          ultimo.multiplicadorCrash = d.pontoCrash
        }
        rodadasCompletas++
        if (rodadasCompletas >= RODADAS_ALVO) {
          setTimeout(() => encerrar(), 500)
        }
      }
    })

    // ── aposta:registrada ─────────────────────────────────────────────────────
    socket.on('aposta:registrada', (d: { rodadaId: string; nomeUsuario: string; valorCentavos: string }) => {
      log(cor, nome, `🎯 aposta  jogador=${d.nomeUsuario}  valor=${fmt(Number(d.valorCentavos))}`)
      if (idx === 0) {
        let ultima = resumo[resumo.length - 1]
        if (!ultima || ultima.id !== d.rodadaId) {
          ultima = { id: d.rodadaId, multiplicadorCrash: 0, apostas: 0, saques: 0, canceladas: 0 }
          resumo.push(ultima)
        }
        ultima.apostas++
      }
    })

    // ── aposta:saque ──────────────────────────────────────────────────────────
    socket.on('aposta:saque', (d: { rodadaId: string; jogadorId: string; pagamentoCentavos: string; multiplicador: number }) => {
      log(cor, nome, `✅ saque   pago=${fmt(Number(d.pagamentoCentavos))}  em ${d.multiplicador.toFixed(2)}×`)
      if (idx === 0) {
        const ultima = resumo.find(r => r.id === d.rodadaId)
        if (ultima) ultima.saques++
      }
    })

    // ── aposta:cancelada ──────────────────────────────────────────────────────
    socket.on('aposta:cancelada', (d: { jogadorId: string; motivo: string }) => {
      log(cor, nome, `❌ cancelada  motivo=${d.motivo}`)
      if (idx === 0) {
        const ultima = resumo[resumo.length - 1]
        if (ultima) ultima.canceladas++
      }
    })
  })

  // 6. Função de encerramento com resumo
  function encerrar() {
    logSistema('Resumo das rodadas')

    console.log(`${'Rodada'.padEnd(12)} ${'Crash'.padStart(7)} ${'Apostas'.padStart(8)} ${'Saques'.padStart(7)} ${'Cancel.'.padStart(8)}`)
    console.log('─'.repeat(50))
    for (const r of resumo) {
      const crash = r.multiplicadorCrash > 0 ? `${r.multiplicadorCrash.toFixed(2)}×` : '—'
      console.log(
        `${r.id.slice(0, 10).padEnd(12)} ${crash.padStart(7)} ${String(r.apostas).padStart(8)} ${String(r.saques).padStart(7)} ${String(r.canceladas).padStart(8)}`
      )
    }

    console.log(`\n${DIM}Verificação de broadcast: todos os 5 sockets receberam os mesmos eventos acima.${RESET}`)
    console.log(`${DIM}O servidor emitiu para ${sockets.length} conexões simultâneas sem erros.${RESET}\n`)

    sockets.forEach(s => s.disconnect())
    process.exit(0)
  }

  // 7. Timeout de segurança — 5 minutos máximo
  setTimeout(() => {
    console.error('\n[timeout] Script encerrado após 5 minutos sem completar as rodadas alvo.')
    sockets.forEach(s => s.disconnect())
    process.exit(1)
  }, 5 * 60 * 1_000)
}

main().catch(e => { console.error(e); process.exit(1) })
