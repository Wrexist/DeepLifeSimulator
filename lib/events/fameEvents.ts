/**
 * Fame Tier Events
 *
 * Special events gated on social media influence level and reputation.
 * Makes fame feel like a double-edged sword: exciting perks AND dangerous
 * consequences. Players with celebrity status get a fundamentally different
 * experience, encouraging fame-chasing playstyles.
 */
import type { EventTemplate } from './engine';
import type { GameState } from '@/contexts/game/types';

// Helper: fame tier checks
const isCelebrity = (s: GameState) =>
  s.socialMedia?.influenceLevel === 'celebrity';

const isInfluencerOrAbove = (s: GameState) =>
  s.socialMedia?.influenceLevel === 'influencer' ||
  s.socialMedia?.influenceLevel === 'celebrity';

const isPopularOrAbove = (s: GameState) =>
  s.socialMedia?.influenceLevel === 'popular' ||
  isInfluencerOrAbove(s);

const hasHighReputation = (s: GameState) =>
  (s.stats?.reputation ?? 0) >= 70;

const getFollowers = (s: GameState) =>
  s.socialMedia?.followers ?? 0;

// ─── Fame event templates ────────────────────────────────────────

const paparazziAmbush: EventTemplate = {
  id: 'fame_paparazzi_ambush',
  category: 'general',
  weight: 0.35,
  condition: (s) => isInfluencerOrAbove(s),
  generate: (state) => {
    const followers = getFollowers(state);
    return {
      id: 'fame_paparazzi_ambush',
      description: `Paparazzi ambush you outside a restaurant! With ${followers.toLocaleString()} followers, you're hot property. Cameras are flashing everywhere.`,
      choices: [
        {
          id: 'smile',
          text: 'Smile and wave for the cameras',
          effects: { stats: { reputation: 5, happiness: -3 } },
        },
        {
          id: 'hide',
          text: 'Cover your face and run',
          effects: { stats: { reputation: -3, happiness: -8 } },
        },
        {
          id: 'confront',
          text: 'Confront them angrily',
          effects: { stats: { reputation: -10, happiness: 3 } },
        },
      ],
    };
  },
};

const talkShowInvitation: EventTemplate = {
  id: 'fame_talk_show',
  category: 'general',
  weight: 0.25,
  condition: (s) => isCelebrity(s) && hasHighReputation(s),
  generate: () => ({
    id: 'fame_talk_show',
    description:
      'A major talk show host invites you for a live interview! This could be your biggest media appearance yet.',
    choices: [
      {
        id: 'accept',
        text: 'Accept — time to shine!',
        effects: { money: 5000, stats: { reputation: 15, happiness: 12 } },
      },
      {
        id: 'negotiate',
        text: 'Accept only for a higher fee',
        effects: { money: 15000, stats: { reputation: 8, happiness: 8 } },
      },
      {
        id: 'decline',
        text: 'Politely decline',
        effects: { stats: { reputation: -5 } },
      },
    ],
  }),
};

const stalkerEncounter: EventTemplate = {
  id: 'fame_stalker',
  category: 'general',
  weight: 0.15,
  condition: (s) => isCelebrity(s) && (s.weeksLived ?? 0) > 30,
  generate: () => ({
    id: 'fame_stalker',
    description:
      "You noticed the same person following you for the third time this week. They claim to be your 'biggest fan,' but this is getting creepy.",
    choices: [
      {
        id: 'security',
        text: 'Hire personal security',
        effects: { money: -2000, stats: { happiness: -5 } },
      },
      {
        id: 'police',
        text: 'Report them to the police',
        effects: { stats: { happiness: -8 } },
      },
      {
        id: 'confront',
        text: 'Confront them directly',
        effects: { stats: { happiness: -3, health: -2 } },
      },
    ],
  }),
};

const tabloidScandal: EventTemplate = {
  id: 'fame_tabloid_scandal',
  category: 'general',
  weight: 0.2,
  condition: (s) => isInfluencerOrAbove(s),
  generate: () => ({
    id: 'fame_tabloid_scandal',
    description:
      "A tabloid published a completely fabricated story about your personal life. It's going viral and your DMs are blowing up.",
    choices: [
      {
        id: 'sue',
        text: 'Sue the tabloid',
        effects: { money: -3000, stats: { reputation: 5, happiness: -10 } },
      },
      {
        id: 'deny',
        text: 'Post a denial on social media',
        effects: { stats: { reputation: -5, happiness: -5 } },
      },
      {
        id: 'ignore',
        text: 'Any publicity is good publicity',
        effects: { stats: { reputation: -2, happiness: -3 } },
      },
    ],
  }),
};

const fanMob: EventTemplate = {
  id: 'fame_fan_mob',
  category: 'general',
  weight: 0.2,
  condition: (s) => isCelebrity(s),
  generate: () => ({
    id: 'fame_fan_mob',
    description:
      "A crowd of fans recognized you at the mall and swarmed you. They're screaming, pulling at your clothes, and begging for photos.",
    choices: [
      {
        id: 'photos',
        text: 'Stop and take photos with everyone',
        effects: { stats: { reputation: 10, happiness: 5, energy: -20 } },
      },
      {
        id: 'escape',
        text: 'Signal security and escape',
        effects: { stats: { reputation: -3, energy: -10 } },
      },
    ],
  }),
};

const endorsementDeal: EventTemplate = {
  id: 'fame_endorsement_deal',
  category: 'economy',
  weight: 0.25,
  condition: (s) => isInfluencerOrAbove(s) && hasHighReputation(s),
  generate: (state) => {
    const basePay = isCelebrity(state) ? 25000 : 8000;
    return {
      id: 'fame_endorsement_deal',
      description: `A major brand wants you as their spokesperson! They're offering $${basePay.toLocaleString()} for a campaign.`,
      choices: [
        {
          id: 'accept',
          text: 'Sign the deal',
          effects: { money: basePay, stats: { reputation: 5, happiness: 8 } },
        },
        {
          id: 'negotiate',
          text: 'Negotiate for more',
          effects: {
            money: Math.round(basePay * 1.5),
            stats: { reputation: 3, happiness: 10 },
          },
        },
        {
          id: 'decline',
          text: "It doesn't align with my brand",
          effects: { stats: { reputation: 2, happiness: 3 } },
        },
      ],
    };
  },
};

const charityGala: EventTemplate = {
  id: 'fame_charity_gala',
  category: 'general',
  weight: 0.2,
  condition: (s) => isPopularOrAbove(s) && (s.stats?.money ?? 0) > 5000,
  generate: () => ({
    id: 'fame_charity_gala',
    description:
      "You've been invited to an exclusive charity gala. The who's who of society will be there.",
    choices: [
      {
        id: 'donate_big',
        text: 'Attend and make a large donation ($5,000)',
        effects: {
          money: -5000,
          stats: { reputation: 15, happiness: 10 },
          karma: {
            dimension: 'generosity',
            amount: 20,
            reason: 'Large charity donation at gala',
          },
        },
      },
      {
        id: 'attend',
        text: 'Attend but keep wallet closed',
        effects: { stats: { reputation: 5, happiness: 5 } },
      },
      {
        id: 'skip',
        text: "Not my scene",
        effects: { stats: { reputation: -3 } },
      },
    ],
  }),
};

const fakeNewsStory: EventTemplate = {
  id: 'fame_fake_news',
  category: 'general',
  weight: 0.15,
  condition: (s) => isCelebrity(s),
  generate: () => ({
    id: 'fame_fake_news',
    description:
      "A deepfake video of you saying terrible things is going viral. It's completely fake but incredibly convincing.",
    choices: [
      {
        id: 'legal',
        text: 'Take immediate legal action',
        effects: { money: -5000, stats: { reputation: -5, happiness: -15 } },
      },
      {
        id: 'video',
        text: 'Post a response video proving it fake',
        effects: { stats: { reputation: -8, happiness: -10 } },
      },
      {
        id: 'wait',
        text: 'Wait for it to blow over',
        effects: { stats: { reputation: -15, happiness: -8 } },
      },
    ],
  }),
};

const autographRequest: EventTemplate = {
  id: 'fame_autograph',
  category: 'general',
  weight: 0.3,
  condition: (s) => isPopularOrAbove(s),
  generate: () => ({
    id: 'fame_autograph',
    description:
      "A kid runs up to you on the street with wide eyes and asks for your autograph. 'You're my hero!' they say.",
    choices: [
      {
        id: 'sign',
        text: 'Sign their notebook and chat',
        effects: { stats: { happiness: 10, reputation: 3 } },
      },
      {
        id: 'selfie',
        text: 'Take a selfie together too',
        effects: { stats: { happiness: 12, reputation: 5 } },
      },
      {
        id: 'rush',
        text: "Sorry kid, I'm in a hurry",
        effects: { stats: { happiness: -5, reputation: -5 } },
      },
    ],
  }),
};

const privacyInvasion: EventTemplate = {
  id: 'fame_privacy_invasion',
  category: 'general',
  weight: 0.15,
  condition: (s) => isCelebrity(s),
  generate: () => ({
    id: 'fame_privacy_invasion',
    description:
      'Someone leaked your home address online. Fans and reporters are showing up at your door.',
    choices: [
      {
        id: 'move',
        text: 'Move to a new place with better security',
        effects: { money: -10000, stats: { happiness: -15 } },
      },
      {
        id: 'security',
        text: 'Install a security system and gates',
        effects: { money: -5000, stats: { happiness: -10 } },
      },
      {
        id: 'cope',
        text: 'Deal with it — this is the price of fame',
        effects: { stats: { happiness: -8 } },
      },
    ],
  }),
};

const brandCrisis: EventTemplate = {
  id: 'fame_brand_crisis',
  category: 'general',
  weight: 0.12,
  condition: (s) =>
    isInfluencerOrAbove(s) &&
    (s.socialMedia?.activeBrandDeals ?? []).length > 0,
  generate: () => ({
    id: 'fame_brand_crisis',
    description:
      "A brand you're endorsing is caught in a major scandal. Your fans are demanding you cut ties.",
    choices: [
      {
        id: 'cut',
        text: 'Publicly cut ties with the brand',
        effects: { money: -3000, stats: { reputation: 10, happiness: -5 } },
      },
      {
        id: 'silent',
        text: 'Stay silent and hope it passes',
        effects: { stats: { reputation: -15, happiness: -3 } },
      },
      {
        id: 'defend',
        text: 'Defend the brand',
        effects: { stats: { reputation: -20, happiness: -8 } },
      },
    ],
  }),
};

const awardNomination: EventTemplate = {
  id: 'fame_award_nomination',
  category: 'general',
  weight: 0.15,
  condition: (s) => isCelebrity(s) && hasHighReputation(s),
  generate: () => ({
    id: 'fame_award_nomination',
    description:
      "You've been nominated for an Influencer of the Year award! The ceremony is in two weeks.",
    choices: [
      {
        id: 'prepare',
        text: 'Prepare an amazing speech',
        effects: { money: -1000, stats: { reputation: 8, happiness: 15 } },
      },
      {
        id: 'humble',
        text: "It's an honor just to be nominated",
        effects: { stats: { reputation: 5, happiness: 10 } },
      },
    ],
  }),
};

const impostorAccount: EventTemplate = {
  id: 'fame_impostor',
  category: 'general',
  weight: 0.15,
  condition: (s) => isPopularOrAbove(s),
  generate: (state) => {
    const followers = getFollowers(state);
    return {
      id: 'fame_impostor',
      description: `Someone created a fake account impersonating you and scamming your ${followers.toLocaleString()} followers.`,
      choices: [
        {
          id: 'report',
          text: 'Report and warn your followers',
          effects: { stats: { reputation: 3, happiness: -5 } },
        },
        {
          id: 'ignore',
          text: "It'll get taken down eventually",
          effects: { stats: { reputation: -5, happiness: -3 } },
        },
      ],
    };
  },
};

const exclusiveParty: EventTemplate = {
  id: 'fame_exclusive_party',
  category: 'general',
  weight: 0.2,
  condition: (s) => isCelebrity(s),
  generate: () => ({
    id: 'fame_exclusive_party',
    description:
      "You're invited to an ultra-exclusive celebrity party. Private jets, designer everything, and faces you've only seen on screen.",
    choices: [
      {
        id: 'attend',
        text: 'Attend and network',
        effects: {
          money: -500,
          stats: { reputation: 10, happiness: 15, energy: -15 },
        },
      },
      {
        id: 'skip',
        text: 'Stay home — early morning tomorrow',
        effects: { stats: { happiness: -3, energy: 10 } },
      },
    ],
  }),
};

const hateComment: EventTemplate = {
  id: 'fame_hate_comments',
  category: 'general',
  weight: 0.25,
  condition: (s) => isPopularOrAbove(s),
  generate: () => ({
    id: 'fame_hate_comments',
    description:
      "A wave of hate comments floods your latest post. Some are genuinely hurtful. The internet can be brutal.",
    choices: [
      {
        id: 'respond',
        text: 'Clap back at the haters',
        effects: { stats: { reputation: -5, happiness: -3 } },
      },
      {
        id: 'ignore',
        text: "Haters gonna hate",
        effects: { stats: { happiness: -5 } },
      },
      {
        id: 'break',
        text: 'Take a social media break',
        effects: { stats: { happiness: 3, energy: 10 } },
      },
    ],
  }),
};

export const fameEventTemplates: EventTemplate[] = [
  paparazziAmbush,
  talkShowInvitation,
  stalkerEncounter,
  tabloidScandal,
  fanMob,
  endorsementDeal,
  charityGala,
  fakeNewsStory,
  autographRequest,
  privacyInvasion,
  brandCrisis,
  awardNomination,
  impostorAccount,
  exclusiveParty,
  hateComment,
];
