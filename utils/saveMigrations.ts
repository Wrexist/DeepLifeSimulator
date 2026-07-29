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
import { createIdentity, normalizeIdentity } from '@/lib/identity';

// Import from initialState.ts to prevent manual sync drift
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

    // Challenge streak — initialize with defaults for saves that had daily challenges
    if (state.challengeStreak === undefined && state.dailyChallenges?.lastCompletionDay) {
      state.challengeStreak = { count: 0, lastCompletionDayKey: '' };
    }

    // Life chapters
    if (state.activeChapterId === undefined) {
      state.activeChapterId = 'ch1_fresh_start';
    }
    if (state.completedChapters === undefined) {
      state.completedChapters = [];
    }

    // Tutorial step completion
    if (state.completedTutorialSteps === undefined) {
      state.completedTutorialSteps = [];
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
        vendors: [
          { id: 'vendor-shadow',   handle: 'shadow.eth',  reputation: 35, reviewCount: 12 },
          { id: 'vendor-zerocool', handle: 'zerocool',    reputation: 65, reviewCount: 84 },
          { id: 'vendor-veil',     handle: 'veil_market', reputation: 80, reviewCount: 230 },
          { id: 'vendor-burner',   handle: 'b4n3_drop',   reputation: 15, reviewCount: 3 },
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

  // Version 26: Identity & Body (`identity`).
  //
  // A concrete stored default (an object), so it needs a real backfill rather
  // than an absent-means-default carve-out: the weekly identity tick simulates
  // `identity.body` every week, and an undefined body would mean an existing
  // save silently opts out of the entire chapter forever.
  //
  // The backfill DERIVES the character rather than handing everyone the same
  // body. Seeding from the save's own name means a returning player's character
  // gets a stable body and face of their own — and, crucially, the same one on
  // every subsequent load, since the seed is part of the save.
  //
  // Age and sex are read from where the game actually keeps them (`date.age`,
  // `social.sex`) so a 60-year-old's backfilled body is a 60-year-old's body.
  26: (state) => {
    if (!state.identity || typeof state.identity !== 'object' || Array.isArray(state.identity)) {
      const first = typeof state.social?.firstName === 'string' ? state.social.firstName : '';
      const last = typeof state.social?.lastName === 'string' ? state.social.lastName : '';
      // Fall back to a constant rather than a random seed: a migration must be
      // idempotent, and re-running it must not produce a different person.
      const seed = `${first}${last}`.trim() || 'legacy-save';
      const sex = typeof state.social?.sex === 'string' ? state.social.sex : 'male';
      const age = typeof state.date?.age === 'number' && isFinite(state.date.age) && state.date.age >= 0
        ? state.date.age
        : 18;
      state.identity = createIdentity(seed, sex, age);
    } else {
      // Present but possibly partial (a hand-edited or truncated save). Route it
      // through the same normalizer everything else uses.
      state.identity = normalizeIdentity(state.identity, 'legacy-save');
    }

    state.version = 26;
    return state;
  },

  // Version 27: grooming and complexion on `FaceGenome` — brow thickness and
  // colour, facial-hair colour and density, skin undertone and finish.
  //
  // The same `normalizeIdentity` call as v26, and that is the whole migration.
  // It is registered rather than listed as a no-op because it DOES do work: the
  // four concrete-default fields (`browThickness`, `beardDensity`,
  // `skinUndertone`, `skinShine`) are backfilled to 0.5 by `normalizeGenome`
  // underneath it, and `repairGameState` runs the same normalizer for a partial
  // save. The two optional fields — `browColor`, `beardColor` — are
  // deliberately NOT written: their default is "absent", meaning follow the
  // hair, so writing a key would turn every existing character's brows into an
  // explicit override of the colour they already had.
  27: (state) => {
    if (state.identity && typeof state.identity === 'object' && !Array.isArray(state.identity)) {
      state.identity = normalizeIdentity(state.identity, 'legacy-save');
    }
    state.version = 27;
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
