import type { GameState } from '@/contexts/game/types';
import type { LifeMoment } from './types';
import { logger } from '@/utils/logger';
import { fnv1a32, makeWeeklyRoll } from '@/utils/seededRoll';
import { weeksSinceLifeStart } from '@/utils/weekCounters';

const log = logger.scope('LifeMomentGenerator');

/**
 * A template optionally gates itself on the player's actual state via
 * `condition`, so moments react to the life you're living (your money, job,
 * family, standing, karma) instead of firing generically.
 */
type LifeMomentTemplate = Omit<LifeMoment, 'id' | 'createdAt'> & {
  condition?: (s: GameState) => boolean;
};

/** Helpers for readable conditions. */
const totalMoney = (s: GameState) => (s.stats?.money ?? 0) + (s.bankSavings ?? 0);
const hasPartner = (s: GameState) =>
  (s.relationships ?? []).some((r) => r.type === 'spouse' || r.type === 'partner');
const hasChildren = (s: GameState) => (s.family?.children ?? []).length > 0;
const karmaScore = (s: GameState) => s.karma?.score ?? 0;

/**
 * Life moment templates
 * Quick 30-60 second decisions that add constant engagement
 */
// Exported for the payoff-completeness ratchet in
// lib/events/__tests__/lifeMomentPayoffs.test.ts: every `unlock_event` target
// authored here must have a registered payoff template, or the promised
// callback silently never arrives (the networking_opportunity orphan,
// 2026-08-24).
export const LIFE_MOMENT_TEMPLATES: LifeMomentTemplate[] = [
  {
    situation: 'A coworker invites you for a coffee break. You\'re swamped with work.',
    choices: [
      {
        id: 'join',
        text: 'Take a 10-minute break',
        quickEffect: [
          { stat: 'happiness', amount: 5, label: '+5 Happiness' },
          { stat: 'energy', amount: 3, label: '+3 Energy' },
        ],
        hiddenEffect: 'Your coworker remembers your friendliness. Future networking opportunities may arise.',
        hiddenConsequences: [
          {
            type: 'unlock_event',
            targetEventId: 'networking_opportunity',
            weeksUntilActive: 3,
            description: 'Your coworker introduces you to someone important.',
          },
        ],
      },
      {
        id: 'decline',
        text: 'Politely decline, keep working',
        quickEffect: [
          { stat: 'happiness', amount: -2, label: '-2 Happiness' },
          { stat: 'reputation', amount: 2, label: '+2 Reputation' },
        ],
        hiddenEffect: 'Your dedication is noticed. Your boss takes note.',
        hiddenConsequences: [
          {
            type: 'modify_weight',
            targetEventId: 'job_bonus',
            weightModifier: 0.1,
            description: 'Your dedication increases chances of bonuses.',
          },
        ],
      },
    ],
    category: 'work',
  },
  {
    situation: 'A street musician is playing beautiful music. You have a few dollars.',
    choices: [
      {
        id: 'tip',
        text: 'Drop $5 in the hat',
        quickEffect: [
          { stat: 'money', amount: -5, label: '-$5' },
          { stat: 'happiness', amount: 8, label: '+8 Happiness' },
        ],
        hiddenEffect: 'The musician remembers your kindness. You might see them again.',
        hiddenConsequences: [
          {
            type: 'unlock_event',
            targetEventId: 'street_musician_friend',
            weeksUntilActive: 5,
            description: 'The street musician recognizes you and plays your favorite song.',
          },
        ],
      },
      {
        id: 'listen',
        text: 'Just listen for a moment',
        quickEffect: [
          { stat: 'happiness', amount: 3, label: '+3 Happiness' },
        ],
        hiddenEffect: 'A moment of peace in your day.',
      },
      {
        id: 'walk',
        text: 'Keep walking',
        quickEffect: [],
        hiddenEffect: 'Life goes on.',
      },
    ],
    category: 'random',
  },
  {
    situation: 'You see someone struggling with heavy groceries. You\'re in a hurry.',
    choices: [
      {
        id: 'help',
        text: 'Offer to help',
        quickEffect: [
          { stat: 'energy', amount: -5, label: '-5 Energy' },
          { stat: 'happiness', amount: 10, label: '+10 Happiness' },
          { stat: 'reputation', amount: 3, label: '+3 Reputation' },
        ],
        karma: { dimension: 'generosity', amount: 4, reason: 'Helped a stranger in need' },
        hiddenEffect: 'Your kindness creates a ripple effect.',
        hiddenConsequences: [
          {
            type: 'modify_weight',
            targetEventId: 'random_act_kindness',
            weightModifier: 0.2,
            description: 'Good deeds attract more opportunities.',
          },
        ],
      },
      {
        id: 'hurry',
        text: 'Keep walking',
        quickEffect: [
          { stat: 'happiness', amount: -3, label: '-3 Happiness' },
        ],
        hiddenEffect: 'You wonder if you should have helped.',
      },
    ],
    category: 'random',
  },
  {
    situation: 'Your phone battery is at 5%. You\'re expecting an important call.',
    choices: [
      {
        id: 'conserve',
        text: 'Turn off unnecessary apps and conserve battery',
        quickEffect: [
          { stat: 'happiness', amount: -2, label: '-2 Happiness' },
        ],
        hiddenEffect: 'Your phone lasts until the call.',
      },
      {
        id: 'charge',
        text: 'Find a charging station (costs $2)',
        quickEffect: [
          { stat: 'money', amount: -2, label: '-$2' },
          { stat: 'happiness', amount: 5, label: '+5 Happiness' },
        ],
        hiddenEffect: 'Peace of mind is worth it.',
      },
    ],
    category: 'random',
  },

  // ── State-aware moments — react to the life you're actually living ──────

  {
    // Windfall decision for the well-off
    situation: 'An old investment quietly matured into a $5,000 windfall. A friend is pitching a risky startup.',
    condition: (s) => totalMoney(s) >= 100_000,
    choices: [
      {
        id: 'gamble',
        text: 'Go all in on the startup',
        quickEffect: [{ stat: 'money', amount: -5000, label: '-$5,000' }, { stat: 'happiness', amount: 6, label: '+6 Happiness' }],
        hiddenEffect: 'High risk, high hope. You\'ll hear how it went.',
        hiddenConsequences: [{ type: 'unlock_event', targetEventId: 'startup_payout', weeksUntilActive: 8, description: 'Your startup bet pays off - or busts.' }],
      },
      {
        id: 'bank',
        text: 'Bank the windfall',
        quickEffect: [{ stat: 'money', amount: 5000, label: '+$5,000' }],
        hiddenEffect: 'Slow and steady. The money is safe.',
      },
    ],
    category: 'money',
  },
  {
    // Relationship white-lie — costs honesty for closeness
    situation: 'Your partner asks you to back up a small white lie to their family tonight.',
    condition: hasPartner,
    choices: [
      {
        id: 'cover',
        text: 'Cover for them',
        quickEffect: [{ stat: 'happiness', amount: 4, label: '+4 Happiness' }, { stat: 'reputation', amount: -1, label: '-1 Reputation' }],
        karma: { dimension: 'honesty', amount: -4, reason: 'Told a white lie to cover for a partner' },
        hiddenEffect: 'They squeeze your hand under the table. You\'re a team - even in the small lies.',
      },
      {
        id: 'honest',
        text: 'Stay honest',
        quickEffect: [{ stat: 'happiness', amount: -3, label: '-3 Happiness' }, { stat: 'reputation', amount: 2, label: '+2 Reputation' }],
        karma: { dimension: 'honesty', amount: 3, reason: 'Chose honesty over a comfortable lie' },
        hiddenEffect: 'Awkward at dinner, but you sleep fine.',
      },
    ],
    category: 'social',
  },
  {
    // Workplace ethics — only if employed
    situation: 'Your manager "suggests" you round up the numbers in this quarter\'s report.',
    condition: (s) => !!s.currentJob,
    choices: [
      {
        id: 'comply',
        text: 'Do as asked',
        quickEffect: [{ stat: 'happiness', amount: -2, label: '-2 Happiness' }, { stat: 'reputation', amount: -3, label: '-3 Reputation' }],
        karma: { dimension: 'honesty', amount: -4, reason: 'Falsified a quarterly report' },
        hiddenEffect: 'The numbers look great. You hope nobody checks.',
        hiddenConsequences: [{ type: 'modify_weight', targetEventId: 'audit_scandal', weightModifier: 0.15, description: 'Fudged numbers can come back around.' }],
      },
      {
        id: 'refuse',
        text: 'Refuse - report it straight',
        quickEffect: [{ stat: 'reputation', amount: 4, label: '+4 Reputation' }, { stat: 'happiness', amount: -1, label: '-1 Happiness' }],
        karma: { dimension: 'honesty', amount: 3, reason: 'Refused to falsify the numbers' },
        hiddenEffect: 'Your manager frowns, but your name stays clean.',
      },
    ],
    category: 'work',
  },
  {
    // Charity gala for the comfortable
    situation: 'A charity gala is raising money for the city hospital. A $500 donation would be noticed.',
    condition: (s) => totalMoney(s) >= 25_000,
    choices: [
      {
        id: 'donate',
        text: 'Donate $500',
        quickEffect: [{ stat: 'money', amount: -500, label: '-$500' }, { stat: 'reputation', amount: 6, label: '+6 Reputation' }, { stat: 'happiness', amount: 4, label: '+4 Happiness' }],
        karma: { dimension: 'generosity', amount: 8, reason: 'Made a generous charitable donation' },
        hiddenEffect: 'Your name goes on the donor wall. People remember generosity.',
      },
      {
        id: 'skip',
        text: 'Skip it',
        quickEffect: [],
        hiddenEffect: 'You keep your money and your evening.',
      },
    ],
    category: 'money',
  },
  {
    // Parenting moment
    situation: 'Your kid is nervous about a school recital. You have a deadline tonight.',
    condition: hasChildren,
    choices: [
      {
        id: 'attend',
        text: 'Drop everything and go',
        quickEffect: [{ stat: 'happiness', amount: 8, label: '+8 Happiness' }, { stat: 'energy', amount: -4, label: '-4 Energy' }],
        hiddenEffect: 'The look on their face is worth the missed deadline.',
      },
      {
        id: 'work',
        text: 'Send a video message, keep working',
        quickEffect: [{ stat: 'happiness', amount: -4, label: '-4 Happiness' }, { stat: 'money', amount: 200, label: '+$200' }],
        hiddenEffect: 'You hit the deadline. You try not to think about the recital.',
      },
    ],
    category: 'social',
  },
  {
    // KARMA: good karma pays off — closes the karma loop
    situation: 'Someone you helped long ago tracks you down. They never forgot - and they insist on repaying you.',
    condition: (s) => karmaScore(s) >= 40,
    choices: [
      {
        id: 'accept',
        text: 'Accept graciously',
        quickEffect: [{ stat: 'money', amount: 1500, label: '+$1,500' }, { stat: 'happiness', amount: 6, label: '+6 Happiness' }],
        hiddenEffect: 'Kindness, it turns out, compounds.',
      },
      {
        id: 'payforward',
        text: '"Pay it forward instead"',
        quickEffect: [{ stat: 'reputation', amount: 5, label: '+5 Reputation' }, { stat: 'happiness', amount: 8, label: '+8 Happiness' }],
        hiddenEffect: 'Word of your grace spreads further than any favor.',
      },
    ],
    category: 'random',
  },
  {
    // KARMA: bad karma bites — closes the karma loop
    situation: 'A promising deal suddenly goes cold. Word is, your reputation preceded you.',
    condition: (s) => karmaScore(s) <= -40,
    choices: [
      {
        id: 'shrug',
        text: 'Shrug it off',
        quickEffect: [{ stat: 'happiness', amount: -4, label: '-4 Happiness' }],
        hiddenEffect: 'You tell yourself it\'s their loss.',
      },
      {
        id: 'amends',
        text: 'Try to make amends',
        quickEffect: [{ stat: 'money', amount: -300, label: '-$300' }, { stat: 'reputation', amount: 3, label: '+3 Reputation' }],
        hiddenEffect: 'A small gesture. Rebuilding trust is slow work.',
      },
    ],
    category: 'random',
  },
  {
    // Health warning when run down
    situation: 'You wake up aching and exhausted. Your body is trying to tell you something.',
    condition: (s) => (s.stats?.health ?? 100) < 45,
    choices: [
      {
        id: 'rest',
        text: 'Take the day to rest',
        quickEffect: [{ stat: 'health', amount: 8, label: '+8 Health' }, { stat: 'energy', amount: 10, label: '+10 Energy' }, { stat: 'money', amount: -100, label: '-$100' }],
        hiddenEffect: 'A day lost, but your body thanks you.',
      },
      {
        id: 'push',
        text: 'Push through it',
        quickEffect: [{ stat: 'money', amount: 150, label: '+$150' }, { stat: 'health', amount: -5, label: '-5 Health' }],
        hiddenEffect: 'You power through. The ache lingers.',
      },
    ],
    category: 'health',
  },
  {
    // Recognized in public — reputation payoff
    situation: 'A stranger does a double-take. "Wait - aren\'t you...?" You\'re becoming known around town.',
    condition: (s) => (s.stats?.reputation ?? 0) >= 60,
    choices: [
      {
        id: 'embrace',
        text: 'Chat and take a photo',
        quickEffect: [{ stat: 'happiness', amount: 6, label: '+6 Happiness' }, { stat: 'reputation', amount: 2, label: '+2 Reputation' }],
        hiddenEffect: 'A little fame feels good.',
      },
      {
        id: 'humble',
        text: 'Smile and stay low-key',
        quickEffect: [{ stat: 'happiness', amount: 3, label: '+3 Happiness' }],
        hiddenEffect: 'You keep your feet on the ground.',
      },
    ],
    category: 'social',
  },
  {
    // Broke player finds money — a small honesty test
    situation: 'You spot a $20 bill on the pavement. A woman nearby is searching her pockets, worried.',
    condition: (s) => totalMoney(s) < 200,
    choices: [
      {
        id: 'return',
        text: 'Ask if she dropped it',
        quickEffect: [{ stat: 'reputation', amount: 4, label: '+4 Reputation' }, { stat: 'happiness', amount: 5, label: '+5 Happiness' }],
        karma: { dimension: 'honesty', amount: 3, reason: 'Returned money that wasn\'t yours' },
        hiddenEffect: 'She\'s overjoyed. You did the right thing, even when you needed it.',
      },
      {
        id: 'keep',
        text: 'Pocket it quietly',
        quickEffect: [{ stat: 'money', amount: 20, label: '+$20' }, { stat: 'happiness', amount: -2, label: '-2 Happiness' }],
        karma: { dimension: 'honesty', amount: -3, reason: 'Kept money that wasn\'t yours' },
        hiddenEffect: 'Twenty bucks. You avoid her eyes.',
      },
    ],
    category: 'money',
  },
  {
    // Overtime temptation for the employed
    situation: 'Your boss offers double pay for a grueling weekend shift.',
    condition: (s) => !!s.currentJob,
    choices: [
      {
        id: 'grind',
        text: 'Take the shift',
        quickEffect: [{ stat: 'money', amount: 400, label: '+$400' }, { stat: 'energy', amount: -15, label: '-15 Energy' }, { stat: 'happiness', amount: -3, label: '-3 Happiness' }],
        hiddenEffect: 'The overtime hits your account. So does the exhaustion.',
      },
      {
        id: 'rest',
        text: 'Protect your weekend',
        quickEffect: [{ stat: 'energy', amount: 8, label: '+8 Energy' }, { stat: 'happiness', amount: 5, label: '+5 Happiness' }],
        hiddenEffect: 'You recharge. Money isn\'t everything.',
      },
    ],
    category: 'work',
  },
  {
    // Old friend reconnects
    situation: 'An old friend messages out of the blue: "Been too long. Coffee this week?"',
    choices: [
      {
        id: 'yes',
        text: 'Absolutely - make a plan',
        quickEffect: [{ stat: 'happiness', amount: 7, label: '+7 Happiness' }, { stat: 'energy', amount: -3, label: '-3 Energy' }],
        hiddenEffect: 'You pick up right where you left off.',
      },
      {
        id: 'later',
        text: '"Soon!" (you both know)',
        quickEffect: [{ stat: 'happiness', amount: -1, label: '-1 Happiness' }],
        hiddenEffect: 'Maybe next month. Maybe.',
      },
    ],
    category: 'social',
  },
  {
    // Investment "hot tip" for those with some cash
    situation: 'A slick acquaintance swears he has a "guaranteed" stock tip. He wants $1,000 to get you in.',
    condition: (s) => totalMoney(s) >= 5000,
    choices: [
      {
        id: 'bite',
        text: 'Hand over $1,000',
        quickEffect: [{ stat: 'money', amount: -1000, label: '-$1,000' }],
        hiddenEffect: 'Guaranteed, he said. You\'ll find out.',
        hiddenConsequences: [{ type: 'unlock_event', targetEventId: 'hot_tip_outcome', weeksUntilActive: 4, description: 'That "guaranteed" tip resolves.' }],
      },
      {
        id: 'pass',
        text: 'Pass - if it\'s guaranteed, why does he need you?',
        quickEffect: [{ stat: 'reputation', amount: 1, label: '+1 Reputation' }],
        hiddenEffect: 'Smart. Guaranteed returns rarely are.',
      },
    ],
    category: 'money',
  },
  {
    // Neighbor conflict
    situation: 'Your neighbor\'s music is rattling your windows at 2 AM. Again.',
    choices: [
      {
        id: 'talk',
        text: 'Knock and ask nicely',
        quickEffect: [{ stat: 'happiness', amount: 3, label: '+3 Happiness' }, { stat: 'reputation', amount: 1, label: '+1 Reputation' }],
        hiddenEffect: 'They apologize and turn it down. Problem solved, bridges intact.',
      },
      {
        id: 'noise',
        text: 'Bang on the wall and yell',
        quickEffect: [{ stat: 'happiness', amount: -2, label: '-2 Happiness' }],
        hiddenEffect: 'The music stops - but now it\'s a cold war.',
      },
    ],
    category: 'social',
  },
  {
    // Impulse purchase temptation
    situation: 'A limited-edition something you\'ve always wanted is on sale - today only, $300.',
    condition: (s) => (s.stats?.money ?? 0) >= 400,
    choices: [
      {
        id: 'buy',
        text: 'Treat yourself',
        quickEffect: [{ stat: 'money', amount: -300, label: '-$300' }, { stat: 'happiness', amount: 9, label: '+9 Happiness' }],
        hiddenEffect: 'Retail therapy. No regrets. Probably.',
      },
      {
        id: 'resist',
        text: 'Walk away',
        quickEffect: [{ stat: 'happiness', amount: -2, label: '-2 Happiness' }, { stat: 'reputation', amount: 1, label: '+1 Reputation' }],
        hiddenEffect: 'Discipline. Your future self approves.',
      },
    ],
    category: 'money',
  },
  {
    // Mentorship — give back
    situation: 'A nervous newcomer asks you for advice on getting started in life.',
    // Gate on weeks lived THIS LIFE, not the raw counter: `weeksLived` is seeded
    // from starting age ((age-18)*52), so a raw `>= 50` was already true on frame
    // one for every non-age-18 scenario (age-20 starts at 104), offering "a
    // newcomer asks YOU for advice" to a character who is themselves brand new.
    // Same §4.2 baseline class fixed for the pity-drought a few lines down.
    condition: (s) => weeksSinceLifeStart(s.weeksLived ?? 0, s.lifeStartWeek) >= 50,
    choices: [
      {
        id: 'mentor',
        text: 'Share what you\'ve learned',
        quickEffect: [{ stat: 'happiness', amount: 6, label: '+6 Happiness' }, { stat: 'reputation', amount: 3, label: '+3 Reputation' }, { stat: 'energy', amount: -3, label: '-3 Energy' }],
        hiddenEffect: 'Passing it on feels good. They\'ll remember you.',
      },
      {
        id: 'busy',
        text: '"Sorry, no time"',
        quickEffect: [{ stat: 'happiness', amount: -1, label: '-1 Happiness' }],
        hiddenEffect: 'You had your reasons.',
      },
    ],
    category: 'social',
  },
];

/**
 * Generate a life moment based on current state.
 *
 * Intentionally rare: these are interruptive popups, so they fire at ~1.5%
 * per week with a long pity window. Players asked for far fewer of these,
 * so the cadence is dialled right down from the old 10%/8-week pace.
 */
/**
 * Stable per-template key, hashed from the situation copy. Templates carry no
 * authored id, and array index would silently re-key every template on a
 * reorder — the copy IS the identity a player would recognise repeating.
 * Embedded in the generated moment id (`life_moment_<key>_<week>`), which is
 * what lets `recentMomentKeys` derive "seen lately" from the choice history
 * the resolver already writes, with no new stored state.
 */
export function lifeMomentTemplateKey(template: Pick<LifeMomentTemplate, 'situation'>): string {
  return fnv1a32(template.situation).toString(36);
}

/** Two game-years: at ~1.5%/week a player sees 2-3 moments a year from a
 *  20-template pool, so anything shorter barely suppresses. */
export const LIFE_MOMENT_REPEAT_COOLDOWN_WEEKS = 104;

/**
 * Template keys the player answered within the cooldown window, parsed from
 * `consequenceState.choiceHistory` — the record `resolveLifeMoment` already
 * writes. Legacy ids (`life_moment_<timestamp>_<rand>`) parse to keys no
 * template hashes to, so old saves simply start with an empty set.
 */
export function recentMomentKeys(
  state: Pick<GameState, 'consequenceState' | 'weeksLived'>,
): Set<string> {
  const out = new Set<string>();
  const history = state.consequenceState?.choiceHistory;
  if (!Array.isArray(history)) return out;
  const now = state.weeksLived || 0;
  for (const record of history) {
    if (!record || typeof record.eventId !== 'string') continue;
    if (!record.eventId.startsWith('life_moment_')) continue;
    const at = typeof record.weeksLived === 'number' ? record.weeksLived : undefined;
    if (at === undefined) continue;
    const delta = now - at;
    if (delta < 0 || delta >= LIFE_MOMENT_REPEAT_COOLDOWN_WEEKS) continue;
    const key = record.eventId.split('_')[2];
    if (key) out.add(key);
  }
  return out;
}

export function generateLifeMoment(state: GameState): LifeMoment | null {
  // Don't generate if already have one pending
  if (state.lifeMoments?.pendingMoment) {
    return null;
  }

  const lastMomentWeek = state.lifeMoments?.lastMomentWeek || 0;
  // Until the first moment fires, the drought is measured from the START OF
  // THIS LIFE, not from the raw counter against a zero baseline: `weeksLived`
  // is seeded from starting age ((age-18)*52), so `weeksLived - 0 >= 52` was
  // already true on the FIRST TICK of every scenario starting past 19 — the
  // pity system's "very long drought" fired an interruptive popup in the
  // opening minutes of exactly the lives meant to open quietly. The fourth
  // instance of the CLAUDE.md §4.2 baseline class.
  const weeksSinceLastMoment =
    lastMomentWeek > 0
      ? (state.weeksLived || 0) - lastMomentWeek
      : weeksSinceLifeStart(state.weeksLived || 0, state.lifeStartWeek);

  // Guaranteed moment only after a very long drought (pity system), otherwise
  // a small per-week chance. Keeps them special instead of constant.
  //
  // DETERMINISM: this was the last content path on `Math.random()` — every
  // other roll baked into a save goes through the seeded weekly RNG
  // (CLAUDE.md §4.3; the cliffhanger/luck-roll fixes). A random draw here ran
  // fresh on each React 19 double-invocation of the updater, so which render
  // committed decided whether a moment existed. Same week + same life now
  // always answers the same.
  const rollFor = makeWeeklyRoll(state.weeksLived || 0);
  const lifeSalt = `${state.lineageId || ''}:${state.generationNumber || 1}`;
  const shouldGenerate =
    weeksSinceLastMoment >= 52 || rollFor(`life-moment-fire:${lifeSalt}`) < 0.015;

  if (!shouldGenerate) {
    return null;
  }

  // Filter templates to those whose state gate (if any) is satisfied, so the
  // moment reflects the life the player is actually living.
  const availableTemplates = LIFE_MOMENT_TEMPLATES.filter(template => {
    if (template.category === 'work' && !state.currentJob) return false;
    if (template.condition && !template.condition(state)) return false;
    return true;
  });

  if (availableTemplates.length === 0) return null;

  // Prefer a moment the player has NOT lived within the cooldown window; if
  // they have somehow answered everything eligible recently, repeat rather
  // than starve (20 templates at 2-3/year makes that practically unreachable).
  const recent = recentMomentKeys(state);
  const fresh = availableTemplates.filter((t) => !recent.has(lifeMomentTemplateKey(t)));
  const pool = fresh.length > 0 ? fresh : availableTemplates;

  // Seeded pick, then drop the (non-serializable) condition fn.
  const pickIndex = Math.min(
    pool.length - 1,
    Math.floor(rollFor(`life-moment-pick:${lifeSalt}`) * pool.length),
  );
  const { condition: _condition, ...template } = pool[pickIndex];
  void _condition;

  return {
    ...template,
    // Deterministic id: template key + the week it fired. One moment per week
    // (the tick calls this once and stamps `lastMomentWeek`), so the pair is
    // unique — and a double-invoked updater now builds the SAME moment.
    id: `life_moment_${lifeMomentTemplateKey(template)}_${state.weeksLived || 0}`,
    createdAt: Date.now(),
  };
}

