import { Module } from '@nestjs/common';
import { PassportModule } from '@nestjs/passport';
import { ClientsModule, Transport } from '@nestjs/microservices';

// Domínio
import { WalletRepository } from './domain/wallet.repository';

// Aplicação
import { CreateWalletUseCase } from './application/create-wallet.use-case';
import { GetWalletUseCase } from './application/get-wallet.use-case';
import { DebitWalletUseCase, PUBLICADOR_MENSAGENS } from './application/debit-wallet.use-case';
import { CreditWalletUseCase } from './application/credit-wallet.use-case';
import { ResetWalletUseCase } from './application/reset-wallet.use-case';

// Infraestrutura
import { PrismaService } from './infrastructure/prisma.service';
import { PrismaWalletRepository } from './infrastructure/prisma-wallet.repository';
import { KeycloakJwtStrategy } from './infrastructure/guards/keycloak-jwt.strategy';
import { RabbitMQPublisher } from './infrastructure/rabbitmq/rabbitmq.publisher';
import { RabbitMQConsumer } from './infrastructure/rabbitmq/rabbitmq.consumer';

// Apresentação
import { WalletsController } from './presentation/controllers/wallets.controller';

@Module({
  imports: [
    PassportModule.register({ defaultStrategy: 'keycloak-jwt' }),
    ClientsModule.register([
      {
        name: 'RABBITMQ_CLIENT',
        transport: Transport.RMQ,
        options: {
          urls: [process.env.RABBITMQ_URL ?? 'amqp://admin:admin@rabbitmq:5672'],
          queue: 'game.events',
          queueOptions: { durable: true },
        },
      },
    ]),
  ],
  controllers: [WalletsController, RabbitMQConsumer],
  providers: [
    // Banco de dados
    PrismaService,
    { provide: WalletRepository, useClass: PrismaWalletRepository },

    // Mensageria
    { provide: PUBLICADOR_MENSAGENS, useClass: RabbitMQPublisher },

    // Autenticação
    KeycloakJwtStrategy,

    // Casos de uso
    CreateWalletUseCase,
    GetWalletUseCase,
    DebitWalletUseCase,
    CreditWalletUseCase,
    ResetWalletUseCase,
  ],
})
export class AppModule {}
