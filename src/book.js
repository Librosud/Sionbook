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

    // Llevar el libro a la vista antes de pasar la hoja
    var top = spread.getBoundingClientRect().top;
    if (top < 0) window.scrollTo({ top: window.scrollY + top - 12, behavior: 'instant' });

    if (reduce.matches) {
      fill(left(), newLeft);
      fill(right(), newRight);
      finish(url, doc, push);
      return;
    }

    var twoPages = wide.matches;
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
    if (a.pathname === location.pathname && a.search === location.search) return;
    go(a.href, true);
  });

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
