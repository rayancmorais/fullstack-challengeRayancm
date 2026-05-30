import { Injectable, Inject } from '@nestjs/common';
import { Bet } from '../domain/bet/bet.entity';
import { GameEngineService } from './game-engine.service';
import { type PublicadorMensagens, PUBLICADOR_MENSAGENS } from './publicador-mensagens';

@Injectable()
export class SacarUseCase {
  constructor(
    private readonly engine: GameEngineService,
    @Inject(PUBLICADOR_MENSAGENS) private readonly publicador: PublicadorMensagens,
  ) {}

  async executar(jogadorId: string): Promise<Bet> {
    // O engine captura o multiplicador exato nesse momento, persiste e emite WebSocket
    const aposta = await this.engine.sacar(jogadorId);

    // Solicita o crédito do pagamento na carteira
    await this.publicador.publicar('bet.credit.requested', {
      apostaId: aposta.id,
      jogadorId,
      valorCentavos: Number(aposta.pagamentoCentavos!),
    });

    return aposta;
  }
}
