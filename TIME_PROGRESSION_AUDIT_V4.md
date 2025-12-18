# Time Progression System Audit V4 - Complete Execution Order

**Date**: 2025-01-27  
**Focus**: Map exact execution order, identify side effects that trigger multiple times or be skipped, find implicit ordering dependencies, fix desynchronization risks

---

## Executive Summary

This audit maps the **exact execution order** of a single in-game year (52 weeks) in Deep Life Simulator and identifies all desynchronization risks, side effects that can trigger multiple times or be skipped, and logic that depends on implicit ordering.

**Key Findings**:
- ✅ Most timing issues fixed (nextWeek used consistently)
- ⚠️ **CRITICAL**: Seasonal event system uses wrong week calculation
- ⚠️ Event pity system uses state.week instead of nextWeek in calculation
- ✅ Monthly checks use correct week values
- ✅ Ages calculated upfront and batched

---

## Year Structure

- **52 weeks = 1 year**
- **4 weeks = 1 month** (13 months per year)
- **13 weeks = 1 season** (4 seasons per year: Spring, Summer, Fall, Winter)
- **Week values**: 1-4 (resets to 1 after 4)
- **Weeks lived**: Increments continuously (1, 2, 3, ..., 52, 53, ...)

---

## Execution Order: Single In-Game Year (52 Weeks)

### Phase 0: Pre-Validation & Setup (Lines 5158-5358)

1. **Lock check** - Prevents concurrent execution (`isNextWeekRunningRef`)
2. **State backup** - Creates backup for rollback
3. **State validation** - Validates state before progression (`validateStateBeforeWeekProgression`)
4. **Stock market simulation** - Updates global stock prices (`simulateWeek`)
5. **Stock holdings collection** - Collects updated holdings (not applied yet)
6. **Crypto price simulation** - Updates crypto prices (global state)
7. **Crypto holdings collection** - Collects updated cryptos (not applied yet)

**Status**: ✅ All updates collected for batch application

---

### Phase 1: Time Increment (Lines 5360-5465)

8. **Calculate next values**:
   - `nextWeeksLived = currentWeeksLived + 1` (validated)
   - `currentWeek = gameState.date.week` (validated: 1-4)
   - `nextWeek = currentWeek === 4 ? 1 : currentWeek + 1`
   - `newDate.week = nextWeek`
   - `newDate.age = addWeekToAge(newDate.age)` ⚠️ **AGE INCREMENT #1 (Player)**

9. **Age-based death check** - Checks if age >= 100 (with immortality bonus)

10. **Month/Year rollover** (if `nextWeek === 1 && currentWeek === 4`):
    - Week reset to 1
    - Month increment (or reset to January)
    - Year increment (if December → January) ⚠️ **YEAR INCREMENT**
    - Year validation (prevents NaN)

**Status**: ✅ Time increment logic correct, year validation added

---

### Phase 2: Jail Handling (Lines 5475-5514)

11. **Jail release check** - If `jailWeeks > 0`:
    - Decrement jailWeeks
    - Update stats
    - **EARLY RETURN** - Skips all remaining progression ⚠️ **DESYNC RISK**
    - **setGameState** - Updates date, stats, weeksLived
    - **Save game**
    - **Return**

**Status**: ⚠️ Early return skips all other progression (intentional but creates desync)

---

### Phase 3: Income & Expenses (Lines 5516-5827)

12. **Passive income calculation** - Calculates weekly passive income
13. **Emergency income** - Monthly check: `nextWeek % 4 === 0` ✅ **FIXED**
14. **Auto-reinvest dividends** - Separate setGameState ⚠️ **PARTIAL UPDATE RISK #1**
15. **Gaming/streaming earnings** - Calculates earnings
16. **Children expenses** - Calculates expenses (pre-calculated)
17. **Family expenses** - Calculates expenses (capped at 50% of income)
18. **Loan payments** - Separate setGameState ⚠️ **PARTIAL UPDATE RISK #2**
19. **Lifestyle costs** - Calculates costs

**Status**: ⚠️ Auto-reinvest and loan payments use separate setGameState calls

---

### Phase 4: Crime & Wanted Level (Lines 5845-5871)

20. **Wanted level check** - Random arrest chance
21. **Wanted level decay** - Decays wanted level

**Status**: ✅ Correct

---

### Phase 5: Pets (Lines 5873-5929)

22. **Pet aging** - All pets age by 1 week
23. **Pet death check** - Pets die if health at 0 for 2+ weeks
24. **Pet happiness/health bonuses** - Applied to stats

**Status**: ✅ Correct

---

### Phase 6: Disease System (Lines 5931-6083)

25. **Disease check** - Random chance based on stats
26. **Disease tracking** - Separate setGameState ⚠️ **PARTIAL UPDATE RISK #3**
27. **Disease effects** - Applied to stats
28. **Cancer countdown** - Separate setGameState ⚠️ **PARTIAL UPDATE RISK #4**

**Status**: ⚠️ Disease tracking uses separate setGameState calls

---

### Phase 7: Age Calculations (Lines 6085-6116)

29. **Relationship ages** - Calculated upfront: `addWeekToAge(rel.age || 0)`
30. **Spouse age** - Calculated upfront: `addWeekToAge(spouse.age || 0)`
31. **Children ages** - Calculated upfront: `addWeekToAge(child.age || 0)`
32. **Social relation ages** - Calculated upfront: `addWeekToAge(rel.age)`

**Status**: ✅ All ages calculated upfront, included in main batch update

---

### Phase 8: Social Relations (Lines 6118-6133)

33. **Process social relations** - Uses `nextWeek` ✅
34. **Apply happiness bonus** - Applied to stats

**Status**: ✅ Correct

---

### Phase 9: Travel Return (Lines 6135-6160)

35. **Travel return check** - Uses `nextWeek >= returnWeek` ✅
36. **Travel benefits** - Applied to stats

**Status**: ✅ Correct

---

### Phase 10: Competition Results (Lines 6162-6219)

37. **Competition results** - Uses `nextWeek` ✅
38. **Prize money** - Added to moneyChange

**Status**: ✅ Correct

---

### Phase 11: Career Progression (Lines 6480-6635)

39. **Career salary** - Calculated and added to moneyChange
40. **Career progression** - Separate setGameState ⚠️ **PARTIAL UPDATE RISK #5**
41. **Career perks** - Applied to stats

**Status**: ⚠️ Career progression uses separate setGameState call

---

### Phase 12: Job Applications (Lines 6638-6695)

42. **Job application processing** - Separate setGameState ⚠️ **PARTIAL UPDATE RISK #6**

**Status**: ⚠️ Job applications use separate setGameState call

---

### Phase 13: Relationship Decay (Lines 6230-6400)

43. **Relationship decay** - Separate setGameState ⚠️ **PARTIAL UPDATE RISK #7**

**Status**: ⚠️ Relationship decay uses separate setGameState call

---

### Phase 14: Company Updates (Lines 6402-6466)

44. **Company production** - Calculated
45. **Company power bill** - Monthly check: `nextWeek % 4 === 0` ✅
46. **Company patents** - Updated
47. **Main batch update** - Includes all ages, relationships, companies, stocks, cryptos

**Status**: ✅ Main batch update includes all critical updates

---

### Phase 15: Event Processing (Lines 7573-7609)

48. **Chained events processing** - Uses `nextWeek >= triggerWeek` ✅
49. **Weekly events rolling** - Uses `{ ...gameState, week: nextWeek }` ✅
50. **Chained events added** - Added to weekly events

**Status**: ✅ Events use nextWeek correctly

---

### Phase 16: Social Media (Lines 7614-7663)

51. **Follower decay** - Uses `nextWeek` ✅

**Status**: ✅ Correct

---

### Phase 17: Stat Decay & Recovery (Lines 7665-7774)

52. **Energy regeneration** - Set to 100
53. **Stat decay calculation** - Based on net worth
54. **Passive recovery** - Applied if stats < 30
55. **Stat changes accumulated** - All changes combined

**Status**: ✅ Correct

---

### Phase 18: Bankruptcy Check (Lines 7787-7855)

56. **Debt weeks tracking** - Tracks weeks in debt
57. **Bankruptcy trigger** - If debt >= 4 weeks
58. **Bankruptcy state update** - Included in main batch ✅

**Status**: ✅ Bankruptcy included in main batch

---

### Phase 19: Final State Update (Lines 8048-8176)

59. **Final batch update** - Includes all calculated values
60. **Seasonal events state** - Uses `newDate.week` ✅
61. **Statistics update** - Lifetime statistics updated
62. **Save game** - Called after state update

**Status**: ✅ Final update is synchronous

---

## Critical Issues Identified

### 1. ❌ CRITICAL: Seasonal Event System Uses Wrong Week Calculation

**Location**: `lib/events/seasonalEvents.ts:18-52`

**Problem**: 
- `getCurrentSeason(week)` uses `week % 52` which assumes weeks are 1-52
- But the game uses weeks 1-4 that repeat (4 weeks = 1 month, 13 months = 1 year)
- Seasonal events will never trigger correctly because week is always 1-4

**How It Occurs**:
1. Game uses weeks 1-4 (repeating)
2. `getCurrentSeason(week)` calculates `week % 52`
3. If week is 1-4, `week % 52` is always 1-4
4. Seasonal calculation expects weeks 1-52
5. Seasons never change correctly

**Corruption Risk**: HIGH - Seasonal events broken

**Fix**: Use `weeksLived % 52` instead of `week % 52` for seasonal calculations

---

### 2. ⚠️ MEDIUM: Event Pity System Uses Wrong Week

**Location**: `lib/events/engine.ts:2306-2308`

**Problem**: 
- `weeksSinceLastEvent = state.week - state.lastEventWeek`
- But `state.week` is the old week (1-4), not the new week
- When called from `nextWeek`, it passes `{ ...gameState, week: nextWeek }` which is correct
- However, the calculation should use `nextWeek` directly, not `state.week`

**How It Occurs**:
1. `rollWeeklyEvents({ ...gameState, week: nextWeek })` is called
2. Inside function: `weeksSinceLastEvent = state.week - state.lastEventWeek`
3. `state.week` is now `nextWeek` (correct)
4. But if `lastEventWeek` is from previous year, calculation can be wrong

**Corruption Risk**: MEDIUM - Event pity system may not work correctly across year boundaries

**Fix**: Use `weeksLived` for pity system instead of week (1-4)

---

### 3. ⚠️ MEDIUM: Early Return in Jail Release

**Location**: `contexts/game/GameActionsContext.tsx:5475-5514`

**Problem**: If player is in jail, week progression returns early. Only date, stats, and weeksLived are updated. Other systems (relationships, companies, etc.) are not updated.

**How It Occurs**:
1. Player is in jail (jailWeeks > 0)
2. `nextWeek()` updates date and stats
3. Returns early before other updates
4. Relationships don't age, companies don't produce income
5. When jail ends, state is weeks behind

**Corruption Risk**: MEDIUM - State desynchronization

**Fix**: Apply all weekly updates even in jail (or explicitly skip with validation)

---

## Side Effects That Can Trigger Multiple Times or Be Skipped

### 1. ✅ FIXED: Monthly Checks Use Correct Week

**Location**: Multiple locations using `nextWeek % 4 === 0`

**Current Status**:
- ✅ Emergency income: Uses `nextWeek % 4 === 0` (line 5565)
- ✅ Company power bill: Uses `nextWeek % 4 === 0` (line 6912)
- ✅ Weekly summary: Uses `nextWeeksLived % 4 === 0` (line 8130)

**Risk**: LOW - All use correct week values

---

### 2. ⚠️ MEDIUM: Seasonal Events Broken

**Location**: `lib/events/seasonalEvents.ts:18-52`

**Problem**: Seasonal events use `week % 52` but game uses weeks 1-4

**Risk**: HIGH - Seasonal events never trigger correctly

**Fix**: Use `weeksLived % 52` for seasonal calculations

---

### 3. ⚠️ LOW: Yearly Checks Don't Exist

**Location**: None

**Problem**: No explicit yearly checks (52 weeks). Year increment happens, but no yearly side effects.

**Risk**: LOW - Not a bug, but could add yearly events/achievements

---

## Logic That Depends on Implicit Ordering

### Dependency Chain 1: Week → Month → Year → Seasonal Events

**Order**:
1. Week incremented first (line 5370)
2. Month/year rollover (lines 5391-5465)
3. Seasonal events checked (line 8059) - Uses `newDate.week` ✅

**Status**: ✅ FIXED - Uses consistent week value, but seasonal calculation is wrong

---

### Dependency Chain 2: Age → Life Stage → Career

**Order**:
1. Age incremented (line 5374)
2. Life stage calculated from age (line 6371)
3. Career progression may depend on life stage

**Status**: ✅ FIXED - Ages calculated upfront, included in atomic update

---

### Dependency Chain 3: Events → Chained Events → State Update

**Order**:
1. Chained events processed (line 7580)
2. Weekly events rolled (line 7603)
3. Events added to state (line 8152)

**Status**: ✅ FIXED - Chained events processed before rolling

---

### Dependency Chain 4: Income → Expenses → Loans

**Order**:
1. Passive income calculated first (line 5522)
2. Family expenses calculated using passive income (line 5701)
3. Loan payments calculated using money after income/expenses (line 5739)

**Status**: ✅ CORRECT - Order is intentional

---

## Recommended Fixes

### Priority 1 (CRITICAL - Immediate Fix)

1. **Fix seasonal event week calculation** - Use `weeksLived % 52` instead of `week % 52`
   - **Impact**: Fixes seasonal events
   - **Risk**: HIGH if not fixed
   - **Effort**: LOW - Simple change

2. **Fix event pity system** - Use `weeksLived` for pity calculation
   - **Impact**: Fixes event pity system across year boundaries
   - **Risk**: MEDIUM if not fixed
   - **Effort**: LOW - Simple change

### Priority 2 (HIGH - Fix Soon)

3. **Handle jail early return** - Apply all updates even in jail, or explicitly skip with validation
   - **Impact**: Prevents state desynchronization
   - **Risk**: MEDIUM if not fixed
   - **Effort**: MEDIUM - Requires conditional logic

---

## Implementation Status

- ✅ Week increment uses `nextWeek` consistently
- ✅ Monthly checks use `nextWeek % 4 === 0`
- ✅ Disease check uses `nextWeek`
- ✅ Chained events processed correctly
- ✅ Ages calculated upfront
- ❌ Seasonal events use wrong week calculation
- ⚠️ Event pity system may have year boundary issues
- ⚠️ Multiple separate setGameState calls (acceptable for non-critical updates)

