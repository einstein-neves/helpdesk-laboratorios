const app = require('./app');
const pool = require('./config/database');
const server = app.listen(process.env.PORT || 3000, () => console.log('API Help Desk iniciada.'));
server.on('error', error => {
 console.error('Servidor HTTP não iniciado:', error.code || error.name);
 process.exitCode = 1;
 pool.end();
});
async function shutdown() {
 server.close(async () => { await pool.end(); process.exit(0); });
 setTimeout(() => process.exit(1),10000).unref();
}
process.once('SIGTERM',shutdown);
process.once('SIGINT',shutdown);
