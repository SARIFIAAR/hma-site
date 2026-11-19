/* HMA content-loader — reads content.json and populates the page */
(function () {
  'use strict';

  function esc(s) {
    var d = document.createElement('div');
    d.textContent = String(s);
    return d.innerHTML;
  }

  function get(obj, path) {
    return path.split('.').reduce(function (o, k) {
      return o != null ? o[k] : null;
    }, obj);
  }

  function applyTheme(theme) {
    if (!theme) return;
    var root = document.documentElement;
    var map = {
      accent:    '--accent',
      accentInk: '--accent-ink',
      onAccent:  '--on-accent',
      bg:        '--bg',
      bg2:       '--bg-2',
      surface:   '--surface',
      ink:       '--ink',
      inkSoft:   '--ink-soft',
      line:      '--line'
    };
    Object.keys(map).forEach(function (k) {
      if (theme[k]) root.style.setProperty(map[k], theme[k]);
    });
    if (theme.fontDisplay) root.style.setProperty('--font-display', '"' + theme.fontDisplay + '", Georgia, serif');
    if (theme.fontBody)    root.style.setProperty('--font-body', '"' + theme.fontBody + '", system-ui, sans-serif');
  }

  function applyText(c) {
    var els = document.querySelectorAll('[data-cms]');
    for (var i = 0; i < els.length; i++) {
      var val = get(c, els[i].getAttribute('data-cms'));
      if (val != null) els[i].textContent = val;
    }
  }

  function applyArrays(c) {
    /* ---- Tags ---- */
    if (c.forWhom && c.forWhom.tags) {
      var tags = document.querySelector('#forwhom .tags');
      if (tags) tags.innerHTML = c.forWhom.tags.map(function (t) {
        return '<li>' + esc(t) + '</li>';
      }).join('');
    }

    /* ---- Stats ---- */
    if (c.approach && c.approach.stats) {
      var stats = document.querySelector('#approach .stats');
      if (stats) stats.innerHTML = c.approach.stats.map(function (s) {
        return '<div class="stat"><span class="stat__n">' + esc(s.n) +
               '</span><span class="stat__l">' + esc(s.label) + '</span></div>';
      }).join('');
    }

    /* ---- Structure rows ---- */
    if (c.structure && c.structure.rows) {
      var struct = document.querySelector('#structure .structure');
      if (struct) struct.innerHTML = c.structure.rows.map(function (r) {
        return '<div class="structure__row"><span class="structure__n">' + esc(r.n) +
               '</span><div><h3>' + esc(r.heading) + '</h3><p>' + esc(r.text) + '</p></div></div>';
      }).join('');
    }

    /* ---- Cards ---- */
    if (c.receive && c.receive.cards) {
      var cards = document.querySelector('#receive .cards');
      if (cards) cards.innerHTML = c.receive.cards.map(function (card) {
        return '<article class="card"><h3>' + esc(card.heading) + '</h3><p>' + esc(card.text) + '</p></article>';
      }).join('');
    }

    /* ---- Programme items ---- */
    if (c.programme && c.programme.items) {
      var prog = document.querySelector('#programme .programme');
      if (prog) prog.innerHTML = c.programme.items.map(function (item) {
        return '<li>' + esc(item) + '</li>';
      }).join('');
    }
  }

  function run() {
    fetch('./content.json?_=' + Date.now())
      .then(function (r) { return r.ok ? r.json() : null; })
      .then(function (c) {
        if (!c) return;
        applyTheme(c.theme);
        applyText(c);
        applyArrays(c);
      })
      .catch(function () { /* fail silently — static fallback text shows */ });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', run);
  } else {
    run();
  }
})();
