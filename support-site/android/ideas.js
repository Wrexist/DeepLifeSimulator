/** Feature request board with voting. */
(function () {
  'use strict';
  let UI = window.BetaUI, API = window.BetaAPI;

  document.getElementById('year').textContent = String(new Date().getFullYear());
  UI.boot();
  API.track('ideas_view');

  let state = { ideas: [], voted: [], sort: 'trending' };
  let list = document.getElementById('list');

  let STATUS_PILL = {
    new: 'lead', considering: 'invited', planned: 'joined',
    building: 'installed', shipped: 'completed', declined: 'inactive',
  };

  document.getElementById('open-new').addEventListener('click', function () {
    let form = document.getElementById('new-idea');
    form.hidden = false;
    document.getElementById('join-hint').hidden = Boolean(API.token());
    document.getElementById('i-title').focus();
  });
  document.getElementById('close-new').addEventListener('click', function () {
    document.getElementById('new-idea').hidden = true;
  });

  UI.qsa('.tabs button').forEach(function (b) {
    b.addEventListener('click', function () {
      state.sort = b.getAttribute('data-sort');
      UI.qsa('.tabs button').forEach(function (o) {
        o.setAttribute('aria-selected', o === b ? 'true' : 'false');
      });
      paint();
    });
  });

  /**
   * "Trending" is votes weighted against age, so a two-week-old idea with 9
   * votes does not permanently outrank a two-day-old one with 7. Without the
   * decay, Trending and Most Requested would be the same list under different
   * names — two tabs that lie about being different.
   */
  function trendScore(idea) {
    let ageDays = Math.max(0.5, (Date.now() - new Date(idea.created_at).getTime()) / 86400000);
    return (idea.votes + 1) / Math.pow(ageDays + 1, 0.7);
  }

  function sorted() {
    let items = state.ideas.slice();
    if (state.sort === 'top') return items.sort(function (a, b) { return b.votes - a.votes; });
    if (state.sort === 'new') {
      return items.sort(function (a, b) { return new Date(b.created_at) - new Date(a.created_at); });
    }
    if (state.sort === 'planned') {
      return items.filter(function (i) {
        return ['planned', 'building', 'shipped'].indexOf(i.status) >= 0;
      }).sort(function (a, b) { return b.votes - a.votes; });
    }
    return items.sort(function (a, b) { return trendScore(b) - trendScore(a); });
  }

  function paint() {
    let items = sorted();
    if (!items.length) {
      list.innerHTML = state.sort === 'planned'
        ? UI.empty('Nothing on the roadmap from here yet',
            'Ideas move onto the roadmap once they have votes behind them. Vote for the ones you want.',
            'See all ideas', '#')
        : UI.empty('No ideas yet',
            'Be the first. The board is genuinely how the next features get chosen — an empty board just means nobody has asked yet.',
            'Propose a feature', '#');
      let cta = UI.qs('.empty .btn', list);
      if (cta) {
        cta.addEventListener('click', function (e) {
          e.preventDefault();
          if (state.sort === 'planned') { state.sort = 'trending'; UI.qsa('.tabs button')[0].click(); }
          else document.getElementById('open-new').click();
        });
      }
      return;
    }

    list.innerHTML = items.map(function (i) {
      let hasVoted = state.voted.indexOf(i.id) >= 0;
      return '<article class="idea">' +
        '<button class="vote" type="button" data-id="' + UI.esc(i.id) + '" ' +
          'aria-pressed="' + (hasVoted ? 'true' : 'false') + '" ' +
          'aria-label="Vote for ' + UI.esc(i.title) + '">' +
          '<span class="arrow" aria-hidden="true">▲</span>' +
          '<span class="count">' + Number(i.votes || 0) + '</span></button>' +
        '<div style="min-width:0">' +
          '<h3>' + UI.esc(i.title) + '</h3>' +
          (i.description ? '<p>' + UI.escLines(i.description) + '</p>' : '') +
          (i.why ? '<p class="small"><em>Why: ' + UI.escLines(i.why) + '</em></p>' : '') +
          '<div class="meta">' +
            '<span class="pill pill-' + (STATUS_PILL[i.status] || 'lead') + '">' +
              UI.esc(String(i.status).toUpperCase()) + '</span>' +
            '<span class="pill pill-lead">' + UI.esc(String(i.priority).toUpperCase()) + '</span>' +
            '<span class="muted" style="align-self:center">' + UI.relativeTime(i.created_at) + '</span>' +
          '</div>' +
        '</div></article>';
    }).join('');

    UI.qsa('.vote', list).forEach(function (button) {
      button.addEventListener('click', function () { vote(button); });
    });
  }

  function vote(button) {
    let id = button.getAttribute('data-id');
    if (!API.token()) {
      UI.toast('Join the beta to vote — it takes under a minute.', 'warn');
      window.setTimeout(function () { window.location.href = 'join.html'; }, 1200);
      return;
    }
    if (button.getAttribute('aria-pressed') === 'true') {
      UI.toast('You have already voted for this one.', 'warn');
      return;
    }
    // The server is the authority on whether the vote counted; the UI does not
    // guess. A double tap is refused there, not here, so the number on screen
    // is always the number in the database.
    button.disabled = true;
    API.vote(id).then(function (res) {
      button.disabled = false;
      if (res.already) { UI.toast('You had already voted for that one.', 'warn'); }
      state.voted.push(id);
      let idea = state.ideas.filter(function (i) { return i.id === id; })[0];
      if (idea && typeof res.votes === 'number') idea.votes = res.votes;
      paint();
      API.track('idea_vote');
    }).catch(function (err) {
      button.disabled = false;
      UI.toast(err.message || 'Could not register that vote.', 'err');
    });
  }

  document.getElementById('new-idea').addEventListener('submit', function (e) {
    e.preventDefault();
    let title = document.getElementById('i-title').value.trim();
    let field = document.getElementById('i-title').closest('.field');
    if (!title) {
      document.getElementById('err-i-title').textContent = 'Name it in one line.';
      field.classList.add('invalid');
      return;
    }
    document.getElementById('err-i-title').textContent = '';
    field.classList.remove('invalid');

    UI.withButton(document.getElementById('i-submit'), function () {
      return API.submit('idea', {
        title: title,
        description: document.getElementById('i-desc').value.trim(),
        why: document.getElementById('i-why').value.trim(),
        priority: document.getElementById('i-priority').value,
      }).then(function () {
        document.getElementById('new-idea').reset();
        document.getElementById('new-idea').hidden = true;
        API.track('idea_submit');
        return load();
      });
    }, { busy: 'Posting…', success: 'Posted. Your own vote is already on it.' });
  });

  function load() {
    if (!API.online()) {
      list.innerHTML = UI.empty('The ideas board is offline',
        'We could not reach the beta service. Everything else on the hub still works — try again in a moment.');
      return Promise.resolve();
    }
    list.innerHTML = UI.skeleton(4);
    return API.ideas().then(function (data) {
      state.ideas = data.ideas || [];
      state.voted = data.voted || [];
      paint();
    }).catch(function (err) {
      list.innerHTML = UI.errorState(err.message || 'Could not load the board.', 'retry-ideas');
      document.getElementById('retry-ideas').addEventListener('click', load);
    });
  }

  load();
})();
