export interface StockData {
  price: number;
  dividendYield: number;
}

const stocks: Record<string, StockData> = {
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

export function simulateWeek(policyEffects?: {
  volatilityModifier?: number;
  dividendBonus?: number;
  companyBoost?: string[];
}) {
  const symbols = Object.keys(stocks);
  const len = symbols.length;
  
  // Apply policy effects
  const volatilityModifier = policyEffects?.volatilityModifier ?? 1;
  const dividendBonus = policyEffects?.dividendBonus ?? 0;
  const companyBoost = policyEffects?.companyBoost ?? [];
  
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
    // Box-Muller transform
    const u1 = Math.random();
    const u2 = Math.random();
    const z = Math.sqrt(-2.0 * Math.log(u1)) * Math.cos(2.0 * Math.PI * u2);
    
    // Convert to percentage change with the stock's volatility
    let changePercent = z * volatility;
    
    // Apply company boost
    changePercent = changePercent * boostFactor;
    
    // Apply the change, ensuring price doesn't go below $0.01
    stock.price = Math.max(0.01, stock.price * (1 + changePercent));
    
    // Apply dividend bonus from policies
    if (stock.dividendYield > 0 && dividendBonus > 0) {
      stock.dividendYield = Math.min(0.1, stock.dividendYield + dividendBonus); // Cap at 10%
    }
    
    // Round to 2 decimal places for realistic pricing
    stock.price = Math.round(stock.price * 100) / 100;
  }
}

export function getStockInfo(id: string): StockData {
  return stocks[id] || { price: 0, dividendYield: 0 };
}

export function adjustStockPrice(id: string, factor: number) {
  const stock = stocks[id];
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
