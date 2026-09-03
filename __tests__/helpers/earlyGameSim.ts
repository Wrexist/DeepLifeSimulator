/**
 * Early-game persona simulator — Master Program 7.
 *
 * Drives the REAL production `nextWeek()` (GameProvider-mounted, the
 * `tickTiming.bench` / `economyStrategySim` pattern) on the REAL onboarding
 * seed (`buildNewGameState` over a scenario from `scenarioData`), with a
 * scripted "player" that acts each week through the REAL action functions —
 * `applyForJob`, `performHealthActivity`, `rentHome`, `performStreetJob`,
 * `buyFood`, `promoteCareer`. Nothing is written to state by hand, so what a
 * persona "does" is exactly what a thumb on the screen can do.
 *
 * Deterministic: `Math.random` is replaced by a seeded PRNG for the run and
 * restored afterwards, so a persona + seed reproduces the same 20 weeks every
 * time, and "unlucky" is a matter of running more seeds, not of guessing.
 *
 * Shared by the manual soak (`__tests__/simulation/earlyGamePersonas.sim.test.ts`)
 * and the CI survivability gates (`__tests__/simulation/earlyGameSurvivability.test.ts`).
 */
import React from 'react';
import { GameProvider } from '@/contexts/game/GameProvider';
import { useGameState, useGameActions, useItemActions, useJobActions, useMoneyActions } from '@/contexts/game';
import { UIUXProvider } from '@/contexts/UIUXContext';
import type { GameState } from '@/contexts/game/types';
import { buildNewGameState } from '@/src/features/onboarding/gameStateBuilder';
import { initialGameState, STATE_VERSION } from '@/contexts/game/initialState';
import * as scenarioData from '@/src/features/onboarding/scenarioData';
import { rentHome as rentHomeAction } from '@/contexts/game/actions/RentalActions';
import { getJobBoard } from '@/lib/careers/jobMarket';
import { getPromotionEligibility } from '@/lib/careers/promotionGating';
import { netWorth } from '@/lib/progress/achievements';
import { weeksInThisLife } from '@/lib/progress/lifeChapters';
import { computeHousingWellbeing } from '@/lib/realEstate/rentals';
// Economic actions (Program 10). Every one is the production action module the
// app screens call, invoked with the same arguments the screen passes.
import { depositCashToAccount, withdrawCashFromAccount } from '@/contexts/game/actions/BankingActions';
import { LEGACY_SAVINGS_ACCOUNT_ID } from '@/lib/banking/operations';
import { buyStockMarket, sellStockMarket } from '@/contexts/game/actions/StockActions';
import { getStockInfo, resetStockPrices } from '@/lib/economy/stockMarket';
import { buyPropertyWithMortgage } from '@/contexts/game/actions/RealEstateActions';
import { PROPERTY_CATALOG } from '@/lib/realEstate/catalog';
import type { DownPaymentTier, MortgageTerm } from '@/lib/realEstate/mortgage';
import { enrollInProgram } from '@/contexts/game/actions/EducationActions';
import { getEducationProgram } from '@/lib/education/programs';
import {
  createCompany as createCompanyAction,
  buyCompanyUpgrade as buyCompanyUpgradeAction,
} from '@/contexts/game/actions/CompanyActions';
import { updateMoney as updateMoneyModule } from '@/contexts/game/actions/MoneyActions';
import { getDriversLicense, purchaseVehicle } from '@/contexts/game/actions/VehicleActions';
import { purchaseLuxuryItem } from '@/contexts/game/actions/LuxuryActions';
import { acceptLoan } from '@/contexts/game/actions/LoanActions';
import { buyPet as buyPetAction } from '@/contexts/game/actions/PetActions';
import { weeklyCareerSalary } from '@/lib/careers/weeklySalary';
import { calcWeeklyPassiveIncome, companyIncomePaidWeekly } from '@/lib/economy/passiveIncome';
import { calcWeeklyExpenses } from '@/lib/economy/expenses';
import { unlockTier } from '@/lib/progress/featureUnlocks';
// Social actions (Program 11). Same rule as the economic block above: every
// entry is the production module the app screens call, with the arguments the
// screen passes — so what a persona "does" socially is what a thumb can do.
import { swipeOnProfile, promoteMatchToFriend, promoteMatchToRelationship, playConversationOption, getSparkConversationView } from '@/contexts/game/actions/SparkActions';
import { DATING_PROFILES } from '@/lib/dating/datingProfiles';
import { recordInteraction, raiseRelationship, meetSomeone } from '@/contexts/game/actions/ContactsActions';
import { goOnDate as goOnDateAction, giveGift as giveGiftAction, proposeMarriage as proposeMarriageAction, type DateType } from '@/contexts/game/actions/DatingActions';
import { updateStats as updateStatsModule } from '@/contexts/game/actions/StatsActions';
import { strongRelationshipCount } from '@/lib/goals/playstyle';
import type { SparkConversationOptionId, SparkDateVenueId } from '@/lib/spark/conversation';

// eslint-disable-next-line @typescript-eslint/no-require-imports
const TestRenderer = require('react-test-renderer');
const { act } = TestRenderer;
const h = React.createElement;

export interface SimActionResult {
  success?: boolean;
  message?: string;
}

/** What a persona can do in a week. Every call goes through a real action. */
export interface SimActions {
  applyForJob: (careerId: string) => Promise<SimActionResult | undefined>;
  promoteCareer: (careerId: string) => Promise<SimActionResult | undefined>;
  performStreetJob: (jobId: string) => Promise<SimActionResult | undefined>;
  performHealthActivity: (activityId: string) => Promise<SimActionResult | undefined>;
  buyFood: (foodId: string) => Promise<SimActionResult | undefined>;
  buyItem: (itemId: string) => Promise<SimActionResult | undefined>;
  rentHome: (tierId: string) => Promise<SimActionResult | undefined>;
  /** Answer a pending weekly event (the "decisions waiting" inbox). */
  resolveEvent: (eventId: string, choiceId: string) => Promise<void>;
  /** Raw state write - for the few things no action exposes (answering a life moment). */
  setState: (updater: (prev: GameState) => GameState) => Promise<void>;
  // ── Economic actions (Program 10) ──────────────────────────────────────
  quitJob: () => Promise<void>;
  /** Move cash into the savings account (the Bank app's deposit). */
  deposit: (amount: number) => Promise<void>;
  withdraw: (amount: number) => Promise<void>;
  /** Market buy at the board's current price, 2% fee on top - the Stocks app's tap. */
  buyStock: (symbol: string, amountUSD: number) => Promise<void>;
  sellStock: (symbol: string, shares: number) => Promise<void>;
  /** Buy a catalogue property with the mortgage the Real Estate app quotes. */
  buyProperty: (
    propertyId: string,
    tier: DownPaymentTier,
    term: MortgageTerm,
    asResidence?: boolean,
  ) => Promise<SimActionResult | undefined>;
  /** Enrol in a programme from the Education app; cash or student loan. */
  enroll: (programId: string, mode: 'cash' | 'loan') => Promise<void>;
  createCompany: (type: string) => Promise<SimActionResult | undefined>;
  buyCompanyUpgrade: (upgradeId: string, companyId?: string) => Promise<SimActionResult | undefined>;
  getLicense: () => Promise<SimActionResult | undefined>;
  buyVehicle: (vehicleId: string) => Promise<SimActionResult | undefined>;
  buyLuxury: (itemId: string) => Promise<SimActionResult | undefined>;
  takeLoan: (principal: number, termWeeks: number, type: 'personal' | 'auto' | 'business') => Promise<void>;
  /** Spend `amountUSD` of cash on a coin at the board price (the Crypto app's buy). */
  buyCrypto: (cryptoId: string, amountUSD: number) => Promise<void>;
  buyPet: (breedId: string) => Promise<SimActionResult | undefined>;
  // ── Social actions (Program 11) ────────────────────────────────────────
  /** Swipe a Spark profile — the app's only way to meet a stranger. */
  swipe: (profileId: string, direction: 'left' | 'right' | 'super') => Promise<SimActionResult | undefined>;
  /** Promote a Spark match into a friend / a partner. */
  promoteFriend: (matchId: string) => Promise<SimActionResult | undefined>;
  promotePartner: (matchId: string) => Promise<SimActionResult | undefined>;
  /** Play one Spark conversation move (the v45 choice-driven chat). */
  converse: (
    matchId: string,
    optionId: SparkConversationOptionId,
    venueId?: SparkDateVenueId,
  ) => Promise<SimActionResult | undefined>;
  /** Contacts app: Call (free) / Hang Out ($30) — one per action per week. */
  contactInteract: (contactId: string, action: string, cost: number, bonus: number) => Promise<SimActionResult | undefined>;
  /** Contacts app: the paid "meaningful gesture" bond raise. */
  bond: (contactId: string) => Promise<SimActionResult | undefined>;
  /** Contacts app date sheet — partners only. */
  date: (partnerId: string, type: DateType) => Promise<SimActionResult | undefined>;
  gift: (partnerId: string, type: 'flowers' | 'jewelry' | 'trip' | 'surprise' | 'luxury') => Promise<SimActionResult | undefined>;
  propose: (partnerId: string, ringId: string) => Promise<SimActionResult | undefined>;
  /** Take the tier-1 introduction the Contacts app is offering this week. */
  meet: () => Promise<SimActionResult | undefined>;
}

/** Where a persona's cash went this week, by the tab it was spent on. */
export type SpendCategory =
  | 'food'
  | 'health'
  | 'items'
  | 'housing'
  | 'education'
  | 'investing'
  | 'property'
  | 'business'
  | 'vehicle'
  | 'luxury'
  | 'pets'
  | 'savings'
  | 'other';

export interface SimWeekContext {
  /** The state at the START of this week's actions (refreshed after each action). */
  state: () => GameState;
  /** Weeks into this life (0 on the first frame). */
  week: number;
  actions: SimActions;
  /** Free-text note that lands in the row for this week. */
  note: (text: string) => void;
}

export type SimPolicy = (ctx: SimWeekContext) => Promise<void> | void;

export interface SimRow {
  week: number;
  cash: number;
  /** Cash change produced by the TICK alone (income − bills), not by the persona's spending. */
  tickDelta: number;
  /** Cash the persona spent on actions this week. */
  spent: number;
  netWorth: number;
  health: number;
  happiness: number;
  energy: number;
  fitness: number;
  housing: string;
  job: string;
  level: number;
  diseases: string[];
  overdue: number;
  /** `completedChapters` after the tick. */
  chapters: string[];
  notes: string[];
  // ── Economic columns (Program 10) ──────────────────────────────────────
  age: number;
  /** Gross weekly job pay at the level held after the tick. */
  salary: number;
  /** Passive income the paycheck would credit next week (after caps). */
  passive: number;
  /** Standing weekly bills incl. projected income tax (`calcWeeklyExpenses`). */
  expenses: number;
  savings: number;
  /** Stocks + crypto at current prices. */
  invested: number;
  /** Owned real estate at current value. */
  property: number;
  /** Loans outstanding + arrears. */
  debt: number;
  /** Progression unlock tier (0-5). */
  tier: number;
  /** Active programme id, or `done:<n>` completed programmes. */
  education: string;
  companies: number;
  /** Cash spent this week by category (positive numbers). */
  spentBy: Partial<Record<SpendCategory, number>>;
  // ── Social columns (Program 11) ───────────────────────────────────────
  /** Relationships the player CHOSE — everything but the seeded parents. */
  chosen: number;
  /** Friends held (type 'friend'). */
  friends: number;
  /** Bonds at 60+ (the `strongRelationshipCount` the goal engine reads). */
  strong: number;
  /** 'none' | 'partner' | 'engaged' | 'spouse'. */
  romance: string;
  /** Children in `family.children`. */
  children: number;
  /** Spark matches held (promoted + not). */
  matches: number;
  /** Mean bond over every relationship, rounded. */
  avgBond: number;
  /** Social notifications the tick raised this week, by id. */
  socialEvents: string[];
}

export interface SimResult {
  name: string;
  scenarioId: string;
  seed: number;
  rows: SimRow[];
  died: boolean;
  deathWeek: number | null;
  deathReason: string | null;
  finalState: GameState;
  /** Lowest health / happiness seen at any week boundary. */
  minHealth: number;
  minHappiness: number;
}

export interface SimSpec {
  name: string;
  scenarioId?: string;
  seed?: number;
  weeks?: number;
  policy: SimPolicy;
  /** Optional tweak applied to the seeded state before the first frame. */
  mutateSeed?: (state: GameState) => GameState;
  /**
   * Replace `Math.random` with a seeded stream for the run (default true).
   * Pass false to exercise the GAME's own determinism - the life-reproducibility
   * tests do, so a stubbed generator cannot hide a live `Math.random()` in the
   * tick.
   */
  seedMathRandom?: boolean;
}

/** mulberry32 — small, fast, good enough to make a run reproducible. */
function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function findScenario(id: string): any {
  const lists = Object.values(scenarioData).filter((v): v is any[] => Array.isArray(v));
  const scenario = lists.flat().find((s) => s?.id === id);
  if (!scenario) throw new Error(`scenario not found: ${id}`);
  return scenario;
}

/** The state "Play" actually seeds for a scenario. */
export function seedScenario(scenarioId = 'food_courier'): GameState {
  return buildNewGameState({
    initialGameState,
    stateVersion: STATE_VERSION,
    firstName: 'New',
    lastName: 'Player',
    sex: 'male',
    sexuality: 'straight',
    scenario: findScenario(scenarioId),
    selectedPerks: [],
    permanentPerks: [],
    selectedMindset: null,
  }) as GameState;
}

type Probe = {
  state: GameState;
  setGameState: React.Dispatch<React.SetStateAction<GameState>>;
  nextWeek: () => Promise<void> | void;
  resolveEvent: (eventId: string, choiceId: string) => void;
  job: ReturnType<typeof useJobActions>;
  item: ReturnType<typeof useItemActions>;
  money: ReturnType<typeof useMoneyActions>;
};

let captured: Probe | null = null;

function ProbeComponent() {
  const { gameState, setGameState } = useGameState();
  const actions = useGameActions();
  const job = useJobActions();
  const item = useItemActions();
  const money = useMoneyActions();
  captured = {
    state: gameState,
    setGameState,
    nextWeek: actions.nextWeek as () => Promise<void> | void,
    resolveEvent: actions.resolveEvent as (eventId: string, choiceId: string) => void,
    job,
    item,
    money,
  };
  return null;
}

function mountGame(): { root: any } {
  captured = null;
  let root: any;
  act(() => {
    root = TestRenderer.create(
      h(UIUXProvider as any, null, h(GameProvider as any, null, h(ProbeComponent))),
    );
  });
  return { root };
}

async function flush() {
  await act(async () => {
    await Promise.resolve();
  });
}

function housingLabel(state: GameState): string {
  const hw = computeHousingWellbeing(state);
  if (hw.owned) return 'owned';
  if (hw.homeless) return 'homeless';
  return state.rental?.tierId ?? 'rented';
}

function jobLabel(state: GameState): { job: string; level: number } {
  if (!state.currentJob) return { job: 'none', level: 0 };
  const career = (state.careers ?? []).find((c) => c.id === state.currentJob);
  return { job: state.currentJob, level: career?.level ?? 0 };
}

function safeNum(n: unknown): number {
  return typeof n === 'number' && isFinite(n) ? n : 0;
}

/** The economic columns of a row, read from the state after the tick. */
function economyColumns(
  s: GameState,
): Pick<
  SimRow,
  'age' | 'salary' | 'passive' | 'expenses' | 'savings' | 'invested' | 'property' | 'debt' | 'tier' | 'education' | 'companies'
> {
  const salary = Math.round(weeklyCareerSalary(s));
  let passive = 0;
  try {
    passive = Math.round(calcWeeklyPassiveIncome(s).total);
  } catch {
    passive = 0;
  }
  let expenses = 0;
  try {
    expenses = Math.round(calcWeeklyExpenses(s as any, salary + passive).total);
  } catch {
    expenses = 0;
  }
  const stocks = (s.stocks?.holdings ?? []).reduce(
    (sum, h) => sum + safeNum(h?.shares) * safeNum(h?.currentPrice),
    0,
  );
  const crypto = (s.cryptos ?? []).reduce((sum, c) => sum + safeNum(c?.owned) * safeNum(c?.price), 0);
  const property = (s.realEstate ?? []).reduce(
    (sum, p) => (p?.owned ? sum + safeNum(p.currentValue ?? p.price) : sum),
    0,
  );
  const loans = (s.loans ?? []).reduce((sum, l) => sum + Math.max(0, safeNum(l?.remaining)), 0);
  const active = (s.educations ?? []).find((e) => e && !e.completed && safeNum(e.weeksRemaining) > 0);
  const done = (s.educations ?? []).filter((e) => e?.completed).length;
  return {
    age: Math.floor(safeNum(s.date?.age)),
    salary,
    passive,
    expenses,
    savings: Math.round(safeNum(s.bankSavings)),
    invested: Math.round(stocks + crypto),
    property: Math.round(property),
    debt: Math.round(loans + safeNum(s.overdueBalance)),
    tier: unlockTier(s),
    education: active ? `${active.id}:${Math.round(safeNum(active.weeksRemaining))}w` : `done:${done}`,
    companies: (s.companies ?? []).length,
  };
}

/**
 * The SOCIAL columns of a row (Program 11).
 *
 * `chosen` deliberately excludes the two seeded parents and every child: those
 * arrive without the player meeting anyone, and counting them is exactly the
 * mistake `ch2_make_friend` documents. It is the same predicate
 * `lib/ambitions/catalog.ts` uses for "Make a Connection", so the harness and
 * the ambition agree on what a relationship the player CHOSE is.
 */
function socialColumns(
  s: GameState,
): Pick<SimRow, 'chosen' | 'friends' | 'strong' | 'romance' | 'children' | 'matches' | 'avgBond'> {
  const rels = (s.relationships ?? []).filter(Boolean);
  const chosen = rels.filter((r) => r.type !== 'parent' && r.type !== 'child').length;
  const friends = rels.filter((r) => r.type === 'friend').length;
  const spouse = rels.find((r) => r.type === 'spouse');
  const partner = rels.find((r) => r.type === 'partner');
  const romance = spouse
    ? 'spouse'
    : partner
      ? partner.engagementWeek != null
        ? 'engaged'
        : 'partner'
      : 'none';
  const avgBond = rels.length
    ? Math.round(rels.reduce((sum, r) => sum + safeNum(r.relationshipScore), 0) / rels.length)
    : 0;
  return {
    chosen,
    friends,
    strong: strongRelationshipCount(s),
    romance,
    children: (s.family?.children ?? []).length,
    matches: (s.sparkApp?.matches ?? []).length,
    avgBond,
  };
}

/** Journal entries whose tags mark them social — the week's relationship news. */
function socialJournalSince(s: GameState, seenIds: Set<string>): string[] {
  const out: string[] = [];
  for (const e of s.journal ?? []) {
    if (!e?.id || seenIds.has(e.id)) continue;
    seenIds.add(e.id);
    const tags = e.tags ?? [];
    if (tags.includes('relationship') || tags.includes('family')) out.push(e.id);
  }
  return out;
}

/**
 * Run one persona for N weeks. Ticks stop at death (the row for the death week
 * is still recorded).
 */
export async function runPersona(spec: SimSpec): Promise<SimResult> {
  const scenarioId = spec.scenarioId ?? 'food_courier';
  const seed = spec.seed ?? 1;
  const weeks = spec.weeks ?? 20;
  const originalRandom = Math.random;
  if (spec.seedMathRandom !== false) Math.random = mulberry32(seed);

  const mounted = mountGame();
  try {
    // `buildNewGameState` mints a lineage id from the wall clock (a real new
    // game must), which would make every run a different life and the gates
    // time-dependent. Pin it from the seed; `mutateSeed` can still override.
    let seeded: GameState = { ...seedScenario(scenarioId), lineageId: `life_seed_${seed}` };
    if (spec.mutateSeed) seeded = spec.mutateSeed(seeded);
    // The stock board is a module store; a new life opens it on catalogue
    // prices (the tick does the same when the save carries no market).
    resetStockPrices();
    await act(async () => {
      captured!.setGameState(() => seeded);
      await Promise.resolve();
    });

    const rows: SimRow[] = [];
    let died = false;
    let deathWeek: number | null = null;
    let deathReason: string | null = null;
    let minHealth = 100;
    let minHappiness = 100;

    // Every action runs inside `act` so its updater is applied before the
    // persona reads the state again. `performHealthActivity` clears its
    // double-tap guard on a 50 ms timer (`ItemActionsContext`), which is a
    // debounce for thumbs, not a weekly cap - the simulator waits it out so
    // "meditate twice" means what it means on a phone.
    const wrap = async <T,>(fn: () => T, settleMs = 0): Promise<T> => {
      let out: T;
      await act(async () => {
        out = fn();
        await Promise.resolve();
      });
      if (settleMs > 0) await new Promise((r) => setTimeout(r, settleMs));
      return out!;
    };

    let spentBy: Partial<Record<SpendCategory, number>> = {};
    /** Run an action and book the cash it moved under `category`. */
    const spend = async <T,>(category: SpendCategory, fn: () => T, settleMs = 0): Promise<T> => {
      const before = captured!.state.stats.money;
      const out = await wrap(fn, settleMs);
      const delta = before - captured!.state.stats.money;
      if (delta > 0) spentBy[category] = Math.round((spentBy[category] ?? 0) + delta);
      return out;
    };
    const jobIncome = (s: GameState) => weeklyCareerSalary(s) + companyIncomePaidWeekly(s);

    const actions: SimActions = {
      applyForJob: (id) => wrap(() => captured!.job.applyForJob(id) as SimActionResult | undefined),
      promoteCareer: (id) => wrap(() => captured!.job.promoteCareer(id) as SimActionResult | undefined),
      performStreetJob: (id) => wrap(() => captured!.job.performStreetJob(id) as SimActionResult | undefined),
      performHealthActivity: (id) =>
        spend('health', () => captured!.item.performHealthActivity(id) as SimActionResult | undefined, 60),
      buyFood: (id) => spend('food', () => captured!.item.buyFood(id) as SimActionResult | undefined),
      buyItem: (id) => spend('items', () => captured!.item.buyItem(id) as SimActionResult | undefined),
      rentHome: (tierId) =>
        spend('housing', () => rentHomeAction(captured!.setGameState, captured!.state, tierId)),
      // `resolveEvent` keeps `${eventId}_${choiceId}` in a 500 ms double-tap
      // set after a successful resolve (GameActionsContext). Two cliffhangers
      // with the same resolve id three game-weeks apart land inside that
      // window at simulator speed and the second tap is silently dropped, so
      // the simulator waits the debounce out - a thumb always would.
      resolveEvent: (eventId, choiceId) =>
        spend('other', () => captured!.resolveEvent(eventId, choiceId), 520),
      setState: (updater) => wrap(() => captured!.setGameState(updater)),
      quitJob: () => wrap(() => captured!.job.quitJob()),
      deposit: (amount) =>
        spend('savings', () => depositCashToAccount(captured!.setGameState, LEGACY_SAVINGS_ACCOUNT_ID, amount)),
      withdraw: (amount) =>
        wrap(() => withdrawCashFromAccount(captured!.setGameState, LEGACY_SAVINGS_ACCOUNT_ID, amount)),
      buyStock: (symbol, amountUSD) =>
        spend('investing', () =>
          buyStockMarket(captured!.setGameState, symbol, amountUSD, getStockInfo(symbol).price),
        ),
      sellStock: (symbol, shares) =>
        wrap(() => sellStockMarket(captured!.setGameState, symbol, shares, getStockInfo(symbol).price)),
      buyProperty: (propertyId, tier, term, asResidence) =>
        spend('property', () => {
          const property = PROPERTY_CATALOG.find((p) => p.id === propertyId);
          if (!property) return { success: false, message: `no such property ${propertyId}` };
          return buyPropertyWithMortgage(captured!.state, captured!.setGameState, {
            property,
            tier,
            term,
            weeklyIncome: jobIncome(captured!.state),
            asResidence,
          });
        }),
      enroll: (programId, mode) =>
        spend('education', () => {
          const program = getEducationProgram(programId);
          if (!program) return;
          enrollInProgram(captured!.setGameState, {
            templateId: program.id,
            name: program.name,
            description: program.description,
            cost: program.cost,
            duration: program.duration,
            mode,
          });
        }),
      createCompany: (type) =>
        spend('business', () =>
          createCompanyAction(captured!.state, captured!.setGameState, type, { updateMoney: updateMoneyModule }),
        ),
      buyCompanyUpgrade: (upgradeId, companyId) =>
        spend('business', () =>
          buyCompanyUpgradeAction(
            captured!.state,
            captured!.setGameState,
            upgradeId,
            { updateMoney: updateMoneyModule },
            companyId,
          ),
        ),
      getLicense: () =>
        spend('vehicle', () =>
          getDriversLicense(captured!.state, captured!.setGameState, { updateMoney: updateMoneyModule }),
        ),
      buyVehicle: (vehicleId) =>
        spend('vehicle', () => purchaseVehicle(captured!.state, captured!.setGameState, vehicleId)),
      buyLuxury: (itemId) =>
        spend('luxury', () => purchaseLuxuryItem(captured!.state, captured!.setGameState, itemId)),
      takeLoan: (principal, termWeeks, type) =>
        wrap(() =>
          acceptLoan(captured!.setGameState, {
            principal,
            termWeeks,
            type,
            name: `${type} loan`,
            weeklyIncome: jobIncome(captured!.state),
            depositAccountId: 'checking-default',
            autoPay: true,
          }),
        ),
      buyCrypto: (cryptoId, amountUSD) => spend('investing', () => captured!.money.buyCrypto(cryptoId, amountUSD)),
      buyPet: (breedId) =>
        spend('pets', () =>
          buyPetAction(captured!.state, captured!.setGameState, breedId, 'Sim Pet', { updateMoney: updateMoneyModule }),
        ),
      // ── Social actions (Program 11) ──────────────────────────────────
      swipe: (profileId, direction) =>
        wrap(() => swipeOnProfile(captured!.setGameState, captured!.state, profileId, direction)),
      promoteFriend: (matchId) =>
        wrap(() => promoteMatchToFriend(captured!.setGameState, captured!.state, matchId)),
      promotePartner: (matchId) =>
        wrap(() => promoteMatchToRelationship(captured!.setGameState, captured!.state, matchId)),
      converse: (matchId, optionId, venueId) =>
        spend('other', () =>
          playConversationOption(captured!.setGameState, captured!.state, matchId, optionId, venueId),
        ),
      contactInteract: (contactId, action, cost, bonus) =>
        spend('other', () =>
          recordInteraction(captured!.state, captured!.setGameState, contactId, action, cost, bonus),
        ),
      bond: (contactId) =>
        spend('other', () => raiseRelationship(captured!.state, captured!.setGameState, contactId)),
      date: (partnerId, type) =>
        spend('other', () =>
          goOnDateAction(captured!.state, captured!.setGameState, partnerId, type, {
            updateMoney: updateMoneyModule,
            updateStats: updateStatsModule,
          }),
        ),
      gift: (partnerId, type) =>
        spend('other', () =>
          giveGiftAction(captured!.state, captured!.setGameState, partnerId, type, {
            updateMoney: updateMoneyModule,
            updateStats: updateStatsModule,
          }),
        ),
      propose: (partnerId, ringId) =>
        spend('other', () =>
          proposeMarriageAction(captured!.state, captured!.setGameState, partnerId, ringId, {
            updateMoney: updateMoneyModule,
            updateStats: updateStatsModule,
          }),
        ),
      meet: () => spend('other', () => meetSomeone(captured!.state, captured!.setGameState)),
    };
    // Journal ids already folded into a row, so each week reports only its own
    // relationship news rather than the running total.
    const seenJournalIds = new Set<string>((captured!.state.journal ?? []).map((e) => e?.id).filter(Boolean) as string[]);

    for (let w = 0; w < weeks; w++) {
      const notes: string[] = [];
      spentBy = {};
      const before = captured!.state;
      const weekIndex = weeksInThisLife(before);
      const cashBeforeActions = before.stats.money;

      await spec.policy({
        state: () => captured!.state,
        week: weekIndex,
        actions,
        note: (t) => notes.push(t),
      });
      await flush();

      const afterActions = captured!.state;
      const spent = Math.round(cashBeforeActions - afterActions.stats.money);
      const cashBeforeTick = afterActions.stats.money;

      await act(async () => {
        await captured!.nextWeek();
        await Promise.resolve();
      });
      await flush();

      const s = captured!.state;
      const { job, level } = jobLabel(s);
      const row: SimRow = {
        week: weeksInThisLife(s),
        cash: Math.round(s.stats.money),
        tickDelta: Math.round(s.stats.money - cashBeforeTick),
        spent,
        netWorth: Math.round(netWorth(s)),
        health: Math.round(s.stats.health),
        happiness: Math.round(s.stats.happiness),
        energy: Math.round(s.stats.energy),
        fitness: Math.round(s.stats.fitness),
        housing: housingLabel(s),
        job,
        level,
        diseases: (s.diseases ?? []).map((d: any) => d?.name ?? d?.id ?? '?'),
        overdue: Math.round(s.overdueBalance ?? 0),
        chapters: [...(s.completedChapters ?? [])],
        notes,
        ...economyColumns(s),
        spentBy,
        ...socialColumns(s),
        socialEvents: socialJournalSince(s, seenJournalIds),
      };
      rows.push(row);
      minHealth = Math.min(minHealth, row.health);
      minHappiness = Math.min(minHappiness, row.happiness);

      if (s.showDeathPopup) {
        died = true;
        deathWeek = row.week;
        deathReason = s.deathReason ?? null;
        break;
      }
    }

    return {
      name: spec.name,
      scenarioId,
      seed,
      rows,
      died,
      deathWeek,
      deathReason,
      finalState: captured!.state,
      minHealth,
      minHappiness,
    };
  } finally {
    act(() => mounted.root.unmount());
    captured = null;
    Math.random = originalRandom;
  }
}

/**
 * Re-age a seeded life. Moves `weeksLived`, `lifeStartWeek` and `date.age`
 * together, the way `computeWeeksLived` seeds them, so every week-relative gate
 * (grace ramp, chapters, coach) sees a fresh life at that age.
 */
export function withStartingAge(state: GameState, age: number): GameState {
  const weeksLived = Math.max(0, Math.round((age - 18) * 52));
  return {
    ...state,
    weeksLived,
    lifeStartWeek: weeksLived,
    date: { ...state.date, age },
  };
}

/** Format a run as a fixed-width table for the soak's stdout. */
export function formatRun(r: SimResult): string {
  const lines: string[] = [];
  lines.push(`--- ${r.name} · ${r.scenarioId} · seed ${r.seed} · ${r.died ? `DIED week ${r.deathWeek} (${r.deathReason})` : 'alive'} · min hp ${r.minHealth} / min hap ${r.minHappiness}`);
  lines.push('wk |  cash | tick | spent | hp | ha | en | fi | housing     | job/lvl        | notes');
  for (const row of r.rows) {
    lines.push(
      `${String(row.week).padStart(2)} | ${String(row.cash).padStart(5)} | ${String(row.tickDelta).padStart(4)} | ${String(row.spent).padStart(5)} | ${String(row.health).padStart(2)} | ${String(row.happiness).padStart(2)} | ${String(row.energy).padStart(2)} | ${String(row.fitness).padStart(2)} | ${row.housing.padEnd(11)} | ${`${row.job}/${row.level}`.padEnd(14)} | ${[...row.notes, ...(row.diseases.length ? [`sick: ${row.diseases.join(',')}`] : [])].join('; ')}`,
    );
  }
  return lines.join('\n');
}

// ── Policy building blocks ────────────────────────────────────────────────

/** Apply to the first eligible opening on the real job board. */
export async function takeFirstJob(ctx: SimWeekContext, prefer?: string[]): Promise<boolean> {
  const s = ctx.state();
  if (s.currentJob || (s.careers ?? []).some((c) => c.applied && !c.accepted)) return false;
  const board = getJobBoard(s);
  const eligible = board.filter((o) => o.verdict.eligible);
  const pick =
    (prefer ?? []).map((id) => eligible.find((o) => o.careerId === id)).find(Boolean) ?? eligible[0];
  if (!pick) return false;
  const r = await ctx.actions.applyForJob(pick.careerId);
  ctx.note(`apply ${pick.careerId}${r?.success ? '' : ` (${r?.message ?? 'refused'})`}`);
  return !!r?.success;
}

/** Take the promotion if the real gate says it is open. */
export async function promoteIfReady(ctx: SimWeekContext): Promise<boolean> {
  const s = ctx.state();
  if (!s.currentJob) return false;
  const career = (s.careers ?? []).find((c) => c.id === s.currentJob);
  const elig = getPromotionEligibility(career, s.weeksLived);
  if (!elig.eligible) return false;
  const r = await ctx.actions.promoteCareer(s.currentJob);
  if (r?.success) ctx.note('promoted');
  return !!r?.success;
}

/** Perform a free health activity up to `times`, stopping when the game refuses. */
export async function doFree(
  ctx: SimWeekContext,
  activityId: 'walk' | 'meditation',
  times: number,
): Promise<number> {
  let done = 0;
  let refused = '';
  for (let i = 0; i < times; i++) {
    const before = ctx.state().stats;
    const r = await ctx.actions.performHealthActivity(activityId);
    const after = ctx.state().stats;
    const changed = after.happiness !== before.happiness || after.health !== before.health || after.energy !== before.energy;
    if (!changed) {
      refused = r?.message ?? 'no change';
      break;
    }
    done++;
  }
  if (done) ctx.note(`${activityId}×${done}`);
  else if (refused) ctx.note(`${activityId} refused: ${refused.slice(0, 40)}`);
  return done;
}

export async function rentIfPossible(ctx: SimWeekContext, tierId: string): Promise<boolean> {
  const s = ctx.state();
  if (s.rental?.tierId === tierId) return false;
  const r = await ctx.actions.rentHome(tierId);
  ctx.note(r?.success ? `rent ${tierId}` : `rent ${tierId} refused: ${r?.message ?? ''}`);
  return !!r?.success;
}

/** Answer every waiting decision with its first choice - what a player who opens the inbox does. */
export async function answerPendingEvents(ctx: SimWeekContext): Promise<number> {
  let answered = 0;
  const titles: string[] = [];
  // One tap per popup: an event that is still pending after its answer is a
  // game defect to report, not something a player can tap twenty times a week.
  const tapped = new Set<string>();
  for (let guard = 0; guard < 20; guard++) {
    const s = ctx.state();
    const next = (s.pendingEvents ?? []).find(
      (e: any) => Array.isArray(e?.choices) && e.choices.length > 0 && !tapped.has(e.id),
    );
    if (!next) break;
    tapped.add(next.id);
    await ctx.actions.resolveEvent(next.id, next.choices[0].id);
    answered++;
    titles.push(String(next.id ?? '?').slice(0, 24));
  }
  if (answered) ctx.note(`answered×${answered} [${titles.slice(0, 3).join(', ')}${titles.length > 3 ? ', …' : ''}]`);
  return answered;
}

/**
 * Answer a pending life moment by clearing it (the modal applies the choice's
 * small stat/karma effects; the cadence question is only whether the NEXT
 * moment can arrive, which `pendingMoment` gates).
 */
export async function answerLifeMoment(ctx: SimWeekContext): Promise<boolean> {
  const s = ctx.state();
  if (!s.lifeMoments?.pendingMoment) return false;
  await ctx.actions.setState((prev) => ({
    ...prev,
    lifeMoments: prev.lifeMoments ? { ...prev.lifeMoments, pendingMoment: undefined } : prev.lifeMoments,
  }));
  ctx.note('moment answered');
  return true;
}

// ── Social policy building blocks (Program 11) ────────────────────────────

/**
 * Try to meet somebody on Spark, the way the app is used: swipe right on the
 * first profile not already matched, up to `swipes` times, and stop the moment
 * the game refuses (out of swipes, app locked, no profiles left).
 *
 * Returns the number of MATCHES produced, not swipes spent — "did anyone enter
 * my life this week" is the measurement, and it is what a player is counting.
 */
export async function swipeForMatches(ctx: SimWeekContext, swipes = 10): Promise<number> {
  const before = (ctx.state().sparkApp?.matches ?? []).length;
  let refused = '';
  for (let i = 0; i < swipes; i++) {
    const s = ctx.state();
    const matched = new Set((s.sparkApp?.matches ?? []).map((m) => m.profileId));
    const swiped = new Set(
      (s.sparkApp?.swipes ?? []).map((h) => h?.profileId).filter(Boolean) as string[],
    );
    const next = DATING_PROFILES.find((p) => !matched.has(p.id) && !swiped.has(p.id));
    if (!next) {
      refused = 'no profiles left';
      break;
    }
    const r = await ctx.actions.swipe(next.id, 'right');
    if (r && r.success === false) {
      refused = r.message ?? 'refused';
      break;
    }
  }
  const gained = (ctx.state().sparkApp?.matches ?? []).length - before;
  if (gained > 0) ctx.note(`matched×${gained}`);
  else if (refused) ctx.note(`swipe: ${refused.slice(0, 40)}`);
  return gained;
}

/**
 * Say hello to whoever the Contacts app is offering this week.
 *
 * The tier-1 door (`lib/social/meetPeople.ts`). A no-op on the weeks when
 * nobody is around, which is most of them — so calling it every week is what a
 * player who opens Contacts regularly does, not a grind.
 */
export async function meetIfOffered(ctx: SimWeekContext): Promise<boolean> {
  const r = await ctx.actions.meet();
  if (r?.success) ctx.note(`met: ${r.message?.replace('You got talking to ', '') ?? ''}`);
  return !!r?.success;
}

/** Promote every unpromoted Spark match into a friend. */
export async function befriendMatches(ctx: SimWeekContext, max = 3): Promise<number> {
  let made = 0;
  for (let i = 0; i < max; i++) {
    const pending = (ctx.state().sparkApp?.matches ?? []).find((m) => !m.promoted);
    if (!pending) break;
    const r = await ctx.actions.promoteFriend(pending.id);
    if (!r?.success) {
      ctx.note(`befriend refused: ${(r?.message ?? '').slice(0, 40)}`);
      break;
    }
    made++;
  }
  if (made) ctx.note(`befriended×${made}`);
  return made;
}

/**
 * Keep in touch with everyone the player knows: Call (free) then Hang Out ($30)
 * where affordable. Both are once-per-week per contact by the real action's own
 * gate, so this is exactly the maintenance loop the Contacts app offers.
 */
export async function keepInTouch(ctx: SimWeekContext, opts: { hangOut?: boolean; budget?: number } = {}): Promise<number> {
  const hangOut = opts.hangOut ?? true;
  let budget = opts.budget ?? Number.POSITIVE_INFINITY;
  let touched = 0;
  const ids = (ctx.state().relationships ?? []).filter(Boolean).map((r) => r.id);
  for (const id of ids) {
    const call = await ctx.actions.contactInteract(id, 'call', 0, 3);
    if (call?.success) touched++;
    if (hangOut && budget >= 30 && (ctx.state().stats?.money ?? 0) >= 30) {
      const hang = await ctx.actions.contactInteract(id, 'hangout', 30, 5);
      if (hang?.success) budget -= 30;
    }
  }
  if (touched) ctx.note(`kept in touch×${touched}`);
  return touched;
}

/**
 * Play the Spark chat toward a relationship: the best move the gate says is
 * available, cheapest venue when one is required. One move per match per week —
 * a thumb opening a chat once.
 */
export async function courtMatches(ctx: SimWeekContext, max = 2): Promise<number> {
  const order: SparkConversationOptionId[] = [
    'go_steady',
    'ask_date',
    'flirt',
    'joke',
    'compliment',
    'ask_interests',
    'break_ice',
  ];
  let played = 0;
  const matches = (ctx.state().sparkApp?.matches ?? []).slice(0, max);
  for (const m of matches) {
    const view = getSparkConversationView(ctx.state(), m.id);
    if (!view) continue;
    const pick = order
      .map((id) => view.options.find((o) => o.option.id === id))
      .find((o) => o?.available);
    if (!pick) continue;
    const r = await ctx.actions.converse(
      m.id,
      pick.option.id,
      pick.option.requiresVenue ? 'coffee' : undefined,
    );
    if (r?.success) {
      played++;
      ctx.note(`spark:${pick.option.id}`);
    }
  }
  return played;
}

/** The partner-only loop the Contacts date sheet offers, at a chosen tier. */
export async function courtPartner(ctx: SimWeekContext, tier: DateType = 'chat'): Promise<boolean> {
  const partner = (ctx.state().relationships ?? []).find(
    (r) => r?.type === 'partner' || r?.type === 'spouse',
  );
  if (!partner) return false;
  const r = await ctx.actions.date(partner.id, tier);
  if (r?.success) ctx.note(`date:${tier}`);
  return !!r?.success;
}

/**
 * Format a run as a SOCIAL table: one line per sampled week with who is in the
 * life, how strong the bonds are, and the relationship news the tick raised.
 */
export function formatSocialRun(r: SimResult, every = 5): string {
  const lines: string[] = [];
  lines.push(
    `--- ${r.name} · ${r.scenarioId} · seed ${r.seed} · ${r.died ? `DIED week ${r.deathWeek} (${r.deathReason})` : `alive at week ${r.rows[r.rows.length - 1]?.week ?? 0}`}`,
  );
  lines.push(
    ' wk | T | chosen | frnd | strng | romance | kids | match | avgBond | ha | notes / social news',
  );
  for (const row of r.rows) {
    const newsy = row.socialEvents.length > 0 || row.notes.length > 0;
    const sampled = row.week % every === 0 || row.week <= 2 || newsy;
    if (!sampled) continue;
    lines.push(
      `${String(row.week).padStart(3)} | ${row.tier} | ${String(row.chosen).padStart(6)} | ${String(row.friends).padStart(4)} | ${String(row.strong).padStart(5)} | ${row.romance.padEnd(7)} | ${String(row.children).padStart(4)} | ${String(row.matches).padStart(5)} | ${String(row.avgBond).padStart(7)} | ${String(row.happiness).padStart(2)} | ${[...row.notes, ...row.socialEvents.map((e) => `NEWS ${e}`)].join('; ').slice(0, 90)}`,
    );
  }
  return lines.join('\n');
}

/**
 * Format a run as an ECONOMY table: one line per sampled week with cash, net
 * worth, income, bills, where the money sits and what the persona did.
 */
export function formatEconomyRun(r: SimResult, every = 10): string {
  const k = (n: number) => {
    const abs = Math.abs(n);
    if (abs >= 1_000_000) return `${(n / 1_000_000).toFixed(2)}M`;
    if (abs >= 10_000) return `${Math.round(n / 1000)}k`;
    return String(Math.round(n));
  };
  const lines: string[] = [];
  lines.push(
    `--- ${r.name} · ${r.scenarioId} · seed ${r.seed} · ${r.died ? `DIED week ${r.deathWeek} (${r.deathReason})` : `alive at week ${r.rows[r.rows.length - 1]?.week ?? 0}`}`,
  );
  lines.push(
    ' wk | age |   cash |  tick |  netW | salary | pass. | bills |  save | invest |  prop |  debt | T | housing         | job/lvl          | edu            | spent                | notes',
  );
  for (const row of r.rows) {
    const sampled = row.week % every === 0 || row.week === r.rows[r.rows.length - 1].week || row.week <= 2;
    if (!sampled) continue;
    const spent = Object.entries(row.spentBy)
      .filter(([, v]) => (v ?? 0) > 0)
      .map(([c, v]) => `${c}:${k(v ?? 0)}`)
      .join(' ');
    lines.push(
      `${String(row.week).padStart(3)} | ${String(row.age).padStart(3)} | ${k(row.cash).padStart(6)} | ${k(row.tickDelta).padStart(5)} | ${k(row.netWorth).padStart(5)} | ${k(row.salary).padStart(6)} | ${k(row.passive).padStart(5)} | ${k(row.expenses).padStart(5)} | ${k(row.savings).padStart(5)} | ${k(row.invested).padStart(6)} | ${k(row.property).padStart(5)} | ${k(row.debt).padStart(5)} | ${row.tier} | ${row.housing.padEnd(15)} | ${`${row.job}/${row.level}`.padEnd(16)} | ${row.education.padEnd(14)} | ${spent.padEnd(20)} | ${row.notes.join('; ').slice(0, 60)}`,
    );
  }
  return lines.join('\n');
}

/** The row at (or just before) a horizon week, for the horizon tables. */
export function rowAt(r: SimResult, week: number): SimRow | undefined {
  let best: SimRow | undefined;
  for (const row of r.rows) {
    if (row.week <= week) best = row;
    else break;
  }
  return best;
}
