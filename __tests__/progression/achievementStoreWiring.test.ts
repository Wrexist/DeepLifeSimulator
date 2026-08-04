/**
 * There are two achievement stores. Only one of them is real.
 *
 * `gameState.achievements` ships 52 entries from `initialState`, every one
 * `completed: false`. The only writer of `completed: true` anywhere in the repo
 * is a single `luxury_life` special case — `evaluateAchievements` is an
 * explicitly documented no-op that returns `[]`. The live store is
 * `claimedProgressAchievements`.
 *
 * Five surfaces read the dead flag, so for the whole game:
 *   - the Progression tab headline read "0/42 · 0% complete", forever;
 *   - every obituary and prestige life summary listed NO achievements;
 *   - the inheritance summary listed none;
 *   - achievement-gated secret events were unreachable.
 *
 * The repo had already hit this exact defect once — `lib/careers/advancedCareers.ts`
 * carries the comment "The old code read `achievements[].completed`, a flag never
 * set in normal play (task #65), so every achievement-gated career was
 * permanently locked" — and the fix did not propagate to the other readers.
 * 2026-07-30 audit GP-3.
 *
 * This test pins the RULE rather than any one call site: no live module may
 * decide anything by filtering on `achievements[].completed`.
 */
import fs from 'fs';
import path from 'path';
import { computeInheritance } from '@/lib/legacy/inheritance';
import { createTestGameState } from '../helpers/createTestGameState';
import type { GameState } from '@/contexts/game/types';

const REPO_ROOT = path.resolve(__dirname, '..', '..');

/** Source directories that ship in the app (tests and scripts excluded). */
const LIVE_DIRS = ['lib', 'contexts', 'components', 'app', 'hooks', 'utils', 'services', 'src'];

function walk(dir: string, out: string[] = []): string[] {
  let entries: fs.Dirent[];
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true });
  } catch {
    return out;
  }
  for (const e of entries) {
    const full = path.join(dir, e.name);
    if (e.isDirectory()) {
      if (e.name === 'node_modules' || e.name === '__tests__') continue;
      walk(full, out);
    } else if (/\.tsx?$/.test(e.name) && !/\.(test|spec|stress)\.tsx?$/.test(e.name)) {
      out.push(full);
    }
  }
  return out;
}

/** A player who has claimed achievements in the LIVE store and none in the dead one. */
function claimer(ids: string[]): GameState {
  return createTestGameState({ claimedProgressAchievements: ids });
}

describe('no live surface decides anything from the dead achievement flag', () => {
  it('has no `a.completed` filter over an achievements array outside tests', () => {
    const offenders: string[] = [];
    const pattern = /achievements[\s\S]{0,40}?\.filter\(\s*\(?\s*a[^)]*\)?\s*=>\s*a\.completed/;

    for (const dir of LIVE_DIRS) {
      for (const file of walk(path.join(REPO_ROOT, dir))) {
        const src = fs.readFileSync(file, 'utf8');
        if (pattern.test(src)) offenders.push(path.relative(REPO_ROOT, file));
      }
    }

    // Every one of these was a surface silently showing the player nothing.
    expect(offenders).toEqual([]);
  });
});

describe('the surfaces that summarise a life read the live store', () => {
  // `unlockedAchievements` is a LOCAL inside `computeInheritance` — it is fed to
  // `updateDynastyOnDeath` and never returned. Asserting on `summary.unlockedAchievements`
  // is asserting on `undefined`; guarding that with `if (Array.isArray(...))`
  // makes the whole assertion unreachable, which is the exact defect this file
  // exists to catch. Read the field the summary really carries.
  const carried = (state: GameState): string[] =>
    computeInheritance(state).updatedDynastyStats.familyAchievements;

  it('inheritance carries the achievements the player actually claimed', () => {
    expect(carried(claimer(['first_job', 'first_million', 'homeowner']))).toEqual(
      expect.arrayContaining(['first_job', 'first_million', 'homeowner']),
    );
  });

  it('reports nothing for a player who genuinely has claimed nothing', () => {
    expect(carried(claimer([]))).toEqual([]);
  });

  it('is not fooled by the deprecated array being populated', () => {
    // A save could carry `achievements` entries; they must not count, because
    // nothing in play sets `completed` on them.
    const state = createTestGameState({
      claimedProgressAchievements: ['first_job'],
      achievements: [
        { id: 'ghost_a', name: 'Ghost A', category: 'career', completed: true },
        { id: 'ghost_b', name: 'Ghost B', category: 'money', completed: true },
      ] as never,
    });

    const result = carried(state);
    expect(result).toContain('first_job');
    expect(result).not.toContain('ghost_a');
    expect(result).not.toContain('ghost_b');
  });
});
