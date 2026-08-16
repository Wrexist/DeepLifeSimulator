/**
 * The shared load-hardening core, `utils/hydrateLoadedState.ts`.
 *
 * This is the pipeline `loadGame` used to run inline and that the cloud-apply
 * path did not run at all: repair → validate+autoFix → family↔relationships
 * reconciliation → merge onto `initialGameState` (with `mergeLoadedSlice` for
 * the four key-by-key sub-objects) → userProfile identity heal → permanent
 * perks → relationship repair → invariants. 2026-08-16 architecture audit M6.
 *
 * What is asserted here is the CONTRACT the extraction has to keep, because
 * both callers now depend on it and one of them (cloud) previously had no
 * hardening to lose:
 *
 *   1. A genuinely partial state comes out complete (that is what makes a
 *      cloud state from an older build safe to apply).
 *   2. The family↔relationships graph is reconciled in BOTH directions.
 *   3. Carve-out fields (CLAUDE.md §7 — stored default `undefined`, therefore
 *      deliberately absent from `initialGameState`) survive. The merge that
 *      eats them is a whitelist over `initialGameState`'s keys, which is
 *      exactly what `__tests__/save/carveOutRoundTrip.test.ts` documents; that
 *      suite covers the merge in isolation, this one covers it through the
 *      real composed function.
 *   4. Order-sensitive steps stay in order — `family`/`relationships` assigned
 *      AFTER the spread, invariants LAST.
 */
import { initialGameState, STATE_VERSION } from '@/contexts/game/initialState';
import { hydrateLoadedState, hydrateRemoteState } from '@/utils/hydrateLoadedState';
import { createTestGameState } from '../helpers/createTestGameState';

/** A save as it comes off disk: a plain object, not a `GameState`. */
const asSave = (state: unknown): Record<string, unknown> =>
  JSON.parse(JSON.stringify(state)) as Record<string, unknown>;

describe('hydrateLoadedState', () => {
  it('completes a genuinely partial state from initialGameState', () => {
    // The shape a cloud save from an older build has: a few real fields and
    // nothing else. Before the extraction the cloud path applied this AS IS.
    const partial = {
      version: STATE_VERSION,
      weeksLived: 500,
      stats: { money: 12_345 },
      userProfile: { firstName: 'Ada', lastName: 'Byron' },
    };

    const { state } = hydrateLoadedState(partial, { source: 'test:partial' });

    // The save's own values win…
    expect(state.stats.money).toBe(12_345);
    expect(state.weeksLived).toBe(500);
    // …and every required field the save never mentioned exists.
    expect(state.stats.health).toBe(initialGameState.stats.health);
    expect(Array.isArray(state.careers)).toBe(true);
    expect(Array.isArray(state.relationships)).toBe(true);
    expect(state.settings).toBeDefined();
    expect(state.date).toBeDefined();
    expect(typeof state.family).toBe('object');
  });

  it('heals a userProfile with no name at all', () => {
    const { state } = hydrateLoadedState(
      { version: STATE_VERSION, weeksLived: 10, stats: { money: 1 }, userProfile: {} },
      { source: 'test:no-name' }
    );

    // Validation requires both halves; an empty pair used to reach the app.
    expect(state.userProfile.firstName).toBeTruthy();
    expect(state.userProfile.lastName).toBeTruthy();
    expect(state.userProfile.name).toBeTruthy();
  });

  it('splits a single `name` into first and last', () => {
    const { state } = hydrateLoadedState(
      {
        version: STATE_VERSION,
        weeksLived: 10,
        stats: { money: 1 },
        userProfile: { name: 'Grace Hopper' },
      },
      { source: 'test:name-split' }
    );

    expect(state.userProfile.firstName).toBe('Grace');
    expect(state.userProfile.lastName).toBe('Hopper');
  });

  describe('family ↔ relationships reconciliation', () => {
    it('copies a child that exists only in relationships into family.children', () => {
      const base = createTestGameState({ weeksLived: 400, version: STATE_VERSION });
      const save = asSave({
        ...base,
        family: { ...base.family, children: [] },
        relationships: [
          { id: 'kid-1', name: 'Kid One', type: 'child', relationshipScore: 80 },
        ],
      });

      const { state } = hydrateLoadedState(save, { source: 'test:child-from-rel' });

      expect(state.family.children.map(c => c.id)).toContain('kid-1');
      expect(state.relationships.filter(r => r.id === 'kid-1')).toHaveLength(1);
    });

    it('copies a child that exists only in family.children into relationships', () => {
      const base = createTestGameState({ weeksLived: 400, version: STATE_VERSION });
      const save = asSave({
        ...base,
        family: {
          ...base.family,
          children: [{ id: 'kid-2', name: 'Kid Two', type: 'child', relationshipScore: 70 }],
        },
        relationships: [],
      });

      const { state } = hydrateLoadedState(save, { source: 'test:rel-from-child' });

      expect(state.relationships.map(r => r.id)).toContain('kid-2');
      expect(state.family.children.map(c => c.id)).toContain('kid-2');
    });

    it('keeps the reconciled arrays — the spread must not overwrite them', () => {
      // The order hazard the extracted function documents: `family` and
      // `relationships` are assigned AFTER `{ ...initialGameState, ...parsed }`.
      // Reorder those two lines and this is the test that fails.
      const base = createTestGameState({ weeksLived: 400, version: STATE_VERSION });
      const save = asSave({
        ...base,
        family: { ...base.family, children: [] },
        relationships: [{ id: 'kid-3', name: 'Kid Three', type: 'child', relationshipScore: 60 }],
      });

      const { state } = hydrateLoadedState(save, { source: 'test:order' });

      expect(state.family.children).toHaveLength(1);
      expect(state.relationships).toHaveLength(1);
    });
  });

  describe('carve-out fields survive (CLAUDE.md §7)', () => {
    // Every one of these has an `undefined` stored default, so it is absent
    // from `initialGameState` — the shape a whitelist merge silently eats.
    const CARVE_OUTS: { path: string; value: unknown; save: Record<string, unknown> }[] = [
      {
        path: 'settings.lastNoFillGrantWeek',
        value: 3_777,
        save: { settings: { lastNoFillGrantWeek: 3_777 } },
      },
      {
        path: 'settings.lastWelcomeBackWeek',
        value: 3_778,
        save: { settings: { lastWelcomeBackWeek: 3_778 } },
      },
      {
        path: 'userProfile.avatar',
        value: { seed: 'a1.5n804631300' },
        save: { userProfile: { firstName: 'A', lastName: 'B', avatar: { seed: 'a1.5n804631300' } } },
      },
      { path: 'lifeStartWeek', value: 1_040, save: { lifeStartWeek: 1_040 } },
      { path: 'tuitionWaiverUSD', value: 12_500, save: { tuitionWaiverUSD: 12_500 } },
      { path: 'lastLoginRewardAt', value: 1_771_000_000_000, save: { lastLoginRewardAt: 1_771_000_000_000 } },
    ];

    const at = (obj: unknown, path: string): unknown =>
      path.split('.').reduce<unknown>(
        (acc, key) => (acc === null || acc === undefined ? undefined : (acc as Record<string, unknown>)[key]),
        obj
      );

    it.each(CARVE_OUTS)('keeps $path', ({ path, value, save }) => {
      const base = createTestGameState({ weeksLived: 3_000, version: STATE_VERSION });
      const merged = asSave({
        ...base,
        ...save,
        settings: { ...base.settings, ...((save.settings as object) ?? {}) },
        userProfile: { ...base.userProfile, ...((save.userProfile as object) ?? {}) },
      });

      const { state } = hydrateLoadedState(merged, { source: 'test:carve-out' });

      expect(at(state, path)).toEqual(value);
    });
  });

  it('applies permanent perks', () => {
    const base = asSave(createTestGameState({ weeksLived: 100, version: STATE_VERSION }));

    const { state } = hydrateLoadedState(base, {
      source: 'test:perks',
      permanentPerks: ['workBoost', 'fastLearner'],
    });

    expect(state.perks?.workBoost).toBe(true);
    expect(state.perks?.fastLearner).toBe(true);
  });

  it('clamps a state that violates the last-word invariants', () => {
    // `enforceStateInvariants` runs LAST, after the merge, and is the only
    // stage that looks at a negative `weeksLived`.
    const base = asSave(createTestGameState({ weeksLived: 100, version: STATE_VERSION }));
    const result = hydrateLoadedState({ ...base, weeksLived: -5 }, { source: 'test:invariants' });

    expect(result.state.weeksLived).toBeGreaterThanOrEqual(0);
    expect(result.invariantViolations.length).toBeGreaterThan(0);
  });

  it('reports a valid save as valid and repairs nothing', () => {
    const base = asSave(createTestGameState({ weeksLived: 200, version: STATE_VERSION }));
    const result = hydrateLoadedState(base, { source: 'test:clean' });

    expect(result.validation.valid).toBe(true);
    expect(result.state.weeksLived).toBe(200);
  });
});

/**
 * The cloud-apply decision. This is what the "Keep Cloud Version" branch of the
 * sync-conflict alert calls (`GameActionsContext.tsx`), which before M6 applied
 * `conflict.remoteState` with nothing but a `repairGameState` in front of it.
 */
describe('hydrateRemoteState', () => {
  it('refuses a remote state whose weeksLived is behind the live one', () => {
    // A rollback of weeks the player actually played — the same question
    // `saveQueue.restoreQueue` asks of a replayed write, asked at the other door.
    const remote = asSave(createTestGameState({ weeksLived: 400, version: STATE_VERSION }));

    const decision = hydrateRemoteState(remote, { localWeeksLived: 500 });

    expect(decision.applied).toBe(false);
    if (!decision.applied) {
      expect(decision.reason).toBe('regression');
      expect(decision.localWeeks).toBe(500);
      expect(decision.remoteWeeks).toBe(400);
    }
  });

  it('accepts a remote state at the same week (a re-sync, not a rollback)', () => {
    const remote = asSave(createTestGameState({ weeksLived: 500, version: STATE_VERSION }));

    const decision = hydrateRemoteState(remote, { localWeeksLived: 500 });

    expect(decision.applied).toBe(true);
  });

  it('delivers an accepted remote partial state HYDRATED, not raw', () => {
    // The M6 bug in one assertion: a remote save missing fields used to be
    // applied exactly as it arrived.
    const decision = hydrateRemoteState(
      {
        version: STATE_VERSION,
        weeksLived: 900,
        stats: { money: 777 },
        userProfile: { firstName: 'Remote', lastName: 'Device' },
        relationships: [{ id: 'kid-r', name: 'Kid R', type: 'child', relationshipScore: 50 }],
      },
      { localWeeksLived: 100 }
    );

    expect(decision.applied).toBe(true);
    if (decision.applied) {
      // Healed, not raw.
      expect(decision.state.stats.money).toBe(777);
      expect(decision.state.stats.health).toBe(initialGameState.stats.health);
      expect(Array.isArray(decision.state.careers)).toBe(true);
      // And reconciled: the child arrived only in `relationships`.
      expect(decision.state.family.children.map(c => c.id)).toContain('kid-r');
    }
  });

  it('refuses a remote object that is not a game state at all', () => {
    const decision = hydrateRemoteState({ hello: 'world' }, { localWeeksLived: 0 });

    expect(decision.applied).toBe(false);
    if (!decision.applied) {
      expect(decision.reason).toBe('invalid');
    }
  });
});
