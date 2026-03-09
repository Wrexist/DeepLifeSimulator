import React, { useCallback, useRef } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Modal, ScrollView, Dimensions } from 'react-native';
import { AlertTriangle, CheckCircle, XCircle, Sparkles, Leaf, Sun, Snowflake, X, TrendingUp, TrendingDown, DollarSign, ArrowUp, ArrowDown } from 'lucide-react-native';
import type { EnhancedEventChoice } from '@/lib/events/engine';
import { useGameState, useGameActions } from '@/contexts/GameContext';
import { getCurrentSeason } from '@/lib/events/seasonalEvents';
import { getCurrentEconomicState } from '@/lib/events/economyEvents';
import { logger } from '@/utils/logger';
import { formatMoney } from '@/utils/moneyFormatting';

const { height: screenHeight } = Dimensions.get('window');
const log = logger.scope('WeeklyEventModal');

export default function WeeklyEventModal() {
  const { gameState, setGameState } = useGameState();
  const { resolveEvent, saveGame } = useGameActions();

  // CRASH FIX: Safe array access - prevent crash if pendingEvents is empty/undefined
  const event = gameState.pendingEvents && gameState.pendingEvents.length > 0
    ? gameState.pendingEvents[0]
    : null;

  const { settings } = gameState;
  const pet = event ? gameState.pets.find(p => p.id === event.relationId) : undefined;

  // Emergency dismiss function - clears the current event if something is wrong
  const handleEmergencyDismiss = useCallback(() => {
    log.warn('Emergency dismiss triggered for event:', { eventId: event?.id });
    setGameState(prev => ({
      ...prev,
      pendingEvents: prev.pendingEvents.slice(1), // Remove the first (current) event
    }));
    saveGame();
  }, [setGameState, saveGame, event?.id]);

  // Safe resolve handler with error catching
  const resolvingRef = useRef<Set<string>>(new Set());
  const handleResolveEvent = useCallback((eventId: string, choiceId: string) => {
    const resolutionKey = `${eventId}_${choiceId}`;
    
    // Prevent duplicate calls
    if (resolvingRef.current.has(resolutionKey)) {
      log.warn('Event resolution already in progress, skipping duplicate call', { eventId, choiceId });
      return;
    }
    
    resolvingRef.current.add(resolutionKey);
    
    try {
      log.info('Resolving event', { eventId, choiceId });
      resolveEvent(eventId, choiceId);
      
      // Remove from pending after a short delay to allow state update
      setTimeout(() => {
        resolvingRef.current.delete(resolutionKey);
      }, 100);
    } catch (error) {
      log.error('Error resolving event:', error);
      resolvingRef.current.delete(resolutionKey);
      // If resolve fails, dismiss the event to prevent being stuck
      handleEmergencyDismiss();
    }
  }, [resolveEvent, handleEmergencyDismiss]);

  if (!event) return null;

  // Validate event has choices
  if (!event.choices || !Array.isArray(event.choices) || event.choices.length === 0) {
    log.error('Event has no valid choices, auto-dismissing:', event.id);
    // Auto-dismiss malformed events
    handleEmergencyDismiss();
    return null;
  }

  // Check if this is a seasonal event
  const seasonalEventIds = [
    'spring_festival', 'garden_event', 'beach_party', 'summer_sale',
    'harvest_festival', 'career_fair', 'winter_holidays', 'new_year',
    'valentines_day', 'halloween', 'christmas', 'easter_egg_hunt',
    'spring_cleaning', 'summer_music_festival', 'national_holiday',
    'thanksgiving_feast', 'black_friday_sale', 'new_years_resolution', 'winter_market'
  ];
  
  // Check if this is an economic event
  const economicEventIds = [
    'economic_recession', 'economic_boom', 'market_crash', 'inflation_spike', 'job_market_shift'
  ];
  const isEconomicEvent = economicEventIds.includes(event.id);
  
  // Check if this is a personal crisis event
  const personalCrisisEventIds = [
    'medical_emergency', 'identity_theft', 'investment_opportunity',
    'job_offer', 'relationship_crisis', 'legal_issue'
  ];
  const isPersonalCrisisEvent = personalCrisisEventIds.includes(event.id);
  
  const isSeasonalEvent = seasonalEventIds.includes(event.id);
  const seasonData = isSeasonalEvent ? getCurrentSeason(gameState.weeksLived || 0) : null;

  // Determine event type for notification design
  // Green (good): seasonal events, economic boom, good events
  // Yellow (warning): personal crisis that aren't too bad, warnings
  // Red (bad): recession, market crash, medical emergency, etc.
  const getEventType = (): 'good' | 'warning' | 'bad' => {
    // Good events (green)
    if (isSeasonalEvent) return 'good';
    if (event.id === 'economic_boom') return 'good';
    if (event.id === 'lottery_win' || event.id === 'found_wallet' || event.id === 'charity_event' || 
        event.id === 'job_bonus' || event.id === 'investment_opportunity' || event.id === 'job_offer') {
      return 'good';
    }
    
    // Bad events (red)
    if (event.id === 'economic_recession' || event.id === 'market_crash' || event.id === 'inflation_spike') {
      return 'bad';
    }
    if (event.id === 'medical_emergency' || event.id === 'identity_theft' || event.id === 'legal_issue' ||
        event.id === 'burglary' || event.id === 'police_raid' || event.id === 'court_trial') {
      return 'bad';
    }
    
    // Warning events (yellow) - everything else
    return 'warning';
  };

  const eventType = getEventType();

  const getSeasonalTheme = () => {
    if (!seasonData) return null;
    
    switch (seasonData.season) {
      case 'spring':
        return {
          icon: Leaf,
          gradient: ['#10B981', '#059669'],
          headerGradient: ['#10B981', '#059669'],
        };
      case 'summer':
        return {
          icon: Sun,
          gradient: ['#F59E0B', '#D97706'],
          headerGradient: ['#F59E0B', '#D97706'],
        };
      case 'fall':
        return {
          icon: Leaf, // Using Leaf for fall (LeafFall doesn't exist in lucide-react-native)
          gradient: ['#EF4444', '#DC2626'],
          headerGradient: ['#EF4444', '#DC2626'],
        };
      case 'winter':
        return {
          icon: Snowflake,
          gradient: ['#3B82F6', '#2563EB'],
          headerGradient: ['#3B82F6', '#2563EB'],
        };
    }
  };

  const seasonalTheme = getSeasonalTheme();
  const SeasonalIcon = seasonalTheme?.icon;

  // Get notification style based on event type
  const getNotificationStyle = () => {
    switch (eventType) {
      case 'good':
        return {
          backgroundColor: '#065F46', // Dark green
          borderColor: '#10B981', // Lighter green border
          icon: CheckCircle,
          iconColor: '#10B981',
          title: isSeasonalEvent ? 'Seasonal Event' : 'Good News',
          titleColor: '#FFFFFF',
        };
      case 'warning':
        return {
          backgroundColor: '#1F2937', // Dark gray
          borderColor: '#F59E0B', // Yellow border
          icon: AlertTriangle,
          iconColor: '#F59E0B',
          title: isPersonalCrisisEvent ? 'Personal Crisis' : 'Warning',
          titleColor: '#FFFFFF',
        };
      case 'bad':
        return {
          backgroundColor: '#1F2937', // Dark gray
          borderColor: '#EF4444', // Red border
          icon: XCircle,
          iconColor: '#EF4444',
          title: isEconomicEvent ? 'Economic Event' : 'Error',
          titleColor: '#FFFFFF',
        };
    }
  };

  const notificationStyle = getNotificationStyle();
  const NotificationIcon = notificationStyle.icon;

  return (
    <Modal visible transparent animationType="fade" onRequestClose={handleEmergencyDismiss}>
      <View style={styles.overlay}>
        <View style={[
          styles.container,
          { backgroundColor: notificationStyle.backgroundColor, borderColor: notificationStyle.borderColor }
        ]}>
          {/* Emergency close button in corner */}
          <TouchableOpacity 
            style={styles.closeButton} 
            onPress={handleEmergencyDismiss}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <X size={20} color="#FFFFFF" />
          </TouchableOpacity>
          
          <ScrollView 
            style={styles.scrollView}
            contentContainerStyle={styles.scrollContent}
            showsVerticalScrollIndicator={true}
            bounces={true}
          >
            <View style={styles.header}>
              <View style={styles.iconCircle}>
                <NotificationIcon size={24} color={notificationStyle.iconColor} />
              </View>
              <Text style={[styles.notificationTitle, { color: notificationStyle.titleColor }]}>
                {notificationStyle.title}
              </Text>
            </View>
            
            <Text style={styles.notificationDescription}>
              {event.description || 'An event has occurred.'}
            </Text>
            
            {/* Show economic event effects */}
            {isEconomicEvent && (() => {
              const econState = getCurrentEconomicState(gameState);
              if (econState && event.id !== 'economic_event_end') {
                // Calculate percentage changes correctly (multiplier - 1, then * 100)
                const incomeChangePercent = ((econState.modifiers.incomeMultiplier - 1) * 100);
                const volatilityChangePercent = ((econState.modifiers.stockVolatility - 1) * 100);
                const jobChangePercent = ((econState.modifiers.jobAvailability - 1) * 100);
                
                // Format with proper sign and no decimal places
                const incomeChange = incomeChangePercent >= 0 
                  ? `+${incomeChangePercent.toFixed(0)}` 
                  : incomeChangePercent.toFixed(0);
                const volatilityChange = volatilityChangePercent >= 0 
                  ? `+${volatilityChangePercent.toFixed(0)}` 
                  : volatilityChangePercent.toFixed(0);
                const jobChange = jobChangePercent >= 0 
                  ? `+${jobChangePercent.toFixed(0)}` 
                  : jobChangePercent.toFixed(0);
                
                // Calculate weeks remaining: duration - (current week - start week)
                // When event first appears, weeksLived equals stateStartWeek, so weeksRemaining = duration
                // Each subsequent week, weeksRemaining decreases by 1
                const weeksInState = gameState.weeksLived - econState.stateStartWeek;
                const weeksRemaining = Math.max(0, econState.stateDuration - weeksInState);
                
                return (
                  <View style={[styles.economicInfo, styles.economicInfoDark]}>
                    <Text style={[styles.economicInfoTitle]}>
                      Economic Effects (Active for {weeksRemaining} more week{weeksRemaining !== 1 ? 's' : ''}):
                    </Text>
                    <View style={styles.economicStats}>
                      <View style={styles.economicStat}>
                        <DollarSign size={16} color={incomeChangePercent < 0 ? '#EF4444' : '#10B981'} />
                        <Text style={styles.economicStatText}>
                          Income: {incomeChange}%
                        </Text>
                      </View>
                      <View style={styles.economicStat}>
                        <TrendingUp size={16} color="#F59E0B" />
                        <Text style={styles.economicStatText}>
                          Stock Volatility: {volatilityChange}%
                        </Text>
                      </View>
                      <View style={styles.economicStat}>
                        <TrendingDown size={16} color={jobChangePercent < 0 ? '#EF4444' : '#10B981'} />
                        <Text style={styles.economicStatText}>
                          Job Availability: {jobChange}%
                        </Text>
                      </View>
                    </View>
                  </View>
                );
              }
              return null;
            })()}
            
            {pet && (
              <View style={styles.petInfo}>
                <Text style={[styles.petText, settings.darkMode && styles.petTextDark]}>
                  {pet.name} â€" Hunger {pet.hunger} â€¢ Happiness {pet.happiness}
                </Text>
              </View>
            )}
            
            {/* Show choice effects preview */}
            <View style={[styles.choiceEffectsInfo, styles.choiceEffectsInfoDark]}>
              <Text style={styles.choiceEffectsTitle}>
                Choice Effects
              </Text>
              {event.choices.map((choice) => {
                const effects = choice.effects || {};
                const moneyChange = effects.money || 0;
                const statChanges = effects.stats || {};
                const hasEffects = moneyChange !== 0 || Object.keys(statChanges).length > 0;
                
                if (!hasEffects) return null;
                
                return (
                  <View key={choice.id} style={styles.choiceEffect}>
                    <Text style={styles.choiceEffectLabel}>
                      {choice.text}
                    </Text>
                    <View style={styles.choiceEffectDetails}>
                      {moneyChange !== 0 && (
                        <View style={[styles.effectBadge, moneyChange > 0 ? styles.positiveBadge : styles.negativeBadge]}>
                          <Text style={styles.effectBadgeText}>
                            {moneyChange > 0 ? '+' : ''}{formatMoney(moneyChange)}
                          </Text>
                        </View>
                      )}
                      {Object.entries(statChanges).map(([stat, change]) => (
                        <View key={stat} style={[styles.effectBadge, (change as number) > 0 ? styles.positiveBadge : styles.negativeBadge]}>
                          <Text style={styles.effectBadgeText}>
                            {stat.charAt(0).toUpperCase() + stat.slice(1)} {(change as number) > 0 ? '+' : ''}{change}
                          </Text>
                        </View>
                      ))}
                    </View>
                  </View>
                );
              })}
            </View>
            
            <View style={styles.choicesContainer}>
              {event.choices.map((choice, index) => {
                const enhancedChoice = choice as EnhancedEventChoice;
                
                return (
                  <TouchableOpacity
                    key={choice.id || `choice-${index}`}
                    style={[
                      styles.choiceButton,
                      index === 0 ? styles.primaryChoice : styles.secondaryChoice,
                      settings.darkMode && styles.choiceButton
                    ]}
                    onPress={() => handleResolveEvent(event.id, choice.id)}
                    activeOpacity={0.8}
                  >
                    <View style={[
                      styles.choiceButtonContent,
                      index === 0 ? styles.primaryChoiceContent : styles.secondaryChoiceContent
                    ]}>
                      <View style={styles.choiceContent}>
                        {index === 0 ? (
                          <CheckCircle size={20} color="#FFFFFF" />
                        ) : (
                          <XCircle size={20} color="#9CA3AF" />
                        )}
                        <Text style={[
                          styles.choiceText,
                          index === 0 ? styles.primaryChoiceText : styles.secondaryChoiceText
                        ]}>
                          {choice.text || 'Continue'}
                        </Text>
                      </View>
                      
                      {/* Tradeoff Display (NEW) - shows gains and losses */}
                      {enhancedChoice.tradeoffs && (
                        <View style={styles.tradeoffContainer}>
                          {/* Gains */}
                          {enhancedChoice.tradeoffs.gain.length > 0 && (
                            <View style={styles.gainContainer}>
                              <Text style={styles.tradeoffLabel}>
                                You gain:
                              </Text>
                              {enhancedChoice.tradeoffs.gain.map((gain, i) => (
                                <View key={i} style={styles.tradeoffItem}>
                                  <ArrowUp size={14} color="#10B981" />
                                  <Text style={styles.gainText}>{gain.label}</Text>
                                </View>
                              ))}
                            </View>
                          )}
                          
                          {/* Losses */}
                          {enhancedChoice.tradeoffs.lose.length > 0 && (
                            <View style={styles.loseContainer}>
                              <Text style={styles.tradeoffLabel}>
                                You lose:
                              </Text>
                              {enhancedChoice.tradeoffs.lose.map((loss, i) => (
                                <View key={i} style={styles.tradeoffItem}>
                                  <ArrowDown size={14} color="#EF4444" />
                                  <Text style={styles.loseText}>{loss.label}</Text>
                                </View>
                              ))}
                            </View>
                          )}
                        </View>
                      )}
                      
                      {/* Emotional Impact Indicator (NEW) */}
                      {enhancedChoice.emotionalImpact && (
                        <View style={styles.emotionalIndicator}>
                          <Text style={styles.emotionalText}>
                            {enhancedChoice.emotionalImpact === 'high' ? '💔 High Impact' :
                             enhancedChoice.emotionalImpact === 'medium' ? '💛 Medium Impact' :
                             '💚 Low Impact'}
                          </Text>
                        </View>
                      )}
                    </View>
                  </TouchableOpacity>
                );
              })}
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
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  container: {
    borderRadius: 12,
    padding: 20,
    width: '100%',
    maxWidth: 400,
    maxHeight: screenHeight * 0.8,
    borderWidth: 2,
    boxShadow: '0px 8px 16px rgba(0, 0, 0, 0.3)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.3,
    shadowRadius: 16,
    elevation: 12,
  },
  closeButton: {
    position: 'absolute',
    top: 12,
    right: 12,
    zIndex: 10,
    padding: 4,
    backgroundColor: 'transparent',
    borderRadius: 12,
  },
  scrollView: {
    width: '100%',
    flexGrow: 0,
    flexShrink: 1,
  },
  scrollContent: {
    alignItems: 'center',
    paddingTop: 8,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
    gap: 12,
  },
  iconCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  notificationTitle: {
    fontSize: 18,
    fontWeight: '600',
    flex: 1,
  },
  notificationDescription: {
    fontSize: 14,
    color: '#D1D5DB',
    textAlign: 'left',
    lineHeight: 20,
    marginBottom: 20,
    opacity: 0.9,
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#1F2937',
    marginLeft: 8,
  },
  titleDark: {
    color: '#F9FAFB',
  },
  seasonalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#FFFFFF',
    marginLeft: 4,
  },
  economicTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#FFFFFF',
    marginLeft: 4,
  },
  crisisTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#FFFFFF',
    marginLeft: 4,
  },
  description: {
    fontSize: 16,
    color: '#374151',
    textAlign: 'center',
    lineHeight: 24,
    marginBottom: 20,
  },
  descriptionDark: {
    color: '#D1D5DB',
  },
  petInfo: {
    backgroundColor: 'rgba(0, 0, 0, 0.2)',
    borderRadius: 8,
    padding: 12,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  petText: {
    textAlign: 'center',
    color: '#D1D5DB',
    fontSize: 14,
  },
  choicesContainer: {
    gap: 12,
  },
  choiceButton: {
    borderRadius: 8,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  primaryChoice: {
    shadowColor: '#059669',
    shadowOpacity: 0.2,
  },
  secondaryChoice: {
    shadowColor: '#6B7280',
  },
  choiceButtonContent: {
    padding: 16,
    gap: 8,
  },
  primaryChoiceContent: {
    backgroundColor: '#10B981', // Green for primary choice
  },
  secondaryChoiceContent: {
    backgroundColor: '#374151', // Dark gray for secondary choices
  },
  choiceContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginBottom: 8,
  },
  choiceText: {
    fontSize: 16,
    fontWeight: '600',
    textAlign: 'center',
  },
  primaryChoiceText: {
    color: '#FFFFFF',
  },
  secondaryChoiceText: {
    color: '#D1D5DB',
  },
  economicInfo: {
    backgroundColor: 'rgba(0, 0, 0, 0.2)',
    borderRadius: 8,
    padding: 12,
    marginVertical: 12,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  economicInfoDark: {
    backgroundColor: 'rgba(0, 0, 0, 0.2)',
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  economicInfoTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#FFFFFF',
    marginBottom: 8,
  },
  economicTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#DC2626',
    marginBottom: 8,
  },
  economicTitleDark: {
    color: '#FCA5A5',
  },
  economicStats: {
    gap: 6,
  },
  economicStat: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  economicStatText: {
    fontSize: 13,
    color: '#D1D5DB',
  },
  choiceEffectsInfo: {
    marginVertical: 16,
    padding: 16,
    backgroundColor: 'rgba(0, 0, 0, 0.2)',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  choiceEffectsInfoDark: {
    backgroundColor: 'rgba(0, 0, 0, 0.2)',
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  choiceEffectsTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#FFFFFF',
    marginBottom: 12,
    opacity: 0.9,
    letterSpacing: 0.5,
  },
  choiceEffect: {
    marginBottom: 12,
  },
  choiceEffectLabel: {
    fontSize: 13,
    fontWeight: '500',
    color: '#D1D5DB',
    marginBottom: 8,
    opacity: 0.9,
  },
  choiceEffectDetails: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  effectBadge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    minWidth: 60,
    alignItems: 'center',
    justifyContent: 'center',
  },
  positiveBadge: {
    backgroundColor: 'rgba(16, 185, 129, 0.25)',
    borderWidth: 1.5,
    borderColor: '#10B981',
  },
  negativeBadge: {
    backgroundColor: 'rgba(239, 68, 68, 0.25)',
    borderWidth: 1.5,
    borderColor: '#EF4444',
  },
  effectBadgeText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#FFFFFF',
    textShadowColor: 'rgba(0, 0, 0, 0.5)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
  tradeoffContainer: {
    marginTop: 8,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.1)',
    gap: 8,
  },
  gainContainer: {
    gap: 4,
    marginBottom: 4,
  },
  loseContainer: {
    gap: 4,
  },
  tradeoffLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#D1D5DB',
    marginBottom: 4,
  },
  tradeoffItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginLeft: 4,
  },
  gainText: {
    fontSize: 12,
    color: '#10B981',
    fontWeight: '500',
  },
  loseText: {
    fontSize: 12,
    color: '#EF4444',
    fontWeight: '500',
  },
  emotionalIndicator: {
    marginTop: 8,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.1)',
  },
  emotionalText: {
    fontSize: 11,
    color: '#9CA3AF',
    textAlign: 'center',
    fontStyle: 'italic',
  },
});


