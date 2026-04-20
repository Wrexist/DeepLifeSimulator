# Exact Integration Points for Rating Prompt

This file specifies the exact locations where `maybeRequestReview()` should be added.

---

## Integration Point 1: Career Promotion

**File**: `contexts/game/actions/JobActions.ts`
**Function**: `promoteCareer()`
**Line Range**: 618-675

### Current Code (lines 664-671)
```typescript
  setGameState(prev => {
    const updatedCareers = prev.careers.map(c => {
      if (c.id !== careerId) return c;

      return {
        ...c,
        level: newLevel,
        progress: 0, // Reset progress after promotion
      };
    });

    return {
      ...prev,
      careers: updatedCareers,
    };
  });

  log.info(`Career promoted: ${careerId} to level ${newLevel} (${levelData.name})`);
  return {
    success: true,
    message: `Congratulations! You've been promoted to ${levelData.name}! Your new salary is $${levelData.salary}/week.`
  };
};
```

### Where to Add
**After line 670** (after the log.info call, before the return statement)

### Code to Add
```typescript
  // Trigger in-app review prompt on promotion (positive moment)
  import { maybeRequestReview } from '@/utils/ratingPrompt';
  maybeRequestReview(gameState, true).catch(err =>
    log.debug('[PromoRating] Review prompt failed', err)
  );
```

### Complete Example (lines 664-678)
```typescript
  setGameState(prev => {
    const updatedCareers = prev.careers.map(c => {
      if (c.id !== careerId) return c;

      return {
        ...c,
        level: newLevel,
        progress: 0,
      };
    });

    return {
      ...prev,
      careers: updatedCareers,
    };
  });

  log.info(`Career promoted: ${careerId} to level ${newLevel} (${levelData.name})`);

  // NEW: Trigger review prompt (positive moment)
  import { maybeRequestReview } from '@/utils/ratingPrompt';
  maybeRequestReview(gameState, true).catch(err =>
    log.debug('[PromoRating] Review prompt failed', err)
  );

  return {
    success: true,
    message: `Congratulations! You've been promoted to ${levelData.name}! Your new salary is $${levelData.salary}/week.`
  };
};
```

---

## Integration Point 2: Wedding Planning

**File**: `contexts/game/actions/DatingActions.ts`
**Function**: `planWedding()`
**Line Range**: 368-426

### Current Code (lines 418-426)
```typescript
  log.info(`Wedding planned at ${venue.name} for week ${scheduledWeek}`);
  return {
    success: true,
    message: `Wedding planned for ${weeksFromNow} weeks from now at ${venue.name}! Deposit paid: $${deposit.toLocaleString()}`,
    plan,
  };
};
```

### Where to Add
**After line 420** (after the log.info call, before the return statement)

### Code to Add
```typescript
  // Trigger in-app review prompt on wedding (positive moment)
  import { maybeRequestReview } from '@/utils/ratingPrompt';
  maybeRequestReview(gameState, true).catch(err =>
    log.debug('[WeddingRating] Review prompt failed', err)
  );
```

### Complete Example (lines 418-428)
```typescript
  log.info(`Wedding planned at ${venue.name} for week ${scheduledWeek}`);

  // NEW: Trigger review prompt (positive moment)
  import { maybeRequestReview } from '@/utils/ratingPrompt';
  maybeRequestReview(gameState, true).catch(err =>
    log.debug('[WeddingRating] Review prompt failed', err)
  );

  return {
    success: true,
    message: `Wedding planned for ${weeksFromNow} weeks from now at ${venue.name}! Deposit paid: $${deposit.toLocaleString()}`,
    plan,
  };
};
```

---

## Integration Point 3: Prestige Achievement

**File**: `contexts/game/GameActionsContext.tsx`
**Function**: `useCallback` hook for `executePrestigeAction()`
**Line Range**: 3738-3765

### Current Code (lines 3748-3753)
```typescript
      const newGameState = executePrestigeFunction(currentState, chosenPath, childId);
      setGameState(newGameState);

      logger.info(`[executePrestige] Prestige executed: path=${chosenPath}, childId=${childId || 'none'}`);

      queueSave(slotToUse, gameData).catch(err => {
```

### Where to Add
**After line 3750** (after setGameState, before queueSave)

### Code to Add
```typescript
      // Trigger in-app review prompt on prestige (positive moment)
      import { maybeRequestReview } from '@/utils/ratingPrompt';
      maybeRequestReview(newGameState, true).catch(err =>
        logger.debug('[PrestigeRating] Review prompt failed', err)
      );
```

### Complete Example (lines 3748-3762)
```typescript
      const newGameState = executePrestigeFunction(currentState, chosenPath, childId);
      setGameState(newGameState);

      logger.info(`[executePrestige] Prestige executed: path=${chosenPath}, childId=${childId || 'none'}`);

      // NEW: Trigger review prompt (positive moment)
      import { maybeRequestReview } from '@/utils/ratingPrompt';
      maybeRequestReview(newGameState, true).catch(err =>
        logger.debug('[PrestigeRating] Review prompt failed', err)
      );

      queueSave(slotToUse, gameData).catch(err => {
        logger.error('[executePrestige] Failed to queue save:', err);
      });
```

---

## Integration Point 4: Real Estate Purchase (OPTIONAL)

**File**: Location TBD (likely `contexts/game/GameActionsContext.tsx` or dedicated real estate action)
**Function**: Real estate purchase function
**Line Range**: Unknown

### Pattern to Follow
Find where real estate is added to `gameState.realEstate` array:

```typescript
setGameState(prev => ({
  ...prev,
  realEstate: [...prev.realEstate, newProperty],
  stats: { ...prev.stats, money: prev.stats.money - price },
}));

// NEW: Add this (only for FIRST property)
const isFirstProperty = gameState.realEstate.length === 0;
if (isFirstProperty) {
  import { maybeRequestReview } from '@/utils/ratingPrompt';
  maybeRequestReview(gameState, true).catch(err =>
    logger.debug('[PropertyRating] Review prompt failed', err)
  );
}
```

### Notes
- Only trigger on **first property purchase** (not every purchase)
- Check `gameState.realEstate.length === 0` before calling
- This milestone is significant enough to warrant a review request

---

## Import Consolidation

If adding multiple calls in the same file, consolidate the import at the top:

### In JobActions.ts
```typescript
// At the top of the file with other imports
import { maybeRequestReview } from '@/utils/ratingPrompt';
```

### In DatingActions.ts
```typescript
// At the top of the file with other imports
import { maybeRequestReview } from '@/utils/ratingPrompt';
```

### In GameActionsContext.tsx
```typescript
// At the top of the file with other imports
import { maybeRequestReview } from '@/utils/ratingPrompt';
```

Then remove individual imports from the function bodies.

---

## Testing After Integration

After adding all four integration points, test each one:

### Test 1: Career Promotion
```typescript
// Advance career progress to 100%, then promote
// Verify rating prompt shows (if week 20+ and 60+ weeks since last prompt)
```

### Test 2: Wedding Planning
```typescript
// Reach engagement, then plan wedding
// Verify rating prompt shows (if week 20+ and 60+ weeks since last prompt)
```

### Test 3: Prestige Achievement
```typescript
// Reach retirement and prestige, trigger prestige
// Verify rating prompt shows (if week 20+ and 60+ weeks since last prompt)
```

### Test 4: Real Estate (if implemented)
```typescript
// Buy first property
// Verify rating prompt shows (if week 20+ and 60+ weeks since last prompt)
```

### Test Cooldown
```typescript
// After seeing prompt once, wait 60+ weeks
// Trigger another positive event
// Verify prompt shows again
```

---

## Notes

- **Import statement**: Can be at function scope or file scope (consolidate if multiple)
- **Error handling**: Use `.catch()` to prevent prompt errors from breaking gameplay
- **Logging**: Use existing logger patterns (log.debug in JobActions/DatingActions, logger.debug in GameActionsContext)
- **No await**: Don't await the promise in actions (fire and forget is fine)
- **One addition per location**: Each integration point is independent, don't combine them

---

## Before Committing

- [ ] Added imports to all modified files
- [ ] Added one call per integration point (4 total)
- [ ] Used correct logger pattern for each file
- [ ] Used `.catch()` error handling
- [ ] Code formatting matches existing style
- [ ] No breaking changes to function signatures
- [ ] All tests pass: `npm test`
- [ ] Type check passes: `npm run type-check`
- [ ] Code compiles: `npm run preflight:quick`

