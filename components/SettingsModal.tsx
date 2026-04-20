import React, { useState, useEffect, useRef } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Modal, ScrollView, Switch, Alert, Linking, Animated, Platform } from 'react-native';
import LinearGradientFallback from '@/components/fallbacks/LinearGradientFallback';
const LinearGradient = LinearGradientFallback;
// import { BlurView } from 'expo-blur'; // Removed - TurboModule crash fix
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useGame } from '@/contexts/GameContext';
import { useGameState } from '@/contexts/game/GameStateContext';
import { useRouter, type Href } from 'expo-router';
import { X, Moon, Sun, Volume2, VolumeX, Bell, BellOff, Save, Globe, HelpCircle, Calendar, Settings, Target, Sparkles, RefreshCw, MessageCircle, Users, HardDrive, TrendingUp, Shield } from 'lucide-react-native';
import BackupRecoveryModal from './BackupRecoveryModal';
import LeaderboardModal from './LeaderboardModal';
import LegacyOverviewTab from './LegacyOverviewTab';
import DevToolsModal from './DevToolsModal';
import LifeGoalsPanel from './settings/LifeGoalsPanel';
import BugReportSheet from './settings/BugReportSheet';
import DangerZone from './settings/DangerZone';
import { useTranslation } from '@/hooks/useTranslation';
import { useTutorial } from '@/contexts/UIUXContext';
// import AsyncStorage from '@react-native-async-storage/async-storage'; // Unused but may be needed
import { safeSetItem, safeGetItem } from '@/utils/safeStorage';
import { setSoundEnabled } from '@/utils/soundManager';
import { setHapticsEnabled } from '@/utils/haptics';
import { responsivePadding, responsiveFontSize, responsiveSpacing, responsiveBorderRadius, scale, fontScale } from '@/utils/scaling';
import { iapService } from '@/services/IAPService';
import { logger } from '@/utils/logger';
import { getShadow } from '@/utils/shadow';
import { DISCORD_URL, PRIVACY_POLICY_URL } from '@/lib/config/appConfig';
import { DISCORD_JOIN_REWARD_GEMS } from '@/lib/config/gameConstants';

interface SettingsModalProps {
  visible: boolean;
  onClose: () => void;
}

function SettingsModal({ visible, onClose }: SettingsModalProps) {
  const { gameState, setGameState, saveGame } = useGame();
  const { currentSlot } = useGameState();
  const { settings } = gameState;
  const router = useRouter();
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();

  const languages = ['English', 'Svenska', 'Español', 'Français', 'Deutsch'];

  const [activeSettingsTab, setActiveSettingsTab] = useState<'settings' | 'lifeGoals'>('settings');
  const [showBugReport, setShowBugReport] = useState(false);
  const { startEnhancedTutorial, resetTutorial } = useTutorial();
  const [showLeaderboard, setShowLeaderboard] = useState(false);
  const [showLegacyOverview, setShowLegacyOverview] = useState(false);
  const [isRestoringPurchases, setIsRestoringPurchases] = useState(false);
  const [discordRewardClaimed, setDiscordRewardClaimed] = useState(false);
  const [showDevTools, setShowDevTools] = useState(false);
  const [showBackupManager, setShowBackupManager] = useState(false);
  const [showRewardPopup, setShowRewardPopup] = useState(false);
  const [rewardPopupMessage, setRewardPopupMessage] = useState('');

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
      const glowLoop = Animated.loop(
        Animated.sequence([
          Animated.timing(discordGlowAnim, {
            toValue: 1,
            duration: 2000,
            useNativeDriver: false,
          }),
          Animated.timing(discordGlowAnim, {
            toValue: 0,
            duration: 2000,
            useNativeDriver: false,
          }),
        ])
      );
      glowLoop.start();
      return () => glowLoop.stop();
    }
    return undefined;
  }, [discordRewardClaimed]);

  const settingItems = [
    {
      id: 'darkMode',
      title: 'Dark Mode',
      description: 'Switch between dark and light theme',
      icon: settings.darkMode ? Moon : Sun,
      type: 'toggle' as const,
      value: settings.darkMode !== false,
    },
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
      id: 'notificationsEnabled',
      title: t('settings.notifications'),
      description: t('settings.notificationsDescription'),
      icon: settings.notificationsEnabled ? Bell : BellOff,
      type: 'toggle' as const,
      value: settings.notificationsEnabled,
    },
    {
      id: 'autoSave',
      title: t('settings.autoSave'),
      description: t('settings.autoSaveDescription'),
      icon: Save,
      type: 'toggle' as const,
      value: settings.autoSave,
    },
    {
      id: 'weeklySummaryEnabled',
      title: 'Monthly Summary',
      description: 'Show progress summary every 4 weeks',
      icon: Calendar,
      type: 'toggle' as const,
      value: settings.weeklySummaryEnabled,
    },
    {
      id: 'showDecimalsInStats',
      title: 'Show Decimals in Stats',
      description: 'Display decimal places in savings and gems',
      icon: Target,
      type: 'toggle' as const,
      value: settings.showDecimalsInStats,
    },
    {
      id: 'autoProgression',
      title: 'Auto Information Progression',
      description: 'Automatically reveal more detailed information as you play',
      icon: Sparkles,
      type: 'toggle' as const,
      value: settings.autoProgression !== false, // Default to true
    },
    {
      id: 'showStatArrows',
      title: 'Show Stat Arrows',
      description: 'Display arrows indicating stat change direction (green up, red down)',
      icon: TrendingUp,
      type: 'toggle' as const,
      value: settings.showStatArrows !== false, // Default to true
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

  const handleLanguageChange = (language: string) => {
    setGameState(prev => ({
      ...prev,
      settings: {
        ...prev.settings,
        language,
      },
    }));
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

  const showRewardAnimation = (message: string) => {
    setRewardPopupMessage(message);
    setShowRewardPopup(true);
    rewardScaleAnim.setValue(0);
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

      // Give reward
      setGameState(prev => ({
        ...prev,
        stats: {
          ...prev.stats,
          gems: prev.stats.gems + DISCORD_JOIN_REWARD_GEMS,
        },
      }));

      // Mark as claimed
      const saved = await safeSetItem('discord_reward_claimed', 'true');
      if (!saved) {
        logger.warn('Could not save discord reward claim status');
      }
      setDiscordRewardClaimed(true);

      // Save game to persist the gems
      await saveGame();

      // Open Discord link
      const canOpen = await Linking.canOpenURL(discordUrl);
      if (canOpen) {
        await Linking.openURL(discordUrl);
      }

      // Show liquid glass reward popup
      showRewardAnimation(
        canOpen
          ? `You received ${DISCORD_JOIN_REWARD_GEMS} gems for joining our Discord!\nWelcome to the community!`
          : `You received ${DISCORD_JOIN_REWARD_GEMS} gems!\nVisit ${DISCORD_URL} to join our Discord.`
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
              <TouchableOpacity onPress={onClose} style={styles.glassCloseButton}>
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
                    <Settings size={16} color="#9CA3AF" style={styles.tabIcon} />
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
                    <Target size={16} color="#9CA3AF" style={styles.tabIcon} />
                    <Text style={[styles.settingsTabText, styles.settingsTabTextDark]}>Life Goals</Text>
                  </View>
                )}
              </TouchableOpacity>
            </View>

            {activeSettingsTab === 'settings' ? (
              <>
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
                              colors={item.value ? ['#10B981', '#059669'] as const : ['#6B7280', '#4B5563'] as const}
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
                            trackColor={{ false: '#E5E7EB', true: '#10B981' }}
                            thumbColor={item.value ? '#FFFFFF' : '#F3F4F6'}
                            ios_backgroundColor="#E5E7EB"
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

                {/* Progressive Disclosure Level */}
                {!settings.autoProgression && (
                  <View style={[styles.settingItem,  styles.settingItemDark]}>
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
                              colors={['#8B5CF6', '#7C3AED']}
                              start={{ x: 0, y: 0 }}
                              end={{ x: 1, y: 1 }}
                              style={styles.settingIconContainer}
                            >
                              <Sparkles size={18} color="#FFFFFF" />
                            </LinearGradient>
                            <View style={styles.settingTextContainer}>
                              <Text style={[styles.settingTitle,  styles.settingTitleDark]}>
                                Information Detail Level
                              </Text>
                              <Text style={[styles.settingDescription,  styles.settingDescriptionDark]}>
                                Choose how much detail to show in tooltips and information
                              </Text>
                            </View>
                          </View>
                        </View>
                        <View style={styles.disclosureLevelSelector}>
                          {(['simple', 'standard', 'advanced'] as const).map((level) => {
                            const isSelected = gameState.progressiveDisclosureLevel === level;
                            return (
                              <TouchableOpacity
                                key={level}
                                onPress={() => {
                                  setGameState(prev => ({
                                    ...prev,
                                    progressiveDisclosureLevel: level,
                                  }));
                                  saveGame();
                                }}
                                style={[
                                  styles.disclosureLevelButton,
                                  isSelected && styles.disclosureLevelButtonActive,
                                ]}
                              >
                                <Text
                                  style={[
                                    styles.disclosureLevelText,
                                    isSelected && styles.disclosureLevelTextActive,
 !isSelected && styles.disclosureLevelTextDark,
                                  ]}
                                >
                                  {level.charAt(0).toUpperCase() + level.slice(1)}
                                </Text>
                              </TouchableOpacity>
                            );
                          })}
                        </View>
                      </LinearGradient>
                    </View>
                  </View>
                )}

                {/* Enhanced Language Selection */}
                <View style={[styles.settingItem,  styles.settingItemDark]}>
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
                            colors={['#3B82F6', '#1D4ED8']}
                            start={{ x: 0, y: 0 }}
                            end={{ x: 1, y: 1 }}
                            style={styles.settingIconContainer}
                          >
                            <Globe size={18} color="#FFFFFF" />
                          </LinearGradient>
                          <View style={styles.settingTextContainer}>
                            <Text style={[styles.settingTitle,  styles.settingTitleDark]}>
                              {t('settings.language')}
                            </Text>
                            <Text style={[styles.settingDescription,  styles.settingDescriptionDark]}>
                              {t('settings.languageDescription')}
                            </Text>
                          </View>
                        </View>
                      </View>
                      <View style={styles.languageButtons}>
                        {languages.map(language => (
                          <TouchableOpacity
                            key={language}
                            style={styles.languageButtonContainer}
                            onPress={() => handleLanguageChange(language)}
                          >
                            {settings.language === language ? (
                              <LinearGradient
                                colors={['#6366F1', '#4F46E5']}
                                start={{ x: 0, y: 0 }}
                                end={{ x: 1, y: 1 }}
                                style={styles.activeLanguageButton}
                              >
                                <Text style={styles.activeLanguageButtonText}>
                                  {language}
                                </Text>
                              </LinearGradient>
                            ) : (
                              <View style={[styles.languageButton,  styles.languageButtonDark]}>
                                <Text style={[styles.languageButtonText,  styles.languageButtonTextDark]}>
                                  {language}
                                </Text>
                              </View>
                            )}
                          </TouchableOpacity>
                        ))}
                      </View>
                    </LinearGradient>
                  </View>
                </View>

                {/* Enhanced Action Buttons */}
                <TouchableOpacity
                  style={styles.actionButtonContainer}
                  onPress={() => setShowLegacyOverview(true)}
                >
                  <LinearGradient
                    colors={['#4F46E5', '#7C3AED']}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                    style={styles.actionButton}
                  >
                    <Users size={20} color="#FFFFFF" style={styles.actionButtonIcon} />
                    <Text style={styles.actionButtonText}>Legacy & Lineage</Text>
                  </LinearGradient>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.actionButtonContainer}
                  onPress={() => {
                    onClose();
                    const saveSlotsPath: Href = '/(onboarding)/SaveSlots';
                    router.push(saveSlotsPath);
                  }}
                >
                  <LinearGradient
                    colors={['#3B82F6', '#1D4ED8']}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                    style={styles.actionButton}
                  >
                    <Save size={20} color="#FFFFFF" style={styles.actionButtonIcon} />
                    <Text style={styles.actionButtonText}>{t('settings.switchSaveSlot')}</Text>
                  </LinearGradient>
                </TouchableOpacity>

                {/* Backup & Recovery Section */}
                <TouchableOpacity
                  style={styles.actionButtonContainer}
                  onPress={() => setShowBackupManager(true)}
                >
                  <LinearGradient
                    colors={['#6366F1', '#4F46E5']}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                    style={styles.actionButton}
                  >
                    <HardDrive size={20} color="#FFFFFF" style={styles.actionButtonIcon} />
                    <Text style={styles.actionButtonText}>Backups & Recovery</Text>
                  </LinearGradient>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.actionButtonContainer}
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
                >
                  <LinearGradient
                    colors={['#10B981', '#059669']}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                    style={styles.actionButton}
                  >
                    <HelpCircle size={20} color="#FFFFFF" style={styles.actionButtonIcon} />
                    <Text style={styles.actionButtonText}>{t('settings.showTutorial')}</Text>
                  </LinearGradient>
                </TouchableOpacity>

                {/* Leaderboard - Hidden */}
                {/* <TouchableOpacity
                  style={styles.actionButtonContainer}
                  onPress={() => setShowLeaderboard(true)}
                >
                  <LinearGradient
                    colors={['#F59E0B', '#D97706']}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                    style={styles.actionButton}
                  >
                    <Star size={20} color="#FFFFFF" style={styles.actionButtonIcon} />
                    <Text style={styles.actionButtonText}>{t('settings.leaderboard')}</Text>
                  </LinearGradient>
                </TouchableOpacity> */}

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
                      <MessageCircle size={22} color="#FFFFFF" style={styles.discordButtonIcon} />
                      <View style={styles.discordButtonTextContainer}>
                        <Text style={styles.discordButtonText}>
                          {discordRewardClaimed ? 'Join Our Discord' : 'Join Our Discord'}
                        </Text>
                        {!discordRewardClaimed && (
                          <Text style={styles.discordButtonRewardText}>{`🎁 Reward: ${DISCORD_JOIN_REWARD_GEMS} Gems`}</Text>
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

                {/* Restore Purchases */}
                <TouchableOpacity
                  style={styles.actionButtonContainer}
                  onPress={handleRestorePurchases}
                  disabled={isRestoringPurchases}
                >
                  <LinearGradient
                    colors={isRestoringPurchases ? ['#9CA3AF', '#6B7280'] : ['#8B5CF6', '#7C3AED']}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                    style={styles.actionButton}
                  >
                    <RefreshCw size={20} color="#FFFFFF" style={styles.actionButtonIcon} />
                    <Text style={styles.actionButtonText}>
                      {isRestoringPurchases ? 'Restoring...' : 'Restore Purchases'}
                    </Text>
                  </LinearGradient>
                </TouchableOpacity>

                {/* Developer Tools - Hidden */}
                {/* {__DEV__ && (
                  <TouchableOpacity
                    style={styles.actionButtonContainer}
                    onPress={() => setShowDevTools(true)}
                  >
                    <LinearGradient
                      colors={['#6366F1', '#4F46E5']}
                      start={{ x: 0, y: 0 }}
                      end={{ x: 1, y: 1 }}
                      style={styles.actionButton}
                    >
                      <Code size={20} color="#FFFFFF" style={styles.actionButtonIcon} />
                      <Text style={styles.actionButtonText}>Developer Tools</Text>
                    </LinearGradient>
                  </TouchableOpacity>
                )} */}

                {/* Privacy Policy & Terms */}
                <TouchableOpacity
                  style={styles.actionButtonContainer}
                  onPress={() => {
                    Linking.openURL(PRIVACY_POLICY_URL).catch(() => {
                      Alert.alert('Error', `Could not open privacy policy. Please visit ${PRIVACY_POLICY_URL} in your browser.`);
                    });
                  }}
                >
                  <LinearGradient
                    colors={['#6366F1', '#4F46E5']}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                    style={styles.actionButton}
                  >
                    <Shield size={20} color="#FFFFFF" style={styles.actionButtonIcon} />
                    <Text style={styles.actionButtonText}>Privacy Policy</Text>
                  </LinearGradient>
                </TouchableOpacity>

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

      <LeaderboardModal visible={showLeaderboard} onClose={() => setShowLeaderboard(false)} />
      <LegacyOverviewTab visible={showLegacyOverview} onClose={() => setShowLegacyOverview(false)} />
      <DevToolsModal visible={showDevTools} onClose={() => setShowDevTools(false)} />
      <BackupRecoveryModal
        visible={showBackupManager}
        slot={currentSlot || 1}
        onClose={() => setShowBackupManager(false)}
      />

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

                {/* Gem amount */}
                <View style={styles.rewardAmountRow}>
                  <Text style={styles.rewardAmountText}>+{DISCORD_JOIN_REWARD_GEMS}</Text>
                  <Sparkles size={scale(16)} color="#A5B4FC" />
                  <Text style={styles.rewardAmountLabel}>Gems</Text>
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

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    backdropFilter: 'none',
  },
  blurOverlay: {
    flex: 1,
    width: '100%',
    justifyContent: 'center',
    alignItems: 'center',
    padding: responsivePadding.large,
  },
  overlayDark: {
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    backdropFilter: 'none',
  },
  modal: {
    backgroundColor: '#1F2937',
    borderRadius: responsiveBorderRadius.xl,
    maxWidth: 450,
    width: '100%',
    maxHeight: '90%',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 12,
    elevation: 10,
    borderWidth: 0,
    overflow: 'hidden',
  },
  header: {
    padding: responsivePadding.large,
    paddingBottom: responsivePadding.medium,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0,0,0,0.06)',
    backgroundColor: '#FAFBFC',
  },
  headerDark: {
    backgroundColor: 'transparent',
    borderBottomColor: 'rgba(229, 231, 235, 0.3)',
  },
  glassHeader: {
    backgroundColor: 'rgba(59, 130, 246, 0.05)',
    borderRadius: responsiveBorderRadius.lg,
    borderWidth: 1,
    borderColor: 'rgba(59, 130, 246, 0.1)',
    paddingHorizontal: responsivePadding.large,
    paddingVertical: responsivePadding.large,
    position: 'relative',
    overflow: 'hidden',
    ...Platform.select({
      ios: {
        ...getShadow(16, '#000'),
      },
      android: {
        elevation: 12,
      },
      web: {
        ...getShadow(16, '#000'),
      },
    }),
  },
  glassOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.2)',
    borderRadius: 20,
  },
  glassTitleIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: 'rgba(99, 102, 241, 0.15)',
    borderWidth: 1,
    borderColor: 'rgba(99, 102, 241, 0.25)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: responsiveSpacing.md,
    position: 'relative',
    overflow: 'hidden',
  },
  glassCloseButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(239, 68, 68, 0.15)',
    borderWidth: 1,
    borderColor: 'rgba(239, 68, 68, 0.25)',
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
    overflow: 'hidden',
  },
  headerContent: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  titleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  titleIconContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: responsiveSpacing.sm,
    ...Platform.select({
      ios: {
        boxShadow: '0px 4px 8px rgba(99, 102, 241, 0.3)',
        shadowColor: '#6366F1',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 8,
      },
      android: {
        elevation: 6,
      },
      web: {
        boxShadow: '0px 4px 8px rgba(99, 102, 241, 0.3)',
      },
    }),
  },
  title: {
    fontSize: responsiveFontSize.xl,
    fontWeight: 'bold',
    color: '#1F2937',
  },
  titleDark: {
    color: '#F9FAFB',
  },
  closeButton: {
    borderRadius: scale(20),
    overflow: 'hidden',
  },
  closeButtonGradient: {
    width: scale(40),
    height: scale(40),
    justifyContent: 'center',
    alignItems: 'center',
    ...Platform.select({
      ios: {
        ...getShadow(8, '#EF4444'),
      },
      android: {
        elevation: 6,
      },
      web: {
        ...getShadow(8, '#EF4444'),
      },
    }),
  },
  content: {
    padding: responsivePadding.large,
    paddingTop: responsivePadding.medium,
  },
  settingItem: {
    marginBottom: responsiveSpacing.md,
    borderRadius: responsiveBorderRadius.lg,
    overflow: 'hidden',
  },
  settingItemDark: {},
  settingItemBlur: {
    borderRadius: responsiveBorderRadius.lg,
    overflow: 'hidden',
  },
  settingItemGradient: {
    padding: responsivePadding.medium,
    borderRadius: responsiveBorderRadius.lg,
  },
  settingInfo: {
    flex: 1,
  },
  settingHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: responsiveSpacing.sm,
  },
  settingIconContainer: {
    width: scale(36),
    height: scale(36),
    borderRadius: scale(18),
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: responsiveSpacing.sm,
    ...Platform.select({
      ios: {
        ...getShadow(4, '#000'),
      },
      android: {
        elevation: 3,
      },
      web: {
        ...getShadow(4, '#000'),
      },
    }),
  },
  settingTextContainer: {
    flex: 1,
  },
  settingTitle: {
    fontSize: responsiveFontSize.base,
    fontWeight: '600',
    color: '#1F2937',
    marginBottom: 2,
  },
  settingTitleDark: {
    color: '#F9FAFB',
  },
  settingDescription: {
    fontSize: responsiveFontSize.sm,
    color: '#6B7280',
    lineHeight: 18,
    textShadowColor: 'rgba(0, 0, 0, 0.75)',
    textShadowOffset: { width: -1, height: 1 },
    textShadowRadius: 2,
  },
  settingDescriptionDark: {
    color: '#FFFFFF',
    textShadowColor: 'rgba(0, 0, 0, 0.75)',
    textShadowOffset: { width: -1, height: 1 },
    textShadowRadius: 2,
  },
  switchContainer: {
    marginLeft: responsiveSpacing.sm,
  },
  languageButtons: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'flex-end',
    marginTop: responsiveSpacing.sm,
  },
  languageButtonContainer: {
    marginLeft: responsiveSpacing.xs,
    marginBottom: responsiveSpacing.xs,
  },
  languageButton: {
    paddingVertical: responsiveSpacing.xs,
    paddingHorizontal: responsiveSpacing.sm,
    borderRadius: responsiveBorderRadius.md,
    backgroundColor: '#F3F4F6',
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  languageButtonDark: {
    backgroundColor: '#374151',
    borderColor: '#4B5563',
  },
  activeLanguageButton: {
    paddingVertical: responsiveSpacing.xs,
    paddingHorizontal: responsiveSpacing.sm,
    borderRadius: responsiveBorderRadius.md,
    ...Platform.select({
      ios: {
        ...getShadow(4, '#6366F1'),
      },
      android: {
        elevation: 3,
      },
      web: {
        ...getShadow(4, '#6366F1'),
      },
    }),
  },
  languageButtonText: {
    fontSize: responsiveFontSize.xs,
    color: '#6B7280',
    fontWeight: '500',
    textShadowColor: 'rgba(0, 0, 0, 0.75)',
    textShadowOffset: { width: -1, height: 1 },
    textShadowRadius: 2,
  },
  languageButtonTextDark: {
    color: '#FFFFFF',
    textShadowColor: 'rgba(0, 0, 0, 0.75)',
    textShadowOffset: { width: -1, height: 1 },
    textShadowRadius: 2,
  },
  activeLanguageButtonText: {
    fontSize: responsiveFontSize.xs,
    color: '#FFFFFF',
    fontWeight: '600',
  },
  // Enhanced Tab Styles
  tabContainer: {
    flexDirection: 'row',
    backgroundColor: '#F3F4F6',
    borderRadius: responsiveBorderRadius.lg,
    padding: 4,
    marginBottom: responsiveSpacing.lg,
    ...Platform.select({
      ios: {
        ...getShadow(4, '#000'),
      },
      android: {
        elevation: 2,
      },
      web: {
        ...getShadow(4, '#000'),
      },
    }),
  },
  tabContainerDark: {
    backgroundColor: '#374151',
  },
  settingsTab: {
    flex: 1,
    borderRadius: responsiveBorderRadius.md,
    overflow: 'hidden',
  },
  activeSettingsTab: {},
  activeTabGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: responsiveSpacing.sm,
    paddingHorizontal: responsiveSpacing.md,
    borderRadius: responsiveBorderRadius.md,
    ...Platform.select({
      ios: {
        ...getShadow(4, '#000'),
      },
      android: {
        elevation: 3,
      },
      web: {
        ...getShadow(4, '#000'),
      },
    }),
  },
  inactiveTab: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: responsiveSpacing.sm,
    paddingHorizontal: responsiveSpacing.md,
  },
  tabIcon: {
    marginRight: responsiveSpacing.xs,
  },
  settingsTabText: {
    fontSize: responsiveFontSize.sm,
    fontWeight: '500',
    color: '#6B7280',
  },
  settingsTabTextDark: {
    color: '#9CA3AF',
  },
  activeSettingsTabText: {
    fontSize: responsiveFontSize.sm,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  
  // Enhanced Action Button Styles
  actionButtonContainer: {
    marginBottom: responsiveSpacing.md,
    borderRadius: responsiveBorderRadius.lg,
    overflow: 'hidden',
    ...Platform.select({
      ios: {
        ...getShadow(8, '#000'),
      },
      android: {
        elevation: 4,
      },
      web: {
        ...getShadow(8, '#000'),
      },
    }),
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: responsiveSpacing.md,
    paddingHorizontal: responsiveSpacing.lg,
    borderRadius: responsiveBorderRadius.lg,
  },
  actionButtonIcon: {
    marginRight: responsiveSpacing.sm,
  },
  actionButtonText: {
    color: '#FFFFFF',
    fontWeight: '600',
    fontSize: responsiveFontSize.base,
  },
  // Enhanced Danger Section Styles
  dangerSection: {
    marginTop: responsiveSpacing.xl,
    borderRadius: responsiveBorderRadius.lg,
    overflow: 'hidden',
  },
  dangerSectionDark: {},
  dangerSectionBlur: {
    borderRadius: responsiveBorderRadius.lg,
    overflow: 'hidden',
  },
  dangerSectionGradient: {
    padding: responsivePadding.large,
    borderRadius: responsiveBorderRadius.lg,
  },
  dangerHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: responsiveSpacing.md,
  },
  dangerIconContainer: {
    width: scale(36),
    height: scale(36),
    borderRadius: scale(18),
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: responsiveSpacing.sm,
    ...Platform.select({
      ios: {
        ...getShadow(4, '#EF4444'),
      },
      android: {
        elevation: 3,
      },
      web: {
        ...getShadow(4, '#EF4444'),
      },
    }),
  },
  dangerTitle: {
    fontSize: responsiveFontSize.base,
    fontWeight: '600',
    color: '#EF4444',
  },
  dangerTitleDark: {
    color: '#F87171',
  },
  dangerButtonContainer: {
    marginBottom: responsiveSpacing.sm,
    borderRadius: responsiveBorderRadius.md,
    overflow: 'hidden',
    ...Platform.select({
      ios: {
        ...getShadow(4, '#000'),
      },
      android: {
        elevation: 3,
      },
      web: {
        ...getShadow(4, '#000'),
      },
    }),
  },
  dangerButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: responsiveSpacing.sm,
    paddingHorizontal: responsiveSpacing.md,
    borderRadius: responsiveBorderRadius.md,
  },
  dangerButtonIcon: {
    marginRight: responsiveSpacing.sm,
  },
  dangerButtonText: {
    color: '#FFFFFF',
    fontWeight: '600',
    fontSize: responsiveFontSize.sm,
  },
  // Life Goals styles moved to components/settings/LifeGoalsPanel.tsx
  lifeGoalGradient: {
    padding: scale(18),
    minHeight: scale(160),
  },
  lifeGoalGradientCompleted: {
    borderColor: 'rgba(16, 185, 129, 0.4)',
    ...Platform.select({
      ios: {
        shadowColor: '#10B981',
        shadowOffset: { width: 0, height: scale(2) },
        shadowOpacity: 0.3,
        shadowRadius: scale(8),
      },
      android: {
        elevation: 6,
      },
      web: {
        shadowColor: '#10B981',
        shadowOffset: { width: 0, height: scale(2) },
        shadowOpacity: 0.3,
        shadowRadius: scale(8),
      },
    }),
  },
  lifeGoalCardHeader: {
    flexDirection: 'row',
    marginBottom: scale(14),
    gap: scale(12),
  },
  lifeGoalIconWrapper: {
    alignItems: 'flex-start',
  },
  lifeGoalIconContainer: {
    width: scale(64),
    height: scale(64),
    borderRadius: scale(32),
    backgroundColor: 'rgba(59, 130, 246, 0.15)',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(59, 130, 246, 0.25)',
  },
  lifeGoalIconContainerCompleted: {
    backgroundColor: 'rgba(16, 185, 129, 0.2)',
    borderColor: 'rgba(16, 185, 129, 0.4)',
  },
  lifeGoalIcon: {
    width: scale(40),
    height: scale(40),
  },
  lifeGoalIconText: {
    fontSize: scale(40),
  },
  lifeGoalInfoSection: {
    flex: 1,
    minWidth: 0,
  },
  lifeGoalTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: scale(8),
    marginBottom: scale(6),
  },
  lifeGoalCardTitle: {
    fontSize: fontScale(18),
    fontWeight: '700',
    color: '#1F2937',
    flex: 1,
    letterSpacing: -0.3,
  },
  lifeGoalCardTitleDark: {
    color: '#FFFFFF',
  },
  lifeGoalCardTitleCompleted: {
    color: '#10B981',
  },
  completedBadge: {
    width: scale(24),
    height: scale(24),
    borderRadius: scale(12),
    backgroundColor: '#10B981',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(16, 185, 129, 0.5)',
  },
  completedBadgeText: {
    fontSize: fontScale(14),
    fontWeight: '700',
    color: '#FFFFFF',
  },
  lifeGoalReward: {
    fontSize: fontScale(13),
    color: '#6B7280',
    lineHeight: fontScale(18),
    fontWeight: '500',
  },
  lifeGoalRewardDark: {
    color: '#D1D5DB',
  },
  lifeGoalRequirementSection: {
    marginBottom: scale(14),
    paddingTop: scale(12),
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.1)',
  },
  lifeGoalRequirementRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: scale(8),
  },
  lifeGoalRequirementText: {
    fontSize: fontScale(12),
    color: '#6B7280',
    fontWeight: '600',
    flex: 1,
  },
  lifeGoalRequirementTextDark: {
    color: '#9CA3AF',
  },
  lifeGoalProgressSection: {
    marginTop: scale(4),
  },
  lifeGoalProgressHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: scale(8),
  },
  lifeGoalProgressLabel: {
    fontSize: fontScale(12),
    fontWeight: '600',
    color: '#6B7280',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  lifeGoalProgressLabelDark: {
    color: '#9CA3AF',
  },
  lifeGoalProgressPercent: {
    fontSize: fontScale(13),
    fontWeight: '700',
    color: '#3B82F6',
  },
  lifeGoalProgressPercentDark: {
    color: '#60A5FA',
  },
  lifeGoalProgressPercentCompleted: {
    color: '#10B981',
  },
  lifeGoalProgressBarContainer: {
    marginBottom: scale(6),
  },
  lifeGoalProgressBar: {
    height: scale(8),
    backgroundColor: 'rgba(229, 231, 235, 0.5)',
    borderRadius: scale(4),
    overflow: 'hidden',
  },
  lifeGoalProgressBarDark: {
    backgroundColor: 'rgba(55, 65, 81, 0.6)',
  },
  lifeGoalProgressFill: {
    height: '100%',
    borderRadius: scale(4),
    ...Platform.select({
      ios: {
        shadowColor: '#3B82F6',
        shadowOffset: { width: 0, height: 0 },
        shadowOpacity: 0.5,
        shadowRadius: scale(4),
      },
      android: {
        elevation: 2,
      },
      web: {
        shadowColor: '#3B82F6',
        shadowOffset: { width: 0, height: 0 },
        shadowOpacity: 0.5,
        shadowRadius: scale(4),
      },
    }),
  },
  lifeGoalProgressText: {
    fontSize: fontScale(11),
    color: '#6B7280',
    fontWeight: '500',
  },
  lifeGoalProgressTextDark: {
    color: '#9CA3AF',
  },
  // Keep old styles hidden for backward compatibility
  lifeGoalInfo: {
    display: 'none',
  },
  lifeGoalInfoDark: {
    display: 'none',
  },
  goalItem: {
    display: 'none',
  },
  goalItemDark: {
    display: 'none',
  },
  goalIcon: {
    display: 'none',
  },
  goalIconText: {
    display: 'none',
  },
  goalIconTextDark: {
    display: 'none',
  },
  goalContent: {
    display: 'none',
  },
  goalTitle: {
    display: 'none',
  },
  goalTitleDark: {
    display: 'none',
  },
  goalDesc: {
    display: 'none',
  },
  goalDescDark: {
    display: 'none',
  },
  goalRequirement: {
    display: 'none',
  },
  goalRequirementDark: {
    display: 'none',
  },
  goalProgressBar: {
    display: 'none',
  },
  goalProgressFill: {
    display: 'none',
  },
  goalProgressText: {
    display: 'none',
  },
  upcomingSection: {
    marginBottom: 30,
  },
  upcomingTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#1F2937',
    marginBottom: 15,
    textAlign: 'center',
  },
  upcomingTitleDark: {
    color: '#F9FAFB',
  },
  upcomingItem: {
    backgroundColor: '#F8FAFC',
    padding: 16,
    borderRadius: 12,
    marginBottom: 12,
    borderLeftWidth: 4,
    borderLeftColor: '#3B82F6',
  },
  upcomingItemDark: {
    backgroundColor: '#374151',
    borderLeftColor: '#60A5FA',
  },
  upcomingItemTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1F2937',
    marginBottom: 4,
  },
  upcomingItemTitleDark: {
    color: '#F9FAFB',
  },
  upcomingItemDesc: {
    fontSize: 14,
    color: '#6B7280',
    lineHeight: 18,
  },
  upcomingItemDescDark: {
    color: '#9CA3AF',
  },
  bugReportButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#EBF8FF',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#BFDBFE',
    marginBottom: 12,
  },
  bugReportButtonDark: {
    backgroundColor: '#1E3A8A',
    borderColor: '#3B82F6',
  },
  bugReportButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#3B82F6',
    marginLeft: 8,
  },
  devToolsContent: {
    padding: 24,
    maxHeight: 400,
  },
  bugReportScrollView: {
    flex: 1,
  },
  bugReportContent: {
    padding: 24,
    paddingBottom: 12,
  },
  bugReportDescription: {
    fontSize: 14,
    color: '#6B7280',
    marginBottom: 16,
    lineHeight: 20,
  },
  bugReportDescriptionDark: {
    color: '#9CA3AF',
  },
  bugReportInput: {
    borderWidth: 1,
    borderColor: '#4B5563',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    backgroundColor: '#374151',
    color: '#F9FAFB',
    minHeight: 120,
    maxHeight: 200,
    marginBottom: 12,
  },
  bugReportActions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 24,
    paddingBottom: 24,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
  },
  bugReportActionsDark: {
    borderTopColor: '#374151',
  },
  cancelBugButton: {
    flex: 1,
    paddingVertical: 12,
    marginRight: 10,
    alignItems: 'center',
  },
  cancelBugButtonText: {
    color: '#6B7280',
    fontSize: 16,
    fontWeight: '500',
  },
  sendBugButton: {
    flex: 1,
    backgroundColor: '#3B82F6',
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  disabledSendButton: {
    backgroundColor: '#E5E7EB',
  },
  sendBugButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  disabledSendButtonText: {
    color: '#9CA3AF',
  },
  featureSuggestionSection: {
    backgroundColor: '#F0F9FF',
    padding: 20,
    borderRadius: 16,
    marginTop: 20,
    borderWidth: 1,
    borderColor: '#BFDBFE',
  },
  featureSuggestionSectionDark: {
    backgroundColor: '#1E3A8A',
    borderColor: '#3B82F6',
  },
  featureSuggestionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#1E40AF',
    marginBottom: 8,
    textAlign: 'center',
  },
  featureSuggestionTitleDark: {
    color: '#93C5FD',
  },
  featureSuggestionDesc: {
    fontSize: 14,
    color: '#374151',
    marginBottom: 16,
    textAlign: 'center',
    lineHeight: 20,
  },
  featureSuggestionDescDark: {
    color: '#D1D5DB',
  },
  featureSuggestionInput: {
    backgroundColor: '#374151',
    borderWidth: 1,
    borderColor: '#4B5563',
    borderRadius: 8,
    padding: 12,
    fontSize: 14,
    color: '#F9FAFB',
    marginBottom: 16,
    minHeight: 100,
  },
  featureSuggestionInputDark: {
    backgroundColor: '#374151',
    borderColor: '#6B7280',
    color: '#F9FAFB',
  },
  featureSuggestionButton: {
    backgroundColor: '#3B82F6',
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 8,
    alignItems: 'center',
  },
  featureSuggestionButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  // Discord Button Styles
  discordButtonContainer: {
    marginBottom: responsiveSpacing.md,
    borderRadius: responsiveBorderRadius.lg,
    overflow: 'visible',
    position: 'relative',
    ...Platform.select({
      ios: {
        ...getShadow(16, '#5865F2'),
      },
      android: {
        elevation: 8,
      },
      web: {
        ...getShadow(16, '#5865F2'),
      },
    }),
  },
  discordButtonGlow: {
    position: 'absolute',
    top: -4,
    left: -4,
    right: -4,
    bottom: -4,
    borderRadius: responsiveBorderRadius.lg + 4,
    zIndex: 0,
  },
  discordButtonGlowGradient: {
    flex: 1,
    borderRadius: responsiveBorderRadius.lg + 4,
  },
  discordButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: responsiveSpacing.lg,
    paddingHorizontal: responsiveSpacing.lg,
    borderRadius: responsiveBorderRadius.lg,
    position: 'relative',
    zIndex: 1,
    borderWidth: 2,
    borderColor: 'rgba(99, 102, 241, 0.3)',
  },
  discordButtonContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    flex: 1,
  },
  discordButtonIcon: {
    marginRight: responsiveSpacing.sm,
  },
  discordButtonTextContainer: {
    flex: 1,
    alignItems: 'center',
  },
  discordButtonText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: responsiveFontSize.base + 2,
    textAlign: 'center',
  },
  discordButtonRewardText: {
    color: '#FFFFFF',
    fontWeight: '500',
    fontSize: responsiveFontSize.sm,
    marginTop: 2,
    opacity: 0.9,
  },
  discordBadge: {
    backgroundColor: '#10B981',
    paddingHorizontal: responsiveSpacing.sm,
    paddingVertical: 4,
    borderRadius: responsiveBorderRadius.md,
    marginLeft: responsiveSpacing.sm,
    ...Platform.select({
      ios: {
        ...getShadow(4, '#10B981'),
      },
      android: {
        elevation: 3,
      },
      web: {
        ...getShadow(4, '#10B981'),
      },
    }),
  },
  discordBadgeText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: responsiveFontSize.xs,
    letterSpacing: 0.5,
  },
  disclosureLevelSelector: {
    flexDirection: 'row',
    gap: responsiveSpacing.xs,
    marginTop: responsiveSpacing.sm,
  },
  disclosureLevelButton: {
    flex: 1,
    paddingVertical: responsiveSpacing.xs,
    paddingHorizontal: responsiveSpacing.sm,
    borderRadius: responsiveBorderRadius.md,
    backgroundColor: '#E5E7EB',
    alignItems: 'center',
  },
  disclosureLevelButtonActive: {
    backgroundColor: '#8B5CF6',
  },
  disclosureLevelText: {
    fontSize: fontScale(12),
    fontWeight: '600',
    color: '#374151',
  },
  disclosureLevelTextActive: {
    color: '#FFFFFF',
  },
  disclosureLevelTextDark: {
    color: '#9CA3AF',
  },
  // Liquid Glass Reward Popup
  rewardOverlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    zIndex: 999,
  },
  rewardOverlayTouch: {
    flex: 1,
    width: '100%',
    justifyContent: 'center',
    alignItems: 'center',
  },
  rewardCard: {
    width: '82%',
    maxWidth: scale(340),
    borderRadius: responsiveBorderRadius.xl + 4,
    overflow: 'hidden',
    borderWidth: 1.5,
    borderColor: 'rgba(129, 140, 248, 0.3)',
    ...Platform.select({
      ios: {
        shadowColor: '#6366F1',
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.35,
        shadowRadius: 24,
      },
      android: { elevation: 16 },
    }),
  },
  rewardGradient: {
    alignItems: 'center',
    paddingTop: scale(8),
    paddingBottom: scale(24),
    paddingHorizontal: scale(24),
  },
  rewardAccentLine: {
    width: '60%',
    height: 3,
    borderRadius: 2,
    marginBottom: scale(20),
    opacity: 0.8,
  },
  rewardGemContainer: {
    marginBottom: scale(16),
  },
  rewardGemCircle: {
    width: scale(64),
    height: scale(64),
    borderRadius: scale(32),
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: 'rgba(165, 180, 252, 0.4)',
    ...Platform.select({
      ios: {
        shadowColor: '#818CF8',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.4,
        shadowRadius: 12,
      },
      android: { elevation: 8 },
    }),
  },
  rewardTitle: {
    fontSize: fontScale(22),
    fontWeight: '700',
    color: '#FFFFFF',
    letterSpacing: 0.5,
    marginBottom: scale(8),
  },
  rewardAmountRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: scale(6),
    backgroundColor: 'rgba(99, 102, 241, 0.2)',
    paddingHorizontal: scale(16),
    paddingVertical: scale(8),
    borderRadius: responsiveBorderRadius.lg,
    borderWidth: 1,
    borderColor: 'rgba(129, 140, 248, 0.25)',
    marginBottom: scale(12),
  },
  rewardAmountText: {
    fontSize: fontScale(26),
    fontWeight: '800',
    color: '#A5B4FC',
  },
  rewardAmountLabel: {
    fontSize: fontScale(16),
    fontWeight: '600',
    color: '#C7D2FE',
  },
  rewardMessage: {
    fontSize: fontScale(14),
    color: 'rgba(255, 255, 255, 0.75)',
    textAlign: 'center',
    lineHeight: fontScale(20),
    marginBottom: scale(20),
  },
  rewardDismissButton: {
    width: '100%',
    borderRadius: responsiveBorderRadius.lg,
    overflow: 'hidden',
  },
  rewardDismissGradient: {
    paddingVertical: scale(14),
    alignItems: 'center',
    borderRadius: responsiveBorderRadius.lg,
  },
  rewardDismissText: {
    fontSize: fontScale(16),
    fontWeight: '700',
    color: '#FFFFFF',
    letterSpacing: 0.5,
  },
});

export default React.memo(SettingsModal);

