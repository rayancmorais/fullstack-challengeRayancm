import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { MicroserviceOptions, Transport } from '@nestjs/microservices';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { AppModule } from './app.module';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule);

  // Consumer RabbitMQ — escuta na fila wallet.commands
  app.connectMicroservice<MicroserviceOptions>({
    transport: Transport.RMQ,
    options: {
      urls: [process.env.RABBITMQ_URL ?? 'amqp://admin:admin@rabbitmq:5672'],
      queue: 'wallet.commands',
      queueOptions: { durable: true },
      noAck: false,
    },
  });

  app.useGlobalPipes(new ValidationPipe({ whitelist: true }));

  const config = new DocumentBuilder()
    .setTitle('Serviço de Carteiras')
    .setDescription('API de carteira do jogador — gerencia saldo e movimentações')
    .setVersion('1.0')
    .addBearerAuth()
    .build();
  SwaggerModule.setup('docs', app, SwaggerModule.createDocument(app, config));

  await app.startAllMicroservices();

  const porta = process.env.PORT ?? '4002';
  await app.listen(porta, '0.0.0.0');
  console.log(`Serviço de carteiras rodando na porta ${porta}`);
  console.log(`Documentação Swagger disponível em http://localhost:${porta}/docs`);
}

bootstrap();
