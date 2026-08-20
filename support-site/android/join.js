/**
 * Onboarding. Two stages on one page so the transition from "form" to
 * "instructions" costs no navigation and no round trip.
 */
(function () {
  'use strict';
  let UI = window.BetaUI, API = window.BetaAPI, C = window.DLS_CONTENT;

  document.getElementById('year').textContent = String(new Date().getFullYear());
  UI.boot();
  API.track('join_view');

  let settings = API.settings(null);
  let stageForm = document.getElementById('stage-form');
  let stageSteps = document.getElementById('stage-steps');
  let form = document.getElementById('signup');

  // ── prefill from what we already know ──────────────────────────────────
  let deviceGuess = UI.guessDevice();
  if (deviceGuess) document.getElementById('device').value = deviceGuess;
  let attrSource = API.attribution.source;
  if (attrSource && attrSource !== 'direct') {
    let found = document.getElementById('found');
    if (UI.qsa('option', found).some(function (o) { return o.value === attrSource; })) {
      found.value = attrSource;
    }
  }

  // ── contact field follows the contact-method picker ────────────────────
  let kindSelect = document.getElementById('contactKind');
  let contactField = document.getElementById('contact-field');
  let contactInput = document.getElementById('contact');
  let contactLabel = document.getElementById('contact-label');

  function syncContactField() {
    let kind = kindSelect.value;
    if (kind === 'none') {
      contactField.hidden = true;
      contactInput.value = '';
      return;
    }
    contactField.hidden = false;
    if (kind === 'email') {
      contactLabel.textContent = 'Email address';
      contactInput.type = 'email';
      contactInput.placeholder = 'you@example.com';
    } else if (kind === 'discord') {
      contactLabel.textContent = 'Discord handle';
      contactInput.type = 'text';
      contactInput.placeholder = 'yourname';
    } else {
      contactLabel.textContent = 'How to reach you';
      contactInput.type = 'text';
      contactInput.placeholder = 'Telegram, X handle, anything';
    }
  }
  kindSelect.addEventListener('change', syncContactField);
  syncContactField();

  function setError(fieldId, message) {
    let field = document.getElementById(fieldId).closest('.field');
    document.getElementById('err-' + fieldId).textContent = message || '';
    field.classList.toggle('invalid', Boolean(message));
    return !message;
  }

  // ── submit ─────────────────────────────────────────────────────────────
  form.addEventListener('submit', function (e) {
    e.preventDefault();
    let nickname = document.getElementById('nickname').value.trim();
    let kind = kindSelect.value;
    let contact = contactInput.value.trim();

    let ok = setError('nickname', nickname ? '' : 'We need something to call you.');
    if (kind === 'email' && contact && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(contact)) {
      ok = setError('contact', 'That email address does not look right.') && ok;
    } else if (kind !== 'none' && !contact) {
      ok = setError('contact', 'Add it here, or choose “Don’t contact me” above.') && ok;
    } else {
      setError('contact', '');
    }
    if (!ok) {
      UI.qs('.field.invalid input').focus();
      return;
    }

    let payload = {
      nickname: nickname,
      contactKind: kind,
      contact: kind === 'none' ? '' : contact,
      country: document.getElementById('country').value.trim(),
      device: document.getElementById('device').value.trim(),
      ageRange: document.getElementById('ageRange').value,
    };
    let found = document.getElementById('found').value;
    if (found && (!API.attribution.source || API.attribution.source === 'direct')) {
      API.attribution.source = found;
    }

    UI.withButton(document.getElementById('submit-join'), function () {
      if (!API.online()) throw new Error('The beta sign-up is offline right now. Try again shortly.');
      return API.signup(payload).then(function (data) {
        API.track('signup_complete');
        showSteps(data.tester, data.waitlisted, settings);
      });
    }, { busy: 'Signing you up…' });
  });

  // ── stage 2 ────────────────────────────────────────────────────────────
  function markRail(tester) {
    [['r-join', true], ['r-install', tester.installed], ['r-play', tester.played]]
      .forEach(function (pair) {
        let el = document.getElementById(pair[0]);
        el.classList.toggle('done', Boolean(pair[1]));
        if (pair[1]) el.querySelector('.mark').textContent = '✓';
      });
    let nextId = !tester.installed ? 'r-install' : (!tester.played ? 'r-play' : 'r-feedback');
    document.getElementById(nextId).classList.add('now');
  }

  function showSteps(tester, waitlisted, s) {
    stageForm.hidden = true;
    stageSteps.hidden = false;
    window.scrollTo({ top: 0, behavior: 'smooth' });

    document.getElementById('welcome').textContent = 'Welcome, ' + tester.nickname + '.';
    markRail(tester);

    if (waitlisted || tester.waitlisted) {
      document.getElementById('welcome-status').textContent = 'On the waitlist';
      document.getElementById('welcome-sub').textContent =
        'The first wave is full — you are in the queue for the next one.';
      let note = document.getElementById('waitlist-note');
      note.hidden = false;
      note.innerHTML = '<strong>You are on the waitlist.</strong> The current wave is full. ' +
        'We promote people in the order they joined as slots open, and you will hear from us ' +
        'when yours does. Nothing to do until then.';
    }

    let betaUrl = s.playBetaUrl;
    let storeUrl = s.playStoreUrl;
    let betaBtn = document.getElementById('play-beta');
    let installBtn = document.getElementById('play-install');

    if (betaUrl) {
      betaBtn.href = betaUrl;
      installBtn.href = betaUrl;
      betaBtn.addEventListener('click', function () { API.track('play_link_click'); });
      installBtn.addEventListener('click', function () { API.track('install_link_click'); });
    } else {
      // No opt-in URL configured yet: say so plainly rather than shipping a
      // button that goes nowhere. A dead CTA is worse than a missing one.
      document.getElementById('no-link').hidden = false;
      [betaBtn, installBtn].forEach(function (b) {
        b.setAttribute('aria-disabled', 'true');
        b.classList.add('btn-g');
        b.classList.remove('btn-p');
        b.href = storeUrl || 'index.html';
      });
    }

    let mission = UI.missionOfTheDay(C.missions, tester.id);
    if (mission) {
      document.getElementById('first-mission').textContent = mission.title;
      document.getElementById('first-mission-detail').textContent = mission.detail;
    }

    wireConfirm('confirm-optin', { optedIn: true }, tester.optedIn, 'Opted in — thank you. That is the part that counts.');
    wireConfirm('confirm-install', { installed: true }, tester.installed, 'Install recorded.');
    wireConfirm('confirm-played', { played: true }, tester.played, 'Nice. Step 4 is where it gets useful for us.');
  }

  function wireConfirm(id, patch, alreadyDone, successMessage) {
    let button = document.getElementById(id);
    if (alreadyDone) {
      button.disabled = true;
      button.textContent = '✓ Done';
      return;
    }
    button.addEventListener('click', function () {
      UI.withButton(button, function () {
        return API.progress(patch).then(function (data) {
          button.disabled = true;
          button.textContent = '✓ Done';
          markRail(data.tester);
          API.track('progress', patch);
        });
      }, { busy: 'Saving…', success: successMessage });
    });
  }

  // ── boot: already a tester? skip the form ──────────────────────────────
  function applyConfig(data) {
    settings = API.settings(data && data.config);
    if (settings.privacyUrl) {
      document.getElementById('privacy-link').href = settings.privacyUrl;
      document.getElementById('f-privacy').href = settings.privacyUrl;
    }
    if (data && data.stats) {
      let target = Number(settings.targetTesters) || 20;
      let left = target - (data.stats.joined || 0);
      let cap = document.getElementById('capacity');
      cap.hidden = false;
      if (left > 0) {
        cap.className = 'notice ok mt-s';
        cap.innerHTML = '<strong>' + left + ' slot' + (left === 1 ? '' : 's') +
          ' left</strong> in the first wave of ' + target + '.';
      } else {
        cap.className = 'notice warn mt-s';
        cap.innerHTML = '<strong>The first wave is full.</strong> Sign up anyway — ' +
          'you go on the waitlist and we promote people as slots open.';
      }
    }
  }

  if (API.online()) {
    API.publicData().then(applyConfig).catch(function () { /* fall back to static copy */ });
    if (API.token()) {
      API.me().then(function (data) {
        settings = API.settings(data.config);
        showSteps(data.tester, data.tester.waitlisted, settings);
      }).catch(function (err) {
        // A token that no longer resolves (deleted account, rotated database)
        // must not strand the visitor on a dashboard they cannot reach.
        if (err.status === 404) API.clearToken();
      });
    }
  }
})();
