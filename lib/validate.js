// Validación y limpieza de los datos del panel de administración (se usa en el panel local y en el de sionbook.com/admin).

export const LANGS = ['es', 'pt'];
export const SLUG = /^[a-z0-9-]+$/;
export const COVER_PATH = /^\/covers\/[A-Za-z0-9._-]+\.(jpe?g|png|webp)$/;
const MAX_TEXT = 20000;

// Quita las claves internas del panel (las que empiezan por "_")
export function clean(v) {
  if (Array.isArray(v)) return v.map(clean);
  if (v && typeof v === 'object') return Object.fromEntries(Object.entries(v).filter(([k]) => !k.startsWith('_')).map(([k, x]) => [k, clean(x)]));
  return v;
}

function checkStrings(v, where) {
  if (typeof v === 'string' && v.length > MAX_TEXT) throw new Error(`Un texto de ${where} es demasiado largo.`);
  if (Array.isArray(v)) { if (v.length > 500) throw new Error(`Demasiados elementos en ${where}.`); v.forEach((x) => checkStrings(x, where)); }
  else if (v && typeof v === 'object') Object.values(v).forEach((x) => checkStrings(x, where));
}

export function validate({ books, upcoming, site }) {
  if (!Array.isArray(books) || !Array.isArray(upcoming) || !site || typeof site !== 'object') throw new Error('Datos incompletos.');
  checkStrings(books, 'los libros'); checkStrings(upcoming, 'las próximas obras'); checkStrings(site, 'los textos de la editorial');
  const seen = new Set();
  const coverOk = (c, who) => { if (c && !COVER_PATH.test(c)) throw new Error(`"${who}": la portada no es válida.`); };
  for (const b of books) {
    if (!b || typeof b !== 'object') throw new Error('Libro no válido.');
    if (!b.title || !b.author) throw new Error(`Falta el título o el autor en un libro (${b.title || 'sin título'}).`);
    if (!SLUG.test(b.slug || '')) throw new Error(`"${b.title}": la dirección web solo admite minúsculas, números y guiones.`);
    if (seen.has(b.slug)) throw new Error(`Dos libros tienen la misma dirección web: ${b.slug}`);
    seen.add(b.slug);
    if (b.slug_pt && !SLUG.test(b.slug_pt)) throw new Error(`"${b.title}": la dirección en portugués solo admite minúsculas, números y guiones.`);
    if (!Array.isArray(b.languages) || !b.languages.length || b.languages.some((l) => !LANGS.includes(l))) throw new Error(`"${b.title}": elige al menos un idioma donde mostrarlo.`);
    coverOk(b.cover, b.title); coverOk(b.cover_pt, b.title);
    for (const k of ['amazonPrint', 'amazonKindle', 'googlePlay']) {
      if (b[k] && !/^https:\/\//.test(b[k])) throw new Error(`"${b.title}": el enlace "${k}" debe empezar por https://`);
    }
  }
  for (const u of upcoming) {
    if (!u || typeof u !== 'object') throw new Error('Próxima obra no válida.');
    if (!u.title || !u.author) throw new Error(`Falta el título o el autor en una próxima obra (${u.title || 'sin título'}).`);
    if (!Array.isArray(u.languages) || !u.languages.length || u.languages.some((l) => !LANGS.includes(l))) throw new Error(`"${u.title}": elige al menos un idioma donde mostrarla.`);
    coverOk(u.cover, u.title); coverOk(u.cover_pt, u.title);
  }
  for (const l of LANGS) if (!site[l] || !Array.isArray(site[l].about)) throw new Error(`Faltan los textos de la editorial en ${l}.`);
}

// Tipo de imagen por sus primeros bytes (no se confía en la extensión)
export function imageKind(buf) {
  if (buf.length > 12 && buf[0] === 0xff && buf[1] === 0xd8) return 'jpg';
  if (buf.length > 12 && buf.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return 'png';
  if (buf.length > 12 && buf.subarray(0, 4).toString() === 'RIFF' && buf.subarray(8, 12).toString() === 'WEBP') return 'webp';
  return null;
}

export const safeBase = (name) => String(name || 'portada').toLowerCase().replace(/\.[a-z0-9]+$/, '').replace(/[^a-z0-9-]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 60) || 'portada';
