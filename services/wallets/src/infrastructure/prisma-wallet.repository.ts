import { Injectable } from '@nestjs/common';
import { Wallet } from '../domain/wallet.entity';
import { WalletRepository } from '../domain/wallet.repository';
import { PrismaService } from './prisma.service';

@Injectable()
export class PrismaWalletRepository extends WalletRepository {
  constructor(private readonly prisma: PrismaService) {
    super();
  }

  async buscarPorJogadorId(jogadorId: string): Promise<Wallet | null> {
    const registro = await this.prisma.wallet.findUnique({ where: { jogadorId } });
    if (!registro) return null;
    return Wallet.reconstituir({
      id: registro.id,
      jogadorId: registro.jogadorId,
      nomeUsuario: registro.nomeUsuario,
      saldo: registro.saldo,
      criadoEm: registro.criadoEm,
    });
  }

  async buscarPorId(id: string): Promise<Wallet | null> {
    const registro = await this.prisma.wallet.findUnique({ where: { id } });
    if (!registro) return null;
    return Wallet.reconstituir({
      id: registro.id,
      jogadorId: registro.jogadorId,
      nomeUsuario: registro.nomeUsuario,
      saldo: registro.saldo,
      criadoEm: registro.criadoEm,
    });
  }

  async salvar(carteira: Wallet): Promise<void> {
    await this.prisma.wallet.upsert({
      where: { id: carteira.id },
      create: {
        id: carteira.id,
        jogadorId: carteira.jogadorId,
        nomeUsuario: carteira.nomeUsuario,
        saldo: carteira.saldo,
      },
      update: {
        saldo: carteira.saldo,
        nomeUsuario: carteira.nomeUsuario,
      },
    });
  }
}
