import { describe, it, expect, beforeAll } from 'bun:test';
import {
  BASE_URL,
  obterToken,
  cabecalhosAuth,
  cabecalhosAuthJson,
  aguardarStatus,
  prepararCarteira,
  obterSaldo,
} from './setup';

// Requer: bun run docker:up com postgres + rabbitmq + keycloak + kong + ambos os serviços
// Rodar: cd services/games && bun test tests/e2e

describe('Game Service — E2E', () => {
  let token: string;

  beforeAll(async () => {
    token = await obterToken();
    // Garante que o serviço está ativo e numa fase de apostas antes de começar
    await aguardarStatus('APOSTAS_ABERTAS', 90_000);
  }, 95_000);

  // ─────────────────────────────────────────────────────────────────
  // Cenário 1: GET /rounds/current
  // ─────────────────────────────────────────────────────────────────
  it('GET /rounds/current → 200 com rodada ativa e seed protegido', async () => {
    const resposta = await fetch(`${BASE_URL}/rounds/current`);

    expect(resposta.status).toBe(200);

    const rodada = (await resposta.json()) as Record<string, unknown>;
    expect(rodada.id).toBeDefined();
    expect(typeof rodada.id).toBe('string');
    expect(rodada.status).toBeDefined();
    expect(rodada.hashSeedServidor).toBeDefined();

    // Seed e crash point nunca devem aparecer enquanto a rodada não crashou
    if (rodada.status !== 'CRASHADO') {
      expect(rodada.seedServidor).toBeUndefined();
      expect(rodada.pontoCrash).toBeUndefined();
    }
  });

  // ─────────────────────────────────────────────────────────────────
  // Cenário 6: GET /rounds/history
  // ─────────────────────────────────────────────────────────────────
  it('GET /rounds/history → 200 com lista paginada', async () => {
    const resposta = await fetch(`${BASE_URL}/rounds/history?page=1&limit=10`);

    expect(resposta.status).toBe(200);

    const lista = (await resposta.json()) as unknown[];
    expect(Array.isArray(lista)).toBe(true);
  });

  // ─────────────────────────────────────────────────────────────────
  // Cenário 8: GET /rounds/:id/verify para ID inexistente
  // ─────────────────────────────────────────────────────────────────
  it('GET /rounds/id-inexistente/verify → 404', async () => {
    const resposta = await fetch(
      `${BASE_URL}/rounds/00000000-0000-0000-0000-000000000000/verify`,
    );

    expect(resposta.status).toBe(404);
  });

  // ─────────────────────────────────────────────────────────────────
  // Cenários durante fase de APOSTAS_ABERTAS
  // ─────────────────────────────────────────────────────────────────
  describe('fase de apostas abertas', () => {
    beforeAll(async () => {
      // Se o round ainda está em APOSTAS_ABERTAS retorna imediatamente,
      // senão aguarda o próximo ciclo
      await aguardarStatus('APOSTAS_ABERTAS', 20_000);
    }, 25_000);

    // Cenário 2
    it('POST /bet com token válido → 201 com aposta PENDENTE', async () => {
      const resposta = await fetch(`${BASE_URL}/bet`, {
        method: 'POST',
        headers: cabecalhosAuthJson(token),
        body: JSON.stringify({ valorCentavos: 500 }),
      });

      expect(resposta.status).toBe(201);

      const aposta = (await resposta.json()) as Record<string, unknown>;
      expect(aposta.id).toBeDefined();
      expect(aposta.status).toBe('PENDENTE');
      expect(aposta.valorCentavos).toBe('500');
    });

    // Cenário 3 — executado imediatamente após o 2, mesma rodada ainda aberta
    it('POST /bet do mesmo jogador → 422 (aposta duplicada na rodada)', async () => {
      const resposta = await fetch(`${BASE_URL}/bet`, {
        method: 'POST',
        headers: cabecalhosAuthJson(token),
        body: JSON.stringify({ valorCentavos: 300 }),
      });

      // Domínio rejeita segunda aposta do mesmo jogador na mesma rodada
      expect(resposta.status).toBe(422);
    });
  });

  // ─────────────────────────────────────────────────────────────────
  // Cenários durante RODANDO
  // ─────────────────────────────────────────────────────────────────
  describe('rodada em andamento', () => {
    beforeAll(async () => {
      await aguardarStatus('RODANDO', 20_000);
      // Aguarda o processamento do debit.failed via RabbitMQ para
      // garantir que a aposta anterior foi cancelada (sem carteira = sem saldo)
      await new Promise<void>((r) => setTimeout(r, 1_500));
    }, 25_000);

    // Cenário 4
    it('POST /bet durante RODANDO → 422 (fora da fase de apostas)', async () => {
      const resposta = await fetch(`${BASE_URL}/bet`, {
        method: 'POST',
        headers: cabecalhosAuthJson(token),
        body: JSON.stringify({ valorCentavos: 500 }),
      });

      expect(resposta.status).toBe(422);

      // Garante que não é um erro interno — deve ser erro de domínio
      expect(resposta.status).not.toBe(500);
    });

    // Cenário 5 — cashout sem aposta ativa deve retornar 422
    it('POST /bet/cashout sem aposta ativa → 422', async () => {
      // Tenta cashout; se retornar 201 (aposta ainda ativa da rodada anterior),
      // tenta uma segunda vez — agora garantidamente sem aposta ativa.
      const r1 = await fetch(`${BASE_URL}/bet/cashout`, {
        method: 'POST',
        headers: cabecalhosAuthJson(token),
      });

      if (r1.status === 201) {
        // Aposta foi sacada com sucesso. Tenta novamente — sem aposta ativa.
        const r2 = await fetch(`${BASE_URL}/bet/cashout`, {
          method: 'POST',
          headers: cabecalhosAuthJson(token),
        });
        expect(r2.status).toBe(422);
        expect(r2.status).not.toBe(500);
      } else {
        expect(r1.status).toBe(422);
        expect(r1.status).not.toBe(500);
      }
    });
  });

  // ─────────────────────────────────────────────────────────────────
  // Cenário 7: GET /bets/me
  // ─────────────────────────────────────────────────────────────────
  it('GET /bets/me com token válido → 200 com histórico do jogador', async () => {
    const resposta = await fetch(`${BASE_URL}/bets/me`, {
      headers: cabecalhosAuth(token),
    });

    expect(resposta.status).toBe(200);

    const apostas = (await resposta.json()) as unknown[];
    expect(Array.isArray(apostas)).toBe(true);
    // O jogador apostou pelo menos uma vez durante os testes
    expect(apostas.length).toBeGreaterThanOrEqual(1);
  });

  // ─────────────────────────────────────────────────────────────────
  // Cenário: saldo insuficiente — validação na camada de domínio
  // O wallet.entity.test.ts valida debitar() com saldo insuficiente.
  // No E2E, confirmamos que aposta com valor acima do limite retorna
  // erro de validação (422) — cobrindo o caminho de validação síncrona.
  // ─────────────────────────────────────────────────────────────────
  it('POST /bet com valor acima do máximo → 422 (saldo insuficiente de limite)', async () => {
    await aguardarStatus('APOSTAS_ABERTAS', 30_000);

    // Valor acima do máximo permitido (R$1.000,00 = 100.000 centavos)
    const resposta = await fetch(`${BASE_URL}/bet`, {
      method: 'POST',
      headers: cabecalhosAuthJson(token),
      body: JSON.stringify({ valorCentavos: 100_001 }),
    });

    // NestJS class-validator retorna 400; domínio retorna 422 — ambos indicam rejeição
    expect([400, 422]).toContain(resposta.status);
    expect(resposta.status).not.toBe(500);
  }, 40_000);

  // ─────────────────────────────────────────────────────────────────
  // Fluxo completo com carteira financiada
  // ─────────────────────────────────────────────────────────────────
  describe('fluxo completo com carteira financiada', () => {
    beforeAll(async () => {
      await prepararCarteira(token);
      await aguardarStatus('APOSTAS_ABERTAS', 30_000);
    }, 40_000);

    // Cenário: apostar → multiplicador sobe → cashout → saldo atualizado
    it('apostar → RODANDO → cashout → saldo aumenta', async () => {
      const saldoAntes = await obterSaldo(token);

      const resAposta = await fetch(`${BASE_URL}/bet`, {
        method: 'POST',
        headers: cabecalhosAuthJson(token),
        body: JSON.stringify({ valorCentavos: 1_000 }),  // R$ 10,00
      });
      expect(resAposta.status).toBe(201);

      // Aguarda a rodada iniciar (multiplicador começa a subir)
      await aguardarStatus('RODANDO', 15_000);
      // Pequena pausa — garante que o multiplicador subiu acima de 1.01
      await new Promise<void>((r) => setTimeout(r, 1_200));

      const resCashout = await fetch(`${BASE_URL}/bet/cashout`, {
        method: 'POST',
        headers: cabecalhosAuthJson(token),
      });
      expect(resCashout.status).toBe(201);

      const aposta = (await resCashout.json()) as Record<string, unknown>;
      expect(['SACOU', 'SACADO']).toContain(aposta.status); // domínio vs Prisma enum
      expect(aposta.pagamentoCentavos).toBeDefined();
      expect(Number(aposta.pagamentoCentavos)).toBeGreaterThan(1_000);

      // Aguarda crédito via RabbitMQ chegar na carteira
      await new Promise<void>((r) => setTimeout(r, 2_000));

      const saldoDepois = await obterSaldo(token);
      // Saldo deve ter aumentado em relação ao momento da aposta
      expect(saldoDepois).toBeGreaterThan(saldoAntes - 1_000n);
    }, 45_000);

    // Cenário: apostar → crash → aposta marcada como perdida
    it('apostar → CRASHADO → aposta fica com status PERDEU', async () => {
      // Garante fase de apostas e carteira financiada
      await prepararCarteira(token);
      await aguardarStatus('APOSTAS_ABERTAS', 30_000);

      const resAposta = await fetch(`${BASE_URL}/bet`, {
        method: 'POST',
        headers: cabecalhosAuthJson(token),
        body: JSON.stringify({ valorCentavos: 500 }),  // R$ 5,00
      });
      expect(resAposta.status).toBe(201);
      const apostaCriada = (await resAposta.json()) as { id: string };

      // Aguarda o crash (pode demorar até ~90 s em casos extremos)
      await aguardarStatus('CRASHADO', 90_000);
      // Dá tempo para o domínio marcar as apostas como perdidas
      await new Promise<void>((r) => setTimeout(r, 500));

      const resHistorico = await fetch(`${BASE_URL}/bets/me`, {
        headers: cabecalhosAuth(token),
      });
      expect(resHistorico.status).toBe(200);

      const apostas = (await resHistorico.json()) as { id: string; status: string }[];
      const apostaPerdida = apostas.find((a) => a.id === apostaCriada.id);
      expect(apostaPerdida).toBeDefined();
      expect(['PERDEU', 'PERDIDO']).toContain(apostaPerdida?.status); // domínio vs Prisma enum
    }, 130_000);
  });
});
