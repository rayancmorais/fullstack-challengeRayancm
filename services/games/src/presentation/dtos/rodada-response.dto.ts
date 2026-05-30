import { ApiProperty } from '@nestjs/swagger';
import { Round, StatusRodada } from '../../domain/round/round.entity';
import { ApostaResponseDto } from './aposta-response.dto';

export class RodadaResponseDto {
  @ApiProperty() id: string;
  @ApiProperty({ enum: StatusRodada }) status: StatusRodada;
  @ApiProperty() hashSeedServidor: string;
  @ApiProperty({ required: false, description: 'Revelado após o crash' }) seedServidor?: string;
  @ApiProperty({ required: false, description: 'Revelado após o crash' }) pontoCrash?: number;
  @ApiProperty({ required: false }) multiplicadorAtual?: number;
  @ApiProperty() iniciadoEm: Date;
  @ApiProperty({ required: false }) crashadoEm?: Date;
  @ApiProperty({ type: [ApostaResponseDto] }) apostas: ApostaResponseDto[];

  static deEntidade(rodada: Round, multiplicadorAtual?: number): RodadaResponseDto {
    const dto = new RodadaResponseDto();
    dto.id = rodada.id;
    dto.status = rodada.status;
    dto.hashSeedServidor = rodada.hashSeedServidor;
    dto.iniciadoEm = rodada.iniciadoEm;
    dto.crashadoEm = rodada.crashadoEm;
    dto.apostas = rodada.apostas.map(ApostaResponseDto.deEntidade);

    if (rodada.status === StatusRodada.CRASHADO) {
      dto.seedServidor = rodada.seedServidor;
      dto.pontoCrash = rodada.pontoCrash;
    }

    if (rodada.status === StatusRodada.RODANDO && multiplicadorAtual !== undefined) {
      dto.multiplicadorAtual = multiplicadorAtual;
    }

    return dto;
  }
}
