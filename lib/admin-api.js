// API del panel de administración en sionbook.com/admin (funciones de Vercel).
// Acciones (?action=...): session, login, logout, data, upload, save.
// Todo salvo "session" y "login" exige sesión válida. Las escrituras exigen además la cabecera X-Admin y el mismo origen.

import crypto from 'node:crypto';
import { createGithub } from './github.js';
import { clean, validate, imageKind, safeBase, COVER_PATH } from './validate.js';
import { verifyPassword, createSession, readSession, sessionCookie, clearCookie, tooManyAttempts, registerFailure, clearFailures, sleep } from './auth.js';

const FILES = { books: 'data/books.json', upcoming: 'data/proximas.json', site: 'site.json' };
const pretty = (v) => JSON.stringify(v, null, 2) + '\n';
const etagOf = (raw) => crypto.createHash('sha256').update(raw.books + '\u0000' + raw.upcoming + '\u0000' + raw.site).digest('hex').slice(0, 24);

export function createHandler(env, deps = {}) {
  const config = () => {
    const need = ['ADMIN_EMAIL', 'ADMIN_PASSWORD_HASH', 'SESSION_SECRET', 'GITHUB_TOKEN'];
    return need.filter((k) => !env[k]);
  };
  const github = () => deps.github || createGithub({ token: env.GITHUB_TOKEN, repo: env.GITHUB_REPO || 'Librosud/Sionbook', branch: env.GITHUB_BRANCH || 'main' });
  const sleepFn = deps.sleep || sleep;

  const send = (res, code, obj, headers = {}) => {
    res.statusCode = code;
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.setHeader('Cache-Control', 'no-store');
    for (const [k, v] of Object.entries(headers)) res.setHeader(k, v);
    res.end(JSON.stringify(obj));
  };

  async function readAll(gh) {
    const raw = {};
    for (const [k, p] of Object.entries(FILES)) raw[k] = await gh.readFile(p);
    return raw;
  }

  return async function handler(req, res) {
    try {
      const url = new URL(req.url, 'http://x');
      const action = url.searchParams.get('action') || req.query?.action || '';
      const missing = config();
      const ip = String(req.headers['x-forwarded-for'] || req.socket?.remoteAddress || 'ip').split(',')[0].trim();
      const session = missing.length ? null : readSession(req.headers.cookie, env.SESSION_SECRET);

      if (action === 'session') {
        return send(res, 200, { mode: 'cloud', configured: missing.length === 0, missing, authenticated: !!session, email: session?.sub || null });
      }
      if (missing.length) return send(res, 503, { ok: false, error: 'El panel todavía no está configurado en Vercel.' });

      const post = req.method === 'POST';
      if (post) {
        const origin = req.headers.origin;
        const host = req.headers.host;
        const sameOrigin = !origin || new URL(origin).host === host;
        if (req.headers['x-admin'] !== '1' || !sameOrigin) return send(res, 403, { ok: false, error: 'Petición no permitida.' });
      }

      if (action === 'login' && post) {
        if (tooManyAttempts(ip)) return send(res, 429, { ok: false, error: 'Demasiados intentos. Espera 15 minutos.' });
        const { email = '', password = '' } = req.body || {};
        const emailOk = String(email).trim().toLowerCase() === String(env.ADMIN_EMAIL).trim().toLowerCase();
        const passOk = await verifyPassword(String(password), env.ADMIN_PASSWORD_HASH); // siempre se verifica (tiempo constante)
        if (!(emailOk && passOk)) {
          registerFailure(ip);
          await sleepFn(900);
          return send(res, 401, { ok: false, error: 'Correo o contraseña incorrectos.' });
        }
        clearFailures(ip);
        return send(res, 200, { ok: true, email: env.ADMIN_EMAIL }, { 'Set-Cookie': sessionCookie(createSession(env.ADMIN_EMAIL, env.SESSION_SECRET)) });
      }

      if (action === 'logout' && post) return send(res, 200, { ok: true }, { 'Set-Cookie': clearCookie() });

      if (!session) return send(res, 401, { ok: false, error: 'Sesión caducada. Entra de nuevo.' });

      const gh = github();

      if (action === 'data' && !post) {
        const raw = await readAll(gh);
        return send(res, 200, { books: JSON.parse(raw.books), upcoming: JSON.parse(raw.upcoming), site: JSON.parse(raw.site), etag: etagOf(raw) });
      }

      if (action === 'upload' && post) {
        const { name, dataBase64 } = req.body || {};
        const buf = Buffer.from(String(dataBase64 || ''), 'base64');
        if (buf.length > 3_500_000) return send(res, 413, { ok: false, error: 'La imagen es demasiado grande (máx. 3,5 MB).' });
        const kind = imageKind(buf);
        if (!kind) return send(res, 400, { ok: false, error: 'Formato no válido. Usa JPG, PNG o WebP.' });
        const file = `${safeBase(name)}-${crypto.randomBytes(3).toString('hex')}.${kind}`;
        const sha = await gh.createBlob(buf.toString('base64'));
        return send(res, 200, { ok: true, path: `/covers/${file}`, sha, kb: Math.round(buf.length / 1024) });
      }

      if (action === 'save' && post) {
        const body = req.body || {};
        const data = clean({ books: body.books, upcoming: body.upcoming, site: body.site });
        validate(data);
        const covers = Array.isArray(body.covers) ? body.covers : [];
        for (const c of covers) {
          if (!COVER_PATH.test(c.path || '') || !/^[0-9a-f]{40}$/.test(c.sha || '')) return send(res, 400, { ok: false, error: 'Portada subida no válida.' });
        }
        const current = await readAll(gh);
        if (body.etag !== etagOf(current)) return send(res, 409, { ok: false, error: 'Los datos cambiaron desde que abriste el panel (¿editaste desde otro sitio?). Recarga la página para ver la versión actual.' });

        const next = { books: pretty(data.books), upcoming: pretty(data.upcoming), site: pretty(data.site) };
        const files = Object.entries(FILES).filter(([k]) => next[k] !== current[k]).map(([k, p]) => ({ path: p, content: next[k] }));
        const used = new Set([data.books, data.upcoming].flat().flatMap((o) => [o.cover, o.cover_pt]).filter(Boolean));
        for (const c of covers) if (used.has(c.path)) files.push({ path: 'assets' + c.path, sha: c.sha });
        if (!files.length) return send(res, 200, { ok: true, unchanged: true, etag: body.etag });

        const msg = String(body.message || '').trim().slice(0, 120) || 'Actualización desde el panel web';
        const commit = await gh.commit(`${msg}\n\n(panel de administración web)`, files);
        return send(res, 200, { ok: true, commit, etag: etagOf(next) });
      }

      return send(res, 404, { ok: false, error: 'No existe.' });
    } catch (e) {
      const known = /GitHub 401|GitHub 403/.test(e.message) ? 'GitHub rechazó el token (revisa que sea válido y tenga permiso de escritura).' : null;
      return send(res, e.message && /^(Falta|Dos|"|Datos|Libro|Próxima|Un texto|Demasiados)/.test(e.message) ? 400 : 500, { ok: false, error: known || e.message || 'Error' });
    }
  };
}
