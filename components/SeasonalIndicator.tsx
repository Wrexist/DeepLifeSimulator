import React, { useState } from 'react';
import { Platform, View, Text, TouchableOpacity, StyleSheet, Modal } from 'react-native';
import { Leaf, Sun, Snowflake, X, Calendar, Heart, Ghost, Trees, Sparkles } from 'lucide-react-native';
import { useGameSelector, shallowEqual } from '@/contexts/game/useGameSelector';
import { safeSettings } from "@/utils/safeGameState";
import { getCurrentSeason } from '@/lib/events/seasonalEvents';
import { isIPad, touchTargets, fontScale } from '@/utils/scaling';
import { tier1Title, tier2 } from '@/lib/config/hierarchy';

interface SeasonalIndicatorProps {
  size?: number;
}

export default function SeasonalIndicator({ size = 22 }: SeasonalIndicatorProps) {
  const settings = useGameSelector((s) => safeSettings(s), shallowEqual);
  const weeksLived = useGameSelector((s) => s.weeksLived);
  const [showInfo, setShowInfo] = useState(false);
  const seasonData = getCurrentSeason(weeksLived || 0);

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
      christmas: { name: 'Christmas', icon: Trees, color: '#10B981' },
      newyear: { name: 'New Year', icon: Sparkles, color: '#3B82F6' },
    };
    
    return holidays[seasonData.holiday as keyof typeof holidays] || null;
  };

  const holiday = getHolidayInfo();
  const HolidayIcon = holiday?.icon;

  const _hasHoliday = !!holiday; // Unused but kept for potential future use
  // Match iconButton dimensions from TopStatsBar
  // Exactly the HUD icon-button footprint. A hard-coded 50 inside the 44pt
  // clipped wrapper drew a disc larger than its clip, so the glyph - centred
  // on the 50 box - sat off-centre in the 44 circle the player saw.
  const containerSize = isIPad() ? touchTargets.large : touchTargets.minimum;
  const borderRadius = containerSize / 2;
  const iconSize = size;

  return (
    <>
      <TouchableOpacity
        style={[styles.container, { width: containerSize, height: containerSize, borderRadius }]}
        onPress={() => setShowInfo(true)}
        activeOpacity={0.7}
      >
        {/* Neutral disc, season colour on the glyph. The saturated gradient
            disc was one more filled circle competing with the HUD's primary
            action for a piece of information the player cannot act on. */}
        <View style={[styles.gradient, styles.disc]}>
          {holiday && HolidayIcon ? (
            <HolidayIcon size={iconSize} color={holiday.color} />
          ) : (
            <SeasonIcon size={iconSize} color={config.color} />
          )}
        </View>
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
            <View style={[styles.modalHeader, { backgroundColor: config.color }]}>
              <View style={styles.modalHeaderContent}>
                <SeasonIcon size={32} color="#FFFFFF" />
                <Text style={styles.modalTitle}>{config.name} Season</Text>
              </View>
              <TouchableOpacity
                style={styles.closeButton}
                onPress={() => setShowInfo(false)}
                hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
                accessibilityRole="button"
                accessibilityLabel="Close"
              >
                <X size={24} color="#FFFFFF" />
              </TouchableOpacity>
            </View>

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
  disc: {
    backgroundColor: 'rgba(30, 41, 59, 0.92)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.14)',
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
  modalContainerDark: {
    backgroundColor: '#1E293B',
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
    ...tier1Title,
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
    backgroundColor: '#1E293B',
  },
  holidaySection: {
    alignItems: 'center',
    marginBottom: 24,
    padding: 16,
    backgroundColor: '#F8FAFC',
    borderRadius: 12,
  },
  holidayName: {
    ...tier2,
    color: '#1E293B',
    marginBottom: 4,
  },
  holidayNameDark: {
    color: '#F8FAFC',
  },
  holidayDescription: {
    fontSize: fontScale(14),
    color: '#64748B',
    textAlign: 'center',
  },
  holidayDescriptionDark: {
    color: '#94A3B8',
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
    fontSize: fontScale(14),
    color: '#64748B',
    marginBottom: 2,
  },
  infoLabelDark: {
    color: '#94A3B8',
  },
  infoValue: {
    fontSize: fontScale(16),
    fontWeight: '600',
    color: '#1E293B',
  },
  infoValueDark: {
    color: '#F8FAFC',
  },
  tipSection: {
    backgroundColor: '#F1F5F9',
    borderRadius: 12,
    padding: 16,
  },
  tipSectionDark: {
    backgroundColor: '#334155',
  },
  tipTitle: {
    ...tier2,
    color: '#1E293B',
    marginBottom: 8,
  },
  tipTitleDark: {
    color: '#F8FAFC',
  },
  tipText: {
    fontSize: fontScale(14),
    color: '#64748B',
    lineHeight: fontScale(20),
  },
  tipTextDark: {
    color: '#CBD5E1',
  },
});


