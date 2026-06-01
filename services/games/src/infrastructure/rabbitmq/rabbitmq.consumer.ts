import { Controller, Logger } from '@nestjs/common';
import { MessagePattern, Payload } from '@nestjs/microservices';
import { GameEngineService } from '../../application/game-engine.service';

// Confirmação de débito — aposta continua PENDENTE normalmente
interface DebitoConfirmadoPayload {
  apostaId: string;
}

// Falha no débito — aposta deve ser cancelada
interface DebitoFalhouPayload {
  apostaId: string;
  motivo: string;
}

// Falha no crédito — saque confirmado pelo domínio mas carteira rejeitou
interface CreditoFalhouPayload {
  apostaId: string;
  jogadorId: string;
  motivo: string;
}

@Controller()
export class RabbitMQConsumer {
  private readonly logger = new Logger(RabbitMQConsumer.name);

  constructor(private readonly engine: GameEngineService) {}

  @MessagePattern('bet.debit.confirmed')
  aoReceberDebitoConfirmado(@Payload() dados: DebitoConfirmadoPayload): void {
    // Débito confirmado — a aposta já está salva como PENDENTE, nada a fazer aqui
    console.log(`Débito confirmado para aposta ${dados.apostaId}`);
  }

  @MessagePattern('bet.debit.failed')
  async aoReceberDebitoFalhou(@Payload() dados: DebitoFalhouPayload): Promise<void> {
    // Saldo insuficiente ou carteira não encontrada — cancela a aposta
    await this.engine.cancelarAposta(dados.apostaId, dados.motivo);
  }

  @MessagePattern('bet.credit.confirmed')
  aoReceberCreditoConfirmado(@Payload() dados: DebitoConfirmadoPayload): void {
    this.logger.log(`Pagamento creditado para aposta ${dados.apostaId}`);
  }

  @MessagePattern('bet.credit.failed')
  aoReceberCreditoFalhou(@Payload() dados: CreditoFalhouPayload): void {
    // O saque já foi confirmado no domínio (status SACOU). Não há rollback possível
    // sem Outbox/Saga. Logamos para investigação e emitimos alerta no WebSocket.
    this.logger.error(
      `Falha ao creditar saque da aposta ${dados.apostaId} ` +
      `para jogador ${dados.jogadorId}: ${dados.motivo}`,
    );
    this.engine.emitirAlertaCreditoFalhou(dados.jogadorId, dados.apostaId);
  }
}
