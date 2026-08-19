/**
 * Deep Life Simulator — Beta Hub client runtime.
 *
 * Three jobs:
 *   1. Talk to the `betahub` edge function.
 *   2. Hold the tester's capability token and the anonymous visitor id.
 *   3. Degrade honestly when the API is unreachable — a hub that shows a blank
 *      page because a fetch failed loses the tester you already paid to acquire.
 *
 * Privacy posture: the only identifiers this file creates are a random visitor
 * id (for funnel counting) and the tester token the server mints. No
 * fingerprinting, no third-party scripts, no cross-site anything.
 */
(function () {
  'use strict';

  let CFG = window.DLS_BETA || {};
  let KEY_TOKEN = 'dls_beta_token';
  let KEY_VISITOR = 'dls_beta_visitor';
  let KEY_ATTR = 'dls_beta_attribution';
  let KEY_QUEUE = 'dls_beta_queue';
  let KEY_LOCAL = 'dls_beta_local';

  // ── storage that never throws ───────────────────────────────────────────
  // Private-mode Safari and locked-down Android browsers throw on localStorage
  // access rather than returning null. An unguarded read here would take the
  // whole page down on exactly the devices we are recruiting.
  function get(key) {
    try { return window.localStorage.getItem(key); } catch (e) { return null; }
  }
  function set(key, value) {
    try { window.localStorage.setItem(key, value); return true; } catch (e) { return false; }
  }
  function del(key) {
    try { window.localStorage.removeItem(key); } catch (e) { /* nothing to do */ }
  }
  function getJson(key, fallback) {
    let raw = get(key);
    if (!raw) return fallback;
    try { return JSON.parse(raw); } catch (e) { return fallback; }
  }

  function randomId() {
    if (window.crypto && window.crypto.getRandomValues) {
      let buf = new Uint8Array(12);
      window.crypto.getRandomValues(buf);
      return Array.prototype.map.call(buf, function (b) {
        return ('0' + b.toString(16)).slice(-2);
      }).join('');
    }
    return String(Date.now()) + Math.floor(Math.random() * 1e9).toString(16);
  }

  function visitorId() {
    let id = get(KEY_VISITOR);
    if (!id) { id = randomId(); set(KEY_VISITOR, id); }
    return id;
  }

  // ── attribution ─────────────────────────────────────────────────────────
  // ?source= / ?campaign= / ?ref= are captured on FIRST touch and kept, so a
  // tester who lands from Reddit, wanders to the FAQ and signs up two days
  // later is still credited to Reddit rather than to "direct".
  function captureAttribution() {
    let params = new URLSearchParams(window.location.search);
    let stored = getJson(KEY_ATTR, null);
    let incoming = {
      source: params.get('source') || params.get('utm_source') || null,
      campaign: params.get('campaign') || params.get('utm_campaign') || null,
      ref: params.get('ref') || null,
    };
    if (!stored || (!stored.source && incoming.source)) {
      stored = {
        source: incoming.source || (stored && stored.source) || 'direct',
        campaign: incoming.campaign || (stored && stored.campaign) || null,
        ref: incoming.ref || (stored && stored.ref) || null,
        at: new Date().toISOString(),
      };
      set(KEY_ATTR, JSON.stringify(stored));
    } else if (incoming.ref && !stored.ref) {
      stored.ref = incoming.ref;
      set(KEY_ATTR, JSON.stringify(stored));
    }
    return stored;
  }

  let attribution = captureAttribution();

  // ── transport ───────────────────────────────────────────────────────────

  function apiBase() {
    return (CFG.apiBase || '').replace(/\/+$/, '');
  }

  function request(path, options) {
    options = options || {};
    let base = apiBase();
    if (!base) return Promise.reject(new Error('OFFLINE'));

    let headers = { 'Content-Type': 'application/json' };
    let token = API.token();
    if (token && options.auth !== false) headers['X-Tester-Token'] = token;
    if (options.adminToken) headers.Authorization = 'Bearer ' + options.adminToken;

    let controller = typeof AbortController !== 'undefined' ? new AbortController() : null;
    let timer = controller ? window.setTimeout(function () { controller.abort(); }, 15000) : null;

    return window.fetch(base + path, {
      method: options.method || 'GET',
      headers: headers,
      body: options.body ? JSON.stringify(options.body) : undefined,
      signal: controller ? controller.signal : undefined,
    }).then(function (res) {
      if (timer) window.clearTimeout(timer);
      let type = res.headers.get('content-type') || '';
      if (type.indexOf('text/csv') === 0 || options.raw) {
        return res.text().then(function (text) {
          if (!res.ok) throw new Error(text || ('HTTP ' + res.status));
          return text;
        });
      }
      return res.json().catch(function () { return {}; }).then(function (data) {
        if (!res.ok || data.ok === false) {
          let err = new Error(data.error || ('Request failed (' + res.status + ')'));
          err.status = res.status;
          throw err;
        }
        return data;
      });
    }).catch(function (err) {
      if (timer) window.clearTimeout(timer);
      if (err.name === 'AbortError') throw new Error('That took too long. Check your connection and try again.');
      throw err;
    });
  }

  // ── local fallback ──────────────────────────────────────────────────────
  // When the API is unreachable, a submission is NEVER silently dropped: it is
  // queued locally and the caller is told plainly that it is pending, with a
  // copy-to-clipboard escape hatch so the tester can still get it to us.
  function queue(kind, payload) {
    let q = getJson(KEY_QUEUE, []);
    q.push({ kind: kind, payload: payload, at: new Date().toISOString() });
    set(KEY_QUEUE, JSON.stringify(q.slice(-50)));
  }

  function flushQueue() {
    let q = getJson(KEY_QUEUE, []);
    if (!q.length || !apiBase()) return Promise.resolve(0);
    let remaining = [];
    let sent = 0;
    return q.reduce(function (chain, item) {
      return chain.then(function () {
        return request('/' + item.kind, { method: 'POST', body: item.payload })
          .then(function () { sent++; })
          .catch(function () { remaining.push(item); });
      });
    }, Promise.resolve()).then(function () {
      set(KEY_QUEUE, JSON.stringify(remaining));
      return sent;
    });
  }

  // ── public API ──────────────────────────────────────────────────────────

  // `const` despite being referenced from `request()` above it: that function
  // is only ever CALLED after this assignment, so there is no temporal dead
  // zone in practice — the auto-fixer cannot prove that, but we can.
  const API = {
    config: CFG,
    attribution: attribution,
    visitor: visitorId,
    hubVersion: CFG.hubVersion || '0.0.0',

    online: function () { return Boolean(apiBase()); },

    token: function () { return get(KEY_TOKEN); },
    setToken: function (value) { if (value) set(KEY_TOKEN, value); },
    clearToken: function () { del(KEY_TOKEN); del(KEY_LOCAL); },

    /** Cached copy of the tester so the dashboard paints before the fetch lands. */
    cachedTester: function () { return getJson(KEY_LOCAL, null); },
    cacheTester: function (tester) { if (tester) set(KEY_LOCAL, JSON.stringify(tester)); },

    /** Merged settings: server config wins, fallbacks fill the gaps. */
    settings: function (fromServer) {
      let merged = {};
      let fb = CFG.fallback || {};
      Object.keys(fb).forEach(function (k) { merged[k] = fb[k]; });
      if (fromServer) {
        Object.keys(fromServer).forEach(function (k) {
          if (fromServer[k] !== null && fromServer[k] !== undefined && fromServer[k] !== '') {
            merged[k] = fromServer[k];
          }
        });
      }
      return merged;
    },

    track: function (type, meta) {
      if (!apiBase()) return Promise.resolve();
      return request('/event', {
        method: 'POST',
        body: {
          type: type,
          visitor: visitorId(),
          source: attribution.source,
          campaign: attribution.campaign,
          path: window.location.pathname.split('/').pop() || 'index.html',
          meta: meta || null,
        },
      }).catch(function () { /* analytics must never break a page */ });
    },

    publicData: function () {
      return request('/public', { auth: false });
    },

    signup: function (form) {
      let body = {
        nickname: form.nickname,
        contact: form.contact,
        contactKind: form.contactKind,
        country: form.country,
        device: form.device,
        ageRange: form.ageRange,
        source: attribution.source,
        campaign: attribution.campaign,
        ref: attribution.ref,
        visitor: visitorId(),
        waitlist: Boolean(form.waitlist),
      };
      return request('/signup', { method: 'POST', body: body, auth: false })
        .then(function (data) {
          API.setToken(data.token);
          API.cacheTester(data.tester);
          return data;
        });
    },

    me: function () {
      return request('/me').then(function (data) {
        API.cacheTester(data.tester);
        return data;
      });
    },

    progress: function (patch) {
      return request('/me', { method: 'POST', body: patch }).then(function (data) {
        API.cacheTester(data.tester);
        return data;
      });
    },

    forgetMe: function () {
      return request('/me', { method: 'DELETE' }).then(function (data) {
        API.clearToken();
        return data;
      });
    },

    submit: function (kind, payload) {
      payload.hubVersion = API.hubVersion;
      return request('/' + kind, { method: 'POST', body: payload })
        .catch(function (err) {
          if (err.status) throw err;       // a real rejection — show it
          queue(kind, payload);            // a transport failure — keep it
          let offline = new Error('Saved on this device. It will send itself next time you open the hub with a connection.');
          offline.queued = true;
          throw offline;
        });
    },

    ideas: function () { return request('/ideas'); },
    vote: function (id) { return request('/idea/vote', { method: 'POST', body: { id: id } }); },

    admin: function (path, options) {
      options = options || {};
      options.adminToken = options.adminToken || API.adminToken();
      return request('/admin' + path, options);
    },

    adminToken: function () {
      try { return window.sessionStorage.getItem('dls_beta_admin') || ''; } catch (e) { return ''; }
    },
    setAdminToken: function (value) {
      // sessionStorage, not localStorage: the admin credential dies with the
      // tab rather than sitting on disk on whatever device you opened it from.
      try {
        if (value) window.sessionStorage.setItem('dls_beta_admin', value);
        else window.sessionStorage.removeItem('dls_beta_admin');
      } catch (e) { /* nothing to do */ }
    },

    flushQueue: flushQueue,
    queued: function () { return getJson(KEY_QUEUE, []).length; },
  };

  window.BetaAPI = API;

  // Anything stranded from a previous offline visit goes out now.
  if (apiBase()) { flushQueue(); }
})();
