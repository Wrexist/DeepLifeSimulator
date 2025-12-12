import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Modal,
  ScrollView,
  Alert,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { X, Heart, Zap, Smile, Dumbbell, AlertTriangle, Stethoscope, Pill, Activity } from 'lucide-react-native';
import { useGame, Disease } from '@/contexts/GameContext';
import { responsivePadding, responsiveFontSize, responsiveSpacing, responsiveBorderRadius, scale, verticalScale } from '@/utils/scaling';

export default function SicknessModal() {
  const { gameState, dismissSicknessModal, performHealthActivity } = useGame();
  const { showSicknessModal, diseases, settings, week } = gameState;
  const [isVisible, setIsVisible] = useState(false);
  const [isClosing, setIsClosing] = useState(false);
  const darkMode = settings.darkMode;
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Only show modal when in an active game (week > 0 indicates active game)
  const isInActiveGame = week > 0;

  useEffect(() => {
    if (isInActiveGame && showSicknessModal && diseases && diseases.length > 0 && !isClosing) {
      setIsVisible(true);
    } else {
      setIsVisible(false);
    }
  }, [isInActiveGame, showSicknessModal, diseases, isClosing]);

  // Cleanup effect to reset state when component unmounts
  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
        timeoutRef.current = null;
      }
      setIsClosing(false);
      setIsVisible(false);
    };
  }, []);

  const handleClose = useCallback(() => {
    if (isClosing) return; // Prevent multiple close calls
    
    // Clear any existing timeout
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }
    
    setIsClosing(true);
    setIsVisible(false);
    
    // Dismiss the modal immediately
    dismissSicknessModal();
    
    // Reset closing state after animation
    timeoutRef.current = setTimeout(() => {
      setIsClosing(false);
      timeoutRef.current = null;
    }, 300);
  }, [isClosing, dismissSicknessModal]);

  // Don't render if not in active game or if conditions aren't met
  if (!isInActiveGame || !showSicknessModal || !diseases || diseases.length === 0 || !isVisible) {
    return null;
  }


  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'mild': return '#F59E0B';
      case 'serious': return '#EF4444';
      case 'critical': return '#DC2626';
      default: return '#6B7280';
    }
  };

  const getSeverityIcon = (severity: string) => {
    switch (severity) {
      case 'mild': return '⚠️';
      case 'serious': return '🚨';
      case 'critical': return '💀';
      default: return '❓';
    }
  };

  const getEffectIcon = (stat: string) => {
    switch (stat) {
      case 'health': return <Heart size={16} color="#EF4444" />;
      case 'energy': return <Zap size={16} color="#F59E0B" />;
      case 'happiness': return <Smile size={16} color="#10B981" />;
      case 'fitness': return <Dumbbell size={16} color="#8B5CF6" />;
      default: return <Activity size={16} color="#6B7280" />;
    }
  };

  const getTotalEffects = () => {
    const total: Record<string, number> = {};
    diseases.forEach(disease => {
      if (disease.effects) {
        Object.entries(disease.effects).forEach(([stat, value]) => {
          total[stat] = (total[stat] || 0) + (value || 0);
        });
      }
    });
    return total;
  };

  const totalEffects = getTotalEffects();

  return (
    <Modal
      visible={isVisible}
      transparent
      animationType="fade"
      onRequestClose={handleClose}
    >
      <View style={styles.overlay}>
        <View style={[styles.modal, darkMode && styles.modalDark]}>
          {/* Header */}
          <View style={[styles.header, darkMode && styles.headerDark]}>
            <View style={styles.headerLeft}>
              <Stethoscope size={24} color={darkMode ? '#FFFFFF' : '#1F2937'} />
              <Text style={[styles.title, darkMode && styles.titleDark]}>
                Health Status
              </Text>
            </View>
            <TouchableOpacity onPress={handleClose} style={styles.closeButton}>
              <X size={24} color={darkMode ? '#D1D5DB' : '#6B7280'} />
            </TouchableOpacity>
          </View>

          {/* Content */}
          <View style={styles.content}>
            <ScrollView 
              style={styles.scrollView}
              showsVerticalScrollIndicator={true}
              contentContainerStyle={styles.scrollContent}
            >
            {/* Total Effects Summary */}
            {Object.keys(totalEffects).length > 0 && (
              <View style={[styles.section, darkMode && styles.sectionDark]}>
                <View style={styles.sectionHeader}>
                  <AlertTriangle size={20} color={darkMode ? '#FFFFFF' : '#1F2937'} />
                  <Text style={[styles.sectionTitle, darkMode && styles.sectionTitleDark]}>
                    Total Effects
                  </Text>
                </View>
                
                <View style={[styles.effectsCard, darkMode && styles.effectsCardDark]}>
                  {Object.entries(totalEffects).map(([stat, value]) => (
                    <View key={stat} style={styles.effectRow}>
                      {getEffectIcon(stat)}
                      <Text style={[styles.effectLabel, darkMode && styles.effectLabelDark]}>
                        {stat.charAt(0).toUpperCase() + stat.slice(1)}:
                      </Text>
                      <Text style={[
                        styles.effectValue,
                        value < 0 ? styles.negativeEffect : styles.positiveEffect
                      ]}>
                        {value > 0 ? '+' : ''}{value}
                      </Text>
                    </View>
                  ))}
                </View>
              </View>
            )}

            {/* Individual Diseases */}
            <View style={[styles.section, darkMode && styles.sectionDark]}>
              <View style={styles.sectionHeader}>
                <Pill size={20} color={darkMode ? '#FFFFFF' : '#1F2937'} />
                <Text style={[styles.sectionTitle, darkMode && styles.sectionTitleDark]}>
                  Current Conditions
                </Text>
              </View>
              
              {diseases.map((disease, index) => (
                <View key={index} style={[styles.diseaseCard, darkMode && styles.diseaseCardDark]}>
                  <View style={styles.diseaseHeader}>
                    <View style={styles.diseaseTitleRow}>
                      <Text style={styles.severityIcon}>
                        {getSeverityIcon(disease.severity)}
                      </Text>
                      <Text style={[styles.diseaseName, darkMode && styles.diseaseNameDark]}>
                        {disease.name}
                      </Text>
                    </View>
                    <View style={[
                      styles.severityBadge,
                      { backgroundColor: getSeverityColor(disease.severity) }
                    ]}>
                      <Text style={styles.severityText}>
                        {disease.severity.toUpperCase()}
                      </Text>
                    </View>
                  </View>
                  
                  {disease.effects && Object.keys(disease.effects).length > 0 && (
                    <View style={styles.diseaseEffects}>
                      <Text style={[styles.effectsTitle, darkMode && styles.effectsTitleDark]}>
                        Effects:
                      </Text>
                      {Object.entries(disease.effects).map(([stat, value]) => (
                        <View key={stat} style={styles.diseaseEffectRow}>
                          {getEffectIcon(stat)}
                          <Text style={[styles.diseaseEffectLabel, darkMode && styles.diseaseEffectLabelDark]}>
                            {stat.charAt(0).toUpperCase() + stat.slice(1)}:
                          </Text>
                          <Text style={[
                            styles.diseaseEffectValue,
                            value! < 0 ? styles.negativeEffect : styles.positiveEffect
                          ]}>
                            {value! > 0 ? '+' : ''}{value}
                          </Text>
                        </View>
                      ))}
                    </View>
                  )}
                  
                  {disease.curable && (
                    <View style={[styles.curableBadge, darkMode && styles.curableBadgeDark]}>
                      <Text style={[styles.curableText, darkMode && styles.curableTextDark]}>
                        💊 Curable - Visit a doctor or hospital
                      </Text>
                    </View>
                  )}
                </View>
              ))}
            </View>

            {/* Quick Treatment Options */}
            <View style={[styles.section, darkMode && styles.sectionDark]}>
              <View style={styles.sectionHeader}>
                <Stethoscope size={20} color={darkMode ? '#FFFFFF' : '#1F2937'} />
                <Text style={[styles.sectionTitle, darkMode && styles.sectionTitleDark]}>
                  Quick Treatment
                </Text>
              </View>
              
              <View style={styles.treatmentButtons}>
                <TouchableOpacity 
                  style={[styles.treatmentButton, darkMode && styles.treatmentButtonDark]}
                  onPress={() => {
                    if (isClosing) return; // Prevent action if modal is closing
                    setIsClosing(true);
                    
                    // Perform the health activity
                    const result = performHealthActivity('doctor');
                    
                    // Close modal first, then show alert after a short delay
                    handleClose();
                    
                    // Show feedback message after modal closes
                    setTimeout(() => {
                      if (result) {
                        Alert.alert('Doctor Visit', result.message);
                      }
                    }, 350); // Wait for modal close animation
                  }}
                  disabled={gameState.stats.money < 500 || isClosing}
                >
                  <LinearGradient
                    colors={gameState.stats.money >= 500 ? ['#3B82F6', '#2563EB'] : ['#9CA3AF', '#6B7280']}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                    style={styles.treatmentButtonGradient}
                  >
                    <Stethoscope size={20} color="#FFFFFF" />
                    <Text style={styles.treatmentButtonText}>Visit Doctor</Text>
                    <Text style={styles.treatmentButtonPrice}>$500</Text>
                  </LinearGradient>
                </TouchableOpacity>

                <TouchableOpacity 
                  style={[styles.treatmentButton, darkMode && styles.treatmentButtonDark]}
                  onPress={() => {
                    if (isClosing) return; // Prevent action if modal is closing
                    setIsClosing(true);
                    
                    // Perform the health activity
                    const result = performHealthActivity('hospital');
                    
                    // Close modal first, then show alert after a short delay
                    handleClose();
                    
                    // Show feedback message after modal closes
                    setTimeout(() => {
                      if (result) {
                        Alert.alert('Hospital Stay', result.message);
                      }
                    }, 350); // Wait for modal close animation
                  }}
                  disabled={gameState.stats.money < 2000 || isClosing}
                >
                  <LinearGradient
                    colors={gameState.stats.money >= 2000 ? ['#EF4444', '#DC2626'] : ['#9CA3AF', '#6B7280']}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                    style={styles.treatmentButtonGradient}
                  >
                    <Heart size={20} color="#FFFFFF" />
                    <Text style={styles.treatmentButtonText}>Hospital Stay</Text>
                    <Text style={styles.treatmentButtonPrice}>$2,000</Text>
                  </LinearGradient>
                </TouchableOpacity>
              </View>
            </View>

            {/* Recommendations */}
            <View style={[styles.section, darkMode && styles.sectionDark]}>
              <View style={styles.sectionHeader}>
                <Heart size={20} color={darkMode ? '#FFFFFF' : '#1F2937'} />
                <Text style={[styles.sectionTitle, darkMode && styles.sectionTitleDark]}>
                  Recommendations
                </Text>
              </View>
              
              <View style={[styles.recommendationsCard, darkMode && styles.recommendationsCardDark]}>
                <Text style={[styles.recommendationText, darkMode && styles.recommendationTextDark]}>
                  • Rest and get plenty of sleep
                </Text>
                <Text style={[styles.recommendationText, darkMode && styles.recommendationTextDark]}>
                  • Stay hydrated and eat healthy foods
                </Text>
                <Text style={[styles.recommendationText, darkMode && styles.recommendationTextDark]}>
                  • Visit a doctor or hospital for treatment
                </Text>
                <Text style={[styles.recommendationText, darkMode && styles.recommendationTextDark]}>
                  • Avoid strenuous activities
                </Text>
              </View>
            </View>
            </ScrollView>
          </View>

          {/* Footer */}
          <View style={[styles.footer, darkMode && styles.footerDark]}>
            <TouchableOpacity onPress={handleClose} style={styles.continueButton}>
              <LinearGradient
                colors={['#EF4444', '#DC2626']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.buttonGradient}
              >
                <Text style={styles.buttonText}>I Understand</Text>
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
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: responsivePadding.horizontal,
  },
  modal: {
    backgroundColor: '#FFFFFF',
    borderRadius: responsiveBorderRadius.lg,
    width: '95%',
    height: '85%',
    maxHeight: '90%',
    boxShadow: '0px 10px 20px rgba(0, 0, 0, 0.25)',
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
    padding: responsiveSpacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  headerDark: {
    borderBottomColor: '#374151',
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  title: {
    fontSize: responsiveFontSize.xl,
    fontWeight: '700',
    color: '#1F2937',
    marginLeft: responsiveSpacing.sm,
  },
  titleDark: {
    color: '#FFFFFF',
  },
  closeButton: {
    padding: responsiveSpacing.sm,
  },
  content: {
    flex: 1,
    minHeight: 400,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: responsiveSpacing.lg,
    flexGrow: 1,
  },
  section: {
    marginBottom: responsiveSpacing.lg,
    backgroundColor: '#F9FAFB',
    borderRadius: responsiveBorderRadius.md,
    padding: responsiveSpacing.md,
  },
  sectionDark: {
    backgroundColor: '#374151',
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: responsiveSpacing.md,
  },
  sectionTitle: {
    fontSize: responsiveFontSize.lg,
    fontWeight: '600',
    color: '#1F2937',
    marginLeft: responsiveSpacing.sm,
  },
  sectionTitleDark: {
    color: '#FFFFFF',
  },
  effectsCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: responsiveBorderRadius.sm,
    padding: responsiveSpacing.md,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  effectsCardDark: {
    backgroundColor: '#4B5563',
    borderColor: '#6B7280',
  },
  effectRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: responsiveSpacing.sm,
  },
  effectLabel: {
    fontSize: responsiveFontSize.base,
    color: '#374151',
    marginLeft: responsiveSpacing.sm,
    flex: 1,
  },
  effectLabelDark: {
    color: '#D1D5DB',
  },
  effectValue: {
    fontSize: responsiveFontSize.base,
    fontWeight: '600',
  },
  positiveEffect: {
    color: '#10B981',
  },
  negativeEffect: {
    color: '#EF4444',
  },
  diseaseCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: responsiveBorderRadius.sm,
    padding: responsiveSpacing.md,
    marginBottom: responsiveSpacing.md,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  diseaseCardDark: {
    backgroundColor: '#4B5563',
    borderColor: '#6B7280',
  },
  diseaseHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: responsiveSpacing.sm,
  },
  diseaseTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  severityIcon: {
    fontSize: responsiveFontSize.lg,
    marginRight: responsiveSpacing.sm,
  },
  diseaseName: {
    fontSize: responsiveFontSize.lg,
    fontWeight: '600',
    color: '#1F2937',
  },
  diseaseNameDark: {
    color: '#FFFFFF',
  },
  severityBadge: {
    paddingHorizontal: responsiveSpacing.sm,
    paddingVertical: responsiveSpacing.xs,
    borderRadius: responsiveBorderRadius.sm,
  },
  severityText: {
    color: '#FFFFFF',
    fontSize: responsiveFontSize.xs,
    fontWeight: '700',
  },
  diseaseEffects: {
    marginTop: responsiveSpacing.sm,
  },
  effectsTitle: {
    fontSize: responsiveFontSize.sm,
    fontWeight: '600',
    color: '#374151',
    marginBottom: responsiveSpacing.sm,
  },
  effectsTitleDark: {
    color: '#D1D5DB',
  },
  diseaseEffectRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: responsiveSpacing.xs,
  },
  diseaseEffectLabel: {
    fontSize: responsiveFontSize.sm,
    color: '#6B7280',
    marginLeft: responsiveSpacing.sm,
    flex: 1,
  },
  diseaseEffectLabelDark: {
    color: '#9CA3AF',
  },
  diseaseEffectValue: {
    fontSize: responsiveFontSize.sm,
    fontWeight: '600',
  },
  curableBadge: {
    backgroundColor: '#F0FDF4',
    borderRadius: responsiveBorderRadius.sm,
    padding: responsiveSpacing.sm,
    marginTop: responsiveSpacing.sm,
    borderWidth: 1,
    borderColor: '#BBF7D0',
  },
  curableBadgeDark: {
    backgroundColor: '#064E3B',
    borderColor: '#059669',
  },
  curableText: {
    fontSize: responsiveFontSize.sm,
    color: '#166534',
    fontWeight: '500',
    textAlign: 'center',
  },
  curableTextDark: {
    color: '#10B981',
  },
  recommendationsCard: {
    backgroundColor: '#F3F4F6',
    borderRadius: responsiveBorderRadius.sm,
    padding: responsiveSpacing.md,
  },
  recommendationsCardDark: {
    backgroundColor: '#4B5563',
  },
  recommendationText: {
    fontSize: responsiveFontSize.sm,
    color: '#374151',
    marginBottom: responsiveSpacing.sm,
    lineHeight: responsiveFontSize.sm * 1.4,
  },
  recommendationTextDark: {
    color: '#D1D5DB',
  },
  footer: {
    padding: responsiveSpacing.lg,
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
  },
  footerDark: {
    borderTopColor: '#374151',
  },
  continueButton: {
    borderRadius: responsiveBorderRadius.md,
    overflow: 'hidden',
  },
  buttonGradient: {
    padding: responsiveSpacing.md,
    alignItems: 'center',
  },
  buttonText: {
    color: '#FFFFFF',
    fontSize: responsiveFontSize.lg,
    fontWeight: '600',
  },
  treatmentButtons: {
    flexDirection: 'row',
    gap: responsiveSpacing.md,
  },
  treatmentButton: {
    flex: 1,
    borderRadius: responsiveBorderRadius.md,
    overflow: 'hidden',
  },
  treatmentButtonDark: {
    // No additional dark mode styling needed for the button itself
  },
  treatmentButtonGradient: {
    padding: responsiveSpacing.md,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 80,
  },
  treatmentButtonText: {
    color: '#FFFFFF',
    fontSize: responsiveFontSize.base,
    fontWeight: '600',
    marginTop: responsiveSpacing.xs,
    textAlign: 'center',
  },
  treatmentButtonPrice: {
    color: '#FFFFFF',
    fontSize: responsiveFontSize.sm,
    fontWeight: '500',
    marginTop: responsiveSpacing.xs,
    opacity: 0.9,
  },
  debugTest: {
    borderRadius: 8,
  },
});