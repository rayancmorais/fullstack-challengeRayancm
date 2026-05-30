import { describe, it, expect } from 'bun:test';
import { Bet, StatusAposta } from '../../src/domain/bet/bet.entity';

function criarAposta(valorCentavos = 1000n) {
  return Bet.criar({
    id: 'aposta-1',
    rodadaId: 'rodada-1',
    jogadorId: 'jogador-1',
    nomeUsuario: 'jogador1',
    valorCentavos,
  });
}

describe('Entidade Bet (Aposta)', () => {
  describe('criar()', () => {
    it('deve iniciar com status PENDENTE', () => {
      const aposta = criarAposta();
      expect(aposta.status).toBe(StatusAposta.PENDENTE);
    });

    it('deve armazenar o valor corretamente', () => {
      const aposta = criarAposta(500n);
      expect(aposta.valorCentavos).toBe(500n);
    });

    it('não deve ter multiplicador ou pagamento antes do saque', () => {
      const aposta = criarAposta();
      expect(aposta.multiplicadorSaque).toBeUndefined();
      expect(aposta.pagamentoCentavos).toBeUndefined();
    });
  });

  describe('sacar()', () => {
    it('deve mudar o status para SACADO', () => {
      const aposta = criarAposta();
      aposta.sacar(2.0);
      expect(aposta.status).toBe(StatusAposta.SACADO);
    });

    it('deve salvar o multiplicador no momento do saque', () => {
      const aposta = criarAposta();
      aposta.sacar(3.75);
      expect(aposta.multiplicadorSaque).toBe(3.75);
    });

    it('2x em R$10,00 deve resultar em R$20,00 (2000 centavos)', () => {
      const aposta = criarAposta(1000n);
      aposta.sacar(2.0);
      expect(aposta.pagamentoCentavos).toBe(2000n);
    });

    it('1.5x em R$7,00 deve resultar em R$10,50 — sem erro de float', () => {
      const aposta = criarAposta(700n);
      aposta.sacar(1.5);
      // em float: 700 * 1.5 = 1050 (ok nesse caso, mas BigInt garante)
      expect(aposta.pagamentoCentavos).toBe(1050n);
    });

    it('2.37x em R$50,00 deve calcular corretamente em centavos', () => {
      const aposta = criarAposta(5000n); // R$50,00
      aposta.sacar(2.37);
      // 5000n * 237n / 100n = 11850n → R$118,50
      expect(aposta.pagamentoCentavos).toBe(11850n);
    });

    it('não deve permitir sacar duas vezes', () => {
      const aposta = criarAposta();
      aposta.sacar(2.0);
      expect(() => aposta.sacar(3.0)).toThrow('Aposta não está ativa para saque');
    });

    it('não deve permitir sacar uma aposta perdida', () => {
      const aposta = criarAposta();
      aposta.marcarComoPerdida();
      expect(() => aposta.sacar(2.0)).toThrow('Aposta não está ativa para saque');
    });
  });

  describe('marcarComoPerdida()', () => {
    it('deve mudar o status para PERDIDO', () => {
      const aposta = criarAposta();
      aposta.marcarComoPerdida();
      expect(aposta.status).toBe(StatusAposta.PERDIDO);
    });

    it('não deve ter pagamento quando perdida', () => {
      const aposta = criarAposta();
      aposta.marcarComoPerdida();
      expect(aposta.pagamentoCentavos).toBeUndefined();
    });
  });

  describe('cancelar()', () => {
    it('deve mudar o status para CANCELADO', () => {
      const aposta = criarAposta();
      aposta.cancelar();
      expect(aposta.status).toBe(StatusAposta.CANCELADO);
    });

    it('não deve permitir cancelar uma aposta já sacada', () => {
      const aposta = criarAposta();
      aposta.sacar(2.0);
      expect(() => aposta.cancelar()).toThrow('Só é possível cancelar uma aposta pendente');
    });
  });
});
