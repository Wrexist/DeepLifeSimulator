import React, { useState, useEffect, useMemo, useRef } from 'react';
import { View, Text, TouchableOpacity, Modal, ScrollView, Switch, Alert, Linking, Animated } from 'react-native';
import LinearGradientFallback from '@/components/fallbacks/LinearGradientFallback';
// import { BlurView } from 'expo-blur'; // Removed - TurboModule crash fix
import { useSafeAreaInsets } from 'react-native-safe-area-context';
// Leaf contexts, not the @/contexts/GameContext barrel (avoids the production
// require-cycle from the barrel's eager `export * from './game'`).
import { useGameActions } from '@/contexts/game/GameActionsContext';
import { safeSettings } from "@/utils/safeGameState";
import { useGameState } from '@/contexts/game/GameStateContext';
import { useRouter, type Href } from 'expo-router';
import { X, Volume2, VolumeX, Save, HelpCircle, Calendar, Settings, Target, Sparkles, RefreshCw, MessageCircle, Users, Shield, Code, DollarSign, Gem } from 'lucide-react-native';
import LegacyOverviewTab from './LegacyOverviewTab';
import LifeGoalsPanel from './settings/LifeGoalsPanel';
import BugReportSheet from './settings/BugReportSheet';
import DangerZone from './settings/DangerZone';
import { useTranslation } from '@/hooks/useTranslation';
import { useTutorial } from '@/contexts/UIUXContext';
// import AsyncStorage from '@react-native-async-storage/async-storage'; // Unused but may be needed
import { safeSetItem, safeGetItem } from '@/utils/safeStorage';
import { setSoundEnabled } from '@/utils/soundManager';
import { setHapticsEnabled } from '@/utils/haptics';
import { scale } from '@/utils/scaling';
import { iapService } from '@/services/IAPService';
import { areAdsRemoved } from '@/lib/ads/rewardedAd';
import { useGemStore, type GemStoreTab } from '@/contexts/GemStoreContext';
import { logger } from '@/utils/logger';
import { styles } from '@/components/SettingsModalStyles';
import { DISCORD_URL, PRIVACY_POLICY_URL } from '@/lib/config/appConfig';
import { discordJoinRewardMoney } from '@/lib/config/gameConstants';
import { calculateNetWorth } from '@/lib/statistics/statisticsTracker';
import { formatMoney } from '@/utils/moneyFormatting';
import { updateMoney } from '@/contexts/game/actions/MoneyActions';
const LinearGradient = LinearGradientFallback;

// Dev/QA tooling is gated behind a build-time flag so the heavy simulator +
// debug graph (DevToolsModal → TestRunner / AIDebugMenu → SimulationRunner →
// lib/simulation/*, ~10k LOC) is dead-code-eliminated from production App Store
// builds. SettingsModal is reached from every screen via TopStatsBar, so a
// static import of DevToolsModal pulled that entire graph into the release
// bundle. __DEV__ is false in every release build; set
// EXPO_PUBLIC_ENABLE_DEVTOOLS=true to opt a TestFlight/internal build back in.
// Kept as a plain module-level constant + conditional require (not via
// featureFlags) so Metro can statically fold the branch and drop the chain.
const DEV_TOOLS_ENABLED =
  __DEV__ || process.env.EXPO_PUBLIC_ENABLE_DEVTOOLS === 'true';
// eslint-disable-next-line @typescript-eslint/no-require-imports
const DevToolsModal: React.ComponentType<{ visible: boolean; onClose: () => void }> | null =
  DEV_TOOLS_ENABLED ? require('./DevToolsModal').default : null;

interface SettingsModalProps {
  visible: boolean;
  onClose: () => void;
}

// On-theme action row for the Settings list. Replaces the old rainbow of fully
// saturated gradient buttons with the game's dark-glass surface + a tinted icon
// chip, so every row reads as one consistent family (matches the onboarding
// GlassActionButton look). The accent only colors the icon chip — never the
// whole button — which is what keeps the screen feeling like the rest of the game.
function SettingsActionButton({
  icon: Icon,
  label,
  accent,
  onPress,
  disabled = false,
  accessibilityLabel,
}: {
  icon: React.ComponentType<{ size?: number; color?: string }>;
  label: string;
  accent: string;
  onPress: () => void;
  disabled?: boolean;
  accessibilityLabel?: string;
}) {
  return (
    <TouchableOpacity
      style={[styles.actionButtonContainer, disabled ? styles.actionButtonDisabled : undefined]}
      onPress={onPress}
      disabled={disabled}
      activeOpacity={0.85}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? label}
    >
      <LinearGradient
        colors={['rgba(31, 41, 55, 0.85)', 'rgba(17, 24, 39, 0.85)']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.glassActionButton}
      >
        <View style={[styles.glassActionIconChip, { backgroundColor: `${accent}22`, borderColor: `${accent}55` }]}>
          <Icon size={18} color={accent} />
        </View>
        <Text style={styles.glassActionLabel}>{label}</Text>
      </LinearGradient>
    </TouchableOpacity>
  );
}

function SettingsModal({ visible, onClose }: SettingsModalProps) {
  const { gameState, setGameState } = useGameState();
  const { saveGame } = useGameActions();
  const { openStore } = useGemStore();
  const settings = safeSettings(gameState); // R3-D: defensive — see utils/safeGameState.ts
  // Both the Remove Ads IAP and DeepLife+ set settings.adsRemoved, so this flag
  // is authoritative (lib/ads/rewardedAd.ts). Used to hide the Remove Ads row
  // once the player already owns an ad-free entitlement.
  const adsRemoved = areAdsRemoved(gameState);
  // Wealth-scaled Discord join reward, computed once so every display below AND
  // the grant in handleJoinDiscord use the identical figure (shown == granted).
  // Memoized: calculateNetWorth walks every asset collection — too heavy to
  // re-run on each render of a modal that re-renders with global state.
  const discordReward = useMemo(
    () => discordJoinRewardMoney(calculateNetWorth(gameState)),
    [gameState]
  );
  const router = useRouter();
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();

  const [activeSettingsTab, setActiveSettingsTab] = useState<'settings' | 'lifeGoals'>('settings');
  const [showBugReport, setShowBugReport] = useState(false);
  const { startEnhancedTutorial, resetTutorial } = useTutorial();
  const [showLegacyOverview, setShowLegacyOverview] = useState(false);
  const [isRestoringPurchases, setIsRestoringPurchases] = useState(false);
  const [discordRewardClaimed, setDiscordRewardClaimed] = useState(false);
  // Game Dev Tools surface — only reachable when DEV_TOOLS_ENABLED (dev builds
  // or an explicit EXPO_PUBLIC_ENABLE_DEVTOOLS opt-in). Stripped from prod.
  const [showDevTools, setShowDevTools] = useState(false);
  const [showRewardPopup, setShowRewardPopup] = useState(false);
  const [rewardPopupMessage, setRewardPopupMessage] = useState('');
  // Frozen at claim time: after updateMoney lands, net worth (and thus the live
  // discordReward memo) grows, so rendering the memo in the popup would show a
  // larger figure than was actually granted. Shown must equal granted.
  const [rewardPopupAmount, setRewardPopupAmount] = useState(0);

  // Animation for Discord button
  const discordGlowAnim = useRef(new Animated.Value(0)).current;
  const rewardScaleAnim = useRef(new Animated.Value(0)).current;
  const rewardOpacityAnim = useRef(new Animated.Value(0)).current;
  const rewardGemAnim = useRef(new Animated.Value(0)).current;
  
  // Check if Discord reward has been claimed
  useEffect(() => {
    const checkDiscordReward = async () => {
      const claimed = await safeGetItem('discord_reward_claimed');
        setDiscordRewardClaimed(claimed === 'true');
    };
    checkDiscordReward();
  }, []);
  
  // Animate Discord button glow
  useEffect(() => {
    if (!discordRewardClaimed) {
      // R-perf: native driver — discordGlowAnim only drives opacity + scale
      // (both native-compatible), so this continuous loop no longer churns the
      // JS thread every frame while the Settings modal is open.
      const glowLoop = Animated.loop(
        Animated.sequence([
          Animated.timing(discordGlowAnim, {
            toValue: 1,
            duration: 2000,
            useNativeDriver: true,
          }),
          Animated.timing(discordGlowAnim, {
            toValue: 0,
            duration: 2000,
            useNativeDriver: true,
          }),
        ])
      );
      glowLoop.start();
      return () => glowLoop.stop();
    }
    return undefined;
  }, [discordRewardClaimed]);

  // Only toggles whose state is actually consumed somewhere remain here.
  // The previous list also included notificationsEnabled, showDecimalsInStats,
  // autoProgression, showStatArrows, and a language picker — all of those
  // saved to state but had no consumers, so the UI was misleading.
  // Dark Mode toggle removed: light mode was never fully implemented (the game
  // is dark-first and immersive) and produced a broken half-themed look. Saves
  // are coerced back to dark on load (utils/saveValidation.ts).
  const settingItems = [
    {
      id: 'soundEnabled',
      title: t('settings.soundEffects'),
      description: t('settings.soundEffectsDescription'),
      icon: settings.soundEnabled ? Volume2 : VolumeX,
      type: 'toggle' as const,
      value: settings.soundEnabled,
    },
    {
      id: 'hapticFeedback',
      title: t('settings.hapticFeedback'),
      description: t('settings.hapticFeedbackDescription'),
      icon: settings.hapticFeedback ? Volume2 : VolumeX,
      type: 'toggle' as const,
      value: settings.hapticFeedback,
    },
    {
      id: 'autoSave',
      title: 'Save Indicator',
      description: 'Show the small auto-save indicator while playing (saving itself is always on)',
      icon: Save,
      type: 'toggle' as const,
      value: settings.autoSave,
    },
    {
      id: 'weeklySummaryEnabled',
      title: 'Week Summary',
      description: 'Show the weekly recap after each week. Turn off to skip it.',
      icon: Calendar,
      type: 'toggle' as const,
      value: settings.weeklySummaryEnabled,
    },
  ];

  const handleToggle = (settingId: string, value: boolean) => {
    setGameState(prev => ({
      ...prev,
      settings: {
        ...prev.settings,
        [settingId]: value,
      },
    }));
    
    // Handle sound-specific settings
    if (settingId === 'soundEnabled') {
      setSoundEnabled(value);
    }
    // Sync standalone haptic utility
    if (settingId === 'hapticFeedback') {
      setHapticsEnabled(value);
    }
  };

  const handleRestorePurchases = async () => {
    if (isRestoringPurchases) {
      return;
    }

    setIsRestoringPurchases(true);
    
    try {
      logger.info('Starting purchase restoration from Settings...');
      const success = await iapService.restorePurchases();
      
      if (success) {
        // Reload IAP state to refresh purchases
        await iapService.loadPurchases();

        Alert.alert(
          'Purchases Restored',
          'Your previous purchases have been restored successfully!',
          [{ text: 'OK', style: 'default' }]
        );
      } else {
        Alert.alert(
          'Could Not Restore',
          'Purchases could not be restored at this time. Make sure you are signed in to the App Store and try again.',
          [{ text: 'OK', style: 'default' }]
        );
      }
    } catch (error) {
      logger.error('Restore purchases error:', error);
      Alert.alert(
        'Restore Failed',
        'Unable to restore purchases. Please try again or contact support.',
        [{ text: 'OK', style: 'default' }]
      );
    } finally {
      setIsRestoringPurchases(false);
    }
  };

  const showRewardAnimation = (message: string, amount: number) => {
    setRewardPopupAmount(amount);
    setRewardPopupMessage(message);
    setShowRewardPopup(true);
    // Start the pop at 0.9 (not 0) so the reward scales in gently instead of
    // popping from nothing; the spring below settles it to 1.
    rewardScaleAnim.setValue(0.9);
    rewardOpacityAnim.setValue(0);
    rewardGemAnim.setValue(0);

    Animated.parallel([
      Animated.spring(rewardScaleAnim, {
        toValue: 1,
        friction: 6,
        tension: 80,
        useNativeDriver: true,
      }),
      Animated.timing(rewardOpacityAnim, {
        toValue: 1,
        duration: 250,
        useNativeDriver: true,
      }),
      Animated.sequence([
        Animated.delay(300),
        Animated.spring(rewardGemAnim, {
          toValue: 1,
          friction: 5,
          tension: 60,
          useNativeDriver: true,
        }),
      ]),
    ]).start();
  };

  const dismissRewardPopup = () => {
    Animated.parallel([
      Animated.timing(rewardScaleAnim, {
        toValue: 0,
        duration: 200,
        useNativeDriver: true,
      }),
      Animated.timing(rewardOpacityAnim, {
        toValue: 0,
        duration: 200,
        useNativeDriver: true,
      }),
    ]).start(() => setShowRewardPopup(false));
  };

  // ── Store bridge (stacked-modal safety) ────────────────────────────────────
  // The gem store is an app-root RN Modal. Presenting it while THIS Settings
  // Modal is still on screen is the iOS stacked-modal hazard fixed elsewhere in
  // this PR (rewarded ad, LuxuryApp sheet). So a store row stashes the target
  // tab, dismisses Settings via onClose(), and opens the store only AFTER the
  // dismiss settles — never while Settings is still presented.
  //
  // Unlike RewardedAdModal (which stays mounted with visible=false), Settings is
  // UNMOUNTED on close by its parents (TopStatsBar / MainMenu gate it on a show
  // flag), so Modal.onDismiss can't be relied on and the deferred open MUST
  // outlive this component's unmount. openStore targets the always-mounted
  // app-level GemStoreProvider, so firing it post-unmount is safe — hence a
  // plain, deliberately un-cleared timer (clearing it on unmount would cancel
  // the open). onDismiss is kept as an iOS fast path for any mount that DOES
  // keep Settings alive; flushPendingStore is idempotent so they can't
  // double-open.
  const pendingStoreTabRef = useRef<GemStoreTab | null>(null);

  const flushPendingStore = () => {
    const tab = pendingStoreTabRef.current;
    if (!tab) return;
    pendingStoreTabRef.current = null;
    openStore(tab);
  };

  const openStoreAfterClose = (tab: GemStoreTab) => {
    pendingStoreTabRef.current = tab;
    onClose();
    setTimeout(flushPendingStore, 550);
  };

  const handleJoinDiscord = async () => {
    try {
      const discordUrl = DISCORD_URL;

      // Check if reward already claimed
      if (discordRewardClaimed) {
        const canOpen = await Linking.canOpenURL(discordUrl);
        if (canOpen) {
          await Linking.openURL(discordUrl);
        } else {
          Alert.alert('Error', `Could not open Discord link. Please visit ${DISCORD_URL} in your browser.`);
        }
        return;
      }

      // Persist the one-time claim marker BEFORE granting anything. If we granted
      // first and this write failed, a force-kill/restart would leave the scaled
      // cash reward re-claimable across restarts. So persist first; only on
      // success grant + save. Shares `discord_reward_claimed` with the in-game
      // CommunityRewardPopup so the reward is claimed exactly once across both
      // entry points.
      const saved = await safeSetItem('discord_reward_claimed', 'true');
      if (!saved) {
        // Persistence failed — grant NOTHING and leave the reward unclaimed so
        // it can be retried; never mint cash that isn't durably recorded.
        logger.warn('Could not persist Discord reward claim; granting nothing');
        Alert.alert("Couldn't save your claim", 'Please try again in a moment.');
        return;
      }

      // Claim persisted — now grant the cash (updateMoney respects the money
      // ceiling and logs it), mark claimed, and save.
      setDiscordRewardClaimed(true);
      updateMoney(setGameState, discordReward, 'Discord community reward');
      await saveGame();

      // Open Discord link (last)
      const canOpen = await Linking.canOpenURL(discordUrl);
      if (canOpen) {
        await Linking.openURL(discordUrl);
      }

      // Show liquid glass reward popup with the amount that was ACTUALLY
      // granted — the live discordReward memo recomputes upward once the grant
      // raises net worth.
      showRewardAnimation(
        canOpen
          ? `You received ${formatMoney(discordReward)} for joining our Discord!\nWelcome to the community!`
          : `You received ${formatMoney(discordReward)}!\nVisit ${DISCORD_URL} to join our Discord.`,
        discordReward
      );
    } catch (error) {
      logger.error('Error joining Discord:', error);
      Alert.alert('Error', `Could not open Discord link. Please visit ${DISCORD_URL} in your browser.`);
    }
  };

  // Always use dark mode - no conditional styles needed

  // Removed upcoming features tab

  return (
    <Modal
      visible={visible}
      transparent={true}
      animationType="fade"
      onRequestClose={onClose}
      onDismiss={flushPendingStore}
    >
      <View style={[styles.overlay, styles.overlayDark, { paddingTop: insets.top, paddingBottom: insets.bottom }]}>
        <View style={[styles.blurOverlay, { backgroundColor: 'rgba(0, 0, 0, 0.7)' }]}>
          <View style={styles.modal}>
          {/* Enhanced Header with Glass */}
          <View style={styles.glassHeader}>
            <View style={styles.glassOverlay} />
            <View style={styles.headerContent}>
              <View style={styles.titleContainer}>
                <View style={styles.glassTitleIcon}>
                  <View style={styles.glassOverlay} />
                  <Settings size={24} color="#FFFFFF" />
                </View>
                <Text style={[styles.title,  styles.titleDark]}>{t('settings.title')}</Text>
              </View>
              <TouchableOpacity onPress={onClose} style={styles.glassCloseButton} accessibilityRole="button" accessibilityLabel="Close" hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                <View style={styles.glassOverlay} />
                <X size={20} color="#FFFFFF" />
              </TouchableOpacity>
            </View>
          </View>

          <ScrollView style={styles.content} showsVerticalScrollIndicator={true}>
            {/* Enhanced Tab Container */}
            <View style={[styles.tabContainer,  styles.tabContainerDark]}>
              <TouchableOpacity
                style={[styles.settingsTab, activeSettingsTab === 'settings' && styles.activeSettingsTab]}
                onPress={() => setActiveSettingsTab('settings')}
              >
                {activeSettingsTab === 'settings' ? (
                  <LinearGradient
                    colors={['#6366F1', '#4F46E5']}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                    style={styles.activeTabGradient}
                  >
                    <Settings size={16} color="#FFFFFF" style={styles.tabIcon} />
                    <Text style={styles.activeSettingsTabText}>Settings</Text>
                  </LinearGradient>
                ) : (
                  <View style={styles.inactiveTab}>
                    <Settings size={16} color="#94A3B8" style={styles.tabIcon} />
                    <Text style={[styles.settingsTabText, styles.settingsTabTextDark]}>Settings</Text>
                  </View>
                )}
              </TouchableOpacity>
              
              <TouchableOpacity
                style={[styles.settingsTab, activeSettingsTab === 'lifeGoals' && styles.activeSettingsTab]}
                onPress={() => setActiveSettingsTab('lifeGoals')}
              >
                {activeSettingsTab === 'lifeGoals' ? (
                  <LinearGradient
                    colors={['#10B981', '#059669']}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                    style={styles.activeTabGradient}
                  >
                    <Target size={16} color="#FFFFFF" style={styles.tabIcon} />
                    <Text style={styles.activeSettingsTabText}>Life Goals</Text>
                  </LinearGradient>
                ) : (
                  <View style={styles.inactiveTab}>
                    <Target size={16} color="#94A3B8" style={styles.tabIcon} />
                    <Text style={[styles.settingsTabText, styles.settingsTabTextDark]}>Life Goals</Text>
                  </View>
                )}
              </TouchableOpacity>
            </View>

            {activeSettingsTab === 'settings' ? (
              <>
                {/* Game Dev Tools — dev/QA only; gated so the simulator graph is stripped from production. */}
                {DEV_TOOLS_ENABLED && (
                  <SettingsActionButton
                    icon={Code}
                    label="Game Dev Tools"
                    accent="#818CF8"
                    onPress={() => setShowDevTools(true)}
                    accessibilityLabel="Open Game Dev Tools"
                  />
                )}

                {settingItems.map(item => (
                  <View key={item.id} style={[styles.settingItem,  styles.settingItemDark]}>
                    <View style={[styles.settingItemBlur, { backgroundColor: 'rgba(0, 0, 0, 0.2)' }]}>
                      <LinearGradient
                        colors={['rgba(55, 65, 81, 0.8)', 'rgba(31, 41, 55, 0.8)']}
                        start={{ x: 0, y: 0 }}
                        end={{ x: 1, y: 1 }}
                        style={styles.settingItemGradient}
                      >
                        <View style={styles.settingInfo}>
                          <View style={styles.settingHeader}>
                            <LinearGradient
                              colors={item.value ? ['#10B981', '#059669'] as const : ['#94A3B8', '#475569'] as const}
                              start={{ x: 0, y: 0 }}
                              end={{ x: 1, y: 1 }}
                              style={styles.settingIconContainer}
                            >
                              <item.icon size={18} color="#FFFFFF" />
                            </LinearGradient>
                            <View style={styles.settingTextContainer}>
                              <Text style={[styles.settingTitle,  styles.settingTitleDark]}>
                                {item.title}
                              </Text>
                              <Text style={[styles.settingDescription,  styles.settingDescriptionDark]}>
                                {item.description}
                              </Text>
                            </View>
                          </View>
                        </View>
                        <View style={styles.switchContainer}>
                          <Switch
                            value={item.value}
                            onValueChange={(value) => handleToggle(item.id, value)}
                            trackColor={{ false: '#475569', true: '#10B981' }}
                            thumbColor={item.value ? '#FFFFFF' : '#F3F4F6'}
                            ios_backgroundColor="#475569"
                            accessibilityLabel={item.title}
                            accessibilityHint={`Toggle ${item.title.toLowerCase()}. Currently ${item.value ? 'enabled' : 'disabled'}`}
                            accessibilityRole="switch"
                            accessibilityState={{ checked: item.value }}
                          />
                        </View>
                      </LinearGradient>
                    </View>
                  </View>
                ))}

                {/* Enhanced Action Buttons */}
                <SettingsActionButton
                  icon={Users}
                  label="Legacy & Lineage"
                  accent="#C084FC"
                  onPress={() => setShowLegacyOverview(true)}
                />

                <SettingsActionButton
                  icon={Save}
                  label={t('settings.switchSaveSlot')}
                  accent="#60A5FA"
                  onPress={() => {
                    onClose();
                    const saveSlotsPath: Href = '/(onboarding)/SaveSlots';
                    router.push(saveSlotsPath);
                  }}
                />

                <SettingsActionButton
                  icon={HelpCircle}
                  label={t('settings.showTutorial')}
                  accent="#34D399"
                  onPress={async () => {
                    try {
                      logger.info('Opening tutorial...');
                      await resetTutorial();
                      onClose();
                      setTimeout(() => {
                        startEnhancedTutorial('game');
                        logger.info('Tutorial opened');
                      }, 150);
                    } catch (error) {
                      logger.error('Error opening tutorial:', error);
                      Alert.alert('Error', 'Failed to open tutorial. Please try again.');
                    }
                  }}
                />

                {/* Special Discord Button with Animation */}
                <TouchableOpacity
                  style={styles.discordButtonContainer}
                  onPress={handleJoinDiscord}
                  activeOpacity={0.9}
                >
                  <Animated.View
                    style={[
                      styles.discordButtonGlow,
                      {
                        opacity: discordGlowAnim.interpolate({
                          inputRange: [0, 1],
                          outputRange: [0.3, 0.8],
                        }),
                        transform: [
                          {
                            scale: discordGlowAnim.interpolate({
                              inputRange: [0, 1],
                              outputRange: [1, 1.05],
                            }),
                          },
                        ],
                      },
                    ]}
                  >
                    <LinearGradient
                      colors={['#5865F2', '#4752C4', '#3C45A5']}
                      start={{ x: 0, y: 0 }}
                      end={{ x: 1, y: 1 }}
                      style={styles.discordButtonGlowGradient}
                    />
                  </Animated.View>
                  <LinearGradient
                    colors={discordRewardClaimed ? ['#5865F2', '#4752C4'] : ['#5865F2', '#4752C4', '#3C45A5']}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                    style={styles.discordButton}
                  >
                    <View style={styles.discordButtonContent}>
                      <MessageCircle size={20} color="#FFFFFF" style={styles.discordButtonIcon} />
                      <View style={styles.discordButtonTextContainer}>
                        <Text style={styles.discordButtonText}>
                          {discordRewardClaimed ? 'Join Our Discord' : 'Join Our Discord'}
                        </Text>
                        {!discordRewardClaimed && (
                          <Text style={styles.discordButtonRewardText}>{`Reward: ${formatMoney(discordReward)}`}</Text>
                        )}
                      </View>
                      {!discordRewardClaimed && (
                        <View style={styles.discordBadge}>
                          <Text style={styles.discordBadgeText}>NEW</Text>
                        </View>
                      )}
                    </View>
                  </LinearGradient>
                </TouchableOpacity>

                {/* Gem Shop & Offers — a first-class entry into the IAP store.
                    Dismiss Settings first, then open the store from onDismiss
                    (stacked-modal safety). */}
                <SettingsActionButton
                  icon={Gem}
                  label="Gem Shop & Offers"
                  accent="#818CF8"
                  onPress={() => openStoreAfterClose('store')}
                  accessibilityLabel="Open the Gem Shop and offers"
                />

                {/* Remove Ads — the genre is majority ad-monetized, so this
                    deserves a first-class path. Hidden once the player already
                    owns an ad-free entitlement. */}
                {!adsRemoved && (
                  <SettingsActionButton
                    icon={Sparkles}
                    label="Remove Ads"
                    accent="#F59E0B"
                    onPress={() => openStoreAfterClose('store')}
                    accessibilityLabel="Remove ads"
                  />
                )}

                {/* Restore Purchases */}
                <SettingsActionButton
                  icon={RefreshCw}
                  label={isRestoringPurchases ? 'Restoring...' : 'Restore Purchases'}
                  accent="#A78BFA"
                  onPress={handleRestorePurchases}
                  disabled={isRestoringPurchases}
                />

                {/* Privacy Policy & Terms */}
                <SettingsActionButton
                  icon={Shield}
                  label="Privacy Policy"
                  accent="#94A3B8"
                  onPress={() => {
                    Linking.openURL(PRIVACY_POLICY_URL).catch(() => {
                      Alert.alert('Error', `Could not open privacy policy. Please visit ${PRIVACY_POLICY_URL} in your browser.`);
                    });
                  }}
                />

                {/* Danger Zone (restart & bug report) */}
                <DangerZone
                  onShowBugReport={() => setShowBugReport(true)}
                  onModalClose={onClose}
                />
              </>
            ) : activeSettingsTab === 'lifeGoals' ? (
              <LifeGoalsPanel />
            ) : null}
          </ScrollView>
          </View>
        </View>
      </View>

      <BugReportSheet visible={showBugReport} onClose={() => setShowBugReport(false)} />

      <LegacyOverviewTab visible={showLegacyOverview} onClose={() => setShowLegacyOverview(false)} />
      {/* Game Dev Tools modal mount — only present in dev/QA builds (see DEV_TOOLS_ENABLED). */}
      {DEV_TOOLS_ENABLED && DevToolsModal ? (
        <DevToolsModal visible={showDevTools} onClose={() => setShowDevTools(false)} />
      ) : null}

      {/* Liquid Glass Reward Popup */}
      {showRewardPopup && (
        <Animated.View style={[styles.rewardOverlay, { opacity: rewardOpacityAnim }]}>
          <TouchableOpacity style={styles.rewardOverlayTouch} activeOpacity={1} onPress={dismissRewardPopup}>
            <Animated.View style={[
              styles.rewardCard,
              {
                transform: [
                  { scale: rewardScaleAnim.interpolate({ inputRange: [0, 1], outputRange: [0.6, 1] }) },
                ],
              },
            ]}>
              <LinearGradient
                colors={['rgba(88, 101, 242, 0.25)', 'rgba(99, 102, 241, 0.15)', 'rgba(15, 23, 42, 0.6)']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.rewardGradient}
              >
                {/* Top accent line */}
                <LinearGradient
                  colors={['#5865F2', '#818CF8', '#5865F2']}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                  style={styles.rewardAccentLine}
                />

                {/* Gem icon with bounce */}
                <Animated.View style={[
                  styles.rewardGemContainer,
                  {
                    transform: [
                      { scale: rewardGemAnim.interpolate({ inputRange: [0, 1], outputRange: [0, 1.15] }) },
                    ],
                  },
                ]}>
                  <LinearGradient
                    colors={['#818CF8', '#6366F1', '#4F46E5']}
                    style={styles.rewardGemCircle}
                  >
                    <Sparkles size={scale(28)} color="#FFFFFF" />
                  </LinearGradient>
                </Animated.View>

                {/* Title */}
                <Text style={styles.rewardTitle}>Reward Claimed!</Text>

                {/* Cash amount */}
                <View style={styles.rewardAmountRow}>
                  <Text style={styles.rewardAmountText}>+{formatMoney(rewardPopupAmount)}</Text>
                  <DollarSign size={scale(16)} color="#6EE7B7" />
                  <Text style={styles.rewardAmountLabel}>Cash</Text>
                </View>

                {/* Message */}
                <Text style={styles.rewardMessage}>{rewardPopupMessage}</Text>

                {/* Dismiss button */}
                <TouchableOpacity style={styles.rewardDismissButton} onPress={dismissRewardPopup} activeOpacity={0.8}>
                  <LinearGradient
                    colors={['#5865F2', '#4752C4']}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                    style={styles.rewardDismissGradient}
                  >
                    <Text style={styles.rewardDismissText}>Awesome!</Text>
                  </LinearGradient>
                </TouchableOpacity>
              </LinearGradient>
            </Animated.View>
          </TouchableOpacity>
        </Animated.View>
      )}
    </Modal>
  );
}

export default React.memo(SettingsModal);

