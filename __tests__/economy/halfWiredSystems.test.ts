/**
 * C-12 / C-13 / C-14 — three constants that described a system nobody had
 * finished connecting to them.
 *
 * C-12 `STUDY_GROUP_BENEFITS` was exported and imported by NOTHING. All four of
 * its values were duplicated as magic numbers elsewhere, so editing the
 * constant changed nothing — except `extraProgress`, documented as "+1 extra
 * week progress per study action", which had no duplicate because it was never
 * implemented at all. `applyStudySession` has always taken a `progressBoost`
 * parameter for exactly this and every caller passed a literal 1: a fully
 * plumbed feature with the last wire missing.
 *
 * C-14 `playWithPet` rejected the player at under 10 energy — and then never
 * charged the 10. The pet paid 20 energy, the player paid nothing, so a player
 * sitting on exactly 10 could play forever without ever crossing the threshold
 * meant to stop them. The gate was decoration.
 *
 * C-13 was reported as a ~4.3x payout error (a monthly rate paid out weekly).
 * IT IS NOT, and the tests below pin down why, because the tempting "fix" was a
 * 4.33x income nerf justified by a stale comment. Every consumer treats the
 * rate as weekly — the tick's own clamp band is documented in $/member/week,
 * `initialState` seeds 4.99 so the displayed "Members/wk" matches the payout.
 * One JSDoc line said "Monthly". The line was what changed.
 *
 * 2026-08-01 audit round 4.
 */
import fs from 'fs';
import path from 'path';
import { studyExtra } from '@/contexts/game/actions/EducationActions';
import { playWithPet } from '@/contexts/game/actions/PetActions';
import { STUDY_GROUP_BENEFITS } from '@/lib/education/educationSystem';
import { BASE_MEMBERSHIP_RATE, membershipWeeklyRevenue } from '@/lib/content/monetization';
import {
  applyContentMemberships,
  MEMBERSHIP_RATE_MIN,
  MEMBERSHIP_RATE_MAX,
} from '@/contexts/game/actions/weekly/applyContentMemberships';
import { createTestGameState } from '../helpers/createTestGameState';
import type { Education, GameState } from '@/contexts/game/types';

function batched(initial: GameState) {
  let state = initial;
  const setState = ((update: React.SetStateAction<GameState>) => {
    if (typeof update !== 'function') throw new Error('non-functional updater');
    state = update(state);
  }) as React.Dispatch<React.SetStateAction<GameState>>;
  return { setState, get: () => state };
}

// ───────────────────────────── C-12 ─────────────────────────────

function enrolled(studyGroup: boolean, energy = 100): GameState {
  const base = createTestGameState();
  return createTestGameState({
    stats: { ...base.stats, energy, happiness: 100 },
    educations: [{
      id: 'edu-1',
      name: 'Test Degree',
      duration: 100,
      weeksRemaining: 100,
      completed: false,
      paused: false,
      studyGroupActive: studyGroup,
      gpa: 3.0,
      enrolledClasses: [],
    } as unknown as Education],
    weeklyStudySessions: {},
  });
}

const weeksDone = (s: GameState): number => 100 - (s.educations?.[0].weeksRemaining ?? 100);

describe('C-12 - the study group actually speeds up studying', () => {
  it('a solo study session advances one week', () => {
    const { setState, get } = batched(enrolled(false));

    studyExtra(setState, 'edu-1');

    expect(weeksDone(get())).toBe(1);
  });

  it('a study-group session advances the extra week the constant promises', () => {
    const { setState, get } = batched(enrolled(true));

    studyExtra(setState, 'edu-1');

    expect(weeksDone(get())).toBe(1 + STUDY_GROUP_BENEFITS.extraProgress);
    expect(weeksDone(get())).toBeGreaterThan(1); // the constant is not 0
  });

  it('the weekly session cap still bounds it (the anti-exploit control)', () => {
    // Doubling per-session progress must not have doubled how MANY sessions a
    // week allows — that cap is what stops a multi-year degree finishing in one
    // week, and it is the reason this boost is safe to apply at all.
    const { setState, get } = batched(enrolled(true));

    for (let i = 0; i < 10; i++) studyExtra(setState, 'edu-1');

    expect(get().weeklyStudySessions?.['edu-1']).toBe(3);
    expect(weeksDone(get())).toBe(3 * (1 + STUDY_GROUP_BENEFITS.extraProgress));
  });

  it('a session with too little energy is still rejected (the control)', () => {
    const { setState, get } = batched(enrolled(true, 5));

    studyExtra(setState, 'edu-1');

    expect(weeksDone(get())).toBe(0);
  });

  it('the constant is now the single source of truth, not a decorative copy', () => {
    const ROOT = path.join(__dirname, '..', '..');
    const read = (rel: string) => fs.readFileSync(path.join(ROOT, rel), 'utf8');

    // Each of the four values must be READ from the constant somewhere.
    expect(read('lib/education/educationSystem.ts'))
      .toMatch(/passChance \+= STUDY_GROUP_BENEFITS\.examBonus/);
    expect(read('contexts/game/actions/weekly/applyEducationProgression.ts'))
      .toMatch(/STUDY_GROUP_BENEFITS\.weeklyHappiness/);
    expect(read('contexts/game/actions/weekly/applyEducationProgression.ts'))
      .toMatch(/STUDY_GROUP_BENEFITS\.weeklyEnergyCost/);
    expect(read('contexts/game/actions/EducationActions.ts'))
      .toMatch(/STUDY_GROUP_BENEFITS\.extraProgress/);
  });

  it('and the player is told what the join fee buys', () => {
    // A $150 purchase that named no benefit is part of why nobody noticed the
    // benefit was missing.
    const app = fs.readFileSync(
      path.join(__dirname, '..', '..', 'components/mobile/EducationApp.tsx'), 'utf8',
    );

    expect(app).toMatch(/STUDY_GROUP_BENEFITS\.examBonus/);
    expect(app).toMatch(/STUDY_GROUP_BENEFITS\.extraProgress/);
  });
});

// ───────────────────────────── C-14 ─────────────────────────────

function withPet(playerEnergy: number, petEnergy = 100): GameState {
  const base = createTestGameState();
  return createTestGameState({
    stats: { ...base.stats, energy: playerEnergy },
    pets: [{
      id: 'p1', name: 'Rex', type: 'dog', age: 3,
      hunger: 80, happiness: 50, health: 80, energy: petEnergy,
    }] as never,
  });
}

describe('C-14 - playing with a pet costs the player the energy it checks for', () => {
  it('the gate is no longer free: the player pays', () => {
    const snapshot = withPet(100);
    const { setState, get } = batched(snapshot);

    const r = playWithPet(snapshot, setState, 'p1');

    expect(r.success).toBe(true);
    expect(get().stats.energy).toBeLessThan(100);
  });

  it('a player at exactly the threshold cannot play forever', () => {
    // The whole bug: at 10 energy the gate passed, nothing was deducted, so the
    // next call found 10 energy again. Infinite free pet happiness.
    const snapshot = withPet(10);
    const { setState, get } = batched(snapshot);

    playWithPet(snapshot, setState, 'p1');
    const afterFirst = get().stats.energy;
    // Second attempt reads the FRESH state, which is now below the gate.
    playWithPet(get(), setState, 'p1');

    expect(afterFirst).toBeLessThan(10);
    expect(get().stats.energy).toBe(afterFirst);
  });

  it('the pet still pays its own energy, in the same transition', () => {
    const snapshot = withPet(100);
    const { setState, get } = batched(snapshot);

    playWithPet(snapshot, setState, 'p1');

    expect(get().pets?.[0].energy).toBe(80);
    expect(get().stats.energy).toBe(90);
  });

  it('a rejected play charges nothing at all', () => {
    const snapshot = withPet(5);
    const { setState, get } = batched(snapshot);

    const r = playWithPet(snapshot, setState, 'p1');

    expect(r.success).toBe(false);
    expect(get().stats.energy).toBe(5);
    expect(get().pets?.[0].energy).toBe(100);
  });

  it('a tired PET is still refused, and neither side pays (the control)', () => {
    const snapshot = withPet(100, 10);
    const { setState, get } = batched(snapshot);

    const r = playWithPet(snapshot, setState, 'p1');

    expect(r.success).toBe(false);
    expect(get().stats.energy).toBe(100);
    expect(get().pets?.[0].energy).toBe(10);
  });

  it('the pet still gets happier when the play succeeds (the control)', () => {
    // Charging the player must not have turned the action into a pure cost.
    const snapshot = withPet(100);
    const { setState, get } = batched(snapshot);

    playWithPet(snapshot, setState, 'p1');

    expect(get().pets?.[0].happiness).toBeGreaterThan(50);
  });
});

// ───────────────────────────── C-13 ─────────────────────────────

describe('C-13 - the membership rate was weekly all along', () => {
  /**
   * These are premise tests, not fix tests. They exist so that the next reader
   * who sees "4.99 sounds monthly" has the evidence in front of them before
   * they nerf a working income stream by 4.33x.
   */
  it('the tick pays the rate once per week, not once per month', () => {
    const first = applyContentMemberships({
      gamingStreaming: { subscribers: 20_000, membershipRate: 4.99 } as never,
      currentWeek: 5,
    });

    // 5% of 20,000 = 1,000 paid members, at the weekly rate.
    expect(first.paidMembers).toBe(1000);
    expect(first.cashDelta).toBe(Math.round(1000 * 4.99));
  });

  it('and pays nothing on a second run in the same week (idempotent)', () => {
    const gs = { subscribers: 20_000, membershipRate: 4.99 } as never;
    const first = applyContentMemberships({ gamingStreaming: gs, currentWeek: 5 });
    const second = applyContentMemberships({
      gamingStreaming: first.gamingStreaming, currentWeek: 5,
    });

    expect(second.cashDelta).toBe(0);
  });

  it("the tick's own clamp band is a WEEKLY band that 4.99 sits inside", () => {
    // If 4.99 were a monthly figure, the weekly rate would be ~1.15 — still
    // inside the band, but the band's floor of 1 would be doing nothing.
    expect(BASE_MEMBERSHIP_RATE).toBeGreaterThanOrEqual(MEMBERSHIP_RATE_MIN);
    expect(BASE_MEMBERSHIP_RATE).toBeLessThanOrEqual(MEMBERSHIP_RATE_MAX);
  });

  it('the UI figure and the payout are computed the same way', () => {
    // This is the property the whole "is it monthly?" question turns on: the
    // number shown as "Members/wk" is the number that lands in cash.
    const shown = membershipWeeklyRevenue(1000, 4.99);
    const paid = applyContentMemberships({
      gamingStreaming: { subscribers: 20_000, membershipRate: 4.99 } as never,
      currentWeek: 1,
    }).cashDelta;

    expect(shown).toBe(paid);
  });

  it('the constant no longer calls itself monthly', () => {
    const src = fs.readFileSync(
      path.join(__dirname, '..', '..', 'lib/content/monetization.ts'), 'utf8',
    );
    const decl = src.slice(0, src.indexOf('export const BASE_MEMBERSHIP_RATE'));
    const jsdoc = decl.slice(decl.lastIndexOf('/**'));

    expect(jsdoc).toMatch(/WEEKLY membership rate/);
    expect(jsdoc).not.toMatch(/^\s*\*\s*Monthly membership rate/m);
  });
});
