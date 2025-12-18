# Time Progression System Audit V3 - Complete Execution Order

**Date**: 2025-01-27  
**Focus**: Map exact execution order, identify side effects that trigger multiple times or are skipped, find implicit ordering dependencies, fix desynchronization risks

---

## Executive Summary

This audit maps the **exact execution order** of a single in-game year (52 weeks) in Deep Life Simulator and identifies all desynchronization risks, side effects that can trigger multiple times or be skipped, and logic that depends on implicit ordering.

**Key Findings**:
- ✅ Most timing issues fixed (nextWeek used consistently)
- ⚠️ Multiple separate setGameState calls create partial update risks
- ⚠️ Age increments calculated upfront but some updates still separate
- ⚠️ Final state update in setTimeout creates timing risk
- ✅ Chained events processed correctly
- ✅ Monthly/yearly checks use correct week values

---

## Year Structure

- **52 weeks = 1 year**
- **4 weeks = 1 month** (13 months per year)
- **13 weeks = 1 season** (4 seasons per year: Spring, Summer, Fall, Winter)
- **Week values**: 1-4 (resets to 1 after 4)

---

## Execution Order: Single In-Game Year (52 Weeks)

### Phase 0: Pre-Validation & Setup (Lines 5132-5325)

1. **Lock check** - Prevents concurrent execution (`isNextWeekRunningRef`)
2. **State backup** - Creates backup for rollback
3. **State validation** - Validates state before progression (`validateStateBeforeWeekProgression`)
4. **Stock market simulation** - Updates global stock prices (`simulateWeek`)
5. **Stock holdings collection** - Collects updated holdings (not applied yet)
6. **Crypto price simulation** - Updates crypto prices (global state)
7. **Crypto holdings collection** - Collects updated cryptos (not applied yet)

**Status**: ✅ All updates collected for batch application

---

### Phase 1: Time Increment (Lines 5327-5441)

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

### Phase 2: Jail Handling (Lines 5445-5484)

11. **Jail release check** - If `jailWeeks > 0`:
    - Decrement jailWeeks
    - Update stats
    - **EARLY RETURN** - Skips all remaining progression ⚠️ **DESYNC RISK**
    - **setGameState** - Updates date, stats, weeksLived
    - **Save game**
    - **Return**

**Status**: ⚠️ Early return skips all other progression (intentional but creates desync)

---

### Phase 3: Income & Expenses (Lines 5486-5784)

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

### Phase 4: Crime & Wanted Level (Lines 5813-5839)

20. **Wanted level check** - Random arrest chance
21. **Wanted level decay** - Decays wanted level

**Status**: ✅ No separate setGameState calls

---

### Phase 5: Pet Updates (Lines 5841-5897)

22. **Pet aging** - Ages all pets by 1 week ⚠️ **AGE INCREMENT #2 (Pets)**
23. **Pet death check** - Removes dead pets
24. **Pet bonuses** - Calculates pet happiness/health bonuses

**Status**: ✅ Pet ages calculated, included in final batch update

---

### Phase 6: Disease System (Lines 5899-6044)

25. **Disease check** - Random disease chance
    - Uses `nextWeek` for `weeksSinceLastDisease` ✅ **FIXED**
    - Disease tracking uses `nextWeek` ✅ **FIXED**
26. **Disease application** - Separate setGameState calls ⚠️ **PARTIAL UPDATE RISK #3, #4**
27. **Disease effects** - Applies ongoing disease effects
28. **Cancer countdown** - Separate setGameState ⚠️ **PARTIAL UPDATE RISK #5**

**Status**: ⚠️ Disease tracking and cancer countdown use separate setGameState calls

---

### Phase 7: Relationship & Family Updates (Lines 6046-6435)

29. **Age calculation** - Calculates all ages upfront ✅ **FIXED**
    - Relationship ages
    - Spouse age
    - Children ages
    - Social relation ages
30. **Social relations processing** - Uses `nextWeek` ✅ **FIXED**
31. **Travel return check** - Processes synchronously ✅ **FIXED**
32. **Competition results** - Processes synchronously ✅ **FIXED**
33. **Main relationship update** - Single setGameState with all ages ✅ **FIXED**
    - Relationship decay
    - Age updates
    - Travel return
    - Competition history
    - Patent updates
    - Commitment decay
    - Stock/crypto updates (batch)
    - Bankruptcy state (batch)

**Status**: ✅ Most relationship updates batched in single setGameState

---

### Phase 8: Career & Job Updates (Lines 6449-6663)

34. **Item bonuses** - Applies daily item bonuses
35. **Salary calculation** - Calculates weekly salary (if not in jail)
36. **Career progression** - Separate setGameState ⚠️ **PARTIAL UPDATE RISK #6**
37. **Job applications** - Separate setGameState calls ⚠️ **PARTIAL UPDATE RISK #7, #8**

**Status**: ⚠️ Career progression and job applications use separate setGameState calls

---

### Phase 9: Relationship Decay & Breakups (Lines 6668-7383)

38. **Relationship decay** - Separate setGameState ⚠️ **PARTIAL UPDATE RISK #9**
39. **Wedding execution** - Executes scheduled weddings (uses `nextWeek`) ✅ **FIXED**
40. **Breakup/divorce logic** - Processes in relationship update
41. **Family state cleanup** - Separate setGameState ⚠️ **PARTIAL UPDATE RISK #10**

**Status**: ⚠️ Relationship decay and family cleanup use separate setGameState calls

---

### Phase 10: Lifestyle & Companies (Lines 6790-7050)

42. **Diet plan effects** - Applies diet plan costs/benefits
43. **Company income** - Calculates company weekly income
44. **Company mining** - Monthly check: `nextWeek % 4 === 0` ✅ **FIXED**
45. **Warehouse mining** - Processes warehouse mining
46. **Miner durability decay** - Separate setGameState calls ⚠️ **PARTIAL UPDATE RISK #11, #12, #13**
47. **Crypto earnings** - Separate setGameState ⚠️ **PARTIAL UPDATE RISK #14**

**Status**: ⚠️ Miner durability and crypto earnings use separate setGameState calls

---

### Phase 11: Political System (Lines 7062-7181)

48. **Policy expiration** - Checks expired policies (uses `nextWeek`) ✅ **FIXED**
49. **Policy effects** - Applies weekly policy effects
50. **Approval rating decay** - Separate setGameState ⚠️ **PARTIAL UPDATE RISK #15**

**Status**: ⚠️ Approval rating decay uses separate setGameState call

---

### Phase 12: Real Estate & Relationships (Lines 7183-7383)

51. **Real estate bonuses** - Applies property bonuses
52. **Partner income** - Calculates partner/spouse income
53. **Relationship processing** - Processes breakups/divorces
54. **Family state cleanup** - Separate setGameState (already counted)

**Status**: ✅ Most processing done synchronously

---

### Phase 13: Hobbies & Education (Lines 7385-7526)

55. **Sponsor income** - Calculates sponsor earnings
56. **Hobby sponsor updates** - Separate setGameState ⚠️ **PARTIAL UPDATE RISK #16**
57. **Education progress** - Separate setGameState ⚠️ **PARTIAL UPDATE RISK #17**

**Status**: ⚠️ Hobby sponsors and education use separate setGameState calls

---

### Phase 14: Event Processing (Lines 7528-7616)

58. **Process chained events** - Processes pending chained events ✅ **FIXED**
59. **Roll weekly events** - Uses `{ ...gameState, week: nextWeek }` ✅ **FIXED**
60. **Social media decay** - Separate setGameState ⚠️ **PARTIAL UPDATE RISK #18**

**Status**: ✅ Events use correct week, ⚠️ Social media uses separate setGameState

---

### Phase 15: Stat Calculations (Lines 7618-7805)

61. **Energy regeneration** - Calculates energy regen
62. **Stat decay** - Calculates health/happiness decay
63. **Stat recovery** - Calculates passive recovery
64. **Reputation decay** - Calculates reputation decay
65. **Bankruptcy check** - Calculates bankruptcy state (included in batch)

**Status**: ✅ All calculations done synchronously, included in final batch

---

### Phase 16: Final State Update (Lines 8006-8126)

66. **Calculate final stats** - Applies all stat changes
67. **Sanitize stats** - Validates and sanitizes final stats
68. **Update seasonal events** - Uses `newDate.week` (which is `nextWeek`) ✅ **FIXED**
69. **Lifetime statistics** - Updates lifetime statistics
70. **Final state update** - **setGameState in setTimeout** ⚠️ **TIMING RISK**
71. **Prestige check** - Checks prestige availability (setTimeout)

**Status**: ⚠️ Final update in setTimeout creates timing risk

---

### Phase 17: Save (Lines 8139-8148)

72. **Save game** - Saves game state

**Status**: ✅ Save happens after setTimeout

---

## Critical Desynchronization Risks

### 1. ⚠️ CRITICAL: Multiple Separate setGameState Calls (17 instances)

**Location**: Throughout `nextWeek()`

**Problem**: 17 separate `setGameState` calls can create partial updates:
1. Auto-reinvest (line 5550)
2. Loan payments (line 5776)
3. Disease tracking (line 5966)
4. Disease application (line 5970)
5. Cancer countdown (line 6019)
6. Career progression (line 6510)
7. Job application acceptance (line 6637)
8. Job application rejection (line 6654)
9. Relationship decay (line 6677)
10. Family state cleanup (line 7352)
11. Miner durability (auto-repair) (line 7007)
12. Miner durability (can't afford) (line 7022)
13. Miner durability (no auto-repair) (line 7032)
14. Crypto earnings (line 7053)
15. Political approval (line 7163)
16. Hobby sponsors (line 7406)
17. Education progress (line 7443)
18. Social media (line 7597)

**How It Occurs**:
1. Auto-reinvest succeeds
2. Loan payment fails (error in calculation)
3. Disease tracking succeeds
4. Career progression fails
5. State has updated investments but stale loans/careers

**Corruption Risk**: HIGH - Partial state updates create inconsistencies

**Fix**: Batch all updates into single setGameState call (or ensure all are non-critical)

---

### 2. ⚠️ HIGH: Final State Update in setTimeout

**Location**: `contexts/game/GameActionsContext.tsx:8006`

**Problem**: Final state update happens in `setTimeout(() => { setGameState(...) }, 50)`. If app closes before setTimeout executes, state might not update.

**How It Occurs**:
1. All calculations complete
2. `setTimeout(() => setGameState(...), 50)` scheduled
3. App closes before setTimeout executes
4. State update never applies
5. Next load has stale state

**Corruption Risk**: MEDIUM - State loss on app close

**Fix**: Make final update synchronous, or ensure save waits for update

---

### 3. ⚠️ MEDIUM: Early Return in Jail Release

**Location**: `contexts/game/GameActionsContext.tsx:5445-5484`

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

### 4. ⚠️ MEDIUM: Age Increments Calculated But Some Updates Separate

**Location**: `contexts/game/GameActionsContext.tsx:6046-6077`

**Problem**: All ages are calculated upfront (good), but some age updates happen in separate setGameState calls (disease tracking, career progression).

**How It Occurs**:
1. Ages calculated upfront (relationships, spouse, children, social)
2. Main relationship update applies ages (good)
3. But disease tracking uses separate setGameState (doesn't update ages)
4. Career progression uses separate setGameState (doesn't update ages)
5. Ages become desynchronized if main update fails

**Corruption Risk**: LOW - Ages are mostly batched, but some updates are separate

**Fix**: Ensure all age updates are in main batch update

---

## Side Effects That Can Trigger Multiple Times or Be Skipped

### 1. ⚠️ MEDIUM: Monthly Checks Can Trigger Multiple Times

**Location**: Multiple locations using `nextWeek % 4 === 0`

**Problem**: If `nextWeek` calculation is wrong, monthly checks can trigger multiple times or be skipped.

**Current Status**:
- ✅ Emergency income: Uses `nextWeek % 4 === 0` (line 5528)
- ✅ Company power bill: Uses `nextWeek % 4 === 0` (line 6873)
- ✅ Weekly summary: Uses `nextWeeksLived % 4 === 0` (line 8082)

**Risk**: LOW - All use correct week values

---

### 2. ⚠️ LOW: Yearly Checks Don't Exist

**Location**: None

**Problem**: No explicit yearly checks (52 weeks). Year increment happens, but no yearly side effects.

**Risk**: LOW - Not a bug, but could add yearly events/achievements

---

### 3. ⚠️ MEDIUM: Event Processing Order

**Location**: `contexts/game/GameActionsContext.tsx:7528-7564`

**Problem**: Chained events processed before rolling weekly events. If chained event processing fails, weekly events still roll.

**Current Status**:
- ✅ Chained events processed first (line 7528)
- ✅ Weekly events rolled second (line 7558)
- ✅ Chained events added to weekly events (line 7561)

**Risk**: LOW - Order is correct, but if chained event processing fails, events are lost

---

## Logic That Depends on Implicit Ordering

### Dependency Chain 1: Week → Month → Year → Seasonal Events

**Order**:
1. Week incremented first (line 5337)
2. Month/year rollover (lines 5358-5441)
3. Seasonal events checked (line 8011) - Uses `newDate.week` ✅

**Status**: ✅ FIXED - Uses consistent week value

---

### Dependency Chain 2: Age → Life Stage → Career

**Order**:
1. Age incremented (line 5341)
2. Life stage calculated from age (line 6371)
3. Career progression may depend on life stage

**Status**: ✅ FIXED - Ages calculated upfront, included in atomic update

---

### Dependency Chain 3: Events → Chained Events → State Update

**Order**:
1. Chained events processed (line 7528)
2. Weekly events rolled (line 7558)
3. Events added to state (line 8104)

**Status**: ✅ FIXED - Chained events processed before rolling

---

### Dependency Chain 4: Income → Expenses → Loans

**Order**:
1. Passive income calculated first (line 5492)
2. Family expenses calculated using passive income (line 5669)
3. Loan payments calculated using money after income/expenses (line 5703)

**Status**: ✅ CORRECT - Order is intentional

---

### Dependency Chain 5: Disease Check → Disease Tracking → Disease Effects

**Order**:
1. Disease check uses `nextWeek` ✅ (line 5928)
2. Disease tracking uses `nextWeek` ✅ (line 5968)
3. Disease effects applied to stats (line 6029)

**Status**: ✅ FIXED - Uses correct week values

---

## Recommended Fixes

### Priority 1 (CRITICAL - Immediate Fix)

1. **Batch all setGameState calls** - Combine all 17 separate calls into main batch update
   - **Impact**: Prevents partial state updates
   - **Risk**: HIGH if not fixed
   - **Effort**: MEDIUM - Requires careful state collection

2. **Make final update synchronous** - Remove setTimeout from final state update
   - **Impact**: Prevents state loss on app close
   - **Risk**: MEDIUM if not fixed
   - **Effort**: LOW - Simple change

### Priority 2 (HIGH - Fix Soon)

3. **Handle jail early return** - Apply all updates even in jail, or explicitly skip with validation
   - **Impact**: Prevents state desynchronization
   - **Risk**: MEDIUM if not fixed
   - **Effort**: MEDIUM - Requires conditional logic

4. **Ensure all age updates in batch** - Verify no age updates in separate setGameState calls
   - **Impact**: Prevents age desynchronization
   - **Risk**: LOW if not fixed
   - **Effort**: LOW - Verification only

### Priority 3 (MEDIUM - Fix When Possible)

5. **Add error handling for chained events** - Ensure chained events don't fail silently
   - **Impact**: Prevents event loss
   - **Risk**: LOW if not fixed
   - **Effort**: LOW - Add try-catch

---

## Implementation Status

- ✅ Week increment uses `nextWeek` consistently
- ✅ Monthly checks use `nextWeek % 4 === 0`
- ✅ Disease check uses `nextWeek`
- ✅ Chained events processed correctly
- ✅ Ages calculated upfront
- ⚠️ Multiple separate setGameState calls (17 instances)
- ⚠️ Final update in setTimeout
- ⚠️ Early return in jail release

---

## Testing Recommendations

### Test Cases

1. **Jail Early Return**:
   - Player in jail for 4 weeks
   - Verify relationships age when jail ends
   - Verify companies produce income when jail ends

2. **Monthly Checks**:
   - Week 3 → Week 4 (should trigger monthly)
   - Week 4 → Week 1 (should trigger monthly)
   - Verify emergency income, power bills trigger correctly

3. **Multiple setGameState Calls**:
   - Simulate error in one setGameState call
   - Verify other updates still apply
   - Verify state is consistent

4. **Final Update Timing**:
   - Close app immediately after nextWeek call
   - Verify state is saved correctly
   - Verify no data loss

