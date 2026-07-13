/**
 * Hobby event pack (v38) — flavored "moments" that can fire for the hobbies a
 * player is actively practicing (via the Hobby Mastery loop in
 * `lib/pursuits/pursuitMastery.ts`). Each event references a real active pursuit,
 * and the "lean in" choice grants a small reward scaled by that pursuit's
 * mastery level, so payoffs grow as the player masters the hobby.
 *
 * These reuse the standard EventTemplate contract (id/category/weight/condition/
 * generate) and are spread into `eventTemplates` in engine.ts, so they roll
 * through the exact same weighted pipeline as every other event — no new engine.
 * Rewards flow through the normal EventChoiceEffects (money/stats), so there is
 * no bespoke reward path either.
 *
 * Anti-exploit: eligibility is gated on having practiced the hobby (condition),
 * and the engine fires at most one event per week behind a frequency/cooldown
 * gate, so these cannot be farmed.
 */
import type { EventTemplate, WeeklyEvent } from './engine';
import type { GameState } from '@/contexts/game/types';
import {
  PURSUITS,
  tierForLevel,
  type PursuitDef,
  type PursuitCategory,
} from '@/lib/pursuits/pursuitMastery';

interface ActivePursuit {
  def: PursuitDef;
  level: number;
  xp: number;
}

/** Every pursuit the player has practiced at least once, with its live level. */
function activePursuits(state: GameState): ActivePursuit[] {
  const map = state.pursuits ?? {};
  return PURSUITS.map((def) => {
    const pp = map[def.id];
    return { def, level: pp?.level ?? 0, xp: pp?.xp ?? 0 };
  }).filter((p) => p.xp > 0);
}

/** Active pursuits in the given theme(s), at or above a minimum mastery level. */
function activeByCategory(
  state: GameState,
  cats: PursuitCategory[],
  minLevel = 1,
): ActivePursuit[] {
  return activePursuits(state).filter(
    (p) => p.level >= minLevel && cats.includes(p.def.category),
  );
}

/** Deterministic pick keyed on the week so a given week is stable across resumes. */
function seededPick<T>(items: T[], seed: number): T | undefined {
  if (items.length === 0) return undefined;
  const x = Math.sin(seed) * 10000;
  const roll = x - Math.floor(x);
  return items[Math.min(items.length - 1, Math.floor(roll * items.length))];
}

const seedFor = (state: GameState, salt: number) => (state.weeksLived || 0) * 100 + salt;

/** Trivial fallback so generate() always returns a valid event (never crashes). */
const noopEvent = (id: string): WeeklyEvent => ({
  id,
  description: 'You reflect on your hobbies.',
  choices: [{ id: 'ok', text: 'Continue', effects: {} }],
});

// Reward scaling helpers — modest, mastery-linked, one-off event payouts.
const moneyReward = (level: number, base: number, per: number) => base + level * per;
const repReward = (level: number) => 2 + Math.floor(level / 3); // 2..5
const happyReward = (level: number) => 5 + Math.floor(level / 2); // 5..10

// ── Creative: local show / gallery feature ────────────────────────────────
const hobbyLocalShow: EventTemplate = {
  id: 'hobby_local_show',
  category: 'general',
  weight: 0.22,
  condition: (state) => activeByCategory(state, ['creative']).length > 0,
  generate: (state) => {
    const items = activeByCategory(state, ['creative']);
    const pick = seededPick(items, seedFor(state, 1));
    if (!pick) return noopEvent('hobby_local_show');
    const { def, level } = pick;
    const money = moneyReward(level, 30, 12);
    return {
      id: 'hobby_local_show',
      description: `A curator saw your ${def.name.toLowerCase()} and wants to feature it at a local show. As a ${tierForLevel(level).name}, your work is turning heads.`,
      choices: [
        {
          id: 'exhibit',
          text: `Exhibit it (sell for ~$${money})`,
          effects: { money, stats: { happiness: happyReward(level), reputation: repReward(level) } },
        },
        {
          id: 'keep',
          text: 'Keep it for yourself',
          effects: { stats: { happiness: 4 } },
        },
      ],
    };
  },
};

// ── Physical / intellectual: amateur tournament ───────────────────────────
const hobbyTournament: EventTemplate = {
  id: 'hobby_tournament',
  category: 'general',
  weight: 0.22,
  condition: (state) => activeByCategory(state, ['physical', 'intellectual']).length > 0,
  generate: (state) => {
    const items = activeByCategory(state, ['physical', 'intellectual']);
    const pick = seededPick(items, seedFor(state, 2));
    if (!pick) return noopEvent('hobby_tournament');
    const { def, level } = pick;
    const prize = moneyReward(level, 40, 14);
    return {
      id: 'hobby_tournament',
      description: `There's an amateur ${def.name.toLowerCase()} tournament this weekend. Your ${tierForLevel(level).name}-level skills could place well.`,
      choices: [
        {
          id: 'compete',
          text: `Compete (placing prize ~$${prize})`,
          effects: {
            money: prize,
            stats: { happiness: happyReward(level), reputation: repReward(level), energy: -10 },
          },
        },
        {
          id: 'watch',
          text: 'Just spectate this time',
          effects: { stats: { happiness: 3 } },
        },
      ],
    };
  },
};

// ── Musical: a set / jam goes viral ───────────────────────────────────────
const hobbyWentViral: EventTemplate = {
  id: 'hobby_went_viral',
  category: 'general',
  weight: 0.2,
  condition: (state) => activeByCategory(state, ['musical']).length > 0,
  generate: (state) => {
    const items = activeByCategory(state, ['musical']);
    const pick = seededPick(items, seedFor(state, 3));
    if (!pick) return noopEvent('hobby_went_viral');
    const { def, level } = pick;
    const tips = moneyReward(level, 20, 10);
    return {
      id: 'hobby_went_viral',
      description: `A clip of your ${def.name.toLowerCase()} session is blowing up online! Comments are pouring in.`,
      choices: [
        {
          id: 'ride',
          text: `Ride the wave (tips ~$${tips})`,
          effects: { money: tips, stats: { happiness: happyReward(level), reputation: repReward(level) + 2 } },
        },
        {
          id: 'humble',
          text: 'Stay humble and keep practicing',
          effects: { stats: { happiness: 5 } },
        },
      ],
    };
  },
};

// ── Culinary / collecting: a marketplace sale ─────────────────────────────
const hobbyMarketplaceSale: EventTemplate = {
  id: 'hobby_marketplace_sale',
  category: 'general',
  weight: 0.2,
  condition: (state) => activeByCategory(state, ['culinary', 'collecting']).length > 0,
  generate: (state) => {
    const items = activeByCategory(state, ['culinary', 'collecting']);
    const pick = seededPick(items, seedFor(state, 4));
    if (!pick) return noopEvent('hobby_marketplace_sale');
    const { def, level } = pick;
    const money = moneyReward(level, 35, 16);
    return {
      id: 'hobby_marketplace_sale',
      description: `A buyer at the weekend market is very interested in your ${def.name.toLowerCase()}. Your ${tierForLevel(level).name} reputation precedes you.`,
      choices: [
        {
          id: 'sell',
          text: `Make the sale (~$${money})`,
          effects: { money, stats: { happiness: happyReward(level) - 1, reputation: repReward(level) } },
        },
        {
          id: 'pass',
          text: 'Not for sale',
          effects: { stats: { happiness: 3 } },
        },
      ],
    };
  },
};

// ── Social / outdoor: community spotlight ─────────────────────────────────
const hobbyCommunitySpotlight: EventTemplate = {
  id: 'hobby_community_spotlight',
  category: 'general',
  weight: 0.2,
  condition: (state) => activeByCategory(state, ['social', 'outdoor', 'wellness']).length > 0,
  generate: (state) => {
    const items = activeByCategory(state, ['social', 'outdoor', 'wellness']);
    const pick = seededPick(items, seedFor(state, 5));
    if (!pick) return noopEvent('hobby_community_spotlight');
    const { def, level } = pick;
    return {
      id: 'hobby_community_spotlight',
      description: `The local paper wants to spotlight your dedication to ${def.name.toLowerCase()}. Neighbors have noticed your ${tierForLevel(level).name} commitment.`,
      choices: [
        {
          id: 'feature',
          text: 'Do the interview',
          effects: { stats: { happiness: happyReward(level), reputation: repReward(level) + 2 } },
        },
        {
          id: 'decline',
          text: 'Politely decline the attention',
          effects: { stats: { happiness: 4 } },
        },
      ],
    };
  },
};

// ── Any Skilled+ hobby: a creative/skill breakthrough ─────────────────────
const hobbyBreakthrough: EventTemplate = {
  id: 'hobby_breakthrough',
  category: 'general',
  weight: 0.18,
  // Only for a hobby you've built real skill in (Skilled tier = level 4+).
  condition: (state) => activePursuits(state).some((p) => p.level >= 4),
  generate: (state) => {
    const items = activePursuits(state).filter((p) => p.level >= 4);
    const pick = seededPick(items, seedFor(state, 6));
    if (!pick) return noopEvent('hobby_breakthrough');
    const { def, level } = pick;
    return {
      id: 'hobby_breakthrough',
      description: `Something clicked during your ${def.name.toLowerCase()} practice — a genuine ${tierForLevel(level).name} breakthrough. You feel unstoppable.`,
      choices: [
        {
          id: 'savor',
          text: 'Savor the moment',
          effects: { stats: { happiness: happyReward(level) + 2, reputation: repReward(level) } },
        },
        {
          id: 'push',
          text: 'Push even harder',
          effects: { stats: { happiness: 4, reputation: repReward(level) + 1, energy: -8 } },
        },
      ],
    };
  },
};

// ── Any Expert+ hobby: invited to teach ───────────────────────────────────
const hobbyInvitedToTeach: EventTemplate = {
  id: 'hobby_invited_to_teach',
  category: 'general',
  weight: 0.16,
  // Expert tier = level 6+.
  condition: (state) => activePursuits(state).some((p) => p.level >= 6),
  generate: (state) => {
    const items = activePursuits(state).filter((p) => p.level >= 6);
    const pick = seededPick(items, seedFor(state, 7));
    if (!pick) return noopEvent('hobby_invited_to_teach');
    const { def, level } = pick;
    const fee = moneyReward(level, 50, 18);
    return {
      id: 'hobby_invited_to_teach',
      description: `A community center asks you to teach a ${def.name.toLowerCase()} class — your ${tierForLevel(level).name} expertise is in demand.`,
      choices: [
        {
          id: 'teach',
          text: `Teach the class (~$${fee})`,
          effects: { money: fee, stats: { reputation: repReward(level) + 2, happiness: 5, energy: -8 } },
        },
        {
          id: 'decline',
          text: 'Decline — keep it a hobby',
          effects: { stats: { happiness: 3 } },
        },
      ],
    };
  },
};

export const hobbyEventTemplates: EventTemplate[] = [
  hobbyLocalShow,
  hobbyTournament,
  hobbyWentViral,
  hobbyMarketplaceSale,
  hobbyCommunitySpotlight,
  hobbyBreakthrough,
  hobbyInvitedToTeach,
];
