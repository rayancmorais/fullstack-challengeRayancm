import { Injectable } from '@nestjs/common';
import { Bet } from '../domain/bet/bet.entity';
import { GameEngineService } from './game-engine.service';

@Injectable()
export class SacarUseCase {
  constructor(private readonly engine: GameEngineService) {}

  async executar(jogadorId: string): Promise<Bet> {
    // O engine faz o saque, persiste, emite WS e publica bet.credit.requested
    return this.engine.sacar(jogadorId);
  }
}
