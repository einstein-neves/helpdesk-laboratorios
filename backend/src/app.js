const express = require('express');
const path = require('path');
const cors = require('cors');
require('dotenv').config({path:path.resolve(__dirname,'../.env'),quiet:true});
const demo = require('./demo/config');
demo.validateConfiguration();
const app = express();
app.disable('x-powered-by');
app.use((req,res,next) => {
 const supabaseUrl = !demo.isDemoMode() && process.env.SUPABASE_URL
  ? require('./config/supabase').getPublicSupabaseConfig().url
  : '';
 res.set({
  'Content-Security-Policy': "default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data:; connect-src 'self' " + supabaseUrl + "; object-src 'none'; base-uri 'self'; frame-ancestors 'none'; form-action 'self'",
  'X-Content-Type-Options': 'nosniff',
  'Referrer-Policy': 'no-referrer'
 });
 next();
});
const origins = (process.env.CORS_ORIGINS || '').split(',').map(s=>s.trim()).filter(Boolean);
app.use(cors({origin: origins.length ? origins : false}));
app.use(express.json({limit:'32kb'}));
// Allowlist explícita: nunca serialize process.env ou a configuração administrativa.
app.get('/api/config', (req,res) => {
 res.set('Cache-Control','no-store');
 const config = demo.isDemoMode()
  ? demo.getPublicConfig()
  : require('./config/supabase').getPublicSupabaseConfig();
 require('./utils/http').ok(res,config);
});
app.get('/api/health', (req,res) => {
 require('./utils/http').ok(res,{status:'ok'});
});
app.use('/api', require('./routes'));
app.get('/', (req,res) => res.redirect('/login.html'));
app.use(express.static(path.resolve(__dirname,'../../publico')));
app.use((req,res) => res.status(404).json({success:false,data:null,message:'Rota nao encontrada.'}));
app.use((error,req,res,next) => {
 let status = error.statusCode || error.status || 500;
 let message = status < 500 ? error.message : 'Erro interno do servidor.';
 if (error.code === '23505') {status=409;message='Registro ja cadastrado.';}
 if (error.code === '23503') {status=409;message='Registro relacionado invalido.';}
 if (error.code === '23514' || error.code === '22P02') {status=400;message='Dados invalidos.';}
 if (status >= 500) console.error('Falha na API:', error.code || error.name);
 res.status(status).json({success:false,data:null,message});
});
module.exports = app;
