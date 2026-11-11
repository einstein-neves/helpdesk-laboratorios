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
 dom.window.HelpDeskAuth={ready:Promise.resolve({auth:{
  getSession:async()=>({data:{session:null}}),
  signInWithPassword:async()=>({error:{message:'informação privada'}}),
  signUp:async args=>{signup=args;return {data:{session:null},error:null};}
 }})};
 script(dom,'login.js');await settle();
 const form=doc.querySelector('#formLogin');
 form.dispatchEvent(new dom.window.Event('submit',{cancelable:true}));await settle();
 assert.ok(doc.querySelector('#mensagem').textContent.includes('Não foi possível entrar'));
 assert.equal(doc.querySelector('#mensagem').textContent.includes('informação privada'),false);
 doc.querySelector('#alternar').click();doc.querySelector('#nome').value='Nova pessoa';
 doc.querySelector('#email').value='example@example.com';doc.querySelector('#senha').value='not-a-real-password';
 form.dispatchEvent(new dom.window.Event('submit',{cancelable:true}));await settle();
 assert.equal(signup.options.data.nome,'Nova pessoa');
 assert.equal(signup.options.data.perfil,undefined);
 assert.ok(doc.querySelector('#mensagem').textContent.includes('Confirme o endereço'));
 dom.window.close();
});
