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
    drift();
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

  /* ──────────────────────────────────────────────────────── scenes ── */
  /* Each work section is a stage of three phones. A phone says what it shows
     with data attributes, so the markup decides the composition and the
     manifest only supplies the pieces:
       data-group  manifest key (defaults to the scene's own key)
       data-show   "1" for one screen, "2-6" for a run of feed slides
       data-kind   screen (default) | post | feed | app | scroll                 */
  var ICONS = {
    heart: '<path d="M12 20s-7-4.4-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.6-7 10-7 10Z"/>',
    chat:  '<path d="M20 12a8 8 0 0 1-11.6 7.1L4 20l1-4.2A8 8 0 1 1 20 12Z"/>',
    send:  '<path d="M21 3 3 10.5l7 3 3 7L21 3ZM10 13.5 21 3"/>',
    save:  '<path d="M6 3h12v18l-6-4.5L6 21Z"/>'
  };
  function icon(name, cls) {
    return '<svg viewBox="0 0 24 24"' + (cls ? ' class="' + cls + '"' : '') +
           ' aria-hidden="true">' + ICONS[name] + '</svg>';
  }

  function range(spec) {
    var m = String(spec || '0').split('-');
    var a = parseInt(m[0], 10), b = parseInt(m[1] || m[0], 10), out = [];
    for (var i = a; i <= b; i++) out.push(i);
    return out;
  }

  var rotators = [];     // feeds and app heroes that advance on a timer
  var stages = [];       // for the parallax drift

  function feedScreen(phone, key, items, idx) {
    var brand = phone.dataset.brand || '';
    var feed = document.createElement('div');
    feed.className = 'feed';
    feed.innerHTML =
      '<div class="feed-head"><span class="feed-avatar"></span><span><b></b><small></small></span></div>' +
      '<div class="feed-track"><span class="feed-count"></span></div>' +
      '<div class="feed-bar">' + icon('heart') + icon('chat') + icon('send') +
        '<span class="feed-dots"></span>' + icon('save', 'feed-save') + '</div>' +
      '<div class="feed-lines"><i></i><i></i></div>';
    $('.feed-avatar', feed).textContent = brand.charAt(0);
    $('.feed-head b', feed).textContent = brand;
    $('.feed-head small', feed).textContent = t('feed.sub');
    var track = $('.feed-track', feed), dots = $('.feed-dots', feed);
    idx.forEach(function (n, j) {
      var it = items[n]; if (!it) return;
      var slide = document.createElement('div');
      slide.className = 'feed-slide' + (j ? '' : ' is-on');
      slide.appendChild(mediaFor(it, j < 2));
      track.appendChild(slide);
      dots.appendChild(document.createElement('i'));
    });
    var r = { el: phone, at: 0, slides: $$('.feed-slide', track), pips: $$('i', dots),
              count: $('.feed-count', track) };
    r.paint = function () {
      r.slides.forEach(function (s, j) {
        s.classList.toggle('is-on', j === r.at);
        var v = s.querySelector('video');
        if (v) {
          if (j === r.at && !reduced.matches) { var pr = v.play(); if (pr) pr.catch(function () {}); }
          else v.pause();
        }
      });
      r.pips.forEach(function (d, j) { d.classList.toggle('is-on', j === r.at); });
      r.count.textContent = (r.at + 1) + '/' + r.slides.length;
    };
    r.paint();
    rotators.push(r);
    phone.addEventListener('click', function () { openLightbox(key, idx[0] + r.at); });
    return feed;
  }

  function appScreen(phone, key, items) {
    var subs = WORKS[phone.dataset.sub] || [];
    var app = document.createElement('div');
    app.className = 'app';
    app.innerHTML =
      '<div class="app-top"><b>betano<i>.</i></b><span>R$ 250,00</span></div>' +
      '<div class="app-tabs"><span></span><span></span><span></span></div>' +
      '<div class="app-hero"></div><div class="app-pips"></div>';
    var tabs = $$('.app-tabs span', app);
    tabs[0].textContent = t('app.tab1'); tabs[1].textContent = t('app.tab2'); tabs[2].textContent = t('app.tab3');
    var hero = $('.app-hero', app), pips = $('.app-pips', app);
    items.forEach(function (it, j) {
      var im = mediaFor(it, j < 2);
      if (!j) im.classList.add('is-on');
      hero.appendChild(im);
      pips.appendChild(document.createElement('i'));
    });
    subs.slice(0, 3).forEach(function (it) {
      var pm = document.createElement('div');
      pm.className = 'app-pm';
      pm.appendChild(mediaFor(it, false));
      app.appendChild(pm);
    });
    var r = { el: phone, at: 0, slides: $$('img', hero), pips: $$('i', pips) };
    r.paint = function () {
      r.slides.forEach(function (s, j) { s.classList.toggle('is-on', j === r.at); });
      r.pips.forEach(function (d, j) { d.classList.toggle('is-on', j === r.at); });
    };
    r.paint();
    rotators.push(r);
    phone.addEventListener('click', function () { openLightbox(key, r.at); });
    return app;
  }

  function buildPhone(phone, key, items) {
    var kind = phone.dataset.kind || 'screen';
    var idx = range(phone.dataset.show);
    var screen = document.createElement('div');
    screen.className = 'phone-screen';

    if (kind === 'feed') screen.appendChild(feedScreen(phone, key, items, idx));
    else if (kind === 'app') screen.appendChild(appScreen(phone, key, items));
    else {
      var it = items[idx[0]];
      if (it) {
        if (kind === 'post') {
          var bg = mediaFor(it, true);
          bg.className = 'phone-bg'; bg.alt = ''; bg.setAttribute('aria-hidden', 'true');
          screen.appendChild(bg);
        }
        screen.appendChild(mediaFor(it, true));
        phone.setAttribute('aria-label', caption(it));
      }
      if (kind === 'scroll') phone.classList.add('phone--scroll');
      if (kind === 'post') phone.classList.add('phone--post');
      phone.addEventListener('click', function () { openLightbox(key, idx[0]); });
    }
    phone.appendChild(screen);
  }

  function renderScenes() {
    rotators = []; stages = [];
    $$('[data-scene]').forEach(function (stage) {
      var scene = stage.dataset.scene;
      $$('.phone', stage).forEach(function (old, i) {
        /* A language switch re-renders, so start from a clean element and
           never stack a second set of listeners on the old one. */
        var phone = old.cloneNode(false);
        old.parentNode.replaceChild(phone, old);
        var key = phone.dataset.group || scene;
        phone.style.setProperty('--i', String(i));
        phone.tabIndex = 0;
        phone.setAttribute('role', 'button');
        phone.setAttribute('aria-label', t('scene.open'));
        buildPhone(phone, key, WORKS[key] || []);
        phone.addEventListener('keydown', function (ev) {
          if (ev.key === 'Enter' || ev.key === ' ') { ev.preventDefault(); phone.click(); }
        });
      });
      /* the scene's own logo can also sit in the copy column (narrow layouts) */
      $$('[data-art]', stage.closest('.scene') || stage).forEach(function (el) {
        var ref = el.dataset.art.split(':');
        var it = (WORKS[ref[0]] || [])[+ref[1]];
        el.innerHTML = '';
        if (it) { var im = mediaFor(it, true); im.alt = ''; el.appendChild(im); }
      });
      stages.push({ el: stage, phones: $$('.phone', stage) });
      observe($$('.phone, .art', stage));
    });

    $$('[data-cast]').forEach(function (row) {
      var key = row.dataset.cast;
      row.innerHTML = '';
      (WORKS[key] || []).forEach(function (it, i) {
        row.appendChild(pieceButton(it, i, key, ''));
      });
    });
    drift();
  }

  /* One clock for every carousel on the page; only the ones on screen move. */
  setInterval(function () {
    if (reduced.matches || document.hidden || lb.open) return;
    var vh = window.innerHeight;
    rotators.forEach(function (r) {
      var box = r.el.getBoundingClientRect();
      if (box.bottom < 0 || box.top > vh || r.slides.length < 2) return;
      r.at = (r.at + 1) % r.slides.length;
      r.paint();
    });
  }, 3200);

  /* The side phones drift against the main one as a scene passes through
     the viewport — enough to read as depth, not enough to notice. */
  function drift() {
    if (reduced.matches) return;
    var vh = window.innerHeight;
    for (var i = 0; i < stages.length; i++) {
      var box = stages[i].el.getBoundingClientRect();
      if (box.bottom < -100 || box.top > vh + 100) continue;
      var p = ((box.top + box.height / 2) - vh / 2) / vh;   // -1 … +1
      stages[i].phones.forEach(function (ph, j) {
        var k = ph.classList.contains('phone--main') ? 0 : (j === 0 ? 46 : 70);
        ph.style.setProperty('--py', (p * k).toFixed(1) + 'px');
      });
    }
  }

  /* ──────────────────────────────────────────────────── sketchbook ── */
  /* Each print shows the finished colour. Where a pencil stage exists,
     moving across the print wipes it back in under the pointer (or fades it
     in whole, when the sketch is a different shape); a click opens the
     viewer on the whole project. */
  var sbTimer = null;
  function renderSketchbook() {
    var items = WORKS.illustration || [];
    $$('.sb-card').forEach(function (old) {
      var card = old.cloneNode(true);           // drop listeners from a previous render
      old.parentNode.replaceChild(card, old);
      var n = +card.dataset.ill, it = items[n];
      var prev = $('.sb-art', card); if (prev) prev.remove();
      if (!it) return;
      var art = document.createElement('div');
      art.className = 'sb-art';
      art.appendChild(mediaFor(it, true));
      var sk = items[+card.dataset.sketch];
      if (card.dataset.sketch && sk) {
        var s = mediaFor(sk, true);
        s.className = 'sb-sketch'; s.alt = '';
        art.appendChild(s);
      }
      card.insertBefore(art, card.firstChild);
      card.tabIndex = 0;
      card.setAttribute('role', 'button');
      card.setAttribute('aria-label', caption(it));

      if (card.dataset.sketch) {
        var move = function (ev) {
          var r = art.getBoundingClientRect();
          var x = Math.min(Math.max((ev.clientX - r.left) / r.width, 0), 1);
          card.style.setProperty('--x', (x * 100).toFixed(1) + '%');
          card.classList.add('is-wiping');
        };
        /* Mouse only: the wipe follows the pointer. Touch screens get the
           automatic sketch/colour flip below instead. */
        if (!coarse.matches) {
          card.addEventListener('pointerenter', move);
          card.addEventListener('pointermove', move);
          card.addEventListener('pointerleave', function () {
            card.classList.remove('is-wiping');
            card.style.setProperty('--x', '0%');
          });
        }
      }
      card.addEventListener('click', function () { openLightbox('illustration', n); });
      card.addEventListener('keydown', function (ev) {
        if (ev.key === 'Enter' || ev.key === ' ') { ev.preventDefault(); openLightbox('illustration', n); }
      });
    });
    observe($$('.sb-card'));

    /* Touch screens: every paired print flips between its sketch and its final
       colour on its own, a beat apart, while the board is on screen. */
    if (coarse.matches && !reduced.matches && !sbTimer) {
      sbTimer = setInterval(function () {
        var board = $('.sb-board');
        if (!board || document.hidden || lb.open) return;
        var box = board.getBoundingClientRect();
        if (box.bottom < 0 || box.top > window.innerHeight) return;
        $$('.sb-card[data-sketch]').forEach(function (c, k) {
          setTimeout(function () {
            var on = !c.classList.contains('is-sketch');
            c.classList.toggle('is-sketch', on);
            c.style.setProperty('--x', on ? '100%' : '0%');
          }, k * 450);
        });
      }, 3000);
    }

    /* the pixel character: idle and run loops side by side */
    $$('[data-pixel]').forEach(function (fig) {
      var row = $('.sb-sprites', fig);
      row.innerHTML = '';
      (WORKS.pixel || []).forEach(function (it) {
        var im = mediaFor(it, true);
        im.alt = caption(it);
        row.appendChild(im);
      });
      observe([fig]);
    });
  }

  function renderAll() {
    renderScenes();
    renderSketchbook();
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

  /* ─────────────────────────────────────────── wireframe callouts ── */
  /* Public Betano chapter: lights one surface of the wireframe at a time,
     with its label, and lets a pointer on a label take over. */
  function initWire() {
    var wire = $('[data-wire]');
    if (!wire) return;
    var labels = $$('.callouts li', wire);
    var order = labels.map(function (l) { return l.dataset.spot; }).sort();
    var at = 0, held = false;
    function light(n) {
      $$('[data-spot]', wire).forEach(function (el) { el.classList.toggle('is-hot', el.dataset.spot === n); });
    }
    labels.forEach(function (l) {
      l.addEventListener('mouseenter', function () { held = true; light(l.dataset.spot); });
      l.addEventListener('mouseleave', function () { held = false; });
    });
    /* each label sits level with the middle of the region it names */
    function align() {
      var top = wire.getBoundingClientRect().top, h = wire.offsetHeight;
      labels.forEach(function (l) {
        var r = $('.wf [data-spot="' + l.dataset.spot + '"]', wire);
        if (!r || !h) return;
        var b = r.getBoundingClientRect();
        l.style.setProperty('--y', (((b.top + b.height / 2) - top) / h * 100).toFixed(2) + '%');
      });
    }
    align();
    window.addEventListener('resize', align);
    light(order[0]);
    if (reduced.matches) return;
    setInterval(function () {
      if (held || document.hidden) return;
      var box = wire.getBoundingClientRect();
      if (box.bottom < 0 || box.top > window.innerHeight) return;
      at = (at + 1) % order.length;
      light(order[at]);
    }, 2200);
  }

  /* ───────────────────────────────────────────────────────── boot ── */
  $('#year').textContent = String(new Date().getFullYear());

  /* touch screens get the instruction that matches the gesture */
  if (coarse.matches) $$('[data-i18n="ill.hint"]').forEach(function (el) { el.dataset.i18n = 'ill.hintTouch'; });
  applyLang();
  initWire();
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
    sweep(); sweepCounters(); drift();
  });

  var resizeT;
  window.addEventListener('resize', function () {
    clearTimeout(resizeT);
    resizeT = setTimeout(function () {
      buildMarquee(); sweep(); sweepCounters(); drift();
    }, 200);
  });
})();
