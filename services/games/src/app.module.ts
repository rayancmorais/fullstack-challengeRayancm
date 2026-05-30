import { Module } from '@nestjs/common';
import { PassportModule } from '@nestjs/passport';
import { ClientsModule, Transport } from '@nestjs/microservices';

// Domínio
import { RoundRepository } from './domain/round/round.repository';

// Aplicação
import { GameEngineService } from './application/game-engine.service';
import { RegistrarApostaUseCase } from './application/registrar-aposta.use-case';
import { SacarUseCase } from './application/sacar.use-case';
import { PUBLICADOR_MENSAGENS } from './application/publicador-mensagens';

// Infraestrutura
import { PrismaService } from './infrastructure/prisma.service';
import { PrismaRoundRepository } from './infrastructure/prisma-round.repository';
import { KeycloakJwtStrategy } from './infrastructure/guards/keycloak-jwt.strategy';
import { RabbitMQPublisher } from './infrastructure/rabbitmq/rabbitmq.publisher';
import { RabbitMQConsumer } from './infrastructure/rabbitmq/rabbitmq.consumer';

// Apresentação
import { GameGateway } from './presentation/gateways/game.gateway';
import { GamesController } from './presentation/controllers/games.controller';
import { RodadasController } from './presentation/controllers/rodadas.controller';
import { ApostasController } from './presentation/controllers/apostas.controller';

@Module({
  imports: [
    PassportModule.register({ defaultStrategy: 'keycloak-jwt' }),
    ClientsModule.register([
      {
        name: 'RABBITMQ_CLIENT',
        transport: Transport.RMQ,
        options: {
          urls: [process.env.RABBITMQ_URL ?? 'amqp://admin:admin@rabbitmq:5672'],
          queue: 'wallet.commands', // fila onde o wallet escuta
          queueOptions: { durable: true },
        },
      },
    ]),
  ],
  controllers: [
    GamesController,
    RodadasController,
    ApostasController,
    RabbitMQConsumer,
  ],
  providers: [
    // Banco de dados
    PrismaService,
    { provide: RoundRepository, useClass: PrismaRoundRepository },

    // Mensageria
    { provide: PUBLICADOR_MENSAGENS, useClass: RabbitMQPublisher },

    // Autenticação
    KeycloakJwtStrategy,

    // WebSocket
    GameGateway,

    // Motor do jogo e casos de uso
    GameEngineService,
    RegistrarApostaUseCase,
    SacarUseCase,
  ],
})
export class AppModule {}
