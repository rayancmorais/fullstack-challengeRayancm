import { describe, it, expect } from 'bun:test';
import {
  gerarSeedServidor,
  calcularHashSeed,
  calcularPontoCrash,
  verificarPontoCrash,
} from '../../src/domain/provably-fair/provably-fair';

describe('Provably Fair', () => {
  describe('gerarSeedServidor()', () => {
    it('deve gerar um seed de 64 caracteres hexadecimais', () => {
      const seed = gerarSeedServidor();
      expect(seed).toHaveLength(64);
      expect(seed).toMatch(/^[a-f0-9]+$/);
    });

    it('deve gerar seeds diferentes a cada chamada', () => {
      const seed1 = gerarSeedServidor();
      const seed2 = gerarSeedServidor();
      expect(seed1).not.toBe(seed2);
    });
  });

  describe('calcularHashSeed()', () => {
    it('deve gerar sempre o mesmo hash para o mesmo seed', () => {
      const seed = 'abc123';
      expect(calcularHashSeed(seed)).toBe(calcularHashSeed(seed));
    });

    it('o hash deve ter 64 caracteres (SHA-256)', () => {
      const hash = calcularHashSeed(gerarSeedServidor());
      expect(hash).toHaveLength(64);
    });
  });

  describe('calcularPontoCrash()', () => {
    it('deve ser determinístico: mesmo seed e roundId sempre geram o mesmo crash point', () => {
      const seed = 'seed-fixo-para-teste';
      const idRodada = 'rodada-42';
      const resultado1 = calcularPontoCrash(seed, idRodada);
      const resultado2 = calcularPontoCrash(seed, idRodada);
      expect(resultado1).toBe(resultado2);
    });

    it('o crash point deve ser sempre maior ou igual a 1.00', () => {
      for (let i = 0; i < 200; i++) {
        const pontoCrash = calcularPontoCrash(gerarSeedServidor(), `rodada-${i}`);
        expect(pontoCrash).toBeGreaterThanOrEqual(1.00);
      }
    });

    it('seeds diferentes devem gerar crash points diferentes', () => {
      const seed1 = gerarSeedServidor();
      const seed2 = gerarSeedServidor();
      const idRodada = 'rodada-teste';
      // muito improvável que dois seeds aleatórios gerem exatamente o mesmo crash point
      expect(calcularPontoCrash(seed1, idRodada)).not.toBe(calcularPontoCrash(seed2, idRodada));
    });

    it('o mesmo seed com roundIds diferentes deve gerar crash points diferentes', () => {
      const seed = gerarSeedServidor();
      const ponto1 = calcularPontoCrash(seed, 'rodada-1');
      const ponto2 = calcularPontoCrash(seed, 'rodada-2');
      expect(ponto1).not.toBe(ponto2);
    });
  });

  describe('verificarPontoCrash()', () => {
    it('deve confirmar um crash point gerado pelo próprio algoritmo', () => {
      const seed = gerarSeedServidor();
      const idRodada = 'rodada-verificacao';
      const pontoCrash = calcularPontoCrash(seed, idRodada);
      expect(verificarPontoCrash(seed, idRodada, pontoCrash)).toBe(true);
    });

    it('deve rejeitar um crash point adulterado', () => {
      const seed = gerarSeedServidor();
      const idRodada = 'rodada-1';
      // ninguém consegue ganhar 99.99x — obviamente adulterado
      expect(verificarPontoCrash(seed, idRodada, 99.99)).toBe(false);
    });

    it('deve rejeitar se o seed for diferente do original', () => {
      const seedOriginal = gerarSeedServidor();
      const seedFalso = gerarSeedServidor();
      const idRodada = 'rodada-1';
      const pontoCrash = calcularPontoCrash(seedOriginal, idRodada);
      expect(verificarPontoCrash(seedFalso, idRodada, pontoCrash)).toBe(false);
    });
  });

  describe('fluxo completo de verificação (como o jogador faria)', () => {
    it('o jogador consegue verificar o resultado usando o seed revelado após o crash', () => {
      // 1. Servidor gera o seed e publica apenas o hash
      const seedServidor = gerarSeedServidor();
      const hashPublicado = calcularHashSeed(seedServidor);
      const idRodada = 'rodada-final';

      // 2. Rodada acontece com o crash point calculado
      const pontoCrash = calcularPontoCrash(seedServidor, idRodada);

      // 3. Após o crash, servidor revela o seed
      // 4. Jogador verifica que o hash bate
      const { createHash } = require('crypto');
      const hashVerificadoPeloJogador = createHash('sha256').update(seedServidor).digest('hex');
      expect(hashVerificadoPeloJogador).toBe(hashPublicado);

      // 5. Jogador recalcula o crash point e confirma
      expect(verificarPontoCrash(seedServidor, idRodada, pontoCrash)).toBe(true);
    });
  });
});
