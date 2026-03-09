/**
 * Life Milestone Events — Relationship, Family, Age, and Wellness events
 *
 * Fills category gaps in the event pool:
 * - Romantic relationship milestones (anniversary, arguments, in-laws)
 * - Child & family events (first words, school trouble, graduation)
 * - Age-gated life milestones (midlife crisis, retirement thoughts)
 * - Mental health & wellness (burnout, loneliness, panic attacks)
 * - Legal & civic (jury duty, lawsuit)
 * - Workplace interactions (gossip, WFH, raise negotiation)
 */
import type { GameState } from '@/contexts/GameContext';
import type { EventTemplate } from './engine';
import { ADULTHOOD_AGE } from '@/lib/config/gameConstants';

// ---------------------------------------------------------------------------
// Romantic relationship events
// ---------------------------------------------------------------------------

const anniversary: EventTemplate = {
  id: 'anniversary',
  category: 'relationship',
  weight: 0.3,
  condition: state => state.relationships?.some(r => r.type === 'spouse') === true,
  generate: state => {
    const spouse = state.relationships?.find(r => r.type === 'spouse');
    if (!spouse) return { id: 'anniversary', description: 'You reflect on your love life.', choices: [{ id: 'skip', text: 'Continue', effects: {} }] };
    return {
      id: 'anniversary',
      description: `It's your wedding anniversary with ${spouse.name}!`,
      relationId: spouse.id,
      choices: [
        { id: 'romantic_dinner', text: 'Plan a romantic dinner ($200)', effects: { money: -200, relationship: 15, stats: { happiness: 15 } } },
        { id: 'simple_gift', text: 'Give a thoughtful gift ($50)', effects: { money: -50, relationship: 8, stats: { happiness: 8 } } },
        { id: 'forget', text: 'You forgot...', effects: { relationship: -20, stats: { happiness: -10 }, karma: { dimension: 'loyalty', amount: -3, reason: 'Forgot anniversary' } } },
      ],
    };
  },
};

const coupleArgument: EventTemplate = {
  id: 'couple_argument',
  category: 'relationship',
  weight: 0.35,
  condition: state => state.relationships?.some(r => r.type === 'spouse' || r.type === 'partner') === true,
  generate: state => {
    const partner = state.relationships?.find(r => r.type === 'spouse' || r.type === 'partner');
    if (!partner) return { id: 'couple_argument', description: 'A disagreement arises.', choices: [{ id: 'skip', text: 'Continue', effects: {} }] };
    return {
      id: 'couple_argument',
      description: `You and ${partner.name} have a heated argument about finances.`,
      relationId: partner.id,
      choices: [
        { id: 'apologize', text: 'Apologize and compromise', effects: { relationship: 5, stats: { happiness: -3 }, karma: { dimension: 'loyalty', amount: 2, reason: 'Compromised in relationship' } } },
        { id: 'stand_ground', text: 'Stand your ground', effects: { relationship: -10, stats: { happiness: -8 } } },
        { id: 'therapy', text: 'Suggest couples therapy ($100)', effects: { money: -100, relationship: 10, stats: { happiness: 5 } } },
      ],
    };
  },
};

const partnerJobLoss: EventTemplate = {
  id: 'partner_job_loss',
  category: 'relationship',
  weight: 0.15,
  condition: state => state.relationships?.some(r => r.type === 'spouse') === true,
  generate: state => {
    const spouse = state.relationships?.find(r => r.type === 'spouse');
    if (!spouse) return { id: 'partner_job_loss', description: 'Someone close to you lost their job.', choices: [{ id: 'skip', text: 'Continue', effects: {} }] };
    return {
      id: 'partner_job_loss',
      description: `${spouse.name} just lost their job and is feeling down.`,
      relationId: spouse.id,
      choices: [
        { id: 'support', text: 'Be supportive and help job search', effects: { relationship: 12, stats: { happiness: -5, energy: -10 }, karma: { dimension: 'loyalty', amount: 4, reason: 'Supported partner through job loss' } } },
        { id: 'pressure', text: 'Pressure them to find work fast', effects: { relationship: -15, stats: { happiness: -5 } } },
      ],
    };
  },
};

const meetInLaws: EventTemplate = {
  id: 'meet_in_laws',
  category: 'relationship',
  weight: 0.2,
  condition: state => state.relationships?.some(r => r.type === 'partner' && r.relationshipScore > 60) === true,
  generate: state => {
    const partner = state.relationships?.find(r => r.type === 'partner');
    if (!partner) return { id: 'meet_in_laws', description: 'Family obligations arise.', choices: [{ id: 'skip', text: 'Continue', effects: {} }] };
    return {
      id: 'meet_in_laws',
      description: `${partner.name} wants you to meet their parents for dinner.`,
      relationId: partner.id,
      choices: [
        { id: 'go', text: 'Go and make a great impression', effects: { relationship: 10, stats: { happiness: 5, energy: -10 } } },
        { id: 'nervous', text: 'Go but feel anxious', effects: { relationship: 3, stats: { happiness: -5 } } },
        { id: 'decline', text: "Say you're not ready", effects: { relationship: -12, stats: { happiness: -5 } } },
      ],
    };
  },
};

const romanticGetaway: EventTemplate = {
  id: 'romantic_getaway',
  category: 'relationship',
  weight: 0.15,
  condition: state => (state.stats?.money || 0) > 1000 && state.relationships?.some(r => r.type === 'spouse' || r.type === 'partner') === true,
  generate: state => {
    const partner = state.relationships?.find(r => r.type === 'spouse' || r.type === 'partner');
    if (!partner) return { id: 'romantic_getaway', description: 'Travel plans arise.', choices: [{ id: 'skip', text: 'Continue', effects: {} }] };
    return {
      id: 'romantic_getaway',
      description: `${partner.name} suggests a weekend getaway together.`,
      relationId: partner.id,
      choices: [
        { id: 'luxury', text: 'Book a luxury resort ($500)', effects: { money: -500, relationship: 20, stats: { happiness: 20, energy: -5 } } },
        { id: 'budget', text: 'Plan a budget trip ($150)', effects: { money: -150, relationship: 10, stats: { happiness: 10 } } },
        { id: 'decline', text: 'Too busy right now', effects: { relationship: -8, stats: { happiness: -5 } } },
      ],
    };
  },
};

// ---------------------------------------------------------------------------
// Child & family events
// ---------------------------------------------------------------------------

const childFirstWords: EventTemplate = {
  id: 'child_first_words',
  category: 'relationship',
  weight: 0.2,
  condition: state => state.family?.children?.some(c => c.age >= 1 && c.age <= 3) === true,
  generate: state => {
    const toddler = state.family?.children?.find(c => c.age >= 1 && c.age <= 3);
    if (!toddler) return { id: 'child_first_words', description: 'A child milestone happens.', choices: [{ id: 'skip', text: 'Continue', effects: {} }] };
    return {
      id: 'child_first_words',
      description: `${toddler.name} says their first word!`,
      choices: [
        { id: 'celebrate', text: 'Record and celebrate!', effects: { stats: { happiness: 20 } } },
        { id: 'share', text: 'Share with family ($30 party)', effects: { money: -30, stats: { happiness: 25 } } },
      ],
    };
  },
};

const childSchoolTrouble: EventTemplate = {
  id: 'child_school_trouble',
  category: 'relationship',
  weight: 0.25,
  condition: state => state.family?.children?.some(c => c.age >= 6 && c.age <= 17) === true,
  generate: state => {
    const child = state.family?.children?.find(c => c.age >= 6 && c.age <= 17);
    if (!child) return { id: 'child_school_trouble', description: 'A school issue arises.', choices: [{ id: 'skip', text: 'Continue', effects: {} }] };
    return {
      id: 'child_school_trouble',
      description: `${child.name}'s teacher calls — they've been in trouble at school.`,
      choices: [
        { id: 'talk', text: 'Have a calm conversation', effects: { stats: { happiness: -5, energy: -5 }, karma: { dimension: 'loyalty', amount: 2, reason: 'Patient parenting' } } },
        { id: 'strict', text: 'Ground them for a month', effects: { stats: { happiness: -3 } } },
        { id: 'ignore', text: 'Brush it off', effects: { stats: { happiness: -2 }, karma: { dimension: 'loyalty', amount: -2, reason: 'Neglected parenting' } } },
      ],
    };
  },
};

const childGraduation: EventTemplate = {
  id: 'child_graduation',
  category: 'relationship',
  weight: 0.15,
  condition: state => state.family?.children?.some(c => c.age >= 17 && c.age <= 19) === true,
  generate: state => {
    const child = state.family?.children?.find(c => c.age >= 17 && c.age <= 19);
    if (!child) return { id: 'child_graduation', description: 'A graduation ceremony happens.', choices: [{ id: 'skip', text: 'Continue', effects: {} }] };
    return {
      id: 'child_graduation',
      description: `${child.name} is graduating high school! They ask for a graduation party.`,
      choices: [
        { id: 'big_party', text: 'Throw a big party ($300)', effects: { money: -300, stats: { happiness: 25 } } },
        { id: 'small', text: 'Keep it simple', effects: { stats: { happiness: 15 } } },
        { id: 'gift', text: 'Give them $500 for college', effects: { money: -500, stats: { happiness: 20 } } },
      ],
    };
  },
};

const childAsksForMoney: EventTemplate = {
  id: 'child_asks_money',
  category: 'economy',
  weight: 0.3,
  condition: state => state.family?.children?.some(c => c.age >= 13) === true,
  generate: state => {
    const child = state.family?.children?.find(c => c.age >= 13);
    if (!child) return { id: 'child_asks_money', description: 'A family request comes in.', choices: [{ id: 'skip', text: 'Continue', effects: {} }] };
    return {
      id: 'child_asks_money',
      description: `${child.name} asks for $200 to go on a trip with friends.`,
      choices: [
        { id: 'give', text: 'Give them the money', effects: { money: -200, stats: { happiness: 5 }, karma: { dimension: 'generosity', amount: 2, reason: 'Supported child' } } },
        { id: 'half', text: 'Give half, they earn the rest', effects: { money: -100, stats: { happiness: 3 } } },
        { id: 'refuse', text: 'Tell them to earn it', effects: { stats: { happiness: -3 } } },
      ],
    };
  },
};

const pregnancyScare: EventTemplate = {
  id: 'pregnancy_scare',
  category: 'relationship',
  weight: 0.1,
  condition: state => {
    const hasPartner = state.relationships?.some(r => r.type === 'spouse' || r.type === 'partner') === true;
    const age = state.date?.age || ADULTHOOD_AGE;
    return hasPartner && age < 45;
  },
  generate: state => {
    const partner = state.relationships?.find(r => r.type === 'spouse' || r.type === 'partner');
    const name = partner?.name || 'Your partner';
    return {
      id: 'pregnancy_scare',
      description: `${name} tells you they might be pregnant. It turns out to be a false alarm.`,
      choices: [
        { id: 'relieved', text: 'Feel relieved', effects: { stats: { happiness: 5 } } },
        { id: 'discuss', text: 'Discuss starting a family', effects: { stats: { happiness: 10 } } },
      ],
    };
  },
};

// ---------------------------------------------------------------------------
// Age-gated milestones
// ---------------------------------------------------------------------------

const midlifeCrisis: EventTemplate = {
  id: 'midlife_crisis',
  category: 'general',
  weight: 0.15,
  condition: state => {
    const age = state.date?.age || ADULTHOOD_AGE;
    return age >= 40 && age <= 50;
  },
  generate: () => ({
    id: 'midlife_crisis',
    description: "You look in the mirror and wonder: is this really all there is? A wave of restlessness hits.",
    choices: [
      { id: 'sports_car', text: 'Buy a sports car ($5,000)', effects: { money: -5000, stats: { happiness: 15 } } },
      { id: 'hobby', text: 'Pick up a new hobby', effects: { stats: { happiness: 10, energy: -5 } } },
      { id: 'accept', text: 'Embrace your wisdom', effects: { stats: { happiness: 5 }, karma: { dimension: 'ambition', amount: 2, reason: 'Embraced maturity' } } },
    ],
  }),
};

const retirementThoughts: EventTemplate = {
  id: 'retirement_thoughts',
  category: 'general',
  weight: 0.2,
  condition: state => {
    const age = state.date?.age || ADULTHOOD_AGE;
    return age >= 55 && !!state.currentJob;
  },
  generate: () => ({
    id: 'retirement_thoughts',
    description: "Colleagues your age are starting to retire. You wonder if it's time.",
    choices: [
      { id: 'plan', text: 'Start planning retirement', effects: { stats: { happiness: 10 } } },
      { id: 'keep_working', text: 'Keep working — you still have it', effects: { stats: { energy: -5, happiness: 3 } } },
    ],
  }),
};

const quarterLifeCrisis: EventTemplate = {
  id: 'quarter_life_crisis',
  category: 'general',
  weight: 0.2,
  condition: state => {
    const age = state.date?.age || ADULTHOOD_AGE;
    return age >= 24 && age <= 28 && !state.currentJob;
  },
  generate: () => ({
    id: 'quarter_life_crisis',
    description: "Everyone on social media seems to have their life together. You wonder what you're doing wrong.",
    choices: [
      { id: 'motivated', text: 'Use it as motivation', effects: { stats: { happiness: -5, energy: 10 } } },
      { id: 'accept', text: "Life isn't a race", effects: { stats: { happiness: 5 } } },
      { id: 'social_detox', text: 'Delete social media for a week', effects: { stats: { happiness: 8 } } },
    ],
  }),
};

const emptyNest: EventTemplate = {
  id: 'empty_nest',
  category: 'relationship',
  weight: 0.15,
  condition: state => {
    const age = state.date?.age || ADULTHOOD_AGE;
    const hasAdultChildren = state.family?.children?.some(c => c.age >= ADULTHOOD_AGE) === true;
    return age >= 45 && hasAdultChildren;
  },
  generate: () => ({
    id: 'empty_nest',
    description: 'Your last child has moved out. The house feels eerily quiet.',
    choices: [
      { id: 'redecorate', text: 'Redecorate their room ($200)', effects: { money: -200, stats: { happiness: 8 } } },
      { id: 'call', text: 'Call them to check in', effects: { stats: { happiness: 10 } } },
      { id: 'grieve', text: 'Miss the old days', effects: { stats: { happiness: -10 } } },
    ],
  }),
};

// ---------------------------------------------------------------------------
// Mental health & wellness events
// ---------------------------------------------------------------------------

const burnout: EventTemplate = {
  id: 'burnout',
  category: 'health',
  weight: 0.25,
  condition: state => (state.stats?.energy || 100) < 30 && !!state.currentJob,
  generate: () => ({
    id: 'burnout',
    description: "You've been pushing too hard. Exhaustion, cynicism, and a sense of dread about work are setting in.",
    choices: [
      { id: 'vacation', text: 'Take a week off', effects: { stats: { energy: 30, happiness: 15, health: 5 } } },
      { id: 'reduce', text: 'Set boundaries at work', effects: { stats: { energy: 15, happiness: 5 } } },
      { id: 'push', text: 'Power through', effects: { stats: { energy: -10, health: -10, happiness: -10 } } },
    ],
  }),
};

const loneliness: EventTemplate = {
  id: 'loneliness',
  category: 'health',
  weight: 0.2,
  condition: state => (state.relationships?.length || 0) === 0,
  generate: () => ({
    id: 'loneliness',
    description: "You realize you haven't had a meaningful conversation in weeks. The isolation is wearing on you.",
    choices: [
      { id: 'join_club', text: 'Join a local club ($30)', effects: { money: -30, stats: { happiness: 10 } } },
      { id: 'volunteer', text: 'Volunteer somewhere', effects: { stats: { happiness: 8, energy: -5 }, karma: { dimension: 'generosity', amount: 3, reason: 'Volunteered to connect' } } },
      { id: 'endure', text: 'Stay in your comfort zone', effects: { stats: { happiness: -8 } } },
    ],
  }),
};

const gratitudeMoment: EventTemplate = {
  id: 'gratitude_moment',
  category: 'general',
  weight: 0.2,
  condition: state => (state.stats?.happiness || 0) > 70,
  generate: () => ({
    id: 'gratitude_moment',
    description: 'You pause during a beautiful sunset and feel genuinely grateful for your life.',
    choices: [
      { id: 'journal', text: 'Write about it in your journal', effects: { stats: { happiness: 10 } } },
      { id: 'share', text: 'Call someone you love', effects: { stats: { happiness: 12 } } },
    ],
  }),
};

const insomnia: EventTemplate = {
  id: 'insomnia',
  category: 'health',
  weight: 0.25,
  condition: state => (state.stats?.happiness || 100) < 40 || (state.stats?.energy || 100) < 25,
  generate: () => ({
    id: 'insomnia',
    description: "You've been lying awake for hours. Sleep just won't come.",
    choices: [
      { id: 'melatonin', text: 'Try sleep supplements ($15)', effects: { money: -15, stats: { energy: 10, health: 3 } } },
      { id: 'exercise', text: 'Start exercising more', effects: { stats: { energy: 5, health: 8, happiness: 3 } } },
      { id: 'screen', text: 'Scroll your phone until dawn', effects: { stats: { energy: -10, happiness: -3 } } },
    ],
  }),
};

const panicAttack: EventTemplate = {
  id: 'panic_attack',
  category: 'health',
  weight: 0.1,
  condition: state => (state.stats?.happiness || 100) < 25 && (state.stats?.energy || 100) < 30,
  generate: () => ({
    id: 'panic_attack',
    description: "Your heart races, you can't breathe. A panic attack hits without warning.",
    choices: [
      { id: 'therapy', text: 'Start seeing a therapist ($100/week)', effects: { money: -100, stats: { happiness: 15, health: 5 } } },
      { id: 'breathe', text: 'Practice breathing exercises', effects: { stats: { happiness: 5, energy: 5 } } },
      { id: 'ignore', text: 'Wait for it to pass', effects: { stats: { happiness: -5, health: -5 } } },
    ],
  }),
};

const exerciseHigh: EventTemplate = {
  id: 'exercise_high',
  category: 'health',
  weight: 0.2,
  condition: state => (state.stats?.health || 0) > 70,
  generate: () => ({
    id: 'exercise_high',
    description: 'You finish a great workout and feel an incredible rush of endorphins.',
    choices: [
      { id: 'routine', text: 'Make this a regular thing', effects: { stats: { happiness: 10, energy: 5 } } },
      { id: 'challenge', text: 'Sign up for a marathon ($50)', effects: { money: -50, stats: { happiness: 12, health: 5 } } },
    ],
  }),
};

// ---------------------------------------------------------------------------
// Legal & civic events
// ---------------------------------------------------------------------------

const juryDuty: EventTemplate = {
  id: 'jury_duty',
  category: 'general',
  weight: 0.15,
  condition: state => (state.date?.age || 18) >= 21,
  generate: () => ({
    id: 'jury_duty',
    description: 'You receive a jury duty summons in the mail.',
    choices: [
      { id: 'serve', text: 'Serve your civic duty', effects: { money: -50, stats: { energy: -10 }, karma: { dimension: 'honesty', amount: 2, reason: 'Fulfilled jury duty' } } },
      { id: 'defer', text: 'Request a deferral', effects: {} },
    ],
  }),
};

const lawsuitThreat: EventTemplate = {
  id: 'lawsuit_threat',
  category: 'economy',
  weight: 0.1,
  condition: state => (state.stats?.money || 0) + (state.bankSavings || 0) > 50000,
  generate: () => ({
    id: 'lawsuit_threat',
    description: 'You receive a letter threatening a frivolous lawsuit.',
    choices: [
      { id: 'lawyer', text: 'Hire a lawyer to handle it ($2,000)', effects: { money: -2000, stats: { happiness: -5 } } },
      { id: 'settle', text: 'Settle out of court ($5,000)', effects: { money: -5000, stats: { happiness: -3 } } },
      { id: 'ignore', text: 'Ignore it and hope it goes away', effects: { stats: { happiness: -10 } } },
    ],
  }),
};

// ---------------------------------------------------------------------------
// Workplace events
// ---------------------------------------------------------------------------

const officeGossip: EventTemplate = {
  id: 'office_gossip',
  category: 'general',
  weight: 0.3,
  condition: state => !!state.currentJob,
  generate: () => ({
    id: 'office_gossip',
    description: 'A coworker tells you some juicy office gossip about your boss.',
    choices: [
      { id: 'share', text: 'Share it with others', effects: { stats: { reputation: -5, happiness: 3 }, karma: { dimension: 'honesty', amount: -2, reason: 'Spread gossip' } } },
      { id: 'keep_quiet', text: 'Keep it to yourself', effects: { stats: { reputation: 3 }, karma: { dimension: 'honesty', amount: 2, reason: 'Kept confidence' } } },
    ],
  }),
};

const workFromHome: EventTemplate = {
  id: 'work_from_home',
  category: 'general',
  weight: 0.2,
  condition: state => !!state.currentJob,
  generate: () => ({
    id: 'work_from_home',
    description: 'Your company offers a voluntary work-from-home day this week.',
    choices: [
      { id: 'wfh', text: 'Work from home', effects: { stats: { happiness: 8, energy: 5 } } },
      { id: 'office', text: 'Go to the office anyway', effects: { stats: { reputation: 3 } } },
    ],
  }),
};

const raiseNegotiation: EventTemplate = {
  id: 'raise_negotiation',
  category: 'economy',
  weight: 0.15,
  condition: state => !!state.currentJob && (state.weeksLived || 0) > 52,
  generate: () => ({
    id: 'raise_negotiation',
    description: "You feel underpaid. Annual reviews are coming up.",
    choices: [
      { id: 'ask', text: 'Ask for a raise', effects: { money: 200, stats: { happiness: 10, reputation: 5 } } },
      { id: 'wait', text: 'Wait for them to offer', effects: { stats: { happiness: -3 } } },
      { id: 'threaten', text: 'Threaten to quit', effects: { money: 300, stats: { reputation: -10 } } },
    ],
  }),
};

// ---------------------------------------------------------------------------
// Export
// ---------------------------------------------------------------------------

export const lifeMilestoneEventTemplates: EventTemplate[] = [
  // Romantic
  anniversary,
  coupleArgument,
  partnerJobLoss,
  meetInLaws,
  romanticGetaway,
  // Child & family
  childFirstWords,
  childSchoolTrouble,
  childGraduation,
  childAsksForMoney,
  pregnancyScare,
  // Age milestones
  midlifeCrisis,
  retirementThoughts,
  quarterLifeCrisis,
  emptyNest,
  // Mental health & wellness
  burnout,
  loneliness,
  gratitudeMoment,
  insomnia,
  panicAttack,
  exerciseHigh,
  // Legal
  juryDuty,
  lawsuitThreat,
  // Workplace
  officeGossip,
  workFromHome,
  raiseNegotiation,
];
