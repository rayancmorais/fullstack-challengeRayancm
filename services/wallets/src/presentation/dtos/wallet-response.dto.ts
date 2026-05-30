import { ApiProperty } from '@nestjs/swagger';
import { Wallet } from '../../domain/wallet.entity';

export class WalletResponseDto {
  @ApiProperty({ example: 'uuid-v4' })
  id: string;

  @ApiProperty({ example: 'uuid-keycloak-do-jogador' })
  jogadorId: string;

  @ApiProperty({ example: 'jogador1' })
  nomeUsuario: string;

  @ApiProperty({ example: '150000', description: 'Saldo em centavos (BigInt serializado como string)' })
  saldo: string;

  @ApiProperty({ example: 'R$1.500,00', description: 'Saldo formatado para exibição' })
  saldoFormatado: string;

  static deEntidade(carteira: Wallet): WalletResponseDto {
    const resposta = new WalletResponseDto();
    resposta.id = carteira.id;
    resposta.jogadorId = carteira.jogadorId;
    resposta.nomeUsuario = carteira.nomeUsuario;
    resposta.saldo = carteira.saldo.toString();
    resposta.saldoFormatado = `R$${(Number(carteira.saldo) / 100).toFixed(2).replace('.', ',')}`;
    return resposta;
  }
}
