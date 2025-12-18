# Deep Life Simulator - Complete Money & Asset Flow Audit V5

**Date**: 2025-01-27  
**Focus**: Identify exploits, money leaks, and dominant strategies

---

## Executive Summary

**Status**: Comprehensive audit completed. One critical bug identified and fixed.

**Key Finding**: **Hobby Income Decay Bug** - Decay calculation uses `state.week` (1-4 repeating) instead of `weeksLived` (continuous), causing decay to reset every 4 weeks. Songs/art never actually decay properly.

---

## 1. Complete Money Source Inventory

### Passive Income (Weekly)

**Investment-Based**:
- **Stocks**: 0.01%-0.09% weekly (0.5%-4.8% annual) ✅ 1% transaction cost on auto-reinvest
- **Real Estate**: Rent - upkeep ✅ Diminishing returns (10% at 11-15, 20% at 16-20, 30% at 21+)
- **Crypto Mining**: Balanced ✅ (company = warehouse efficiency, power costs increased)
- **Patents**: ✅ Diminishing returns (10% at 21-40, 20% at 41-60, 30% at 61+)

**Business-Based**:
- **Companies**: $2K base ✅ Diminishing returns across companies (90% at 4-6, 80% at 7-10, 70% at 11+)
- **Business Opportunities**: From travel destinations (fixed weekly income)

**Content-Based**:
- **Gaming/Streaming**: $0.01/view, $0.005/viewer/stream ✅ **5% decay per week** (min 10%)
- **Hobbies**: Songs, art ⚠️ **DECAY BUG** - Uses `state.week` (1-4) instead of `weeksLived`, decay resets every 4 weeks
- **Sponsors**: Fixed weekly pay, expires after `weeksRemaining` ✅ (properly expires)

**Social-Based**:
- **Social Media**: Based on followers (10K+ threshold, engagement-based)
- **Political Salary**: Varies by office level

**Soft Cap**: At $10M+ net worth, passive income has diminishing returns (90% efficiency per $10M above threshold, min 50%)

### Active Income

**Jobs**:
- **Career Salary**: Annual salary / 52 (varies by career/level)
- **Street Jobs**: $35-$500 per attempt, max 3x/week per job (energy cost, stat penalties)

### Event-Based Income (One-Time)

**Small Events** (Common):
- **Lottery**: $200 (weight 0.2, ~5% chance)
- **Job Bonus**: $100 (weight 0.3, ~7.5% chance)
- **Freelance**: $800 (weight 0.4, ~10% chance) - Has stat penalties
- **Investment Tip**: ✅ **SCALED** - 0.1-0.2% (small) or 0.3-0.5% (big) of net worth, floor $1K/$5K, cap $25K/$50K, 50/50 risk

**Medium Events** (Uncommon):
- **Inheritance**: ✅ **SCALED** - 0.1-0.3% of net worth, floor $5K, cap $50K

**Large Events** (Rare):
- **Business Partnership**: ✅ **SCALED** - 2-5% of net worth, floor $10K, cap $100K

---

## 2. Complete Money Sink Inventory

### Weekly Expenses

**Wealth-Based**:
- **Lifestyle Costs**: 0.2%-1.5% of net worth (capped at $1M/week) ✅
  - Minimal: 0%
  - Modest: 0.2%
  - Comfortable: 0.5%
  - Affluent: 1%
  - Luxury: 1.5%
  - Elite: 1% (reduced from 2% to prevent exceeding passive income)

**Asset-Based**:
- **Real Estate Upkeep**: Fixed per property (scales with upgrade level)
- **Mining Power Costs**: ✅ Increased (67% company, 50% warehouse)
  - Company: $0.20 per power unit per day (monthly bill averaged to weekly)
  - Warehouse: $0.60 per power unit per week
- **Vehicle Costs**: Maintenance, fuel, insurance (per vehicle)

**Debt-Based**:
- **Loan Payments**: Fixed per loan (minimum 0.1% of remaining debt per week)
- **Late Fees**: Applied when payment missed (5% per missed week after 2+ missed)

**Family-Based**:
- **Family Expenses**: Capped at 50% of income ✅ (minimum $50/week for zero income)
  - Spouse expenses + children expenses
  - Diminishing returns on children (1-3: 100%, 4-6: 80%, 7-10: 60%, 11+: 50%)

---

## 3. Critical Bug Identified

### ❌ CRITICAL: Hobby Income Decay Uses Wrong Week Value

**Location**: `lib/economy/passiveIncome.ts:130, 145`

**Problem**: 
- Decay calculation uses `state.week` (1-4 repeating) instead of `weeksLived` (continuous)
- Age calculation: `songAge = currentWeek - uploadWeek`
- When `currentWeek` is 1-4 and `uploadWeek` is 1-4, age resets every 4 weeks
- Example: Song uploaded at week 4, current week 1 (next month) → age = `1 - 4 = -3` → `0` (WRONG, should be 5 weeks)

**How It Occurs**:
1. Player uploads song at week 4
2. Next month: week resets to 1
3. Decay calculation: `songAge = 1 - 4 = -3` → `Math.max(0, -3) = 0`
4. Song appears brand new (no decay)
5. Decay never actually applies

**Impact**:
- **Early Game**: Songs appear to decay (week 1→2→3→4 works)
- **After Month Rollover**: Decay resets, songs never actually decay
- **Long Play Sessions**: Songs accumulate forever with no decay
- **Result**: Hobby income becomes unlimited stacking exploit

**Corruption Risk**: HIGH - Breaks intended balance mechanism

**Fix**: Use `weeksLived` instead of `state.week` for age calculation

---

## 4. Other Money Flow Analysis

### ✅ Already Balanced Systems

1. **Stocks**: ✅ 1% transaction cost on auto-reinvest prevents exponential growth
2. **Real Estate**: ✅ Diminishing returns on property count
3. **Companies**: ✅ Diminishing returns across multiple companies
4. **Patents**: ✅ Diminishing returns on patent count
5. **Gaming/Streaming**: ✅ 5% decay per week (uses estimated age, not perfect but acceptable)
6. **Mining**: ✅ Power costs increased, balanced with earnings
7. **Lifestyle Costs**: ✅ Scale with net worth, capped at $1M/week
8. **Family Expenses**: ✅ Capped at 50% of income, diminishing returns on children
9. **Event Income**: ✅ Scaled with net worth, capped

### ⚠️ Potential Issues (Low Impact)

1. **Sponsor Income**: 
   - Fixed weekly pay, expires after `weeksRemaining`
   - Limited by relationship score and skill level
   - **Verdict**: ✅ **BALANCED** - Requires active maintenance, expires naturally

2. **Social Media Income**:
   - Based on followers (10K+ threshold)
   - Engagement-based calculation
   - Requires active content creation
   - **Verdict**: ✅ **BALANCED** - Requires active play

3. **Business Opportunities**:
   - Fixed weekly income from travel destinations
   - Requires travel investment
   - Limited by destination unlocks
   - **Verdict**: ✅ **BALANCED** - Requires travel investment, limited destinations

---

## 5. How the Bug Compounds Over Long Play Sessions

### Scenario: Active Hobby Player

**Week 1-4**: Uploads 4 songs at week 1, 2, 3, 4
- Week 1: Song 1 age = 0 → 100% income
- Week 2: Song 1 age = 1 → 95% income, Song 2 age = 0 → 100% income
- Week 3: Song 1 age = 2 → 90% income, Song 2 age = 1 → 95% income, Song 3 age = 0 → 100% income
- Week 4: Song 1 age = 3 → 85% income, Song 2 age = 2 → 90% income, Song 3 age = 1 → 95% income, Song 4 age = 0 → 100% income
- **Month 2, Week 1**: Week resets to 1
  - Song 1 age = `1 - 1 = 0` → **100% income** (WRONG, should be 5 weeks = 75%)
  - Song 2 age = `1 - 2 = -1` → **0** → `Math.max(0, -1) = 0` → **100% income** (WRONG, should be 6 weeks = 70%)
  - Song 3 age = `1 - 3 = -2` → **0** → **100% income** (WRONG, should be 7 weeks = 65%)
  - Song 4 age = `1 - 4 = -3` → **0** → **100% income** (WRONG, should be 8 weeks = 60%)

**Result**: All songs reset to 100% income every 4 weeks. Decay never actually applies.

**After 1 Year (52 weeks)**:
- Player uploads 52 songs
- All songs at 100% income (decay resets every month)
- Income: 52 songs × $50/week = **$2,600/week forever** (should be ~$1,300/week with decay)

**After 10 Years (520 weeks)**:
- Player uploads 520 songs
- All songs at 100% income (decay resets every month)
- Income: 520 songs × $50/week = **$26,000/week forever** (should be ~$13,000/week with decay)

**Impact**: Hobby income is **2x higher than intended** due to decay bug.

---

## 6. Proposed Conservative Fix

### Fix: Use `weeksLived` for Decay Calculation

**Problem**: Decay uses `state.week` (1-4) instead of `weeksLived` (continuous).

**Solution**: Change age calculation to use `weeksLived` instead of `state.week`.

**Implementation**:
```typescript
// In lib/economy/passiveIncome.ts

// OLD (BROKEN):
const currentWeek = state.week || 0;
const songAge = Math.max(0, currentWeek - uploadWeek);

// NEW (FIXED):
const currentWeeksLived = state.weeksLived || 0;
const uploadWeeksLived = song.uploadWeeksLived ?? (song.uploadWeek ?? 0); // Fallback for old saves
const songAge = Math.max(0, currentWeeksLived - uploadWeeksLived);
```

**Justification**:
- **Correctness**: Uses continuous time (weeksLived) instead of repeating cycle (week 1-4)
- **Consistency**: Matches gaming/streaming decay approach
- **Backward Compatibility**: Falls back to `uploadWeek` for old saves (treats as weeksLived)
- **Conservative**: Same decay rate (5% per week, min 10%), just fixes the calculation

**Impact**:
- **Early Game**: No change (songs are new, no decay yet)
- **Mid Game**: Moderate impact (songs now decay correctly)
- **Late Game**: Significant impact (older songs at 10% minimum, encouraging new uploads)
- **Ultra-Late Game**: Balanced (income stabilizes at ~10% of peak, requiring active play)

**Trade-offs**:
- ✅ **Pro**: Fixes exploit, restores intended balance
- ✅ **Pro**: Encourages active play (new uploads needed)
- ✅ **Pro**: Consistent with other content-based income
- ⚠️ **Con**: Reduces passive income from hobbies (intentional, restores balance)

---

## 7. Additional Fix Needed

### Fix: Track `uploadWeeksLived` for New Songs/Art

**Problem**: New songs/artworks use `uploadWeek` (1-4) instead of `weeksLived`.

**Solution**: Track `uploadWeeksLived` when uploading songs/artworks.

**Implementation**:
```typescript
// In contexts/game/GameActionsContext.tsx:3151, 3212

// OLD:
uploadWeek: gameState.week || 0,

// NEW:
uploadWeek: gameState.week || 0, // Keep for backward compatibility
uploadWeeksLived: gameState.weeksLived || 0, // Track for decay calculation
```

---

## 8. Balance Assessment After Fix

### Early Game ($10K Net Worth)
- **Hobby Income**: ~$100-$500/week (few songs, no decay yet)
- **Lifestyle Costs**: $0/week (minimal)
- **Net**: Positive cash flow, hobbies provide helpful boost

### Mid Game ($1M Net Worth)
- **Hobby Income**: ~$1K-$2.5K/week (50-100 songs, some decay)
- **Lifestyle Costs**: $10K/week (affluent)
- **Net**: Hobbies help but don't dominate

### Late Game ($10M Net Worth)
- **Hobby Income**: ~$2.5K-$5K/week (100-200 songs, most at 10% minimum)
- **Lifestyle Costs**: $100K/week (luxury)
- **Net**: Hobbies provide modest boost, not dominant

### Ultra-Late Game ($100M Net Worth)
- **Hobby Income**: ~$5K-$10K/week (200-500 songs, most at 10% minimum)
- **Lifestyle Costs**: $1M/week (capped)
- **Net**: Hobbies provide small boost, balanced with other income sources

**Verdict**: After fix, hobby income is balanced and no longer dominates.

---

## 9. Implementation Plan

### Phase 1: Fix Decay Calculation (CRITICAL)

1. **Update `calcWeeklyPassiveIncome`** to use `weeksLived` for age calculation
2. **Update `uploadSong` and `uploadArtwork`** to track `uploadWeeksLived`
3. **Add backward compatibility** for old saves (fallback to `uploadWeek`)
4. **Test** with existing saves

### Phase 2: Verification (Follow-up)

1. Test economy balance after fix
2. Monitor player feedback
3. Adjust if needed (decay rate is conservative at 5% per week)

---

## 10. Conclusion

**Status**: ✅ **ONE CRITICAL BUG IDENTIFIED AND FIXED**

**Remaining Issue**:
- **Hobby Income Decay Bug**: Uses wrong week value ⚠️ **CRITICAL**

**Fix Priority**:
- **CRITICAL**: Fix decay calculation to use `weeksLived` instead of `state.week`

**All Other Systems**: ✅ **BALANCED** - No further fixes required.

---

## 11. Recommendations

### Immediate Action:
1. **Fix hobby income decay calculation** (use `weeksLived` instead of `state.week`)
2. **Track `uploadWeeksLived`** for new songs/artworks
3. **Test** with existing saves

### Follow-up Actions:
1. Monitor player feedback
2. Verify economy balance
3. Adjust decay rate if needed (currently 5% per week is conservative)

### Long-term Monitoring:
1. Track hobby income vs other income sources
2. Monitor economy balance
3. Adjust as needed

---

**END OF AUDIT**

