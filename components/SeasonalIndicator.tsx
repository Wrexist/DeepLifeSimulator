import React, { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Modal } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Leaf, Sun, Snowflake, X, Calendar, Heart, Ghost, Tree, Sparkles } from 'lucide-react-native';
import { useGame } from '@/contexts/GameContext';
import { getCurrentSeason } from '@/lib/events/seasonalEvents';
import { isIPad } from '@/utils/scaling';

interface SeasonalIndicatorProps {
  size?: number;
}

export default function SeasonalIndicator({ size = 22 }: SeasonalIndicatorProps) {
  const { gameState } = useGame();
  const [showInfo, setShowInfo] = useState(false);
  const { settings } = gameState;
  const seasonData = getCurrentSeason(gameState.week);

  const getSeasonConfig = () => {
    switch (seasonData.season) {
      case 'spring':
        return {
          icon: Leaf,
          color: '#10B981',
          gradient: ['#10B981', '#059669'],
          name: 'Spring',
          nextSeason: 'Summer',
          weeksUntilNext: 13 - seasonData.weekInSeason,
        };
      case 'summer':
        return {
          icon: Sun,
          color: '#F59E0B',
          gradient: ['#F59E0B', '#D97706'],
          name: 'Summer',
          nextSeason: 'Fall',
          weeksUntilNext: 13 - seasonData.weekInSeason,
        };
      case 'fall':
        return {
          icon: Leaf, // Using Leaf for fall (LeafFall doesn't exist in lucide-react-native)
          color: '#EF4444',
          gradient: ['#EF4444', '#DC2626'],
          name: 'Fall',
          nextSeason: 'Winter',
          weeksUntilNext: 13 - seasonData.weekInSeason,
        };
      case 'winter':
        return {
          icon: Snowflake,
          color: '#3B82F6',
          gradient: ['#3B82F6', '#2563EB'],
          name: 'Winter',
          nextSeason: 'Spring',
          weeksUntilNext: 13 - seasonData.weekInSeason,
        };
    }
  };

  const config = getSeasonConfig();
  const SeasonIcon = config.icon;

  const getHolidayInfo = () => {
    if (!seasonData.holiday) return null;
    
    const holidays = {
      valentines: { name: "Valentine's Day", icon: Heart, color: '#EC4899' },
      halloween: { name: 'Halloween', icon: Ghost, color: '#F59E0B' },
      christmas: { name: 'Christmas', icon: Tree, color: '#10B981' },
      newyear: { name: 'New Year', icon: Sparkles, color: '#3B82F6' },
    };
    
    return holidays[seasonData.holiday];
  };

  const holiday = getHolidayInfo();
  const HolidayIcon = holiday?.icon;

  const hasHoliday = !!holiday;
  // Match iconButton dimensions from TopStatsBar
  const containerSize = isIPad() ? 70 : 50;
  const borderRadius = containerSize / 2;
  const iconSize = size;

  return (
    <>
      <TouchableOpacity
        style={[styles.container, { width: containerSize, height: containerSize, borderRadius }]}
        onPress={() => setShowInfo(true)}
        activeOpacity={0.7}
      >
        <LinearGradient
          colors={config.gradient}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.gradient}
        >
          {holiday && HolidayIcon ? (
            <HolidayIcon size={iconSize} color="#FFFFFF" />
          ) : (
            <SeasonIcon size={iconSize} color="#FFFFFF" />
          )}
        </LinearGradient>
      </TouchableOpacity>

      <Modal
        visible={showInfo}
        transparent
        animationType="fade"
        onRequestClose={() => setShowInfo(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[
            styles.modalContainer,
            settings.darkMode && styles.modalContainerDark
          ]}>
            <LinearGradient
              colors={config.gradient}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.modalHeader}
            >
              <View style={styles.modalHeaderContent}>
                <SeasonIcon size={32} color="#FFFFFF" />
                <Text style={styles.modalTitle}>{config.name} Season</Text>
              </View>
              <TouchableOpacity
                style={styles.closeButton}
                onPress={() => setShowInfo(false)}
              >
                <X size={24} color="#FFFFFF" />
              </TouchableOpacity>
            </LinearGradient>

            <View style={[
              styles.modalContent,
              settings.darkMode && styles.modalContentDark
            ]}>
              {holiday && HolidayIcon && (
                <View style={styles.holidaySection}>
                  <HolidayIcon size={48} color={holiday.color} style={{ marginBottom: 8 }} />
                  <Text style={[
                    styles.holidayName,
                    settings.darkMode && styles.holidayNameDark
                  ]}>
                    {holiday.name}
                  </Text>
                  <Text style={[
                    styles.holidayDescription,
                    settings.darkMode && styles.holidayDescriptionDark
                  ]}>
                    Special holiday events are active this week!
                  </Text>
                </View>
              )}

              <View style={styles.infoSection}>
                <View style={styles.infoRow}>
                  <Calendar size={20} color={config.color} />
                  <View style={styles.infoTextContainer}>
                    <Text style={[
                      styles.infoLabel,
                      settings.darkMode && styles.infoLabelDark
                    ]}>
                      Week in Season
                    </Text>
                    <Text style={[
                      styles.infoValue,
                      settings.darkMode && styles.infoValueDark
                    ]}>
                      {seasonData.weekInSeason + 1} / 13
                    </Text>
                  </View>
                </View>

                <View style={styles.infoRow}>
                  <SeasonIcon size={20} color={config.color} />
                  <View style={styles.infoTextContainer}>
                    <Text style={[
                      styles.infoLabel,
                      settings.darkMode && styles.infoLabelDark
                    ]}>
                      Next Season
                    </Text>
                    <Text style={[
                      styles.infoValue,
                      settings.darkMode && styles.infoValueDark
                    ]}>
                      {config.nextSeason} in {config.weeksUntilNext} weeks
                    </Text>
                  </View>
                </View>
              </View>

              <View style={[
                styles.tipSection,
                settings.darkMode && styles.tipSectionDark
              ]}>
                <Text style={[
                  styles.tipTitle,
                  settings.darkMode && styles.tipTitleDark
                ]}>
                  Seasonal Events
                </Text>
                <Text style={[
                  styles.tipText,
                  settings.darkMode && styles.tipTextDark
                ]}>
                  Special seasonal events occur 1-2 times per season. Keep an eye out for unique opportunities and rewards!
                </Text>
              </View>
            </View>
          </View>
        </View>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    overflow: 'hidden',
  },
  gradient: {
    width: '100%',
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalContainer: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    width: '100%',
    maxWidth: 400,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.3,
    shadowRadius: 16,
    elevation: 12,
  },
  modalContainerDark: {
    backgroundColor: '#1F2937',
  },
  modalHeader: {
    padding: 20,
    paddingTop: 30,
  },
  modalHeaderContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  modalTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#FFFFFF',
  },
  closeButton: {
    position: 'absolute',
    top: 20,
    right: 20,
    padding: 4,
  },
  modalContent: {
    padding: 20,
  },
  modalContentDark: {
    backgroundColor: '#1F2937',
  },
  holidaySection: {
    alignItems: 'center',
    marginBottom: 24,
    padding: 16,
    backgroundColor: '#F9FAFB',
    borderRadius: 12,
  },
  holidayName: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#1F2937',
    marginBottom: 4,
  },
  holidayNameDark: {
    color: '#F9FAFB',
  },
  holidayDescription: {
    fontSize: 14,
    color: '#6B7280',
    textAlign: 'center',
  },
  holidayDescriptionDark: {
    color: '#9CA3AF',
  },
  infoSection: {
    gap: 16,
    marginBottom: 20,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  infoTextContainer: {
    flex: 1,
  },
  infoLabel: {
    fontSize: 14,
    color: '#6B7280',
    marginBottom: 2,
  },
  infoLabelDark: {
    color: '#9CA3AF',
  },
  infoValue: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1F2937',
  },
  infoValueDark: {
    color: '#F9FAFB',
  },
  tipSection: {
    backgroundColor: '#F3F4F6',
    borderRadius: 12,
    padding: 16,
  },
  tipSectionDark: {
    backgroundColor: '#374151',
  },
  tipTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1F2937',
    marginBottom: 8,
  },
  tipTitleDark: {
    color: '#F9FAFB',
  },
  tipText: {
    fontSize: 14,
    color: '#6B7280',
    lineHeight: 20,
  },
  tipTextDark: {
    color: '#D1D5DB',
  },
});

