/**
 * Save Migration Registry (A-4)
 *
 * Ordered migration functions that transform save state from version N to N+1.
 * Each migration handles renames, restructures, enum remaps, and type changes
 * that `repairGameState()` (which only fills defaults) cannot handle.
 *
 * On load: read `state.version`, run all migrations from `state.version + 1`
 * to `CURRENT_STATE_VERSION` in order, then run `repairGameState()` for remaining defaults.
 */
import { logger } from '@/utils/logger';
import { STATE_VERSION } from '@/contexts/game/initialState';
import { defaultStockFor } from '@/lib/economy/stockMarket';

// Import from initialState.ts to prevent manual sync drift
/**
 * A save written by a NEWER build of the app.
 *
 * Refusing to load it is correct — loading would merge a downgraded shape over
 * `initialGameState` and the next autosave would overwrite the newer save for
 * good. But the refusal used to surface as a bare `null`, the same value an
 * EMPTY slot returns, so the menu told a player holding an intact newer save
 * "No save data found. Please try loading from Save Slots or start a new game."
 * 2026-07-29 audit MR-4.
 */
export class SaveFromFutureError extends Error {
  readonly isSaveFromFuture = true;

  constructor(message = 'This save was made by a newer version of DeepLife.') {
    super(message);
    this.name = 'SaveFromFutureError';
  }
}

/** Duck-typed check — survives the dynamic import boundary and a bundle split. */
export function isSaveFromFutureError(error: unknown): error is SaveFromFutureError {
  return !!error && typeof error === 'object' && (error as { isSaveFromFuture?: unknown }).isSaveFromFuture === true;
}

/** The message to show a player whose save is from a newer build. */
export const SAVE_FROM_FUTURE_MESSAGE =
  'This save was made by a newer version of DeepLife. Update the app to load it. Your save has not been changed.';

export const CURRENT_STATE_VERSION = STATE_VERSION;

/**
 * Migration registry: key is the TARGET version (the version after migration runs).
 * e.g., migration[10] transforms version 9 → 10.
 *
 * Each function receives the raw parsed state object (any) and returns the transformed state.
 * Migrations MUST be idempotent — running them on an already-migrated state should be a no-op.
 */
// H-2 (R8): versions that intentionally bump STATE_VERSION without a structural
// migration. Versions 2–9 predate the v10 "initial production release" baseline
// and never shipped a schema, so a save at those versions simply steps up to
// v10 where the real migration chain begins. Add a version here ONLY when a
// STATE_VERSION bump genuinely needs no migration — otherwise a forgotten
// migration registration will (correctly) halt the chain at load time.
const NO_OP_MIGRATION_VERSIONS = new Set<number>([2, 3, 4, 5, 6, 7, 8, 9]);

const migrations: Record<number, (state: any) => any> = {
  // Version 10: Initial production release — all v10 defaults are handled by repairGameState()
  10: (state) => {
    // No explicit migration needed: repairGameState fills all missing v10 fields with defaults.
    // This entry exists so the migration loop doesn't skip v10 silently.
    return state;
  },

  // Version 11: Engagement & addiction systems (play streak, lucky bonus, legacy points, etc.)
  11: (state) => {
    // Play streak system
    if (state.playStreak === undefined) {
      state.playStreak = { count: 0, lastPlayTimestamp: 0, longestStreak: 0 };
    }
    // Weekly result — transient, reset each week. Default to undefined (set fresh in advanceToNextWeek).
    // No backfill needed: code uses optional chaining (gameState.weekResult?.luckyBonus).

    // Legacy points (mini-prestige currency)
    if (state.legacyPoints === undefined) {
      state.legacyPoints = 0;
    }
    // Legacy buffs — initialize if missing so code can safely read .activeBuff without crash
    if (state.legacyBuffs === undefined) {
      state.legacyBuffs = undefined; // Explicitly set (no-op but makes intent clear)
    }

    // Life chapters. `activeChapterId` used to be backfilled here too; it was
    // removed because `getCurrentChapter()` DERIVES the active chapter from
    // `completedChapters`, so the stored field had no reader and every load was
    // maintaining it for nobody.
    if (state.completedChapters === undefined) {
      state.completedChapters = [];
    }

    // Career startedWeeksLived — backfill for existing careers
    if (Array.isArray(state.careers)) {
      for (const career of state.careers) {
        if (career.startedWeeksLived === undefined) {
          // Best guess: assume they started at the beginning
          career.startedWeeksLived = 0;
        }
      }
    }

    state.version = 11;
    return state;
  },

  // Version 12: Wave 2 addiction mechanics (secrets, cliffhangers, ribbons, challenges, time machine)
  12: (state) => {
    if (state.discoveredSecrets === undefined) {
      state.discoveredSecrets = [];
    }
    // pendingCliffhanger — transient, no backfill needed (undefined = no pending)
    if (state.ribbonCollection === undefined) {
      state.ribbonCollection = { earned: [], discoveredIds: [] };
    }
    // weeklyChallenge — transient, initialized on next week advance
    if (state.checkpoints === undefined) {
      state.checkpoints = [];
    }
    if (state.timeMachineUsesThisLife === undefined) {
      state.timeMachineUsesThisLife = 0;
    }
    // Event spacing tracker — must exist so event engine can compute intervals
    if (state.lastEventWeeksLived === undefined) {
      state.lastEventWeeksLived = state.weeksLived || 0;
    }
    // Campus event pending state — undefined means no pending event
    if (state.pendingCampusEventEducationId === undefined) {
      state.pendingCampusEventEducationId = undefined;
    }
    // Processed IAP transaction IDs — prevents duplicate purchase fulfillment
    if (state.processedIAPTransactions === undefined) {
      state.processedIAPTransactions = [];
    }
    state.version = 12;
    return state;
  },

  // Version 13: Pulse social platform deep systems (comments, hashtags, scandals,
  // brand inbox, verified pro subscription, notifications, live sessions, lifetime stats).
  // Purely additive — every existing socialMedia field is preserved verbatim.
  13: (state) => {
    if (!state.socialMedia || typeof state.socialMedia !== 'object') {
      state.socialMedia = {
        followers: 0,
        influenceLevel: 'novice',
        totalPosts: 0,
        viralPosts: 0,
        brandPartnerships: 0,
        engagementRate: 0,
      };
    }
    const sm = state.socialMedia;

    // 9 new sub-objects — only assign when undefined (idempotent).
    if (sm.commentThreads === undefined) sm.commentThreads = {};
    if (sm.trendingHashtags === undefined) sm.trendingHashtags = [];
    if (sm.followGraph === undefined) {
      sm.followGraph = {
        followingNpcIds: [],
        followedByNpcIds: [],
        lastUpdatedWeek: state.weeksLived ?? 0,
      };
    }
    if (sm.activeScandal === undefined) sm.activeScandal = null;
    if (sm.scandalHistory === undefined) sm.scandalHistory = [];
    if (sm.brandInbox === undefined) {
      sm.brandInbox = { pending: [], declined: [], history: [] };
    }
    if (sm.verifiedPro === undefined) {
      sm.verifiedPro = {
        active: false,
        perksUnlocked: {
          blueCheckmark: false,
          postBoostMultiplier: 1.0,
          analyticsUnlocked: false,
          noAdsInFeed: false,
          longerPosts: false,
        },
      };
    }
    if (sm.notifications === undefined) sm.notifications = [];
    if (sm.liveSession === undefined) sm.liveSession = null;
    if (sm.pendingBoosts === undefined) sm.pendingBoosts = [];
    if (sm.lastViralBoostBySkill === undefined) sm.lastViralBoostBySkill = {};

    // Upgrade legacy activeBrandDeals[] with new optional fields. Never strip
    // existing fields — only add defaults for missing ones.
    if (Array.isArray(sm.activeBrandDeals)) {
      sm.activeBrandDeals = sm.activeBrandDeals.map((d: any) => ({
        ...d,
        postsRequired: d.postsRequired ?? 1,
        postsDelivered: d.postsDelivered ?? 0,
        weeklyPayment:
          d.weeklyPayment ?? Math.floor((d.payment ?? 0) / Math.max(1, d.expiresIn ?? 4)),
        category: d.category ?? 'lifestyle',
        riskOfBreach: d.riskOfBreach ?? 0,
      }));
    }

    // Lifetime stats — seed peakFollowers from current followers if missing
    // so existing players keep credit for what they've already achieved.
    if (sm.lifetimeStats === undefined) {
      sm.lifetimeStats = {
        peakFollowers: sm.followers ?? 0,
        peakInfluenceLevel: sm.influenceLevel ?? 'novice',
        totalScandalsSurvived: 0,
        totalBrandDealsCompleted: sm.brandPartnerships ?? 0,
        totalGemsBoostsUsed: 0,
        totalVerifiedProWeeks: 0,
      };
    }

    state.version = 13;
    return state;
  },

  // Version 14: Banking system remake (AdvancedBankApp).
  // Introduces gameState.banking with multi-account, credit score, credit cards,
  // bill-pay automation, savings goals, and budget tracking. Legacy bankSavings/loans
  // remain on the state for backward compatibility — banking.accounts mirrors them.
  14: (state) => {
    if (!state.banking || typeof state.banking !== 'object') {
      const openedWeek = typeof state.weeksLived === 'number' ? state.weeksLived : 0;
      const legacySavings = typeof state.bankSavings === 'number' && isFinite(state.bankSavings)
        ? Math.max(0, state.bankSavings)
        : 0;

      state.banking = {
        accounts: [
          {
            id: 'checking-default',
            type: 'checking',
            name: 'Everyday Checking',
            balance: 0,
            baseAPR: 0,
            openedWeek,
          },
          {
            id: 'savings-default',
            type: 'savings',
            name: 'Savings',
            // Carry over the player's existing savings balance verbatim.
            balance: legacySavings,
            baseAPR: 0.02,
            openedWeek,
          },
        ],
        creditCards: [],
        billPayRules: [],
        budgetSpend: [],
        creditScore: {
          // Start mid-Fair. Lifetime stats can lift it quickly once the engine runs.
          score: 650,
          band: 'fair',
          componentBreakdown: {
            paymentHistory: 70,
            utilization: 60,
            accountAge: 0,
            creditMix: 30,
            inquiries: 100,
          },
          lastUpdatedWeek: openedWeek,
          history: [],
          inquiries: [],
        },
        savingsGoals: [],
        totalLateFeesPaid: 0,
        totalInterestEarned: 0,
        totalInterestPaid: 0,
        taxDueThisYear: 0,
      };
    }

    // Backfill new optional Loan tracking fields so credit score has data to work with.
    if (Array.isArray(state.loans)) {
      for (const loan of state.loans) {
        if (loan.onTimePayments === undefined) loan.onTimePayments = 0;
        if (loan.latePayments === undefined) loan.latePayments = 0;
        if (loan.originalAPR === undefined && typeof loan.rateAPR === 'number') {
          loan.originalAPR = loan.rateAPR;
        }
      }
    }

    state.version = 14;
    return state;
  },

  // Version 15: Spark dating platform — adds gameState.sparkApp owning swipes,
  // matches, chat messages, premium subscription, catfishing records, jealousy
  // events. Purely additive: existing relationships[] / family.spouse remain
  // the source of truth for promoted matches.
  15: (state) => {
    if (!state.sparkApp || typeof state.sparkApp !== 'object') {
      state.sparkApp = {};
    }
    const s = state.sparkApp;

    if (!s.profile || typeof s.profile !== 'object') {
      s.profile = {
        bio: '',
        photos: [],
        interests: [],
        showAge: true,
        showJob: true,
        showWealth: false,
      };
    }
    if (!Array.isArray(s.swipes)) s.swipes = [];
    if (!Array.isArray(s.matches)) s.matches = [];
    if (!s.messages || typeof s.messages !== 'object') s.messages = {};
    if (typeof s.swipeQuota !== 'number') s.swipeQuota = 30;
    if (typeof s.swipesUsedThisWeek !== 'number') s.swipesUsedThisWeek = 0;
    if (typeof s.lastQuotaResetWeek !== 'number') {
      s.lastQuotaResetWeek = state.weeksLived ?? 0;
    }
    if (typeof s.superLikesUsedThisWeek !== 'number') s.superLikesUsedThisWeek = 0;

    if (!s.premium || typeof s.premium !== 'object') {
      s.premium = {
        active: false,
        tier: 'free',
        perks: {
          unlimitedSwipes: false,
          seeWhoLikedYou: false,
          rewindLastSwipe: false,
          boostMultiplier: 1.0,
          superLikesPerDay: 1,
          verifiedBadge: false,
          travelMode: false,
        },
      };
    }

    if (!Array.isArray(s.likedYou)) s.likedYou = [];
    if (!Array.isArray(s.catfishRecords)) s.catfishRecords = [];
    if (s.activeJealousy === undefined) s.activeJealousy = null;
    if (!Array.isArray(s.jealousyHistory)) s.jealousyHistory = [];
    if (s.boost === undefined) s.boost = null;
    if (!Array.isArray(s.dismissedCatfishIds)) s.dismissedCatfishIds = [];
    if (!Array.isArray(s.reportedIds)) s.reportedIds = [];

    // P2-3: deep-merge so a PARTIAL lifetimeStats (older/tampered saves missing some
    // counters) gets the absent fields backfilled — not just the wholly-missing case.
    const existingLifetimeStats =
      s.lifetimeStats && typeof s.lifetimeStats === 'object' ? s.lifetimeStats : {};
    s.lifetimeStats = {
      totalSwipes: 0,
      totalMatches: 0,
      totalSuperLikes: 0,
      totalDatesGoneOn: 0,
      totalGiftsGiven: 0,
      totalProposals: 0,
      totalMarriages: 0,
      totalDivorces: 0,
      totalCatfishExposed: 0,
      totalJealousyEvents: 0,
      peakPremiumTier: 'free',
      totalPremiumWeeks: 0,
      ...existingLifetimeStats,
    };

    state.version = 15;
    return state;
  },

  // Version 16: BitcoinMiningApp remake — adds gameState.cryptoMarket with
  // per-coin regimes, order book parameters, DCA rules, cost basis, and tax
  // tracking. Legacy `cryptos[].price` remains the authoritative spot price;
  // `cryptoMarket.coinMarkets[id]` adds regime + history + spread.
  16: (state) => {
    if (!state.cryptoMarket || typeof state.cryptoMarket !== 'object') {
      const w = typeof state.weeksLived === 'number' ? state.weeksLived : 0;
      const coinMarkets: Record<string, any> = {};
      const costBasis: Record<string, any> = {};
      const cryptos = Array.isArray(state.cryptos) ? state.cryptos : [];
      for (const c of cryptos) {
        if (!c || !c.id) continue;
        const price = typeof c.price === 'number' && isFinite(c.price) && c.price > 0 ? c.price : 1;
        coinMarkets[c.id] = {
          cryptoId: c.id,
          regime: 'stable',
          regimeWeeksRemaining: 16,
          priceHistory: [{ weeksLived: w, price }],
          bidAskSpread: 0.002,
        };
        // Seed cost basis from existing owned holdings at current price.
        const owned = typeof c.owned === 'number' && isFinite(c.owned) ? Math.max(0, c.owned) : 0;
        if (owned > 0) {
          costBasis[c.id] = { totalCost: owned * price, totalShares: owned };
        }
      }
      state.cryptoMarket = {
        coinMarkets,
        openOrders: [],
        orderHistory: [],
        dcaRules: [],
        costBasis,
        realizedGainsThisYear: 0,
        totalRealizedGains: 0,
      };
    }
    state.version = 16;
    return state;
  },

  // Version 17: Hustle business app overlay. Adds gameState.hustleApp keyed by
  // companyId for campaigns, scandals, hiring pipeline, board, IPO, M&A.
  // Existing companies[] / company.ts / CompanyActions remain canonical for
  // revenue, employees, upgrades, R&D — Hustle is purely additive.
  17: (state) => {
    if (!state.hustleApp || typeof state.hustleApp !== 'object') {
      state.hustleApp = {};
    }
    const h = state.hustleApp;
    if (!h.companies || typeof h.companies !== 'object') h.companies = {};
    if (!h.lifetimeStats || typeof h.lifetimeStats !== 'object') {
      h.lifetimeStats = {
        totalCompaniesFounded: Array.isArray(state.companies) ? state.companies.length : 0,
        totalCompaniesSold: 0,
        totalIPOsLaunched: 0,
        totalAcquisitionsCompleted: 0,
        totalScandalsSurvived: 0,
        totalCampaignsRun: 0,
        totalNamedHires: 0,
        totalFires: 0,
        peakBrandScore: 0,
        peakMarketShare: 0,
        peakSharePrice: 0,
      };
    }

    // For existing companies, seed an empty overlay per company so the UI
    // doesn't have to keep null-checking.
    if (Array.isArray(state.companies)) {
      for (const c of state.companies) {
        if (!c || typeof c.id !== 'string') continue;
        if (!h.companies[c.id]) {
          h.companies[c.id] = {
            companyId: c.id,
            hiringPipeline: {
              candidates: [],
              namedHires: [],
              weeksSinceLastHire: 0,
              totalSeverance: 0,
            },
            activeCampaigns: [],
            brand: {
              score: 50,
              trend: 'flat',
              lastUpdatedWeek: state.weeksLived ?? 0,
            },
            activeScandal: null,
            scandalHistory: [],
            boardSeats: [],
            ipo: {
              status: 'private',
              ownershipPercent: 100,
              sharePrice: 0,
              sharesOutstandingK: 0,
              recentEarnings: [],
            },
            pendingAcquisitions: [],
            suppliers: [],
            marketSharePercent: 5, // small fish to start
            notifications: [],
          };
        }
      }
    }

    state.version = 17;
    return state;
  },

  // Version 18: OnionApp / Dark Web remake. Adds gameState.darkWeb with heat,
  // vendors, marketplace listings, multi-stage jobs, laundering chain, and
  // skill tree. Legacy `wantedLevel`, `darkWebItems[]`, `hacks[]` remain on
  // GameState; `darkWeb.heat` is seeded from `wantedLevel` so a player mid-game
  // doesn't start fresh.
  18: (state) => {
    if (!state.darkWeb || typeof state.darkWeb !== 'object') {
      const w = typeof state.weeksLived === 'number' ? state.weeksLived : 0;
      const wantedSeed =
        typeof state.wantedLevel === 'number' && isFinite(state.wantedLevel) && state.wantedLevel > 0
          ? Math.min(100, state.wantedLevel * 10) // legacy wantedLevel 0..10 → heat 0..100
          : 0;

      state.darkWeb = {
        heat: wantedSeed,
        lastHeatDecayWeek: w,
        dirtyBtc: 0,
        cleanBtc: 0,
        playerReputation: 0,
        // reviewCount 0 — same reasoning as initialState: a vendor the player
        // never bought from is marketplace data, not a contact, and non-zero
        // seeds made shadow.eth & co. show in Contacts → Network for players
        // who had never touched the dark web.
        vendors: [
          { id: 'vendor-shadow',   handle: 'shadow.eth',  reputation: 35, reviewCount: 0 },
          { id: 'vendor-zerocool', handle: 'zerocool',    reputation: 65, reviewCount: 0 },
          { id: 'vendor-veil',     handle: 'veil_market', reputation: 80, reviewCount: 0 },
          { id: 'vendor-burner',   handle: 'b4n3_drop',   reputation: 15, reviewCount: 0 },
        ],
        listings: [],
        activeJobs: [],
        jobHistory: [],
        laundering: [],
        skills: {
          hacking:    { level: 1, xp: 0, nextLevelXp: 100 },
          social:     { level: 1, xp: 0, nextLevelXp: 100 },
          opsec:      { level: 1, xp: 0, nextLevelXp: 100 },
          laundering: { level: 1, xp: 0, nextLevelXp: 100 },
        },
        recentEvents: [],
      };
    }
    state.version = 18;
    return state;
  },

  // Version 19: HMAC signing key rotation (R7 SB-1 Path A).
  //
  // No state-schema change in this migration. The bump exists so the loader
  // can identify "saves that were last signed under the OLD HMAC key" and
  // run them through the verification fallback (legacy SAVE_SIGNATURE_KEY
  // path) until the next save persist, at which point the envelope is
  // re-signed with the NEW EXPO_PUBLIC_SAVE_HMAC_KEY automatically.
  //
  // BUILD REQUIREMENT for the release that introduces v19:
  //   - EXPO_PUBLIC_SAVE_HMAC_KEY = <newly rotated key>
  //   - EXPO_PUBLIC_ALLOW_WEAK_SAVE_MIGRATION = true   (one-release escape hatch)
  //   - EXPO_PUBLIC_SAVE_SIGNATURE_KEY        = (unchanged — legacy fallback)
  //
  // The release AFTER this one can drop ALLOW_WEAK_SAVE_MIGRATION (any
  // player who ran the v19 build will have re-signed their save with the
  // new HMAC by then; anyone who skipped it gets a fresh start).
  //
  // See tasks/round7-sb1-path-a-checklist.md for the user-action steps.
  19: (state) => {
    state.version = 19;
    return state;
  },

  // Version 20: Legacy Pass (seasonal battle pass). Adds the `legacyPass` slice.
  // Idempotent — only initializes when missing. The season id is left empty and
  // is reconciled to the current season on first use (ensureCurrentSeason).
  20: (state) => {
    if (!state.legacyPass || typeof state.legacyPass !== 'object') {
      // Covers undefined AND a corrupted/hand-edited `legacyPass: null` that would
      // otherwise throw on the property access below and halt migration.
      state.legacyPass = {
        seasonId: '',
        xp: 0,
        premiumOwned: false,
        claimedFreeTiers: [],
        claimedPremiumTiers: [],
        ownedCosmetics: [],
      };
    } else if (!Array.isArray(state.legacyPass.ownedCosmetics)) {
      // Defensive: a partially-shaped legacyPass from an in-dev build.
      state.legacyPass.ownedCosmetics = [];
    }
    state.version = 20;
    return state;
  },

  // Version 21: Hobby Mastery. Adds the `pursuits` map (per-hobby xp/level) and
  // the `weeklyPursuitPractice` weekly cap counter. Idempotent — only sets when
  // missing. Both are optional and consumers guard with `?? {}`, so this is a
  // pure default-fill.
  21: (state) => {
    if (!state.pursuits || typeof state.pursuits !== 'object') {
      state.pursuits = {};
    }
    if (!state.weeklyPursuitPractice || typeof state.weeklyPursuitPractice !== 'object') {
      state.weeklyPursuitPractice = {};
    }
    state.version = 21;
    return state;
  },

  // Version 22: App Depth Program — Wave A additive batch. A SINGLE migration
  // default-filling every new OPTIONAL field the Wave-A depth features read via
  // `??`, plus the ONE data-preserving change (Pet `ownedToys` → `toys`). Every
  // block only sets a value when it is missing, so this is idempotent and never
  // clobbers a save that already carries v22 data.
  22: (state) => {
    // ── Banking: live rate environment + computer-only budget targets ──────
    if (state.banking && typeof state.banking === 'object') {
      if (!state.banking.rateEnvironment || typeof state.banking.rateEnvironment !== 'object') {
        state.banking.rateEnvironment = { depositMult: 1, loanDelta: 0 };
      }
      if (!state.banking.budgetTargets || typeof state.banking.budgetTargets !== 'object') {
        state.banking.budgetTargets = {};
      }
    }

    // ── Pulse: capped follower history (52) + optional scandal risk score ──
    if (state.socialMedia && typeof state.socialMedia === 'object') {
      if (!Array.isArray(state.socialMedia.followerHistory)) {
        const week = typeof state.weeksLived === 'number' && isFinite(state.weeksLived)
          ? Math.max(0, Math.floor(state.weeksLived)) : 0;
        const followers = typeof state.socialMedia.followers === 'number' && isFinite(state.socialMedia.followers)
          ? state.socialMedia.followers : 0;
        // Anchor the series with the current-followers point so charts have a datum.
        state.socialMedia.followerHistory = [{ week, followers }];
      } else if (state.socialMedia.followerHistory.length > 52) {
        // Enforce the cap on any pre-seeded series.
        state.socialMedia.followerHistory = state.socialMedia.followerHistory.slice(-52);
      }
      if (typeof state.socialMedia.scandalRiskScore !== 'number' || !isFinite(state.socialMedia.scandalRiskScore)) {
        state.socialMedia.scandalRiskScore = 0;
      }
    }

    // ── YouVideo + Streamly (shared gamingStreaming slice): creator perks,
    //    memberships payout stamp, streamly hype streak ────────────────────
    if (state.gamingStreaming && typeof state.gamingStreaming === 'object') {
      if (typeof state.gamingStreaming.perkTier !== 'number' || !isFinite(state.gamingStreaming.perkTier)) {
        state.gamingStreaming.perkTier = 0;
      }
      if (typeof state.gamingStreaming.lastMemberWeek !== 'number' || !isFinite(state.gamingStreaming.lastMemberWeek)) {
        state.gamingStreaming.lastMemberWeek = 0;
      }
      if (typeof state.gamingStreaming.hypeStreak !== 'number' || !isFinite(state.gamingStreaming.hypeStreak)) {
        state.gamingStreaming.hypeStreak = 0;
      }
    }

    // ── Travel: passport milestone tiers ──────────────────────────────────
    if (state.travel && typeof state.travel === 'object') {
      if (!Array.isArray(state.travel.passportMilestones)) {
        state.travel.passportMilestones = [];
      }
    }

    // ── Real estate: capped portfolio activity timeline (top-level slice) ──
    if (!Array.isArray(state.realEstateActivity)) {
      state.realEstateActivity = [];
    } else if (state.realEstateActivity.length > 40) {
      state.realEstateActivity = state.realEstateActivity.slice(-40);
    }

    // ── Pet: DATA-PRESERVING collapse of `ownedToys` → `toys` ─────────────
    // Union the two arrays (dedupe), write the result into `toys`, and empty
    // `ownedToys` so the data now lives in the single canonical field. Never
    // drops a toy.
    if (Array.isArray(state.pets)) {
      state.pets = state.pets.map((pet: any) => {
        if (!pet || typeof pet !== 'object') return pet;
        const toys = Array.isArray(pet.toys) ? pet.toys : [];
        const owned = Array.isArray(pet.ownedToys) ? pet.ownedToys : [];
        if (owned.length === 0 && Array.isArray(pet.toys)) return pet; // nothing to merge
        const merged = Array.from(new Set([...toys, ...owned]));
        return { ...pet, toys: merged, ownedToys: [] };
      });
    }

    state.version = 22;
    return state;
  },

  // Version 23: schema-drift backfill. Three OPTIONAL fields were added to
  // `initialState` (Luxury & Collectibles + Life Ambitions, 2026-07-13) AFTER
  // v22 shipped, without their own version bump — so a v22 save loads without
  // them. Every consumer already reads them via `?? []` / `!!`, so this is not
  // an active crash; it closes the invariant (Hard Rule #3: every initialState
  // field is migration- and repair-covered) before any future non-guarded
  // reader lands. Only sets a value when missing — idempotent, never clobbers.
  // `ambitionId` is intentionally omitted: its default is `undefined` (absent =
  // freeform life), so an absent key already equals the default.
  23: (state) => {
    if (!Array.isArray(state.luxuryItems)) {
      state.luxuryItems = [];
    }
    if (!Array.isArray(state.ambitionCompletedMilestones)) {
      state.ambitionCompletedMilestones = [];
    }
    if (typeof state.ambitionRewardClaimed !== 'boolean') {
      state.ambitionRewardClaimed = false;
    }

    state.version = 23;
    return state;
  },

  // Version 24: per-item luxury state (`luxuryHoldings`).
  //
  // `luxuryItems` (a flat id list) stays the ownership source of truth; this
  // adds a SIDECAR record keyed by the same ids so a luxury item can finally
  // carry state — when it was acquired, and for developable items the
  // RealEstate.id the purchase minted.
  //
  // Backfill: every already-owned id gets a holding. `acquiredWeek` is stamped
  // from the save's own `weeksLived` rather than 0, so an island bought in a
  // 300-week life doesn't claim to have been owned since birth.
  24: (state) => {
    if (!state.luxuryHoldings || typeof state.luxuryHoldings !== 'object' || Array.isArray(state.luxuryHoldings)) {
      state.luxuryHoldings = {};
    }
    const ownedIds = Array.isArray(state.luxuryItems) ? state.luxuryItems : [];
    const acquiredWeek = typeof state.weeksLived === 'number' && isFinite(state.weeksLived) && state.weeksLived >= 0
      ? state.weeksLived
      : 0;
    for (const id of ownedIds) {
      if (typeof id !== 'string') continue;
      // Never clobber a holding that already exists — idempotent re-runs.
      if (!state.luxuryHoldings[id]) {
        state.luxuryHoldings[id] = { acquiredWeek };
      }
    }

    state.version = 24;
    return state;
  },

  // Version 25: `hasPilotLicense`. Concrete default (false), so it needs a real
  // backfill rather than an absent-means-default carve-out — `purchaseVehicle`
  // reads it to gate aircraft, and `undefined` would work by accident today but
  // silently break the first time something does a strict comparison.
  25: (state) => {
    if (typeof state.hasPilotLicense !== 'boolean') {
      state.hasPilotLicense = false;
    }

    state.version = 25;
    return state;
  },

  // Version 26: `settings.quickActionWeeks` — the per-game-week marker that gates
  // the HUD long-press quick actions. Its default is `undefined` (an absent key
  // already means "no action used this week"), so per the save-format rule it
  // gets a version bump and NO backfill, and no repairGameState mirror.
  26: (state) => {
    state.version = 26;
    return state;
  },

  // Version 27: `lastLoginRewardAt` — epoch high-water mark for the daily-login
  // gem claim, so a rewound device clock cannot re-arm it. Default is
  // `undefined` (absent = never claimed), so this is another carve-out field:
  // version bump, NO backfill, no repairGameState mirror. Writing a value here
  // would be actively wrong — it would lock an existing player out of their
  // next claim. 2026-07-30 audit ECON-1.
  27: (state) => {
    state.version = 27;
    return state;
  },

  // Version 28: `settings.lastNoFillGrantWeek` — the game-week marker that caps
  // the ad orb's no-fill courtesy reward. It replaces a module-level boolean
  // that reset on every app restart, making the net-worth-scaled grant farmable
  // by force-quitting. Default is `undefined` (absent = never granted), so this
  // is another carve-out field: version bump, NO backfill and no
  // repairGameState mirror. Writing a value would deny an existing player their
  // first legitimate courtesy grant. 2026-07-31 audit round 4, R4-MON-6.
  28: (state) => {
    state.version = 28;
    return state;
  },

  // Version 29: `legacyUpgrades` — the ids bought with legacy points (C-11).
  //
  // `legacyPoints` had accrued since v11 with nothing to spend them on. This
  // adds the purchase record, so an existing save arrives at the new shop with
  // a full balance and nothing bought — which is exactly right, since it never
  // had the chance to buy anything.
  //
  // Concrete stored default (`[]`), so unlike the v26/v27/v28 carve-outs this
  // one takes a REAL backfill and a matching `repairGameState` mirror. An
  // absent key would work by accident today because every reader guards with
  // `Array.isArray`, but the moment one does a bare `.includes` it breaks.
  29: (state) => {
    if (!Array.isArray(state.legacyUpgrades)) {
      state.legacyUpgrades = [];
    }
    state.version = 29;
    return state;
  },

  // Version 30: `revivalPack` — the unspent charge from the $2.99 Revival Pack
  // (MON-5).
  //
  // The field is NOT new. It has been on GameState and in `initialState` since
  // the beginning, defaulting to `false`, read by nothing and written by
  // nothing — a dead field, and a standing instance of exactly the drift Hard
  // Rule #3 exists to catch: a concrete stored default that never shipped a
  // migration. It is registered here now because it has become load-bearing:
  // the IAP grant banks a charge into it and `reviveWithPack` spends one.
  //
  // Functionally a no-op backfill — an absent key is falsy, which already means
  // "no banked revive", and that is the correct answer for every save written
  // before the pack could be banked. It is a REAL migration rather than a
  // member of the intentional-no-op set because the default is concrete
  // (`false`, not `undefined`), so §7 wants the key written and mirrored in
  // `repairGameState`.
  //
  // Deliberately does NOT consult `settings.hasRevivalPack`. That records the
  // PURCHASE and survives prestige; this records the unspent CHARGE. Granting a
  // charge to everyone who ever bought the pack would hand a free life to every
  // player who already had their instant-revive at purchase time.
  30: (state) => {
    if (typeof state.revivalPack !== 'boolean') {
      state.revivalPack = false;
    }
    state.version = 30;
    return state;
  },
  /**
   * v31 — `overdueBalance` (+ `lastLoginRewardWeek`, which is a carve-out).
   *
   * `overdueBalance` is the arrears bucket that replaced the silent forgiveness
   * of unpayable weekly bills (`Math.max(0, …)` on the cash line). Concrete
   * stored default of `0`, so it takes a REAL backfill here and a matching
   * `repairGameState` mirror — a partial save that reaches a consumer with
   * `undefined` would arithmetic its way to NaN and poison `stats.money`.
   *
   * Only-if-missing, so re-running the ladder can never wipe a real debt.
   *
   * `lastLoginRewardWeek` is deliberately NOT written. Its default is
   * `undefined`, an absent key already equals "never claimed", and writing a
   * value would be actively wrong: stamping the current week would deny an
   * existing player their next legitimate daily claim until they played another
   * week. Same reasoning as the v26/v27/v28 carve-outs.
   */
  31: (state) => {
    if (typeof state.overdueBalance !== 'number' || !isFinite(state.overdueBalance)) {
      state.overdueBalance = 0;
    }
    healCollapsedMarket(state);
    state.version = 31;
    return state;
  },
  /**
   * v32 — `rental`, the home the player is renting.
   *
   * Default `undefined`: an absent key already means "not renting", which is the
   * correct state for every existing save. So this is a carve-out — version
   * bumped, NO backfill and no `repairGameState` mirror. Writing a tenancy would
   * be actively wrong: it would start charging rent to a player who never signed
   * for anything.
   *
   * Registered here rather than left as silent drift because it is a NEW field
   * on `initialState`'s type surface, and Hard Rule #3 exists for exactly the
   * case where that goes unrecorded.
   */
  32: (state) => {
    state.version = 32;
    return state;
  },

  // Version 33: `legacyContracts` — the claimed-id record for Legacy Contracts,
  // the multi-life goals that pay Legacy Points into the Dynasty Tree.
  //
  // Concrete stored default (`{ claimedIds: [] }`), so unlike the v26/v27/v28
  // and v32 carve-outs this takes a REAL backfill and a `repairGameState`
  // mirror. An absent key genuinely means "nothing claimed yet", which is the
  // correct answer for every save written before contracts existed — and the
  // only safe one, since inventing a claim would silently deny the player the
  // points for a contract they have already earned.
  //
  // Note what is NOT stored: progress. Every contract metric is read from
  // values the save already tracks and that only ever increase, so an existing
  // save loads with its contracts already part-complete — a 12-generation
  // dynasty gets credit for the work it did before this shipped.
  33: (state) => {
    const existing = state.legacyContracts as { claimedIds?: unknown } | undefined;
    if (!existing || typeof existing !== 'object' || !Array.isArray(existing.claimedIds)) {
      state.legacyContracts = { claimedIds: [] };
    }
    state.version = 33;
    return state;
  },

  // Version 34: `grandchildren` on ChildInfo — lightweight records one
  // generation below the player's children.
  //
  // Default `undefined`, so this is a CARVE-OUT in the v26/v27/v28/v32 mould:
  // version bumped, NO backfill and no `repairGameState` mirror. An absent key
  // already means "no grandchildren", and writing an empty array onto every
  // child of every existing save would churn the whole family tree for no
  // behavioural gain. Births are derived by the weekly tick from that point on.
  34: (state) => {
    state.version = 34;
    return state;
  },

  // Version 35: `settings.lastAdCashGrantWeek` — the game-week marker capping
  // rewarded-ad CASH grants to one per game week.
  //
  // The orb's only limiter was a wall-clock respawn timer, decoupled from
  // `weeksLived` entirely, so the 1.5%-of-net-worth reward compounded on REAL
  // time — doubling net worth roughly every 2.2 hours of play, invisibly to the
  // tax brackets and the net-worth soft cap.
  //
  // Default `undefined`, so this is a CARVE-OUT: version bumped, NO backfill
  // and no `repairGameState` mirror. Same reasoning as v28's
  // `lastNoFillGrantWeek` and v31's `lastLoginRewardWeek` — stamping a week
  // would deny an existing player their next legitimate claim.
  35: (state) => {
    state.version = 35;
    return state;
  },

  // Version 36: `dynasty` — the bookkeeping behind prestige tiers 2–5 (the
  // Vault, the Endowment, Dynasty Trials, the Dynasty Seat).
  //
  // ONE optional object rather than four top-level keys, so four new systems
  // cost one carve-out instead of four backfills and four repair mirrors.
  //
  // Default `undefined`, so this is a CARVE-OUT in the v26/v27/v28/v32/v34/v35
  // mould: version bumped, NO backfill and no `repairGameState` mirror. An
  // absent key already means precisely the right thing for every save written
  // before this — empty vault, nothing endowed, no Trial sworn or running, no
  // Seat wings — and writing `{}` onto every save would churn every slot to say
  // what absence already says. Each sub-field is read through
  // `lib/dynasty/state.ts`, which degrades a missing or malformed shape to the
  // empty answer rather than throwing.
  //
  // Nothing here can be invented safely either: stamping a vault item, a taken
  // tranche or an active Trial onto an existing save would hand out (or charge
  // for) something the player never chose.
  36: (state) => {
    state.version = 36;
    return state;
  },

  // Version 37: `mail` — the game's paper trail (payslips, statements,
  // invoices, receipts) and the phishing channel that rides on it.
  //
  // Default `undefined`, so this is a CARVE-OUT in the v26/v27/v28/v32/v34/v36
  // mould: version bumped, NO backfill and no `repairGameState` mirror.
  //
  // The absence is not just harmless here, it is the only honest state. An
  // empty inbox is exactly what a save that has never had mail should show, and
  // the alternative — seeding one — would have to invent the documents to put
  // in it: payslips for weeks already lived, statements for balances that have
  // since moved, receipts for purchases that never happened. Every one of those
  // would be a number the player could check and find wrong, which is worse
  // than an empty mailbox that fills from the next tick onward.
  //
  // Nor can the fraud half be backfilled: a scam message is an unresolved
  // decision, and writing one onto an existing save would present the player
  // with a choice about money they earned before the feature existed.
  //
  // Every read goes through `lib/mail/state.ts`, which degrades a missing or
  // malformed shape to the empty inbox rather than throwing inside the week
  // loop.
  37: (state) => {
    state.version = 37;
    return state;
  },

  // Version 38: `gameMode`. The field is RETIRED — story mode was removed after
  // playtesting and nothing reads or writes it any more.
  //
  // The bump stays, and that is deliberate. A TestFlight build shipped with
  // story mode, so saves carrying `version: 38` exist on real devices. Dropping
  // back to 37 would make every one of them take the "save is newer than the
  // app" branch below on load. Keeping 38 as an intentional no-op costs nothing
  // and keeps those saves loading silently.
  //
  // It was a carve-out when it landed (default `undefined`, no backfill, no
  // `repairGameState` mirror), which is why retiring it needs no unwind: there
  // is no written value anywhere to clean up.
  38: (state) => {
    state.version = 38;
    return state;
  },

  // Version 39: `userProfile.avatar` — the encoded `AvatarConfig` behind the
  // rebuilt character creator (`lib/avatar/`). Faces are now assembled from
  // authored vector geometry rather than picked from a pool of pre-rendered
  // portraits, so a character's appearance is a set of parameters that ages
  // with them instead of a PNG that gets swapped for a different person's face
  // at every age band.
  //
  // Default `undefined`, so this is a CARVE-OUT: version bumped, NO backfill
  // and no `repairGameState` mirror. Two independent reasons, either of which
  // is sufficient:
  //
  //   1. Absence already resolves correctly. `resolveAvatar`
  //      (`lib/avatar/resolve.ts`) derives a face deterministically from the
  //      character's name and their legacy `avatarId`, so an existing save
  //      loads with a stable face that reflects the portrait they had picked —
  //      and the same one on every subsequent load.
  //
  //   2. Writing a value would be actively harmful. A stored config is a set
  //      of INDICES into the catalogs in `lib/avatar/style.ts`. Stamping
  //      today's indices into every save would freeze this catalog order into
  //      them permanently, and appending a single hair style later would then
  //      silently re-roll the face of every character that had been stamped.
  //      Deriving on read has no such coupling.
  //
  // `avatarId` is deliberately left in place rather than translated. It still
  // carries the player's original pick, which is exactly what seeds the
  // derived face — rewriting it would lose that.
  39: (state) => {
    state.version = 39;
    return state;
  },

  // Version 40: `settings.deepLifePlusLastGemClaimWeek` — the `weeksLived` marker
  // that gates the FREE-tier daily-gem faucet (`SubscriptionActions.claimDailyGems`,
  // surfaced by `DailyGemClaim`). The faucet was gated only on the UTC day-key and
  // an epoch high-water mark, both of which only refuse a REWOUND clock; advancing
  // the device date a day at a time farmed gems (20/day) with no play. This closes
  // it the same way the sibling login faucet was closed (`lastLoginRewardWeek`,
  // v31): `weeksLived` is the one clock a scrubber cannot move. The DeepLife+ member
  // drop (250/day) keeps its deliberate day-key grace and is intentionally NOT
  // gated here — a paid-retention decision left to the owner.
  //
  // Default `undefined`, so this is a CARVE-OUT: version bumped, NO backfill and no
  // `repairGameState` mirror. An absent key means "never claimed via the week
  // gate", which is the only safe value — stamping the current week onto an
  // existing save would deny the player their next legitimate claim (exactly the
  // reasoning behind the v28 `lastNoFillGrantWeek` carve-out). The key still has to
  // survive the load round-trip, which `loadedStateMerge` now guarantees by keeping
  // the saved object's own keys.
  40: (state) => {
    state.version = 40;
    return state;
  },

  // Version 41: `tuitionWaiverUSD` — an unspent tuition credit, granted by the
  // poverty-recovery scholarship event and consumed at the next enrolment.
  //
  // The event (`scholarship_opportunity`) had been unreachable for its whole
  // life: its condition reads `weeksInPoverty >= 12` and nothing wrote that
  // field. Making it fire exposed the other half — its `grant_free_education`
  // effect granted +10 reputation while the choice text says "Accept the
  // scholarship (Free education!)". This is the field that makes the promise
  // real.
  //
  // A CREDIT, not cash: the event fires for a player under $500 and programmes
  // cost $12k-$180k, so paying it out as money would be a life-changing
  // injection from one random event, and it is not what the event promises
  // anyway.
  //
  // Default `undefined`, so a CARVE-OUT: version bumped, NO backfill and no
  // `repairGameState` mirror. Absent already means "no credit", and writing a
  // value would hand every existing save a scholarship nobody earned — the
  // mirror image of the v27/v28 reasoning, where stamping a value would have
  // DENIED something instead.
  41: (state) => {
    state.version = 41;
    return state;
  },

  // Version 42: `title` on `CareerHistoryEntry` — the job title as of the most
  // recent paid week, stamped by the weekly tick.
  //
  // The obituary derived a title from the LIVE career record, and the political
  // exit deliberately resets `careers.political.level` to 0 (so lifestyle costs
  // and the "in office?" UI stop treating a voted-out player as a sitting
  // official). A president who left office was therefore eulogised as whatever
  // level 0 is called. Recording the title while it is true, rather than
  // reconstructing it later, makes the history independent of anything an exit
  // path does to `careers` — including exit paths that do not exist yet.
  //
  // Default `undefined`, so a CARVE-OUT: version bumped, NO backfill and no
  // `repairGameState` mirror. Entries written before this have no title and
  // cannot grow one — the week they were worked is gone — and readers already
  // fall back to deriving from `careers`, which is correct for every career
  // except the political one. Inventing a title would put words in a dead
  // character's obituary.
  42: (state) => {
    state.version = 42;
    return state;
  },

  // Version 43: `lifeStartWeek` — `weeksLived` at the moment a life began.
  //
  // `weeksLived` is absolute and seeded from the starting age, so an age-20
  // character starts at 104. Every "have I played N weeks yet" check against
  // the raw counter was therefore true before the first frame — which made
  // Chapter 1's "Survive 4 Weeks" complete on week 1 and paid its reward for
  // nothing. The same trap had already retired the first-session coach before
  // it rendered.
  //
  // Default `undefined`, so a CARVE-OUT: version bumped, NO backfill and no
  // `repairGameState` mirror. A save written before this has no record of when
  // its life began and cannot grow one — the week is gone — so readers fall
  // back to 0, which is exactly the behaviour those saves have today. Writing
  // a value would be a guess, and guessing high would silently un-complete a
  // goal an existing player has already been paid for.
  43: (state) => {
    state.version = 43;
    return state;
  },

  // Version 44: `settings.lastWelcomeBackWeek` — the game-week marker capping
  // the welcome-back cash bonus to one per game week.
  //
  // The bonus (`0.5 × weekly salary × min(daysAway, 7)`, floor $100) was gated
  // purely on `Date.now() - lastLogin`. That refuses a REWOUND clock and
  // nothing else, so scrubbing the device date FORWARD a week at a time paid
  // 3.5 weeks of salary per scrub with zero game weeks played — past the tax
  // brackets, past the net-worth soft cap and outside the weekly tick
  // entirely. `weeksLived` only advances by playing, which is the same fix as
  // v28's `lastNoFillGrantWeek`, v31's `lastLoginRewardWeek`, v35's
  // `lastAdCashGrantWeek` and v40's `deepLifePlusLastGemClaimWeek`.
  //
  // Default `undefined`, so this is a CARVE-OUT: version bumped, NO backfill
  // and no `repairGameState` mirror. An absent key already means "no bonus
  // claimed in the current week", and stamping the current week onto an
  // existing save would deny that player their next legitimate bonus.
  44: (state) => {
    state.version = 44;
    return state;
  },

  // Version 45: `rapport` and `conversationCooldowns` on `SparkMatch` — the
  // per-match state behind Spark's choice-driven chat.
  //
  // The chat used to be a free-text box wired to a personality reply pool:
  // whatever the player typed, the NPC answered from a fixed list and NOTHING
  // about the match changed. It is now a short game — `rapport` (0-100) moves
  // on every move, gates `flirt` / `ask on a date` / `ask to go steady` behind
  // rising thresholds, and `conversationCooldowns` (optionId -> `weeksLived`)
  // stops the cheapest move being tapped ten times to ratchet it. That map is
  // keyed on `weeksLived` (absolute) and never on the cyclic `week` or the
  // device clock — a wall-clock gate here would be farmable, and this one
  // paces happiness, money and ultimately a relationship.
  //
  // Default `undefined` for both, so this is a CARVE-OUT: version bumped, NO
  // backfill and no `repairGameState` mirror. Two independent reasons, either
  // sufficient. Absence already RESOLVES: `readRapport`
  // (`lib/spark/conversation.ts`) applies the fresh-match baseline at read
  // time, and an absent cooldown map already means "nothing on cooldown",
  // which is what a match that predates the feature should mean. And writing a
  // value would be a guess in either direction — a save has no record of how
  // its chats actually went, so a low number would erase a conversation the
  // player had already invested in, while a high one would hand out the date
  // and go-steady moves for free. Stamping cooldowns would be worse still: it
  // would lock every existing match out of moves it has never played.
  45: (state) => {
    state.version = 45;
    return state;
  },

  // Version 46: `settings.deepLifePlusLastMemberClaimWeek` — the `weeksLived`
  // marker capping the DeepLife+ MEMBER daily-gem grace at one unplayed claim
  // per played game week.
  //
  // v40 gated the FREE tier on `weeksLived` and deliberately left the member
  // drop (250/day) on its calendar-day grace — claiming on a quiet day without
  // playing is a paid perk. But the grace had no cap, and the day-key and epoch
  // guards only refuse a REWOUND clock, so scrubbing the device date FORWARD a
  // day at a time compounded that one-day courtesy into an unbounded 250/day
  // faucet on the premium currency that is otherwise an IAP. The perk stays;
  // this marker just stops it repeating: a claim backed by a played week never
  // touches it, an unplayed claim spends it, and only `weeksLived` advancing
  // re-arms it — the one clock a scrubber cannot move. Same fix shape as v28,
  // v31, v35, v40 and v44.
  //
  // Default `undefined`, so this is a CARVE-OUT: version bumped, NO backfill
  // and no `repairGameState` mirror. An absent key already means "the grace is
  // unspent", and stamping the current week onto an existing save would refuse
  // a paying member's next legitimate claim (the v27/v28 reasoning). The key
  // still has to survive the load round-trip, which `loadedStateMerge`
  // guarantees by keeping the saved object's own keys.
  //
  // Numbered 46, not 45: this landed alongside the Spark chat carve-out below,
  // which reached `main` first and owns 45. A version number means one schema
  // shape, so the later change renumbers rather than sharing the slot.
  46: (state) => {
    state.version = 46;
    return state;
  },
};

/**
 * Run all applicable migrations on a loaded save state.
 * @param state The raw parsed state from storage
 * @returns The migrated state with updated version, and a list of migrations applied
 */
/**
 * CI/test guard (H-2): true if version `v` is covered by either a registered
 * migration or an explicit no-op bump. Any version in [2, CURRENT_STATE_VERSION]
 * that returns false is a forgotten migration registration — `runMigrations`
 * will halt the chain there rather than silently stamping the version forward.
 */
/**
 * Threshold below which a persisted market is treated as bug damage rather than
 * a bad run. Every market on the old build fell; none should be near this on the
 * new one, where the walk carries a ~9-11%/yr drift.
 */
const COLLAPSED_MARKET_MEDIAN_RATIO = 0.5;

/**
 * v31 remediation — give back the market the drift bug destroyed.
 *
 * `simulateWeek` stepped prices with `price *= (1 + z·sigma)` and no drift term,
 * which is −sigma²/2 geometrically. Every save on every device was on the same
 * seeded path down: ten game years took the median symbol to 0.32x and forty
 * pinned four of them on the $0.01 floor.
 *
 * Fixing the walk does NOT fix an existing player, because their collapsed
 * prices are persisted in `stocks.savedMarketPrices` and restored on load. Their
 * portfolio stays worthless and, from ~0.0001x, the new drift would take
 * geological time to recover it. Leaving them there would mean the people most
 * affected by the bug are the only ones the fix does not reach.
 *
 * So: if the persisted board is far below the catalogue, drop it and let the
 * life reopen on catalogue prices. Holdings revalue automatically — the weekly
 * tick refreshes `currentPrice` from the board — and `avgCost` is untouched, so
 * a player who bought at $485 and watched it fall to $0.07 comes back to even.
 *
 * KNOWN AND ACCEPTED: someone who bought INTO the collapsed market at $0.07 gets
 * a windfall. This is a single-player game with no leaderboard, and that trade
 * was only available because of the bug in the first place. Restoring everyone's
 * market beats leaving every market dead to deny a few players an upside.
 *
 * Deliberately conditional. A healthy save is left completely alone — a
 * migration that rewrites a working market would be a bigger bug than the one it
 * is repairing.
 */
function healCollapsedMarket(state: any): void {
  const saved = state?.stocks?.savedMarketPrices;
  if (!saved || typeof saved !== 'object') return;

  const ratios: number[] = [];
  for (const [symbol, data] of Object.entries(saved)) {
    const base = defaultStockFor(String(symbol).toUpperCase())?.price;
    const persisted = (data as { price?: unknown })?.price;
    if (typeof base !== 'number' || base <= 0) continue;
    if (typeof persisted !== 'number' || !isFinite(persisted) || persisted <= 0) continue;
    ratios.push(persisted / base);
  }
  if (ratios.length === 0) return;

  ratios.sort((a, b) => a - b);
  const median = ratios[Math.floor(ratios.length / 2)];
  if (median >= COLLAPSED_MARKET_MEDIAN_RATIO) return;

  // Drop the persisted board. `restoreStockPrices(undefined)` and the weekly
  // tick's guard both read "no persisted market" as "open on the catalogue", so
  // deleting is the whole repair — no price table has to be duplicated here.
  delete state.stocks.savedMarketPrices;
  delete state.stocks.lastWeekPrices;
  logger.info(
    `[MIGRATION v31] Persisted market was at ${(median * 100).toFixed(1)}% of catalogue — ` +
      'reopening on catalogue prices (drift-bug remediation)',
  );
}

export function isMigrationVersionCovered(v: number): boolean {
  return migrations[v] !== undefined || NO_OP_MIGRATION_VERSIONS.has(v);
}

export function runMigrations(state: any): { state: any; migrationsApplied: number[]; errors: string[]; versionFromFuture?: boolean } {
  const migrationsApplied: number[] = [];
  const errors: string[] = [];

  if (!state || typeof state !== 'object') {
    return { state, migrationsApplied, errors: ['State is null or not an object'] };
  }

  // Determine current version (default to 1 if missing)
  let currentVersion = typeof state.version === 'number' && state.version >= 1 ? state.version : 1;

  if (currentVersion > CURRENT_STATE_VERSION) {
    // Save is from a newer build than the running app. There's no safe way to
    // downgrade — log loudly so the boot path / UI can surface the mismatch
    // instead of silently loading state that may reference fields we don't know.
    const msg = `Save version ${currentVersion} is newer than app version ${CURRENT_STATE_VERSION} — loading anyway, but unknown fields may be ignored or cause unexpected behavior.`;
    logger.warn(`[MIGRATION] ${msg}`);
    errors.push(msg);
    // P1-7: flag the future-version case so loadGame can refuse to load (and,
    // crucially, refuse to re-persist) — preventing an older build from
    // overwriting a newer save with a downgraded shape.
    return { state, migrationsApplied, errors, versionFromFuture: true };
  }

  if (currentVersion === CURRENT_STATE_VERSION) {
    // Already at current version — no migrations needed
    return { state, migrationsApplied, errors };
  }

  logger.info(`[MIGRATION] Starting migration from v${currentVersion} to v${CURRENT_STATE_VERSION}`);

  for (let targetVersion = currentVersion + 1; targetVersion <= CURRENT_STATE_VERSION; targetVersion++) {
    const migrationFn = migrations[targetVersion];
    if (migrationFn) {
      try {
        state = migrationFn(state);
        migrationsApplied.push(targetVersion);
        // Only bump version on successful migration. If we bumped on failure,
        // subsequent loads would skip the failed migration permanently and
        // run later migrations against state that's structurally one version
        // behind — silent data loss.
        state.version = targetVersion;
        logger.info(`[MIGRATION] Applied migration to v${targetVersion}`);
      } catch (error) {
        const errorMsg = `Migration to v${targetVersion} failed: ${error instanceof Error ? error.message : String(error)}`;
        errors.push(errorMsg);
        logger.error(`[MIGRATION] ${errorMsg}`);
        // Stop the chain at the last successful version. Next load will retry
        // the failed migration (it may have been a transient failure), rather
        // than running later migrations against unmigrated state.
        break;
      }
    } else if (NO_OP_MIGRATION_VERSIONS.has(targetVersion)) {
      // Registered intentional no-op bump (no schema change at this version).
      state.version = targetVersion;
      logger.info(`[MIGRATION] v${targetVersion} is a registered no-op version bump`);
    } else {
      // H-2 (R8): a missing migration that is NOT a registered no-op is almost
      // certainly a forgotten registration. Do NOT stamp the version forward —
      // that would permanently skip the real migration once it's added (the
      // loader would then see version === CURRENT and never run it), shipping
      // saves with unpopulated new fields. Halt at the last good version so a
      // later build with the registered migration can finish the upgrade.
      const msg =
        `No migration registered for v${targetVersion} and it is not a known no-op bump — ` +
        `halting migration at v${state.version}. Add migrations[${targetVersion}] (or register ` +
        `it in NO_OP_MIGRATION_VERSIONS if the bump is intentional).`;
      logger.error(`[MIGRATION] ${msg}`);
      errors.push(msg);
      break;
    }
  }

  if (migrationsApplied.length > 0) {
    logger.info(`[MIGRATION] Completed: applied ${migrationsApplied.length} migrations (${migrationsApplied.join(', ')})`);
  }

  return { state, migrationsApplied, errors };
}
