import { Resultado } from './result.type';

export class Wallet {
  private constructor(
    public readonly id: string,
    public readonly jogadorId: string,
    public readonly nomeUsuario: string,
    private _saldo: bigint,
    public readonly criadoEm: Date,
  ) {}

  static criar(params: {
    id: string;
    jogadorId: string;
    nomeUsuario: string;
  }): Wallet {
    return new Wallet(
      params.id,
      params.jogadorId,
      params.nomeUsuario,
      0n,
      new Date(),
    );
  }

  static reconstituir(params: {
    id: string;
    jogadorId: string;
    nomeUsuario: string;
    saldo: bigint;
    criadoEm: Date;
  }): Wallet {
    return new Wallet(
      params.id,
      params.jogadorId,
      params.nomeUsuario,
      params.saldo,
      params.criadoEm,
    );
  }

  get saldo(): bigint {
    return this._saldo;
  }

  debitar(valorCentavos: bigint): Resultado<void> {
    if (valorCentavos <= 0n) {
      return { ok: false, erro: 'O valor deve ser positivo' };
    }
    if (this._saldo < valorCentavos) {
      return { ok: false, erro: 'Saldo insuficiente' };
    }
    this._saldo -= valorCentavos;
    return { ok: true, valor: undefined };
  }

  creditar(valorCentavos: bigint): void {
    if (valorCentavos <= 0n) {
      throw new Error('O valor do crédito deve ser positivo');
    }
    this._saldo += valorCentavos;
  }
}
