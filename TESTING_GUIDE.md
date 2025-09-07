# 🧪 Testing Guide för DeeplifeSim

## 📋 Översikt

Detta dokument beskriver teststrategin och implementeringen för DeeplifeSim. Vi använder en flernivå teststrategi för att säkerställa kodkvalitet och applikationsstabilitet.

## 🎯 Teststrategi

### Testpyramid
```
    E2E Tests (10%)
   ┌─────────────┐
   │Integration  │ (20%)
   │   Tests     │
   └─────────────┘
   ┌─────────────┐
   │  Unit Tests │ (70%)
   │             │
   └─────────────┘
```

## 📁 Teststruktur

```
├── lib/
│   ├── economy/__tests__/
│   │   ├── expenses.test.ts
│   │   ├── inflation.test.ts
│   │   └── passiveIncome.test.ts
│   ├── gameLogic/__tests__/
│   │   ├── career.test.ts
│   │   └── stats.test.ts
│   └── progress/__tests__/
│       └── saveLoad.test.ts
├── __tests__/
│   ├── e2e/
│   │   └── gameFlow.test.ts
│   └── performance/
│       └── performance.test.ts
├── jest.config.js
├── jest.setup.js
└── TESTING_GUIDE.md
```

## 🧩 Testtyper

### 1. Unit Tests (70%)

**Syfte:** Testa enskilda funktioner och komponenter i isolering.

**Plats:** `lib/**/__tests__/`

**Exempel:**
```typescript
describe('Career Logic', () => {
  it('should check if player meets fitness requirements', () => {
    const state = createGameState({
      stats: { fitness: 35 }
    });
    
    const career = state.careers[0];
    const meetsFitness = state.stats.fitness >= career.requirements.fitness;
    
    expect(meetsFitness).toBe(true);
  });
});
```

**Täckning:** 70% av alla funktioner, branches, lines och statements.

### 2. Integration Tests (20%)

**Syfte:** Testa interaktion mellan olika systemkomponenter.

**Plats:** `lib/progress/__tests__/saveLoad.test.ts`

**Exempel:**
```typescript
describe('Save/Load Integration Tests', () => {
  it('should save and load game state successfully', async () => {
    const gameState = createGameState();
    await saveGame('test_slot', gameState);
    const loadedState = await loadGame('test_slot');
    
    expect(loadedState).toEqual(gameState);
  });
});
```

### 3. E2E Tests (10%)

**Syfte:** Testa kompletta användarflöden från början till slut.

**Plats:** `__tests__/e2e/`

**Exempel:**
```typescript
describe('E2E Game Flow Tests', () => {
  it('should complete a basic week cycle', () => {
    const gameManager = new GameStateManager(initialState);
    
    gameManager.work();
    gameManager.exercise();
    gameManager.socialize();
    gameManager.nextWeek();
    
    expect(gameManager.getState().week).toBe(2);
  });
});
```

### 4. Performance Tests

**Syfte:** Säkerställa att appen presterar bra under belastning.

**Plats:** `__tests__/performance/`

**Exempel:**
```typescript
describe('Performance Tests', () => {
  it('should serialize game state within 10ms', () => {
    const iterations = 100;
    const startTime = performance.now();
    
    for (let i = 0; i < iterations; i++) {
      JSON.stringify(largeGameState);
    }
    
    const avgTime = (performance.now() - startTime) / iterations;
    expect(avgTime).toBeLessThan(10);
  });
});
```

## 🚀 Testkommandon

### Grundläggande kommandon
```bash
# Kör alla tester
npm test

# Kör tester i watch mode
npm run test:watch

# Kör tester med coverage
npm run test:coverage

# Kör specifika testtyper
npm run test:unit
npm run test:integration
npm run test:e2e
npm run test:performance

# Kör tester för CI
npm run test:ci
```

### Linting och Type Checking
```bash
# Lint kod
npm run lint

# Fixa linting errors
npm run lint:fix

# TypeScript type checking
npm run type-check
```

## 📊 Coverage Krav

### Minimum Coverage
- **Branches:** 70%
- **Functions:** 70%
- **Lines:** 70%
- **Statements:** 70%

### Coverage Report
```bash
npm run test:coverage
```

Detta genererar en HTML-rapport i `coverage/lcov-report/index.html`

## 🛠️ Testverktyg

### Jest Configuration
```javascript
// jest.config.js
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  collectCoverageFrom: [
    'lib/**/*.{ts,tsx}',
    'components/**/*.{ts,tsx}',
    'contexts/**/*.{ts,tsx}',
    'hooks/**/*.{ts,tsx}',
    'utils/**/*.{ts,tsx}',
  ],
  coverageThreshold: {
    global: {
      branches: 70,
      functions: 70,
      lines: 70,
      statements: 70,
    },
  },
};
```

### Test Setup
```javascript
// jest.setup.js
// Mock React Native och Expo modules
jest.mock('@react-native-async-storage/async-storage');
jest.mock('expo-router');
jest.mock('expo-linear-gradient');
```

## 📝 Test Best Practices

### 1. Testnamn
```typescript
// ✅ Bra
it('should calculate weekly expenses correctly', () => {
  // test implementation
});

// ❌ Dåligt
it('test1', () => {
  // test implementation
});
```

### 2. Arrange-Act-Assert Pattern
```typescript
describe('Game Logic', () => {
  it('should handle money transactions', () => {
    // Arrange
    const gameState = createGameState({ money: 1000 });
    
    // Act
    const result = addMoney(gameState, 500);
    
    // Assert
    expect(result.money).toBe(1500);
  });
});
```

### 3. Test Isolation
```typescript
describe('Game State', () => {
  let gameState: GameState;
  
  beforeEach(() => {
    gameState = createGameState();
  });
  
  afterEach(() => {
    // Cleanup if needed
  });
});
```

### 4. Mocking
```typescript
// Mock external dependencies
jest.mock('@react-native-async-storage/async-storage', () => ({
  setItem: jest.fn(() => Promise.resolve()),
  getItem: jest.fn(() => Promise.resolve(null)),
}));
```

## 🔍 Testning av Specifika Komponenter

### Game Logic
```typescript
// lib/gameLogic/__tests__/career.test.ts
describe('Career Logic', () => {
  describe('Requirements', () => {
    it('should check fitness requirements');
    it('should check education requirements');
    it('should check reputation requirements');
  });
  
  describe('Progression', () => {
    it('should calculate salary correctly');
    it('should allow promotions');
    it('should prevent over-promotion');
  });
});
```

### Save/Load System
```typescript
// lib/progress/__tests__/saveLoad.test.ts
describe('Save/Load System', () => {
  describe('Save Operations', () => {
    it('should save game state');
    it('should handle save errors');
    it('should overwrite existing saves');
  });
  
  describe('Load Operations', () => {
    it('should load game state');
    it('should handle corrupted data');
    it('should return null for missing saves');
  });
});
```

### Performance
```typescript
// __tests__/performance/performance.test.ts
describe('Performance Tests', () => {
  describe('Game State Operations', () => {
    it('should serialize within 10ms');
    it('should deserialize within 5ms');
    it('should clone within 15ms');
  });
  
  describe('Array Operations', () => {
    it('should filter 100 items within 0.1ms');
    it('should map 100 items within 0.2ms');
  });
});
```

## 🐛 Debugging Tests

### Verbose Output
```bash
npm test -- --verbose
```

### Debug Specific Test
```bash
npm test -- --testNamePattern="should calculate weekly expenses"
```

### Debug with Console
```typescript
it('should debug test', () => {
  console.log('Debug info:', someVariable);
  expect(result).toBe(expected);
});
```

## 📈 Continuous Integration

### GitHub Actions Workflow
```yaml
name: Tests
on: [push, pull_request]
jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v2
      - uses: actions/setup-node@v2
      - run: npm install
      - run: npm run test:ci
      - run: npm run lint
      - run: npm run type-check
```

### Pre-commit Hooks
```json
{
  "husky": {
    "hooks": {
      "pre-commit": "npm run test:unit && npm run lint",
      "pre-push": "npm run test:ci"
    }
  }
}
```

## 🎯 Test Metrics

### Kvalitetsindikatorer
- **Test Coverage:** 70%+
- **Test Execution Time:** < 30 sekunder
- **Test Reliability:** 99%+ (inga flaky tests)
- **Performance Benchmarks:** Alla gränser uppfyllda

### Rapportering
```bash
# Generera testrapport
npm run test:coverage

# Exportera till CI
npm run test:ci -- --coverage --watchAll=false
```

## 🔄 Test Maintenance

### Regelbundna uppgifter
1. **Daglig:** Kör unit tests
2. **Veckan:** Kör integration tests
3. **Månadsvis:** Kör performance tests
4. **Vid release:** Kör alla tester + E2E

### Test Refactoring
```typescript
// Före refactoring
it('should test everything', () => {
  // 100+ rader test kod
});

// Efter refactoring
describe('Complex Feature', () => {
  it('should handle case A', () => {
    // 10-20 rader
  });
  
  it('should handle case B', () => {
    // 10-20 rader
  });
});
```

## 📚 Resurser

### Dokumentation
- [Jest Documentation](https://jestjs.io/docs/getting-started)
- [React Native Testing](https://reactnative.dev/docs/testing)
- [TypeScript Testing](https://www.typescriptlang.org/docs/handbook/testing.html)

### Verktyg
- **Jest:** Test framework
- **ts-jest:** TypeScript support
- **@testing-library/react-native:** React Native testing utilities

### Exempel
- Se `lib/economy/__tests__/` för unit test exempel
- Se `__tests__/e2e/` för E2E test exempel
- Se `__tests__/performance/` för performance test exempel

---

**Kom ihåg:** Bra tester är som dokumentation som aldrig blir föråldrad. De hjälper dig att förstå koden och säkerställa att den fungerar som förväntat! 🚀
