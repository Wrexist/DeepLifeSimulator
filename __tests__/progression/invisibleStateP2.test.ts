/**
 * Phase 2B/2C/2D — the rest of the invisible gameplay state.
 *
 * Same principle as 2A (the criminal record): logic that works and nothing
 * displays is indistinguishable, from the player's chair, from logic that is
 * broken. Five of the seven reports on 2026-08-02 were exactly that.
 *
 *   2B  criminalLevel/criminalXp   a GATE with no progress display
 *   2C  vaccinations/immunities    protection you paid for, unconfirmable
 *   2D  legacyBuffs                TIMED buffs with no timer
 *
 * 2E was triaged and deliberately produces NO code change — see the last block.
 */
import { criminalProgress, criminalXpForNextLevel, CRIMINAL_XP_PER_ILLEGAL_JOB } from '@/lib/crime/criminalRecord';
import { activeLegacyBuffs } from '@/lib/legacy/activeBuffs';
import { createTestGameState } from '../helpers/createTestGameState';
import fs from 'fs';
import path from 'path';

const repoRoot = path.join(__dirname, '..', '..');
const code = (rel: string) =>
  fs.readFileSync(path.join(repoRoot, rel), 'utf8')
    .replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');

describe('2B - criminal progression is a gate, so show progress toward it', () => {
  it('matches the curve the tick levels you up on', () => {
    // `applyStreetJobXp`: +10 XP per illegal job, level at `criminalLevel*100`.
    expect(criminalXpForNextLevel(1)).toBe(100);
    expect(criminalXpForNextLevel(3)).toBe(300);
  });

  it('level 0 and level 1 both need 100 (the `|| 1` in the tick)', () => {
    // The tick reads `(prev.criminalLevel || 1) * 100`. A display that used a
    // bare `level * 100` would promise "0 XP to next level" at level 0.
    expect(criminalXpForNextLevel(0)).toBe(criminalXpForNextLevel(1));
  });

  it('reports how many more illegal jobs the next level needs', () => {
    const p = criminalProgress(1, 70);

    expect(p.xpForNext).toBe(100);
    expect(p.jobsToNextLevel).toBe(Math.ceil(30 / CRIMINAL_XP_PER_ILLEGAL_JOB));
    expect(p.fraction).toBeCloseTo(0.7, 5);
  });

  it('a corrupt XP value cannot overflow the meter (the control)', () => {
    // `fraction` drives a bar width. Above 1 it renders past its track.
    for (const bad of [Infinity, NaN, 1e9, -5]) {
      const p = criminalProgress(1, bad);
      expect(p.fraction).toBeGreaterThanOrEqual(0);
      expect(p.fraction).toBeLessThanOrEqual(1);
    }
  });

  it('JobActions and the screen share the curve', () => {
    expect(code('contexts/game/actions/JobActions.ts'))
      .toMatch(/criminalXpForNextLevel\(prev\.criminalLevel\)/);
    expect(code('app/(tabs)/work.tsx'))
      .toMatch(/criminalProgress\(gameState\.criminalLevel, gameState\.criminalXp\)/);
  });
});

describe('2C - protection the player paid for is now confirmable', () => {
  const src = code('app/(tabs)/health.tsx');

  it('the health screen lists vaccinations and immunities', () => {
    // Both prevent real illnesses (diseaseGenerator.ts:184-197) and neither
    // appeared in any component. A $150 pneumonia vaccine that shows nowhere is
    // indistinguishable from a purchase that did not work.
    expect(src).toMatch(/gameState\.vaccinations/);
    expect(src).toMatch(/gameState\.diseaseImmunities/);
    expect(src).toMatch(/Protected against/);
  });

  it('names vaccines from the activity catalogue, not the raw id', () => {
    // So the card says "Pneumonia Vaccine", not "pneumonia_vaccine".
    expect(src).toMatch(/healthActivities \?\? \[\]\)\.find\(\(a\) => a\.id === id\)/);
  });

  it('shows nothing when the player has neither (the control)', () => {
    expect(src).toMatch(/protection\.length > 0 &&/);
  });
});

describe('2D - timed legacy buffs have a timer now', () => {
  const base = (over: Record<string, unknown> = {}) =>
    createTestGameState({ weeksLived: 100, ...over });

  it('lists an active buff with its effect and weeks remaining', () => {
    const buffs = activeLegacyBuffs(base({
      legacyBuffs: { mentor: { expiresWeeksLived: 103 } },
    }));

    expect(buffs).toHaveLength(1);
    expect(buffs[0].label).toBe('Mentor');
    expect(buffs[0].effect).toBe('+50% career progress');
    expect(buffs[0].weeksLeft).toBe(3);
  });

  it('hides one that has already lapsed', () => {
    expect(activeLegacyBuffs(base({
      legacyBuffs: { mentor: { expiresWeeksLived: 99 } },
    }))).toEqual([]);
  });

  it('treats an expiry EQUAL to now as spent, exactly like the tick does', () => {
    // `applyCareerProgress` uses `expiresWeeksLived > nextWeeksLived`. Showing a
    // buff the tick no longer applies would be a lie in the player's favour.
    expect(activeLegacyBuffs(base({
      legacyBuffs: { mentor: { expiresWeeksLived: 100 } },
    }))).toEqual([]);
  });

  it('handles both buffs, and no legacyBuffs at all (the control)', () => {
    expect(activeLegacyBuffs(base({
      legacyBuffs: { mentor: { expiresWeeksLived: 105 }, luckyCharm: { expiresWeeksLived: 102 } },
    }))).toHaveLength(2);
    expect(activeLegacyBuffs(base())).toEqual([]);
  });

  it('the work screen renders them', () => {
    expect(code('app/(tabs)/work.tsx')).toMatch(/activeLegacyBuffs\(gameState\)/);
    expect(code('app/(tabs)/work.tsx')).toMatch(/b\.weeksLeft/);
  });
});

describe('2E - triaged, and deliberately unchanged', () => {
  /*
   * Twelve fields were flagged as "logic, no UI". On inspection ELEVEN are
   * internal bookkeeping that a player has no reason to see:
   *
   *   weeksInPoverty          gates one event at >= 12 weeks
   *   computerPreviouslyOwned gates a discovery unlock
   *   retiredAtWeek           feeds retirement milestone timing
   *   zeroStatType            simulator-only
   *   socialPosts             NPC post scheduling data
   *   seasonalEvents          season bookkeeping
   *   discoveredSecrets       carried across prestige
   *   bankruptcyTriggered / totalHappiness / healthWeeks / escapedFromJail
   *
   * The twelfth, `lastDivorceWeek`, enforces a 26-week cooldown — which WOULD
   * be the UX-4 "discovered by being refused" problem, except the refusal
   * already states the remaining wait. That is verified below rather than
   * asserted in prose, because "I checked and it was fine" is worth exactly as
   * much as the check behind it.
   *
   * Recording a deliberate no-change matters: without it, the next audit
   * re-derives the same twelve names and cannot tell "not looked at" from
   * "looked at and correctly left alone".
   */
  it('the divorce cooldown tells the player how long is left', () => {
    const src = code('contexts/game/actions/DatingActions.ts');

    expect(src).toMatch(/const weeksToWait = DIVORCE_COOLDOWN_WEEKS - \(currentWeeksLived - lastDivorceWeek\)/);
    expect(src).toMatch(/You must wait \$\{weeksToWait\} more weeks/);
  });
});
