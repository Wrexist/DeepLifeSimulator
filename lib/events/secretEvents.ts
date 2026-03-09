/**
 * Secret / Easter Egg Events
 *
 * Hidden events with extremely narrow trigger conditions. Players discover
 * them by accident or through community sharing on social media/Reddit.
 * Each has weight 100 so when conditions match, they ALWAYS fire.
 *
 * Community discovery of these drives viral social media discussions:
 * "Has anyone gotten the $777,777 event??"
 */
import type { EventTemplate } from './engine';
import type { GameState } from '@/contexts/game/types';

// Helper: calculate rough net worth
const getNetWorth = (s: GameState): number => {
  const cash = s.stats?.money ?? 0;
  const bankBalance = s.bankSavings ?? 0;
  const holdings = Array.isArray(s.stocks) ? s.stocks : (s.stocks?.holdings ?? []);
  const stocks = Array.isArray(holdings)
    ? holdings.reduce(
        (sum: number, st: any) => sum + (st.shares ?? 0) * (st.currentPrice ?? 0),
        0
      )
    : 0;
  const realEstate =
    Array.isArray(s.realEstate)
      ? s.realEstate.reduce((sum: number, r: any) => sum + (r.value ?? 0), 0)
      : 0;
  return cash + bankBalance + stocks + realEstate;
};

const getAge = (s: GameState) => Math.floor(s.date?.age ?? 18);

const getAchievementCount = (s: GameState) =>
  Array.isArray(s.achievements)
    ? s.achievements.filter((a: any) => a.completed).length
    : 0;

// ─── Secret event templates ──────────────────────────────────────

const luckyNumber: EventTemplate = {
  id: 'secret_lucky_777',
  category: 'economy',
  weight: 100,
  condition: (s) => Math.floor(s.stats?.money ?? 0) === 777777,
  generate: () => ({
    id: 'secret_lucky_777',
    description:
      '🍀 Your bank balance reads exactly $777,777. A golden envelope mysteriously appears in your mailbox with a wax seal.',
    choices: [
      {
        id: 'open',
        text: 'Open the golden envelope',
        effects: { money: 77777, stats: { happiness: 30 } },
      },
      {
        id: 'frame',
        text: 'Frame the envelope as a good luck charm',
        effects: { money: 7777, stats: { happiness: 20 } },
      },
    ],
  }),
};

const rockBottom: EventTemplate = {
  id: 'secret_rock_bottom',
  category: 'general',
  weight: 100,
  condition: (s) =>
    (s.stats?.health ?? 100) <= 5 &&
    (s.stats?.happiness ?? 100) <= 5 &&
    (s.stats?.energy ?? 100) <= 5 &&
    (s.stats?.money ?? 1) <= 0,
  generate: () => ({
    id: 'secret_rock_bottom',
    description:
      '💫 You hit absolute rock bottom. Sitting on a park bench with nothing, a stranger sits down next to you. "I was where you are once," they say, handing you an envelope. "I believe in you."',
    choices: [
      {
        id: 'accept',
        text: 'Accept their help',
        effects: {
          money: 500,
          stats: { happiness: 30, energy: 25, health: 15 },
        },
      },
    ],
  }),
};

const centuryClub: EventTemplate = {
  id: 'secret_century_club',
  category: 'general',
  weight: 100,
  condition: (s) => getAge(s) === 100,
  generate: () => ({
    id: 'secret_century_club',
    description:
      '🎂 Happy 100th birthday! The mayor personally visits your home with a key to the city. News crews are outside. You made it to the century club!',
    choices: [
      {
        id: 'speech',
        text: 'Give a speech about your incredible life',
        effects: {
          money: 10000,
          stats: { happiness: 50, reputation: 30 },
        },
      },
      {
        id: 'quiet',
        text: 'Enjoy a quiet celebration with family',
        effects: { stats: { happiness: 40 } },
      },
    ],
  }),
};

const cleanSlate: EventTemplate = {
  id: 'secret_clean_slate',
  category: 'economy',
  weight: 100,
  condition: (s) => {
    const nw = getNetWorth(s);
    return nw === 0 && (s.weeksLived ?? 0) > 50;
  },
  generate: () => ({
    id: 'secret_clean_slate',
    description:
      '🪶 Your net worth is exactly $0. Not in debt, not wealthy. Perfectly balanced. A monk approaches you and says, "True freedom is wanting nothing."',
    choices: [
      {
        id: 'enlightened',
        text: '"I understand now"',
        effects: { stats: { happiness: 40, energy: 20 } },
      },
      {
        id: 'nah',
        text: '"I want money though"',
        effects: { money: 100, stats: { happiness: 5 } },
      },
    ],
  }),
};

const perfectStats: EventTemplate = {
  id: 'secret_perfect_balance',
  category: 'general',
  weight: 100,
  condition: (s) =>
    (s.stats?.health ?? 0) >= 95 &&
    (s.stats?.happiness ?? 0) >= 95 &&
    (s.stats?.energy ?? 0) >= 95 &&
    (s.stats?.fitness ?? 0) >= 80,
  generate: () => ({
    id: 'secret_perfect_balance',
    description:
      '✨ You feel... perfect. Every cell in your body is vibrating with life. You look in the mirror and your eyes are literally glowing. Is this what enlightenment feels like?',
    choices: [
      {
        id: 'transcend',
        text: 'Embrace the feeling',
        effects: { stats: { happiness: 20 }, money: 5000 },
      },
      {
        id: 'share',
        text: 'Post about it on social media',
        effects: { stats: { reputation: 15, happiness: 10 } },
      },
    ],
  }),
};

const millionaireBirthday: EventTemplate = {
  id: 'secret_millionaire_at_21',
  category: 'economy',
  weight: 100,
  condition: (s) => getAge(s) === 21 && getNetWorth(s) >= 1_000_000,
  generate: () => ({
    id: 'secret_millionaire_at_21',
    description:
      '🥂 You just turned 21 and you\'re already a millionaire. A business magazine wants to feature you in their "30 Under 30" list.',
    choices: [
      {
        id: 'accept',
        text: 'Accept the feature',
        effects: { stats: { reputation: 25, happiness: 20 } },
      },
      {
        id: 'humble',
        text: 'Stay humble, stay hungry',
        effects: { stats: { happiness: 10 } },
      },
    ],
  }),
};

const unluckyThirteen: EventTemplate = {
  id: 'secret_unlucky_13',
  category: 'general',
  weight: 100,
  condition: (s) => {
    const age = getAge(s);
    const week = s.week ?? 1;
    // Age 13, week 1 of month (approximately Friday the 13th)
    return age === 13 && week === 1;
  },
  generate: () => ({
    id: 'secret_unlucky_13',
    description:
      "🖤 It's your 13th year and things feel... ominous. A black cat crosses your path. You walk under a ladder. You break a mirror. All in one day.",
    choices: [
      {
        id: 'superstitious',
        text: "I'm not going outside for a week",
        effects: { stats: { happiness: -10, energy: 10 } },
      },
      {
        id: 'brave',
        text: "Superstition is nonsense",
        effects: { stats: { happiness: 5 } },
      },
    ],
  }),
};

const exactlyBroke: EventTemplate = {
  id: 'secret_exactly_broke',
  category: 'economy',
  weight: 100,
  condition: (s) => {
    const money = Math.floor(s.stats?.money ?? 1);
    return money === 1;
  },
  generate: () => ({
    id: 'secret_exactly_broke',
    description:
      "💰 You have exactly $1 to your name. A coin lands heads-up in front of you. Is this a sign?",
    choices: [
      {
        id: 'pick_up',
        text: 'Pick up the lucky penny',
        effects: { stats: { happiness: 5 } },
      },
      {
        id: 'leave',
        text: 'Leave it for someone who needs it more',
        effects: {
          stats: { happiness: 3 },
          karma: { dimension: 'generosity', amount: 5, reason: 'Left lucky penny' },
        },
      },
    ],
  }),
};

const achievementHunter: EventTemplate = {
  id: 'secret_achievement_hunter',
  category: 'general',
  weight: 100,
  condition: (s) => getAchievementCount(s) >= 25,
  generate: (state) => {
    const count = getAchievementCount(state);
    return {
      id: 'secret_achievement_hunter',
      description: `🏆 With ${count} achievements unlocked, you've attracted the attention of a secret society of overachievers. They invite you to join their exclusive club.`,
      choices: [
        {
          id: 'join',
          text: 'Join the secret society',
          effects: {
            money: 10000,
            stats: { reputation: 10, happiness: 15 },
          },
        },
        {
          id: 'decline',
          text: "I work alone",
          effects: { stats: { happiness: 5 } },
        },
      ],
    };
  },
};

const palindromeAge: EventTemplate = {
  id: 'secret_palindrome',
  category: 'general',
  weight: 100,
  condition: (s) => {
    const wl = s.weeksLived ?? 0;
    const str = String(wl);
    return str.length >= 3 && str === str.split('').reverse().join('');
  },
  generate: (state) => ({
    id: 'secret_palindrome',
    description: `🔢 You've been alive for exactly ${state.weeksLived} weeks — a palindrome number! A math professor stops you on the street to congratulate you.`,
    choices: [
      {
        id: 'celebrate',
        text: 'Celebrate the mathematical beauty',
        effects: { stats: { happiness: 10 }, money: 1000 },
      },
      {
        id: 'confused',
        text: '"How did you know that?"',
        effects: { stats: { happiness: 5 } },
      },
    ],
  }),
};

const niceNumber: EventTemplate = {
  id: 'secret_nice',
  category: 'general',
  weight: 100,
  condition: (s) => {
    const age = getAge(s);
    // Age 69 triggers the meme event (like BitLife)
    return age === 69;
  },
  generate: () => ({
    id: 'secret_nice',
    description:
      "You turned 69. Your friends won't stop making jokes. Your social media is flooded with a single word.",
    choices: [
      {
        id: 'nice',
        text: 'Nice.',
        effects: { stats: { happiness: 15 } },
      },
      {
        id: 'mature',
        text: 'Grow up, people',
        effects: { stats: { happiness: 3 } },
      },
    ],
  }),
};

const fullCircle: EventTemplate = {
  id: 'secret_full_circle',
  category: 'general',
  weight: 100,
  condition: (s) => {
    const prestigeLevel = s.prestige?.prestigeLevel ?? 0;
    const age = getAge(s);
    // On your 2nd+ prestige life, reach the same age you died at last time
    if (prestigeLevel < 1) return false;
    const prevLives = s.previousLives ?? [];
    if (prevLives.length === 0) return false;
    const lastLife = prevLives[prevLives.length - 1];
    const lastAge = lastLife?.ageAtDeath ?? 0;
    return lastAge > 0 && age === lastAge;
  },
  generate: (state) => {
    const prevLives = state.previousLives ?? [];
    const lastLife = prevLives[prevLives.length - 1];
    const lastAge = lastLife?.ageAtDeath ?? 0;
    return {
      id: 'secret_full_circle',
      description: `🔄 You just turned ${lastAge} — the exact age you died in your previous life. A chill runs down your spine. Déjà vu hits hard.`,
      choices: [
        {
          id: 'determined',
          text: 'This time will be different',
          effects: { stats: { happiness: 10, energy: 15 } },
        },
        {
          id: 'spooked',
          text: "That's... unsettling",
          effects: { stats: { happiness: -8 } },
        },
      ],
    };
  },
};

export const secretEventTemplates: EventTemplate[] = [
  luckyNumber,
  rockBottom,
  centuryClub,
  cleanSlate,
  perfectStats,
  millionaireBirthday,
  unluckyThirteen,
  exactlyBroke,
  achievementHunter,
  palindromeAge,
  niceNumber,
  fullCircle,
];
