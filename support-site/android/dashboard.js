/** Personal tester dashboard. */
(function () {
  'use strict';
  let UI = window.BetaUI, API = window.BetaAPI, C = window.DLS_CONTENT;

  document.getElementById('year').textContent = String(new Date().getFullYear());
  document.getElementById('skel').innerHTML = UI.skeleton(4);
  UI.boot();

  let loading = document.getElementById('loading');
  let stranger = document.getElementById('stranger');
  let dash = document.getElementById('dash');

  function showStranger() {
    loading.hidden = true;
    dash.hidden = true;
    stranger.hidden = false;
  }

  function render(data) {
    let t = data.tester;
    let settings = API.settings(data.config);
    let feedbackCount = data.feedbackCount || 0;
    let bugs = data.bugs || [];
    let ideas = data.ideas || [];
    let referrals = data.referrals || [];

    loading.hidden = true;
    stranger.hidden = true;
    dash.hidden = false;

    document.getElementById('nick').textContent = t.nickname;
    document.getElementById('status-label').textContent = t.waitlisted ? 'On the waitlist' : 'Beta tester';
    if (settings.privacyUrl) {
      document.getElementById('privacy-link').href = settings.privacyUrl;
      document.getElementById('f-privacy').href = settings.privacyUrl;
    }

    // ── level ──────────────────────────────────────────────────────────
    let lvl = UI.level(t.xp || 0);
    document.getElementById('xp').textContent = String(t.xp || 0);
    document.getElementById('xp-bar').style.width = lvl.pct + '%';
    document.getElementById('level-line').textContent =
      'Level ' + lvl.level + ' beta tester · joined ' + UI.relativeTime(t.createdAt);
    document.getElementById('xp-next').textContent = lvl.next === null
      ? 'Top level'
      : (lvl.next - (t.xp || 0)) + ' XP to level ' + (lvl.level + 1);

    // ── funnel ─────────────────────────────────────────────────────────
    let steps = UI.funnelSteps(t, feedbackCount);
    let done = steps.filter(function (s) { return s.done; }).length;
    let pct = Math.round((done / steps.length) * 100);
    document.getElementById('progress-bar').style.width = pct + '%';
    if (pct === 100) document.getElementById('progress-bar').parentNode.classList.add('ok');
    document.getElementById('pct-label').textContent = pct + '%';

    let firstOpen = -1;
    document.getElementById('rail').innerHTML = steps.map(function (s, i) {
      if (!s.done && firstOpen < 0) firstOpen = i;
      let cls = s.done ? 'done' : (firstOpen === i ? 'now' : '');
      return '<li class="' + cls + '"><span class="chip"><span class="mark">' +
        (s.done ? '✓' : String(i + 1)) + '</span> ' + UI.esc(s.label) + '</span></li>';
    }).join('');

    // The one thing to do next, stated as an action rather than a status.
    let next = document.getElementById('next-action');
    if (!t.optedIn) {
      next.innerHTML = '<div class="notice warn"><strong>Next:</strong> opt in on Google Play. ' +
        '<a href="join.html" style="text-decoration:underline">Open the steps →</a></div>';
    } else if (!t.installed) {
      next.innerHTML = '<div class="notice warn"><strong>Next:</strong> install the game, then come back and confirm. ' +
        '<a href="join.html" style="text-decoration:underline">Open the steps →</a></div>';
    } else if (!t.played) {
      next.innerHTML = '<div class="notice"><strong>Next:</strong> play for ten minutes. ' +
        '<a href="join.html" style="text-decoration:underline">Mark it done →</a></div>';
    } else if (feedbackCount === 0) {
      next.innerHTML = '<div class="notice"><strong>Next:</strong> the bit we actually need — ' +
        '<a href="feedback.html" style="text-decoration:underline">tell us what you think →</a></div>';
    } else {
      next.innerHTML = '<div class="notice ok"><strong>All four done.</strong> ' +
        'Keep playing, keep sending bugs, and please stay opted in until the 14 days are up.</div>';
    }

    // ── missions ───────────────────────────────────────────────────────
    let doneIds = t.missionsDone || [];
    document.getElementById('mission-count').textContent = String(doneIds.length);
    let remaining = C.missions.filter(function (m) { return doneIds.indexOf(m.id) < 0; });
    let mission = UI.missionOfTheDay(remaining.length ? remaining : C.missions, t.id);

    let box = document.getElementById('mission-box');
    if (!remaining.length) {
      box.innerHTML = '<div class="k">ALL CLEAR</div><h3>Every mission done</h3>' +
        '<p>Genuinely — thank you. Keep playing however you like; bugs and ideas are still the most useful things you can send.</p>';
    } else {
      box.innerHTML = '<div class="k">TODAY\'S MISSION</div><h3>' + UI.esc(mission.title) + '</h3>' +
        '<p>' + UI.esc(mission.detail) + '</p>' +
        '<button class="btn btn-ok" type="button" id="mission-done" data-id="' + UI.esc(mission.id) + '">✓ Done — next one</button>';
      document.getElementById('mission-done').addEventListener('click', function (e) {
        let button = e.currentTarget;
        UI.withButton(button, function () {
          return API.progress({ mission: button.getAttribute('data-id') }).then(function (res) {
            data.tester = res.tester;
            render(data);
          });
        }, { busy: 'Saving…', success: '+35 XP' });
      });
    }

    document.getElementById('mission-list').innerHTML = C.missions.map(function (m) {
      let isDone = doneIds.indexOf(m.id) >= 0;
      return '<div class="todo"><div class="item' + (isDone ? ' good' : '') + '">' +
        '<p>' + (isDone ? '✓ ' : '') + '<strong>' + UI.esc(m.title) + '</strong><br>' +
        '<span class="muted small">' + UI.esc(m.detail) + '</span></p></div></div>';
    }).join('');

    // ── badges ─────────────────────────────────────────────────────────
    let ctx = {
      rank: data.rank || 0,
      feedbackCount: feedbackCount,
      bugCount: bugs.length,
      ideaCount: ideas.length,
      referralCount: referrals.length,
    };
    document.getElementById('badges').innerHTML = C.badges.map(function (b) {
      let earned = false;
      try { earned = Boolean(b.check(t, ctx)); } catch (e) { earned = false; }
      return '<div class="bdg' + (earned ? ' earned' : '') + '">' +
        '<span class="g" aria-hidden="true">' + b.icon + '</span>' +
        '<div class="n">' + UI.esc(b.name) + '</div>' +
        '<div class="r">' + UI.esc(b.rule) + '</div></div>';
    }).join('');

    // ── counters ───────────────────────────────────────────────────────
    document.getElementById('c-feedback').textContent = String(feedbackCount);
    document.getElementById('c-bugs').textContent = String(bugs.length);
    document.getElementById('c-ideas').textContent = String(ideas.length);
    document.getElementById('c-refs').textContent = String(referrals.length);

    document.getElementById('my-bugs').innerHTML = bugs.length
      ? '<h3 class="small muted" style="margin-bottom:9px">YOUR BUG REPORTS</h3><div class="todo">' +
        bugs.map(function (b) {
          return '<div class="item"><p><strong>' + UI.esc(b.title) + '</strong><br>' +
            '<span class="small muted">' + UI.esc(b.severity) + ' · ' + UI.relativeTime(b.created_at) +
            '</span></p><span class="pill pill-' + (b.status === 'fixed' ? 'completed' : 'joined') + '">' +
            UI.esc(String(b.status).toUpperCase()) + '</span></div>';
        }).join('') + '</div>'
      : '';

    // ── referral ───────────────────────────────────────────────────────
    let link = (API.config.siteBase || '') + '?source=friend&ref=' + encodeURIComponent(t.referralCode);
    document.getElementById('ref-link').textContent = link;
    document.getElementById('copy-ref').addEventListener('click', function () { UI.copy(link); });
    if (navigator.share) {
      let shareBtn = document.getElementById('share-ref');
      shareBtn.hidden = false;
      shareBtn.addEventListener('click', function () {
        navigator.share({
          title: 'Deep Life Simulator — Android beta',
          text: 'Start with almost nothing. Build the life you want. I\'m testing this on Android:',
          url: link,
        }).catch(function () { /* the user dismissed the sheet */ });
      });
    }

    document.getElementById('ref-list').innerHTML = referrals.length
      ? '<div class="todo">' + referrals.map(function (r) {
          return '<div class="item' + (r.active ? ' good' : '') + '"><p><strong>' + UI.esc(r.nickname) +
            '</strong> · joined ' + UI.relativeTime(r.joined) + '</p><span class="pill pill-' +
            (r.active ? 'active' : (r.installed ? 'installed' : 'joined')) + '">' +
            (r.active ? 'PLAYING' : (r.installed ? 'INSTALLED' : 'JOINED')) + '</span></div>';
        }).join('') + '</div>'
      : '<p class="small muted">Nobody yet. One person is a real difference at this size.</p>';

    // ── delete my data ─────────────────────────────────────────────────
    document.getElementById('forget').addEventListener('click', function (e) {
      if (!window.confirm('Delete everything we hold about you, including your feedback? This cannot be undone.')) return;
      UI.withButton(e.currentTarget, function () {
        return API.forgetMe().then(function () { showStranger(); });
      }, { busy: 'Deleting…', success: 'Deleted. Nothing about you is left on our side.' });
    });
  }

  if (!API.online() || !API.token()) {
    showStranger();
    return;
  }

  API.track('dashboard_view');
  // `rank` is this tester's own join position among non-waitlisted testers,
  // computed server-side. It must NOT be derived from the public total: that
  // number keeps climbing, so tester #5 would silently lose the "First 20"
  // badge the moment the 21st person signed up.
  API.me()
    .then(render)
    .catch(function (err) {
      if (err.status === 404) { API.clearToken(); showStranger(); return; }
      loading.innerHTML = '<div class="panel">' +
        UI.errorState(err.message || 'We could not reach the beta service.', 'retry-dash') + '</div>';
      document.getElementById('retry-dash').addEventListener('click', function () {
        window.location.reload();
      });
    });
})();
