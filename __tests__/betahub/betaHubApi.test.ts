/**
 * Contract tests between the Beta Hub front end and the `betahub` edge function.
 *
 * The two halves live in different languages and deploy separately, so nothing
 * else stops the client calling a route the server does not serve. These tests
 * read both sources and check that they agree.
 */
import * as fs from 'fs';
import * as path from 'path';

const ROOT = path.join(__dirname, '..', '..');
const HUB = path.join(ROOT, 'support-site', 'android');
const SERVER = fs.readFileSync(path.join(ROOT, 'server', 'beta-hub', 'index.ts'), 'utf8');
const SCHEMA = fs.readFileSync(path.join(ROOT, 'server', 'beta-hub', 'schema.sql'), 'utf8');
const CLIENT = fs.readFileSync(path.join(HUB, 'beta-api.js'), 'utf8');
const ADMIN = fs.readFileSync(path.join(HUB, 'admin.js'), 'utf8');

/** Every route literal the edge function actually matches. */
function serverRoutes(): Set<string> {
  const routes = new Set<string>();
  const re = /route === '([^']+)'/g;
  let match: RegExpExecArray | null;
  while ((match = re.exec(SERVER)) !== null) routes.add(match[1]);
  const sub = /sub === '([^']+)'/g;
  while ((match = sub.exec(SERVER)) !== null) routes.add('/admin' + match[1]);
  return routes;
}

describe('Beta Hub API contract', () => {
  const routes = serverRoutes();

  it('serves every public route the client calls', () => {
    ['/public', '/event', '/signup', '/me', '/feedback', '/bug', '/ideas', '/idea', '/idea/vote']
      .forEach((route) => expect(routes.has(route)).toBe(true));
  });

  it('serves every admin route the dashboard calls', () => {
    const called = new Set<string>();
    const re = /API\.admin\('([^']+)'/g;
    let match: RegExpExecArray | null;
    while ((match = re.exec(ADMIN)) !== null) called.add('/admin' + match[1].split('?')[0]);
    expect(called.size).toBeGreaterThan(5);
    called.forEach((route) => expect({ route, served: routes.has(route) })
      .toEqual({ route, served: true }));
  });

  it('every table the function writes to exists in the schema', () => {
    const tables = new Set<string>();
    const re = /db\('(beta_[a-z_]+)/g;
    let match: RegExpExecArray | null;
    while ((match = re.exec(SERVER)) !== null) tables.add(match[1]);
    const re2 = /db\(`(beta_[a-z_]+)/g;
    while ((match = re2.exec(SERVER)) !== null) tables.add(match[1]);
    expect(tables.size).toBeGreaterThan(5);
    tables.forEach((table) => expect({ table, declared: SCHEMA.includes(`public.${table} (`) })
      .toEqual({ table, declared: true }));
  });

  it('the RPC the function calls is defined in the schema', () => {
    expect(SERVER).toContain("rpc('beta_cast_vote'");
    expect(SCHEMA).toContain('function public.beta_cast_vote(p_idea uuid, p_tester uuid)');
  });
});

describe('Beta Hub API - security posture', () => {
  it('enables row-level security on every table it creates', () => {
    const created = (SCHEMA.match(/create table if not exists public\.(beta_[a-z_]+)/g) ?? [])
      .map((line) => line.replace(/.*public\./, ''));
    expect(created.length).toBeGreaterThan(8);
    created.forEach((table) => {
      const rls = new RegExp(`alter table public\\.${table}\\s+enable row level security`).test(SCHEMA);
      expect({ table, rls }).toEqual({ table, rls: true });
    });
  });

  it('never lets the settings form write the admin token', () => {
    // A config allow-list that included admin_token would turn the settings
    // page into privilege escalation for anyone who reached it once.
    expect(SERVER).toContain('WRITABLE_CONFIG_KEYS');
    const defaults = /const CONFIG_DEFAULTS[\s\S]*?\n};/.exec(SERVER) as RegExpExecArray;
    expect(defaults[0]).not.toContain('admin_token');
    expect(SERVER).toContain(".filter(([key]) => WRITABLE_CONFIG_KEYS.includes(key))");
  });

  it('never returns the admin token, even to an authenticated admin', () => {
    expect(SERVER).toContain("if (row.key === 'admin_token') continue;");
  });

  it('compares the admin token as a hash, in constant time', () => {
    expect(SERVER).toContain('timingSafeEqual');
    expect(SERVER).toMatch(/const digest = await sha256\(token\);/);
  });

  it('refuses admin routes outright when no token is configured', () => {
    expect(SERVER).toContain("admin token is not configured on this deployment");
  });

  it('neutralises spreadsheet formula injection in the CSV export', () => {
    // A tester nickname of `=HYPERLINK(...)` would otherwise execute when the
    // export is opened in Sheets or Excel.
    expect(SERVER).toMatch(/\/\^\[=\+\\-@\\t\\r\]\/\.test\(s\)/);
  });

  it('caps every string that reaches the database', () => {
    expect(SERVER).toContain('return trimmed.slice(0, max);');
  });

  it('rate-limits the unauthenticated write endpoints', () => {
    ["'signup'", "'feedback'", "'bug'", "'idea'", "'event'"]
      .forEach((scope) => expect(SERVER).toContain(`rateLimited(req, ${scope}`));
  });

  it('stores a salted hash rather than the caller IP', () => {
    expect(SERVER).toMatch(/const bucket = \(await sha256\(/);
    expect(SERVER).toMatch(/SALTED\s+\*?\s*HASH/);
    // and the IP itself is never a column value
    expect(SCHEMA).not.toMatch(/\bip\s+(text|inet)\b/);
  });
});

describe('Beta Hub API - no fake engagement', () => {
  it('reads nothing from Google Play and claims nothing about it', () => {
    // Every funnel flag is the tester's own confirmation. Nothing here polls,
    // scrapes or infers Play Store state - the whole system would be
    // untrustworthy the moment it pretended otherwise.
    [SERVER, CLIENT, ADMIN].forEach((source) => {
      expect(/googleapis|androidpublisher|play\.google\.com\/apps\/testing\/api/i.test(source))
        .toBe(false);
    });
  });

  it('awards XP only on a genuine first-time transition', () => {
    // `!tester[step]` is the whole anti-farm rule: a re-submitted form or a
    // double-tapped button re-checks against the stored row and pays once.
    expect(SERVER).toContain('if (body[camel] === true && !tester[step])');
    expect(SERVER).toContain("if (!done.includes(mission))");
  });

  it('counts a vote atomically in the database, not in the client', () => {
    expect(SCHEMA).toContain('on conflict do nothing');
    expect(SCHEMA).toContain('set votes = votes + 1');
    // The client must not invent the tally; it renders whatever the server returns.
    const ideas = fs.readFileSync(path.join(HUB, 'ideas.js'), 'utf8');
    expect(ideas).toContain("if (idea && typeof res.votes === 'number') idea.votes = res.votes;");
  });
});

describe('Beta Hub client - degrades instead of breaking', () => {
  it('guards every storage access against a browser that throws', () => {
    // Private-mode Safari and locked-down Android browsers throw on
    // localStorage rather than returning null.
    expect(CLIENT).toMatch(/function get\(key\) \{\s*try \{/);
    expect(CLIENT).toMatch(/function set\(key, value\) \{\s*try \{/);
  });

  it('queues a failed submission instead of dropping it', () => {
    expect(CLIENT).toContain('queue(kind, payload)');
    expect(CLIENT).toContain('flushQueue');
    expect(CLIENT).toContain('Saved on this device');
  });

  it('never lets analytics break a page', () => {
    expect(CLIENT).toMatch(/track: function[\s\S]*?catch\(function \(\) \{ \/\* analytics must never break a page \*\/ \}\)/);
  });

  it('times out a hung request rather than spinning forever', () => {
    expect(CLIENT).toContain('AbortController');
    expect(CLIENT).toContain('15000');
  });

  it('keeps first-touch attribution when the visitor wanders before signing up', () => {
    expect(CLIENT).toContain('captureAttribution');
    expect(CLIENT).toMatch(/if \(!stored \|\| \(!stored\.source && incoming\.source\)\)/);
  });
});
