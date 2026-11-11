// Erro padrão das chamadas à API. "status" é o código HTTP (400, 404, 409...).
export class ApiErro extends Error {
  constructor(status, mensagem) {
    super(mensagem);
    this.name = 'ApiErro';
    this.status = status;
  }
}
