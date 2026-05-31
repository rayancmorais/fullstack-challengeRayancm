import { Controller, Get, Param, Query, NotFoundException, BadRequestException } from '@nestjs/common';
import { ApiOperation, ApiQuery, ApiResponse, ApiTags } from '@nestjs/swagger';
import { GameEngineService } from '../../application/game-engine.service';
import { RoundRepository } from '../../domain/round/round.repository';
import { StatusRodada } from '../../domain/round/round.entity';
import { verificarPontoCrash } from '../../domain/provably-fair/provably-fair';
import { RodadaResponseDto } from '../dtos/rodada-response.dto';
import { LeaderboardEntryDto } from '../dtos/leaderboard.dto';

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

  @Get('leaderboard')
  @ApiOperation({ summary: 'Top 10 jogadores por PnL (lucro − prejuízo) no período' })
  @ApiQuery({ name: 'period', required: false, enum: ['24h', 'week'], example: '24h' })
  @ApiResponse({ status: 200, type: [LeaderboardEntryDto] })
  async leaderboard(@Query('period') period = '24h'): Promise<LeaderboardEntryDto[]> {
    if (period !== '24h' && period !== 'week') {
      throw new BadRequestException('period deve ser "24h" ou "week"');
    }
    const ms = period === '24h' ? 24 * 60 * 60 * 1_000 : 7 * 24 * 60 * 60 * 1_000;
    const aPartirDe = new Date(Date.now() - ms);
    const entradas = await this.roundRepository.listarLeaderboard(aPartirDe);
    return entradas.map((e, i) => LeaderboardEntryDto.deEntrada(e, i + 1));
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
