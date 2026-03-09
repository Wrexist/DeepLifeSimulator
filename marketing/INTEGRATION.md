# Integration Guide: Rating Prompt & Share Your Life Features

This document provides implementation instructions for two marketing/engagement features added to Deep Life Simulator:

1. **In-App Rating Prompt** - Intelligently requests app store reviews
2. **Share Your Life Card** - Allows players to share their character summary

---

## Feature 1: In-App Rating Prompt

### Overview
The rating prompt encourages players to rate the app after favorable gaming moments (career promotions, weddings, prestige achievements, property purchases). It respects a 60-week cooldown to prevent spam.

### Files Involved
- **Implementation**: `utils/ratingPrompt.ts`
- **Integration points**: `contexts/game/actions/*.ts` (multiple action files)
- **Context**: `contexts/game/GameActionsContext.tsx`

### Installation Step 1: Add expo-store-review Package

The feature uses `expo-store-review` for native store review prompts. Add it to your project:

```bash
expo add expo-store-review
```

Alternatively, if using EAS Build, it will auto-install based on your native config.

### Installation Step 2: Configure in app.config.js

Add the store review plugin to `app.config.js` if not already present:

```javascript
// app.config.js
export default {
  plugins: [
    [
      'expo-store-review',
      // Optional: configure platform-specific behavior
    ],
  ],
};
```

**CRITICAL**: Never remove config plugins from `app.config.js` if the package is in `package.json`. The native SDK initializes before JS code runs.

### Usage: Calling the Rating Prompt

The `maybeRequestReview()` function has this signature:

```typescript
export async function maybeRequestReview(
  gameState: GameState,
  isPositiveEvent: boolean = false
): Promise<boolean>
```

Call it after positive moments. The function will:
1. Verify player has played ≥20 weeks
2. Verify ≥60 weeks since last prompt
3. Verify it's a positive event
4. Show the native store review dialog if conditions met
5. Return `true` if prompt was shown, `false` otherwise

### Where to Integrate: Action Functions

Add calls to `maybeRequestReview()` in these locations. **Do NOT modify GameActionsContext.tsx directly** — these are action files with simpler scope:

#### 1. Career Promotion
**File**: `contexts/game/actions/JobActions.ts`
**Function**: `promoteCareer()`
**Location**: After career level is incremented (around line 659)

```typescript
// After promotion success:
const newLevel = career.level + 1;
setGameState(prev => {
  // ... promotion logic ...
});

// Add this:
import { maybeRequestReview } from '@/utils/ratingPrompt';
maybeRequestReview(gameState, true).catch(err =>
  logger.debug('[PromoRating] Review prompt failed', err)
);
```

#### 2. Wedding/Marriage
**File**: `contexts/game/actions/DatingActions.ts`
**Function**: `planWedding()`
**Location**: After wedding is successfully scheduled (around line 410-430)

```typescript
// After wedding plan is created:
setGameState(prev => {
  // ... wedding logic ...
});

// Add this:
import { maybeRequestReview } from '@/utils/ratingPrompt';
maybeRequestReview(gameState, true).catch(err =>
  logger.debug('[WeddingRating] Review prompt failed', err)
);
```

#### 3. Prestige Achievement
**File**: `contexts/game/GameActionsContext.tsx`
**Function**: `executePrestigeAction()` (the useCallback hook)
**Location**: After prestige execution completes successfully (around line 3750)

```typescript
// After prestige executes:
const newGameState = executePrestigeFunction(currentState, chosenPath, childId);
setGameState(newGameState);

// Add this:
import { maybeRequestReview } from '@/utils/ratingPrompt';
maybeRequestReview(newGameState, true).catch(err =>
  logger.debug('[PrestigeRating] Review prompt failed', err)
);
```

#### 4. Real Estate Purchase (First Property)
**File**: `contexts/game/GameActionsContext.tsx` or a dedicated real estate action file
**Function**: Wherever real estate is purchased
**Location**: After property is successfully added to gameState.realEstate

```typescript
// After property purchase:
setGameState(prev => ({
  ...prev,
  realEstate: [...prev.realEstate, newProperty],
  stats: { ...prev.stats, money: prev.stats.money - price },
}));

// Add this (only on FIRST property):
import { maybeRequestReview } from '@/utils/ratingPrompt';
const isFirstProperty = gameState.realEstate.length === 0;
if (isFirstProperty) {
  maybeRequestReview(gameState, true).catch(err =>
    logger.debug('[PropertyRating] Review prompt failed', err)
  );
}
```

### Behavior Details

**Conditions Check Order**:
1. `weeksLived < 20` → no prompt (too early)
2. `isPositiveEvent === false` → no prompt
3. `60+ weeks since last prompt` check → no prompt if in cooldown
4. If all pass → show native store review dialog

**Storage**:
- Key: `'lastReviewPromptWeek'`
- Value: The `gameState.weeksLived` when prompt was shown
- Persistent across sessions via AsyncStorage

**Error Handling**:
- Module not available (expo-store-review not installed) → returns false, no crash
- AsyncStorage unavailable → logs warning, continues anyway
- Invalid gameState → returns false safely

**Testing**:
```typescript
// To test: reset the cooldown and check
import { resetRatingPromptCooldown, getLastReviewPromptWeek } from '@/utils/ratingPrompt';

// Check when last prompt was shown
const lastWeek = await getLastReviewPromptWeek(); // Returns number | null
console.log('Last review prompt:', lastWeek);

// Reset for testing
await resetRatingPromptCooldown();
```

---

## Feature 2: Share Your Life Card

### Overview
A beautiful glassmorphic card component that displays a player's life summary (name, career, net worth, spouse, children, prestige level, tagline) with options to share or copy the text.

### Files Involved
- **Component**: `components/ShareLifeCard.tsx`
- **Integration point**: Any screen showing player stats (HomeScreen, ProfileScreen, etc.)

### Usage: Adding to UI

#### Basic Integration
```typescript
import ShareLifeCard from '@/components/ShareLifeCard';
import { useState } from 'react';
import { GameState } from '@/contexts/game/types';

export function MyScreen() {
  const { gameState } = useGameState();
  const [showShareCard, setShowShareCard] = useState(false);

  return (
    <>
      {/* Your existing UI */}
      <TouchableOpacity onPress={() => setShowShareCard(true)}>
        <Text>Share Your Life</Text>
      </TouchableOpacity>

      {/* Share Card Modal */}
      {showShareCard && (
        <ShareLifeCard
          gameState={gameState}
          onClose={() => setShowShareCard(false)}
        />
      )}
    </>
  );
}
```

#### Recommended Integration Points

1. **Home/Dashboard Screen**
   - Add a "Share" button in the player stats area
   - Show card when button is tapped

2. **Profile Screen**
   - Add a floating action button or card action
   - Naturally fits alongside character customization

3. **Weekly Summary Modal**
   - Add "Share" option when weekly summary appears
   - Captures moment of accomplishment

4. **Achievements/Milestones Screen**
   - Add after major milestone (marriage, prestige, etc.)
   - Encourages social sharing during celebration

### Features

**Card Displays**:
- Character name and age
- Current career and weekly salary
- Cash on hand and total net worth
- Marriage status (if married)
- Number of children (if any)
- Prestige generation level
- Dynamic tagline based on life situation

**Share Methods**:
1. **Native Share** (`Share.share()`) — Opens device's native share sheet
   - Works with Messages, Email, Twitter, Facebook, etc.
   - Platform-specific formatting

2. **Copy to Clipboard** — Copies formatted text to clipboard
   - User can then paste anywhere
   - Fallback if native clipboard unavailable

**Dynamic Taglines**:
The tagline changes based on player status:
- High net worth (>$1M): "💎 Living the dream life!"
- Married with kids: "👨‍👩‍👧‍👦 Building a legacy! X kids deep"
- Married no kids: "💕 Happily married & thriving"
- High career level (3+): "🚀 Career on fire!"
- High happiness: "😄 Living my best life"
- Later generation: "👑 Generation X - carrying the legacy forward"
- Default: "🌟 Making moves in life"

**Share Text Format**:
```
🎮 My Deep Life:
👤 CharacterName (Age 45)
💼 CEO - $50K/wk
💰 Net Worth: $2.5M
💕 Married to SpouseName
👨‍👩‍👧‍👦 3 children
👑 Generation 3
💎 Living the dream life!

#DeepLifeSim
```

### Styling

The component uses the project's design system:
- **Theme**: Respects `gameState.settings.darkMode`
- **Glassmorphism**: Uses `getGlassCard()` from `utils/glassmorphismStyles.ts`
- **Scaling**: Responsive via `scale()`, `fontScale()`, `responsiveWidth()`
- **Colors**: Pulls from `getThemeColors()` for consistency
- **Icons**: Lucide React Native icons throughout

### Dependencies

The component requires:
- `react-native` (built-in)
- `lucide-react-native` (already in project)
- `@react-native-clipboard/clipboard` (optional, for clipboard fallback)

If clipboard is unavailable, the Copy button will still exist but won't work — it logs a warning instead of crashing.

### Customization Options

To customize the taglines, edit the `generateTagline()` function in `ShareLifeCard.tsx`:

```typescript
function generateTagline(gameState: GameState): string {
  const { stats, family, generationNumber } = gameState;
  const netWorth = calculateNetWorth(gameState);

  // Edit these conditions:
  if (netWorth > 1000000) {
    return '💎 Your custom tagline here!';
  }
  // ... more cases ...
}
```

To customize share format, edit the `shareText` variable:

```typescript
const shareText = `🎮 My Deep Life:
// Edit format here
// Include any fields from gameState you want
#DeepLifeSim`;
```

---

## Testing Checklist

### Rating Prompt Testing

- [ ] Player with <20 weeks lived doesn't see prompt (wait until week 21+)
- [ ] Player sees prompt after a promotion
- [ ] Player sees prompt after planning a wedding
- [ ] After first prompt, cooldown prevents second prompt within 60 weeks
- [ ] After 60 weeks, next positive event triggers prompt again
- [ ] `resetRatingPromptCooldown()` allows immediate re-testing
- [ ] App doesn't crash if expo-store-review is missing
- [ ] AsyncStorage properly tracks last prompt week

### Share Card Testing

- [ ] Card displays correctly on light and dark mode
- [ ] All fields populate correctly (name, age, career, salary, net worth)
- [ ] Spouse name shows only if married
- [ ] Children count shows only if has kids
- [ ] Generation level always displays
- [ ] Tagline changes appropriately for different player situations
- [ ] Share button opens native share sheet
- [ ] Copy button copies text to clipboard
- [ ] Copy button shows "Copied" confirmation for 2 seconds
- [ ] Card closes when onClose is called
- [ ] Close button (×) works properly
- [ ] Loading state shows during share operation
- [ ] Card scales responsively on different device sizes
- [ ] Glassmorphic styling is visible with proper transparency

---

## Notes for Developers

### Architecture Principles

Both features follow the project's core principles:

1. **Correctness**: Rating prompt safely handles missing modules. Share card degrades gracefully if clipboard unavailable.
2. **Simplicity**: Rating prompt is a single utility file. Share card is self-contained component with no external dependencies.
3. **Root Causes**: No band-aids — uses proper native APIs instead of hacky workarounds.
4. **Elegance**: Glassmorphism styling aligns with design system. Responsive scaling follows established patterns.

### State Management

- **Rating Prompt**: Uses AsyncStorage only (no GameState mutation)
- **Share Card**: Read-only of GameState (no mutations)
- Both follow immutable patterns established in the project

### Performance

- **Rating Prompt**: Minimal overhead — single AsyncStorage read/write, native library call
- **Share Card**: Component renders once, listeners only on button presses
- No impact on main game loop or weekly progression

### Future Enhancements

Potential improvements (not included in MVP):

1. **Rating Prompt**:
   - A/B test different cooldown periods (30, 60, 90 weeks)
   - Track which positive events convert best
   - Variant: show at specific milestones (50 weeks played, $1M net worth, etc.)

2. **Share Card**:
   - Take screenshot and share as image
   - Deep link to app store for recipient
   - Track shares analytics
   - Leaderboard integration (top net worth, etc.)
   - Historical snapshots (share past generations)

---

## Troubleshooting

### Rating Prompt Not Showing

1. **Check week counter**: `console.log(gameState.weeksLived)` — must be ≥20
2. **Check cooldown**: Run `getLastReviewPromptWeek()` to see when last shown
3. **Reset for testing**: Run `resetRatingPromptCooldown()`
4. **Check module**: Verify `expo-store-review` installed via `expo doctor`
5. **Verify API called**: Add console.log in the action function before `maybeRequestReview()`

### Share Card Not Showing

1. **Check visibility**: Confirm `showShareCard` state is true
2. **Check gameState**: Verify props are being passed correctly
3. **Check theme**: In dark/light mode toggle, card should look correct
4. **Check responsiveness**: Test on different device sizes

### Copy to Clipboard Not Working

1. The component gracefully handles missing clipboard
2. Check: `require('@react-native-clipboard/clipboard')` available?
3. Fallback: User can always use native Share button instead
4. Optional: Install `@react-native-clipboard/clipboard` for better support

### Glassmorphism Not Visible

1. Check `useTheme()` hook is being called
2. Verify `getDarkMode()` returns correct boolean
3. Test on physical device (simulator may have rendering differences)
4. Ensure backdrop blur is enabled in OS settings

---

## Deployment Notes

### Before Release

1. Run `npm run preflight` to type-check both new files
2. Test rating prompt on both iOS and Android test builds
3. Verify share card on various device sizes
4. Get design review of share card styling
5. Consider A/B testing rating prompt (show to 50% of users first)

### Post-Release Monitoring

1. **Analytics**: Track rating prompt show rate vs. acceptance rate
2. **Analytics**: Track share button clicks and share destinations
3. **Crashes**: Monitor for any exceptions in ratingPrompt.ts or ShareLifeCard.tsx
4. **User Feedback**: Watch for complaints about rating prompt frequency

---

## Support

For issues with these features:

1. Check logs: `logger.debug('[RatingPrompt]...')` and `logger.info('[ShareLifeCard]...')`
2. Review this document's testing section
3. Check CLAUDE.md for general project conventions
4. Reference the code comments in the implementation files

