// Sion Book — panel de administración (solo en tu computadora).
// Uso:  node admin.mjs      → abre http://localhost:4000
// Edita data/*.json y site.json, sube portadas a assets/covers, regenera dist/ y publica con git.
// Solo escucha en 127.0.0.1: nadie más puede entrar. Sin dependencias.

import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { execFile } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const root = path.dirname(fileURLToPath(import.meta.url));
const PORT = Number(process.env.ADMIN_PORT) || 4000;
const file = (...p) => path.join(root, ...p);
const DATA = { books: file('data/books.json'), upcoming: file('data/proximas.json'), site: file('site.json') };
const COVERS = file('assets/covers');
const BACKUPS = file('admin/.backups');

const readJSON = (p, fallback) => (fs.existsSync(p) ? JSON.parse(fs.readFileSync(p, 'utf8')) : fallback);
const writeJSON = (p, v) => fs.writeFileSync(p, JSON.stringify(v, null, 2) + '\n');

function run(cmd, args) {
  return new Promise((resolve) => {
    execFile(cmd, args, { cwd: root, windowsHide: true, maxBuffer: 10_000_000 }, (err, stdout, stderr) => {
      resolve({ ok: !err, out: `${stdout || ''}${stderr || ''}`.trim() });
    });
  });
}

const json = (res, code, obj) => { res.writeHead(code, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' }); res.end(JSON.stringify(obj)); };
const send = (res, code, type, body) => { res.writeHead(code, { 'Content-Type': type, 'Cache-Control': 'no-store' }); res.end(body); };

function body(req, limit = 12_000_000) {
  return new Promise((resolve, reject) => {
    const chunks = []; let size = 0;
    req.on('data', (c) => { size += c.length; if (size > limit) { reject(new Error('Archivo demasiado grande (máx. 12 MB).')); req.destroy(); } else chunks.push(c); });
    req.on('end', () => resolve(Buffer.concat(chunks)));
    req.on('error', reject);
  });
}

/* ---------- validación al guardar ---------- */

const clean = (v) => {
  if (Array.isArray(v)) return v.map(clean);
  if (v && typeof v === 'object') return Object.fromEntries(Object.entries(v).filter(([k]) => !k.startsWith('_')).map(([k, x]) => [k, clean(x)]));
  return v;
};

function validate({ books, upcoming, site }) {
  if (!Array.isArray(books) || !Array.isArray(upcoming) || !site || typeof site !== 'object') throw new Error('Datos incompletos.');
  const seen = new Set();
  for (const b of books) {
    if (!b.title || !b.author) throw new Error(`Falta el título o el autor en un libro (${b.title || 'sin título'}).`);
    if (!/^[a-z0-9-]+$/.test(b.slug || '')) throw new Error(`"${b.title}": la dirección web solo admite minúsculas, números y guiones.`);
    if (seen.has(b.slug)) throw new Error(`Dos libros tienen la misma dirección web: ${b.slug}`);
    seen.add(b.slug);
    if (b.slug_pt && !/^[a-z0-9-]+$/.test(b.slug_pt)) throw new Error(`"${b.title}": la dirección en portugués solo admite minúsculas, números y guiones.`);
    if (!Array.isArray(b.languages) || !b.languages.length) throw new Error(`"${b.title}": elige al menos un idioma donde mostrarlo.`);
    for (const k of ['amazonPrint', 'amazonKindle', 'googlePlay']) {
      if (b[k] && !/^https:\/\//.test(b[k])) throw new Error(`"${b.title}": el enlace "${k}" debe empezar por https://`);
    }
  }
  for (const u of upcoming) {
    if (!u.title || !u.author) throw new Error(`Falta el título o el autor en una próxima obra (${u.title || 'sin título'}).`);
    if (!Array.isArray(u.languages) || !u.languages.length) throw new Error(`"${u.title}": elige al menos un idioma donde mostrarla.`);
  }
  for (const l of ['es', 'pt']) if (!site[l] || !Array.isArray(site[l].about)) throw new Error(`Faltan los textos de la editorial en ${l}.`);
}

function backup() {
  fs.mkdirSync(BACKUPS, { recursive: true });
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  for (const [name, p] of Object.entries(DATA)) if (fs.existsSync(p)) fs.copyFileSync(p, path.join(BACKUPS, `${stamp}-${name}.json`));
  const all = fs.readdirSync(BACKUPS).sort();
  for (const f of all.slice(0, Math.max(0, all.length - 60))) fs.unlinkSync(path.join(BACKUPS, f));
}

/* ---------- imágenes ---------- */

function imageKind(buf) {
  if (buf.length > 12 && buf[0] === 0xff && buf[1] === 0xd8) return 'jpg';
  if (buf.length > 12 && buf.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return 'png';
  if (buf.length > 12 && buf.subarray(0, 4).toString() === 'RIFF' && buf.subarray(8, 12).toString() === 'WEBP') return 'webp';
  return null;
}

/* ---------- servidor ---------- */

const types = { '.html': 'text/html; charset=utf-8', '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp', '.svg': 'image/svg+xml' };

const server = http.createServer(async (req, res) => {
  try {
    // Solo desde esta misma computadora: se comprueba el Host (evita ataques desde otras webs)
    const host = (req.headers.host || '').toLowerCase();
    if (host !== `localhost:${PORT}` && host !== `127.0.0.1:${PORT}`) return send(res, 403, 'text/plain', 'Acceso denegado');
    const url = new URL(req.url, `http://${host}`);
    const p = decodeURIComponent(url.pathname);

    if (req.method === 'GET') {
      if (p === '/') return send(res, 200, types['.html'], fs.readFileSync(file('admin/index.html')));
      if (p === '/logo.png') return send(res, 200, 'image/png', fs.readFileSync(file('assets/brand/logo.png')));
      if (p.startsWith('/covers/')) {
        const f = path.join(COVERS, path.basename(p));
        if (fs.existsSync(f)) return send(res, 200, types[path.extname(f).toLowerCase()] || 'application/octet-stream', fs.readFileSync(f));
        return send(res, 404, 'text/plain', 'No existe');
      }
      if (p === '/api/data') {
        return json(res, 200, { books: readJSON(DATA.books, []), upcoming: readJSON(DATA.upcoming, []), site: readJSON(DATA.site, {}) });
      }
      if (p === '/api/git') {
        const st = await run('git', ['status', '--porcelain']);
        const ahead = await run('git', ['rev-list', '--count', '@{u}..HEAD']);
        const last = await run('git', ['log', '-1', '--format=%h %s']);
        return json(res, 200, { changes: st.out ? st.out.split('\n').length : 0, ahead: ahead.ok ? Number(ahead.out) || 0 : 0, last: last.out });
      }
      return send(res, 404, 'text/plain', 'No existe');
    }

    // Toda escritura exige la cabecera propia (una web ajena no puede enviarla)
    if (req.method !== 'POST' || req.headers['x-admin'] !== '1') return send(res, 403, 'text/plain', 'Acceso denegado');

    if (p === '/api/save') {
      const data = clean(JSON.parse((await body(req, 5_000_000)).toString('utf8')));
      validate(data);
      backup();
      writeJSON(DATA.books, data.books);
      writeJSON(DATA.upcoming, data.upcoming);
      writeJSON(DATA.site, data.site);
      const built = await run(process.execPath, [file('build.mjs')]);
      return json(res, built.ok ? 200 : 500, { ok: built.ok, log: built.out });
    }

    if (p === '/api/upload') {
      const buf = await body(req);
      const kind = imageKind(buf);
      if (!kind) throw new Error('Formato no válido. Usa JPG, PNG o WebP.');
      const base = (url.searchParams.get('name') || 'portada').toLowerCase().replace(/\.[a-z0-9]+$/, '').replace(/[^a-z0-9-]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 60) || 'portada';
      fs.mkdirSync(COVERS, { recursive: true });
      let name = `${base}.${kind}`;
      for (let i = 2; fs.existsSync(path.join(COVERS, name)); i++) name = `${base}-${i}.${kind}`;
      fs.writeFileSync(path.join(COVERS, name), buf);
      return json(res, 200, { ok: true, path: `/covers/${name}`, kb: Math.round(buf.length / 1024) });
    }

    if (p === '/api/publish') {
      const { message } = JSON.parse((await body(req, 100_000)).toString('utf8') || '{}');
      const msg = String(message || '').trim() || 'Actualización desde el panel de administración';
      const log = [];
      const step = async (args) => { const r = await run('git', args); log.push(`$ git ${args[0]}\n${r.out}`); return r; };
      await step(['add', '-A']);
      const staged = await run('git', ['diff', '--cached', '--quiet']);
      if (!staged.ok) {
        const name = (await run('git', ['config', 'user.name'])).out || 'Sion Book';
        const email = (await run('git', ['config', 'user.email'])).out || 'admin@sionbook.com';
        const c = await step(['-c', `user.name=${name}`, '-c', `user.email=${email}`, 'commit', '-m', msg]);
        if (!c.ok) return json(res, 500, { ok: false, log: log.join('\n\n') });
      } else log.push('(no había cambios nuevos que guardar)');
      const push = await step(['push']);
      return json(res, push.ok ? 200 : 500, { ok: push.ok, log: log.join('\n\n') });
    }

    return send(res, 404, 'text/plain', 'No existe');
  } catch (e) {
    return json(res, 400, { ok: false, error: e.message || String(e) });
  }
});

server.listen(PORT, '127.0.0.1', () => {
  console.log(`Panel de administración en http://localhost:${PORT}  (Ctrl+C para cerrar)`);
});
// Vista previa del sitio en http://localhost:3000 (si ya estaba abierta, no pasa nada)
import('./serve.mjs').catch(() => {});
