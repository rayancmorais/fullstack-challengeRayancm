export interface PublicadorMensagens {
  publicar(chaveRoteamento: string, payload: unknown): Promise<void>;
}

export const PUBLICADOR_MENSAGENS = 'PUBLICADOR_MENSAGENS';
