/**
 * Deep Life Simulator — Beta Hub shared UI.
 *
 * Small deliberate helpers rather than a framework: the site has no build step,
 * and every kilobyte here is downloaded on a phone over mobile data before the
 * visitor has decided whether they care.
 */
(function () {
  'use strict';

  const UI = {

    /** Escape before anything user-written reaches innerHTML. */
    esc: function (value) {
      return String(value === null || value === undefined ? '' : value)
        .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
    },

    /** User text with newlines preserved, still escaped. */
    escLines: function (value) {
      return UI.esc(value).replace(/\n/g, '<br>');
    },

    qs: function (sel, root) { return (root || document).querySelector(sel); },
    qsa: function (sel, root) {
      return Array.prototype.slice.call((root || document).querySelectorAll(sel));
    },

    /** Toast. Announced politely so screen readers hear the outcome too. */
    toast: function (message, kind) {
      let host = UI.qs('#toast-host');
      if (!host) {
        host = document.createElement('div');
        host.id = 'toast-host';
        host.className = 'toast-host';
        host.setAttribute('role', 'status');
        host.setAttribute('aria-live', 'polite');
        document.body.appendChild(host);
      }
      let el = document.createElement('div');
      el.className = 'toast toast-' + (kind || 'ok');
      el.textContent = message;
      host.appendChild(el);
      window.setTimeout(function () { el.classList.add('out'); }, 4200);
      window.setTimeout(function () { if (el.parentNode) el.parentNode.removeChild(el); }, 4700);
    },

    /**
     * Every button that starts work goes through here, so loading / success /
     * failure are never left to individual call sites to remember.
     */
    withButton: function (button, work, opts) {
      opts = opts || {};
      if (!button || button.disabled) return Promise.resolve();
      let original = button.innerHTML;
      button.disabled = true;
      button.setAttribute('aria-busy', 'true');
      button.innerHTML = '<span class="spin" aria-hidden="true"></span>' + (opts.busy || 'Working…');
      return Promise.resolve()
        .then(work)
        .then(function (result) {
          button.disabled = false;
          button.removeAttribute('aria-busy');
          button.innerHTML = original;
          if (opts.success) UI.toast(opts.success, 'ok');
          return result;
        })
        .catch(function (err) {
          button.disabled = false;
          button.removeAttribute('aria-busy');
          button.innerHTML = original;
          UI.toast(err && err.message ? err.message : 'Something went wrong. Try again.',
            err && err.queued ? 'warn' : 'err');
          throw err;
        });
    },

    /** A useful empty state, never a blank panel. */
    empty: function (title, body, ctaLabel, ctaHref) {
      return '<div class="empty">' +
        '<div class="empty-mark" aria-hidden="true">◇</div>' +
        '<h3>' + UI.esc(title) + '</h3>' +
        '<p>' + UI.esc(body) + '</p>' +
        (ctaLabel ? '<a class="btn btn-p" href="' + UI.esc(ctaHref || '#') + '">' + UI.esc(ctaLabel) + '</a>' : '') +
        '</div>';
    },

    /** Failure state with a retry, for anything that fetches. */
    errorState: function (message, retryId) {
      return '<div class="empty empty-err">' +
        '<div class="empty-mark" aria-hidden="true">!</div>' +
        '<h3>Could not load that</h3>' +
        '<p>' + UI.esc(message) + '</p>' +
        '<button type="button" class="btn btn-g" id="' + UI.esc(retryId || 'retry') + '">Try again</button>' +
        '</div>';
    },

    skeleton: function (rows) {
      let out = '';
      for (let i = 0; i < (rows || 3); i++) out += '<div class="skel"></div>';
      return '<div class="skel-wrap" aria-hidden="true">' + out + '</div>';
    },

    copy: function (text) {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        return navigator.clipboard.writeText(text)
          .then(function () { UI.toast('Copied to clipboard', 'ok'); })
          .catch(function () { UI.fallbackCopy(text); });
      }
      UI.fallbackCopy(text);
      return Promise.resolve();
    },

    fallbackCopy: function (text) {
      let area = document.createElement('textarea');
      area.value = text;
      area.setAttribute('readonly', '');
      area.style.position = 'fixed';
      area.style.top = '-1000px';
      document.body.appendChild(area);
      area.select();
      try {
        document.execCommand('copy');
        UI.toast('Copied to clipboard', 'ok');
      } catch (e) {
        UI.toast('Could not copy automatically — select the text and copy it.', 'warn');
      }
      document.body.removeChild(area);
    },

    /** Level + progress from XP, using the ladder in beta-content.js. */
    level: function (xp) {
      let ladder = (window.DLS_CONTENT && window.DLS_CONTENT.levels) || [0];
      let level = 1;
      for (let i = 0; i < ladder.length; i++) if (xp >= ladder[i]) level = i + 1;
      let floor = ladder[level - 1] || 0;
      let next = ladder[level] !== undefined ? ladder[level] : null;
      return {
        level: level,
        floor: floor,
        next: next,
        pct: next === null ? 100 : Math.min(100, Math.round(((xp - floor) / (next - floor)) * 100)),
      };
    },

    /** Funnel step count a tester has completed, out of 4. */
    funnelSteps: function (tester, feedbackCount) {
      return [
        { key: 'join',     label: 'Joined',    done: Boolean(tester) },
        { key: 'install',  label: 'Installed', done: Boolean(tester && tester.installed) },
        { key: 'play',     label: 'Played',    done: Boolean(tester && tester.played) },
        { key: 'feedback', label: 'Feedback',  done: (feedbackCount || 0) > 0 },
      ];
    },

    /** Deterministic daily mission pick — the same one all day, not a re-roll per render. */
    missionOfTheDay: function (missions, seedString) {
      if (!missions || !missions.length) return null;
      let day = Math.floor(Date.now() / 86400000);
      let seed = day;
      let s = String(seedString || '');
      for (let i = 0; i < s.length; i++) seed = (seed * 31 + s.charCodeAt(i)) % 100000;
      return missions[Math.abs(seed) % missions.length];
    },

    relativeTime: function (iso) {
      if (!iso) return '—';
      let diff = Date.now() - new Date(iso).getTime();
      if (!isFinite(diff)) return '—';
      let mins = Math.round(diff / 60000);
      if (mins < 1) return 'just now';
      if (mins < 60) return mins + 'm ago';
      let hrs = Math.round(mins / 60);
      if (hrs < 24) return hrs + 'h ago';
      let days = Math.round(hrs / 24);
      if (days < 30) return days + 'd ago';
      return new Date(iso).toISOString().slice(0, 10);
    },

    /**
     * Best-effort device guess used to PREFILL the bug form. It is a
     * convenience for the tester, always editable, and never treated as fact —
     * a UA string is not identity and is not stored anywhere else.
     */
    guessDevice: function () {
      let ua = navigator.userAgent || '';
      let model = /Android[^;]*;\s*([^)]+?)\s*(?:Build|\))/i.exec(ua);
      return model && model[1] ? model[1].trim() : '';
    },

    guessAndroid: function () {
      let m = /Android\s+([\d.]+)/i.exec(navigator.userAgent || '');
      return m ? m[1] : '';
    },

    isAndroid: function () { return /Android/i.test(navigator.userAgent || ''); },

    /** Reveal-on-scroll, matching the rest of the site. Degrades to visible. */
    reveal: function () {
      document.documentElement.classList.add('js');
      if (!('IntersectionObserver' in window)) {
        UI.qsa('.reveal').forEach(function (el) { el.classList.add('in'); });
        return;
      }
      const io = new IntersectionObserver(function (entries) {
        entries.forEach(function (e) {
          if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target); }
        });
      }, { threshold: 0.12 });
      UI.qsa('.reveal').forEach(function (el) { io.observe(el); });
    },

    /** Mobile nav toggle, shared by every page's header. */
    nav: function () {
      let toggle = UI.qs('#navtoggle');
      let links = UI.qs('#navlinks');
      if (!toggle || !links) return;
      toggle.addEventListener('click', function () {
        let open = links.classList.toggle('open');
        toggle.setAttribute('aria-expanded', open ? 'true' : 'false');
      });
    },

    /** Appends the captured source/campaign to internal hub links. */
    carryAttribution: function () {
      let attr = window.BetaAPI && window.BetaAPI.attribution;
      if (!attr || !attr.source || attr.source === 'direct') return;
      UI.qsa('a[data-carry]').forEach(function (a) {
        let url = new URL(a.getAttribute('href'), window.location.href);
        if (!url.searchParams.get('source')) url.searchParams.set('source', attr.source);
        if (attr.campaign && !url.searchParams.get('campaign')) url.searchParams.set('campaign', attr.campaign);
        a.setAttribute('href', url.pathname.split('/').pop() + url.search + url.hash);
      });
    },

    boot: function () {
      UI.reveal();
      UI.nav();
      UI.carryAttribution();
    },
  };

  window.BetaUI = UI;
})();
