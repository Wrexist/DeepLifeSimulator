/**
 * Timed legacy buffs, in a form a screen can show.
 *
 * `legacyBuffs` holds two entries, each just an expiry week:
 *
 *   mentor      +50% career progress  (`applyCareerProgress.ts:113`)
 *   luckyCharm  +10% luck
 *
 * Neither appeared in any component. A TIMED buff nobody can see is worse than
 * a permanent one: the player cannot tell it is running, cannot tell when it
 * lapses, and cannot plan around either. The most likely experience is
 * noticing career progress feels fast for a while and never learning why.
 *
 * Expiry is compared against `weeksLived`, never `week` — `week` cycles 1-4 and
 * is display-only (CLAUDE.md §4.2). The tick uses `>` (strictly future), so
 * this does too; a buff expiring exactly this week is already spent.
 */
import type { GameState } from '@/contexts/game/types';

export interface ActiveBuff {
  id: 'mentor' | 'luckyCharm';
  label: string;
  effect: string;
  /** Whole weeks remaining, at least 1 while still active. */
  weeksLeft: number;
}

const finite = (n: unknown): number =>
  typeof n === 'number' && isFinite(n) ? n : 0;

export function activeLegacyBuffs(state: Pick<GameState, 'legacyBuffs' | 'weeksLived'>): ActiveBuff[] {
  const now = finite(state?.weeksLived);
  const buffs = state?.legacyBuffs;
  if (!buffs) return [];

  const out: ActiveBuff[] = [];

  const push = (id: ActiveBuff['id'], label: string, effect: string, expires: unknown) => {
    const at = finite(expires);
    // Strictly greater, matching the tick's own check — a buff whose expiry
    // equals the current week no longer applies, so showing it would be a lie.
    if (at > now) {
      out.push({ id, label, effect, weeksLeft: Math.max(1, Math.ceil(at - now)) });
    }
  };

  push('mentor', 'Mentor', '+50% career progress', buffs.mentor?.expiresWeeksLived);
  push('luckyCharm', 'Lucky Charm', '+10% luck', buffs.luckyCharm?.expiresWeeksLived);

  return out;
}
