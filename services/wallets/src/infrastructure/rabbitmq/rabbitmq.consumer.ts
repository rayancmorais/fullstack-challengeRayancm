import { Controller } from '@nestjs/common';
import { MessagePattern, Payload } from '@nestjs/microservices';
import { DebitWalletUseCase } from '../../application/debit-wallet.use-case';
import { CreditWalletUseCase } from '../../application/credit-wallet.use-case';

// RabbitMQ serializa números como number — convertemos para bigint ao receber
interface SolicitacaoDebitoDados {
  apostaId: string;
  jogadorId: string;
  valorCentavos: number;
}

interface SolicitacaoCreditoDados {
  apostaId: string;
  jogadorId: string;
  valorCentavos: number;
}

@Controller()
export class RabbitMQConsumer {
  constructor(
    private readonly debitarCarteira: DebitWalletUseCase,
    private readonly creditarCarteira: CreditWalletUseCase,
  ) {}

  @MessagePattern('bet.debit.requested')
  async aoReceberSolicitacaoDebito(@Payload() dados: SolicitacaoDebitoDados): Promise<void> {
    await this.debitarCarteira.executar({
      apostaId: dados.apostaId,
      jogadorId: dados.jogadorId,
      valorCentavos: BigInt(dados.valorCentavos),
    });
  }

  @MessagePattern('bet.credit.requested')
  async aoReceberSolicitacaoCredito(@Payload() dados: SolicitacaoCreditoDados): Promise<void> {
    await this.creditarCarteira.executar({
      apostaId: dados.apostaId,
      jogadorId: dados.jogadorId,
      valorCentavos: BigInt(dados.valorCentavos),
    });
  }
}
