import React, { useState, useEffect, useRef } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Modal, ScrollView, Switch, Alert, TextInput, Linking, Image, Animated, Platform, KeyboardAvoidingView } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useGame } from '@/contexts/GameContext';
import { useRouter, type Href } from 'expo-router';
import { X, Moon, Sun, Volume2, VolumeX, Bell, BellOff, Save, Globe, RotateCcw, Bug, HelpCircle, Calendar, Settings, Target, Sparkles, Star, Zap, Shield, Heart, RefreshCw, MessageCircle, Users, Code } from 'lucide-react-native';
import { perks } from '@/src/features/onboarding/perksData';
import LeaderboardModal from './LeaderboardModal';
import LegacyOverviewTab from './LegacyOverviewTab';
import DevToolsModal from './DevToolsModal';
import { useTranslation } from '@/hooks/useTranslation';
import { useTutorial } from '@/contexts/UIUXContext';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { setSoundEnabled, setSoundVolume, isSoundEnabled, getSoundVolume } from '@/utils/soundManager';
import { responsivePadding, responsiveFontSize, responsiveSpacing, responsiveBorderRadius, scale, verticalScale } from '@/utils/scaling';
import { iapService } from '@/services/IAPService';
import { logger } from '@/utils/logger';
import { getShadow } from '@/utils/shadow';

interface SettingsModalProps {
  visible: boolean;
  onClose: () => void;
}

export default function SettingsModal({ visible, onClose }: SettingsModalProps) {
  const { gameState, updateSettings, restartGame, nextWeek, setGameState, saveGame } = useGame();
  const { settings } = gameState;
  const router = useRouter();
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();

  const languages = ['English', 'Svenska', 'Español', 'Français', 'Deutsch'];

  const [activeSettingsTab, setActiveSettingsTab] = useState<'settings' | 'lifeGoals'>('settings');
  const [showBugReport, setShowBugReport] = useState(false);
  const { startEnhancedTutorial, resetTutorial } = useTutorial();
  const [bugReportText, setBugReportText] = useState('');
  const [showRestartConfirm, setShowRestartConfirm] = useState(false);
  const [showLeaderboard, setShowLeaderboard] = useState(false);
  const [showLegacyOverview, setShowLegacyOverview] = useState(false);
  const [isRestoringPurchases, setIsRestoringPurchases] = useState(false);
  const [discordRewardClaimed, setDiscordRewardClaimed] = useState(false);
  const [showDevTools, setShowDevTools] = useState(false);
  
  // Animation for Discord button
  const discordGlowAnim = useRef(new Animated.Value(0)).current;
  
  // Check if Discord reward has been claimed
  useEffect(() => {
    const checkDiscordReward = async () => {
      try {
        const claimed = await AsyncStorage.getItem('discord_reward_claimed');
        setDiscordRewardClaimed(claimed === 'true');
      } catch (error) {
        logger.error('Error checking Discord reward:', error);
      }
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
  }, [discordRewardClaimed]);

  const settingItems = [
    {
      id: 'darkMode',
      title: t('settings.darkMode'),
      description: t('settings.darkModeDescription'),
      icon: settings.darkMode ? Moon : Sun,
      type: 'toggle' as const,
      value: settings.darkMode,
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
  ];

  const handleToggle = (settingId: string, value: boolean) => {
    updateSettings({ [settingId]: value });
    
    // Handle sound-specific settings
    if (settingId === 'soundEnabled') {
      setSoundEnabled(value);
    }
  };

  const handleLanguageChange = (language: string) => {
    updateSettings({ language });
  };

  const confirmRestart = async () => {
    try {
      await restartGame();
      setShowRestartConfirm(false);
      onClose();
      // Navigate to main menu after restart
      const mainMenuPath: Href = '/(onboarding)/MainMenu';
      router.push(mainMenuPath);
    } catch (error) {
      logger.error('Failed to restart game:', error);
      Alert.alert('Error', 'Failed to restart game. Please try again.');
    }
  };

  const handleBugReport = () => {
    if (!bugReportText.trim()) {
      Alert.alert('Empty Report', 'Please describe the bug you encountered.');
      return;
    }

    const subject = 'Bug Report - DeepLife Simulator';
    const body = `Bug Report:\n\n${bugReportText.trim()}\n\nGame Info:\nWeek: ${gameState.week}\nMoney: $${Math.floor(gameState.stats.money)}\nAge: ${Math.floor(gameState.date.age)}`;
    const emailUrl = `mailto:deeplifesimulator@gmail.com?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
    
    Linking.openURL(emailUrl).then(() => {
      setBugReportText('');
      setShowBugReport(false);
      Alert.alert('Thank you!', 'Your bug report has been prepared. Please send the email to help us improve the game.');
    }).catch(() => {
      Alert.alert('Error', 'Could not open email app. Please email deeplifesimulator@gmail.com directly.');
    });
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
        
        // Show success message
        Alert.alert(
          'Purchases Restored',
          'Your previous purchases have been restored successfully!',
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

  const handleJoinDiscord = async () => {
    try {
      const discordUrl = 'https://discord.gg/MU9VSgKg';
      
      // Check if reward already claimed
      if (discordRewardClaimed) {
        // Just open Discord link
        const canOpen = await Linking.canOpenURL(discordUrl);
        if (canOpen) {
          await Linking.openURL(discordUrl);
        } else {
          Alert.alert('Error', 'Could not open Discord link. Please visit https://discord.gg/MU9VSgKg in your browser.');
        }
        return;
      }
      
      // Give reward
      setGameState(prev => ({
        ...prev,
        stats: {
          ...prev.stats,
          gems: prev.stats.gems + 500,
        },
      }));
      
      // Mark as claimed
      await AsyncStorage.setItem('discord_reward_claimed', 'true');
      setDiscordRewardClaimed(true);
      
      // Save game to persist the gems
      await saveGame();
      
      // Open Discord link
      const canOpen = await Linking.canOpenURL(discordUrl);
      if (canOpen) {
        await Linking.openURL(discordUrl);
        Alert.alert(
          '🎉 Reward Claimed!',
          'You received 500 gems for joining our Discord! Welcome to the community!',
          [{ text: 'OK', style: 'default' }]
        );
      } else {
        Alert.alert(
          '🎉 Reward Claimed!',
          'You received 500 gems! Please visit https://discord.gg/MU9VSgKg in your browser to join our Discord.',
          [{ text: 'OK', style: 'default' }]
        );
      }
    } catch (error) {
      logger.error('Error joining Discord:', error);
      Alert.alert('Error', 'Could not open Discord link. Please visit https://discord.gg/MU9VSgKg in your browser.');
    }
  };

  const overlayStyle = [
    styles.overlay,
    settings.darkMode && styles.overlayDark
  ];

  const modalStyle = [
    styles.modal,
    settings.darkMode && styles.modalDark
  ];

  // Removed upcoming features tab

  return (
    <Modal
      visible={visible}
      transparent={true}
      animationType="fade"
      onRequestClose={onClose}
    >
      <View style={[styles.overlay, { paddingTop: insets.top, paddingBottom: insets.bottom }]}>
        <BlurView intensity={20} style={styles.blurOverlay}>
          <View style={[styles.modal, settings.darkMode && styles.modalDark]}>
          {/* Enhanced Header with Glass */}
          <View style={styles.glassHeader}>
            <View style={styles.glassOverlay} />
            <View style={styles.headerContent}>
              <View style={styles.titleContainer}>
                <View style={styles.glassTitleIcon}>
                  <View style={styles.glassOverlay} />
                  <Settings size={24} color="#FFFFFF" />
                </View>
                <Text style={[styles.title, settings.darkMode && styles.titleDark]}>{t('settings.title')}</Text>
              </View>
              <TouchableOpacity onPress={onClose} style={styles.glassCloseButton}>
                <View style={styles.glassOverlay} />
                <X size={20} color="#FFFFFF" />
              </TouchableOpacity>
            </View>
          </View>

          <ScrollView style={styles.content} showsVerticalScrollIndicator={true}>
            {/* Enhanced Tab Container */}
            <View style={[styles.tabContainer, settings.darkMode && styles.tabContainerDark]}>
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
                    <Settings size={16} color={settings.darkMode ? '#9CA3AF' : '#6B7280'} style={styles.tabIcon} />
                    <Text style={[styles.settingsTabText, settings.darkMode && styles.settingsTabTextDark]}>Settings</Text>
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
                    <Target size={16} color={settings.darkMode ? '#9CA3AF' : '#6B7280'} style={styles.tabIcon} />
                    <Text style={[styles.settingsTabText, settings.darkMode && styles.settingsTabTextDark]}>Life Goals</Text>
                  </View>
                )}
              </TouchableOpacity>
            </View>

            {activeSettingsTab === 'settings' ? (
              <>
                {settingItems.map(item => (
                  <View key={item.id} style={[styles.settingItem, settings.darkMode && styles.settingItemDark]}>
                    <BlurView intensity={10} style={styles.settingItemBlur}>
                      <LinearGradient
                        colors={settings.darkMode ? ['rgba(55, 65, 81, 0.8)', 'rgba(31, 41, 55, 0.8)'] : ['rgba(255, 255, 255, 0.9)', 'rgba(248, 250, 252, 0.9)']}
                        start={{ x: 0, y: 0 }}
                        end={{ x: 1, y: 1 }}
                        style={styles.settingItemGradient}
                      >
                        <View style={styles.settingInfo}>
                          <View style={styles.settingHeader}>
                            <LinearGradient
                              colors={item.value ? ['#10B981', '#059669'] : ['#6B7280', '#4B5563']}
                              start={{ x: 0, y: 0 }}
                              end={{ x: 1, y: 1 }}
                              style={styles.settingIconContainer}
                            >
                              <item.icon size={18} color="#FFFFFF" />
                            </LinearGradient>
                            <View style={styles.settingTextContainer}>
                              <Text style={[styles.settingTitle, settings.darkMode && styles.settingTitleDark]}>
                                {item.title}
                              </Text>
                              <Text style={[styles.settingDescription, settings.darkMode && styles.settingDescriptionDark]}>
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
                    </BlurView>
                  </View>
                ))}

                {/* Enhanced Language Selection */}
                <View style={[styles.settingItem, settings.darkMode && styles.settingItemDark]}>
                  <BlurView intensity={10} style={styles.settingItemBlur}>
                    <LinearGradient
                      colors={settings.darkMode ? ['rgba(55, 65, 81, 0.8)', 'rgba(31, 41, 55, 0.8)'] : ['rgba(255, 255, 255, 0.9)', 'rgba(248, 250, 252, 0.9)']}
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
                            <Text style={[styles.settingTitle, settings.darkMode && styles.settingTitleDark]}>
                              {t('settings.language')}
                            </Text>
                            <Text style={[styles.settingDescription, settings.darkMode && styles.settingDescriptionDark]}>
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
                              <View style={[styles.languageButton, settings.darkMode && styles.languageButtonDark]}>
                                <Text style={[styles.languageButtonText, settings.darkMode && styles.languageButtonTextDark]}>
                                  {language}
                                </Text>
                              </View>
                            )}
                          </TouchableOpacity>
                        ))}
                      </View>
                    </LinearGradient>
                  </BlurView>
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

                <TouchableOpacity
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
                </TouchableOpacity>

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
                          <Text style={styles.discordButtonRewardText}>🎁 Reward: 500 Gems</Text>
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

                {/* Developer Tools - Visible in development mode */}
                {__DEV__ && (
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
                )}

                {/* Privacy Policy & Terms */}
                <TouchableOpacity
                  style={styles.actionButtonContainer}
                  onPress={() => {
                    const privacyUrl = 'https://deeplifesimulator.github.io/privacy-policy/';
                    Linking.openURL(privacyUrl).catch(() => {
                      Alert.alert('Error', 'Could not open privacy policy. Please visit https://deeplifesimulator.github.io/privacy-policy/ in your browser.');
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

                {/* Enhanced Danger Zone */}
                <View style={[styles.dangerSection, settings.darkMode && styles.dangerSectionDark]}>
                  <BlurView intensity={15} style={styles.dangerSectionBlur}>
                    <LinearGradient
                      colors={settings.darkMode ? ['rgba(127, 29, 29, 0.3)', 'rgba(95, 21, 21, 0.3)'] : ['rgba(254, 226, 226, 0.8)', 'rgba(252, 231, 243, 0.8)']}
                      start={{ x: 0, y: 0 }}
                      end={{ x: 1, y: 1 }}
                      style={styles.dangerSectionGradient}
                    >
                      <View style={styles.dangerHeader}>
                        <LinearGradient
                          colors={['#EF4444', '#DC2626']}
                          start={{ x: 0, y: 0 }}
                          end={{ x: 1, y: 1 }}
                          style={styles.dangerIconContainer}
                        >
                          <Shield size={20} color="#FFFFFF" />
                        </LinearGradient>
                        <Text style={[styles.dangerTitle, settings.darkMode && styles.dangerTitleDark]}>{t('settings.dangerZone')}</Text>
                      </View>
                      
                      <TouchableOpacity
                        style={styles.dangerButtonContainer}
                        onPress={() => setShowBugReport(true)}
                        accessibilityLabel={t('settings.reportBug')}
                        accessibilityRole="button"
                        accessibilityHint="Tap to report a bug or issue you encountered in the game"
                      >
                        <LinearGradient
                          colors={['#3B82F6', '#1D4ED8']}
                          start={{ x: 0, y: 0 }}
                          end={{ x: 1, y: 1 }}
                          style={styles.dangerButton}
                        >
                          <Bug size={18} color="#FFFFFF" style={styles.dangerButtonIcon} />
                          <Text style={styles.dangerButtonText}>{t('settings.reportBug')}</Text>
                        </LinearGradient>
                      </TouchableOpacity>
                      
                      <TouchableOpacity
                        style={styles.dangerButtonContainer}
                        onPress={() => setShowRestartConfirm(true)}
                        accessibilityLabel={t('settings.restartGame')}
                        accessibilityRole="button"
                        accessibilityHint="Tap to restart the game. This will delete all your progress"
                      >
                        <LinearGradient
                          colors={['#EF4444', '#DC2626']}
                          start={{ x: 0, y: 0 }}
                          end={{ x: 1, y: 1 }}
                          style={styles.dangerButton}
                        >
                          <RotateCcw size={18} color="#FFFFFF" style={styles.dangerButtonIcon} />
                          <Text style={styles.dangerButtonText}>{t('settings.restartGame')}</Text>
                        </LinearGradient>
                      </TouchableOpacity>
                    </LinearGradient>
                  </BlurView>
                </View>
              </>
            ) : activeSettingsTab === 'lifeGoals' ? (
              <>
                <Text style={[styles.lifeGoalInfo, settings.darkMode && styles.lifeGoalInfoDark]}>
                  Achieve a Life Goal to unlock a perk for your next life. Each perk offers unique bonuses and advantages.
                </Text>
                {perks.map(perk => {
                  const current = gameState.achievements?.some(
                    a => a.id === perk.unlock?.achievementId && a.completed
                  )
                    ? 1
                    : 0;
                  const goalValue = 1;
                  const progress = Math.min(1, current / goalValue);
                  return (
                    <View key={perk.id} style={[styles.goalItem, settings.darkMode && styles.goalItemDark]}>
                      {typeof perk.icon === 'string' ? (
                        <Text
                          style={[
                            styles.goalIconText,
                            settings.darkMode && styles.goalIconTextDark,
                          ]}
                        >
                          {perk.icon}
                        </Text>
                      ) : (
                        <Image source={perk.icon} style={styles.goalIcon} />
                      )}
                      <View style={styles.goalContent}>
                        <Text style={[styles.goalTitle, settings.darkMode && styles.goalTitleDark]}>
                          {perk.title}
                        </Text>
                        <Text style={[styles.goalDesc, settings.darkMode && styles.goalDescDark]}>
                          Reward: {perk.description}
                        </Text>
                        <Text style={[styles.goalRequirement, settings.darkMode && styles.goalRequirementDark]}>
                          Requirement: {perk.requirement}
                        </Text>
                        <View style={styles.goalProgressBar}>
                          <View style={[styles.goalProgressFill, { width: `${progress * 100}%` }]} />
                        </View>
                        <Text style={[styles.goalProgressText, settings.darkMode && styles.goalDescDark]}>
                          {`Progress: ${current}/${goalValue}`}
                        </Text>
                      </View>
                    </View>
                  );
                })}
              </>
            ) : null}
          </ScrollView>
          </View>
        </BlurView>
      </View>

      <Modal
        visible={showRestartConfirm}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setShowRestartConfirm(false)}
      >
        <View style={overlayStyle}>
          <View style={modalStyle}>
            <View style={styles.header}>
              <Text style={[styles.title, settings.darkMode && styles.titleDark]}>Restart Game</Text>
              <TouchableOpacity onPress={() => setShowRestartConfirm(false)} style={styles.closeButton}>
                <X size={24} color={settings.darkMode ? '#D1D5DB' : '#6B7280'} />
              </TouchableOpacity>
            </View>

            <View style={styles.bugReportContent}>
              <Text style={[styles.bugReportDescription, settings.darkMode && styles.bugReportDescriptionDark]}>
                Are you sure you want to restart? All progress will be lost.
              </Text>
              <View style={styles.bugReportActions}>
                <TouchableOpacity
                  style={styles.cancelBugButton}
                  onPress={() => setShowRestartConfirm(false)}
                >
                  <Text style={styles.cancelBugButtonText}>No</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.sendBugButton}
                  onPress={confirmRestart}
                >
                  <Text style={styles.sendBugButtonText}>Yes</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </View>
      </Modal>

      <Modal
        visible={showBugReport}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setShowBugReport(false)}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={overlayStyle}
        >
          <View style={modalStyle}>
            <View style={styles.header}>
              <Text style={[styles.title, settings.darkMode && styles.titleDark]}>Report Bug</Text>
              <TouchableOpacity onPress={() => setShowBugReport(false)} style={styles.closeButton}>
                <X size={24} color={settings.darkMode ? '#D1D5DB' : '#6B7280'} />
              </TouchableOpacity>
            </View>

            <ScrollView
              style={styles.bugReportScrollView}
              contentContainerStyle={styles.bugReportContent}
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={true}
            >
              <Text style={[styles.bugReportDescription, settings.darkMode && styles.bugReportDescriptionDark]}>
                Please describe the bug you encountered. Include steps to reproduce it if possible.
              </Text>

              <TextInput
                style={[styles.bugReportInput, settings.darkMode && styles.bugReportInputDark]}
                placeholder="Describe the bug here..."
                placeholderTextColor={settings.darkMode ? '#9CA3AF' : '#6B7280'}
                value={bugReportText}
                onChangeText={setBugReportText}
                multiline
                numberOfLines={6}
                textAlignVertical="top"
                maxLength={1000}
              />
            </ScrollView>

            <View style={[styles.bugReportActions, settings.darkMode && styles.bugReportActionsDark]}>
              <TouchableOpacity
                style={styles.cancelBugButton}
                onPress={() => {
                  setShowBugReport(false);
                  setBugReportText('');
                }}
              >
                <Text style={styles.cancelBugButtonText}>Cancel</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.sendBugButton, !bugReportText.trim() && styles.disabledSendButton]}
                onPress={handleBugReport}
                disabled={!bugReportText.trim()}
              >
                <Text style={[styles.sendBugButtonText, !bugReportText.trim() && styles.disabledSendButtonText]}>
                  Send Report
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      <LeaderboardModal visible={showLeaderboard} onClose={() => setShowLeaderboard(false)} />
      <LegacyOverviewTab visible={showLegacyOverview} onClose={() => setShowLegacyOverview(false)} />
      <DevToolsModal visible={showDevTools} onClose={() => setShowDevTools(false)} />
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
  },
  blurOverlay: {
    flex: 1,
    width: '100%',
    justifyContent: 'center',
    alignItems: 'center',
    padding: responsivePadding.large,
  },
  overlayDark: {
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
  },
  modal: {
    backgroundColor: '#FFFFFF',
    borderRadius: responsiveBorderRadius.xl,
    maxWidth: scale(450),
    width: '100%',
    maxHeight: '90%',
    ...Platform.select({
      ios: {
        ...getShadow(20, '#000'),
      },
      android: {
        elevation: 10,
      },
      web: {
        ...getShadow(20, '#000'),
      },
    }),
    overflow: 'hidden',
  },
  modalDark: {
    backgroundColor: '#1F2937',
  },
  header: {
    padding: responsivePadding.large,
    paddingBottom: responsivePadding.medium,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(229, 231, 235, 0.3)',
  },
  glassHeader: {
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.15)',
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
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
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
    width: scale(40),
    height: scale(40),
    borderRadius: scale(20),
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
  lifeGoalInfo: {
    fontSize: 14,
    color: '#6B7280',
    textShadowColor: 'rgba(0, 0, 0, 0.75)',
    textShadowOffset: { width: -1, height: 1 },
    textShadowRadius: 2,
    marginBottom: 12,
    textAlign: 'center',
  },
  lifeGoalInfoDark: {
    color: '#FFFFFF',
    textShadowColor: 'rgba(0, 0, 0, 0.75)',
    textShadowOffset: { width: -1, height: 1 },
    textShadowRadius: 2,
  },
  goalItem: {
    flexDirection: 'row',
    backgroundColor: '#F9FAFB',
    padding: 12,
    borderRadius: 8,
    marginBottom: 12,
  },
  goalItemDark: {
    backgroundColor: '#1F2937',
  },
  goalIcon: {
    width: 32,
    height: 32,
    marginRight: 12,
  },
  goalIconText: {
    width: 32,
    marginRight: 12,
    textAlign: 'center',
    fontSize: 24,
    color: '#1F2937',
  },
  goalIconTextDark: {
    color: '#F9FAFB',
  },
  goalContent: {
    flex: 1,
  },
  goalTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1F2937',
  },
  goalTitleDark: {
    color: '#F9FAFB',
  },
  goalDesc: {
    fontSize: 12,
    color: '#6B7280',
    marginBottom: 8,
  },
  goalDescDark: {
    color: '#D1D5DB',
  },
  goalRequirement: {
    fontSize: 12,
    color: '#6B7280',
    marginBottom: 8,
  },
  goalRequirementDark: {
    color: '#D1D5DB',
  },
  goalProgressBar: {
    height: 6,
    backgroundColor: '#E5E7EB',
    borderRadius: 3,
    overflow: 'hidden',
  },
  goalProgressFill: {
    height: '100%',
    backgroundColor: '#3B82F6',
  },
  goalProgressText: {
    fontSize: 12,
    color: '#6B7280',
    marginTop: 4,
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
    borderColor: '#D1D5DB',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    backgroundColor: '#FFFFFF',
    minHeight: 120,
    maxHeight: 200,
    marginBottom: 12,
  },
  bugReportInputDark: {
    backgroundColor: '#374151',
    borderColor: '#4B5563',
    color: '#F9FAFB',
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
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#D1D5DB',
    borderRadius: 8,
    padding: 12,
    fontSize: 14,
    color: '#374151',
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
    borderColor: 'rgba(255, 255, 255, 0.2)',
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
});