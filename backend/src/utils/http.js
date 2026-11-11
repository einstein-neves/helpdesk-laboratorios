function fail(statusCode, message) {
 return Object.assign(new Error(message), { statusCode });
}
function ok(res, data, status = 200) {
 return res.status(status).json({ success: true, data, message: 'Operacao realizada com sucesso.' });
}
function id(value) {
 if (!/^[1-9]\d*$/.test(String(value)) || !Number.isSafeInteger(Number(value)) || Number(value) > 2147483647)
  throw fail(400, 'ID invalido.');
 return Number(value);
}
function text(value, name, max) {
 if (typeof value !== 'string' || !value.trim() || value.trim().length > max)
  throw fail(400, name + ' invalido.');
 return value.trim();
}
module.exports = { fail, ok, id, text };
