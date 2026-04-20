import React from 'react';
import { Modal, View, Text, TouchableOpacity, StyleSheet, Image } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useRouter } from 'expo-router';
import { perks } from '@/src/features/onboarding/perksData';
import { useGame } from '@/contexts/GameContext';

export default function TombstonePopup() {
  const { gameState, setGameState, restartGame, reviveCharacter, currentSlot } = useGame();
  const router = useRouter();
  const { settings, deathReason, stats, date } = gameState;
  const completed = gameState.achievements?.filter(a => a.completed) || [];
  const unlockedPerks = perks.filter(p =>
    completed.some(a => a.id === p.unlock?.achievementId)
  );

  const handleNewLife = async () => {
    try {
      // Close the death popup first
      setGameState(prev => ({
        ...prev,
        showDeathPopup: false,
        deathReason: undefined,
      }));
      
      // Clear the current save slot
      await AsyncStorage.removeItem(`save_slot_${currentSlot}`);
      await AsyncStorage.removeItem('lastSlot');
      
      // Restart the game with preserved achievements and gems
      await restartGame();
      
      // Navigate to main menu
      router.replace('/(onboarding)/MainMenu');
    } catch (error) {
      console.error('Failed to start new life:', error);
      // Re-show the death popup if there was an error
      setGameState(prev => ({
        ...prev,
        showDeathPopup: true,
      }));
    }
  };

  return (
    <Modal visible transparent animationType="fade" onRequestClose={() => {
      // Prevent dismissal - user must choose an action (revive or new life)
    }}>
      <View style={styles.overlay}>
        <View style={[styles.popup, settings.darkMode && styles.popupDark]}>
          <Image
            source={require('@/assets/images/Tombstone.png')}
            style={styles.tombstoneImage}
          />
          <Text style={[styles.title, settings.darkMode && styles.titleDark]}>You Died</Text>
          {deathReason && (
            <Text style={[styles.message, settings.darkMode && styles.messageDark]}>
              {deathReason === 'happiness'
                ? 'You remained unhappy for 4 weeks.'
                : 'You remained unhealthy for 4 weeks.'}
            </Text>
          )}

          <View style={styles.statsContainer}>
            <Text style={[styles.stat, settings.darkMode && styles.statDark]}>
              Age: {Math.floor(date.age)}
            </Text>
            <Text style={[styles.stat, settings.darkMode && styles.statDark]}>
              Money: ${stats.money.toLocaleString()}
            </Text>
            <Text style={[styles.stat, settings.darkMode && styles.statDark]}>Health: {stats.health}</Text>
            <Text style={[styles.stat, settings.darkMode && styles.statDark]}>Happiness: {stats.happiness}</Text>
            {unlockedPerks.length > 0 && (
              <Text style={[styles.stat, settings.darkMode && styles.statDark]}>
                Perks unlocked: {unlockedPerks.map(p => p.title).join(', ')}
              </Text>
            )}
            {completed.length > 0 && (
              <Text style={[styles.stat, settings.darkMode && styles.statDark]}>
                Life goals: {completed.map(a => a.name).join(', ')}
              </Text>
            )}
          </View>
          <TouchableOpacity style={styles.button} onPress={handleNewLife} activeOpacity={0.8}>
            <Text style={styles.buttonText}>New Life</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.button, styles.reviveButton]} onPress={reviveCharacter} activeOpacity={0.8}>
                            <Text style={styles.buttonText}>Revive (500 gems)</Text>
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
    boxShadow: '0px 10px 20px rgba(0, 0, 0, 0.25)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.25,
    shadowRadius: 20,
    elevation: 10,
  },
  popupDark: {
    backgroundColor: '#1F2937',
  },
  tombstoneImage: {
    width: 100,
    height: 100,
    marginBottom: 16,
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
  statsContainer: {
    marginBottom: 24,
    alignItems: 'center',
  },
  stat: {
    fontSize: 16,
    color: '#4B5563',
  },
  statDark: {
    color: '#D1D5DB',
  },
  button: {
    backgroundColor: '#3B82F6',
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 8,
    marginTop: 8,
  },
  reviveButton: {
    backgroundColor: '#10B981',
  },
  buttonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
});

