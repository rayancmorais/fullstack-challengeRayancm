import { Inject, Injectable } from '@nestjs/common';
import { ClientProxy } from '@nestjs/microservices';
import type { PublicadorMensagens } from '../../application/publicador-mensagens';

@Injectable()
export class RabbitMQPublisher implements PublicadorMensagens {
  constructor(
    @Inject('RABBITMQ_CLIENT') private readonly client: ClientProxy,
  ) {}

  async publicar(chaveRoteamento: string, payload: unknown): Promise<void> {
    this.client.emit(chaveRoteamento, payload);
  }
}
