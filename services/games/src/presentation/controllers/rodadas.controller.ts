import { Controller, Get, Param, Query, NotFoundException } from '@nestjs/common';
import { ApiOperation, ApiQuery, ApiResponse, ApiTags } from '@nestjs/swagger';
import { GameEngineService } from '../../application/game-engine.service';
import { RoundRepository } from '../../domain/round/round.repository';
import { StatusRodada } from '../../domain/round/round.entity';
import { verificarPontoCrash } from '../../domain/provably-fair/provably-fair';
import { RodadaResponseDto } from '../dtos/rodada-response.dto';

@ApiTags('rodadas')
@Controller()
export class RodadasController {
  constructor(
    private readonly engine: GameEngineService,
    private readonly roundRepository: RoundRepository,
  ) {}

  @Get('rounds/current')
  @ApiOperation({ summary: 'Retornar a rodada atual com apostas em andamento' })
  @ApiResponse({ status: 200, type: RodadaResponseDto })
  buscarAtual(): RodadaResponseDto {
    const rodada = this.engine.obterRodadaAtual();
    if (!rodada) {
      throw new NotFoundException('Nenhuma rodada ativa no momento');
    }
    const multiplicador = rodada.status === StatusRodada.RODANDO
      ? this.engine.obterMultiplicadorAtual()
      : undefined;
    return RodadaResponseDto.deEntidade(rodada, multiplicador);
  }

  @Get('rounds/history')
  @ApiOperation({ summary: 'Listar histórico de rodadas encerradas (paginado)' })
  @ApiQuery({ name: 'pagina', required: false, example: 1 })
  @ApiQuery({ name: 'limite', required: false, example: 20 })
  @ApiResponse({ status: 200, type: [RodadaResponseDto] })
  async listarHistorico(
    @Query('pagina') pagina = '1',
    @Query('limite') limite = '20',
  ): Promise<RodadaResponseDto[]> {
    const rodadas = await this.roundRepository.listarHistorico(
      Number(pagina),
      Number(limite),
    );
    return rodadas.map(r => RodadaResponseDto.deEntidade(r));
  }

  @Get('rounds/:id/verify')
  @ApiOperation({ summary: 'Verificar o resultado de uma rodada encerrada (provably fair)' })
  @ApiResponse({ status: 200 })
  @ApiResponse({ status: 404, description: 'Rodada não encontrada' })
  async verificar(@Param('id') id: string) {
    const rodada = await this.roundRepository.buscarPorId(id);
    if (!rodada || rodada.status !== StatusRodada.CRASHADO) {
      throw new NotFoundException('Rodada encerrada não encontrada');
    }
    const dados = rodada.dadosParaPersistencia();
    return {
      rodadaId: rodada.id,
      hashSeedServidor: rodada.hashSeedServidor,
      seedServidor: dados.seedServidor,
      pontoCrash: rodada.pontoCrash,
      verificado: verificarPontoCrash(dados.seedServidor, rodada.id, rodada.pontoCrash),
    };
  }
}
