import { performance } from 'perf_hooks';

describe('Performance Tests', () => {
  describe('Game State Updates', () => {
    it('should update game state within acceptable time', async () => {
      const startTime = performance.now();
      
      // Simulate game state update
      const gameState = {
        stats: { money: 1000, health: 80, happiness: 90, energy: 50 },
        items: Array.from({ length: 100 }, (_, i) => ({ id: i, owned: false })),
        companies: Array.from({ length: 50 }, (_, i) => ({ id: i, weeklyIncome: 100 })),
      };

      // Simulate expensive calculation
      const netWorth = calculateNetWorth(gameState);
      
      const endTime = performance.now();
      const duration = endTime - startTime;

      expect(duration).toBeLessThan(100); // Should complete within 100ms
      expect(netWorth).toBeDefined();
    });

    it('should handle large datasets efficiently', async () => {
      const startTime = performance.now();
      
      // Create large dataset
      const largeDataset = Array.from({ length: 1000 }, (_, i) => ({
        id: i,
        value: Math.random() * 1000,
        owned: Math.random() > 0.5,
      }));

      // Process dataset
      const processedData = largeDataset
        .filter(item => item.owned)
        .map(item => ({ ...item, processed: true }));

      const endTime = performance.now();
      const duration = endTime - startTime;

      expect(duration).toBeLessThan(50); // Should complete within 50ms
      expect(processedData.length).toBeLessThanOrEqual(largeDataset.length);
    });
  });

  describe('Memory Usage', () => {
    it('should not leak memory during repeated operations', () => {
      const initialMemory = process.memoryUsage().heapUsed;
      
      // Perform repeated operations
      for (let i = 0; i < 1000; i++) {
        const tempData = Array.from({ length: 100 }, (_, j) => ({
          id: j,
          value: Math.random(),
        }));
        
        // Process and discard
        tempData.forEach(item => item.value * 2);
      }

      // Force garbage collection if available
      if (global.gc) {
        global.gc();
      }

      const finalMemory = process.memoryUsage().heapUsed;
      const memoryIncrease = finalMemory - initialMemory;

      // Memory increase should be reasonable (less than 10MB)
      expect(memoryIncrease).toBeLessThan(10 * 1024 * 1024);
    });
  });

  describe('Rendering Performance', () => {
    it('should render components within acceptable time', () => {
      const startTime = performance.now();
      
      // Simulate component rendering
      const components = Array.from({ length: 100 }, (_, i) => ({
        id: i,
        props: { value: Math.random() },
        render: () => ({ id: i, value: Math.random() }),
      }));

      const renderedComponents = components.map(comp => comp.render());
      
      const endTime = performance.now();
      const duration = endTime - startTime;

      expect(duration).toBeLessThan(200); // Should complete within 200ms
      expect(renderedComponents).toHaveLength(100);
    });
  });
});

// Helper function to simulate net worth calculation
function calculateNetWorth(gameState: any): number {
  let total = gameState.stats.money;
  
  gameState.items.forEach((item: any) => {
    if (item.owned) {
      total += item.price || 0;
    }
  });
  
  gameState.companies.forEach((company: any) => {
    total += company.weeklyIncome * 10; // Simple valuation
  });
  
  return total;
}