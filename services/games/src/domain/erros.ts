// Erros esperados de regras de negócio — não são bugs, são fluxos válidos
export class ErroDominio extends Error {
  constructor(mensagem: string) {
    super(mensagem);
    this.name = 'ErroDominio';
  }
}
