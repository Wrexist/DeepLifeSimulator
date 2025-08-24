export interface StockData {
  price: number;
  dividendYield: number;
}

const stocks: Record<string, StockData> = {
  aapl: { price: 178.2, dividendYield: 0.006 },
  msft: { price: 295.6, dividendYield: 0.008 },
  nvda: { price: 432.5, dividendYield: 0 },
  tsla: { price: 245.8, dividendYield: 0 },
  googl: { price: 142.3, dividendYield: 0 },
  meta: { price: 524.9, dividendYield: 0 },
  amzn: { price: 168.4, dividendYield: 0 },
  wmt: { price: 86.3, dividendYield: 0.015 },
  nflx: { price: 485.2, dividendYield: 0 },
};

export function simulateWeek() {
  Object.values(stocks).forEach(stock => {
    const changePercent = (Math.random() - 0.5) * 0.1; // -5% to +5%
    stock.price = Math.max(0.01, stock.price * (1 + changePercent));
  });
}

export function getStockInfo(id: string): StockData {
  return stocks[id] || { price: 0, dividendYield: 0 };
}

export function adjustStockPrice(id: string, factor: number) {
  const stock = getStockInfo(id);
  stock.price = Math.max(0.01, stock.price * factor);
}
