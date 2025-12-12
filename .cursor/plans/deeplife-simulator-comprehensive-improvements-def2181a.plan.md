<!-- def2181a-609c-4770-bf0a-15c3d40a37c1 dc8d1b56-b355-4bf3-b0a7-96c758e3a981 -->
# DeepLife Simulator - Comprehensive Improvements Implementation Plan

## Overview

This plan covers all High and Medium priority improvements organized into 4 phases over 8-12 weeks. Each phase builds on the previous one, ensuring stability before adding new features.

---

## Phase 1: Critical Foundation (Weeks 1-2)

**Goal:** Fix critical issues and complete context migration

### 1.1 Complete GameActionsContext Migration

**Priority:** Critical

**Files:**

- `contexts/game/GameActionsContext.tsx` (currently has 50+ placeholder functions)
- `contexts/GameContext.tsx` (7655 lines - migrate all action functions)

**Implementation:**

1. Migrate all action functions from `GameContext.tsx` to `GameActionsContext.tsx`:

   - Game progression: `nextWeek`, `resolveEvent`, `checkAchievements`
   - Jobs: `performStreetJob`, `gainCriminalXp`, `gainCrimeSkillXp`, `unlockCrimeSkillUpgrade`, `applyForJob`, `quitJob`
   - Hobbies: `trainHobby`, `enterHobbyTournament`, `uploadSong`, `uploadArtwork`, `playMatch`, `acceptContract`, `extendContract`, `cancelContract`, `buyHobbyUpgrade`, `dive`, `completeMinigame`
   - Items: `buyItem`, `sellItem`, `buyDarkWebItem`, `buyHack`, `performHack`, `buyFood`, `performHealthActivity`, `toggleDietPlan`
   - Jail: `performJailActivity`, `serveJailTime`, `payBail`
   - Relationships: `updateRelationship`, `addRelationship`, `addSocialRelation`, `interactRelation`, `breakUpWithPartner`, `proposeToPartner`, `moveInTogether`, `haveChild`, `askForMoney`, `callRelationship`, `recordRelationshipAction`
   - Pets: `adoptPet`, `feedPet`, `playWithPet`
   - Education: `startEducation`
   - Company: `createCompany`, `buyCompanyUpgrade`, `addWorker`, `removeWorker`, `buyMiner`, `selectMiningCrypto`, `buyWarehouse`, `upgradeWarehouse`, `selectWarehouseMiningCrypto`
   - Crypto: `buyCrypto`, `sellCrypto`, `swapCrypto`
   - IAP: `buyPerk`, `buyStarterPack`, `buyGoldPack`, `buyGoldUpgrade`, `buyRevival`
   - Profile: `updateUserProfile`, `updateSettings`
   - Save/Load: `saveGame`, `loadGame`, `restartGame`, `clearSaveSlot`, `triggerCacheClear`
   - Permanent Perks: `savePermanentPerk`, `hasPermanentPerk`, `loadPermanentPerks`
   - Daily Challenges: `initializeDailyChallenges`, `updateDailyChallengeProgress`, `claimDailyChallengeReward`
   - Achievements: `claimProgressAchievement`
   - Character: `reviveCharacter`

2. Each function must:

   - Use `useGameState()` hook to access state
   - Use `useGameData()` for helper functions
   - Maintain all existing logic and dependencies
   - Include proper error handling
   - Use `useCallback` for memoization

3. Update `GameContext.tsx` to use split contexts:

   - Remove action function implementations
   - Import and use hooks from split contexts
   - Maintain backward compatibility with `useGame()` hook

4. Update all components using `useGame()` to use specific context hooks where possible

**Testing:**

- Test all migrated functions work identically
- Verify no regressions in game functionality
- Check performance improvements

### 1.2 Console.log Cleanup

**Priority:** High

**Files:**

- `contexts/GameContext.tsx` (71 console statements)
- All other files with console statements

**Implementation:**

1. Create `utils/logger.ts`:
   ```typescript
   export class Logger {
     static log(message: string, ...args: any[]): void {
       if (__DEV__) console.log(`[DeepLife] ${message}`, ...args);
     }
     static error(message: string, ...args: any[]): void {
       if (__DEV__) console.error(`[DeepLife] ERROR: ${message}`, ...args);
       // In production, send to crash reporting
     }
     static warn(message: string, ...args: any[]): void {
       if (__DEV__) console.warn(`[DeepLife] WARN: ${message}`, ...args);
     }
     static info(message: string, ...args: any[]): void {
       if (__DEV__) console.info(`[DeepLife] INFO: ${message}`, ...args);
     }
   }
   ```

2. Replace all `console.log/error/warn/info` with `Logger.log/error/warn/info`
3. Add log levels (debug, info, warn, error)
4. Integrate with Sentry for production error logging
5. Add log filtering by category (game, save, iap, etc.)

**Files to update:**

- `contexts/GameContext.tsx` (71 instances)
- `utils/saveQueue.ts`
- `components/computer/GamingStreamingApp.tsx`
- All other files with console statements

### 1.3 Error Boundary Consolidation

**Priority:** High

**Files:**

- `components/ErrorBoundary.tsx`
- `components/ui/ErrorBoundary.tsx` (duplicate)

**Implementation:**

1. Consolidate into single `components/ErrorBoundary.tsx`
2. Merge features from both:

   - Sentry integration
   - Retry mechanism
   - Error reporting UI
   - Fallback UI

3. Remove duplicate `components/ui/ErrorBoundary.tsx`
4. Update all imports to use consolidated version
5. Add error boundary to all major screens

### 1.4 Memory Leak Fixes

**Priority:** High

**Files:**

- `contexts/GameContext.tsx` (all useEffect hooks)

**Implementation:**

1. Audit all `useEffect` hooks in `GameContext.tsx`:

   - Line 3156: IAP trigger interval cleanup
   - Line 5986: setTimeout cleanup
   - All interval/timer cleanup
   - Event listener cleanup

2. Add cleanup functions to all useEffect hooks
3. Use `useRef` for intervals/timers to ensure proper cleanup
4. Add memory profiling in development mode
5. Test for memory leaks with long play sessions

---

## Phase 2: Feature Completion (Weeks 3-4)

**Goal:** Complete incomplete features

### 2.1 Pet Food System Implementation

**Priority:** High

**Files:**

- `components/mobile/PetApp.tsx` (line 476 - "Coming Soon" alert)
- `contexts/GameContext.tsx` (pet feeding logic)

**Implementation:**

1. Create pet food data structure:
   ```typescript
   interface PetFood {
     id: string;
     name: string;
     price: number;
     nutrition: number; // 1-100
     happiness: number; // 0-20
     health: number; // 0-10
     quality: 'basic' | 'premium' | 'luxury';
   }
   ```

2. Add pet food items to game state
3. Implement `feedPet` function in `GameActionsContext`:

   - Check if player has food
   - Apply nutrition, happiness, health bonuses
   - Remove food from inventory
   - Update pet stats
   - Add feeding cooldown (once per day)

4. Update `PetApp.tsx`:

   - Remove "Coming Soon" alert
   - Implement buy food functionality
   - Show pet hunger level
   - Add feeding UI with food selection
   - Show feeding effects

5. Add pet hunger system:

   - Pets get hungry over time
   - Low hunger affects pet happiness/health
   - Visual indicators for hunger level

### 2.2 Leaderboard Implementation

**Priority:** Medium

**Files:**

- `components/LeaderboardModal.tsx` (currently shows "Coming Soon")
- `lib/progress/leaderboard.ts` (exists but may need enhancement)

**Implementation:**

1. Backend integration (if not exists):

   - Create leaderboard API endpoints
   - User authentication/identification
   - Score submission
   - Ranking retrieval

2. Update `lib/progress/leaderboard.ts`:

   - Implement score submission
   - Implement ranking retrieval
   - Add caching for offline support
   - Add error handling

3. Update `LeaderboardModal.tsx`:

   - Remove "Coming Soon" badge
   - Implement leaderboard display:
     - Global rankings (net worth, weeks lived, achievements)
     - Weekly rankings
     - Friends rankings (if friend system exists)
   - Add filters (all-time, weekly, monthly)
   - Add player profile links
   - Show user's current rank
   - Add refresh functionality

4. Add leaderboard categories:

   - Net Worth
   - Weeks Lived
   - Achievements Unlocked
   - Total Happiness
   - Companies Owned

5. Add rewards for top players (weekly)

### 2.3 Sound System Implementation

**Priority:** Medium

**Files:**

- `utils/feedbackSystem.ts` (line 127 - falls back to haptic)
- `contexts/GameContext.tsx` (settings.soundEnabled)

**Implementation:**

1. Install `expo-av` for audio playback
2. Create `utils/soundManager.ts`:
   ```typescript
   export class SoundManager {
     static sounds: { [key: string]: Audio.Sound } = {};
     static async loadSounds(): Promise<void>
     static play(soundName: string, volume?: number): Promise<void>
     static stop(soundName: string): Promise<void>
     static setMasterVolume(volume: number): void
   }
   ```

3. Add sound effects:

   - Button clicks
   - Achievement unlock
   - Money gain/loss
   - Stat changes
   - Event triggers
   - Error sounds

4. Add background music:

   - Main menu music
   - Gameplay music (ambient)
   - Different tracks for different life stages

5. Update `FeedbackSystem` to use SoundManager
6. Add sound settings UI:

   - Master volume
   - Music volume
   - SFX volume
   - Mute toggle

7. Respect `settings.soundEnabled` flag

### 2.4 AdMob Re-implementation

**Priority:** Medium

**Files:**

- `services/AdMobService.ts` (currently disabled)

**Implementation:**

1. Install `react-native-google-mobile-ads`
2. Update `services/AdMobService.ts`:

   - Remove deprecated expo-ads-admob code
   - Implement with react-native-google-mobile-ads
   - Banner ads
   - Interstitial ads
   - Rewarded ads

3. Add ad placement strategy:

   - Banner: Bottom of main screens
   - Interstitial: Between major actions (every 3-5 actions)
   - Rewarded: Optional for bonuses (extra gems, energy refill)

4. Respect user's IAP status (no ads for premium users)
5. Add ad loading states
6. Handle ad errors gracefully
7. Test with test ad IDs before production

---

## Phase 3: Quality & Testing (Weeks 5-6)

**Goal:** Improve code quality and test coverage

### 3.1 TypeScript Strict Mode Compliance

**Priority:** Medium

**Files:**

- All `.ts` and `.tsx` files

**Implementation:**

1. TypeScript strict mode is already enabled in `tsconfig.json`
2. Find and fix all type errors:

   - Replace `any` types with proper types
   - Fix null/undefined handling
   - Add proper type guards
   - Fix function type issues

3. Create type definitions for:

   - All game state interfaces
   - All component props
   - All function parameters/returns

4. Add JSDoc comments with types
5. Enable additional strict checks if needed

### 3.2 Test Coverage Increase

**Priority:** Medium

**Current:** Limited test coverage

**Target:** 80%+ coverage

**Implementation:**

1. Set up coverage reporting:

   - Configure Jest coverage
   - Add coverage thresholds
   - Set up CI coverage reports

2. Unit tests for utilities:

   - `utils/saveValidation.ts`
   - `utils/statUtils.ts`
   - `utils/gameBalance.ts`
   - `utils/logger.ts`
   - All calculation functions

3. Integration tests:

   - Game state updates
   - Save/load operations
   - IAP flow
   - Achievement system

4. Component tests:

   - All major components
   - User interactions
   - State changes

5. E2E tests:

   - Complete game flow
   - Save/load cycle
   - IAP purchase flow

6. Add test utilities:

   - Mock game state factory
   - Test helpers
   - Snapshot testing

---

## Phase 4: Quality of Life & Polish (Weeks 7-8)

**Goal:** Enhance user experience and add polish

### 4.1 Quick Actions Panel

**Priority:** Medium

**Files:**

- New: `components/QuickActionsPanel.tsx`

**Implementation:**

1. Create floating action button (FAB) component
2. Add quick actions:

   - Next Week
   - Save Game
   - Open Market
   - Open Work
   - Open Progression
   - Settings

3. Make actions customizable in settings
4. Add haptic feedback on actions
5. Add animations for FAB
6. Position FAB on main screens
7. Add swipe gestures for quick access

### 4.2 Auto-Save Indicator

**Priority:** Medium

**Files:**

- New: `components/AutoSaveIndicator.tsx`
- `contexts/GameContext.tsx` (saveGame function)

**Implementation:**

1. Create save status indicator component:

   - Show "Saving..." when save in progress
   - Show "Saved" with timestamp when complete
   - Show "Save Failed" on error

2. Add save status to GameUIContext
3. Update saveGame to update status
4. Display indicator in header or as toast
5. Add last save timestamp display
6. Add manual save button
7. Show save queue status if multiple saves pending

### 4.3 Offline Mode Enhancements

**Priority:** Medium

**Files:**

- `utils/saveQueue.ts`
- `lib/progress/cloud.ts`

**Implementation:**

1. Detect network connectivity:

   - Use `@react-native-community/netinfo`
   - Monitor connection status
   - Show offline indicator

2. Queue operations when offline:

   - Save operations
   - Leaderboard submissions
   - Cloud sync operations

3. Auto-sync when connection restored:

   - Background sync
   - Conflict resolution
   - Merge strategies

4. Offline data storage:

   - Store queued operations
   - Store pending syncs
   - Persist queue across app restarts

5. Add offline mode UI:

   - Show offline banner
   - Show queued operations count
   - Manual sync button

### 4.4 Export/Import Save Data

**Priority:** Medium

**Files:**

- New: `utils/saveExport.ts`
- `app/(tabs)/settings.tsx` or new settings modal

**Implementation:**

1. Create export function:

   - Convert save data to JSON
   - Add metadata (version, timestamp, checksum)
   - Compress if large

2. Create import function:

   - Validate imported data
   - Check version compatibility
   - Verify checksum
   - Migrate if needed

3. Add UI:

   - Export button in settings
   - Import button in settings
   - File picker for import
   - Share functionality for export

4. Add safety features:

   - Backup before import
   - Confirmation dialogs
   - Error handling

5. Support multiple formats:

   - JSON (readable)
   - Compressed (smaller)

### 4.5 Accessibility Improvements

**Priority:** Medium

**Files:**

- All component files

**Implementation:**

1. Add accessibility labels:

   - All buttons
   - All interactive elements
   - All images/icons

2. Add accessibility hints:

   - Action descriptions
   - State information
   - Navigation hints

3. Dynamic text sizing:

   - Support system font scaling
   - Test with large text
   - Ensure UI doesn't break

4. Color blind support:

   - Add color blind palettes
   - Use patterns/icons in addition to color
   - High contrast mode

5. Screen reader testing:

   - Test with VoiceOver (iOS)
   - Test with TalkBack (Android)
   - Fix navigation issues

6. Keyboard navigation (for web):

   - Tab order
   - Focus indicators
   - Keyboard shortcuts

### 4.6 Code Splitting & Performance

**Priority:** Medium

**Files:**

- All screen components
- `app/_layout.tsx`

**Implementation:**

1. Implement lazy loading:

   - Lazy load screens
   - Lazy load heavy components
   - Code splitting by route

2. Optimize bundle size:

   - Remove unused dependencies
   - Tree shaking
   - Minification

3. Image optimization:

   - Use OptimizedImage component everywhere
   - Lazy load images
   - Compress images

4. Reduce initial load time:

   - Preload critical assets
   - Defer non-critical loading
   - Show loading states

### 4.7 API Rate Limiting

**Priority:** Medium

**Files:**

- `lib/progress/cloud.ts`
- `services/IAPService.ts`

**Implementation:**

1. Create rate limiter utility:
   ```typescript
   export class RateLimiter {
     static limit(category: string, maxRequests: number, windowMs: number): boolean
   }
   ```

2. Apply to cloud sync:

   - Max 1 sync per 5 seconds
   - Queue additional requests

3. Apply to leaderboard:

   - Max 1 submission per minute
   - Batch updates

4. Apply to IAP:

   - Max 1 purchase check per second

5. Add retry with exponential backoff
6. Show user-friendly error messages

### 4.8 Error Recovery

**Priority:** Medium

**Files:**

- `components/ErrorBoundary.tsx`
- `contexts/GameContext.tsx`

**Implementation:**

1. Automatic error recovery:

   - Retry failed operations
   - Fallback to cached data
   - Reset to last known good state

2. Error reporting:

   - Collect error context
   - Send to crash reporting
   - User-friendly error messages

3. Recovery strategies:

   - Save operation: Retry with exponential backoff
   - Load operation: Use backup save
   - Network error: Queue for retry
   - State corruption: Restore from backup

4. Add recovery UI:

   - Show recovery progress
   - Allow manual recovery
   - Show recovery options

---

## Implementation Order & Dependencies

**Week 1-2: Phase 1 (Critical Foundation)**

- 1.1 GameActionsContext Migration (Week 1)
- 1.2 Console.log Cleanup (Week 1-2)
- 1.3 Error Boundary Consolidation (Week 2)
- 1.4 Memory Leak Fixes (Week 2)

**Week 3-4: Phase 2 (Feature Completion)**

- 2.1 Pet Food System (Week 3)
- 2.2 Leaderboard Implementation (Week 3-4)
- 2.3 Sound System (Week 4)
- 2.4 AdMob Re-implementation (Week 4)

**Week 5-6: Phase 3 (Quality & Testing)**

- 3.1 TypeScript Strict Mode (Week 5)
- 3.2 Test Coverage (Week 5-6)

**Week 7-8: Phase 4 (Quality of Life)**

- 4.1 Quick Actions Panel (Week 7)
- 4.2 Auto-Save Indicator (Week 7)
- 4.3 Offline Mode (Week 7-8)
- 4.4 Export/Import (Week 8)
- 4.5 Accessibility (Week 8)
- 4.6 Code Splitting (Week 8)
- 4.7 API Rate Limiting (Week 8)
- 4.8 Error Recovery (Week 8)

---

## Success Metrics

- **Phase 1:** All contexts working, no console logs in production, no memory leaks
- **Phase 2:** All features complete and functional
- **Phase 3:** 80%+ test coverage, zero TypeScript errors
- **Phase 4:** Improved UX metrics, better performance, accessibility compliance

---

## Notes

- Test each phase thoroughly before moving to next
- Maintain backward compatibility throughout
- Document all changes
- Update README with new features
- Consider user feedback during implementation

### To-dos

- [ ] Fix death popup race condition in GameContext.tsx (lines 5900-5926) - Replace setTimeout chain with requestAnimationFrame and add state guards
- [ ] Create save validation system - Add utils/saveValidation.ts with checksum, validation, and atomic save operations
- [ ] Fix memory leaks - Audit all useEffect hooks in GameContext.tsx, add cleanup for timers/intervals/listeners
- [ ] Replace IAP polling with event-driven sync - Create services/IAPSyncService.ts with queue and retry logic
- [ ] Create AsyncStorage wrapper with error handling - Add utils/storageWrapper.ts with retry logic and fallbacks
- [ ] Add stat clamping utility - Create utils/statUtils.ts and apply to all stat updates
- [ ] Split GameContext into 4 focused contexts - Create contexts/game/ directory with GameStateContext, GameActionsContext, GameUIContext, GameDataContext
- [ ] Add memoization to all components - Add React.memo, useMemo, useCallback to market.tsx, BankApp.tsx, StocksApp.tsx and all FlatLists
- [ ] Optimize all FlatList components - Add removeClippedSubviews, maxToRenderPerBatch, getItemLayout to all lists
- [ ] Implement image optimization - Install react-native-fast-image and replace all Image components
- [ ] Remove all any types and enable strict TypeScript - Update tsconfig.json and fix all type errors
- [ ] Enhance error handling - Add Sentry integration, improve ErrorBoundary, add user-friendly error messages
- [ ] Add skeleton loading screens - Create components/ui/SkeletonLoader.tsx and replace loading spinners
- [ ] Enhance haptic feedback - Update hooks/useHapticFeedback.ts and add to all button components
- [ ] Enhance toast notifications - Update contexts/ToastContext.tsx with more variants and animations
- [ ] Improve accessibility - Add labels/hints to all components, test with VoiceOver/TalkBack, ensure WCAG AA compliance
- [ ] Add gesture support - Create SwipeableItem and LongPressMenu components
- [ ] Implement friend system - Create lib/social/friends.ts and friend UI components
- [ ] Enhance leaderboards - Create lib/progress/leaderboard.ts and update LeaderboardModal.tsx
- [ ] Enhance cloud sync - Create services/CloudSyncService.ts with real-time sync and conflict resolution
- [ ] Add analytics integration - Install Firebase Analytics and create services/AnalyticsService.ts
- [ ] Implement subscription system - Create services/SubscriptionService.ts and SubscriptionModal.tsx
- [ ] Add seasonal events system - Create lib/events/seasonal.ts and event UI components
- [ ] Enhance localization - Add support for top 20 languages and RTL support
- [ ] Increase test coverage to 80%+ - Add unit, integration, and E2E tests