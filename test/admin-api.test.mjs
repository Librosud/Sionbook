// Pruebas del panel web (node --test). GitHub se simula: no se toca el repositorio real.
import test from 'node:test';
import assert from 'node:assert/strict';
import { createHandler } from '../lib/admin-api.js';
import { hashPassword, verifyPassword, createSession, readSession } from '../lib/auth.js';
import { validate } from '../lib/validate.js';

const PASSWORD = 'una-clave-larga-de-prueba-123';
const SECRET = 'secreto-de-sesion-de-prueba-0123456789abcdef';
const hash = await hashPassword(PASSWORD);
const env = { ADMIN_EMAIL: 'Yo@Example.com', ADMIN_PASSWORD_HASH: hash, SESSION_SECRET: SECRET, GITHUB_TOKEN: 'tok' };

const books = [{ slug: 'uno', title: 'Uno', author: 'A', languages: ['es', 'pt'], cover: '/covers/uno.jpg' }];
const store = { 'data/books.json': JSON.stringify(books, null, 2) + '\n', 'data/proximas.json': '[]\n', 'site.json': JSON.stringify({ es: { about: ['x'] }, pt: { about: ['y'] } }, null, 2) + '\n' };

function fakeGithub() {
  const calls = { commits: [], blobs: [] };
  return {
    calls,
    readFile: async (p) => store[p],
    createBlob: async (b64) => { calls.blobs.push(b64); return 'a'.repeat(40); },
    commit: async (msg, files) => { calls.commits.push({ msg, files }); return 'c'.repeat(40); }
  };
}

function call(handler, { method = 'GET', action, body, headers = {} }) {
  return new Promise((resolve) => {
    const res = { headers: {}, statusCode: 200, setHeader(k, v) { this.headers[k.toLowerCase()] = v; }, end(s) { resolve({ status: this.statusCode, json: JSON.parse(s), headers: this.headers }); } };
    const req = { method, url: `/api/admin?action=${action}`, headers: { host: 'www.sionbook.com', ...headers }, body, socket: { remoteAddress: '1.2.3.4' } };
    handler(req, res);
  });
}
const mk = (e = env, gh = fakeGithub()) => ({ gh, h: createHandler(e, { github: gh, sleep: async () => {} }) });
const post = { 'x-admin': '1', 'content-type': 'application/json' };
async function login(h, headers = {}) {
  const r = await call(h, { method: 'POST', action: 'login', body: { email: 'yo@example.com', password: PASSWORD }, headers: { ...post, ...headers } });
  return r.headers['set-cookie'].split(';')[0];
}
const savePayload = (etag, extra = {}) => ({ books, upcoming: [], site: JSON.parse(store['site.json']), etag, ...extra });

test('sin configurar: session informa y el resto se bloquea', async () => {
  const { h } = mk({});
  const s = await call(h, { action: 'session' });
  assert.equal(s.json.configured, false);
  assert.equal((await call(h, { action: 'data' })).status, 503);
});

test('contraseña: acepta la buena y rechaza la mala', async () => {
  assert.equal(await verifyPassword(PASSWORD, hash), true);
  assert.equal(await verifyPassword('otra', hash), false);
  assert.equal(await verifyPassword(PASSWORD, 'basura'), false);
});

test('login: mal correo o mala contraseña = 401; bien = cookie segura', async () => {
  const { h } = mk();
  assert.equal((await call(h, { method: 'POST', action: 'login', body: { email: 'yo@example.com', password: 'mal' }, headers: post })).status, 401);
  assert.equal((await call(h, { method: 'POST', action: 'login', body: { email: 'otro@x.com', password: PASSWORD }, headers: post })).status, 401);
  const ok = await call(h, { method: 'POST', action: 'login', body: { email: ' YO@example.com ', password: PASSWORD }, headers: post });
  assert.equal(ok.status, 200);
  const c = ok.headers['set-cookie'];
  assert.match(c, /HttpOnly/); assert.match(c, /Secure/); assert.match(c, /SameSite=Strict/);
});

test('login: tras 5 fallos bloquea esa IP', async () => {
  const { h } = mk();
  const bad = () => call(h, { method: 'POST', action: 'login', body: { email: 'yo@example.com', password: 'mal' }, headers: { ...post, 'x-forwarded-for': '9.9.9.9' } });
  for (let i = 0; i < 5; i++) assert.equal((await bad()).status, 401);
  assert.equal((await bad()).status, 429);
  const good = await call(h, { method: 'POST', action: 'login', body: { email: 'yo@example.com', password: PASSWORD }, headers: { ...post, 'x-forwarded-for': '9.9.9.9' } });
  assert.equal(good.status, 429); // ni siquiera la buena entra mientras dure el bloqueo
});

test('sin sesión no se puede leer ni escribir', async () => {
  const { h } = mk();
  assert.equal((await call(h, { action: 'data' })).status, 401);
  assert.equal((await call(h, { method: 'POST', action: 'save', body: {}, headers: post })).status, 401);
});

test('escrituras: exigen X-Admin y mismo origen', async () => {
  const { h } = mk();
  const cookie = await login(h);
  assert.equal((await call(h, { method: 'POST', action: 'save', body: {}, headers: { cookie } })).status, 403);
  assert.equal((await call(h, { method: 'POST', action: 'save', body: {}, headers: { ...post, cookie, origin: 'https://evil.com' } })).status, 403);
});

test('sesión: caduca y no se puede falsificar', () => {
  const t = createSession('yo@example.com', SECRET, 1000);
  assert.ok(readSession(`sb_admin=${t}`, SECRET, 2000));
  assert.equal(readSession(`sb_admin=${t}`, SECRET, 1000 + 9 * 3600 * 1000), null);
  assert.equal(readSession(`sb_admin=${t}x`, SECRET, 2000), null);
  assert.equal(readSession(`sb_admin=${t}`, 'otro-secreto', 2000), null);
  const forged = Buffer.from(JSON.stringify({ sub: 'yo', exp: 9e15 })).toString('base64url') + '.' + t.split('.')[1];
  assert.equal(readSession(`sb_admin=${forged}`, SECRET, 2000), null);
});

test('data: devuelve los datos y un etag', async () => {
  const { h } = mk();
  const cookie = await login(h);
  const r = await call(h, { action: 'data', headers: { cookie } });
  assert.equal(r.status, 200);
  assert.equal(r.json.books[0].slug, 'uno');
  assert.ok(r.json.etag);
});

test('save: etag viejo = 409; datos inválidos = 400; sin cambios = nada que publicar', async () => {
  const { h, gh } = mk();
  const cookie = await login(h);
  const { json: d } = await call(h, { action: 'data', headers: { cookie } });
  assert.equal((await call(h, { method: 'POST', action: 'save', body: savePayload('viejo'), headers: { ...post, cookie } })).status, 409);
  const bad = savePayload(d.etag); bad.books = [{ slug: 'Mal Slug', title: 'x', author: 'y', languages: ['es'] }];
  assert.equal((await call(h, { method: 'POST', action: 'save', body: bad, headers: { ...post, cookie } })).status, 400);
  const same = await call(h, { method: 'POST', action: 'save', body: savePayload(d.etag), headers: { ...post, cookie } });
  assert.equal(same.json.unchanged, true);
  assert.equal(gh.calls.commits.length, 0);
});

test('save: un cambio genera UN commit solo con los archivos modificados', async () => {
  const { h, gh } = mk();
  const cookie = await login(h);
  const { json: d } = await call(h, { action: 'data', headers: { cookie } });
  const payload = savePayload(d.etag, { message: 'Cambio de prueba' }); payload.books = [{ ...books[0], title: 'Uno editado', _interno: 1 }];
  const r = await call(h, { method: 'POST', action: 'save', body: payload, headers: { ...post, cookie } });
  assert.equal(r.status, 200);
  assert.equal(gh.calls.commits.length, 1);
  const files = gh.calls.commits[0].files;
  assert.deepEqual(files.map((f) => f.path), ['data/books.json']);
  assert.ok(files[0].content.includes('Uno editado'));
  assert.ok(!files[0].content.includes('_interno'));
  assert.match(gh.calls.commits[0].msg, /Cambio de prueba/);
});

test('upload + save: la portada nueva entra en el mismo commit', async () => {
  const { h, gh } = mk();
  const cookie = await login(h);
  const png = Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), Buffer.alloc(40)]);
  const up = await call(h, { method: 'POST', action: 'upload', body: { name: 'Mi Libro!.png', dataBase64: png.toString('base64') }, headers: { ...post, cookie } });
  assert.equal(up.status, 200);
  assert.match(up.json.path, /^\/covers\/mi-libro-[0-9a-f]{6}\.png$/);
  const { json: d } = await call(h, { action: 'data', headers: { cookie } });
  const payload = savePayload(d.etag, { covers: [{ path: up.json.path, sha: up.json.sha }] });
  payload.books = [{ ...books[0], cover: up.json.path }];
  const r = await call(h, { method: 'POST', action: 'save', body: payload, headers: { ...post, cookie } });
  assert.equal(r.status, 200);
  assert.ok(gh.calls.commits[0].files.some((f) => f.path === 'assets' + up.json.path && f.sha));
});

test('upload: rechaza lo que no es imagen y lo demasiado grande', async () => {
  const { h } = mk();
  const cookie = await login(h);
  const txt = await call(h, { method: 'POST', action: 'upload', body: { name: 'a', dataBase64: Buffer.from('<?php echo 1; ?>'.repeat(5)).toString('base64') }, headers: { ...post, cookie } });
  assert.equal(txt.status, 400);
  const big = await call(h, { method: 'POST', action: 'upload', body: { name: 'a', dataBase64: Buffer.alloc(3_600_000, 1).toString('base64') }, headers: { ...post, cookie } });
  assert.equal(big.status, 413);
});

test('save: rechaza rutas de portada peligrosas', async () => {
  const { h } = mk();
  const cookie = await login(h);
  const { json: d } = await call(h, { action: 'data', headers: { cookie } });
  const evil = savePayload(d.etag, { covers: [{ path: '/covers/../../api/admin.js', sha: 'a'.repeat(40) }] });
  assert.equal((await call(h, { method: 'POST', action: 'save', body: evil, headers: { ...post, cookie } })).status, 400);
  const evil2 = savePayload(d.etag); evil2.books = [{ ...books[0], cover: 'https://evil.com/x.png' }];
  assert.equal((await call(h, { method: 'POST', action: 'save', body: evil2, headers: { ...post, cookie } })).status, 400);
});

test('validate: reglas básicas', () => {
  const site = { es: { about: [] }, pt: { about: [] } };
  assert.throws(() => validate({ books: [{ slug: 'a', title: 't', author: 'a', languages: [] }], upcoming: [], site }));
  assert.throws(() => validate({ books: [{ slug: 'a', title: 't', author: 'a', languages: ['es'], amazonPrint: 'http://x' }], upcoming: [], site }));
  assert.throws(() => validate({ books: [{ slug: 'a', title: 't', author: 'a', languages: ['fr'] }], upcoming: [], site }));
  validate({ books: [{ slug: 'a', title: 't', author: 'a', languages: ['es'], amazonPrint: 'https://x.com/p' }], upcoming: [], site });
});

test('logout borra la cookie', async () => {
  const { h } = mk();
  const cookie = await login(h);
  const r = await call(h, { method: 'POST', action: 'logout', headers: { ...post, cookie } });
  assert.match(r.headers['set-cookie'], /Max-Age=0/);
});
