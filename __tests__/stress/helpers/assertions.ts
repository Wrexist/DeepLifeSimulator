/**
 * Custom assertions for game state validation
 */

/**
 * Verify a stat is within valid bounds (0-100)
 */
export function expectStatInBounds(stat: number, name: string) {
  expect(stat).toBeGreaterThanOrEqual(0);
  expect(stat).toBeLessThanOrEqual(100);
  expect(stat).not.toBeNaN();

  if (stat < 0 || stat > 100) {
    throw new Error(`Stat ${name} out of bounds: ${stat}`);
  }
}

/**
 * Recursively check for NaN values in an object
 */
export function expectNoNaN(state: any, path: string = 'root') {
  const checkForNaN = (obj: any, currentPath: string) => {
    if (obj === null || obj === undefined) {
      return;
    }

    if (typeof obj === 'number') {
      if (isNaN(obj)) {
        throw new Error(`NaN found at ${currentPath}`);
      }
      expect(obj).not.toBeNaN();
      return;
    }

    if (typeof obj === 'object') {
      if (Array.isArray(obj)) {
        obj.forEach((item, index) => {
          checkForNaN(item, `${currentPath}[${index}]`);
        });
      } else {
        Object.keys(obj).forEach((key) => {
          checkForNaN(obj[key], `${currentPath}.${key}`);
        });
      }
    }
  };

  checkForNaN(state, path);
}

/**
 * Check for Infinity values in an object
 */
export function expectNoInfinity(state: any, path: string = 'root') {
  const checkForInfinity = (obj: any, currentPath: string) => {
    if (obj === null || obj === undefined) {
      return;
    }

    if (typeof obj === 'number') {
      if (!isFinite(obj)) {
        throw new Error(`Infinity found at ${currentPath}: ${obj}`);
      }
      expect(obj).not.toBe(Infinity);
      expect(obj).not.toBe(-Infinity);
      return;
    }

    if (typeof obj === 'object') {
      if (Array.isArray(obj)) {
        obj.forEach((item, index) => {
          checkForInfinity(item, `${currentPath}[${index}]`);
        });
      } else {
        Object.keys(obj).forEach((key) => {
          checkForInfinity(obj[key], `${currentPath}.${key}`);
        });
      }
    }
  };

  checkForInfinity(state, path);
}

/**
 * Verify age is within valid range
 */
export function expectValidAge(age: number) {
  expect(age).toBeGreaterThanOrEqual(0);
  expect(age).toBeLessThan(150);
  expect(age).not.toBeNaN();

  if (age < 0 || age >= 150 || isNaN(age)) {
    throw new Error(`Invalid age: ${age}`);
  }
}

/**
 * Verify price index is reasonable
 */
export function expectValidPriceIndex(priceIndex: number, maxYears: number = 100) {
  const maxExpected = Math.pow(1.03, maxYears); // 3% annual inflation

  expect(priceIndex).toBeGreaterThan(0);
  expect(priceIndex).toBeLessThan(maxExpected * 2); // Allow some margin
  expect(priceIndex).not.toBeNaN();
  expect(priceIndex).not.toBe(Infinity);
}

/**
 * Verify all stats in GameState are valid
 */
export function expectAllStatsValid(stats: any) {
  const statNames = ['health', 'happiness', 'energy', 'fitness', 'reputation'];

  statNames.forEach((statName) => {
    if (stats[statName] !== undefined) {
      expectStatInBounds(stats[statName], statName);
    }
  });

  // Money and gems can be any non-negative number
  if (stats.money !== undefined) {
    expect(stats.money).toBeGreaterThanOrEqual(0);
    expect(stats.money).not.toBeNaN();
  }

  if (stats.gems !== undefined) {
    expect(stats.gems).toBeGreaterThanOrEqual(0);
    expect(stats.gems).not.toBeNaN();
  }
}

/**
 * Verify game state has no numerical issues
 */
export function expectNumericalStability(state: any) {
  expectNoNaN(state);
  expectNoInfinity(state);

  if (state.stats) {
    expectAllStatsValid(state.stats);
  }

  if (state.date?.age !== undefined) {
    expectValidAge(state.date.age);
  }
}
