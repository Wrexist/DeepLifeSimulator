/**
 * Boot-error surfacing regression guard (audit H5)
 *
 * `app/_layout.tsx` installs global error handlers at module-eval time and
 * stashes whatever they capture in a module-level `layoutEarlyError`. The fatal
 * "App Initialization Error" screen used to read a SNAPSHOT of that value taken
 * on the same synchronous pass (`const earlyInitError = getEarlyInitError()`),
 * so it was frozen at `null` forever and the screen could never render — a boot
 * crash produced a blank app instead of the diagnostic this file exists for.
 *
 * The same shape killed the Metro-connection screen: `metroConnectionHealthy`
 * was assigned inside a `setTimeout`, and its only reader was a `useState`
 * initializer that had already run. That apparatus is deleted.
 *
 * These are source-level assertions on purpose. The defect is not observable by
 * rendering — the frozen-snapshot version renders identically to the fixed one
 * unless a real error happens to be captured in the millisecond window between
 * module eval and mount, which is exactly why it survived. What CAN be pinned
 * is the shape: no module-scope snapshot, and a live subscription instead.
 */

import * as fs from 'fs';
import * as path from 'path';

const LAYOUT_PATH = path.resolve(__dirname, '..', '..', 'app', '_layout.tsx');
const source = fs.readFileSync(LAYOUT_PATH, 'utf8');

describe('boot-error surfacing (H5)', () => {
  it('does not snapshot the early-init error into a module-level binding', () => {
    // The exact regression: a top-level `const earlyInitError = getEarlyInitError()`.
    // Matched at column 0 so the in-component `useState(() => getEarlyInitError())`
    // (which is indented, and re-reads at mount) does not trip it.
    const moduleScopeSnapshot = /^(?:const|let|var)\s+\w*[eE]arlyInitError\w*\s*(?::[^=]+)?=\s*getEarlyInitError\(\)/m;
    expect(source).not.toMatch(moduleScopeSnapshot);
  });

  it('exposes a subscriber so a late-captured error reaches the screen', () => {
    expect(source).toContain('function subscribeEarlyInitError');
    // Every capture site must go through the notifying setter, or the listener
    // never fires and the read path is dead again.
    expect(source).toContain('function setEarlyError');
    // Exactly one raw assignment may exist — the one inside `setEarlyError`
    // itself. Any other is a capture site that skips the notification.
    const rawAssignments = source.match(/^\s*layoutEarlyError\s*=/gm) ?? [];
    expect(rawAssignments).toHaveLength(1);
    expect(source).toMatch(/function setEarlyError[^}]*layoutEarlyError = error;/);
  });

  it('subscribes from RootLayout rather than reading a stale value', () => {
    expect(source).toContain('subscribeEarlyInitError((error)');
  });

  it('has no Metro-connection apparatus left', () => {
    // Comments explaining the deletion are fine; code referencing the deleted
    // symbols is not.
    const codeOnly = source
      .split('\n')
      .filter((line) => !line.trim().startsWith('//') && !line.trim().startsWith('*'))
      .join('\n');
    expect(codeOnly).not.toContain('metroConnectionHealthy');
    expect(codeOnly).not.toContain('metroConnectionError');
    expect(codeOnly).not.toContain('checkMetroConnection');
    expect(codeOnly).not.toContain('MetroConnectionError');
  });
});

describe('cold-start boot path has no fabricated delays (H9)', () => {
  const INDEX_PATH = path.resolve(__dirname, '..', '..', 'app', 'index.tsx');
  const PRELOAD_PATH = path.resolve(__dirname, '..', '..', 'hooks', 'usePreload.ts');
  const indexSource = fs.readFileSync(INDEX_PATH, 'utf8');
  const preloadSource = fs.readFileSync(PRELOAD_PATH, 'utf8');

  it('usePreload does not sleep in place of work', () => {
    // `new Promise(resolve => setTimeout(resolve, N))` is a bare sleep; the hook
    // had 450 ms of them standing in for work that lives elsewhere now.
    expect(preloadSource).not.toMatch(/new Promise\(\s*resolve\s*=>\s*setTimeout\(\s*resolve/);
  });

  it('the loader has exactly one named minimum-splash constant', () => {
    expect(indexSource).toContain('MIN_SPLASH_MS');
    // The scripted progress script is gone — it narrated work nobody was doing.
    expect(indexSource).not.toContain('loadingSteps');
    expect(indexSource).not.toContain('Welcome to DeepLife!');
  });

  it('bounds the startup health-check poll', () => {
    expect(indexSource).toContain('HEALTH_POLL_MAX_ATTEMPTS');
    expect(indexSource).toContain('healthPollTimerRef');
  });
});
