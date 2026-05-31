# Checklist — Critérios de Avaliação

---

## Critérios Eliminatórios

| # | Critério | Status | Evidência |
|---|---------|--------|-----------|
| 1 | `bun run docker:up` sobe tudo sem passos manuais | ✅ | `docker-compose.yml` com healthchecks encadeados; Keycloak realm auto-importado; Kong declarativo; migrations automáticas no `onModuleInit` |
| 2 | Gameplay: apostar → multiplicador sobe → cashout → saldo atualizado | ✅ | `POST /games/bet` → RabbitMQ debit → `POST /games/bet/cashout` → RabbitMQ credit → `GET /wallets/me` reflete novo saldo |
| 3 | Gameplay: apostar → crash → aposta marcada como perdida | ✅ | `GameEngineService.encerrarRodada()` chama `round.crashar()` que marca todas as apostas PENDENTE → PERDIDO |
| 4 | Dois serviços separados comunicando via RabbitMQ | ✅ | Fila `wallet.commands` (Games → Wallets) e `game.events` (Wallets → Games); zero HTTP direto entre serviços |
| 5 | Sincronização em tempo real — múltiplas abas mostram o mesmo estado | ✅ | WebSocket namespace `/jogo`; `rodada:tick` a cada 100ms broadcast para todos os clientes conectados |
| 6 | Zero ponto flutuante para dinheiro — saldo nunca negativo | ✅ | `BIGINT` no banco, `BigInt` no TypeScript; cálculo de payout: `(valorCentavos * BigInt(Math.floor(mult * 100))) / 100n`; `Wallet.debit()` lança `ErroDominio` se saldo insuficiente |
| 7 | JWT validado no backend via Keycloak JWKS (RS256) | ✅ | `KeycloakJwtStrategy` em ambos os serviços; JWKS URI em `http://keycloak:8080/realms/crash-game/protocol/openid-connect/certs`; sem round-trip por request |
| 8 | Testes unitários existem — camada de domínio | ✅ | 63 testes unitários: Round (22), Bet (14), Provably Fair (12), Wallet (15) |
| 9 | Testes E2E existem | ✅ | 8 cenários em `services/games/tests/e2e/game.e2e.test.ts` |

---

## Critérios de Pontuação

### DDD e Arquitetura (25%)

| Item | Status | Detalhe |
|------|--------|---------|
| 4 camadas em ambos os serviços | ✅ | `domain/` `application/` `infrastructure/` `presentation/` — sem vazamentos entre camadas |
| Domain sem dependências de framework | ✅ | `domain/` importa apenas TypeScript puro e a própria lib de domínio |
| Agregado `Round` com invariantes | ✅ | Transições de estado protegidas; `registrarAposta`, `sacar`, `iniciar`, `crashar` validam estado antes de mudar |
| Entidade `Wallet` com regras de negócio | ✅ | `debit()` e `credit()` retornam `Resultado<T>` — nunca exceções inesperadas |
| Repositório como abstração | ✅ | `abstract class` como token de DI (NestJS precisa de valor em runtime) |
| Comunicação entre bounded contexts via eventos | ✅ | RabbitMQ; nenhum import cruzado entre `services/games` e `services/wallets` |

### Qualidade de Código (20%)

| Item | Status | Detalhe |
|------|--------|---------|
| TypeScript strict | ✅ | `strict: true` no `tsconfig.json` de ambos os serviços |
| Nomes em português (regra de negócio) | ✅ | Variáveis, métodos, erros e testes em PT; exceções documentadas no CLAUDE.md |
| Sem `any` explícito no código de produção | ✅ | Tipos `RegistroBancoDadosRound` e `RegistroBancoDadosBet` substituíram os `any` iniciais |
| Commits atômicos | ✅ | Um commit por funcionalidade (ver git log) |

### Testes (20%)

| Item | Status | Detalhe |
|------|--------|---------|
| Happy path dos domain objects | ✅ | Criação, operações válidas, cálculos de pagamento |
| Cenários de erro / violações | ✅ | Saldo insuficiente, aposta dupla, estado inválido, transição proibida |
| Provably fair determinístico | ✅ | Mesmo seed + roundId → mesmo crash point, sempre |
| E2E cobrindo o fluxo completo | ✅ | bet → multiplicador → cashout → saldo; bet → crash → perdido |

### Frontend/UX (15%)

| Item | Status | Detalhe |
|------|--------|---------|
| Dark mode estética de cassino | ✅ | Tailwind v4 com fundo escuro e acentos vibrantes |
| Gráfico do multiplicador animado | ✅ | `CrashGraph.tsx` com SVG dinâmico e curva exponencial |
| Contagem regressiva na fase de apostas | ✅ | `CountdownOverlay.tsx` com timer baseado em `encerraEm` do servidor |
| Lista de apostas em tempo real | ✅ | `BetsList.tsx` atualizado via WebSocket com status colorido |
| Histórico de rodadas | ✅ | `HistoryRail.tsx` com código de cores (verde alto, vermelho baixo) |
| Estatísticas de sessão | ✅ | `SessionStats.tsx` com P&L, melhor saque, total apostado |
| Toast notifications | ✅ | `Toasts.tsx` com 4 tipos e auto-dismiss |
| Verificação provably fair na UI | ✅ | `FairModal.tsx` com hash, seed e recálculo do crash point |
| Auto-cashout | ✅ | Configurável no `BetControls.tsx` com multiplicador alvo |

### Provably Fair (10%)

| Item | Status | Detalhe |
|------|--------|---------|
| Hash chain verificável | ✅ | `hashSeedServidor = SHA-256(seedServidor)` exposto antes do crash; seed revelado depois |
| Cálculo determinístico | ✅ | `HMAC-SHA256(seedServidor, roundId)` → normalizado → fórmula com house edge 4% |
| Endpoint de verificação | ✅ | `GET /rounds/:id/verify` retorna `hashSeedServidor`, `seedServidor` (se crashada) e `pontoCrash` |
| Testes de verificação | ✅ | 12 testes unitários cobrindo determinismo, hash chain e fluxo completo do jogador |

### Histórico Git (10%)

| Item | Status | Detalhe |
|------|--------|---------|
| Commits com mensagens descritivas | ✅ | Progressão lógica por funcionalidade (ver git log) |
| Progressão lógica — uma task por commit | ✅ | Entidade → repositório → use case → controller → testes |

---

## Bônus Implementados

| Bônus | Status | Detalhe |
|-------|--------|---------|
| Auto-cashout | ✅ | Configurável no frontend com alvo de multiplicador |
| Swagger/OpenAPI | ✅ | Acessível em `/games/api` e `/wallets/api` via Kong |

## Bônus Não Implementados

| Bônus | Status |
|-------|--------|
| Outbox/Inbox transacional (at-least-once) | ❌ |
| Observabilidade (OpenTelemetry + Grafana) | ❌ |
| Seed determinística para E2E | ❌ |
| Efeitos sonoros | ❌ |
| Leaderboard | ❌ |
| CI pipeline (GitHub Actions) | ❌ |
| Playwright (E2E browser) | ❌ |
| Rate limiting via Kong | ❌ |
| Storybook | ❌ |
