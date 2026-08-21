/**
 * The Work tab opens on Career.
 *
 * It opened on Street Hustle — the $20-a-tap filler — so the first thing the
 * screen offered was the least valuable thing on it, and the career ladder (the
 * actual progression system, and the thing every other system feeds off) sat
 * one tap behind a segment a player had no reason to press.
 *
 * Source-level, like the other layout guards in this directory: the assertion
 * is about which segment is selected on mount and in what order they render,
 * neither of which needs a mounted tree to state.
 */
import fs from 'fs';
import path from 'path';

const src = fs.readFileSync(
  path.join(process.cwd(), 'app', '(tabs)', 'work.tsx'),
  'utf8',
);

describe('Work tab', () => {
  it('lands on the Career tab', () => {
    expect(src).toMatch(/useState<'street' \| 'career' \| 'skills'>\('career'\)/);
    expect(src).not.toMatch(/useState<'street' \| 'career' \| 'skills'>\('street'\)/);
  });

  it('renders Career as the first segment', () => {
    const segments = /segments=\{\[([\s\S]*?)\]\}/.exec(src)?.[1] ?? '';
    const order = [...segments.matchAll(/key: '(\w+)'/g)].map((m) => m[1]);
    expect(order).toEqual(['career', 'street', 'skills']);
  });

  it('no longer force-switches the tab from an effect', () => {
    // The old one-shot fired once per life for a jobless player under $1,000
    // and burned `hasSeenJobTutorial` doing it. With Career as the default its
    // only firing would land on the tab already shown — leaving a
    // `setGameState` on every Work open for a broke player, dirtying the save
    // and re-rendering for no visible change.
    expect(src).not.toMatch(/setActiveTab\('career'\);\s*\n\s*\/\/ Mark that we've shown/);
    expect(src).not.toMatch(/hasSeenJobTutorial: true/);
  });

  it('still offers all three segments (the control)', () => {
    // A "fix" that dropped Street Hustle would also pass the assertions above.
    for (const key of ['career', 'street', 'skills']) {
      expect(src).toContain(`key: '${key}'`);
      expect(src).toContain(`activeTab === '${key}'`);
    }
  });
});
