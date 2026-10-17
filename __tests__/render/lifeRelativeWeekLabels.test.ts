/**
 * Journal and welcome-back labels count weeks from the start of THIS life.
 *
 * `weeksLived` is absolute and seeded from the starting age, so an age-25 start
 * begins at 364: the Journal printed its first entry as "Week 365" (and "Year 8,
 * Week 1" in the detail view) and the welcome-back popup "Week 364" while the
 * HUD said week 1. CLAUDE.md §4.2; 2026-10-17 audit.
 */
import fs from 'fs';
import path from 'path';
import { formatLifeWeek } from '@/utils/formatLifeWeek';

const read = (rel: string) => fs.readFileSync(path.join(process.cwd(), rel), 'utf8');

describe('life-relative week labels', () => {
  it('labels an age-25 life by its own weeks', () => {
    expect(formatLifeWeek(365, 364)).toBe('Week 2');
    expect(formatLifeWeek(364, 364)).toBe('Week 1');
  });

  it('never prints the raw absolute counter as a week in the Journal or welcome-back popup', () => {
    for (const file of ['components/Journal.tsx', 'components/WelcomeBackPopup.tsx']) {
      const src = read(file);
      expect(src).not.toMatch(/Week \{entry\.atWeek\}/);
      expect(src).not.toMatch(/Week \{gameState\.weeksLived/);
      expect(src).toMatch(/formatLifeWeek\(/);
    }
  });

  it('anchors the Journal year/week detail to lifeStartWeek', () => {
    const src = read('components/Journal.tsx');
    const fmt = src.slice(src.indexOf('const formatWeek'), src.indexOf('const formatWeek') + 300);
    expect(fmt).toMatch(/weeksSinceLifeStart\(week, lifeStartWeek\)/);
  });
});
