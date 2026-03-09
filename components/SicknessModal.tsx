import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Modal,
  ScrollView,
  Alert,
  Animated,
} from 'react-native';
import LinearGradientFallback from '@/components/fallbacks/LinearGradientFallback';
const LinearGradient = LinearGradientFallback;
import BlurViewFallback from '@/components/fallbacks/BlurViewFallback';
const BlurView = BlurViewFallback;
import { X, Heart, Zap, Smile, Dumbbell, AlertTriangle, Stethoscope, Pill, Activity, Clock, Info, Sparkles } from 'lucide-react-native';
import { useGame, useItemActions } from '@/contexts/game';
import type { Disease } from '@/contexts/game/types';
import { responsivePadding, responsiveFontSize, responsiveSpacing, responsiveBorderRadius, scale, fontScale } from '@/utils/scaling';
import { getDiseaseTemplate } from '@/lib/diseases/diseaseDefinitions';
import { logger } from '@/utils/logger';

function SicknessModal() {
  const { gameState, dismissSicknessModal } = useGame();
  const { performHealthActivity } = useItemActions();
  const { showSicknessModal, diseases, settings, week } = gameState;
  const [isVisible, setIsVisible] = useState(false);
  const [isClosing, setIsClosing] = useState(false);
  const darkMode = settings.darkMode;
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const fadeAnim = useRef(new Animated.Value(0)).current;
  
  // Safely get money with default value - access directly from gameState
  const playerMoney = gameState?.stats?.money ?? 0;
  
  // Debug logging for button state - development only
  useEffect(() => {
    if (__DEV__ && isVisible && diseases && diseases.length > 0) {
      const doctorDisabled = playerMoney < 500 || isClosing || !performHealthActivity;
      const hospitalDisabled = playerMoney < 2000 || isClosing || !performHealthActivity;

      console.log('[SicknessModal] Button state:', {
        playerMoney,
        isClosing,
        hasPerformHealthActivity: !!performHealthActivity,
        doctorDisabled,
        hospitalDisabled,
      });
    }
  }, [isVisible, playerMoney, isClosing, performHealthActivity, diseases]);

  // Only show modal when in an active game (week > 0 indicates active game)
  const isInActiveGame = week > 0;

  // Memoize diseases length to prevent unnecessary re-renders
  const diseasesLength = diseases?.length || 0;
  const hasDiseases = diseasesLength > 0;
  
  // Use a ref to track previous state and prevent unnecessary updates
  const prevStateRef = useRef({ showSicknessModal: false, hasDiseases: false, isClosing: false });
  const isProcessingRef = useRef(false);
  
  // Reset isClosing when modal should be visible
  useEffect(() => {
    if (isInActiveGame && showSicknessModal && hasDiseases && isVisible) {
      // Always reset isClosing when modal is visible to ensure buttons work
      setIsClosing(false);
    }
  }, [isInActiveGame, showSicknessModal, hasDiseases, isVisible]);
  
  useEffect(() => {
    // Check if state actually changed
    const stateChanged = 
      prevStateRef.current.showSicknessModal !== showSicknessModal ||
      prevStateRef.current.hasDiseases !== hasDiseases ||
      prevStateRef.current.isClosing !== isClosing;
    
    if (!stateChanged && isVisible === (isInActiveGame && showSicknessModal && hasDiseases && !isClosing)) {
      return; // No change needed
    }
    
    // Update ref
    prevStateRef.current = { showSicknessModal, hasDiseases, isClosing };
    
    // Prevent processing if already in progress
    if (isProcessingRef.current) return;
    
    const shouldShow = isInActiveGame && showSicknessModal && hasDiseases && !isClosing;
    
    if (shouldShow) {
      isProcessingRef.current = true;
      setIsClosing(false); // Reset isClosing when modal opens
      setIsVisible(true);
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 300,
        useNativeDriver: true,
      }).start(() => {
        isProcessingRef.current = false;
      });
    } else {
      isProcessingRef.current = true;
      Animated.timing(fadeAnim, {
        toValue: 0,
        duration: 200,
        useNativeDriver: true,
      }).start(() => {
        setIsVisible(false);
        isProcessingRef.current = false;
      });
    }
  }, [isInActiveGame, showSicknessModal, hasDiseases, isClosing, fadeAnim, isVisible]);

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
    Animated.timing(fadeAnim, {
      toValue: 0,
      duration: 200,
      useNativeDriver: true,
    }).start(() => {
      setIsVisible(false);
    });
    
    // Dismiss the modal immediately
    dismissSicknessModal();
    
    // Reset closing state after animation
    timeoutRef.current = setTimeout(() => {
      setIsClosing(false);
      timeoutRef.current = null;
    }, 300);
  }, [isClosing, dismissSicknessModal, fadeAnim]);

  // Don't render if not in active game or if conditions aren't met
  if (!isInActiveGame || !showSicknessModal || diseasesLength === 0 || !isVisible) {
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

  const getSeverityGradient = (severity: string) => {
    switch (severity) {
      case 'mild': return ['rgba(245, 158, 11, 0.3)', 'rgba(217, 119, 6, 0.4)'];
      case 'serious': return ['rgba(239, 68, 68, 0.3)', 'rgba(220, 38, 38, 0.4)'];
      case 'critical': return ['rgba(220, 38, 38, 0.4)', 'rgba(185, 28, 28, 0.5)'];
      default: return ['rgba(107, 114, 128, 0.3)', 'rgba(75, 85, 99, 0.4)'];
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

  // Get disease template for additional info
  const getDiseaseInfo = (disease: Disease) => {
    return getDiseaseTemplate(disease.id);
  };

  // Calculate disease duration
  const getDiseaseDuration = (disease: Disease) => {
    if ('contractedWeek' in disease && typeof disease.contractedWeek === 'number') {
      const weeksLived = gameState.weeksLived || 0;
      return Math.max(0, weeksLived - disease.contractedWeek);
    }
    return 0;
  };

  // Get treatment recommendations for a disease
  const getTreatmentRecommendations = (disease: Disease): string[] => {
    const template = getDiseaseInfo(disease);
    const recommendations: string[] = [];

    if ('weeksUntilDeath' in disease && typeof disease.weeksUntilDeath === 'number' && disease.weeksUntilDeath <= 4) {
      recommendations.push(`URGENT: Only ${disease.weeksUntilDeath} week(s) until death - seek immediate treatment!`);
      if (disease.severity === 'critical' && disease.curable) {
        recommendations.push('Experimental treatment recommended for critical diseases');
      } else if (disease.curable) {
        recommendations.push('Hospital stay recommended for guaranteed cure');
      }
    } else if (disease.curable) {
      if (disease.severity === 'critical') {
        recommendations.push('Experimental treatment required for critical diseases');
        recommendations.push('Hospital stay may help but may not cure critical diseases');
      } else if (disease.severity === 'serious') {
        recommendations.push('Hospital stay recommended for serious diseases (100% cure rate)');
        recommendations.push('Doctor visit has 50% chance to cure');
      } else {
        recommendations.push('Doctor visit recommended (50% cure rate)');
        recommendations.push('Hospital stay guarantees cure but costs more');
      }
    } else {
      recommendations.push('This disease is not curable but can be managed');
      recommendations.push('Regular doctor visits can help manage symptoms');
    }

    if ('naturalRecoveryWeeks' in disease && typeof disease.naturalRecoveryWeeks === 'number') {
      recommendations.push(`Natural recovery possible in ${disease.naturalRecoveryWeeks} week(s) with good health`);
    }

    if (template && template.preventionTips) {
      recommendations.push('Prevention tips: ' + template.preventionTips.join(', '));
    }

    return recommendations;
  };

  return (
    <Modal
      visible={isVisible}
      transparent
      animationType="fade"
      onRequestClose={handleClose}
    >
      <View style={styles.overlay}>
        <TouchableOpacity 
          style={StyleSheet.absoluteFill} 
          activeOpacity={1} 
          onPress={handleClose}
        >
          <View 
            style={[StyleSheet.absoluteFill, { backgroundColor: darkMode ? 'rgba(0, 0, 0, 0.7)' : 'rgba(0, 0, 0, 0.5)' }]}
          />
        </TouchableOpacity>
        
        <Animated.View
          style={[
            styles.container,
            {
              opacity: fadeAnim,
            },
          ]}
        >
          <LinearGradient
            colors={darkMode 
              ? ['rgba(31, 41, 55, 0.95)', 'rgba(17, 24, 39, 0.98)'] 
              : ['rgba(255, 255, 255, 0.95)', 'rgba(243, 244, 246, 0.98)']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.content}
          >
            {/* Header */}
            <BlurView intensity={20} style={styles.headerBlur}>
              <View style={styles.header}>
                <View style={styles.headerLeft}>
                  <View style={styles.headerIconContainer}>
                    <Stethoscope size={24} color={darkMode ? '#60A5FA' : '#3B82F6'} />
                    <Sparkles size={12} color={darkMode ? '#60A5FA' : '#3B82F6'} style={styles.sparkleIcon} />
                  </View>
                  <View>
                    <Text style={[styles.title, darkMode && styles.titleDark]}>
                      Health Status
                    </Text>
                    <Text style={[styles.subtitle, darkMode && styles.subtitleDark]}>
                      {diseases.length} active condition{diseases.length !== 1 ? 's' : ''}
                    </Text>
                  </View>
                </View>
                <TouchableOpacity 
                  onPress={handleClose} 
                  style={styles.closeButton}
                  activeOpacity={0.7}
                >
                  <View style={[styles.closeButtonInner, darkMode && styles.closeButtonInnerDark]}>
                    <X size={18} color={darkMode ? '#FFFFFF' : '#1F2937'} />
                  </View>
                </TouchableOpacity>
              </View>
            </BlurView>

            {/* Content */}
            <ScrollView 
              style={styles.scrollView}
              showsVerticalScrollIndicator={false}
              contentContainerStyle={styles.scrollContent}
            >
              {/* Total Effects Summary */}
              {Object.keys(totalEffects).length > 0 && (
                <View style={styles.section}>
                  <LinearGradient
                    colors={darkMode 
                      ? ['rgba(239, 68, 68, 0.15)', 'rgba(220, 38, 38, 0.2)'] 
                      : ['rgba(254, 242, 242, 0.8)', 'rgba(254, 226, 226, 0.9)']}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                    style={styles.effectsCard}
                  >
                    <View style={styles.sectionHeader}>
                      <View style={[styles.iconBadge, { backgroundColor: darkMode ? 'rgba(239, 68, 68, 0.2)' : 'rgba(239, 68, 68, 0.1)' }]}>
                        <AlertTriangle size={18} color="#EF4444" />
                      </View>
                      <Text style={[styles.sectionTitle, darkMode && styles.sectionTitleDark]}>
                        Total Effects
                      </Text>
                    </View>
                    
                    <View style={styles.effectsGrid}>
                      {Object.entries(totalEffects).map(([stat, value]) => (
                        <View key={stat} style={styles.effectItem}>
                          {getEffectIcon(stat)}
                          <Text style={[styles.effectLabel, darkMode && styles.effectLabelDark]}>
                            {stat.charAt(0).toUpperCase() + stat.slice(1)}
                          </Text>
                          <Text style={[
                            styles.effectValue,
                            value < 0 ? styles.negativeEffect : styles.positiveEffect
                          ]}>
                            {value > 0 ? '+' : ''}{Math.round(value)}
                          </Text>
                        </View>
                      ))}
                    </View>
                  </LinearGradient>
                </View>
              )}

              {/* Quick Treatment Options */}
              <View style={styles.section}>
                <View style={styles.sectionHeader}>
                  <View style={[styles.iconBadge, { backgroundColor: darkMode ? 'rgba(59, 130, 246, 0.2)' : 'rgba(59, 130, 246, 0.1)' }]}>
                    <Stethoscope size={18} color="#3B82F6" />
                  </View>
                  <Text style={[styles.sectionTitle, darkMode && styles.sectionTitleDark]}>
                    Quick Treatment
                  </Text>
                </View>
                
                <View style={styles.treatmentButtons}>
                  <TouchableOpacity 
                    style={styles.treatmentButton}
                    onPress={() => {
                      if (isClosing || !performHealthActivity) return;
                      setIsClosing(true);
                      try {
                        const result = performHealthActivity('doctor');
                        handleClose();
                        setTimeout(() => {
                          if (result) {
                            Alert.alert('Doctor Visit', result.message);
                          }
                        }, 350);
                      } catch (error) {
                        logger.error('[SicknessModal] Error performing doctor visit:', error);
                        Alert.alert('Error', 'Failed to perform doctor visit. Please try again.');
                        setIsClosing(false);
                      }
                    }}
                    disabled={playerMoney < 500 || isClosing || !performHealthActivity}
                    activeOpacity={0.7}
                  >
                    <LinearGradient
                      colors={playerMoney >= 500 
                        ? ['rgba(59, 130, 246, 0.7)', 'rgba(37, 99, 235, 0.8)'] 
                        : ['rgba(107, 114, 128, 0.4)', 'rgba(75, 85, 99, 0.5)']}
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
                    style={styles.treatmentButton}
                    onPress={() => {
                      if (isClosing || !performHealthActivity) return;
                      setIsClosing(true);
                      try {
                        const result = performHealthActivity('hospital');
                        handleClose();
                        setTimeout(() => {
                          if (result) {
                            Alert.alert('Hospital Stay', result.message);
                          }
                        }, 350);
                      } catch (error) {
                        logger.error('[SicknessModal] Error performing hospital stay:', error);
                        Alert.alert('Error', 'Failed to perform hospital stay. Please try again.');
                        setIsClosing(false);
                      }
                    }}
                    disabled={playerMoney < 2000 || isClosing || !performHealthActivity}
                    activeOpacity={0.7}
                  >
                    <LinearGradient
                      colors={playerMoney >= 2000 && !isClosing && performHealthActivity
                        ? ['rgba(239, 68, 68, 0.7)', 'rgba(220, 38, 38, 0.8)'] 
                        : ['rgba(107, 114, 128, 0.4)', 'rgba(75, 85, 99, 0.5)']}
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

              {/* Individual Diseases */}
              <View style={styles.section}>
                <View style={styles.sectionHeader}>
                  <View style={[styles.iconBadge, { backgroundColor: darkMode ? 'rgba(139, 92, 246, 0.2)' : 'rgba(139, 92, 246, 0.1)' }]}>
                    <Pill size={18} color="#8B5CF6" />
                  </View>
                  <Text style={[styles.sectionTitle, darkMode && styles.sectionTitleDark]}>
                    Current Conditions
                  </Text>
                </View>
                
                {diseases.map((disease, index) => {
                  const template = getDiseaseInfo(disease);
                  const duration = getDiseaseDuration(disease);
                  const weeksUntilDeath = 'weeksUntilDeath' in disease && typeof disease.weeksUntilDeath === 'number' ? disease.weeksUntilDeath : null;
                  const naturalRecoveryWeeks = 'naturalRecoveryWeeks' in disease && typeof disease.naturalRecoveryWeeks === 'number' ? disease.naturalRecoveryWeeks : null;
                  const contractedWeek = 'contractedWeek' in disease && typeof disease.contractedWeek === 'number' ? disease.contractedWeek : null;
                  const isUrgent = weeksUntilDeath !== null && weeksUntilDeath <= 4;

                  return (
                    <View key={index} style={styles.diseaseCardWrapper}>
                      <LinearGradient
                        colors={isUrgent 
                          ? ['rgba(220, 38, 38, 0.3)', 'rgba(185, 28, 28, 0.4)']
                          : getSeverityGradient(disease.severity)}
                        start={{ x: 0, y: 0 }}
                        end={{ x: 1, y: 1 }}
                        style={[styles.diseaseCard, isUrgent && styles.urgentDiseaseCard]}
                      >
                        <View style={styles.diseaseHeader}>
                          <View style={styles.diseaseTitleRow}>
                            <Text style={[styles.diseaseName, darkMode && styles.diseaseNameDark]}>
                              {disease.name}
                            </Text>
                            <View style={[styles.severityBadge, { backgroundColor: getSeverityColor(disease.severity) }]}>
                              <Text style={styles.severityText}>
                                {disease.severity.toUpperCase()}
                              </Text>
                            </View>
                          </View>
                        </View>

                        {/* Disease Description */}
                        {template && template.description && (
                          <View style={styles.diseaseDescription}>
                            <View style={styles.descriptionHeader}>
                              <Info size={14} color="#FFFFFF" />
                              <Text style={[styles.descriptionTitle, darkMode && styles.descriptionTitleDark]}>
                                Description
                              </Text>
                            </View>
                            <Text style={[styles.descriptionText, darkMode && styles.descriptionTextDark]}>
                              {template.description}
                            </Text>
                          </View>
                        )}

                        {/* Disease Timeline */}
                        {(contractedWeek !== null || duration > 0) && (
                          <View style={styles.diseaseTimeline}>
                            <View style={styles.timelineHeader}>
                              <Clock size={14} color="#FFFFFF" />
                              <Text style={[styles.timelineTitle, darkMode && styles.timelineTitleDark]}>
                                Timeline
                              </Text>
                            </View>
                            {contractedWeek !== null && (
                              <Text style={[styles.timelineText, darkMode && styles.timelineTextDark]}>
                                Contracted: Week {contractedWeek}
                              </Text>
                            )}
                            {duration > 0 && (
                              <Text style={[styles.timelineText, darkMode && styles.timelineTextDark]}>
                                Duration: {duration} week{duration !== 1 ? 's' : ''}
                              </Text>
                            )}
                          </View>
                        )}

                        {/* Death Countdown Progress */}
                        {weeksUntilDeath !== null && (
                          <View style={styles.deathCountdown}>
                            <View style={styles.countdownHeader}>
                              <AlertTriangle size={14} color={isUrgent ? '#DC2626' : '#F59E0B'} />
                              <Text style={[
                                styles.countdownTitle,
                                darkMode && styles.countdownTitleDark,
                                isUrgent && styles.urgentText
                              ]}>
                                {isUrgent ? 'URGENT: ' : ''}Weeks Until Death: {weeksUntilDeath}
                              </Text>
                            </View>
                            <View style={styles.progressBar}>
                              <LinearGradient
                                colors={isUrgent ? ['#DC2626', '#991B1B'] : ['#F59E0B', '#D97706']}
                                start={{ x: 0, y: 0 }}
                                end={{ x: 1, y: 0 }}
                                style={[
                                  styles.progressFill,
                                  { width: `${Math.max(0, Math.min(100, (weeksUntilDeath / 20) * 100))}%` }
                                ]}
                              />
                            </View>
                          </View>
                        )}

                        {/* Natural Recovery Progress */}
                        {naturalRecoveryWeeks !== null && (
                          <View style={styles.recoveryProgress}>
                            <View style={styles.recoveryHeader}>
                              <Heart size={14} color="#10B981" />
                              <Text style={[styles.recoveryTitle, darkMode && styles.recoveryTitleDark]}>
                                Natural Recovery: {naturalRecoveryWeeks} week{naturalRecoveryWeeks !== 1 ? 's' : ''} remaining
                              </Text>
                            </View>
                            <View style={styles.progressBar}>
                              <LinearGradient
                                colors={['#10B981', '#059669']}
                                start={{ x: 0, y: 0 }}
                                end={{ x: 1, y: 0 }}
                                style={[
                                  styles.progressFill,
                                  { 
                                    width: `${Math.max(0, Math.min(100, ((template?.naturalRecoveryWeeks || naturalRecoveryWeeks - naturalRecoveryWeeks) / (template?.naturalRecoveryWeeks || naturalRecoveryWeeks)) * 100))}%`
                                  }
                                ]}
                              />
                            </View>
                          </View>
                        )}
                      
                        {disease.effects && Object.keys(disease.effects).length > 0 && (
                          <View style={styles.diseaseEffects}>
                            <Text style={[styles.effectsTitle, darkMode && styles.effectsTitleDark]}>
                              Effects:
                            </Text>
                            <View style={styles.effectsList}>
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
                                    {value! > 0 ? '+' : ''}{Math.round(value!)}
                                  </Text>
                                </View>
                              ))}
                            </View>
                          </View>
                        )}
                      
                        {disease.curable && (
                          <View style={styles.curableBadge}>
                            <LinearGradient
                              colors={darkMode ? ['rgba(16, 185, 129, 0.3)', 'rgba(5, 150, 105, 0.4)'] : ['rgba(240, 253, 244, 0.8)', 'rgba(220, 252, 231, 0.9)']}
                              start={{ x: 0, y: 0 }}
                              end={{ x: 1, y: 1 }}
                              style={styles.curableBadgeGradient}
                            >
                              <Text style={[styles.curableText, darkMode && styles.curableTextDark]}>
                                ✓ Curable - Visit a doctor or hospital
                              </Text>
                            </LinearGradient>
                          </View>
                        )}
                      </LinearGradient>
                    </View>
                  );
                })}
              </View>

              {/* Disease History */}
              {gameState.diseaseHistory && gameState.diseaseHistory.totalDiseases > 0 && (
                <View style={styles.section}>
                  <View style={styles.sectionHeader}>
                    <View style={[styles.iconBadge, { backgroundColor: darkMode ? 'rgba(16, 185, 129, 0.2)' : 'rgba(16, 185, 129, 0.1)' }]}>
                      <Activity size={18} color="#10B981" />
                    </View>
                    <Text style={[styles.sectionTitle, darkMode && styles.sectionTitleDark]}>
                      Disease History
                    </Text>
                  </View>
                  
                  <LinearGradient
                    colors={darkMode 
                      ? ['rgba(55, 65, 81, 0.3)', 'rgba(31, 41, 55, 0.4)'] 
                      : ['rgba(243, 244, 246, 0.6)', 'rgba(229, 231, 235, 0.7)']}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                    style={styles.historyCard}
                  >
                    <View style={styles.historyStats}>
                      <View style={styles.historyStatItem}>
                        <Text style={[styles.historyStatValue, darkMode && styles.historyStatValueDark]}>
                          {gameState.diseaseHistory.totalDiseases}
                        </Text>
                        <Text style={[styles.historyStatLabel, darkMode && styles.historyStatLabelDark]}>
                          Total Diseases
                        </Text>
                      </View>
                      <View style={styles.historyStatItem}>
                        <Text style={[styles.historyStatValue, darkMode && styles.historyStatValueDark]}>
                          {gameState.diseaseHistory.totalCured}
                        </Text>
                        <Text style={[styles.historyStatLabel, darkMode && styles.historyStatLabelDark]}>
                          Cured
                        </Text>
                      </View>
                      <View style={styles.historyStatItem}>
                        <Text style={[styles.historyStatValue, darkMode && styles.historyStatValueDark]}>
                          {gameState.diseaseHistory.deathsFromDisease}
                        </Text>
                        <Text style={[styles.historyStatLabel, darkMode && styles.historyStatLabelDark]}>
                          Deaths
                        </Text>
                      </View>
                    </View>
                    
                    {gameState.diseaseHistory.diseases.length > 0 && (
                      <View style={styles.historyList}>
                        <Text style={[styles.historyListTitle, darkMode && styles.historyListTitleDark]}>
                          Past Diseases:
                        </Text>
                        {gameState.diseaseHistory.diseases.slice(-5).reverse().map((disease, index) => (
                          <View key={index} style={styles.historyItem}>
                            <Text style={[styles.historyItemText, darkMode && styles.historyItemTextDark]}>
                              {disease.name} ({disease.severity}) - Week {disease.contractedWeek}
                              {disease.curedWeek ? ` (Cured: Week ${disease.curedWeek})` : ' (Active)'}
                            </Text>
                          </View>
                        ))}
                      </View>
                    )}
                  </LinearGradient>
                </View>
              )}

              {/* Dynamic Treatment Recommendations */}
              <View style={styles.section}>
                <View style={styles.sectionHeader}>
                  <View style={[styles.iconBadge, { backgroundColor: darkMode ? 'rgba(245, 158, 11, 0.2)' : 'rgba(245, 158, 11, 0.1)' }]}>
                    <Heart size={18} color="#F59E0B" />
                  </View>
                  <Text style={[styles.sectionTitle, darkMode && styles.sectionTitleDark]}>
                    Treatment Recommendations
                  </Text>
                </View>
                
                <LinearGradient
                  colors={darkMode 
                    ? ['rgba(55, 65, 81, 0.3)', 'rgba(31, 41, 55, 0.4)'] 
                    : ['rgba(243, 244, 246, 0.6)', 'rgba(229, 231, 235, 0.7)']}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={styles.recommendationsCard}
                >
                  {diseases.length > 0 ? (
                    diseases.map((disease, index) => {
                      const recommendations = getTreatmentRecommendations(disease);
                      return (
                        <View key={index} style={styles.diseaseRecommendations}>
                          <Text style={[styles.diseaseRecommendationTitle, darkMode && styles.diseaseRecommendationTitleDark]}>
                            {disease.name}:
                          </Text>
                          {recommendations.map((rec, recIndex) => (
                            <Text key={recIndex} style={[
                              styles.recommendationText, 
                              darkMode && styles.recommendationTextDark,
                              rec.startsWith('URGENT') && styles.urgentRecommendation
                            ]}>
                              • {rec}
                            </Text>
                          ))}
                        </View>
                      );
                    })
                  ) : (
                    <>
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
                    </>
                  )}
                </LinearGradient>
              </View>
            </ScrollView>

            {/* Footer */}
            <View style={styles.footer}>
              <TouchableOpacity onPress={handleClose} style={styles.continueButton} activeOpacity={0.7}>
                <LinearGradient
                  colors={['rgba(239, 68, 68, 0.7)', 'rgba(220, 38, 38, 0.8)']}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={styles.buttonGradient}
                >
                  <Text style={styles.buttonText}>I Understand</Text>
                </LinearGradient>
              </TouchableOpacity>
            </View>
          </LinearGradient>
        </Animated.View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'flex-end',
    alignItems: 'center',
    padding: scale(12),
    paddingBottom: scale(40),
  },
  container: {
    width: '100%',
    maxWidth: scale(700),
    height: '85%',
    maxHeight: '85%',
    borderRadius: scale(24),
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: scale(20) },
    shadowOpacity: 0.4,
    shadowRadius: scale(30),
    elevation: 20,
  },
  content: {
    flex: 1,
    borderRadius: scale(24),
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.2)',
  },
  headerBlur: {
    borderTopLeftRadius: scale(24),
    borderTopRightRadius: scale(24),
    overflow: 'hidden',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: scale(20),
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.1)',
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  headerIconContainer: {
    position: 'relative',
    marginRight: responsiveSpacing.md,
  },
  sparkleIcon: {
    position: 'absolute',
    top: -2,
    right: -2,
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
    borderRadius: 8,
    padding: 2,
  },
  title: {
    fontSize: fontScale(24),
    fontWeight: '700',
    color: '#1F2937',
    letterSpacing: -0.5,
  },
  titleDark: {
    color: '#FFFFFF',
  },
  subtitle: {
    fontSize: fontScale(12),
    color: '#FFFFFF',
    marginTop: scale(2),
    fontWeight: '500',
  },
  subtitleDark: {
    color: '#FFFFFF',
  },
  closeButton: {
    width: scale(36),
    height: scale(36),
    borderRadius: scale(18),
    overflow: 'hidden',
  },
  closeButtonInner: {
    width: '100%',
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.1)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  closeButtonInnerDark: {
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: scale(20),
    paddingBottom: scale(20),
  },
  section: {
    marginBottom: scale(20),
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: scale(12),
  },
  iconBadge: {
    width: scale(32),
    height: scale(32),
    borderRadius: scale(16),
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: scale(10),
  },
  sectionTitle: {
    fontSize: fontScale(18),
    fontWeight: '700',
    color: '#1F2937',
    letterSpacing: -0.3,
  },
  sectionTitleDark: {
    color: '#FFFFFF',
  },
  effectsCard: {
    borderRadius: scale(16),
    padding: scale(16),
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.2)',
  },
  effectsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: scale(12),
  },
  effectItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.3)',
    paddingHorizontal: scale(12),
    paddingVertical: scale(8),
    borderRadius: scale(12),
    gap: scale(6),
    minWidth: scale(100),
  },
  effectLabel: {
    fontSize: fontScale(13),
    color: '#FFFFFF',
    fontWeight: '500',
  },
  effectLabelDark: {
    color: '#FFFFFF',
  },
  effectValue: {
    fontSize: fontScale(14),
    fontWeight: '700',
  },
  positiveEffect: {
    color: '#10B981',
  },
  negativeEffect: {
    color: '#EF4444',
  },
  diseaseCardWrapper: {
    marginBottom: scale(16),
  },
  diseaseCard: {
    borderRadius: scale(16),
    padding: scale(16),
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.2)',
  },
  urgentDiseaseCard: {
    borderWidth: 2,
    borderColor: 'rgba(220, 38, 38, 0.6)',
  },
  diseaseHeader: {
    marginBottom: scale(12),
  },
  diseaseTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    flexWrap: 'wrap',
    gap: scale(8),
  },
  diseaseName: {
    fontSize: fontScale(18),
    fontWeight: '700',
    color: '#1F2937',
    flex: 1,
  },
  diseaseNameDark: {
    color: '#FFFFFF',
  },
  severityBadge: {
    paddingHorizontal: scale(10),
    paddingVertical: scale(4),
    borderRadius: scale(8),
  },
  severityText: {
    color: '#FFFFFF',
    fontSize: fontScale(10),
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  diseaseDescription: {
    marginTop: scale(12),
    marginBottom: scale(12),
    padding: scale(12),
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    borderRadius: scale(12),
  },
  descriptionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: scale(6),
  },
  descriptionTitle: {
    fontSize: fontScale(12),
    fontWeight: '600',
    color: '#FFFFFF',
    marginLeft: scale(6),
  },
  descriptionTitleDark: {
    color: '#FFFFFF',
  },
  descriptionText: {
    fontSize: fontScale(13),
    color: '#FFFFFF',
    lineHeight: fontScale(13) * 1.5,
  },
  descriptionTextDark: {
    color: '#FFFFFF',
  },
  diseaseTimeline: {
    marginTop: scale(12),
    marginBottom: scale(12),
    padding: scale(12),
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    borderRadius: scale(12),
  },
  timelineHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: scale(6),
  },
  timelineTitle: {
    fontSize: fontScale(12),
    fontWeight: '600',
    color: '#FFFFFF',
    marginLeft: scale(6),
  },
  timelineTitleDark: {
    color: '#FFFFFF',
  },
  timelineText: {
    fontSize: fontScale(12),
    color: '#FFFFFF',
    marginTop: scale(4),
  },
  timelineTextDark: {
    color: '#FFFFFF',
  },
  deathCountdown: {
    marginTop: scale(12),
    marginBottom: scale(12),
    padding: scale(12),
    backgroundColor: 'rgba(220, 38, 38, 0.2)',
    borderRadius: scale(12),
  },
  countdownHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: scale(8),
  },
  countdownTitle: {
    fontSize: fontScale(13),
    fontWeight: '700',
    color: '#DC2626',
    marginLeft: scale(6),
  },
  countdownTitleDark: {
    color: '#FCA5A5',
  },
  urgentText: {
    color: '#DC2626',
    fontWeight: '800',
  },
  progressBar: {
    height: scale(8),
    backgroundColor: 'rgba(0, 0, 0, 0.2)',
    borderRadius: scale(4),
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: scale(4),
  },
  recoveryProgress: {
    marginTop: scale(12),
    marginBottom: scale(12),
    padding: scale(12),
    backgroundColor: 'rgba(16, 185, 129, 0.2)',
    borderRadius: scale(12),
  },
  recoveryHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: scale(8),
  },
  recoveryTitle: {
    fontSize: fontScale(13),
    fontWeight: '600',
    color: '#166534',
    marginLeft: scale(6),
  },
  recoveryTitleDark: {
    color: '#6EE7B7',
  },
  diseaseEffects: {
    marginTop: scale(12),
    padding: scale(12),
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    borderRadius: scale(12),
  },
  effectsTitle: {
    fontSize: fontScale(13),
    fontWeight: '600',
    color: '#FFFFFF',
    marginBottom: scale(8),
  },
  effectsTitleDark: {
    color: '#FFFFFF',
  },
  effectsList: {
    gap: scale(6),
  },
  diseaseEffectRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: scale(8),
  },
  diseaseEffectLabel: {
    fontSize: fontScale(12),
    color: '#FFFFFF',
    flex: 1,
  },
  diseaseEffectLabelDark: {
    color: '#FFFFFF',
  },
  diseaseEffectValue: {
    fontSize: fontScale(12),
    fontWeight: '600',
  },
  curableBadge: {
    marginTop: scale(12),
    borderRadius: scale(12),
    overflow: 'hidden',
  },
  curableBadgeGradient: {
    padding: scale(10),
    alignItems: 'center',
  },
  curableText: {
    fontSize: fontScale(12),
    color: '#166534',
    fontWeight: '600',
  },
  curableTextDark: {
    color: '#10B981',
  },
  treatmentButtons: {
    flexDirection: 'row',
    gap: scale(12),
    width: '100%',
  },
  treatmentButton: {
    flex: 1,
    borderRadius: scale(16),
    overflow: 'hidden',
    minWidth: 0, // Ensure equal distribution
  },
  treatmentButtonGradient: {
    padding: scale(16),
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: scale(100),
    height: scale(100),
  },
  treatmentButtonText: {
    color: '#FFFFFF',
    fontSize: fontScale(15),
    fontWeight: '700',
    marginTop: scale(8),
    textAlign: 'center',
    width: '100%',
  },
  treatmentButtonPrice: {
    color: '#FFFFFF',
    fontSize: fontScale(12),
    fontWeight: '500',
    marginTop: scale(4),
    opacity: 0.9,
    textAlign: 'center',
    width: '100%',
  },
  historyCard: {
    borderRadius: scale(16),
    padding: scale(16),
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.2)',
  },
  historyStats: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginBottom: scale(16),
  },
  historyStatItem: {
    alignItems: 'center',
  },
  historyStatValue: {
    fontSize: fontScale(24),
    fontWeight: '700',
    color: '#1F2937',
  },
  historyStatValueDark: {
    color: '#FFFFFF',
  },
  historyStatLabel: {
    fontSize: fontScale(11),
    color: '#FFFFFF',
    marginTop: scale(4),
    fontWeight: '500',
  },
  historyStatLabelDark: {
    color: '#FFFFFF',
  },
  historyList: {
    marginTop: scale(12),
  },
  historyListTitle: {
    fontSize: fontScale(13),
    fontWeight: '600',
    color: '#FFFFFF',
    marginBottom: scale(8),
  },
  historyListTitleDark: {
    color: '#FFFFFF',
  },
  historyItem: {
    marginBottom: scale(6),
    paddingLeft: scale(8),
  },
  historyItemText: {
    fontSize: fontScale(11),
    color: '#FFFFFF',
    lineHeight: fontScale(11) * 1.4,
  },
  historyItemTextDark: {
    color: '#FFFFFF',
  },
  recommendationsCard: {
    borderRadius: scale(16),
    padding: scale(16),
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.2)',
  },
  recommendationText: {
    fontSize: fontScale(13),
    color: '#FFFFFF',
    marginBottom: scale(8),
    lineHeight: fontScale(13) * 1.5,
  },
  recommendationTextDark: {
    color: '#FFFFFF',
  },
  diseaseRecommendations: {
    marginBottom: scale(12),
  },
  diseaseRecommendationTitle: {
    fontSize: fontScale(14),
    fontWeight: '700',
    color: '#1F2937',
    marginBottom: scale(6),
  },
  diseaseRecommendationTitleDark: {
    color: '#F9FAFB',
  },
  urgentRecommendation: {
    color: '#DC2626',
    fontWeight: '700',
  },
  footer: {
    padding: scale(20),
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.1)',
  },
  continueButton: {
    borderRadius: scale(16),
    overflow: 'hidden',
  },
  buttonGradient: {
    padding: scale(16),
    alignItems: 'center',
  },
  buttonText: {
    color: '#FFFFFF',
    fontSize: fontScale(16),
    fontWeight: '700',
  },
});

export default React.memo(SicknessModal);
