import { Injectable, NotFoundException } from '@nestjs/common';
import { Wallet } from '../domain/wallet.entity';
import { WalletRepository } from '../domain/wallet.repository';

@Injectable()
export class GetWalletUseCase {
  constructor(private readonly walletRepository: WalletRepository) {}

  async executar(jogadorId: string): Promise<Wallet> {
    const carteira = await this.walletRepository.buscarPorJogadorId(jogadorId);
    if (!carteira) {
      throw new NotFoundException('Carteira não encontrada');
    }
    return carteira;
  }
}
