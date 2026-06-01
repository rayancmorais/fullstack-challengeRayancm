# Crash Game — Fullstack Challenge

Projeto fullstack desenvolvido como desafio técnico para a Jungle Gaming. É um crash game multiplayer em tempo real: um multiplicador sobe a partir de `1.00x` e pode "crashar" a qualquer momento. Jogadores apostam antes da rodada e precisam sacar antes do crash para garantir os ganhos — quem não saca, perde.

**Bônus implementados:** Auto-cashout server-side · Auto-bet Martingale · Leaderboard · Efeitos sonoros · CI GitHub Actions · Rate limiting Kong · Swagger/OpenAPI · Animação SVG customizada

---

## Credenciais de acesso

| Serviço             | Usuário  | Senha       |
| ------------------- | -------- | ----------- |
| Keycloak Admin      | `admin`  | `admin`     |
| RabbitMQ Management | `admin`  | `admin`     |
| Jogador de teste    | `player` | `player123` |

---

## Arquitetura

```
Frontend (Next.js · porta 3001)
    │
    ├── REST/HTTP ──────────────────────────────────────►
    │                  Kong API Gateway (porta 8000)
    │                      ├── /games/*   → Game Service  (porta 4001)
    │                      └── /wallets/* → Wallet Service (porta 4002)
    │
    └── WebSocket (/jogo) ──────────────────► Game Service direto
                                                  (porta 4001)
                                                      │
                                               ┌──────┴──────┐
                                          RabbitMQ       PostgreSQL
                                         (AMQP 5672)      (5432)

Keycloak (8080) — valida JWT em ambos os serviços via JWKS (RS256)
```

**Dois bounded contexts:**

- **Game Service** — ciclo de vida das rodadas, apostas, provably fair, WebSocket push, RabbitMQ publisher/consumer
- **Wallet Service** — saldo do jogador, crédito/débito acionados exclusivamente via RabbitMQ (nunca HTTP direto entre serviços)

---

## Stack

| Camada      | Tecnologia                               | Versão     |
| ----------- | ---------------------------------------- | ---------- |
| Runtime     | Bun                                      | 1.3.x      |
| Backend     | NestJS + TypeScript strict               | 10.x / 5.x |
| ORM         | Prisma                                   | 7.x        |
| Banco       | PostgreSQL                               | 18.3       |
| Mensageria  | RabbitMQ                                 | 4.2.4      |
| API Gateway | Kong (DB-less/declarativo)               | 3.9.1      |
| IdP         | Keycloak                                 | 26.5.5     |
| WebSocket   | socket.io via @nestjs/websockets         | 4.x        |
| Frontend    | Next.js (App Router, standalone)         | 15.5       |
| Estado WS   | Zustand                                  | 5.x        |
| Estado REST | TanStack Query                           | 5.x        |
| Auth UI     | OIDC customizado (PKCE S256 + ROPC demo) | —          |
| CSS         | Tailwind CSS                             | v4         |

---

## Como rodar

**Pré-requisitos:** Docker, Docker Compose, Bun >= 1.x

```bash
git clone <repo>
cd fullstack-challenge
bun install
bun run docker:up
```

Aguarda todos os healthchecks passarem (~30–60s). O Keycloak leva um pouco mais na primeira vez que baixar a imagem.

O frontend abre em `http://localhost:3001`. O login usa o usuário `player` / `player123` pré-configurado.

## Variáveis de Ambiente

Os arquivos `.env` não estão no repositório por segurança.
Cada serviço tem um `.env.example` com os valores padrão para desenvolvimento local.

Para configurar manualmente (não necessário com Docker):

```bash
cp services/games/.env.example services/games/.env
cp services/wallets/.env.example services/wallets/.env
cp frontend/.env.local.example frontend/.env.local
```

Com `bun run docker:up` as variáveis são injetadas automaticamente pelo Docker Compose — não é necessário criar os arquivos `.env` manualmente para rodar o projeto.

### Autenticação — Nota sobre o flow de login

O fluxo principal implementado é **Authorization Code + PKCE (S256)**, conforme especificado pelo desafio. O frontend possui também uma função `loginDireto()` que usa o **Resource Owner Password Credentials (ROPC)**, utilizada para facilitar testes locais (preenche usuário/senha automaticamente e autentica sem redirecionar ao Keycloak).

> **Limitação conhecida:** ROPC é deprecated no OAuth 2.1 e não deve ser usado em produção (expõe credenciais ao cliente, não é compatível com MFA). Em produção, o flow seria substituído integralmente pelo Authorization Code + PKCE — o código para isso já existe em `lib/oidc.ts` (`iniciarLogin`, `trocarCodePorToken`, `renovarToken`).

### Bots e jogadores simulados

Os jogadores simulados ("bots") exibidos na interface são **gerados no frontend** para fins de demonstração visual — criam apostas fictícias com timings e valores aleatórios, replicando a experiência de uma partida com múltiplos jogadores.

> A lógica real do jogo roda **inteiramente no servidor** — apostas e saques reais são validados pelo Game Service (DDD + RabbitMQ), e o saldo é debitado/creditado pelo Wallet Service. Os bots não interagem com o backend e não afetam o resultado de nenhuma rodada.

---

## Endpoints

| Serviço                 | URL                                             |
| ----------------------- | ----------------------------------------------- |
| Frontend                | http://localhost:3001                           |
| Game Service (direto)   | http://localhost:4001                           |
| Wallet Service (direto) | http://localhost:4002                           |
| Kong (API Gateway)      | http://localhost:8000                           |
| Kong Admin API          | http://localhost:8001                           |
| Keycloak Admin          | http://localhost:8080                           |
| RabbitMQ Management     | http://localhost:15672                          |
| Swagger Games           | Swagger Games: http://localhost:8000/games/docs |
| Swagger Wallets         | http://localhost:4002/docs                      |

### REST — Game Service (via Kong em `/games`)

| Método | Endpoint                        | Auth | Descrição                                                 |
| ------ | ------------------------------- | ---- | --------------------------------------------------------- |
| GET    | `/rounds/current`               | não  | Estado da rodada ativa com lista de apostas               |
| GET    | `/rounds/history?limit=N`       | não  | Histórico paginado de rodadas encerradas                  |
| GET    | `/rounds/:id/verify`            | não  | Dados de verificação provably fair da rodada              |
| GET    | `/leaderboard?period=24h\|week` | não  | Top 10 jogadores por lucro no período                     |
| GET    | `/bets/me`                      | sim  | Histórico de apostas do jogador autenticado               |
| POST   | `/bet`                          | sim  | Apostar na rodada atual (`valorCentavos`, `autoCashout?`) |
| POST   | `/bet/cashout`                  | sim  | Sacar no multiplicador atual                              |

### REST — Wallet Service (via Kong em `/wallets`)

| Método | Endpoint         | Auth | Descrição                                             |
| ------ | ---------------- | ---- | ----------------------------------------------------- |
| POST   | `/wallets`       | sim  | Cria carteira para o jogador autenticado              |
| GET    | `/wallets/me`    | sim  | Retorna saldo atual em centavos                       |
| POST   | `/wallets/reset` | sim  | Reseta saldo para R$ 1.000.000,00 (rate-limit: 1/min) |

### WebSocket — namespace `/jogo` (porta 4001 direto)

Apenas server-push. Ações do jogador vão por REST.

| Evento                  | Quando                    | Payload principal                                 |
| ----------------------- | ------------------------- | ------------------------------------------------- |
| `rodada:apostas`        | Fase de apostas abre      | `rodadaId`, `hashSeedServidor`, `encerraEm`       |
| `rodada:iniciada`       | Rodada começa             | `rodadaId`, `iniciadoEm`                          |
| `rodada:tick`           | A cada 100ms              | `multiplicador`                                   |
| `rodada:crash`          | Rodada termina            | `rodadaId`, `pontoCrash`, `seedServidor`          |
| `aposta:registrada`     | Nova aposta confirmada    | `jogadorId`, `nomeUsuario`, `valorCentavos`       |
| `aposta:saque`          | Cashout de um jogador     | `jogadorId`, `pagamentoCentavos`, `multiplicador` |
| `aposta:cancelada`      | Débito falhou             | `jogadorId`, `motivo`                             |
| `aposta:credito_falhou` | Crédito falhou após saque | `jogadorId`, `apostaId`                           |

---

## Testes

```bash
# Unitários — sem Docker
cd services/games   && bun test tests/unit   # 48 testes (Round 22, Bet 14, Provably Fair 12)
cd services/wallets && bun test tests/unit   # 23 testes (Wallet entity + Use Cases)
cd frontend         && bun test              # 20 testes (lib/utils)

# Arquivo específico
cd services/games && bun test tests/unit/round.test.ts

# E2E — requer docker:up + imagem atualizada
docker compose build games && docker compose restart games
cd services/games && bun test tests/e2e     # 11 cenários
```

**91 testes unitários** + **11 cenários E2E** (bet→cashout→saldo, bet→crash→perdido, validações).

---

## Decisões de arquitetura

### DDD com 4 camadas

Cada serviço segue `domain → application → infrastructure → presentation`. A camada `domain` é TypeScript puro — zero NestJS, zero Prisma. Isso permite testar regras de negócio sem nenhum mock de framework.

O Game Service usa `ErroDominio` (throw) para violações. O Wallet Service usa `Resultado<T>` (return type discriminado). Os dois estilos coexistem intencionalmente.

A comunicação entre `Application` e `Presentation` é desacoplada via interface: `IPublicadorEventos` (em `application/`) define o contrato de emissão de eventos WebSocket. `GameGateway` (em `presentation/`) implementa a interface e é injetado via token `PUBLICADOR_EVENTOS`. O `GameEngineService` depende apenas da abstração, nunca do Gateway concreto.

### Prisma 7 — nova configuração de datasource

O Prisma 7 mudou: a URL saiu do `schema.prisma` e foi para `prisma.config.ts`. A documentação ainda é fraca nisso e tomou um tempo de debugging até descobrir.

### Dinheiro como BigInt centavos

Todo valor monetário é `BIGINT` no banco e `BigInt` no TypeScript. `R$1,50 = 150n`. `JSON.stringify` lança erro em BigInt, então os DTOs serializam como `string`. Consumidores RabbitMQ recebem como `number` e reconvertem com `BigInt(value)`.

### Provably Fair

Cada rodada gera um `seedServidor` aleatório antes das apostas. O `hashSeedServidor` (SHA-256 do seed) é exposto ao jogador antes do crash. Após a rodada, o seed é revelado — o jogador pode recalcular o crash point de forma independente e verificar que não houve manipulação.

Cálculo: `HMAC-SHA256(seedServidor, roundId)` → normalizado para `[0, 1)` → fórmula com house edge de 4%.

### WebSocket direto, REST via Kong

REST passa pelo Kong (strip path, logging). WebSocket conecta direto no Game Service (porta 4001) — o Kong em modo DB-less tem limitações com o upgrade HTTP→WS em algumas configurações.

### Comunicação assíncrona via RabbitMQ

Game e Wallet nunca fazem HTTP entre si. Fluxo de aposta:

```
Player aposta
  → Game publica bet.debit.requested  → [wallet.commands]
  → Wallet consome, debita
  → Wallet publica bet.debit.confirmed → [game.events]
  → Game confirma a aposta (ou cancela se bet.debit.failed)

No cashout:
  → Game publica bet.credit.requested → [wallet.commands]
  → Wallet credita
  → Wallet publica bet.credit.confirmed → [game.events]
  → Game loga sucesso (ou trata bet.credit.failed com alerta WS)
```

Sem Outbox/Saga: se o broker cair entre o publish e o ACK, a mensagem pode ser perdida.
Em produção seria necessário um outbox transacional para garantia at-least-once.

---

## Bônus implementados

| Bônus                                    | Status | Detalhe                                                                     |
| ---------------------------------------- | ------ | --------------------------------------------------------------------------- |
| Auto-cashout no servidor                 | ✅     | `autoCashout` persistido na aposta; `verificarAutoCashouts()` a cada tick   |
| Auto-bet (Martingale/fixo)               | ✅     | `useAutoBetController` hook + `AutoBetPanel.tsx`                            |
| Efeitos sonoros                          | ✅     | Web Audio API (blips) + `rise.mp3` loop + `boom.mp3` no crash               |
| Leaderboard                              | ✅     | `GET /leaderboard?period=24h\|week` + SQL raw + frontend com TanStack Query |
| CI (GitHub Actions)                      | ✅     | `.github/workflows/ci.yml` — jobs paralelos, cache Bun, build-check Docker  |
| Rate limiting (Kong)                     | ✅     | 60 req/min em POST /games; 1 reset/min em POST /wallets/reset               |
| Swagger/OpenAPI                          | ✅     | `/games/api` e `/wallets/api` via Kong                                      |
| Animação SVG customizada (fase de crash) | ✅     | Asteroide + planeta com expressões, escudo, explosão, confetes              |
