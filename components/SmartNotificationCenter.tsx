import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Animated,
  Modal,
  Dimensions,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
import {
  Bell,
  BellOff,
  X,
  Settings,
  Filter,
  Check,
  AlertTriangle,
  Info,
  Lightbulb,
  Calendar,
  PartyPopper,
  MessageSquare,
  Eye,
  EyeOff,
  Trash2,
  MoreHorizontal,
} from 'lucide-react-native';
import { useGame } from '@/contexts/GameContext';
import { SmartNotification, NotificationContext, useSmartNotifications } from '@/utils/smartNotifications';
import { useFeedback } from '@/utils/feedbackSystem';
import { DesignSystem } from '@/utils/designSystem';

interface SmartNotificationCenterProps {
  visible: boolean;
  onClose: () => void;
}

const { width, height } = Dimensions.get('window');

export default function SmartNotificationCenter({
  visible,
  onClose,
}: SmartNotificationCenterProps) {
  const { gameState } = useGame();
  const { buttonPress, haptic } = useFeedback(gameState?.settings?.hapticFeedback || false);
  
  const [selectedFilter, setSelectedFilter] = useState<'all' | 'unread' | 'achievement' | 'warning' | 'tip'>('all');
  const [showSettings, setShowSettings] = useState(false);
  const [notificationPreferences, setNotificationPreferences] = useState({
    showTips: true,
    showMilestones: true,
    showWarnings: true,
    showSuggestions: true,
    notificationFrequency: 'medium' as 'low' | 'medium' | 'high',
  });

  const slideAnim = useRef(new Animated.Value(height)).current;
  const fadeAnim = useRef(new Animated.Value(0)).current;

  // Create notification context
  const notificationContext: NotificationContext = {
    gameState,
    timeOfDay: getTimeOfDay(),
    dayOfWeek: new Date().getDay(),
    season: getSeason(),
    recentActions: [], // This would be populated from game state
    userPreferences: notificationPreferences,
  };

  const { notifications, showNotification, clearHistory } = useSmartNotifications(notificationContext);

  useEffect(() => {
    if (visible) {
      Animated.parallel([
        Animated.timing(slideAnim, {
          toValue: 0,
          duration: 300,
          useNativeDriver: true,
        }),
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: 300,
          useNativeDriver: true,
        }),
      ]).start();
    } else {
      Animated.parallel([
        Animated.timing(slideAnim, {
          toValue: height,
          duration: 300,
          useNativeDriver: true,
        }),
        Animated.timing(fadeAnim, {
          toValue: 0,
          duration: 300,
          useNativeDriver: true,
        }),
      ]).start();
    }
  }, [visible]);

  const filteredNotifications = notifications.filter(notification => {
    switch (selectedFilter) {
      case 'unread':
        return !notification.lastShown;
      case 'achievement':
        return notification.type === 'achievement';
      case 'warning':
        return notification.type === 'warning';
      case 'tip':
        return notification.type === 'tip';
      default:
        return true;
    }
  });

  const getNotificationIcon = (type: string) => {
    switch (type) {
      case 'achievement': return <Check size={20} color="#10B981" />;
      case 'milestone': return <Calendar size={20} color="#3B82F6" />;
      case 'warning': return <AlertTriangle size={20} color="#EF4444" />;
      case 'tip': return <Lightbulb size={20} color="#F59E0B" />;
      case 'reminder': return <Bell size={20} color="#6B7280" />;
      case 'celebration': return <PartyPopper size={20} color="#8B5CF6" />;
      case 'suggestion': return <MessageSquare size={20} color="#06B6D4" />;
      default: return <Info size={20} color="#6B7280" />;
    }
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'critical': return '#DC2626';
      case 'high': return '#EF4444';
      case 'medium': return '#F59E0B';
      case 'low': return '#6B7280';
      default: return '#6B7280';
    }
  };

  const getCategoryColor = (category: string) => {
    switch (category) {
      case 'wealth': return '#10B981';
      case 'health': return '#EF4444';
      case 'social': return '#3B82F6';
      case 'career': return '#F59E0B';
      case 'family': return '#8B5CF6';
      case 'education': return '#06B6D4';
      case 'general': return '#6B7280';
      default: return '#6B7280';
    }
  };

  const handleNotificationPress = (notification: SmartNotification) => {
    buttonPress();
    haptic('light');
    showNotification(notification);
  };

  const handleClearAll = () => {
    buttonPress();
    haptic('medium');
    clearHistory();
  };

  const handleFilterChange = (filter: typeof selectedFilter) => {
    buttonPress();
    haptic('light');
    setSelectedFilter(filter);
  };

  const handlePreferenceToggle = (key: keyof typeof notificationPreferences) => {
    buttonPress();
    haptic('light');
    setNotificationPreferences(prev => ({
      ...prev,
      [key]: !prev[key],
    }));
  };

  if (!visible) return null;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="none"
      onRequestClose={onClose}
    >
      <Animated.View style={[styles.overlay, { opacity: fadeAnim }]}>
        <BlurView intensity={20} style={styles.blur}>
          <Animated.View
            style={[
              styles.container,
              { transform: [{ translateY: slideAnim }] },
            ]}
          >
            <LinearGradient
              colors={gameState.settings.darkMode ? ['#1F2937', '#111827'] : ['#F8FAFC', '#FFFFFF']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.gradient}
            >
              {/* Header */}
              <View style={styles.header}>
                <View style={styles.headerLeft}>
                  <Bell size={24} color="#3B82F6" />
                  <Text style={[styles.headerTitle, gameState.settings.darkMode && styles.headerTitleDark]}>
                    Smart Notifications
                  </Text>
                </View>
                <View style={styles.headerActions}>
                  <TouchableOpacity
                    onPress={() => {
                      buttonPress();
                      haptic('light');
                      setShowSettings(!showSettings);
                    }}
                    style={styles.headerButton}
                  >
                    <Settings size={20} color={gameState.settings.darkMode ? '#FFFFFF' : '#374151'} />
                  </TouchableOpacity>
                  <TouchableOpacity
                    onPress={() => {
                      buttonPress();
                      haptic('light');
                      onClose();
                    }}
                    style={styles.headerButton}
                  >
                    <X size={20} color={gameState.settings.darkMode ? '#FFFFFF' : '#374151'} />
                  </TouchableOpacity>
                </View>
              </View>

              {/* Settings Panel */}
              {showSettings && (
                <View style={[styles.settingsPanel, gameState.settings.darkMode && styles.settingsPanelDark]}>
                  <Text style={[styles.settingsTitle, gameState.settings.darkMode && styles.settingsTitleDark]}>
                    Notification Preferences
                  </Text>
                  
                  <View style={styles.settingsList}>
                    <TouchableOpacity
                      onPress={() => handlePreferenceToggle('showTips')}
                      style={styles.settingItem}
                    >
                      <View style={styles.settingInfo}>
                        <Lightbulb size={20} color="#F59E0B" />
                        <Text style={[styles.settingLabel, gameState.settings.darkMode && styles.settingLabelDark]}>
                          Show Tips
                        </Text>
                      </View>
                      {notificationPreferences.showTips ? (
                        <Check size={20} color="#10B981" />
                      ) : (
                        <X size={20} color="#6B7280" />
                      )}
                    </TouchableOpacity>

                    <TouchableOpacity
                      onPress={() => handlePreferenceToggle('showMilestones')}
                      style={styles.settingItem}
                    >
                      <View style={styles.settingInfo}>
                        <Calendar size={20} color="#3B82F6" />
                        <Text style={[styles.settingLabel, gameState.settings.darkMode && styles.settingLabelDark]}>
                          Show Milestones
                        </Text>
                      </View>
                      {notificationPreferences.showMilestones ? (
                        <Check size={20} color="#10B981" />
                      ) : (
                        <X size={20} color="#6B7280" />
                      )}
                    </TouchableOpacity>

                    <TouchableOpacity
                      onPress={() => handlePreferenceToggle('showWarnings')}
                      style={styles.settingItem}
                    >
                      <View style={styles.settingInfo}>
                        <AlertTriangle size={20} color="#EF4444" />
                        <Text style={[styles.settingLabel, gameState.settings.darkMode && styles.settingLabelDark]}>
                          Show Warnings
                        </Text>
                      </View>
                      {notificationPreferences.showWarnings ? (
                        <Check size={20} color="#10B981" />
                      ) : (
                        <X size={20} color="#6B7280" />
                      )}
                    </TouchableOpacity>

                    <TouchableOpacity
                      onPress={() => handlePreferenceToggle('showSuggestions')}
                      style={styles.settingItem}
                    >
                      <View style={styles.settingInfo}>
                        <MessageSquare size={20} color="#06B6D4" />
                        <Text style={[styles.settingLabel, gameState.settings.darkMode && styles.settingLabelDark]}>
                          Show Suggestions
                        </Text>
                      </View>
                      {notificationPreferences.showSuggestions ? (
                        <Check size={20} color="#10B981" />
                      ) : (
                        <X size={20} color="#6B7280" />
                      )}
                    </TouchableOpacity>
                  </View>

                  <TouchableOpacity
                    onPress={handleClearAll}
                    style={styles.clearButton}
                  >
                    <Trash2 size={16} color="#EF4444" />
                    <Text style={styles.clearButtonText}>Clear All History</Text>
                  </TouchableOpacity>
                </View>
              )}

              {/* Filters */}
              <View style={styles.filtersContainer}>
                <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                  <View style={styles.filters}>
                    {[
                      { key: 'all', label: 'All' },
                      { key: 'unread', label: 'Unread' },
                      { key: 'achievement', label: 'Achievements' },
                      { key: 'warning', label: 'Warnings' },
                      { key: 'tip', label: 'Tips' },
                    ].map(filter => (
                      <TouchableOpacity
                        key={filter.key}
                        onPress={() => handleFilterChange(filter.key as any)}
                        style={[
                          styles.filterButton,
                          selectedFilter === filter.key && styles.filterButtonActive,
                        ]}
                      >
                        <Text style={[
                          styles.filterButtonText,
                          selectedFilter === filter.key && styles.filterButtonTextActive,
                        ]}>
                          {filter.label}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </ScrollView>
              </View>

              {/* Notifications List */}
              <ScrollView style={styles.notificationsList} showsVerticalScrollIndicator={false}>
                {filteredNotifications.length === 0 ? (
                  <View style={styles.emptyState}>
                    <BellOff size={48} color="#6B7280" />
                    <Text style={[styles.emptyStateText, gameState.settings.darkMode && styles.emptyStateTextDark]}>
                      No notifications
                    </Text>
                    <Text style={[styles.emptyStateSubtext, gameState.settings.darkMode && styles.emptyStateSubtextDark]}>
                      {selectedFilter === 'all' 
                        ? 'You\'re all caught up!' 
                        : `No ${selectedFilter} notifications`}
                    </Text>
                  </View>
                ) : (
                  filteredNotifications.map(notification => (
                    <TouchableOpacity
                      key={notification.id}
                      onPress={() => handleNotificationPress(notification)}
                      style={[styles.notificationCard, gameState.settings.darkMode && styles.notificationCardDark]}
                      activeOpacity={0.8}
                    >
                      <View style={styles.notificationHeader}>
                        <View style={styles.notificationIcon}>
                          {getNotificationIcon(notification.type)}
                        </View>
                        <View style={styles.notificationInfo}>
                          <Text style={[styles.notificationTitle, gameState.settings.darkMode && styles.notificationTitleDark]}>
                            {notification.title}
                          </Text>
                          <Text style={[styles.notificationMessage, gameState.settings.darkMode && styles.notificationMessageDark]}>
                            {notification.message}
                          </Text>
                        </View>
                        <View style={styles.notificationMeta}>
                          <View style={[
                            styles.priorityIndicator,
                            { backgroundColor: getPriorityColor(notification.priority) }
                          ]} />
                          <View style={[
                            styles.categoryIndicator,
                            { backgroundColor: getCategoryColor(notification.category) }
                          ]} />
                        </View>
                      </View>
                      
                      <View style={styles.notificationFooter}>
                        <Text style={[styles.notificationCategory, gameState.settings.darkMode && styles.notificationCategoryDark]}>
                          {notification.category}
                        </Text>
                        <Text style={[styles.notificationPriority, gameState.settings.darkMode && styles.notificationPriorityDark]}>
                          {notification.priority}
                        </Text>
                      </View>
                    </TouchableOpacity>
                  ))
                )}
              </ScrollView>
            </LinearGradient>
          </Animated.View>
        </BlurView>
      </Animated.View>
    </Modal>
  );
}

// Helper functions
const getTimeOfDay = (): 'morning' | 'afternoon' | 'evening' | 'night' => {
  const hour = new Date().getHours();
  if (hour >= 6 && hour < 12) return 'morning';
  if (hour >= 12 && hour < 17) return 'afternoon';
  if (hour >= 17 && hour < 22) return 'evening';
  return 'night';
};

const getSeason = (): 'spring' | 'summer' | 'autumn' | 'winter' => {
  const month = new Date().getMonth();
  if (month >= 2 && month < 5) return 'spring';
  if (month >= 5 && month < 8) return 'summer';
  if (month >= 8 && month < 11) return 'autumn';
  return 'winter';
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
  },
  blur: {
    flex: 1,
  },
  container: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: height * 0.8,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    overflow: 'hidden',
  },
  gradient: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 16,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#1F2937',
    marginLeft: 12,
  },
  headerTitleDark: {
    color: '#FFFFFF',
  },
  headerActions: {
    flexDirection: 'row',
    gap: 8,
  },
  headerButton: {
    padding: 8,
    backgroundColor: 'rgba(59, 130, 246, 0.1)',
    borderRadius: 8,
  },
  settingsPanel: {
    marginHorizontal: 20,
    marginBottom: 16,
    backgroundColor: '#F9FAFB',
    borderRadius: 12,
    padding: 16,
  },
  settingsPanelDark: {
    backgroundColor: '#374151',
  },
  settingsTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 12,
  },
  settingsTitleDark: {
    color: '#D1D5DB',
  },
  settingsList: {
    gap: 8,
  },
  settingItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
  },
  settingInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  settingLabel: {
    fontSize: 14,
    color: '#374151',
  },
  settingLabelDark: {
    color: '#D1D5DB',
  },
  clearButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginTop: 12,
    paddingVertical: 8,
    backgroundColor: 'rgba(239, 68, 68, 0.1)',
    borderRadius: 8,
  },
  clearButtonText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#EF4444',
  },
  filtersContainer: {
    paddingHorizontal: 20,
    marginBottom: 16,
  },
  filters: {
    flexDirection: 'row',
    gap: 8,
  },
  filterButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: '#F3F4F6',
    borderRadius: 20,
  },
  filterButtonActive: {
    backgroundColor: '#3B82F6',
  },
  filterButtonText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#374151',
  },
  filterButtonTextActive: {
    color: '#FFFFFF',
  },
  notificationsList: {
    flex: 1,
    paddingHorizontal: 20,
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
  },
  emptyStateText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#374151',
    marginTop: 16,
  },
  emptyStateTextDark: {
    color: '#D1D5DB',
  },
  emptyStateSubtext: {
    fontSize: 14,
    color: '#6B7280',
    marginTop: 4,
    textAlign: 'center',
  },
  emptyStateSubtextDark: {
    color: '#9CA3AF',
  },
  notificationCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  notificationCardDark: {
    backgroundColor: '#374151',
  },
  notificationHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 8,
  },
  notificationIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(59, 130, 246, 0.1)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  notificationInfo: {
    flex: 1,
  },
  notificationTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1F2937',
    marginBottom: 4,
  },
  notificationTitleDark: {
    color: '#FFFFFF',
  },
  notificationMessage: {
    fontSize: 14,
    color: '#6B7280',
    lineHeight: 20,
  },
  notificationMessageDark: {
    color: '#9CA3AF',
  },
  notificationMeta: {
    alignItems: 'center',
    gap: 4,
  },
  priorityIndicator: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  categoryIndicator: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  notificationFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  notificationCategory: {
    fontSize: 12,
    fontWeight: '500',
    color: '#6B7280',
    textTransform: 'capitalize',
  },
  notificationCategoryDark: {
    color: '#9CA3AF',
  },
  notificationPriority: {
    fontSize: 12,
    fontWeight: '500',
    color: '#6B7280',
    textTransform: 'capitalize',
  },
  notificationPriorityDark: {
    color: '#9CA3AF',
  },
});
