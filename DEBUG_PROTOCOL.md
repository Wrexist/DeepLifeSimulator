# DeepLifeSim Master Debug Protocol for AI Assistants

This document serves as the definitive debugging guide for AI assistants working on the DeepLifeSim codebase. Follow this protocol systematically for every bug investigation.

---

## Section 1: Issue Intake Template

When a debug session begins, gather this information:

```
ISSUE DESCRIPTION: [What's happening vs what should happen]
STEPS TO REPRODUCE: [Numbered steps]
EXPECTED BEHAVIOR: [What should happen]
ACTUAL BEHAVIOR: [What is happening]
ERROR MESSAGES: [Console errors, stack traces]
AFFECTED FILES: [Suspected files/components]
RECENT CHANGES: [What changed before the bug appeared]
```

---

## Section 2: Information Gathering Phase (MANDATORY BEFORE FIXES)

### 2.1 Context Understanding Checklist

- [ ] Read ALL files mentioned in the issue completely (no assumptions)
- [ ] Identify the component hierarchy (parent to child relationships)
- [ ] Trace data flow: state to props to render
- [ ] Determine if this is new feature code or existing code that broke
- [ ] Identify when the issue started and correlate with recent changes

### 2.2 State Management Verification

- [ ] Check for direct state mutation (VIOLATION: never mutate state)
- [ ] Verify functional updates: `setGameState(prev => ({ ...prev, ... }))`
- [ ] Confirm nested state properly spread: `...prev.feature!`
- [ ] Check for missing null/undefined checks on state properties
- [ ] Verify `saveGame()` called after state-changing actions
- [ ] Check migration logic exists for state structure changes in `migrateState()`

### 2.3 Type Safety Audit

- [ ] Verify types defined in `contexts/game/types.ts`
- [ ] Check for `any` type usage hiding bugs
- [ ] Verify interface properties match actual usage
- [ ] Check optional properties accessed with null checks
- [ ] Validate array operations use `(array || []).method()` pattern

---

## Section 3: Code Pattern Verification

### 3.1 React Hooks Compliance

- [ ] Event handlers wrapped in `useCallback` with correct dependencies
- [ ] Expensive calculations wrapped in `useMemo` with correct dependencies
- [ ] `useEffect` has proper dependency arrays (no missing dependencies)
- [ ] `useEffect` has cleanup for timers/intervals/subscriptions
- [ ] No hooks called conditionally or in loops

### 3.2 Component Structure Check

- [ ] Imports in correct order: React, third-party, internal contexts, components, utils, types
- [ ] Props interface properly defined
- [ ] Default props provided where needed
- [ ] Component uses `useGame()` hook correctly
- [ ] `LinearGradient` used for backgrounds with dark mode support

### 3.3 Styling and Responsive Design

- [ ] All dimensions use `scale()` from `@/utils/scaling`
- [ ] All font sizes use `fontScale()` from `@/utils/scaling`
- [ ] Dark mode variants exist for all colored elements
- [ ] `settings.darkMode` checked for conditional styling
- [ ] No hardcoded pixel values (exception: `GamingStreamingApp.tsx`)

### 3.4 Error Handling Verification

- [ ] Try/catch blocks around async operations
- [ ] `QuotaExceededError` handled for AsyncStorage operations
- [ ] User-friendly error messages via Alert
- [ ] Errors logged using `logger` utility
- [ ] Graceful fallbacks for missing/null data

---

## Section 4: Issue-Specific Investigation

### 4.1 State/Data Issues

- [ ] Check `contexts/game/initialState.ts` for correct defaults
- [ ] Verify `migrateState()` handles old save structures
- [ ] Check action functions in `contexts/game/actions/` folder
- [ ] Verify action returns correct success/failure response
- [ ] Check save/load cycle preserves data correctly

### 4.2 UI/Rendering Issues

- [ ] Check conditional rendering logic
- [ ] Verify key props on list items
- [ ] Check for missing `flex: 1` on containers
- [ ] Verify ScrollView/FlatList for long content
- [ ] Check z-index for overlay/modal issues

### 4.3 Performance Issues

- [ ] Check for unnecessary re-renders (missing memoization)
- [ ] Look for inline function definitions in render
- [ ] Check for inline object/array creation in props
- [ ] Verify large lists use FlatList not ScrollView with map
- [ ] Check for memory leaks (uncleaned timers/subscriptions)

### 4.4 Navigation Issues

- [ ] Verify screen registered in navigation stack
- [ ] Check navigation prop types
- [ ] Verify `onBack` callback properly passed
- [ ] Check navigation state persistence issues

### 4.5 Save/Load Issues

- [ ] Verify data structure matches type definitions
- [ ] Check migration logic in `migrateState()`
- [ ] Verify AsyncStorage key is correct
- [ ] Check for circular references in save data
- [ ] Verify `saveGame()` called at correct times

---

## Section 5: Common Bug Patterns Reference

### Pattern 1: Array Null Check Missing

```typescript
// BUG: Will crash if array undefined
state.items.filter(...)

// FIX: Always use null check
(state.items || []).filter(...)
```

### Pattern 2: Direct State Mutation

```typescript
// BUG: Mutating state directly
state.feature.value = newValue;
setGameState(state);

// FIX: Functional update with spread
setGameState(prev => ({
  ...prev,
  feature: {
    ...prev.feature!,
    value: newValue,
  },
}));
```

### Pattern 3: Missing saveGame Call

```typescript
// BUG: State changes but doesn't persist
setGameState(prev => ({ ...prev, money: prev.money + 100 }));

// FIX: Always save after state changes
setGameState(prev => ({ ...prev, money: prev.money + 100 }));
saveGame();
```

### Pattern 4: Missing Migration Logic

```typescript
// BUG: Old saves crash with new state structure

// FIX: Add migration in migrateState()
if (!state.newFeature) {
  state.newFeature = initialState.newFeature;
}
```

### Pattern 5: Missing Cleanup

```typescript
// BUG: Memory leak, timer keeps running
useEffect(() => {
  const timer = setInterval(() => {}, 1000);
}, []);

// FIX: Clean up on unmount
useEffect(() => {
  const timer = setInterval(() => {}, 1000);
  return () => clearInterval(timer);
}, []);
```

### Pattern 6: Missing useCallback

```typescript
// BUG: Causes unnecessary re-renders
const handlePress = () => { /* ... */ };

// FIX: Memoize handlers
const handlePress = useCallback(() => {
  // ...
}, [dependencies]);
```

---

## Section 6: Fix Implementation Checklist

### Before Implementing

- [ ] Understand root cause, not just symptom
- [ ] Can explain WHY the bug occurs
- [ ] Fix addresses root cause
- [ ] Fix does not break other functionality
- [ ] Fix follows all project patterns/rules

### During Implementation

- [ ] Follow state management patterns
- [ ] Add proper null/undefined checks
- [ ] Use correct scaling utilities
- [ ] Support dark mode
- [ ] Add proper error handling
- [ ] Use memoization where needed

### After Implementation

- [ ] Code compiles without TypeScript errors
- [ ] No new ESLint warnings introduced
- [ ] Migration logic added if state structure changed
- [ ] `saveGame()` called where needed
- [ ] Cleanup functions added for timers/subscriptions

---

## Section 7: Verification Testing Protocol

### 7.1 Functional Testing

- [ ] Bug no longer reproduces with original steps
- [ ] Feature works as expected
- [ ] Edge cases handled (empty arrays, null values)
- [ ] Error states handled gracefully

### 7.2 State Persistence Testing

- [ ] Save and reload game: data persists correctly
- [ ] New game starts with correct initial values
- [ ] Old saves migrate correctly
- [ ] No data corruption after multiple save/load cycles

### 7.3 UI Testing

- [ ] Light mode displays correctly
- [ ] Dark mode displays correctly
- [ ] Different screen sizes render properly
- [ ] Scrolling works for long content
- [ ] Touch interactions work correctly

### 7.4 Performance Testing

- [ ] No visible lag during interactions
- [ ] No memory warnings in console
- [ ] No excessive re-renders
- [ ] Timers/intervals clean up on unmount

### 7.5 Regression Testing

- [ ] Related features still work
- [ ] Parent/child components not affected
- [ ] Save/load of related data works
- [ ] No new console errors/warnings

---

## Section 8: AI Self-Assessment (Confidence Check)

Before proposing any fix, the AI must answer YES to all:

1. Am I 90%+ confident I understand the root cause?
2. Have I read ALL relevant code, not assumed?
3. Could there be other causes I have not considered?
4. Is my fix the simplest solution possible?
5. Have I checked if this pattern exists elsewhere (might need fix too)?

**If ANY answer is NO: Gather more information before proceeding.**

---

## Section 9: Key Files Reference

| Purpose | File Path |
|---------|-----------|
| Game State Types | `contexts/game/types.ts` |
| Initial State | `contexts/game/initialState.ts` |
| Game Actions Context | `contexts/game/GameActionsContext.tsx` |
| Action Functions | `contexts/game/actions/` |
| Scaling Utilities | `utils/scaling.ts` |
| Logger Utility | `utils/logger.ts` |
| UI/UX Context | `contexts/UIUXContext.tsx` |
| Tutorial System | `contexts/TutorialContext.tsx` |
| Toast Notifications | `contexts/ToastContext.tsx` |

---

## Section 10: Usage Instructions

1. Copy the Issue Intake Template when starting a debug session
2. Fill in all known issue details
3. Follow Sections 2-4 systematically before proposing fixes
4. Reference Section 5 for common patterns
5. Use Section 6 checklist during implementation
6. Complete Section 7 verification before marking complete
7. Always perform Section 8 self-assessment

**This protocol ensures thorough investigation and prevents fixing symptoms instead of root causes.**

---

## Section 11: Cross-System Integration Checks

### 11.1 Money System Integration

- [ ] Money changes use `updateMoney` from `MoneyActions.ts`
- [ ] Money changes update `dailySummary` for weekly report
- [ ] Large money values handled correctly (use `.toLocaleString()` for display)
- [ ] Money formatting uses suffixes (M, B, T, Q) for large amounts
- [ ] No NaN values introduced from calculations
- [ ] Prevent negative money unless debt is intentional

### 11.2 Stats System Integration

- [ ] Stats changes use `updateStats` from `StatsActions.ts`
- [ ] All stats clamped to 0-100 range
- [ ] Stats changes trigger appropriate gameplay effects
- [ ] Zero-stat consequences properly handled (death, jail, etc.)
- [ ] Stats displayed with correct formatting

### 11.3 Achievement & Progress System

- [ ] Achievements properly unlocked when conditions met
- [ ] Achievement progress tracked incrementally
- [ ] Prestige system evaluates correctly
- [ ] Goals progress updated when relevant actions occur
- [ ] Daily challenges track completion

### 11.4 Time Progression System

- [ ] `nextWeek` properly advances all time-based systems
- [ ] Passive income calculated from all sources
- [ ] Expenses deducted correctly
- [ ] Age-based events trigger at correct ages
- [ ] Weekly job limits reset each week
- [ ] Research progress advances weekly
- [ ] Patents expire after duration

### 11.5 Travel & Business System

- [ ] Passport required for international destinations
- [ ] Travel costs apply policy discounts
- [ ] Business opportunities unlock on first visit
- [ ] Trip return applies stat benefits
- [ ] Current trip prevents new travel

---

## Section 12: Data Consistency Checks

### 12.1 Type Consistency

- [ ] All properties in `types.ts` have matching entries in `initialState.ts`
- [ ] Optional properties (`?`) have fallback values in code
- [ ] Required properties never undefined
- [ ] Enum values match usage in code
- [ ] Array element types consistent with declarations

### 12.2 State Synchronization

- [ ] `company` and `companies` array stay in sync
- [ ] `travel?.currentTrip` cleared when trip ends
- [ ] Relationship scores updated bidirectionally
- [ ] Pet hunger/happiness decay processed weekly
- [ ] Disease effects applied correctly

### 12.3 Migration Completeness

- [ ] Every new field in `types.ts` has migration logic
- [ ] Removed fields cleaned up in migration
- [ ] Renamed fields mapped correctly
- [ ] Default values match `initialState.ts`
- [ ] `STATE_VERSION` incremented for breaking changes

---

## Section 13: Action Function Checklist

When creating or modifying action functions:

### 13.1 Function Signature

- [ ] Accepts `gameState` as first parameter
- [ ] Accepts `setGameState` as second parameter
- [ ] Dependencies injected to avoid circular imports
- [ ] Return type includes `{ success: boolean; message: string }`

### 13.2 Validation

- [ ] Check required state exists (not null/undefined)
- [ ] Verify user has required resources (money, energy, items)
- [ ] Check prerequisites met (education, level, etc.)
- [ ] Validate input parameters

### 13.3 State Updates

- [ ] Use functional update pattern
- [ ] Spread all nested objects correctly
- [ ] Apply null checks on arrays: `(array || [])`
- [ ] Don't mix multiple `setGameState` calls (race condition risk)
- [ ] Calculate values from prev state, not gameState closure

### 13.4 Side Effects

- [ ] Log important actions with `logger`
- [ ] Trigger achievements/goals when appropriate
- [ ] Update statistics tracking
- [ ] Show user feedback (toast/alert)

---

## Section 14: Common Cross-Cutting Concerns

### 14.1 Snapshot vs Closure State

```typescript
// BUG: Using stale state from closure
const handleAction = () => {
  const value = gameState.someValue; // Stale!
  setGameState(prev => ({
    ...prev,
    result: prev.someValue * 2, // Use prev, not closure value
  }));
};
```

### 14.2 Multiple State Updates Race Condition

```typescript
// BUG: Multiple setGameState calls can race
setGameState(prev => ({ ...prev, money: prev.money - 100 }));
setGameState(prev => ({ ...prev, items: [...prev.items, newItem] }));

// FIX: Combine into single update
setGameState(prev => ({
  ...prev,
  stats: { ...prev.stats, money: prev.stats.money - 100 },
  items: [...(prev.items || []), newItem],
}));
```

### 14.3 Action Return Consistency

```typescript
// BUG: Inconsistent return - sometimes void, sometimes object
if (error) return; // No return value

// FIX: Always return consistent structure
if (error) return { success: false, message: 'Error description' };
return { success: true, message: 'Action completed' };
```

---

## Section 15: Testing Checklist

### 15.1 New Game Test

- [ ] Start new game, verify all initial values correct
- [ ] Verify UI displays correctly with initial state
- [ ] Verify no errors in console
- [ ] Verify save creates valid file

### 15.2 Existing Save Test

- [ ] Load old save file
- [ ] Verify migration runs without errors
- [ ] Verify new features accessible
- [ ] Verify old data preserved

### 15.3 Edge Case Test

- [ ] Test with zero money
- [ ] Test with max stats (100)
- [ ] Test with empty arrays
- [ ] Test rapid repeated actions
- [ ] Test after 100+ weeks of gameplay

---

## Quick Reference: Critical Rules

| Rule | Description |
|------|-------------|
| **NEVER** | Mutate state directly |
| **ALWAYS** | Call `saveGame()` after state changes |
| **ALWAYS** | Add migration logic when changing state structure |
| **ALWAYS** | Use scaling utilities for responsive design |
| **ALWAYS** | Support dark mode in UI components |
| **ALWAYS** | Handle null/undefined for arrays and objects |
| **ALWAYS** | Clean up timers in useEffect cleanup |
| **ALWAYS** | Use `useCallback` for event handlers |
| **ALWAYS** | Use `useMemo` for expensive calculations |
| **ALWAYS** | Handle `QuotaExceededError` for storage operations |
| **ALWAYS** | Return consistent `{ success, message }` from actions |
| **ALWAYS** | Use `prev` state in setGameState callbacks, not closure |
| **ALWAYS** | Combine multiple state updates into single call |
| **ALWAYS** | Validate inputs before processing |
| **ALWAYS** | Log important actions for debugging |

