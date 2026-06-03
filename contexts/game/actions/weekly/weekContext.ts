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
}
