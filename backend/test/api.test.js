const {test,after}=require('node:test');
const assert=require('node:assert/strict');
process.env.DEMO_MODE='false';
process.env.NODE_ENV='test';
process.env.SUPABASE_URL='https://example.supabase.co';
process.env.SUPABASE_PUBLISHABLE_KEY='sb_publishable_test';
const pool=require('../src/config/database');
const realFetch=global.fetch;
let profile={id:1,perfil:'SOLICITANTE',ativo:true};
const queries=[];
const authRequests=[];
pool.query=async(sql,params)=>{
 queries.push({sql,params});
 if(sql.includes('WHERE auth_user_id')) return {rows:profile?[profile]:[],rowCount:profile?1:0};
 if(sql.startsWith('SELECT * FROM tickets')) return {rows:[{id:9,solicitante_id:2,tecnico_id:3,status:'EM_ATENDIMENTO'}],rowCount:1};
 if(sql.startsWith('INSERT INTO users')) return {rows:[{id:1,perfil:'SOLICITANTE',ativo:true}],rowCount:1};
 return {rows:[],rowCount:0};
};
global.fetch=async(url,options)=>{
 if(String(url).startsWith('https://example.supabase.co')) {
  if(String(url).endsWith('/auth/v1/signup')) {
   authRequests.push({url:String(url),body:JSON.parse(options.body)});
   return new Response(JSON.stringify({user:{id:'signup-user',email:'new@example.com'},session:null}));
  }
  if(String(url).includes('/auth/v1/token?grant_type=password')) {
   authRequests.push({url:String(url),body:JSON.parse(options.body)});
   return new Response(JSON.stringify({
    user:{id:'login-user',email:'test@example.com'},
    session:{access_token:'access-token',refresh_token:'refresh-token'}
   }));
  }
  if(options.headers.Authorization==='Bearer invalid') return new Response('{}',{status:401});
  return new Response(JSON.stringify({id:'00000000-0000-4000-8000-000000000001',email:'test@example.com',email_confirmed_at:'2026-01-01'}));
 }
 return realFetch(url,options);
};
const server=require('../src/app').listen(0,'127.0.0.1');
async function request(path,token='valid',options={}) {
 if(!server.listening) await new Promise(r=>server.once('listening',r));
 return fetch('http://127.0.0.1:'+server.address().port+'/api'+path,{
 ...options,headers:{...(token?{Authorization:'Bearer '+token}:{}),'Content-Type':'application/json'}});
}
after(async()=>{global.fetch=realFetch;await new Promise(r=>server.close(r));await pool.end();});
test('config pública não expõe secret key e respostas bloqueiam scripts externos',async()=>{
 const response=await request('/config',null);
 assert.equal(response.status,200);
 assert.deepEqual(Object.keys((await response.json()).data).sort(),['publishableKey','url']);
 assert.ok(response.headers.get('content-security-policy').includes("script-src 'self'"));
});
test('cadastro público encaminha os dados ao Supabase e responde JSON 201',async()=>{
 const response=await request('/usuarios',null,{method:'POST',body:JSON.stringify({nome:'Nova Pessoa',email:'NEW@example.com',senha:'senha-segura-123'})});
 assert.equal(response.status,201);
 const body=await response.json();
 assert.equal(body.success,true);
 assert.equal(body.data.session,null);
 assert.deepEqual(authRequests.at(-1).body,{email:'new@example.com',password:'senha-segura-123',data:{nome:'Nova Pessoa'}});
});
test('login público retorna JSON 200 com a sessão do Supabase',async()=>{
 const response=await request('/login',null,{method:'POST',body:JSON.stringify({email:'TEST@example.com',senha:'senha-segura-123'})});
 assert.equal(response.status,200);
 const body=await response.json();
 assert.equal(body.data.session.access_token,'access-token');
 assert.equal(body.data.session.refresh_token,'refresh-token');
 assert.equal(authRequests.at(-1).url,'https://example.supabase.co/auth/v1/token?grant_type=password');
});
test('rota desconhecida da API continua respondendo JSON em vez de HTML',async()=>{
 const response=await request('/rota-inexistente');
 assert.match(response.headers.get('content-type'),/application\/json/);
 assert.equal(response.status,404);
});
test('API rejeita aus?ncia de token e token inv?lido',async()=>{
 assert.equal((await request('/tickets',null)).status,401);
 assert.equal((await request('/tickets','invalid')).status,401);
});
test('API bloqueia usu?rio inativo',async()=>{
 profile.ativo=false;assert.equal((await request('/tickets')).status,403);profile.ativo=true;
});
test('solicitante n?o consulta chamado alheio ou lista usu?rios',async()=>{
 assert.equal((await request('/tickets/9')).status,404);
 assert.equal((await request('/users')).status,403);
 assert.equal((await request('/tickets/9/status','valid',{method:'PATCH',body:JSON.stringify({status:'RESOLVIDO'})})).status,403);
});
test('listagem de solicitante filtra pelo usu?rio autenticado',async()=>{
 assert.equal((await request('/tickets')).status,200);
 const q=queries.findLast(q=>q.sql.includes('LIMIT 50'));
 assert.ok(q.sql.includes('WHERE t.solicitante_id=$1'));assert.equal(q.params[0],1);
});
test('cadastro ignora perfil e identidade fornecidos pelo cliente',async()=>{
 profile=null;
 const response=await request('/users/me','valid',{method:'POST',body:JSON.stringify({nome:'Teste',perfil:'ADMIN',auth_user_id:'forged'})});
 assert.equal(response.status,201);assert.equal((await response.json()).data.perfil,'SOLICITANTE');
 const q=queries.findLast(q=>q.sql.startsWith('INSERT INTO users'));
 assert.equal(q.params[0],'00000000-0000-4000-8000-000000000001');assert.equal(q.params.length,3);
 profile={id:1,perfil:'SOLICITANTE',ativo:true};
});
