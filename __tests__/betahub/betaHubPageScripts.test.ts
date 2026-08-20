/**
 * Load-smoke test for every Beta Hub page script.
 *
 * The hub has no build step and no browser in CI, so nothing else would catch a
 * typo, a temporal-dead-zone reference or a call to a helper that does not
 * exist — those fail at runtime, in front of a tester, on the one page we paid
 * to get them to. This runs each script against a DOM stub and asserts it gets
 * to the end without throwing, both when the API answers and when it is down.
 */
import * as fs from 'fs';
import * as path from 'path';
import * as vm from 'vm';

const HUB = path.join(__dirname, '..', '..', 'support-site', 'android');

const PAGE_SCRIPTS = [
  'landing.js', 'join.js', 'dashboard.js', 'feedback.js',
  'bug.js', 'ideas.js', 'community.js', 'admin.js',
];

interface StubElement {
  [key: string]: unknown;
}

/** A permissive element that answers whatever a page script asks of it. */
function makeElement(tag = 'div'): StubElement {
  const el: StubElement = {
    tagName: tag.toUpperCase(),
    innerHTML: '',
    outerHTML: '',
    textContent: '',
    value: '',
    href: '',
    type: 'text',
    placeholder: '',
    hidden: false,
    disabled: false,
    checked: false,
    tabIndex: 0,
    className: '',
    style: { setProperty: (): void => undefined, width: '' },
    dataset: {},
    classList: {
      add: (): void => undefined,
      remove: (): void => undefined,
      contains: (): boolean => false,
      toggle: (): boolean => false,
    },
    addEventListener: (): void => undefined,
    removeEventListener: (): void => undefined,
    setAttribute: (): void => undefined,
    removeAttribute: (): void => undefined,
    getAttribute: (): string => '',
    appendChild: (): void => undefined,
    removeChild: (): void => undefined,
    scrollIntoView: (): void => undefined,
    focus: (): void => undefined,
    click: (): void => undefined,
    reset: (): void => undefined,
    querySelector: (): StubElement => makeElement(),
    querySelectorAll: (): StubElement[] => [],
    closest: (): StubElement => makeElement(),
  };
  el.parentNode = { classList: el.classList, appendChild: () => undefined, removeChild: () => undefined };
  return el;
}

interface RunResult { errors: unknown[]; }

function runScript(file: string, opts: { apiFails: boolean }): RunResult {
  const errors: unknown[] = [];
  const store: Record<string, string> = {};

  const win: Record<string, unknown> = {
    location: { search: '?source=reddit&campaign=t', pathname: '/android/index.html', href: 'https://x/android/index.html', hash: '', reload: () => undefined },
    localStorage: {
      getItem: (k: string) => (k in store ? store[k] : null),
      setItem: (k: string, v: string) => { store[k] = v; },
      removeItem: (k: string) => { delete store[k]; },
    },
    sessionStorage: {
      getItem: () => null, setItem: () => undefined, removeItem: () => undefined,
    },
    crypto: { getRandomValues: (a: Uint8Array) => a },
    // The interesting case is failure: a landing page must still convert with
    // the backend down, so every script is run against a rejecting fetch too.
    fetch: opts.apiFails
      ? () => Promise.reject(new Error('offline'))
      : () => Promise.resolve({
          ok: true,
          headers: { get: () => 'application/json' },
          json: () => Promise.resolve({ ok: true, config: {}, stats: { joined: 3 }, posts: [], roadmap: [], ideas: [], voted: [] }),
          text: () => Promise.resolve('{}'),
        }),
    setTimeout: (fn: () => void) => { void fn; return 0; },
    clearTimeout: () => undefined,
    scrollTo: () => undefined,
    confirm: () => false,
    open: () => null,
    IntersectionObserver: class { observe(): void { /* noop */ } unobserve(): void { /* noop */ } },
    AbortController: class { signal = {}; abort(): void { /* noop */ } },
    URL, URLSearchParams, Blob, Promise, Math, JSON, Date, Number, String, Array, Object, Error, Set, Map, RegExp, isFinite,
  };

  const doc = {
    documentElement: { classList: { add: () => undefined } },
    body: { appendChild: () => undefined, removeChild: () => undefined },
    getElementById: () => makeElement(),
    querySelector: () => makeElement(),
    querySelectorAll: () => [],
    createElement: (tag: string) => makeElement(tag),
    addEventListener: () => undefined,
  };

  const sandbox: Record<string, unknown> = {
    window: win,
    document: doc,
    navigator: { userAgent: 'Mozilla/5.0 (Linux; Android 14; Pixel 8 Build/X)', clipboard: undefined },
    console: { log: () => undefined, warn: () => undefined, error: (...a: unknown[]) => errors.push(a) },
    setTimeout: win.setTimeout,
    clearTimeout: win.clearTimeout,
    fetch: win.fetch,
    URL, URLSearchParams, Blob, Promise, Uint8Array,
    unescape, escape,
  };
  Object.assign(sandbox, {
    localStorage: win.localStorage,
    sessionStorage: win.sessionStorage,
    IntersectionObserver: win.IntersectionObserver,
    AbortController: win.AbortController,
  });
  (win as Record<string, unknown>).document = doc;

  const context = vm.createContext(sandbox);
  // Same order the pages load them in.
  ['beta-config.js', 'beta-content.js', 'beta-api.js', 'beta-ui.js', 'qr.js', file].forEach((script) => {
    vm.runInContext(fs.readFileSync(path.join(HUB, script), 'utf8'), context, { filename: script });
  });
  return { errors };
}

describe('Beta Hub page scripts load without throwing', () => {
  it.each(PAGE_SCRIPTS)('%s runs to completion with the API reachable', (file) => {
    expect(() => runScript(file, { apiFails: false })).not.toThrow();
  });

  it.each(PAGE_SCRIPTS)('%s runs to completion with the API down', (file) => {
    // This is the case that matters: a page that white-screens when the backend
    // is unreachable loses the visitor we already paid to acquire.
    expect(() => runScript(file, { apiFails: true })).not.toThrow();
  });

  it('settles every pending promise without an unhandled rejection', async () => {
    const unhandled: unknown[] = [];
    const onUnhandled = (reason: unknown): void => { unhandled.push(reason); };
    process.on('unhandledRejection', onUnhandled);
    PAGE_SCRIPTS.forEach((file) => {
      runScript(file, { apiFails: true });
      runScript(file, { apiFails: false });
    });
    await new Promise((resolve) => setTimeout(resolve, 60));
    process.off('unhandledRejection', onUnhandled);
    expect(unhandled).toEqual([]);
  });
});
