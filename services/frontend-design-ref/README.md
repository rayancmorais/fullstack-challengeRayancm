# Handoff: Crash Game — Frontend (Camada de Apresentação)

## Overview
Pacote de referência de design para a **interface do jogador** de um Crash Game
multiplayer em tempo real (estilo Aviator/JetX). Cobre as duas telas exigidas pelo
desafio: **Login (OIDC/Keycloak)** e **Tela do Jogo**. O objetivo é servir de
*blueprint visual e de UX* para a implementação real do frontend.

> ⚠️ **Estes arquivos são REFERÊNCIA DE DESIGN feita em HTML** — protótipos que
> mostram aparência e comportamento pretendidos. **Não são código de produção
> para copiar.** A tarefa é **recriar estes designs no stack real do desafio**:
> **Vite/Next/TanStack Start + React + Tailwind CSS v4 + shadcn/ui**, com
> **TanStack Query** (server state) e **Zustand/Context** (client state),
> consumindo a API REST via Kong e os eventos via WebSocket. Entenda cada decisão
> antes de implementar — o desafio prevê arguição.

## Fidelity
**Alta fidelidade (hi-fi).** Cores, tipografia, espaçamentos, estados e animações
são finais. Recrie a UI fielmente usando os componentes do seu design system
(shadcn/ui) e os tokens listados abaixo.

---

## Escopo vs. Backend (importante)
O protótipo simula o que, na entrega real, vem do backend:
| No protótipo (simulado) | Na entrega real |
|---|---|
| Motor de crash roda no cliente (`engine.js`) | Game Service (NestJS) é a fonte da verdade; cliente só renderiza |
| Login gera um JWT fake | Redirect OIDD → Keycloak → callback troca `code` por tokens (PKCE S256) |
| Saldo guardado em `localStorage` | `GET /wallets/me` via TanStack Query |
| Apostas de "bots" geradas localmente | Eventos WebSocket `server→client` |
| Ações de aposta chamam o motor direto | `POST /games/bet` e `POST /games/bet/cashout` (REST via Kong) |

O `engine.js` documenta **a lógica de domínio** (fases, curva, provably-fair,
validações) — útil como espelho do que o **Game Service** deve implementar no
backend, mas no frontend real essa lógica **não existe no cliente**.

---

## Screens / Views

### 1. Login (`login.html`)
- **Purpose:** autenticar via Keycloak (OIDC Authorization Code + PKCE).
- **Layout:** card central (max-width 420px) sobre fundo obsidiana com glow ambiente.
  Vertical: logo (60×60, radius 16, gradiente accent) → título "NOVAX" → subtítulo →
  banner "Login seguro via Keycloak" → botão primário → rodapé mono.
- **Fluxo (3 passos):**
  1. **Landing:** botão `Entrar com Keycloak →`.
  2. **IdP (tela estilo Keycloak):** realm `crash-game`, campos usuário/senha,
     pré-preenchido `player` / `player123`. Submit dispara autenticação.
  3. **Authorizing → Redirecting:** spinner + dots, depois `window.location` para o jogo.
- **Implementação real:** trocar os passos 2-3 por redirect ao endpoint de
  authorization do Keycloak; tratar o callback (`?code=...`), trocar por tokens,
  guardar access/refresh token (memória + refresh silencioso), decodificar
  `preferred_username` do JWT.

### 2. Tela do Jogo (`CrashGame.html`)
Grid de 2 colunas (`1fr 360px`) em desktop; empilha < 980px.

- **Topbar:** marca à esquerda; à direita chip de **Saldo** (mono, R$, tabular-nums),
  avatar com iniciais, **username (do JWT)** + label "via JWT", botão sair.
- **History Rail:** pílulas dos últimos ~20 crash points, código de cores (ver abaixo).
- **Stage (gráfico):** aspect-ratio 16:9.
  - Badge **SEED** (hash) no topo-esq → abre modal provably-fair.
  - Badge **LIVE/Apostas/Rodada#** no topo-dir.
  - Curva neon SVG (área + linha + orbe na ponta) construída a partir do multiplicador.
  - Readout central: multiplicador gigante (mono, tabular) + legenda (Subindo/Crash!).
  - Fase de apostas: anel de **contagem regressiva** + "Faça sua aposta".
- **Bet Controls:** input com validação (R$, min 1 / max 1.000), steppers ±,
  quick-bets (½, 2×, +10, +50, Máx), **Auto cash-out** (toggle + alvo ×),
  botão de ação **contextual**, linha de saldo.
- **Bets List (rodada atual):** total apostado + nº de saques; linhas com avatar,
  username, valor, status (em jogo / sacou em X.XX× +R$ / perdeu). Jogador destacado.
- **Session Stats:** P&L, rodadas, melhor saque, total apostado.
- **Toasts:** sucesso / erro / dourado (cash out) / info.
- **Fairness Modal:** hash (commit) + seed revelada + nonce + crash point.

---

## Bet button — máquina de estados (contextual)
O botão de ação principal muda conforme a fase + estado da aposta:
| Condição | Rótulo | Estilo |
|---|---|---|
| BETTING, sem aposta, válido | **Apostar** `valor` | `cta-bet` (accent) habilitado |
| BETTING, sem aposta, inválido | Apostar (desabilitado) | accent opaco |
| BETTING, com aposta | **Aposta confirmada · valor** (toque p/ cancelar) | `cta-open` |
| RUNNING, aposta ativa | **CASH OUT** `payout · mult×` | `cta-cash` (verde, pulsa) |
| RUNNING, já sacou | **Sacou em X.XX×** +R$ | `cta-done` |
| RUNNING, sem aposta | Rodada em andamento | `cta-wait` |
| CRASHED | Próxima rodada… | `cta-wait` |

## Regras de negócio (validação no cliente — re-valide no servidor!)
- Aposta mínima **1,00**, máxima **1.000,00**.
- Saldo insuficiente → rejeita + toast de erro.
- Uma aposta por rodada (sem dupla).
- Apostar só na fase BETTING; cash out só em RUNNING com aposta `placed`.
- Sem aposta → não pode sacar.

---

## Interactions & Behavior
- **Loop do multiplicador:** `m = e^(growth · elapsedMs)`, `growth ≈ 0.000098`
  (no real: derivar do tempo do servidor; **nunca** confiar no relógio do cliente).
- **Curva:** redesenhada a cada frame via `requestAnimationFrame`, janela deslizante
  (ponta ~80% da largura), eixo Y auto-escala (`yMax = max(1.9, m·1.28)`).
- **Crash:** stage faz `shake` + flash vermelho; multiplicador fica vermelho com `pop`;
  pílula entra no histórico.
- **Cash out:** flash dourado/verde no stage + toast + atualização de saldo/stats.
- **Countdown:** anel SVG `stroke-dashoffset` + número com 1 casa decimal.
- **Skeletons:** history rail e bets list mostram placeholders shimmer quando vazios.
- **Responsivo:** grid colapsa para 1 coluna < 980px; topbar compacta < 560px.

## Provably Fair
- **Commit:** antes da rodada, publica `hash = SHA-256(serverSeed:clientSeed:nonce)`.
- **Reveal:** após o crash, revela `serverSeed` + `clientSeed` + `nonce`; jogador
  recomputa o hash e o crash point.
- **Crash point:** derivado do hash com **house edge** (~1%) e chance de bust instantâneo.
- No real: implemente como **hash chain** no Game Service e exponha
  `GET /games/rounds/:roundId/verify`.

## State Management (sugestão para o real)
- **Server state (TanStack Query):** `wallet/me`, `rounds/current`, `rounds/history`, `bets/me`.
- **Realtime (WebSocket → store):** estado da rodada/fase, multiplicador, lista de
  apostas/cash outs, evento de crash + dados de verificação.
- **Client state (Zustand):** valor do input, auto-cashout (on/alvo), preferências (som/tema).
- **Sincronização do multiplicador:** servidor envia `roundStartTime` + `crashPoint`
  (no crash); cliente interpola localmente entre ticks para suavidade.

---

## Design Tokens

### NovaX (v1 — `styles.css`)
Cores
- `--bg #0a0c11` · `--bg-2 #0e1117` · `--panel rgba(255,255,255,.035)` · `--panel-solid #14171e`
- `--border rgba(255,255,255,.08)` · `--border-strong rgba(255,255,255,.16)`
- Texto: `--fg-1 #e8eaef` · `--fg-2 #8b93a7` · `--fg-3 #6b7280` · `--fg-4 #565e6e`
- Accent (themeable): `--accent #2bf5b0` (mint) · `--accent-2 #16c8e8` · `--accent-ink #04130d`
- Temas alternativos: Azul `#3e7fe9`/`#64a0ff` · Lime `#c6f135` · Magenta `#ff4dd2` · Gold `#ffb020`
- Semânticos: `--gold #ffc24b` · `--danger #ff3b6b` · `--win #2bf5b0` · `--info #64a0ff`

Tipografia
- Sans: **Inter** (300–800) · Mono: **JetBrains Mono** (400–700)
- Multiplicador: mono 700, `clamp(48px,9vw,104px)`, `letter-spacing -0.02em`, tabular-nums
- Labels: mono, 9–11px, `letter-spacing .12em`, uppercase, `--fg-4`

Raios / motion
- `--r-sm 10` · `--r 14` · `--r-lg 18` · `--r-pill 100px`
- `--ease cubic-bezier(.4,0,.2,1)` · `--spring cubic-bezier(.34,1.56,.64,1)` · `--dur .28s`

### Histórico — código de cores (limiares)
- `< 2.00×` → **vermelho** (`low`)
- `2–5×` → **dourado** (`mid`)
- `5–20×` → **verde/accent** (`high`)
- `≥ 20×` → **épico** (gradiente accent com glow)

> Há também uma direção alternativa **"Crash Terminal"** (`terminal.css`) — estética
> de mesa de trading (Martian Mono + JetBrains Mono, âmbar Bloomberg `#FFB000`,
> verde `#19E08A`, vermelho `#FF3B5C`, fundo papel-grid). Use se preferir um visual
> mais "engenharia/dados". Tokens no topo do arquivo.

## Assets
- Sem imagens externas. Ícones desenhados inline (SVG, stroke 2). Fontes via Google Fonts.
- Fontes: Inter + JetBrains Mono (v1); Martian Mono + JetBrains Mono (terminal).

## Files
- `login.html` — tela de login (fluxo OIDC simulado).
- `CrashGame.html` — tela principal (monta os componentes React).
- `styles.css` — design tokens + estilos da v1 (NovaX).
- `engine.js` — lógica de domínio (fases, curva, provably-fair, validações). Espelho do Game Service.
- `components.jsx` — gráfico, stage, countdown, history rail.
- `components2.jsx` — controles de aposta, lista, stats, toasts, modal de fairness.
- `app.jsx` — wiring (auth, assinatura do motor, saldo, toasts, tema dinâmico).
- `tweaks-panel.jsx` — painel de ajustes ao vivo (tema/timer/som) — só para o protótipo.
- `terminal.css` — tokens/estilos da direção alternativa "Crash Terminal".

### Como rodar o protótipo
Abra `login.html` em um servidor estático (os `.jsx` são transpilados no navegador via Babel).
Entre com qualquer usuário → cai na tela do jogo.
