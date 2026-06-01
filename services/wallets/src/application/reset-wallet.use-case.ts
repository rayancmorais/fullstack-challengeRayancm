import { Injectable, NotFoundException } from '@nestjs/common';
import { WalletRepository } from '../domain/wallet.repository';

const SALDO_INICIAL = BigInt(process.env.WALLET_RESET_AMOUNT ?? '100000000'); // R$ 1.000.000,00 em centavos

@Injectable()
export class ResetWalletUseCase {
  constructor(private readonly walletRepository: WalletRepository) {}

  async executar(jogadorId: string): Promise<void> {
    const carteira = await this.walletRepository.buscarPorJogadorId(jogadorId);
    if (!carteira) throw new NotFoundException('Carteira não encontrada');
    carteira.resetar(SALDO_INICIAL);
    await this.walletRepository.salvar(carteira);
  }
}
