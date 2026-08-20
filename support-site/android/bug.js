/** Bug report form. */
(function () {
  'use strict';
  let UI = window.BetaUI, API = window.BetaAPI, C = window.DLS_CONTENT;

  document.getElementById('year').textContent = String(new Date().getFullYear());
  UI.boot();
  API.track('bug_view');

  let settings = API.settings(null);

  if (!API.token()) {
    let note = document.getElementById('anon-note');
    note.hidden = false;
    note.innerHTML = 'You are not signed up as a tester on this device, so this arrives anonymously and we ' +
      'cannot ask you a follow-up question. <a href="join.html" style="text-decoration:underline">Join the beta</a> ' +
      'if you would rather we could.';
  }

  let LABELS = {
    crash: 'CRASH', gameplay: 'GAMEPLAY', ui: 'UI', save: 'SAVE', economy: 'ECONOMY',
    performance: 'PERFORMANCE', audio: 'AUDIO', ads: 'ADS', iap: 'IAP', other: 'OTHER',
  };
  document.getElementById('cats').innerHTML = C.bugCategories.map(function (c, i) {
    // One category per report, so radios rather than checkboxes — the schema
    // stores a single category and a checkbox set would silently drop the rest.
    return '<input type="radio" name="bugcat" id="bc' + i + '" value="' + UI.esc(c) + '"' +
      (c === 'other' ? ' checked' : '') + ' />' +
      '<label for="bc' + i + '">' + UI.esc(LABELS[c] || c) + '</label>';
  }).join('');

  // Auto-filled device context. A convenience, always editable, never treated
  // as fact — and nothing is derived from it beyond these three fields.
  document.getElementById('device').value = UI.guessDevice();
  document.getElementById('android').value = UI.guessAndroid();
  document.getElementById('appVersion').value = settings.appVersion || '';
  document.getElementById('auto-note').textContent =
    'Also attached automatically: the time you sent this, and hub version ' + API.hubVersion + '.';
  if (!UI.isAndroid()) {
    document.getElementById('auto-note').textContent +=
      ' You are not on an Android device right now, so the device fields are blank — please fill them in by hand.';
  }

  function reset() {
    document.getElementById('bug-form').hidden = false;
    document.getElementById('thanks').hidden = true;
    ['title', 'description', 'steps', 'expected', 'actual', 'attachment'].forEach(function (id) {
      document.getElementById(id).value = '';
    });
    document.getElementById('title').focus();
  }

  document.getElementById('another').addEventListener('click', reset);

  document.getElementById('bug-form').addEventListener('submit', function (e) {
    e.preventDefault();
    let title = document.getElementById('title').value.trim();
    let field = document.getElementById('title').closest('.field');
    if (!title) {
      document.getElementById('err-title').textContent = 'Give it a one-line summary — that is all we need to start.';
      field.classList.add('invalid');
      document.getElementById('title').focus();
      return;
    }
    document.getElementById('err-title').textContent = '';
    field.classList.remove('invalid');

    let checked = UI.qs('#cats input:checked');
    let payload = {
      title: title,
      category: checked ? checked.value : 'other',
      severity: document.getElementById('severity').value,
      description: document.getElementById('description').value.trim(),
      steps: document.getElementById('steps').value.trim(),
      expected: document.getElementById('expected').value.trim(),
      actual: document.getElementById('actual').value.trim(),
      attachment: document.getElementById('attachment').value.trim(),
      device: document.getElementById('device').value.trim(),
      android: document.getElementById('android').value.trim(),
      appVersion: document.getElementById('appVersion').value.trim(),
    };

    UI.withButton(document.getElementById('bug-submit'), function () {
      return API.submit('bug', payload).then(function () {
        API.track('bug_complete', { severity: payload.severity, category: payload.category });
        document.getElementById('bug-form').hidden = true;
        document.getElementById('thanks').hidden = false;
        window.scrollTo({ top: 0, behavior: 'smooth' });
      }).catch(function (err) {
        if (err.queued) {
          document.getElementById('bug-form').hidden = true;
          document.getElementById('thanks').hidden = false;
        }
        throw err;
      });
    }, { busy: 'Sending…' });
  });

  if (API.online()) {
    API.publicData().then(function (data) {
      settings = API.settings(data.config);
      let version = document.getElementById('appVersion');
      if (!version.value && settings.appVersion) version.value = settings.appVersion;
      if (settings.privacyUrl) document.getElementById('f-privacy').href = settings.privacyUrl;
    }).catch(function () { /* the form works without it */ });
  }
})();
