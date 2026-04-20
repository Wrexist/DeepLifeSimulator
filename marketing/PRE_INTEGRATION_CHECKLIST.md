# Pre-Integration Checklist

This checklist ensures you're ready to integrate the two new marketing features.

---

## File Verification

### Core Implementation Files
- [ ] `utils/ratingPrompt.ts` exists (4.8 KB)
  ```bash
  ls -lh utils/ratingPrompt.ts
  ```

- [ ] `components/ShareLifeCard.tsx` exists (12 KB)
  ```bash
  ls -lh components/ShareLifeCard.tsx
  ```

### Documentation Files
- [ ] `marketing/INTEGRATION.md` exists (15 KB)
- [ ] `IMPLEMENTATION_SUMMARY.md` exists (12 KB)
- [ ] `QUICK_REFERENCE.md` exists (4.8 KB)
- [ ] `INTEGRATION_POINTS.md` exists (8.3 KB)

---

## Pre-Integration Tasks

### Task 1: Install Required Package
```bash
# In project root
expo add expo-store-review
```

**Verification**:
- [ ] Command completed without errors
- [ ] `package.json` has `expo-store-review` in dependencies
- [ ] No new warnings in `expo doctor`

**Expected Output**:
```
✓ expo-store-review installed
✓ Packages updated
```

### Task 2: Verify Project Structure
Ensure these paths exist and are writable:

- [ ] `/utils/` directory exists and is writable
- [ ] `/components/` directory exists and is writable
- [ ] `/contexts/game/actions/` directory exists
- [ ] `/marketing/` directory exists and is writable

```bash
# Quick check
test -d utils && test -d components && test -d marketing && echo "✓ OK" || echo "✗ Missing"
```

### Task 3: Review Documentation

Read these files in order:
1. [ ] `QUICK_REFERENCE.md` (5 min) — Quick overview
2. [ ] `marketing/INTEGRATION.md` (10 min) — Full details
3. [ ] `INTEGRATION_POINTS.md` (10 min) — Exact locations
4. [ ] `IMPLEMENTATION_SUMMARY.md` (15 min) — Deep dive

**Time**: ~40 minutes total

### Task 4: Verify TypeScript Setup
```bash
# Type check the project
npm run type-check

# Should complete with no errors related to new files
```

**Acceptable Output**:
- New files may have import path errors (expected, module resolution)
- No syntax errors in the new files themselves

---

## Integration Phase

### Step 1: Add Rating Prompt to JobActions

**File**: `contexts/game/actions/JobActions.ts`

- [ ] Open file in editor
- [ ] Find `promoteCareer()` function (around line 618)
- [ ] Locate the `setGameState` call (lines 653-668)
- [ ] After line 670, add the import and call
- [ ] Follow exact format from `INTEGRATION_POINTS.md`

**Quick Test**:
```typescript
// Visual check: paste this block and verify IDE accepts it
import { maybeRequestReview } from '@/utils/ratingPrompt';
maybeRequestReview(gameState, true).catch(err =>
  log.debug('[PromoRating] Review prompt failed', err)
);
```

### Step 2: Add Rating Prompt to DatingActions

**File**: `contexts/game/actions/DatingActions.ts`

- [ ] Open file in editor
- [ ] Find `planWedding()` function (around line 368)
- [ ] Locate the success return statement (lines 420-426)
- [ ] After line 420, add the import and call
- [ ] Follow exact format from `INTEGRATION_POINTS.md`

**Quick Test**: Same as Step 1

### Step 3: Add Rating Prompt to GameActionsContext

**File**: `contexts/game/GameActionsContext.tsx`

- [ ] Open file in editor
- [ ] Find `executePrestigeAction()` useCallback (around line 3738)
- [ ] Locate the `setGameState(newGameState)` call (line 3750)
- [ ] After that line, add the import and call
- [ ] Follow exact format from `INTEGRATION_POINTS.md`

**Quick Test**: Same as Step 1

### Step 4: (Optional) Add Rating Prompt to Real Estate

**File**: Unknown — find where real estate is purchased

- [ ] Search for where `realEstate` array is updated
- [ ] Look for: `[...prev.realEstate, newProperty]`
- [ ] Add call only if `isFirstProperty` (see INTEGRATION_POINTS.md)
- [ ] This is optional if feature doesn't exist yet

### Step 5: Add Share Card to Home Screen

**File**: `app/(tabs)/(home)/index.tsx` (or similar)

- [ ] Open home/dashboard screen
- [ ] Add state: `const [showShare, setShowShare] = useState(false);`
- [ ] Import: `import ShareLifeCard from '@/components/ShareLifeCard';`
- [ ] Add button: `<Button onPress={() => setShowShare(true)}>Share Life</Button>`
- [ ] Add component:
  ```typescript
  {showShare && (
    <ShareLifeCard
      gameState={gameState}
      onClose={() => setShowShare(false)}
    />
  )}
  ```

### Step 6: (Optional) Add Share Card to Profile Screen

**File**: Profile screen (if exists)

- [ ] Repeat Step 5 pattern in profile screen
- [ ] Consider adding to user profile editing area

### Step 7: (Optional) Add Share Card to Weekly Summary

**File**: Weekly summary modal/screen

- [ ] Find where weekly summary is displayed
- [ ] Add Share button and component (same pattern as Step 5)
- [ ] This makes sharing feel like celebrating achievement

---

## Code Quality Checks

### Syntax Check
```bash
# This might show module resolution errors (OK), but no syntax errors
npm run type-check
```

- [ ] No syntax errors in new files
- [ ] No missing imports
- [ ] No `any` types added

### Lint Check
```bash
# Check code style
npm run lint -- --fix
```

- [ ] All files pass linting
- [ ] No warnings about unused imports

### Build Check
```bash
# Quick type check only
npm run preflight:quick
```

- [ ] Command completes without errors
- [ ] No TypeScript errors introduced

---

## Testing Phase

### Test 1: Rating Prompt - Minimum Weeks
```typescript
// In dev console or test
const { gameState } = useGameState();
console.log('Weeks lived:', gameState.weeksLived);

// Must be >= 20 for prompt to ever show
// If < 20, manually set for testing via GameState editor
```

- [ ] Verify `weeksLived >= 20`
- [ ] If not, advance game to week 20+

### Test 2: Rating Prompt - Trigger After Promotion

```typescript
// In GameActionsContext or action file
1. Advance career progress to 100%
2. Call promoteCareer()
3. Check for rating prompt in UI
4. On iOS: appears as native pop-up
5. On Android: appears as native dialog
```

**Expected Behavior**:
- [ ] Career promotion succeeds
- [ ] No console errors
- [ ] Rating prompt appears (if week >= 20 and >= 60 weeks since last)

### Test 3: Rating Prompt - Cooldown Prevention

```typescript
// Test that prompt doesn't repeat immediately
1. Reset cooldown: resetRatingPromptCooldown()
2. Trigger promotion → prompt should show
3. Check last prompt week: getLastReviewPromptWeek()
4. Advance 59 weeks
5. Trigger another promotion → prompt should NOT show
6. Advance 1 more week (60 total)
7. Trigger third promotion → prompt should show again
```

**Expected Behavior**:
- [ ] First prompt shows
- [ ] Second prompt blocked (in cooldown)
- [ ] Third prompt shows (after cooldown expires)

### Test 4: Share Card - Renders Correctly

```typescript
1. Navigate to screen with Share Card
2. Check dark mode: component should be visible
3. Check light mode: component should look good
4. Check content:
   - Name displays
   - Age displays
   - Career displays
   - Salary displays
   - Net worth displays
```

**Expected Behavior**:
- [ ] Card renders in modal overlay
- [ ] All text visible and readable
- [ ] Colors appropriate for theme

### Test 5: Share Card - Share Button

```typescript
1. Tap Share button
2. Native share sheet should open
3. Can share to Messages, Email, etc.
4. Text contains:
   - 🎮 My Deep Life:
   - Character name
   - Age
   - Career
   - Salary
   - Net worth
   - #DeepLifeSim hashtag
```

**Expected Behavior**:
- [ ] Share sheet opens
- [ ] All text is formatted correctly
- [ ] Can successfully share

### Test 6: Share Card - Copy Button

```typescript
1. Tap Copy button
2. Button text changes to "Copied"
3. Wait 2 seconds
4. Button text changes back to "Copy"
5. Paste clipboard content somewhere
6. Verify it's the correct share text
```

**Expected Behavior**:
- [ ] Copy button shows confirmation
- [ ] Text actually gets copied to clipboard
- [ ] Confirmation shows for 2 seconds

### Test 7: Share Card - Responsive Design

```typescript
// Test on multiple devices/screen sizes
1. iPhone 12 (375px width): Card should fit
2. iPhone 14 Pro Max (430px width): Card should look great
3. iPad (768px width): Card should scale up appropriately
4. Android phone (360px width): Card should be readable
5. Android tablet (600px width): Card should look great
```

**Expected Behavior**:
- [ ] Card adapts to screen size
- [ ] Text remains readable
- [ ] Buttons remain tappable
- [ ] No text overflow

---

## Pre-Release Verification

### Full Type Check
```bash
npm run type-check
```

- [ ] No errors (or only existing errors)
- [ ] New files don't introduce type issues

### Full Lint Check
```bash
npm run lint
```

- [ ] No errors on new files
- [ ] Style matches project conventions

### Preflight Check
```bash
npm run preflight
```

- [ ] Type check passes
- [ ] Lint passes
- [ ] Tests pass (if any new ones added)

### Build Check
```bash
# iOS
npm run ios

# Android
npm run android
```

- [ ] Both platforms build without errors
- [ ] App launches successfully
- [ ] Features work on both platforms

---

## Deployment Checklist

Before committing:

- [ ] All 4 integration points complete
- [ ] Share card added to 2-3 screens
- [ ] All tests passing
- [ ] No console errors
- [ ] Both platforms tested
- [ ] Dark and light modes tested
- [ ] No breaking changes

Before releasing:

- [ ] Product review of features
- [ ] Analytics setup (if needed)
- [ ] User documentation updated (if needed)
- [ ] Release notes include new features
- [ ] Beta tested on TestFlight/Google Play
- [ ] Customer support briefed

---

## Troubleshooting During Integration

### "Cannot find module '@/utils/ratingPrompt'"
- [ ] Verify file exists: `ls utils/ratingPrompt.ts`
- [ ] Check TypeScript path aliases in `tsconfig.json`
- [ ] Restart TypeScript server in IDE

### "ShareLifeCard component not found"
- [ ] Verify file exists: `ls components/ShareLifeCard.tsx`
- [ ] Check import path matches exactly
- [ ] Verify no typos in component name

### "expo-store-review not found"
- [ ] Run: `expo add expo-store-review`
- [ ] Check: `npm ls expo-store-review`
- [ ] Verify in `package.json`

### "Rating prompt crashes the app"
- [ ] Check console for errors
- [ ] Verify try/catch is present
- [ ] Check that module is installed
- [ ] Review error handling in INTEGRATION.md

### "Share button doesn't work"
- [ ] Check for console errors
- [ ] Verify `Share.share()` API is available
- [ ] Test on physical device (simulator may not work)
- [ ] Check that gameState is being passed correctly

---

## Success Criteria

After integration, verify:

- [ ] ✓ Rating prompt installs and builds without errors
- [ ] ✓ Share card renders and works on all devices
- [ ] ✓ Promotion triggers review prompt (positive moment)
- [ ] ✓ Wedding triggers review prompt (positive moment)
- [ ] ✓ Prestige triggers review prompt (positive moment)
- [ ] ✓ Rating prompt respects 60-week cooldown
- [ ] ✓ Share button opens native share sheet
- [ ] ✓ Copy button copies text to clipboard
- [ ] ✓ Card displays correct player information
- [ ] ✓ Tagline changes based on player status
- [ ] ✓ Both dark and light modes work
- [ ] ✓ All responsive sizes work
- [ ] ✓ No console errors or warnings
- [ ] ✓ Type check passes
- [ ] ✓ Lint passes
- [ ] ✓ Builds on iOS and Android

---

## Sign-Off

When all above items are complete:

```
Date: _______________
Integrated By: ______________________
Reviewed By: ________________________
Tested On: iOS [ ] Android [ ] Both [ ]
Status: [ ] READY FOR RELEASE
```

---

## Next Actions

1. **Before Starting Integration**: Print this checklist
2. **During Integration**: Mark items as you complete them
3. **After Integration**: Run full test suite
4. **Before Merge**: Get code review from lead
5. **Before Release**: Verify on TestFlight/Play Store beta

---

## Support

- Questions: Check `QUICK_REFERENCE.md` first
- Integration help: See `INTEGRATION_POINTS.md` for exact line numbers
- Detailed guide: Read `marketing/INTEGRATION.md`
- Complete overview: See `IMPLEMENTATION_SUMMARY.md`

**Good luck! These features will greatly improve player engagement.**
