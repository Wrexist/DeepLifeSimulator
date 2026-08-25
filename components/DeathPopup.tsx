import React, { useEffect, useRef, useState, useMemo, useCallback } from 'react';
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  Animated,
  ScrollView,
  Alert,
  Share,
  Dimensions,
  type LayoutChangeEvent,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
} from 'react-native';
import Gradient from '@/components/ui/Gradient';
import { lazyAsyncStorage as AsyncStorage } from '@/utils/storageWrapper';
import { useRouter } from 'expo-router';
import { useOnboarding } from '@/src/features/onboarding/OnboardingContext';
import { NEW_LIFE_SLOT_UNSET } from '@/src/features/onboarding/slotSafety';
import { useGame } from '@/contexts/GameContext';
import { useGemStore, type GemStoreTab } from '@/contexts/GemStoreContext';
import { getProductConfig, IAP_PRODUCTS } from '@/utils/iapConfig';
import { safeSettings, safeStats, safeDate, safeUserProfile } from '@/utils/safeGameState';
import { Heart, RotateCcw, Brain, Check, Crown, Sparkles, TrendingUp, DollarSign, Users, Award, Briefcase, GraduationCap, Home, Building2, Trophy, Calendar, BookOpen, Share2, Gem, ChevronRight } from 'lucide-react-native';
import CharacterAvatar from '@/components/avatar/CharacterAvatar';
import { childParentSources } from '@/lib/avatar/family';
import { HeirGenerator } from '@/lib/legacy/heirGeneration';
import { calculatePrestigePoints } from '@/lib/prestige/prestigePoints';
import { defaultPrestigeData } from '@/lib/prestige/prestigeTypes';
import { computeInheritance } from '@/lib/legacy/inheritance';
import { simulateChildrenToAdulthood } from '@/lib/legacy/childSimulation';
import { MindsetId } from '@/lib/mindset/config';
import { logger } from '@/utils/logger';
import { formatMoney } from '@/utils/moneyFormatting';
import { REVIVE_GEM_COST, WEEKS_PER_YEAR } from '@/lib/config/gameConstants';
import { getThemeColors, accent, colors as theme } from '@/lib/config/theme';
import LifeStoryModal from './LifeStoryModal';
import { createStyles } from '@/components/DeathPopupStyles';
import { suspendLifeAutosave } from '@/utils/autosaveSuspension';
import { characterName } from '@/utils/characterName';
import { lifeQuality } from '@/lib/legacy/lifeQuality';
import DeathHero from '@/components/death/DeathHero';
import LifeQualityGauge from '@/components/death/LifeQualityGauge';
import { scale } from '@/utils/scaling';
const LinearGradient = Gradient;
const { height: windowHeight } = Dimensions.get('window');

function DeathPopup() {
  const { gameState, setGameState, startNewLifeFromLegacy, reviveCharacter, reviveWithPack, currentSlot, saveGame } = useGame();
  const router = useRouter();
  // The new life has to be told which slot it belongs in. This screen used to
  // navigate into onboarding without setting one, so the flow fell back to the
  // context default (slot 1) and wrote the fresh character over whatever was
  // there - the save-loss a player reported after a prestiged run vanished.
  const { setState: setOnboardingState } = useOnboarding();
  // App-level IAP store launcher - used to bridge out of "not enough gems"
  // dead-ends (revive / rewind) without auto-opening or blocking the death flow.
  // `isStoreOpen` lets the death Modal SUPPRESS itself while the store's own RN
  // Modal is presented (stacked-modal safety), then re-present when it closes.
  const { openStore, isStoreOpen } = useGemStore();
  // R2-A: death is the worst place to crash - onRequestClose is gated, so a
  // settings/stats/date NPE soft-locks the player. Pull through safe accessors.
  const settings = safeSettings(gameState);
  const date = safeDate(gameState);
  const { deathReason } = gameState;

  const [showLifeStory, setShowLifeStory] = useState(false);
  const [selectedHeirId, setSelectedHeirId] = useState<string | null>(null);
  const [selectedMindset] = useState<MindsetId | null>(
    (gameState.mindset?.activeTraitId as MindsetId | null) || null
  );
  const [activeTab, setActiveTab] = useState<'summary' | 'legacy'>('summary');

  // Theme-aware styles + color tokens (lib/config/theme.ts). Rebuilt only when
  // the player toggles dark mode so colors stay centrally managed.
  const styles = useMemo(() => createStyles(settings.darkMode), [settings.darkMode]);
  const c = getThemeColors(settings.darkMode);

  const fadeAnim = useRef(new Animated.Value(0)).current;
  const scaleAnim = useRef(new Animated.Value(0.9)).current;

  // P1-6: depend on specific fields rather than the whole gameState object -
  // computeInheritance walks money + bank + properties + stocks, so the
  // recompute is expensive and we don't want it firing on every unrelated save.
  const inheritanceSummary = useMemo(() => {
    return computeInheritance(gameState);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    gameState.stats?.money,
    gameState.bankSavings,
    gameState.realEstate,
    gameState.stocks?.holdings,
    gameState.loans,
  ]);

  const heirs = useMemo(() => {
    if (!gameState.family?.children || gameState.family.children.length === 0) return [];

    const simulatedChildren = simulateChildrenToAdulthood(gameState.family.children, gameState);

    return simulatedChildren.map((child: any) => {
      const result = HeirGenerator.generateHeir(
        child,
        gameState.activeTraits || [],
        (gameState.generationNumber || 1) + 1,
        gameState.lineageId ?? 'default_lineage',
        gameState.mindset?.activeTraitId ?? 'unknown_parent',
        gameState.family?.spouse?.id,
        []
      );

      const childInheritance = (() => {
        const totalNetWorth = inheritanceSummary.totalNetWorth;
        const baseInheritance = Math.floor(totalNetWorth * 0.1);

        let educationMultiplier = 1.0;
        if (child.educationLevel === 'university') {
          educationMultiplier = 1.2;
        } else if (child.educationLevel === 'specialized') {
          educationMultiplier = 1.3;
        }

        if (child.careerPath === 'professional' || child.careerPath === 'entrepreneur') {
          educationMultiplier += 0.1;
        }

        const inheritance = Math.floor(baseInheritance * educationMultiplier);
        return totalNetWorth < 100_000
          ? Math.min(1_000_000, inheritance)
          : inheritance;
      })();

      return {
        id: child.id,
        name: child.name || 'Unknown',
        age: Math.max(18, Math.floor(child.age || 18)),
        traits: (result as any).traits || [],
        stats: (result as any).stats || {},
        preview: result,
        child: child,
        inheritance: childInheritance,
        educationLevel: child.educationLevel,
        careerPath: child.careerPath,
        savings: child.savings || 0,
      };
    });
  }, [gameState.family?.children, gameState.activeTraits, gameState.generationNumber, gameState.lineageId, gameState.mindset?.activeTraitId, inheritanceSummary]);

  useEffect(() => {
    const entranceAnim = Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 300,
        useNativeDriver: true,
      }),
      Animated.spring(scaleAnim, {
        toValue: 1,
        tension: 50,
        friction: 7,
        useNativeDriver: true,
      }),
    ]);
    entranceAnim.start();

    return () => {
      entranceAnim.stop();
    };
  }, [fadeAnim, scaleAnim]);

  /**
   * Rewind targets.
   *
   * "Before Death" is filtered out. It is no longer created (see
   * `applyAutoCheckpoint`), but every save written before that change still
   * carries one, and offering it would keep the exploit alive for exactly the
   * players who already have it: a 500-gem rewind that returns a living
   * character one week older, which is what Revive charges thousands for and
   * what the $2.99 Revival Pack sells.
   *
   * Filtered rather than migrated away. The snapshot is harmless sitting in the
   * save, it rotates out of the 5-slot ring on its own as year checkpoints
   * accumulate, and deleting player data to fix a pricing mistake is a trade
   * worth not making.
   */
  const checkpoints = useMemo(
    () => (gameState.checkpoints ?? []).filter((cp) => cp?.label !== 'Before Death'),
    [gameState.checkpoints]
  );
  const rewindCost = useMemo(() => {
    try {
      const { getRewindCost } = require('@/lib/timeMachine/checkpointSystem');
      return getRewindCost(
        gameState.timeMachineUsesThisLife ?? 0,
        !!gameState.goldUpgrades?.time_machine,
        !!gameState.goldUpgrades?.chronomaster,
      );
    } catch {
      return 500;
    }
  }, [gameState.timeMachineUsesThisLife, gameState.goldUpgrades?.time_machine, gameState.goldUpgrades?.chronomaster]);
  const lifeRibbon = useMemo(() => {
    try {
      const { classifyLife } = require('@/lib/legacy/ribbonSystem');
      return classifyLife(gameState);
    } catch {
      return null;
    }
  }, [gameState]);

  // Dynasty context for the Legacy tab — the sell for the NEXT life. Both
  // numbers were always computed and never shown at life end: the ribbon
  // catalogue is a 26-strong collection whose count rendered only inside a
  // modal behind IdentityCard, and the best-previous-life comparison existed
  // solely in LegacyTimeline. This is the one moment the player is deciding
  // whether a next life is worth starting (2026-08-25 retention audit).
  const dynastyContext = useMemo(() => {
    try {
      const { RIBBONS } = require('@/lib/legacy/ribbonSystem');
      const { netWorth } = require('@/lib/progress/achievements');
      const discovered = (gameState.ribbonCollection?.discoveredIds ?? []).length;
      const lives = gameState.previousLives ?? [];
      const bestLife = lives.reduce<{ netWorth: number; generation: number } | null>(
        (best, life) => {
          const value = typeof life?.netWorth === 'number' ? life.netWorth : 0;
          return !best || value > best.netWorth
            ? { netWorth: value, generation: life?.generation ?? 1 }
            : best;
        },
        null,
      );
      return {
        ribbonsDiscovered: discovered,
        ribbonsTotal: RIBBONS.length as number,
        bestLife,
        thisLifeNetWorth: Math.round(netWorth(gameState)),
      };
    } catch {
      return null;
    }
  }, [gameState]);

  const handleContinueLegacy = useCallback(async () => {
    if (!selectedHeirId) {
      Alert.alert('No Heir Selected', 'Please select a child to continue your legacy.');
      return;
    }

    try {
      startNewLifeFromLegacy(selectedHeirId);

      if (selectedMindset) {
        setGameState(prev => ({
          ...prev,
          mindset: {
            activeTraitId: selectedMindset,
            traits: [selectedMindset],
          },
        }));
      }

      setGameState(prev => ({
        ...prev,
        showDeathPopup: false,
        deathReason: undefined,
      }));
      setSelectedHeirId(null);

      // Same reason as the rewind path: without the yield this persists the
      // state as it was BEFORE the heir transition - showDeathPopup still true,
      // so the next load reopens the death screen on an already-continued
      // legacy. 2026-07-28 audit save-1.
      await new Promise<void>((resolve) => setTimeout(resolve, 0));
      await saveGame(true);
    } catch (error) {
      logger.error('Failed to start new life from legacy:', error);
      Alert.alert('Error', 'Failed to continue legacy. Please try again.');
      setGameState(prev => ({
        ...prev,
        showDeathPopup: true,
      }));
    }
  }, [selectedHeirId, selectedMindset, startNewLifeFromLegacy, setGameState, saveGame]);

  const handleRevive = useCallback(() => {
    const reviveCost = REVIVE_GEM_COST;
    if (safeStats(gameState).gems >= reviveCost) {
      reviveCharacter();
    }
  }, [gameState, reviveCharacter]);

  // MON-5: spend the banked Revival Pack. Offered ABOVE the gem revive because
  // it is already paid for - making someone spend 15,000 gems while holding an
  // unused pack would be the second way this product could take money for
  // nothing.
  const handleReviveWithPack = useCallback(() => {
    reviveWithPack();
  }, [reviveWithPack]);

  // ── Store bridge (stacked-modal safety) ────────────────────────────────────
  // The gem store is an app-root RN Modal. Opening it while THIS death Modal is
  // still presented is the exact iOS stacked-modal hazard this PR fixed for the
  // rewarded ad + LuxuryApp sheet. So we SUPPRESS the death Modal first
  // (visible → false via a local flag), let its native teardown settle, then
  // open the store from the Modal's onDismiss - with a tracked-timer fallback
  // for Android (no onDismiss). When the store closes, `isStoreOpen` flips false
  // and the death Modal re-presents automatically; its state lives in game state
  // (showDeathPopup), so re-showing is clean and loses nothing.
  const [storeBridging, setStoreBridging] = useState(false);
  const pendingStoreRef = useRef(false);
  const storeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Which store tab the pending bridge should land on. A ref rather than state
  // because `flushPendingStore` is also the Modal's `onDismiss` handler, which
  // must stay callable with no arguments.
  const pendingStoreTabRef = useRef<GemStoreTab>('gems');

  const flushPendingStore = useCallback(() => {
    if (!pendingStoreRef.current) return;
    pendingStoreRef.current = false;
    if (storeTimerRef.current) {
      clearTimeout(storeTimerRef.current);
      storeTimerRef.current = null;
    }
    openStore(pendingStoreTabRef.current);
  }, [openStore]);

  // Quiet bridge for the out-of-gems dead-ends: flip suppression + arm the
  // fallback so the death Modal dismisses, THEN the store opens. Never
  // auto-invoked - only fired by an explicit tap.
  const bridgeToStore = useCallback(
    (tab: GemStoreTab = 'gems') => {
      pendingStoreTabRef.current = tab;
      pendingStoreRef.current = true;
      setStoreBridging(true);
      if (storeTimerRef.current) clearTimeout(storeTimerRef.current);
      storeTimerRef.current = setTimeout(flushPendingStore, 600);
    },
    [flushPendingStore]
  );

  const handleGetMoreGems = useCallback(() => bridgeToStore('gems'), [bridgeToStore]);

  /**
   * Buy the Revival Pack with real money.
   *
   * Lands on the `perks` tab, where the pack lives. It deliberately does NOT
   * run the purchase inline: `GemShopModal` owns the whole flow - store
   * loading, localized pricing, receipt verification, entitlement grant,
   * restore - and a second copy of that on the death screen would be a second
   * set of rules for taking someone's money.
   *
   * Buying while dead banks the charge (`revivalPack: true`), so the death
   * screen re-presents with "Use Revival Pack" waiting at the top. That is the
   * same one-shot machinery the pack has always used, reached from the one
   * place it was never reachable from.
   */
  const handleBuyRevivalPack = useCallback(() => bridgeToStore('perks'), [bridgeToStore]);

  // Re-present the death Modal once the store closes. The bridge flag is cleared
  // only when the store is DOWN, so `visible` never flickers true mid-bridge.
  useEffect(() => {
    if (!isStoreOpen) setStoreBridging(false);
  }, [isStoreOpen]);

  // Cancel any pending fallback on unmount.
  useEffect(
    () => () => {
      if (storeTimerRef.current) clearTimeout(storeTimerRef.current);
      pendingStoreRef.current = false;
    },
    [],
  );

  const handleRewind = useCallback((checkpointId: string) => {
    try {
      const { rewindToCheckpoint, getRewindCost } = require('@/lib/timeMachine/checkpointSystem');
      const cost = getRewindCost(
        gameState.timeMachineUsesThisLife ?? 0,
        !!gameState.goldUpgrades?.time_machine,
        !!gameState.goldUpgrades?.chronomaster,
      );
      const gems = gameState.stats?.gems ?? 0;
      if (gems < cost) {
        Alert.alert(
          'Not Enough Gems',
          `You need ${cost.toLocaleString()} gems to rewind.`,
          [
            { text: 'Not now', style: 'cancel' },
            // Same pending+dismiss bridge as the revive path - the native Alert
            // dismisses on button press, then the death Modal suppresses and the
            // store opens once teardown settles.
            { text: 'Get Gems', onPress: () => bridgeToStore() },
          ]
        );
        return;
      }
      Alert.alert(
        'Rewind Time',
        `Spend ${cost.toLocaleString()} gems to rewind? You'll lose all progress after this checkpoint.`,
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Rewind',
            onPress: async () => {
              const restored = rewindToCheckpoint(gameState, checkpointId);
              if (restored) {
                setGameState(() => restored);
                // saveGame reads gameStateRef, which is only synced by a
                // post-commit effect - calling it in this same synchronous
                // segment persists the PRE-rewind (dead) state, and the gems
                // were already spent. Yield one macrotask so React commits and
                // the ref catches up first (the 2026-07-14 stale-save-after-
                // commit lesson; 2026-07-28 audit save-1).
                await new Promise<void>((resolve) => setTimeout(resolve, 0));
                await saveGame(true);
              } else {
                Alert.alert('Error', 'Failed to rewind. Checkpoint may be corrupted.');
              }
            },
          },
        ]
      );
    } catch (err) {
      logger.error('[TIME_MACHINE] Rewind failed:', err);
    }
  }, [gameState, setGameState, saveGame, bridgeToStore]);

  const handleStartNewGame = useCallback(async () => {
    try {
      setGameState(prev => ({
        ...prev,
        showDeathPopup: false,
        deathReason: undefined,
      }));

      // Remember the life before erasing it (2026-08-24, §52). Death WITHOUT
      // an heir was the one ending that left no record anywhere - the heir and
      // prestige paths append to previousLives, this path deleted the slot.
      // Out-of-save archive (utils/lifeArchive.ts): memory only, no mechanics,
      // never blocks the new life on failure.
      try {
        const [{ buildLifeRecord }, { appendToLifeArchive }] = await Promise.all([
          import('@/lib/legacy/lifeRecord'),
          import('@/utils/lifeArchive'),
        ]);
        await appendToLifeArchive(buildLifeRecord(gameState));
      } catch {
        // archive is best-effort
      }

      if (currentSlot) {
        // Snapshot the life we are about to erase FIRST. This path deleted the
        // slot outright, so a player who tapped "Start New Game" by mistake -
        // or who did not realise it wipes the slot - had no way back.
        // Rotation-exempt, so it is not evicted by the next few autosaves.
        const { snapshotOutgoingSave } = await import('@/utils/saveBackup');
        await snapshotOutgoingSave(currentSlot, 'before_overwrite');

        // CRASH FIX (A-1): Delete all double-buffer keys for this slot
        const { deleteSaveSlot } = await import('@/utils/saveValidation');
        await deleteSaveSlot(currentSlot);
        // Clear the cached slot summary too so SaveSlots can't show the dead
        // character as a playable slot. AWAITED before the navigation below -
        // the next screen reads this cache, so the invalidation must land
        // first. Errors swallowed (must not block starting the new life).
        await import('@/utils/saveSlotMeta').then((m) => m.deleteSaveSlotMeta(currentSlot)).catch(() => {});
        await AsyncStorage.removeItem('lastSlot');
        // The slot we just emptied is exactly where this life's successor
        // belongs - the player stays in the slot they were playing. Set it
        // explicitly; the onboarding write refuses an unset slot rather than
        // guessing one.
        // R3-S1: stop the app-wide autosave writing this dead character back
        // into the slot we just emptied. Without it the next tick (or simply
        // backgrounding the app mid-scenario-pick) restores the life and
        // `lastSlot`, and `resolveNewLifeSlot` then refuses the slot because it
        // "holds" the character the player just buried.
        suspendLifeAutosave('death -> new life in onboarding');
        setOnboardingState((prev) => ({ ...prev, slot: currentSlot }));
        router.replace('/(onboarding)/Scenarios');
        return;
      }

      // No current slot (shouldn't happen, but a death with no slot marker is
      // survivable): send them to the picker instead of into a write that would
      // have to guess.
      setOnboardingState((prev) => ({ ...prev, slot: NEW_LIFE_SLOT_UNSET }));
      suspendLifeAutosave('death -> save slots');
      router.replace('/(onboarding)/SaveSlots');
    } catch (error) {
      if (__DEV__) {
        logger.error('Failed to start new game:', error);
      }
      setGameState(prev => ({
        ...prev,
        showDeathPopup: true,
      }));
    }
  }, [setGameState, currentSlot, router, setOnboardingState, gameState]);

  const handleShareObituary = useCallback(async () => {
    try {
      const { generateObituary } = require('@/lib/legacy/obituaryGenerator');
      const obituary = generateObituary(gameState);
      await Share.share({
        message: obituary.shareText,
        title: obituary.headline,
      });
    } catch (err) {
      logger.error('Failed to share obituary:', err);
    }
  }, [gameState]);

  // ── One scroll surface ─────────────────────────────────────────────────────
  // The whole card scrolls: tombstone, verdict, identity card, segmented
  // control, the active page AND its actions all live inside ONE ScrollView.
  //
  // The control is deliberately NOT a sticky header. The card is a gradient and
  // the segmented control is translucent glass, so pinning it would need an
  // opaque band that seams against the gradient sliding underneath. Instead we
  // remember where the control sits and, on a tab switch, jump to it ONLY if it
  // has already scrolled off the top: a player reading the bottom of Summary
  // lands on Legacy with the control at the top, and a player still up at the
  // hero is not yanked anywhere.
  const scrollRef = useRef<ScrollView | null>(null);
  const tabBarY = useRef(0);
  const scrollY = useRef(0);

  const handleTabBarLayout = useCallback((e: LayoutChangeEvent) => {
    tabBarY.current = e.nativeEvent.layout.y;
  }, []);

  // Offset lives in a ref, not state: this fires on every frame of a drag and
  // must not re-render the most crash-sensitive screen in the game.
  const handleScroll = useCallback((e: NativeSyntheticEvent<NativeScrollEvent>) => {
    scrollY.current = e.nativeEvent.contentOffset.y;
  }, []);

  const selectTab = useCallback((tab: 'summary' | 'legacy') => {
    setActiveTab(tab);
    if (scrollY.current > tabBarY.current) {
      scrollRef.current?.scrollTo({ y: tabBarY.current, animated: false });
    }
  }, []);

  // Memoized handlers for the tab bar + secondary actions (passed to children).
  const handleSelectSummaryTab = useCallback(() => selectTab('summary'), [selectTab]);
  const handleSelectLegacyTab = useCallback(() => selectTab('legacy'), [selectTab]);
  const handleShowLifeStory = useCallback(() => setShowLifeStory(true), []);
  const handleHideLifeStory = useCallback(() => setShowLifeStory(false), []);

  if (!gameState.showDeathPopup) return null;

  const age = Math.floor(date.age);
  const weeksLived = gameState.weeksLived || 0;
  const yearsLived = Math.floor(weeksLived / WEEKS_PER_YEAR);

  // Enhanced death messages
  const deathTitleMessages = {
    health: ['You Died', 'Your body could no longer carry on'],
    happiness: ['You Died', 'The weight of life became too much'],
    age: ['A Long Life', `${age} years well lived`],
    default: ['You Died', 'Your journey has come to an end'],
  };

  const deathTitle = deathReason === 'health'
    ? deathTitleMessages.health[0]
    : deathReason === 'happiness'
    ? deathTitleMessages.happiness[0]
    : deathReason === 'age'
    ? deathTitleMessages.age[0]
    : deathTitleMessages.default[0];

  const deathSubtitle = deathReason === 'health'
    ? deathTitleMessages.health[1]
    : deathReason === 'happiness'
    ? deathTitleMessages.happiness[1]
    : deathReason === 'age'
    ? deathTitleMessages.age[1]
    : deathTitleMessages.default[1];

  const deathMessage =
    deathReason === 'health'
      ? 'Your body finally gave out.'
      : deathReason === 'happiness'
      ? 'You lost the will to go on.'
      : deathReason === 'age'
      ? 'You passed away peacefully of natural causes.'
      : 'Your journey has ended.';

  // Calculate life summary statistics. Reads the LIVE claimed store - the
  // deprecated `achievements[].completed` flag is never set in play, so the
  // death screen told every player they had achieved nothing. GP-3.
  const claimedIds = gameState.claimedProgressAchievements || [];
  const completedAchievements = (gameState.achievements || []).filter((a) => claimedIds.includes(a.id));
  const totalAchievements = claimedIds.length;
  const topAchievements = completedAchievements.slice(0, 5);

  const completedEducation = (gameState.educations || []).filter(e => e.completed);
  const highestEducation = completedEducation.length > 0
    ? completedEducation[completedEducation.length - 1]
    : null;

  const currentJob = gameState.currentJob
    ? gameState.careers?.find(job => job.id === gameState.currentJob) || gameState.streetJobs?.find(j => j.id === gameState.currentJob)
    : null;

  const ownedProperties = (gameState.realEstate || []).filter(p => p.owned);
  const ownedCompanies = gameState.companies || [];

  const spouse = gameState.family?.spouse;
  const children = gameState.family?.children || [];

  const totalNetWorth = inheritanceSummary.totalNetWorth;

  // Additional life statistics
  const lifetimeStats = gameState.prestige?.lifetimeStats;
  const totalRelationships = (gameState.relationships || []).length;
  const maxNetWorth = lifetimeStats?.maxNetWorth || totalNetWorth;

  // Calculate career level if available
  const careerLevel = currentJob && 'level' in currentJob && typeof currentJob.level === 'number'
    ? currentJob.level + 1
    : null;

  const canAffordRevive = safeStats(gameState).gems >= REVIVE_GEM_COST;
  const hasBankedRevive = gameState.revivalPack === true;

  // The config USD price. The live localized price lives in the store modal -
  // this is the death screen's label, and a missing config price hides the row
  // rather than rendering a purchase button with no price on it.
  const revivalPackPrice = getProductConfig(IAP_PRODUCTS.REVIVAL_PACK)?.price;
  const canAffordRewind = (gameState.stats?.gems ?? 0) >= rewindCost;
  const canContinueLegacy = heirs.length > 0 && !!selectedHeirId;

  // The name the player gave this character, not the `userProfile.name` handle
  // (which defaults to "player"). Shared resolver - see utils/characterName.ts.
  const displayName = characterName(gameState) || 'Unknown Soul';

  // A real score over the whole life, not the final tick's happiness. It is the
  // number under the arc, and a number this final is one the player will check.
  const quality = lifeQuality(gameState);

  // The hero band scales with the device but is capped, so a tablet does not
  // give a third of the screen to a gravestone.
  const heroHeight = Math.min(scale(190), windowHeight * 0.22);

  // Shared secondary action row (Read Story + Share) - appears in both footers.
  const secondaryActions = (
    <View style={styles.secondaryRow}>
      <TouchableOpacity
        style={styles.secondaryButton}
        onPress={handleShowLifeStory}
        activeOpacity={0.8}
      >
        <BookOpen size={16} color={c.text} />
        <Text style={styles.secondaryButtonText}>Read Story</Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={styles.secondaryButton}
        onPress={handleShareObituary}
        activeOpacity={0.8}
      >
        <Share2 size={16} color={c.text} />
        <Text style={styles.secondaryButtonText}>Share</Text>
      </TouchableOpacity>
    </View>
  );

  // Universal "fresh start" button - present on both pages so the player can
  // always move forward regardless of which tab they're on.
  const startNewLifeButton = (
    <TouchableOpacity
      style={[styles.actionButton, styles.newLifeButton]}
      onPress={handleStartNewGame}
      activeOpacity={0.85}
      accessibilityRole="button"
      accessibilityLabel="Start a new life"
    >
      <LinearGradient colors={['#7C4DFF', '#5B2BE0']} style={styles.buttonGradient}>
        <Sparkles size={20} color="#FFF" />
        <View>
          <Text style={styles.buttonText}>Start New Life</Text>
          <Text style={styles.buttonSubtext}>A new beginning awaits.</Text>
        </View>
      </LinearGradient>
    </TouchableOpacity>
  );

  return (
    <>
    <Modal
      visible={!isStoreOpen && !storeBridging}
      transparent
      animationType="fade"
      statusBarTranslucent={true}
      presentationStyle="overFullScreen"
      hardwareAccelerated={true}
      onDismiss={flushPendingStore}
    >
      <View style={styles.container}>
        <View style={styles.overlay} />

        <Animated.View
          style={[
            styles.content,
            {
              opacity: fadeAnim,
              transform: [{ scale: scaleAnim }],
            },
          ]}
        >
          <LinearGradient
            colors={[c.background, c.surface, c.surfaceElevated]}
            style={styles.card}
          >
            {/* ── The one scroll surface ────────────────────────────────────
                Everything from the tombstone down is inside this ScrollView:
                hero, identity card, tab bar, the active page and its actions.

                The card used to pin the hero AND the action footer outside the
                scroller, leaving it only the space left over. That space is
                what broke: `flex: 1` on the scroller is flexBasis 0 + grow, and
                RN defaults flexShrink to 0, so a footer taller than the
                left-over space takes ALL of it - the scroll area resolves to
                zero height and the footer's tail (the purple "Start New Life"
                button) is clipped away by the card's `overflow: 'hidden'`, with
                nothing scrollable to reach it. The Summary footer - revive,
                revival pack, gems, one row per checkpoint, new life, secondary
                actions - is exactly that tall on a small phone. */}
            <ScrollView
              ref={scrollRef}
              style={styles.scrollView}
              contentContainerStyle={styles.scrollContent}
              showsVerticalScrollIndicator={true}
              onScroll={handleScroll}
              scrollEventThrottle={16}
              bounces={true}
            >
              {/* ── Hero ──────────────────────────────────────────────────────
                  The illustration, the verdict, and the cause. Centred, because
                  this is the one screen in the game that is not a dashboard: it
                  is an ending, and an ending reads down the middle.

                  `DeathHero` draws the gravestone today and accepts the painted
                  asset via `source` the moment one exists - see
                  `docs/DEATH_SCREEN_ASSETS.md`. */}
              <DeathHero
                height={heroHeight}
                mood={quality.mood}
                source={require('@/assets/images/death/gravestone.webp')}
              />

              <View style={styles.hero}>
                <Text style={styles.heroTitle} numberOfLines={1} adjustsFontSizeToFit>
                  {deathTitle}
                </Text>
                <Text style={styles.heroSubtitle}>{deathSubtitle}</Text>
                <Text style={styles.heroCause}>{deathMessage}</Text>
              </View>

              {/* Identity card - the portrait belongs here. A player who spent
                  sixty years as this character should see their face, not a
                  generic skull, and certainly not be eulogised as "Player":
                  `userProfile.name` is the HANDLE and defaults to that string.
                  `characterName` is the one resolver, shared with mail. */}
              <View style={styles.identityCard}>
                <View style={styles.identityAvatarRing}>
                  <CharacterAvatar
                    source={safeUserProfile(gameState)}
                    seed={displayName}
                    sex={safeUserProfile(gameState).sex || 'male'}
                    age={age}
                    size={scale(54)}
                  />
                </View>
                <View style={styles.identityText}>
                  <Text style={styles.identityName} numberOfLines={1}>
                    {displayName}
                  </Text>
                  <Text style={styles.identityDetails} numberOfLines={1}>
                    <Text style={styles.identityAge}>Age {age}</Text>
                    {'  •  '}
                    {yearsLived > 0 ? `${yearsLived} yrs` : `${weeksLived} wks`} lived
                  </Text>
                </View>
              </View>

              {/* TOP MENU BAR - segmented control switching between the two pages.
                  Scrolls with the rest of the card; `onLayout` records where it
                  sits so a tab switch can bring it back to the top. */}
              <View style={styles.topBar} onLayout={handleTabBarLayout}>
                <View style={styles.segmented}>
                  <TouchableOpacity
                    style={[styles.segment, activeTab === 'summary' && styles.segmentActive]}
                    onPress={handleSelectSummaryTab}
                    activeOpacity={0.8}
                  >
                    <Sparkles size={15} color={activeTab === 'summary' ? '#FFF' : c.textSecondary} />
                    <Text style={[styles.segmentText, activeTab === 'summary' && styles.segmentTextActive]}>
                      Summary
                    </Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[styles.segment, activeTab === 'legacy' && styles.segmentActive]}
                    onPress={handleSelectLegacyTab}
                    activeOpacity={0.8}
                  >
                    <Crown size={15} color={activeTab === 'legacy' ? '#FFF' : c.textSecondary} />
                    <Text style={[styles.segmentText, activeTab === 'legacy' && styles.segmentTextActive]}>
                      Legacy
                    </Text>
                  </TouchableOpacity>
                </View>
              </View>

              {/* ───────────────────────────── SUMMARY PAGE ───────────────────────────── */}
              {activeTab === 'summary' && (
                <>
                  <View style={styles.pageContent}>
                    {/* ── Life Summary verdict ────────────────────────────────
                        The earned ribbon and the score, side by side, because
                        they are two readings of the same life and separating
                        them is how a LEGENDARY ribbon ends up sitting above a
                        30% gauge with nothing to reconcile them. `lifeQuality`
                        scores the same signals `classifyLife` judges. */}
                    <View style={styles.section}>
                      <View style={styles.sectionHeader}>
                        <View style={styles.sectionIcon}>
                          <Sparkles size={16} color={settings.darkMode ? '#A78BFA' : '#7C3AED'} />
                        </View>
                        <Text style={styles.sectionTitle}>Life Summary</Text>
                      </View>

                      <View style={styles.verdictCard}>
                        <View style={styles.verdictText}>
                          <Text
                            style={[
                              styles.verdictName,
                              lifeRibbon ? { color: lifeRibbon.color } : null,
                            ]}
                          >
                            {lifeRibbon
                              ? lifeRibbon.hidden &&
                                !gameState.ribbonCollection?.discoveredIds?.includes(lifeRibbon.id)
                                ? 'NEW RIBBON DISCOVERED!'
                                : lifeRibbon.name.toUpperCase()
                              : quality.verdict.toUpperCase()}
                          </Text>
                          <Text style={styles.verdictDesc}>
                            {lifeRibbon ? lifeRibbon.description : deathMessage}
                          </Text>
                        </View>

                        <LifeQualityGauge quality={quality} darkMode={settings.darkMode} />
                      </View>
                    </View>

                    {/* Life details */}
                    <View style={styles.section}>
                      <View style={styles.summaryCard}>
                        {/* Career */}
                        {currentJob && (
                          <View style={styles.summaryRow}>
                            <View style={[styles.summaryIconContainer, { backgroundColor: 'rgba(59, 130, 246, 0.1)' }]}>
                              <Briefcase size={18} color={accent.info} />
                            </View>
                            <View style={styles.summaryContent}>
                              <Text style={styles.summaryLabel}>Final Career</Text>
                              <Text style={styles.summaryValue}>
                                {('name' in currentJob ? currentJob.name : currentJob.levels?.[currentJob.level]?.name) || 'Unknown'}
                              </Text>
                            </View>
                          </View>
                        )}

                        {/* Education */}
                        {highestEducation && (
                          <View style={styles.summaryRow}>
                            <View style={[styles.summaryIconContainer, { backgroundColor: 'rgba(139, 92, 246, 0.1)' }]}>
                              <GraduationCap size={18} color={theme.palette.fitness} />
                            </View>
                            <View style={styles.summaryContent}>
                              <Text style={styles.summaryLabel}>Education</Text>
                              <Text style={styles.summaryValue}>
                                {highestEducation.name || 'None'}
                              </Text>
                            </View>
                          </View>
                        )}

                        {/* Family */}
                        <View style={styles.summaryRow}>
                          <View style={[styles.summaryIconContainer, { backgroundColor: 'rgba(236, 72, 153, 0.1)' }]}>
                            <Users size={18} color={theme.palette.reputation} />
                          </View>
                          <View style={styles.summaryContent}>
                            <Text style={styles.summaryLabel}>Family</Text>
                            <Text style={styles.summaryValue}>
                              {spouse ? `Married to ${spouse.name}` : 'Single'} • {children.length} {children.length === 1 ? 'child' : 'children'}
                            </Text>
                          </View>
                        </View>

                        {/* Properties */}
                        {ownedProperties.length > 0 && (
                          <View style={styles.summaryRow}>
                            <View style={[styles.summaryIconContainer, { backgroundColor: 'rgba(16, 185, 129, 0.1)' }]}>
                              <Home size={18} color={accent.success} />
                            </View>
                            <View style={styles.summaryContent}>
                              <Text style={styles.summaryLabel}>Properties Owned</Text>
                              <Text style={styles.summaryValue}>
                                {ownedProperties.length} {ownedProperties.length === 1 ? 'property' : 'properties'}
                              </Text>
                            </View>
                          </View>
                        )}

                        {/* Companies */}
                        {ownedCompanies.length > 0 && (
                          <View style={styles.summaryRow}>
                            <View style={[styles.summaryIconContainer, { backgroundColor: 'rgba(245, 158, 11, 0.1)' }]}>
                              <Building2 size={18} color={accent.warning} />
                            </View>
                            <View style={styles.summaryContent}>
                              <Text style={styles.summaryLabel}>Companies Owned</Text>
                              <Text style={styles.summaryValue}>
                                {ownedCompanies.length} {ownedCompanies.length === 1 ? 'company' : 'companies'}
                              </Text>
                            </View>
                          </View>
                        )}

                        {/* Achievements */}
                        {totalAchievements > 0 && (
                          <View style={styles.summaryRow}>
                            <View style={[styles.summaryIconContainer, { backgroundColor: 'rgba(168, 85, 247, 0.1)' }]}>
                              <Trophy size={18} color={accent.purple} />
                            </View>
                            <View style={styles.summaryContent}>
                              <Text style={styles.summaryLabel}>Achievements</Text>
                              <Text style={styles.summaryValue}>
                                {totalAchievements} {totalAchievements === 1 ? 'achievement' : 'achievements'} unlocked
                              </Text>
                            </View>
                          </View>
                        )}

                        {/* Top Achievements */}
                        {topAchievements.length > 0 && (
                          <View style={styles.achievementsList}>
                            {topAchievements.map((ach, idx) => (
                              <View key={ach.id || idx} style={styles.achievementBadge}>
                                <Trophy size={12} color={accent.warning} />
                                <Text style={styles.achievementText}>{ach.name}</Text>
                              </View>
                            ))}
                          </View>
                        )}
                      </View>
                    </View>

                    {/* Stats Cards */}
                    <View style={styles.statsContainer}>
                      <View style={styles.statCard}>
                        <View style={[styles.statIconContainer, { backgroundColor: 'rgba(16, 185, 129, 0.1)' }]}>
                          <DollarSign size={20} color={accent.success} />
                        </View>
                        <View style={styles.statContent}>
                          <Text style={styles.statLabel}>Net Worth</Text>
                          <Text style={styles.statValue}>
                            {formatMoney(inheritanceSummary.totalNetWorth)}
                          </Text>
                        </View>
                      </View>

                      <View style={styles.statCard}>
                        <View style={[styles.statIconContainer, { backgroundColor: 'rgba(139, 92, 246, 0.1)' }]}>
                          <Crown size={20} color={theme.palette.fitness} />
                        </View>
                        <View style={styles.statContent}>
                          <Text style={styles.statLabel}>Generation</Text>
                          <Text style={styles.statValue}>
                            {gameState.generationNumber || 1}
                          </Text>
                        </View>
                      </View>
                    </View>

                    {/* Life Statistics */}
                    <View style={styles.section}>
                      <View style={styles.sectionHeader}>
                        <Calendar size={20} color={settings.darkMode ? theme.palette.fitness : theme.palette.primary} />
                        <Text style={styles.sectionTitle}>Life Statistics</Text>
                      </View>

                      <View style={styles.statsGrid}>
                        <View style={styles.statBox}>
                          <Text style={styles.statBoxLabel}>Weeks Lived</Text>
                          <Text style={styles.statBoxValue}>{weeksLived}</Text>
                        </View>

                        <View style={styles.statBox}>
                          <Text style={styles.statBoxLabel}>Relationships</Text>
                          <Text style={styles.statBoxValue}>{totalRelationships}</Text>
                        </View>

                        {careerLevel ? (
                          <View style={styles.statBox}>
                            <Text style={styles.statBoxLabel}>Career Level</Text>
                            <Text style={styles.statBoxValue}>{careerLevel}</Text>
                          </View>
                        ) : null}

                        <View style={styles.statBox}>
                          <Text style={styles.statBoxLabel}>Peak Net Worth</Text>
                          <Text style={styles.statBoxValue}>{formatMoney(maxNetWorth)}</Text>
                        </View>
                      </View>
                    </View>

                    {/* ENGAGEMENT: Prestige Points Preview - reframes death as investment */}
                    {(() => {
                      /**
                       * F1: quote the REAL award, not a lookalike.
                       *
                       * This preview used its own formula -
                       * `(netWorth/10000) + (weeksLived/5) + (achievements*20) +
                       * (prestigeLevel*100)` - which shares not one term with
                       * `calculatePrestigePoints`, the function that actually
                       * awards the points. It invented a `weeksLived/5` term and a
                       * flat `prestigeLevel*100`, paid DOUBLE per achievement and
                       * paid for every achievement rather than only the newly
                       * credited ones, and omitted the generation, age, career,
                       * property, company and child bonuses, the 1.1^level
                       * multiplier and the +25% child-path bonus entirely.
                       *
                       * This number is shown at the exact moment the player
                       * decides whether to prestige, and `PrestigeModal` already
                       * calls the real function. The two screens quoted different
                       * figures for the same decision.
                       */
                      const earnedPoints = calculatePrestigePoints(
                        gameState,
                        totalNetWorth,
                        gameState.prestige || defaultPrestigeData,
                        'reset',
                      ).total;
                      const canBuySmallInheritance = earnedPoints >= 500;
                      const canBuyStatBoost = earnedPoints >= 1000;
                      const canBuyModestInheritance = earnedPoints >= 2000;
                      return earnedPoints > 0 ? (
                        <View style={styles.section}>
                          <View style={styles.sectionHeader}>
                            <Crown size={20} color={accent.warning} />
                            <Text style={styles.sectionTitle}>Prestige Points Earned</Text>
                          </View>
                          <View style={styles.prestigePreviewCard}>
                            <Text style={styles.prestigePointsValue}>
                              {earnedPoints.toLocaleString()} pts
                            </Text>
                            <Text style={styles.prestigeHint}>
                              {/* Honest about the mechanics: neither button on
                                  THIS screen awards these points. Prestige is a
                                  while-alive action (executePrestige, reached
                                  from the home screen); the heir path below
                                  carries your existing balance unchanged and
                                  the fresh start wipes it. The old caption —
                                  "use prestige points to start your next life
                                  stronger" — promised a payout no death-screen
                                  path delivers. */}
                              What prestiging this life would have banked — prestige happens while
                              alive, from the home screen. An heir keeps points you already have.
                            </Text>
                            <View style={styles.prestigeBuyList}>
                              {canBuySmallInheritance && (
                                <View style={styles.prestigeBuyItem}>
                                  <DollarSign size={14} color={accent.success} />
                                  <Text style={styles.prestigeBuyText}>
                                    +$10,000 starting money (500 pts)
                                  </Text>
                                </View>
                              )}
                              {canBuyStatBoost && (
                                <View style={styles.prestigeBuyItem}>
                                  <TrendingUp size={14} color={accent.info} />
                                  <Text style={styles.prestigeBuyText}>
                                    +5 to all starting stats (1,000 pts)
                                  </Text>
                                </View>
                              )}
                              {canBuyModestInheritance && (
                                <View style={styles.prestigeBuyItem}>
                                  <Sparkles size={14} color={accent.warning} />
                                  <Text style={styles.prestigeBuyText}>
                                    +$50,000 starting money (2,000 pts)
                                  </Text>
                                </View>
                              )}
                            </View>
                          </View>
                        </View>
                      ) : null;
                    })()}
                  </View>

                  {/* ── Summary actions ─────────────────────────────────────────
                      The tail of the scroll, not a pinned footer - see the
                      ScrollView comment above for why pinning it was what made
                      this page unscrollable.

                      Three ways to keep this life, then one to leave it. Each is
                      a full-width row that states what it does and what it costs
                      on the same line, rather than a pill with the price crammed
                      into its label.

                      Every priced row stays PRESSABLE when it cannot be afforded,
                      and dims only its price. A `disabled` button swallows the
                      tap, and that tap is the only route into the "not enough
                      gems → store" bridge the handlers already implement - so
                      disabling it turned the shortest path to a purchase into a
                      dead end. The rewind row already worked this way; revive now
                      matches it. */}
                  <View style={styles.actions}>
                    {hasBankedRevive && (
                      <TouchableOpacity
                        style={[styles.optionRow, styles.optionRevive]}
                        onPress={handleReviveWithPack}
                        activeOpacity={0.85}
                        accessibilityRole="button"
                        accessibilityLabel="Use your Revival Pack to come back to life"
                      >
                        <View style={[styles.optionIcon, styles.optionIconRevive]}>
                          <Heart size={20} color="#F472B6" fill="#F472B6" />
                        </View>
                        <View style={styles.optionText}>
                          <Text style={styles.optionTitle}>Use Revival Pack</Text>
                          <Text style={styles.optionSubtitle}>You already paid for this one.</Text>
                        </View>
                        <View style={[styles.optionPill, styles.optionPillRevive]}>
                          <Text style={[styles.optionPillText, styles.optionPillTextRevive]}>Free</Text>
                        </View>
                      </TouchableOpacity>
                    )}

                    <TouchableOpacity
                      style={[styles.optionRow, styles.optionRevive]}
                      onPress={handleRevive}
                      activeOpacity={0.85}
                      accessibilityRole="button"
                      accessibilityLabel={`Revive for ${REVIVE_GEM_COST.toLocaleString()} gems`}
                      accessibilityHint={!canAffordRevive ? 'Not enough gems' : undefined}
                    >
                      <View style={[styles.optionIcon, styles.optionIconRevive]}>
                        <Heart size={20} color="#F472B6" fill="#F472B6" />
                      </View>
                      <View style={styles.optionText}>
                        <Text style={styles.optionTitle}>Revive</Text>
                        <Text style={styles.optionSubtitle}>Start over and try again.</Text>
                      </View>
                      <View
                        style={[
                          styles.optionPill,
                          styles.optionPillRevive,
                          !canAffordRevive && styles.optionPillShort,
                        ]}
                      >
                        <Gem size={13} color="#F472B6" />
                        <Text style={[styles.optionPillText, styles.optionPillTextRevive]}>
                          {REVIVE_GEM_COST.toLocaleString()}
                        </Text>
                      </View>
                    </TouchableOpacity>

                    {/* ── Revive with real money ──────────────────────────────
                        Shown only while the pack can still be bought. It is a
                        NON-CONSUMABLE, so it is purchasable exactly once per
                        Apple/Google account, ever - after that the row would be
                        a button that cannot do anything, which is worse than no
                        row. (Making it repeatable is a store-side product change,
                        not a code one.)

                        It says the price is better than the gem route because it
                        is: the pack is a few dollars and REVIVE_GEM_COST is
                        thousands of gems. A death screen that hid that while
                        showing the expensive option first would be taking
                        advantage of the moment. */}
                    {!hasBankedRevive && !settings.hasRevivalPack && revivalPackPrice ? (
                      <TouchableOpacity
                        style={[styles.optionRow, styles.optionRevive]}
                        onPress={handleBuyRevivalPack}
                        activeOpacity={0.85}
                        accessibilityRole="button"
                        accessibilityLabel={`Buy the Revival Pack for ${revivalPackPrice} and revive without gems`}
                      >
                        <View style={[styles.optionIcon, styles.optionIconRevive]}>
                          <Heart size={20} color="#F472B6" fill="#F472B6" />
                        </View>
                        <View style={styles.optionText}>
                          <Text style={styles.optionTitle}>Revival Pack</Text>
                          <Text style={styles.optionSubtitle}>
                            Revive without spending gems. One-time purchase.
                          </Text>
                        </View>
                        <View style={[styles.optionPill, styles.optionPillRevive]}>
                          <Text style={[styles.optionPillText, styles.optionPillTextRevive]}>
                            {revivalPackPrice}
                          </Text>
                        </View>
                      </TouchableOpacity>
                    ) : null}

                    {/* The store bridge. No urgency copy, and the store is still
                        never opened automatically - this is a row you can tap,
                        not a thing that happens to you. */}
                    <TouchableOpacity
                      style={styles.optionRow}
                      onPress={handleGetMoreGems}
                      activeOpacity={0.85}
                      accessibilityRole="button"
                      accessibilityLabel="Get more gems in the shop"
                    >
                      <View style={styles.optionIcon}>
                        <Gem size={20} color={c.textSecondary} />
                      </View>
                      <View style={styles.optionText}>
                        <Text style={styles.optionTitle}>Get more gems</Text>
                        <Text style={styles.optionSubtitle}>Stock up and come back stronger.</Text>
                      </View>
                      <ChevronRight size={18} color={c.textSecondary} />
                    </TouchableOpacity>

                    {/* Time Machine - rewind to a checkpoint, cheaper than revive. */}
                    {checkpoints.slice().reverse().map((cp: { id: string; label: string; age: number }) => (
                      <TouchableOpacity
                        key={cp.id}
                        style={[styles.optionRow, styles.optionRewind]}
                        onPress={() => handleRewind(cp.id)}
                        activeOpacity={0.85}
                        accessibilityRole="button"
                        accessibilityLabel={`Rewind time to ${cp.label}, age ${cp.age}, for ${rewindCost.toLocaleString()} gems`}
                        accessibilityHint={!canAffordRewind ? 'Not enough gems' : undefined}
                      >
                        <View style={[styles.optionIcon, styles.optionIconRewind]}>
                          <RotateCcw size={20} color={accent.warning} />
                        </View>
                        <View style={styles.optionText}>
                          <Text style={[styles.optionTitle, styles.optionTitleRewind]}>Rewind Time</Text>
                          <Text style={[styles.optionSubtitle, styles.optionSubtitleRewind]}>
                            Go back to {cp.label.toLowerCase()} (Age {cp.age}).
                          </Text>
                        </View>
                        <View
                          style={[
                            styles.optionPill,
                            styles.optionPillRewind,
                            !canAffordRewind && styles.optionPillShort,
                          ]}
                        >
                          <Gem size={13} color={accent.warning} />
                          <Text style={[styles.optionPillText, styles.optionPillTextRewind]}>
                            {rewindCost.toLocaleString()}
                          </Text>
                        </View>
                      </TouchableOpacity>
                    ))}

                    {startNewLifeButton}
                    {secondaryActions}
                  </View>
                </>
              )}

              {/* ───────────────────────────── LEGACY PAGE ───────────────────────────── */}
              {activeTab === 'legacy' && (
                <>
                  <View style={styles.pageContent}>
                    {/* Your Dynasty — what continuing is FOR. Ribbon collection
                        progress and the family record to beat, both already
                        computed elsewhere and never shown at life end. Hidden
                        entirely when there is nothing to say (first life, no
                        ribbons yet). */}
                    {dynastyContext &&
                      (dynastyContext.ribbonsDiscovered > 0 || dynastyContext.bestLife) && (
                        <View style={styles.section}>
                          <Text style={styles.sectionTitle}>Your Dynasty</Text>
                          <View style={styles.breakdownCard}>
                            {dynastyContext.ribbonsDiscovered > 0 && (
                              <View style={styles.breakdownRow}>
                                <Text style={styles.breakdownLabel}>Ribbons discovered</Text>
                                <Text style={styles.breakdownValue}>
                                  {dynastyContext.ribbonsDiscovered} / {dynastyContext.ribbonsTotal}
                                </Text>
                              </View>
                            )}
                            {dynastyContext.bestLife && (
                              <View style={styles.breakdownRow}>
                                <Text style={styles.breakdownLabel}>
                                  Family record (Gen {dynastyContext.bestLife.generation})
                                </Text>
                                <Text style={styles.breakdownValue}>
                                  {formatMoney(dynastyContext.bestLife.netWorth)}
                                </Text>
                              </View>
                            )}
                            {dynastyContext.bestLife && (
                              <View style={styles.breakdownRow}>
                                <Text style={styles.breakdownLabel}>This life</Text>
                                <Text
                                  style={[
                                    styles.breakdownValue,
                                    dynastyContext.thisLifeNetWorth >
                                      dynastyContext.bestLife.netWorth && {
                                      color: accent.success,
                                    },
                                  ]}
                                >
                                  {formatMoney(dynastyContext.thisLifeNetWorth)}
                                  {dynastyContext.thisLifeNetWorth >
                                  dynastyContext.bestLife.netWorth
                                    ? ' · new record'
                                    : ''}
                                </Text>
                              </View>
                            )}
                          </View>
                        </View>
                      )}

                    {/* Inheritance Breakdown */}
                    <View style={styles.section}>
                      <Text style={styles.sectionTitle}>Inheritance Breakdown</Text>

                      <View style={styles.breakdownCard}>
                        <View style={styles.breakdownRow}>
                          <Text style={styles.breakdownLabel}>Cash</Text>
                          <Text style={styles.breakdownValue}>
                            {formatMoney(inheritanceSummary.cash)}
                          </Text>
                        </View>

                        <View style={styles.breakdownRow}>
                          <Text style={styles.breakdownLabel}>Savings</Text>
                          <Text style={styles.breakdownValue}>
                            {formatMoney(inheritanceSummary.bankSavings)}
                          </Text>
                        </View>

                        {inheritanceSummary.realEstateIds.length > 0 && (
                          <View style={styles.breakdownRow}>
                            <Text style={styles.breakdownLabel}>Properties</Text>
                            <Text style={styles.breakdownValue}>
                              {inheritanceSummary.realEstateIds.length}
                            </Text>
                          </View>
                        )}

                        {inheritanceSummary.companyIds.length > 0 && (
                          <View style={styles.breakdownRow}>
                            <Text style={styles.breakdownLabel}>Companies</Text>
                            <Text style={styles.breakdownValue}>
                              {inheritanceSummary.companyIds.length}
                            </Text>
                          </View>
                        )}

                        {inheritanceSummary.debts > 0 && (
                          <View style={styles.breakdownRow}>
                            <Text style={[styles.breakdownLabel, { color: accent.danger }]}>Debts</Text>
                            <Text style={[styles.breakdownValue, { color: accent.danger }]}>
                              -{formatMoney(inheritanceSummary.debts)}
                            </Text>
                          </View>
                        )}
                      </View>
                    </View>

                    {/* Legacy Bonuses */}
                    <View style={styles.section}>
                      <Text style={styles.sectionTitle}>Legacy Bonuses</Text>

                      <View style={styles.bonusesCard}>
                        <View style={styles.bonusItem}>
                          <View style={[styles.bonusIconContainer, { backgroundColor: 'rgba(16, 185, 129, 0.1)' }]}>
                            <TrendingUp size={16} color={accent.success} />
                          </View>
                          <View style={styles.bonusContent}>
                            <Text style={styles.bonusLabel}>Income</Text>
                            <Text style={styles.bonusValue}>
                              +{((inheritanceSummary.legacyBonuses.incomeMultiplier - 1) * 100).toFixed(1)}%
                            </Text>
                          </View>
                        </View>

                        <View style={styles.bonusItem}>
                          <View style={[styles.bonusIconContainer, { backgroundColor: 'rgba(139, 92, 246, 0.1)' }]}>
                            <Brain size={16} color={theme.palette.fitness} />
                          </View>
                          <View style={styles.bonusContent}>
                            <Text style={styles.bonusLabel}>Learning</Text>
                            <Text style={styles.bonusValue}>
                              +{((inheritanceSummary.legacyBonuses.learningMultiplier - 1) * 100).toFixed(1)}%
                            </Text>
                          </View>
                        </View>

                        <View style={styles.bonusItem}>
                          <View style={[styles.bonusIconContainer, { backgroundColor: 'rgba(59, 130, 246, 0.1)' }]}>
                            <Award size={16} color={accent.info} />
                          </View>
                          <View style={styles.bonusContent}>
                            <Text style={styles.bonusLabel}>Reputation</Text>
                            <Text style={styles.bonusValue}>
                              +{inheritanceSummary.legacyBonuses.reputationBonus}
                            </Text>
                          </View>
                        </View>
                      </View>
                    </View>

                    {/* Children Selection */}
                    <View style={styles.section}>
                      <View style={styles.sectionHeader}>
                        <Users size={20} color={theme.palette.reputation} />
                        <Text style={styles.sectionTitle}>Continue Legacy</Text>
                      </View>

                      {heirs.length > 0 ? (
                        <>
                          <Text style={styles.childrenNote}>
                            Select a child to continue your legacy. Children under 18 will be simulated to age 18.
                          </Text>
                          <View style={styles.childrenList}>
                            {heirs.map(({ child, inheritance, educationLevel, careerPath, savings, age }) => {
                              const isSelected = selectedHeirId === child.id;
                              const childTotalNetWorth = inheritance + savings;

                              return (
                                <TouchableOpacity
                                  key={child.id}
                                  style={[
                                    styles.childCard,
                                    isSelected && styles.childCardSelected
                                  ]}
                                  onPress={() => setSelectedHeirId(child.id)}
                                  activeOpacity={0.8}
                                >
                                  <View style={styles.childCardHeader}>
                                    <View style={styles.childImage}>
                                      <CharacterAvatar
                                        seed={child.id}
                                        sex={child.gender}
                                        age={age}
                                        size={scale(56)}
                                        parents={childParentSources(gameState)}
                                      />
                                    </View>
                                    <View style={styles.childInfo}>
                                      <Text style={styles.childName}>{child.name}</Text>
                                      <Text style={styles.childDetails}>
                                        Age {age} • {child.gender === 'male' ? 'Son' : 'Daughter'}
                                      </Text>
                                      {educationLevel && educationLevel !== 'none' && (
                                        <View style={styles.badgeContainer}>
                                          <View style={[styles.badge, { backgroundColor: 'rgba(59, 130, 246, 0.1)' }]}>
                                            <Text style={[styles.badgeText, { color: accent.info }]}>
                                              {educationLevel === 'university' ? 'University' :
                                               educationLevel === 'specialized' ? 'Specialized' : 'High School'}
                                            </Text>
                                          </View>
                                        </View>
                                      )}
                                      {careerPath && (
                                        <View style={styles.badgeContainer}>
                                          <View style={[styles.badge, { backgroundColor: 'rgba(139, 92, 246, 0.1)' }]}>
                                            <Text style={[styles.badgeText, { color: theme.palette.fitness }]}>
                                              {careerPath === 'entrepreneur' ? 'Entrepreneur' :
                                               careerPath === 'professional' ? 'Professional' :
                                               careerPath === 'whiteCollar' ? 'White Collar' : 'Blue Collar'}
                                            </Text>
                                          </View>
                                        </View>
                                      )}
                                    </View>
                                    {isSelected && (
                                      <View style={styles.selectedBadge}>
                                        <Check size={20} color={accent.success} />
                                      </View>
                                    )}
                                  </View>

                                  <View style={styles.childNetWorthCard}>
                                    <View style={styles.childNetWorthRow}>
                                      <DollarSign size={16} color={accent.success} />
                                      <Text style={styles.childNetWorthLabel}>Net Worth</Text>
                                      <Text style={styles.childNetWorthValue}>
                                        {formatMoney(childTotalNetWorth)}
                                      </Text>
                                    </View>
                                    {inheritance > 0 && (
                                      <Text style={styles.childInheritanceText}>
                                        Inheritance: {formatMoney(inheritance)}
                                      </Text>
                                    )}
                                    {savings > 0 && (
                                      <Text style={styles.childInheritanceText}>
                                        Savings: {formatMoney(savings)}
                                      </Text>
                                    )}
                                  </View>
                                </TouchableOpacity>
                              );
                            })}
                          </View>
                        </>
                      ) : (
                        <View style={styles.noChildrenCard}>
                          <Users size={32} color={c.textSecondary} />
                          <Text style={styles.noChildrenText}>
                            You have no children to continue your legacy.
                          </Text>
                        </View>
                      )}
                    </View>
                  </View>

                  {/* Legacy actions - continue the bloodline, or start fresh */}
                  <View style={styles.actions}>
                    <TouchableOpacity
                      style={[styles.actionButton, !canContinueLegacy && styles.disabledButton]}
                      onPress={handleContinueLegacy}
                      disabled={!canContinueLegacy}
                      activeOpacity={0.8}
                    >
                      <LinearGradient
                        colors={!canContinueLegacy ? ['#94A3B8', '#6B7280'] : [theme.palette.primary, theme.palette.primaryDark]}
                        style={styles.buttonGradient}
                      >
                        <Crown size={18} color="#FFF" />
                        <Text style={styles.buttonText}>
                          {heirs.length === 0 ? 'No Children Available' : !selectedHeirId ? 'Select a Child First' : 'Continue Legacy'}
                        </Text>
                      </LinearGradient>
                    </TouchableOpacity>

                    {startNewLifeButton}
                    {secondaryActions}
                  </View>
                </>
              )}
            </ScrollView>
          </LinearGradient>
        </Animated.View>
      </View>
    </Modal>
    <LifeStoryModal visible={showLifeStory} onClose={handleHideLifeStory} />
    {/*
      F2: `PrestigeModal` is deliberately NOT rendered here, and must not be.
      It was - with `visible={showPrestigeModal}` against a state nothing ever
      set to true, so it was unreachable dead wiring rather than a feature.

      It should stay unreachable from this screen. `PrestigeModal` calls
      `executePrestige(path, childId)` on confirm, which rebuilds the save; the
      death screen already owns that transition through `startNewLifeFromLegacy`
      and the heir picker. Two competing paths to end the same life, both live
      at once, is how the heir flow loses a save. The points preview above now
      quotes the real `calculatePrestigePoints` figure, which is what a player
      opened this modal to see.
    */}
    </>
  );
}


export default React.memo(DeathPopup);
