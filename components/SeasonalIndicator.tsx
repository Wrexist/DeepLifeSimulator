import React, { useState } from 'react';
import { Platform, View, Text, TouchableOpacity, StyleSheet, Modal } from 'react-native';
import { Leaf, Sun, Snowflake, X, Calendar, Heart, Ghost, Trees, Sparkles, Egg, Flag, Utensils, ShoppingBag } from 'lucide-react-native';
import { useGameSelector, shallowEqual } from '@/contexts/game/useGameSelector';
import { safeSettings } from "@/utils/safeGameState";
import { getCurrentSeason, WEEKS_PER_SEASON } from '@/lib/events/seasonalEvents';
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

  /**
   * Weeks left BEFORE the next season starts.
   *
   * This was `13 - weekInSeason`, which mixes the 0-based index with the
   * `weekInSeason + 1` printed one row above it in the same card: on "Week in
   * Season 8 / 13" it claimed the next season was 6 weeks away when 5 weeks
   * remain (screenshot report, 2026-09-04). The two lines are derived from one
   * number and have to agree.
   */
  const weeksUntilNext = Math.max(0, WEEKS_PER_SEASON - 1 - seasonData.weekInSeason);

  const getSeasonConfig = () => {
    switch (seasonData.season) {
      case 'spring':
        return {
          icon: Leaf,
          color: '#10B981',
          gradient: ['#10B981', '#059669'],
          name: 'Spring',
          nextSeason: 'Summer',
        };
      case 'summer':
        return {
          icon: Sun,
          color: '#F59E0B',
          gradient: ['#F59E0B', '#D97706'],
          name: 'Summer',
          nextSeason: 'Fall',
        };
      case 'fall':
        return {
          icon: Leaf, // Using Leaf for fall (LeafFall doesn't exist in lucide-react-native)
          color: '#EF4444',
          gradient: ['#EF4444', '#DC2626'],
          name: 'Fall',
          nextSeason: 'Winter',
        };
      case 'winter':
        return {
          icon: Snowflake,
          color: '#3B82F6',
          gradient: ['#3B82F6', '#2563EB'],
          name: 'Winter',
          nextSeason: 'Spring',
        };
    }
  };

  const config = getSeasonConfig();
  const SeasonIcon = config.icon;

  const getHolidayInfo = () => {
    if (!seasonData.holiday) return null;
    
    // All eight holidays `getCurrentSeason` can return. Four of them
    // (easter, independence, thanksgiving, blackfriday) were missing, so the
    // lookup fell through to null and the holiday card did not render on those
    // weeks even though the events themselves were firing.
    const holidays = {
      newyear: { name: 'New Year', icon: Sparkles, color: '#3B82F6' },
      valentines: { name: "Valentine's Day", icon: Heart, color: '#EC4899' },
      easter: { name: 'Easter', icon: Egg, color: '#A78BFA' },
      independence: { name: 'Independence Day', icon: Flag, color: '#3B82F6' },
      halloween: { name: 'Halloween', icon: Ghost, color: '#F59E0B' },
      thanksgiving: { name: 'Thanksgiving', icon: Utensils, color: '#D97706' },
      blackfriday: { name: 'Black Friday', icon: ShoppingBag, color: '#94A3B8' },
      christmas: { name: 'Christmas', icon: Trees, color: '#10B981' },
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
        // The modal's close button was labelled; the button that OPENS it was
        // not, so a screen reader announced the HUD's season control as an
        // unnamed button. It is also what a UI capture has to find it by.
        accessibilityRole="button"
        accessibilityLabel={holiday ? `${holiday.name}, ${config.name} season` : `${config.name} season`}
        accessibilityHint="Shows the season, the week within it and any active holiday"
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
                <View style={[styles.holidaySection, settings.darkMode && styles.holidaySectionDark]}>
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
                      {seasonData.weekInSeason + 1} / {WEEKS_PER_SEASON}
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
                      {weeksUntilNext === 0
                        ? `${config.nextSeason} next week`
                        : `${config.nextSeason} in ${weeksUntilNext} week${weeksUntilNext === 1 ? '' : 's'}`}
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
  /**
   * The dark-mode fill this card never had.
   *
   * `holidaySection` was `#F8FAFC` in BOTH modes while `holidayNameDark` is
   * `#F8FAFC` - so in dark mode the holiday's name was white text on a white
   * card and had never once been readable, and the card itself was a glaring
   * light block in an otherwise dark modal (screenshot report, 2026-09-04).
   * A style that overrides the text for dark mode but not the surface under it
   * is the shape to look for.
   */
  holidaySectionDark: {
    backgroundColor: '#334155',
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


