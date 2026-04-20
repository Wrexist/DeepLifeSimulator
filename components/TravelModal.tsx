/**
 * Travel Modal Component
 * 
 * Quick access travel widget that provides fast travel options
 * and links to the full TravelApp for more features
 */
import React, { useState, useMemo } from 'react';
import { View, Text, StyleSheet, Modal, TouchableOpacity, ScrollView, Alert } from 'react-native';
import LinearGradientFallback from '@/components/fallbacks/LinearGradientFallback';
const LinearGradient = LinearGradientFallback;
import { Plane, X, MapPin, Heart, Zap, Battery, ChevronRight, Globe, Briefcase, Clock, Star } from 'lucide-react-native';
import { useGame } from '@/contexts/GameContext';
import { DESTINATIONS, TravelDestination } from '@/lib/travel/destinations';
import { responsivePadding, responsiveFontSize, responsiveSpacing, responsiveBorderRadius, scale, fontScale } from '@/utils/scaling';

interface TravelModalProps {
  visible: boolean;
  onClose: () => void;
  onOpenFullApp?: () => void;
}

export default function TravelModal({ visible, onClose, onOpenFullApp }: TravelModalProps) {
  const { gameState, travelTo, saveGame } = useGame();
  const { settings } = gameState;
  const [selectedDestination, setSelectedDestination] = useState<TravelDestination | null>(null);

  // Check if currently traveling
  const isOnTrip = gameState.travel?.currentTrip !== undefined;
  const currentTrip = gameState.travel?.currentTrip;

  // Get visited destinations
  const visitedCount = (gameState.travel?.visitedDestinations || []).length;
  const totalDestinations = DESTINATIONS.length;

  // Sort destinations - show affordable ones first
  const sortedDestinations = useMemo(() => {
    return [...DESTINATIONS].sort((a, b) => {
      const aAffordable = gameState.stats.money >= a.cost ? 1 : 0;
      const bAffordable = gameState.stats.money >= b.cost ? 1 : 0;
      if (aAffordable !== bAffordable) return bAffordable - aAffordable;
      return a.cost - b.cost;
    }).slice(0, 6); // Show only top 6 for quick access
  }, [gameState.stats.money]);

  const handleTravel = (destination: TravelDestination) => {
    if (isOnTrip) {
      Alert.alert('Already Traveling', 'You are currently on a trip. Return home first before planning another trip.');
      return;
    }

    if (!gameState.travel?.passportOwned) {
      Alert.alert('Passport Required', 'You need a passport to travel internationally. Visit the full Travel app to purchase one.');
      return;
    }

    if (gameState.stats.money < destination.cost) {
      Alert.alert('Insufficient Funds', `You need $${destination.cost.toLocaleString()} to travel to ${destination.name}.`);
      return;
    }

    Alert.alert(
      `Travel to ${destination.name}`,
      `Are you sure you want to spend $${destination.cost.toLocaleString()} to visit ${destination.name}?\n\nBenefits:\n+${destination.benefits.happiness} Happiness\n+${destination.benefits.health} Health\n+${destination.benefits.energy} Energy`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Let\'s Go! âœˆï¸',
          onPress: () => {
            const result = travelTo(destination.id);
            if (result.success) {
              saveGame();
              Alert.alert('Bon Voyage! ðŸŒ', result.message);
              onClose();
            } else {
              Alert.alert('Error', result.message);
            }
          },
        },
      ]
    );
  };

  const getDestinationStatus = (dest: TravelDestination) => {
    const visited = (gameState.travel?.visitedDestinations || []).includes(dest.id);
    const affordable = gameState.stats.money >= dest.cost;
    return { visited, affordable };
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={[styles.container, settings.darkMode && styles.containerDark]}>
          {/* Header */}
          <View style={styles.header}>
            <View style={styles.headerContent}>
              <Plane size={24} color={settings.darkMode ? '#60A5FA' : '#3B82F6'} />
              <Text style={[styles.title, settings.darkMode && styles.textDark]}>Quick Travel</Text>
            </View>
            <TouchableOpacity 
              onPress={onClose} 
              style={styles.closeButton}
              accessibilityLabel="Close travel modal"
              accessibilityRole="button"
            >
              <X size={24} color={settings.darkMode ? '#fff' : '#000'} />
            </TouchableOpacity>
          </View>

          {/* Travel Stats Bar */}
          <View style={[styles.statsBar, settings.darkMode && styles.statsBarDark]}>
            <View style={styles.statItem}>
              <Globe size={16} color="#8B5CF6" />
              <Text style={[styles.statText, settings.darkMode && styles.textMuted]}>
                {visitedCount}/{totalDestinations} Visited
              </Text>
            </View>
            <View style={styles.statItem}>
              <Text style={styles.moneyText}>${gameState.stats.money.toLocaleString()}</Text>
            </View>
            {gameState.travel?.passportOwned ? (
              <View style={styles.passportBadge}>
                <Text style={styles.passportText}>âœ… Passport</Text>
              </View>
            ) : (
              <View style={[styles.passportBadge, styles.passportBadgeLocked]}>
                <Text style={styles.passportTextLocked}>âŒ No Passport</Text>
              </View>
            )}
          </View>

          {/* Current Trip Warning */}
          {isOnTrip && currentTrip && (
            <View style={styles.tripWarning}>
              <LinearGradient
                colors={['#F59E0B', '#D97706']}
                style={styles.tripWarningGradient}
              >
                <Clock size={16} color="#FFF" />
                <Text style={styles.tripWarningText}>
                  Currently traveling! Return on week {currentTrip.returnWeek}
                </Text>
              </LinearGradient>
            </View>
          )}

          <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
            <Text style={[styles.subtitle, settings.darkMode && styles.textMuted]}>
              Quick destinations â€¢ Tap for instant booking
            </Text>

            {sortedDestinations.map((dest) => {
              const { visited, affordable } = getDestinationStatus(dest);
              
              return (
                <TouchableOpacity
                  key={dest.id}
                  style={[
                    styles.card, 
                    settings.darkMode && styles.cardDark,
                    !affordable && styles.cardDisabled,
                  ]}
                  onPress={() => handleTravel(dest)}
                  disabled={!affordable || isOnTrip}
                  accessibilityLabel={`Travel to ${dest.name}, ${dest.country}`}
                  accessibilityHint={`Cost $${dest.cost}. Double tap to travel.`}
                  accessibilityRole="button"
                >
                  <View style={styles.cardContent}>
                    <View style={styles.cardHeader}>
                      <View style={styles.destInfo}>
                        <View style={styles.destNameRow}>
                          <Text style={[styles.destName, settings.darkMode && styles.textDark]}>
                            {dest.name}
                          </Text>
                          {visited && (
                            <Star size={14} color="#F59E0B" fill="#F59E0B" />
                          )}
                        </View>
                        <View style={styles.locationRow}>
                          <MapPin size={12} color="#6B7280" />
                          <Text style={styles.destCountry}>{dest.country}</Text>
                        </View>
                      </View>
                      <View style={[styles.priceTag, !affordable && styles.priceTagDisabled]}>
                        <Text style={styles.priceText}>
                          ${dest.cost.toLocaleString()}
                        </Text>
                      </View>
                    </View>

                    <View style={styles.benefitsRow}>
                      <View style={styles.benefit}>
                        <Heart size={12} color="#EF4444" />
                        <Text style={styles.benefitText}>+{dest.benefits.happiness}</Text>
                      </View>
                      <View style={styles.benefit}>
                        <Battery size={12} color="#10B981" />
                        <Text style={styles.benefitText}>+{dest.benefits.health}</Text>
                      </View>
                      <View style={styles.benefit}>
                        <Zap size={12} color="#F59E0B" />
                        <Text style={styles.benefitText}>+{dest.benefits.energy}</Text>
                      </View>
                    </View>
                  </View>
                </TouchableOpacity>
              );
            })}

            {/* Open Full App Button */}
            {onOpenFullApp && (
              <TouchableOpacity
                style={[styles.fullAppButton, settings.darkMode && styles.fullAppButtonDark]}
                onPress={() => {
                  onClose();
                  onOpenFullApp();
                }}
              >
                <View style={styles.fullAppContent}>
                  <View>
                    <Text style={[styles.fullAppTitle, settings.darkMode && styles.textDark]}>
                      Open Travel App
                    </Text>
                    <Text style={[styles.fullAppSubtitle, settings.darkMode && styles.textMuted]}>
                      Business opportunities, trip history & more
                    </Text>
                  </View>
                  <ChevronRight size={24} color={settings.darkMode ? '#60A5FA' : '#3B82F6'} />
                </View>
              </TouchableOpacity>
            )}

            {/* Tips */}
            <View style={[styles.tipsCard, settings.darkMode && styles.tipsCardDark]}>
              <Text style={styles.tipsTitle}>ðŸ’¡ Travel Tips</Text>
              <Text style={[styles.tipText, settings.darkMode && styles.textMuted]}>
                â€¢ Travel boosts happiness, health, and energy
              </Text>
              <Text style={[styles.tipText, settings.darkMode && styles.textMuted]}>
                â€¢ Visit all destinations to unlock achievements
              </Text>
              <Text style={[styles.tipText, settings.darkMode && styles.textMuted]}>
                â€¢ Some destinations have business opportunities
              </Text>
            </View>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: scale(20),
  },
  container: {
    width: '100%',
    maxHeight: '85%',
    backgroundColor: '#fff',
    borderRadius: scale(20),
    overflow: 'hidden',
  },
  containerDark: {
    backgroundColor: '#1F2937',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: scale(16),
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0,0,0,0.1)',
  },
  headerContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  title: {
    fontSize: fontScale(20),
    fontWeight: 'bold',
    color: '#111827',
    marginLeft: scale(10),
  },
  textDark: {
    color: '#F9FAFB',
  },
  textMuted: {
    color: '#9CA3AF',
  },
  closeButton: {
    padding: scale(4),
  },
  statsBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: scale(16),
    paddingVertical: scale(10),
    backgroundColor: '#F3F4F6',
  },
  statsBarDark: {
    backgroundColor: '#374151',
  },
  statItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: scale(4),
  },
  statText: {
    fontSize: fontScale(12),
    color: '#6B7280',
    fontWeight: '500',
  },
  moneyText: {
    fontSize: fontScale(13),
    color: '#10B981',
    fontWeight: 'bold',
  },
  passportBadge: {
    backgroundColor: '#D1FAE5',
    paddingHorizontal: scale(8),
    paddingVertical: scale(4),
    borderRadius: scale(8),
  },
  passportBadgeLocked: {
    backgroundColor: '#FEE2E2',
  },
  passportText: {
    fontSize: fontScale(11),
    color: '#059669',
    fontWeight: '600',
  },
  passportTextLocked: {
    fontSize: fontScale(11),
    color: '#DC2626',
    fontWeight: '600',
  },
  tripWarning: {
    marginHorizontal: scale(16),
    marginTop: scale(12),
    borderRadius: scale(10),
    overflow: 'hidden',
  },
  tripWarningGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: scale(10),
    gap: scale(8),
  },
  tripWarningText: {
    color: '#FFF',
    fontSize: fontScale(13),
    fontWeight: '600',
  },
  content: {
    padding: scale(16),
  },
  subtitle: {
    fontSize: fontScale(14),
    color: '#6B7280',
    marginBottom: scale(12),
  },
  card: {
    marginBottom: scale(10),
    borderRadius: scale(12),
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.05)',
    backgroundColor: '#FAFAFA',
  },
  cardDark: {
    borderColor: 'rgba(255,255,255,0.1)',
    backgroundColor: '#374151',
  },
  cardDisabled: {
    opacity: 0.5,
  },
  cardContent: {
    padding: scale(12),
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: scale(8),
  },
  destInfo: {
    flex: 1,
  },
  destNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: scale(6),
  },
  destName: {
    fontSize: fontScale(15),
    fontWeight: '600',
    color: '#111827',
  },
  locationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: scale(2),
    gap: scale(4),
  },
  destCountry: {
    fontSize: fontScale(12),
    color: '#6B7280',
  },
  priceTag: {
    backgroundColor: '#10B981',
    paddingHorizontal: scale(10),
    paddingVertical: scale(5),
    borderRadius: scale(8),
  },
  priceTagDisabled: {
    backgroundColor: '#6B7280',
  },
  priceText: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: fontScale(12),
  },
  benefitsRow: {
    flexDirection: 'row',
    gap: scale(10),
  },
  benefit: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: scale(4),
  },
  benefitText: {
    fontSize: fontScale(12),
    fontWeight: '600',
    color: '#374151',
  },
  fullAppButton: {
    marginTop: scale(8),
    marginBottom: scale(16),
    backgroundColor: '#EBF5FF',
    borderRadius: scale(12),
    borderWidth: 1,
    borderColor: '#BFDBFE',
  },
  fullAppButtonDark: {
    backgroundColor: '#1E3A5F',
    borderColor: '#3B82F6',
  },
  fullAppContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: scale(14),
  },
  fullAppTitle: {
    fontSize: fontScale(15),
    fontWeight: '600',
    color: '#1D4ED8',
  },
  fullAppSubtitle: {
    fontSize: fontScale(12),
    color: '#6B7280',
    marginTop: scale(2),
  },
  tipsCard: {
    backgroundColor: '#FFFBEB',
    borderRadius: scale(12),
    padding: scale(14),
    borderWidth: 1,
    borderColor: '#FDE68A',
    marginBottom: scale(16),
  },
  tipsCardDark: {
    backgroundColor: '#422006',
    borderColor: '#854D0E',
  },
  tipsTitle: {
    fontSize: fontScale(14),
    fontWeight: '600',
    color: '#92400E',
    marginBottom: scale(8),
  },
  tipText: {
    fontSize: fontScale(12),
    color: '#78350F',
    lineHeight: fontScale(18),
  },
});

