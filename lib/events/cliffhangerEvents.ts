/**
 * Cliffhanger Events
 *
 * After advancing a week, a small chance (~7%, ~10% in the first 12 weeks) to
 * show a teaser like "Your partner has been acting strange lately..." that
 * resolves as an event the following week. Creates a "one more turn" pull while
 * staying rare enough (roughly one every 10–15 weeks) to feel special.
 *
 * Each cliffhanger has:
 * - teaser: text shown on WeeklyResultSheet
 * - condition: when eligible (e.g., must have a spouse)
 * - resolveEvent: the event that fires next week
 */
import type { WeeklyEvent } from './engine';
import type { GameState } from '@/contexts/game/types';
import { weeksInThisLife } from '@/lib/progress/lifeChapters';
import { makeWeeklyRoll } from '@/utils/seededRoll';

export interface CliffhangerDefinition {
  id: string;
  teaser: string;
  weight: number;
  condition?: (state: GameState) => boolean;
  resolveEvent: (state: GameState) => WeeklyEvent;
}

export const CLIFFHANGERS: CliffhangerDefinition[] = [
  // ── Relationship cliffhangers ──
  {
    id: 'ch_partner_secret',
    teaser: 'Your partner has been acting distant lately...',
    weight: 0.3,
    condition: (s) =>
      !!s.family?.spouse ||
      (s.relationships ?? []).some(
        (r: any) => r.type === 'partner' || r.type === 'spouse'
      ),
    resolveEvent: () => ({
      id: 'ch_partner_secret_resolve',
      description:
        "They finally say it: they have been unhappy for a long time, and they have been working out how to tell you.",
      choices: [
        {
          id: 'fight_for_it',
          text: 'Ask them to work on it with you',
          // Costs something real up front. Counselling, time, swallowing pride —
          // and it does not guarantee anything, which is the point.
          effects: { money: -1200, stats: { happiness: -8 }, relationship: 18 },
        },
        {
          id: 'let_go',
          text: 'Tell them to go, then',
          effects: { stats: { happiness: -25 }, relationship: -40 },
        },
      ],
    }),
  },
  {
    id: 'ch_partner_phone',
    teaser: 'You saw a suspicious message on your partner\'s phone...',
    weight: 0.2,
    condition: (s) =>
      !!s.family?.spouse ||
      (s.relationships ?? []).some(
        (r: any) => r.type === 'partner' || r.type === 'spouse'
      ),
    resolveEvent: () => ({
      id: 'ch_partner_phone_resolve',
      description:
        "It is not a jewellery store. It is someone at their work, and it has been going on for months.",
      choices: [
        {
          id: 'confront',
          text: 'Put the phone down in front of them',
          // The honest option and the expensive one. Ends it either way.
          effects: { stats: { happiness: -22 }, relationship: -45 },
        },
        {
          id: 'say_nothing',
          text: 'Say nothing and carry it',
          // Cheaper this week, worse every week after. Knowing and pretending
          // not to is its own slow cost.
          effects: { stats: { happiness: -16, health: -4 }, relationship: -8 },
        },
      ],
    }),
  },

  // ── Career cliffhangers ──
  {
    id: 'ch_boss_meeting',
    teaser: 'Your boss called an urgent meeting for Monday...',
    weight: 0.3,
    condition: (s) => !!s.currentJob,
    resolveEvent: (state) => {
      const performance = state.stats?.reputation ?? 50;
      if (performance >= 60) {
        return {
          id: 'ch_boss_meeting_resolve',
          description:
            "Your boss announces you're being considered for a leadership position! The role comes with a significant raise.",
          choices: [
            {
              id: 'accept',
              text: "I'm ready for the challenge!",
              effects: { money: 500, stats: { happiness: 15, reputation: 5 } },
            },
            {
              id: 'negotiate',
              text: 'Only if the pay reflects the responsibility',
              effects: { money: 1000, stats: { happiness: 10 } },
            },
          ],
        };
      }
      return {
        id: 'ch_boss_meeting_resolve',
        description:
          "Your boss announces company-wide budget cuts. Everyone's taking a temporary pay reduction.",
        choices: [
          {
            id: 'accept',
            text: 'Accept it - at least I still have a job',
            effects: { money: -200, stats: { happiness: -8 } },
          },
          {
            id: 'protest',
            text: 'Push back on the cuts',
            effects: { money: -100, stats: { happiness: -5, reputation: -3 } },
          },
        ],
      };
    },
  },
  {
    id: 'ch_coworker_whisper',
    teaser: 'Your coworkers keep whispering and going quiet when you walk by...',
    weight: 0.2,
    condition: (s) => !!s.currentJob,
    resolveEvent: () => ({
      id: 'ch_coworker_whisper_resolve',
      description:
        "They were planning a surprise birthday/work anniversary celebration for you! Cake, decorations, the works.",
      choices: [
        {
          id: 'happy',
          text: "You guys are the best!",
          effects: { stats: { happiness: 15, energy: 5 } },
        },
        {
          id: 'awkward',
          text: "That's sweet but I hate surprises",
          effects: { stats: { happiness: 5 } },
        },
      ],
    }),
  },

  // ── Mystery cliffhangers ──
  {
    id: 'ch_mysterious_letter',
    teaser: 'A mysterious letter with no return address arrived today...',
    weight: 0.25,
    condition: (s) => weeksInThisLife(s) > 10,
    resolveEvent: () => ({
      id: 'ch_mysterious_letter_resolve',
      description:
        "The letter is from a long-lost relative. They're leaving you a small inheritance - but there's a catch. You must visit their hometown first.",
      choices: [
        {
          id: 'visit',
          text: 'Plan a trip to visit',
          effects: { money: 2000, stats: { happiness: 10 } },
        },
        {
          id: 'decline',
          text: 'Too suspicious - throw it away',
          effects: { stats: { happiness: -3 } },
        },
      ],
    }),
  },
  {
    id: 'ch_strange_noise',
    teaser: "There's a strange noise coming from your attic at night...",
    weight: 0.15,
    condition: (s) =>
      Array.isArray(s.realEstate) && s.realEstate.length > 0,
    resolveEvent: () => ({
      id: 'ch_strange_noise_resolve',
      description:
        "You finally investigated the attic and found a family of raccoons living up there. One of them hissed at you.",
      choices: [
        {
          id: 'remove',
          text: 'Call animal control ($150)',
          effects: { money: -150, stats: { happiness: 3 } },
        },
        {
          id: 'keep',
          text: "They're kinda cute... let them stay",
          effects: { stats: { happiness: 5 } },
        },
      ],
    }),
  },

  // ── Health cliffhangers ──
  {
    id: 'ch_doctor_callback',
    teaser: "The doctor's office called - they need to discuss your test results...",
    weight: 0.2,
    condition: (s) => weeksInThisLife(s) > 15,
    resolveEvent: (state) => {
      const health = state.stats?.health ?? 50;
      if (health < 40) {
        return {
          id: 'ch_doctor_callback_resolve',
          description:
            "The doctor found some concerning markers in your bloodwork. They want to run more tests, but catching it early is good news.",
          choices: [
            {
              id: 'tests',
              text: 'Schedule the follow-up tests ($300)',
              effects: { money: -300, stats: { health: 5, happiness: -5 } },
            },
            {
              id: 'ignore',
              text: "I'm sure it's nothing",
              effects: { stats: { happiness: -2 } },
            },
          ],
        };
      }
      return {
        id: 'ch_doctor_callback_resolve',
        description:
          "Great news - your bloodwork came back perfect! The doctor says you're in excellent health.",
        choices: [
          {
            id: 'celebrate',
            text: 'That calls for a celebration!',
            effects: { stats: { happiness: 12, health: 3 } },
          },
        ],
      };
    },
  },
  {
    id: 'ch_weird_symptom',
    teaser: "You've been feeling unusually dizzy the past few days...",
    weight: 0.15,
    condition: (s) => (s.stats?.health ?? 100) < 60,
    resolveEvent: () => ({
      id: 'ch_weird_symptom_resolve',
      description:
        "Turns out you were just dehydrated. The doctor says to drink more water and you'll be fine.",
      choices: [
        {
          id: 'relieved',
          text: 'Buy a big water bottle',
          effects: { money: -20, stats: { health: 5, happiness: 5 } },
        },
      ],
    }),
  },

  // ── Financial cliffhangers ──
  {
    id: 'ch_bank_call',
    teaser: 'You received an urgent call from your bank...',
    weight: 0.2,
    condition: (s) => (s.stats?.money ?? 0) > 1000,
    resolveEvent: () => ({
      id: 'ch_bank_call_resolve',
      description:
        "Your bank detected unusual activity on your account. Fortunately, they froze it in time - no money was lost.",
      choices: [
        {
          id: 'secure',
          text: 'Change all my passwords',
          effects: { stats: { happiness: -3 } },
        },
        {
          id: 'upgrade',
          text: 'Upgrade to premium security ($50/mo)',
          effects: { money: -200, stats: { happiness: 2 } },
        },
      ],
    }),
  },
  {
    id: 'ch_investment_news',
    teaser: 'Breaking news about one of your investments...',
    weight: 0.2,
    condition: (s) => Array.isArray(s.stocks) && s.stocks.length > 0,
    resolveEvent: () => ({
      id: 'ch_investment_news_resolve',
      description:
        "Good news! The company you invested in just announced record quarterly earnings. Your portfolio got a nice bump.",
      choices: [
        {
          id: 'hold',
          text: 'Hold and ride the wave',
          effects: { money: 1000, stats: { happiness: 10 } },
        },
        {
          id: 'sell',
          text: 'Cash out while ahead',
          effects: { money: 2000, stats: { happiness: 8 } },
        },
      ],
    }),
  },

  // ── Social cliffhangers ──
  {
    id: 'ch_friend_trouble',
    teaser: "Your best friend sent you a text: 'We need to talk...'",
    weight: 0.2,
    condition: (s) => (s.relationships ?? []).length > 0,
    resolveEvent: () => ({
      id: 'ch_friend_trouble_resolve',
      description:
        "Your friend needed advice about a big life decision - they're thinking about moving abroad and wanted your honest opinion.",
      choices: [
        {
          id: 'support',
          text: "Follow your dreams, I'll support you",
          effects: { stats: { happiness: 5 }, relationship: 15 },
        },
        {
          id: 'honest',
          text: "Think carefully - that's a huge change",
          effects: { stats: { happiness: 3 }, relationship: 5 },
        },
      ],
    }),
  },
  {
    id: 'ch_neighbor_complaint',
    teaser: "Your neighbor left an angry note on your door...",
    weight: 0.15,
    condition: (s) =>
      Array.isArray(s.realEstate) && s.realEstate.length > 0,
    resolveEvent: () => ({
      id: 'ch_neighbor_complaint_resolve',
      description:
        "Turns out the note was for the wrong apartment! Your neighbor apologized profusely and brought you homemade cookies.",
      choices: [
        {
          id: 'accept',
          text: 'Accept the cookies and laugh it off',
          effects: { stats: { happiness: 8 } },
        },
        {
          id: 'grudge',
          text: "That really stressed me out though",
          effects: { stats: { happiness: -2 } },
        },
      ],
    }),
  },

  // ── Legal/danger cliffhangers ──
  {
    id: 'ch_police_visit',
    teaser: 'Police officers showed up at your door asking questions...',
    weight: 0.1,
    condition: (s) => weeksInThisLife(s) > 20,
    resolveEvent: () => ({
      id: 'ch_police_visit_resolve',
      description:
        "The police were investigating a break-in in the neighborhood and just canvassing for witnesses. They thanked you for your time.",
      choices: [
        {
          id: 'cooperate',
          text: 'Happy to help',
          effects: { stats: { happiness: 2 } },
        },
        {
          id: 'nervous',
          text: "That was nerve-wracking",
          effects: { stats: { happiness: -5 } },
        },
      ],
    }),
  },
  {
    id: 'ch_email_from_lawyer',
    teaser: 'You received an email from a lawyer you\'ve never heard of...',
    weight: 0.15,
    condition: (s) => weeksInThisLife(s) > 25,
    resolveEvent: () => ({
      id: 'ch_email_from_lawyer_resolve',
      description:
        "A distant relative passed away and named you in their will. After legal fees, you receive a modest but unexpected inheritance.",
      choices: [
        {
          id: 'grateful',
          text: "I didn't even know them well",
          effects: { money: 3000, stats: { happiness: 8 } },
        },
        {
          id: 'donate',
          text: 'Donate it to charity in their memory',
          effects: {
            stats: { happiness: 12 },
            karma: {
              dimension: 'generosity',
              amount: 15,
              reason: 'Donated inheritance to charity',
            },
          },
        },
      ],
    }),
  },
];

/**
 * Roll for a cliffhanger to show on the weekly result sheet.
 * Returns null if no cliffhanger triggers (fires ~7% of eligible weeks,
 * ~10% in the first 12 weeks).
 */
export function rollCliffhanger(
  state: GameState,
  seed: number
): { teaser: string; resolveEventId: string; definition: CliffhangerDefinition } | null {
  // Only roll if no cliffhanger is already pending
  if (state.pendingCliffhanger) return null;

  // Base chance: ~7% normally, a small bump to ~10% in the first 12 weeks so new
  // players still meet the "what happens next?" narrative hook without it firing
  // constantly. Players reported the old 22%/32% rates felt like every week —
  // this cliffhanger drives BOTH the weekly-summary teaser and next week's popup,
  // so the target cadence is roughly one every 10–15 weeks.
  // "first 12 weeks" means twelve weeks into THIS life, not twelve weeks past
  // age 18 — `weeksLived` is absolute and seeded from the starting age, so the
  // new-player bump never applied to any scenario that does not start at 18.
  const threshold = weeksInThisLife(state) <= 12 ? 0.10 : 0.07;
  // Deterministic per week, but genuinely varied. The old fire roll was
  // `(seed*997+31)%100` — 997 ≡ 97 (mod 100), gcd(97,100)=1, so cliffhanger
  // weeks were a FIXED permutation repeating every 100 weeks, identical for
  // every player and every life (2026-08-24 audit; same class as the lucky
  // bonus). Routed through the audited seeded RNG, salted per-life so two
  // lives don't share a timeline. Same fix for the weight pick below.
  const rollFor = makeWeeklyRoll(seed);
  const lifeSalt = `${state.lineageId || ''}:${state.generationNumber || 1}`;
  const roll = rollFor(`cliffhanger-fire:${lifeSalt}`);
  if (roll > threshold) return null;

  // Filter eligible cliffhangers
  const eligible = CLIFFHANGERS.filter(
    (ch) => !ch.condition || ch.condition(state)
  );
  if (eligible.length === 0) return null;

  // Pick one based on weights
  const totalWeight = eligible.reduce((sum, ch) => sum + ch.weight, 0);
  let weightRoll = rollFor(`cliffhanger-pick:${lifeSalt}`) * totalWeight;

  for (const ch of eligible) {
    weightRoll -= ch.weight;
    if (weightRoll <= 0) {
      return {
        teaser: ch.teaser,
        resolveEventId: ch.id,
        definition: ch,
      };
    }
  }

  return null;
}

/**
 * Get the resolve event for a pending cliffhanger.
 */
export function resolveCliffhanger(
  cliffhangerId: string,
  state: GameState
): WeeklyEvent | null {
  const definition = CLIFFHANGERS.find((ch) => ch.id === cliffhangerId);
  if (!definition) return null;
  return definition.resolveEvent(state);
}
