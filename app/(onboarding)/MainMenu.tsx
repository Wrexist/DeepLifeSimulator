import React, { useEffect, useState } from 'react';
import { View, TouchableOpacity, StyleSheet, ImageBackground, Image, Text, Dimensions } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useGame } from '@/contexts/GameContext';
import { useOnboarding } from '@/src/features/onboarding/OnboardingContext';
import SettingsModal from '@/components/SettingsModal';
import { Play, Plus, Save, Settings } from 'lucide-react-native';

const { width: screenWidth } = Dimensions.get('window');

export default function MainMenu() {
  const router = useRouter();
  const { loadGame } = useGame();
  const { setState } = useOnboarding();
  const [hasSave, setHasSave] = useState(false);
  const [showSettings, setShowSettings] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const last = await AsyncStorage.getItem('lastSlot');
        if (last) setHasSave(true);
      } catch (error) {
        console.error('Error checking last save slot:', error);
      }
    })();
  }, []);

  const continueGame = async () => {
    await loadGame();
    router.replace('/(tabs)');
  };

  const startNew = () => {
    setState(prev => ({ ...prev, scenario: undefined, perks: [], firstName: '', lastName: '' }));
    router.push('/(onboarding)/SaveSlots');
  };

  return (
    <ImageBackground
      source={require('@/assets/images/Main_Menu.png')}
      style={styles.container}
      resizeMode="cover"
    >
      <View style={styles.overlay}>
        <View style={styles.menu}>
          {hasSave && (
            <TouchableOpacity style={styles.buttonContainer} onPress={continueGame}>
              <LinearGradient
                colors={['#3B82F6', '#1D4ED8']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.button}
              >
                <View style={styles.buttonContent}>
                  <View style={styles.iconContainer}>
                    <Play size={28} color="#FFFFFF" />
                  </View>
                  <View style={styles.textContainer}>
                    <Text style={styles.buttonTitle}>Continue</Text>
                    <Text style={styles.buttonSubtitle}>Resume your journey</Text>
                  </View>
                </View>
              </LinearGradient>
            </TouchableOpacity>
          )}
          
          <TouchableOpacity style={styles.buttonContainer} onPress={startNew}>
            <LinearGradient
              colors={['#10B981', '#059669']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.button}
            >
              <View style={styles.buttonContent}>
                <View style={styles.iconContainer}>
                  <Plus size={28} color="#FFFFFF" />
                </View>
                <View style={styles.textContainer}>
                  <Text style={styles.buttonTitle}>New Game</Text>
                  <Text style={styles.buttonSubtitle}>Start a new adventure</Text>
                </View>
              </View>
            </LinearGradient>
          </TouchableOpacity>
          
          <TouchableOpacity
            style={styles.buttonContainer}
            onPress={() => router.push('/(onboarding)/SaveSlots')}
          >
            <LinearGradient
              colors={['#F59E0B', '#D97706']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.button}
            >
              <View style={styles.buttonContent}>
                <View style={styles.iconContainer}>
                  <Save size={28} color="#FFFFFF" />
                </View>
                <View style={styles.textContainer}>
                  <Text style={styles.buttonTitle}>Save Slots</Text>
                  <Text style={styles.buttonSubtitle}>Manage your saves</Text>
                </View>
              </View>
            </LinearGradient>
          </TouchableOpacity>
          
          <TouchableOpacity style={styles.buttonContainer} onPress={() => setShowSettings(true)}>
            <LinearGradient
              colors={['#6B7280', '#4B5563']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.button}
            >
              <View style={styles.buttonContent}>
                <View style={styles.iconContainer}>
                  <Settings size={28} color="#FFFFFF" />
                </View>
                <View style={styles.textContainer}>
                  <Text style={styles.buttonTitle}>Settings</Text>
                  <Text style={styles.buttonSubtitle}>Configure your game</Text>
                </View>
              </View>
            </LinearGradient>
          </TouchableOpacity>
        </View>
      </View>
      
      <SettingsModal visible={showSettings} onClose={() => setShowSettings(false)} />
    </ImageBackground>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    width: '100%',
    height: '100%',
  },
  overlay: {
    flex: 1,
    justifyContent: 'flex-end',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingBottom: 60,
  },
  menu: {
    width: '100%',
    maxWidth: 400,
    alignItems: 'center',
  },
  buttonContainer: {
    width: '100%',
    marginBottom: 16,
    borderRadius: 16,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  button: {
    paddingVertical: 20,
    paddingHorizontal: 24,
  },
  buttonContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  iconContainer: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  textContainer: {
    flex: 1,
  },
  buttonTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#FFFFFF',
    marginBottom: 4,
  },
  buttonSubtitle: {
    fontSize: 14,
    color: 'rgba(255, 255, 255, 0.8)',
  },
});
