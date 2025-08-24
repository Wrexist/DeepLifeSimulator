import React, { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Modal, ScrollView, Switch, Alert, TextInput, Linking, Image } from 'react-native';
import { useGame } from '@/contexts/GameContext';
import { useRouter } from 'expo-router';
import { X, Moon, Sun, Volume2, VolumeX, Bell, BellOff, Save, Globe, RotateCcw, Bug, Wrench } from 'lucide-react-native';
import { perks } from '@/src/features/onboarding/perksData';
import LeaderboardModal from './LeaderboardModal';

interface SettingsModalProps {
  visible: boolean;
  onClose: () => void;
}

export default function SettingsModal({ visible, onClose }: SettingsModalProps) {
  const { gameState, updateSettings, restartGame, updateStats, nextWeek, setGameState } = useGame();
  const { settings } = gameState;
  const router = useRouter();

  const languages = ['English', 'Svenska', 'Español', 'Français', 'Deutsch'];

  const [activeSettingsTab, setActiveSettingsTab] = useState<'settings' | 'lifeGoals' | 'upcoming'>('settings');
  const [showBugReport, setShowBugReport] = useState(false);
  const [bugReportText, setBugReportText] = useState('');
  const [showDevTools, setShowDevTools] = useState(false);
  const [showRestartConfirm, setShowRestartConfirm] = useState(false);
  const [showLeaderboard, setShowLeaderboard] = useState(false);

  const settingItems = [
    {
      id: 'darkMode',
      title: 'Dark Mode',
      description: 'Switch between light and dark themes',
      icon: settings.darkMode ? Moon : Sun,
      type: 'toggle' as const,
      value: settings.darkMode,
    },
    {
      id: 'soundEnabled',
      title: 'Sound Effects',
      description: 'Enable or disable game sounds',
      icon: settings.soundEnabled ? Volume2 : VolumeX,
      type: 'toggle' as const,
      value: settings.soundEnabled,
    },
    {
      id: 'notificationsEnabled',
      title: 'Notifications',
      description: 'Receive game notifications',
      icon: settings.notificationsEnabled ? Bell : BellOff,
      type: 'toggle' as const,
      value: settings.notificationsEnabled,
    },
    {
      id: 'autoSave',
      title: 'Auto Save',
      description: 'Automatically save game progress',
      icon: Save,
      type: 'toggle' as const,
      value: settings.autoSave,
    },
  ];

  const handleToggle = (settingId: string, value: boolean) => {
    updateSettings({ [settingId]: value });
  };

  const handleLanguageChange = (language: string) => {
    updateSettings({ language });
  };

  const confirmRestart = () => {
    void restartGame();
    setShowRestartConfirm(false);
    onClose();
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
      <View style={overlayStyle}>
        <View style={modalStyle}>
          <View style={styles.header}>
            <Text style={[styles.title, settings.darkMode && styles.titleDark]}>Settings</Text>
            <TouchableOpacity onPress={onClose} style={styles.closeButton}>
              <X size={24} color={settings.darkMode ? '#D1D5DB' : '#6B7280'} />
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
            <View style={styles.tabContainer}>
              <TouchableOpacity
                style={[styles.settingsTab, activeSettingsTab === 'settings' && styles.activeSettingsTab]}
                onPress={() => setActiveSettingsTab('settings')}
              >
                <Text style={[styles.settingsTabText, activeSettingsTab === 'settings' && styles.activeSettingsTabText]}>
                  Settings
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.settingsTab, activeSettingsTab === 'lifeGoals' && styles.activeSettingsTab]}
                onPress={() => setActiveSettingsTab('lifeGoals')}
              >
                <Text style={[styles.settingsTabText, activeSettingsTab === 'lifeGoals' && styles.activeSettingsTabText]}>
                  Life Goals
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.settingsTab, activeSettingsTab === 'upcoming' && styles.activeSettingsTab]}
                onPress={() => setActiveSettingsTab('upcoming')}
              >
                <Text style={[styles.settingsTabText, activeSettingsTab === 'upcoming' && styles.activeSettingsTabText]}>
                  Coming Soon
                </Text>
              </TouchableOpacity>
            </View>

            {activeSettingsTab === 'settings' ? (
              <>
                {settingItems.map(item => (
                  <View key={item.id} style={[styles.settingItem, settings.darkMode && styles.settingItemDark]}>
                    <View style={styles.settingInfo}>
                      <View style={styles.settingHeader}>
                        <item.icon size={20} color={settings.darkMode ? '#D1D5DB' : '#374151'} />
                        <Text style={[styles.settingTitle, settings.darkMode && styles.settingTitleDark]}>
                          {item.title}
                        </Text>
                      </View>
                      <Text style={[styles.settingDescription, settings.darkMode && styles.settingDescriptionDark]}>
                        {item.description}
                      </Text>
                    </View>
                    <Switch
                      value={item.value}
                      onValueChange={(value) => handleToggle(item.id, value)}
                      trackColor={{ false: '#E5E7EB', true: '#3B82F6' }}
                      thumbColor={item.value ? '#FFFFFF' : '#F3F4F6'}
                    />
                  </View>
                ))}

                <View style={[styles.settingItem, settings.darkMode && styles.settingItemDark]}>
                  <View style={styles.settingInfo}>
                    <View style={styles.settingHeader}>
                      <Globe size={20} color={settings.darkMode ? '#D1D5DB' : '#374151'} />
                      <Text style={[styles.settingTitle, settings.darkMode && styles.settingTitleDark]}>
                        Language
                      </Text>
                    </View>
                    <Text style={[styles.settingDescription, settings.darkMode && styles.settingDescriptionDark]}>
                      Choose your preferred language
                    </Text>
                  </View>
                  <View style={styles.languageButtons}>
                    {languages.map(language => (
                      <TouchableOpacity
                        key={language}
                        style={[
                          styles.languageButton,
                          settings.language === language && styles.activeLanguageButton,
                          settings.darkMode && styles.languageButtonDark,
                          settings.language === language && settings.darkMode && styles.activeLanguageButtonDark
                        ]}
                        onPress={() => handleLanguageChange(language)}
                      >
                        <Text style={[
                          styles.languageButtonText,
                          settings.language === language && styles.activeLanguageButtonText,
                          settings.darkMode && styles.languageButtonTextDark,
                          settings.language === language && settings.darkMode && styles.activeLanguageButtonTextDark
                        ]}>
                          {language}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </View>

                <TouchableOpacity
                  style={[styles.saveSlotsButton, settings.darkMode && styles.saveSlotsButtonDark]}
                  onPress={() => {
                    onClose();
                    router.push('/(onboarding)/SaveSlots');
                  }}
                >
                  <Text style={styles.saveSlotsButtonText}>Switch Save Slot</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.bugReportButton, settings.darkMode && styles.bugReportButtonDark]}
                  onPress={() => setShowLeaderboard(true)}
                >
                  <Globe size={20} color="#3B82F6" />
                  <Text style={styles.bugReportButtonText}>Leaderboard</Text>
                </TouchableOpacity>

                <View style={[styles.dangerSection, settings.darkMode && styles.dangerSectionDark]}>
                  <Text style={[styles.dangerTitle, settings.darkMode && styles.dangerTitleDark]}>Danger Zone</Text>
                  <TouchableOpacity
                    style={[styles.bugReportButton, settings.darkMode && styles.bugReportButtonDark]}
                    onPress={() => setShowBugReport(true)}
                  >
                    <Bug size={20} color="#3B82F6" />
                    <Text style={styles.bugReportButtonText}>Report Bug</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.restartButton, settings.darkMode && styles.restartButtonDark]}
                    onPress={() => setShowRestartConfirm(true)}
                  >
                    <RotateCcw size={20} color="#EF4444" />
                    <Text style={styles.restartButtonText}>Restart Game</Text>
                  </TouchableOpacity>
                </View>

                <View style={[styles.devSection, settings.darkMode && styles.devSectionDark]}>
                  <Text style={[styles.devTitle, settings.darkMode && styles.devTitleDark]}>Developer Tools</Text>
                  <TouchableOpacity
                    style={[styles.devToolsButton, settings.darkMode && styles.devToolsButtonDark]}
                    onPress={() => setShowDevTools(true)}
                  >
                    <Wrench size={20} color="#4F46E5" />
                    <Text style={styles.devToolsButtonText}>Open Dev Tools</Text>
                  </TouchableOpacity>
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
              </View>
            )}
          </ScrollView>
        </View>
      </View>

      <Modal
        visible={showDevTools}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setShowDevTools(false)}
      >
        <View style={overlayStyle}>
          <View style={modalStyle}>
            <View style={styles.header}>
              <Text style={[styles.title, settings.darkMode && styles.titleDark]}>Dev Tools</Text>
              <TouchableOpacity onPress={() => setShowDevTools(false)} style={styles.closeButton}>
                <X size={24} color={settings.darkMode ? '#D1D5DB' : '#6B7280'} />
              </TouchableOpacity>
            </View>

            <View style={styles.devToolsContent}>
              <TouchableOpacity
                style={[styles.devButton, settings.darkMode && styles.devButtonDark]}
                onPress={() => {
                  updateStats({ money: gameState.stats.money + 10000 });
                  Alert.alert('Money Added', '$10,000 added to your balance');
                }}
              >
                <Text style={[styles.devButtonText, settings.darkMode && styles.devButtonTextDark]}>Add $10,000</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.devButton, settings.darkMode && styles.devButtonDark]}
                onPress={() => {
                  updateStats({ money: gameState.stats.money + 1000000 });
                  Alert.alert('Money Added', '$1,000,000 added to your balance');
                }}
              >
                <Text style={[styles.devButtonText, settings.darkMode && styles.devButtonTextDark]}>Add $1,000,000</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.devButton, settings.darkMode && styles.devButtonDark]}
                onPress={() => {
                  updateStats({ happiness: Math.min(100, gameState.stats.happiness + 20) });
                  Alert.alert('Happiness Boosted', '+20 happiness');
                }}
              >
                <Text style={[styles.devButtonText, settings.darkMode && styles.devButtonTextDark]}>Boost Happiness</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.devButton, settings.darkMode && styles.devButtonDark]}
                onPress={() => {
                  updateStats({ health: Math.min(100, gameState.stats.health + 20) });
                  Alert.alert('Health Boosted', '+20 health');
                }}
              >
                <Text style={[styles.devButtonText, settings.darkMode && styles.devButtonTextDark]}>Boost Health</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.devButton, settings.darkMode && styles.devButtonDark]}
                onPress={() => {
                  updateStats({ energy: Math.min(100, gameState.stats.energy + 20) });
                  Alert.alert('Energy Boosted', '+20 energy');
                }}
              >
                <Text style={[styles.devButtonText, settings.darkMode && styles.devButtonTextDark]}>Boost Energy</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.devButton, settings.darkMode && styles.devButtonDark]}
                onPress={() => {
                  const enabled = !settings.maxStats;
                  updateSettings({ maxStats: enabled });
                  if (enabled) {
                    updateStats({ health: 100, happiness: 100, energy: 100 });
                  }
                  Alert.alert('Max Stats', enabled ? 'Enabled' : 'Disabled');
                }}
              >
                <Text style={[styles.devButtonText, settings.darkMode && styles.devButtonTextDark]}>
                  {settings.maxStats ? 'Disable Max Stats' : 'Enable Max Stats'}
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.devButton, settings.darkMode && styles.devButtonDark]}
                onPress={() => {
                  for (let i = 0; i < 52; i++) {
                    nextWeek();
                  }
                  Alert.alert('Time Travelled', 'Skipped 52 weeks');
                }}
              >
                <Text style={[styles.devButtonText, settings.darkMode && styles.devButtonTextDark]}>Skip 52 Weeks</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.devButton, settings.darkMode && styles.devButtonDark]}
                onPress={() => {
                  setGameState(prev => {
                    const diff = 99 - Math.floor(prev.date.age);
                    return {
                      ...prev,
                      date: { ...prev.date, age: 99, year: prev.date.year + diff },
                    };
                  });
                  Alert.alert('Time Travelled', 'Age set to 99');
                }}
              >
                <Text style={[styles.devButtonText, settings.darkMode && styles.devButtonTextDark]}>Skip to Age 99</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.devButton, settings.darkMode && styles.devButtonDark]}
                onPress={() => {
                  nextWeek();
                  Alert.alert('Week Advanced', 'Moved forward one week');
                }}
              >
                <Text style={[styles.devButtonText, settings.darkMode && styles.devButtonTextDark]}>Advance Week</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

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
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  overlayDark: {
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
  },
  modal: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    maxWidth: 450,
    width: '100%',
    maxHeight: '85%',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.25,
    shadowRadius: 20,
    elevation: 10,
  },
  modalDark: {
    backgroundColor: '#1F2937',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 24,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#1F2937',
  },
  titleDark: {
    color: '#F9FAFB',
  },
  closeButton: {
    padding: 4,
  },
  content: {
    padding: 24,
    paddingTop: 16,
  },
  settingItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  settingItemDark: {
    borderBottomColor: '#374151',
  },
  settingInfo: {
    flex: 1,
    marginRight: 16,
  },
  settingHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  settingTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1F2937',
    marginLeft: 12,
  },
  settingTitleDark: {
    color: '#F9FAFB',
  },
  settingDescription: {
    fontSize: 14,
    color: '#6B7280',
    lineHeight: 18,
  },
  settingDescriptionDark: {
    color: '#9CA3AF',
  },
  languageButtons: {
    flexDirection: 'column',
    alignItems: 'flex-end',
  },
  languageButton: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 6,
    marginBottom: 4,
    backgroundColor: '#F3F4F6',
  },
  languageButtonDark: {
    backgroundColor: '#374151',
  },
  activeLanguageButton: {
    backgroundColor: '#3B82F6',
  },
  activeLanguageButtonDark: {
    backgroundColor: '#60A5FA',
  },
  languageButtonText: {
    fontSize: 12,
    color: '#6B7280',
    fontWeight: '500',
  },
  languageButtonTextDark: {
    color: '#D1D5DB',
  },
  activeLanguageButtonText: {
    color: '#FFFFFF',
  },
  activeLanguageButtonTextDark: {
    color: '#1F2937',
  },
  saveSlotsButton: {
    marginTop: 16,
    backgroundColor: '#3B82F6',
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  saveSlotsButtonDark: {
    backgroundColor: '#1D4ED8',
  },
  saveSlotsButtonText: {
    color: '#FFFFFF',
    fontWeight: '600',
    fontSize: 16,
  },
  dangerSection: {
    marginTop: 30,
    paddingTop: 20,
    borderTopWidth: 1,
    borderTopColor: '#FEE2E2',
  },
  dangerSectionDark: {
    borderTopColor: '#7F1D1D',
  },
  dangerTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#EF4444',
    marginBottom: 12,
  },
  dangerTitleDark: {
    color: '#F87171',
  },
  restartButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FEF2F2',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#FECACA',
  },
  restartButtonDark: {
    backgroundColor: '#7F1D1D',
    borderColor: '#991B1B',
  },
  restartButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#EF4444',
    marginLeft: 8,
  },
  devSection: {
    marginTop: 30,
    paddingTop: 20,
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
  },
  devSectionDark: {
    borderTopColor: '#374151',
  },
  devTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#4F46E5',
    marginBottom: 12,
  },
  devTitleDark: {
    color: '#818CF8',
  },
  devToolsButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#E0E7FF',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#C7D2FE',
  },
  devToolsButtonDark: {
    backgroundColor: '#3730A3',
    borderColor: '#4338CA',
  },
  devToolsButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#4F46E5',
    marginLeft: 8,
  },
  tabContainer: {
    flexDirection: 'row',
    backgroundColor: '#F3F4F6',
    borderRadius: 8,
    padding: 4,
    marginBottom: 20,
  },
  settingsTab: {
    flex: 1,
    paddingVertical: 8,
    alignItems: 'center',
    borderRadius: 6,
  },
  activeSettingsTab: {
    backgroundColor: '#3B82F6',
  },
  settingsTabText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#6B7280',
  },
  activeSettingsTabText: {
    color: '#FFFFFF',
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
  },
  devButton: {
    backgroundColor: '#E5E7EB',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    marginBottom: 12,
    alignItems: 'center',
  },
  devButtonDark: {
    backgroundColor: '#374151',
  },
  devButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1F2937',
  },
  devButtonTextDark: {
    color: '#F9FAFB',
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
});