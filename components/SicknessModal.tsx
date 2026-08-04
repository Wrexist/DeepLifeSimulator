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
import BlurViewFallback from '@/components/fallbacks/BlurViewFallback';
import { X, Heart, Zap, Smile, Dumbbell, AlertTriangle, Stethoscope, Pill, Activity, Clock, Info, Sparkles } from 'lucide-react-native';
import { useGame, useItemActions } from '@/contexts/game';
import type { Disease } from '@/contexts/game/types';
import { styles } from '@/components/SicknessModalStyles';
import { getDiseaseTemplate } from '@/lib/diseases/diseaseDefinitions';
import { DOCTOR_MANAGEMENT_WEEKS, HOSPITAL_MANAGEMENT_WEEKS, isManageableDisease } from '@/lib/diseases/chronicCare';
import { logger } from '@/utils/logger';
import { policyAdjustedActivityPrice } from '@/lib/politics/healthcarePerks';
const LinearGradient = LinearGradientFallback;
const BlurView = BlurViewFallback;

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

  /**
   * GL-3: the treatment prices, from the catalogue and after enacted
   * healthcare policy — the same figures `performHealthActivity` charges.
   *
   * These were hardcoded 500 and 2000 in five places: the two `disabled`
   * gates, the two gradient colours, and the two price labels. That already
   * risked drifting from `healthActivities`, and once policy discounts the
   * real charge it also disables a button the player CAN afford — a player
   * with $1,600 and a 50% healthcare policy was refused a hospital stay that
   * now costs $1,000.
   */
  const treatmentPrice = (activityId: string, fallback: number): number => {
    const listed = gameState?.healthActivities?.find(a => a.id === activityId)?.price;
    return policyAdjustedActivityPrice(
      gameState,
      activityId,
      typeof listed === 'number' && Number.isFinite(listed) ? listed : fallback,
    );
  };
  const doctorPrice = treatmentPrice('doctor', 500);
  const hospitalPrice = treatmentPrice('hospital', 2000);

  // Debug logging for button state - development only
  useEffect(() => {
    if (__DEV__ && isVisible && diseases && diseases.length > 0) {
      const doctorDisabled = playerMoney < doctorPrice || isClosing || !performHealthActivity;
      const hospitalDisabled = playerMoney < hospitalPrice || isClosing || !performHealthActivity;

      logger.info('[SicknessModal] Button state:', {
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
    // Compute the desired visibility from external state only — NEVER include
    // `isVisible` in deps and set it from inside (that's an infinite-loop trap
    // that fires "Maximum update depth exceeded" warnings).
    const shouldShow = isInActiveGame && showSicknessModal && hasDiseases && !isClosing;

    if (isProcessingRef.current) return;

    if (shouldShow) {
      isProcessingRef.current = true;
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
  }, [isInActiveGame, showSicknessModal, hasDiseases, isClosing, fadeAnim]);

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

    // A disease with `weeksUntilDeath` that is NOT curable is terminal — no
    // treatment can cure it. Telling the player to "seek treatment for a cure"
    // (or that it "can be managed") would be misleading, so terminal diseases
    // get their own honest messaging.
    const isTerminal =
      !disease.curable &&
      'weeksUntilDeath' in disease &&
      typeof disease.weeksUntilDeath === 'number';

    if (isTerminal) {
      const weeksLeft = (disease as { weeksUntilDeath: number }).weeksUntilDeath;
      recommendations.push(
        `This is a terminal illness — approximately ${weeksLeft} week(s) remain and there is no cure.`,
      );
      recommendations.push('Treatment can ease symptoms but will not stop its progression.');
    } else if ('weeksUntilDeath' in disease && typeof disease.weeksUntilDeath === 'number' && disease.weeksUntilDeath <= 4) {
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
      recommendations.push('This condition is chronic — it cannot be cured, but treatment keeps it managed.');
      recommendations.push(`While managed (doctor visit: ${DOCTOR_MANAGEMENT_WEEKS} weeks, hospital stay: ${HOSPITAL_MANAGEMENT_WEEKS} weeks), symptoms are halved and the condition cannot worsen.`);
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
                    <X size={18} color={darkMode ? '#FFFFFF' : '#1E293B'} />
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
                    disabled={playerMoney < doctorPrice || isClosing || !performHealthActivity}
                    activeOpacity={0.7}
                  >
                    <LinearGradient
                      colors={playerMoney >= doctorPrice 
                        ? ['rgba(59, 130, 246, 0.7)', 'rgba(37, 99, 235, 0.8)'] 
                        : ['rgba(107, 114, 128, 0.4)', 'rgba(75, 85, 99, 0.5)']}
                      start={{ x: 0, y: 0 }}
                      end={{ x: 1, y: 1 }}
                      style={styles.treatmentButtonGradient}
                    >
                      <Stethoscope size={20} color="#FFFFFF" />
                      <Text style={styles.treatmentButtonText}>Visit Doctor</Text>
                      <Text style={styles.treatmentButtonPrice}>${doctorPrice.toLocaleString()}</Text>
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
                    disabled={playerMoney < hospitalPrice || isClosing || !performHealthActivity}
                    activeOpacity={0.7}
                  >
                    <LinearGradient
                      colors={playerMoney >= hospitalPrice && !isClosing
                        ? ['rgba(239, 68, 68, 0.7)', 'rgba(220, 38, 38, 0.8)']
                        : ['rgba(107, 114, 128, 0.4)', 'rgba(75, 85, 99, 0.5)']}
                      start={{ x: 0, y: 0 }}
                      end={{ x: 1, y: 1 }}
                      style={styles.treatmentButtonGradient}
                    >
                      <Heart size={20} color="#FFFFFF" />
                      <Text style={styles.treatmentButtonText}>Hospital Stay</Text>
                      <Text style={styles.treatmentButtonPrice}>${hospitalPrice.toLocaleString()}</Text>
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
                  const manageable = isManageableDisease(disease);
                  const managedWeeksLeft = manageable && typeof disease.managedUntilWeek === 'number'
                    ? Math.max(0, disease.managedUntilWeek - (gameState.weeksLived || 0))
                    : 0;

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

                        {/* Chronic-care status: managed (green, weeks left) vs
                            unmanaged (amber call-to-action). Only for
                            non-curable, treatment-requiring conditions. */}
                        {manageable && (
                          <View style={styles.curableBadge}>
                            <LinearGradient
                              colors={managedWeeksLeft > 0
                                ? (darkMode ? ['rgba(16, 185, 129, 0.3)', 'rgba(5, 150, 105, 0.4)'] : ['rgba(240, 253, 244, 0.8)', 'rgba(220, 252, 231, 0.9)'])
                                : (darkMode ? ['rgba(245, 158, 11, 0.3)', 'rgba(217, 119, 6, 0.4)'] : ['rgba(255, 251, 235, 0.8)', 'rgba(254, 243, 199, 0.9)'])}
                              start={{ x: 0, y: 0 }}
                              end={{ x: 1, y: 1 }}
                              style={styles.curableBadgeGradient}
                            >
                              <Text style={[
                                styles.curableText,
                                darkMode && styles.curableTextDark,
                                managedWeeksLeft <= 0 && { color: darkMode ? '#FCD34D' : '#B45309' },
                              ]}>
                                {managedWeeksLeft > 0
                                  ? `✓ Managed — ${managedWeeksLeft} week${managedWeeksLeft !== 1 ? 's' : ''} of care remaining`
                                  : '⚠ Unmanaged — visit a doctor to manage symptoms'}
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


export default React.memo(SicknessModal);
