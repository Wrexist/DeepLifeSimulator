/**
 * Beta Hub admin.
 *
 * The design goal is stated in one line: OPEN → SEE WHAT NEEDS ATTENTION →
 * CLICK → DONE. The Today tab exists so that the whole system is legible in
 * ten seconds; everything else is a drill-down from it.
 *
 * The admin token lives in sessionStorage for the tab's lifetime only. It is
 * never written to localStorage, never put in a URL, and never logged.
 */
(function () {
  'use strict';
  let UI = window.BetaUI, API = window.BetaAPI, C = window.DLS_CONTENT;

  let state = { data: null, settings: {}, filter: 'ALL', search: '', sort: 'created_at', dir: -1 };
  let gate = document.getElementById('gate');
  let app = document.getElementById('app');

  // ── sign in ────────────────────────────────────────────────────────────
  document.getElementById('gate-form').addEventListener('submit', function (e) {
    e.preventDefault();
    let token = document.getElementById('token').value.trim();
    if (!token) return;
    UI.withButton(document.getElementById('gate-submit'), function () {
      return API.admin('/overview', { adminToken: token }).then(function (data) {
        API.setAdminToken(token);
        document.getElementById('token').value = '';
        boot(data);
      });
    }, { busy: 'Checking…' }).catch(function (err) {
      document.getElementById('err-token').textContent =
        err.status === 401 ? 'That token was not accepted.' : (err.message || 'Could not sign in.');
    });
  });

  document.getElementById('signout').addEventListener('click', function () {
    API.setAdminToken('');
    window.location.reload();
  });

  function boot(data) {
    state.data = data;
    state.settings = API.settings(data.config);
    gate.hidden = true;
    app.hidden = false;
    document.getElementById('signout').hidden = false;
    renderAll();
  }

  function refresh() {
    return API.admin('/overview').then(function (data) {
      state.data = data;
      state.settings = API.settings(data.config);
      renderAll();
      return data;
    });
  }

  // ── tabs ───────────────────────────────────────────────────────────────
  UI.qsa('.tabs button').forEach(function (b) {
    b.addEventListener('click', function () {
      UI.qsa('.tabs button').forEach(function (o) {
        let on = o === b;
        o.setAttribute('aria-selected', on ? 'true' : 'false');
        document.getElementById('tab-' + o.getAttribute('data-tab')).hidden = !on;
      });
    });
  });

  // ── derived numbers ────────────────────────────────────────────────────
  function metrics() {
    let d = state.data;
    let testers = d.testers || [];
    let live = testers.filter(function (t) { return !t.waitlisted; });
    let events = d.events || [];
    let visitors = {};
    events.forEach(function (e) { if (e.type === 'visit' && e.visitor) visitors[e.visitor] = 1; });
    let since = Date.now() - 5 * 86400000;
    return {
      testers: testers,
      live: live,
      waitlist: testers.filter(function (t) { return t.waitlisted; }),
      target: Number(state.settings.targetTesters) || 20,
      visitors: Object.keys(visitors).length,
      signups: live.length,
      optedIn: live.filter(function (t) { return t.opted_in; }).length,
      installed: live.filter(function (t) { return t.installed; }).length,
      active: live.filter(function (t) { return t.played; }).length,
      withFeedback: live.filter(function (t) { return (t.feedback_count || 0) > 0; }).length,
      inactive: live.filter(function (t) {
        return t.played && new Date(t.last_seen_at).getTime() < since;
      }),
      stalled: live.filter(function (t) { return !t.installed; }),
      noFeedback: live.filter(function (t) { return t.played && (t.feedback_count || 0) === 0; }),
      openBugs: (d.bugs || []).filter(function (b) { return b.status === 'open'; }),
      feedback: d.feedback || [],
      ideas: d.ideas || [],
      events: events,
    };
  }

  function todayCounts(events, testers, feedback, bugs) {
    let start = new Date(); start.setHours(0, 0, 0, 0);
    let t0 = start.getTime();
    let after = function (iso) { return new Date(iso).getTime() >= t0; };
    let bySource = {};
    testers.filter(function (t) { return after(t.created_at); }).forEach(function (t) {
      bySource[t.source || 'direct'] = (bySource[t.source || 'direct'] || 0) + 1;
    });
    return {
      testers: testers.filter(function (t) { return after(t.created_at); }).length,
      feedback: feedback.filter(function (f) { return after(f.created_at); }).length,
      bugs: bugs.filter(function (b) { return after(b.created_at); }).length,
      bySource: bySource,
    };
  }

  // ── render: TODAY ──────────────────────────────────────────────────────
  function renderToday() {
    let m = metrics();
    let today = todayCounts(m.events, m.testers, m.feedback, state.data.bugs || []);
    let needed = Math.max(0, m.target - m.signups);

    // Best source by ACTIVE testers, not by signups: a channel that delivers
    // 30 people who never open the app is worse than one that delivers 5 who do.
    let bySource = {};
    m.live.forEach(function (t) {
      let k = t.source || 'direct';
      bySource[k] = bySource[k] || { signups: 0, active: 0 };
      bySource[k].signups++;
      if (t.played) bySource[k].active++;
    });
    let best = Object.keys(bySource).sort(function (a, b) {
      return bySource[b].active - bySource[a].active || bySource[b].signups - bySource[a].signups;
    })[0];

    let attention = [];
    if (needed > 0) {
      attention.push({ kind: 'attn', text: '<strong>' + needed + ' more tester' + (needed === 1 ? '' : 's') +
        ' needed</strong> to hit your target of ' + m.target + '.', cta: 'Get recruitment posts', tab: 'marketing' });
    } else {
      attention.push({ kind: 'good', text: '<strong>Target reached</strong> — ' + m.signups + ' of ' + m.target +
        '. Keep 15–18 opted in so a dropout never puts you under Google\'s minimum.', cta: 'See testers', tab: 'testers' });
    }
    if (!state.settings.playBetaUrl) {
      attention.push({ kind: 'attn', text: '<strong>No Google Play opt-in link set.</strong> Until you add it, ' +
        'the onboarding shows a "coming soon" notice instead of a dead button.', cta: 'Add it', tab: 'settings' });
    }
    if (m.stalled.length) {
      attention.push({ kind: 'attn', text: '<strong>' + m.stalled.length + ' haven\'t confirmed an install.</strong> ' +
        'The Day 1 message is written for exactly this.', cta: 'Open messages', tab: 'comms' });
    }
    if (m.noFeedback.length) {
      attention.push({ kind: 'attn', text: '<strong>' + m.noFeedback.length + ' played but sent no feedback.</strong> ' +
        'That is the single highest-value nudge you can send.', cta: 'Open messages', tab: 'comms' });
    }
    if (m.inactive.length) {
      attention.push({ kind: 'attn', text: '<strong>' + m.inactive.length + ' testers have gone quiet</strong> ' +
        '(no activity in 5+ days). Check they are still opted in on Play.', cta: 'See who', tab: 'testers' });
    }
    if (m.openBugs.length) {
      attention.push({ kind: 'attn', text: '<strong>' + m.openBugs.length + ' bug' +
        (m.openBugs.length === 1 ? '' : 's') + ' need review.</strong>', cta: 'Triage', tab: 'bugs' });
    }
    if (best && bySource[best].signups > 0) {
      attention.push({ kind: 'good', text: '<strong>' + UI.esc(best) + ' is your best channel</strong> — ' +
        bySource[best].signups + ' signups, ' + bySource[best].active + ' actually playing. Do more of it.',
        cta: 'Get its posts', tab: 'marketing' });
    }
    if (attention.length === 1 && needed === 0) {
      attention.push({ kind: 'good', text: 'Nothing needs you right now.', cta: '', tab: '' });
    }

    document.getElementById('tab-today').innerHTML =
      '<section class="panel"><div class="panel-head"><h2>Today</h2>' +
        '<button class="btn btn-g btn-sm" id="reload">Refresh</button></div>' +
        '<div class="stats">' +
          statBox(today.testers, 'New testers', '+today', today.testers > 0 ? 'good' : '') +
          statBox(today.feedback, 'Feedback', '+today') +
          statBox(today.bugs, 'Bugs', '+today', today.bugs > 0 ? 'warn' : '') +
          statBox(m.signups + ' / ' + m.target, 'Toward target', needed > 0 ? needed + ' to go' : 'reached',
            needed > 0 ? 'warn' : 'good') +
        '</div>' +
        (Object.keys(today.bySource).length
          ? '<p class="small muted mt-m">Today by source: ' + Object.keys(today.bySource).map(function (s) {
              return UI.esc(s) + ' +' + today.bySource[s];
            }).join(' · ') + '</p>'
          : '<p class="small muted mt-m">No signups yet today.</p>') +
      '</section>' +

      '<section class="panel"><div class="panel-head"><h2>Needs your attention</h2></div>' +
        '<div class="todo">' + attention.map(function (a) {
          return '<div class="item ' + a.kind + '"><p>' + a.text + '</p>' +
            (a.cta ? '<button class="btn btn-g btn-sm" data-goto="' + a.tab + '">' + UI.esc(a.cta) + '</button>' : '') +
            '</div>';
        }).join('') + '</div></section>' +

      '<section class="panel"><div class="panel-head"><h2>Overview</h2></div>' +
        '<div class="stats">' +
          statBox(m.visitors, 'Visitors', 'last 30 days') +
          statBox(m.signups, 'Joined') +
          statBox(m.optedIn, 'Opted in') +
          statBox(m.installed, 'Installed') +
          statBox(m.active, 'Active') +
          statBox(m.withFeedback, 'Gave feedback') +
          statBox(m.inactive.length, 'Inactive', '5+ days quiet', m.inactive.length ? 'warn' : '') +
          statBox(m.waitlist.length, 'Waitlisted') +
        '</div></section>' +

      '<section class="panel"><div class="panel-head"><h2>Quick actions</h2></div>' +
        '<div class="actions">' +
          '<button class="btn btn-p" data-goto="testers" data-add="1">+ Add tester</button>' +
          '<button class="btn btn-g" data-goto="links">Create recruitment link</button>' +
          '<button class="btn btn-g" data-goto="marketing">Generate marketing post</button>' +
          '<button class="btn btn-g" data-goto="comms">Send an update</button>' +
          '<button class="btn btn-g" data-goto="feedback">View feedback</button>' +
          '<button class="btn btn-g" data-goto="bugs">View bugs</button>' +
          '<button class="btn btn-g" id="export-quick">Export testers (CSV)</button>' +
          '<button class="btn btn-g" data-goto="settings">Update Play Store link</button>' +
        '</div></section>';

    document.getElementById('reload').addEventListener('click', function (e) {
      UI.withButton(e.currentTarget, refresh, { busy: 'Refreshing…', success: 'Up to date' });
    });
    document.getElementById('export-quick').addEventListener('click', exportCsv);
    UI.qsa('[data-goto]').forEach(function (b) {
      b.addEventListener('click', function () {
        let tab = b.getAttribute('data-goto');
        if (!tab) return;
        UI.qsa('.tabs button').filter(function (t) {
          return t.getAttribute('data-tab') === tab;
        })[0].click();
        if (b.getAttribute('data-add')) {
          let addBtn = document.getElementById('open-add');
          if (addBtn) addBtn.click();
        }
        window.scrollTo({ top: 0, behavior: 'smooth' });
      });
    });
  }

  function statBox(n, label, detail, tone) {
    return '<div class="stat ' + (tone || '') + '"><div class="n">' + UI.esc(n) + '</div>' +
      '<div class="l">' + UI.esc(label) + '</div>' +
      (detail ? '<div class="d">' + UI.esc(detail) + '</div>' : '') + '</div>';
  }

  // ── render: TESTERS ────────────────────────────────────────────────────
  let STATUSES = ['ALL', 'LEAD', 'INVITED', 'JOINED', 'INSTALLED', 'ACTIVE', 'FEEDBACK', 'INACTIVE', 'COMPLETED'];

  function renderTesters() {
    let m = metrics();
    let host = document.getElementById('tab-testers');

    if (!m.testers.length) {
      host.innerHTML = '<section class="panel">' +
        UI.empty('No testers yet',
          'Nothing to manage until someone signs up. Create a tracked recruitment link, post it, and they land here automatically.',
          'Create your first recruitment link', '#') +
        '</section>';
      UI.qs('.empty .btn', host).addEventListener('click', function (e) {
        e.preventDefault();
        UI.qsa('.tabs button').filter(function (t) { return t.getAttribute('data-tab') === 'links'; })[0].click();
      });
      return;
    }

    host.innerHTML =
      '<section class="panel"><div class="panel-head"><h2>Testers</h2>' +
        '<div class="actions">' +
          '<button class="btn btn-p btn-sm" id="open-add">+ Add tester</button>' +
          '<button class="btn btn-g btn-sm" id="export">Export CSV</button>' +
        '</div></div>' +
        '<div class="row" style="margin-bottom:14px">' +
          '<label class="sr-only" for="search">Search testers</label>' +
          '<input id="search" type="search" placeholder="Search name, contact, country, device…" style="flex:1 1 240px" />' +
          '<label class="sr-only" for="statusfilter">Filter by status</label>' +
          '<select id="statusfilter" style="flex:0 0 190px">' +
            STATUSES.map(function (s) {
              return '<option value="' + s + '"' + (s === state.filter ? ' selected' : '') + '>' +
                (s === 'ALL' ? 'All statuses' : s) + '</option>';
            }).join('') +
          '</select>' +
        '</div>' +
        '<div class="tablewrap"><table><thead><tr>' +
          th('Tester', 'nickname') + th('Source', 'source') + th('Joined', 'created_at') +
          '<th>Opted in</th><th>Installed</th>' + th('Last activity', 'last_seen_at') +
          th('Feedback', 'feedback_count') + '<th>Status</th><th>Actions</th>' +
        '</tr></thead><tbody id="tbody"></tbody></table></div>' +
        '<p class="small muted mt-s" id="count"></p>' +
      '</section>' +

      '<section class="panel" id="add-panel" hidden>' +
        '<div class="panel-head"><h2>Add a tester by hand</h2>' +
          '<button class="btn btn-g btn-sm" id="close-add">Cancel</button></div>' +
        '<p class="sub">For someone who messaged you directly. They will not have a dashboard token — ' +
          'send them the hub link and they can join normally to get one.</p>' +
        '<form class="form" id="add-form">' +
          '<div class="row" style="align-items:flex-start;gap:14px">' +
            '<div class="field" style="flex:1 1 180px"><label for="a-nick">Name</label>' +
              '<input id="a-nick" required maxlength="40" /></div>' +
            '<div class="field" style="flex:1 1 220px"><label for="a-contact">Contact</label>' +
              '<input id="a-contact" maxlength="120" /></div>' +
            '<div class="field" style="flex:1 1 140px"><label for="a-source">Source</label>' +
              '<input id="a-source" maxlength="40" value="manual" /></div>' +
          '</div>' +
          '<div class="row" style="align-items:flex-start;gap:14px">' +
            '<div class="field" style="flex:1 1 160px"><label for="a-country">Country</label>' +
              '<input id="a-country" maxlength="60" /></div>' +
            '<div class="field" style="flex:1 1 160px"><label for="a-device">Device</label>' +
              '<input id="a-device" maxlength="60" /></div>' +
          '</div>' +
          '<div class="field"><label for="a-notes">Notes</label><textarea id="a-notes" maxlength="2000"></textarea></div>' +
          '<button class="btn btn-p" type="submit" id="a-submit">Add tester</button>' +
        '</form></section>' +

      '<section class="panel" id="edit-panel" hidden></section>';

    document.getElementById('export').addEventListener('click', exportCsv);
    document.getElementById('open-add').addEventListener('click', function () {
      document.getElementById('add-panel').hidden = false;
      document.getElementById('a-nick').focus();
    });
    document.getElementById('close-add').addEventListener('click', function () {
      document.getElementById('add-panel').hidden = true;
    });
    document.getElementById('add-form').addEventListener('submit', function (e) {
      e.preventDefault();
      UI.withButton(document.getElementById('a-submit'), function () {
        return API.admin('/tester', { method: 'POST', body: {
          nickname: document.getElementById('a-nick').value.trim(),
          contact: document.getElementById('a-contact').value.trim(),
          contactKind: 'other',
          source: document.getElementById('a-source').value.trim() || 'manual',
          country: document.getElementById('a-country').value.trim(),
          device: document.getElementById('a-device').value.trim(),
          notes: document.getElementById('a-notes').value.trim(),
        } }).then(refresh);
      }, { busy: 'Adding…', success: 'Tester added' });
    });

    let search = document.getElementById('search');
    search.value = state.search;
    search.addEventListener('input', function () { state.search = search.value; paintRows(); });
    let filter = document.getElementById('statusfilter');
    filter.addEventListener('change', function () { state.filter = filter.value; paintRows(); });
    UI.qsa('th[data-sort]').forEach(function (h) {
      h.addEventListener('click', function () {
        let key = h.getAttribute('data-sort');
        state.dir = state.sort === key ? -state.dir : -1;
        state.sort = key;
        paintRows();
      });
    });

    paintRows();
  }

  function th(label, key) {
    return '<th data-sort="' + key + '" scope="col">' + UI.esc(label) +
      (state.sort === key ? (state.dir < 0 ? ' ▾' : ' ▴') : '') + '</th>';
  }

  function paintRows() {
    let rows = (state.data.testers || []).slice();
    let q = state.search.trim().toLowerCase();
    if (q) {
      rows = rows.filter(function (t) {
        return ['nickname', 'contact', 'country', 'device', 'source', 'campaign', 'notes']
          .some(function (k) { return String(t[k] || '').toLowerCase().indexOf(q) >= 0; });
      });
    }
    if (state.filter !== 'ALL') {
      rows = rows.filter(function (t) { return t.status === state.filter; });
    }
    rows.sort(function (a, b) {
      let av = a[state.sort], bv = b[state.sort];
      if (typeof av === 'string' && /\d{4}-\d{2}-\d{2}/.test(av)) {
        av = new Date(av).getTime(); bv = new Date(bv).getTime();
      }
      if (typeof av === 'string') return state.dir * String(bv).localeCompare(String(av));
      return state.dir * ((bv || 0) - (av || 0));
    });

    document.getElementById('tbody').innerHTML = rows.length ? rows.map(function (t) {
      return '<tr>' +
        '<td><strong>' + UI.esc(t.nickname) + '</strong>' +
          (t.contact ? '<br><span class="small muted">' + UI.esc(t.contact) + '</span>' : '') + '</td>' +
        '<td>' + UI.esc(t.source || 'direct') + (t.campaign ? '<br><span class="small muted">' +
          UI.esc(t.campaign) + '</span>' : '') + '</td>' +
        '<td>' + UI.relativeTime(t.created_at) + '</td>' +
        '<td>' + (t.opted_in ? '✓' : '—') + '</td>' +
        '<td>' + (t.installed ? '✓' : '—') + '</td>' +
        '<td>' + UI.relativeTime(t.last_seen_at) + '</td>' +
        '<td>' + Number(t.feedback_count || 0) + '</td>' +
        '<td><span class="pill pill-' + String(t.status || 'lead').toLowerCase() + '">' +
          UI.esc(t.status || 'LEAD') + '</span></td>' +
        '<td><button class="btn btn-g btn-sm" data-edit="' + UI.esc(t.id) + '">Edit</button></td>' +
      '</tr>';
    }).join('') : '<tr><td colspan="9" class="muted" style="text-align:center;padding:26px">' +
      'Nothing matches that filter.</td></tr>';

    document.getElementById('count').textContent =
      rows.length + ' of ' + (state.data.testers || []).length + ' testers shown';

    UI.qsa('[data-edit]').forEach(function (b) {
      b.addEventListener('click', function () { editTester(b.getAttribute('data-edit')); });
    });
  }

  function editTester(id) {
    let t = (state.data.testers || []).filter(function (x) { return x.id === id; })[0];
    if (!t) return;
    let panel = document.getElementById('edit-panel');
    panel.hidden = false;
    panel.innerHTML =
      '<div class="panel-head"><h2>' + UI.esc(t.nickname) + '</h2>' +
        '<button class="btn btn-g btn-sm" id="close-edit">Close</button></div>' +
      '<div class="stats" style="margin-bottom:18px">' +
        statBox(t.xp || 0, 'XP') + statBox((t.missions_done || []).length, 'Missions') +
        statBox(t.feedback_count || 0, 'Feedback') +
        statBox(t.referral_code || '—', 'Referral code') +
      '</div>' +
      '<form class="form" id="edit-form">' +
        '<div class="row" style="align-items:flex-start;gap:14px">' +
          '<div class="field" style="flex:1 1 200px"><label for="e-contact">Contact</label>' +
            '<input id="e-contact" maxlength="120" value="' + UI.esc(t.contact || '') + '" /></div>' +
          '<div class="field" style="flex:1 1 150px"><label for="e-country">Country</label>' +
            '<input id="e-country" maxlength="60" value="' + UI.esc(t.country || '') + '" /></div>' +
          '<div class="field" style="flex:1 1 150px"><label for="e-device">Device</label>' +
            '<input id="e-device" maxlength="60" value="' + UI.esc(t.device || '') + '" /></div>' +
        '</div>' +
        '<fieldset class="field"><legend>Funnel — set these only when you know for a fact</legend>' +
          '<div class="chips">' +
            flagChip('e-opted', 'Opted in', t.opted_in) +
            flagChip('e-installed', 'Installed', t.installed) +
            flagChip('e-played', 'Played', t.played) +
            flagChip('e-waitlisted', 'Waitlisted', t.waitlisted) +
            flagChip('e-completed', 'Completed', t.completed) +
          '</div>' +
          '<p class="hint">These are the tester\'s own self-reported confirmations. Nothing here is read from ' +
            'Google Play — the hub has no visibility into it, and does not pretend to.</p>' +
        '</fieldset>' +
        '<div class="field"><label for="e-notes">Notes</label>' +
          '<textarea id="e-notes" maxlength="2000">' + UI.esc(t.notes || '') + '</textarea></div>' +
        '<div class="actions">' +
          '<button class="btn btn-p" type="submit" id="e-save">Save</button>' +
          '<button class="btn btn-g" type="button" id="e-delete">Delete this tester</button>' +
        '</div>' +
      '</form>';
    panel.scrollIntoView({ behavior: 'smooth', block: 'start' });

    document.getElementById('close-edit').addEventListener('click', function () { panel.hidden = true; });
    document.getElementById('edit-form').addEventListener('submit', function (e) {
      e.preventDefault();
      UI.withButton(document.getElementById('e-save'), function () {
        return API.admin('/tester', { method: 'POST', body: {
          id: id,
          contact: document.getElementById('e-contact').value.trim(),
          country: document.getElementById('e-country').value.trim(),
          device: document.getElementById('e-device').value.trim(),
          notes: document.getElementById('e-notes').value.trim(),
          opted_in: document.getElementById('e-opted').checked,
          installed: document.getElementById('e-installed').checked,
          played: document.getElementById('e-played').checked,
          waitlisted: document.getElementById('e-waitlisted').checked,
          completed: document.getElementById('e-completed').checked,
        } }).then(function () { panel.hidden = true; return refresh(); });
      }, { busy: 'Saving…', success: 'Saved' });
    });
    document.getElementById('e-delete').addEventListener('click', function (e) {
      if (!window.confirm('Delete ' + t.nickname + ' and everything they sent? This cannot be undone.')) return;
      UI.withButton(e.currentTarget, function () {
        return API.admin('/tester?id=' + encodeURIComponent(id), { method: 'DELETE' })
          .then(function () { panel.hidden = true; return refresh(); });
      }, { busy: 'Deleting…', success: 'Deleted' });
    });
  }

  function flagChip(id, label, on) {
    return '<input type="checkbox" id="' + id + '"' + (on ? ' checked' : '') + ' />' +
      '<label for="' + id + '">' + UI.esc(label) + '</label>';
  }

  function exportCsv() {
    API.admin('/export', { raw: true }).then(function (csv) {
      let blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
      let url = URL.createObjectURL(blob);
      let a = document.createElement('a');
      a.href = url;
      a.download = 'deeplife-beta-testers-' + new Date().toISOString().slice(0, 10) + '.csv';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.setTimeout(function () { URL.revokeObjectURL(url); }, 1000);
      UI.toast('CSV downloaded', 'ok');
    }).catch(function (err) {
      UI.toast(err.message || 'Export failed.', 'err');
    });
  }

  // ── render: FUNNEL & SOURCES ───────────────────────────────────────────
  function renderFunnel() {
    let m = metrics();
    let stages = [
      { label: 'Visitors', n: m.visitors },
      { label: 'Signups', n: m.signups },
      { label: 'Opted in', n: m.optedIn },
      { label: 'Installed', n: m.installed },
      { label: 'Active', n: m.active },
      { label: 'Feedback', n: m.withFeedback },
    ];
    let top = Math.max(1, stages[0].n, stages[1].n);

    let bySource = {};
    m.events.forEach(function (e) {
      if (e.type !== 'visit') return;
      let k = e.source || 'direct';
      bySource[k] = bySource[k] || { visitors: {}, signups: 0, joined: 0, active: 0, feedback: 0 };
      if (e.visitor) bySource[k].visitors[e.visitor] = 1;
    });
    m.live.forEach(function (t) {
      let k = t.source || 'direct';
      bySource[k] = bySource[k] || { visitors: {}, signups: 0, joined: 0, active: 0, feedback: 0 };
      bySource[k].signups++;
      if (t.opted_in) bySource[k].joined++;
      if (t.played) bySource[k].active++;
      if ((t.feedback_count || 0) > 0) bySource[k].feedback++;
    });
    let keys = Object.keys(bySource).sort(function (a, b) {
      return bySource[b].active - bySource[a].active || bySource[b].signups - bySource[a].signups;
    });

    document.getElementById('tab-funnel').innerHTML =
      '<section class="panel"><div class="panel-head"><h2>Tester funnel</h2>' +
        '<span class="small muted">Visitors counted over the last 30 days</span></div>' +
        '<div class="funnel">' + stages.map(function (s, i) {
          let prev = i === 0 ? null : stages[i - 1].n;
          let rate = prev ? Math.round((s.n / prev) * 100) + '%' : '';
          return '<div class="frow"><div class="fl">' + UI.esc(s.label) + '</div>' +
            '<div class="fb"><i style="width:' + Math.min(100, Math.round((s.n / top) * 100)) + '%"></i></div>' +
            '<div class="fn">' + s.n + (rate ? '<small>' + rate + '</small>' : '') + '</div></div>';
        }).join('') + '</div>' +
        '<p class="small muted mt-m">Visitor counts only include people who arrived with JavaScript running and ' +
          'were not blocking the request. Treat the top of the funnel as a floor, not a census.</p>' +
      '</section>' +

      '<section class="panel"><div class="panel-head"><h2>By recruitment source</h2></div>' +
        (keys.length
          ? '<div class="tablewrap"><table><thead><tr><th>Source</th><th>Visitors</th><th>Signups</th>' +
            '<th>Opted in</th><th>Active</th><th>Feedback</th><th>Visitor → signup</th></tr></thead><tbody>' +
            keys.map(function (k) {
              let s = bySource[k];
              let v = Object.keys(s.visitors).length;
              return '<tr><td><strong>' + UI.esc(k) + '</strong></td><td>' + v + '</td><td>' + s.signups +
                '</td><td>' + s.joined + '</td><td>' + s.active + '</td><td>' + s.feedback + '</td><td>' +
                (v ? Math.round((s.signups / v) * 100) + '%' : '—') + '</td></tr>';
            }).join('') + '</tbody></table></div>'
          : UI.empty('No source data yet',
              'Post a tracked recruitment link and this fills in on its own.',
              'Create a link', '#')) +
      '</section>';

    let cta = UI.qs('#tab-funnel .empty .btn');
    if (cta) cta.addEventListener('click', function (e) {
      e.preventDefault();
      UI.qsa('.tabs button').filter(function (t) { return t.getAttribute('data-tab') === 'links'; })[0].click();
    });
  }

  // ── render: FEEDBACK ───────────────────────────────────────────────────
  function renderFeedback() {
    let list = state.data.feedback || [];
    let byName = {};
    (state.data.testers || []).forEach(function (t) { byName[t.id] = t.nickname; });
    let avg = list.length
      ? (list.reduce(function (a, f) { return a + (f.rating || 0); }, 0) / list.length).toFixed(1)
      : '—';
    let catCount = {};
    list.forEach(function (f) {
      (f.categories || []).forEach(function (c) { catCount[c] = (catCount[c] || 0) + 1; });
    });

    document.getElementById('tab-feedback').innerHTML =
      '<section class="panel"><div class="panel-head"><h2>Feedback</h2></div>' +
        '<div class="stats">' + statBox(list.length, 'Responses') + statBox(avg, 'Average rating') +
          statBox(list.filter(function (f) { return f.confusing; }).length, 'Named something confusing', '', 'warn') +
          statBox(list.filter(function (f) { return f.stop; }).length, 'Said why they stopped', '', 'warn') +
        '</div>' +
        (Object.keys(catCount).length
          ? '<p class="small muted mt-m">Most-tagged: ' + Object.keys(catCount)
              .sort(function (a, b) { return catCount[b] - catCount[a]; })
              .map(function (c) { return UI.esc(c) + ' (' + catCount[c] + ')'; }).join(' · ') + '</p>'
          : '') +
      '</section>' +
      (list.length
        ? list.map(function (f) {
            let parts = [
              ['Best', f.best], ['Confusing', f.confusing], ['Would change', f.change],
              ['Kept playing because', f.keep], ['Stopped because', f.stop],
            ].filter(function (p) { return p[1]; });
            return '<article class="panel"><div class="panel-head">' +
              '<h2 style="font-size:17px">' + '★'.repeat(f.rating || 0) +
                '<span class="muted">' + '★'.repeat(5 - (f.rating || 0)) + '</span>' +
                ' <span class="small muted">' + UI.esc(byName[f.tester_id] || 'Anonymous') + ' · ' +
                UI.relativeTime(f.created_at) + '</span></h2>' +
              (f.categories && f.categories.length
                ? '<div class="row" style="gap:6px">' + f.categories.map(function (c) {
                    return '<span class="pill pill-lead">' + UI.esc(c) + '</span>';
                  }).join('') + '</div>' : '') +
              '</div>' +
              (parts.length
                ? parts.map(function (p) {
                    return '<p class="small muted" style="margin-bottom:8px"><strong style="color:#fff">' +
                      p[0] + ':</strong> ' + UI.escLines(p[1]) + '</p>';
                  }).join('')
                : '<p class="small muted">Rating only, no written answers.</p>') +
              '</article>';
          }).join('')
        : '<section class="panel">' + UI.empty('No feedback yet',
            'It arrives once testers have played. If people are playing and not writing, the Day 8 message is the one that unsticks it.') +
          '</section>');
  }

  // ── render: BUGS ───────────────────────────────────────────────────────
  function renderBugs() {
    let bugs = state.data.bugs || [];
    let byName = {};
    (state.data.testers || []).forEach(function (t) { byName[t.id] = t.nickname; });
    let order = { critical: 0, high: 1, medium: 2, low: 3 };
    let sorted = bugs.slice().sort(function (a, b) {
      if ((a.status === 'open') !== (b.status === 'open')) return a.status === 'open' ? -1 : 1;
      return (order[a.severity] ?? 9) - (order[b.severity] ?? 9);
    });

    document.getElementById('tab-bugs').innerHTML =
      '<section class="panel"><div class="panel-head"><h2>Bug reports</h2></div>' +
        '<div class="stats">' +
          statBox(bugs.filter(function (b) { return b.status === 'open'; }).length, 'Open', '', 'warn') +
          statBox(bugs.filter(function (b) { return b.severity === 'critical'; }).length, 'Critical', '', 'bad') +
          statBox(bugs.filter(function (b) { return b.status === 'fixed'; }).length, 'Fixed', '', 'good') +
          statBox(bugs.length, 'Total') +
        '</div></section>' +
      (sorted.length
        ? sorted.map(function (b) {
            return '<article class="panel"><div class="panel-head">' +
              '<h2 style="font-size:17px">' + UI.esc(b.title) + '</h2>' +
              '<div class="row" style="gap:8px">' +
                '<span class="pill pill-' + (b.severity === 'critical' || b.severity === 'high' ? 'inactive' : 'lead') +
                  '">' + UI.esc(String(b.severity).toUpperCase()) + '</span>' +
                '<span class="pill pill-lead">' + UI.esc(String(b.category).toUpperCase()) + '</span>' +
                '<select data-bug="' + UI.esc(b.id) + '" style="min-height:36px;padding:6px 10px;width:auto">' +
                  ['open', 'triaged', 'fixed', 'wontfix', 'duplicate'].map(function (s) {
                    return '<option value="' + s + '"' + (b.status === s ? ' selected' : '') + '>' + s + '</option>';
                  }).join('') + '</select>' +
              '</div></div>' +
              '<p class="small muted">' + UI.esc(byName[b.tester_id] || 'Anonymous') + ' · ' +
                UI.relativeTime(b.created_at) + ' · ' + UI.esc(b.device || 'unknown device') +
                ' · Android ' + UI.esc(b.android || '?') + ' · app ' + UI.esc(b.app_version || '?') + '</p>' +
              (b.description ? '<p class="small mt-s">' + UI.escLines(b.description) + '</p>' : '') +
              (b.steps ? '<p class="small mt-s"><strong>Steps:</strong><br>' + UI.escLines(b.steps) + '</p>' : '') +
              (b.expected ? '<p class="small mt-s"><strong>Expected:</strong> ' + UI.escLines(b.expected) + '</p>' : '') +
              (b.actual ? '<p class="small"><strong>Actual:</strong> ' + UI.escLines(b.actual) + '</p>' : '') +
              (b.attachment ? '<p class="small mt-s"><a href="' + UI.esc(b.attachment) +
                '" target="_blank" rel="noopener noreferrer" style="text-decoration:underline">Attachment</a></p>' : '') +
              '</article>';
          }).join('')
        : '<section class="panel">' + UI.empty('No bugs reported',
            'Either the build is solid or nobody has played it yet. The Overview tab tells you which.') + '</section>');

    UI.qsa('[data-bug]').forEach(function (sel) {
      sel.addEventListener('change', function () {
        API.admin('/bug', { method: 'POST', body: { id: sel.getAttribute('data-bug'), status: sel.value } })
          .then(function () { UI.toast('Status updated', 'ok'); return refresh(); })
          .catch(function (err) { UI.toast(err.message || 'Could not update.', 'err'); });
      });
    });
  }

  // ── render: IDEAS ──────────────────────────────────────────────────────
  function renderIdeas() {
    let ideas = (state.data.ideas || []).slice().sort(function (a, b) { return b.votes - a.votes; });
    document.getElementById('tab-ideas').innerHTML =
      '<section class="panel"><div class="panel-head"><h2>Feature requests</h2>' +
        '<a class="btn btn-g btn-sm" href="ideas.html" target="_blank" rel="noopener">Public board →</a></div>' +
        (ideas.length
          ? ideas.map(function (i) {
              return '<div class="idea"><div class="vote" style="cursor:default">' +
                '<span class="count">' + Number(i.votes || 0) + '</span></div>' +
                '<div style="min-width:0"><h3>' + UI.esc(i.title) + '</h3>' +
                (i.description ? '<p>' + UI.escLines(i.description) + '</p>' : '') +
                (i.why ? '<p class="small"><em>Why: ' + UI.escLines(i.why) + '</em></p>' : '') +
                '<div class="row mt-s"><select data-idea="' + UI.esc(i.id) +
                  '" style="min-height:36px;padding:6px 10px;width:auto">' +
                  ['new', 'considering', 'planned', 'building', 'shipped', 'declined'].map(function (s) {
                    return '<option value="' + s + '"' + (i.status === s ? ' selected' : '') + '>' + s + '</option>';
                  }).join('') + '</select>' +
                  '<span class="small muted">' + UI.relativeTime(i.created_at) + '</span></div>' +
                '</div></div>';
            }).join('')
          : UI.empty('No ideas yet',
              'The board fills once testers are playing. Point them at it in your Day 5 message — it is the highest-signal thing you can ask for.')) +
      '</section>';

    UI.qsa('[data-idea]').forEach(function (sel) {
      sel.addEventListener('change', function () {
        API.admin('/idea', { method: 'POST', body: { id: sel.getAttribute('data-idea'), status: sel.value } })
          .then(function () { UI.toast('Status updated', 'ok'); return refresh(); })
          .catch(function (err) { UI.toast(err.message || 'Could not update.', 'err'); });
      });
    });
  }

  // ── render: LINKS & QR ─────────────────────────────────────────────────
  function renderLinks() {
    document.getElementById('tab-links').innerHTML =
      '<section class="panel"><div class="panel-head"><h2>Create a recruitment link</h2></div>' +
        '<p class="sub">Every link carries its source through signup, so the Funnel tab can tell you which channel is ' +
          'actually producing testers who play — not just people who clicked.</p>' +
        '<form class="form" id="link-form">' +
          '<div class="row" style="align-items:flex-start;gap:14px">' +
            '<div class="field" style="flex:1 1 200px"><label for="l-source">Source</label>' +
              '<select id="l-source">' + (API.config.sources || []).map(function (s) {
                return '<option value="' + UI.esc(s) + '">' + UI.esc(s) + '</option>';
              }).join('') + '</select></div>' +
            '<div class="field" style="flex:1 1 200px"><label for="l-campaign">Campaign <span class="muted">(optional)</span></label>' +
              '<input id="l-campaign" maxlength="60" placeholder="android-beta-wave-1" /></div>' +
            '<div class="field" style="flex:1 1 180px"><label for="l-page">Landing page</label>' +
              '<select id="l-page">' +
                '<option value="">Landing page (best for cold traffic)</option>' +
                '<option value="join.html">Straight to sign-up</option>' +
                '<option value="ideas.html">Ideas board</option>' +
                '<option value="community.html">Community</option>' +
              '</select></div>' +
          '</div>' +
        '</form>' +
        '<div class="mono mt-m" id="link-out"></div>' +
        '<div class="row mt-m">' +
          '<button class="btn btn-p" id="copy-link" type="button">Copy link</button>' +
          '<button class="btn btn-g" id="download-qr" type="button">Download QR (SVG)</button>' +
        '</div>' +
        '<div class="mt-m" id="qr-out"></div>' +
      '</section>' +

      '<section class="panel"><div class="panel-head"><h2>Ready-made links</h2></div>' +
        '<p class="sub">One per channel, already tracked. Copy and go.</p>' +
        '<div class="tablewrap"><table><thead><tr><th>Source</th><th>Link</th><th></th></tr></thead><tbody>' +
          (API.config.sources || []).map(function (s) {
            let url = buildLink(s, '', '');
            return '<tr><td><strong>' + UI.esc(s) + '</strong></td>' +
              '<td class="wrap-cell"><span class="small">' + UI.esc(url) + '</span></td>' +
              '<td><button class="btn btn-g btn-sm" data-copy="' + UI.esc(url) + '">Copy</button></td></tr>';
          }).join('') + '</tbody></table></div></section>';

    let form = document.getElementById('link-form');
    function update() {
      let url = buildLink(
        document.getElementById('l-source').value,
        document.getElementById('l-campaign').value.trim(),
        document.getElementById('l-page').value
      );
      document.getElementById('link-out').textContent = url;
      let svg = window.QR ? window.QR.svg(url, 5) : null;
      document.getElementById('qr-out').innerHTML = svg
        ? '<div class="row"><div style="background:#fff;padding:8px;border-radius:12px;display:inline-block">' +
          svg + '</div><p class="small muted" style="max-width:280px">Point a phone camera at this. ' +
          'Works on a poster, a stream overlay, or a slide — and it carries the same source tracking as the link.</p></div>'
        : '<p class="small muted">That link is too long to encode as a QR code — shorten the campaign name.</p>';
    }
    form.addEventListener('input', update);
    form.addEventListener('change', update);
    update();

    document.getElementById('copy-link').addEventListener('click', function () {
      UI.copy(document.getElementById('link-out').textContent);
    });
    document.getElementById('download-qr').addEventListener('click', function () {
      let svg = UI.qs('#qr-out svg');
      if (!svg) { UI.toast('No QR to download.', 'warn'); return; }
      let blob = new Blob([svg.outerHTML], { type: 'image/svg+xml' });
      let url = URL.createObjectURL(blob);
      let a = document.createElement('a');
      a.href = url;
      a.download = 'deeplife-beta-qr-' + document.getElementById('l-source').value + '.svg';
      document.body.appendChild(a); a.click(); document.body.removeChild(a);
      window.setTimeout(function () { URL.revokeObjectURL(url); }, 1000);
      UI.toast('QR downloaded', 'ok');
    });
    UI.qsa('[data-copy]').forEach(function (b) {
      b.addEventListener('click', function () { UI.copy(b.getAttribute('data-copy')); });
    });
  }

  function buildLink(source, campaign, page) {
    let base = (API.config.siteBase || '').replace(/\/+$/, '/') || '/';
    let url = base + (page || '');
    let params = [];
    if (source) params.push('source=' + encodeURIComponent(source));
    if (campaign) params.push('campaign=' + encodeURIComponent(campaign));
    return params.length ? url + '?' + params.join('&') : url;
  }

  // ── render: MARKETING ──────────────────────────────────────────────────
  function renderMarketing() {
    let host = document.getElementById('tab-marketing');
    host.innerHTML =
      '<section class="panel"><div class="panel-head"><h2>Marketing centre</h2></div>' +
        '<p class="sub">Ready-to-post copy per platform, with the tracked link already substituted. ' +
          'Post it yourself, in your own voice, where it is welcome — nothing here is bulk-sent, and nothing ' +
          'in it claims anything the build does not do.</p>' +
        '<div class="row"><label class="sr-only" for="m-platform">Platform</label>' +
          '<select id="m-platform" style="flex:1 1 220px">' + C.marketing.map(function (p, i) {
            return '<option value="' + i + '">' + UI.esc(p.platform) + '</option>';
          }).join('') + '</select>' +
          '<label class="sr-only" for="m-campaign">Campaign</label>' +
          '<input id="m-campaign" placeholder="Campaign tag (optional)" style="flex:1 1 200px" maxlength="60" />' +
        '</div>' +
        '<div id="m-out" class="mt-m"></div>' +
      '</section>' +

      '<section class="panel"><div class="panel-head"><h2>Social post generator</h2></div>' +
        '<p class="sub">Pick a platform, a goal, a topic and a tone. Every line it produces is built from a real ' +
          'game system — it composes copy, it does not invent features.</p>' +
        '<div class="row">' +
          '<div class="field" style="flex:1 1 160px"><label for="g-platform">Platform</label>' +
            '<select id="g-platform">' + C.marketing.map(function (p) {
              return '<option value="' + UI.esc(p.key) + '">' + UI.esc(p.platform) + '</option>';
            }).join('') + '</select></div>' +
          '<div class="field" style="flex:1 1 180px"><label for="g-goal">Goal</label>' +
            '<select id="g-goal">' + C.generator.goals.map(function (g) {
              return '<option>' + UI.esc(g) + '</option>';
            }).join('') + '</select></div>' +
          '<div class="field" style="flex:1 1 160px"><label for="g-topic">Topic</label>' +
            '<select id="g-topic">' + Object.keys(C.generator.topics).map(function (t) {
              return '<option>' + UI.esc(t) + '</option>';
            }).join('') + '</select></div>' +
          '<div class="field" style="flex:1 1 140px"><label for="g-tone">Tone</label>' +
            '<select id="g-tone">' + C.generator.tones.map(function (t) {
              return '<option>' + UI.esc(t) + '</option>';
            }).join('') + '</select></div>' +
        '</div>' +
        '<button class="btn btn-p mt-s" id="g-go" type="button">Generate</button>' +
        '<div id="g-out" class="mt-m"></div>' +
      '</section>' +

      '<section class="panel"><div class="panel-head"><h2>Shareable cards</h2></div>' +
        '<p class="sub">Screenshot one and post it. Every line is a real mechanic.</p>' +
        '<div class="sharecards">' + C.cards.map(function (c) {
          return '<div class="sharecard"><div class="brand-mini">DEEP LIFE SIMULATOR</div>' +
            '<div class="l">' + UI.esc(c.line) + '</div><div class="s">' + UI.esc(c.sub) + '</div></div>';
        }).join('') + '</div></section>';

    function paintPlatform() {
      let platform = C.marketing[Number(document.getElementById('m-platform').value)];
      let campaign = document.getElementById('m-campaign').value.trim();
      let link = buildLink(platform.key, campaign, '');
      document.getElementById('m-out').innerHTML =
        '<div class="notice">' + UI.esc(platform.note) + '</div>' +
        platform.posts.map(function (post, pi) {
          let sub = function (text) { return String(text).split('{{link}}').join(link); };
          return '<div class="panel mt-m" style="background:rgba(15,23,42,.5)">' +
            '<div class="panel-head"><h2 style="font-size:16px">' + UI.esc(post.goal) + '</h2>' +
              '<span class="pill pill-lead">' + UI.esc(platform.platform) + '</span></div>' +
            '<p class="small muted"><strong style="color:#fff">Headline:</strong> ' + UI.esc(post.headline) + '</p>' +
            '<div class="mono mt-s" style="white-space:pre-wrap" id="mp-' + pi + '-s">' + UI.esc(sub(post.short)) + '</div>' +
            '<div class="row mt-s"><button class="btn btn-g btn-sm" data-copytext="mp-' + pi + '-s">Copy short version</button></div>' +
            '<details class="mt-s"><summary class="small muted" style="cursor:pointer">Long version</summary>' +
              '<div class="mono mt-s" style="white-space:pre-wrap" id="mp-' + pi + '-l">' + UI.esc(sub(post.long)) + '</div>' +
              '<div class="row mt-s"><button class="btn btn-g btn-sm" data-copytext="mp-' + pi + '-l">Copy long version</button></div>' +
            '</details>' +
            '<p class="small muted mt-s"><strong style="color:#fff">CTA:</strong> ' + UI.esc(post.cta) + '<br>' +
              '<strong style="color:#fff">Image:</strong> ' + UI.esc(post.image) + '<br>' +
              '<strong style="color:#fff">Tracked link:</strong> ' + UI.esc(link) + '</p>' +
            '</div>';
        }).join('');
      wireCopyText();
    }

    document.getElementById('m-platform').addEventListener('change', paintPlatform);
    document.getElementById('m-campaign').addEventListener('input', paintPlatform);
    paintPlatform();

    document.getElementById('g-go').addEventListener('click', function () {
      let key = document.getElementById('g-platform').value;
      let goal = document.getElementById('g-goal').value;
      let topic = document.getElementById('g-topic').value;
      let tone = document.getElementById('g-tone').value;
      document.getElementById('g-out').innerHTML =
        '<div class="mono" style="white-space:pre-wrap" id="gen-text">' +
        UI.esc(generate(key, goal, topic, tone)) + '</div>' +
        '<div class="row mt-s"><button class="btn btn-g btn-sm" data-copytext="gen-text">Copy</button></div>';
      wireCopyText();
    });

    function wireCopyText() {
      UI.qsa('[data-copytext]', host).forEach(function (b) {
        b.addEventListener('click', function () {
          UI.copy(document.getElementById(b.getAttribute('data-copytext')).textContent);
        });
      });
    }
  }

  /**
   * Composes a post from real game facts. Deliberately a template engine, not a
   * copywriter: every clause it can emit is a statement about a system that
   * exists, so it cannot produce a claim the build does not back.
   */
  function generate(platformKey, goal, topic, tone) {
    let t = C.generator.topics[topic];
    let link = buildLink(platformKey, '', '');
    let mode = state.settings.mode === 'launch';

    let opener = {
      Direct: t.hook,
      Curious: 'Question for you: ' + t.hook.charAt(0).toLowerCase() + t.hook.slice(1),
      Dry: t.hook + ' Make of that what you will.',
      Hyped: t.hook.toUpperCase(),
    }[tone] || t.hook;

    let body = {
      'GET TESTERS': t.detail + '\n\nDeep Life Simulator is live on iOS. The Android build needs ' +
        (Number(state.settings.targetTesters) || 20) +
        ' closed testers before Google will let it onto the public Play Store. Free, everything unlocked, no ads.',
      'SHOW GAMEPLAY': t.detail + '\n\nScreen recording below — this is the actual build, not a mock-up.',
      'BUILD CURIOSITY': t.detail + '\n\nOne choice a week. That is the whole game.',
      'SHOW FEATURES': t.detail + '\n\nIt sits alongside 35 career tracks, property, markets, businesses, ' +
        'relationships and a family that outlives you.',
      'TEASE UPDATE': t.detail + '\n\nSomething is changing here in the next build. More soon.',
      'ANNOUNCE UPDATE': t.detail + '\n\nThis is live now in version ' + (state.settings.appVersion || 'the latest build') + '.',
      'COMMUNITY ENGAGEMENT': t.detail + '\n\nWhat would you change about it? The ideas board is open and ' +
        'top-voted items are what gets built next.',
    }[goal] || t.detail;

    let cta = mode
      ? '\n\nFree on Google Play: ' + (state.settings.playStoreUrl || link)
      : (goal === 'GET TESTERS'
          ? '\n\nJoin the Android beta (under a minute, no Google password ever asked for):\n' + link
          : '\n\n' + link);

    let tags = {
      reddit: '', discord: '', direct: '',
      tiktok: '\n\n#lifesim #simulationgame #androidgames #indiegame #mobilegame',
      instagram: '\n\n#lifesimulator #simulationgame #androidgaming #indiegame #mobilegames',
      x: '\n\n#indiedev #androidgames #buildinpublic',
      youtube: '', facebook: '', 'app-communities': '',
    }[platformKey] || '';

    return opener + '\n\n' + body + cta + tags;
  }

  // ── render: COMMS ──────────────────────────────────────────────────────
  function renderComms() {
    let m = metrics();
    document.getElementById('tab-comms').innerHTML =
      '<section class="panel"><div class="panel-head"><h2>Message templates</h2></div>' +
        '<p class="sub">Copy, personalise, send from your own inbox or Discord. This hub deliberately does ' +
          '<strong>not</strong> send anything on your behalf: a tester gave you a contact method for beta ' +
          'instructions, not for automated mail, and a one-at-a-time message from a person is what gets replies.</p>' +
        '<div class="notice mt-s"><strong>Who to send what, right now:</strong><br>' +
          (m.stalled.length ? '· <strong>Day 1</strong> → ' + m.stalled.length + ' who have not confirmed an install<br>' : '') +
          (m.noFeedback.length ? '· <strong>Day 8</strong> → ' + m.noFeedback.length + ' who played but wrote nothing<br>' : '') +
          (m.inactive.length ? '· <strong>Still opted in?</strong> → ' + m.inactive.length + ' who have gone quiet<br>' : '') +
          (!m.stalled.length && !m.noFeedback.length && !m.inactive.length ? 'Nobody needs a nudge right now.' : '') +
        '</div>' +
      '</section>' +
      C.comms.map(function (c, i) {
        return '<section class="panel"><div class="panel-head">' +
          '<h2 style="font-size:17px">' + UI.esc(c.subject) + '</h2>' +
          '<span class="pill pill-lead">' + (c.day === null ? 'AS NEEDED' : 'DAY ' + c.day) + '</span></div>' +
          '<div class="mono" style="white-space:pre-wrap" id="cm-' + i + '">' + UI.esc(c.body) + '</div>' +
          '<div class="row mt-s">' +
            '<button class="btn btn-g btn-sm" data-copycomm="cm-' + i + '">Copy</button>' +
            '<a class="btn btn-g btn-sm" href="mailto:?subject=' + encodeURIComponent(c.subject) +
              '&body=' + encodeURIComponent(c.body) + '">Open in email</a>' +
          '</div></section>';
      }).join('');

    UI.qsa('[data-copycomm]').forEach(function (b) {
      b.addEventListener('click', function () {
        UI.copy(document.getElementById(b.getAttribute('data-copycomm')).textContent);
      });
    });
  }

  // ── render: COMMUNITY ──────────────────────────────────────────────────
  function renderCommunity() {
    document.getElementById('tab-community').innerHTML =
      '<section class="panel"><div class="panel-head"><h2>Post an announcement or devlog</h2></div>' +
        '<form class="form" id="post-form">' +
          '<div class="row" style="align-items:flex-start;gap:14px">' +
            '<div class="field" style="flex:0 0 190px"><label for="p-kind">Type</label>' +
              '<select id="p-kind"><option value="announcement">Announcement</option>' +
              '<option value="devlog">Devlog</option></select></div>' +
            '<div class="field" style="flex:1 1 260px"><label for="p-title">Title</label>' +
              '<input id="p-title" maxlength="160" required /></div>' +
          '</div>' +
          '<div class="field"><label for="p-body">Body</label>' +
            '<textarea id="p-body" maxlength="8000" required style="min-height:170px"></textarea></div>' +
          '<div class="chips"><input type="checkbox" id="p-pin" /><label for="p-pin">Pin to the top</label></div>' +
          '<button class="btn btn-p" type="submit" id="p-submit">Publish</button>' +
        '</form></section>' +

      '<section class="panel"><div class="panel-head"><h2>Roadmap</h2></div>' +
        '<p class="sub">Only put things here you actually intend to build. A roadmap is a promise, and testers read it as one.</p>' +
        '<form class="form" id="rm-form">' +
          '<div class="row" style="align-items:flex-start;gap:14px">' +
            '<div class="field" style="flex:1 1 220px"><label for="rm-title">Item</label>' +
              '<input id="rm-title" maxlength="160" required /></div>' +
            '<div class="field" style="flex:0 0 180px"><label for="rm-col">Column</label>' +
              '<select id="rm-col"><option value="coming">Coming</option>' +
              '<option value="building">In development</option><option value="done">Done</option></select></div>' +
          '</div>' +
          '<div class="field"><label for="rm-detail">Detail <span class="muted">(optional)</span></label>' +
            '<input id="rm-detail" maxlength="1000" /></div>' +
          '<button class="btn btn-p" type="submit" id="rm-submit">Add to roadmap</button>' +
        '</form>' +
        '<p class="small muted mt-m">Existing items are managed on the ' +
          '<a href="community.html#roadmap" target="_blank" rel="noopener" style="text-decoration:underline">public board</a>. ' +
          'To move or remove one, add the replacement and delete the old entry from the database ' +
          '(<code>server/beta-hub/README.md</code> has the one-liner).</p>' +
      '</section>';

    document.getElementById('post-form').addEventListener('submit', function (e) {
      e.preventDefault();
      UI.withButton(document.getElementById('p-submit'), function () {
        return API.admin('/post', { method: 'POST', body: {
          kind: document.getElementById('p-kind').value,
          title: document.getElementById('p-title').value.trim(),
          body: document.getElementById('p-body').value.trim(),
          pinned: document.getElementById('p-pin').checked,
        } }).then(function () {
          document.getElementById('post-form').reset();
        });
      }, { busy: 'Publishing…', success: 'Published — it is live on the community page.' });
    });

    document.getElementById('rm-form').addEventListener('submit', function (e) {
      e.preventDefault();
      UI.withButton(document.getElementById('rm-submit'), function () {
        return API.admin('/roadmap', { method: 'POST', body: {
          title: document.getElementById('rm-title').value.trim(),
          detail: document.getElementById('rm-detail').value.trim(),
          column: document.getElementById('rm-col').value,
        } }).then(function () { document.getElementById('rm-form').reset(); });
      }, { busy: 'Adding…', success: 'Added to the roadmap' });
    });
  }

  // ── render: SETTINGS ───────────────────────────────────────────────────
  function renderSettings() {
    let s = state.settings;
    let field = function (id, label, value, hint, type) {
      return '<div class="field"><label for="' + id + '">' + UI.esc(label) + '</label>' +
        '<input id="' + id + '" type="' + (type || 'text') + '" value="' + UI.esc(value == null ? '' : value) + '" />' +
        (hint ? '<p class="hint">' + hint + '</p>' : '') + '</div>';
    };

    document.getElementById('tab-settings').innerHTML =
      '<section class="panel"><div class="panel-head"><h2>Play Store &amp; links</h2></div>' +
        '<form class="form" id="cfg-form" style="max-width:760px">' +
          field('c-beta', 'Google Play closed-test opt-in URL', s.playBetaUrl,
            'The one from Play Console → Testing → Closed testing → Testers → Copy link. Looks like ' +
            '<code>https://play.google.com/apps/testing/com.deeplife.simulator</code>. ' +
            'Until this is set, onboarding shows a "not published yet" notice instead of a dead button.', 'url') +
          field('c-store', 'Google Play production URL', s.playStoreUrl, '', 'url') +
          field('c-site', 'Game website', s.websiteUrl, '', 'url') +
          field('c-discord', 'Discord invite', s.discordUrl, '', 'url') +
          field('c-privacy', 'Privacy policy URL', s.privacyUrl, '', 'url') +
          field('c-email', 'Support email', s.supportEmail, '', 'email') +
          field('c-version', 'Current app version', s.appVersion,
            'Stamped onto every bug report, so you can tell which build a report came from.') +
          '<div class="row" style="align-items:flex-start;gap:14px">' +
            '<div class="field" style="flex:1 1 160px"><label for="c-target">Target tester count</label>' +
              '<input id="c-target" type="number" min="1" max="500" value="' + UI.esc(s.targetTesters) + '" />' +
              '<p class="hint">Google\'s closed-test minimum is 12. Aim higher so a dropout never puts you under.</p></div>' +
            '<div class="field" style="flex:1 1 160px"><label for="c-start">Beta start date</label>' +
              '<input id="c-start" type="date" value="' + UI.esc(s.betaStartDate || '') + '" />' +
              '<p class="hint">Day 0 of the 14-day continuous window.</p></div>' +
            '<div class="field" style="flex:1 1 160px"><label for="c-status">Beta status</label>' +
              '<select id="c-status">' +
                ['open', 'full', 'closed'].map(function (v) {
                  return '<option value="' + v + '"' + (s.betaStatus === v ? ' selected' : '') + '>' + v + '</option>';
                }).join('') + '</select>' +
              '<p class="hint">"full" and "closed" route new signups to the waitlist.</p></div>' +
          '</div>' +
          '<button class="btn btn-p btn-lg" type="submit" id="cfg-save">Save settings</button>' +
        '</form></section>' +

      '<section class="panel"><div class="panel-head"><h2>Mode</h2></div>' +
        '<p class="sub">Beta mode recruits testers. Launch mode turns the same hub into a download page — ' +
          'the community, ideas board, feedback and bug reporting all stay exactly where they are, and campaign ' +
          'source tracking keeps working. Flip it the day the game goes public.</p>' +
        '<div class="todo">' +
          '<div class="item' + (s.mode === 'beta' ? ' good' : '') + '">' +
            '<p><strong>BETA MODE</strong><br><span class="small muted">CTAs point at the closed test. ' +
              'The "first 20" counter is shown.</span></p>' +
            '<button class="btn btn-' + (s.mode === 'beta' ? 'g' : 'p') + ' btn-sm" data-mode="beta"' +
              (s.mode === 'beta' ? ' disabled' : '') + '>' + (s.mode === 'beta' ? 'Active' : 'Switch to beta') + '</button></div>' +
          '<div class="item' + (s.mode === 'launch' ? ' good' : '') + '">' +
            '<p><strong>LAUNCH MODE</strong><br><span class="small muted">CTAs become "Get it on Google Play". ' +
              'Tester onboarding is replaced by the store link.</span></p>' +
            '<button class="btn btn-' + (s.mode === 'launch' ? 'g' : 'p') + ' btn-sm" data-mode="launch"' +
              (s.mode === 'launch' ? ' disabled' : '') + '>' + (s.mode === 'launch' ? 'Active' : 'Switch to launch') + '</button></div>' +
        '</div></section>' +

      '<section class="panel"><div class="panel-head"><h2>Security</h2></div>' +
        '<ul class="todo">' +
          '<li class="item good"><p>Your admin token is held in <strong>sessionStorage for this tab only</strong> ' +
            'and is compared server-side against a SHA-256 hash — the plaintext is not stored anywhere, ' +
            'including in the database.</p></li>' +
          '<li class="item good"><p>Tester rows are reachable only through a per-tester capability token or this ' +
            'admin token. Row-level security is on across every table with no policies, so the anon key alone ' +
            'reads nothing.</p></li>' +
          '<li class="item"><p>To rotate the admin token, replace the hash in <code>beta_config</code> — ' +
            'the exact SQL is in <code>server/beta-hub/README.md</code>.</p></li>' +
        '</ul></section>';

    document.getElementById('cfg-form').addEventListener('submit', function (e) {
      e.preventDefault();
      UI.withButton(document.getElementById('cfg-save'), function () {
        return API.admin('/config', { method: 'POST', body: {
          playBetaUrl: document.getElementById('c-beta').value.trim(),
          playStoreUrl: document.getElementById('c-store').value.trim(),
          websiteUrl: document.getElementById('c-site').value.trim(),
          discordUrl: document.getElementById('c-discord').value.trim(),
          privacyUrl: document.getElementById('c-privacy').value.trim(),
          supportEmail: document.getElementById('c-email').value.trim(),
          appVersion: document.getElementById('c-version').value.trim(),
          targetTesters: Number(document.getElementById('c-target').value) || 20,
          betaStartDate: document.getElementById('c-start').value,
          betaStatus: document.getElementById('c-status').value,
        } }).then(refresh);
      }, { busy: 'Saving…', success: 'Settings saved — live on the public hub immediately.' });
    });

    UI.qsa('[data-mode]').forEach(function (b) {
      b.addEventListener('click', function () {
        let mode = b.getAttribute('data-mode');
        if (!window.confirm('Switch the public hub to ' + mode.toUpperCase() + ' mode? This changes what every visitor sees.')) return;
        UI.withButton(b, function () {
          return API.admin('/config', { method: 'POST', body: { mode: mode } }).then(refresh);
        }, { busy: 'Switching…', success: 'Now in ' + mode + ' mode' });
      });
    });
  }

  function renderAll() {
    renderToday();
    renderTesters();
    renderFunnel();
    renderFeedback();
    renderBugs();
    renderIdeas();
    renderLinks();
    renderMarketing();
    renderComms();
    renderCommunity();
    renderSettings();
  }

  // ── boot ───────────────────────────────────────────────────────────────
  if (!API.online()) {
    gate.innerHTML = '<h1 style="font-size:24px;font-weight:800;margin-bottom:10px">No backend configured</h1>' +
      '<p class="muted">Set <code>apiBase</code> in <code>beta-config.js</code> and deploy the ' +
      '<code>betahub</code> edge function. <code>server/beta-hub/README.md</code> has the steps.</p>';
  } else if (API.adminToken()) {
    API.admin('/overview').then(boot).catch(function () { API.setAdminToken(''); });
  }
})();
