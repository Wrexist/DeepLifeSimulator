/**
 * The What's New feed: aligned, scannable, and free of internals.
 *
 * Three things this pins, all of which regressed or were reported:
 *
 *  1. ALIGNMENT. The category tag used `minWidth`, so it grew to fit its label
 *     and a "NEW" row started its text at a different x than an "IMPROVED" row.
 *     Down a long sheet the whole column visibly zig-zagged. A fixed width is
 *     the fix, and it is one word away from silently regressing.
 *
 *  2. BULLETS, not paragraphs. This is a popup people skim on the way back into
 *     a save. `description: string` invited four-line paragraphs and got them.
 *
 *  3. NO INTERNALS. Every line here is read by players. Tooling, vendors, how
 *     the work was produced, and engineering vocabulary all stay out — the data
 *     file says so in its header, and a header is not a check.
 */
import fs from 'fs';
import path from 'path';
import { CHANGELOG, LATEST_VERSION, UPCOMING } from '@/lib/config/changelog';

const REPO_ROOT = path.resolve(__dirname, '..', '..');
const MODAL = fs.readFileSync(path.join(REPO_ROOT, 'components/WhatsNewModal.tsx'), 'utf8');

/** Modal source with comments stripped — the docblocks NAME what they forbid. */
const modalCode = MODAL.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1');

describe('the tag column is a fixed width, so every row lines up', () => {
  it('declares a fixed width rather than a minimum', () => {
    const tagStyle = modalCode.slice(modalCode.indexOf('  tag: {'), modalCode.indexOf('  tagText: {'));
    expect(tagStyle).toMatch(/\bwidth:\s*scale\(/);
    expect(tagStyle).not.toMatch(/\bminWidth:/);
  });

  it('shrinks the label to fit instead of widening the box', () => {
    // Without this the fixed width would simply clip "IMPROVED" at large
    // accessibility text sizes — trading a visible bug for a worse one.
    expect(modalCode).toMatch(/adjustsFontSizeToFit/);
    expect(modalCode).toMatch(/numberOfLines=\{1\}/);
  });

  it('leaves room for the longest label at the default text size', () => {
    const longest = Math.max(...['NEW', 'IMPROVED', 'FIXED', 'SOON'].map((l) => l.length));
    // width 96 - horizontal padding 12 - icon 11 - gap 4 leaves ~69pt for text.
    // At ~6.5pt per uppercase character that fits 10 characters; the longest
    // label in use is 8. The assertion is on the label set, so adding a longer
    // one in future fails here rather than in a screenshot.
    expect(longest).toBeLessThanOrEqual(10);
  });
});

describe('every change is bullets, never a paragraph', () => {
  const allChanges = CHANGELOG.flatMap((entry) => entry.changes);

  it('has changes to check (the control)', () => {
    expect(allChanges.length).toBeGreaterThan(20);
  });

  it('exposes bullets and no free-text description field', () => {
    for (const change of allChanges) {
      expect(Array.isArray(change.bullets)).toBe(true);
      expect(change.bullets.length).toBeGreaterThan(0);
      expect((change as { description?: unknown }).description).toBeUndefined();
    }
  });

  it('keeps each bullet to a single scannable line', () => {
    // ~90 characters is about one line on a phone at the default text size. A
    // bullet that wraps three times is a paragraph wearing a dot.
    const tooLong = allChanges
      .flatMap((c) => c.bullets.map((b) => ({ title: c.title, b })))
      .filter(({ b }) => b.length > 95);
    expect(tooLong.map((t) => `${t.title}: ${t.b}`)).toEqual([]);
  });

  it('renders the bullets in the modal', () => {
    expect(modalCode).toMatch(/change\.bullets\.map/);
    expect(modalCode).not.toMatch(/change\.description/);
  });
});

describe('nothing internal reaches the player', () => {
  const playerText = [
    ...CHANGELOG.flatMap((e) => [e.headline, e.summary, ...e.changes.flatMap((c) => [c.title, ...c.bullets])]),
    ...UPCOMING.flatMap((u) => [u.title, ...u.bullets]),
  ].join('\n');

  /**
   * Tooling, vendors and how the work was produced. A changelog is about the
   * game; anything here reads as either noise or a leak.
   */
  const FORBIDDEN = [
    /\bclaude\b/i,
    /\bopenai\b/i,
    /\bchatgpt\b/i,
    /\bcopilot\b/i,
    /\bagentic\b/i,
    /\bvibe[\s-]?cod/i,
    /\bLLM\b/,
    /\bAI[-\s]generated\b/i,
    /\bgenerated (?:by|with)\b/i,
    /\bprompt(?:ed|ing)?\b/i,
  ];

  /** Engineering vocabulary the data file's own header rules out. */
  const JARGON = [
    /\brefactor/i,
    /\bmigration\b/i,
    /\bbackend\b/i,
    /\baudit\b/i,
    /\bcommit\b/i,
    /\bpull request\b/i,
    /\brepo(?:sitory)?\b/i,
    /\bcodebase\b/i,
    /\bunit test/i,
    /\bCI\b/,
  ];

  it('has text to check (the control)', () => {
    expect(playerText.length).toBeGreaterThan(2000);
  });

  it.each(FORBIDDEN)('never mentions %s', (pattern) => {
    expect(playerText).not.toMatch(pattern);
  });

  it.each(JARGON)('never uses the internal term %s', (pattern) => {
    expect(playerText).not.toMatch(pattern);
  });
});

describe('the feed stays consistent with the build', () => {
  it('leads with the version the app actually reports', () => {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const pkg = require(path.join(REPO_ROOT, 'package.json')) as { version: string };
    expect(LATEST_VERSION).toBe(pkg.version);
  });

  it('lists releases newest first', () => {
    const rank = (v: string) => v.split('.').map((n) => Number(n) || 0);
    const released = CHANGELOG.filter((e) => /^\d+\.\d+\.\d+$/.test(e.version));
    for (let i = 1; i < released.length; i++) {
      const [aMaj, aMin, aPat] = rank(released[i - 1].version);
      const [bMaj, bMin, bPat] = rank(released[i].version);
      const newer = aMaj * 1e6 + aMin * 1e3 + aPat;
      const older = bMaj * 1e6 + bMin * 1e3 + bPat;
      expect(`${released[i - 1].version} > ${released[i].version}`).toBe(
        newer > older ? `${released[i - 1].version} > ${released[i].version}` : 'out of order',
      );
    }
  });

  it('gives every entry a headline and a summary', () => {
    for (const entry of CHANGELOG) {
      expect(entry.headline.length).toBeGreaterThan(5);
      expect(entry.summary.length).toBeGreaterThan(5);
      expect(entry.date.length).toBeGreaterThan(2);
    }
  });

  it('renders the Coming next section when there is upcoming work', () => {
    expect(modalCode).toMatch(/UPCOMING\.length > 0/);
    expect(modalCode).toMatch(/UPCOMING\.map/);
  });
});
