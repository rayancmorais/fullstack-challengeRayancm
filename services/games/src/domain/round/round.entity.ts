import { randomUUID } from 'crypto';
import { gerarSeedServidor, calcularHashSeed, calcularPontoCrash } from '../provably-fair/provably-fair';
import { Bet, StatusAposta } from '../bet/bet.entity';
import { ErroDominio } from '../erros';

export enum StatusRodada {
  APOSTAS_ABERTAS = 'APOSTAS_ABERTAS',
  RODANDO = 'RODANDO',
  CRASHADO = 'CRASHADO',
}

export class Round {
  private _apostas: Bet[] = [];
  private _crashadoEm?: Date;

  private constructor(
    public readonly id: string,
    private _status: StatusRodada,
    public readonly hashSeedServidor: string, // publicado antes da rodada — jogador usa pra verificar depois
    private readonly _seedServidor: string,   // mantido em segredo até o crash
    public readonly pontoCrash: number,       // calculado antes das apostas, nunca muda
    public readonly iniciadoEm: Date,
  ) {}

  static criar(id: string): Round {
    const seed = gerarSeedServidor();
    return new Round(
      id,
      StatusRodada.APOSTAS_ABERTAS,
      calcularHashSeed(seed),
      seed,
      calcularPontoCrash(seed, id),
      new Date(),
    );
  }

  // Reconstrói a rodada com seus dados vindos do banco
  static reconstituir(params: {
    id: string;
    status: StatusRodada;
    hashSeedServidor: string;
    seedServidor: string;
    pontoCrash: number;
    iniciadoEm: Date;
    crashadoEm?: Date;
    apostas?: Bet[];
  }): Round {
    const rodada = new Round(
      params.id,
      params.status,
      params.hashSeedServidor,
      params.seedServidor,
      params.pontoCrash,
      params.iniciadoEm,
    );
    rodada._apostas = params.apostas ?? [];
    rodada._crashadoEm = params.crashadoEm;
    return rodada;
  }

  dadosParaPersistencia() {
    return {
      id: this.id,
      status: this._status,
      hashSeedServidor: this.hashSeedServidor,
      seedServidor: this._seedServidor,
      pontoCrash: this.pontoCrash,
      iniciadoEm: this.iniciadoEm,
      crashadoEm: this._crashadoEm,
    };
  }

  get status(): StatusRodada {
    return this._status;
  }

  get apostas(): ReadonlyArray<Bet> {
    return this._apostas;
  }

  get crashadoEm(): Date | undefined {
    return this._crashadoEm;
  }

  // Seed só é revelado após o crash para o jogador poder verificar
  get seedServidor(): string | undefined {
    return this._status === StatusRodada.CRASHADO ? this._seedServidor : undefined;
  }

  registrarAposta(jogadorId: string, nomeUsuario: string, valorCentavos: bigint, autoCashout?: number): Bet {
    if (this._status !== StatusRodada.APOSTAS_ABERTAS) {
      throw new ErroDominio('Apostas só podem ser registradas na fase de apostas');
    }
    if (valorCentavos < 100n || valorCentavos > 100_000n) {
      throw new ErroDominio('Valor da aposta fora do permitido (mínimo R$1,00 — máximo R$1.000,00)');
    }
    if (this._apostas.some(a => a.jogadorId === jogadorId)) {
      throw new ErroDominio('Jogador já tem uma aposta nesta rodada');
    }
    if (autoCashout !== undefined && autoCashout < 1.01) {
      throw new ErroDominio('Auto-cashout mínimo é 1.01×');
    }

    const aposta = Bet.criar({
      id: randomUUID(),
      rodadaId: this.id,
      jogadorId,
      nomeUsuario,
      valorCentavos,
      autoCashout,
    });

    this._apostas.push(aposta);
    return aposta;
  }

  sacar(jogadorId: string, multiplicadorAtual: number): Bet {
    if (this._status !== StatusRodada.RODANDO) {
      throw new ErroDominio('Saque só é possível enquanto a rodada está em andamento');
    }
    const aposta = this._apostas.find(
      a => a.jogadorId === jogadorId && a.status === StatusAposta.PENDENTE,
    );
    if (!aposta) {
      throw new ErroDominio('Nenhuma aposta ativa encontrada para este jogador');
    }
    aposta.sacar(multiplicadorAtual);
    return aposta;
  }

  iniciar(): void {
    if (this._status !== StatusRodada.APOSTAS_ABERTAS) {
      throw new ErroDominio('Rodada não está na fase de apostas');
    }
    this._status = StatusRodada.RODANDO;
  }

  crashar(): void {
    if (this._status !== StatusRodada.RODANDO) {
      throw new ErroDominio('Rodada não está em andamento');
    }
    this._status = StatusRodada.CRASHADO;
    this._crashadoEm = new Date();

    // Todas as apostas que não foram sacadas são marcadas como perdidas
    this._apostas
      .filter(a => a.status === StatusAposta.PENDENTE)
      .forEach(a => a.marcarComoPerdida());
  }
}
