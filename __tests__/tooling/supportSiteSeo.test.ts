/**
 * The support site is the one page about the game that search engines and AI
 * assistants read directly. These checks keep the parts they rely on from
 * silently rotting: every page says where it lives (canonical), the sitemap
 * only lists pages that exist, the structured data parses, and the IndexNow
 * key the deploy workflow sends matches the key file the engines fetch.
 */
import * as fs from 'fs';
import * as path from 'path';

const SITE = path.join(__dirname, '..', '..', 'support-site');
const BASE = 'https://wrexist.github.io/DeepLifeSimulator/';
const PAGES = ['index.html', 'features.html', 'guide.html', 'gallery.html', 'whats-new.html', 'support.html', 'privacy.html'];

const read = (rel: string): string => fs.readFileSync(path.join(SITE, rel), 'utf8');

describe('support site SEO', () => {
  it.each(PAGES)('%s has a canonical URL, a description and a title naming the game', (page) => {
    const html = read(page);
    const canonical = html.match(/<link rel="canonical" href="([^"]+)"/);
    expect(canonical?.[1]).toBe(BASE + (page === 'index.html' ? '' : page));
    expect(html).toMatch(/<meta name="description" content="[^"]{50,}"/);
    expect(html).toMatch(/<title>[^<]*Deep Life Simulator[^<]*<\/title>/);
  });

  it('lists only pages that exist in the sitemap', () => {
    const locs = [...read('sitemap.xml').matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1]);
    expect(locs.length).toBeGreaterThanOrEqual(PAGES.length);
    for (const loc of locs) {
      expect(loc.startsWith(BASE)).toBe(true);
      let rel = loc.slice(BASE.length);
      if (rel === '' || rel.endsWith('/')) rel += 'index.html';
      expect(fs.existsSync(path.join(SITE, rel))).toBe(true);
    }
  });

  it('ships structured data that parses, with FAQ answers matching the visible FAQ', () => {
    for (const page of ['index.html', 'guide.html']) {
      const blocks = [...read(page).matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)];
      expect(blocks.length).toBeGreaterThan(0);
      for (const b of blocks) expect(() => JSON.parse(b[1])).not.toThrow();
    }
    const index = read('index.html');
    const faq = [...index.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)]
      .map((b) => JSON.parse(b[1]))
      .find((d) => d['@type'] === 'FAQPage');
    const visible = [...index.matchAll(/<summary>(.*?)<\/summary>/g)].map((m) => m[1]);
    expect(faq.mainEntity.map((q: { name: string }) => q.name)).toEqual(visible);
  });

  it('sends the IndexNow key that the key file holds', () => {
    const workflow = fs.readFileSync(path.join(__dirname, '..', '..', '.github', 'workflows', 'deploy-support-site.yml'), 'utf8');
    const key = workflow.match(/INDEXNOW_KEY:\s*([0-9a-f]{32})/)?.[1];
    expect(key).toBeDefined();
    expect(read(`${key}.txt`).trim()).toBe(key);
  });
});
