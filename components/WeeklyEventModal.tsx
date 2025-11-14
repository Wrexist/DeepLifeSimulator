import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Modal, Animated } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { AlertTriangle, CheckCircle, XCircle } from 'lucide-react-native';
import { useGame } from '@/contexts/GameContext';

export default function WeeklyEventModal() {
  const { gameState, resolveEvent } = useGame();
  const event = gameState.pendingEvents[0];
  const { settings } = gameState;
  const pet = event ? gameState.pets.find(p => p.id === event.relationId) : undefined;

  if (!event) return null;

  return (
    <Modal visible transparent animationType="fade" onRequestClose={() => {
      // Prevent dismissal without making a choice
      // User must select one of the event choices
    }}>
      <View style={styles.overlay}>
        <LinearGradient
          colors={settings.darkMode ? ['#1F2937', '#111827'] : ['#F8FAFC', '#FFFFFF']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.container}
        >
          <View style={styles.header}>
            <AlertTriangle size={24} color={settings.darkMode ? '#F59E0B' : '#D97706'} />
            <Text style={[styles.title, settings.darkMode && styles.titleDark]}>Weekly Event</Text>
          </View>
          
          <Text style={[styles.description, settings.darkMode && styles.descriptionDark]}>
            {event.description}
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
                key={choice.id}
                style={[
                  styles.choiceButton,
                  index === 0 ? styles.primaryChoice : styles.secondaryChoice,
                  settings.darkMode && styles.choiceButton
                ]}
                onPress={() => resolveEvent(event.id, choice.id)}
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
                    {choice.text}
                  </Text>
                </LinearGradient>
              </TouchableOpacity>
            ))}
          </View>
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
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.3,
    shadowRadius: 16,
    elevation: 12,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
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

