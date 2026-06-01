import {
  WebSocketGateway,
  WebSocketServer,
  OnGatewayConnection,
  OnGatewayDisconnect,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { IPublicadorEventos } from '../../application/publicador-eventos.interface';

@WebSocketGateway({
  cors: {
    origin: [
      'http://localhost:3000',   // Next.js dev
      'http://localhost:3001',   // Next.js Docker
    ],
    credentials: true,
  },
  namespace: '/jogo',
})
export class GameGateway implements OnGatewayConnection, OnGatewayDisconnect, IPublicadorEventos {
  @WebSocketServer()
  servidor: Server;

  handleConnection(cliente: Socket) {
    console.log(`Jogador conectado: ${cliente.id}`);
  }

  handleDisconnect(cliente: Socket) {
    console.log(`Jogador desconectado: ${cliente.id}`);
  }

  emitirFaseApostas(dados: {
    rodadaId: string;
    hashSeedServidor: string;
    encerraEm: Date;
  }): void {
    this.servidor.emit('rodada:apostas', dados);
  }

  emitirRodadaIniciada(dados: { rodadaId: string; iniciadoEm: Date }): void {
    this.servidor.emit('rodada:iniciada', dados);
  }

  emitirTick(dados: { multiplicador: number }): void {
    this.servidor.emit('rodada:tick', dados);
  }

  emitirCrash(dados: {
    rodadaId: string;
    pontoCrash: number;
    seedServidor: string;
    crashadoEm: Date;
  }): void {
    this.servidor.emit('rodada:crash', dados);
  }

  emitirApostaRegistrada(dados: {
    rodadaId: string;
    jogadorId: string;
    nomeUsuario: string;
    valorCentavos: string;
  }): void {
    this.servidor.emit('aposta:registrada', dados);
  }

  emitirSaque(dados: {
    rodadaId: string;
    jogadorId: string;
    pagamentoCentavos: string;
    multiplicador: number;
  }): void {
    this.servidor.emit('aposta:saque', dados);
  }

  // Emitido quando o débito na carteira falha (saldo insuficiente)
  emitirApostaCancelada(dados: { rodadaId: string; jogadorId: string; motivo: string }): void {
    this.servidor.emit('aposta:cancelada', dados);
  }
}
