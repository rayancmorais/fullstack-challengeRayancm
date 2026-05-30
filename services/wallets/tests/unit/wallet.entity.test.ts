import { describe, it, expect } from 'bun:test';
import { Wallet } from '../../src/domain/wallet.entity';

describe('Entidade Carteira', () => {
  describe('criar()', () => {
    it('deve iniciar com saldo zero', () => {
      const carteira = Wallet.criar({ id: '1', jogadorId: 'j1', nomeUsuario: 'jogador1' });
      expect(carteira.saldo).toBe(0n);
    });

    it('deve armazenar jogadorId e nomeUsuario corretamente', () => {
      const carteira = Wallet.criar({ id: '1', jogadorId: 'j1', nomeUsuario: 'jogador1' });
      expect(carteira.jogadorId).toBe('j1');
      expect(carteira.nomeUsuario).toBe('jogador1');
    });
  });

  describe('reconstituir()', () => {
    it('deve restaurar o saldo vindo do banco de dados', () => {
      const carteira = Wallet.reconstituir({
        id: '1',
        jogadorId: 'j1',
        nomeUsuario: 'jogador1',
        saldo: 5000n,
        criadoEm: new Date(),
      });
      expect(carteira.saldo).toBe(5000n);
    });
  });

  describe('creditar()', () => {
    it('deve aumentar o saldo corretamente', () => {
      const carteira = Wallet.criar({ id: '1', jogadorId: 'j1', nomeUsuario: 'jogador1' });
      carteira.creditar(150n);
      carteira.creditar(250n);
      expect(carteira.saldo).toBe(400n);
    });

    it('deve somar valores sem erro de ponto flutuante', () => {
      const carteira = Wallet.criar({ id: '1', jogadorId: 'j1', nomeUsuario: 'jogador1' });
      carteira.creditar(10n);
      carteira.creditar(20n);
      // 0.1 + 0.2 em float = 0.30000000000000004, aqui deve ser exato
      expect(carteira.saldo).toBe(30n);
    });

    it('deve lançar erro quando o valor for zero', () => {
      const carteira = Wallet.criar({ id: '1', jogadorId: 'j1', nomeUsuario: 'jogador1' });
      expect(() => carteira.creditar(0n)).toThrow('O valor do crédito deve ser positivo');
    });

    it('deve lançar erro quando o valor for negativo', () => {
      const carteira = Wallet.criar({ id: '1', jogadorId: 'j1', nomeUsuario: 'jogador1' });
      expect(() => carteira.creditar(-100n)).toThrow('O valor do crédito deve ser positivo');
    });
  });

  describe('debitar()', () => {
    it('deve diminuir o saldo após débito bem-sucedido', () => {
      const carteira = Wallet.reconstituir({
        id: '1', jogadorId: 'j1', nomeUsuario: 'jogador1', saldo: 1000n, criadoEm: new Date(),
      });
      const resultado = carteira.debitar(300n);
      expect(resultado.ok).toBe(true);
      expect(carteira.saldo).toBe(700n);
    });

    it('deve retornar erro quando o saldo for insuficiente', () => {
      const carteira = Wallet.reconstituir({
        id: '1', jogadorId: 'j1', nomeUsuario: 'jogador1', saldo: 100n, criadoEm: new Date(),
      });
      const resultado = carteira.debitar(200n);
      expect(resultado.ok).toBe(false);
      if (!resultado.ok) expect(resultado.erro).toBe('Saldo insuficiente');
    });

    it('não deve alterar o saldo quando o débito falhar', () => {
      const carteira = Wallet.reconstituir({
        id: '1', jogadorId: 'j1', nomeUsuario: 'jogador1', saldo: 100n, criadoEm: new Date(),
      });
      carteira.debitar(200n);
      expect(carteira.saldo).toBe(100n);
    });

    it('deve retornar erro quando o valor for zero', () => {
      const carteira = Wallet.reconstituir({
        id: '1', jogadorId: 'j1', nomeUsuario: 'jogador1', saldo: 1000n, criadoEm: new Date(),
      });
      const resultado = carteira.debitar(0n);
      expect(resultado.ok).toBe(false);
      if (!resultado.ok) expect(resultado.erro).toBe('O valor deve ser positivo');
    });

    it('deve retornar erro quando o valor for negativo', () => {
      const carteira = Wallet.reconstituir({
        id: '1', jogadorId: 'j1', nomeUsuario: 'jogador1', saldo: 1000n, criadoEm: new Date(),
      });
      const resultado = carteira.debitar(-50n);
      expect(resultado.ok).toBe(false);
    });

    it('deve permitir débito do saldo exato (zerar conta)', () => {
      const carteira = Wallet.reconstituir({
        id: '1', jogadorId: 'j1', nomeUsuario: 'jogador1', saldo: 500n, criadoEm: new Date(),
      });
      const resultado = carteira.debitar(500n);
      expect(resultado.ok).toBe(true);
      expect(carteira.saldo).toBe(0n);
    });
  });

  describe('precisão monetária', () => {
    it('deve tratar R$1.000,00 (100000 centavos) corretamente', () => {
      const carteira = Wallet.criar({ id: '1', jogadorId: 'j1', nomeUsuario: 'jogador1' });
      carteira.creditar(100_000n);
      const resultado = carteira.debitar(100_000n);
      expect(resultado.ok).toBe(true);
      expect(carteira.saldo).toBe(0n);
    });

    it('crédito seguido de múltiplos débitos deve ser exato', () => {
      const carteira = Wallet.criar({ id: '1', jogadorId: 'j1', nomeUsuario: 'jogador1' });
      carteira.creditar(1000n);
      carteira.debitar(333n);
      carteira.debitar(333n);
      carteira.debitar(334n);
      expect(carteira.saldo).toBe(0n);
    });
  });
});
