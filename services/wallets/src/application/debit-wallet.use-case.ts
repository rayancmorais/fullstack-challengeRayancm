import { Injectable, Inject } from '@nestjs/common';
import { WalletRepository } from '../domain/wallet.repository';

interface DebitarCarteiraDto {
  apostaId: string;
  jogadorId: string;
  valorCentavos: bigint;
}

export interface PublicadorMensagens {
  publicar(chaveRoteamento: string, payload: unknown): Promise<void>;
}

export const PUBLICADOR_MENSAGENS = 'PUBLICADOR_MENSAGENS';

@Injectable()
export class DebitWalletUseCase {
  constructor(
    private readonly walletRepository: WalletRepository,
    @Inject(PUBLICADOR_MENSAGENS) private readonly publicador: PublicadorMensagens,
  ) {}

  async executar(dto: DebitarCarteiraDto): Promise<void> {
    const carteira = await this.walletRepository.buscarPorJogadorId(dto.jogadorId);

    if (!carteira) {
      await this.publicador.publicar('bet.debit.failed', {
        apostaId: dto.apostaId,
        motivo: 'Carteira não encontrada',
      });
      return;
    }

    const resultado = carteira.debitar(dto.valorCentavos);

    if (!resultado.ok) {
      await this.publicador.publicar('bet.debit.failed', {
        apostaId: dto.apostaId,
        motivo: resultado.erro,
      });
      return;
    }

    await this.walletRepository.salvar(carteira);
    await this.publicador.publicar('bet.debit.confirmed', { apostaId: dto.apostaId });
  }
}
