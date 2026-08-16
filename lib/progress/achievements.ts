import { GameState } from '@/contexts/game/types';
import { WEEKS_PER_YEAR } from '@/lib/config/gameConstants';
import { getTotalLuxuryMarketValue } from '@/lib/luxury';
import { nonMirrorDeposits, totalCreditCardDebt } from '@/lib/banking/operations';

export interface AchievementProgress {
  id: string;
  name: string;
  desc: string;
  unlockedAt?: number; 
}

/**
 * @deprecated Legacy 7-entry achievement catalog, superseded by the unified
 * system in `src/features/onboarding/achievementsData.ts`. Reduced to an empty
 * stub — its only remaining consumer was the no-op `checkAchievements` path.
 * TODO(flawless-audit): remove with checkAchievements.
 */
export const ACHIEVEMENTS: AchievementProgress[] = [];

/**
 * Memoization cache for net worth.
 *
 * M9: every slice was typed `any`, so a field could be added to the SUM and
 * silently omitted from the key (or keyed on the wrong slice) with nothing to
 * catch it. The fields are the real `GameState` slice types now — identity
 * comparison is all the cache does, so the types cost nothing at runtime and a
 * renamed/removed slice becomes a compile error here.
 *
 * RULE: every slice read by `netWorth` below must appear here. Comparison is by
 * REFERENCE (state is never mutated in place — §4.1), so a slice that changes
 * produces a new object identity and invalidates the memo.
 */
interface NetWorthCacheKey {
  money: number;
  bank: number;
  stocks: GameState['stocks'];
  /** The legacy fallback path (`else if (state.stocksOwned)`) reads this, so a
   *  change to it must invalidate the memo on a save with no modern holdings. */
  stocksOwned: GameState['stocksOwned'];
  realEstate: GameState['realEstate'];
  companies: GameState['companies'];
  loans: GameState['loans'];
  vehicles: GameState['vehicles'];
  luxury: GameState['luxuryItems'];
  /** Holdings drift weekly through appreciation WITHOUT the id list changing,
   *  so keying on `luxuryItems` alone would serve a stale net worth forever. */
  luxuryHoldings: GameState['luxuryHoldings'];
  /** R3-M4: crypto and the modern banking slice were absent entirely. */
  cryptos: GameState['cryptos'];
  banking: GameState['banking'];
  /** D-5: laundered BTC is spendable value and moves independently of `cryptos`. */
  darkWeb: GameState['darkWeb'];
  /**
   * M9: keyed but deliberately NOT summed — see the note at the total below.
   * Keying it costs one comparison and means that if arrears are ever made a
   * liability, an existing memo cannot serve a stale figure across the change.
   */
  overdueBalance: GameState['overdueBalance'];
}

let lastCacheKey: NetWorthCacheKey | null = null;
let lastNetWorthValue: number = 0;

export const netWorth = (state: GameState): number => {
  // BUGFIX: state.stats may be undefined for partial states from cloud
  // download, prestige resets, or onboarding flows. Direct access crashed
  // the leaderboard score calculator with TypeError.
  const money = state?.stats?.money ?? 0;
  const bank = state?.bankSavings ?? 0;
  
  // Check if we can return cached value (fast path)
  if (lastCacheKey &&
      lastCacheKey.money === money &&
      lastCacheKey.bank === bank &&
      lastCacheKey.stocks === state.stocks &&
      lastCacheKey.stocksOwned === state.stocksOwned &&
      lastCacheKey.overdueBalance === state.overdueBalance &&
      lastCacheKey.realEstate === state.realEstate &&
      lastCacheKey.companies === state.companies &&
      lastCacheKey.loans === state.loans &&
      lastCacheKey.vehicles === state.vehicles &&
      lastCacheKey.luxury === state.luxuryItems &&
      lastCacheKey.luxuryHoldings === state.luxuryHoldings &&
      lastCacheKey.cryptos === state.cryptos &&
      lastCacheKey.banking === state.banking &&
      lastCacheKey.darkWeb === state.darkWeb) {
    return lastNetWorthValue;
  }

  // Calculate stock value from modern holdings structure
  // CRITICAL FIX: Add overflow protection for very large numbers
  //
  // SAFETY: This is safe because:
  // - All calculations check for overflow before and after operations
  // - Clamping to MAX_SAFE_INTEGER prevents integer overflow (which causes negative numbers)
  // - isFinite() checks catch NaN and Infinity values
  //
  // FRAGILE LOGIC WARNING:
  // - If a single holding exceeds MAX_SAFE_VALUE, the entire stockValue becomes MAX_SAFE_VALUE.
  //   This means one very large holding caps the total, which might not be intended.
  //   However, this is better than overflow causing negative values.
  // - The clamp happens per-holding AND per-total, which is redundant but safe.
  //
  // FUTURE BUG RISK:
  // - If holding.shares or holding.currentPrice are very large but their product is just under
  //   MAX_SAFE_VALUE, but total + value exceeds it, we clamp. This is correct but might cause
  //   net worth to be slightly inaccurate for ultra-rich players.
  // - If multiple holdings each approach MAX_SAFE_VALUE, total will be capped even if sum
  //   would be valid. This is acceptable as it prevents overflow.
  // - TODO: Consider using BigInt for net worth calculations if ultra-high precision is needed
  const MAX_SAFE_VALUE = Number.MAX_SAFE_INTEGER; // 2^53 - 1
  let stockValue = 0;
  if (state.stocks?.holdings) {
    stockValue = state.stocks.holdings.reduce((total, holding) => {
      const value = (holding.shares || 0) * (holding.currentPrice || 0);
      // Prevent overflow: if value would exceed safe limit, clamp it
      if (!isFinite(value) || value > MAX_SAFE_VALUE) {
        return MAX_SAFE_VALUE;
      }
      const newTotal = total + value;
      // Prevent total from exceeding safe limit
      return newTotal > MAX_SAFE_VALUE ? MAX_SAFE_VALUE : newTotal;
    }, 0);
  } else if (state.stocksOwned) {
    // Fallback for legacy data
    stockValue = Object.values(state.stocksOwned).reduce((a, b) => {
      const sum = a + (b || 0);
      return sum > MAX_SAFE_VALUE ? MAX_SAFE_VALUE : sum;
    }, 0);
  }

  // Calculate real estate value. Skip SOLD properties — sellProperty keeps the
  // entry with owned:false, so summing every property ever owned permanently
  // inflated net worth and let players farm the prestige gate/points. Test
  // `owned === false` (not `!owned`) so legacy entries lacking the flag still
  // count. Prefer the live currentValue over the original purchase price.
  const realEstateValue = state.realEstate?.reduce((total, property) => {
    if (property?.owned === false) return total;
    const value = (property?.currentValue ?? property?.price ?? 0);
    const sum = total + value;
    return sum > MAX_SAFE_VALUE ? MAX_SAFE_VALUE : sum;
  }, 0) || 0;

  // Calculate companies value
  // CRITICAL FIX: Add overflow protection for weeklyIncome * 52
  const companyValue = state.companies?.reduce((total, company) => {
    const weeklyIncome = company.weeklyIncome || 0;
    const annualIncome = weeklyIncome * WEEKS_PER_YEAR;
    // Prevent overflow: if calculation would exceed safe limit, clamp it
    if (!isFinite(annualIncome) || annualIncome > MAX_SAFE_VALUE) {
      return MAX_SAFE_VALUE;
    }
    const sum = total + annualIncome;
    return sum > MAX_SAFE_VALUE ? MAX_SAFE_VALUE : sum;
  }, 0) || 0;

  // Calculate vehicle value (depreciated)
  let vehicleValue = 0;
  if (state.vehicles && Array.isArray(state.vehicles)) {
    state.vehicles.forEach(vehicle => {
      if (!vehicle) return; // Skip invalid vehicles
      
      // CRITICAL: Validate all vehicle values before calculation
      const price = typeof vehicle.price === 'number' && isFinite(vehicle.price) && vehicle.price >= 0 ? vehicle.price : 0;
      const condition = typeof vehicle.condition === 'number' && isFinite(vehicle.condition) && vehicle.condition >= 0 && vehicle.condition <= 100 ? vehicle.condition : 100;
      const mileage = typeof vehicle.mileage === 'number' && isFinite(vehicle.mileage) && vehicle.mileage >= 0 ? vehicle.mileage : 0;
      
      if (price > 0) {
        // Use same depreciation logic as sell price
        const baseSellPercent = 0.8;
        const conditionMultiplier = 0.2 + (condition / 100) * 0.8;
        const mileagePenalty = Math.min(0.3, mileage / 500000);
        const depreciatedValue = price * baseSellPercent * conditionMultiplier * (1 - mileagePenalty);
        
        // CRITICAL: Validate result before adding
        if (isFinite(depreciatedValue) && depreciatedValue > 0) {
          vehicleValue += Math.floor(depreciatedValue);
        }
      }
    });
  }
  // Final validation
  if (!isFinite(vehicleValue) || vehicleValue < 0) vehicleValue = 0;

  // Luxury & Collectibles value — resale fraction of owned trophies (a sink, not
  // an investment, so it counts less than sticker). Reads the APPRECIATED value
  // per holding, falling back to the catalog price when a holding has never
  // drifted — so an untouched collection is valued exactly as it always was.
  // Null-safe for old saves (absent luxuryItems → 0). Clamp for overflow parity.
  let luxuryValue = getTotalLuxuryMarketValue(state.luxuryItems, state.luxuryHoldings);
  if (!isFinite(luxuryValue) || luxuryValue < 0) luxuryValue = 0;
  if (luxuryValue > MAX_SAFE_VALUE) luxuryValue = MAX_SAFE_VALUE;

  // Calculate loans (liabilities). Use the outstanding balance (remaining), not
  // the fixed origination principal, so paying a loan down actually raises net
  // worth (loans are removed at payoff). Fall back to principal on legacy saves.
  const loansValue = state.loans?.reduce((total, loan) => {
    return total + (loan.remaining ?? loan.principal ?? 0);
  }, 0) || 0;

  // CRITICAL FIX: Validate all components and prevent overflow in final calculation
  //
  // SAFETY: This is safe because:
  // - Each component is validated independently, preventing NaN/Infinity propagation
  // - Final sum is clamped to prevent overflow (both positive and negative)
  // - Negative net worth is allowed (debt > assets) but clamped to prevent extreme values
  //
  // FRAGILE LOGIC WARNING:
  // - If one component is MAX_SAFE_VALUE and others are positive, total will be clamped.
  //   This means net worth might be slightly inaccurate for ultra-rich players, but prevents
  //   overflow which would cause much worse issues (negative net worth, NaN, etc.).
  // - Negative net worth is clamped to -MAX_SAFE_VALUE, which is a very large debt.
  //   This is acceptable as it prevents integer underflow.
  //
  // FUTURE BUG RISK:
  // - If all components are valid but their sum exceeds MAX_SAFE_VALUE, total is clamped.
  //   This is correct but might cause prestige thresholds to fail for ultra-rich players.
  //   Consider: If net worth is clamped to MAX_SAFE_VALUE but should be higher, prestige
  //   system might not work correctly.
  // - If loansValue is very large (close to MAX_SAFE_VALUE), subtracting it from total
  //   might cause underflow. The clamp to -MAX_SAFE_VALUE prevents this.
  // - TODO: Consider logging when net worth is clamped, so we can track if this happens
  const safeMoney = isFinite(money) ? money : 0;
  const safeBank = isFinite(bank) ? bank : 0;
  const safeStockValue = isFinite(stockValue) ? stockValue : 0;
  /**
   * R3-M4: crypto and the modern banking slice were missing from this sum
   * entirely — `grep crypto lib/progress/achievements.ts` returned nothing, and
   * `bank` was only the legacy `bankSavings` pool, deprecated since
   * STATE_VERSION 14 in favour of `banking.accounts`.
   *
   * So converting $1M of cash to Bitcoin DROPPED reported net worth by $1M, and
   * every coin the mining warehouse ever produced was worth $0 on the
   * scoreboard. Depositing into a high-yield savings account did the same. This
   * is the canonical figure: it gates prestige, the ultra-rich passive-income
   * soft cap, bail cost, ad-reward scaling, the identity card and the statistics
   * history — so a crypto-heavy or deposit-heavy player could be locked out of
   * prestige indefinitely, while also dodging the >$10M passive-income cap.
   */
  const cryptoValue = (state.cryptos ?? []).reduce((sum, coin) => {
    const owned = Number(coin?.owned);
    const price = Number(coin?.price);
    if (!isFinite(owned) || !isFinite(price) || owned <= 0 || price <= 0) return sum;
    return sum + owned * price;
  }, 0);

  /**
   * D-5: LAUNDERED dark-web BTC counts. Dirty BTC does not.
   *
   * PLAYER REPORT (BBQ, 2026-08-11): "Doesn't add to net worth or attribute any
   * value to items owned."
   *
   * `darkWeb.cleanBtc` is a staging pool, not a separate currency:
   * `withdrawCleanBtc` moves it 1:1 into `cryptos[btc].owned`, which this
   * function already counts at full price. So the SAME bitcoin was worth its
   * market price in one pocket and exactly $0 in the other, and a player's net
   * worth jumped the instant they tapped Withdraw without anything of value
   * changing hands. Since this figure gates prestige, the passive-income soft
   * cap, bail and ad rewards, a laundering-heavy run was quietly penalised on
   * all four.
   *
   * `dirtyBtc` is deliberately NOT counted. It cannot leave without going
   * through a mixer, which takes a cut and several weeks, so it is a claim on
   * future value rather than present value. Counting it at face would also make
   * the mixer's fee invisible to the scoreboard and drain the point of
   * laundering. Excluding it keeps "launder to realise value" a real decision.
   *
   * `darkWebItems` are likewise excluded: they have `costBtc` but no resale
   * path anywhere in the game, and every other term here is what an asset would
   * actually pay out. An item you can never sell has no realisable value.
   */
  const rawBtcPrice = (state.cryptos ?? []).find((c) => c?.id === 'btc')?.price;
  const rawCleanBtc = state.darkWeb?.cleanBtc;
  // `typeof === 'number'` rather than `Number(x)`: the coercing form credits a
  // persisted STRING like "2", which is exactly the corrupt-save shape the
  // surrounding guards exist to reject. The product is clamped because two
  // individually-finite values can still multiply to Infinity, and the
  // isFinite sweep further down would then silently zero the whole term.
  const darkWebBtcValue =
    typeof rawBtcPrice === 'number' && isFinite(rawBtcPrice) && rawBtcPrice > 0 &&
    typeof rawCleanBtc === 'number' && isFinite(rawCleanBtc) && rawCleanBtc > 0
      ? Math.min(MAX_SAFE_VALUE, rawCleanBtc * rawBtcPrice)
      : 0;

  /**
   * R4 correction to R3-M4: EXCLUDE the mirror accounts.
   *
   * `banking.accounts` always contains `checking-default` and
   * `savings-default`, which `mirrorAccountsFromLegacy` overwrites with
   * `stats.money` and `bankSavings` on step 1 of every weekly tick. Summing all
   * balances on top of `safeMoney + safeBank` therefore counted both legacy
   * pools TWICE — roughly doubling reported net worth for any cash-holding
   * player, which gates prestige availability, the prestige points award, the
   * $10M achievement, ambition goals, life chapters, the leaderboard, the
   * passive-income soft cap, bail and ad rewards.
   *
   * The repo already shipped the guard I should have used: `nonMirrorDeposits`,
   * whose doc comment says verbatim that anything also counting the legacy
   * fields must exclude the mirrors. The R3-M4 test missed it because its
   * fixtures used ids like `chk`/`hysa` and left both mirrors at 0.
   */
  const bankAccountsValue = nonMirrorDeposits(state.banking?.accounts ?? []);

  /**
   * R4 correction: card debt. R3-M4's own finding text said netWorth "ignores
   * credit-card debt" and I marked it fixed without adding the term. R3-M8 then
   * made balances compound weekly with no minimum payment, so an unpaid card
   * grows without bound while staying invisible on the balance sheet.
   */
  const creditCardDebt = totalCreditCardDebt({
    // `totalCreditCardDebt` dereferences `.creditCards` directly, and a partial
    // save can carry a `banking` object without it. `netWorth` is called from
    // the leaderboard and the HUD, so a throw here is a blank screen.
    //
    // M9: this used to be spread + `as never`, which erased the argument type
    // entirely — the ONE thing this call has to get right (that `creditCards`
    // is a real array) was the thing the cast stopped checking. The helper now
    // takes `Pick<BankingState, 'creditCards'>`, so the guarded array is passed
    // on its own and the shape is verified.
    creditCards: state.banking?.creditCards ?? [],
  });
  const safeCreditCardDebt = isFinite(creditCardDebt) ? Math.max(0, creditCardDebt) : 0;

  /**
   * R3-M5: money parked in a savings goal is still the player's. It was
   * invisible here AND had no withdraw path, so contributing destroyed it
   * twice over — gone from the balance sheet and gone from the game. The
   * withdraw path now exists (`withdrawFromGoal`); this makes it count.
   */
  const savingsGoalsValue = (state.banking?.savingsGoals ?? []).reduce((sum, goal) => {
    const amount = Number(goal?.currentAmount);
    return isFinite(amount) && amount > 0 ? sum + amount : sum;
  }, 0);

  const safeSavingsGoalsValue = isFinite(savingsGoalsValue) ? savingsGoalsValue : 0;

  const safeCryptoValue = isFinite(cryptoValue) ? cryptoValue : 0;
  const safeDarkWebBtcValue = isFinite(darkWebBtcValue) ? darkWebBtcValue : 0;
  const safeBankAccountsValue = isFinite(bankAccountsValue) ? bankAccountsValue : 0;
  const safeRealEstateValue = isFinite(realEstateValue) ? realEstateValue : 0;
  const safeCompanyValue = isFinite(companyValue) ? companyValue : 0;
  const safeVehicleValue = isFinite(vehicleValue) ? vehicleValue : 0;
  const safeLuxuryValue = isFinite(luxuryValue) ? luxuryValue : 0;
  const safeLoansValue = isFinite(loansValue) ? loansValue : 0;

  /**
   * OPEN QUESTION (M9) — `state.overdueBalance` is NOT subtracted here.
   *
   * v31 added it as the arrears bucket for unpayable weekly bills, so it is a
   * real debt the player owes, and every other liability in this sum (loans,
   * card balances) IS subtracted. Whether arrears should reduce net worth is a
   * GAME-BALANCE decision, not a bookkeeping one: this figure gates prestige
   * availability and the prestige points award, the ultra-rich passive-income
   * soft cap, bail cost and ad-reward scaling, so subtracting it would push a
   * struggling player further from the prestige that resets their debts.
   * Deliberately left for the owner to decide; the field is in the cache key
   * above so the memo cannot serve a stale figure if that decision changes.
   */
  const total = safeMoney + safeBank + safeBankAccountsValue + safeSavingsGoalsValue + safeCryptoValue + safeDarkWebBtcValue - safeCreditCardDebt + safeStockValue + safeRealEstateValue + safeCompanyValue + safeVehicleValue + safeLuxuryValue - safeLoansValue;
  
  // CRITICAL FIX: Clamp final total to prevent overflow or negative corruption
  // Note: Negative net worth is allowed (debt > assets) but clamped to prevent extreme values
  const clampedTotal = isFinite(total) 
    ? Math.max(-MAX_SAFE_VALUE, Math.min(MAX_SAFE_VALUE, total))
    : 0;
  
  // Update cache
  lastCacheKey = {
    money,
    bank,
    stocks: state.stocks,
    stocksOwned: state.stocksOwned,
    overdueBalance: state.overdueBalance,
    realEstate: state.realEstate,
    companies: state.companies,
    loans: state.loans,
    vehicles: state.vehicles,
    luxury: state.luxuryItems,
    luxuryHoldings: state.luxuryHoldings,
    cryptos: state.cryptos,
    banking: state.banking,
    darkWeb: state.darkWeb
  };
  lastNetWorthValue = clampedTotal;

  return clampedTotal;
};

/**
 * @deprecated Superseded by the unified achievement system in
 * `src/features/onboarding/achievementsData.ts`. Reduced to a no-op stub: its
 * only caller is the no-op `checkAchievements` in GameActionsContext (not
 * editable this wave), so it must stay exported but does nothing.
 * TODO(flawless-audit): remove with checkAchievements.
 */
export const evaluateAchievements = (_state: GameState): AchievementProgress[] => {
  return [];
};
