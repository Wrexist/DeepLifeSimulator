/**
 * The record of a finished life — built ONCE, by both prestige paths.
 *
 * ## Why this exists (2026-08-24 gameplay audit)
 *
 * `previousLives` entries carried seven fields, while `LegacyTimeline` — the
 * screen built to show them — has always rendered nine MORE (spouse, children,
 * properties, companies, career history, memorable events…) that nothing ever
 * wrote. Worse, the death screen computes a life-quality score
 * (`lib/legacy/lifeQuality.ts`) and a playstyle ribbon (`classifyLife`) at the
 * moment of every death, shows them once, and then throws both away instead of
 * stamping them into the one record designed to hold them. The result: the
 * game had no memory a player could compare lives with — "was this life better
 * than my last one?" was unanswerable from the data.
 *
 * One builder, used by BOTH `prestigeExecution` write sites (reset and heir),
 * so the two paths cannot drift. Every field is optional on the entry type;
 * entries written before this simply lack the new keys, and the renderer has
 * always guarded absence — so no migration, no backfill, no repair mirror
 * (CLAUDE.md §7: appended data, not schema defaults).
 *
 * Every derivation is wrapped so one corrupt subsystem cannot lose the whole
 * record at the exact moment the life ends.
 */
import type { GameState } from '@/contexts/game/types';
import { netWorth } from '@/lib/progress/achievements';
import { getEarnedAchievementNames } from '@/lib/progress/earnedAchievements';
import { lifeQuality } from './lifeQuality';
import { classifyLife } from './ribbonSystem';
import { logger } from '@/utils/logger';

export interface PreviousLifeRecord {
  /** The character's name — who this life WAS (added with the archive, S2). */
  name?: string;
  generation: number;
  netWorth: number;
  ageAtDeath: number;
  deathReason?: string;
  timestamp: number;
  summaryAchievements?: string[];
  weeksLivedAtEnd?: number;
  // ── The fields LegacyTimeline always rendered and never received ──
  careerHistory?: string[];
  totalChildren?: number;
  propertiesOwned?: number;
  companiesOwned?: number;
  happiness?: number;
  health?: number;
  totalWeeksWorked?: number;
  spouseName?: string;
  memorableEvents?: string[];
  // ── What the death screen computes and used to discard ──
  lifeQualityScore?: number;
  lifeQualityVerdict?: string;
  ribbonId?: string;
  ribbonName?: string;
}

const finite = (v: unknown): number =>
  typeof v === 'number' && Number.isFinite(v) ? v : 0;

/** Guarded derivation: a throwing subsystem costs its field, not the record. */
function safely<T>(label: string, fn: () => T): T | undefined {
  try {
    return fn();
  } catch (err) {
    logger.warn(`[lifeRecord] ${label} failed; field omitted`, { error: err });
    return undefined;
  }
}

/** "Head Chef - 3 yrs" from a career-history entry, robust to old entries. */
function careerLine(entry: {
  job?: string;
  title?: string;
  weeks?: number;
}): string | null {
  const name = entry.title || entry.job;
  if (!name) return null;
  const weeks = finite(entry.weeks);
  if (weeks >= 52) return `${name} - ${Math.floor(weeks / 52)} yr${weeks >= 104 ? 's' : ''}`;
  if (weeks > 0) return `${name} - ${Math.round(weeks)} wk${weeks >= 2 ? 's' : ''}`;
  return name;
}

/**
 * Highlights for the "Memorable Events" section: the biggest money swings and
 * the special/crime beats, most recent first - the same signal the life-story
 * generator reads, kept deliberately small (the record is stored per life).
 */
function memorableEvents(state: GameState): string[] {
  const log = Array.isArray(state.eventLog) ? state.eventLog : [];
  return log
    .filter(
      (e) =>
        e &&
        (Math.abs(finite(e.effects?.money)) > 5000 ||
          e.category === 'special' ||
          e.category === 'crime')
    )
    .slice(-5)
    .reverse()
    .map((e) => e.description)
    .filter((d): d is string => typeof d === 'string' && d.length > 0);
}

/**
 * Bound on `previousLives`. It was the last unbounded append in the cross-life
 * carry set (prestigeHistory caps at 50, ribbons at 200, the device archive at
 * 50) — every prestige and every heir transition added up to ~16 fields plus
 * arrays, forever, inside the save blob. Newest-first survivorship: the most
 * recent lives are the ones LegacyTimeline compares against and renders.
 */
export const MAX_PREVIOUS_LIVES = 50;

/**
 * Append a finished life, keeping the newest `MAX_PREVIOUS_LIVES`. The ONE
 * append both prestige paths use, so the cap cannot be forgotten on one of
 * them (the applyOfficeExit lesson: count the entry points).
 */
export function appendLifeRecord(
  // The stored field's own (looser) entry shape, so both prestige paths can
  // hand `oldState.previousLives` straight in without a cast.
  previousLives: GameState['previousLives'] | null,
  record: PreviousLifeRecord,
): NonNullable<GameState['previousLives']> {
  return [...(previousLives || []), record].slice(-MAX_PREVIOUS_LIVES);
}

export function buildLifeRecord(oldState: GameState): PreviousLifeRecord {
  const name =
    [oldState.userProfile?.firstName, oldState.userProfile?.lastName].filter(Boolean).join(' ') ||
    oldState.userProfile?.name ||
    undefined;

  const record: PreviousLifeRecord = {
    ...(name ? { name } : {}),
    generation: oldState.generationNumber || 1,
    netWorth: safely('netWorth', () => Math.round(netWorth(oldState))) ?? 0,
    ageAtDeath: Math.floor(finite(oldState.date?.age)),
    deathReason: oldState.deathReason,
    timestamp: Date.now(),
    summaryAchievements: safely('achievements', () => getEarnedAchievementNames(oldState)),
    // Weeks lived when this life ended - feeds the prestige-speed achievements.
    weeksLivedAtEnd: oldState.weeksLived || 0,
  };

  const stats = oldState.lifetimeStatistics;
  const careerEntries = Array.isArray(stats?.careerHistory) ? stats.careerHistory : [];
  const careerHistory = careerEntries
    .map((e) => careerLine(e ?? {}))
    .filter((line): line is string => !!line)
    .slice(-6);
  if (careerHistory.length > 0) record.careerHistory = careerHistory;
  const weeksWorked = careerEntries.reduce((sum, e) => sum + finite(e?.weeks), 0);
  if (weeksWorked > 0) record.totalWeeksWorked = Math.round(weeksWorked);

  const children = oldState.family?.children;
  if (Array.isArray(children) && children.length > 0) record.totalChildren = children.length;

  const spouseName =
    oldState.family?.spouse?.name ??
    (oldState.relationships ?? []).find((r) => r && r.type === 'spouse')?.name;
  if (typeof spouseName === 'string' && spouseName) record.spouseName = spouseName;

  const properties = (oldState.realEstate ?? []).filter((p) => p && p.owned !== false).length;
  if (properties > 0) record.propertiesOwned = properties;

  const companies = (oldState.companies ?? []).length;
  if (companies > 0) record.companiesOwned = companies;

  record.happiness = Math.round(finite(oldState.stats?.happiness));
  record.health = Math.round(finite(oldState.stats?.health));

  const memorable = safely('memorableEvents', () => memorableEvents(oldState));
  if (memorable && memorable.length > 0) record.memorableEvents = memorable;

  const quality = safely('lifeQuality', () => lifeQuality(oldState));
  if (quality) {
    record.lifeQualityScore = quality.score;
    record.lifeQualityVerdict = quality.verdict;
  }

  const ribbon = safely('ribbon', () => classifyLife(oldState));
  if (ribbon) {
    record.ribbonId = ribbon.id;
    record.ribbonName = ribbon.name;
  }

  return record;
}
