import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Image,
  Platform,
  Alert,
} from 'react-native';
import LinearGradientFallback from '@/components/fallbacks/LinearGradientFallback';
import BlurViewFallback from '@/components/fallbacks/BlurViewFallback';
import { useRouter, useNavigation } from 'expo-router';
import { useHardwareBack } from '@/hooks/useHardwareBack';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { perks } from '@/src/features/onboarding/perksData';
import { useOnboarding } from '@/src/features/onboarding/OnboardingContext';
// Leaf contexts, not the @/contexts/GameContext barrel (avoids the production
// require-cycle from the barrel's eager `export * from './game'`).
import { useGameSelector } from '@/contexts/game/useGameSelector';
import { useGameActions } from '@/contexts/game/GameActionsContext';
import { initialGameState, STATE_VERSION } from '@/contexts/game/initialState';
import { type MindsetId, type MindsetTrait, MINDSET_TRAITS } from '@/lib/mindset/config';
import {
  Lock,
  Check,
  Gift,
  Brain,
  Star,
  Play,
} from 'lucide-react-native';

import OnboardingStepBar from '@/components/onboarding/OnboardingStepBar';
import OnboardingScreenShellV2 from '@/components/onboarding/OnboardingScreenShellV2';
import OnboardingGlassHeader from '@/components/onboarding/OnboardingGlassHeader';
import OnboardingFloatingButton from '@/components/onboarding/OnboardingFloatingButton';
import { useOnboardingFlowGuard } from '@/hooks/useOnboardingFlowGuard';

// Extracted modules
import { buildNewGameState } from '@/src/features/onboarding/gameStateBuilder';
import {
  sortPerksByUnlockStatus,
  isPerkLocked,
  isPerkPermanent,
  getPerkBenefits,
  getStatColor,
  type PerkDefinition,
} from '@/src/features/onboarding/perksFlow';
import {
  validateOnboardingInputs,
  initializeAndSaveGame,
} from '@/src/features/onboarding/gameInitializer';
import { resolveNewLifeSlot } from '@/src/features/onboarding/slotSafety';
import { snapshotOutgoingSave } from '@/utils/saveBackup';
import {
  logOnboardingStepView,
  logOnboardingValidationError,
} from '@/src/features/onboarding/onboardingAnalytics';
import {
  fontScale,
  responsiveBorderRadius,
  responsiveFontSize,
  responsivePadding,
  responsiveSpacing,
  scale,
} from '@/utils/scaling';
import { formatMoney } from '@/utils/moneyFormatting';
import { haptic } from '@/utils/haptics';
import { logger } from '@/utils/logger';
import { validateOnboardingState, applySafeDefaults } from '@/utils/onboardingValidation';
import { validateGameEntry } from '@/utils/gameEntryValidation';
import { forceSave } from '@/utils/saveQueue';
import { createBackupFromState } from '@/utils/saveBackup';
import { isSaveSigningConfigError } from '@/utils/saveValidation';
import { IAPService } from '@/services/IAPService';
const LinearGradient = LinearGradientFallback;
const BlurView = BlurViewFallback;

type TabType = 'perks' | 'mindset';

const RECOMMENDED_MINDSETS = ['optimist', 'frugal', 'riskAverse'];

const log = logger.scope('Perks');

// Lazy-loaded lucide icons for stat display (avoids importing all at top level)
const getStatIcon = (stat: string) => {
  switch (stat) {
    case 'happiness':
      return require('lucide-react-native').Heart;
    case 'health':
      return require('lucide-react-native').Shield;
    case 'energy':
      return require('lucide-react-native').Zap;
    case 'fitness':
      return require('lucide-react-native').TrendingUp;
    case 'reputation':
      return require('lucide-react-native').Users;
    case 'money':
    case 'Starting Money':
      return require('lucide-react-native').DollarSign;
    case 'Income Boost':
      return require('lucide-react-native').TrendingUp;
    default:
      return require('lucide-react-native').TrendingUp;
  }
};

interface PerkCardProps {
  perk: PerkDefinition;
  isSelected: boolean;
  isPermanent: boolean;
  isLocked: boolean;
  onToggle: (id: string) => void;
}

// R-perf: memoized so toggling one perk only re-renders that card, not the whole
// list. Previously every perk (each a BlurView + LinearGradient) re-rendered on
// every selection change. Props are stable per-perk except `isSelected`, so only
// the toggled card (and the previously-selected one) re-render.
const PerkCard = React.memo(function PerkCard({
  perk,
  isSelected,
  isPermanent,
  isLocked,
  onToggle,
}: PerkCardProps) {
  const benefits = getPerkBenefits(perk);
  const rarityColor =
    perk.rarity === 'Legendary'
      ? '#F59E0B'
      : perk.rarity === 'Epic'
        ? '#8B5CF6'
        : perk.rarity === 'Rare'
          ? '#3B82F6'
          : '#10B981';
  return (
    <TouchableOpacity
      style={styles.perkContainer}
      accessibilityRole="button"
      accessibilityLabel={`${perk.title}, ${perk.rarity} perk${
        isPermanent ? ', permanently unlocked' : isLocked ? ', locked' : ''
      }`}
      accessibilityState={{ disabled: isLocked || isPermanent, selected: isSelected }}
      onPress={() => !isLocked && !isPermanent && onToggle(perk.id)}
      disabled={isLocked || isPermanent}
    >
      <BlurView intensity={20} style={styles.perkBlur}>
        <LinearGradient
          colors={
            isPermanent
              ? ['rgba(245, 158, 11, 0.3)', 'rgba(217, 119, 6, 0.3)']
              : isSelected
                ? ['rgba(59, 130, 246,0.2)', 'rgba(37, 99, 235,0.2)']
                : isLocked
                  ? ['rgba(51, 65, 85, 0.6)', 'rgba(30, 41, 59, 0.6)']
                  : ['rgba(30, 41, 59, 0.9)', 'rgba(15, 23, 42, 0.8)']
          }
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={[
            styles.perkCard,
            isLocked && styles.lockedPerkCard,
            isPermanent && styles.permanentPerkCard,
          ]}
        >
          {/* Hero artwork — the perk's own painting, full-bleed with a scrim so
              the title and rarity read cleanly over any illustration. */}
          <View style={styles.heroWrap}>
            <Image source={perk.icon} style={styles.heroImage} resizeMode="cover" />
            <View style={styles.heroScrim} />
            {isPermanent ? (
              <View style={styles.permanentPill}>
                <Text style={styles.permanentPillText}>PERMANENT</Text>
              </View>
            ) : null}
            {isLocked ? (
              <View style={styles.statusOverlay}>
                <Lock size={scale(15)} color="#94A3B8" />
              </View>
            ) : isPermanent ? (
              <View style={[styles.statusOverlay, styles.statusOverlayAmber]}>
                <Check size={scale(15)} color="#F59E0B" />
              </View>
            ) : isSelected ? (
              <View style={[styles.statusOverlay, styles.statusOverlayBlue]}>
                <Check size={scale(15)} color="#3B82F6" />
              </View>
            ) : null}
            <View style={styles.heroTitleRow}>
              <Text
                style={[styles.perkTitle, isLocked && styles.lockedPerkTitle]}
                numberOfLines={1}
              >
                {perk.title}
              </Text>
              <View style={styles.glassRarityBadge}>
                <Text style={[styles.rarityText, { color: rarityColor }]}>{perk.rarity}</Text>
              </View>
            </View>
          </View>

          <View style={styles.perkBody}>
            <Text
              style={[styles.perkDescription, isLocked && styles.lockedPerkDescription]}
              numberOfLines={2}
            >
              {perk.description}
            </Text>
            {perk.unlock && isLocked && (
              <Text style={styles.requirementText}>
                Requires achievement: {perk.unlock.achievementId}
              </Text>
            )}

            {benefits.length > 0 && (
              <View style={styles.benefitsContainer}>
                {benefits.map((benefit) => {
                  const Icon = getStatIcon(benefit.stat);
                  const displayValue =
                    benefit.type === 'start'
                      ? `+${formatMoney(benefit.value)}`
                      : benefit.type === 'income'
                        ? `+${benefit.value}%`
                        : `+${benefit.value}`;

                  const displayStat =
                    benefit.stat === 'Starting Money'
                      ? 'Starting Money'
                      : benefit.stat === 'Income Boost'
                        ? 'Income Boost'
                        : benefit.stat;

                  return (
                    <View key={benefit.stat} style={styles.glassBenefitItem}>
                      <Icon size={16} color={getStatColor(benefit.stat)} />
                      <Text
                        style={[
                          styles.benefitText,
                          { color: getStatColor(benefit.stat) },
                        ]}
                      >
                        {displayValue} {displayStat}
                      </Text>
                    </View>
                  );
                })}
              </View>
            )}
          </View>
        </LinearGradient>
      </BlurView>
    </TouchableOpacity>
  );
});

interface MindsetCardProps {
  trait: MindsetTrait;
  isSelected: boolean;
  onSelect: (id: MindsetId) => void;
}

// R-perf: memoized — selecting a mindset only re-renders the affected cards
// instead of the whole list.
const MindsetCard = React.memo(function MindsetCard({
  trait,
  isSelected,
  onSelect,
}: MindsetCardProps) {
  const isRecommended = RECOMMENDED_MINDSETS.includes(trait.id);
  return (
    <TouchableOpacity
      style={styles.perkContainer}
      accessibilityRole="button"
      accessibilityLabel={`${trait.name}, ${
        trait.category === 'personality' ? 'Personality' : 'Financial'
      } mindset`}
      accessibilityState={{ selected: isSelected }}
      onPress={() => onSelect(trait.id)}
    >
      <BlurView intensity={20} style={styles.perkBlur}>
        <LinearGradient
          colors={
            isSelected
              ? ['rgba(139, 92, 246, 0.3)', 'rgba(124, 58, 237, 0.3)']
              : ['rgba(30, 41, 59, 0.9)', 'rgba(15, 23, 42, 0.8)']
          }
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={[styles.perkCard, isSelected && styles.mindsetCardSelected]}
        >
          {/* Hero symbol — the mindset's glowing icon, full-bleed with a scrim
              to match the perk cards; the purple accent marks the category. */}
          <View style={styles.heroWrap}>
            <Image source={trait.icon} style={styles.heroImage} resizeMode="cover" />
            <View style={styles.heroScrim} />
            {isRecommended ? (
              <View style={[styles.recommendedPill, styles.recommendedPillPurple]}>
                <Star size={11} color="#A78BFA" />
                <Text style={[styles.recommendedPillText, styles.recommendedPillTextPurple]}>
                  RECOMMENDED
                </Text>
              </View>
            ) : null}
            {isSelected ? (
              <View style={[styles.statusOverlay, styles.statusOverlayPurple]}>
                <Check size={scale(15)} color="#8B5CF6" />
              </View>
            ) : null}
            <View style={styles.heroTitleRow}>
              <Text
                style={[styles.perkTitle, isSelected && styles.mindsetNameSelected]}
                numberOfLines={1}
              >
                {trait.name}
              </Text>
              <View
                style={[
                  styles.glassRarityBadge,
                  {
                    backgroundColor:
                      trait.category === 'personality'
                        ? 'rgba(139, 92, 246, 0.2)'
                        : 'rgba(59, 130, 246,0.2)',
                  },
                ]}
              >
                <Text
                  style={[
                    styles.rarityText,
                    { color: trait.category === 'personality' ? '#A78BFA' : '#60A5FA' },
                  ]}
                >
                  {trait.category === 'personality' ? 'Personality' : 'Financial'}
                </Text>
              </View>
            </View>
          </View>

          <View style={styles.perkBody}>
            <Text style={[styles.perkDescription, isSelected && styles.mindsetDescSelected]}>
              {trait.description}
            </Text>
          </View>
        </LinearGradient>
      </BlurView>
    </TouchableOpacity>
  );
});

export default function Perks() {
  const { state, clearDraft } = useOnboarding();
  // R-perf: subscribe only to `achievements` (used for perk unlock state) instead
  // of the whole game state, so settings/theme changes don't re-render this screen.
  const achievements = useGameSelector((s) => s.achievements);
  const { loadGame } = useGameActions();
  const router = useRouter();
  const navigation = useNavigation();
  useOnboardingFlowGuard('Perks');

  useEffect(() => {
    logOnboardingStepView('Perks');
  }, []);

  const insets = useSafeAreaInsets();
  const [selected, setSelected] = useState<string[]>(state.perks);
  const [permanentPerks, setPermanentPerks] = useState<string[]>([]);
  const [activeTab, setActiveTab] = useState<TabType>('perks');
  const [selectedMindset, setSelectedMindset] = useState<MindsetId | null>(null);

  const handleBack = useCallback(() => {
    if (navigation.canGoBack()) {
      router.back();
    } else {
      router.replace('/(onboarding)/MainMenu');
    }
  }, [navigation, router]);

  // R3-C: Android hardware back → same handler as the on-screen back button.
  useHardwareBack(() => {
    handleBack();
    return true;
  });

  // Load permanent perks on mount
  useEffect(() => {
    const loadPermanentPerks = async () => {
      try {
        const perks = await IAPService.loadPermanentPerks();
        setPermanentPerks(perks);
        if (perks.length > 0) log.info('Loaded permanent perks', { perks });
      } catch (error) {
        log.error('Error loading permanent perks:', error);
      }
    };
    loadPermanentPerks();
  }, []);

  // Sorted perks using extracted logic
  const sortedPerks = useMemo(
    () => sortPerksByUnlockStatus(perks, permanentPerks, achievements || []),
    [achievements, permanentPerks]
  );

  // Backdrop, entrance animation, and floating particles are all owned by
  // OnboardingScreenShellV2 now — no need to hand-roll them here.

  const toggle = useCallback((id: string) => {
    haptic.selection();
    setSelected((prev) =>
      prev.includes(id) ? prev.filter((p) => p !== id) : [...prev, id]
    );
  }, []);

  const selectMindset = useCallback(
    (id: MindsetId) => setSelectedMindset((prev) => (prev === id ? null : id)),
    []
  );

  // H-7 (R8): synchronous re-entry guard for the start flow. Without it, two
  // rapid taps both run the full buildNewGameState → forceSave → loadGame
  // pipeline against the same slot with two different random states, racing the
  // double-buffer writer and risking corruption of the brand-new save. Mirrors
  // the continueInFlightRef pattern already used in SaveSlots.
  const startInFlightRef = useRef(false);
  const [isStarting, setIsStarting] = useState(false);

  const start = () => {
    if (startInFlightRef.current) return;
    startInFlightRef.current = true;
    setIsStarting(true);
    // Defer the heavy buildNewGameState() + save/load to the next frame so the
    // "Starting…" spinner paints before the synchronous work blocks the JS thread.
    requestAnimationFrame(() => {
      void runStart();
    });
  };

  const runStart = async () => {
    let navigating = false;
    try {
      haptic.heavy();
      log.info('Start button pressed', {
        selectedPerks: selected.length,
        selectedMindset,
        scenarioId: state.scenario?.id,
      });

      // Validate inputs using extracted module
      const inputCheck = validateOnboardingInputs({
        scenario: state.scenario,
        firstName: state.firstName,
        lastName: state.lastName,
        sex: state.sex,
        sexuality: state.sexuality,
      });
      if (!inputCheck.valid) {
        haptic.error();
        log.error(inputCheck.errorTitle!, { state });
        logOnboardingValidationError('Perks', inputCheck.errorTitle || 'input_invalid', {
          message: inputCheck.errorMessage,
        });
        Alert.alert(inputCheck.errorTitle!, inputCheck.errorMessage!, [{ text: 'OK' }]);
        return;
      }

      // Build game state using extracted module
      const newState = buildNewGameState({
        initialGameState,
        stateVersion: STATE_VERSION,
        firstName: state.firstName,
        lastName: state.lastName,
        sex: state.sex,
        sexuality: state.sexuality,
        avatarId: state.avatarId,
        scenario: {
          id: state.scenario!.id,
          start: state.scenario!.start,
        },
        challengeScenarioId: state.challengeScenarioId,
        selectedPerks: selected,
        permanentPerks,
        selectedMindset,
        ambitionId: state.ambitionId,
        faceGenome: state.faceGenome,
        facePortraitUri: state.facePortraitUri,
      });

      // Pass the chosen slot through UNCHANGED. The old `state.slot || 1` is
      // what let a flow that never picked a slot — the death screen, a deep
      // link, a rehydrated draft — land on slot 1 and overwrite a real save.
      // `initializeAndSaveGame` re-reads the slot and refuses if it is not ours.
      const slotToUse = state.slot;
      const createBackupForOnboarding = async (
        slot: number,
        stateToSave: any,
        tag: string
      ): Promise<void> => {
        await createBackupFromState(slot, stateToSave, tag);
      };
      const forceSaveForOnboarding = async (
        slot: number,
        stateToSave: any
      ): Promise<void> => {
        await forceSave(slot, stateToSave);
      };

      // Initialize, save, load, and validate using extracted module
      const result = await initializeAndSaveGame(newState, slotToUse, {
        validateOnboardingState,
        applySafeDefaults,
        createBackupFromState: createBackupForOnboarding,
        forceSave: forceSaveForOnboarding,
        loadGame,
        validateGameEntry,
        isSaveSigningConfigError,
        resolveNewLifeSlot,
        snapshotOutgoingSave,
      });

      if (!result.success) {
        haptic.error();
        if (result.slotProblem) {
          // Don't dead-end them on an alert four screens deep — the fix is a
          // slot choice, so take them to where that choice is made. Their
          // scenario, name, perks and mindset stay in the draft, so coming
          // back is a couple of taps, not a restart.
          Alert.alert(result.errorTitle!, result.errorMessage!, [
            {
              text: 'Choose Slot',
              onPress: () => router.replace('/(onboarding)/SaveSlots'),
            },
          ]);
          return;
        }
        Alert.alert(result.errorTitle!, result.errorMessage!, [{ text: 'OK' }]);
        return;
      }

      haptic.success();
      // R3-B: drop the persisted onboarding draft once the player has actually
      // started the life — clearDraft() also resets the in-memory onboarding
      // state so the next "New Life" entry starts clean (no leaked name/perks).
      void clearDraft();
      navigating = true;
      setTimeout(() => {
        router.replace('/(tabs)/home');
      }, 100);
    } finally {
      // Always release the synchronous guard. On the failure/return paths also
      // re-enable the button so the player can retry; on success keep it disabled
      // because we're navigating away (avoids a setState-after-unmount warning).
      startInFlightRef.current = false;
      if (!navigating) setIsStarting(false);
    }
  };

  const floatingStartButton = (
    <OnboardingFloatingButton
      title="Start Your Life"
      onPress={start}
      loading={isStarting}
      icon={<Play size={24} color="#FFFFFF" />}
    />
  );

  return (
    <OnboardingScreenShellV2 showParticles floatingButton={floatingStartButton}>
        <OnboardingGlassHeader
          title="Choose Perks"
          onBack={handleBack}
          onInfo={() =>
            Alert.alert(
              'Perks & Mindset',
              'Perks give small head-starts and mostly unlock by earning achievements as you play — so most will be locked on your first game, which is normal. A mindset is one optional trait that shapes your run with bonuses and trade-offs. Both are optional: tap "Start Your Life" whenever you are ready.'
            )
          }
        />

        <OnboardingStepBar currentStep={4} totalSteps={4} />

        <Text style={styles.guidanceText}>
          {activeTab === 'perks'
            ? 'Optional. Most perks unlock as you earn achievements — new players can just tap "Start Your Life".'
            : 'Optional. A mindset adds bonuses and trade-offs. Skip it if you’re not sure.'}
        </Text>

        {/* Tab Selector */}
        <View style={styles.tabContainer}>
          <TouchableOpacity
            style={[styles.tab, activeTab === 'perks' && styles.tabActive]}
            accessibilityRole="tab"
            accessibilityLabel="Perks"
            accessibilityState={{ selected: activeTab === 'perks' }}
            onPress={() => { haptic.light(); setActiveTab('perks'); }}
          >
            <LinearGradient
              colors={
                activeTab === 'perks'
                  ? ['#3B82F6', '#2563EB']
                  : ['rgba(30, 41, 59, 0.9)', 'rgba(15, 23, 42, 0.8)']
              }
              style={styles.tabGradient}
            >
              <Gift
                size={18}
                color={activeTab === 'perks' ? '#FFFFFF' : '#94A3B8'}
              />
              <Text
                style={[
                  styles.tabText,
                  activeTab === 'perks' && styles.tabTextActive,
                ]}
              >
                Perks
              </Text>
              {selected.length > 0 && (
                <View style={styles.tabBadge}>
                  <Text style={styles.tabBadgeText}>{selected.length}</Text>
                </View>
              )}
            </LinearGradient>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.tab, activeTab === 'mindset' && styles.tabActive]}
            accessibilityRole="tab"
            accessibilityLabel="Mindset"
            accessibilityState={{ selected: activeTab === 'mindset' }}
            onPress={() => { haptic.light(); setActiveTab('mindset'); }}
          >
            <LinearGradient
              colors={
                activeTab === 'mindset'
                  ? ['#3B82F6', '#2563EB']
                  : ['rgba(30, 41, 59, 0.9)', 'rgba(15, 23, 42, 0.8)']
              }
              style={styles.tabGradient}
            >
              <Brain
                size={18}
                color={activeTab === 'mindset' ? '#FFFFFF' : '#94A3B8'}
              />
              <Text
                style={[
                  styles.tabText,
                  activeTab === 'mindset' && styles.tabTextActive,
                ]}
              >
                Mindset
              </Text>
              {selectedMindset && (
                <View style={[styles.tabBadge, { backgroundColor: '#8B5CF6' }]}>
                  <Text style={styles.tabBadgeText}>1</Text>
                </View>
              )}
            </LinearGradient>
          </TouchableOpacity>
        </View>

        <ScrollView
          style={styles.scrollContainer}
          contentContainerStyle={{ paddingTop: 8 }}
          showsVerticalScrollIndicator={true}
        >
          <View style={styles.scrollContent}>
            {activeTab === 'perks' ? (
              <View style={styles.perksContainer}>
                {sortedPerks.map((perk) => (
                  <PerkCard
                    key={perk.id}
                    perk={perk}
                    isSelected={selected.includes(perk.id)}
                    isPermanent={isPerkPermanent(perk.id, permanentPerks)}
                    isLocked={isPerkLocked(perk, permanentPerks, achievements || [])}
                    onToggle={toggle}
                  />
                ))}
              </View>
            ) : (
              <View style={styles.perksContainer}>
                {MINDSET_TRAITS.map((trait: MindsetTrait) => (
                  <MindsetCard
                    key={trait.id}
                    trait={trait}
                    isSelected={selectedMindset === trait.id}
                    onSelect={selectMindset}
                  />
                ))}

                {selectedMindset && (
                  <TouchableOpacity
                    style={styles.clearButton}
                    onPress={() => setSelectedMindset(null)}
                  >
                    <Text style={styles.clearButtonText}>
                      Clear Mindset Selection
                    </Text>
                  </TouchableOpacity>
                )}
              </View>
            )}

            <View style={{ height: 140 + insets.bottom }} />
          </View>
        </ScrollView>

    </OnboardingScreenShellV2>
  );
}

const styles = StyleSheet.create({
  guidanceText: {
    fontSize: fontScale(13),
    fontWeight: '500',
    color: '#94A3B8',
    textAlign: 'center',
    paddingHorizontal: responsivePadding.large,
    paddingBottom: responsiveSpacing.xs,
  },
  recommendedPill: {
    position: 'absolute',
    top: 10,
    left: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: 'rgba(15, 23, 42, 0.78)',
    borderWidth: 1,
    borderColor: 'rgba(96, 165, 250, 0.6)',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: responsiveBorderRadius.full,
  },
  recommendedPillPurple: {
    borderColor: 'rgba(167, 139, 250, 0.6)',
  },
  recommendedPillText: {
    fontSize: fontScale(10),
    fontWeight: '800',
    color: '#60A5FA',
    letterSpacing: 0.6,
  },
  recommendedPillTextPurple: {
    color: '#A78BFA',
  },
  scrollContainer: { flex: 1 },
  scrollContent: { paddingBottom: 40 },

  perksContainer: {
    gap: responsiveSpacing.lg,
    paddingHorizontal: responsivePadding.large,
    paddingBottom: responsiveSpacing.lg,
  },
  perkContainer: {
    borderRadius: 16,
    overflow: 'hidden',
    ...Platform.select({
      web: { boxShadow: '0px 8px 16px rgba(0, 0, 0, 0.3)' } as any,
      default: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.3,
        shadowRadius: 16,
      },
    }),
    elevation: 12,
  },
  perkBlur: { borderRadius: 16, overflow: 'hidden' },
  perkCard: {
    // Hero image is full-bleed, so the card clips its children to the rounded
    // corners and the body supplies its own padding (no card-level padding).
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    overflow: 'hidden',
  },
  heroWrap: {
    position: 'relative',
    width: '100%',
    height: scale(132),
    backgroundColor: '#0F172A',
  },
  heroImage: {
    width: '100%',
    height: '100%',
  },
  heroScrim: {
    // One flat band over the bottom of the hero so the title/rarity read
    // cleanly — never a gradient (the fallback would render a hard-edged block).
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    height: '55%',
    backgroundColor: 'rgba(15, 23, 42, 0.9)',
  },
  heroTitleRow: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    gap: responsiveSpacing.xs,
    paddingHorizontal: 16,
    paddingBottom: 12,
  },
  perkBody: {
    padding: 16,
    gap: responsiveSpacing.sm,
  },
  statusOverlay: {
    position: 'absolute',
    top: 10,
    right: 10,
    width: scale(28),
    height: scale(28),
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(15, 23, 42, 0.85)',
    borderWidth: 2,
    borderColor: 'rgba(148, 163, 184, 0.6)',
  },
  statusOverlayBlue: { borderColor: 'rgba(96, 165, 250, 0.85)' },
  statusOverlayAmber: { borderColor: 'rgba(245, 158, 11, 0.85)' },
  statusOverlayPurple: { borderColor: 'rgba(167, 139, 250, 0.85)' },
  permanentPill: {
    position: 'absolute',
    top: 10,
    left: 10,
    backgroundColor: 'rgba(245, 158, 11, 0.9)',
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: responsiveBorderRadius.full,
    zIndex: 10,
  },
  permanentPillText: {
    color: '#FFFFFF',
    fontSize: fontScale(10),
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  perkTitle: {
    flex: 1,
    fontSize: responsiveFontSize.xl,
    fontWeight: '800',
    color: '#FFFFFF',
    textShadowColor: 'rgba(0, 0, 0, 0.6)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 4,
  },
  glassRarityBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.12)',
  },
  rarityText: { fontSize: responsiveFontSize.xs, fontWeight: 'bold' },

  perkDescription: {
    fontSize: responsiveFontSize.base,
    fontWeight: '500',
    color: '#CBD5E1',
    lineHeight: fontScale(16),
  },
  lockedPerkCard: { opacity: 0.6 },
  lockedPerkTitle: { color: '#94A3B8' },
  lockedPerkDescription: { color: '#94A3B8' },

  permanentPerkCard: { borderWidth: 2, borderColor: '#F59E0B' },

  requirementText: {
    fontSize: responsiveFontSize.sm,
    color: '#94A3B8',
    fontStyle: 'italic',
  },

  benefitsContainer: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  benefitText: {
    fontSize: responsiveFontSize.sm,
    fontWeight: '600',
    marginLeft: 4,
  },

  glassBenefitItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.2)',
  },
  tabContainer: {
    flexDirection: 'row',
    paddingHorizontal: responsivePadding.large,
    paddingTop: responsiveSpacing.sm,
    paddingBottom: responsiveSpacing.md,
    gap: 12,
  },
  tab: {
    flex: 1,
    borderRadius: 12,
    overflow: 'hidden',
  },
  tabActive: {
    ...Platform.select({
      web: { boxShadow: '0px 4px 8px rgba(59, 130, 246,0.3)' } as any,
      default: {
        shadowColor: '#3B82F6',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 8,
      },
    }),
    elevation: 4,
  },
  tabGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    paddingHorizontal: 16,
    gap: 8,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 12,
  },
  tabText: {
    fontSize: responsiveFontSize.base,
    fontWeight: '600',
    color: '#94A3B8',
  },
  tabTextActive: {
    color: '#FFFFFF',
  },
  tabBadge: {
    backgroundColor: '#3B82F6',
    borderRadius: 10,
    minWidth: 20,
    height: 20,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 6,
  },
  tabBadgeText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  mindsetCardSelected: {
    borderColor: 'rgba(96, 165, 250, 0.85)',
    borderWidth: 2,
  },
  mindsetNameSelected: {
    color: '#A78BFA',
  },
  mindsetDescSelected: {
    color: '#C4B5FD',
  },
  clearButton: {
    alignSelf: 'center',
    paddingVertical: 12,
    paddingHorizontal: 24,
    marginTop: responsiveSpacing.md,
  },
  clearButtonText: {
    fontSize: responsiveFontSize.base,
    color: '#94A3B8',
    fontWeight: '500',
  },
});
