import React, { useState, useCallback, useMemo } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Modal, ScrollView, TextInput, Alert, Platform } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { X, Calendar, Users, DollarSign, Check, MapPin } from 'lucide-react-native';
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
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.modalOverlay}>
        <LinearGradient
          colors={isDarkMode ? ['#1F2937', '#111827'] : ['#FFFFFF', '#F8FAFC']}
          style={styles.modalContainer}
        >
          {/* Header */}
          <View style={styles.header}>
            <View style={styles.headerContent}>
              <Calendar size={scale(24)} color={isDarkMode ? '#FFFFFF' : '#1F2937'} />
              <Text style={[styles.headerTitle, isDarkMode && styles.headerTitleDark]}>
                Plan Wedding with {partnerName}
              </Text>
            </View>
            <TouchableOpacity onPress={onClose} style={styles.closeButton}>
              <X size={scale(24)} color={isDarkMode ? '#FFFFFF' : '#1F2937'} />
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.content} showsVerticalScrollIndicator={true}>
            {/* Venue Selection */}
            <View style={styles.section}>
              <Text style={[styles.sectionTitle, isDarkMode && styles.sectionTitleDark]}>Select Venue</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.venueScroll}>
                {WEDDING_VENUES.map(venue => {
                  const isSelected = selectedVenueId === venue.id;
                  const venueColor = getVenueTypeColor(venue.type);
                  return (
                    <TouchableOpacity
                      key={venue.id}
                      onPress={() => setSelectedVenueId(venue.id)}
                      style={[styles.venueCard, isSelected && styles.venueCardSelected]}
                    >
                      <LinearGradient
                        colors={isSelected ? [venueColor, venueColor] : isDarkMode ? ['#374151', '#1F2937'] : ['#F3F4F6', '#E5E7EB']}
                        style={styles.venueCardGradient}
                      >
                        <MapPin size={scale(20)} color={isSelected ? '#FFFFFF' : (isDarkMode ? '#9CA3AF' : '#6B7280')} />
                        <Text style={[styles.venueName, isSelected && styles.venueNameSelected]}>
                          {venue.name}
                        </Text>
                        <Text style={[styles.venueCapacity, isSelected && styles.venueCapacitySelected]}>
                          Up to {venue.guestCapacity} guests
                        </Text>
                        <Text style={[styles.venueCost, isSelected && styles.venueCostSelected]}>
                          ${venue.baseCost.toLocaleString()}
                        </Text>
                        {isSelected && (
                          <View style={styles.selectedBadge}>
                            <Check size={scale(16)} color="#FFFFFF" />
                          </View>
                        )}
                      </LinearGradient>
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>
              {selectedVenue && (
                <Text style={[styles.venueDescription, isDarkMode && styles.venueDescriptionDark]}>
                  {selectedVenue.description}
                </Text>
              )}
            </View>

            {/* Guest Count */}
            {selectedVenueId && (
              <View style={styles.section}>
                <Text style={[styles.sectionTitle, isDarkMode && styles.sectionTitleDark]}>Guest Count</Text>
                <View style={styles.guestInputContainer}>
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
                <Text style={[styles.sectionTitle, isDarkMode && styles.sectionTitleDark]}>Optional Services</Text>
                
                <TouchableOpacity
                  style={[styles.serviceOption, isDarkMode && styles.serviceOptionDark]}
                  onPress={() => setCatering(!catering)}
                >
                  <View style={[styles.checkbox, catering && styles.checkboxChecked]}>
                    {catering && <Check size={scale(14)} color="#FFFFFF" />}
                  </View>
                  <View style={styles.serviceInfo}>
                    <Text style={[styles.serviceName, isDarkMode && styles.serviceNameDark]}>
                      {WEDDING_ADDONS.catering.name}
                    </Text>
                    <Text style={[styles.serviceDescription, isDarkMode && styles.serviceDescriptionDark]}>
                      {WEDDING_ADDONS.catering.description}
                    </Text>
                    <Text style={[styles.serviceCost, isDarkMode && styles.serviceCostDark]}>
                      ${(WEDDING_ADDONS.catering.baseCostPerGuest * guestCountNum).toLocaleString()}
                    </Text>
                  </View>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.serviceOption, isDarkMode && styles.serviceOptionDark]}
                  onPress={() => setPhotography(!photography)}
                >
                  <View style={[styles.checkbox, photography && styles.checkboxChecked]}>
                    {photography && <Check size={scale(14)} color="#FFFFFF" />}
                  </View>
                  <View style={styles.serviceInfo}>
                    <Text style={[styles.serviceName, isDarkMode && styles.serviceNameDark]}>
                      {WEDDING_ADDONS.photography.name}
                    </Text>
                    <Text style={[styles.serviceDescription, isDarkMode && styles.serviceDescriptionDark]}>
                      {WEDDING_ADDONS.photography.description}
                    </Text>
                    <Text style={[styles.serviceCost, isDarkMode && styles.serviceCostDark]}>
                      ${WEDDING_ADDONS.photography.cost.toLocaleString()}
                    </Text>
                  </View>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.serviceOption, isDarkMode && styles.serviceOptionDark]}
                  onPress={() => setMusic(!music)}
                >
                  <View style={[styles.checkbox, music && styles.checkboxChecked]}>
                    {music && <Check size={scale(14)} color="#FFFFFF" />}
                  </View>
                  <View style={styles.serviceInfo}>
                    <Text style={[styles.serviceName, isDarkMode && styles.serviceNameDark]}>
                      {WEDDING_ADDONS.music.name}
                    </Text>
                    <Text style={[styles.serviceDescription, isDarkMode && styles.serviceDescriptionDark]}>
                      {WEDDING_ADDONS.music.description}
                    </Text>
                    <Text style={[styles.serviceCost, isDarkMode && styles.serviceCostDark]}>
                      ${WEDDING_ADDONS.music.cost.toLocaleString()}
                    </Text>
                  </View>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.serviceOption, isDarkMode && styles.serviceOptionDark]}
                  onPress={() => setDecorations(!decorations)}
                >
                  <View style={[styles.checkbox, decorations && styles.checkboxChecked]}>
                    {decorations && <Check size={scale(14)} color="#FFFFFF" />}
                  </View>
                  <View style={styles.serviceInfo}>
                    <Text style={[styles.serviceName, isDarkMode && styles.serviceNameDark]}>
                      {WEDDING_ADDONS.decorations.name}
                    </Text>
                    <Text style={[styles.serviceDescription, isDarkMode && styles.serviceDescriptionDark]}>
                      {WEDDING_ADDONS.decorations.description}
                    </Text>
                    <Text style={[styles.serviceCost, isDarkMode && styles.serviceCostDark]}>
                      ${WEDDING_ADDONS.decorations.cost.toLocaleString()}
                    </Text>
                  </View>
                </TouchableOpacity>
              </View>
            )}

            {/* Cost Breakdown */}
            {selectedVenueId && totalCost > 0 && (
              <View style={styles.section}>
                <Text style={[styles.sectionTitle, isDarkMode && styles.sectionTitleDark]}>Cost Breakdown</Text>
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
                  <View style={styles.costRow}>
                    <Text style={[styles.costLabel, isDarkMode && styles.costLabelDark]}>Remaining (75%):</Text>
                    <Text style={[styles.costValue, isDarkMode && styles.costValueDark]}>
                      ${(totalCost - deposit).toLocaleString()}
                    </Text>
                  </View>
                  <View style={[styles.costRow, styles.costRowTotal]}>
                    <Text style={[styles.costLabel, isDarkMode && styles.costLabelDark]}>Due at Wedding:</Text>
                    <Text style={[styles.costValue, isDarkMode && styles.costValueDark]}>
                      ${(totalCost - deposit).toLocaleString()}
                    </Text>
                  </View>
                </View>
                {!canAfford && (
                  <Text style={styles.insufficientFunds}>
                    Insufficient funds for deposit. You need ${(deposit - gameState.stats.money).toLocaleString()} more.
                  </Text>
                )}
              </View>
            )}
          </ScrollView>

          {/* Footer */}
          <View style={styles.footer}>
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
                colors={(!selectedVenueId || !canAfford) ? ['#9CA3AF', '#6B7280'] : ['#22C55E', '#16A34A']}
                style={styles.confirmButtonGradient}
              >
                <Calendar size={scale(18)} color="#FFFFFF" />
                <Text style={styles.confirmButtonText}>Plan Wedding</Text>
              </LinearGradient>
            </TouchableOpacity>
          </View>
        </LinearGradient>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    justifyContent: 'flex-end',
  },
  modalContainer: {
    maxHeight: '90%',
    borderTopLeftRadius: scale(24),
    borderTopRightRadius: scale(24),
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
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: responsivePadding.large,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0, 0, 0, 0.1)',
  },
  headerContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: scale(12),
  },
  headerTitle: {
    fontSize: fontScale(20),
    fontWeight: '700',
    color: '#1F2937',
  },
  headerTitleDark: {
    color: '#FFFFFF',
  },
  closeButton: {
    padding: scale(8),
  },
  content: {
    flex: 1,
    padding: responsivePadding.large,
  },
  section: {
    marginBottom: scale(24),
  },
  sectionTitle: {
    fontSize: fontScale(18),
    fontWeight: '700',
    color: '#1F2937',
    marginBottom: scale(12),
  },
  sectionTitleDark: {
    color: '#FFFFFF',
  },
  venueScroll: {
    marginHorizontal: scale(-16),
    paddingHorizontal: scale(16),
  },
  venueCard: {
    width: scale(200),
    marginRight: scale(12),
    borderRadius: scale(16),
    overflow: 'hidden',
  },
  venueCardSelected: {
    borderWidth: 2,
    borderColor: '#22C55E',
  },
  venueCardGradient: {
    padding: scale(16),
    alignItems: 'center',
    minHeight: scale(140),
    justifyContent: 'center',
  },
  venueName: {
    fontSize: fontScale(16),
    fontWeight: '700',
    color: '#1F2937',
    marginTop: scale(8),
    textAlign: 'center',
  },
  venueNameSelected: {
    color: '#FFFFFF',
  },
  venueCapacity: {
    fontSize: fontScale(12),
    color: '#6B7280',
    marginTop: scale(4),
  },
  venueCapacitySelected: {
    color: 'rgba(255, 255, 255, 0.8)',
  },
  venueCost: {
    fontSize: fontScale(14),
    fontWeight: '600',
    color: '#1F2937',
    marginTop: scale(8),
  },
  venueCostSelected: {
    color: '#FFFFFF',
  },
  selectedBadge: {
    position: 'absolute',
    top: scale(8),
    right: scale(8),
    width: scale(24),
    height: scale(24),
    borderRadius: scale(12),
    backgroundColor: '#22C55E',
    justifyContent: 'center',
    alignItems: 'center',
  },
  venueDescription: {
    fontSize: fontScale(14),
    color: '#6B7280',
    marginTop: scale(8),
    fontStyle: 'italic',
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
  guestInput: {
    flex: 1,
    fontSize: fontScale(16),
    color: '#1F2937',
  },
  guestInputDark: {
    backgroundColor: '#374151',
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
    alignItems: 'flex-start',
    padding: scale(12),
    borderRadius: scale(12),
    backgroundColor: '#F3F4F6',
    marginBottom: scale(8),
  },
  serviceOptionDark: {
    backgroundColor: '#374151',
  },
  checkbox: {
    width: scale(24),
    height: scale(24),
    borderRadius: scale(6),
    borderWidth: 2,
    borderColor: '#9CA3AF',
    marginRight: scale(12),
    marginTop: scale(2),
    justifyContent: 'center',
    alignItems: 'center',
  },
  checkboxChecked: {
    backgroundColor: '#22C55E',
    borderColor: '#22C55E',
  },
  serviceInfo: {
    flex: 1,
  },
  serviceName: {
    fontSize: fontScale(16),
    fontWeight: '600',
    color: '#1F2937',
    marginBottom: scale(4),
  },
  serviceNameDark: {
    color: '#FFFFFF',
  },
  serviceDescription: {
    fontSize: fontScale(12),
    color: '#6B7280',
    marginBottom: scale(4),
  },
  serviceDescriptionDark: {
    color: '#9CA3AF',
  },
  serviceCost: {
    fontSize: fontScale(14),
    fontWeight: '600',
    color: '#22C55E',
  },
  serviceCostDark: {
    color: '#4ADE80',
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
  insufficientFunds: {
    fontSize: fontScale(12),
    color: '#EF4444',
    marginTop: scale(8),
    fontStyle: 'italic',
  },
  footer: {
    flexDirection: 'row',
    gap: scale(12),
    padding: responsivePadding.large,
    borderTopWidth: 1,
    borderTopColor: 'rgba(0, 0, 0, 0.1)',
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

