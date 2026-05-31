import { ErroDominio } from '../erros';

export enum StatusAposta {
  PENDENTE = 'PENDENTE',
  SACADO = 'SACADO',
  PERDIDO = 'PERDIDO',
  CANCELADO = 'CANCELADO',
}

export class Bet {
  private _status: StatusAposta = StatusAposta.PENDENTE;
  private _multiplicadorSaque?: number;
  private _pagamentoCentavos?: bigint;

  private constructor(
    public readonly id: string,
    public readonly rodadaId: string,
    public readonly jogadorId: string,
    public readonly nomeUsuario: string,
    public readonly valorCentavos: bigint,
    public readonly apostadoEm: Date,
    public readonly autoCashout?: number,
  ) {}

  static criar(params: {
    id: string;
    rodadaId: string;
    jogadorId: string;
    nomeUsuario: string;
    valorCentavos: bigint;
    autoCashout?: number;
  }): Bet {
    return new Bet(
      params.id,
      params.rodadaId,
      params.jogadorId,
      params.nomeUsuario,
      params.valorCentavos,
      new Date(),
      params.autoCashout,
    );
  }

  // Usado pelo repositório para reconstruir apostas vindas do banco
  static reconstituir(params: {
    id: string;
    rodadaId: string;
    jogadorId: string;
    nomeUsuario: string;
    valorCentavos: bigint;
    status: StatusAposta;
    autoCashout?: number;
    multiplicadorSaque?: number;
    pagamentoCentavos?: bigint;
    apostadoEm: Date;
  }): Bet {
    const aposta = new Bet(
      params.id,
      params.rodadaId,
      params.jogadorId,
      params.nomeUsuario,
      params.valorCentavos,
      params.apostadoEm,
      params.autoCashout,
    );
    aposta._status = params.status;
    aposta._multiplicadorSaque = params.multiplicadorSaque;
    aposta._pagamentoCentavos = params.pagamentoCentavos;
    return aposta;
  }

  get status(): StatusAposta {
    return this._status;
  }

  get multiplicadorSaque(): number | undefined {
    return this._multiplicadorSaque;
  }

  get pagamentoCentavos(): bigint | undefined {
    return this._pagamentoCentavos;
  }

  sacar(multiplicador: number): void {
    if (this._status !== StatusAposta.PENDENTE) {
      throw new ErroDominio('Aposta não está ativa para saque');
    }
    this._status = StatusAposta.SACADO;
    this._multiplicadorSaque = multiplicador;
    // Usa BigInt para não perder precisão: ex. 2.5x com 1000n → (1000n * 250n) / 100n = 2500n
    this._pagamentoCentavos = (this.valorCentavos * BigInt(Math.floor(multiplicador * 100))) / 100n;
  }

  marcarComoPerdida(): void {
    this._status = StatusAposta.PERDIDO;
  }

  cancelar(): void {
    if (this._status !== StatusAposta.PENDENTE) {
      throw new ErroDominio('Só é possível cancelar uma aposta pendente');
    }
    this._status = StatusAposta.CANCELADO;
  }
}
