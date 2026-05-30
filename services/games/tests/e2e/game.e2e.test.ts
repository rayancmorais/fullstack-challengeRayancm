import { describe, it, expect, beforeAll } from 'bun:test';
import {
  BASE_URL,
  obterToken,
  cabecalhosAuth,
  cabecalhosAuthJson,
  aguardarStatus,
} from './setup';

// Requer: bun run docker:up com postgres + rabbitmq + keycloak + kong + ambos os serviços
// Rodar: cd services/games && bun test tests/e2e

describe('Game Service — E2E', () => {
  let token: string;

  beforeAll(async () => {
    token = await obterToken();
    // Garante que o serviço está ativo e numa fase de apostas antes de começar
    await aguardarStatus('APOSTAS_ABERTAS', 30_000);
  }, 35_000);

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

    // Cenário 5
    it('POST /bet/cashout sem aposta ativa → 422', async () => {
      // O jogador não tem aposta ativa nesta rodada:
      // a aposta da fase anterior foi cancelada pelo debit.failed
      // (jogador não tem carteira no Wallet Service)
      const resposta = await fetch(`${BASE_URL}/bet/cashout`, {
        method: 'POST',
        headers: cabecalhosAuthJson(token),
      });

      expect(resposta.status).toBe(422);
      expect(resposta.status).not.toBe(500);
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
});
