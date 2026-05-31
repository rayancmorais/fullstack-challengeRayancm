import { Controller, Get, Post, UseGuards, HttpCode, HttpStatus } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { CreateWalletUseCase } from '../../application/create-wallet.use-case';
import { GetWalletUseCase } from '../../application/get-wallet.use-case';
import { ResetWalletUseCase } from '../../application/reset-wallet.use-case';
import { KeycloakJwtGuard } from '../../infrastructure/guards/keycloak-jwt.guard';
import { UsuarioAtual } from '../../infrastructure/decorators/current-user.decorator';
import type { UsuarioAutenticado } from '../../infrastructure/guards/keycloak-jwt.strategy';
import { WalletResponseDto } from '../dtos/wallet-response.dto';
import { HealthCheckResponseDto } from '../dtos/health-check-response.dto';

@ApiTags('carteiras')
@Controller()
export class WalletsController {
  constructor(
    private readonly criarCarteira: CreateWalletUseCase,
    private readonly buscarCarteira: GetWalletUseCase,
    private readonly resetarCarteira: ResetWalletUseCase,
  ) {}

  @Get('health')
  @ApiOperation({ summary: 'Verificar saúde do serviço' })
  @ApiResponse({ status: 200, type: HealthCheckResponseDto })
  verificarSaude(): HealthCheckResponseDto {
    return { status: 'ok', service: 'wallets' };
  }

  @Post('wallets')
  @UseGuards(KeycloakJwtGuard)
  @HttpCode(HttpStatus.CREATED)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Criar carteira para o jogador autenticado' })
  @ApiResponse({ status: 201, type: WalletResponseDto, description: 'Carteira criada com sucesso' })
  @ApiResponse({ status: 409, description: 'Carteira já existe para este jogador' })
  async criar(@UsuarioAtual() usuario: UsuarioAutenticado): Promise<WalletResponseDto> {
    const carteira = await this.criarCarteira.executar({
      jogadorId: usuario.jogadorId,
      nomeUsuario: usuario.nomeUsuario,
    });
    return WalletResponseDto.deEntidade(carteira);
  }

  @Post('wallets/reset')
  @UseGuards(KeycloakJwtGuard)
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Resetar saldo para R$ 1.000.000,00 (início de sessão)' })
  @ApiResponse({ status: 204, description: 'Saldo resetado com sucesso' })
  async resetar(@UsuarioAtual() usuario: UsuarioAutenticado): Promise<void> {
    await this.resetarCarteira.executar(usuario.jogadorId);
  }

  @Get('wallets/me')
  @UseGuards(KeycloakJwtGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Retornar carteira e saldo do jogador autenticado' })
  @ApiResponse({ status: 200, type: WalletResponseDto })
  @ApiResponse({ status: 404, description: 'Carteira não encontrada' })
  async buscarMinha(@UsuarioAtual() usuario: UsuarioAutenticado): Promise<WalletResponseDto> {
    const carteira = await this.buscarCarteira.executar(usuario.jogadorId);
    return WalletResponseDto.deEntidade(carteira);
  }
}
