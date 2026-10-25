// Проверка без сети: node worker/test.mjs
import assert from 'node:assert/strict';
import worker from './worker.js';

const env = { BOT_TOKEN: 'T', CHAT_ID: '1', ALLOWED_ORIGIN: 'https://site.example, https://second.example' };
let sent = null;
globalThis.fetch = async (url, opts) => { sent = { url, body: JSON.parse(opts.body) }; return new Response('{}', { status: 200 }); };
const post = (body, origin = 'https://site.example') =>
  worker.fetch(new Request('https://w.example', { method: 'POST', headers: { Origin: origin, 'Content-Type': 'application/json' }, body: JSON.stringify(body) }), env);

let r = await post({ contact: '+7 900 123-45-67', name: '<Аня>', business: 'Пекарня', kind: 'Магазин', message: 'хочу сайт' });
assert.equal(r.status, 200);
assert.equal(sent.url, 'https://api.telegram.org/botT/sendMessage');
assert.match(sent.body.text, /Контакт: \+7 900 123-45-67/);
assert.match(sent.body.text, /&lt;Аня&gt;/);
assert.match(sent.body.text, /Пекарня \(Магазин\)/);

sent = null;
assert.equal((await post({ contact: '@anna_bakery' })).status, 200);
assert.ok(sent);

sent = null;
assert.equal((await post({ contact: '123' })).status, 400);
assert.equal((await post({ contact: '+79001234567', website: 'spam' })).status, 200);
assert.equal(sent, null, 'honeypot must not send');
assert.equal((await post({ contact: '+79001234567' }, 'https://evil.example')).status, 403);
r = await post({ contact: '+79001234567' }, 'https://second.example');
assert.equal(r.status, 200);
assert.equal(r.headers.get('Access-Control-Allow-Origin'), 'https://second.example');
assert.equal((await worker.fetch(new Request('https://w.example', { method: 'OPTIONS' }), env)).status, 204);

globalThis.fetch = async () => new Response('{}', { status: 401 });
assert.equal((await post({ contact: '+79001234567' })).status, 502);
console.log('worker ok');
