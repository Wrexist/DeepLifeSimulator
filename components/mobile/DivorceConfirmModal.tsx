import React, { useMemo, useState } from 'react';
import { Modal, View, Text, StyleSheet, TouchableOpacity, ScrollView } from 'react-native';
import LinearGradientFallback from '@/components/fallbacks/LinearGradientFallback';
const LinearGradient = LinearGradientFallback;
import { X, AlertTriangle, DollarSign, Heart, Gem, Scale, TrendingDown, Shield, Star } from 'lucide-react-native';
import { scale, fontScale, responsivePadding } from '@/utils/scaling';
import { getShadow } from '@/utils/shadow';
import { DIVORCE_LAWYERS, getLawyerExpectedValue, DivorceLawyer } from '@/lib/dating/divorceLawyers';

interface DivorceConfirmModalProps {
  visible: boolean;
  onClose: () => void;
  onConfirm: (lawyerId?: string) => void;
  spouseName: string;
  estimatedSettlement: number;
  lawyerFees: number;
  currentMoney: number;
  currentGems: number;
  netWorth: number;
  isDarkMode: boolean;
}

export default function DivorceConfirmModal({
  visible,
  onClose,
  onConfirm,
  spouseName,
  estimatedSettlement,
  lawyerFees,
  currentMoney,
  currentGems,
  netWorth,
  isDarkMode,
}: DivorceConfirmModalProps) {
  const [selectedLawyer, setSelectedLawyer] = useState<string | null>(null);
  
  const baseTotalCost = estimatedSettlement + lawyerFees;
  const moneyAfterDivorce = Math.max(1000, currentMoney - baseTotalCost);
  const canAffordBase = currentMoney >= lawyerFees;

  const settlementPercent = useMemo(() => {
    if (netWorth === 0) return 0;
    return ((estimatedSettlement / netWorth) * 100).toFixed(1);
  }, [estimatedSettlement, netWorth]);

  // Calculate lawyer outcomes
  const lawyerOutcomes = useMemo(() => {
    return DIVORCE_LAWYERS.map(lawyer => {
      const expected = getLawyerExpectedValue(estimatedSettlement, lawyer);
      const lawyerCost = expected.lawyerCost; // Use dynamic cost
      const totalCost = lawyerFees + lawyerCost;
      const canAfford = currentMoney >= totalCost;
      const finalCost = expected.expectedSettlement + totalCost;
      const netSavings = expected.expectedSavings;
      
      return {
        lawyer,
        expected,
        lawyerCost, // Dynamic cost
        totalCost,
        canAfford,
        finalCost,
        netSavings,
      };
    });
  }, [estimatedSettlement, lawyerFees, currentMoney]);

  const selectedLawyerData = selectedLawyer 
    ? lawyerOutcomes.find(o => o.lawyer.id === selectedLawyer)
    : null;

  const finalTotalCost = selectedLawyerData 
    ? selectedLawyerData.finalCost
    : baseTotalCost;

  const finalMoneyAfter = Math.max(1000, currentMoney - finalTotalCost);
  const canAffordFinal = selectedLawyerData 
    ? selectedLawyerData.canAfford && currentMoney >= finalTotalCost
    : canAffordBase;

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={[styles.container, isDarkMode && styles.containerDark]}>
          {/* Header */}
          <View style={styles.header}>
            <View style={styles.headerContent}>
              <AlertTriangle size={scale(24)} color="#EF4444" />
              <Text style={[styles.title, isDarkMode && styles.titleDark]}>Confirm Divorce</Text>
            </View>
            <TouchableOpacity onPress={onClose} style={styles.closeButton}>
              <X size={scale(24)} color={isDarkMode ? '#fff' : '#000'} />
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.content} showsVerticalScrollIndicator={true}>
            {/* Warning Message */}
            <View style={[styles.warningBox, isDarkMode && styles.warningBoxDark]}>
              <Text style={[styles.warningText, isDarkMode && styles.warningTextDark]}>
                ⚠️ This action cannot be undone!
              </Text>
              <Text style={[styles.warningSubtext, isDarkMode && styles.warningSubtextDark]}>
                You are about to divorce {spouseName}. This will permanently end your marriage.
              </Text>
            </View>

            {/* Base Divorce Costs */}
            <View style={styles.section}>
              <Text style={[styles.sectionTitle, isDarkMode && styles.sectionTitleDark]}>
                Base Divorce Costs
              </Text>
              
              <View style={[styles.infoCard, isDarkMode && styles.infoCardDark]}>
                <View style={styles.infoRow}>
                  <DollarSign size={scale(18)} color="#10B981" />
                  <Text style={[styles.infoLabel, isDarkMode && styles.infoLabelDark]}>
                    Estimated Settlement:
                  </Text>
                  <Text style={[styles.infoValue, isDarkMode && styles.infoValueDark]}>
                    ${estimatedSettlement.toLocaleString()}
                  </Text>
                </View>
                <Text style={[styles.infoSubtext, isDarkMode && styles.infoSubtextDark]}>
                  ({settlementPercent}% of your ${netWorth.toLocaleString()} net worth)
                </Text>
                
                <View style={styles.divider} />
                
                <View style={styles.infoRow}>
                  <DollarSign size={scale(18)} color="#F59E0B" />
                  <Text style={[styles.infoLabel, isDarkMode && styles.infoLabelDark]}>
                    Base Lawyer Fees:
                  </Text>
                  <Text style={[styles.infoValue, isDarkMode && styles.infoValueDark]}>
                    ${lawyerFees.toLocaleString()}
                  </Text>
                </View>
                
                <View style={styles.divider} />
                
                <View style={[styles.infoRow, styles.totalRow]}>
                  <Text style={[styles.totalLabel, isDarkMode && styles.totalLabelDark]}>
                    Base Total Cost:
                  </Text>
                  <Text style={[styles.totalValue, isDarkMode && styles.totalValueDark]}>
                    ${baseTotalCost.toLocaleString()}
                  </Text>
                </View>
              </View>
            </View>

            {/* Fight the Settlement Section */}
            <View style={styles.section}>
              <View style={styles.sectionHeader}>
                <Scale size={scale(20)} color="#8B5CF6" />
                <Text style={[styles.sectionTitle, isDarkMode && styles.sectionTitleDark]}>
                  Fight the Settlement
                </Text>
              </View>
              <Text style={[styles.sectionDescription, isDarkMode && styles.sectionDescriptionDark]}>
                Hire a lawyer to potentially reduce your settlement amount. Better lawyers have higher success rates and can save you more money.
              </Text>

              {/* Lawyer Options */}
              <View style={styles.lawyerContainer}>
                {lawyerOutcomes.map((outcome) => {
                  const isSelected = selectedLawyer === outcome.lawyer.id;
                  const tierColors = {
                    budget: ['#FEF3C7', '#FDE68A'],
                    standard: ['#DBEAFE', '#BFDBFE'],
                    premium: ['#FCE7F3', '#FBCFE8'],
                  };
                  const tierColor = tierColors[outcome.lawyer.tier];
                  
                  return (
                    <TouchableOpacity
                      key={outcome.lawyer.id}
                      style={[
                        styles.lawyerCard,
                        isSelected && styles.lawyerCardSelected,
                        !outcome.canAfford && styles.lawyerCardDisabled,
                        isDarkMode && styles.lawyerCardDark,
                      ]}
                      onPress={() => outcome.canAfford && setSelectedLawyer(
                        selectedLawyer === outcome.lawyer.id ? null : outcome.lawyer.id
                      )}
                      disabled={!outcome.canAfford}
                    >
                      <LinearGradient
                        colors={isSelected 
                          ? (isDarkMode ? ['#4B5563', '#374151'] : tierColor)
                          : (isDarkMode ? ['#374151', '#1F2937'] : ['#F9FAFB', '#F3F4F6'])
                        }
                        style={styles.lawyerCardGradient}
                      >
                        {/* Lawyer Header */}
                        <View style={styles.lawyerHeader}>
                          <View style={styles.lawyerHeaderLeft}>
                            <View style={[
                              styles.lawyerTierBadge,
                              { backgroundColor: outcome.lawyer.tier === 'premium' ? '#FFD700' : 
                                                outcome.lawyer.tier === 'standard' ? '#60A5FA' : '#F59E0B' }
                            ]}>
                              <Star 
                                size={scale(12)} 
                                color="#FFFFFF" 
                                fill={isSelected ? '#FFFFFF' : 'transparent'}
                              />
                            </View>
                            <View style={styles.lawyerNameContainer}>
                              <Text style={[
                                styles.lawyerName,
                                isDarkMode && styles.lawyerNameDark,
                                isSelected && styles.lawyerNameSelected
                              ]}>
                                {outcome.lawyer.name}
                              </Text>
                              <Text style={[
                                styles.lawyerTagline,
                                isDarkMode && styles.lawyerTaglineDark
                              ]}>
                                {outcome.lawyer.tagline}
                              </Text>
                            </View>
                          </View>
                          {isSelected && (
                            <View style={styles.selectedBadge}>
                              <Text style={styles.selectedBadgeText}>✓</Text>
                            </View>
                          )}
                        </View>

                        {/* Lawyer Stats */}
                        <View style={styles.lawyerStats}>
                          <View style={styles.lawyerStatRow}>
                            <Shield size={scale(14)} color="#10B981" />
                            <Text style={[styles.lawyerStatLabel, isDarkMode && styles.lawyerStatLabelDark]}>
                              Success Rate:
                            </Text>
                            <Text style={[styles.lawyerStatValue, isDarkMode && styles.lawyerStatValueDark]}>
                              {(outcome.lawyer.successRate * 100).toFixed(0)}%
                            </Text>
                          </View>
                          <View style={styles.lawyerStatRow}>
                            <TrendingDown size={scale(14)} color="#8B5CF6" />
                            <Text style={[styles.lawyerStatLabel, isDarkMode && styles.lawyerStatLabelDark]}>
                              Reduction:
                            </Text>
                            <Text style={[styles.lawyerStatValue, isDarkMode && styles.lawyerStatValueDark]}>
                              {(outcome.lawyer.minReduction * 100).toFixed(0)}-{(outcome.lawyer.maxReduction * 100).toFixed(0)}%
                            </Text>
                          </View>
                        </View>

                        {/* Expected Outcome */}
                        <View style={[styles.lawyerOutcome, isDarkMode && styles.lawyerOutcomeDark]}>
                          <Text style={[styles.lawyerOutcomeTitle, isDarkMode && styles.lawyerOutcomeTitleDark]}>
                            Expected Outcome:
                          </Text>
                          <View style={styles.lawyerOutcomeRow}>
                            <Text style={[styles.lawyerOutcomeLabel, isDarkMode && styles.lawyerOutcomeLabelDark]}>
                              Expected Settlement:
                            </Text>
                            <Text style={[styles.lawyerOutcomeValue, isDarkMode && styles.lawyerOutcomeValueDark]}>
                              ${Math.round(outcome.expected.expectedSettlement).toLocaleString()}
                            </Text>
                          </View>
                          <View style={styles.lawyerOutcomeRow}>
                            <Text style={[styles.lawyerOutcomeLabel, isDarkMode && styles.lawyerOutcomeLabelDark]}>
                              Net Savings:
                            </Text>
                            <Text style={[
                              styles.lawyerOutcomeValue,
                              outcome.netSavings > 0 ? styles.positiveSavings : styles.negativeSavings
                            ]}>
                              {outcome.netSavings > 0 ? '+' : ''}${Math.round(outcome.netSavings).toLocaleString()}
                            </Text>
                          </View>
                          {outcome.expected.roi > 0 && (
                            <Text style={[styles.lawyerROI, isDarkMode && styles.lawyerROIDark]}>
                              ROI: {outcome.expected.roi.toFixed(1)}%
                            </Text>
                          )}
                        </View>

                        {/* Cost */}
                        <View style={styles.lawyerCostRow}>
                          <Text style={[styles.lawyerCostLabel, isDarkMode && styles.lawyerCostLabelDark]}>
                            Lawyer Cost:
                          </Text>
                          <Text style={[styles.lawyerCostValue, isDarkMode && styles.lawyerCostValueDark]}>
                            ${outcome.lawyerCost.toLocaleString()}
                          </Text>
                        </View>

                        {!outcome.canAfford && (
                          <View style={styles.cannotAffordBadge}>
                            <Text style={styles.cannotAffordText}>
                              Need ${(outcome.totalCost - currentMoney).toLocaleString()} more
                            </Text>
                          </View>
                        )}
                      </LinearGradient>
                    </TouchableOpacity>
                  );
                })}
              </View>

              {/* No Lawyer Option */}
              <TouchableOpacity
                style={[
                  styles.noLawyerOption,
                  !selectedLawyer && styles.noLawyerOptionSelected,
                  isDarkMode && styles.noLawyerOptionDark,
                ]}
                onPress={() => setSelectedLawyer(null)}
              >
                <Text style={[
                  styles.noLawyerText,
                  isDarkMode && styles.noLawyerTextDark,
                  !selectedLawyer && styles.noLawyerTextSelected
                ]}>
                  {!selectedLawyer ? '✓ ' : ''}Accept settlement without fighting
                </Text>
              </TouchableOpacity>
            </View>

            {/* Final Costs Summary */}
            {selectedLawyerData && (
              <View style={styles.section}>
                <Text style={[styles.sectionTitle, isDarkMode && styles.sectionTitleDark]}>
                  Final Costs (with Lawyer)
                </Text>
                
                <View style={[styles.infoCard, styles.finalCostCard, isDarkMode && styles.infoCardDark]}>
                  <View style={styles.infoRow}>
                    <Text style={[styles.infoLabel, isDarkMode && styles.infoLabelDark]}>
                      Expected Settlement:
                    </Text>
                    <Text style={[styles.infoValue, isDarkMode && styles.infoValueDark]}>
                      ${Math.round(selectedLawyerData.expected.expectedSettlement).toLocaleString()}
                    </Text>
                  </View>
                  <View style={styles.infoRow}>
                    <Text style={[styles.infoLabel, isDarkMode && styles.infoLabelDark]}>
                      Base Fees:
                    </Text>
                    <Text style={[styles.infoValue, isDarkMode && styles.infoValueDark]}>
                      ${lawyerFees.toLocaleString()}
                    </Text>
                  </View>
                  <View style={styles.infoRow}>
                    <Text style={[styles.infoLabel, isDarkMode && styles.infoLabelDark]}>
                      Lawyer Cost:
                    </Text>
                    <Text style={[styles.infoValue, isDarkMode && styles.infoValueDark]}>
                      ${selectedLawyerData.lawyerCost.toLocaleString()}
                    </Text>
                  </View>
                  <View style={styles.divider} />
                  <View style={[styles.infoRow, styles.totalRow]}>
                    <Text style={[styles.totalLabel, isDarkMode && styles.totalLabelDark]}>
                      Expected Total:
                    </Text>
                    <Text style={[styles.totalValue, styles.finalTotalValue, isDarkMode && styles.totalValueDark]}>
                      ${Math.round(selectedLawyerData.finalCost).toLocaleString()}
                    </Text>
                  </View>
                  {selectedLawyerData.netSavings > 0 && (
                    <View style={styles.savingsHighlight}>
                      <Text style={styles.savingsText}>
                        💰 Expected Savings: ${Math.round(selectedLawyerData.netSavings).toLocaleString()}
                      </Text>
                    </View>
                  )}
                </View>
              </View>
            )}

            {/* What You Keep */}
            <View style={styles.section}>
              <Text style={[styles.sectionTitle, isDarkMode && styles.sectionTitleDark]}>
                What You Keep
              </Text>
              
              <View style={[styles.infoCard, isDarkMode && styles.infoCardDark]}>
                <View style={styles.infoRow}>
                  <DollarSign size={scale(18)} color="#10B981" />
                  <Text style={[styles.infoLabel, isDarkMode && styles.infoLabelDark]}>
                    Money After Divorce:
                  </Text>
                  <Text style={[styles.infoValue, isDarkMode && styles.infoValueDark]}>
                    ${finalMoneyAfter.toLocaleString()}
                  </Text>
                </View>
                <Text style={[styles.infoSubtext, isDarkMode && styles.infoSubtextDark]}>
                  (Minimum $1,000 will be preserved)
                </Text>
                
                <View style={styles.divider} />
                
                <View style={styles.infoRow}>
                  <Gem size={scale(18)} color="#FFD700" />
                  <Text style={[styles.infoLabel, isDarkMode && styles.infoLabelDark]}>
                    Your Gems:
                  </Text>
                  <Text style={[styles.infoValue, styles.gemValue]}>
                    {currentGems.toLocaleString()} 💎
                  </Text>
                </View>
                <Text style={[styles.infoSubtext, styles.gemSubtext, isDarkMode && styles.infoSubtextDark]}>
                  ✓ Gems are NEVER affected by divorce
                </Text>
              </View>
            </View>

            {/* Other Effects */}
            <View style={styles.section}>
              <Text style={[styles.sectionTitle, isDarkMode && styles.sectionTitleDark]}>
                Other Effects
              </Text>
              
              <View style={[styles.effectsList, isDarkMode && styles.effectsListDark]}>
                <View style={styles.effectItem}>
                  <Heart size={scale(16)} color="#EF4444" />
                  <Text style={[styles.effectText, isDarkMode && styles.effectTextDark]}>
                    -40 Happiness
                  </Text>
                </View>
                <View style={styles.effectItem}>
                  <Text style={[styles.effectText, isDarkMode && styles.effectTextDark]}>
                    -10 Reputation
                  </Text>
                </View>
                <View style={styles.effectItem}>
                  <Text style={[styles.effectText, isDarkMode && styles.effectTextDark]}>
                    Spouse relationship removed
                  </Text>
                </View>
              </View>
            </View>

            {!canAffordFinal && (
              <View style={[styles.errorBox, isDarkMode && styles.errorBoxDark]}>
                <Text style={styles.errorText}>
                  ⚠️ {selectedLawyerData 
                    ? `You need $${Math.round(selectedLawyerData.finalCost).toLocaleString()} total to proceed with this lawyer.`
                    : `You need at least $${lawyerFees.toLocaleString()} for lawyer fees to proceed with the divorce.`
                  }
                </Text>
              </View>
            )}
          </ScrollView>

          {/* Footer */}
          <View style={[styles.footer, isDarkMode && styles.footerDark]}>
            <TouchableOpacity
              style={[styles.cancelButton, isDarkMode && styles.cancelButtonDark]}
              onPress={onClose}
            >
              <Text style={[styles.cancelButtonText, isDarkMode && styles.cancelButtonTextDark]}>
                Cancel
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.confirmButton, (!canAffordFinal) && styles.confirmButtonDisabled]}
              onPress={() => onConfirm(selectedLawyer || undefined)}
              disabled={!canAffordFinal}
            >
              <LinearGradient
                colors={!canAffordFinal ? ['#9CA3AF', '#6B7280'] : ['#EF4444', '#DC2626']}
                style={styles.confirmButtonGradient}
              >
                <Text style={styles.confirmButtonText}>
                  {canAffordFinal 
                    ? (selectedLawyer ? `Divorce (with Lawyer)` : 'Confirm Divorce')
                    : 'Insufficient Funds'
                  }
                </Text>
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
    width: '95%',
    maxWidth: scale(600),
    height: '90%',
    maxHeight: scale(800),
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
    padding: scale(20),
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0,0,0,0.1)',
  },
  headerContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: scale(10),
  },
  title: {
    fontSize: fontScale(24),
    fontWeight: 'bold',
    color: '#111827',
  },
  titleDark: {
    color: '#F9FAFB',
  },
  closeButton: {
    padding: scale(4),
  },
  content: {
    flex: 1,
    padding: scale(20),
  },
  warningBox: {
    backgroundColor: '#FEF2F2',
    borderRadius: scale(12),
    padding: scale(20),
    marginBottom: scale(24),
    borderWidth: 2,
    borderColor: '#FEE2E2',
  },
  warningBoxDark: {
    backgroundColor: '#7F1D1D',
    borderColor: '#991B1B',
  },
  warningText: {
    fontSize: fontScale(18),
    fontWeight: 'bold',
    color: '#DC2626',
    marginBottom: scale(10),
  },
  warningTextDark: {
    color: '#FCA5A5',
  },
  warningSubtext: {
    fontSize: fontScale(15),
    color: '#991B1B',
    lineHeight: fontScale(22),
  },
  warningSubtextDark: {
    color: '#FCA5A5',
  },
  section: {
    marginBottom: scale(24),
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: scale(8),
    marginBottom: scale(8),
  },
  sectionTitle: {
    fontSize: fontScale(20),
    fontWeight: '700',
    color: '#111827',
    marginBottom: scale(16),
  },
  sectionTitleDark: {
    color: '#FFFFFF',
  },
  sectionDescription: {
    fontSize: fontScale(15),
    color: '#6B7280',
    marginBottom: scale(16),
    lineHeight: fontScale(21),
  },
  sectionDescriptionDark: {
    color: '#9CA3AF',
  },
  infoCard: {
    backgroundColor: '#F9FAFB',
    borderRadius: scale(12),
    padding: scale(20),
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  infoCardDark: {
    backgroundColor: '#374151',
    borderColor: '#4B5563',
  },
  finalCostCard: {
    borderWidth: 2,
    borderColor: '#8B5CF6',
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: scale(8),
    marginBottom: scale(4),
  },
  infoLabel: {
    flex: 1,
    fontSize: fontScale(15),
    color: '#6B7280',
  },
  infoLabelDark: {
    color: '#9CA3AF',
  },
  infoValue: {
    fontSize: fontScale(16),
    fontWeight: '600',
    color: '#1F2937',
  },
  infoValueDark: {
    color: '#FFFFFF',
  },
  gemValue: {
    color: '#FFD700',
    fontWeight: 'bold',
  },
  infoSubtext: {
    fontSize: fontScale(12),
    color: '#9CA3AF',
    marginLeft: scale(26),
    marginTop: scale(4),
  },
  infoSubtextDark: {
    color: '#6B7280',
  },
  gemSubtext: {
    color: '#10B981',
    fontWeight: '500',
  },
  divider: {
    height: 1,
    backgroundColor: '#E5E7EB',
    marginVertical: scale(12),
  },
  totalRow: {
    marginTop: scale(4),
  },
  totalLabel: {
    flex: 1,
    fontSize: fontScale(18),
    fontWeight: 'bold',
    color: '#1F2937',
  },
  totalLabelDark: {
    color: '#FFFFFF',
  },
  totalValue: {
    fontSize: fontScale(18),
    fontWeight: 'bold',
    color: '#EF4444',
  },
  totalValueDark: {
    color: '#FCA5A5',
  },
  finalTotalValue: {
    color: '#8B5CF6',
    fontSize: fontScale(18),
  },
  savingsHighlight: {
    marginTop: scale(12),
    padding: scale(12),
    backgroundColor: '#D1FAE5',
    borderRadius: scale(8),
    borderWidth: 1,
    borderColor: '#10B981',
  },
  savingsText: {
    fontSize: fontScale(14),
    fontWeight: 'bold',
    color: '#059669',
    textAlign: 'center',
  },
  lawyerContainer: {
    gap: scale(12),
    marginBottom: scale(12),
  },
  lawyerCard: {
    borderRadius: scale(12),
    overflow: 'hidden',
    borderWidth: 2,
    borderColor: 'transparent',
  },
  lawyerCardSelected: {
    borderColor: '#8B5CF6',
  },
  lawyerCardDisabled: {
    opacity: 0.5,
  },
  lawyerCardDark: {
    // Handled by gradient
  },
  lawyerCardGradient: {
    padding: scale(18),
  },
  lawyerHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: scale(12),
  },
  lawyerHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: scale(10),
    flex: 1,
  },
  lawyerTierBadge: {
    width: scale(24),
    height: scale(24),
    borderRadius: scale(12),
    justifyContent: 'center',
    alignItems: 'center',
  },
  lawyerNameContainer: {
    flex: 1,
  },
  lawyerName: {
    fontSize: fontScale(18),
    fontWeight: '700',
    color: '#1F2937',
    marginBottom: scale(4),
  },
  lawyerNameDark: {
    color: '#FFFFFF',
  },
  lawyerNameSelected: {
    color: '#8B5CF6',
  },
  lawyerTagline: {
    fontSize: fontScale(11),
    color: '#6B7280',
    fontStyle: 'italic',
  },
  lawyerTaglineDark: {
    color: '#9CA3AF',
  },
  selectedBadge: {
    width: scale(24),
    height: scale(24),
    borderRadius: scale(12),
    backgroundColor: '#8B5CF6',
    justifyContent: 'center',
    alignItems: 'center',
  },
  selectedBadgeText: {
    color: '#FFFFFF',
    fontWeight: 'bold',
    fontSize: fontScale(14),
  },
  lawyerStats: {
    marginBottom: scale(12),
    gap: scale(6),
  },
  lawyerStatRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: scale(6),
  },
  lawyerStatLabel: {
    fontSize: fontScale(14),
    color: '#6B7280',
    flex: 1,
  },
  lawyerStatLabelDark: {
    color: '#9CA3AF',
  },
  lawyerStatValue: {
    fontSize: fontScale(14),
    fontWeight: '600',
    color: '#1F2937',
  },
  lawyerStatValueDark: {
    color: '#FFFFFF',
  },
  lawyerOutcome: {
    backgroundColor: 'rgba(139, 92, 246, 0.1)',
    borderRadius: scale(8),
    padding: scale(10),
    marginBottom: scale(10),
  },
  lawyerOutcomeDark: {
    backgroundColor: 'rgba(139, 92, 246, 0.2)',
  },
  lawyerOutcomeTitle: {
    fontSize: fontScale(14),
    fontWeight: '600',
    color: '#8B5CF6',
    marginBottom: scale(8),
  },
  lawyerOutcomeTitleDark: {
    color: '#C4B5FD',
  },
  lawyerOutcomeRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: scale(4),
  },
  lawyerOutcomeLabel: {
    fontSize: fontScale(13),
    color: '#6B7280',
  },
  lawyerOutcomeLabelDark: {
    color: '#9CA3AF',
  },
  lawyerOutcomeValue: {
    fontSize: fontScale(14),
    fontWeight: '600',
    color: '#1F2937',
  },
  lawyerOutcomeValueDark: {
    color: '#FFFFFF',
  },
  positiveSavings: {
    color: '#10B981',
  },
  negativeSavings: {
    color: '#EF4444',
  },
  lawyerROI: {
    fontSize: fontScale(10),
    color: '#8B5CF6',
    marginTop: scale(4),
    fontStyle: 'italic',
  },
  lawyerROIDark: {
    color: '#C4B5FD',
  },
  lawyerCostRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: scale(8),
    borderTopWidth: 1,
    borderTopColor: 'rgba(0,0,0,0.1)',
  },
  lawyerCostLabel: {
    fontSize: fontScale(16),
    fontWeight: '600',
    color: '#1F2937',
  },
  lawyerCostLabelDark: {
    color: '#FFFFFF',
  },
  lawyerCostValue: {
    fontSize: fontScale(18),
    fontWeight: 'bold',
    color: '#F59E0B',
  },
  lawyerCostValueDark: {
    color: '#FBBF24',
  },
  cannotAffordBadge: {
    marginTop: scale(8),
    padding: scale(6),
    backgroundColor: '#FEE2E2',
    borderRadius: scale(6),
  },
  cannotAffordText: {
    fontSize: fontScale(11),
    color: '#DC2626',
    fontWeight: '600',
    textAlign: 'center',
  },
  noLawyerOption: {
    padding: scale(12),
    borderRadius: scale(10),
    backgroundColor: '#F3F4F6',
    borderWidth: 2,
    borderColor: 'transparent',
    alignItems: 'center',
  },
  noLawyerOptionSelected: {
    borderColor: '#10B981',
    backgroundColor: '#D1FAE5',
  },
  noLawyerOptionDark: {
    backgroundColor: '#374151',
  },
  noLawyerText: {
    fontSize: fontScale(14),
    fontWeight: '600',
    color: '#6B7280',
  },
  noLawyerTextDark: {
    color: '#9CA3AF',
  },
  noLawyerTextSelected: {
    color: '#059669',
    fontWeight: 'bold',
  },
  effectsList: {
    backgroundColor: '#F9FAFB',
    borderRadius: scale(12),
    padding: scale(12),
  },
  effectsListDark: {
    backgroundColor: '#374151',
  },
  effectItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: scale(8),
    marginBottom: scale(8),
  },
  effectText: {
    fontSize: fontScale(15),
    color: '#6B7280',
  },
  effectTextDark: {
    color: '#9CA3AF',
  },
  errorBox: {
    backgroundColor: '#FEF2F2',
    borderRadius: scale(12),
    padding: scale(16),
    marginTop: scale(12),
    borderWidth: 2,
    borderColor: '#FEE2E2',
  },
  errorBoxDark: {
    backgroundColor: '#7F1D1D',
    borderColor: '#991B1B',
  },
  errorText: {
    fontSize: fontScale(16),
    color: '#DC2626',
    fontWeight: '600',
    textAlign: 'center',
  },
  footer: {
    flexDirection: 'row',
    gap: scale(12),
    padding: scale(20),
    borderTopWidth: 1,
    borderTopColor: 'rgba(0,0,0,0.1)',
  },
  footerDark: {
    borderTopColor: 'rgba(255,255,255,0.1)',
  },
  cancelButton: {
    flex: 1,
    padding: scale(16),
    borderRadius: scale(12),
    backgroundColor: '#F3F4F6',
    alignItems: 'center',
  },
  cancelButtonDark: {
    backgroundColor: '#374151',
  },
  cancelButtonText: {
    fontSize: fontScale(18),
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
    padding: scale(16),
    alignItems: 'center',
  },
  confirmButtonText: {
    fontSize: fontScale(18),
    fontWeight: '700',
    color: '#FFFFFF',
  },
});
