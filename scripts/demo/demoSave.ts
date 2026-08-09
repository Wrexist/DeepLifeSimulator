/**
 * Demo-save generator for the App Store App Preview capture.
 *
 * Builds three chapters of ONE character's life and emits the exact
 * localStorage entries the app reads at boot, so a capture run starts from a
 * known, photogenic state instead of grinding a hundred weeks on camera.
 *
 * Every id, price and symbol below is pulled from the real catalogs
 * (`PROPERTY_CATALOG`, `DEFAULT_PRICES`, `initialGameState`) rather than
 * invented, so the states are ones the app can actually render. Each chapter
 * is run through `validateGameState` before it is written; a chapter the app
 * would reject fails the build.
 *
 * Run: `npm run demo:save`
 */

import type { GameState, RealEstate, Relationship, ChildInfo, Company } from '@/contexts/game/types';
import { initialGameState, STATE_VERSION } from '@/contexts/game/initialState';
import { createSaveEnvelope, validateGameState } from '@/utils/saveValidation';
import { PROPERTY_CATALOG } from '@/lib/realEstate/catalog';
import { DEFAULT_PRICES } from '@/lib/economy/stockMarket';
import { calculateNetWorth } from '@/lib/statistics/statisticsTracker';
import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';

const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

const WEEKS_PER_YEAR = 52;
const START_AGE = 18;
const START_YEAR = 2025;

/** Deep clone that keeps the GameState type. `structuredClone` is fine here — no functions in state. */
function cloneState(state: GameState): GameState {
  return structuredClone(state);
}

/** Absolute week counter for an age, matching the app's `weeksLived` convention (§4.2). */
function weeksLivedForAge(age: number): number {
  return (age - START_AGE) * WEEKS_PER_YEAR;
}

/**
 * Owned copy of a catalog property. Reads the real entry so name/price/comfort
 * match what the Real Estate screen will display.
 */
function ownProperty(
  catalogId: string,
  opts: { residence?: boolean; rented?: boolean; purchasedWeek: number }
): RealEstate {
  const base = PROPERTY_CATALOG.find((p) => p.id === catalogId);
  if (!base) {
    throw new Error(
      `Unknown property id "${catalogId}". Known ids: ${PROPERTY_CATALOG.map((p) => p.id).join(', ')}`
    );
  }
  return {
    ...base,
    owned: true,
    status: opts.rented ? 'rented' : opts.residence ? 'owner' : 'vacant',
    currentResidence: opts.residence ?? false,
    currentValue: base.price,
    purchasePrice: base.price,
    purchasedWeek: opts.purchasedWeek,
    condition: 96,
    lastMaintenance: opts.purchasedWeek,
    // Commercial units earn; the residence does not.
    rent: opts.rented ? Math.round((base.price * 0.0009) / 10) * 10 : undefined,
  };
}

/** Holding priced off the real market catalog, bought at a plausible cost basis. */
function holding(symbol: string, shares: number, costBasisFactor: number) {
  const market = DEFAULT_PRICES[symbol];
  if (!market) {
    throw new Error(
      `Unknown stock symbol "${symbol}". Known: ${Object.keys(DEFAULT_PRICES).join(', ')}`
    );
  }
  return {
    symbol,
    shares,
    averagePrice: Math.round(market.price * costBasisFactor * 100) / 100,
    currentPrice: market.price,
  };
}

/**
 * Put the character on a career rung.
 *
 * The Identity card reads `careers.find(id === currentJob).levels[level].name`,
 * so `currentJob` alone leaves a 40-year-old founder captioned "Business
 * Intern" — level 0 of the ladder. This sets the rung, and the accepted/applied
 * flags the Work screen checks before it will show a job as held.
 */
function promote(state: GameState, careerId: string, level: number, weeksLived: number): void {
  const career = state.careers.find((c) => c.id === careerId);
  if (!career) {
    throw new Error(
      `Unknown career id "${careerId}". Known: ${state.careers.map((c) => c.id).join(', ')}`
    );
  }
  const topLevel = career.levels.length - 1;
  if (level > topLevel) {
    throw new Error(`Career "${careerId}" has no level ${level} (top rung is ${topLevel}).`);
  }
  career.level = level;
  career.currentLevel = level;
  career.applied = true;
  career.accepted = true;
  career.progress = 100;
  career.performance = 94;
  career.startedWeeksLived = Math.max(0, weeksLived - level * 90);
  state.currentJob = careerId;
}

/**
 * Mark catalog items as owned.
 *
 * More than cosmetics: the Apps tab — which is where Stocks, Bank, Real Estate
 * and the social apps live, i.e. most of what is worth filming — is hidden from
 * the tab bar until `items` contains an owned `smartphone` or `computer`
 * (`app/(tabs)/_layout.tsx`). The corporate ladder also gates on `suit` +
 * `computer`.
 */
function ownItems(state: GameState, ids: string[]): void {
  for (const id of ids) {
    const item = state.items.find((i) => i.id === id);
    if (!item) {
      throw new Error(
        `Unknown item id "${id}". Known: ${state.items.map((i) => i.id).join(', ')}`
      );
    }
    item.owned = true;
  }
}

/**
 * Last week's closing prices for every listed symbol.
 *
 * Without this the Market screen has nothing to diff against: it reports
 * "0 Advancing / 0 Declining", every sector reads Neutral and the sparklines
 * render as flat dashes — a dead market, which is the exact opposite of what
 * the listing claims. Seeding a previous close makes the board move on the
 * first frame.
 *
 * The offsets are deterministic (hashed off the symbol) rather than random, so
 * regenerating the bundle doesn't churn the file, and are deliberately mixed:
 * a board that is 100% green reads as fake.
 */
function seedMarketHistory(): {
  saved: Record<string, { price: number; dividendYield: number }>;
  lastWeek: Record<string, { price: number; dividendYield: number }>;
} {
  const saved: Record<string, { price: number; dividendYield: number }> = {};
  const lastWeek: Record<string, { price: number; dividendYield: number }> = {};

  for (const [symbol, data] of Object.entries(DEFAULT_PRICES)) {
    // Stable per-symbol hash → offset in roughly [-4%, +6%], biased upward so
    // the board leans green without being uniformly green.
    let hash = 0;
    for (let i = 0; i < symbol.length; i++) hash = (hash * 31 + symbol.charCodeAt(i)) % 1000;
    const offset = (hash / 1000) * 0.1 - 0.04;

    saved[symbol] = { price: data.price, dividendYield: data.dividendYield };
    lastWeek[symbol] = {
      price: Math.round(data.price * (1 - offset) * 100) / 100,
      dividendYield: data.dividendYield,
    };
  }

  return { saved, lastWeek };
}

function makeSpouse(weeksLived: number): Relationship {
  return {
    id: 'spouse-daniel',
    name: 'Daniel Moreno',
    type: 'spouse',
    relationshipScore: 92,
    personality: 'supportive',
    gender: 'male',
    age: 41,
    income: 4200,
    livingTogether: true,
    familyHappiness: 88,
    marriageWeek: weeksLived - 9 * WEEKS_PER_YEAR,
    anniversaryWeek: weeksLived - 9 * WEEKS_PER_YEAR,
    datesCount: 64,
  };
}

function makeChild(
  id: string,
  name: string,
  age: number,
  gender: 'male' | 'female',
  weeksLived: number
): ChildInfo {
  return {
    id,
    name,
    type: 'child',
    relationshipScore: 90,
    personality: 'curious',
    gender,
    age,
    birthWeeksLived: weeksLived - age * WEEKS_PER_YEAR,
    educationLevel: age >= 14 ? 'highSchool' : 'none',
    isHeirEligible: true,
    intelligence: 78,
    health: 85,
    happiness: 88,
    discipline: 72,
    familyHappiness: 88,
  };
}

function makeCompany(
  id: string,
  name: string,
  type: Company['type'],
  weeklyIncome: number,
  employees: number
): Company {
  return {
    id,
    name,
    type,
    weeklyIncome,
    baseWeeklyIncome: Math.round(weeklyIncome * 0.55),
    money: Math.round(weeklyIncome * 6),
    upgrades: [],
    employees,
    workerSalary: 900,
    workerMultiplier: 1.35,
    marketingLevel: 4,
    miners: {},
    warehouseLevel: 3,
  };
}

// ---------------------------------------------------------------------------
// Chapters
// ---------------------------------------------------------------------------

export interface Chapter {
  slot: number;
  key: string;
  title: string;
  caption: string;
  build: () => GameState;
}

/** Shared identity so all three chapters read as one person's life. */
function applyIdentity(state: GameState, age: number): GameState {
  state.userProfile = {
    ...state.userProfile,
    name: 'Ava Moreno',
    firstName: 'Ava',
    lastName: 'Moreno',
    handle: '@avamoreno',
    username: '@avamoreno',
    displayName: 'Ava Moreno',
    gender: 'female',
    sex: 'female',
    seekingGender: 'male',
  };
  const weeksLived = weeksLivedForAge(age);
  state.weeksLived = weeksLived;
  state.week = 1;
  state.day = 1;
  state.date = {
    year: START_YEAR + (age - START_AGE),
    month: MONTHS[0],
    week: 1,
    age,
  };
  // Drives the italic line under the name on the Identity card. Left unset it
  // renders the literal string "Unknown", which reads as a bug on camera.
  state.scenarioId = 'aspiring_entrepreneur';
  return state;
}

/** Chapter 1 — the hook frame. Eighteen, unemployed, nothing in the bank. */
function buildWeekOne(): GameState {
  const s = applyIdentity(cloneState(initialGameState), 18);
  s.version = STATE_VERSION;
  s.stats = { ...s.stats, money: 250, health: 88, happiness: 70, energy: 92, fitness: 45, reputation: 5, gems: 25 };
  s.bankSavings = 0;
  s.userProfile.bio = 'Just turned 18. No money, no plan, no excuses.';
  s.userProfile.followers = 41;
  s.userProfile.following = 180;
  s.showWelcomePopup = false;
  return s;
}

/** Chapter 2 — the climb. First real job, first shares, first keys. */
function buildTheClimb(): GameState {
  const age = 24;
  const s = applyIdentity(cloneState(initialGameState), age);
  const weeksLived = s.weeksLived;
  s.version = STATE_VERSION;
  s.stats = { ...s.stats, money: 8_400, health: 84, happiness: 78, energy: 71, fitness: 58, reputation: 34, gems: 60 };
  s.bankSavings = 12_000;
  promote(s, 'software', 1, weeksLived);
  s.loginStreak = 3;
  s.userProfile.bio = 'Junior dev. Saving every paycheck. Watching the market.';
  s.userProfile.followers = 2_180;
  s.userProfile.following = 604;
  s.showWelcomePopup = false;
  s.hasSeenJobTutorial = true;
  s.hasPhone = true;
  ownItems(s, ['smartphone', 'computer', 'basic_bed']);

  s.realEstate = [ownProperty('studio-apt', { residence: true, purchasedWeek: weeksLived - 40 })];
  s.stocks = {
    ...(s.stocks ?? { holdings: [], watchlist: [], realizedGains: 0 }),
    holdings: [holding('AAPL', 120, 0.74), holding('MSFT', 30, 0.81)],
    watchlist: ['NVDA', 'AMZN'],
    realizedGains: 1_850,
    ...(() => {
      const m = seedMarketHistory();
      return { savedMarketPrices: m.saved, lastWeekPrices: m.lastWeek };
    })(),
  };

  s.relationships = [
    {
      id: 'partner-daniel',
      name: 'Daniel',
      type: 'partner',
      relationshipScore: 74,
      personality: 'supportive',
      gender: 'male',
      age: 25,
      datesCount: 11,
      livingTogether: false,
    },
  ];
  return s;
}

/** Chapter 3 — the empire. The frame the whole listing is selling. */
function buildTheEmpire(): GameState {
  const age = 40;
  const s = applyIdentity(cloneState(initialGameState), age);
  const weeksLived = s.weeksLived;
  s.version = STATE_VERSION;
  s.stats = {
    ...s.stats,
    money: 2_400_000,
    health: 82,
    happiness: 91,
    energy: 74,
    fitness: 70,
    reputation: 88,
    gems: 340,
  };
  s.bankSavings = 1_800_000;
  // Top rung of the corporate ladder — "CEO".
  promote(s, 'corporate', 5, weeksLived);
  s.mindset = { activeTraitId: 'workaholic' };
  s.ambitionId = 'business_empire';
  s.ambitionCompletedMilestones = ['be_found', 'be_conglomerate', 'be_networth_5m'];
  s.ambitionRewardClaimed = false;
  s.loginStreak = 6;
  // Mark this week's daily-gem reward as already taken, so the hero frame is
  // the game rather than a monetisation CTA sitting under the Identity card.
  s.lastLoginRewardWeek = weeksLived;
  s.userProfile.bio = 'Founder. Two companies, three properties, one very patient husband.';
  s.userProfile.followers = 1_240_000;
  s.userProfile.following = 312;
  s.userProfile.verified = true;
  s.showWelcomePopup = false;
  s.hasSeenJobTutorial = true;
  s.hasPhone = true;
  s.hasDriversLicense = true;
  s.computerPreviouslyOwned = true;
  ownItems(s, ['smartphone', 'computer', 'suit', 'basic_bed', 'gym_membership', 'passport']);

  s.realEstate = [
    ownProperty('mansion', { residence: true, purchasedWeek: weeksLived - 5 * WEEKS_PER_YEAR }),
    ownProperty('retail-strip', { rented: true, purchasedWeek: weeksLived - 8 * WEEKS_PER_YEAR }),
    ownProperty('warehouse', { rented: true, purchasedWeek: weeksLived - 6 * WEEKS_PER_YEAR }),
  ];

  const market = seedMarketHistory();
  s.stocks = {
    ...(s.stocks ?? { holdings: [], watchlist: [], realizedGains: 0 }),
    holdings: [
      holding('NVDA', 2_400, 0.31),
      holding('AAPL', 5_000, 0.42),
      holding('MSFT', 2_600, 0.48),
      holding('AMZN', 3_500, 0.55),
    ],
    watchlist: ['TSLA', 'META', 'JPM'],
    realizedGains: 1_940_000,
    savedMarketPrices: market.saved,
    lastWeekPrices: market.lastWeek,
    sectorSnapshots: [
      { sector: 'tech', state: 'strong', weeksRemaining: 6 },
      { sector: 'finance', state: 'neutral', weeksRemaining: 3 },
      { sector: 'healthcare', state: 'weak', weeksRemaining: 2 },
      { sector: 'consumer', state: 'strong', weeksRemaining: 5 },
      { sector: 'industrial', state: 'neutral', weeksRemaining: 4 },
      { sector: 'energy', state: 'weak', weeksRemaining: 7 },
    ],
  };

  s.companies = [
    makeCompany('co-moreno-robotics', 'Moreno Robotics', 'factory', 42_000, 34),
    makeCompany('co-northwind-ai', 'Northwind AI', 'ai', 61_000, 21),
  ];
  s.company = s.companies[0];

  s.family = {
    spouse: makeSpouse(weeksLived),
    children: [
      makeChild('child-noa', 'Noa Moreno', 15, 'female', weeksLived),
      makeChild('child-elias', 'Elias Moreno', 11, 'male', weeksLived),
    ],
  };
  s.relationships = [makeSpouse(weeksLived)];
  s.generationNumber = 1;

  return s;
}

export const CHAPTERS: Chapter[] = [
  { slot: 1, key: 'week-one', title: 'Week One', caption: 'Eighteen. $250. No plan.', build: buildWeekOne },
  { slot: 2, key: 'the-climb', title: 'The Climb', caption: 'First job. First shares. First keys.', build: buildTheClimb },
  { slot: 3, key: 'the-empire', title: 'The Empire', caption: 'Two companies. Three properties. One dynasty.', build: buildTheEmpire },
];

// ---------------------------------------------------------------------------
// Emit
// ---------------------------------------------------------------------------

export interface DemoSaveBundle {
  /** localStorage key -> value, written verbatim before the app boots. */
  entries: Record<string, string>;
  /** Human-readable summary, for the beat sheet and for eyeballing the run. */
  chapters: { slot: number; key: string; title: string; caption: string; netWorth: number; age: number }[];
  stateVersion: number;
}

/**
 * Build every chapter, validate it, and return the storage entries plus a
 * summary. Throws on a chapter the app would reject — better to fail here than
 * to discover it as a blank screen halfway through a capture run.
 */
export function buildDemoSaveBundle(): DemoSaveBundle {
  const entries: Record<string, string> = {};
  const summary: DemoSaveBundle['chapters'] = [];

  for (const chapter of CHAPTERS) {
    const state = chapter.build();

    const result = validateGameState(state, false);
    if (!result.valid) {
      throw new Error(
        `Chapter "${chapter.key}" (slot ${chapter.slot}) is not a valid GameState:\n  - ${result.errors.join('\n  - ')}`
      );
    }
    if (result.warnings.length > 0) {
      console.warn(`  ! ${chapter.key}: ${result.warnings.length} warning(s)`);
      for (const w of result.warnings.slice(0, 5)) console.warn(`      ${w}`);
    }

    // Match `createSaveData`: state + version + updatedAt, then the v2 envelope.
    // updatedAt is fixed so regenerating an unchanged chapter is byte-identical
    // and does not show up as a spurious diff.
    const dataString = JSON.stringify({ ...state, version: STATE_VERSION, updatedAt: 0 });
    const envelope = createSaveEnvelope(dataString);

    const slotKey = `save_slot_${chapter.slot}`;
    entries[`${slotKey}_A`] = envelope;
    entries[`${slotKey}_active`] = 'A';

    summary.push({
      slot: chapter.slot,
      key: chapter.key,
      title: chapter.title,
      caption: chapter.caption,
      netWorth: Math.round(calculateNetWorth(state)),
      age: state.date.age,
    });
  }

  // Boot straight into the hero chapter.
  const hero = CHAPTERS[CHAPTERS.length - 1];
  entries.currentSlot = String(hero.slot);
  entries.lastSlot = String(hero.slot);

  return { entries, chapters: summary, stateVersion: STATE_VERSION };
}

export function main() {
  const outPath = resolve(__dirname, 'demo-save.json');
  console.log(`Building demo saves (STATE_VERSION ${STATE_VERSION})...`);

  const bundle = buildDemoSaveBundle();

  mkdirSync(dirname(outPath), { recursive: true });
  writeFileSync(outPath, JSON.stringify(bundle, null, 2) + '\n', 'utf8');

  const fmt = (n: number) =>
    n >= 1_000_000 ? `$${(n / 1_000_000).toFixed(2)}M` : `$${Math.round(n).toLocaleString('en-US')}`;

  console.log('');
  for (const c of bundle.chapters) {
    console.log(`  slot ${c.slot}  ${c.title.padEnd(10)}  age ${String(c.age).padStart(2)}  net worth ${fmt(c.netWorth).padStart(9)}   ${c.caption}`);
  }
  console.log('');
  console.log(`Wrote ${Object.keys(bundle.entries).length} storage entries -> ${outPath}`);
}
