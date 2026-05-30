import { Injectable, OnModuleInit } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { Round } from '../domain/round/round.entity';
import { Bet } from '../domain/bet/bet.entity';
import { RoundRepository } from '../domain/round/round.repository';
import { ErroDominio } from '../domain/erros';
import { GameGateway } from '../presentation/gateways/game.gateway';

@Injectable()
export class GameEngineService implements OnModuleInit {
  private rodadaAtual: Round | null = null;
  private multiplicadorAtual: number = 1.00;
  private tickInterval: ReturnType<typeof setInterval> | null = null;

  constructor(
    private readonly roundRepository: RoundRepository,
    private readonly gateway: GameGateway,
  ) {}

  onModuleInit() {
    // Aguarda 2s para o servidor HTTP e WebSocket estarem prontos antes do primeiro loop
    setTimeout(() => this.iniciarFaseApostas(), 2000);
  }

  obterRodadaAtual(): Round | null {
    return this.rodadaAtual;
  }

  obterMultiplicadorAtual(): number {
    return this.multiplicadorAtual;
  }

  async registrarAposta(
    jogadorId: string,
    nomeUsuario: string,
    valorCentavos: bigint,
  ): Promise<Bet> {
    if (!this.rodadaAtual) {
      throw new ErroDominio('Nenhuma rodada ativa no momento');
    }
    const aposta = this.rodadaAtual.registrarAposta(jogadorId, nomeUsuario, valorCentavos);
    await this.roundRepository.salvar(this.rodadaAtual);

    this.gateway.emitirApostaRegistrada({
      rodadaId: this.rodadaAtual.id,
      jogadorId,
      nomeUsuario,
      valorCentavos: valorCentavos.toString(),
    });

    return aposta;
  }

  async sacar(jogadorId: string): Promise<Bet> {
    if (!this.rodadaAtual) {
      throw new ErroDominio('Nenhuma rodada ativa no momento');
    }
    const aposta = this.rodadaAtual.sacar(jogadorId, this.multiplicadorAtual);
    await this.roundRepository.salvar(this.rodadaAtual);

    this.gateway.emitirSaque({
      rodadaId: this.rodadaAtual.id,
      jogadorId,
      pagamentoCentavos: aposta.pagamentoCentavos!.toString(),
      multiplicador: this.multiplicadorAtual,
    });

    return aposta;
  }

  async cancelarAposta(apostaId: string, motivo: string): Promise<void> {
    if (!this.rodadaAtual) {
      console.warn(`[cancelarAposta] Nenhuma rodada ativa ao tentar cancelar aposta ${apostaId}`);
      return;
    }
    const aposta = this.rodadaAtual.apostas.find(a => a.id === apostaId);
    if (!aposta) {
      console.warn(`[cancelarAposta] Aposta ${apostaId} não encontrada na rodada ${this.rodadaAtual.id}`);
      return;
    }
    aposta.cancelar();
    await this.roundRepository.salvar(this.rodadaAtual);
    this.gateway.emitirApostaCancelada({
      rodadaId: this.rodadaAtual.id,
      jogadorId: aposta.jogadorId,
      motivo,
    });
  }

  private async iniciarFaseApostas(): Promise<void> {
    const idRodada = randomUUID();
    this.rodadaAtual = Round.criar(idRodada);
    this.multiplicadorAtual = 1.00;

    await this.roundRepository.salvar(this.rodadaAtual);

    const encerraEm = new Date(Date.now() + 10_000);
    this.gateway.emitirFaseApostas({
      rodadaId: idRodada,
      hashSeedServidor: this.rodadaAtual.hashSeedServidor,
      encerraEm,
    });

    setTimeout(() => this.iniciarRodada(), 10_000);
  }

  private async iniciarRodada(): Promise<void> {
    if (!this.rodadaAtual) return;

    this.rodadaAtual.iniciar();
    const iniciadoEm = new Date();

    this.gateway.emitirRodadaIniciada({
      rodadaId: this.rodadaAtual.id,
      iniciadoEm,
    });

    const marcadorTempo = Date.now();
    this.tickInterval = setInterval(() => this.processarTick(marcadorTempo), 100);
  }

  private async processarTick(marcadorTempo: number): Promise<void> {
    if (!this.rodadaAtual) return;

    const segundos = (Date.now() - marcadorTempo) / 1000;
    this.multiplicadorAtual = Math.round(Math.pow(Math.E, 0.06 * segundos) * 100) / 100;

    this.gateway.emitirTick({ multiplicador: this.multiplicadorAtual });

    if (this.multiplicadorAtual >= this.rodadaAtual.pontoCrash) {
      clearInterval(this.tickInterval!);
      this.tickInterval = null;
      await this.encerrarRodada();
    }
  }

  private async encerrarRodada(): Promise<void> {
    if (!this.rodadaAtual) return;

    this.rodadaAtual.crashar();
    await this.roundRepository.salvar(this.rodadaAtual);

    this.gateway.emitirCrash({
      rodadaId: this.rodadaAtual.id,
      pontoCrash: this.rodadaAtual.pontoCrash,
      seedServidor: this.rodadaAtual.seedServidor!,
      crashadoEm: new Date(),
    });

    setTimeout(() => this.iniciarFaseApostas(), 3_000);
  }
}
