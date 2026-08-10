/**
 * Weekly crypto market tick.
 *
 * Runs once per game-week. Responsibilities:
 *   1. Evolve regimes (decrement remaining; re-roll when expired; force by economy state).
 *   2. Step each coin's price (drift + walk + news shock if any).
 *   3. Append price + spread to each coin's CoinMarket.
 *   4. Process open orders (fill limits when crossed, trigger stops).
 *   5. Run due DCA rules (debit checking account, buy at current mid + slippage).
 *
 * Pure function. Caller threads cash / coin holdings deltas into setGameState.
 *
 * Deterministic when given a seeded `rollFor(key)` function — matches the
 * existing preRolls pattern in the game's nextWeek pipeline.
 */

import {
  BankingState,
  CoinMarket,
  Crypto,
  CryptoMarketState,
  CryptoRegime,
} from '@/contexts/game/types';
import {
  nextRegime,
  regimeFromEconomyState,
  REGIME_PARAMS,
  sampleRegimeDuration,
  stepPrice,
} from './marketModel';
import {
  marketFillPrice,
  bidAskSpreadForRegime,
} from './orderBook';
import { processOpenOrders, recordPriceTick, recordDCAExecution } from './operations';
import {
  CAPITAL_GAINS_TAX_RATE,
  TAX_YEAR_WEEKS,
  clampTaxMult,
} from '@/lib/economy/taxLedger';

const safe = (n: number | undefined, fb = 0): number =>
  typeof n === 'number' && isFinite(n) ? n : fb;

export interface CryptoWeeklyTickInput {
  market: CryptoMarketState;
  cryptos: Crypto[];
  banking?: BankingState;
  /** Player's cash on hand entering this tick. */
  cashIn: number;
  /** weeksLived of THIS tick (the new week). */
  currentWeek: number;
  /** Optional economy state — forces a regime override for the week. */
  economyState?: 'normal' | 'recession' | 'boom' | 'crash';
  /**
   * Tax Strategy life-skill multiplier (`lifeSkillMods.taxMult`, 0.75–1).
   *
   * It used to scale the weekly income tax and NOTHING else, so the one
   * tax-related thing the player can invest in was worth exactly zero to a
   * player whose income is capital gains. Defaults to 1, so an omitted value
   * reproduces the old numbers exactly.
   */
  taxMult?: number;
  /**
   * Deterministic roll source. Given a key, returns a stable u in [0, 1).
   * Pass `(key) => Math.random()` for non-deterministic flows (e.g. in tests
   * we'll seed it manually).
   */
  rollFor: (key: string) => number;
}

export interface CryptoWeeklyTickResult {
  market: CryptoMarketState;
  /** Cryptos with updated prices, changes, changePercent (writes legacy field). */
  cryptos: Crypto[];
  /** Updated banking state if DCA debits ran from a bank account. */
  banking?: BankingState;
  /** Delta to apply to stats.money (sells, refunds, etc.). DCA debits are
   *  charged to bank accounts via `banking`, not cash, so this is usually 0. */
  cashDelta: number;
  /**
   * Capital-gains tax actually collected this tick (0 except on the year
   * boundary). Reported so the caller can fold it into the year-to-date tax
   * ledger the Bank app reads — the same field name the stocks tick returns.
   */
  capitalGainsTaxUSD: number;
  /** Notifications for the UI (regime changes, DCA fills, stop-loss triggers). */
  notifications: { id: string; title: string; message: string }[];
}

function clampRegimeRoll(roll: number): number {
  return Math.max(0, Math.min(0.9999, roll));
}

function evolveRegime(
  market: CoinMarket,
  forced: CryptoRegime | null,
  rollTransition: number,
  rollDuration: number
): { regime: CryptoRegime; weeksRemaining: number; spread: number; changed: boolean } {
  const expiringSoon = safe(market.regimeWeeksRemaining) <= 1;
  if (forced != null && forced !== market.regime) {
    return {
      regime: forced,
      weeksRemaining: sampleRegimeDuration(forced, rollDuration),
      spread: REGIME_PARAMS[forced].bidAskSpread,
      changed: true,
    };
  }
  if (expiringSoon) {
    const r = nextRegime(market.regime, clampRegimeRoll(rollTransition));
    return {
      regime: r,
      weeksRemaining: sampleRegimeDuration(r, rollDuration),
      spread: REGIME_PARAMS[r].bidAskSpread,
      changed: r !== market.regime,
    };
  }
  return {
    regime: market.regime,
    weeksRemaining: Math.max(0, safe(market.regimeWeeksRemaining) - 1),
    spread: market.bidAskSpread,
    changed: false,
  };
}

export function runCryptoWeeklyTick(input: CryptoWeeklyTickInput): CryptoWeeklyTickResult {
  const notifications: CryptoWeeklyTickResult['notifications'] = [];
  let market: CryptoMarketState = input.market;
  let cryptos = input.cryptos.map((c) => ({ ...c }));
  let banking = input.banking;
  let cashDelta = 0;
  let regimeChangeCount = 0;

  const forcedRegime = regimeFromEconomyState(input.economyState);

  // --- 1) Per-coin price evolution + regime updates -----------------------
  for (const coin of cryptos) {
    const cm = market.coinMarkets?.[coin.id];
    if (!cm) continue;
    const { regime, weeksRemaining, spread, changed } = evolveRegime(
      cm,
      forcedRegime,
      input.rollFor(`crypto.${coin.id}.regimeTransition`),
      input.rollFor(`crypto.${coin.id}.regimeDuration`)
    );
    if (changed) regimeChangeCount++;
    const oldPrice = safe(coin.price, 1);
    const newPrice = stepPrice(
      oldPrice,
      regime,
      {
        u1: input.rollFor(`crypto.${coin.id}.priceU1`),
        u2: input.rollFor(`crypto.${coin.id}.priceU2`),
      }
    );
    coin.change = newPrice - oldPrice;
    coin.changePercent = oldPrice > 0 ? ((newPrice - oldPrice) / oldPrice) * 100 : 0;
    coin.price = newPrice;
    market = recordPriceTick(market, coin.id, input.currentWeek, newPrice, regime, spread, weeksRemaining);
  }

  // SMOOTHNESS: the market evolves for every coin each week, so a regime flip
  // happens almost weekly. That's pure ambient flavor for someone who doesn't
  // trade crypto — surfacing it as a top-of-screen toast every "Next Week" is
  // noise. Only notify players who actually hold a position (or have automation
  // riding on prices); for everyone else the market still moves silently.
  const playerEngagedWithCrypto =
    cryptos.some((c) => safe(c.owned) > 0) ||
    (input.market.openOrders?.length ?? 0) > 0 ||
    (input.market.dcaRules?.some((r) => r.enabled) ?? false);
  if (regimeChangeCount > 0 && playerEngagedWithCrypto) {
    notifications.push({
      id: 'crypto-regime-flip',
      title: '📊 Crypto Regimes Shifted',
      message: `${regimeChangeCount} ${regimeChangeCount === 1 ? 'coin' : 'coins'} entered a new market regime.`,
    });
  }

  // --- 1b) BTC halving every 208 weeks (~4 game years). Halves mining reward
  //         and forces a bull regime on BTC for 24 weeks as the supply-shock catalyst.
  const HALVING_INTERVAL = 208;
  const lastHalving = safe(market.lastHalvingWeek, 0);
  if (input.currentWeek > 0 && input.currentWeek - lastHalving >= HALVING_INTERVAL) {
    const newHalvingCount = safe(market.halvingCount, 0) + 1;
    market = {
      ...market,
      lastHalvingWeek: input.currentWeek,
      halvingCount: newHalvingCount,
    };
    const btcMarket = market.coinMarkets?.btc;
    let btcBullApplied = false;
    if (btcMarket) {
      market = {
        ...market,
        coinMarkets: {
          ...market.coinMarkets,
          btc: { ...btcMarket, regime: 'bull', regimeWeeksRemaining: 24 },
        },
      };
      btcBullApplied = true;
    }
    // Only announce the bull regime if it was actually applied — on a malformed /
    // partial market (`coinMarkets` absent) the halving still cuts mining rewards,
    // but BTC's regime was not changed, so don't claim it was.
    notifications.push({
      id: 'crypto-halving',
      title: '⛏️ Bitcoin Halving',
      message: `Mining rewards halved (now ${(Math.pow(0.5, newHalvingCount) * 100).toFixed(2)}% of original).${btcBullApplied ? ' BTC enters a bull regime.' : ''}`,
    });
  }

  // --- 2) Process open orders (limits + stops) ---------------------------
  const orderResult = processOpenOrders(market, cryptos, input.currentWeek, safe(input.cashIn, 0));
  market = orderResult.market;
  for (const fill of orderResult.fills) {
    if (fill.order.side === 'buy') {
      cashDelta -= fill.notionalUSD;
      cryptos = cryptos.map((c) =>
        c.id === fill.order.cryptoId ? { ...c, owned: safe(c.owned) + fill.coinAmount } : c
      );
    } else {
      // Sell — credit cash ONLY for coins actually held. R10-1: clamp to owned
      // so an order for more coins than the player holds can't print cash for
      // phantom coins (the authoritative safety net behind placement validation).
      const held = safe(cryptos.find((c) => c.id === fill.order.cryptoId)?.owned);
      const sellable = Math.min(safe(fill.coinAmount), held);
      if (sellable > 0) {
        const pricePerCoin = fill.coinAmount > 0 ? fill.notionalUSD / fill.coinAmount : 0;
        cashDelta += pricePerCoin * sellable;
        cryptos = cryptos.map((c) =>
          c.id === fill.order.cryptoId
            ? { ...c, owned: Math.max(0, safe(c.owned) - sellable) }
            : c
        );
      }
    }
    if (fill.order.type === 'stop') {
      notifications.push({
        id: `crypto-stop-${fill.order.id}`,
        title: '🛑 Stop Order Triggered',
        message: `${fill.order.side === 'sell' ? 'Sold' : 'Bought'} ${fill.order.cryptoId.toUpperCase()} at $${fill.order.filledPrice?.toFixed(2)}.`,
      });
    }
  }

  // --- 3) DCA execution (debits from checking account in banking slice) ---
  let dcaFillCount = 0;
  // Guard optional slices: a partially-migrated save can carry `cryptoMarket`
  // without `dcaRules`, or `banking` without `accounts`. An unguarded read here
  // throws inside the weekly-tick updater and silently bricks "Next Week".
  for (const rule of market.dcaRules || []) {
    if (!rule.enabled || rule.nextExecutionWeek > input.currentWeek) continue;
    const coin = cryptos.find((c) => c.id === rule.cryptoId);
    if (!coin || !banking || !banking.accounts) continue;
    const acctIdx = banking.accounts.findIndex((a) => a.id === rule.fromAccountId);
    if (acctIdx === -1) continue;
    const account = banking.accounts[acctIdx];
    // Affordability + debit both run against the authoritative cash pool
    // (stats.money via cashDelta). rule.fromAccountId is the checking-default
    // mirror, whose balance is overwritten from stats.money every tick, so
    // charging only the mirror let DCA print free coins. Check live cash and
    // charge cashDelta; mirror the balance too for same-tick UI consistency.
    const availableCashForDca = safe(input.cashIn, 0) + cashDelta;
    if (availableCashForDca < rule.amount) {
      // Insufficient funds — skip this execution but bump nextExecutionWeek so we retry.
      market = recordDCAExecution(market, rule.id, 0, 0, input.currentWeek);
      continue;
    }
    const regime = market.coinMarkets?.[rule.cryptoId]?.regime ?? 'stable';
    const fillPrice = marketFillPrice(coin.price, 'buy', rule.amount, regime);
    const coinsBought = rule.amount / fillPrice;

    cashDelta -= rule.amount;
    const accounts = [...banking.accounts];
    accounts[acctIdx] = { ...account, balance: account.balance - rule.amount };
    banking = { ...banking, accounts };

    market = {
      ...market,
      costBasis: {
        ...market.costBasis,
        [rule.cryptoId]: {
          totalCost: safe(market.costBasis?.[rule.cryptoId]?.totalCost) + rule.amount,
          totalShares: safe(market.costBasis?.[rule.cryptoId]?.totalShares) + coinsBought,
        },
      },
    };

    cryptos = cryptos.map((c) =>
      c.id === rule.cryptoId ? { ...c, owned: safe(c.owned) + coinsBought } : c
    );

    market = recordDCAExecution(market, rule.id, rule.amount, coinsBought, input.currentWeek);
    dcaFillCount++;
  }
  if (dcaFillCount > 0) {
    notifications.push({
      // Week-keyed. An id that repeats week after week is deduped by the
      // journal writer (`lib/lifeMoments/journalWriter.ts` keys entries by
      // notification id), so a fixed id would record the FIRST occurrence and
      // silently drop every one after it.
      id: `crypto-dca-${input.currentWeek}`,
      title: '🔁 DCA Buys Executed',
      message: `${dcaFillCount} scheduled crypto purchase${dcaFillCount === 1 ? '' : 's'} completed.`,
    });
  }

  // --- 4) Yearly capital-gains tax — debit from checking on the year boundary.
  // 52-week game year. Tax rate: 25% of realized gains, scaled by the Tax
  // Strategy life skill. Losses don't generate a refund here.
  let capitalGainsTaxUSD = 0;
  if (input.currentWeek > 0 && input.currentWeek % TAX_YEAR_WEEKS === 0 && market.realizedGainsThisYear > 0) {
    const gains = market.realizedGainsThisYear;
    const effectiveRate = CAPITAL_GAINS_TAX_RATE * clampTaxMult(input.taxMult);
    const tax = gains * effectiveRate;
    // Debit from the authoritative cash pool (stats.money via cashDelta), not a
    // mirror account whose balance is overwritten every tick (which dodged the
    // tax entirely). Collect only what the player can afford this tick and carry
    // the untaxed portion of gains forward rather than zeroing them unpaid.
    const availableCashForTax = safe(input.cashIn, 0) + cashDelta;
    const collected = Math.max(0, Math.min(tax, availableCashForTax));
    capitalGainsTaxUSD = collected;
    if (collected > 0) {
      cashDelta -= collected;
      // Mirror the checking balance too so the same-tick UI matches.
      if (banking) {
        const checkingIdx = banking.accounts.findIndex((a) => a.type === 'checking');
        if (checkingIdx !== -1) {
          const checking = banking.accounts[checkingIdx];
          const accounts = [...banking.accounts];
          accounts[checkingIdx] = { ...checking, balance: Math.max(0, checking.balance - collected) };
          banking = { ...banking, accounts };
        }
      }
      notifications.push({
        // Week-keyed for the same reason as the DCA note above: a fixed id is
        // recorded once and then deduped forever, so every year after the first
        // would vanish from the journal.
        id: `crypto-tax-${input.currentWeek}`,
        title: '🧾 Capital Gains Tax',
        message: `Debited $${Math.round(collected).toLocaleString()} (${Math.round(effectiveRate * 100)}% of $${Math.round(gains).toLocaleString()} realized gains).`,
      });
    }
    // Reduce YTD realized gains only by the fraction actually taxed this year.
    // Divide by the EFFECTIVE rate, not the headline 25% — otherwise a player
    // with Tax Strategy clears less gain than they actually paid tax on and the
    // remainder is taxed a second time next year.
    const taxedGains = effectiveRate > 0 ? collected / effectiveRate : 0;
    market = { ...market, realizedGainsThisYear: Math.max(0, gains - taxedGains) };
  }

  // --- 5) Economy state tracking (for regime forcing memory) -------------
  if (input.economyState && input.economyState !== market.lastEconomyState) {
    market = { ...market, lastEconomyState: input.economyState };
  }

  // Update spread on each coin to reflect new regime (cosmetic; UI reads this).
  for (const coinId of Object.keys(market.coinMarkets || {})) {
    const cm = market.coinMarkets[coinId];
    const newSpread = bidAskSpreadForRegime(cm.regime);
    if (Math.abs(newSpread - cm.bidAskSpread) > 1e-9) {
      market = {
        ...market,
        coinMarkets: {
          ...market.coinMarkets,
          [coinId]: { ...cm, bidAskSpread: newSpread },
        },
      };
    }
  }

  return { market, cryptos, banking, cashDelta, capitalGainsTaxUSD, notifications };
}
