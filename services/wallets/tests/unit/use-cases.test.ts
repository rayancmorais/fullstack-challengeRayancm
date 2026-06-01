import { describe, it, expect, beforeEach, mock } from 'bun:test';
import { CreateWalletUseCase } from '../../src/application/create-wallet.use-case';
import { GetWalletUseCase } from '../../src/application/get-wallet.use-case';
import { ResetWalletUseCase } from '../../src/application/reset-wallet.use-case';
import { Wallet } from '../../src/domain/wallet.entity';
import { WalletRepository } from '../../src/domain/wallet.repository';

// ── Repositório mock ──────────────────────────────────────────────────────────
class RepositorioEmMemoria extends WalletRepository {
  private carteiras: Map<string, Wallet> = new Map();

  async buscarPorJogadorId(jogadorId: string): Promise<Wallet | null> {
    for (const c of this.carteiras.values()) {
      if ((c as any).jogadorId === jogadorId) return c;
    }
    return null;
  }

  async buscarPorId(id: string): Promise<Wallet | null> {
    return this.carteiras.get(id) ?? null;
  }

  async salvar(carteira: Wallet): Promise<void> {
    this.carteiras.set((carteira as any).id, carteira);
  }
}

// ── CreateWalletUseCase ───────────────────────────────────────────────────────
describe('CreateWalletUseCase', () => {
  let repo: RepositorioEmMemoria;
  let useCase: CreateWalletUseCase;

  beforeEach(() => {
    repo    = new RepositorioEmMemoria();
    useCase = new CreateWalletUseCase(repo);
  });

  it('deve criar carteira com saldo zero', async () => {
    const carteira = await useCase.executar({ jogadorId: 'j1', nomeUsuario: 'player' });
    expect(carteira.saldo).toBe(0n);
    expect((carteira as any).nomeUsuario).toBe('player');
  });

  it('deve persistir a carteira no repositório', async () => {
    await useCase.executar({ jogadorId: 'j2', nomeUsuario: 'player2' });
    const salva = await repo.buscarPorJogadorId('j2');
    expect(salva).not.toBeNull();
  });

  it('deve lançar erro se carteira já existe', async () => {
    await useCase.executar({ jogadorId: 'j3', nomeUsuario: 'dup' });
    expect(useCase.executar({ jogadorId: 'j3', nomeUsuario: 'dup' })).rejects.toThrow();
  });
});

// ── GetWalletUseCase ──────────────────────────────────────────────────────────
describe('GetWalletUseCase', () => {
  let repo: RepositorioEmMemoria;
  let useCase: GetWalletUseCase;

  beforeEach(() => {
    repo    = new RepositorioEmMemoria();
    useCase = new GetWalletUseCase(repo);
  });

  it('deve retornar carteira existente', async () => {
    const carteira = Wallet.criar({ id: 'w1', jogadorId: 'j1', nomeUsuario: 'player' });
    await repo.salvar(carteira);
    const resultado = await useCase.executar('j1');
    expect(resultado.saldo).toBe(0n);
  });

  it('deve lançar NotFoundException se carteira não existe', async () => {
    expect(useCase.executar('inexistente')).rejects.toThrow();
  });
});

// ── ResetWalletUseCase ────────────────────────────────────────────────────────
describe('ResetWalletUseCase', () => {
  let repo: RepositorioEmMemoria;
  let useCase: ResetWalletUseCase;

  beforeEach(() => {
    repo    = new RepositorioEmMemoria();
    useCase = new ResetWalletUseCase(repo);
  });

  it('deve resetar saldo para o valor configurado', async () => {
    const carteira = Wallet.criar({ id: 'w1', jogadorId: 'j1', nomeUsuario: 'player' });
    carteira.debitar(0n); // apenas para ter na memória com saldo 0
    await repo.salvar(carteira);

    await useCase.executar('j1');

    const apos = await repo.buscarPorJogadorId('j1');
    // saldo deve ser WALLET_RESET_AMOUNT (100_000_000 por padrão) ou env var
    const esperado = BigInt(process.env.WALLET_RESET_AMOUNT ?? '100000000');
    expect(apos!.saldo).toBe(esperado);
  });

  it('deve lançar NotFoundException se carteira não existe', async () => {
    expect(useCase.executar('inexistente')).rejects.toThrow();
  });

  it('deve sobrescrever saldo existente positivo', async () => {
    const carteira = Wallet.criar({ id: 'w2', jogadorId: 'j2', nomeUsuario: 'rico' });
    carteira.creditar(500_000_000n);
    await repo.salvar(carteira);

    await useCase.executar('j2');

    const apos = await repo.buscarPorJogadorId('j2');
    const esperado = BigInt(process.env.WALLET_RESET_AMOUNT ?? '100000000');
    expect(apos!.saldo).toBe(esperado);
  });
});
