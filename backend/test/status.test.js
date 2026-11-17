const {test,after}=require('node:test');
const assert=require('node:assert/strict');
const pool=require('../src/config/database');
const service=require('../src/services/statusService');
let calls=[];
pool.connect=async()=>({
 query:async(sql,params)=>{
  calls.push({sql,params});
  if(sql.includes('FOR UPDATE')) return {rowCount:1,rows:[{id:9,status:'EM_ATENDIMENTO',tecnico_id:2,solicitante_id:1}]};
  if(sql.includes('UPDATE tickets')) return {rows:[{id:9,status:'RESOLVIDO'}]};
  return {rows:[]};
 },release:()=>{calls.push({sql:'RELEASE'});}
});
after(()=>pool.end());
test('historico consulta os campos necessarios para autorizar o solicitante', async()=>{
 const original=pool.query;
 pool.query=async sql=>{
  if(sql.includes('FROM tickets')) {
   assert.ok(sql.includes('solicitante_id'));
   assert.ok(sql.includes('tecnico_id'));
   return {rowCount:1,rows:[{id:9,solicitante_id:1,tecnico_id:2,status:'RESOLVIDO'}]};
  }
  return {rows:[{id:1}]};
 };
 try {assert.deepEqual(await service.consultarHistorico(9,{id:1,perfil:'SOLICITANTE'}),[{id:1}]);}
 finally {pool.query=original;}
});
test('alteracao alheia faz rollback sem gravar status ou historico',async()=>{
 calls=[];
 await assert.rejects(service.alterarStatus(9,{id:3,perfil:'TECNICO'},'RESOLVIDO'),{statusCode:403});
 assert.ok(calls.some(c=>c.sql==='ROLLBACK'));
 assert.equal(calls.some(c=>c.sql.includes('UPDATE tickets')),false);
 assert.equal(calls.at(-1).sql,'RELEASE');
});
test('alteracao autorizada grava status e historico antes do commit',async()=>{
 calls=[];
 const solucao = 'Cabo de rede substituído e conexão restabelecida.';

 await service.alterarStatus(
  9,
  {id:2,perfil:'TECNICO'},
  'RESOLVIDO',
  solucao
 );

 const history=calls.findIndex(c=>c.sql.includes('INSERT INTO ticket_history'));
 assert.ok(history>0);
 assert.equal(calls[history].params[1],2);
 assert.equal(calls[history].params[4],solucao);
 assert.ok(calls.findIndex(c=>c.sql==='COMMIT')>history);
});