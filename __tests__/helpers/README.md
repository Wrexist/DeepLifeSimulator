# Test Helpers

## GameState Factory

### `createTestGameState(overrides?: Partial<GameState>): GameState`

**Purpose**: Creates a complete, valid GameState object for testing.

**Why This Exists**:
- Prevents test-only GameState breakage
- Ensures tests use the same structure as production code
- Automatically includes all required properties
- Type-safe - fails at compile time if GameState changes

**Usage**:
```typescript
import { createTestGameState } from '@/__tests__/helpers/createTestGameState';

// Minimal override
const state = createTestGameState({
  stats: { money: 5000 },
  week: 10
});

// Multiple overrides
const state = createTestGameState({
  stats: { money: 10000, health: 80 },
  careers: [mockCareer],
  week: 20
});
```

**Key Benefits**:
1. **Single Source of Truth**: Uses `initialGameState` as base
2. **Deep Merging**: Properly merges nested objects (stats, date, settings, etc.)
3. **Type Safety**: TypeScript ensures all required properties exist
4. **Future-Proof**: When GameState changes, tests fail at compile time, not runtime

### `assertValidGameState(state: GameState): asserts state is GameState`

**Purpose**: Runtime validation that GameState is complete.

**Usage**:
```typescript
const state = createTestGameState({ week: 10 });
assertValidGameState(state); // Throws if incomplete
```

**When to Use**:
- In test setup to catch incomplete GameState early
- When receiving GameState from external sources
- As a safety check in test utilities

## Migration Guide

### Before (❌ Bad - Incomplete GameState)
```typescript
function createGameState(overrides: Partial<GameState> = {}): GameState {
  return {
    stats: { money: 1000 },
    week: 1,
    // ... missing many required properties
    ...overrides,
  } as GameState; // Dangerous type assertion
}
```

### After (✅ Good - Complete GameState)
```typescript
import { createTestGameState } from '@/__tests__/helpers/createTestGameState';

function createGameState(overrides: Partial<GameState> = {}): GameState {
  return createTestGameState(overrides);
}
```

## Rules

1. **NEVER** use `as GameState` to bypass type checking
2. **ALWAYS** use `createTestGameState()` for test GameState creation
3. **NEVER** manually construct GameState objects in tests
4. **ALWAYS** import from the shared helper, don't duplicate

## Why This Prevents Future Issues

### Compile-Time Safety
- If GameState interface changes, TypeScript will error
- Tests must be updated to match new GameState structure
- No silent failures or runtime errors

### Single Source of Truth
- All tests use the same factory
- Changes to GameState structure only need to be fixed in one place
- Consistent test state across all test files

### No Type Assertions
- No `as GameState` needed
- TypeScript guarantees correctness
- Runtime validation available if needed

