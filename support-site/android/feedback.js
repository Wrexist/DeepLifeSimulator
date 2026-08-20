/** Feedback form. */
(function () {
  'use strict';
  let UI = window.BetaUI, API = window.BetaAPI, C = window.DLS_CONTENT;

  document.getElementById('year').textContent = String(new Date().getFullYear());
  UI.boot();
  API.track('feedback_view');

  let rating = 0, mood = '';
  let settings = API.settings(null);

  if (!API.token()) {
    let note = document.getElementById('anon-note');
    note.hidden = false;
    note.innerHTML = 'You are not signed up as a tester on this device, so this will arrive anonymously — ' +
      'which is fine, we still read it. <a href="join.html" style="text-decoration:underline">Joining</a> ' +
      'lets us follow up and credits it to your dashboard.';
  }

  document.getElementById('cats').innerHTML = C.feedbackCategories.map(function (c, i) {
    let id = 'cat' + i;
    return '<input type="checkbox" id="' + id + '" value="' + UI.esc(c) + '" />' +
      '<label for="' + id + '">' + UI.esc(c) + '</label>';
  }).join('');

  // ── stars: a real radiogroup, keyboard included ────────────────────────
  let starButtons = UI.qsa('#stars button');
  function paintStars() {
    starButtons.forEach(function (b) {
      let on = Number(b.getAttribute('data-v')) <= rating;
      b.classList.toggle('on', on);
      b.setAttribute('aria-checked', Number(b.getAttribute('data-v')) === rating ? 'true' : 'false');
      b.tabIndex = Number(b.getAttribute('data-v')) === (rating || 1) ? 0 : -1;
    });
    document.getElementById('err-rating').textContent = '';
  }
  starButtons.forEach(function (b) {
    b.addEventListener('click', function () { rating = Number(b.getAttribute('data-v')); paintStars(); });
    b.addEventListener('keydown', function (e) {
      if (e.key === 'ArrowRight' || e.key === 'ArrowUp') {
        rating = Math.min(5, (rating || 0) + 1); paintStars(); starButtons[rating - 1].focus(); e.preventDefault();
      } else if (e.key === 'ArrowLeft' || e.key === 'ArrowDown') {
        rating = Math.max(1, (rating || 2) - 1); paintStars(); starButtons[rating - 1].focus(); e.preventDefault();
      }
    });
  });
  paintStars();

  UI.qsa('#moods button').forEach(function (b) {
    b.addEventListener('click', function () {
      mood = b.getAttribute('data-v');
      UI.qsa('#moods button').forEach(function (o) {
        let on = o === b;
        o.classList.toggle('on', on);
        o.setAttribute('aria-pressed', on ? 'true' : 'false');
      });
    });
  });

  document.getElementById('fb-form').addEventListener('submit', function (e) {
    e.preventDefault();
    if (!rating) {
      document.getElementById('err-rating').textContent = 'Pick a star rating — it is the one thing we need.';
      starButtons[0].focus();
      return;
    }
    let payload = {
      rating: rating,
      mood: mood,
      categories: UI.qsa('#cats input:checked').map(function (i) { return i.value; }),
      best: document.getElementById('best').value.trim(),
      confusing: document.getElementById('confusing').value.trim(),
      change: document.getElementById('change').value.trim(),
      keep: document.getElementById('keep').value.trim(),
      stop: document.getElementById('stop').value.trim(),
      appVersion: settings.appVersion,
    };
    UI.withButton(document.getElementById('fb-submit'), function () {
      return API.submit('feedback', payload).then(function (res) {
        API.track('feedback_complete', { rating: rating });
        document.getElementById('fb-form').hidden = true;
        document.getElementById('thanks').hidden = false;
        if (res && res.gainedXp) {
          document.getElementById('thanks-sub').textContent =
            'That goes straight onto the board — and it is worth ' + res.gainedXp + ' tester XP.';
        }
        window.scrollTo({ top: 0, behavior: 'smooth' });
      }).catch(function (err) {
        // A queued submission is not a failure: tell them it is safe and let
        // them leave the page.
        if (err.queued) {
          document.getElementById('fb-form').hidden = true;
          document.getElementById('thanks').hidden = false;
          document.getElementById('thanks-sub').textContent =
            'Saved on this device — it will send itself next time you open the hub with a connection.';
        }
        throw err;
      });
    }, { busy: 'Sending…' });
  });

  if (API.online()) {
    API.publicData().then(function (data) {
      settings = API.settings(data.config);
      if (settings.privacyUrl) document.getElementById('f-privacy').href = settings.privacyUrl;
    }).catch(function () { /* the form works without it */ });
  }
})();
