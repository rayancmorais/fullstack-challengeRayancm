import { Injectable, Inject } from '@nestjs/common';
import { Bet } from '../domain/bet/bet.entity';
import { GameEngineService } from './game-engine.service';
import { type PublicadorMensagens, PUBLICADOR_MENSAGENS } from './publicador-mensagens';

interface RegistrarApostaDto {
  jogadorId: string;
  nomeUsuario: string;
  valorCentavos: bigint;
  autoCashout?: number;
}

@Injectable()
export class RegistrarApostaUseCase {
  constructor(
    private readonly engine: GameEngineService,
    @Inject(PUBLICADOR_MENSAGENS) private readonly publicador: PublicadorMensagens,
  ) {}

  async executar(dto: RegistrarApostaDto): Promise<Bet> {
    // O engine valida as regras de domínio, persiste e emite o evento WebSocket
    const aposta = await this.engine.registrarAposta(
      dto.jogadorId,
      dto.nomeUsuario,
      dto.valorCentavos,
      dto.autoCashout,
    );

    // Solicita o débito na carteira — assíncrono via RabbitMQ
    // JSON não suporta BigInt, então convertemos para number aqui
    await this.publicador.publicar('bet.debit.requested', {
      apostaId: aposta.id,
      jogadorId: dto.jogadorId,
      valorCentavos: Number(dto.valorCentavos),
    });

    return aposta;
  }
}
