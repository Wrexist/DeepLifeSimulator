/**
 * Near-Miss Events
 *
 * Atmospheric tension events that describe dangerous situations the player
 * narrowly avoided. Creates constant low-level anxiety that makes every
 * week advance feel risky — a key BitLife-style addiction mechanic.
 *
 * These events have no major stat consequences; they exist purely for
 * psychological tension and narrative flavor.
 */
import type { EventTemplate } from './engine';
import type { GameState } from '@/contexts/game/types';

// Helper: does the player own any vehicles?
const ownsVehicle = (s: GameState) =>
  Array.isArray(s.vehicles) && s.vehicles.length > 0;

// Helper: is the player employed?
const isEmployed = (s: GameState) => !!s.currentJob;

// Helper: has criminal activity
const isCriminal = (s: GameState) => (s.criminalLevel ?? 0) > 0;

// Helper: has a partner/spouse
const hasPartner = (s: GameState) =>
  !!s.family?.spouse ||
  (s.relationships ?? []).some(
    (r: any) => r.type === 'partner' || r.type === 'spouse'
  );

// Helper: age in years
const getAge = (s: GameState) => Math.floor(s.date?.age ?? 18);

// ─── Near-miss event templates ───────────────────────────────────

const nearMissCarAccident: EventTemplate = {
  id: 'near_miss_car_accident',
  category: 'health',
  weight: 0.12,
  condition: (s) => ownsVehicle(s) && (s.weeksLived ?? 0) > 8,
  generate: () => ({
    id: 'near_miss_car_accident',
    description:
      'A car ran a red light and missed you by inches while you were crossing the street. Your heart is pounding.',
    choices: [
      {
        id: 'shaken',
        text: 'That was way too close...',
        effects: { stats: { happiness: -3 } },
      },
      {
        id: 'grateful',
        text: 'Thank goodness I looked both ways!',
        effects: { stats: { happiness: 2 } },
      },
    ],
  }),
};

const nearMissHeartScare: EventTemplate = {
  id: 'near_miss_heart_scare',
  category: 'health',
  weight: 0.15,
  condition: (s) => (s.stats?.health ?? 100) < 40 && getAge(s) >= 35,
  generate: () => ({
    id: 'near_miss_heart_scare',
    description:
      'You felt a sharp pain in your chest and your vision blurred for a moment. The doctor says you narrowly avoided a heart attack.',
    choices: [
      {
        id: 'scared',
        text: "I need to take better care of myself",
        effects: { stats: { happiness: -8, energy: -5 } },
      },
      {
        id: 'relieved',
        text: "At least I'm still here",
        effects: { stats: { happiness: -2 } },
      },
    ],
  }),
};

const nearMissBullet: EventTemplate = {
  id: 'near_miss_bullet',
  category: 'health',
  weight: 0.1,
  condition: (s) => isCriminal(s) && (s.weeksLived ?? 0) > 20,
  generate: () => ({
    id: 'near_miss_bullet',
    description:
      'A stray bullet whizzed past your head in a shady part of town. You heard it hit the wall behind you.',
    choices: [
      {
        id: 'run',
        text: 'Get out of here!',
        effects: { stats: { happiness: -10, energy: -15 } },
      },
      {
        id: 'shrug',
        text: "Comes with the territory",
        effects: { stats: { happiness: -3 } },
      },
    ],
  }),
};

const nearMissLightning: EventTemplate = {
  id: 'near_miss_lightning',
  category: 'health',
  weight: 0.06,
  condition: (s) => (s.weeksLived ?? 0) > 10,
  generate: () => ({
    id: 'near_miss_lightning',
    description:
      'Lightning struck a tree just 20 feet away from you during a storm. The crack of thunder left your ears ringing.',
    choices: [
      {
        id: 'terrified',
        text: "I'm never going outside in a storm again",
        effects: { stats: { happiness: -5 } },
      },
      {
        id: 'amazed',
        text: 'Wow... what are the odds?',
        effects: { stats: { happiness: 1 } },
      },
    ],
  }),
};

const nearMissFoodPoisoning: EventTemplate = {
  id: 'near_miss_food_poisoning',
  category: 'health',
  weight: 0.1,
  condition: (s) => (s.weeksLived ?? 0) > 5,
  generate: () => ({
    id: 'near_miss_food_poisoning',
    description:
      "You almost ate some food that had gone bad. You noticed the smell just in time and threw it away.",
    choices: [
      {
        id: 'relieved',
        text: 'That was a close one',
        effects: { stats: { happiness: 1 } },
      },
      {
        id: 'hungry',
        text: "Now I'm still hungry...",
        effects: { stats: { energy: -3, happiness: -2 } },
      },
    ],
  }),
};

const nearMissFallingObject: EventTemplate = {
  id: 'near_miss_falling_object',
  category: 'health',
  weight: 0.08,
  condition: (s) => (s.weeksLived ?? 0) > 10,
  generate: () => ({
    id: 'near_miss_falling_object',
    description:
      'A heavy flowerpot fell from a balcony above and shattered right where you were standing a second ago.',
    choices: [
      {
        id: 'shocked',
        text: 'I could have died!',
        effects: { stats: { happiness: -6 } },
      },
      {
        id: 'lucky',
        text: 'Someone up there is looking out for me',
        effects: { stats: { happiness: 3 } },
      },
    ],
  }),
};

const nearMissRobbery: EventTemplate = {
  id: 'near_miss_robbery',
  category: 'general',
  weight: 0.1,
  condition: (s) => (s.stats?.money ?? 0) > 5000 && (s.weeksLived ?? 0) > 15,
  generate: () => ({
    id: 'near_miss_robbery',
    description:
      "Someone tried to grab your wallet on the street, but a passerby shouted and scared them off.",
    choices: [
      {
        id: 'grateful',
        text: 'Thank that stranger profusely',
        effects: { stats: { happiness: -2 } },
      },
      {
        id: 'paranoid',
        text: "I'm never carrying cash again",
        effects: { stats: { happiness: -5 } },
      },
    ],
  }),
};

const nearMissCarCrash: EventTemplate = {
  id: 'near_miss_car_crash',
  category: 'health',
  weight: 0.1,
  condition: (s) => ownsVehicle(s) && (s.weeksLived ?? 0) > 15,
  generate: () => ({
    id: 'near_miss_car_crash',
    description:
      'A truck swerved into your lane on the highway. You jerked the wheel just in time to avoid a head-on collision.',
    choices: [
      {
        id: 'shaking',
        text: 'Pull over, hands shaking',
        effects: { stats: { happiness: -8, energy: -10 } },
      },
      {
        id: 'adrenaline',
        text: 'Heart racing, keep driving',
        effects: { stats: { happiness: -3, energy: 5 } },
      },
    ],
  }),
};

const nearMissFireAlarm: EventTemplate = {
  id: 'near_miss_fire_alarm',
  category: 'general',
  weight: 0.08,
  condition: (s) => (s.weeksLived ?? 0) > 8,
  generate: () => ({
    id: 'near_miss_fire_alarm',
    description:
      'Your smoke detector went off at 3 AM. You found a smoldering outlet behind your couch. A few more minutes and the whole place could have caught fire.',
    choices: [
      {
        id: 'fix',
        text: 'Get it repaired immediately',
        effects: { money: -150, stats: { happiness: -3 } },
      },
      {
        id: 'shaken',
        text: "I couldn't sleep the rest of the night",
        effects: { stats: { happiness: -5, energy: -10 } },
      },
    ],
  }),
};

const nearMissSlippery: EventTemplate = {
  id: 'near_miss_slip',
  category: 'health',
  weight: 0.09,
  condition: (s) => getAge(s) >= 50,
  generate: () => ({
    id: 'near_miss_slip',
    description:
      'You slipped on a wet floor and nearly cracked your head on the tile. You caught yourself at the last second.',
    choices: [
      {
        id: 'careful',
        text: "I need to be more careful at my age",
        effects: { stats: { happiness: -4 } },
      },
      {
        id: 'laughitoff',
        text: 'Still got the reflexes!',
        effects: { stats: { happiness: 2 } },
      },
    ],
  }),
};

const nearMissDogAttack: EventTemplate = {
  id: 'near_miss_dog_attack',
  category: 'health',
  weight: 0.07,
  condition: (s) => (s.weeksLived ?? 0) > 12,
  generate: () => ({
    id: 'near_miss_dog_attack',
    description:
      "An unleashed dog charged at you in the park, teeth bared. Its owner tackled it just before it reached you.",
    choices: [
      {
        id: 'angry',
        text: 'Yell at the owner',
        effects: { stats: { happiness: -3, energy: -5 } },
      },
      {
        id: 'calm',
        text: 'Walk away quickly',
        effects: { stats: { happiness: -2 } },
      },
    ],
  }),
};

const nearMissScam: EventTemplate = {
  id: 'near_miss_scam',
  category: 'economy',
  weight: 0.1,
  condition: (s) => (s.stats?.money ?? 0) > 2000 && (s.weeksLived ?? 0) > 10,
  generate: () => ({
    id: 'near_miss_scam',
    description:
      'You almost fell for a convincing email scam. You were about to enter your bank details when you noticed the URL was fake.',
    choices: [
      {
        id: 'report',
        text: 'Report it and change your passwords',
        effects: { stats: { happiness: -2 } },
      },
      {
        id: 'embarrassed',
        text: "Can't believe I almost fell for that",
        effects: { stats: { happiness: -5 } },
      },
    ],
  }),
};

const nearMissWorkAccident: EventTemplate = {
  id: 'near_miss_work_accident',
  category: 'health',
  weight: 0.1,
  condition: (s) => isEmployed(s) && (s.weeksLived ?? 0) > 15,
  generate: () => ({
    id: 'near_miss_work_accident',
    description:
      'A heavy shelf collapsed at work right after you walked past it. Your coworkers are stunned.',
    choices: [
      {
        id: 'report',
        text: 'Report the safety hazard',
        effects: {
          stats: { reputation: 3, happiness: -2 },
          karma: { dimension: 'honesty', amount: 5, reason: 'Reported workplace hazard' },
        },
      },
      {
        id: 'shrug',
        text: 'Just another day at work...',
        effects: { stats: { happiness: -3 } },
      },
    ],
  }),
};

const nearMissChoke: EventTemplate = {
  id: 'near_miss_choke',
  category: 'health',
  weight: 0.07,
  condition: (s) => (s.weeksLived ?? 0) > 5,
  generate: () => ({
    id: 'near_miss_choke',
    description:
      "You choked on a piece of food at dinner. A stranger performed the Heimlich maneuver and saved your life.",
    choices: [
      {
        id: 'grateful',
        text: 'Thank them tearfully',
        effects: { stats: { happiness: 5 } },
      },
      {
        id: 'embarrassed',
        text: "That was mortifying",
        effects: { stats: { happiness: -5 } },
      },
    ],
  }),
};

const nearMissTornado: EventTemplate = {
  id: 'near_miss_tornado',
  category: 'health',
  weight: 0.04,
  condition: (s) => (s.weeksLived ?? 0) > 20,
  generate: () => ({
    id: 'near_miss_tornado',
    description:
      'A tornado touched down just a mile from your home. You watched debris flying through the air from your window.',
    choices: [
      {
        id: 'terrified',
        text: 'Hide in the basement',
        effects: { stats: { happiness: -8 } },
      },
      {
        id: 'amazed',
        text: "That was terrifyingly beautiful",
        effects: { stats: { happiness: -2 } },
      },
    ],
  }),
};

const nearMissPartnerCheating: EventTemplate = {
  id: 'near_miss_partner_suspicion',
  category: 'relationship',
  weight: 0.08,
  condition: (s) => hasPartner(s) && (s.weeksLived ?? 0) > 20,
  generate: () => ({
    id: 'near_miss_partner_suspicion',
    description:
      "You found a suspicious text on your partner's phone, but it turned out to be a surprise party they were planning for you.",
    choices: [
      {
        id: 'relieved',
        text: 'Phew! I feel terrible for snooping',
        effects: { stats: { happiness: 8 } },
      },
      {
        id: 'suspicious',
        text: "I'll keep my eye out anyway...",
        effects: { stats: { happiness: -2 } },
      },
    ],
  }),
};

const nearMissIdentityTheft: EventTemplate = {
  id: 'near_miss_identity_theft',
  category: 'economy',
  weight: 0.08,
  condition: (s) => (s.stats?.money ?? 0) > 10000 && (s.weeksLived ?? 0) > 25,
  generate: () => ({
    id: 'near_miss_identity_theft',
    description:
      "Your bank called to alert you that someone tried to open a credit card in your name. They caught it just in time.",
    choices: [
      {
        id: 'freeze',
        text: 'Freeze your credit immediately',
        effects: { money: -50, stats: { happiness: -5 } },
      },
      {
        id: 'shrug',
        text: "The bank handled it, I'm fine",
        effects: { stats: { happiness: -2 } },
      },
    ],
  }),
};

const nearMissBikeAccident: EventTemplate = {
  id: 'near_miss_bike',
  category: 'health',
  weight: 0.08,
  condition: (s) => (s.stats?.fitness ?? 0) > 30 && (s.weeksLived ?? 0) > 8,
  generate: () => ({
    id: 'near_miss_bike',
    description:
      'A car door swung open right as you were cycling past. You swerved just in time, scraping your knee on the pavement.',
    choices: [
      {
        id: 'angry',
        text: 'Yell at the driver',
        effects: { stats: { happiness: -3, health: -2 } },
      },
      {
        id: 'shaken',
        text: 'Sit on the curb and catch your breath',
        effects: { stats: { happiness: -2, energy: -5, health: -1 } },
      },
    ],
  }),
};

const nearMissElectricalShock: EventTemplate = {
  id: 'near_miss_electrical',
  category: 'health',
  weight: 0.05,
  condition: (s) => (s.weeksLived ?? 0) > 10,
  generate: () => ({
    id: 'near_miss_electrical',
    description:
      'You got a sharp electrical shock from a faulty outlet. Your arm is numb but the doctor says no permanent damage.',
    choices: [
      {
        id: 'fix',
        text: 'Get it fixed right away',
        effects: { money: -200, stats: { health: -3 } },
      },
      {
        id: 'ignore',
        text: "It's probably fine...",
        effects: { stats: { health: -5, happiness: -2 } },
      },
    ],
  }),
};

const nearMissAllergyReaction: EventTemplate = {
  id: 'near_miss_allergy',
  category: 'health',
  weight: 0.07,
  condition: (s) => (s.weeksLived ?? 0) > 8,
  generate: () => ({
    id: 'near_miss_allergy',
    description:
      "You had a severe allergic reaction to something you ate. Your throat started swelling but the EpiPen from a nearby pharmacy saved you.",
    choices: [
      {
        id: 'shaken',
        text: "That was terrifying",
        effects: { money: -100, stats: { happiness: -8, health: -5 } },
      },
      {
        id: 'prepared',
        text: 'Buy an EpiPen to carry with me',
        effects: { money: -300, stats: { happiness: -3 } },
      },
    ],
  }),
};

const nearMissGasleak: EventTemplate = {
  id: 'near_miss_gas_leak',
  category: 'health',
  weight: 0.05,
  condition: (s) =>
    (s.weeksLived ?? 0) > 15 &&
    Array.isArray(s.realEstate) &&
    s.realEstate.length > 0,
  generate: () => ({
    id: 'near_miss_gas_leak',
    description:
      'You smelled gas in your home and called emergency services. They found a leak that could have caused an explosion.',
    choices: [
      {
        id: 'repair',
        text: 'Get it fixed and buy a detector',
        effects: { money: -400, stats: { happiness: -5 } },
      },
      {
        id: 'minimal',
        text: 'Just fix the leak',
        effects: { money: -200, stats: { happiness: -8 } },
      },
    ],
  }),
};

export const nearMissEventTemplates: EventTemplate[] = [
  nearMissCarAccident,
  nearMissHeartScare,
  nearMissBullet,
  nearMissLightning,
  nearMissFoodPoisoning,
  nearMissFallingObject,
  nearMissRobbery,
  nearMissCarCrash,
  nearMissFireAlarm,
  nearMissSlippery,
  nearMissDogAttack,
  nearMissScam,
  nearMissWorkAccident,
  nearMissChoke,
  nearMissTornado,
  nearMissPartnerCheating,
  nearMissIdentityTheft,
  nearMissBikeAccident,
  nearMissElectricalShock,
  nearMissAllergyReaction,
  nearMissGasleak,
];
