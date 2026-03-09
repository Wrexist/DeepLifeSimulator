# Quick Reference: New Features

## Files Added

| File | Purpose | Size |
|------|---------|------|
| `utils/ratingPrompt.ts` | Rating prompt utility | 4.8 KB |
| `components/ShareLifeCard.tsx` | Share card component | 12 KB |
| `marketing/INTEGRATION.md` | Integration guide | 15 KB |
| `IMPLEMENTATION_SUMMARY.md` | Detailed summary | 8 KB |

## Feature 1: Rating Prompt

### Installation
```bash
expo add expo-store-review
```

### Basic Usage
```typescript
import { maybeRequestReview } from '@/utils/ratingPrompt';

// After a positive event (promotion, wedding, etc.)
await maybeRequestReview(gameState, true);
```

### Conditions for Showing
- ✓ Player has played ≥20 weeks
- ✓ ≥60 weeks since last prompt
- ✓ It's a positive event (isPositiveEvent=true)

### Integration Points (4 locations)
1. `contexts/game/actions/JobActions.ts` → `promoteCareer()`
2. `contexts/game/actions/DatingActions.ts` → `planWedding()`
3. `contexts/game/GameActionsContext.tsx` → `executePrestigeAction()`
4. Real estate purchase (location TBD)

## Feature 2: Share Card

### Basic Usage
```typescript
import ShareLifeCard from '@/components/ShareLifeCard';

const [showCard, setShowCard] = useState(false);

return (
  <>
    <Button onPress={() => setShowCard(true)}>Share Life</Button>
    {showCard && (
      <ShareLifeCard
        gameState={gameState}
        onClose={() => setShowCard(false)}
      />
    )}
  </>
);
```

### Recommended Locations
- Home/Dashboard screen
- Profile screen
- Weekly summary modal
- After achievements/milestones

### Displays
- Character name & age
- Career & salary
- Net worth
- Spouse (if married)
- Children count (if any)
- Generation level
- Dynamic tagline

## Testing

### Rating Prompt Quick Test
```typescript
import { resetRatingPromptCooldown } from '@/utils/ratingPrompt';

// Reset cooldown for testing
await resetRatingPromptCooldown();

// Trigger after action then check if prompt shows
```

### Share Card Quick Test
1. Set `gameState` to various conditions
2. Watch tagline change
3. Test Share button (opens native sheet)
4. Test Copy button (shows "Copied" confirmation)
5. Test on light and dark mode

## Key Design Decisions

### Rating Prompt
- **Why AsyncStorage?** Persists across sessions without mutation
- **Why 60 weeks?** ~1 year real time, prevents fatigue
- **Why lazy-load?** Module may not be installed
- **Why try/catch everywhere?** Native code is unpredictable

### Share Card
- **Why modal?** Non-blocking, reusable
- **Why glassmorphic?** Matches premium game aesthetic
- **Why dynamic taglines?** Makes sharing more personal
- **Why responsive?** Works on all devices/orientations

## Common Integration Patterns

### Pattern 1: Call in action function
```typescript
// In JobActions.ts promoteCareer()
setGameState(prev => ({
  ...prev,
  careers: updatedCareers,
}));

import { maybeRequestReview } from '@/utils/ratingPrompt';
maybeRequestReview(gameState, true).catch(err =>
  logger.debug('[PromoRating] failed', err)
);
```

### Pattern 2: Show in UI
```typescript
// In HomeScreen.tsx
const [showShare, setShowShare] = useState(false);

<Button onPress={() => setShowShare(true)}>Share</Button>

{showShare && (
  <ShareLifeCard gameState={gameState} onClose={() => setShowShare(false)} />
)}
```

## Troubleshooting

| Issue | Solution |
|-------|----------|
| Rating prompt not showing | Check `weeksLived >= 20`, run `resetRatingPromptCooldown()` |
| Share card not visible | Verify `showShare` state is true, check theme colors |
| Copy not working | Component gracefully degrades, Share button is fallback |
| Glassmorphism not visible | Check dark mode toggle, test on real device |

## Before Release

- [ ] Run `expo add expo-store-review`
- [ ] Add plugin to `app.config.js`
- [ ] Integrate rating prompt in 4 action functions
- [ ] Add share card to 2-3 screens
- [ ] Run `npm run preflight`
- [ ] Test on iOS simulator
- [ ] Test on Android simulator
- [ ] Test light and dark modes
- [ ] Verify on physical devices

## Performance Notes

- **Rating Prompt**: ~1ms overhead (AsyncStorage read)
- **Share Card**: Renders once, button listeners only on press
- **No impact** on main game loop or save system

## Future Ideas

### Rating Prompt v2
- A/B test cooldown periods
- Show at specific milestones ($1M net worth, 50 weeks, etc.)
- Track which events convert best

### Share Card v2
- Screenshot and share as image
- Deep link for recipients
- Leaderboard integration
- Historical snapshots

## Support

- **Documentation**: See `marketing/INTEGRATION.md`
- **Implementation**: Follow code examples above
- **Testing**: Use checklist in INTEGRATION.md
- **Help**: Check troubleshooting table above

---

**Last Updated**: March 9, 2026
**Status**: Ready for integration
**Review**: Check INTEGRATION.md for full details
