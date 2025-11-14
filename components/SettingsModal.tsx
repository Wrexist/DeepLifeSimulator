import React, { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Modal, ScrollView, Switch, Alert, TextInput, Linking, Image } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
import { useGame } from '@/contexts/GameContext';
import { useRouter } from 'expo-router';
import { X, Moon, Sun, Volume2, VolumeX, Bell, BellOff, Save, Globe, RotateCcw, Bug, Wrench, HelpCircle, Calendar, Settings, Target, Sparkles, Star, Zap, Shield, Heart, RefreshCw } from 'lucide-react-native';
import { perks } from '@/src/features/onboarding/perksData';
import LeaderboardModal from './LeaderboardModal';
import TutorialOverlay from './TutorialOverlay';
import { useTranslation } from '@/hooks/useTranslation';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { setSoundEnabled, setSoundVolume, isSoundEnabled, getSoundVolume } from '@/utils/soundManager';
import { responsivePadding, responsiveFontSize, responsiveSpacing, responsiveBorderRadius, scale, verticalScale } from '@/utils/scaling';
import { iapService } from '@/services/IAPService';

interface SettingsModalProps {
  visible: boolean;
  onClose: () => void;
}

export default function SettingsModal({ visible, onClose }: SettingsModalProps) {
  const { gameState, updateSettings, restartGame, nextWeek, setGameState } = useGame();
  const { settings } = gameState;
  const router = useRouter();
  const { t } = useTranslation();

  const languages = ['English', 'Svenska', 'Español', 'Français', 'Deutsch'];

  const [activeSettingsTab, setActiveSettingsTab] = useState<'settings' | 'lifeGoals' | 'upcoming'>('settings');
  const [showTutorial, setShowTutorial] = useState(false);
  const [showBugReport, setShowBugReport] = useState(false);
  const [bugReportText, setBugReportText] = useState('');
  const [showRestartConfirm, setShowRestartConfirm] = useState(false);
  const [showLeaderboard, setShowLeaderboard] = useState(false);
  const [featureSuggestion, setFeatureSuggestion] = useState('');
  const [isRestoringPurchases, setIsRestoringPurchases] = useState(false);

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
      router.push('/(onboarding)/MainMenu');
    } catch (error) {
      console.error('Failed to restart game:', error);
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

  const handleFeatureSuggestion = () => {
    if (!featureSuggestion.trim()) {
      Alert.alert('Empty Suggestion', 'Please describe the feature you would like to see.');
      return;
    }

    const subject = 'Feature Suggestion - DeepLife Simulator';
    const body = `Feature Suggestion:\n\n${featureSuggestion.trim()}\n\nGame Info:\nWeek: ${gameState.week}\nMoney: $${Math.floor(gameState.stats.money)}\nAge: ${Math.floor(gameState.date.age)}`;
    const emailUrl = `mailto:deeplifesimulator@gmail.com?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
    
    Linking.openURL(emailUrl).then(() => {
      setFeatureSuggestion('');
      Alert.alert('Thank you!', 'Your feature suggestion has been prepared. Please send the email to help us plan future updates.');
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
      console.log('Starting purchase restoration from Settings...');
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
      console.error('Restore purchases error:', error);
      Alert.alert(
        'Restore Failed',
        'Unable to restore purchases. Please try again or contact support.',
        [{ text: 'OK', style: 'default' }]
      );
    } finally {
      setIsRestoringPurchases(false);
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

  const upcomingFeatures = [
    {
      id: 'new_apps',
      title: '📱 New Apps',
      description: 'Instogram, PayPol, AppHub, YouVideo, Toktik & more!'
    },
    {
      id: 'enhanced_companies',
      title: '🏢 Enhanced Companies',
      description: 'IPO, mergers'
    },
    {
      id: 'game_features',
      title: '🎮 Game Features',
      description: 'achievements, leaderboards'
    },
    {
      id: 'global_expansion',
      title: '🌍 Global expansion',
      description: 'and travel'
    },
    {
      id: 'advanced_careers',
      title: '💼 Advanced careers',
      description: 'politician, celebrity, athlete'
    },
    {
      id: 'social_media_superstar',
      title: '🌟 Social Media Superstar',
      description: 'Become famous and earn money'
    },
  ];

  return (
    <Modal
      visible={visible}
      transparent={true}
      animationType="slide"
      onRequestClose={onClose}
    >
      <BlurView intensity={20} style={styles.overlay}>
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
              
              <TouchableOpacity
                style={[styles.settingsTab, activeSettingsTab === 'upcoming' && styles.activeSettingsTab]}
                onPress={() => setActiveSettingsTab('upcoming')}
              >
                {activeSettingsTab === 'upcoming' ? (
                  <LinearGradient
                    colors={['#F59E0B', '#D97706']}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                    style={styles.activeTabGradient}
                  >
                    <Sparkles size={16} color="#FFFFFF" style={styles.tabIcon} />
                    <Text style={styles.activeSettingsTabText}>Coming Soon</Text>
                  </LinearGradient>
                ) : (
                  <View style={styles.inactiveTab}>
                    <Sparkles size={16} color={settings.darkMode ? '#9CA3AF' : '#6B7280'} style={styles.tabIcon} />
                    <Text style={[styles.settingsTabText, settings.darkMode && styles.settingsTabTextDark]}>Coming Soon</Text>
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
                  onPress={() => {
                    onClose();
                    router.push('/(onboarding)/SaveSlots');
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
                      console.log('Opening tutorial...');
                      // Remove tutorial completed flag so it can be shown again
                      await AsyncStorage.removeItem('tutorial_completed');
                      // Close settings
                      onClose();
                      // Show tutorial after a brief delay
                      setTimeout(() => {
                        setShowTutorial(true);
                        console.log('Tutorial opened');
                      }, 300);
                    } catch (error) {
                      console.error('Error opening tutorial:', error);
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
            ) : (
              <View style={styles.upcomingSection}>
                <Text style={[styles.upcomingTitle, settings.darkMode && styles.upcomingTitleDark]}>Exciting Features Coming Soon!</Text>
                {upcomingFeatures.map(feature => (
                  <View key={feature.id} style={[styles.upcomingItem, settings.darkMode && styles.upcomingItemDark]}>
                    <Text style={[styles.upcomingItemTitle, settings.darkMode && styles.upcomingItemTitleDark]}>
                      {feature.title}
                    </Text>
                    <Text style={[styles.upcomingItemDesc, settings.darkMode && styles.upcomingItemDescDark]}>
                      {feature.description}
                    </Text>
                  </View>
                ))}
                
                {/* Feature Suggestion Section */}
                <View style={[styles.featureSuggestionSection, settings.darkMode && styles.featureSuggestionSectionDark]}>
                  <Text style={[styles.featureSuggestionTitle, settings.darkMode && styles.featureSuggestionTitleDark]}>
                    💡 Suggest New Features
                  </Text>
                  <Text style={[styles.featureSuggestionDesc, settings.darkMode && styles.featureSuggestionDescDark]}>
                    Have an idea for a new feature? Let us know what you'd like to see in future updates!
                  </Text>
                  
                  <TextInput
                    style={[styles.featureSuggestionInput, settings.darkMode && styles.featureSuggestionInputDark]}
                    placeholder="Describe your feature idea..."
                    placeholderTextColor={settings.darkMode ? '#9CA3AF' : '#6B7280'}
                    value={featureSuggestion}
                    onChangeText={setFeatureSuggestion}
                    multiline
                    numberOfLines={4}
                    textAlignVertical="top"
                  />
                  
                  <TouchableOpacity
                    style={styles.featureSuggestionButton}
                    onPress={handleFeatureSuggestion}
                    disabled={!featureSuggestion.trim()}
                  >
                    <Text style={styles.featureSuggestionButtonText}>
                      Send Suggestion
                    </Text>
                  </TouchableOpacity>
                </View>
              </View>
            )}
          </ScrollView>
        </View>
      </BlurView>


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
        <View style={overlayStyle}>
          <View style={modalStyle}>
            <View style={styles.header}>
              <Text style={[styles.title, settings.darkMode && styles.titleDark]}>Report Bug</Text>
              <TouchableOpacity onPress={() => setShowBugReport(false)} style={styles.closeButton}>
                <X size={24} color={settings.darkMode ? '#D1D5DB' : '#6B7280'} />
              </TouchableOpacity>
            </View>

            <View style={styles.bugReportContent}>
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
              />

              <View style={styles.bugReportActions}>
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
          </View>
        </View>
      </Modal>
      <LeaderboardModal visible={showLeaderboard} onClose={() => setShowLeaderboard(false)} />
      <TutorialOverlay visible={showTutorial} onClose={() => setShowTutorial(false)} />
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
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
    maxHeight: '85%',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.25,
    shadowRadius: 20,
    elevation: 10,
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
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.3,
    shadowRadius: 16,
    elevation: 12,
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
    shadowColor: '#6366F1',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 6,
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
    shadowColor: '#EF4444',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 6,
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
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 3,
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
  },
  settingDescriptionDark: {
    color: '#9CA3AF',
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
    shadowColor: '#6366F1',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 3,
  },
  languageButtonText: {
    fontSize: responsiveFontSize.xs,
    color: '#6B7280',
    fontWeight: '500',
  },
  languageButtonTextDark: {
    color: '#D1D5DB',
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
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
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
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 3,
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
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 4,
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
    shadowColor: '#EF4444',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 3,
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
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 3,
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
  // Enhanced Dev Section Styles
  devSection: {
    marginTop: responsiveSpacing.xl,
    borderRadius: responsiveBorderRadius.lg,
    overflow: 'hidden',
  },
  devSectionDark: {},
  devSectionBlur: {
    borderRadius: responsiveBorderRadius.lg,
    overflow: 'hidden',
  },
  devSectionGradient: {
    padding: responsivePadding.large,
    borderRadius: responsiveBorderRadius.lg,
  },
  devHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: responsiveSpacing.md,
  },
  devIconContainer: {
    width: scale(36),
    height: scale(36),
    borderRadius: scale(18),
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: responsiveSpacing.sm,
    shadowColor: '#4F46E5',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 3,
  },
  devTitle: {
    fontSize: responsiveFontSize.base,
    fontWeight: '600',
    color: '#4F46E5',
  },
  devTitleDark: {
    color: '#818CF8',
  },
  devButtonContainer: {
    borderRadius: responsiveBorderRadius.md,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 3,
  },
  devButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: responsiveSpacing.sm,
    paddingHorizontal: responsiveSpacing.md,
    borderRadius: responsiveBorderRadius.md,
  },
  devButtonIcon: {
    marginRight: responsiveSpacing.sm,
  },
  devButtonText: {
    color: '#FFFFFF',
    fontWeight: '600',
    fontSize: responsiveFontSize.sm,
  },
  lifeGoalInfo: {
    fontSize: 14,
    color: '#6B7280',
    marginBottom: 12,
    textAlign: 'center',
  },
  lifeGoalInfoDark: {
    color: '#D1D5DB',
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
  bugReportContent: {
    padding: 24,
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
    marginBottom: 20,
  },
  bugReportInputDark: {
    backgroundColor: '#374151',
    borderColor: '#4B5563',
    color: '#F9FAFB',
  },
  bugReportActions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
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
});