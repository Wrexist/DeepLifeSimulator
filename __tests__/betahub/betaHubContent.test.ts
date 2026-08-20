/**
 * Content and client-logic tests for the Beta Hub.
 *
 * The hub's copy makes claims about the game. A landing page that promises a
 * feature the build does not have converts a visitor into a disappointed
 * tester, which is worse than not converting them — so the numbers in the copy
 * are checked against the source they came from.
 */
import * as fs from 'fs';
import * as path from 'path';
import * as vm from 'vm';

const ROOT = path.join(__dirname, '..', '..');
const HUB = path.join(ROOT, 'support-site', 'android');

interface HubWindow {
  DLS_BETA?: Record<string, unknown>;
  DLS_CONTENT?: Record<string, any>;
  BetaUI?: Record<string, any>;
  QR?: Record<string, any>;
  [key: string]: unknown;
}

/** Runs hub scripts in a sandbox with just enough browser shape to load. */
function loadHub(files: string[]): HubWindow {
  const win: HubWindow = {};
  const sandbox: Record<string, unknown> = {
    window: win,
    document: {
      documentElement: { classList: { add: () => undefined } },
      querySelectorAll: () => [],
      querySelector: () => null,
    },
    navigator: { userAgent: 'node' },
    crypto: { getRandomValues: (a: Uint8Array) => a },
    unescape,
    escape,
  };
  sandbox.self = sandbox;
  const context = vm.createContext(sandbox);
  files.forEach((file) => {
    vm.runInContext(fs.readFileSync(path.join(HUB, file), 'utf8'), context, { filename: file });
  });
  return win;
}

describe('Beta Hub content', () => {
  const win = loadHub(['beta-config.js', 'beta-content.js']);
  const C = win.DLS_CONTENT as Record<string, any>;
  const CFG = win.DLS_BETA as Record<string, any>;

  it('exposes every section the pages render', () => {
    ['pillars', 'paths', 'shots', 'faq', 'missions', 'badges', 'levels',
      'feedbackCategories', 'bugCategories', 'cards', 'marketing', 'generator', 'comms']
      .forEach((key) => expect(Array.isArray(C[key]) || typeof C[key] === 'object').toBe(true));
  });

  it('quotes career numbers that match lib/careers', () => {
    const careers = fs.readFileSync(path.join(ROOT, 'lib', 'careers', 'careerData.ts'), 'utf8');
    const advanced = fs.readFileSync(path.join(ROOT, 'lib', 'careers', 'advancedCareers.ts'), 'utf8');
    const trackCount = (careers.match(/^\s+id: '/gm) ?? []).length +
      (advanced.match(/^\s+id: '/gm) ?? []).length;
    const minSalary = /MIN_ENTRY_WEEKLY_SALARY = (\d+)/.exec(careers);
    const maxSalary = /TOP_WEEKLY_SALARY_CEILING = (\d+)/.exec(careers);

    const copy = JSON.stringify(C);
    expect(copy).toContain(`${trackCount} career`);
    expect(copy).toContain(`$${(minSalary as RegExpExecArray)[1]}`);
    expect(copy).toContain(
      `$${Number((maxSalary as RegExpExecArray)[1]).toLocaleString('en-US')}`,
    );
  });

  it('quotes a scenario count that matches lib/scenarios', () => {
    const scenarios = fs.readFileSync(
      path.join(ROOT, 'lib', 'scenarios', 'scenarioDefinitions.ts'), 'utf8');
    const count = (scenarios.match(/^ {4}id: '/gm) ?? []).length;
    const landing = fs.readFileSync(path.join(HUB, 'index.html'), 'utf8');
    expect(landing).toContain(`${count} WAYS TO START`);
  });

  it('names only scenarios that actually exist', () => {
    const scenarios = fs.readFileSync(
      path.join(ROOT, 'lib', 'scenarios', 'scenarioDefinitions.ts'), 'utf8');
    const named = C.paths
      .map((p: { note: string }) => /Scenario: ([^.]+)\./.exec(p.note))
      .filter(Boolean)
      .map((m: RegExpExecArray) => m[1]);
    expect(named.length).toBeGreaterThan(2);
    named.forEach((name: string) => expect(scenarios).toContain(`name: '${name}'`));
  });

  it('promises no monetary reward for testing', () => {
    // Paying for testers is exactly what gets production access denied, and the
    // brief forbids it. A stray "get paid" in a marketing template would be a
    // claim we cannot honour.
    const copy = JSON.stringify(C).toLowerCase();
    [/paid to test/, /get paid/, /cash reward/, /earn money by testing/, /gift card/]
      .forEach((pattern) => expect(pattern.test(copy)).toBe(false));
  });

  it('never asks a tester for a Google credential', () => {
    // The one password field in the whole hub is the ADMIN token on admin.html,
    // which is the operator's own credential. No tester-facing page may collect
    // a password of any kind — Google Play handles the opt-in itself, and a
    // form that asked would be indistinguishable from a phishing page.
    const testerPages = fs.readdirSync(HUB)
      .filter((f) => /\.html$/.test(f) && f !== 'admin.html');
    testerPages.forEach((file) => {
      const text = fs.readFileSync(path.join(HUB, file), 'utf8');
      expect({ file, hasPasswordInput: /type="password"/.test(text) })
        .toEqual({ file, hasPasswordInput: false });
    });

    // And the sign-up form says so out loud, because "we will never ask" is the
    // sentence that makes a stranger's recruitment link safe to act on.
    const join = fs.readFileSync(path.join(HUB, 'join.html'), 'utf8');
    expect(join).toMatch(/never ask for your Google password/i);
  });

  it('every marketing template carries a link placeholder and a real platform note', () => {
    C.marketing.forEach((platform: any) => {
      expect(typeof platform.note).toBe('string');
      expect(platform.note.length).toBeGreaterThan(20);
      expect(platform.posts.length).toBeGreaterThan(0);
      platform.posts.forEach((post: any) => {
        ['goal', 'headline', 'short', 'long', 'cta', 'image']
          .forEach((k) => expect(typeof post[k]).toBe('string'));
        // Either the copy carries the tracked link inline, or it uses the
        // platform's own convention (TikTok and Instagram strip links from
        // captions, so those posts say "link in bio" and the admin panel
        // surfaces the tracked URL separately for the operator to paste there).
        const body = post.short + post.long;
        expect(body.includes('{{link}}') || /link in bio/i.test(body)).toBe(true);
      });
    });
  });

  it('every generator topic has a hook and a detail', () => {
    Object.keys(C.generator.topics).forEach((topic) => {
      expect(C.generator.topics[topic].hook.length).toBeGreaterThan(10);
      expect(C.generator.topics[topic].detail.length).toBeGreaterThan(10);
    });
  });

  it('mission and badge ids are unique — a duplicate would double-award XP', () => {
    const missionIds = C.missions.map((m: { id: string }) => m.id);
    expect(new Set(missionIds).size).toBe(missionIds.length);
    const badgeIds = C.badges.map((b: { id: string }) => b.id);
    expect(new Set(badgeIds).size).toBe(badgeIds.length);
  });

  it('the XP ladder only ever increases', () => {
    for (let i = 1; i < C.levels.length; i++) {
      expect(C.levels[i]).toBeGreaterThan(C.levels[i - 1]);
    }
  });

  it('bug categories match the ones the API accepts', () => {
    const server = fs.readFileSync(path.join(ROOT, 'server', 'beta-hub', 'index.ts'), 'utf8');
    // A category the server rejects would silently become "other", losing the
    // triage signal the form asked the tester for.
    const allowed = /\['crash', 'gameplay', 'ui', 'save', 'economy', 'performance', 'audio', 'ads', 'iap', 'other'\]/;
    expect(allowed.test(server)).toBe(true);
    expect(C.bugCategories).toEqual(
      ['crash', 'gameplay', 'ui', 'save', 'economy', 'performance', 'audio', 'ads', 'iap', 'other'],
    );
  });

  it('the public config carries no secret and points at the deployed function', () => {
    expect(typeof CFG.apiBase).toBe('string');
    expect(CFG.apiBase).toContain('/functions/v1/betahub');
    expect(Object.keys(CFG)).not.toContain('adminToken');
    expect(CFG.fallback.playBetaUrl).toBe('');
  });

  it('comms templates cover the whole 14-day window', () => {
    const days = C.comms
      .map((c: { day: number | null }) => c.day)
      .filter((d: number | null): d is number => d !== null);
    expect(Math.min(...days)).toBe(0);
    expect(Math.max(...days)).toBeGreaterThanOrEqual(14);
  });
});

describe('Beta Hub UI helpers', () => {
  const win = loadHub(['beta-config.js', 'beta-content.js', 'beta-ui.js']);
  const UI = win.BetaUI as Record<string, any>;

  it('escapes user text before it reaches innerHTML', () => {
    expect(UI.esc('<img src=x onerror=alert(1)>'))
      .toBe('&lt;img src=x onerror=alert(1)&gt;');
    expect(UI.esc('"quoted" & \'single\''))
      .toBe('&quot;quoted&quot; &amp; &#39;single&#39;');
  });

  it('escapes before turning newlines into breaks', () => {
    expect(UI.escLines('<b>a</b>\nb')).toBe('&lt;b&gt;a&lt;/b&gt;<br>b');
  });

  it('computes levels from the ladder without overshooting the top', () => {
    expect(UI.level(0).level).toBe(1);
    expect(UI.level(0).pct).toBe(0);
    expect(UI.level(60).level).toBe(2);
    const top = UI.level(99999);
    expect(top.next).toBeNull();
    expect(top.pct).toBe(100);
  });

  it('reports funnel completion only for steps actually confirmed', () => {
    const none = UI.funnelSteps({ installed: false, played: false }, 0);
    expect(none.filter((s: { done: boolean }) => s.done).length).toBe(1); // joined
    const all = UI.funnelSteps({ installed: true, played: true }, 2);
    expect(all.every((s: { done: boolean }) => s.done)).toBe(true);
  });

  it('picks the same mission all day for the same tester', () => {
    const missions = (win.DLS_CONTENT as Record<string, any>).missions;
    const a = UI.missionOfTheDay(missions, 'tester-1');
    const b = UI.missionOfTheDay(missions, 'tester-1');
    expect(a.id).toBe(b.id);
    expect(missions.some((m: { id: string }) => m.id === a.id)).toBe(true);
  });

  it('survives an empty mission list rather than throwing on render', () => {
    expect(UI.missionOfTheDay([], 'x')).toBeNull();
  });
});
