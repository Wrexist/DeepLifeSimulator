/**
 * WeekContext — shared mutable accumulator for the weekly reducer pipeline.
 * R7 Phase 2 step 2.2b.
 *
 * Each extracted subsystem reducer (vehicles, family/relationships, crime,
 * disease, mining, etc.) takes this context and is allowed to MUTATE
 * `newStats` and PUSH to `notifications`. The shape mirrors the legacy
 * inline pattern in `GameActionsContext.tsx.nextWeek()` where `newStats`
 * and `pendingNotifications` were closure-captured variables threaded
 * through ~20 inline blocks. Promoting them to a typed bag makes each
 * subsystem testable in isolation.
 *
 * Rules:
 *   - Mutations happen via Math.max / Math.min / array push. We do NOT
 *     replace the references — the caller holds the same references and
 *     reads them after every reducer returns.
 *   - `preRolls` is read-only. Reducers consume specific keys but never
 *     write back to preRolls.
 *   - This file has NO React deps, NO global state, NO imports of the
 *     things that make `GameActionsContext.tsx` hard to test.
 */

import type { GameStats } from '@/contexts/game/types';
import type { PreRolls } from './preTick';
import type { LifeSkillModifiers } from '@/lib/skillTrees/lifeSkillEffects';

/**
 * Notification pushed by a weekly reducer. Flushed to the UI via the
 * batched `setTimeout` after the `setGameState` updater returns.
 */
export interface WeekNotification {
  id: string;
  title: string;
  message: string;
}

/**
 * Mutable context threaded through the weekly reducer pipeline. The
 * caller (`nextWeek` in `GameActionsContext.tsx`) creates ONE context
 * per tick — owning `newStats`, `notifications`, and `preRolls` — and
 * passes it through each reducer in order. Each reducer mutates its
 * narrow slice; subsequent reducers see the mutations.
 */
export interface WeekContext {
  /**
   * Running stat accumulator. Reducers mutate via:
   *   newStats.X = Math.max(0, Math.min(100, newStats.X + delta))
   *   newStats.money = Math.max(0, newStats.money - cost)
   * The caller initializes this from `prevState.stats` plus initial
   * decay/income deltas BEFORE invoking any reducer.
   */
  newStats: GameStats;
  /**
   * Notification sink. Reducers push event/announcement objects to be
   * displayed in the UI after the tick completes.
   */
  notifications: WeekNotification[];
  /**
   * Pre-rolled RNG draws (from `buildPreRolls()`). Read-only — reducers
   * index into the relevant per-subsystem array (`preRolls.petSickness`,
   * `preRolls.vehicleAccident`, etc.) but never write back.
   */
  preRolls: PreRolls;
  /**
   * Absolute week of the tick being processed (i.e. `weeksLived AFTER
   * the +1 advance`). Some reducers need this for cooldown / scheduled
   * effect math.
   */
  nextWeeksLived: number;
  /**
   * Bounded Life Skills tree modifiers (`unlockedLifeSkills` → multipliers),
   * computed ONCE per tick by the caller from `getLifeSkillModifiers(prevState)`.
   * Read-only for reducers. Optional so existing test fixtures / callers that
   * omit it keep working — consumers fall back to the neutral (all-1) set.
   */
  lifeSkillMods?: LifeSkillModifiers;
  /**
   * Mandatory costs a reducer could not fully cover this week.
   *
   * The v31 arrears system only ever covered the SIX bill lines computed before
   * the money writeback (tax, rent, housing wellbeing/upkeep, diet, education).
   * Everything charged after it — luxury upkeep, insurance, crime fines,
   * student-loan payments — did `money = Math.max(0, money - cost)`, so a cost
   * the player could not afford was silently FORGIVEN. A player owning the full
   * luxury collection owes $556,820/wk; if they could not pay, the shortfall
   * vanished and they kept both the collection and its $301,200/wk of yields.
   *
   * Reducers now call `chargeOrDefer` instead, which pays what it can and adds
   * the remainder here. The caller folds this into `overdueBalance` alongside
   * the arrears result, so the money axis has one failure state instead of two
   * different answers depending on which side of the writeback a cost sits.
   *
   * Optional so existing fixtures and callers that omit it keep working.
   */
  deferredCharges?: number;
}
