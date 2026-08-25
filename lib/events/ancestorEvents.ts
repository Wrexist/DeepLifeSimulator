/**
 * Ancestor events - the world remembers the lives you already lived.
 *
 * WHY THIS PACK EXISTS. Every other event in the game could fire in anyone's
 * first life. Nothing in ~340 templates read `previousLives`, so a tenth
 * generation met exactly the same world as a first character, and the honest
 * answer to "why start another life?" was "the numbers carry over". The
 * dynasty was bookkeeping, not fiction (2026-08-25 endgame round).
 *
 * These read the player's OWN finished lives and name them. `buildLifeRecord`
 * has stored the material since it was written - name, generation, net worth,
 * age at death, career line, spouse, ribbon - and until now only the Legacy
 * Timeline rendered any of it. An ancestor event is the cheapest content in
 * the game per unit of meaning, because the player wrote it themselves.
 *
 * RULES THIS PACK FOLLOWS
 *  - Gated on dynasty DEPTH (`previousLives`), never on a prestige counter:
 *    what summons your ancestors is having ancestors.
 *  - Deterministic payloads. Which ancestor a beat names is picked with
 *    `payloadRoll`/`pickSeeded`, so a React 19 double-invoked updater builds
 *    the same event (CLAUDE.md §4.3) rather than re-rolling a relative.
 *  - Degrade, never throw. Records come off disk and may be partial, so every
 *    read has a fallback and `describeAncestor` never returns an empty string.
 *  - `oncePerLife` on the beats whose fiction is a first meeting - a sealed
 *    letter from your great-grandmother cannot arrive twice.
 */
import type { EventTemplate } from './engine';
import type { GameState } from '@/contexts/game/types';
import { payloadRoll, pickSeeded } from './seededPayload';

type Ancestor = NonNullable<GameState['previousLives']>[number];

/** Finished lives, newest first. Empty for a first life. */
function ancestors(state: GameState): Ancestor[] {
  const lives = state?.previousLives;
  if (!Array.isArray(lives)) return [];
  return lives.filter(Boolean).slice().reverse();
}

function hasAncestors(state: GameState, atLeast = 1): boolean {
  return ancestors(state).length >= atLeast;
}

/** Deterministic ancestor for one event's payload. */
function pickAncestor(state: GameState, eventId: string): Ancestor | undefined {
  const list = ancestors(state);
  if (list.length === 0) return undefined;
  return pickSeeded(list, payloadRoll(state, eventId), 'ancestor');
}

/**
 * How the family refers to them. Falls back through name → generation →
 * a plain noun, so a partial record still reads as a person.
 */
function ancestorName(a: Ancestor | undefined): string {
  const name = typeof a?.name === 'string' ? a.name.trim() : '';
  if (name) return name;
  const gen = typeof a?.generation === 'number' ? a.generation : undefined;
  return gen ? `your ancestor of the ${ordinal(gen)} generation` : 'your ancestor';
}

function ordinal(n: number): string {
  const v = Math.max(1, Math.floor(n));
  const s = ['th', 'st', 'nd', 'rd'];
  const m = v % 100;
  return `${v}${s[(m - 20) % 10] || s[m] || s[0]}`;
}

/** "a shipping magnate", "a woman who died at 91" - never empty. */
function describeAncestor(a: Ancestor | undefined): string {
  const career = Array.isArray(a?.careerHistory)
    ? a?.careerHistory.find((line) => typeof line === 'string' && line.length > 0)
    : undefined;
  if (career) return String(career).toLowerCase();
  if (typeof a?.ribbonName === 'string' && a.ribbonName) return String(a.ribbonName).toLowerCase();
  if (typeof a?.ageAtDeath === 'number' && a.ageAtDeath > 0) return `who lived to ${Math.floor(a.ageAtDeath)}`;
  return 'whose name still means something here';
}

function money(n: number): string {
  const v = Math.max(0, Math.round(n));
  if (v >= 1_000_000_000) return `$${(v / 1_000_000_000).toFixed(1)}B`;
  if (v >= 1_000_000) return `$${(v / 1_000_000).toFixed(1)}M`;
  if (v >= 1_000) return `$${Math.round(v / 1_000)}k`;
  return `$${v}`;
}

// ─── The beats ────────────────────────────────────────────────────────────

/** A first letter can only arrive once - the fiction breaks if it repeats. */
const ancestorLetter: EventTemplate = {
  id: 'ancestor_letter',
  category: 'general',
  weight: 0.6,
  oncePerLife: true,
  rarity: 'rare',
  condition: (s) => hasAncestors(s),
  generate: (state) => {
    const a = pickAncestor(state, 'ancestor_letter');
    const who = ancestorName(a);
    const age = typeof a?.ageAtDeath === 'number' && a.ageAtDeath > 0 ? Math.floor(a.ageAtDeath) : null;
    return {
      id: 'ancestor_letter',
      description:
        `A solicitor delivers a sealed envelope that has been in storage for years. ` +
        `It is addressed to you in the handwriting of ${who}` +
        `${age ? `, written the year before they died at ${age}` : ''}.`,
      choices: [
        {
          id: 'read',
          text: 'Read it now',
          effects: { stats: { happiness: 14 } },
          createsMemory: true,
          memoryText: `Read the letter ${who} left behind.`,
        },
        {
          id: 'keep_sealed',
          text: 'Keep it sealed for your own children',
          effects: { stats: { happiness: 6, reputation: 2 } },
          createsMemory: true,
          memoryText: `Kept ${who}'s sealed letter for the next generation.`,
        },
      ],
    };
  },
};

/** The family name opens a door. */
const ancestorNameOpensDoor: EventTemplate = {
  id: 'ancestor_name_opens_door',
  category: 'general',
  weight: 0.5,
  condition: (s) => hasAncestors(s),
  generate: (state) => {
    const a = pickAncestor(state, 'ancestor_name_opens_door');
    const who = ancestorName(a);
    return {
      id: 'ancestor_name_opens_door',
      description:
        `Someone at a function stops when they hear your surname. "You're related to ${who}? ` +
        `I knew of them - ${describeAncestor(a)}." The room warms to you.`,
      choices: [
        {
          id: 'trade_on_it',
          text: 'Trade on the family name',
          effects: { money: 2500, moneyPct: 0.004, stats: { reputation: 6 } },
        },
        {
          id: 'own_merit',
          text: 'Say you would rather be known for your own work',
          effects: { stats: { reputation: 10, happiness: 5 } },
        },
      ],
    };
  },
};

/** An old obligation from a life the player actually lived. */
const ancestorObligation: EventTemplate = {
  id: 'ancestor_obligation',
  category: 'economy',
  weight: 0.45,
  condition: (s) => hasAncestors(s),
  generate: (state) => {
    const a = pickAncestor(state, 'ancestor_obligation');
    const who = ancestorName(a);
    return {
      id: 'ancestor_obligation',
      description:
        `An elderly stranger produces a yellowed note. ${who} borrowed from their family ` +
        `and never settled it. There is no legal claim left - only the note, and the fact that it is true.`,
      choices: [
        {
          id: 'settle',
          text: 'Settle it in full',
          effects: { money: -4000, moneyPct: -0.006, stats: { reputation: 12, happiness: 5 } },
          createsMemory: true,
          memoryText: `Settled a debt ${who} left unpaid.`,
        },
        { id: 'part', text: 'Pay what feels fair', effects: { money: -1200, stats: { reputation: 4 } } },
        { id: 'refuse', text: 'It died with them', effects: { stats: { reputation: -6 } } },
      ],
    };
  },
};

/**
 * The records board, quoted back at the player as a challenge.
 *
 * Deliberately reads the SAME figure `familyRecords` shows on the Progression
 * tab (`previousLives[].netWorth`), so the number in the event and the number
 * on the board are one fact, not two.
 */
const ancestorRecordChallenge: EventTemplate = {
  id: 'ancestor_record_challenge',
  category: 'economy',
  weight: 0.5,
  condition: (s) => {
    const list = ancestors(s);
    if (list.length === 0) return false;
    // Only worth saying while the record still stands.
    const best = list.reduce((m, l) => Math.max(m, typeof l?.netWorth === 'number' ? l.netWorth : 0), 0);
    return best > 0;
  },
  generate: (state) => {
    const list = ancestors(state);
    const best = list.reduce<Ancestor | undefined>(
      (top, l) =>
        (typeof l?.netWorth === 'number' ? l.netWorth : 0) >
        (typeof top?.netWorth === 'number' ? top.netWorth : 0)
          ? l
          : top,
      undefined,
    );
    const who = ancestorName(best);
    const mark = money(typeof best?.netWorth === 'number' ? best.netWorth : 0);
    return {
      id: 'ancestor_record_challenge',
      description:
        `A family archivist is compiling your line's history. "${who} is still the high-water mark," ` +
        `they say, almost kindly. "${mark}. Nobody since has come close."`,
      choices: [
        {
          id: 'accept',
          text: 'Take it as a target',
          effects: { stats: { happiness: 6, reputation: 3 } },
          createsMemory: true,
          memoryText: `Set out to beat ${who}'s ${mark}.`,
        },
        { id: 'shrug', text: 'Numbers are not the point', effects: { stats: { happiness: 3 } } },
      ],
    };
  },
};

/** Only for a dynasty deep enough to have a plot worth visiting. */
const ancestorGraves: EventTemplate = {
  id: 'ancestor_graves',
  category: 'general',
  weight: 0.4,
  oncePerLife: true,
  condition: (s) => hasAncestors(s, 3),
  generate: (state) => {
    const list = ancestors(state);
    const count = list.length;
    const oldest = list[list.length - 1];
    return {
      id: 'ancestor_graves',
      description:
        `The family plot has ${count} names on it now, the earliest being ${ancestorName(oldest)}. ` +
        `The groundskeeper asks whether you want the stonework kept up.`,
      choices: [
        {
          id: 'endow',
          text: 'Pay to maintain it properly',
          effects: { money: -3000, moneyPct: -0.004, stats: { happiness: 10, reputation: 8 } },
          createsMemory: true,
          memoryText: 'Endowed the upkeep of the family plot.',
        },
        { id: 'visit', text: 'Just visit for a while', effects: { stats: { happiness: 8 } } },
        { id: 'leave', text: 'Leave it to the weather', effects: { stats: { happiness: -4 } } },
      ],
    };
  },
};

/** A rival line with a long memory. Needs a dynasty, and something to envy. */
const ancestorRivalFamily: EventTemplate = {
  id: 'ancestor_rival_family',
  category: 'relationship',
  weight: 0.35,
  condition: (s) => hasAncestors(s, 2),
  generate: (state) => {
    const a = pickAncestor(state, 'ancestor_rival_family');
    const who = ancestorName(a);
    return {
      id: 'ancestor_rival_family',
      description:
        `An old family in town has never forgiven yours. "${who} ruined my grandfather," ` +
        `their heir tells you at a dinner, loudly enough that others hear.`,
      choices: [
        {
          id: 'make_peace',
          text: 'Offer to settle it, whatever it was',
          effects: { money: -2000, stats: { reputation: 8, happiness: 4 } },
          createsMemory: true,
          memoryText: 'Made peace with the family that hated ours.',
        },
        { id: 'stand', text: 'Defend your ancestor', effects: { stats: { reputation: -3, happiness: 6 } } },
        { id: 'ignore', text: 'Let them talk', effects: { stats: { happiness: -2 } } },
      ],
    };
  },
};

export const ancestorEventTemplates: EventTemplate[] = [
  ancestorLetter,
  ancestorNameOpensDoor,
  ancestorObligation,
  ancestorRecordChallenge,
  ancestorGraves,
  ancestorRivalFamily,
];
