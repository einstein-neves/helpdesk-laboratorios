const {test}=require('node:test');
const assert=require('node:assert/strict');
const {podeConsultar,podeAlterarStatus}=require('../src/config/permissions');
const ticket={solicitante_id:1,tecnico_id:2,status:'EM_ATENDIMENTO'};
test('solicitante consulta somente chamados pr?prios',()=>{
 assert.equal(podeConsultar({id:1,perfil:'SOLICITANTE'},ticket),true);
 assert.equal(podeConsultar({id:3,perfil:'SOLICITANTE'},ticket),false);
 assert.equal(podeAlterarStatus({id:1,perfil:'SOLICITANTE'},ticket),false);
});
test('t?cnico altera somente chamado atribu?do a si',()=>{
 assert.equal(podeAlterarStatus({id:2,perfil:'TECNICO'},ticket),true);
 assert.equal(podeAlterarStatus({id:3,perfil:'TECNICO'},ticket),false);
 assert.equal(podeConsultar({id:3,perfil:'TECNICO'},ticket),false);
 assert.equal(podeConsultar({id:3,perfil:'TECNICO'},{...ticket,status:'ABERTO',tecnico_id:null}),true);
});
test('atendente consulta mas n?o altera status; admin altera',()=>{
 assert.equal(podeConsultar({id:3,perfil:'ATENDENTE'},ticket),true);
 assert.equal(podeAlterarStatus({id:3,perfil:'ATENDENTE'},ticket),false);
 assert.equal(podeAlterarStatus({id:3,perfil:'ADMIN'},ticket),true);
});
