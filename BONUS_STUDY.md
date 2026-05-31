# Bônus — Guia de Estudo e Apresentação

## O que foi implementado e por quê

### 1. Rate Limiting (Kong)

**O que é:** limita o número de requisições por minuto por IP/consumer.

**Por que:** protege o backend de abuse/spam de apostas. Sem isso, um script poderia
fazer centenas de POSTs por segundo, sobrecarregando o Game Service e tentando explorar
condições de corrida no multiplicador.

**Como funciona no kong.yml:**
- Criada uma rota `games-post-routes` que captura apenas `methods: [POST]` no path `/games`
- Kong usa prioridade por especificidade: rota com método explícito ganha da rota genérica
- Resultado: POST /games/bet e POST /games/bet/cashout → rate-limited (60/min)
- GET /games/rounds/current e outros GETs → sem rate-limit (rota `games-routes`)
- O plugin retorna `429 Too Many Requests` com header `RateLimit-Remaining` quando esgotado
- `policy: local` = contador por nó Kong. Para multi-nó usaria `policy: redis`

**Headers que o Kong adiciona:**
```
RateLimit-Limit: 60
RateLimit-Remaining: 59
RateLimit-Reset: <segundos até reset>
X-RateLimit-Limit-Minute: 60
X-RateLimit-Remaining-Minute: 59
```

**O que dizer na arguição:** "O Kong atua como API Gateway e centraliza políticas de
segurança como rate limiting, evitando que cada serviço implemente isso separadamente.
A separação em rotas por método permite limitar apenas as ações de escrita (apostar,
sacar) sem penalizar leituras de estado como GET /rounds/current."

---

### 2. Efeitos Sonoros (Web Audio API)

**O que é:** feedback de áudio para as ações do jogo usando Web Audio API — sem arquivos
de áudio externos, sons gerados programaticamente por osciladores.

**Por que Web Audio API e não arquivos .mp3/.ogg?**
- Sem latência de carregamento de assets
- Sons gerados em runtime com frequência e envelope precisos
- Funciona offline, sem CDN
- Menor bundle size

**Como funciona — arquitetura:**

```
Sound (singleton em lib/sound.ts)
  ├── ctx: AudioContext (criado na primeira interação — restrição do browser)
  ├── on: boolean (sincronizado com store.somAtivo)
  └── blip(freq, dur, type, vol)
        ├── createOscillator() — gera onda (sine/triangle/sawtooth)
        ├── createGain() — controla volume com envelope
        └── exponentialRampToValueAtTime — fade-out suave

Sons implementados:
  bet()     → 440Hz, 80ms, sine    — toque limpo de confirmação
  cashout() → 660Hz + 990Hz com 90ms delay, triangle — melodia de vitória
  crash()   → 140Hz, 400ms, sawtooth — som grave/ominoso
```

**Por que browsers bloqueiam AudioContext na inicialização?**
Por política de autoplay — o browser exige interação do usuário antes de permitir áudio.
O `Sound.init()` registra listeners em `pointerdown` e `keydown` para chamar
`ctx.resume()` no primeiro gesto. Isso garante que o áudio funcione sem pop-ups de
permissão.

**Fluxo de ativação:**
1. App abre → `Sound.init()` registra listeners (GamePage useEffect)
2. `store.somAtivo` sincroniza com `Sound.on` (outro useEffect)
3. Usuário clica qualquer coisa → AudioContext desbloqueado
4. WebSocket emite `rodada:crash` → `useGameSocket` chama `Sound.crash()`

**Toggle persistido:**
- `store.somAtivo` salvo em `localStorage` (chave `'som'`)
- Padrão: som ativo (`true`)
- O valor é lido na inicialização do Zustand store: `localStorage.getItem('som') !== 'false'`
- Botão na Topbar (ícone SVG alto-falante) chama `store.toggleSom()`

**Integração nos eventos WebSocket (`useGameSocket.ts`):**
```ts
socket.on('rodada:crash', (d) => { store.setCrash(d); Sound.crash() })
socket.on('aposta:registrada', (d) => { store.addAposta(d); Sound.bet() })
socket.on('aposta:saque', (d) => { store.setSaque(d); Sound.cashout() })
```

Os sons de outros jogadores também tocam — é intencional. Em crash games reais,
ouvir outros sacando cria tensão e imersão.

**O que dizer na arguição:** "Usei Web Audio API porque não precisava de assets externos —
os sons são gerados por osciladores com envelope de amplitude. O AudioContext requer
desbloqueio por gesto do usuário, então registrei listeners de pointerdown/keydown que
chamam ctx.resume(). O toggle persiste no localStorage para não precisar do middleware
persist do Zustand."

---

### 3. Auto-cashout no Servidor

**O que é:** cliente envia `autoCashout: number` no `POST /games/bet`. O Game Service
armazena o alvo na entidade `Bet`. A cada tick do `processarTick`, antes de verificar
o crash, o engine checa todas as apostas `PENDENTE` com `autoCashout` definido e,
se `multiplicadorAtual >= autoCashout`, executa o saque automaticamente.

**Por que no servidor e não no cliente:**
Se fosse só no cliente, lag de rede ou desconexão WebSocket faria o jogador perder o
saque no multiplicador alvo. No servidor, o saque acontece no próprio loop de tick,
independente de qualquer conexão. O resultado chega ao cliente via evento `aposta:saque`
normalmente — o frontend não sabe se foi saque manual ou automático.

**Decisão de design — mover bet.credit.requested para dentro do engine:**
Antes, o `SacarUseCase` publicava `bet.credit.requested` após chamar `engine.sacar()`.
Para o auto-cashout no tick funcionar sem chamar o use case (que causaria dependência
circular), o publish foi movido para dentro de `GameEngineService.sacar()`. O
`SacarUseCase` virou um wrapper simples. O `PublicadorMensagens` é injetado no engine
via `@Inject(PUBLICADOR_MENSAGENS)`.

**Arquitetura dos arquivos alterados:**
```
prisma/schema.prisma          + autoCashout Float? na tabela apostas
domain/bet/bet.entity.ts      + campo autoCashout (readonly, opcional)
domain/round/round.entity.ts  + validação (min 1.01) e repasse para Bet.criar
application/game-engine.service.ts
  + recebe PublicadorMensagens via @Inject
  + registrarAposta aceita autoCashout?
  + sacar() agora publica bet.credit.requested (era no SacarUseCase)
  + verificarAutoCashouts() chamado a cada tick
application/sacar.use-case.ts simplificado — apenas delega ao engine
application/registrar-aposta.use-case.ts + autoCashout no DTO interno
presentation/dtos/registrar-aposta.dto.ts + campo autoCashout opcional (min 1.01)
presentation/controllers/apostas.controller.ts + repassa autoCashout
infrastructure/prisma-round.repository.ts + persistência e reconstituição
frontend/lib/api.ts + placeBet aceita autoCashout? opcional
frontend/components/GamePage.tsx
  + passa autoTarget ao placeBet quando toggle está ativo
  - remove useEffect de auto-cashout do cliente (conflitava com servidor)
```

**Perguntas prováveis na arguição:**

P: "Por que remover o auto-cashout do cliente se tinha um no frontend?"
R: Com o servidor fazendo o saque, o cliente não precisa mais monitorar o tick.
Manter os dois causaria race condition: o servidor saca primeiro, o evento WS chega,
o cliente tenta sacar novamente e recebe erro "aposta não está ativa". Removendo o
fallback do cliente, o fluxo fica determinístico.

P: "O que acontece se o servidor travar entre o tick de autoCashout e o crash?"
R: O `verificarAutoCashouts()` roda antes de checar o crash na mesma chamada de tick.
Em JavaScript/Bun (single thread), não há preempção — a verificação completa antes do
crash ser processado. Se mesmo assim o crash acontecer antes (próximo tick), a aposta
fica PENDENTE e é marcada como PERDIDA no `round.crashar()`. Isso é comportamento
esperado: o auto-cashout é best-effort dentro do tick resolution de 100ms.

P: "Como você testaria o auto-cashout em E2E?"
R: Com a seed determinística (bônus 6), posso forçar um crash point alto (ex: 10.0x),
apostar com autoCashout: 2.0, e verificar que: (1) a aposta ficou SACADA no banco,
(2) o evento aposta:saque foi emitido via WS, (3) a carteira foi creditada com
valorCentavos * 2.0.

P: "Por que guardar autoCashout no banco e não só em memória?"
R: Em memória seria suficiente para o loop atual, mas se o serviço reiniciar durante
uma rodada (deploy, crash do processo), as apostas pendentes são recarregadas do banco.
Sem o autoCashout persistido, os saques automáticos seriam perdidos nesse cenário.

P: "O cliente ainda vê o auto-cashout acontecer?"
R: Sim. O servidor emite `aposta:saque` via WebSocket igualmente para saques manuais
e automáticos. O frontend exibe o saque na lista de apostas e pode mostrar um toast
diferenciado (o toast já inclui o sufixo "auto-cashout em X×" na confirmação da aposta).

---

### 3. Auto-bet no Frontend

**O que é:** painel de apostas automáticas com estratégias Martingale e Valor Fixo.
O servidor nunca sabe que é auto-bet — valida cada aposta isoladamente pelo fluxo normal.
A inteligência (quando apostar, quanto apostar, quando parar) fica inteiramente no cliente.

**Por que a estratégia fica no cliente:**
O servidor valida apenas regras de negócio (saldo, fase, limite de aposta). Estratégias de
apostas são preferência de UX — colocá-las no servidor acoplaria lógica de produto ao backend
e exigiria re-deploy para ajustes de parâmetros. No cliente, cada `POST /bet` é atômico e
independente.

**Arquivos criados/alterados:**
```
frontend/components/AutoBetPanel.tsx  — componente UI fiel ao bonus.jsx
frontend/components/GamePage.tsx      — controlador (startAutoBet, resolveAutoBet, stopAutoBet)
frontend/app/globals.css              — estilos: .seg, .ab-grid, .mini-input, .ab-toggle, etc.
```

**Fluxo completo (por rodada):**
```
rodada:apostas (WS) → fase = APOSTAS_ABERTAS
  → useEffect detecta transição de fase
  → abRun.current.active? → verifica saldo vs nextStake
  → handleBet(nextStake, target, quiet=true)  ← POST /bet com autoCashout=target
  → placeBet envia { valorCentavos, autoCashout } ao servidor
  → servidor processa tick → auto-cashout dispara no servidor

rodada:crash (WS) → fase = CRASHADO
  → playerBet.status = 'SACOU' ou 'PERDEU'
  → resolveAutoBet(playerBet):
      ganhou → nextStake = base (qualquer estratégia)
      perdeu, fixo → nextStake = base
      perdeu, martingale → nextStake = min(stake × onLoss, R$1.000)
      roundsLeft--
      verificar stopWin / stopLoss / saldo / rodadas
```

**Campos do AutoBetCfg (centavos onde monetário):**
```
base      — aposta base (centavos)
target    — multiplicador de cashout (ex: 2.0)
strategy  — 'fixed' | 'martingale'
onLoss    — fator Martingale (ex: 2.0 = dobra)
rounds    — número de rodadas (0 = infinito)
stopLoss  — prejuízo máximo acumulado (centavos, 0 = desativado)
stopWin   — lucro mínimo para parar (centavos, 0 = desativado)
```

**Runtime em `useRef` e não `useState`:**
`abRun` usa `useRef` porque os valores mudam a cada rodada (a cada 13-15s). Se fosse
`useState`, cada `setAbRun` geraria um re-render completo do `Game` component —
desnecessário e potencialmente conflitante com os renders do store Zustand.
Apenas `setAbTick` (contador dummy) força re-render quando a linha de status precisa atualizar.

**Integração com auto-cashout do servidor (bônus 2):**
Quando auto-bet coloca uma aposta, passa `autoCashout = abRef.current.target` ao `placeBet`.
O servidor irá sacar automaticamente nesse multiplicador. O cliente não precisa monitorar
o tick — apenas aguarda o `rodada:crash` para resolver o resultado.

**Perguntas prováveis na arguição:**

P: "Por que usar useRef para o runtime em vez de estado Zustand?"
R: O runtime muda a cada rodada — colocar no Zustand geraria um action de store por rodada,
subscriptions desnecessárias e possíveis conflitos com os eventos WebSocket que também
escrevem no store. O `useRef` é local ao componente, muta sem causar render, e `setAbTick`
(useState com número) é o mecanismo de re-render controlado.

P: "Como funciona o Martingale nesta implementação?"
R: Ao detectar perda no `resolveAutoBet`, `nextStake = Math.round(valorCentavos × onLoss)`,
limitado a R$1.000 (max do servidor). Na vitória, reseta para `base`. O `stopLoss` serve
exatamente para proteger contra sequências de Martingale que exponencializariam a perda.

P: "O que acontece se a aposta auto-bet falhar (ex: 422 do servidor)?"
R: `handleBet` faz catch do erro, exibe toast de erro e chama `stopAutoBet('Aposta falhou.')`.
A sessão é encerrada imediatamente para evitar loop infinito de apostas rejeitadas.

P: "Por que o auto-bet usa `quiet=true`?"
R: Com auto-bet rodando por 20 rodadas, cada aposta confirmada geraria um toast — 20 toasts
em 5 minutos. Modo silencioso suprime apenas a confirmação individual; erros e o resultado
final da sessão sempre geram toast.

P: "Como a estratégia e os campos se integram com o painel de controle?"
R: `showAutoBet` é um `useState` local que exibe/oculta o `AutoBetPanel`. O botão toggle
fica abaixo do `BetControls`. Quando `abRun.current.active`, o label do botão muda para
'rodando' para feedback visual claro mesmo com o painel fechado.

---

### 4. Leaderboard

**O que é:** ranking top 10 jogadores por lucro líquido (PnL) num período. Backend agrega
apostas resolvidas com SQL bruto. Frontend exibe via TanStack Query com toggle 24h/semana
e destaque para o jogador atual.

**Endpoint:** `GET /games/leaderboard?period=24h|week` → strips `/games` via Kong → Game Service
`GET /leaderboard`. Nenhuma autenticação necessária (ranking é público).

**Query SQL (raw):**
```sql
SELECT
  "jogadorId",
  "nomeUsuario",
  COALESCE(SUM("pagamentoCentavos"), 0) - SUM("valorCentavos") AS pnl,
  COUNT(*) AS rodadas
FROM apostas
WHERE status IN ('SACADO', 'PERDIDO')
  AND "apostadoEm" >= $1          -- cutoff: Date passada pelo controller
GROUP BY "jogadorId", "nomeUsuario"
ORDER BY pnl DESC
LIMIT 10
```

**Por que `$queryRaw` e não `groupBy` do Prisma?**
`groupBy` do Prisma não suporta expressões calculadas como `COALESCE(SUM(...)) - SUM(...)`.
Só suportaria campos simples e `_sum` por coluna — sem lógica condicional entre colunas.
O `$queryRaw` é seguro aqui porque o único parâmetro dinâmico é uma `Date` (o cutoff),
passada como bind parameter pelo template literal (sem risco de SQL injection).

**PnL como BigInt:**
PostgreSQL retorna `BIGINT` para operações sobre colunas BigInt. O Prisma mapeia `bigint`
para `BigInt` do JS. O DTO serializa para `string` (mesmo padrão dos outros campos monetários).
No frontend, `Number(r.pnl)` é seguro para exibição — valores de leaderboard ficam dentro
do range seguro de `Number` mesmo após muitas rodadas.

**Kong:** nenhuma mudança. `games-routes` já captura `GET /games/*` e remove o prefixo.

**Arquivos criados/alterados:**
```
domain/round/round.repository.ts          + interface EntradaLeaderboard + método abstrato
infrastructure/prisma-round.repository.ts + listarLeaderboard() com $queryRaw
presentation/dtos/leaderboard.dto.ts      + LeaderboardEntryDto com posicao
presentation/controllers/rodadas.controller.ts + GET /leaderboard endpoint
frontend/lib/api.ts                        + getLeaderboard() + LeaderboardEntry interface
frontend/components/Leaderboard.tsx        + componente com TanStack Query + toggle
frontend/app/globals.css                   + estilos .lb-*, .me-tag, cores rank
frontend/components/GamePage.tsx           + <Leaderboard> na side-col
```

**Atualização:** TanStack Query busca a cada 30s (`refetchInterval: 30_000`).
O cache fica stale após 20s (`staleTime: 20_000`).

**Perguntas prováveis na arguição:**

P: "Por que não usar cache Redis no leaderboard?"
R: Para o volume esperado (poucas dezenas de jogadores em teste), uma query SQL a cada 30s é
trivial. Com Redis, o TTL curto (10-30s) adicionaria complexidade de invalidação sem ganho real.
Em produção com milhares de jogadores simultâneos, faria sentido: calcula via cron, guarda
no Redis, serve do cache com TTL de 30s.

P: "Como você diferencia SACADO de PERDIDO no cálculo?"
R: Para SACADO: `pagamentoCentavos` está preenchido (payout > 0), então
`COALESCE(pagamentoCentavos, 0) - valorCentavos` = lucro positivo.
Para PERDIDO: `pagamentoCentavos` é NULL → `COALESCE(NULL, 0) = 0`, então
`0 - valorCentavos` = prejuízo (negativo). Apostas PENDENTE e CANCELADO são excluídas.

P: "Por que o leaderboard não precisa de autenticação?"
R: Rankings são informação pública — os jogadores querem saber quem está ganhando.
Exigir JWT seria friction desnecessário e impediria futuramente exibir em telas públicas.

P: "Como a posição do jogador atual é detectada?"
R: A API retorna `jogadorId` (o UUID do Keycloak). O frontend compara com `playerJogadorId`
(`auth.user.profile.sub`) para marcar a linha com `.lb-row.me` e o badge `VOCÊ`.
Não depende do username (que poderia colidir entre usuários).

---

### 5. CI GitHub Actions

**Arquivo:** `.github/workflows/ci.yml`

**Trigger:** `push` e `pull_request` na branch `main`. PRs ficam bloqueados até todos os jobs passarem (status checks obrigatórios configuráveis nas branch protection rules do GitHub).

**Estrutura dos jobs:**

```
push/PR → main
  ├── test-wallets  (paralelo)
  └── test-games    (paralelo)
        └── build-check (depende dos dois)
```

**Por que os testes rodam em paralelo?**
`test-wallets` e `test-games` são independentes — não compartilham banco nem estado.
Rodá-los em paralelo reduz o tempo total de CI: se cada job leva 30s, paralelo = 30s total;
sequencial = 60s. O `build-check` espera os dois (`needs: [test-wallets, test-games]`) porque
só faz sentido buildar imagens se os testes passaram.

**Cache do Bun:**
```yaml
path: ~/.bun/install/cache
key: bun-games-${{ runner.os }}-${{ hashFiles('services/games/bun.lock') }}
restore-keys: bun-games-${{ runner.os }}-
```
A chave é baseada no `bun.lock` — se nenhuma dependência mudou, o cache é restaurado e
`bun install` é instantâneo. O `restore-keys` é um fallback parcial: se o lockfile mudou,
restaura o cache mais próximo e só baixa os pacotes diferentes.

**`--frozen-lockfile`:**
Garante que `bun install` não atualize dependências implicitamente. Se o `bun.lock` estiver
desatualizado em relação ao `package.json`, a build falha — isso força o desenvolvedor a
commitar o lockfile atualizado. Sem essa flag, CI poderia instalar versões diferentes
das que estão em produção.

**`bun test tests/unit`:**
Explícito sobre qual suíte rodar (unit). Se amanhã os testes E2E forem adicionados ao mesmo
diretório, o CI não vai tentar rodá-los sem infraestrutura — evita falsos negativos.

**build-check:**
- `docker compose config --quiet` — valida o YAML do compose e resolve variáveis de ambiente.
  Falha se houver sintaxe inválida, serviço referenciando imagem inexistente, etc.
- `docker compose build` — constrói todas as imagens (games, wallets, frontend). Verifica que
  os Dockerfiles são válidos e que o `bun build` do Next.js não tem erros. Não sobe nenhum
  container (não há `up`, `start` ou `run`).
- `docker/setup-buildx-action@v3` — ativa o BuildKit, que é mais rápido que o build clássico
  e suporta cache de camadas multi-estágio.

**Perguntas prováveis na arguição:**

P: "Por que não usar matrix strategy?"
R: Matrix strategy faz sentido quando os jobs são idênticos mas com parâmetros diferentes
(ex: Node 18/20/22). Aqui os jobs têm passos ligeiramente diferentes (`working-directory`
diferente, lockfile diferente). Duplicar explicitamente é mais legível e mais fácil de
debugar — se o wallets quebrar, fica claro no nome do job.

P: "Por que o build-check não usa cache de layer Docker?"
R: Para manter simples. Cache de layer Docker em CI exige registry (GitHub Container Registry
ou similar) e configuração de `cache-from/cache-to`. O tradeoff (complexidade vs. velocidade)
não se justifica para um projeto de avaliação. Em produção, adicionaria:
```yaml
- uses: docker/build-push-action@v5
  with:
    cache-from: type=gha
    cache-to: type=gha,mode=max
```

P: "Como ativar os status checks obrigatórios no GitHub?"
R: Settings → Branches → Branch protection rules → Require status checks to pass before merging.
Adicionar `Testes · wallets`, `Testes · games` e `Build · Docker images` como required checks.
Isso impede merge de PRs com CI quebrado.

---

### 6. Seed Determinística E2E
(a implementar)

---

## Perguntas que o recrutador pode fazer

### Sobre Rate Limiting

**Por que no Kong e não no NestJS?**
No Kong, a política se aplica antes de o request chegar ao NestJS — economiza CPU do
serviço. Também é configurável sem redeploy de código: só muda o kong.yml e reinicia
o Kong. Com `@nestjs/throttler` no NestJS, cada serviço implementa separadamente e
o throttle ocorre depois que o NestJS já processou boa parte do request.

**O que acontece quando o limite é atingido?**
Kong retorna `429 Too Many Requests` com o header `RateLimit-Reset` indicando em quantos
segundos o contador reseta. O frontend já tem tratamento de erro por toast notification.

**Como você configuraria para múltiplos nós Kong?**
Trocar `policy: local` por `policy: redis` e apontar para um Redis compartilhado. Assim
todos os nós do Kong contam do mesmo contador. Com `policy: local`, cada nó tem seu
próprio contador — funciona para um único nó mas falha em cluster.

---

### Sobre DDD (sempre perguntam)

**O que é Domain-Driven Design?**
É uma abordagem de design de software que organiza o código em torno do domínio do
negócio, não das tecnologias. O domínio fica isolado (sem imports de NestJS/Prisma),
e a infraestrutura se adapta ao domínio, não o contrário.

**Por que separar Domain, Application, Infrastructure, Presentation?**
- `domain`: regras de negócio puras. Testável sem I/O, sem framework.
- `application`: orquestra o domínio. Sabe o que fazer, não sabe como persistir.
- `infrastructure`: sabe como persistir (Prisma), publicar (RabbitMQ), autenticar (Keycloak).
- `presentation`: traduz HTTP/WS para chamadas de application. Converte erros de domínio em HTTP.

Se misturar, uma mudança de banco (ex: de Prisma para TypeORM) exige mexer em toda a codebase.
Com DDD, só muda o arquivo de repositório concreto.

**O que é um Aggregate Root?**
É a entidade principal de um grupo de objetos que mantém as invariantes do grupo. No nosso
caso, `Round` é o Aggregate Root: ninguém cria ou modifica `Bet` diretamente — tudo passa
por `round.registrarAposta()` e `round.sacar()`. Isso garante que as regras de negócio
(ex: só uma aposta por jogador, só sacar durante RODANDO) sejam sempre respeitadas.

**O que é um Value Object?**
Objeto definido pelo valor, não por identidade. Não tem ID. Se dois Value Objects têm os
mesmos valores, são iguais. Exemplo: `Dinheiro { centavos: 150n }`. No nosso projeto não
criamos Value Objects explícitos — usamos BigInt diretamente, o que é uma simplificação
aceitável para o prazo.

---

### Sobre Prisma 7

**Por que Prisma 7 e não 5/6?**
O projeto já vinha com Prisma 7 configurado. A versão 7 é a mais recente e introduz
o conceito de driver adapters como primeira classe — mais flexibilidade de banco.

**O que mudou na arquitetura do Prisma 7?**
A URL do datasource saiu do `schema.prisma` e foi para `prisma.config.ts`. O `schema.prisma`
não tem mais `url = env("DATABASE_URL")` — só `provider = "postgresql"`. Isso tomou um tempo
de debugging porque a documentação ainda é fraca nisso.

**O que é um driver adapter?**
É uma camada que separa o Prisma Client do driver de banco específico. Com `PrismaPg`,
o Prisma usa a lib `pg` (node-postgres) diretamente, dando mais controle sobre o pool de
conexões. O `PrismaService` instancia `new PrismaPg({ connectionString })` e passa o adapter
para `new PrismaClient({ adapter })`.

---

### Sobre WebSocket

**Por que WebSocket e não polling?**
Polling (GET a cada 100ms) geraria 600 requests/minuto por cliente. Com WebSocket, o
servidor empurra apenas quando há mudança. O multiplicador sobe a cada 100ms durante a
rodada — com 10 jogadores conectados, polling geraria 6000 requests/min vs. 10 conexões
WebSocket abertas.

**Como o cliente sincroniza o multiplicador?**
O Game Service emite `rodada:tick` a cada 100ms via `setInterval` no `GameEngineService`.
O evento chega ao cliente via `socket.on('rodada:tick')` que chama `store.setTick(multiplicador)`.
O Zustand atualiza o estado e o React re-renderiza apenas os componentes que consomem
`multiplicador`.

**O que acontece se o cliente desconectar?**
O socket.io reconecta automaticamente (`reconnection: true, reconnectionAttempts: Infinity`).
Ao reconectar, o cliente faz GET /rounds/current para recarregar o estado da rodada e
re-hidrata o Zustand store via `store.setFromCurrentRound(round)`.

---

### Sobre Provably Fair

**O que garante que o resultado não foi manipulado?**
Antes das apostas, o servidor revela o `hashSeedServidor = SHA-256(seedServidor)`. O jogador
vê esse hash. Depois do crash, o `seedServidor` é revelado. O jogador pode verificar:
`SHA-256(seedServidor) === hashSeedServidor` (confirma que o seed não mudou) e depois
recalcular `HMAC-SHA256(seedServidor, roundId)` para obter o crash point. Se coincidir com
o crash point exibido, a rodada foi honesta.

**Como o jogador verifica o crash point?**
Via `GET /games/rounds/:id/verify` que retorna `hashSeedServidor`, `seedServidor` e
`pontoCrash`. O frontend tem um modal (`FairModal.tsx`) que mostra esses valores e explica
o cálculo. O jogador pode reproduzir o cálculo em qualquer ferramenta online de HMAC-SHA256.

**O que é SHA-256 neste contexto?**
É uma função de hash criptográfico: dado um input, produz sempre o mesmo output de 256 bits,
mas não é possível descobrir o input a partir do output (propriedade de pré-imagem). Isso
garante que o `seedServidor` não pode ser descoberto a partir do `hashSeedServidor` — então
o servidor não pode escolher o seed depois de ver as apostas.

---

## Glossário técnico

- **DDD:** Domain-Driven Design — organiza o código em torno do domínio do negócio
- **Aggregate Root:** entidade principal que controla um grupo de objetos relacionados
- **OIDC:** OpenID Connect — protocolo de autenticação sobre OAuth2
- **PKCE:** Proof Key for Code Exchange — extensão de segurança do OAuth2 para clientes públicos
- **Kong:** API Gateway — proxy reverso que centraliza roteamento, CORS, auth, rate limiting
- **RabbitMQ:** Message Broker — fila de mensagens assíncronas entre serviços
- **Provably Fair:** técnica criptográfica que prova que o resultado não foi manipulado após o fato
- **BigInt:** tipo inteiro de precisão arbitrária — usado para centavos sem risco de erro de ponto flutuante
- **strip_path:** configuração Kong que remove o prefixo da rota antes de encaminhar ao backend
- **policy: local:** rate-limiting por nó Kong (vs. redis = compartilhado entre nós)

---

## Fluxo completo de uma aposta (para explicar ao vivo)

```
1. Player clica "Apostar" no frontend
   → BetControls.onBet(centavos) → placeBet(centavos, token)
   → POST /games/bet via Kong (rate-limit verifica: 60/min)
   → Kong valida JWT com Keycloak JWKS
   → Game Service: KeycloakJwtGuard → RegistrarApostaUseCase

2. RegistrarApostaUseCase:
   → round.registrarAposta(jogadorId, centavos) [domain validation]
   → publica bet.debit.requested → [wallet.commands] no RabbitMQ

3. Wallet Service consome bet.debit.requested:
   → DebitWalletUseCase → wallet.debit(centavos) [domain: saldo >= centavos]
   → Prisma persiste saldo atualizado
   → publica bet.debit.confirmed → [game.events]

4. Game Service consome bet.debit.confirmed:
   → confirma aposta no engine em memória
   → emite aposta:registrada via WebSocket para todos os clientes

5. Frontend recebe aposta:registrada via socket.on
   → store.addAposta(d) → Zustand atualiza lista de apostas
   → BetsList re-renderiza em tempo real

6. A cada 100ms durante RODANDO:
   → GameEngineService.processarTick() calcula multiplicador
   → GameGateway.emit('rodada:tick', { multiplicador })
   → useGameSocket: store.setTick(multiplicador)
   → Stage/CrashGraph re-renderizam

7. Player clica "Cash Out":
   → cashout(token) → POST /games/bet/cashout via Kong (rate-limit)
   → SacarUseCase: round.sacar(jogadorId, multiplicadorAtual)
   → payout = valorCentavos * multiplicador (em BigInt)
   → publica bet.credit.requested → [wallet.commands]

8. Wallet Service credita → publica bet.credit.confirmed
   → Game Service emite aposta:saque via WebSocket
   → Frontend: store.setSaque() → refetchWallet() → saldo atualizado na UI
```
