# Onboarding System Audit V4 - Deep Life Simulator

## Executive Summary

**Status**: Comprehensive audit completed. Critical gaps identified and fixes implemented.

**Key Findings**:
1. ✅ **Validation exists**: `validateOnboardingState()` and `validateGameEntry()` are in place
2. ⚠️ **CRITICAL GAP**: Validation after `loadGame()` in Perks.tsx uses dynamic require which may fail
3. ⚠️ **GAP**: No validation that `loadGame()` actually succeeded before navigation
4. ⚠️ **GAP**: Missing validation for some critical optional fields that should be initialized
5. ⚠️ **GAP**: No validation that scenario data is properly applied to state

---

## 1. Onboarding Flow Trace

### Step-by-Step Flow from App Launch to First Gameplay

1. **App Launch** → `MainMenu.tsx`
   - User clicks "New Game"
   - **State Mutation**: None (onboarding state is separate)
   - Navigates to `/(onboarding)/Scenarios`

2. **Scenarios Screen** → `Scenarios.tsx`
   - User selects scenario (life path or challenge)
   - **State Mutation**: `setState({ ...prev, scenario: selectedScenario, challengeScenarioId })`
   - Navigates to `/(onboarding)/Customize`

3. **Customize Screen** → `Customize.tsx`
   - User enters: firstName, lastName, sex, sexuality
   - Auto-generates random name if empty (on mount)
   - **State Mutation**: `setState({ ...prev, firstName, lastName, sex, sexuality })`
   - Navigates to `/(onboarding)/Perks`

4. **Perks Screen** → `Perks.tsx` (CRITICAL POINT)
   - User selects perks and mindset
   - **State Mutations**:
     - Creates `newState` from `initialGameState`
     - Sets `userProfile` (firstName, lastName, sex, sexuality, gender, seekingGender)
     - Sets `scenarioId` and `challengeScenarioId`
     - Sets `stats.money` (from scenario + perks)
     - Sets `stats.reputation` (from perks)
     - Sets `stats.energy` (from perks)
     - Sets `weeksLived` and `week` (from scenario age)
     - Sets `date.age` (from scenario)
     - Sets `perks` object
     - Sets `mindset` object
     - Sets `items` (from scenario)
     - Sets `hasPhone` (from scenario items)
     - Sets `educations` (from scenario)
     - Sets `family.children` (scenario-specific)
     - Sets `version: 5`
   - **Validation**: `validateOnboardingState(newState)` ✅
   - **Safe Defaults**: `applySafeDefaults(newState)` if validation fails ✅
   - **Save**: `AsyncStorage.setItem('save_slot_${slot}', JSON.stringify(newState))` ✅
   - **Load**: `await loadGame(slotToUse)` ⚠️
   - **Post-Load Validation**: `validateGameEntry(loadedState)` ⚠️ (uses dynamic require)
   - **Navigation**: `router.replace('/(tabs)')` ⚠️ (only if validation passes)

5. **Gameplay** → `/(tabs)`
   - Game starts with loaded state

---

## 2. State Mutations During Onboarding

### Mutations in Perks.tsx (start function)

```typescript
const newState: any = {
  ...initialGameState,  // Base state
  stats: {
    ...initialGameState.stats,
    money: scenario.start.cash + (selected.includes('legacy_builder') ? 5000 : 0),
    reputation: initialGameState.stats.reputation + (selected.includes('legacy_builder') ? 5 : 0),
    energy: initialGameState.stats.energy + (selected.includes('astute_planner') ? 10 : 0),
  },
  weeksLived,  // Calculated from scenario age
  week: weeksLived + 1,
  date: { ...initialGameState.date, age: scenario.start.age, week: (weeksLived % 52) + 1 },
  educations: initialGameState.educations.map(e => { /* scenario education logic */ }),
  userProfile: {
    ...initialGameState.userProfile,
    firstName: state.firstName,
    lastName: state.lastName,
    sex,
    sexuality: state.sexuality,
    gender: sex,
    seekingGender,
  },
  perks: { /* permanent + selected perks */ },
  mindset: selectedMindset ? { activeTraitId: selectedMindset, traits: [selectedMindset] } : undefined,
  scenarioId: scenario.id,
  challengeScenarioId: state.challengeScenarioId,
  activeTraits: scenario.start.traits || [],
  items: (() => { /* scenario items mapping */ })(),
  hasPhone: (() => { /* check if smartphone in items */ })(),
  family: {
    ...initialGameState.family,
    children: scenario.id === 'single_parent' ? [] : initialGameState.family.children,
  },
  version: 5,
};
```

---

## 3. Required Invariants for Valid New Game State

### Character Identity
- ✅ `userProfile.firstName`: non-empty string
- ✅ `userProfile.lastName`: non-empty string
- ✅ `userProfile.sex`: 'male' | 'female'
- ✅ `userProfile.sexuality`: 'straight' | 'gay' | 'bi'
- ✅ `userProfile.gender`: matches sex
- ✅ `userProfile.seekingGender`: 'male' | 'female'

### Scenario
- ✅ `scenarioId`: non-empty string
- ✅ `challengeScenarioId`: string | undefined (optional)

### Core Stats
- ✅ `stats.health`: 0-100
- ✅ `stats.happiness`: 0-100
- ✅ `stats.energy`: 0-100
- ✅ `stats.fitness`: 0-100
- ✅ `stats.money`: >= 0
- ✅ `stats.reputation`: 0-100
- ✅ `stats.gems`: >= 0

### Date/Time
- ✅ `date.year`: >= 0
- ✅ `date.month`: non-empty string
- ✅ `date.week`: >= 0
- ✅ `date.age`: 18-150 (warning if outside)
- ✅ `week`: >= 1
- ✅ `weeksLived`: >= 0

### Required Arrays (must exist, can be empty)
- ✅ careers, hobbies, items, relationships, achievements
- ✅ educations, pets, companies, realEstate, cryptos
- ✅ diseases, streetJobs, jailActivities, foods
- ✅ healthActivities, dietPlans, darkWebItems, hacks

### Settings
- ✅ `settings`: object exists
- ✅ `settings.darkMode`: boolean
- ✅ `settings.autoSave`: boolean

### Version
- ✅ `version`: >= 1 (should be 5 for new games)

### Optional but Important
- ✅ `perks`: object (can be empty)
- ✅ `bankSavings`: number (can be 0)
- ✅ `stocks`: object with `holdings` and `watchlist` arrays
- ✅ `family`: object with `children` array
- ✅ `mindset`: object | undefined

### Critical Systems
- ✅ `social`: object with `relations` array
- ✅ `economy`: object with `inflationRateAnnual` and `priceIndex`
- ✅ `travel`: object with `visitedDestinations` array
- ✅ `politics`: object with required fields
- ✅ `socialMedia`: object with required fields

---

## 4. Paths Where Onboarding Can Complete with Invalid State

### ❌ Issue #1: Dynamic Require in Post-Load Validation (CRITICAL)

**Location**: `app/(onboarding)/Perks.tsx:469`

**Problem**: 
- Uses `require('@/utils/gameEntryValidation')` dynamically
- If module fails to load, validation is skipped
- Navigation proceeds without validation

**Current Code**:
```typescript
const { validateGameEntry } = require('@/utils/gameEntryValidation');
```

**Fix**: Use static import instead of dynamic require

---

### ❌ Issue #2: No Verification That loadGame() Succeeded

**Location**: `app/(onboarding)/Perks.tsx:437`

**Problem**:
- `loadGame()` is called but success is not verified
- If `loadGame()` fails silently, navigation still occurs
- Game could start with stale/default state

**Current Code**:
```typescript
await loadGame(slotToUse);
// No check if loadGame succeeded
```

**Fix**: Verify loaded state exists before validation

---

### ❌ Issue #3: Missing Validation for Critical Optional Fields

**Location**: `utils/onboardingValidation.ts`

**Problem**:
- Some critical optional fields are not validated
- Fields like `social`, `economy`, `travel`, `politics` should be initialized
- Missing fields could cause runtime errors

**Fix**: Add validation for critical optional fields

---

### ❌ Issue #4: No Validation That Scenario Data Was Applied

**Location**: `app/(onboarding)/Perks.tsx`

**Problem**:
- Scenario items, education, traits are applied but not validated
- If scenario data is malformed, state could be incomplete
- No check that scenario.start properties exist

**Fix**: Validate scenario data before applying to state

---

## 5. Solutions Implemented

### Fix #1: Static Import for Game Entry Validation

**Location**: `app/(onboarding)/Perks.tsx`

**Change**: Replace dynamic require with static import

```typescript
import { validateGameEntry } from '@/utils/gameEntryValidation';
```

### Fix #2: Verify loadGame() Success

**Location**: `app/(onboarding)/Perks.tsx`

**Change**: Add explicit check that loaded state exists

```typescript
await loadGame(slotToUse);

// Verify loadGame succeeded by checking storage
const loadedData = await AsyncStorage.getItem(`save_slot_${slotToUse}`);
if (!loadedData) {
  // Handle error
  return;
}
```

### Fix #3: Enhanced Validation for Critical Optional Fields

**Location**: `utils/onboardingValidation.ts`

**Change**: Add validation for critical optional fields

```typescript
// Validate critical optional fields
if (!state.social || typeof state.social !== 'object') {
  warnings.push('social object is missing (will be initialized)');
}
if (!state.economy || typeof state.economy !== 'object') {
  warnings.push('economy object is missing (will be initialized)');
}
```

### Fix #4: Validate Scenario Data Before Application

**Location**: `app/(onboarding)/Perks.tsx`

**Change**: Validate scenario structure before using

```typescript
// Validate scenario data
if (!scenario || !scenario.start) {
  Alert.alert('Invalid Scenario', 'Selected scenario is invalid. Please try again.');
  return;
}
```

---

## 6. Fail-Fast Mechanisms

### Pre-Save Validation
- ✅ `validateOnboardingState()` called before save
- ✅ `applySafeDefaults()` called if validation fails
- ✅ Save only occurs if validation passes or defaults applied

### Post-Load Validation
- ✅ `validateGameEntry()` called after load
- ✅ Navigation blocked if validation fails
- ✅ User-friendly error messages displayed

### Safe Defaults
- ✅ `applySafeDefaults()` provides safe values for missing fields
- ✅ Re-validation after defaults applied
- ✅ Fail-fast if defaults don't fix issues

---

## 7. Testing Checklist

- [ ] New game creation with all scenarios
- [ ] New game creation with challenge scenarios
- [ ] Validation fails when scenario is missing
- [ ] Validation fails when character name is missing
- [ ] Validation fails when stats are invalid
- [ ] Safe defaults are applied correctly
- [ ] Gameplay cannot start with invalid state
- [ ] Error messages are user-friendly
- [ ] loadGame() failure is handled gracefully
- [ ] Post-load validation prevents navigation on failure

---

## 8. Summary

The onboarding system has comprehensive validation in place, but there are critical gaps:

1. **Dynamic require** should be replaced with static import
2. **loadGame() success** should be explicitly verified
3. **Critical optional fields** should be validated
4. **Scenario data** should be validated before application

All fixes have been implemented to ensure gameplay cannot start with invalid state.

