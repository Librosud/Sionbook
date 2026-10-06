// Autenticación del panel web: contraseña con scrypt + sesión firmada en una cookie.
// Nada de esto contiene secretos: la contraseña (ya cifrada) y la clave de sesión viven en variables de entorno de Vercel.

import crypto from 'node:crypto';

const SCRYPT = { N: 32768, r: 8, p: 1, maxmem: 64 * 1024 * 1024 };
const SESSION_HOURS = 8;
export const COOKIE = 'sb_admin';

const scrypt = (password, salt, opts) => new Promise((res, rej) => crypto.scrypt(password, salt, 32, opts, (e, k) => (e ? rej(e) : res(k))));

// Formato guardado: scrypt$N$r$p$salt(base64)$hash(base64)
export async function hashPassword(password) {
  const salt = crypto.randomBytes(16);
  const dk = await scrypt(password, salt, SCRYPT);
  return ['scrypt', SCRYPT.N, SCRYPT.r, SCRYPT.p, salt.toString('base64'), dk.toString('base64')].join('$');
}

export async function verifyPassword(password, stored) {
  try {
    const [alg, N, r, p, salt, hash] = String(stored || '').split('$');
    if (alg !== 'scrypt') return false;
    const want = Buffer.from(hash, 'base64');
    const dk = await scrypt(password, Buffer.from(salt, 'base64'), { N: +N, r: +r, p: +p, maxmem: SCRYPT.maxmem });
    return want.length === dk.length && crypto.timingSafeEqual(dk, want);
  } catch { return false; }
}

const b64u = (b) => Buffer.from(b).toString('base64url');
const sign = (data, secret) => crypto.createHmac('sha256', secret).update(data).digest('base64url');

export function createSession(email, secret, now = Date.now()) {
  const payload = b64u(JSON.stringify({ sub: email, exp: now + SESSION_HOURS * 3600 * 1000 }));
  return `${payload}.${sign(payload, secret)}`;
}

export function readSession(cookieHeader, secret, now = Date.now()) {
  const m = String(cookieHeader || '').split(/;\s*/).find((c) => c.startsWith(COOKIE + '='));
  if (!m || !secret) return null;
  const token = m.slice(COOKIE.length + 1);
  const [payload, sig] = token.split('.');
  if (!payload || !sig) return null;
  const good = sign(payload, secret);
  if (sig.length !== good.length || !crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(good))) return null;
  try {
    const data = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'));
    return data.exp > now ? data : null;
  } catch { return null; }
}

export const sessionCookie = (token) => `${COOKIE}=${token}; HttpOnly; Secure; SameSite=Strict; Path=/; Max-Age=${SESSION_HOURS * 3600}`;
export const clearCookie = () => `${COOKIE}=; HttpOnly; Secure; SameSite=Strict; Path=/; Max-Age=0`;

// Límite de intentos por IP (en memoria: frena la fuerza bruta dentro de una misma instancia)
const fails = new Map();
export function tooManyAttempts(ip, now = Date.now()) {
  const f = fails.get(ip);
  return !!f && f.until > now;
}
export function registerFailure(ip, now = Date.now()) {
  const f = fails.get(ip) || { count: 0, until: 0 };
  f.count += 1;
  if (f.count >= 5) { f.until = now + 15 * 60 * 1000; f.count = 0; }
  fails.set(ip, f);
}
export const clearFailures = (ip) => fails.delete(ip);

export const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
