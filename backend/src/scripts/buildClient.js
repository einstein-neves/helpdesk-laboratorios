const path = require('path');
require('esbuild').buildSync({
    entryPoints: [path.resolve(__dirname, '../../client/auth.js')],
    outfile: path.resolve(__dirname, '../../../publico/js/auth.bundle.js'),
    bundle: true, minify: true, format: 'iife', platform: 'browser', target: ['es2022'],
    legalComments: 'eof'
});
console.log('Cliente de autenticação compilado.');
