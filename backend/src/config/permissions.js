const PERFIS = Object.freeze(['SOLICITANTE', 'ATENDENTE', 'TECNICO', 'ADMIN']);
function podeConsultar(user, ticket) {
 return ['ADMIN', 'ATENDENTE'].includes(user.perfil) || ticket.solicitante_id === user.id ||
  (user.perfil === 'TECNICO' && (ticket.tecnico_id === user.id || (ticket.status === 'ABERTO' && ticket.tecnico_id === null)));
}
function podeAlterarStatus(user, ticket) {
 return user.perfil === 'ADMIN' || (user.perfil === 'TECNICO' && ticket.tecnico_id === user.id);
}
module.exports = { PERFIS, podeConsultar, podeAlterarStatus };
