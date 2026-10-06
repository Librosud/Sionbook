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

  /* ---- Hoja que se pasa: la esquina superior derecha se levanta y el doblez avanza en diagonal ----
     Geometría: la esquina C se arrastra hasta C' (hacia la izquierda, describiendo un arco). El doblez es la mediatriz de C-C'.
     - La parte plana (a un lado del doblez) sigue siendo la hoja que se va.
     - La parte doblada se refleja sobre el doblez y muestra el reverso (la hoja izquierda nueva).
     - Debajo va quedando a la vista la página nueva. */
  function clipPoly(poly, nx, ny, d) {
    // Recorta el polígono conservando los puntos con nx*x + ny*y >= d
    var out = [];
    for (var i = 0; i < poly.length; i++) {
      var a = poly[i], b = poly[(i + 1) % poly.length];
      var da = nx * a[0] + ny * a[1] - d, db = nx * b[0] + ny * b[1] - d;
      if (da >= 0) out.push(a);
      if ((da >= 0) !== (db >= 0)) { var t = da / (da - db); out.push([a[0] + t * (b[0] - a[0]), a[1] + t * (b[1] - a[1])]); }
    }
    return out;
  }
  function setPoly(el, poly, dx) {
    if (poly.length < 3) { el.style.visibility = 'hidden'; return; }
    var css = 'polygon(' + poly.map(function (p) { return (p[0] + dx).toFixed(1) + 'px ' + p[1].toFixed(1) + 'px'; }).join(',') + ')';
    el.style.visibility = 'visible';
    el.style.clipPath = css;
    el.style.webkitClipPath = css;
  }

  function makeCurl(frontHTML, flapHTML, W, H, X0) {
    var el = document.createElement('div');
    el.className = 'curl';
    el.setAttribute('aria-hidden', 'true');
    el.innerHTML =
      '<div class="curl-layer curl-under"><i class="curl-strip"></i></div>' +
      '<div class="curl-layer curl-front"><div class="curl-page paper paper--right"><div class="page-inner"></div></div><i class="curl-strip"></i></div>' +
      '<div class="curl-layer curl-flap"><div class="curl-page paper paper--left"><div class="page-inner"></div></div><i class="curl-strip"></i></div>';
    var under = el.querySelector('.curl-under'), front = el.querySelector('.curl-front'), flap = el.querySelector('.curl-flap');
    var fp = front.querySelector('.curl-page'), lp = flap.querySelector('.curl-page');
    fp.querySelector('.page-inner').innerHTML = frontHTML;
    lp.querySelector('.page-inner').innerHTML = flapHTML;
    fp.style.cssText = 'left:' + X0 + 'px;width:' + W + 'px;height:' + H + 'px';
    lp.style.cssText = 'left:0;width:' + W + 'px;height:' + H + 'px;transform-origin:0 0';
    var uS = under.querySelector('.curl-strip'), fS = front.querySelector('.curl-strip'), lS = flap.querySelector('.curl-strip');
    var L = 2 * (W + H), rect = [[0, 0], [W, 0], [W, H], [0, H]], amp = Math.min(W * 0.5, 380);

    function strip(node, x, y, deg) {
      node.style.height = L + 'px';
      node.style.transform = 'translate(' + x.toFixed(1) + 'px,' + y.toFixed(1) + 'px) rotate(' + deg.toFixed(2) + 'deg) translate(0,' + (-L / 2) + 'px)';
    }

    // s: 0 = hoja en su sitio, 1 = hoja completamente pasada
    function draw(s) {
      if (s <= 0.0005) { setPoly(front, rect, X0); setPoly(flap, [], 0); setPoly(under, [], 0); return; }
      if (s > 1) s = 1;
      var cx = W - 2 * W * s, cy = amp * Math.sin(Math.PI * s);       // posición de la esquina arrastrada
      var dx = cx - W, len = Math.sqrt(dx * dx + cy * cy), nx = dx / len, ny = cy / len;
      var px = (W + cx) / 2, py = cy / 2, d = px * nx + py * ny;         // punto medio y distancia del doblez
      var flat = clipPoly(rect, nx, ny, d), folded = clipPoly(rect, -nx, -ny, -d);
      var refl = folded.map(function (q) { var k = 2 * (q[0] * nx + q[1] * ny - d); return [q[0] - k * nx, q[1] - k * ny]; });
      refl = clipPoly(clipPoly(refl, 0, 1, 0), 0, -1, -H);
      setPoly(front, flat, X0); setPoly(under, folded, X0); setPoly(flap, refl, X0);
      // El reverso (hoja izquierda nueva) = espejo ∘ reflexión sobre el doblez = una transformación afín
      var m = [-(1 - 2 * nx * nx), 2 * nx * ny, -2 * nx * ny, 1 - 2 * ny * ny, W * (1 - 2 * nx * nx) + 2 * d * nx + X0, -2 * W * nx * ny + 2 * d * ny];
      lp.style.transform = 'matrix(' + m.map(function (v) { return v.toFixed(5); }).join(',') + ')';
      // Sombras a lo largo del doblez
      var deg = Math.atan2(ny, nx) * 180 / Math.PI;
      strip(fS, px + X0, py, deg);
      strip(uS, px + X0, py, deg + 180);
      strip(lS, px + X0, py, deg + 180);
    }
    return { el: el, draw: draw };
  }

  function runCurl(curl, forward, duration) {
    return new Promise(function (resolve) {
      var t0 = null, done = false;
      function end() { if (!done) { done = true; resolve(); } }
      function ease(t) { return t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2; }
      function frame(ts) {
        if (done) return;
        if (t0 === null) t0 = ts;
        var t = Math.min(1, (ts - t0) / duration);
        var e = ease(t);
        curl.draw(forward ? e : 1 - e);
        if (t < 1) requestAnimationFrame(frame); else end();
      }
      curl.draw(forward ? 0 : 1);
      requestAnimationFrame(frame);
      setTimeout(end, duration + 1500); // red de seguridad (pestaña en segundo plano)
    });
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

    var h0 = spread.offsetHeight;
    var oldRightHTML = inner(right()).innerHTML;
    var oldLeftHTML = inner(left()).innerHTML;
    var fwd = dir > 0, frontHTML, flapHTML, H;

    if (fwd) {
      // Hacia delante: la hoja derecha se levanta por la esquina y deja ver la nueva debajo
      fill(right(), newRight);
      H = Math.max(h0, spread.offsetHeight);
      frontHTML = oldRightHTML;
      flapHTML = newLeft.innerHTML;
    } else {
      // Hacia atrás: la hoja anterior vuelve desde la izquierda y cubre la actual
      fill(left(), newLeft);
      fill(right(), newRight);                       // solo para medir la altura de la página a la que se vuelve
      H = Math.max(h0, spread.offsetHeight);
      inner(right()).innerHTML = oldRightHTML;       // la hoja actual sigue debajo hasta que la otra la cubre
      frontHTML = newRight.innerHTML;
      flapHTML = oldLeftHTML;
    }
    spread.style.minHeight = H + 'px';

    var curl = makeCurl(frontHTML, flapHTML, right().offsetWidth, H, right().offsetLeft);
    spread.appendChild(curl.el);
    await runCurl(curl, fwd, phone.matches ? 1000 : 1150);

    if (fwd) fill(left(), newLeft); else fill(right(), newRight);
    curl.el.remove();
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
