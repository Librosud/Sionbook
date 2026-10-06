// Sion Book — generador del sitio estático.
// Uso:  node build.mjs      → crea la carpeta dist/ lista para publicar
// Sin dependencias: solo Node 18+.

import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';

const root = path.dirname(fileURLToPath(import.meta.url));
const dist = path.join(root, 'dist');
const read = (p) => fs.readFileSync(path.join(root, p), 'utf8');
const site = JSON.parse(read('site.json'));
const books = JSON.parse(read('data/books.json'));
const upcoming = fs.existsSync(path.join(root, 'data/proximas.json')) ? JSON.parse(read('data/proximas.json')) : [];
const today = new Date();
const year = today.getFullYear();

/* ---------- utilidades ---------- */

const esc = (s = '') => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const paragraphs = (s = '') => s.split(/\n\s*\n/).map((p) => p.trim()).filter(Boolean).map((p) => `<p>${esc(p)}</p>`).join('\n');
const jsonLd = (obj) => `<script type="application/ld+json">${JSON.stringify(obj).replace(/</g, '\\u003c')}</script>`;
const abs = (p) => (/^https?:/.test(p) ? p : site.url + p);
const langCode = (l = '') => ({ 'español': 'es', 'portugués': 'pt', 'português': 'pt', 'english': 'en', 'inglés': 'en' }[l.toLowerCase()] || site.lang);
const colorOf = (b) => (/^#[0-9a-f]{3,8}$/i.test(b.color || '') ? b.color : '#0a2a8a');

function out(rel, content) {
  const file = path.join(dist, rel);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, content);
}

function hashed(srcRel, name, ext) {
  const buf = fs.readFileSync(path.join(root, srcRel));
  const h = crypto.createHash('md5').update(buf).digest('hex').slice(0, 8);
  const rel = `assets/${name}.${h}.${ext}`;
  out(rel, buf);
  return '/' + rel;
}

/* ---------- validación de datos ---------- */

const slugs = new Set();
for (const b of books) {
  if (!b.slug || !/^[a-z0-9-]+$/.test(b.slug)) throw new Error(`Libro "${b.title}": slug inválido (solo a-z, 0-9 y guiones).`);
  if (slugs.has(b.slug)) throw new Error(`Slug repetido: ${b.slug}`);
  slugs.add(b.slug);
  if (!b.title || !b.author) throw new Error(`Libro ${b.slug}: faltan título o autor.`);
  for (const k of ['amazonPrint', 'amazonKindle', 'googlePlay']) {
    if (b[k] && !/^https:\/\//.test(b[k])) console.warn(`⚠ ${b.slug}: ${k} debería empezar por https://`);
  }
  if (!b.description) console.warn(`⚠ ${b.slug}: sin descripción (Google necesita texto para indexar la ficha).`);
}

for (const u of upcoming) {
  if (!u.title || !u.author) throw new Error(`Próxima obra "${u.title || '?'}": faltan título o autor.`);
}

/* ---------- páginas en orden de lectura ---------- */

const bookPath = (b) => `/libros/${b.slug}/`;
const pages = [
  { path: '/', title: 'Inicio' },
  { path: '/catalogo/', title: 'Catálogo' },
  ...books.map((b) => ({ path: bookPath(b), title: b.title, book: b })),
  ...(upcoming.length ? [{ path: '/proximas-obras/', title: 'Próximas obras' }] : []),
  { path: '/sobre-nosotros/', title: 'La editorial' },
  { path: '/contacto/', title: 'Contacto' }
];
const folioOf = (p) => pages.findIndex((x) => x.path === p);
// Número de capítulo (romano) según el orden del índice: Inicio, Catálogo, [Próximas obras], La editorial, Contacto
const chapter = (p) => ['I', 'II', 'III', 'IV', 'V', 'VI'][['/', '/catalogo/', ...(upcoming.length ? ['/proximas-obras/'] : []), '/sobre-nosotros/', '/contacto/'].indexOf(p)];

/* ---------- piezas visuales ---------- */

const logo = `<img src="/brand/logo.png" alt="Sion Book" width="838" height="402">`;
const coverMark = `<svg class="cover-mark" viewBox="0 0 64 44" fill="none" aria-hidden="true"><path d="M32 8C24 3 12 3 4 6v32c8-3 20-3 28 2zM32 8c8-5 20-5 28-2v32c-8-3-20-3-28 2zM32 8v32" stroke="currentColor" stroke-width="2.2" stroke-linejoin="round"/></svg>`;
const ornament = `<svg class="ornament" viewBox="0 0 200 120" fill="none" stroke="currentColor" stroke-width="1.5" aria-hidden="true"><path d="M100 14l16 46-16 46-16-46z"/><path d="M100 30l8 30-8 30-8-30z" fill="currentColor" opacity=".25"/><path d="M84 60C60 60 50 40 28 40M84 60C60 60 50 80 28 80M116 60c24 0 34-20 56-20M116 60c24 0 34 20 56 20"/><circle cx="22" cy="40" r="3"/><circle cx="22" cy="80" r="3"/><circle cx="178" cy="40" r="3"/><circle cx="178" cy="80" r="3"/></svg>`;
const rule = `<span class="rule" aria-hidden="true"><i></i></span>`;

function cover(b, { cls = '', decorative = false } = {}) {
  const c = `class="cover${cls ? ' ' + cls : ''}" style="--c:${colorOf(b)}"`;
  if (b.cover) {
    const alt = decorative ? '' : `Portada de ${esc(b.title)}`;
    return `<span ${c}${decorative ? ' aria-hidden="true"' : ''}><img src="${esc(b.cover)}" alt="${alt}" width="400" height="600" loading="lazy" decoding="async"></span>`;
  }
  const a11y = decorative ? 'aria-hidden="true"' : `role="img" aria-label="Portada de ${esc(b.title)}"`;
  return `<span ${c} ${a11y}><span class="cover-frame"><span><span class="cover-title">${esc(b.title)}</span>${b.subtitle ? `<span class="cover-sub" style="display:block">${esc(b.subtitle)}</span>` : ''}</span>${coverMark}<span class="cover-author">${esc(b.author)}</span></span></span>`;
}

function card(b, withCategory = false) {
  return `<li class="card"${withCategory ? ` data-category="${esc(b.category || '')}"` : ''}>${cover(b, { decorative: true })}${b.category ? `<p class="card-cat">${esc(b.category)}</p>` : ''}<h3 class="card-title"><a href="${bookPath(b)}">${esc(b.title)}</a></h3><p class="card-author">${esc(b.author)}</p></li>`;
}

function soonCard(b) {
  return `<li class="card card--soon">${cover(b, { decorative: true })}<p class="card-cat">Próximamente${b.when ? ' · ' + esc(b.when) : ''}</p><h3 class="card-title">${esc(b.title)}</h3>${b.subtitle ? `<p class="card-sub">${esc(b.subtitle)}</p>` : ''}${b.note ? `<p class="card-note">${esc(b.note)}</p>` : ''}<p class="card-author">${esc(b.author)}</p></li>`;
}

// Sección "Próximas obras": solo aparece si data/proximas.json tiene títulos
const upcomingBlock = () => upcoming.length
  ? `${rule}
<section aria-labelledby="proximas"><h2 id="proximas">Próximas obras</h2>
<ul class="grid">${upcoming.map(soonCard).join('')}</ul></section>`
  : '';

/* ---------- página izquierda (índice) y derecha (contenido) ---------- */

function leftPage(current, extra) {
  const roman = ['I', 'II', 'III', 'IV', 'V', 'VI'];
  const main = [
    { path: '/', label: 'Inicio' },
    { path: '/catalogo/', label: 'Catálogo', kids: true },
    ...(upcoming.length ? [{ path: '/proximas-obras/', label: 'Próximas obras' }] : []),
    { path: '/sobre-nosotros/', label: 'La editorial' },
    { path: '/contacto/', label: 'Contacto' }
  ].map((it, i) => ({ ...it, num: roman[i] }));
  const li = main.map((it) => {
    const aria = current === it.path ? ' aria-current="page"' : it.kids && current.startsWith('/libros/') ? ' aria-current="true"' : '';
    const kids = it.kids && books.length
      ? `<ol class="toc toc--sub">${books.slice(0, 8).map((b) => `<li><a href="${bookPath(b)}"${current === bookPath(b) ? ' aria-current="page"' : ''}><span class="toc-title">${esc(b.title)}</span><span class="toc-dots" aria-hidden="true"></span><span class="toc-page" aria-hidden="true">${folioOf(bookPath(b)) + 1}</span></a></li>`).join('')}</ol>`
      : '';
    return `<li><a href="${it.path}"${aria}><span class="toc-num" aria-hidden="true">${it.num}</span><span class="toc-title">${it.label}</span><span class="toc-dots" aria-hidden="true"></span><span class="toc-page" aria-hidden="true">${folioOf(it.path) + 1}</span></a>${kids}</li>`;
  }).join('');
  return `<header><a class="brand" href="/"${current === '/' ? ' aria-current="page"' : ''}>${logo}<span class="brand-sub">Editorial</span></a></header>
<nav aria-label="Índice del libro"><p class="toc-label" aria-hidden="true">Índice</p><ol class="toc">${li}</ol></nav>
<div class="left-extra">${extra}</div>
<footer class="left-footer"><p>© ${year} Sion Book · ${esc(site.editorTitle)}: ${esc(site.editor)}</p><p>Los botones de compra te llevan a tiendas externas (Amazon y Google Play Libros).</p></footer>`;
}

function rightPage(current, content) {
  const i = folioOf(current);
  let folio = '';
  if (i >= 0) {
    const prev = pages[i - 1];
    const next = pages[i + 1];
    folio = `<nav class="folio" aria-label="Pasar página">${prev ? `<a class="prev" rel="prev" href="${prev.path}">← ${esc(prev.title)}</a>` : '<span></span>'}<span class="folio-num" aria-hidden="true">— ${i + 1} —</span>${next ? `<a class="next" rel="next" href="${next.path}">${esc(next.title)} →</a>` : '<span></span>'}</nav>`;
  }
  return `<div class="content">${content}</div>${folio}<p class="mobile-footer">© ${year} Sion Book · ${esc(site.editorTitle)}: ${esc(site.editor)}. Los botones de compra te llevan a tiendas externas.</p>`;
}

const defaultExtra = `<div style="text-align:center">${ornament}<p class="left-quote">${esc(site.tagline)}</p></div>`;

/* ---------- documento completo ---------- */

fs.rmSync(dist, { recursive: true, force: true });
fs.mkdirSync(dist, { recursive: true });

const css = hashed('src/style.css', 'style', 'css');
const js = hashed('src/book.js', 'book', 'js');

function document_({ path: p, order, page, title, description, left, right, og = {}, ld = [] }) {
  const canonical = abs(p === '/404.html' ? '/' : p);
  const image = og.image ? abs(og.image) : '';
  return `<!doctype html>
<html lang="${site.lang}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(title)}</title>
<meta name="description" content="${esc(description)}">
<link rel="canonical" href="${canonical}">
<meta name="theme-color" content="#0a1f6b">
<meta property="og:site_name" content="${esc(site.name)}">
<meta property="og:locale" content="${site.locale}">
<meta property="og:type" content="${og.type || 'website'}">
<meta property="og:title" content="${esc(title)}">
<meta property="og:description" content="${esc(description)}">
<meta property="og:url" content="${canonical}">
${image ? `<meta property="og:image" content="${esc(image)}">\n` : ''}<meta name="twitter:card" content="${image ? 'summary_large_image' : 'summary'}">
${p === '/404.html' ? '<meta name="robots" content="noindex">\n' : ''}<link rel="icon" href="/favicon.svg" type="image/svg+xml">
<script>document.documentElement.classList.add('js')</script>
<link rel="stylesheet" href="${css}">
${ld.map(jsonLd).join('\n')}
<script src="${js}" defer></script>
</head>
<body data-page="${page}" data-order="${order}">
<a class="skip" href="#page-right">Saltar al contenido</a>
<div class="wrap"><div class="book"><div class="spread" id="spread">
<div class="paper paper--left" id="page-left"><div class="page-inner">
${left}
</div></div>
<main class="paper paper--right" id="page-right" tabindex="-1"><div class="page-inner">
${right}
</div></main>
</div></div></div>
<div class="sr-only" id="announcer" aria-live="polite"></div>
</body>
</html>
`;
}

const orgLd = { '@context': 'https://schema.org', '@type': 'Organization', name: site.name, url: site.url, description: site.description, founder: { '@type': 'Person', name: site.editor, jobTitle: site.editorTitle }, email: site.email };
const siteLd = { '@context': 'https://schema.org', '@type': 'WebSite', name: site.name, url: site.url, inLanguage: site.lang };

/* ---------- construcción ---------- */

// Inicio
out('index.html', document_({
  path: '/', order: 1, page: 'home',
  title: `${site.name} — ${site.tagline}`,
  description: site.description,
  left: leftPage('/', defaultExtra),
  right: rightPage('/', `
<p class="eyebrow">Editorial independiente · Español y português</p>
<h1>${esc(site.tagline)}</h1>
<p class="lead">${esc(site.description)}</p>
${rule}
<h2>Novedades</h2>
<ul class="grid">${books.slice(0, 3).map((b) => card(b)).join('')}</ul>
<p><a class="link-arrow" href="/catalogo/">Ver todo el catálogo →</a></p>
${upcomingBlock()}
${rule}
<h2>Cómo comprar</h2>
<ul class="formats">
<li><h3>Papel</h3><p>Edición impresa, a través de Amazon.</p></li>
<li><h3>Kindle</h3><p>Libro electrónico para tu Kindle o la app de Kindle.</p></li>
<li><h3>Google Play Libros</h3><p>Lee en la app Play Libros, en el móvil o en el navegador.</p></li>
</ul>
<p class="fineprint">Cada ficha de libro tiene botones directos a cada tienda: eliges el formato y compras allí.</p>`),
  ld: [orgLd, siteLd]
}));

// Catálogo
const categories = [...new Set(books.map((b) => b.category).filter(Boolean))];
out('catalogo/index.html', document_({
  path: '/catalogo/', order: 2, page: 'catalog',
  title: `Catálogo de libros — ${site.name}`,
  description: `Catálogo completo de ${site.name}: ${books.length} título${books.length === 1 ? '' : 's'} disponibles en papel, Kindle y Google Play Libros.`,
  left: leftPage('/catalogo/', defaultExtra),
  right: rightPage('/catalogo/', `
<p class="eyebrow">Capítulo II</p>
<h1>Catálogo</h1>
<p class="lead">Todos nuestros libros, con enlace directo a Amazon y Google Play Libros.</p>
${categories.length > 1 ? `<div class="chips js-only" data-filter-scope role="group" aria-label="Filtrar por categoría"><button type="button" class="chip" data-filter="all" aria-pressed="true">Todos</button>${categories.map((c) => `<button type="button" class="chip" data-filter="${esc(c)}" aria-pressed="false">${esc(c)}</button>`).join('')}</div>` : ''}
<ul class="grid">${books.map((b) => card(b, true)).join('')}</ul>
${upcomingBlock()}`),
  ld: [{ '@context': 'https://schema.org', '@type': 'CollectionPage', name: 'Catálogo', url: abs('/catalogo/'), isPartOf: { '@type': 'WebSite', name: site.name, url: site.url } }]
}));

// Fichas de libro
const stores = [
  { key: 'amazonPrint', kicker: 'Papel en', label: 'Amazon', format: 'https://schema.org/Paperback' },
  { key: 'amazonKindle', kicker: 'Kindle en', label: 'Amazon', format: 'https://schema.org/EBook' },
  { key: 'googlePlay', kicker: 'Ebook en', label: 'Google Play Libros', format: 'https://schema.org/EBook' }
];

for (const b of books) {
  const p = bookPath(b);
  const buttons = stores.map((s) => b[s.key]
    ? `<a class="btn" href="${esc(b[s.key])}" target="_blank" rel="noopener nofollow" aria-label="${s.kicker} ${s.label}: ${esc(b.title)} (se abre en una pestaña nueva)"><span class="btn-kicker">${s.kicker}</span><span class="btn-label">${s.label}</span></a>`
    : `<span class="btn is-disabled" aria-disabled="true"><span class="btn-kicker">Próximamente</span><span class="btn-label">${s.kicker} ${s.label}</span></span>`).join('');
  const meta = [
    ['Autor', b.author], ['Categoría', b.category], ['Idioma', b.language], ['Año', b.year], ['Páginas', b.pages], ['ISBN', b.isbn]
  ].filter(([, v]) => v).map(([k, v]) => `<dt>${k}</dt><dd>${esc(v)}</dd>`).join('');
  const desc = (b.description || '').replace(/\s+/g, ' ').trim();
  const metaDesc = desc ? (desc.length > 155 ? desc.slice(0, 152).replace(/\s+\S*$/, '') + '…' : desc) : `${b.title}, de ${b.author}. Cómpralo en papel, Kindle o Google Play Libros.`;
  const work = stores.filter((s) => b[s.key]).map((s) => ({ '@type': 'Book', bookFormat: s.format, url: b[s.key], isbn: undefined }));
  out(`libros/${b.slug}/index.html`, document_({
    path: p, order: folioOf(p) + 1, page: 'book',
    title: `${b.title}${b.subtitle ? ': ' + b.subtitle : ''} — ${b.author} | ${site.name}`,
    description: metaDesc,
    og: { type: 'book', image: b.cover },
    left: leftPage(p, cover(b, { cls: 'only-wide', decorative: true })),
    right: rightPage(p, `
<nav class="breadcrumb" aria-label="Migas de pan"><a href="/catalogo/">Catálogo</a> / <span>${esc(b.title)}</span></nav>
${cover(b, { cls: 'only-narrow' })}
${b.category ? `<p class="eyebrow">${esc(b.category)}</p>` : ''}
<h1>${esc(b.title)}</h1>
${b.subtitle ? `<p class="subtitle">${esc(b.subtitle)}</p>` : ''}
<p class="byline">${esc(b.author)}</p>
<h2>Comprar</h2>
<div class="buy">${buttons}</div>
<p class="fineprint">Los botones te llevan a la tienda, donde completas la compra.</p>
${rule}
<div class="prose" lang="${langCode(b.language)}">${paragraphs(b.description)}</div>
<dl class="meta">${meta}</dl>`),
    ld: [
      {
        '@context': 'https://schema.org', '@type': 'Book', name: b.title, alternativeHeadline: b.subtitle || undefined,
        author: { '@type': 'Person', name: b.author }, inLanguage: langCode(b.language), url: abs(p), description: desc || undefined,
        publisher: { '@type': 'Organization', name: site.name, url: site.url }, isbn: b.isbn || undefined,
        numberOfPages: b.pages || undefined, datePublished: b.year ? String(b.year) : undefined, genre: b.category || undefined,
        image: b.cover ? abs(b.cover) : undefined, workExample: work.length ? work : undefined
      },
      {
        '@context': 'https://schema.org', '@type': 'BreadcrumbList',
        itemListElement: [
          { '@type': 'ListItem', position: 1, name: 'Inicio', item: abs('/') },
          { '@type': 'ListItem', position: 2, name: 'Catálogo', item: abs('/catalogo/') },
          { '@type': 'ListItem', position: 3, name: b.title, item: abs(p) }
        ]
      }
    ]
  }));
}

// Próximas obras
if (upcoming.length) out('proximas-obras/index.html', document_({
  path: '/proximas-obras/', order: folioOf('/proximas-obras/') + 1, page: 'upcoming',
  title: `Próximas obras — ${site.name}`,
  description: `Próximas obras de ${site.name}: ${upcoming.map((u) => u.title + (u.subtitle ? ' (' + u.subtitle + ')' : '')).join('; ')}.`,
  left: leftPage('/proximas-obras/', defaultExtra),
  right: rightPage('/proximas-obras/', `
<p class="eyebrow">Capítulo ${chapter('/proximas-obras/')}</p>
<h1>Próximas obras</h1>
<p class="lead">Los libros que estamos preparando. Cuando se publiquen, los encontrarás en el catálogo con enlaces a Amazon y Google Play Libros.</p>
<ul class="grid">${upcoming.map(soonCard).join('')}</ul>
<p><a class="link-arrow" href="/catalogo/">Ver el catálogo →</a></p>`)
}));

// La editorial
out('sobre-nosotros/index.html', document_({
  path: '/sobre-nosotros/', order: folioOf('/sobre-nosotros/') + 1, page: 'about',
  title: `La editorial — ${site.name}`,
  description: `Conoce ${site.name}, editorial independiente de libros en español y portugués dirigida por ${site.editor}.`,
  left: leftPage('/sobre-nosotros/', defaultExtra),
  right: rightPage('/sobre-nosotros/', `
<p class="eyebrow">Capítulo ${chapter('/sobre-nosotros/')}</p>
<h1>La editorial</h1>
${site.about.map((t, i) => `<p${i === 0 ? ' class="dropcap lead"' : ''}>${esc(t)}</p>`).join('\n')}
${rule}
<p><strong>${esc(site.editor)}</strong><br><em>${esc(site.editorTitle)}</em></p>
<p><a class="link-arrow" href="/catalogo/">Explora el catálogo →</a></p>`),
  ld: [orgLd]
}));

// Contacto
out('contacto/index.html', document_({
  path: '/contacto/', order: folioOf('/contacto/') + 1, page: 'contact',
  title: `Contacto — ${site.name}`,
  description: `Escribe a ${site.name} para consultas sobre libros, prensa, distribución o colaboraciones.`,
  left: leftPage('/contacto/', defaultExtra),
  right: rightPage('/contacto/', `
<p class="eyebrow">Capítulo ${chapter('/contacto/')}</p>
<h1>Contacto</h1>
<p class="lead">${esc(site.contactIntro)}</p>
${rule}
<p><a class="btn cta" href="mailto:${esc(site.email)}"><span class="btn-kicker">Escríbenos a</span><span class="btn-label">${esc(site.email)}</span></a></p>`),
  ld: [{ '@context': 'https://schema.org', '@type': 'ContactPage', name: 'Contacto', url: abs('/contacto/') }]
}));

// 404
out('404.html', document_({
  path: '/404.html', order: 0, page: 'notfound',
  title: `Página no encontrada — ${site.name}`,
  description: 'La página que buscas no existe.',
  left: leftPage('', defaultExtra),
  right: rightPage('', `
<p class="eyebrow">Error 404</p>
<h1>Esta página no está en el libro</h1>
<p class="lead">Puede que el enlace sea antiguo o esté mal escrito.</p>
<p><a class="link-arrow" href="/">Volver al inicio →</a> &nbsp;·&nbsp; <a class="link-arrow" href="/catalogo/">Ver el catálogo →</a></p>`)
}));

/* ---------- archivos de apoyo ---------- */

out('favicon.svg', `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><rect width="64" height="64" rx="12" fill="#fff"/><path d="M14 8h18v40l-18-7z" fill="#00b4ff"/><path d="M32 8h18v33l-18 7z" fill="#0a2cff"/></svg>`);

out('robots.txt', `User-agent: *\nAllow: /\n\nSitemap: ${site.url}/sitemap.xml\n`);

const lastmod = today.toISOString().slice(0, 10);
out('sitemap.xml', `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${pages.map((p) => `  <url><loc>${site.url}${p.path}</loc><lastmod>${lastmod}</lastmod></url>`).join('\n')}\n</urlset>\n`);

out('_headers', `/*\n  X-Content-Type-Options: nosniff\n  Referrer-Policy: strict-origin-when-cross-origin\n  X-Frame-Options: SAMEORIGIN\n\n/assets/*\n  Cache-Control: public, max-age=31536000, immutable\n`);

// Logo de la marca (assets/brand → dist/brand)
const brandDir = path.join(root, 'assets/brand');
if (fs.existsSync(brandDir)) for (const f of fs.readdirSync(brandDir)) out(`brand/${f}`, fs.readFileSync(path.join(brandDir, f)));

// Portadas propias (assets/covers → dist/covers)
const coversDir = path.join(root, 'assets/covers');
if (fs.existsSync(coversDir)) {
  for (const f of fs.readdirSync(coversDir)) {
    if (/\.(jpe?g|png|webp|avif)$/i.test(f)) out(`covers/${f}`, fs.readFileSync(path.join(coversDir, f)));
  }
}

console.log(`✔ Sitio generado en dist/ — ${pages.length} páginas (${books.length} libros).`);
