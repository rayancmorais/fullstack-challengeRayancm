export interface IPublicadorEventos {
  emitirFaseApostas(dados: {
    rodadaId: string;
    hashSeedServidor: string;
    encerraEm: Date;
  }): void;

  emitirRodadaIniciada(dados: { rodadaId: string; iniciadoEm: Date }): void;

  emitirTick(dados: { multiplicador: number }): void;

  emitirCrash(dados: {
    rodadaId: string;
    pontoCrash: number;
    seedServidor: string;
    crashadoEm?: Date;
  }): void;

  emitirApostaRegistrada(dados: {
    rodadaId: string;
    jogadorId: string;
    nomeUsuario: string;
    valorCentavos: string;
  }): void;

  emitirSaque(dados: {
    rodadaId: string;
    jogadorId: string;
    pagamentoCentavos: string;
    multiplicador: number;
  }): void;

  emitirApostaCancelada(dados: {
    rodadaId: string;
    jogadorId: string;
    motivo: string;
  }): void;

  emitirAlertaCreditoFalhou(jogadorId: string, apostaId: string): void;
}

export const PUBLICADOR_EVENTOS = 'PUBLICADOR_EVENTOS';
