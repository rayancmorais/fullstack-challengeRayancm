export const BASE_URL    = 'http://localhost:8000/games';
export const WALLETS_URL = 'http://localhost:8000';
const KEYCLOAK_URL = 'http://localhost:8080';

export async function obterToken(): Promise<string> {
  const resposta = await fetch(
    `${KEYCLOAK_URL}/realms/crash-game/protocol/openid-connect/token`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'password',
        client_id: 'crash-game-client',
        username: 'player',
        password: 'player123',
      }),
    },
  );

  if (!resposta.ok) {
    throw new Error(`Keycloak retornou ${resposta.status} — verifique se o Docker está rodando`);
  }

  const { access_token } = (await resposta.json()) as { access_token: string };
  return access_token;
}

export function cabecalhosAuth(token: string): Record<string, string> {
  return { Authorization: `Bearer ${token}` };
}

export function cabecalhosAuthJson(token: string): Record<string, string> {
  return {
    Authorization: `Bearer ${token}`,
    'Content-Type': 'application/json',
  };
}

// Garante que o jogador tem carteira com R$ 1.000.000,00 (para testes de fluxo completo)
export async function prepararCarteira(token: string): Promise<void> {
  // cria a carteira se ainda não existir
  await fetch(`${WALLETS_URL}/wallets`, {
    method: 'POST',
    headers: cabecalhosAuth(token),
  });
  // reseta o saldo para R$ 1.000.000,00 independente do estado anterior
  const reset = await fetch(`${WALLETS_URL}/wallets/reset`, {
    method: 'POST',
    headers: cabecalhosAuth(token),
  });
  if (!reset.ok && reset.status !== 204) {
    throw new Error(`Falha ao resetar carteira: ${reset.status}`);
  }
}

export async function obterSaldo(token: string): Promise<bigint> {
  const res = await fetch(`${WALLETS_URL}/wallets/me`, {
    headers: cabecalhosAuth(token),
  });
  if (!res.ok) throw new Error(`GET /wallets/me retornou ${res.status}`);
  const { saldo } = (await res.json()) as { saldo: string };
  return BigInt(saldo);
}

// Fica em loop até a rodada atingir o status esperado ou o timeout estourar
export async function aguardarStatus(
  status: 'APOSTAS_ABERTAS' | 'RODANDO' | 'CRASHADO',
  timeoutMs = 20_000,
): Promise<Record<string, unknown>> {
  const inicio = Date.now();

  while (Date.now() - inicio < timeoutMs) {
    try {
      const resposta = await fetch(`${BASE_URL}/rounds/current`);
      if (resposta.ok) {
        const rodada = (await resposta.json()) as Record<string, unknown>;
        if (rodada.status === status) return rodada;
      }
    } catch {
      // serviço ainda inicializando
    }
    await new Promise<void>((r) => setTimeout(r, 500));
  }

  throw new Error(`Timeout: rodada não atingiu "${status}" em ${timeoutMs}ms`);
}
