import { Round } from './round.entity';
import { Bet } from '../bet/bet.entity';

export interface EntradaLeaderboard {
  jogadorId: string;
  nomeUsuario: string;
  pnl: bigint;      // centavos, pode ser negativo
  rodadas: number;
}

export abstract class RoundRepository {
  abstract salvar(rodada: Round): Promise<void>;
  abstract buscarPorId(id: string): Promise<Round | null>;
  abstract listarHistorico(pagina: number, limite: number): Promise<Round[]>;
  abstract listarApostasPorJogador(jogadorId: string, pagina: number, limite: number): Promise<Bet[]>;
  abstract listarLeaderboard(aPartirDe: Date): Promise<EntradaLeaderboard[]>;
}
