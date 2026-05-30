import { ApiProperty } from '@nestjs/swagger';
import { Bet, StatusAposta } from '../../domain/bet/bet.entity';

export class ApostaResponseDto {
  @ApiProperty() id: string;
  @ApiProperty() rodadaId: string;
  @ApiProperty() jogadorId: string;
  @ApiProperty() nomeUsuario: string;
  @ApiProperty({ description: 'Valor apostado em centavos (string)' }) valorCentavos: string;
  @ApiProperty({ enum: StatusAposta }) status: StatusAposta;
  @ApiProperty({ required: false }) multiplicadorSaque?: number;
  @ApiProperty({ required: false, description: 'Pagamento em centavos (string)' }) pagamentoCentavos?: string;
  @ApiProperty() apostadoEm: Date;

  static deEntidade(aposta: Bet): ApostaResponseDto {
    const dto = new ApostaResponseDto();
    dto.id = aposta.id;
    dto.rodadaId = aposta.rodadaId;
    dto.jogadorId = aposta.jogadorId;
    dto.nomeUsuario = aposta.nomeUsuario;
    dto.valorCentavos = aposta.valorCentavos.toString();
    dto.status = aposta.status;
    dto.multiplicadorSaque = aposta.multiplicadorSaque;
    dto.pagamentoCentavos = aposta.pagamentoCentavos?.toString();
    dto.apostadoEm = aposta.apostadoEm;
    return dto;
  }
}
