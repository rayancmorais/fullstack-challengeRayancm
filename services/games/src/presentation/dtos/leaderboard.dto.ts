import { ApiProperty } from '@nestjs/swagger';
import type { EntradaLeaderboard } from '../../domain/round/round.repository';

export class LeaderboardEntryDto {
  @ApiProperty() posicao: number;
  @ApiProperty() jogadorId: string;
  @ApiProperty() nomeUsuario: string;
  @ApiProperty({ description: 'PnL em centavos (string para preservar precisão)' }) pnl: string;
  @ApiProperty() rodadas: number;

  static deEntrada(entrada: EntradaLeaderboard, posicao: number): LeaderboardEntryDto {
    const dto = new LeaderboardEntryDto();
    dto.posicao = posicao;
    dto.jogadorId = entrada.jogadorId;
    dto.nomeUsuario = entrada.nomeUsuario;
    dto.pnl = entrada.pnl.toString();
    dto.rodadas = entrada.rodadas;
    return dto;
  }
}
