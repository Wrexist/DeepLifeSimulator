/**
 * The "This Life" timeline — a chronological record the player can scroll.
 *
 * ## Why (2026-08-24 gameplay audit, brief §11)
 *
 * The audit's finding: "careerHistory is the one real timeline in the codebase
 * — and it is read by exactly one consumer, the obituary." The game stamps
 * weeks on careers (v42 titles), births (`birthWeeksLived`), marriages
 * (`marriageWeek`), notable events (`eventLog.weeksLived`) and journal entries
 * (`atWeek`) — and never assembles them into the chronological "first job at
 * 22, married at 29" view the life-sim fantasy is built on. This module is
 * that assembly: PURE, derived on demand, stores nothing, grants nothing.
 *
 * Every source is guarded independently (the anticipation-engine rule): one
 * malformed record loses its row, never the timeline.
 */
import type { GameState } from '@/contexts/game/types';
import { ageFromWeeksLived } from '@/utils/weekCounters';

export type TimelineKind = 'career' | 'family' | 'event' | 'journal' | 'wealth';

export interface TimelineEntry {
  /** Stable per-source id, safe as a React key. */
  id: string;
  /** Absolute `weeksLived` stamp the source recorded. */
  week: number;
  /** The age the character was at that week. */
  age: number;
  kind: TimelineKind;
  title: string;
  detail?: string;
}

/** Newest-first cap — a timeline, not an archive dump. */
export const MAX_TIMELINE_ENTRIES = 60;

const finite = (v: unknown): number | null =>
  typeof v === 'number' && Number.isFinite(v) && v >= 0 ? v : null;

function careerEntries(state: GameState): TimelineEntry[] {
  const out: TimelineEntry[] = [];
  const history = state.lifetimeStatistics?.careerHistory;
  if (!Array.isArray(history)) return out;
  history.forEach((entry, i) => {
    if (!entry) return;
    const name = entry.title || entry.job;
    if (!name) return;
    const start = finite(entry.startWeek);
    if (start !== null) {
      out.push({
        id: `career-start:${i}`,
        week: start,
        age: ageFromWeeksLived(start),
        kind: 'career',
        title: `Started as ${name}`,
      });
    }
    const end = finite(entry.endWeek);
    if (end !== null && end > (start ?? 0)) {
      out.push({
        id: `career-end:${i}`,
        week: end,
        age: ageFromWeeksLived(end),
        kind: 'career',
        title: `Left ${name}`,
        detail: entry.weeks ? `${Math.round(entry.weeks)} weeks on the job` : undefined,
      });
    }
  });
  return out;
}

function familyEntries(state: GameState): TimelineEntry[] {
  const out: TimelineEntry[] = [];
  for (const child of state.family?.children ?? []) {
    const week = finite(child?.birthWeeksLived);
    if (child && week !== null) {
      out.push({
        id: `birth:${child.id}`,
        week,
        age: ageFromWeeksLived(week),
        kind: 'family',
        title: `${child.name} was born`,
      });
    }
  }
  const partners = [
    ...(state.family?.spouse ? [state.family.spouse] : []),
    ...(state.relationships ?? []),
  ];
  const seen = new Set<string>();
  for (const rel of partners) {
    const week = finite(rel?.marriageWeek);
    if (!rel || week === null || seen.has(rel.id)) continue;
    seen.add(rel.id);
    out.push({
      id: `marriage:${rel.id}`,
      week,
      age: ageFromWeeksLived(week),
      kind: 'family',
      title: `Married ${rel.name}`,
    });
  }
  return out;
}

function eventEntries(state: GameState): TimelineEntry[] {
  const log = Array.isArray(state.eventLog) ? state.eventLog : [];
  return log
    .filter(
      (e) =>
        e &&
        finite(e.weeksLived) !== null &&
        (Math.abs(e.effects?.money ?? 0) > 5000 ||
          e.category === 'special' ||
          e.category === 'crime')
    )
    .map((e, i) => ({
      id: `event:${e.id}:${i}`,
      week: e.weeksLived as number,
      age: ageFromWeeksLived(e.weeksLived as number),
      kind: 'event' as const,
      title: e.description,
    }));
}

function journalEntries(state: GameState): TimelineEntry[] {
  const journal = Array.isArray(state.journal) ? state.journal : [];
  return journal
    .filter((j) => j && finite(j.atWeek) !== null && typeof j.title === 'string' && j.title)
    .map((j) => ({
      id: `journal:${j.id}`,
      week: j.atWeek,
      age: ageFromWeeksLived(j.atWeek),
      kind: 'journal' as const,
      title: j.title,
      detail: j.details || undefined,
    }));
}

function wealthEntries(state: GameState): TimelineEntry[] {
  const peak = state.lifetimeStatistics?.peakNetWorth ?? 0;
  const week = finite(state.lifetimeStatistics?.peakNetWorthWeek);
  if (peak < 1_000_000 || week === null) return [];
  return [
    {
      id: 'wealth:peak',
      week,
      age: ageFromWeeksLived(week),
      kind: 'wealth',
      title: `Fortune peaked at $${Math.round(peak).toLocaleString()}`,
    },
  ];
}

/**
 * The life so far, newest first (a scroll starts at "now" and digs back).
 * Deterministic order: week desc, then id, so re-renders never reshuffle.
 */
export function buildLifeTimeline(state: GameState | null | undefined): TimelineEntry[] {
  if (!state) return [];
  let all: TimelineEntry[] = [];
  const sources = [careerEntries, familyEntries, eventEntries, journalEntries, wealthEntries];
  for (const collect of sources) {
    try {
      all = all.concat(collect(state));
    } catch {
      // one bad source loses its rows, never the timeline
    }
  }
  return all
    .sort((a, b) => b.week - a.week || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0))
    .slice(0, MAX_TIMELINE_ENTRIES);
}
