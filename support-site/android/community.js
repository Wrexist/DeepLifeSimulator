/** Community: announcements, devlog, roadmap, top ideas. */
(function () {
  'use strict';
  let UI = window.BetaUI, API = window.BetaAPI;

  document.getElementById('year').textContent = String(new Date().getFullYear());
  UI.boot();
  API.track('community_view');

  let tabs = UI.qsa('.tabs button');
  function select(tab) {
    tabs.forEach(function (t) {
      let on = t === tab;
      t.setAttribute('aria-selected', on ? 'true' : 'false');
      document.getElementById(t.getAttribute('aria-controls')).hidden = !on;
    });
  }
  tabs.forEach(function (t) { t.addEventListener('click', function () { select(t); }); });
  if (window.location.hash === '#roadmap') select(document.getElementById('tab-roadmap'));

  function postHtml(p) {
    return '<article class="post">' +
      (p.pinned ? '<span class="pill pill-active">PINNED</span>' : '') +
      '<h3 style="margin-top:' + (p.pinned ? '10px' : '0') + '">' + UI.esc(p.title) + '</h3>' +
      '<div class="when">' + UI.relativeTime(p.created_at) + '</div>' +
      '<div class="body">' + UI.escLines(p.body) + '</div></article>';
  }

  function lane(items, id) {
    let host = document.getElementById(id);
    host.innerHTML = items.length
      ? items.map(function (i) {
          return '<div class="item"><strong>' + UI.esc(i.title) + '</strong>' +
            (i.detail ? '<p>' + UI.escLines(i.detail) + '</p>' : '') + '</div>';
        }).join('')
      : '<p class="small muted">Nothing here yet.</p>';
  }

  function render(data) {
    let s = API.settings(data && data.config);
    ['discord', 'd1'].forEach(function (id) {
      let el = document.getElementById(id);
      if (el && s.discordUrl) el.href = s.discordUrl;
    });
    if (s.supportEmail) document.getElementById('mailto').href = 'mailto:' + s.supportEmail;
    if (s.privacyUrl) document.getElementById('f-privacy').href = s.privacyUrl;

    let posts = (data && data.posts) || [];
    let news = posts.filter(function (p) { return p.kind === 'announcement'; });
    let devlog = posts.filter(function (p) { return p.kind === 'devlog'; });

    document.getElementById('t-news').innerHTML = news.length
      ? news.map(postHtml).join('')
      : '<div class="panel">' + UI.empty('No announcements yet',
          'When there is something worth saying, it appears here first — and in Discord at the same time.',
          'Join the Discord', s.discordUrl) + '</div>';

    document.getElementById('t-devlog').innerHTML = devlog.length
      ? devlog.map(postHtml).join('')
      : '<div class="panel">' + UI.empty('No devlogs yet',
          'Longer write-ups on what changed and why. The first one lands with the next build.',
          'See the roadmap', '#roadmap') + '</div>';

    let roadmap = (data && data.roadmap) || [];
    lane(roadmap.filter(function (r) { return r.column_key === 'coming'; }), 'lane-coming');
    lane(roadmap.filter(function (r) { return r.column_key === 'building'; }), 'lane-building');
    lane(roadmap.filter(function (r) { return r.column_key === 'done'; }), 'lane-done');

    let ideas = ((data && data.ideas) || []).slice()
      .sort(function (a, b) { return b.votes - a.votes; }).slice(0, 10);
    document.getElementById('top-ideas').innerHTML = ideas.length
      ? ideas.map(function (i) {
          return '<div class="idea"><div class="vote" aria-hidden="true" style="cursor:default">' +
            '<span class="count">' + Number(i.votes || 0) + '</span></div>' +
            '<div style="min-width:0"><h3>' + UI.esc(i.title) + '</h3>' +
            (i.description ? '<p>' + UI.escLines(i.description) + '</p>' : '') +
            '<div class="meta"><span class="pill pill-lead">' +
            UI.esc(String(i.status).toUpperCase()) + '</span></div></div></div>';
        }).join('')
      : UI.empty('Nothing proposed yet', 'The board is open — be the first.', 'Propose a feature', 'ideas.html');
  }

  if (!API.online()) { render(null); return; }
  document.getElementById('t-news').innerHTML = '<div class="panel">' + UI.skeleton(3) + '</div>';
  API.publicData().then(render).catch(function (err) {
    render(null);
    document.getElementById('t-news').innerHTML = '<div class="panel">' +
      UI.errorState(err.message || 'Could not reach the beta service.', 'retry-comm') + '</div>';
    document.getElementById('retry-comm').addEventListener('click', function () { window.location.reload(); });
  });
})();
