# Bônus — Especificações de Implementação

Guia para implementar os recursos bônus do desafio. Os **bônus de frontend** já
estão demonstrados no protótipo (`CrashGame.html`); os **de backend/infra** estão
especificados aqui para você implementar no stack real (NestJS + Bun + Docker).

> Use como referência de *o que fazer e por quê*. Entenda cada decisão — o desafio
> prevê arguição e desclassifica "IA sem entendimento".

---

## ✅ Bônus já demonstrados no protótipo (frontend)

### Auto cashout
- UI: toggle + alvo `×` nos controles de aposta (`components2.jsx` → `BetControls`).
- Lógica no protótipo: a cada tick, se `multiplier >= alvo` e há aposta `placed`, saca.
- **No real:** o auto-cashout deve rodar no **servidor** (Game Service), não só no cliente —
  senão lag/desconexão fariam o jogador perder o saque. Cliente envia o alvo ao apostar
  (`POST /games/bet { amount, autoCashout }`); o servidor executa o saque no tick em que
  `multiplier >= autoCashout`. O cliente mostra o alvo e reflete o resultado via WS.

### Auto bet (Martingale / valor fixo + stop-loss/stop-win)
- UI: `bonus.jsx` → `AutoBetPanel` (estratégia, base, alvo, multipl. na perda, nº de
  rodadas, stop-loss, stop-win) + controlador em `app.jsx` (`startAutoBet`,
  `resolveAutoBet`, `stopAutoBet`).
- Regras: **fixo** = mesma aposta sempre; **Martingale** = dobra (×`onLoss`) após perda,
  reseta na vitória. Para ao atingir nº de rodadas, stop-win (lucro acumulado ≥ alvo) ou
  stop-loss (prejuízo acumulado ≥ limite), ou saldo insuficiente.
- **No real:** mantenha a estratégia no **cliente** (é preferência de UX), mas cada aposta
  individual passa pelo fluxo normal `POST /games/bet`. O servidor nunca confia na
  sequência — valida cada aposta isoladamente (saldo, fase, limites).

### Efeitos sonoros
- `app.jsx` → objeto `Sound` (WebAudio): `bet()`, `cashout()`, `crash()`. Toggle nos Tweaks.
- **No real:** pré-carregue assets de áudio curtos; respeite `prefers-reduced-motion`/mudo;
  persista a preferência.

### Leaderboard (top por lucro 24h/semana)
- UI: `bonus.jsx` → `Leaderboard` com toggle de período e ranking colorido (1º ouro etc.).
- **No real:** endpoint `GET /games/leaderboard?period=24h|week` no Game Service, agregando
  PnL por jogador (materialized view ou query com `SUM(payout - amount)` por janela de tempo).
  Considere cache (Redis) com TTL curto. Atualize via WS opcionalmente.

### Fórmula da curva na UI
- `components2.jsx` → `FairModal` exibe `m(t)=e^(k·t)` e o cálculo do crash point.
- **No real:** mantenha a fórmula sincronizada com a implementação do servidor.

---

## 🔧 Bônus de backend / infra (implementar no stack real)

### 1. Outbox / Inbox transacional (at-least-once + exactly-once)
**Problema:** ao debitar a carteira e publicar um evento, se o broker cair entre o commit
do banco e o publish, você perde o evento (ou duplica). Outbox resolve isso.

- **Outbox (producer):** na MESMA transação do banco que muda o estado (ex: criar aposta,
  debitar saldo), insira o evento numa tabela `outbox_messages (id, aggregate_id, type,
  payload, created_at, processed_at)`. Um **relay** (poller ou CDC/Debezium) lê as não
  processadas e publica no RabbitMQ, marcando `processed_at`. Garante **at-least-once**.
- **Inbox (consumer):** ao receber um evento, antes de processar, tente inserir seu `id`
  numa tabela `inbox_messages (message_id PK, processed_at)`. Se violar a PK → já foi
  processado → descarta (idempotência). Garante **exactly-once processing**.
- **NestJS:** envolva a escrita de domínio + insert no outbox num `EntityManager`
  transacional (MikroORM/Prisma `$transaction`/TypeORM `QueryRunner`). Relay como
  `@Interval()` ou um worker dedicado. Documente a escolha no README.
- **Sagas/compensação:** fluxo de aposta = Game cria `Bet(pending)` → publica
  `BetPlaced` → Wallet tenta debitar → publica `WalletDebited` ou `WalletDebitFailed` →
  Game confirma `Bet(active)` ou cancela (`Bet(rejected)`). No cashout: Game calcula
  payout → `CashoutRequested` → Wallet credita → `WalletCredited`. Defina os **eventos,
  estados e compensações** explicitamente (isso é avaliado).

### 2. Observabilidade (OpenTelemetry + Prometheus + Grafana)
- **Tracing:** instrumente ambos os serviços com `@opentelemetry/sdk-node` + auto-instr
  (HTTP, AMQP, ORM). Propague contexto através das mensagens RabbitMQ (inject/extract nos
  headers) para traces ponta-a-ponta REST→broker→serviço.
- **Métricas (Prometheus):** exponha `/metrics`. Métricas de jogo sugeridas:
  - `crash_round_total` (counter), `crash_point` (histogram) → RTP real vs. teórico
  - `bet_volume_total` (counter, por outcome), `bet_amount` (histogram)
  - `ws_event_latency_seconds` (histogram) — do `_emit` no servidor ao ack do cliente
  - `wallet_balance_operations_total`, `payout_total`
- **Grafana:** dashboard provisionado (`docker/grafana/`) com RTP, volume de apostas,
  distribuição de crash points, latência WS. Adicione Prometheus + Grafana ao compose.

### 3. Seed determinística para testes E2E
- Script `bun run seed:e2e` que popula Postgres + estado do broker de forma reproduzível.
- **Provably-fair determinístico:** aceite um `serverSeed` fixo via env para forçar crash
  points específicos (ex: sequência `[1.5, 2.0, 1.0, 10.0]`). Como o crash point é
  `f(hash(serverSeed:clientSeed:nonce))`, seeds fixas → resultados fixos.
- Útil para os testes E2E exigidos: "apostar→crash→perdeu" precisa de um crash em 1.0x
  garantido; "apostar→subir→cashout" precisa de um crash alto.

### 4. CI pipeline (GitHub Actions)
- `.github/workflows/ci.yml`: em `push`/`pull_request` → `bun install` → lint →
  `bun test` (unit) nos dois serviços → build. E2E opcional com `docker compose up -d`
  + healthcheck antes de rodar.
- Cache do Bun; matriz por serviço; status checks obrigatórios no PR.

### 5. Playwright (E2E de browser)
- `frontend/e2e/`: simula o fluxo real — login (mock do Keycloak ou usuário de teste),
  apostar na fase de apostas, aguardar multiplicador, cashout, ver saldo atualizar;
  e o caminho de crash/perda. Use a seed determinística (#3) para resultados estáveis.
- Rode em CI com os serviços de pé.

### 6. Rate limiting (Kong)
- No `docker/kong/kong.yml`, plugin `rate-limiting` nas rotas sensíveis
  (`POST /games/bet`, `/games/bet/cashout`): ex. `minute: 60`, `policy: local` (ou
  `redis` se multi-nó). Retorna 429 — o frontend já tem toast de erro para isso.
- Alternativa na aplicação: `@nestjs/throttler`.

### 7. Storybook (biblioteca de componentes)
- `frontend/.storybook/`. Crie stories para os componentes recriados a partir do
  protótipo: `CrashChart`, `BetControls`, `BetsList`/order-book, `HistoryRail`,
  `Leaderboard`, `AutoBetPanel`, `FairnessModal`, toasts. Use os tokens do design system.
- Bom para isolar estados (fase de aposta, rodada ativa, crash, skeleton/loading).

---

## Ordem sugerida (dado o prazo de 5 dias)
1. **Eliminatórios primeiro:** `docker:up` ok → 2 serviços + RabbitMQ → gameplay
   completo → precisão monetária (centavos/Decimal) → JWT validado → WS sincronizando →
   testes unit + E2E mínimos.
2. **Pontuação:** DDD bem modelado, provably-fair com endpoint `/verify`, frontend fiel
   ao protótipo, cobertura de testes.
3. **Bônus (diferenciais):** Outbox/Inbox → seed determinística → auto-cashout no servidor
   → observabilidade → CI → Playwright → rate limiting → Storybook → leaderboard.
