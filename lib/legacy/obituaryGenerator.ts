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
  const careers = state.careers || [];
  const acceptedCareers = careers.filter((c) => c?.accepted);
  if (acceptedCareers.length > 0) {
    const lastCareer = acceptedCareers[acceptedCareers.length - 1];
    /**
     * `Career` has no `name` and no `title` — the job title lives in
     * `levels[level].name`. This read them through `as any` and so silently fell
     * through to the 'employed' fallback on EVERY obituary, for every player who
     * ever held a job. The cast is what hid it: without it this would not have
     * compiled. Same derivation as `getCareerName` in `lib/events/careerEvents`.
     */
    const levels = Array.isArray(lastCareer.levels) ? lastCareer.levels : [];
    const safeLevel = Math.max(0, Math.min(lastCareer.level ?? 0, levels.length - 1));
    facts.push(levels[safeLevel]?.name || 'employed');
  }

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
