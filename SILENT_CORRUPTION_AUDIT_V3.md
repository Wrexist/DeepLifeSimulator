# Silent Corruption Audit V3 - Comprehensive

**Date**: 2025-01-27  
**Focus**: Save-file safety, state mutation without validation, partial updates, chained state updates

---

## Executive Summary

This audit identifies all potential silent corruption paths that can leave the game in an impossible state without crashing. Focus areas: save/load logic, yearly/monthly progression, and chained state updates (money → health → relationships).

**Critical Findings**: 8 silent corruption paths identified, 6 require immediate fixes.

---

## 1. Save/Load Logic Corruption Paths

### 1.1 ❌ CRITICAL: Partial State Update in nextWeek Before Final Batch

**Location**: `contexts/game/GameActionsContext.tsx:5174-5307`

**Problem**:
- Stock and crypto updates are collected but not validated before batch update
- If collection fails partially (e.g., one stock invalid), entire batch is skipped
- State has stale prices but week progresses

**How It Occurs**:
1. Stock update collection succeeds for 9/10 holdings
2. 10th holding has invalid price (NaN)
3. Collection throws error, `updatedStockHoldings` remains null
4. Batch update skips stock update entirely
5. Week progresses with stale stock prices
6. Player's portfolio value is wrong

**Corruption Risk**: HIGH - Financial data desynchronization

**Fix**: Validate each update individually, skip invalid ones, continue with valid updates

---

### 1.2 ❌ CRITICAL: Load Without Post-Migration Validation

**Location**: `contexts/game/GameActionsContext.tsx:4596-4705`

**Problem**:
- `migrateState()` adds defaults for missing fields
- But doesn't validate that defaults are correct type/range
- State is set even if migration produces invalid values

**How It Occurs**:
1. Old save has `stats.money = "invalid"`
2. Migration doesn't fix it (only adds missing fields)
3. State is set with invalid money value
4. Game continues with NaN money after first calculation

**Corruption Risk**: HIGH - Invalid state propagates

**Fix**: Add post-migration validation before setting state

---

### 1.3 ❌ HIGH: Save Validation Can Fail Silently

**Location**: `contexts/game/GameActionsContext.tsx:4378-4414`

**Problem**:
- If validation fails and repair fails, save is skipped
- But state remains in memory with invalid values
- Next action might save invalid state

**How It Occurs**:
1. State becomes invalid (NaN in stats)
2. Save is called, validation fails
3. Repair fails, save is skipped
4. State remains invalid in memory
5. User continues playing, next save might succeed with invalid state

**Corruption Risk**: MEDIUM - Invalid state persists

**Fix**: Rollback to snapshot if save validation fails

---

## 2. Yearly/Monthly Progression Corruption Paths

### 2.1 ❌ CRITICAL: Year Increment Without Validation

**Location**: `contexts/game/GameActionsContext.tsx:5360-5390`

**Problem**:
- Year increment happens during month rollover
- No validation that year is valid number/range
- If year becomes NaN, all date calculations break

**How It Occurs**:
1. Month rollover: December → January
2. Year increment: `newDate.year += 1`
3. If `newDate.year` is already NaN, result is NaN
4. All date-dependent logic breaks (events, seasonal, etc.)

**Corruption Risk**: HIGH - Date system breaks

**Fix**: Validate year before and after increment

---

### 2.2 ❌ HIGH: Month Rollover Can Fail Silently

**Location**: `contexts/game/GameActionsContext.tsx:5377-5390`

**Problem**:
- Month normalization can fail if month is invalid type
- Defaults to January but doesn't validate year
- Year can become desynchronized

**How It Occurs**:
1. Month becomes invalid (number, object, etc.)
2. Normalization fails, defaults to January
3. Year increment happens anyway
4. Year advances but month is wrong
5. Date is desynchronized

**Corruption Risk**: MEDIUM - Date desynchronization

**Fix**: Validate month type before normalization, validate year after rollover

---

### 2.3 ❌ MEDIUM: Disease Check Uses Wrong Week Value

**Location**: `contexts/game/GameActionsContext.tsx:5759, 5794` (from TIME_PROGRESSION_AUDIT_V2.md)

**Problem**:
- Disease check uses `gameState.week` instead of `nextWeek`
- Disease tracking uses `prev.week` instead of `nextWeek`
- Diseases can trigger at wrong time or not trigger at all

**How It Occurs**:
1. Week 4 → Week 1 (month rollover)
2. Disease check uses `gameState.week` (still 4)
3. Calculates wrong `weeksSinceLastDisease`
4. Disease triggers at wrong time or not at all

**Corruption Risk**: MEDIUM - Disease timing wrong

**Fix**: Use `nextWeek` for disease checks and tracking

---

## 3. Chained State Updates Corruption Paths

### 3.1 ❌ CRITICAL: Money → Health → Relationships Chain Without Validation

**Location**: `contexts/game/GameActionsContext.tsx:7607-7695`

**Problem**:
- Net worth calculation can fail (throws error)
- Stat decay uses net worth result
- If net worth is NaN, stat decay is NaN
- Relationships use health/happiness for decay
- Chain breaks if any step produces invalid value

**How It Occurs**:
1. Net worth calculation throws error
2. `currentNetWorth = 0` (default)
3. But if error happens after calculation, `currentNetWorth` might be NaN
4. Stat decay calculation: `healthDecay = NaN`
5. Health becomes NaN
6. Relationship decay uses NaN health
7. Relationships break

**Corruption Risk**: HIGH - Cascading NaN propagation

**Fix**: Validate net worth result, validate stat decay before use, validate health before relationship decay

---

### 3.2 ❌ CRITICAL: Stats Change Accumulation Without Intermediate Validation

**Location**: `contexts/game/GameActionsContext.tsx:7676-7695`

**Problem**:
- Multiple stat changes accumulated in `statsChange` object
- Changes validated at end, but intermediate values can be NaN
- If one calculation produces NaN, entire accumulation is NaN

**How It Occurs**:
1. Health decay: `-5` (valid)
2. Passive recovery: `+2` (valid)
3. Net worth reduction: `NaN` (invalid calculation)
4. Accumulation: `statsChange.health = -5 + 2 + NaN = NaN`
5. Final health: `health + NaN = NaN`

**Corruption Risk**: HIGH - NaN propagation

**Fix**: Validate each stat change before accumulation

---

### 3.3 ❌ HIGH: Bankruptcy State Update Separate from Money

**Location**: `contexts/game/GameActionsContext.tsx:7764-7771`

**Problem**:
- Bankruptcy calculation updates `moneyChange`
- But state update (`bankruptcyStateUpdate`) is separate
- If state update fails, money is changed but assets aren't sold
- Player has reduced debt but still owns assets

**How It Occurs**:
1. Bankruptcy triggered: `moneyChange += debtReduction`
2. `bankruptcyStateUpdate` prepared
3. State update fails (error in setGameState)
4. Money is updated but assets aren't sold
5. Net worth calculation is wrong

**Corruption Risk**: MEDIUM - State inconsistency

**Fix**: Include bankruptcy in main batch update (already done, verify it's included)

---

## 4. Partial State Updates Corruption Paths

### 4.1 ❌ CRITICAL: Multiple setGameState Calls in nextWeek

**Location**: Multiple locations (from TIME_PROGRESSION_AUDIT_V2.md)

**Problem**:
- Auto-reinvest, loan payments, disease tracking, career progression, etc. use separate `setGameState` calls
- If one fails, others succeed
- State is partially updated

**How It Occurs**:
1. Auto-reinvest succeeds
2. Loan payment fails (error in calculation)
3. Disease tracking succeeds
4. Career progression fails
5. State has updated investments but stale loans/careers

**Corruption Risk**: HIGH - Partial state updates

**Fix**: Batch all updates into single setGameState call (verify all are included)

---

### 4.2 ❌ HIGH: Final State Update in setTimeout

**Location**: `contexts/game/GameActionsContext.tsx:7995` (from TIME_PROGRESSION_AUDIT_V2.md)

**Problem**:
- Final state update happens in `setTimeout(() => { setGameState(...) }, 0)`
- Save happens after setTimeout
- If app closes between setTimeout and save, state might not be saved

**How It Occurs**:
1. All calculations complete
2. `setTimeout(() => setGameState(...), 0)` scheduled
3. App closes before setTimeout executes
4. State update never applies
5. Next load has stale state

**Corruption Risk**: MEDIUM - State loss on app close

**Fix**: Make final update synchronous, or ensure save waits for update

---

## 5. Impossible State Paths

### 5.1 ❌ CRITICAL: Negative Money After Calculations

**Location**: `contexts/game/GameActionsContext.tsx:7795-7805`

**Problem**:
- Money calculation: `finalMoney = currentMoney + moneyChange`
- Validation checks `finalMoney >= 0`
- But if validation fails, `validatedFinalMoney` is used
- If `validatedFinalMoney` calculation fails, money can be negative

**How It Occurs**:
1. `finalMoney = -5000` (negative)
2. Validation fails
3. `safeMoneyChange = NaN` (if moneyChange is NaN)
4. `safeFinalMoney = currentMoney + NaN = NaN`
5. Money becomes NaN

**Corruption Risk**: HIGH - Money becomes invalid

**Fix**: Ensure `validatedFinalMoney` is always valid (already done, verify)

---

### 5.2 ❌ HIGH: Stats Out of Range After Sanitization

**Location**: `contexts/game/GameActionsContext.tsx:7810-7814`

**Problem**:
- Stats are clamped: `Math.max(0, Math.min(100, ...))`
- But if input is NaN, clamp produces NaN
- Sanitization happens after clamp

**How It Occurs**:
1. `gameState.stats.health = NaN`
2. `sanitizedStatsChange.health = 5`
3. `health = Math.max(0, Math.min(100, NaN + 5)) = NaN`
4. Sanitization happens after, but NaN already propagated

**Corruption Risk**: MEDIUM - Stats become invalid

**Fix**: Sanitize inputs before calculation (already done, verify)

---

## Recommended Fixes

### Priority 1 (CRITICAL - Immediate Fix)

1. **Validate stock/crypto updates individually** - Skip invalid, continue with valid
2. **Add post-migration validation** - Validate state after migration before setting
3. **Validate year before/after increment** - Prevent NaN year
4. **Validate net worth before use** - Prevent NaN in stat chain
5. **Validate stat changes before accumulation** - Prevent NaN propagation
6. **Verify all updates in batch** - Ensure no separate setGameState calls remain

### Priority 2 (HIGH - Fix Soon)

7. **Fix disease check week value** - Use `nextWeek` consistently
8. **Validate month type before normalization** - Prevent type errors
9. **Rollback on save validation failure** - Prevent invalid state persistence

### Priority 3 (MEDIUM - Fix When Possible)

10. **Make final update synchronous** - Prevent state loss on app close
11. **Add intermediate validation in stat chain** - Catch issues earlier

---

## Implementation Status

- ✅ Money validation before/after calculation
- ✅ Stat change sanitization
- ✅ Final stats sanitization
- ✅ Bankruptcy in batch update
- ⚠️ Stock/crypto validation (partial - needs individual validation)
- ⚠️ Post-migration validation (missing)
- ⚠️ Year increment validation (missing)
- ⚠️ Disease week value (needs fix)
- ⚠️ Multiple setGameState calls (needs verification)

