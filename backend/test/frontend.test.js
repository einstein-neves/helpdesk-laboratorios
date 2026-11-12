const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { JSDOM } = require('jsdom');
const publicDir = path.resolve(__dirname, '../../publico');
function page(file) {
 return new JSDOM(fs.readFileSync(path.join(publicDir, file), 'utf8'), {
  url: 'http://localhost:3000/' + file, runScripts: 'outside-only'
 });
}
function script(dom, file) { dom.window.eval(fs.readFileSync(path.join(publicDir, 'js', file), 'utf8')); }
async function settle() { for (let i=0;i<8;i++) await new Promise(resolve=>setImmediate(resolve)); }

test('home mostra administração somente para admin', async () => {
 for (const perfil of ['SOLICITANTE','ADMIN']) {
  const dom=page('index.html');
  dom.window.HelpDeskAuth={requireUser:async()=>({nome:'Teste',perfil}),navigation:()=>{}};
  script(dom,'app.js'); await settle();
  assert.equal(dom.window.document.querySelector('#administracao').hidden,perfil!=='ADMIN');
  assert.equal(dom.window.document.querySelector('#acoes').hidden,false);
  dom.window.close();
 }
});

test('abertura usa a API e não envia identidade ou prazo controlado pelo navegador', async () => {
 const dom=page('abertura.html'), doc=dom.window.document;
 let created;
 dom.window.HelpDeskAuth={navigation:()=>{}};
 dom.window.ChamadosService={
  iniciar:async()=>({id:1,nome:'Pessoa autenticada'}),listarChamados:async()=>[],
  criarChamado:async body=>{created=body;return {id:8,prazoSla:'2026-11-12T12:00:00Z'};}
 };
 script(dom,'abertura.js');await settle();
 assert.equal(doc.querySelector('#solicitante').readOnly,true);
 doc.querySelector('#titulo').value='Projetor com falha';
 doc.querySelector('#descricao').value='Não apresenta imagem';
 doc.querySelector('#laboratorio').selectedIndex=1;doc.querySelector('#categoria').selectedIndex=1;
 doc.querySelector('#prioridade').value='P1';
 doc.querySelector('#formChamado').dispatchEvent(new dom.window.Event('submit',{cancelable:true}));await settle();
 assert.equal(created.nivelSla,'P1');assert.equal(created.prioridade,'ALTA');
 assert.equal(created.solicitanteId,undefined);assert.equal(created.prazoSla,undefined);
 assert.ok(doc.querySelector('#mensagem').textContent.includes('#8'));
 dom.window.close();
});

test('solicitante vê seus chamados e histórico sem controles de técnico', async () => {
 const dom=page('atendimentos.html'), doc=dom.window.document;
 dom.window.HTMLDialogElement.prototype.showModal=function(){this.open=true;};
 dom.window.HTMLDialogElement.prototype.close=function(){this.open=false;};
 const user={id:1,nome:'Solicitante',perfil:'SOLICITANTE'};
 const ticket={id:8,titulo:'Chamado real',descricao:'Descrição',categoria:'Rede',laboratorio:'Lab',prioridade:'MEDIA',status:'ABERTO',tecnicoId:null,solicitanteId:1,dataAbertura:'2026-11-11T12:00:00Z'};
 dom.window.HelpDeskAuth={navigation:()=>{}};
 dom.window.ChamadosService={tecnicoAtual:user,iniciar:async()=>user,listarChamados:async()=>[ticket],buscarChamado:async()=>ticket,consultarHistorico:async()=>[]};
 script(dom,'atendimentos.js');await settle();
 assert.equal(doc.querySelector('[data-fila=disponiveis]').hidden,true);
 assert.ok(doc.querySelector('#listaChamados').textContent.includes('Chamado real'));
 doc.querySelector('[data-detalhes-id]').click();await settle();
 assert.equal(doc.querySelector('#modalDetalhes').open,true);
 assert.equal(doc.querySelector('#botaoAssumir').hidden,true);
 assert.equal(doc.querySelector('#controlesAtendimento').hidden,true);
 assert.equal(doc.querySelector('#controlesAtribuicao').hidden,true);
 assert.ok(doc.querySelector('#historicoChamado').textContent.includes('Nenhuma alteração'));
 dom.window.close();
});

test('login apresenta falha genérica e cadastro aguarda confirmação de e-mail', async () => {
 const dom=page('login.html'), doc=dom.window.document;
 let signup;
 dom.window.HelpDeskAuth={ready:Promise.resolve({auth:{getSession:async()=>({data:{session:null}})}}),
  authenticate:async(path,payload)=>{
   if(path==='/login') throw new Error('Não foi possível entrar. Confira e-mail, senha e confirmação do e-mail.');
   signup={path,payload};return {session:null};
  }};
 script(dom,'login.js');await settle();
 const form=doc.querySelector('#formLogin');
 form.dispatchEvent(new dom.window.Event('submit',{cancelable:true}));await settle();
 assert.ok(doc.querySelector('#mensagem').textContent.includes('Não foi possível entrar'));
 assert.equal(doc.querySelector('#mensagem').textContent.includes('informação privada'),false);
 doc.querySelector('#alternar').click();doc.querySelector('#nome').value='Nova pessoa';
 doc.querySelector('#email').value='example@example.com';doc.querySelector('#senha').value='not-a-real-password';
 form.dispatchEvent(new dom.window.Event('submit',{cancelable:true}));await settle();
 assert.equal(signup.path,'/usuarios');
 assert.equal(signup.payload.nome,'Nova pessoa');
 assert.equal(signup.payload.perfil,undefined);
 assert.ok(doc.querySelector('#mensagem').textContent.includes('Confirme o endereço'));
 dom.window.close();
});

test('login envia credenciais à rota REST e persiste os tokens antes de carregar o perfil', async () => {
 const dom=page('login.html'), doc=dom.window.document;
 let sent, session;
 dom.window.HelpDeskAuth={
  ready:Promise.resolve({auth:{
   getSession:async()=>({data:{session:null}}),
   setSession:async value=>{session=value;return {error:null};}
  }}),
  authenticate:async(path,payload)=>{
   sent={path,payload};
   return {session:{access_token:'access-token',refresh_token:'refresh-token'}};
  },
  requireUser:async()=>{throw new Error('Teste interrompe antes do redirecionamento.');}
 };
 script(dom,'login.js');await settle();
 doc.querySelector('#email').value='pessoa@example.com';
 doc.querySelector('#senha').value='senha-segura-123';
 doc.querySelector('#formLogin').dispatchEvent(new dom.window.Event('submit',{cancelable:true}));await settle();
 assert.equal(sent.path,'/login');
 assert.equal(sent.payload.email,'pessoa@example.com');
 assert.equal(sent.payload.senha,'senha-segura-123');
 assert.equal(session.access_token,'access-token');
 assert.equal(session.refresh_token,'refresh-token');
 dom.window.close();
});

test('login identifica o modo demo e mostra o e-mail local sem oferecer cadastro', async () => {
 const dom=page('login.html'), doc=dom.window.document;
 dom.window.HelpDeskAuth={
  ready:Promise.resolve({mode:'demo',demoEmail:'demo@localhost.test',auth:{getSession:async()=>({data:{session:null}})}}),
  requireUser:async()=>({id:1,nome:'Desenvolvedor',perfil:'ADMIN'})
 };
 script(dom,'login.js');await settle();
 assert.equal(doc.querySelector('#titulo').textContent,'Acesso do desenvolvedor');
 assert.equal(doc.querySelector('#email').value,'demo@localhost.test');
 assert.equal(doc.querySelector('#email').readOnly,true);
 assert.equal(doc.querySelector('#alternar').hidden,true);
 assert.match(doc.querySelector('#mensagem').textContent,/senha está no terminal/);
 dom.window.close();
});
