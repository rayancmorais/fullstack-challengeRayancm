import { Injectable } from '@nestjs/common';
import { Round, StatusRodada } from '../domain/round/round.entity';
import { RoundRepository, EntradaLeaderboard } from '../domain/round/round.repository';
import { Bet, StatusAposta } from '../domain/bet/bet.entity';
import { PrismaService } from './prisma.service';

interface RegistroBancoDadosBet {
  id: string;
  rodadaId: string;
  jogadorId: string;
  nomeUsuario: string;
  valorCentavos: bigint;
  status: string;
  autoCashout: number | null;
  multiplicadorSaque: number | null;
  pagamentoCentavos: bigint | null;
  apostadoEm: Date;
}

interface RegistroBancoDadosRound {
  id: string;
  status: string;
  hashSeedServidor: string;
  seedServidor: string;
  pontoCrash: number;
  iniciadoEm: Date;
  crashadoEm: Date | null;
  apostas?: RegistroBancoDadosBet[];
}

@Injectable()
export class PrismaRoundRepository extends RoundRepository {
  constructor(private readonly prisma: PrismaService) {
    super();
  }

  async salvar(rodada: Round): Promise<void> {
    const dados = rodada.dadosParaPersistencia();

    await this.prisma.$transaction(async (tx) => {
      await tx.round.upsert({
        where: { id: dados.id },
        create: {
          id:               dados.id,
          status:           dados.status,
          hashSeedServidor: dados.hashSeedServidor,
          seedServidor:     dados.seedServidor,
          pontoCrash:       dados.pontoCrash,
          iniciadoEm:       dados.iniciadoEm,
          crashadoEm:       dados.crashadoEm ?? null,
        },
        update: {
          status:     dados.status,
          crashadoEm: dados.crashadoEm ?? null,
        },
      });

      await this.salvarApostas(tx, rodada.apostas);
    });
  }

  private async salvarApostas(
    tx: Parameters<Parameters<typeof this.prisma.$transaction>[0]>[0],
    apostas: ReadonlyArray<Bet>,
  ): Promise<void> {
    for (const aposta of apostas) {
      await tx.bet.upsert({
        where:  { id: aposta.id },
        create: {
          id:                 aposta.id,
          rodadaId:           aposta.rodadaId,
          jogadorId:          aposta.jogadorId,
          nomeUsuario:        aposta.nomeUsuario,
          valorCentavos:      aposta.valorCentavos,
          status:             aposta.status,
          autoCashout:        aposta.autoCashout ?? null,
          multiplicadorSaque: aposta.multiplicadorSaque ?? null,
          pagamentoCentavos:  aposta.pagamentoCentavos ?? null,
          apostadoEm:         aposta.apostadoEm,
        },
        update: {
          status:             aposta.status,
          multiplicadorSaque: aposta.multiplicadorSaque ?? null,
          pagamentoCentavos:  aposta.pagamentoCentavos ?? null,
        },
      });
    }
  }

  async buscarPorId(id: string): Promise<Round | null> {
    const registro = await this.prisma.round.findUnique({
      where: { id },
      include: { apostas: true },
    });
    if (!registro) return null;
    return this.mapearParaDominio(registro);
  }

  async listarHistorico(pagina: number, limite: number): Promise<Round[]> {
    const registros = await this.prisma.round.findMany({
      where: { status: StatusRodada.CRASHADO },
      orderBy: { iniciadoEm: 'desc' },
      skip: (pagina - 1) * limite,
      take: limite,
    });
    return registros.map((r) => this.mapearParaDominio(r));
  }

  async listarApostasPorJogador(jogadorId: string, pagina: number, limite: number): Promise<Bet[]> {
    const registros = await this.prisma.bet.findMany({
      where: { jogadorId },
      orderBy: { apostadoEm: 'desc' },
      skip: (pagina - 1) * limite,
      take: limite,
    });
    return registros.map((a) =>
      Bet.reconstituir({
        id: a.id,
        rodadaId: a.rodadaId,
        jogadorId: a.jogadorId,
        nomeUsuario: a.nomeUsuario,
        valorCentavos: a.valorCentavos,
        status: a.status as StatusAposta,
        autoCashout: a.autoCashout ?? undefined,
        multiplicadorSaque: a.multiplicadorSaque ?? undefined,
        pagamentoCentavos: a.pagamentoCentavos ?? undefined,
        apostadoEm: a.apostadoEm,
      }),
    );
  }

  async listarLeaderboard(aPartirDe: Date): Promise<EntradaLeaderboard[]> {
    const resultado = await this.prisma.$queryRaw<Array<{
      jogadorId: string;
      nomeUsuario: string;
      pnl: bigint;
      rodadas: bigint;
    }>>`
      SELECT
        "jogadorId",
        "nomeUsuario",
        COALESCE(SUM("pagamentoCentavos"), 0) - SUM("valorCentavos") AS pnl,
        COUNT(*) AS rodadas
      FROM apostas
      WHERE status IN ('SACADO', 'PERDIDO')
        AND "apostadoEm" >= ${aPartirDe}
      GROUP BY "jogadorId", "nomeUsuario"
      ORDER BY pnl DESC
      LIMIT 10
    `;

    return resultado.map(r => ({
      jogadorId: r.jogadorId,
      nomeUsuario: r.nomeUsuario,
      pnl: BigInt(r.pnl),
      rodadas: Number(r.rodadas),
    }));
  }

  private mapearParaDominio(registro: RegistroBancoDadosRound): Round {
    const apostas = (registro.apostas ?? []).map((a: RegistroBancoDadosBet) =>
      Bet.reconstituir({
        id: a.id,
        rodadaId: a.rodadaId,
        jogadorId: a.jogadorId,
        nomeUsuario: a.nomeUsuario,
        valorCentavos: a.valorCentavos,
        status: a.status as StatusAposta,
        autoCashout: a.autoCashout ?? undefined,
        multiplicadorSaque: a.multiplicadorSaque ?? undefined,
        pagamentoCentavos: a.pagamentoCentavos ?? undefined,
        apostadoEm: a.apostadoEm,
      }),
    );

    return Round.reconstituir({
      id: registro.id,
      status: registro.status as StatusRodada,
      hashSeedServidor: registro.hashSeedServidor,
      seedServidor: registro.seedServidor,
      pontoCrash: registro.pontoCrash,
      iniciadoEm: registro.iniciadoEm,
      crashadoEm: registro.crashadoEm ?? undefined,
      apostas,
    });
  }
}
