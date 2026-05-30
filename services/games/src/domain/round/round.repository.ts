import { Round } from './round.entity';
import { Bet } from '../bet/bet.entity';

export abstract class RoundRepository {
  abstract salvar(rodada: Round): Promise<void>;
  abstract buscarPorId(id: string): Promise<Round | null>;
  abstract listarHistorico(pagina: number, limite: number): Promise<Round[]>;
  abstract listarApostasPorJogador(jogadorId: string, pagina: number, limite: number): Promise<Bet[]>;
}
