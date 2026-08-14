/**
 * Obituary Generator
 *
 * Creates a narrative obituary text from game state at death.
 * Used for social sharing — generates shareable text with #DeepLifeSim.
 */
import type { GameState } from '@/contexts/game/types';
import { formatMoney } from '@/utils/moneyFormatting';
import { ADULTHOOD_AGE } from '@/lib/config/gameConstants';
import { APP_STORE_URL } from '@/lib/config/appConfig';

export interface Obituary {
  headline: string;
  body: string;
  shareText: string;
}

export function generateObituary(state: GameState): Obituary {
  const name = state.userProfile?.name || 'Unknown';
  const age = Math.floor(state.date?.age ?? ADULTHOOD_AGE);
  const deathReasonMap: Record<string, string> = {
    health: 'health complications',
    happiness: 'a broken spirit',
  };
  const deathReason = deathReasonMap[state.deathReason ?? ''] || 'natural causes';

  // Gather life facts
  const facts: string[] = [];

  // Career
  const careerTitle = lastJobTitle(state);
  if (careerTitle) facts.push(careerTitle);

  // Education
  const educations = state.educations || [];
  const completed = educations.filter((e: any) => e?.completed);
  if (completed.length > 0) {
    const highest = completed[completed.length - 1];
    if (highest?.name) facts.push(highest.name + ' graduate');
  }

  // Family
  const spouse = state.family?.spouse;
  const children = state.family?.children || [];
  if (spouse) {
    facts.push(`married to ${spouse.name || 'their partner'}`);
  }
  if (children.length > 0) {
    facts.push(
      `${children.length} ${children.length === 1 ? 'child' : 'children'}`
    );
  }

  // Wealth
  const cash = state.stats?.money ?? 0;
  const bank = state.bankSavings ?? 0;
  const holdings = Array.isArray(state.stocks) ? state.stocks : (state.stocks?.holdings ?? []);
  const stocks = Array.isArray(holdings)
    ? holdings.reduce(
        (sum: number, s: any) => sum + (s.shares ?? 0) * (s.currentPrice ?? 0),
        0
      )
    : 0;
  const realEstate = Array.isArray(state.realEstate)
    ? state.realEstate.reduce((sum: number, r: any) => sum + (r.value ?? 0), 0)
    : 0;
  const netWorth = cash + bank + stocks + realEstate;

  // Achievements
  // `achievements[].completed` is the DEPRECATED store — 52 entries that ship
  // `false` and are never set in normal play (`evaluateAchievements` is a
  // documented no-op). The live store is `claimedProgressAchievements`. Reading
  // the dead flag made this silently empty for every player. 2026-07-30 audit
  // GP-3; same fix as lib/careers/advancedCareers.ts.
  const achievements = [...(state.claimedProgressAchievements || [])];

  // Build descriptor
  let descriptor = '';
  if (netWorth >= 10_000_000) descriptor = 'mega-wealthy';
  else if (netWorth >= 1_000_000) descriptor = 'millionaire';
  else if (netWorth >= 100_000) descriptor = 'well-off';
  else if (netWorth >= 10_000) descriptor = 'modest';
  else if (netWorth >= 0) descriptor = 'humble';
  else descriptor = 'debt-ridden';

  // Properties
  const propertyCount = (state.realEstate || []).length;
  if (propertyCount >= 3) facts.push(`owned ${propertyCount} properties`);

  // Companies
  const companyCount = (state.companies || []).length;
  if (companyCount > 0) facts.push(`founded ${companyCount} ${companyCount === 1 ? 'company' : 'companies'}`);

  // Prestige
  const prestigeLevel = state.prestige?.prestigeLevel ?? 0;
  if (prestigeLevel > 0) facts.push(`${prestigeLevel}x prestige`);

  // Build headline
  const headline = `${name}, Age ${age}`;

  // Build body
  const factsStr =
    facts.length > 0
      ? facts.join(', ')
      : 'lived a quiet life';

  const body = [
    `${name} passed away at the age of ${age}.`,
    `${descriptor.charAt(0).toUpperCase() + descriptor.slice(1)} ${factsStr}.`,
    `Net worth at death: ${formatMoney(netWorth)}.`,
    achievements.length > 0
      ? `Achievements unlocked: ${achievements.length}.`
      : '',
    `Cause of death: ${deathReason}.`,
  ]
    .filter(Boolean)
    .join(' ');

  // Build share text (compact for social media).
  //
  // THE LINK IS NOT DECORATION. This text used to end at `#DeepLifeSim`, which
  // made every shared death a dead end: a reader who wanted the game had to go
  // search a store for a hashtag, and nothing about the install was
  // attributable. A share is the cheapest acquisition channel the game has and
  // it was terminating one tap short of working. Keep the URL last — messaging
  // apps and social clients build their preview from the final link.
  const shareText = [
    `RIP ${name} (Age ${age})`,
    `${descriptor.charAt(0).toUpperCase() + descriptor.slice(1)} ${factsStr}.`,
    `Net worth: ${formatMoney(netWorth)}`,
    `Cause of death: ${deathReason}`,
    '',
    'Live your own life in Deep Life Simulator:',
    APP_STORE_URL,
    '',
    '#DeepLifeSim',
  ].join('\n');

  return { headline, body, shareText };
}

/**
 * The job title to put in an obituary, or '' if they never worked.
 *
 * ── Two bugs, one line ────────────────────────────────────────────────────
 *
 * This used to read `career.name || career.title` through `as any`, and
 * `Career` has NEITHER — the title lives in `levels[level].name`. So it
 * evaluated to `undefined || undefined` and fell through to the literal
 * 'employed' on every obituary ever shown. The cast is what hid it; without it
 * the expression would not have compiled.
 *
 * Fixing that exposed the second one. The filter was `accepted`, and `accepted`
 * means "employed RIGHT NOW", not "was ever employed" — both `quitJob` and the
 * firing path set it false. So a character who retired, quit, or was fired
 * before dying still got no career named, which is most of the people whose
 * working life is worth a sentence. Caught in review of #130.
 *
 * So: the job held at death if there is one, else the last job ever held,
 * recovered from `lifetimeStatistics.careerHistory` — which already records
 * every job with a `startWeek` and a closing `endWeek`.
 *
 * The LEVEL is read from `state.careers`, which is safe because neither the
 * quit path nor the firing path resets it: they clear `accepted`, `applied`,
 * `progress`, `performance` and `warningsReceived`, and leave the ladder
 * position alone. Deliberately NOT "the highest level ever reached" — no such
 * record exists, and inventing one from the ladder length would eulogise a
 * promotion the character never got.
 */
function lastJobTitle(state: GameState): string {
  const careers = Array.isArray(state.careers) ? state.careers : [];

  const titleOf = (careerId: string | undefined): string => {
    if (!careerId) return '';
    const career = careers.find((c) => c?.id === careerId);
    const levels = Array.isArray(career?.levels) ? career.levels : [];
    if (levels.length === 0) return '';
    const safeLevel = Math.max(0, Math.min(career?.level ?? 0, levels.length - 1));
    return levels[safeLevel]?.name ?? '';
  };

  // 1. The job they held when they died. `currentJob` is the canonical answer —
  //    the same one `getCareerName` uses — and only falls back to scanning for
  //    an accepted flag if it is unset. Scanning is a LAST match, not a first:
  //    a save should only ever have one accepted career, but if it somehow has
  //    two, the later one is the one they moved to.
  const held =
    careers.find((c) => c?.id === state.currentJob && c?.accepted)
    ?? [...careers].reverse().find((c) => c?.accepted);
  if (held) return titleOf(held.id) || 'employed';

  // 2. Otherwise the last one they ever held.
  const history = state.lifetimeStatistics?.careerHistory;
  if (Array.isArray(history) && history.length > 0) {
    const last = history[history.length - 1];
    const title = titleOf(last?.job);
    if (title) return title;
    // A history entry naming a career the catalogue no longer has still tells
    // us they worked, which is more than nothing to say about a life.
    if (last?.job) return 'employed';
  }

  return '';
}
