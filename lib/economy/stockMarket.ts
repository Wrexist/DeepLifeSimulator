export interface StockData {
  price: number;
  dividendYield: number;
}

const DEFAULT_PRICES: Record<string, StockData> = {
  AAPL: { price: 150.25, dividendYield: 0.006 },
  GOOGL: { price: 2750.80, dividendYield: 0.0 },
  MSFT: { price: 310.45, dividendYield: 0.008 },
  TSLA: { price: 245.67, dividendYield: 0.0 },
  AMZN: { price: 145.82, dividendYield: 0.0 },
  META: { price: 324.15, dividendYield: 0.0 },
  NVDA: { price: 432.50, dividendYield: 0.0 },
  NFLX: { price: 485.20, dividendYield: 0.0 },
  WMT: { price: 86.30, dividendYield: 0.015 },
  JPM: { price: 142.85, dividendYield: 0.025 },
  JNJ: { price: 158.90, dividendYield: 0.028 },
  PG: { price: 152.40, dividendYield: 0.024 },
  KO: { price: 58.75, dividendYield: 0.031 },
  DIS: { price: 89.45, dividendYield: 0.0 },
  V: { price: 245.80, dividendYield: 0.008 },
  MA: { price: 412.30, dividendYield: 0.005 },
  HD: { price: 298.75, dividendYield: 0.022 },
  BA: { price: 185.60, dividendYield: 0.0 },
  CAT: { price: 298.40, dividendYield: 0.018 },
  IBM: { price: 142.30, dividendYield: 0.048 },
};

// Mutable stock state — initialized from defaults, restored from save via restoreStockPrices()
const stocks: Record<string, StockData> = {};
Object.entries(DEFAULT_PRICES).forEach(([symbol, data]) => {
  stocks[symbol] = { ...data };
});

// --- Seeded PRNG (Mulberry32) to prevent save/reload stock price manipulation ---
// Same weeksLived + symbol always produces the same price change
function mulberry32(seed: number): () => number {
  let s = seed | 0;
  return () => {
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// FNV-1a hash for combining weeksLived + stock index into a unique seed
function hashSeed(weeksLived: number, index: number): number {
  let hash = 2166136261;
  const combined = `${weeksLived}:${index}`;
  for (let i = 0; i < combined.length; i++) {
    hash ^= combined.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

// Pre-calculate volatility map to avoid recalculation every tick
const volatilityMap: Record<string, number> = {};

Object.keys(stocks).forEach(symbol => {
  // High volatility stocks (tech, growth stocks)
  if (['TSLA', 'NVDA', 'META', 'NFLX'].includes(symbol)) {
    volatilityMap[symbol] = 0.08; // 8% volatility
  }
  // Medium volatility stocks
  else if (['AAPL', 'GOOGL', 'MSFT', 'AMZN'].includes(symbol)) {
    volatilityMap[symbol] = 0.06; // 6% volatility
  }
  // Low volatility stocks (blue chips, dividend stocks)
  else if (['JPM', 'JNJ', 'PG', 'KO', 'WMT', 'V', 'MA', 'HD', 'CAT', 'IBM'].includes(symbol)) {
    volatilityMap[symbol] = 0.04; // 4% volatility
  }
  else {
    volatilityMap[symbol] = 0.05; // Default 5% volatility
  }
});

/**
 * Restore stock prices from saved game state.
 * Call this when loading a save to sync module-level prices with persisted data.
 */
export function restoreStockPrices(savedPrices: Record<string, { price: number; dividendYield?: number }>) {
  if (!savedPrices || typeof savedPrices !== 'object') return;
  Object.entries(savedPrices).forEach(([symbol, data]) => {
    // ANTI-EXPLOIT (B-6): Normalize to uppercase to match stock key format
    const normalizedSymbol = symbol?.toUpperCase() ?? '';
    if (stocks[normalizedSymbol] && typeof data?.price === 'number' && isFinite(data.price) && data.price > 0) {
      stocks[normalizedSymbol].price = data.price;
      if (typeof data.dividendYield === 'number' && isFinite(data.dividendYield) && data.dividendYield >= 0) {
        stocks[normalizedSymbol].dividendYield = data.dividendYield;
      }
    }
  });
}

/**
 * Get a snapshot of current prices for persistence in game state.
 */
export function getStockPricesSnapshot(): Record<string, { price: number; dividendYield: number }> {
  const snapshot: Record<string, { price: number; dividendYield: number }> = {};
  Object.entries(stocks).forEach(([symbol, data]) => {
    snapshot[symbol] = { price: data.price, dividendYield: data.dividendYield };
  });
  return snapshot;
}

/**
 * Reset stock prices to defaults (used on prestige/new game).
 */
export function resetStockPrices() {
  Object.entries(DEFAULT_PRICES).forEach(([symbol, data]) => {
    stocks[symbol] = { ...data };
  });
}

/**
 * Simulate one week of stock market price changes.
 * ANTI-EXPLOIT: Uses seeded PRNG based on weeksLived so that the same week
 * always produces the same price changes regardless of save/reload.
 */
export function simulateWeek(policyEffects?: {
  volatilityModifier?: number;
  dividendBonus?: number;
  companyBoost?: string[];
}, weeksLived?: number) {
  const symbols = Object.keys(stocks);
  const len = symbols.length;

  // Apply policy effects
  const volatilityModifier = policyEffects?.volatilityModifier ?? 1;
  const dividendBonus = policyEffects?.dividendBonus ?? 0;
  const companyBoost = policyEffects?.companyBoost ?? [];

  // Use weeksLived for deterministic seeding; fall back to Math.random() only if not provided
  const useSeededRng = typeof weeksLived === 'number' && isFinite(weeksLived) && weeksLived >= 0;

  for (let i = 0; i < len; i++) {
    const symbol = symbols[i];
    const stock = stocks[symbol];
    let volatility = volatilityMap[symbol];

    // Apply volatility modifier from policies
    volatility *= volatilityModifier;

    // Apply company boost (slight positive bias for boosted companies)
    const isBoosted = companyBoost.includes(symbol);
    const boostFactor = isBoosted ? 1.02 : 1.0; // 2% positive bias

    // Generate random price change with normal distribution approximation
    // Box-Muller transform (clamp u1 away from 0 to prevent Math.log(0) = -Infinity)
    let u1: number, u2: number;
    if (useSeededRng) {
      // Seeded PRNG: same weeksLived + stock index = same price change every time
      const rng = mulberry32(hashSeed(weeksLived, i));
      u1 = Math.max(Number.EPSILON, rng());
      u2 = rng();
    } else {
      u1 = Math.max(Number.EPSILON, Math.random());
      u2 = Math.random();
    }
    const z = Math.sqrt(-2.0 * Math.log(u1)) * Math.cos(2.0 * Math.PI * u2);

    // Guard against NaN/Infinity from edge-case random values
    if (!isFinite(z)) continue;

    // Convert to percentage change with the stock's volatility
    let changePercent = z * volatility;

    // Apply company boost
    changePercent = changePercent * boostFactor;

    // Guard against extreme changes that could corrupt prices
    if (!isFinite(changePercent)) continue;

    // CRASH FIX (B-2): Apply the change with floor AND ceiling to prevent overflow
    const MAX_STOCK_PRICE = 1_000_000; // $1M per share max — triggers conceptual "split"
    let newPrice = stock.price * (1 + changePercent);
    // Guard against NaN/Infinity from edge-case calculations
    if (!isFinite(newPrice) || isNaN(newPrice)) {
      newPrice = stock.price; // Keep previous price if calculation corrupted
    }
    stock.price = Math.max(0.01, Math.min(MAX_STOCK_PRICE, newPrice));

    // Apply dividend bonus from policies
    if (stock.dividendYield > 0 && dividendBonus > 0) {
      stock.dividendYield = Math.min(0.1, stock.dividendYield + dividendBonus); // Cap at 10%
    }

    // Round to 2 decimal places for realistic pricing
    stock.price = Math.round(stock.price * 100) / 100;
  }
}

export function getStockInfo(id: string): StockData {
  // ANTI-EXPLOIT (B-6): Normalize to uppercase — stock keys are uppercase (AAPL, GOOGL, etc.)
  // Prevents silent zero-dividend from case mismatch (e.g., 'aapl' vs 'AAPL')
  const normalizedId = id?.toUpperCase() ?? '';
  return stocks[normalizedId] || { price: 0, dividendYield: 0 };
}

export function adjustStockPrice(id: string, factor: number) {
  // ANTI-EXPLOIT (B-6): Normalize to uppercase to match stock key format
  const normalizedId = id?.toUpperCase() ?? '';
  const stock = stocks[normalizedId];
  if (stock) {
    stock.price = Math.max(0.01, stock.price * factor);
  }
}

export function getAllStockSymbols(): string[] {
  return Object.keys(stocks);
}

export function getAllStocks(): Record<string, StockData> {
  // Return a copy to prevent direct mutation outside this module
  // Deep copy not needed as StockData is simple object, but shallow copy of Record is needed
  return { ...stocks };
}
