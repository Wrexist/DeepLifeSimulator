/**
 * Obituary Generator
 *
 * Creates a narrative obituary text from game state at death.
 * Used for social sharing — generates shareable text with #DeepLifeSim.
 */
import type { GameState } from '@/contexts/game/types';
import { formatMoney } from '@/utils/moneyFormatting';
import { ADULTHOOD_AGE } from '@/lib/config/gameConstants';

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
  const acceptedCareers = careers.filter((c: any) => c?.accepted);
  if (acceptedCareers.length > 0) {
    const lastCareer = acceptedCareers[acceptedCareers.length - 1];
    facts.push((lastCareer as any).name || (lastCareer as any).title || 'employed');
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
  const achievements = (state.achievements || []).filter(
    (a: any) => a.completed
  );

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

  // Build share text (compact for social media)
  const shareText = [
    `RIP ${name} (Age ${age})`,
    `${descriptor.charAt(0).toUpperCase() + descriptor.slice(1)} ${factsStr}.`,
    `Net worth: ${formatMoney(netWorth)}`,
    `Cause of death: ${deathReason}`,
    '',
    '#DeepLifeSim',
  ].join('\n');

  return { headline, body, shareText };
}
