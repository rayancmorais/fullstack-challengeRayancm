import {
  Controller,
  Get,
  Post,
  Body,
  UseGuards,
  HttpCode,
  HttpStatus,
  UnprocessableEntityException,
  Query,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiQuery, ApiResponse, ApiTags } from '@nestjs/swagger';
import { RegistrarApostaUseCase } from '../../application/registrar-aposta.use-case';
import { SacarUseCase } from '../../application/sacar.use-case';
import { RoundRepository } from '../../domain/round/round.repository';
import { ErroDominio } from '../../domain/erros';
import { KeycloakJwtGuard } from '../../infrastructure/guards/keycloak-jwt.guard';
import { UsuarioAtual } from '../../infrastructure/decorators/usuario-atual.decorator';
import type { UsuarioAutenticado } from '../../infrastructure/guards/keycloak-jwt.strategy';
import { RegistrarApostaDto } from '../dtos/registrar-aposta.dto';
import { ApostaResponseDto } from '../dtos/aposta-response.dto';

@ApiTags('apostas')
@Controller()
export class ApostasController {
  constructor(
    private readonly registrarAposta: RegistrarApostaUseCase,
    private readonly sacar: SacarUseCase,
    private readonly roundRepository: RoundRepository,
  ) {}

  @Post('bet')
  @UseGuards(KeycloakJwtGuard)
  @HttpCode(HttpStatus.CREATED)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Registrar aposta na rodada atual' })
  @ApiResponse({ status: 201, type: ApostaResponseDto })
  @ApiResponse({ status: 422, description: 'Rodada não está na fase de apostas, jogador já apostou ou valor inválido' })
  async apostar(
    @UsuarioAtual() usuario: UsuarioAutenticado,
    @Body() corpo: RegistrarApostaDto,
  ): Promise<ApostaResponseDto> {
    try {
      const aposta = await this.registrarAposta.executar({
        jogadorId: usuario.jogadorId,
        nomeUsuario: usuario.nomeUsuario,
        valorCentavos: BigInt(corpo.valorCentavos),
        autoCashout: corpo.autoCashout,
      });
      return ApostaResponseDto.deEntidade(aposta);
    } catch (erro) {
      if (erro instanceof ErroDominio) {
        throw new UnprocessableEntityException(erro.message);
      }
      throw erro;
    }
  }

  @Post('bet/cashout')
  @UseGuards(KeycloakJwtGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Sacar aposta com o multiplicador atual' })
  @ApiResponse({ status: 200, type: ApostaResponseDto })
  @ApiResponse({ status: 422, description: 'Rodada não está em andamento ou jogador não tem aposta ativa' })
  async sacarAposta(@UsuarioAtual() usuario: UsuarioAutenticado): Promise<ApostaResponseDto> {
    try {
      const aposta = await this.sacar.executar(usuario.jogadorId);
      return ApostaResponseDto.deEntidade(aposta);
    } catch (erro) {
      if (erro instanceof ErroDominio) {
        throw new UnprocessableEntityException(erro.message);
      }
      throw erro;
    }
  }

  @Get('bets/me')
  @UseGuards(KeycloakJwtGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Listar histórico de apostas do jogador autenticado' })
  @ApiQuery({ name: 'page', required: false, example: 1, description: 'Página (começa em 1)' })
  @ApiQuery({ name: 'limit', required: false, example: 20, description: 'Máximo de apostas por página' })
  @ApiResponse({ status: 200, type: [ApostaResponseDto] })
  async listarMinhasApostas(
    @UsuarioAtual() usuario: UsuarioAutenticado,
    @Query('page') pagina = '1',
    @Query('limit') limite = '20',
  ): Promise<ApostaResponseDto[]> {
    const apostas = await this.roundRepository.listarApostasPorJogador(
      usuario.jogadorId,
      Number(pagina),
      Number(limite),
    );
    return apostas.map(ApostaResponseDto.deEntidade);
  }
}
