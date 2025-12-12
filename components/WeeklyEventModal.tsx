import React, { useCallback } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Modal, ScrollView, Dimensions } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { AlertTriangle, CheckCircle, XCircle, Sparkles, Leaf, Sun, Snowflake, X } from 'lucide-react-native';
import { useGameState, useGameActions } from '@/contexts/GameContext';
import { getCurrentSeason } from '@/lib/events/seasonalEvents';
import { logger } from '@/utils/logger';

const { height: screenHeight } = Dimensions.get('window');
const log = logger.scope('WeeklyEventModal');

export default function WeeklyEventModal() {
  const { gameState, setGameState } = useGameState();
  const { resolveEvent, saveGame } = useGameActions();
  const event = gameState.pendingEvents[0];
  const { settings } = gameState;
  const pet = event ? gameState.pets.find(p => p.id === event.relationId) : undefined;

  // Emergency dismiss function - clears the current event if something is wrong
  const handleEmergencyDismiss = useCallback(() => {
    log.warn('Emergency dismiss triggered for event:', event?.id);
    setGameState(prev => ({
      ...prev,
      pendingEvents: prev.pendingEvents.slice(1), // Remove the first (current) event
    }));
    saveGame();
  }, [setGameState, saveGame, event?.id]);

  // Safe resolve handler with error catching
  const handleResolveEvent = useCallback((eventId: string, choiceId: string) => {
    try {
      log.info('Resolving event', { eventId, choiceId });
      resolveEvent(eventId, choiceId);
    } catch (error) {
      log.error('Error resolving event:', error);
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
    'valentines_day', 'halloween', 'christmas'
  ];
  const isSeasonalEvent = seasonalEventIds.includes(event.id);
  const seasonData = isSeasonalEvent ? getCurrentSeason(gameState.week) : null;

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

  return (
    <Modal visible transparent animationType="fade" onRequestClose={handleEmergencyDismiss}>
      <View style={styles.overlay}>
        <LinearGradient
          colors={isSeasonalEvent && seasonalTheme
            ? seasonalTheme.headerGradient
            : settings.darkMode ? ['#1F2937', '#111827'] : ['#F8FAFC', '#FFFFFF']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.container}
        >
          {/* Emergency close button in corner */}
          <TouchableOpacity 
            style={styles.closeButton} 
            onPress={handleEmergencyDismiss}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <X size={20} color={settings.darkMode ? '#9CA3AF' : '#6B7280'} />
          </TouchableOpacity>
          
          <ScrollView 
            style={styles.scrollView}
            contentContainerStyle={styles.scrollContent}
            showsVerticalScrollIndicator={true}
            bounces={true}
          >
            <View style={styles.header}>
              {isSeasonalEvent && SeasonalIcon ? (
                <>
                  <Sparkles size={24} color="#FFFFFF" />
                  <SeasonalIcon size={24} color="#FFFFFF" />
                  <Text style={styles.seasonalTitle}>Seasonal Event</Text>
                </>
              ) : (
                <>
                  <AlertTriangle size={24} color={settings.darkMode ? '#F59E0B' : '#D97706'} />
                  <Text style={[styles.title, settings.darkMode && styles.titleDark]}>Weekly Event</Text>
                </>
              )}
            </View>
            
            <Text style={[styles.description, settings.darkMode && styles.descriptionDark]}>
              {event.description || 'An event has occurred.'}
            </Text>
            
            {pet && (
              <View style={styles.petInfo}>
                <Text style={[styles.petText, settings.darkMode && styles.petTextDark]}>
                  {pet.name} – Hunger {pet.hunger} • Happiness {pet.happiness}
                </Text>
              </View>
            )}
            
            <View style={styles.choicesContainer}>
              {event.choices.map((choice, index) => (
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
                  <LinearGradient
                    colors={
                      index === 0
                        ? settings.darkMode ? ['#10B981', '#059669'] : ['#059669', '#047857']
                        : settings.darkMode ? ['#374151', '#4B5563'] : ['#F3F4F6', '#E5E7EB']
                    }
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                    style={styles.choiceGradient}
                  >
                    {index === 0 ? (
                      <CheckCircle size={20} color="#FFFFFF" />
                    ) : (
                      <XCircle size={20} color={settings.darkMode ? '#9CA3AF' : '#6B7280'} />
                    )}
                    <Text style={[
                      styles.choiceText,
                      index === 0 ? styles.primaryChoiceText : styles.secondaryChoiceText,
                      settings.darkMode && styles.choiceTextDark
                    ]}>
                      {choice.text || 'Continue'}
                    </Text>
                  </LinearGradient>
                </TouchableOpacity>
              ))}
            </View>
          </ScrollView>
        </LinearGradient>
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
    borderRadius: 20,
    padding: 24,
    width: '100%',
    maxWidth: 400,
    maxHeight: screenHeight * 0.8,
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
    backgroundColor: 'rgba(0,0,0,0.1)',
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
    justifyContent: 'center',
    marginBottom: 16,
    gap: 8,
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
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 12,
    padding: 12,
    marginBottom: 20,
  },
  petText: {
    textAlign: 'center',
    color: '#374151',
    fontSize: 14,
  },
  petTextDark: {
    color: '#D1D5DB',
  },
  choicesContainer: {
    gap: 12,
  },
  choiceButton: {
    borderRadius: 12,
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
  choiceGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
    gap: 8,
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
    color: '#374151',
  },
  choiceTextDark: {
    color: '#F9FAFB',
  },
});

