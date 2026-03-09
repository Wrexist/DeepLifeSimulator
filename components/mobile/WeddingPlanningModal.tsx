import React, { useState, useCallback, useMemo } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Modal, ScrollView, TextInput, Alert, Platform } from 'react-native';
import LinearGradientFallback from '@/components/fallbacks/LinearGradientFallback';
const LinearGradient = LinearGradientFallback;
import { X, Calendar, Users, DollarSign, Check, MapPin, Heart, Sparkles } from 'lucide-react-native';
import { useGame } from '@/contexts/GameContext';
import { planWedding } from '@/contexts/game/actions/DatingActions';
import { updateMoney } from '@/contexts/game/actions/MoneyActions';
import { updateStats } from '@/contexts/game/actions/StatsActions';
import { WEDDING_VENUES, WEDDING_ADDONS, calculateWeddingCost, getVenueTypeColor } from '@/lib/dating/weddingVenues';
import { WeddingPlan } from '@/contexts/game/types';
import { scale, fontScale, responsivePadding, responsiveBorderRadius } from '@/utils/scaling';
import { getShadow } from '@/utils/shadow';

interface WeddingPlanningModalProps {
  visible: boolean;
  onClose: () => void;
  partnerId: string;
  partnerName: string;
}

export default function WeddingPlanningModal({ visible, onClose, partnerId, partnerName }: WeddingPlanningModalProps) {
  const { gameState, setGameState, saveGame } = useGame();
  const { settings } = gameState;
  const isDarkMode = settings?.darkMode ?? false;

  // Debug: Log venues on mount
  React.useEffect(() => {
    if (__DEV__ && visible) {
      console.log('[WeddingPlanningModal] Venues count:', WEDDING_VENUES.length);
    }
  }, [visible]);

  const [selectedVenueId, setSelectedVenueId] = useState<string>('');
  const [guestCount, setGuestCount] = useState<string>('50');
  const [catering, setCatering] = useState(false);
  const [photography, setPhotography] = useState(false);
  const [music, setMusic] = useState(false);
  const [decorations, setDecorations] = useState(false);

  const selectedVenue = useMemo(() => {
    return selectedVenueId ? WEDDING_VENUES.find(v => v.id === selectedVenueId) : null;
  }, [selectedVenueId]);

  const guestCountNum = useMemo(() => {
    const num = parseInt(guestCount, 10);
    return isNaN(num) ? 0 : Math.max(1, Math.min(selectedVenue?.guestCapacity || 300, num));
  }, [guestCount, selectedVenue]);

  const totalCost = useMemo(() => {
    if (!selectedVenueId) return 0;
    const plan: Partial<WeddingPlan> & { venueId: string; guestCount: number } = {
      venueId: selectedVenueId,
      guestCount: guestCountNum,
      catering,
      photography,
      music,
      decorations,
    };
    return calculateWeddingCost(plan);
  }, [selectedVenueId, guestCountNum, catering, photography, music, decorations]);

  const deposit = useMemo(() => {
    return Math.floor(totalCost * 0.25);
  }, [totalCost]);

  const canAfford = gameState.stats.money >= deposit;

  const handlePlanWedding = useCallback(() => {
    if (!selectedVenueId) {
      Alert.alert('Select Venue', 'Please select a wedding venue first.');
      return;
    }

    if (guestCountNum < 1) {
      Alert.alert('Invalid Guest Count', 'Please enter a valid number of guests.');
      return;
    }

    if (!canAfford) {
      Alert.alert('Insufficient Funds', `You need $${deposit.toLocaleString()} for the deposit.`);
      return;
    }

    const result = planWedding(
      gameState,
      setGameState,
      partnerId,
      selectedVenueId,
      guestCountNum,
      4, // 4 weeks from now
      { catering, photography, music, decorations }
    );

    if (result.success) {
      saveGame();
      Alert.alert(
        'Wedding Planned!',
        `Your wedding at ${selectedVenue?.name} is scheduled for 4 weeks from now! Deposit paid: $${deposit.toLocaleString()}`,
        [{ text: 'OK', onPress: onClose }]
      );
    } else {
      Alert.alert('Error', result.message);
    }
  }, [selectedVenueId, guestCountNum, catering, photography, music, decorations, canAfford, deposit, gameState, setGameState, partnerId, selectedVenue, saveGame, onClose]);

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={[styles.container, isDarkMode && styles.containerDark]}>
          {/* Header */}
          <View style={styles.header}>
            <View style={styles.headerContent}>
              <Heart size={scale(24)} color={isDarkMode ? '#F472B6' : '#EC4899'} />
              <Text style={[styles.title, isDarkMode && styles.titleDark]}>Plan Wedding</Text>
            </View>
            <TouchableOpacity 
              onPress={onClose} 
              style={styles.closeButton}
              accessibilityLabel="Close wedding planning modal"
              accessibilityRole="button"
            >
              <X size={scale(24)} color={isDarkMode ? '#fff' : '#000'} />
            </TouchableOpacity>
          </View>

          {/* Stats Bar */}
          <View style={[styles.statsBar, isDarkMode && styles.statsBarDark]}>
            <View style={styles.statItem}>
              <DollarSign size={scale(16)} color="#10B981" />
              <Text style={[styles.moneyText, isDarkMode && styles.textMuted]}>
                ${gameState.stats.money.toLocaleString()}
              </Text>
            </View>
            <View style={styles.statItem}>
              <Calendar size={scale(16)} color="#8B5CF6" />
              <Text style={[styles.statText, isDarkMode && styles.textMuted]}>
                Wedding in 4 weeks
              </Text>
            </View>
            {!canAfford && deposit > 0 && (
              <View style={[styles.warningBadge, isDarkMode && styles.warningBadgeDark]}>
                <Text style={styles.warningText}>
                  Need ${(deposit - gameState.stats.money).toLocaleString()} more
                </Text>
              </View>
            )}
          </View>

          <ScrollView 
            style={styles.content} 
            showsVerticalScrollIndicator={true}
            contentContainerStyle={styles.contentContainer}
            nestedScrollEnabled={true}
          >
            {/* Partner Info */}
            <View style={[styles.partnerCard, isDarkMode && styles.partnerCardDark]}>
              <Heart size={scale(20)} color="#EC4899" />
              <Text style={[styles.partnerName, isDarkMode && styles.textDark]}>
                Planning with {partnerName}
              </Text>
            </View>

            {/* Venue Selection */}
            <View style={styles.section}>
              <Text style={[styles.sectionTitle, isDarkMode && styles.sectionTitleDark]}>
                Select Venue
              </Text>
              {WEDDING_VENUES.length === 0 ? (
                <View style={[styles.emptyState, isDarkMode && styles.emptyStateDark]}>
                  <Text style={[styles.emptyStateText, isDarkMode && styles.emptyStateTextDark]}>
                    No venues available
                  </Text>
                </View>
              ) : (
                <ScrollView 
                  horizontal 
                  showsHorizontalScrollIndicator={true} 
                  style={styles.venueScroll}
                  contentContainerStyle={styles.venueScrollContent}
                >
                  {WEDDING_VENUES.map(venue => {
                  const isSelected = selectedVenueId === venue.id;
                  const venueColor = getVenueTypeColor(venue.type);
                  return (
                    <TouchableOpacity
                      key={venue.id}
                      onPress={() => setSelectedVenueId(venue.id)}
                      style={[styles.venueCard, isSelected && styles.venueCardSelected]}
                    >
                      <View style={[
                        styles.venueCardContent,
                        isDarkMode && styles.venueCardContentDark,
                        isSelected && { borderColor: venueColor, borderWidth: 2 }
                      ]}>
                        <MapPin size={scale(20)} color={isSelected ? venueColor : (isDarkMode ? '#9CA3AF' : '#6B7280')} />
                        <Text style={[
                          styles.venueName, 
                          isDarkMode && styles.venueNameDark,
                          isSelected && { color: venueColor }
                        ]}>
                          {venue.name}
                        </Text>
                        <Text style={[styles.venueCapacity, isDarkMode && styles.venueCapacityDark]}>
                          Up to {venue.guestCapacity} guests
                        </Text>
                        <Text style={[styles.venueCost, isDarkMode && styles.venueCostDark]}>
                          ${venue.baseCost.toLocaleString()}
                        </Text>
                        {isSelected && (
                          <View style={[styles.selectedBadge, { backgroundColor: venueColor }]}>
                            <Check size={scale(14)} color="#FFFFFF" />
                          </View>
                        )}
                      </View>
                    </TouchableOpacity>
                  );
                })}
                </ScrollView>
              )}
              {selectedVenue && (
                <View style={[styles.venueDescriptionCard, isDarkMode && styles.venueDescriptionCardDark]}>
                  <Text style={[styles.venueDescription, isDarkMode && styles.venueDescriptionDark]}>
                    {selectedVenue.description}
                  </Text>
                </View>
              )}
            </View>

            {/* Guest Count */}
            {selectedVenueId && (
              <View style={styles.section}>
                <Text style={[styles.sectionTitle, isDarkMode && styles.sectionTitleDark]}>
                  Guest Count
                </Text>
                <View style={[styles.guestInputContainer, isDarkMode && styles.guestInputContainerDark]}>
                  <Users size={scale(20)} color={isDarkMode ? '#9CA3AF' : '#6B7280'} />
                  <TextInput
                    style={[styles.guestInput, isDarkMode && styles.guestInputDark]}
                    value={guestCount}
                    onChangeText={setGuestCount}
                    keyboardType="numeric"
                    placeholder="Enter number of guests"
                    placeholderTextColor={isDarkMode ? '#6B7280' : '#9CA3AF'}
                    maxLength={3}
                  />
                  <Text style={[styles.guestHint, isDarkMode && styles.guestHintDark]}>
                    Max: {selectedVenue?.guestCapacity || 0}
                  </Text>
                </View>
              </View>
            )}

            {/* Optional Services */}
            {selectedVenueId && (
              <View style={styles.section}>
                <Text style={[styles.sectionTitle, isDarkMode && styles.sectionTitleDark]}>
                  Optional Services
                </Text>
                
                {[
                  { key: 'catering', state: catering, setState: setCatering, addon: WEDDING_ADDONS.catering, cost: WEDDING_ADDONS.catering.baseCostPerGuest * guestCountNum },
                  { key: 'photography', state: photography, setState: setPhotography, addon: WEDDING_ADDONS.photography, cost: WEDDING_ADDONS.photography.cost },
                  { key: 'music', state: music, setState: setMusic, addon: WEDDING_ADDONS.music, cost: WEDDING_ADDONS.music.cost },
                  { key: 'decorations', state: decorations, setState: setDecorations, addon: WEDDING_ADDONS.decorations, cost: WEDDING_ADDONS.decorations.cost },
                ].map(({ key, state, setState, addon, cost }) => (
                  <TouchableOpacity
                    key={key}
                    style={[styles.serviceOption, isDarkMode && styles.serviceOptionDark]}
                    onPress={() => setState(!state)}
                  >
                    <View style={[styles.checkbox, state && styles.checkboxChecked]}>
                      {state && <Check size={scale(12)} color="#FFFFFF" />}
                    </View>
                    <View style={styles.serviceInfo}>
                      <Text style={[styles.serviceName, isDarkMode && styles.serviceNameDark]}>
                        {addon.name}
                      </Text>
                      <Text style={[styles.serviceDescription, isDarkMode && styles.serviceDescriptionDark]}>
                        {addon.description}
                      </Text>
                    </View>
                    <Text style={[styles.serviceCost, isDarkMode && styles.serviceCostDark]}>
                      ${cost.toLocaleString()}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            )}

            {/* Cost Breakdown */}
            {selectedVenueId && totalCost > 0 && (
              <View style={styles.section}>
                <Text style={[styles.sectionTitle, isDarkMode && styles.sectionTitleDark]}>
                  Cost Breakdown
                </Text>
                <View style={[styles.costBreakdown, isDarkMode && styles.costBreakdownDark]}>
                  <View style={styles.costRow}>
                    <Text style={[styles.costLabel, isDarkMode && styles.costLabelDark]}>Total Cost:</Text>
                    <Text style={[styles.costValue, isDarkMode && styles.costValueDark]}>
                      ${totalCost.toLocaleString()}
                    </Text>
                  </View>
                  <View style={styles.costRow}>
                    <Text style={[styles.costLabel, isDarkMode && styles.costLabelDark]}>Deposit (25%):</Text>
                    <Text style={[styles.costValue, isDarkMode && styles.costValueDark]}>
                      ${deposit.toLocaleString()}
                    </Text>
                  </View>
                  <View style={[styles.costRow, styles.costRowTotal]}>
                    <Text style={[styles.costLabel, isDarkMode && styles.costLabelDark]}>Due at Wedding:</Text>
                    <Text style={[styles.costValue, isDarkMode && styles.costValueDark]}>
                      ${(totalCost - deposit).toLocaleString()}
                    </Text>
                  </View>
                </View>
              </View>
            )}
          </ScrollView>

          {/* Footer */}
          <View style={[styles.footer, isDarkMode && styles.footerDark]}>
            <TouchableOpacity
              style={[styles.cancelButton, isDarkMode && styles.cancelButtonDark]}
              onPress={onClose}
            >
              <Text style={[styles.cancelButtonText, isDarkMode && styles.cancelButtonTextDark]}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.confirmButton, (!selectedVenueId || !canAfford) && styles.confirmButtonDisabled]}
              onPress={handlePlanWedding}
              disabled={!selectedVenueId || !canAfford}
            >
              <LinearGradient
                colors={(!selectedVenueId || !canAfford) ? ['#9CA3AF', '#6B7280'] : ['#EC4899', '#DB2777']}
                style={styles.confirmButtonGradient}
              >
                <Heart size={scale(18)} color="#FFFFFF" />
                <Text style={styles.confirmButtonText}>Plan Wedding</Text>
              </LinearGradient>
            </TouchableOpacity>
          </View>
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
    maxWidth: scale(500),
    height: '90%',
    maxHeight: scale(700),
    backgroundColor: '#fff',
    borderRadius: scale(20),
    overflow: 'hidden',
    ...getShadow(20, '#000'),
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
    gap: scale(10),
  },
  title: {
    fontSize: fontScale(20),
    fontWeight: 'bold',
    color: '#111827',
  },
  titleDark: {
    color: '#F9FAFB',
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
  textMuted: {
    color: '#9CA3AF',
  },
  moneyText: {
    fontSize: fontScale(13),
    color: '#10B981',
    fontWeight: 'bold',
  },
  warningBadge: {
    backgroundColor: '#FEE2E2',
    paddingHorizontal: scale(8),
    paddingVertical: scale(4),
    borderRadius: scale(8),
  },
  warningBadgeDark: {
    backgroundColor: '#7F1D1D',
  },
  warningText: {
    fontSize: fontScale(11),
    color: '#DC2626',
    fontWeight: '600',
  },
  content: {
    flex: 1,
  },
  contentContainer: {
    padding: scale(16),
    paddingBottom: scale(20),
    flexGrow: 1,
  },
  partnerCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: scale(8),
    padding: scale(12),
    borderRadius: scale(12),
    backgroundColor: '#FEF3C7',
    marginBottom: scale(16),
  },
  partnerCardDark: {
    backgroundColor: '#78350F',
  },
  partnerName: {
    fontSize: fontScale(16),
    fontWeight: '600',
    color: '#92400E',
  },
  textDark: {
    color: '#F9FAFB',
  },
  section: {
    marginBottom: scale(24),
  },
  sectionTitle: {
    fontSize: fontScale(18),
    fontWeight: '700',
    color: '#111827',
    marginBottom: scale(12),
  },
  sectionTitleDark: {
    color: '#FFFFFF',
  },
  venueScroll: {
    marginHorizontal: scale(-16),
    marginVertical: scale(8),
  },
  venueScrollContent: {
    paddingHorizontal: scale(16),
    paddingVertical: scale(4),
  },
  emptyState: {
    padding: scale(20),
    alignItems: 'center',
    backgroundColor: '#F3F4F6',
    borderRadius: scale(12),
  },
  emptyStateDark: {
    backgroundColor: '#374151',
  },
  emptyStateText: {
    fontSize: fontScale(14),
    color: '#6B7280',
  },
  emptyStateTextDark: {
    color: '#9CA3AF',
  },
  venueCard: {
    width: scale(180),
    marginRight: scale(12),
  },
  venueCardSelected: {
    // Selection handled by border
  },
  venueCardContent: {
    padding: scale(16),
    borderRadius: scale(12),
    backgroundColor: '#F9FAFB',
    borderWidth: 2,
    borderColor: 'transparent',
    alignItems: 'center',
    minHeight: scale(140),
    justifyContent: 'center',
  },
  venueCardContentDark: {
    backgroundColor: '#374151',
  },
  venueName: {
    fontSize: fontScale(16),
    fontWeight: '700',
    color: '#1F2937',
    marginTop: scale(8),
    textAlign: 'center',
  },
  venueNameDark: {
    color: '#FFFFFF',
  },
  venueCapacity: {
    fontSize: fontScale(12),
    color: '#6B7280',
    marginTop: scale(4),
  },
  venueCapacityDark: {
    color: '#9CA3AF',
  },
  venueCost: {
    fontSize: fontScale(14),
    fontWeight: '600',
    color: '#10B981',
    marginTop: scale(8),
  },
  venueCostDark: {
    color: '#34D399',
  },
  selectedBadge: {
    position: 'absolute',
    top: scale(8),
    right: scale(8),
    width: scale(24),
    height: scale(24),
    borderRadius: scale(12),
    justifyContent: 'center',
    alignItems: 'center',
  },
  venueDescriptionCard: {
    marginTop: scale(12),
    padding: scale(12),
    borderRadius: scale(10),
    backgroundColor: '#F3F4F6',
  },
  venueDescriptionCardDark: {
    backgroundColor: '#374151',
  },
  venueDescription: {
    fontSize: fontScale(14),
    color: '#6B7280',
    fontStyle: 'italic',
    lineHeight: fontScale(20),
  },
  venueDescriptionDark: {
    color: '#9CA3AF',
  },
  guestInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: scale(12),
    padding: scale(12),
    borderRadius: scale(12),
    backgroundColor: '#F3F4F6',
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  guestInputContainerDark: {
    backgroundColor: '#374151',
    borderColor: '#4B5563',
  },
  guestInput: {
    flex: 1,
    fontSize: fontScale(16),
    color: '#1F2937',
  },
  guestInputDark: {
    color: '#FFFFFF',
  },
  guestHint: {
    fontSize: fontScale(12),
    color: '#6B7280',
  },
  guestHintDark: {
    color: '#9CA3AF',
  },
  serviceOption: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: scale(12),
    borderRadius: scale(12),
    backgroundColor: '#F9FAFB',
    marginBottom: scale(8),
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  serviceOptionDark: {
    backgroundColor: '#374151',
    borderColor: '#4B5563',
  },
  checkbox: {
    width: scale(20),
    height: scale(20),
    borderRadius: scale(6),
    borderWidth: 2,
    borderColor: '#9CA3AF',
    marginRight: scale(12),
    justifyContent: 'center',
    alignItems: 'center',
  },
  checkboxChecked: {
    backgroundColor: '#EC4899',
    borderColor: '#EC4899',
  },
  serviceInfo: {
    flex: 1,
  },
  serviceName: {
    fontSize: fontScale(15),
    fontWeight: '600',
    color: '#1F2937',
    marginBottom: scale(2),
  },
  serviceNameDark: {
    color: '#FFFFFF',
  },
  serviceDescription: {
    fontSize: fontScale(12),
    color: '#6B7280',
  },
  serviceDescriptionDark: {
    color: '#9CA3AF',
  },
  serviceCost: {
    fontSize: fontScale(14),
    fontWeight: '600',
    color: '#10B981',
  },
  serviceCostDark: {
    color: '#34D399',
  },
  costBreakdown: {
    padding: scale(16),
    borderRadius: scale(12),
    backgroundColor: '#F3F4F6',
  },
  costBreakdownDark: {
    backgroundColor: '#374151',
  },
  costRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: scale(8),
  },
  costRowTotal: {
    borderTopWidth: 1,
    borderTopColor: 'rgba(0, 0, 0, 0.1)',
    paddingTop: scale(8),
    marginTop: scale(4),
  },
  costLabel: {
    fontSize: fontScale(14),
    color: '#6B7280',
  },
  costLabelDark: {
    color: '#9CA3AF',
  },
  costValue: {
    fontSize: fontScale(14),
    fontWeight: '600',
    color: '#1F2937',
  },
  costValueDark: {
    color: '#FFFFFF',
  },
  footer: {
    flexDirection: 'row',
    gap: scale(12),
    padding: scale(16),
    borderTopWidth: 1,
    borderTopColor: 'rgba(0,0,0,0.1)',
  },
  footerDark: {
    borderTopColor: 'rgba(255,255,255,0.1)',
  },
  cancelButton: {
    flex: 1,
    padding: scale(14),
    borderRadius: scale(12),
    backgroundColor: '#F3F4F6',
    alignItems: 'center',
  },
  cancelButtonDark: {
    backgroundColor: '#374151',
  },
  cancelButtonText: {
    fontSize: fontScale(16),
    fontWeight: '600',
    color: '#6B7280',
  },
  cancelButtonTextDark: {
    color: '#9CA3AF',
  },
  confirmButton: {
    flex: 2,
    borderRadius: scale(12),
    overflow: 'hidden',
  },
  confirmButtonDisabled: {
    opacity: 0.5,
  },
  confirmButtonGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: scale(14),
    gap: scale(8),
  },
  confirmButtonText: {
    fontSize: fontScale(16),
    fontWeight: '700',
    color: '#FFFFFF',
  },
});
