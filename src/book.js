/* Sion Book — el efecto de pasar página es solo una transición visual.
   Sin JavaScript (o si algo falla) cada enlace es un enlace normal a su propia URL. */
(function () {
  'use strict';

  /* ---- Filtro del catálogo (mejora progresiva) ---- */
  document.addEventListener('click', function (e) {
    var btn = e.target.closest && e.target.closest('[data-filter]');
    if (!btn) return;
    var scope = btn.closest('[data-filter-scope]') || document;
    var value = btn.getAttribute('data-filter');
    scope.querySelectorAll('[data-filter]').forEach(function (b) {
      b.setAttribute('aria-pressed', String(b === btn));
    });
    document.querySelectorAll('[data-category]').forEach(function (card) {
      card.hidden = value !== 'all' && card.getAttribute('data-category') !== value;
    });
  });

  /* ---- Pasar página ---- */
  var spread = document.getElementById('spread');
  if (!spread || !window.fetch || !window.DOMParser || !('animate' in Element.prototype)) return;

  var reduce = window.matchMedia('(prefers-reduced-motion: reduce)');
  var wide = window.matchMedia('(min-width: 900px)');
  var cache = new Map();
  var busy = false;
  var DURATION = 950;
  var EASE = 'cubic-bezier(.55,.05,.3,1)';

  function left() { return document.getElementById('page-left'); }
  function right() { return document.getElementById('page-right'); }
  function inner(page) { return page.querySelector('.page-inner'); }
  function order() { return Number(document.body.getAttribute('data-order')) || 0; }
  function sleep(ms) { return new Promise(function (r) { setTimeout(r, ms); }); }

  /* ---- Móvil: libro abierto con una sola hoja a la vista ---- */
  var phone = window.matchMedia('(max-width: 899.98px)');
  function indexOpen() { return spread.classList.contains('show-index'); }
  function showBook() {
    // Llevar el libro entero (con su marco) a la vista
    var bookTop = (spread.closest('.book') || spread).getBoundingClientRect().top;
    if (bookTop < 16) window.scrollTo({ top: Math.max(0, window.scrollY + bookTop - 16), behavior: 'instant' });
  }
  function applyMode() {
    // En móvil la hoja que no se ve no debe recibir foco ni lectores de pantalla (inert)
    var open = phone.matches && indexOpen();
    left().inert = phone.matches && !open;
    right().inert = phone.matches && open;
    if (!phone.matches) spread.classList.remove('show-index');
    var rb = document.querySelector('.ribbon-btn');
    if (rb) rb.setAttribute('aria-expanded', String(open));
  }
  function setIndex(open) {
    if (!phone.matches) open = false;
    spread.classList.toggle('show-index', open);
    applyMode();
    if (open) {
      showBook();
      var first = left().querySelector('nav a');
      if (first) first.focus({ preventScroll: true });
    }
  }

  function load(href) {
    var key = new URL(href, location.href);
    key.hash = '';
    key = key.href;
    if (!cache.has(key)) {
      cache.set(key, fetch(key, { credentials: 'same-origin' })
        .then(function (r) {
          var type = r.headers.get('content-type') || '';
          if (!r.ok || type.indexOf('text/html') === -1) throw new Error('bad response');
          return r.text();
        })
        .then(function (text) {
          var doc = new DOMParser().parseFromString(text, 'text/html');
          if (!doc.getElementById('page-left') || !doc.getElementById('page-right')) throw new Error('no pages');
          return doc;
        })
        .catch(function () { cache.delete(key); return null; }));
    }
    return cache.get(key);
  }

  function isInternal(a) {
    if (a.origin !== location.origin) return false;
    if (a.target && a.target !== '_self') return false;
    if (a.hasAttribute('download') || a.hasAttribute('data-no-flip')) return false;
    if (/\.[a-z0-9]{2,5}$/i.test(a.pathname)) return false;
    if (a.pathname === location.pathname && a.hash) return false; // ancla dentro de la misma página
    return true;
  }

  function fill(page, sourceInner) {
    var target = inner(page);
    var copy = document.importNode(sourceInner, true);
    target.replaceChildren.apply(target, Array.prototype.slice.call(copy.childNodes));
  }

  function syncHead(doc) {
    document.title = doc.title;
    document.body.setAttribute('data-page', doc.body.getAttribute('data-page') || '');
    document.body.setAttribute('data-order', doc.body.getAttribute('data-order') || '0');
    ['meta[name="description"]', 'link[rel="canonical"]'].forEach(function (sel) {
      var from = doc.head.querySelector(sel);
      var to = document.head.querySelector(sel);
      if (from && to) {
        var attr = from.hasAttribute('content') ? 'content' : 'href';
        to.setAttribute(attr, from.getAttribute(attr));
      }
    });
  }

  function makeFace(kind, html) {
    var face = document.createElement('div');
    face.className = 'face face--' + kind + ' paper ' + (kind === 'front' ? 'paper--right' : 'paper--left');
    var box = document.createElement('div');
    box.className = 'page-inner';
    box.innerHTML = html;
    face.appendChild(box);
    var shade = document.createElement('i');
    shade.className = 'shade';
    face.appendChild(shade);
    return face;
  }

  function makeLeaf(frontHTML, backHTML, height) {
    var leaf = document.createElement('div');
    leaf.className = 'leaf';
    leaf.setAttribute('aria-hidden', 'true');
    leaf.style.height = height + 'px';
    leaf.appendChild(makeFace('front', frontHTML));
    leaf.appendChild(makeFace('back', backHTML));
    return leaf;
  }

  function finish(url, doc, push) {
    if (push) history.pushState({}, '', url.pathname + url.search + url.hash);
    syncHead(doc);
    var main = right();
    var hash = url.hash && document.getElementById(decodeURIComponent(url.hash.slice(1)));
    if (hash) hash.scrollIntoView(); else main.focus({ preventScroll: true });
    var note = document.getElementById('announcer');
    if (note) note.textContent = doc.title;
    applyMode();
    document.dispatchEvent(new CustomEvent('sionbook:pageview', { detail: { url: url.href, title: doc.title } }));
    busy = false;
  }

  async function go(href, push) {
    if (busy) return;
    busy = true;
    var doc = await load(href);
    if (!doc) { location.href = href; return; }

    var url = new URL(href, location.href);
    var newOrder = Number(doc.body.getAttribute('data-order')) || 0;
    var dir = newOrder < order() ? -1 : 1;
    var newLeft = inner(doc.getElementById('page-left'));
    var newRight = inner(doc.getElementById('page-right'));

    // Si el índice estaba abierto (móvil), primero se vuelve a la hoja derecha
    if (indexOpen()) { setIndex(false); if (!reduce.matches) await sleep(380); }

    // Llevar el libro a la vista antes de pasar la hoja
    // (se alinea el libro entero, con su marco, no solo la hoja)
    showBook();

    if (reduce.matches) {
      fill(left(), newLeft);
      fill(right(), newRight);
      finish(url, doc, push);
      return;
    }

    var twoPages = true; // también en móvil: el libro siempre es una doble página (solo se ve una hoja)
    var h0 = spread.offsetHeight;
    var oldRightHTML = inner(right()).innerHTML;
    var oldLeftHTML = inner(left()).innerHTML;
    var leaf, front, back, turn, finalStep;

    if (dir > 0 || !twoPages) {
      // Hacia delante: la hoja de la derecha se vuelve sobre la izquierda
      fill(right(), newRight);
      if (!twoPages) fill(left(), newLeft);
      var h1 = spread.offsetHeight;
      var H = Math.max(h0, h1);
      spread.style.minHeight = H + 'px';
      leaf = makeLeaf(oldRightHTML, twoPages ? newLeft.innerHTML : '', H);
      spread.appendChild(leaf);
      turn = twoPages ? [0, -180] : [0, -100];
      finalStep = function () { if (twoPages) fill(left(), newLeft); };
    } else {
      // Hacia atrás: la hoja vuelve de la izquierda a la derecha
      fill(left(), newLeft);
      var h2 = spread.offsetHeight;
      var Hb = Math.max(h0, h2);
      spread.style.minHeight = Hb + 'px';
      leaf = makeLeaf(newRight.innerHTML, oldLeftHTML, Hb);
      spread.appendChild(leaf);
      turn = [-180, 0];
      finalStep = function () { fill(right(), newRight); };
    }

    front = leaf.querySelector('.face--front .shade');
    back = leaf.querySelector('.face--back .shade');
    var opts = { duration: DURATION, easing: EASE, fill: 'forwards' };
    var forward = turn[0] === 0;
    var anims = [
      leaf.animate([
        { transform: 'translateZ(1px) rotateY(' + turn[0] + 'deg)' },
        { transform: 'translateZ(1px) rotateY(' + turn[1] + 'deg)' }
      ], opts)
    ];
    if (!twoPages) {
      anims.push(leaf.animate([{ opacity: 1 }, { opacity: 1, offset: .6 }, { opacity: 0 }], opts));
    }
    anims.push(front.animate(forward
      ? [{ opacity: 0 }, { opacity: .55, offset: .5 }, { opacity: .55 }]
      : [{ opacity: .55 }, { opacity: .55, offset: .5 }, { opacity: 0 }], opts));
    anims.push(back.animate(forward
      ? [{ opacity: .55 }, { opacity: .55, offset: .5 }, { opacity: 0 }]
      : [{ opacity: 0 }, { opacity: .55, offset: .5 }, { opacity: .55 }], opts));

    try {
      await Promise.all(anims.map(function (a) { return a.finished; }));
    } catch (err) { /* animación cancelada: seguimos igualmente */ }

    finalStep();
    leaf.remove();
    spread.style.minHeight = '';
    finish(url, doc, push);
  }

  /* ---- Enlaces ---- */
  document.addEventListener('click', function (e) {
    if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    var a = e.target.closest && e.target.closest('a[href]');
    if (!a || !isInternal(a)) return;
    e.preventDefault();
    if (a.pathname === location.pathname && a.search === location.search) { if (indexOpen()) setIndex(false); return; }
    go(a.href, true);
  });

  // Tocar el borde de la otra hoja, o la cinta, abre/cierra el índice
  document.addEventListener('click', function (e) {
    if (!phone.matches || busy) return;
    if (e.target.closest && e.target.closest('.ribbon-btn')) { setIndex(!indexOpen()); return; }
    if (!e.target.closest || !e.target.closest('.book')) return;
    if (!indexOpen() && e.clientX < left().getBoundingClientRect().right) { e.preventDefault(); setIndex(true); }
    else if (indexOpen() && e.clientX >= right().getBoundingClientRect().left) { e.preventDefault(); setIndex(false); }
  });

  // Deslizar el dedo: izquierda = hoja siguiente, derecha = anterior; desde el borde izquierdo = índice
  var sx = null, sy = 0;
  document.addEventListener('touchstart', function (e) {
    var ok = phone.matches && !busy && e.touches.length === 1 && e.target.closest && e.target.closest('.book');
    if (!ok) { sx = null; return; }
    sx = e.touches[0].clientX; sy = e.touches[0].clientY;
  }, { passive: true });
  document.addEventListener('touchend', function (e) {
    if (sx === null) return;
    var t = e.changedTouches[0], dx = t.clientX - sx, dy = t.clientY - sy, x0 = sx;
    sx = null;
    if (Math.abs(dx) < 70 || Math.abs(dy) > Math.abs(dx) / 1.8) return;
    if (indexOpen()) { if (dx < 0) setIndex(false); return; }
    var link = document.querySelector(dx > 0 ? 'a[rel="prev"]' : 'a[rel="next"]');
    if (dx > 0 && (x0 < 44 || !link)) setIndex(true);
    else if (link) go(link.href, true);
  }, { passive: true });

  phone.addEventListener ? phone.addEventListener('change', applyMode) : phone.addListener(applyMode);
  applyMode();

  function warm(e) {
    var a = e.target.closest && e.target.closest('a[href]');
    if (a && isInternal(a) && a.pathname !== location.pathname) load(a.href);
  }
  document.addEventListener('pointerover', warm, { passive: true });
  document.addEventListener('focusin', warm);
  document.addEventListener('touchstart', warm, { passive: true });

  var currentPath = location.pathname;
  window.addEventListener('popstate', function () {
    if (location.pathname === currentPath) return; // solo cambió el ancla
    if (busy) { location.reload(); return; }
    go(location.href, false);
  });
  // Mantener currentPath al día
  document.addEventListener('sionbook:pageview', function () { currentPath = location.pathname; });
})();
