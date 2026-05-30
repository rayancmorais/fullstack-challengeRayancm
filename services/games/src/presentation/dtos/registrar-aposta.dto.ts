import { ApiProperty } from '@nestjs/swagger';
import { IsInt, Min, Max } from 'class-validator';

export class RegistrarApostaDto {
  @ApiProperty({ description: 'Valor da aposta em centavos (mínimo R$1,00 = 100, máximo R$1.000,00 = 100000)' })
  @IsInt()
  @Min(100)
  @Max(100_000)
  valorCentavos: number;
}
