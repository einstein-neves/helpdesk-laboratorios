(async function(){try{
 const user=await HelpDeskAuth.requireUser();HelpDeskAuth.navigation(user);
 document.querySelector('#saudacao').textContent='Olá, '+user.nome;
 document.querySelector('#acoes').hidden=false;document.querySelector('#administracao').hidden=user.perfil!=='ADMIN';
}catch(error){document.querySelector('#mensagem').textContent=error.message;}})();
