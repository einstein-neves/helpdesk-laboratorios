const router = require('express').Router();
const { ok, fail, id, text } = require('../utils/http');
const { PERFIS } = require('../config/permissions');
const { getUser } = require('./config');

const demoUser = getUser();
const technicians = [{
 id: 2,
 nome: 'Técnico de demonstração',
 email: 'tecnico@localhost.test',
 perfil: 'TECNICO',
 ativo: true
}];
const tickets = [];
const histories = new Map();
let nextTicketId = 1100;

const sla = {
 P1: { prioridade: 'ALTA', horas: 4 },
 P2: { prioridade: 'ALTA', horas: 8 },
 P3: { prioridade: 'MEDIA', horas: 24 },
 P4: { prioridade: 'BAIXA', horas: 72 }
};
const transitions = {
 ABERTO: ['EM_ATENDIMENTO'],
 EM_ATENDIMENTO: ['PENDENTE', 'RESOLVIDO'],
 PENDENTE: ['EM_ATENDIMENTO', 'RESOLVIDO'],
 RESOLVIDO: ['FECHADO'],
 FECHADO: []
};

function addHistory(ticket, previous, next, observation) {
 const entries = histories.get(ticket.id) || [];
 entries.unshift({
  id: entries.length + 1,
  chamadoId: ticket.id,
  usuarioId: demoUser.id,
  statusAnterior: previous,
  statusNovo: next,
  observacao: observation,
  dataAlteracao: new Date().toISOString()
 });
 histories.set(ticket.id, entries);
}

function findTicket(value) {
 const ticketId = id(value);
 const ticket = tickets.find(item => item.id === ticketId);
 if (!ticket) throw fail(404, 'Chamado não encontrado.');
 return ticket;
}

function seedTicket({ id: ticketId, titulo, descricao, laboratorio, categoria, prioridade, status, tecnicoId, openedHoursAgo }) {
 const opened = new Date(Date.now() - openedHoursAgo * 60 * 60 * 1000);
 const level = { ALTA: 'P2', MEDIA: 'P3', BAIXA: 'P4' }[prioridade];
 const due = new Date(opened.getTime() + sla[level].horas * 60 * 60 * 1000);
 const technician = technicians.find(item => item.id === tecnicoId) || null;
 const ticket = {
  id: ticketId,
  titulo,
  descricao,
  laboratorio,
  categoria,
  prioridade,
  status,
  solicitanteId: demoUser.id,
  solicitanteNome: demoUser.nome,
  tecnicoId: technician?.id ?? null,
  tecnicoNome: technician?.nome ?? null,
  dataAbertura: opened.toISOString(),
  dataAtualizacao: opened.toISOString(),
  nivelSla: level,
  prazoSla: due.toISOString()
 };
 tickets.push(ticket);
 if (technician) addHistory(ticket, 'ABERTO', 'EM_ATENDIMENTO', 'Chamado atribuído ao técnico de demonstração.');
}

seedTicket({
 id: 1042, titulo: 'Projetor não apresenta imagem', descricao: 'O projetor liga, mas não exibe imagem.',
 laboratorio: 'Laboratório 01', categoria: 'Projetor', prioridade: 'ALTA', status: 'ABERTO',
 tecnicoId: null, openedHoursAgo: 1
});
seedTicket({
 id: 1038, titulo: 'Computador sem acesso à rede', descricao: 'A estação perdeu conexão com a rede local.',
 laboratorio: 'Laboratório 02', categoria: 'Rede', prioridade: 'MEDIA', status: 'ABERTO',
 tecnicoId: null, openedHoursAgo: 3
});
seedTicket({
 id: 1031, titulo: 'Instalar software de laboratório', descricao: 'Instalar os aplicativos previstos para a aula.',
 laboratorio: 'Laboratório 03', categoria: 'Software', prioridade: 'BAIXA', status: 'ABERTO',
 tecnicoId: null, openedHoursAgo: 6
});
seedTicket({
 id: 1030, titulo: 'Teclado com falha', descricao: 'Algumas teclas não respondem.',
 laboratorio: 'Laboratório 01', categoria: 'Periférico', prioridade: 'MEDIA', status: 'EM_ATENDIMENTO',
 tecnicoId: technicians[0].id, openedHoursAgo: 2
});

router.get('/auth/me', (req, res) => ok(res, req.user));
router.post('/users/me', (req, res) => {
 text(req.body?.nome, 'Nome', 150);
 ok(res, demoUser);
});
router.get('/users/me', (req, res) => ok(res, demoUser));
router.get('/users/technicians', (req, res) => ok(res, technicians.filter(item => item.ativo)));
router.get('/users', (req, res) => {
 const offset = req.query.offset === undefined ? 0 : Number(req.query.offset);
 if (!Number.isSafeInteger(offset) || offset < 0) throw fail(400, 'Offset inválido.');
 const users = [demoUser, ...technicians].slice(offset, offset + 50);
 ok(res, users);
});
router.patch('/users/:id', (req, res) => {
 const userId = id(req.params.id);
 const user = [demoUser, ...technicians].find(item => item.id === userId);
 if (!user) throw fail(404, 'Usuário não encontrado.');
 const { perfil, ativo } = req.body || {};
 if (perfil === undefined && ativo === undefined) throw fail(400, 'Informe perfil ou ativo.');
 if (perfil !== undefined && !PERFIS.includes(perfil)) throw fail(400, 'Perfil inválido.');
 if (ativo !== undefined && typeof ativo !== 'boolean') throw fail(400, 'Ativo deve ser booleano.');
 if (userId === demoUser.id && (ativo === false || (perfil !== undefined && perfil !== 'ADMIN'))) {
  throw fail(409, 'Não é permitido remover o acesso administrativo da conta demo.');
 }
 if (perfil !== undefined) user.perfil = perfil;
 if (ativo !== undefined) user.ativo = ativo;
 ok(res, user);
});

router.get('/tickets', (req, res) => {
 const offset = req.query.offset === undefined ? 0 : Number(req.query.offset);
 if (!Number.isSafeInteger(offset) || offset < 0) throw fail(400, 'Offset inválido.');
 const statuses = ['ABERTO', 'EM_ATENDIMENTO', 'PENDENTE', 'RESOLVIDO', 'FECHADO'];
 if (req.query.status !== undefined && !statuses.includes(req.query.status)) throw fail(400, 'Status inválido.');
 const result = req.query.status ? tickets.filter(item => item.status === req.query.status) : tickets;
 ok(res, [...result].sort((a, b) => new Date(b.dataAbertura) - new Date(a.dataAbertura)).slice(offset, offset + 50));
});
router.post('/tickets', (req, res) => {
 const body = req.body || {};
 const titulo = text(body.titulo, 'Título', 200);
 const descricao = text(body.descricao, 'Descrição', 10000);
 const laboratorio = text(body.laboratorio, 'Laboratório', 150);
 const categoria = body.categoria == null ? null : text(body.categoria, 'Categoria', 100);
 const prioridade = body.prioridade ?? 'MEDIA';
 const nivelSla = body.nivelSla ?? { ALTA: 'P2', MEDIA: 'P3', BAIXA: 'P4' }[prioridade];
 if (!['ALTA', 'MEDIA', 'BAIXA'].includes(prioridade) || !sla[nivelSla] || sla[nivelSla].prioridade !== prioridade) {
  throw fail(400, 'Prioridade ou SLA inválido.');
 }
 const now = new Date();
 const ticket = {
  id: nextTicketId++,
  titulo,
  descricao,
  laboratorio,
  categoria,
  prioridade,
  status: 'ABERTO',
  solicitanteId: demoUser.id,
  solicitanteNome: demoUser.nome,
  tecnicoId: null,
  tecnicoNome: null,
  dataAbertura: now.toISOString(),
  dataAtualizacao: now.toISOString(),
  nivelSla,
  prazoSla: new Date(now.getTime() + sla[nivelSla].horas * 60 * 60 * 1000).toISOString()
 };
 tickets.unshift(ticket);
 ok(res, ticket, 201);
});
router.get('/tickets/:id', (req, res) => ok(res, findTicket(req.params.id)));
router.patch('/tickets/:id/assign', (req, res) => {
 const ticket = findTicket(req.params.id);
 const technicianId = id(req.body?.tecnicoId);
 const technician = technicians.find(item => item.id === technicianId && item.ativo);
 if (!technician) throw fail(400, 'Técnico inválido ou desativado.');
 if (ticket.status !== 'ABERTO' || ticket.tecnicoId !== null) {
  throw fail(409, 'Chamado não disponível para atribuição.');
 }
 ticket.tecnicoId = technician.id;
 ticket.tecnicoNome = technician.nome;
 ticket.status = 'EM_ATENDIMENTO';
 ticket.dataAtualizacao = new Date().toISOString();
 addHistory(ticket, 'ABERTO', 'EM_ATENDIMENTO', 'Chamado atribuído a ' + technician.nome + '.');
 ok(res, ticket);
});
router.patch('/tickets/:id/status', (req, res) => {
 const ticket = findTicket(req.params.id);
 const status = req.body?.status;
 const observation = req.body?.observacao;
 if (typeof status !== 'string' || !status.trim()) throw fail(400, 'O novo status é obrigatório.');
 if (observation !== undefined && observation !== null &&
     (typeof observation !== 'string' || observation.length > 2000)) {
  throw fail(400, 'A observação deve ser um texto de até 2000 caracteres.');
 }
 const next = status.trim();
 if (!Object.hasOwn(transitions, next)) throw fail(400, 'Status inválido.');
 if (!transitions[ticket.status].includes(next)) {
  throw fail(409, `Não é permitido alterar o status de ${ticket.status} para ${next}.`);
 }
 const previous = ticket.status;
 ticket.status = next;
 ticket.dataAtualizacao = new Date().toISOString();
 addHistory(ticket, previous, next, observation?.trim() || null);
 ok(res, { id: ticket.id, status: ticket.status, dataAtualizacao: ticket.dataAtualizacao });
});
router.get('/tickets/:id/history', (req, res) => {
 const ticket = findTicket(req.params.id);
 ok(res, histories.get(ticket.id) || []);
});

module.exports = router;
