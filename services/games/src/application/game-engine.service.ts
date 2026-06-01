import { Injectable, OnModuleInit, Inject } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { Round } from '../domain/round/round.entity';
import { Bet, StatusAposta } from '../domain/bet/bet.entity';
import { RoundRepository } from '../domain/round/round.repository';
import { ErroDominio } from '../domain/erros';
import { type PublicadorMensagens, PUBLICADOR_MENSAGENS } from './publicador-mensagens';
import { type IPublicadorEventos, PUBLICADOR_EVENTOS } from './publicador-eventos.interface';

const DELAY_INICIAL_MS              = 2_000;
const DURACAO_FASE_APOSTAS_MS       = 10_000;
const DELAY_ENTRE_RODADAS_MS        = 3_000;
const INTERVALO_TICK_MS             = 100;
const EXPOENTE_MULTIPLICADOR_POR_S  = 0.06;

@Injectable()
export class GameEngineService implements OnModuleInit {
  private rodadaAtual: Round | null = null;
  private multiplicadorAtual: number = 1.00;
  private tickInterval: ReturnType<typeof setInterval> | null = null;

  constructor(
    private readonly roundRepository: RoundRepository,
    @Inject(PUBLICADOR_EVENTOS) private readonly gateway: IPublicadorEventos,
    @Inject(PUBLICADOR_MENSAGENS) private readonly publicador: PublicadorMensagens,
  ) {}

  onModuleInit() {
    // Aguarda 2s para o servidor HTTP e WebSocket estarem prontos antes do primeiro loop
    setTimeout(() => this.iniciarFaseApostas(), DELAY_INICIAL_MS);
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
    autoCashout?: number,
  ): Promise<Bet> {
    if (!this.rodadaAtual) {
      throw new ErroDominio('Nenhuma rodada ativa no momento');
    }
    const aposta = this.rodadaAtual.registrarAposta(jogadorId, nomeUsuario, valorCentavos, autoCashout);
    await this.roundRepository.salvar(this.rodadaAtual);

    this.gateway.emitirApostaRegistrada({
      rodadaId: this.rodadaAtual.id,
      jogadorId,
      nomeUsuario,
      valorCentavos: valorCentavos.toString(),
    });

    return aposta;
  }

  // Executar saque — usado tanto pelo endpoint manual quanto pelo auto-cashout do tick
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

    // Publica crédito na carteira — mesmo fluxo do saque manual
    await this.publicador.publicar('bet.credit.requested', {
      apostaId: aposta.id,
      jogadorId,
      valorCentavos: Number(aposta.pagamentoCentavos!),
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

    const encerraEm = new Date(Date.now() + DURACAO_FASE_APOSTAS_MS);
    this.gateway.emitirFaseApostas({
      rodadaId: idRodada,
      hashSeedServidor: this.rodadaAtual.hashSeedServidor,
      encerraEm,
    });

    setTimeout(() => this.iniciarRodada(), DURACAO_FASE_APOSTAS_MS);
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
    this.tickInterval = setInterval(() => this.processarTick(marcadorTempo), INTERVALO_TICK_MS);
  }

  private async processarTick(marcadorTempo: number): Promise<void> {
    if (!this.rodadaAtual) return;

    const segundos = (Date.now() - marcadorTempo) / 1000;
    this.multiplicadorAtual = Math.round(Math.pow(Math.E, EXPOENTE_MULTIPLICADOR_POR_S * segundos) * 100) / 100;

    this.gateway.emitirTick({ multiplicador: this.multiplicadorAtual });

    // Verificar apostas com auto-cashout atingido antes de checar crash
    await this.verificarAutoCashouts();

    if (this.multiplicadorAtual >= this.rodadaAtual.pontoCrash) {
      clearInterval(this.tickInterval!);
      this.tickInterval = null;
      await this.encerrarRodada();
    }
  }

  private async verificarAutoCashouts(): Promise<void> {
    if (!this.rodadaAtual) return;

    const apostasParaSacar = this.rodadaAtual.apostas.filter(
      a =>
        a.status === StatusAposta.PENDENTE &&
        a.autoCashout !== undefined &&
        this.multiplicadorAtual >= a.autoCashout,
    );

    for (const aposta of apostasParaSacar) {
      try {
        await this.sacar(aposta.jogadorId);
      } catch (e) {
        // Ignorar — pode ter crashado antes do saque ser processado
        console.warn(`[autoCashout] Falha ao sacar automaticamente para ${aposta.jogadorId}:`, e);
      }
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

    setTimeout(() => this.iniciarFaseApostas(), DELAY_ENTRE_RODADAS_MS);
  }
}
