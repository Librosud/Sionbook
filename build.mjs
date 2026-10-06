// Sion Book — generador del sitio estático (español en la raíz, português en /pt/).
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
const LANGS = ['es', 'pt'];

/* ---------- textos de la interfaz ---------- */

const T = {
  es: {
    locale: 'es_ES', skip: 'Saltar al contenido', publisher: 'Editorial', toc: 'Índice', tocAria: 'Índice del libro', turnAria: 'Pasar página',
    leftFoot: 'Los botones de compra te llevan a tiendas externas (Amazon y Google Play Libros).',
    mobileFoot: 'Los botones de compra te llevan a tiendas externas.',
    home: 'Inicio', catalog: 'Catálogo', upcoming: 'Próximas obras', about: 'La editorial', contact: 'Contacto', chapter: 'Capítulo',
    homeEyebrow: 'Editorial independiente · Español y português', news: 'Novedades', seeAll: 'Ver todo el catálogo →', howBuy: 'Cómo comprar',
    fPrint: ['Papel', 'Edición impresa, a través de Amazon.'], fKindle: ['Kindle', 'Libro electrónico para tu Kindle o la app de Kindle.'],
    fPlay: ['Google Play Libros', 'Lee en la app Play Libros, en el móvil o en el navegador.'],
    fine: 'Cada ficha de libro tiene botones directos a cada tienda: eliges el formato y compras allí.',
    catTitle: 'Catálogo de libros', catDesc: (n) => `Catálogo completo de ${site.name}: ${n} título${n === 1 ? '' : 's'} disponibles en papel, Kindle y Google Play Libros.`,
    catLead: 'Todos nuestros libros, con enlace directo a Amazon y Google Play Libros.', filterAria: 'Filtrar por categoría', all: 'Todos',
    crumbAria: 'Migas de pan', buy: 'Comprar', buyFine: 'Los botones te llevan a la tienda, donde completas la compra.',
    soon: 'Próximamente', coverOf: 'Portada de', newTab: 'se abre en una pestaña nueva',
    stores: { amazonPrint: 'Papel en', amazonKindle: 'Kindle en', googlePlay: 'Ebook en' }, playName: 'Google Play Libros',
    meta: { author: 'Autor', category: 'Categoría', language: 'Idioma', year: 'Año', pages: 'Páginas', isbn: 'ISBN' },
    bookFallback: (b) => `${b.title}, de ${b.author}. Cómpralo en papel, Kindle o Google Play Libros.`,
    upcLead: 'Los libros que estamos preparando. Cuando se publiquen, los encontrarás en el catálogo con enlaces a Amazon y Google Play Libros.',
    upcDesc: (list) => `Próximas obras de ${site.name}: ${list}.`, seeCatalog: 'Ver el catálogo →', exploreCat: 'Explora el catálogo →',
    aboutTitle: 'La editorial', aboutDesc: `Conoce ${site.name}, editorial independiente de libros en español y portugués dirigida por ${site.editor}.`,
    contactTitle: 'Contacto', contactDesc: `Escribe a ${site.name} para consultas sobre libros, prensa, distribución o colaboraciones.`, writeTo: 'Escríbenos a',
    langAria: 'Idioma de la web', switchTo: 'Leer en portugués',
    languages: { 'español': 'Español', 'portugués': 'Portugués', 'português': 'Portugués', 'english': 'Inglés', 'inglés': 'Inglés' }
  },
  pt: {
    locale: 'pt_BR', skip: 'Ir para o conteúdo', publisher: 'Editora', toc: 'Índice', tocAria: 'Índice do livro', turnAria: 'Passar a página',
    leftFoot: 'Os botões de compra levam você a lojas externas (Amazon e Google Play Livros).',
    mobileFoot: 'Os botões de compra levam você a lojas externas.',
    home: 'Início', catalog: 'Catálogo', upcoming: 'Próximas obras', about: 'A editora', contact: 'Contato', chapter: 'Capítulo',
    homeEyebrow: 'Editora independente · Espanhol e português', news: 'Novidades', seeAll: 'Ver todo o catálogo →', howBuy: 'Como comprar',
    fPrint: ['Papel', 'Edição impressa, pela Amazon.'], fKindle: ['Kindle', 'Livro eletrônico para o seu Kindle ou o app Kindle.'],
    fPlay: ['Google Play Livros', 'Leia no app Play Livros, no celular ou no navegador.'],
    fine: 'Cada ficha de livro tem botões diretos para cada loja: você escolhe o formato e compra lá.',
    catTitle: 'Catálogo de livros', catDesc: (n) => `Catálogo completo da ${site.name}: ${n} título${n === 1 ? '' : 's'} disponíve${n === 1 ? 'l' : 'is'} em papel, Kindle e Google Play Livros.`,
    catLead: 'Todos os nossos livros, com link direto para a Amazon e o Google Play Livros.', filterAria: 'Filtrar por categoria', all: 'Todos',
    crumbAria: 'Trilha de navegação', buy: 'Comprar', buyFine: 'Os botões levam você à loja, onde a compra é concluída.',
    soon: 'Em breve', coverOf: 'Capa de', newTab: 'abre em uma nova aba',
    stores: { amazonPrint: 'Papel na', amazonKindle: 'Kindle na', googlePlay: 'Ebook no' }, playName: 'Google Play Livros',
    meta: { author: 'Autor', category: 'Categoria', language: 'Idioma', year: 'Ano', pages: 'Páginas', isbn: 'ISBN' },
    bookFallback: (b) => `${b.title}, de ${b.author}. Compre em papel, Kindle ou Google Play Livros.`,
    upcLead: 'Os livros que estamos preparando. Quando forem publicados, você os encontrará no catálogo com links para a Amazon e o Google Play Livros.',
    upcDesc: (list) => `Próximas obras da ${site.name}: ${list}.`, seeCatalog: 'Ver o catálogo →', exploreCat: 'Explore o catálogo →',
    aboutTitle: 'A editora', aboutDesc: `Conheça a ${site.name}, editora independente de livros em espanhol e português dirigida por ${site.editor}.`,
    contactTitle: 'Contato', contactDesc: `Escreva para a ${site.name} para consultas sobre livros, imprensa, distribuição ou colaborações.`, writeTo: 'Escreva para',
    langAria: 'Idioma do site', switchTo: 'Ler em espanhol',
    languages: { 'español': 'Espanhol', 'portugués': 'Português', 'português': 'Português', 'english': 'Inglês', 'inglés': 'Inglês' }
  }
};

// Rutas de cada sección, por idioma (el español queda en la raíz)
const R = {
  es: { home: '/', catalog: '/catalogo/', upcoming: '/proximas-obras/', about: '/sobre-nosotros/', contact: '/contacto/', books: '/libros/' },
  pt: { home: '/pt/', catalog: '/pt/catalogo/', upcoming: '/pt/proximas-obras/', about: '/pt/sobre-nos/', contact: '/pt/contato/', books: '/pt/livros/' }
};
const routeOf = (lang, key) => (key.startsWith('book:') ? `${R[lang].books}${key.slice(5)}/` : R[lang][key]);
// Campo traducido: usa `campo_pt` si existe en portugués; si no, el original
const loc = (lang, obj, key) => (lang !== 'es' && obj[`${key}_${lang}`]) || obj[key];

/* ---------- utilidades ---------- */

const esc = (s = '') => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const paragraphs = (s = '') => s.split(/\n\s*\n/).map((p) => p.trim()).filter(Boolean).map((p) => `<p>${esc(p)}</p>`).join('\n');
const jsonLd = (obj) => `<script type="application/ld+json">${JSON.stringify(obj).replace(/</g, '\\u003c')}</script>`;
const abs = (p) => (/^https?:/.test(p) ? p : site.url + p);
const langCode = (l = '') => ({ 'español': 'es', 'portugués': 'pt', 'português': 'pt', 'english': 'en', 'inglés': 'en' }[l.toLowerCase()] || 'es');
const colorOf = (b) => (/^#[0-9a-f]{3,8}$/i.test(b.color || '') ? b.color : '#0a2a8a');

function out(rel, content) {
  const file = path.join(dist, rel);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, content);
}
// Escribe una página en su ruta ("/pt/catalogo/" → pt/catalogo/index.html)
const outPage = (route, html) => out(route.slice(1) + 'index.html', html);

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
  if (!b.description_pt) console.warn(`⚠ ${b.slug}: sin description_pt (la versión en portugués usará el texto en español).`);
}

for (const u of upcoming) {
  if (!u.title || !u.author) throw new Error(`Próxima obra "${u.title || '?'}": faltan título o autor.`);
}

/* ---------- piezas visuales (comunes) ---------- */

const logo = `<img src="/brand/logo.png" alt="Sion Book" width="838" height="402">`;
const coverMark = `<svg class="cover-mark" viewBox="0 0 64 44" fill="none" aria-hidden="true"><path d="M32 8C24 3 12 3 4 6v32c8-3 20-3 28 2zM32 8c8-5 20-5 28-2v32c-8-3-20-3-28 2zM32 8v32" stroke="currentColor" stroke-width="2.2" stroke-linejoin="round"/></svg>`;
const ornament = `<svg class="ornament" viewBox="0 0 200 120" fill="none" stroke="currentColor" stroke-width="1.5" aria-hidden="true"><path d="M100 14l16 46-16 46-16-46z"/><path d="M100 30l8 30-8 30-8-30z" fill="currentColor" opacity=".25"/><path d="M84 60C60 60 50 40 28 40M84 60C60 60 50 80 28 80M116 60c24 0 34-20 56-20M116 60c24 0 34 20 56 20"/><circle cx="22" cy="40" r="3"/><circle cx="22" cy="80" r="3"/><circle cx="178" cy="40" r="3"/><circle cx="178" cy="80" r="3"/></svg>`;
const rule = `<span class="rule" aria-hidden="true"><i></i></span>`;

/* ---------- recursos con hash ---------- */

fs.rmSync(dist, { recursive: true, force: true });
fs.mkdirSync(dist, { recursive: true });

const css = hashed('src/style.css', 'style', 'css');
const js = hashed('src/book.js', 'book', 'js');

/* ---------- documento completo ---------- */

function document_({ lang, path: p, order, page, title, description, left, right, og = {}, ld = [], alt = null }) {
  const canonical = abs(p === '/404.html' ? '/' : p);
  const image = og.image ? abs(og.image) : '';
  const other = LANGS.find((l) => l !== lang);
  const alternates = alt
    ? LANGS.map((l) => `<link rel="alternate" hreflang="${l}" href="${abs(alt[l])}">`).join('\n') + `\n<link rel="alternate" hreflang="x-default" href="${abs(alt.es)}">\n`
    : '';
  return `<!doctype html>
<html lang="${lang}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(title)}</title>
<meta name="description" content="${esc(description)}">
<link rel="canonical" href="${canonical}">
${alternates}<meta name="theme-color" content="#0a1f6b">
<meta property="og:site_name" content="${esc(site.name)}">
<meta property="og:locale" content="${T[lang].locale}">
${alt ? `<meta property="og:locale:alternate" content="${T[other].locale}">\n` : ''}<meta property="og:type" content="${og.type || 'website'}">
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
<a class="skip" href="#page-right">${T[lang].skip}</a>
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

/* ---------- construcción de un idioma ---------- */

function buildLang(lang) {
  const t = T[lang];
  const s = site[lang];
  const r = R[lang];
  const other = LANGS.find((l) => l !== lang);
  const bookPath = (b) => `${r.books}${b.slug}/`;
  const altOf = (key) => ({ es: routeOf('es', key), pt: routeOf('pt', key) });

  // Páginas en orden de lectura
  const pages = [
    { key: 'home', path: r.home, title: t.home },
    { key: 'catalog', path: r.catalog, title: t.catalog },
    ...books.map((b) => ({ key: `book:${b.slug}`, path: bookPath(b), title: b.title })),
    ...(upcoming.length ? [{ key: 'upcoming', path: r.upcoming, title: t.upcoming }] : []),
    { key: 'about', path: r.about, title: t.about },
    { key: 'contact', path: r.contact, title: t.contact }
  ];
  const folioOf = (p) => pages.findIndex((x) => x.path === p);
  const roman = ['I', 'II', 'III', 'IV', 'V', 'VI'];
  const chapterKeys = ['home', 'catalog', ...(upcoming.length ? ['upcoming'] : []), 'about', 'contact'];
  const chapter = (key) => roman[chapterKeys.indexOf(key)];

  const catOf = (b) => loc(lang, b, 'category');
  const langName = (l) => t.languages[(l || '').toLowerCase()] || l;

  function cover(b, { cls = '', decorative = false } = {}) {
    const title = b.title;
    const sub = loc(lang, b, 'subtitle');
    const c = `class="cover${cls ? ' ' + cls : ''}" style="--c:${colorOf(b)}"`;
    if (b.cover) {
      const altText = decorative ? '' : `${t.coverOf} ${esc(title)}`;
      return `<span ${c}${decorative ? ' aria-hidden="true"' : ''}><img src="${esc(b.cover)}" alt="${altText}" width="400" height="600" loading="lazy" decoding="async"></span>`;
    }
    const a11y = decorative ? 'aria-hidden="true"' : `role="img" aria-label="${t.coverOf} ${esc(title)}"`;
    return `<span ${c} ${a11y}><span class="cover-frame"><span><span class="cover-title">${esc(title)}</span>${sub ? `<span class="cover-sub" style="display:block">${esc(sub)}</span>` : ''}</span>${coverMark}<span class="cover-author">${esc(b.author)}</span></span></span>`;
  }

  function card(b, withCategory = false) {
    return `<li class="card"${withCategory ? ` data-category="${esc(catOf(b) || '')}"` : ''}>${cover(b, { decorative: true })}${catOf(b) ? `<p class="card-cat">${esc(catOf(b))}</p>` : ''}<h3 class="card-title"><a href="${bookPath(b)}">${esc(b.title)}</a></h3><p class="card-author">${esc(b.author)}</p></li>`;
  }

  function soonCard(b) {
    const sub = loc(lang, b, 'subtitle');
    const note = loc(lang, b, 'note');
    const when = loc(lang, b, 'when');
    return `<li class="card card--soon">${cover(b, { decorative: true })}<p class="card-cat">${t.soon}${when ? ' · ' + esc(when) : ''}</p><h3 class="card-title">${esc(b.title)}</h3>${sub ? `<p class="card-sub">${esc(sub)}</p>` : ''}${note ? `<p class="card-note">${esc(note)}</p>` : ''}<p class="card-author">${esc(b.author)}</p></li>`;
  }

  // Selector de idioma ES | PT (el idioma actual va resaltado)
  function langSwitch(key) {
    if (!key) return '';
    const item = (l) => (l === lang
      ? `<span class="lang-on" lang="${l}" aria-current="true">${l.toUpperCase()}</span>`
      : `<a href="${routeOf(l, key)}" lang="${l}" hreflang="${l}" data-no-flip aria-label="${t.switchTo}" title="${t.switchTo}">${l.toUpperCase()}</a>`);
    return `<div class="lang" role="group" aria-label="${t.langAria}">${LANGS.map(item).join('')}</div>`;
  }

  function leftPage(current, extra, key) {
    const main = [
      { path: r.home, label: t.home },
      { path: r.catalog, label: t.catalog, kids: true },
      ...(upcoming.length ? [{ path: r.upcoming, label: t.upcoming }] : []),
      { path: r.about, label: t.about },
      { path: r.contact, label: t.contact }
    ].map((it, i) => ({ ...it, num: roman[i] }));
    const li = main.map((it) => {
      const aria = current === it.path ? ' aria-current="page"' : it.kids && current.startsWith(r.books) ? ' aria-current="true"' : '';
      const kids = it.kids && books.length
        ? `<ol class="toc toc--sub">${books.slice(0, 8).map((b) => `<li><a href="${bookPath(b)}"${current === bookPath(b) ? ' aria-current="page"' : ''}><span class="toc-title">${esc(b.title)}</span><span class="toc-dots" aria-hidden="true"></span><span class="toc-page" aria-hidden="true">${folioOf(bookPath(b)) + 1}</span></a></li>`).join('')}</ol>`
        : '';
      return `<li><a href="${it.path}"${aria}><span class="toc-num" aria-hidden="true">${it.num}</span><span class="toc-title">${it.label}</span><span class="toc-dots" aria-hidden="true"></span><span class="toc-page" aria-hidden="true">${folioOf(it.path) + 1}</span></a>${kids}</li>`;
    }).join('');
    return `<header class="head"><a class="brand" href="${r.home}"${current === r.home ? ' aria-current="page"' : ''}>${logo}<span class="brand-sub">${t.publisher}</span></a>${langSwitch(key)}</header>
<nav aria-label="${t.tocAria}"><p class="toc-label" aria-hidden="true">${t.toc}</p><ol class="toc">${li}</ol></nav>
<div class="left-extra">${extra}</div>
<footer class="left-footer"><p>© ${year} Sion Book · ${esc(s.editorTitle)}: ${esc(site.editor)}</p><p>${t.leftFoot}</p></footer>`;
  }

  function rightPage(current, content) {
    const i = folioOf(current);
    let folio = '';
    if (i >= 0) {
      const prev = pages[i - 1];
      const next = pages[i + 1];
      folio = `<nav class="folio" aria-label="${t.turnAria}">${prev ? `<a class="prev" rel="prev" href="${prev.path}">← ${esc(prev.title)}</a>` : '<span></span>'}<span class="folio-num" aria-hidden="true">— ${i + 1} —</span>${next ? `<a class="next" rel="next" href="${next.path}">${esc(next.title)} →</a>` : '<span></span>'}</nav>`;
    }
    return `<div class="content">${content}</div>${folio}<p class="mobile-footer">© ${year} Sion Book · ${esc(s.editorTitle)}: ${esc(site.editor)}. ${t.mobileFoot}</p>`;
  }

  const defaultExtra = `<div style="text-align:center">${ornament}<p class="left-quote">${esc(s.tagline)}</p></div>`;
  const orgLd = { '@context': 'https://schema.org', '@type': 'Organization', name: site.name, url: site.url, description: s.description, founder: { '@type': 'Person', name: site.editor, jobTitle: s.editorTitle }, email: site.email };
  const siteLd = { '@context': 'https://schema.org', '@type': 'WebSite', name: site.name, url: site.url, inLanguage: lang };

  // Inicio
  outPage(r.home, document_({
    lang, path: r.home, order: 1, page: 'home', alt: altOf('home'),
    title: `${site.name} — ${s.tagline}`,
    description: s.description,
    left: leftPage(r.home, defaultExtra, 'home'),
    right: rightPage(r.home, `
<p class="eyebrow">${t.homeEyebrow}</p>
<h1>${esc(s.tagline)}</h1>
<p class="lead">${esc(s.description)}</p>
${rule}
<h2>${t.news}</h2>
<ul class="grid">${books.slice(0, 3).map((b) => card(b)).join('')}</ul>
<p><a class="link-arrow" href="${r.catalog}">${t.seeAll}</a></p>
${rule}
<h2>${t.howBuy}</h2>
<ul class="formats">
<li><h3>${t.fPrint[0]}</h3><p>${t.fPrint[1]}</p></li>
<li><h3>${t.fKindle[0]}</h3><p>${t.fKindle[1]}</p></li>
<li><h3>${t.fPlay[0]}</h3><p>${t.fPlay[1]}</p></li>
</ul>
<p class="fineprint">${t.fine}</p>`),
    ld: [orgLd, siteLd]
  }));

  // Catálogo
  const categories = [...new Set(books.map(catOf).filter(Boolean))];
  outPage(r.catalog, document_({
    lang, path: r.catalog, order: 2, page: 'catalog', alt: altOf('catalog'),
    title: `${t.catTitle} — ${site.name}`,
    description: t.catDesc(books.length),
    left: leftPage(r.catalog, defaultExtra, 'catalog'),
    right: rightPage(r.catalog, `
<p class="eyebrow">${t.chapter} ${chapter('catalog')}</p>
<h1>${t.catalog}</h1>
<p class="lead">${t.catLead}</p>
${categories.length > 1 ? `<div class="chips js-only" data-filter-scope role="group" aria-label="${t.filterAria}"><button type="button" class="chip" data-filter="all" aria-pressed="true">${t.all}</button>${categories.map((c) => `<button type="button" class="chip" data-filter="${esc(c)}" aria-pressed="false">${esc(c)}</button>`).join('')}</div>` : ''}
<ul class="grid">${books.map((b) => card(b, true)).join('')}</ul>`),
    ld: [{ '@context': 'https://schema.org', '@type': 'CollectionPage', name: t.catalog, url: abs(r.catalog), isPartOf: { '@type': 'WebSite', name: site.name, url: site.url } }]
  }));

  // Fichas de libro
  const stores = [
    { key: 'amazonPrint', label: 'Amazon', format: 'https://schema.org/Paperback' },
    { key: 'amazonKindle', label: 'Amazon', format: 'https://schema.org/EBook' },
    { key: 'googlePlay', label: t.playName, format: 'https://schema.org/EBook' }
  ];

  for (const b of books) {
    const p = bookPath(b);
    const key = `book:${b.slug}`;
    const sub = loc(lang, b, 'subtitle');
    const descRaw = loc(lang, b, 'description') || '';
    const descLang = lang !== 'es' && !b[`description_${lang}`] ? 'es' : lang;
    const buttons = stores.map((st) => {
      const kicker = t.stores[st.key];
      return b[st.key]
        ? `<a class="btn" href="${esc(b[st.key])}" target="_blank" rel="noopener nofollow" aria-label="${kicker} ${st.label}: ${esc(b.title)} (${t.newTab})"><span class="btn-kicker">${kicker}</span><span class="btn-label">${st.label}</span></a>`
        : `<span class="btn is-disabled" aria-disabled="true"><span class="btn-kicker">${t.soon}</span><span class="btn-label">${kicker} ${st.label}</span></span>`;
    }).join('');
    const meta = [
      [t.meta.author, b.author], [t.meta.category, catOf(b)], [t.meta.language, langName(b.language)], [t.meta.year, b.year], [t.meta.pages, b.pages], [t.meta.isbn, b.isbn]
    ].filter(([, v]) => v).map(([k, v]) => `<dt>${k}</dt><dd>${esc(v)}</dd>`).join('');
    const desc = descRaw.replace(/\s+/g, ' ').trim();
    const metaDesc = desc ? (desc.length > 155 ? desc.slice(0, 152).replace(/\s+\S*$/, '') + '…' : desc) : t.bookFallback(b);
    const work = stores.filter((st) => b[st.key]).map((st) => ({ '@type': 'Book', bookFormat: st.format, url: b[st.key], isbn: undefined }));
    outPage(p, document_({
      lang, path: p, order: folioOf(p) + 1, page: 'book', alt: altOf(key),
      title: `${b.title}${sub ? ': ' + sub : ''} — ${b.author} | ${site.name}`,
      description: metaDesc,
      og: { type: 'book', image: b.cover },
      left: leftPage(p, cover(b, { cls: 'only-wide', decorative: true }), key),
      right: rightPage(p, `
<nav class="breadcrumb" aria-label="${t.crumbAria}"><a href="${r.catalog}">${t.catalog}</a> / <span>${esc(b.title)}</span></nav>
${cover(b, { cls: 'only-narrow' })}
${catOf(b) ? `<p class="eyebrow">${esc(catOf(b))}</p>` : ''}
<h1>${esc(b.title)}</h1>
${sub ? `<p class="subtitle">${esc(sub)}</p>` : ''}
<p class="byline">${esc(b.author)}</p>
<h2>${t.buy}</h2>
<div class="buy">${buttons}</div>
<p class="fineprint">${t.buyFine}</p>
${rule}
<div class="prose" lang="${descLang}">${paragraphs(descRaw)}</div>
<dl class="meta">${meta}</dl>`),
      ld: [
        {
          '@context': 'https://schema.org', '@type': 'Book', name: b.title, alternativeHeadline: sub || undefined,
          author: { '@type': 'Person', name: b.author }, inLanguage: langCode(b.language), url: abs(p), description: desc || undefined,
          publisher: { '@type': 'Organization', name: site.name, url: site.url }, isbn: b.isbn || undefined,
          numberOfPages: b.pages || undefined, datePublished: b.year ? String(b.year) : undefined, genre: catOf(b) || undefined,
          image: b.cover ? abs(b.cover) : undefined, workExample: work.length ? work : undefined
        },
        {
          '@context': 'https://schema.org', '@type': 'BreadcrumbList',
          itemListElement: [
            { '@type': 'ListItem', position: 1, name: t.home, item: abs(r.home) },
            { '@type': 'ListItem', position: 2, name: t.catalog, item: abs(r.catalog) },
            { '@type': 'ListItem', position: 3, name: b.title, item: abs(p) }
          ]
        }
      ]
    }));
  }

  // Próximas obras
  if (upcoming.length) outPage(r.upcoming, document_({
    lang, path: r.upcoming, order: folioOf(r.upcoming) + 1, page: 'upcoming', alt: altOf('upcoming'),
    title: `${t.upcoming} — ${site.name}`,
    description: t.upcDesc(upcoming.map((u) => { const sub = loc(lang, u, 'subtitle'); return u.title + (sub ? ' (' + sub + ')' : ''); }).join('; ')),
    left: leftPage(r.upcoming, defaultExtra, 'upcoming'),
    right: rightPage(r.upcoming, `
<p class="eyebrow">${t.chapter} ${chapter('upcoming')}</p>
<h1>${t.upcoming}</h1>
<p class="lead">${t.upcLead}</p>
<ul class="grid">${upcoming.map(soonCard).join('')}</ul>
<p><a class="link-arrow" href="${r.catalog}">${t.seeCatalog}</a></p>`)
  }));

  // La editorial
  outPage(r.about, document_({
    lang, path: r.about, order: folioOf(r.about) + 1, page: 'about', alt: altOf('about'),
    title: `${t.aboutTitle} — ${site.name}`,
    description: t.aboutDesc,
    left: leftPage(r.about, defaultExtra, 'about'),
    right: rightPage(r.about, `
<p class="eyebrow">${t.chapter} ${chapter('about')}</p>
<h1>${t.aboutTitle}</h1>
${s.about.map((x, i) => `<p${i === 0 ? ' class="dropcap lead"' : ''}>${esc(x)}</p>`).join('\n')}
${rule}
<p><strong>${esc(site.editor)}</strong><br><em>${esc(s.editorTitle)}</em></p>
<p><a class="link-arrow" href="${r.catalog}">${t.exploreCat}</a></p>`),
    ld: [orgLd]
  }));

  // Contacto
  outPage(r.contact, document_({
    lang, path: r.contact, order: folioOf(r.contact) + 1, page: 'contact', alt: altOf('contact'),
    title: `${t.contactTitle} — ${site.name}`,
    description: t.contactDesc,
    left: leftPage(r.contact, defaultExtra, 'contact'),
    right: rightPage(r.contact, `
<p class="eyebrow">${t.chapter} ${chapter('contact')}</p>
<h1>${t.contactTitle}</h1>
<p class="lead">${esc(s.contactIntro)}</p>
${rule}
<p><a class="btn cta" href="mailto:${esc(site.email)}"><span class="btn-kicker">${t.writeTo}</span><span class="btn-label">${esc(site.email)}</span></a></p>`),
    ld: [{ '@context': 'https://schema.org', '@type': 'ContactPage', name: t.contactTitle, url: abs(r.contact) }]
  }));

  return pages;
}

const built = Object.fromEntries(LANGS.map((l) => [l, buildLang(l)]));

// 404 (bilingüe: Vercel sirve el mismo archivo para cualquier ruta inexistente)
{
  const t = T.es, tp = T.pt;
  const left = `<header class="head"><a class="brand" href="/">${logo}<span class="brand-sub">${t.publisher}</span></a></header>
<div class="left-extra"><div style="text-align:center">${ornament}<p class="left-quote">${esc(site.es.tagline)}<br>${esc(site.pt.tagline)}</p></div></div>`;
  out('404.html', document_({
    lang: 'es', path: '/404.html', order: 0, page: 'notfound',
    title: `Página no encontrada · Página não encontrada — ${site.name}`,
    description: 'La página que buscas no existe. · A página que você procura não existe.',
    left,
    right: `<div class="content">
<p class="eyebrow">Error 404</p>
<h1>Esta página no está en el libro</h1>
<p class="lead">Puede que el enlace sea antiguo o esté mal escrito.</p>
<p><a class="link-arrow" href="/">Volver al inicio →</a> &nbsp;·&nbsp; <a class="link-arrow" href="/catalogo/">Ver el catálogo →</a></p>
${rule}
<h2 lang="pt">Esta página não está no livro</h2>
<p lang="pt">O link pode ser antigo ou estar escrito errado.</p>
<p lang="pt"><a class="link-arrow" href="/pt/">Voltar ao início →</a> &nbsp;·&nbsp; <a class="link-arrow" href="/pt/catalogo/">Ver o catálogo →</a></p>
</div>`
  }));
}

/* ---------- archivos de apoyo ---------- */

out('favicon.svg', `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><rect width="64" height="64" rx="12" fill="#fff"/><path d="M14 8h18v40l-18-7z" fill="#00b4ff"/><path d="M32 8h18v33l-18 7z" fill="#0a2cff"/></svg>`);

out('robots.txt', `User-agent: *\nAllow: /\n\nSitemap: ${site.url}/sitemap.xml\n`);

// Sitemap con alternativas de idioma (hreflang)
const lastmod = today.toISOString().slice(0, 10);
const keys = built.es.map((p) => p.key);
const sitemapUrl = (lang, key) => {
  const alts = LANGS.map((l) => `<xhtml:link rel="alternate" hreflang="${l}" href="${site.url}${routeOf(l, key)}"/>`).join('') + `<xhtml:link rel="alternate" hreflang="x-default" href="${site.url}${routeOf('es', key)}"/>`;
  return `  <url><loc>${site.url}${routeOf(lang, key)}</loc><lastmod>${lastmod}</lastmod>${alts}</url>`;
};
out('sitemap.xml', `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">\n${LANGS.flatMap((l) => keys.map((k) => sitemapUrl(l, k))).join('\n')}\n</urlset>\n`);

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

console.log(`✔ Sitio generado en dist/ — ${built.es.length} páginas × ${LANGS.length} idiomas (${books.length} libros).`);
