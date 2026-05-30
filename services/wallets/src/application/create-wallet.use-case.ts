import { ConflictException, Injectable } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { Wallet } from '../domain/wallet.entity';
import { WalletRepository } from '../domain/wallet.repository';

interface CriarCarteiraDto {
  jogadorId: string;
  nomeUsuario: string;
}

@Injectable()
export class CreateWalletUseCase {
  constructor(private readonly walletRepository: WalletRepository) {}

  async executar(dto: CriarCarteiraDto): Promise<Wallet> {
    const existente = await this.walletRepository.buscarPorJogadorId(dto.jogadorId);
    if (existente) {
      throw new ConflictException('Carteira já existe para este jogador');
    }

    const carteira = Wallet.criar({
      id: randomUUID(),
      jogadorId: dto.jogadorId,
      nomeUsuario: dto.nomeUsuario,
    });

    await this.walletRepository.salvar(carteira);
    return carteira;
  }
}
