(function () {
 const api = (path, options) => HelpDeskAuth.request(path, options);
 const service = {
  CONFIGURACAO: Object.freeze({usarApi:true,baseApi:'/api'}), tecnicoAtual:null,
  async iniciar(){service.tecnicoAtual=await HelpDeskAuth.requireUser();return service.tecnicoAtual;},
  async listarChamados(){
   const all=[];
   for(let offset=0;;offset+=50){const batch=await api('/tickets?offset='+offset);all.push(...batch);if(batch.length<50)return all;}
  },
  buscarChamado:id=>api('/tickets/'+id),
  criarChamado:body=>api('/tickets',{method:'POST',body:JSON.stringify(body)}),
  atribuirChamado:(id,tecnicoId)=>api('/tickets/'+id+'/assign',{method:'PATCH',body:JSON.stringify({tecnicoId})}),
  atualizarStatus:(id,status,observacao)=>api('/tickets/'+id+'/status',{method:'PATCH',body:JSON.stringify({status,observacao})}),
  consultarHistorico:id=>api('/tickets/'+id+'/history'),
  listarTecnicos:()=>api('/users/technicians')
 };
 window.ChamadosService=service;
})();
