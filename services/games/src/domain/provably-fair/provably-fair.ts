import { createHash, createHmac, randomBytes } from 'crypto';

// Gera um seed aleatório de 32 bytes para o servidor
// Esse seed precisa ser gerado ANTES das apostas abrirem
export function gerarSeedServidor(): string {
  return randomBytes(32).toString('hex');
}

// O hash do seed é o que publicamos para os jogadores antes da rodada começar
// Assim eles sabem que o resultado já existe, mas não conseguem ver qual é
export function calcularHashSeed(seedServidor: string): string {
  return createHash('sha256').update(seedServidor).digest('hex');
}

// Calcula o ponto de crash usando HMAC-SHA256
// O roundId garante que cada rodada tenha um crash point diferente mesmo com o mesmo seed
export function calcularPontoCrash(seedServidor: string, idRodada: string): number {
  const hmac = createHmac('sha256', seedServidor).update(idRodada).digest('hex');

  // Pega os primeiros 8 caracteres hex e converte para número inteiro
  const h = parseInt(hmac.slice(0, 8), 16);
  const valorMaximo = Math.pow(2, 32); // valor máximo que 8 hex chars podem representar

  // House edge de 1%: quando h é divisível por 100, o jogo crasha na largada
  // Isso garante que a casa sempre tenha uma margem de lucro
  if (h % 100 === 0) return 1.00;

  // Fórmula que gera distribuição exponencial — crash points baixos são mais comuns
  const pontoCrash = Math.floor((100 * valorMaximo - h) / (valorMaximo - h)) / 100;
  return Math.max(1.00, pontoCrash);
}

// Verifica se o crash point informado bate com o que o seed gera
// Jogadores podem usar isso para confirmar que o resultado não foi alterado
export function verificarPontoCrash(
  seedServidor: string,
  idRodada: string,
  pontoCrashInformado: number,
): boolean {
  const pontoCrashCalculado = calcularPontoCrash(seedServidor, idRodada);
  // Tolerância pequena por causa de arredondamento no toFixed
  return Math.abs(pontoCrashCalculado - pontoCrashInformado) < 0.01;
}
