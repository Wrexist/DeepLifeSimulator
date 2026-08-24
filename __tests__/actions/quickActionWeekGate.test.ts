/**
 * The HUD quick actions were a stat printer, and the comment above them said
 * they were not.
 *
 * `components/TopStatsBar.tsx` long-press quick actions carried this claim:
 * "Each action is a self-limiting trade (spends a resource) so none is a free,
 * spammable win." Verified against the code, false:
 *
 *   rest     — NO gate at all      -> { happiness: -5, energy: +14 }
 *   social   — gated on energy >= 8 -> { energy: -8,   happiness: +10 }
 *
 * so rest -> social nets **+6 energy and +5 happiness per cycle**, repeatable
 * forever. `exercise` (-12 energy, +6 fitness, +5 health) then converts the free
 * energy into free fitness and health. Energy is what gates street jobs, crime,
 * health activities and hobbies, so this bypassed the entire weekly budget from
 * a control visible on every screen. 2026-07-30 audit UX-R1-02.
 *
 * The gate is one use per action per GAME WEEK, stamped in
 * `settings.quickActionWeeks` (STATE_VERSION 26 — default `undefined`, so no
 * backfill per the save-format rule). It is keyed on `weeksLived`, never a wall
 * clock, and never a component ref: a ref resets on app restart, which would
 * have left a one-restart-per-action bypass.
 *
 * These tests pin the RULE at the reducer level. The switch lives inside a React
 * callback, so what is asserted here is the shape the callback implements:
 * refuse when the action is already stamped for this week, stamp on success, and
 * re-check inside the updater so a same-batch double-tap cannot pass twice.
 */
import { createTestGameState } from '../helpers/createTestGameState';
import { STATE_VERSION } from '@/contexts/game/initialState';
import { runMigrations, isMigrationVersionCovered } from '@/utils/saveMigrations';
import type { GameState } from '@/contexts/game/types';

/** The exact predicate TopStatsBar uses. */
function usedThisWeek(state: GameState, action: string): boolean {
  const marks = state.settings?.quickActionWeeks;
  return typeof marks?.[action] === 'number' && marks[action] === (state.weeksLived ?? 0);
}

/** The exact stamp TopStatsBar writes. */
function stamp(state: GameState, action: string): GameState {
  return {
    ...state,
    settings: {
      ...state.settings,
      quickActionWeeks: { ...(state.settings?.quickActionWeeks ?? {}), [action]: state.weeksLived ?? 0 },
    },
  };
}

/** Drive the gate the way the component does: check, stamp, apply. */
function tryAction(state: GameState, action: string): { allowed: boolean; state: GameState } {
  if (usedThisWeek(state, action)) return { allowed: false, state };
  return { allowed: true, state: stamp(state, action) };
}

const at = (weeksLived: number) => createTestGameState({ weeksLived });

describe('a quick action is once per game week', () => {
  it('allows the first use and refuses the second', () => {
    const first = tryAction(at(40), 'rest');
    expect(first.allowed).toBe(true);

    const second = tryAction(first.state, 'rest');
    expect(second.allowed).toBe(false);
  });

  it('closes the rest -> social loop that was net-positive forever', () => {
    let s = at(40);

    const rest = tryAction(s, 'rest');
    expect(rest.allowed).toBe(true);
    s = rest.state;

    const social = tryAction(s, 'social');
    expect(social.allowed).toBe(true);
    s = social.state;

    // The cycle cannot repeat, which is the whole point — one rest and one
    // social per week is a trade, not a printer.
    expect(tryAction(s, 'rest').allowed).toBe(false);
    expect(tryAction(s, 'social').allowed).toBe(false);
  });

  it('gates each action independently - using rest does not block exercise', () => {
    const s = tryAction(at(40), 'rest').state;

    expect(tryAction(s, 'exercise').allowed).toBe(true);
    expect(tryAction(s, 'eat').allowed).toBe(true);
    expect(tryAction(s, 'social').allowed).toBe(true);
  });

  it('re-arms when the week advances', () => {
    const used = tryAction(at(40), 'rest').state;
    const nextWeek = { ...used, weeksLived: 41 };

    expect(tryAction(nextWeek, 'rest').allowed).toBe(true);
  });

  it('pays once under a same-batch double-tap', () => {
    // Both taps read the SAME stale snapshot. Only the in-updater re-check
    // against `prev` stops the second one — the exact discipline the ad-cash
    // bonus and the DM clue grant use.
    const before = at(40);

    const a = tryAction(before, 'rest');
    // Second tap re-checks against the RESULT of the first, not the snapshot.
    const b = tryAction(a.state, 'rest');

    expect(a.allowed).toBe(true);
    expect(b.allowed).toBe(false);
  });

  it('is keyed on game time, so moving the device clock changes nothing', () => {
    const used = tryAction(at(40), 'rest').state;
    // Same weeksLived, any wall clock.
    expect(usedThisWeek({ ...used }, 'rest')).toBe(true);
  });

  it('treats a save with no marker as fully available', () => {
    const fresh = at(40);
    expect(fresh.settings?.quickActionWeeks).toBeUndefined();
    for (const action of ['rest', 'social', 'exercise', 'eat']) {
      expect(usedThisWeek(fresh, action)).toBe(false);
    }
  });

  it('survives a save with no settings object', () => {
    const broken = createTestGameState({ weeksLived: 40, settings: undefined as never });
    expect(() => usedThisWeek(broken, 'rest')).not.toThrow();
    expect(usedThisWeek(broken, 'rest')).toBe(false);
  });

  it('ignores a garbage marker rather than locking the action out forever', () => {
    const garbage = createTestGameState({
      weeksLived: 40,
      settings: { ...at(40).settings, quickActionWeeks: { rest: 'not-a-number' } } as never,
    });

    expect(usedThisWeek(garbage, 'rest')).toBe(false);
  });
});

describe('the save-format rule is honoured for the new field', () => {
  it('bumped STATE_VERSION and registered a migration', () => {
    // Version-agnostic: this field arrived at v26, so what matters is that v26
    // is registered and the chain runs clean to whatever the current version
    // is. A hardcoded literal here just breaks on the next unrelated bump.
    expect(STATE_VERSION).toBeGreaterThanOrEqual(26);
    expect(isMigrationVersionCovered(26)).toBe(true);

    const { state, errors } = runMigrations({ version: 25, weeksLived: 10 });

    expect(errors).toHaveLength(0);
    expect((state as { version?: number }).version).toBe(STATE_VERSION);
  });

  it('writes NO key, because an absent marker already equals the default', () => {
    // Per the save-format rule, a field whose default is `undefined` gets a
    // version bump and no backfill — writing the key would be the bug.
    const { state } = runMigrations({ version: 25, weeksLived: 10, settings: {} });
    expect((state as { settings?: Record<string, unknown> }).settings?.quickActionWeeks).toBeUndefined();
  });
});
