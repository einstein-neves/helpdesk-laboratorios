const pool = require('../config/database');
const { ok, fail, id, text } = require('../utils/http');
const { podeConsultar } = require('../config/permissions');
// Colunas e junções comuns mantêm o formato da resposta consistente nas consultas.
const fields = `t.id,t.titulo,t.descricao,t.laboratorio,t.categoria,t.prioridade,t.status,
 t.solicitante_id AS "solicitanteId",s.nome AS "solicitanteNome",
 t.tecnico_id AS "tecnicoId",u.nome AS "tecnicoNome",
 t.data_abertura AS "dataAbertura",t.data_atualizacao AS "dataAtualizacao",
 t.nivel_sla AS "nivelSla",t.prazo_sla AS "prazoSla"`;
const from = ' FROM tickets t JOIN users s ON s.id=t.solicitante_id LEFT JOIN users u ON u.id=t.tecnico_id ';
async function listar(req,res) {
 const offset = req.query.offset === undefined ? 0 : Number(req.query.offset);
 if (!Number.isSafeInteger(offset) || offset<0) throw fail(400,'Offset invalido.');
 const filters = [];
 const params = [];
 // A consulta já filtra por perfil para não depender de filtros enviados pelo navegador.
 if (req.user.perfil === 'SOLICITANTE') {
  params.push(req.user.id);
  filters.push('t.solicitante_id=$'+params.length);
 } else if (req.user.perfil === 'TECNICO') {
  params.push(req.user.id);
  filters.push("(t.solicitante_id=$"+params.length+" OR t.tecnico_id=$"+params.length+" OR (t.status='ABERTO' AND t.tecnico_id IS NULL))");
 }
 if (req.query.status !== undefined) {
  const statuses = ['ABERTO','EM_ATENDIMENTO','PENDENTE','RESOLVIDO','FECHADO'];
  if (!statuses.includes(req.query.status)) throw fail(400,'Status invalido.');
  params.push(req.query.status);
  filters.push('t.status=$'+params.length);
 }
 params.push(offset);
 const where = filters.length ? filters.join(' AND ') : 'TRUE';
 const result=await pool.query('SELECT '+fields+from+'WHERE '+where+' ORDER BY t.data_abertura DESC,t.id DESC LIMIT 50 OFFSET $'+params.length,params);
 ok(res,result.rows);
}
async function buscar(req,res) {
 const ticketId=id(req.params.id);
 const result=await pool.query('SELECT * FROM tickets WHERE id=$1',[ticketId]);
 if (!result.rowCount || !podeConsultar(req.user,result.rows[0])) throw fail(404,'Chamado nao encontrado.');
 ok(res,(await pool.query('SELECT '+fields+from+'WHERE t.id=$1',[ticketId])).rows[0]);
}
async function criar(req,res) {
 // Dados de solicitante, responsável e prazo são definidos pelo backend autenticado.
 const body=req.body || {};
 const titulo=text(body.titulo,'Titulo',200), descricao=text(body.descricao,'Descricao',10000), laboratorio=text(body.laboratorio,'Laboratorio',150);
 const categoria=body.categoria == null ? null : text(body.categoria,'Categoria',100);
 const prioridade=body.prioridade ?? 'MEDIA';
 if (!['ALTA','MEDIA','BAIXA'].includes(prioridade)) throw fail(400,'Prioridade invalida.');
 const nivelSla = body.nivelSla ?? {ALTA:'P2',MEDIA:'P3',BAIXA:'P4'}[prioridade];
 const sla = {P1:{prioridade:'ALTA',horas:4},P2:{prioridade:'ALTA',horas:8},P3:{prioridade:'MEDIA',horas:24},P4:{prioridade:'BAIXA',horas:72}};
 if (!Object.hasOwn(sla,nivelSla) || sla[nivelSla].prioridade !== prioridade) throw fail(400,'SLA incompatível com a prioridade.');
 const result=await pool.query("INSERT INTO tickets(titulo,descricao,laboratorio,categoria,prioridade,solicitante_id,nivel_sla,prazo_sla) VALUES($1,$2,$3,$4,$5,$6,$7,NOW()+($8 * INTERVAL '1 hour')) RETURNING id",[titulo,descricao,laboratorio,categoria,prioridade,req.user.id,nivelSla,sla[nivelSla].horas]);
 ok(res,(await pool.query('SELECT '+fields+from+'WHERE t.id=$1',[result.rows[0].id])).rows[0],201);
}
async function atribuir(req,res) {
 const ticketId=id(req.params.id);
 const tecnicoId=req.user.perfil==='TECNICO' ? req.user.id : id(req.body?.tecnicoId);
 if (req.user.perfil==='TECNICO' && req.body?.tecnicoId !== undefined && req.body.tecnicoId !== req.user.id) throw fail(403,'Tecnico so pode assumir para si.');
 // O bloqueio transacional impede que dois técnicos assumam o mesmo chamado.
 const client=await pool.connect();
 try {
  await client.query('BEGIN');
  const result=await client.query('SELECT * FROM tickets WHERE id=$1 FOR UPDATE',[ticketId]);
  if (!result.rowCount) throw fail(404,'Chamado nao encontrado.');
  const ticket=result.rows[0];
  if (ticket.status!=='ABERTO' || ticket.tecnico_id!==null) throw fail(409,'Chamado nao disponivel para atribuicao.');
  const tecnico=await client.query("SELECT id FROM users WHERE id=$1 AND perfil='TECNICO' AND ativo=TRUE FOR SHARE",[tecnicoId]);
  if (!tecnico.rowCount) throw fail(400,'Tecnico invalido ou desativado.');
  await client.query("UPDATE tickets SET tecnico_id=$1,status='EM_ATENDIMENTO',data_atualizacao=NOW() WHERE id=$2",[tecnicoId,ticketId]);
  await client.query("INSERT INTO ticket_history(chamado_id,usuario_id,status_anterior,status_novo,observacao) VALUES($1,$2,'ABERTO','EM_ATENDIMENTO',$3)",[ticketId,req.user.id,'Atribuido ao tecnico '+tecnicoId]);
  await client.query('COMMIT');
 } catch(e) {await client.query('ROLLBACK');throw e;} finally {client.release();}
 ok(res,(await pool.query('SELECT '+fields+from+'WHERE t.id=$1',[ticketId])).rows[0]);
}
module.exports={listar,buscar,criar,atribuir};
