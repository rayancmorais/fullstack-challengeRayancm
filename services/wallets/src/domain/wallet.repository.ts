import { Wallet } from './wallet.entity';

export abstract class WalletRepository {
  abstract buscarPorJogadorId(jogadorId: string): Promise<Wallet | null>;
  abstract buscarPorId(id: string): Promise<Wallet | null>;
  abstract salvar(carteira: Wallet): Promise<void>;
}
