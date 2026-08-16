/**
 * WP-A — no side effects inside a `setGameState` updater (SkillTreeModal).
 *
 * `commitUnlock` ran the pure reducer inside the updater and then fired the
 * side effects from in there:
 *
 *     setGameState(prev => {
 *       const result = purchaseLifeSkill(prev, …);
 *       if (result.purchased) { haptic.success(); Alert.alert('Skill Unlocked', …); }
 *       return result.state;
 *     });
 *
 * An updater must be PURE. React StrictMode double-invokes it in development,
 * and a re-render/rebase replays it in production — so one purchase buzzed the
 * phone twice and stacked two identical "Skill Unlocked" alerts, the second of
 * which the player has to dismiss for a thing that happened once.
 *
 * The fix is the established preview/commit shape (the C-10 example quoted in
 * `updaterResultRatchet.test.ts`): `purchaseLifeSkill` is pure, so run it on
 * the snapshot for the REPORT and again against `prev` for the STATE. The
 * effects fire from the preview, outside the updater, exactly once per tap.
 */
import fs from 'fs';
import path from 'path';
import { purchaseLifeSkill } from '@/lib/skillTrees/lifeSkillEffects';
import { createTestGameState } from '../helpers/createTestGameState';
import type { GameState } from '@/contexts/game/types';

const SOURCE = fs.readFileSync(
  path.join(__dirname, '../../components/SkillTreeModal.tsx'),
  'utf8',
);

const COMMIT = SOURCE.slice(
  SOURCE.indexOf('const commitUnlock = useCallback'),
  SOURCE.indexOf('const handleUnlockNode = useCallback'),
);

const NODE = { id: 'wp_a_test_skill', cost: 1_000, levelRequired: 0 };

function rich(money = 50_000): GameState {
  const base = createTestGameState();
  return createTestGameState({
    stats: { ...base.stats, money },
    unlockedLifeSkills: [],
  });
}

describe('the updater is pure', () => {
  it('the updater body is a single expression — no Alert, no haptic inside it', () => {
    const updater = COMMIT.slice(COMMIT.indexOf('setGameState('));
    const updaterEnd = updater.indexOf('\n    if (preview.purchased)');
    const inside = updater.slice(0, updaterEnd > 0 ? updaterEnd : undefined);
    expect(inside).not.toMatch(/Alert\.alert/);
    expect(inside).not.toMatch(/haptic\./);
  });

  it('the side effects are driven by a PREVIEW run on the snapshot', () => {
    expect(COMMIT).toMatch(/const preview = purchaseLifeSkill\(gameState, args\)/);
    expect(COMMIT).toMatch(/setGameState\(prev => purchaseLifeSkill\(prev, args\)\.state\)/);
    expect(COMMIT).toMatch(/if \(preview\.purchased\)[\s\S]{0,200}Alert\.alert\('Skill Unlocked'/);
  });
});

describe('running the reducer twice (StrictMode double-invoke) is safe', () => {
  it('charges once and unlocks once when the SAME prev is replayed', () => {
    // What StrictMode actually does: invoke the updater twice with the same
    // `prev`. Both invocations must produce the same state — and, with the
    // effects moved out, produce no player-visible noise at all.
    const prev = rich();

    const first = purchaseLifeSkill(prev, NODE);
    const replay = purchaseLifeSkill(prev, NODE);

    expect(first.purchased).toBe(true);
    expect(replay.purchased).toBe(true);
    expect(replay.state.stats.money).toBe(first.state.stats.money);
    expect(replay.state.stats.money).toBe(49_000);
    expect(replay.state.unlockedLifeSkills).toEqual(first.state.unlockedLifeSkills);
    expect((replay.state.unlockedLifeSkills || []).filter((s) => s === NODE.id)).toHaveLength(1);
  });

  it('a second tap in the same batch (chained prev) is refused, not double-charged', () => {
    let state = rich();
    state = purchaseLifeSkill(state, NODE).state;
    const second = purchaseLifeSkill(state, NODE);

    expect(second.purchased).toBe(false);
    expect(second.reason).toBe('already-unlocked');
    expect(second.state.stats.money).toBe(49_000);
  });

  it('the preview agrees with the commit on an uncontended tap (the common case)', () => {
    const snapshot = rich();
    const preview = purchaseLifeSkill(snapshot, NODE);
    const committed = purchaseLifeSkill(snapshot, NODE);

    expect(preview.purchased).toBe(committed.purchased);
    expect(preview.state.stats.money).toBe(committed.state.stats.money);
  });
});
