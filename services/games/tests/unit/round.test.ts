import { describe, it, expect } from 'bun:test';
import { Round, StatusRodada } from '../../src/domain/round/round.entity';
import { StatusAposta } from '../../src/domain/bet/bet.entity';
import { calcularHashSeed } from '../../src/domain/provably-fair/provably-fair';
import { createHash } from 'crypto';

// helper para criar uma rodada já em andamento (evita repetição nos testes)
function criarRodadaRodando() {
  const rodada = Round.criar('rodada-teste');
  rodada.registrarAposta('jogador-1', 'jogador1', 1000n);
  rodada.iniciar();
  return rodada;
}

describe('Agregado Round', () => {
  describe('criar()', () => {
    it('deve iniciar na fase de apostas abertas', () => {
      const rodada = Round.criar('rodada-1');
      expect(rodada.status).toBe(StatusRodada.APOSTAS_ABERTAS);
    });

    it('deve ter um hash do seed publicado desde o início', () => {
      const rodada = Round.criar('rodada-1');
      expect(rodada.hashSeedServidor).toHaveLength(64);
    });

    it('não deve expor o seed antes do crash', () => {
      const rodada = Round.criar('rodada-1');
      expect(rodada.seedServidor).toBeUndefined();
    });

    it('deve ter um crash point pré-determinado e maior ou igual a 1.00', () => {
      const rodada = Round.criar('rodada-1');
      expect(rodada.pontoCrash).toBeGreaterThanOrEqual(1.00);
    });
  });

  describe('registrarAposta()', () => {
    it('deve adicionar aposta na fase de apostas', () => {
      const rodada = Round.criar('rodada-1');
      const aposta = rodada.registrarAposta('jogador-1', 'jogador1', 500n);
      expect(rodada.apostas).toHaveLength(1);
      expect(aposta.valorCentavos).toBe(500n);
      expect(aposta.status).toBe(StatusAposta.PENDENTE);
    });

    it('deve rejeitar aposta fora da fase de apostas', () => {
      const rodada = criarRodadaRodando();
      expect(() => rodada.registrarAposta('jogador-2', 'jogador2', 500n))
        .toThrow('Apostas só podem ser registradas na fase de apostas');
    });

    it('deve rejeitar se o jogador já apostou nesta rodada', () => {
      const rodada = Round.criar('rodada-1');
      rodada.registrarAposta('jogador-1', 'jogador1', 500n);
      expect(() => rodada.registrarAposta('jogador-1', 'jogador1', 300n))
        .toThrow('Jogador já tem uma aposta nesta rodada');
    });

    it('deve rejeitar aposta abaixo do mínimo (R$1,00 = 100 centavos)', () => {
      const rodada = Round.criar('rodada-1');
      expect(() => rodada.registrarAposta('jogador-1', 'jogador1', 50n))
        .toThrow('Valor da aposta fora do permitido');
    });

    it('deve rejeitar aposta acima do máximo (R$1.000,00 = 100000 centavos)', () => {
      const rodada = Round.criar('rodada-1');
      expect(() => rodada.registrarAposta('jogador-1', 'jogador1', 100_001n))
        .toThrow('Valor da aposta fora do permitido');
    });

    it('deve aceitar apostas de jogadores diferentes', () => {
      const rodada = Round.criar('rodada-1');
      rodada.registrarAposta('jogador-1', 'jogador1', 500n);
      rodada.registrarAposta('jogador-2', 'jogador2', 300n);
      expect(rodada.apostas).toHaveLength(2);
    });
  });

  describe('iniciar()', () => {
    it('deve mudar o status para RODANDO', () => {
      const rodada = Round.criar('rodada-1');
      rodada.iniciar();
      expect(rodada.status).toBe(StatusRodada.RODANDO);
    });

    it('deve rejeitar se já estiver rodando', () => {
      const rodada = Round.criar('rodada-1');
      rodada.iniciar();
      expect(() => rodada.iniciar()).toThrow('Rodada não está na fase de apostas');
    });
  });

  describe('sacar()', () => {
    it('deve marcar a aposta como sacada com o multiplicador correto', () => {
      const rodada = criarRodadaRodando();
      const aposta = rodada.sacar('jogador-1', 2.50);
      expect(aposta.status).toBe(StatusAposta.SACADO);
      expect(aposta.multiplicadorSaque).toBe(2.50);
    });

    it('deve calcular o pagamento corretamente sem float: 2.5x em R$10,00 = R$25,00', () => {
      const rodada = Round.criar('rodada-1');
      rodada.registrarAposta('jogador-1', 'jogador1', 1000n); // R$10,00
      rodada.iniciar();
      const aposta = rodada.sacar('jogador-1', 2.50);
      expect(aposta.pagamentoCentavos).toBe(2500n); // R$25,00
    });

    it('deve rejeitar saque na fase de apostas', () => {
      const rodada = Round.criar('rodada-1');
      rodada.registrarAposta('jogador-1', 'jogador1', 500n);
      expect(() => rodada.sacar('jogador-1', 2.0))
        .toThrow('Saque só é possível enquanto a rodada está em andamento');
    });

    it('deve rejeitar saque de jogador sem aposta ativa', () => {
      const rodada = criarRodadaRodando();
      expect(() => rodada.sacar('jogador-sem-aposta', 2.0))
        .toThrow('Nenhuma aposta ativa encontrada');
    });
  });

  describe('crashar()', () => {
    it('deve mudar o status para CRASHADO', () => {
      const rodada = criarRodadaRodando();
      rodada.crashar();
      expect(rodada.status).toBe(StatusRodada.CRASHADO);
    });

    it('deve marcar todas as apostas pendentes como perdidas', () => {
      const rodada = Round.criar('rodada-1');
      rodada.registrarAposta('jogador-1', 'jogador1', 500n);
      rodada.registrarAposta('jogador-2', 'jogador2', 300n);
      rodada.iniciar();
      rodada.crashar();

      const todasPerdidas = rodada.apostas.every(a => a.status === StatusAposta.PERDIDO);
      expect(todasPerdidas).toBe(true);
    });

    it('não deve marcar como perdida a aposta que já foi sacada', () => {
      const rodada = Round.criar('rodada-1');
      rodada.registrarAposta('jogador-1', 'jogador1', 500n);
      rodada.registrarAposta('jogador-2', 'jogador2', 300n);
      rodada.iniciar();
      rodada.sacar('jogador-1', 2.0); // jogador-1 sacou
      rodada.crashar();

      const apostas = rodada.apostas;
      expect(apostas.find(a => a.jogadorId === 'jogador-1')?.status).toBe(StatusAposta.SACADO);
      expect(apostas.find(a => a.jogadorId === 'jogador-2')?.status).toBe(StatusAposta.PERDIDO);
    });

    it('deve revelar o seed após o crash para verificação', () => {
      const rodada = criarRodadaRodando();
      rodada.crashar();
      expect(rodada.seedServidor).toBeDefined();
    });

    it('deve rejeitar crash se a rodada não estiver em andamento', () => {
      const rodada = Round.criar('rodada-1');
      expect(() => rodada.crashar()).toThrow('Rodada não está em andamento');
    });
  });

  describe('verificação provably fair após o crash', () => {
    it('o hash publicado antes deve corresponder ao seed revelado depois', () => {
      const rodada = criarRodadaRodando();
      const hashAnunciado = rodada.hashSeedServidor;

      rodada.crashar();
      const seedRevelado = rodada.seedServidor!;

      // jogador recalcula o hash e compara com o que foi publicado antes da rodada
      const hashVerificado = createHash('sha256').update(seedRevelado).digest('hex');
      expect(hashVerificado).toBe(hashAnunciado);
    });
  });
});
