/**
 * TAB-3 (owner decision 2026-10-22): keep the Profile tab, drop its tier gate
 * and the Life tab's Stats segment, and point Home's progress card at Profile.
 *
 * Before: the Profile tab-bar button opened the screen in week 1, while the
 * Life tab's "Stats" segment and Home's "Your Progress" card both said
 * "Finish Chapter 1" - one screen, three names, and a gate that read as broken.
 */
import fs from 'fs';
import path from 'path';
import { createTestGameState } from '../helpers/createTestGameState';
import { isFeatureUnlocked } from '@/lib/progress/featureUnlocks';
import { GOAL_CATALOGUE } from '@/lib/goals/catalogue';
import { routeForSystem } from '@/lib/depth/systemRoutes';

const read = (rel: string) => fs.readFileSync(path.join(process.cwd(), rel), 'utf8');

describe('TAB-3 - Profile is the one door', () => {
  it('Profile is not tier-gated: a week-one life can open it', () => {
    const fresh = createTestGameState({ completedChapters: [], weeksLived: 0, lifeStartWeek: 0 });
    expect(isFeatureUnlocked(fresh, 'tab:progression')).toBe(true);
  });

  it('the Life tab has no Stats segment and no progression gate', () => {
    const life = read('app/(tabs)/life.tsx');
    expect(life).not.toMatch(/key: 'stats'/);
    expect(life).not.toContain('ProgressionScreenContent');
    expect(life).not.toContain("'tab:progression'");
    // An old `segment=stats` link still lands on Profile rather than dead-ending.
    expect(life).toContain("router.navigate('/(tabs)/progression')");
  });

  it("Home's card opens the Profile tab, ungated, under the same name", () => {
    const home = read('app/(tabs)/home.tsx');
    expect(home).toContain("router.push('/(tabs)/progression')");
    expect(home).not.toContain("'tab:progression'");
    expect(home).not.toMatch(/segment: 'stats'/);
    expect(home).toContain('<Text style={styles.progressLinkTitle}>Profile</Text>');
  });

  it('the tab is still a visible Profile button outside prison', () => {
    const layout = read('app/(tabs)/_layout.tsx');
    const at = layout.indexOf('name="progression"');
    const opts = layout.slice(at, layout.indexOf('/>', at));
    expect(opts).toContain("title: 'Profile'");
    expect(opts).toContain('href: isInPrison ? null : undefined');
  });

  it('goals and system links point at Profile, not the removed segment', () => {
    for (const g of GOAL_CATALOGUE) {
      expect(`${g.id}:${g.route}`).not.toContain('segment=stats');
    }
    for (const id of ['prestige', 'dynasty', 'legacy']) {
      const r = routeForSystem(id);
      expect(`${id}:${r?.pathname}:${r?.segment ?? ''}`).toBe(`${id}:/(tabs)/progression:`);
    }
  });
});
