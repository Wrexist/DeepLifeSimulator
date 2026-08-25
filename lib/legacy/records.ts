/**
 * Family records - the dynasty's personal bests, derived on demand.
 *
 * The save has captured everything needed for self-competition for a long
 * time (`previousLives` carries net worth, life quality, age, companies,
 * children per finished life) and surfaced almost none of it: the only
 * comparison in the game was one net-worth band inside LegacyTimeline. This
 * module derives the record board the 2026-08-25 retention audit found
 * missing - "beat your own best life" is the cheapest durable goal a
 * life-sim has, and it was invisible.
 *
 * DERIVED ONLY, the lib/goals invariant: reads `previousLives` plus the live
 * life, stores nothing, grants nothing. It deliberately does NOT read
 * `prestige.lifetimeStats.maxNetWorth`, which updates only inside
 * `executePrestige` and silently under-reports for players who die rather
 * than prestige - `previousLives` is written by every path that ends a life,
 * so it is the trustworthy source.
 */
import type { GameState } from '@/contexts/game/types';
import { netWorth } from '@/lib/progress/achievements';
import { lifeQuality } from '@/lib/legacy/lifeQuality';

export interface FamilyRecordRow {
  id: 'richest' | 'quality' | 'longest' | 'companies' | 'children';
  label: string;
  /** The best a FINISHED life achieved. */
  best: number;
  /** "Gen 2 · Ada" - who holds it. */
  bestHolder: string;
  /** The live life's figure for the same metric. */
  current: number;
  /** True when the life being played has already passed the record. */
  currentLeads: boolean;
  kind: 'money' | 'count' | 'age' | 'score';
}

type Life = NonNullable<GameState['previousLives']>[number];

function holderLabel(life: Life): string {
  const gen = `Gen ${life.generation ?? 1}`;
  const name = typeof life.name === 'string' && life.name.length > 0 ? life.name : null;
  return name ? `${gen} · ${name}` : gen;
}

function bestBy(lives: Life[], read: (l: Life) => number): { value: number; holder: string } | null {
  let best: { value: number; holder: string } | null = null;
  for (const life of lives) {
    if (!life) continue;
    const value = read(life);
    if (!Number.isFinite(value) || value <= 0) continue;
    if (!best || value > best.value) best = { value, holder: holderLabel(life) };
  }
  return best;
}

const num = (v: unknown): number => (typeof v === 'number' && Number.isFinite(v) ? v : 0);

/**
 * The record board, or [] when there is nothing to compare against (first
 * life of a save - a board of zeros would be noise, the WeekAheadCard rule).
 * Rows whose record is zero are omitted for the same reason.
 */
export function familyRecords(state: GameState | undefined | null): FamilyRecordRow[] {
  try {
    const lives = (state?.previousLives ?? []).filter(Boolean);
    if (!state || lives.length === 0) return [];

    const rows: FamilyRecordRow[] = [];
    const push = (
      id: FamilyRecordRow['id'],
      label: string,
      kind: FamilyRecordRow['kind'],
      best: { value: number; holder: string } | null,
      current: number,
    ) => {
      if (!best) return;
      rows.push({
        id,
        label,
        kind,
        best: best.value,
        bestHolder: best.holder,
        current: Math.max(0, current),
        currentLeads: current > best.value,
      });
    };

    push('richest', 'Richest life', 'money', bestBy(lives, (l) => num(l.netWorth)), netWorth(state));
    push(
      'quality',
      'Best life quality',
      'score',
      bestBy(lives, (l) => num(l.lifeQualityScore)),
      lifeQuality(state).score,
    );
    push(
      'longest',
      'Longest life',
      'age',
      bestBy(lives, (l) => num(l.ageAtDeath)),
      Math.floor(num(state.date?.age)),
    );
    push(
      'companies',
      'Most companies',
      'count',
      bestBy(lives, (l) => num(l.companiesOwned)),
      (state.companies ?? []).length,
    );
    push(
      'children',
      'Largest family',
      'count',
      bestBy(lives, (l) => num(l.totalChildren)),
      (state.family?.children ?? []).length,
    );

    return rows;
  } catch {
    // A malformed archive must not take a screen down with it.
    return [];
  }
}
