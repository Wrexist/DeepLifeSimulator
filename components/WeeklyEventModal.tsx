import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Modal } from 'react-native';
import { useGame } from '@/contexts/GameContext';

export default function WeeklyEventModal() {
  const { gameState, resolveEvent } = useGame();
  const event = gameState.pendingEvents[0];
  const { settings } = gameState;
  const pet = event ? gameState.pets.find(p => p.id === event.relationId) : undefined;

  if (!event) return null;

  return (
    <Modal visible transparent animationType="slide">
      <View style={styles.overlay}>
        <View style={[styles.container, settings.darkMode && styles.containerDark]}>
          <Text style={[styles.title, settings.darkMode && styles.titleDark]}>{event.description}</Text>
          {pet && (
            <View style={styles.petInfo}>
              <Text style={[styles.petText, settings.darkMode && styles.petTextDark]}>
                {pet.name} – Hunger {pet.hunger} • Happiness {pet.happiness}
              </Text>
            </View>
          )}
          {event.choices.map(choice => (
            <TouchableOpacity
              key={choice.id}
              style={[styles.choiceButton, settings.darkMode && styles.choiceButtonDark]}
              onPress={() => resolveEvent(event.id, choice.id)}
            >
              <Text style={[styles.choiceText, settings.darkMode && styles.choiceTextDark]}>{choice.text}</Text>
            </TouchableOpacity>
          ))}
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
    padding: 20,
  },
  container: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 20,
    width: '100%',
    maxWidth: 400,
  },
  containerDark: {
    backgroundColor: '#1F2937',
  },
  title: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 20,
    color: '#1F2937',
  },
  titleDark: {
    color: '#F9FAFB',
  },
  choiceButton: {
    backgroundColor: '#F3F4F6',
    padding: 12,
    borderRadius: 8,
    marginBottom: 10,
  },
  choiceButtonDark: {
    backgroundColor: '#374151',
  },
  choiceText: {
    color: '#1F2937',
    textAlign: 'center',
    fontSize: 16,
  },
  choiceTextDark: {
    color: '#F9FAFB',
  },
  petInfo: {
    marginBottom: 10,
  },
  petText: {
    textAlign: 'center',
    color: '#1F2937',
  },
  petTextDark: {
    color: '#F9FAFB',
  },
});

