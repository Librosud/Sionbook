import test from 'node:test';
import assert from 'node:assert/strict';
import { createGithub, GhError } from '../lib/github.js';

function mockFetch(handlers) {
  const log = [];
  const impl = async (url, opts) => {
    const path = url.replace('https://api.github.com', '');
    const key = `${opts.method || 'GET'} ${path.split('?')[0]}`;
    log.push({ key, body: opts.body ? JSON.parse(opts.body) : null, auth: opts.headers.Authorization });
    const h = handlers[key];
    const out = typeof h === 'function' ? h(log.filter((l) => l.key === key).length) : h;
    if (!out) return { ok: false, status: 404, text: async () => 'no mock' };
    return { ok: out.status ? out.status < 400 : true, status: out.status || 200, json: async () => out.json, text: async () => out.text ?? JSON.stringify(out.json) };
  };
  return { impl, log };
}

const repo = 'Librosud/Sionbook';
const base = {
  [`GET /repos/${repo}/git/ref/heads/main`]: { json: { object: { sha: 'h1' } } },
  [`GET /repos/${repo}/git/commits/h1`]: { json: { tree: { sha: 't1' } } },
  [`POST /repos/${repo}/git/blobs`]: { json: { sha: 'b1' } },
  [`POST /repos/${repo}/git/trees`]: { json: { sha: 't2' } },
  [`POST /repos/${repo}/git/commits`]: { json: { sha: 'c2' } },
  [`PATCH /repos/${repo}/git/refs/heads/main`]: { json: {} }
};

test('commit: un solo commit con todos los archivos, en orden, con el token', async () => {
  const { impl, log } = mockFetch(base);
  const gh = createGithub({ token: 'TOK', repo, fetchImpl: impl });
  const sha = await gh.commit('msg', [{ path: 'a.json', content: '{}' }, { path: 'assets/covers/x.jpg', sha: 'blob9' }]);
  assert.equal(sha, 'c2');
  assert.deepEqual(log.map((l) => l.key), [
    `GET /repos/${repo}/git/ref/heads/main`, `GET /repos/${repo}/git/commits/h1`,
    `POST /repos/${repo}/git/blobs`, `POST /repos/${repo}/git/trees`, `POST /repos/${repo}/git/commits`, `PATCH /repos/${repo}/git/refs/heads/main`
  ]);
  const tree = log.find((l) => l.key.endsWith('/git/trees')).body;
  assert.equal(tree.base_tree, 't1');
  assert.deepEqual(tree.tree.map((e) => [e.path, e.sha]), [['a.json', 'b1'], ['assets/covers/x.jpg', 'blob9']]);
  assert.ok(log.every((l) => l.auth === 'Bearer TOK'));
});

test('commit: si el push choca (422) reintenta una vez desde el nuevo estado', async () => {
  let patches = 0;
  const { impl, log } = mockFetch({ ...base, [`PATCH /repos/${repo}/git/refs/heads/main`]: () => (++patches === 1 ? { status: 422, text: 'not fast forward' } : { json: {} }) });
  const gh = createGithub({ token: 't', repo, fetchImpl: impl });
  assert.equal(await gh.commit('m', [{ path: 'a', content: 'x' }]), 'c2');
  assert.equal(log.filter((l) => l.key.startsWith('PATCH')).length, 2);
});

test('commit: otros errores se propagan', async () => {
  const { impl } = mockFetch({ ...base, [`PATCH /repos/${repo}/git/refs/heads/main`]: { status: 403, text: 'forbidden' } });
  const gh = createGithub({ token: 't', repo, fetchImpl: impl });
  await assert.rejects(() => gh.commit('m', [{ path: 'a', content: 'x' }]), (e) => e instanceof GhError && e.status === 403);
});

test('readFile pide el contenido en bruto de la rama', async () => {
  const { impl, log } = mockFetch({ [`GET /repos/${repo}/contents/site.json`]: { text: '{"a":1}' } });
  const gh = createGithub({ token: 't', repo, fetchImpl: impl });
  assert.equal(await gh.readFile('site.json'), '{"a":1}');
  assert.equal(log[0].key, `GET /repos/${repo}/contents/site.json`);
});
