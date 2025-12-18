import React from 'react';
import { 
  Modal, 
  View, 
  Text, 
  TouchableOpacity, 
  StyleSheet, 
  Image, 
  ScrollView, 
  Dimensions,
  SafeAreaView,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useRouter } from 'expo-router';
import { perks } from '@/src/features/onboarding/perksData';
import { useGame } from '@/contexts/GameContext';
import { logger } from '@/utils/logger';

const { height: screenHeight, width: screenWidth } = Dimensions.get('window');

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
      setGameState(prev => ({
        ...prev,
        showDeathPopup: false,
        deathReason: undefined,
      }));
      
      await AsyncStorage.removeItem(`save_slot_${currentSlot}`);
      await AsyncStorage.removeItem('lastSlot');
      await restartGame();
      router.replace('/(onboarding)/MainMenu');
    } catch (error) {
      logger.error('Failed to start new life:', error);
      setGameState(prev => ({
        ...prev,
        showDeathPopup: true,
      }));
    }
  };

  const isDark = settings.darkMode;

  return (
    <Modal visible transparent animationType="fade" onRequestClose={() => {}}>
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.overlay}>
          <View style={[styles.popupContainer, isDark && styles.popupContainerDark]}>
            {/* Scrollable Content Area */}
            <ScrollView
              style={styles.scrollView}
              contentContainerStyle={styles.scrollContent}
              showsVerticalScrollIndicator={true}
              bounces={true}
              overScrollMode="always"
              scrollEnabled={true}
            >
              <Image
                source={require('@/assets/images/Tombstone.png')}
                style={styles.tombstoneImage}
                resizeMode="contain"
              />
              
              <Text style={[styles.title, isDark && styles.titleDark]}>
                R.I.P.
              </Text>
              
              {deathReason && (
                <Text style={[styles.message, isDark && styles.messageDark]}>
                  {deathReason === 'happiness'
                    ? 'You remained unhappy for 4 weeks.'
                    : 'You remained unhealthy for 4 weeks.'}
                </Text>
              )}

              <View style={[styles.statsCard, isDark && styles.statsCardDark]}>
                <Text style={[styles.statRow, isDark && styles.statRowDark]}>
                  Age: {Math.floor(date.age)} years
                </Text>
                <Text style={[styles.statRow, isDark && styles.statRowDark]}>
                  Money: ${stats.money.toLocaleString()}
                </Text>
                <Text style={[styles.statRow, isDark && styles.statRowDark]}>
                  Health: {stats.health}
                </Text>
                <Text style={[styles.statRow, isDark && styles.statRowDark]}>
                  Happiness: {stats.happiness}
                </Text>
              </View>

              {unlockedPerks.length > 0 && (
                <View style={[styles.section, isDark && styles.sectionDark]}>
                  <Text style={[styles.sectionTitle, isDark && styles.sectionTitleDark]}>
                    🎁 Perks Unlocked
                  </Text>
                  {unlockedPerks.map(p => (
                    <Text key={p.id} style={[styles.listItem, isDark && styles.listItemDark]}>
                      • {p.title}
                    </Text>
                  ))}
                </View>
              )}

              {completed.length > 0 && (
                <View style={[styles.section, isDark && styles.sectionDark]}>
                  <Text style={[styles.sectionTitle, isDark && styles.sectionTitleDark]}>
                    🏆 Life Goals Achieved
                  </Text>
                  {completed.map(a => (
                    <Text key={a.id} style={[styles.listItem, isDark && styles.listItemDark]}>
                      • {a.name}
                    </Text>
                  ))}
                </View>
              )}
              
              {/* Extra padding at bottom for scroll space */}
              <View style={{ height: 20 }} />
            </ScrollView>

            {/* Fixed Buttons at Bottom */}
            <View style={[styles.buttonArea, isDark && styles.buttonAreaDark]}>
              <TouchableOpacity 
                style={styles.newLifeButton} 
                onPress={handleNewLife} 
                activeOpacity={0.8}
              >
                <Text style={styles.buttonText}>🔄 New Life</Text>
              </TouchableOpacity>
              
              <TouchableOpacity 
                style={styles.reviveButton} 
                onPress={reviveCharacter} 
                activeOpacity={0.8}
              >
                <Text style={styles.buttonText}>💎 Revive (500 gems)</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
  },
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
  },
  popupContainer: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    width: Math.min(screenWidth - 32, 380),
    maxHeight: screenHeight * 0.70,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.3,
    shadowRadius: 20,
    elevation: 15,
  },
  popupContainerDark: {
    backgroundColor: '#1F2937',
  },
  scrollView: {
    flexGrow: 1,
    flexShrink: 1,
  },
  scrollContent: {
    padding: 20,
    paddingBottom: 10,
    alignItems: 'center',
  },
  tombstoneImage: {
    width: 70,
    height: 70,
    marginBottom: 10,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#1F2937',
    marginBottom: 8,
    textAlign: 'center',
  },
  titleDark: {
    color: '#F9FAFB',
  },
  message: {
    fontSize: 14,
    color: '#6B7280',
    textAlign: 'center',
    marginBottom: 16,
  },
  messageDark: {
    color: '#9CA3AF',
  },
  statsCard: {
    backgroundColor: '#F3F4F6',
    borderRadius: 12,
    padding: 12,
    width: '100%',
    marginBottom: 12,
  },
  statsCardDark: {
    backgroundColor: '#374151',
  },
  statRow: {
    fontSize: 14,
    color: '#374151',
    marginBottom: 4,
    textAlign: 'center',
  },
  statRowDark: {
    color: '#E5E7EB',
  },
  section: {
    backgroundColor: '#F9FAFB',
    borderRadius: 12,
    padding: 12,
    width: '100%',
    marginBottom: 10,
  },
  sectionDark: {
    backgroundColor: '#374151',
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#374151',
    marginBottom: 8,
    textAlign: 'center',
  },
  sectionTitleDark: {
    color: '#F3F4F6',
  },
  listItem: {
    fontSize: 13,
    color: '#4B5563',
    marginBottom: 4,
    textAlign: 'left',
    paddingLeft: 8,
  },
  listItemDark: {
    color: '#D1D5DB',
  },
  buttonArea: {
    padding: 16,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
    backgroundColor: '#FFFFFF',
  },
  buttonAreaDark: {
    borderTopColor: '#374151',
    backgroundColor: '#1F2937',
  },
  newLifeButton: {
    backgroundColor: '#3B82F6',
    paddingVertical: 14,
    paddingHorizontal: 24,
    borderRadius: 12,
    marginBottom: 10,
    alignItems: 'center',
  },
  reviveButton: {
    backgroundColor: '#10B981',
    paddingVertical: 14,
    paddingHorizontal: 24,
    borderRadius: 12,
    alignItems: 'center',
  },
  buttonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
  },
});
