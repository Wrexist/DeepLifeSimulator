import React from 'react';
import { Modal, View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { useGame } from '@/contexts/GameContext';

export default function ZeroStatPopup() {
  const { gameState, dismissStatWarning } = useGame();
  const { settings, zeroStatType } = gameState;

  const message = zeroStatType === 'happiness'
    ? 'Your happiness is at 0! Increase it within 4 weeks or your character will die.'
    : 'Your health is at 0! Increase it within 4 weeks or your character will die.';

  return (
    <Modal visible transparent animationType="fade" onRequestClose={() => {}}>
      <View style={styles.overlay}>
        <View style={[styles.popup, settings.darkMode && styles.popupDark]}>
          <Text style={[styles.title, settings.darkMode && styles.titleDark]}>Warning</Text>
          <Text style={[styles.message, settings.darkMode && styles.messageDark]}>{message}</Text>
          <TouchableOpacity style={styles.button} onPress={dismissStatWarning} activeOpacity={0.8}>
            <Text style={styles.buttonText}>OK</Text>
          </TouchableOpacity>
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
  popup: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 24,
    alignItems: 'center',
    maxWidth: 400,
    width: '100%',
  },
  popupDark: {
    backgroundColor: '#1F2937',
  },
  title: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#1F2937',
    marginBottom: 12,
    textAlign: 'center',
  },
  titleDark: {
    color: '#F9FAFB',
  },
  message: {
    fontSize: 16,
    color: '#4B5563',
    textAlign: 'center',
    marginBottom: 24,
  },
  messageDark: {
    color: '#D1D5DB',
  },
  button: {
    backgroundColor: '#3B82F6',
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 8,
  },
  buttonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
});
