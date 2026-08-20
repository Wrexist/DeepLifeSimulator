/**
 * Structural tests for the Beta Hub (`support-site/android/`).
 *
 * The hub is hand-written HTML/CSS/JS with no build step, which is the right
 * call for a static GitHub Pages site but removes the compiler that would
 * normally catch a broken link or a missing script. These tests are that
 * compiler: they read every page and assert the things a build would.
 */
import * as fs from 'fs';
import * as path from 'path';

const HUB = path.join(__dirname, '..', '..', 'support-site', 'android');
const SITE = path.join(__dirname, '..', '..', 'support-site');

const PAGES = [
  'index.html', 'join.html', 'dashboard.html', 'feedback.html',
  'bug.html', 'ideas.html', 'community.html', 'admin.html',
];

const read = (file: string): string => fs.readFileSync(path.join(HUB, file), 'utf8');

/** Every local href/src a page references, ignoring anchors and absolute URLs. */
function localRefs(html: string): string[] {
  const out: string[] = [];
  const re = /(?:href|src)="([^"]+)"/g;
  let match: RegExpExecArray | null;
  while ((match = re.exec(html)) !== null) {
    const ref = match[1];
    if (/^(https?:|mailto:|data:|#|\/\/)/.test(ref)) continue;
    out.push(ref.split('#')[0]);
  }
  return out.filter(Boolean);
}

describe('Beta Hub — pages exist and are wired up', () => {
  it.each(PAGES)('%s exists', (page) => {
    expect(fs.existsSync(path.join(HUB, page))).toBe(true);
  });

  it.each(PAGES)('%s references only files that exist', (page) => {
    const missing = localRefs(read(page)).filter(
      (ref) => !fs.existsSync(path.resolve(HUB, ref)),
    );
    expect(missing).toEqual([]);
  });

  it.each(PAGES)('%s loads the shared runtime in dependency order', (page) => {
    const html = read(page);
    // beta-api.js reads window.DLS_BETA, and beta-ui.js reads window.DLS_CONTENT.
    // Loading them out of order fails silently at runtime rather than loudly.
    const order = ['beta-config.js', 'beta-api.js', 'beta-ui.js']
      .map((script) => html.indexOf(script));
    expect(order.every((i) => i >= 0)).toBe(true);
    expect(order[0]).toBeLessThan(order[1]);
    expect(order[1]).toBeLessThan(order[2]);
  });

  it('every page links back to the hub landing page', () => {
    PAGES.filter((p) => p !== 'index.html').forEach((page) => {
      expect(read(page)).toContain('index.html');
    });
  });
});

describe('Beta Hub — no third-party scripts and no leaked secrets', () => {
  const sources = fs.readdirSync(HUB).filter((f) => /\.(html|js|css)$/.test(f));

  it('loads no external script, only self-hosted files and Google Fonts CSS', () => {
    PAGES.forEach((page) => {
      const scripts = read(page).match(/<script[^>]+src="([^"]+)"/g) ?? [];
      scripts.forEach((tag) => {
        expect(tag).not.toMatch(/src="https?:/);
      });
    });
  });

  it('ships no admin token, service key or bearer credential', () => {
    // The admin token is typed in by the operator and held in sessionStorage.
    // Anything token-shaped baked into a published file would be a live leak.
    const forbidden = [
      /service_role/i,
      /eyJ[A-Za-z0-9_-]{20,}\./,          // a JWT
      /sk-[A-Za-z0-9]{16,}/,              // an API key
      /admin_token['"]?\s*[:=]\s*['"][^'"]{8,}/i,
    ];
    sources.forEach((file) => {
      const text = fs.readFileSync(path.join(HUB, file), 'utf8');
      forbidden.forEach((pattern) => {
        expect({ file, hit: pattern.test(text) }).toEqual({ file, hit: false });
      });
    });
  });

  it('keeps the admin token out of localStorage — sessionStorage only', () => {
    const admin = fs.readFileSync(path.join(HUB, 'beta-api.js'), 'utf8');
    const adminBlock = admin.slice(admin.indexOf('adminToken'));
    expect(adminBlock).toContain('sessionStorage');
    expect(adminBlock.slice(0, 600)).not.toContain('localStorage');
  });

  it('marks the admin and dashboard pages noindex', () => {
    expect(read('admin.html')).toContain('name="robots" content="noindex');
    expect(read('dashboard.html')).toContain('name="robots" content="noindex');
  });
});

describe('Beta Hub — SEO and social preview', () => {
  it('the landing page carries a title, description, OG and Twitter cards', () => {
    const html = read('index.html');
    expect(html).toMatch(/<title>[^<]{20,}<\/title>/);
    expect(html).toMatch(/<meta name="description" content="[^"]{80,}"/);
    ['og:title', 'og:description', 'og:image', 'og:url', 'twitter:card', 'twitter:image']
      .forEach((tag) => expect(html).toContain(tag));
    expect(html).toContain('rel="canonical"');
  });

  it('the OG image is an absolute URL that exists in the repo', () => {
    const html = read('index.html');
    const match = /<meta property="og:image" content="([^"]+)"/.exec(html);
    expect(match).not.toBeNull();
    const url = (match as RegExpExecArray)[1];
    expect(url.startsWith('https://')).toBe(true);
    // Social scrapers do not follow relative paths, and a 404 here is an
    // invisible failure — the link just previews as a blank card.
    const file = url.replace('https://wrexist.github.io/DeepLifeSimulator/', '');
    expect(fs.existsSync(path.join(SITE, file))).toBe(true);
  });

  it('carries structured data describing the game', () => {
    const html = read('index.html');
    const match = /<script type="application\/ld\+json">([\s\S]*?)<\/script>/.exec(html);
    expect(match).not.toBeNull();
    const data = JSON.parse((match as RegExpExecArray)[1]);
    expect(data['@type']).toBe('VideoGame');
    expect(data.name).toBe('Deep Life Simulator');
  });
});

describe('Beta Hub — mobile and accessibility basics', () => {
  it.each(PAGES)('%s declares a language and a responsive viewport', (page) => {
    const html = read(page);
    expect(html).toContain('<html lang="en">');
    expect(html).toContain('width=device-width');
  });

  it.each(PAGES)('%s has a skip link and a main landmark', (page) => {
    const html = read(page);
    expect(html).toContain('class="skip"');
    expect(html).toMatch(/id="main"/);
  });

  it.each(PAGES)('%s gives every image an alt attribute', (page) => {
    const imgs = read(page).match(/<img\b[^>]*>/g) ?? [];
    imgs.forEach((tag) => expect(tag).toMatch(/\balt="/));
  });

  it.each(PAGES)('%s labels its icon-only menu button', (page) => {
    const html = read(page);
    if (!html.includes('navtoggle')) return;
    expect(html).toMatch(/id="navtoggle"[^>]*aria-label="/);
    expect(html).toMatch(/id="navtoggle"[^>]*aria-expanded="/);
  });

  it('keeps every tap target at 44px or more', () => {
    const css = fs.readFileSync(path.join(HUB, 'beta.css'), 'utf8');
    expect(css).toMatch(/\.btn\{min-height:44px\}/);
    expect(css).toMatch(/input,select,textarea\{[^}]*min-height:48px/);
  });

  it('honours prefers-reduced-motion', () => {
    const css = fs.readFileSync(path.join(HUB, 'beta.css'), 'utf8');
    expect(css).toContain('prefers-reduced-motion');
  });

  it('never lets wide content scroll the page body sideways', () => {
    const css = fs.readFileSync(path.join(HUB, 'beta.css'), 'utf8');
    // Tables are the only thing here wider than a phone; they scroll inside
    // their own container instead of pushing the page.
    expect(css).toMatch(/\.tablewrap\{overflow-x:auto/);
    expect(css).toMatch(/body\{overflow-x:hidden\}/);
  });
});

describe('Beta Hub — house style', () => {
  it('uses no one-sided decorative card borders (CLAUDE.md Hard Rule #7)', () => {
    // The app bans colored accent stripes app-wide; the hub is meant to read as
    // the same product, so the same rule holds here. Structural hairlines
    // (dividers, the sticky nav underline, table row rules) are the allowed
    // exception and are matched out below.
    const css = fs.readFileSync(path.join(HUB, 'beta.css'), 'utf8');
    const offenders = css
      .split('}')
      // The loading spinner is a rotating ring whose single colored edge IS the
      // animation — it is not a border on a card, and excluding it by rule name
      // keeps the check honest rather than widening it until it passes.
      .filter((rule) => !rule.includes('.spin'))
      .flatMap((rule) => rule.match(/border-(left|right|top|bottom)-color\s*:/g) ?? []);
    expect(offenders).toEqual([]);
  });

  it('extends the existing support-site design system rather than forking it', () => {
    PAGES.forEach((page) => {
      expect(read(page)).toContain('../styles.css');
    });
  });

  it('reuses the real screenshots instead of duplicating them', () => {
    const content = fs.readFileSync(path.join(HUB, 'beta-content.js'), 'utf8');
    const shots = content.match(/\.\.\/assets\/[a-z0-9]+\.png/g) ?? [];
    expect(shots.length).toBeGreaterThan(6);
    shots.forEach((ref) => {
      expect(fs.existsSync(path.resolve(HUB, ref))).toBe(true);
    });
  });
});

describe('Beta Hub — tab widgets are wired for assistive tech', () => {
  const tabbed = ['admin.html', 'community.html', 'ideas.html'];

  it.each(tabbed)('%s pairs every tab with the panel it controls', (page) => {
    const html = read(page);
    expect(html).toContain('role="tablist"');
    const tabs = html.match(/<button role="tab"[^>]*>/g) ?? [];
    expect(tabs.length).toBeGreaterThan(2);
    tabs.forEach((tab) => {
      expect(tab).toMatch(/aria-selected="(true|false)"/);
      const controls = /aria-controls="([^"]+)"/.exec(tab);
      // ideas.html sorts one list in place rather than switching panels, so it
      // has no panel to point at; every tab that DOES must point at a real one.
      if (controls) expect(html).toContain(`id="${controls[1]}"`);
    });
    expect(tabs.filter((t) => /aria-selected="true"/.test(t))).toHaveLength(1);
  });
});
