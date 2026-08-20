/**
 * Landing page behaviour.
 *
 * Everything that depends on live data (the slot counter, the Play links,
 * launch mode) renders from the API when it answers and falls back to static
 * copy when it does not — the page must convert with the backend down.
 */
(function () {
  'use strict';
  let UI = window.BetaUI, API = window.BetaAPI, C = window.DLS_CONTENT;

  document.getElementById('year').textContent = String(new Date().getFullYear());

  // ── static content ────────────────────────────────────────────────────
  document.getElementById('pillars').innerHTML = C.pillars.map(function (p) {
    return '<div class="pillar"><div class="ico" aria-hidden="true">' + p.icon + '</div>' +
      '<h3>' + UI.esc(p.title) + '</h3><p>' + UI.esc(p.blurb) + '</p></div>';
  }).join('');

  document.getElementById('paths').innerHTML = C.paths.map(function (p) {
    return '<div class="path"><div class="tag">' + UI.esc(p.tag) + '</div><ol>' +
      p.steps.map(function (s) { return '<li>' + UI.esc(s) + '</li>'; }).join('') +
      '</ol><p class="note">' + UI.esc(p.note) + '</p></div>';
  }).join('');

  document.getElementById('shots').innerHTML = C.shots.map(function (s) {
    return '<figure><img src="' + UI.esc(s.src) + '" alt="' + UI.esc(s.caption) +
      '" loading="lazy" width="206" height="446" /><figcaption>' + UI.esc(s.caption) +
      '</figcaption></figure>';
  }).join('');

  document.getElementById('faq-list').innerHTML = C.faq.map(function (f) {
    return '<details><summary>' + UI.esc(f.q) + '</summary><div class="a">' +
      UI.esc(f.a) + '</div></details>';
  }).join('');

  UI.boot();

  // ── funnel tracking ───────────────────────────────────────────────────
  API.track('visit');
  UI.qsa('[data-cta]').forEach(function (el) {
    el.addEventListener('click', function () {
      API.track('cta_click', { cta: el.getAttribute('data-cta') });
    });
  });

  // ── live state ────────────────────────────────────────────────────────
  function paint(data) {
    let s = API.settings(data && data.config);
    let stats = (data && data.stats) || null;

    if (s.privacyUrl) document.getElementById('f-privacy').href = s.privacyUrl;
    if (s.discordUrl) document.getElementById('f-discord').href = s.discordUrl;
    if (s.supportEmail) {
      let mail = document.getElementById('f-mail');
      mail.href = 'mailto:' + s.supportEmail;
      mail.textContent = s.supportEmail;
    }

    // LAUNCH MODE: the same page becomes a download page. Community, ideas and
    // bug reporting all stay exactly where they are.
    if (s.mode === 'launch') {
      UI.qsa('a[data-cta]').forEach(function (a) {
        a.setAttribute('href', s.playStoreUrl || 'index.html');
        a.setAttribute('rel', 'noopener');
        if (a.classList.contains('btn-lg')) a.textContent = 'GET IT ON GOOGLE PLAY';
        else a.textContent = 'Download';
      });
      UI.qsa('.badge-android').forEach(function (b) {
        b.innerHTML = '<span class="dot"></span> Now on Google Play · Free';
      });
      document.getElementById('hero-note').textContent = 'Free to play. Available on Android and iOS.';
      return;
    }

    if (!stats) return;

    let target = Number(s.targetTesters) || 20;
    let joined = stats.joined || 0;
    let pct = Math.min(100, Math.round((joined / target) * 100));
    let full = joined >= target || s.betaStatus === 'full';

    let box = document.getElementById('slots');
    box.hidden = false;
    document.getElementById('slot-target').textContent = String(target);
    document.getElementById('slot-count').textContent = joined + ' / ' + target + ' testers';
    let bar = document.getElementById('slot-bar');
    bar.style.width = pct + '%';
    if (full) bar.parentNode.classList.add('ok');

    let pips = '';
    for (let i = 0; i < Math.min(target, 40); i++) {
      pips += '<span class="pip' + (i < joined ? ' on' : '') + '"></span>';
    }
    document.getElementById('slot-pips').innerHTML = pips;

    let note = full
      ? 'The first wave is full. You can still join the waitlist — we promote people as slots open.'
      : (target - joined) + ' slot' + (target - joined === 1 ? '' : 's') + ' left in the first wave.';
    document.getElementById('slot-note').textContent = note;
    document.getElementById('final-note').textContent = note;

    if (full) {
      UI.qsa('a[data-cta]').forEach(function (a) {
        if (a.classList.contains('btn-lg')) a.textContent = 'JOIN THE WAITLIST';
      });
    }
  }

  if (API.online()) {
    API.publicData().then(paint).catch(function () {
      // Silent: the page is fully readable without live counts, and an error
      // banner on a landing page costs conversions for no reader benefit.
      paint(null);
    });
  } else {
    paint(null);
  }
})();
