/* ══════════════════════════════════════════════════════════════════════════
   Valter Kittler — portfolio behaviour
   No dependencies: this has to keep working from a USB stick, a static host
   or a file:// double-click, five years from now.
   ══════════════════════════════════════════════════════════════════════ */
(function () {
  'use strict';

  var root  = document.documentElement;
  var $     = function (s, c) { return (c || document).querySelector(s); };
  var $$    = function (s, c) { return Array.prototype.slice.call((c || document).querySelectorAll(s)); };
  var WORKS = window.WORKS || {};
  var I18N  = window.I18N || {};

  var reduced = window.matchMedia('(prefers-reduced-motion: reduce)');


  /* Touch devices have no hover, so the enlarge-a-screen gesture is a tap. */
  var coarse = window.matchMedia('(hover: none)');

  /* ────────────────────────────────────────────────────── language ── */
  var lang = root.dataset.lang === 'pt' ? 'pt' : 'en';

  function t(key) {
    var dict = I18N[lang] || I18N.en || {};
    return dict[key] !== undefined ? dict[key] : (I18N.en ? I18N.en[key] : '') || '';
  }

  function translateIn(scope) {
    $$('[data-i18n]', scope).forEach(function (el) {
      var v = t(el.dataset.i18n);
      if (v) el.textContent = v;
    });
    $$('[data-i18n-html]', scope).forEach(function (el) {
      var v = t(el.dataset.i18nHtml);
      if (v) el.innerHTML = v;
    });
  }

  function applyLang() {
    root.lang = lang === 'pt' ? 'pt-BR' : 'en';
    root.dataset.lang = lang;
    translateIn(document);
    $$('.lang-switch button').forEach(function (b) {
      b.setAttribute('aria-pressed', String(b.dataset.lang === lang));
    });
    syncThemeLabel();
    buildMarquee();
    renderAll();
    if (lb.open) paintLightbox();
  }

  $$('.lang-switch button').forEach(function (b) {
    b.addEventListener('click', function () {
      if (b.dataset.lang === lang) return;
      lang = b.dataset.lang;
      try { localStorage.setItem('vk-lang', lang); } catch (e) {}
      applyLang();
    });
  });

  /* ───────────────────────────────────────────────────────── theme ── */
  var themeBtn = $('#themeToggle');

  function syncThemeLabel() {
    var dark = root.dataset.theme === 'dark';
    var label = t(dark ? 'theme.toLight' : 'theme.toDark');
    themeBtn.setAttribute('aria-pressed', String(dark));
    $('.visually-hidden', themeBtn).textContent = label;
    themeBtn.setAttribute('title', label);
    var meta = $('meta[name="theme-color"]');
    if (meta) meta.setAttribute('content', dark ? '#0C0B0A' : '#F4F2EE');
  }

  themeBtn.addEventListener('click', function () {
    var next = root.dataset.theme === 'dark' ? 'light' : 'dark';
    root.dataset.theme = next;
    try { localStorage.setItem('vk-theme', next); } catch (e) {}
    syncThemeLabel();
  });

  /* ─────────────────────────────────────────────────────────── nav ── */
  var nav = $('#nav');
  var burger = $('#navBurger');

  burger.addEventListener('click', function () {
    var open = nav.classList.toggle('is-open');
    burger.setAttribute('aria-expanded', String(open));
  });
  $$('.nav-links a').forEach(function (a) {
    a.addEventListener('click', function () {
      nav.classList.remove('is-open');
      burger.setAttribute('aria-expanded', 'false');
    });
  });

  var navLinks = $$('.nav-links a');
  var sections = navLinks
    .map(function (a) { return document.getElementById(a.getAttribute('href').slice(1)); })
    .filter(Boolean);

  function markCurrent() {
    var best = null, bestTop = -Infinity;
    sections.forEach(function (s) {
      var top = s.getBoundingClientRect().top - 140;
      if (top <= 0 && top > bestTop) { bestTop = top; best = s; }
    });
    navLinks.forEach(function (a) {
      a.classList.toggle('is-current', !!best && a.getAttribute('href') === '#' + best.id);
    });
  }

  /* ───────────────────────────────────────────── scroll behaviours ── */
  var bar = $('.scroll-progress i');
  var portrait = $('.hero-portrait');
  var ticking = false;

  function onScroll() {
    var y = window.scrollY || window.pageYOffset;
    nav.classList.toggle('is-stuck', y > 24);

    var max = document.documentElement.scrollHeight - window.innerHeight;
    bar.style.transform = 'scaleX(' + (max > 0 ? Math.min(y / max, 1) : 0) + ')';

    if (portrait && !reduced.matches && y < window.innerHeight * 1.3) {
      portrait.style.transform = 'translate3d(0,' + (y * -0.055).toFixed(2) + 'px,0)';
    }
    markCurrent();
    ticking = false;
  }

  var lastSweep = 0;
  window.addEventListener('scroll', function () {
    /* Reveals and the strip scrub run straight off the scroll event, never
       behind rAF: the boards section IS the scrub, so it must not stall. */
    scrubStrips();
    scrubHStrips();
    var now = Date.now();
    if (now - lastSweep > 110) { lastSweep = now; sweep(); sweepCounters(); }
    if (!ticking) { ticking = true; window.requestAnimationFrame(onScroll); }
  }, { passive: true });

  /* ───────────────────────────────────────────── reveal on scroll ── */
  /* Deliberately not IntersectionObserver. An observer that is throttled or
     never fires leaves the whole page at opacity 0, and a portfolio that can
     render blank is worse than one without animation. A plain measured sweep
     off the scroll event always runs, and each element is checked only until
     it has been revealed. */
  var pending = [];

  function observe(els) {
    els.forEach(function (el) { if (!el.classList.contains('is-in')) pending.push(el); });
    sweep();
  }

  function sweep() {
    if (!pending.length) return;
    var limit = window.innerHeight * 0.94;
    var still = [];
    for (var i = 0; i < pending.length; i++) {
      var el = pending[i];
      if (el.getBoundingClientRect().top < limit) {
        el.classList.add('is-in');
        /* Deferred until now so two videos don't download on first paint. */
        var v = el.querySelector && el.querySelector('video');
        if (v && !reduced.matches) { var p = v.play(); if (p) p.catch(function () {}); }
      } else still.push(el);
    }
    pending = still;
  }

  /* ──────────────────────────────────────────────────── counters ── */
  function runCounter(el) {
    var target = parseFloat(el.dataset.count);
    var div = parseFloat(el.dataset.div || '1');
    if (el.dataset.plain || reduced.matches) {
      el.textContent = fmt(target / div, div);
      return;
    }
    var start = performance.now(), dur = 1100;
    (function step(now) {
      var p = Math.min(Math.max((now - start) / dur, 0), 1);
      var eased = 1 - Math.pow(1 - p, 3);
      el.textContent = fmt((target * eased) / div, div);
      if (p < 1) requestAnimationFrame(step);
    })(start);
    /* If frames are starved the count must still land on the real number. */
    setTimeout(function () { el.textContent = fmt(target / div, div); }, dur + 500);
  }

  function fmt(n, div) {
    return div > 1 ? n.toFixed(1).replace('.', lang === 'pt' ? ',' : '.') : String(Math.round(n));
  }

  var counters = [];
  function initCounters() { counters = $$('.num[data-count]'); sweepCounters(); }
  function sweepCounters() {
    if (!counters.length) return;
    var limit = window.innerHeight * 0.9;
    counters = counters.filter(function (el) {
      if (el.getBoundingClientRect().top >= limit) return true;
      runCounter(el);
      return false;
    });
  }

  /* ──────────────────────────────────────────────────── marquee ── */
  var marqueeTrack = $('.marquee-track');
  var marqueeSeed  = $('[data-marquee]').cloneNode(true);

  function buildMarquee() {
    if (!marqueeTrack) return;
    marqueeTrack.innerHTML = '';
    var first = marqueeSeed.cloneNode(true);
    marqueeTrack.appendChild(first);
    /* Translate is -50%, so the track needs an even number of identical sets
       and must be at least twice the viewport wide to loop without a gap. */
    var setW = first.getBoundingClientRect().width || 800;
    var copies = Math.max(2, Math.ceil((window.innerWidth * 2) / setW));
    if (copies % 2) copies += 1;
    for (var i = 1; i < copies; i++) marqueeTrack.appendChild(marqueeSeed.cloneNode(true));
    marqueeTrack.style.animationDuration = Math.round((setW * copies) / 90) + 's';
    translateIn(marqueeTrack);   // the seed was cloned before translation
  }

  /* ────────────────────────────────────────────────── media pieces ── */
  function caption(item) { return item[lang] || item.en || ''; }

  function mediaFor(item, eager) {
    if (item.video) {
      /* Behaves like the GIF it replaces — silent, looping, inline — but
         carries the full gradient instead of 256 quantised colours. */
      var v = document.createElement('video');
      v.src = 'assets/' + item.src;
      v.width = item.w; v.height = item.h;
      v.loop = true; v.muted = true; v.playsInline = true;
      v.setAttribute('muted', '');          // Safari reads the attribute
      v.setAttribute('playsinline', '');
      v.preload = 'metadata';               // played once it scrolls into view
      v.setAttribute('aria-label', caption(item));
      return v;
    }
    var img = document.createElement('img');
    img.src = 'assets/' + item.src;
    img.width = item.w; img.height = item.h;
    img.alt = caption(item);
    img.decoding = 'async';
    /* The first row of every group is fetched immediately; a portfolio that
       shows empty boxes while you scroll reads as broken. */
    if (!eager) img.loading = 'lazy';
    return img;
  }

  function pieceButton(item, i, key, cls, onClick) {
    var btn = document.createElement('button');
    btn.type = 'button';
    btn.className = cls;
    btn.style.setProperty('--i', String(i % 10));
    btn.setAttribute('aria-label', caption(item));
    btn.appendChild(mediaFor(item, i < 4));
    btn.addEventListener('click', onClick || function () { openLightbox(key, i); });
    return btn;
  }

  /* ────────────────────────────────────────────────────────── sets ── */
  /* Every piece in a collection is on the page, so a row renders all of them
     and the viewer walks exactly what you can already see. */
  function tileChrome(btn, item) {
    if (item.anim) btn.classList.add('tile--anim');
    var zoom = document.createElement('span');
    zoom.className = 'tile-zoom';
    zoom.setAttribute('aria-hidden', 'true');
    zoom.innerHTML = '<svg viewBox="0 0 24 24"><path d="M11 4a7 7 0 1 1 0 14 7 7 0 0 1 0-14ZM20 20l-4-4M11 8v6M8 11h6"/></svg>';
    btn.appendChild(zoom);
    var cap = document.createElement('span');
    cap.className = 'tile-cap';
    cap.textContent = caption(item);
    btn.appendChild(cap);
  }

  function renderSet(el) {
    var key = el.dataset.set;
    var items = WORKS[key] || [];

    el.innerHTML = '';
    items.forEach(function (item, i) {
      var btn = pieceButton(item, i, key, 'tile', function () {
        openLightbox(key, i);
      });
      tileChrome(btn, item);
      el.appendChild(btn);
    });
    observe($$('.tile', el));
  }

  /* ────────────────────────────────────────────────────── cutouts ── */
  /* Transparent artwork, shown with no frame at all — the whole point is that
     these came out of the deck with their backgrounds already gone. */
  function renderCutouts(el) {
    var key = el.dataset.cutouts;
    var items = WORKS[key] || [];
    var limit = parseInt(el.dataset.limit || '0', 10);
    var shown = limit ? items.slice(0, limit) : items;
    var phones = el.classList.contains('cutouts--phone');
    el.innerHTML = '';
    shown.forEach(function (item, i) {
      /* A screen is small on the page. With a mouse, hovering enlarges it in
         place (CSS); on a touch screen the first tap does the same and the
         second opens the full viewer. */
      var btn = pieceButton(item, i, key, 'cutout', function () {
        if (phones && coarse.matches && !btn.classList.contains('is-zoomed')) {
          $$('.is-zoomed', el).forEach(function (o) { o.classList.remove('is-zoomed'); });
          btn.classList.add('is-zoomed');
          return;
        }
        openLightbox(key, i);
      });
      /* Bare screen captures get a device bezel so a row of screens reads as
         a row of phones; sources that already ship inside a mockup don't. */
      if (item.dev) btn.classList.add('cutout--device');
      var cap = document.createElement('span');
      cap.className = 'cutout-cap';
      cap.textContent = caption(item).replace(/^[^—]*—\s*/, '');
      btn.appendChild(cap);
      el.appendChild(btn);
    });
    observe($$('.cutout', el));
  }

  /* ─────────────────────────────────────────── horizontal strip ── */
  /* The reaction set is wider than the page. Rather than shrink it to fit or
     hide it behind a button, the row travels sideways as the section passes
     through the viewport, so every emoji gets its moment. */
  var hstrips = [];

  function renderHStrips() {
    hstrips = [];
    $$('[data-hstrip]').forEach(function (el) {
      var key = el.dataset.hstrip;
      var track = $('.hstrip-track', el);
      track.innerHTML = '';
      (WORKS[key] || []).forEach(function (item, i) {
        var piece = pieceButton(item, i, key, 'cutout');
        var img = piece.querySelector('img');
        if (img) {
          /* Inside a transformed track, so the browser's idea of "near the
             viewport" is unreliable — fetch up front, but out of the way. */
          img.loading = 'eager';
          img.setAttribute('fetchpriority', 'low');
        }
        track.appendChild(piece);
      });
      hstrips.push({ el: el, track: track });
    });
    scrubHStrips();
  }

  function scrubHStrips() {
    if (reduced.matches) return;   // the row scrolls by hand instead
    for (var i = 0; i < hstrips.length; i++) {
      var s = hstrips[i];
      var box = s.el.getBoundingClientRect();
      var vh = window.innerHeight;
      if (box.bottom < -100 || box.top > vh + 100) continue;
      var p = Math.min(Math.max((vh - box.top) / (vh + box.height), 0), 1);
      var travel = Math.max(0, s.track.scrollWidth - s.el.clientWidth);
      s.track.style.transform = 'translate3d(' + (-travel * p).toFixed(1) + 'px,0,0)';
    }
  }

  /* ──────────────────────────────────────────── scrolling strips ── */
  /* Each board is a very tall strip. It sits pinned in the middle of the
     screen at a readable size, and the page scroll runs it past the frame,
     so you read the whole thing without ever leaving the flow. */
  var strips = [];

  function renderStrips() {
    var host = $('[data-strips]');
    if (!host) return;
    host.innerHTML = '';
    strips = [];
    (WORKS.boards || []).forEach(function (item, i) {
      var text = caption(item);
      var parts = text.split(' — ');

      var wrap = document.createElement('div');
      wrap.className = 'strip';
      wrap.innerHTML =
        '<div class="strip-sticky">' +
          '<div class="strip-head">' +
            '<h3></h3><p></p>' +
          '</div>' +
          '<figure class="strip-frame"><img alt=""></figure>' +
          '<div class="strip-rail" aria-hidden="true"><i></i></div>' +
        '</div>';

      $('h3', wrap).textContent = parts[0];
      $('.strip-head p', wrap).textContent = parts[1] || '';
      var img = $('img', wrap);
      img.src = 'assets/' + item.src;
      img.width = item.w; img.height = item.h;
      img.alt = text;
      img.loading = 'eager';
      if (i) img.setAttribute('fetchpriority', 'low');
      img.decoding = 'async';

      var open = document.createElement('button');
      open.type = 'button';
      open.className = 'strip-open';
      open.innerHTML = '<span></span><svg viewBox="0 0 24 24" aria-hidden="true">' +
        '<path d="M11 4a7 7 0 1 1 0 14 7 7 0 0 1 0-14ZM20 20l-4-4M11 8v6M8 11h6"/></svg>';
      $('span', open).textContent = t('board.open');
      open.addEventListener('click', function () { openLightbox('boards', i); });
      $('.strip-sticky', wrap).appendChild(open);

      host.appendChild(wrap);
      strips.push({ wrap: wrap, img: img, frame: $('.strip-frame', wrap),
                    rail: $('.strip-rail i', wrap), ratio: item.h / item.w });
    });
    scrubStrips();
  }

  function scrubStrips() {
    if (reduced.matches) return;   // strips render in full, unpinned
    for (var i = 0; i < strips.length; i++) {
      var s = strips[i];
      var box = s.wrap.getBoundingClientRect();
      if (box.bottom < -200 || box.top > window.innerHeight + 200) continue;

      /* progress through the pinned portion of this strip */
      var travelRange = box.height - window.innerHeight;
      var p = travelRange > 0 ? Math.min(Math.max(-box.top / travelRange, 0), 1) : 0;

      var frameH = s.frame.clientHeight;
      var imgH = s.frame.clientWidth * s.ratio;
      var travel = Math.max(0, imgH - frameH);
      s.img.style.transform = 'translate3d(0,' + (-travel * p).toFixed(1) + 'px,0)';
      if (s.rail) s.rail.style.transform = 'scaleX(' + Math.max(p, 0.02).toFixed(3) + ')';
    }
  }

  function renderAll() {
    $$('[data-set]').forEach(renderSet);
    $$('[data-cutouts]').forEach(renderCutouts);
    renderHStrips();
    renderStrips();
    initCounters();
  }

  /* ──────────────────────────────────────────────────── lightbox ── */
  var lb = { open: false, items: [], index: 0, restore: null };
  var lbEl    = $('#lightbox');
  var lbMedia = $('#lbMedia');
  var lbText  = $('#lbText');
  var lbCount = $('#lbCount');

  function openLightbox(key, index) {
    lb.items = WORKS[key] || [];
    if (!lb.items.length) return;
    lb.index = index;
    lb.open = true;
    lb.restore = document.activeElement;
    lbEl.hidden = false;
    document.body.classList.add('is-locked');
    requestAnimationFrame(function () { lbEl.classList.add('is-open'); });
    paintLightbox();
    $('.lb-close').focus();
  }

  function closeLightbox() {
    if (!lb.open) return;
    lb.open = false;
    lbEl.classList.remove('is-open');
    document.body.classList.remove('is-locked');
    setTimeout(function () { lbEl.hidden = true; lbMedia.innerHTML = ''; }, 260);
    if (lb.restore && lb.restore.focus) lb.restore.focus();
  }

  function step(delta) {
    if (!lb.items.length) return;
    lb.index = (lb.index + delta + lb.items.length) % lb.items.length;
    paintLightbox();
  }

  function paintLightbox() {
    var item = lb.items[lb.index];
    if (!item) return;
    lbMedia.innerHTML = '';
    var img;
    if (item.video) {
      img = document.createElement('video');
      img.src = 'assets/' + item.src;
      img.controls = true; img.loop = true; img.muted = true;
      img.playsInline = true; img.setAttribute('playsinline', '');
      img.preload = 'auto';
      if (!reduced.matches) img.autoplay = true;
      img.setAttribute('aria-label', caption(item));
    } else {
      img = document.createElement('img');
      img.src = 'assets/' + item.src;
      img.alt = caption(item);
      img.decoding = 'async';
    }
    /* Anything much taller than it is wide would shrink to a thumbnail if it
       had to fit the viewport height, so it scrolls inside the viewer instead
       — the boards and the story-format pieces both land here. */
    if (item.h / item.w > 1.6) lbMedia.classList.add('is-tall');
    else lbMedia.classList.remove('is-tall');
    lbMedia.appendChild(img);

    lbText.textContent = caption(item);
    lbCount.textContent = (lb.index + 1) + ' ' + t('lb.of') + ' ' + lb.items.length;
    var multiple = lb.items.length > 1;
    $('.lb-prev').hidden = !multiple;
    $('.lb-next').hidden = !multiple;
  }

  lbEl.addEventListener('click', function (ev) {
    var act = ev.target.closest('[data-lb]');
    if (act) {
      if (act.dataset.lb === 'close') closeLightbox();
      if (act.dataset.lb === 'prev')  step(-1);
      if (act.dataset.lb === 'next')  step(1);
      return;
    }
    if (!ev.target.closest('.lb-stage')) closeLightbox();
  });

  document.addEventListener('keydown', function (ev) {
    if (!lb.open) return;
    if (ev.key === 'Escape')     { closeLightbox(); }
    if (ev.key === 'ArrowLeft')  { step(-1); }
    if (ev.key === 'ArrowRight') { step(1); }
    if (ev.key === 'Tab') {
      var focusable = $$('button:not([hidden])', lbEl);
      if (!focusable.length) return;
      var first = focusable[0], last = focusable[focusable.length - 1];
      if (ev.shiftKey && document.activeElement === first) { ev.preventDefault(); last.focus(); }
      else if (!ev.shiftKey && document.activeElement === last) { ev.preventDefault(); first.focus(); }
    }
  });

  /* ──────────────────────────────────────────────── capabilities ── */
  var caps = $$('.cap');
  var panels = $$('.cap-panel');

  function setCap(n) {
    caps.forEach(function (c) { c.classList.toggle('is-active', c.dataset.cap === String(n)); });
    panels.forEach(function (p) { p.classList.toggle('is-active', p.dataset.cap === String(n)); });
  }
  caps.forEach(function (c) {
    c.addEventListener('mouseenter', function () { setCap(c.dataset.cap); });
    c.addEventListener('click', function () { setCap(c.dataset.cap); });
    c.addEventListener('focusin', function () { setCap(c.dataset.cap); });
    c.tabIndex = 0;
  });

  /* ───────────────────────────────────────────────────────── boot ── */
  $('#year').textContent = String(new Date().getFullYear());

  applyLang();
  observe($$('.reveal'));
  onScroll();

  function playHero() { $$('.anim').forEach(function (el) { el.classList.add('is-in'); }); }
  if (document.fonts && document.fonts.ready) {
    document.fonts.ready.then(function () { buildMarquee(); playHero(); });
    setTimeout(playHero, 1200);            // safety net if fonts never resolve
  } else {
    playHero();
  }

  window.addEventListener('load', function () {
    sweep(); sweepCounters(); scrubStrips(); scrubHStrips();
  });

  var resizeT;
  window.addEventListener('resize', function () {
    clearTimeout(resizeT);
    resizeT = setTimeout(function () {
      buildMarquee(); sweep(); sweepCounters(); scrubStrips(); scrubHStrips();
    }, 200);
  });
})();
