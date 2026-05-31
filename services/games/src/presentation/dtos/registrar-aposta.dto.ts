import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsInt, Min, Max, IsNumber, IsOptional } from 'class-validator';

export class RegistrarApostaDto {
  @ApiProperty({ description: 'Valor da aposta em centavos (mínimo R$1,00 = 100, máximo R$1.000,00 = 100000)' })
  @IsInt()
  @Min(100)
  @Max(100_000)
  valorCentavos: number;

  @ApiPropertyOptional({ description: 'Multiplicador alvo para saque automático no servidor (ex: 2.0 = 2×). Mínimo 1.01.' })
  @IsOptional()
  @IsNumber()
  @Min(1.01)
  autoCashout?: number;
}
