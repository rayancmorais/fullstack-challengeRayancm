import { Inject, Injectable, Logger } from '@nestjs/common';
import { ClientProxy } from '@nestjs/microservices';
import { type PublicadorMensagens, PUBLICADOR_MENSAGENS } from '../../application/debit-wallet.use-case';

@Injectable()
export class RabbitMQPublisher implements PublicadorMensagens {
  private readonly logger = new Logger(RabbitMQPublisher.name);

  constructor(
    @Inject('RABBITMQ_CLIENT') private readonly client: ClientProxy,
  ) {}

  async publicar(chaveRoteamento: string, payload: unknown): Promise<void> {
    try {
      this.client.emit(chaveRoteamento, payload);
    } catch (erro) {
      this.logger.error(
        `Falha ao publicar evento "${chaveRoteamento}": ${(erro as Error).message}`,
        (erro as Error).stack,
      );
      throw erro;
    }
  }
}

export { PUBLICADOR_MENSAGENS };
