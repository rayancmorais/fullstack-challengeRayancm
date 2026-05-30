import { Injectable, Inject } from '@nestjs/common';
import { WalletRepository } from '../domain/wallet.repository';
import { PublicadorMensagens, PUBLICADOR_MENSAGENS } from './debit-wallet.use-case';

interface CreditarCarteiraDto {
  apostaId: string;
  jogadorId: string;
  valorCentavos: bigint;
}

@Injectable()
export class CreditWalletUseCase {
  constructor(
    private readonly walletRepository: WalletRepository,
    @Inject(PUBLICADOR_MENSAGENS) private readonly publicador: PublicadorMensagens,
  ) {}

  async executar(dto: CreditarCarteiraDto): Promise<void> {
    const carteira = await this.walletRepository.buscarPorJogadorId(dto.jogadorId);

    if (!carteira) {
      console.warn(`[creditar] Carteira não encontrada para jogador ${dto.jogadorId} — aposta ${dto.apostaId}`);
      await this.publicador.publicar('bet.credit.failed', {
        apostaId: dto.apostaId,
        motivo: 'Carteira não encontrada',
      });
      return;
    }

    carteira.creditar(dto.valorCentavos);
    await this.walletRepository.salvar(carteira);
    await this.publicador.publicar('bet.credit.confirmed', { apostaId: dto.apostaId });
  }
}
