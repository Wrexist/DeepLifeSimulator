import React, { useEffect, useState, useRef } from 'react';
import { View, TouchableOpacity, StyleSheet, Text, Dimensions, Animated, Easing, ImageBackground } from 'react-native';
import { useRouter } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useGame } from '@/contexts/GameContext';
import { useOnboarding } from '@/src/features/onboarding/OnboardingContext';
import SettingsModal from '@/components/SettingsModal';
import { Play, Plus, Save, Settings } from 'lucide-react-native';
import {
  responsivePadding,
  responsiveFontSize,
  responsiveSpacing,
  responsiveBorderRadius,
  responsiveIconSize,
  scale,
  verticalScale,
  responsiveScale,
} from '@/utils/scaling';

import { useTranslation } from '@/hooks/useTranslation';

const { width: screenWidth, height: screenHeight } = Dimensions.get('window');

export default function MainMenu() {
  const router = useRouter();
  const { loadGame } = useGame();
  const { setState } = useOnboarding();
  const [hasSave, setHasSave] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const { t } = useTranslation();

  // Simple animations
  const fadeAnim = useRef(new Animated.Value(0)).current;

  // Random background selection
  const backgroundImages = [
    require('@/assets/images/Main_Menu.png'),
    require('@/assets/images/Main_Menu_2.png'),
    require('@/assets/images/Main_Menu_3.png'),
  ];
  
  const [selectedBackground, setSelectedBackground] = useState(() => 
    backgroundImages[Math.floor(Math.random() * backgroundImages.length)]
  );

  useEffect(() => {
    let isMounted = true;
    
    (async () => {
      try {
        // Check if there's actual game data, not just a save slot
        const gameState = await AsyncStorage.getItem('gameState');
        const lastSlot = await AsyncStorage.getItem('lastSlot');
        
        if (isMounted && gameState && lastSlot) {
          try {
            // Parse the game state to check if it has meaningful progress
            const parsedGameState = JSON.parse(gameState);
            
            // Validate that the parsed data has the expected structure
            if (!parsedGameState || typeof parsedGameState !== 'object') {
              setHasSave(false);
              return;
            }
            
            // Check if the game has meaningful progress (not just initial state)
            const hasProgress = (parsedGameState.weeksLived > 0) || 
                               (parsedGameState.stats?.money > 0) || 
                               (parsedGameState.achievements?.some((a: any) => a?.completed)) ||
                               (parsedGameState.relationships?.length > 0) ||
                               (parsedGameState.items?.some((item: any) => item?.owned));
            
            setHasSave(hasProgress);
          } catch (parseError) {
            console.error('Failed to parse game state:', parseError);
            setHasSave(false);
          }
        } else {
          setHasSave(false);
        }
      } catch (error) {
        console.error('Error checking save data:', error);
        setHasSave(false);
      }
    })();

    return () => {
      isMounted = false;
    };
  }, []);

  // Fade in animation
  useEffect(() => {
    let isMounted = true;
    const fadeInAnimation = Animated.timing(fadeAnim, {
      toValue: 1,
      duration: 1000,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    });

    if (isMounted && fadeInAnimation) {
      fadeInAnimation.start();
    }

    return () => {
      isMounted = false;
      if (fadeInAnimation) {
        fadeInAnimation.stop();
      }
    };
  }, [fadeAnim]);



  const continueGame = async () => {
    try {
      // Ensure we have valid game data before continuing
      const gameState = await AsyncStorage.getItem('gameState');
      if (!gameState) {
        console.error('No game state found when trying to continue');
        return;
      }
      
      // Load the game data properly
      await loadGame();
      
      // Navigate to the main game with error handling
      if (router && typeof router.replace === 'function') {
        router.replace('/(tabs)');
      } else {
        console.error('Router not available for navigation');
        startNew();
      }
    } catch (error) {
      console.error('Navigation error:', error);
      // If there's an error, fall back to new game
      startNew();
    }
  };

  const startNew = () => {
    try {
      setState(prev => ({ ...prev, slot: 1, scenario: undefined, perks: [], firstName: '', lastName: '' }));
      if (router && typeof router.push === 'function') {
        router.push('/(onboarding)/Scenarios');
      } else {
        console.error('Router not available for navigation');
      }
    } catch (error) {
      console.error('Error starting new game:', error);
    }
  };

  return (
    <ImageBackground
      source={selectedBackground}
      style={styles.container}
      resizeMode="cover"
    >
      <View style={styles.overlay}>
        {/* Main content */}
        <Animated.View 
          style={[
            styles.content, 
            { opacity: fadeAnim }
          ]}
        >


          {/* Menu buttons */}
          <View style={styles.menuSection}>
            {hasSave && (
              <TouchableOpacity style={styles.buttonContainer} onPress={continueGame}>
                <View style={styles.glassButton}>
                  <View style={styles.glassOverlay} />
                  <View style={styles.buttonContent}>
                    <View style={styles.glassIconContainer}>
                      <Play size={responsiveIconSize.lg} color="#FFFFFF" />
                    </View>
                    <View style={styles.textContainer}>
                      <Text style={styles.glassButtonTitle}>{t('mainMenu.continue')}</Text>
                      <Text style={styles.glassButtonSubtitle}>{t('mainMenu.continueSubtitle')}</Text>
                    </View>
                  </View>
                </View>
              </TouchableOpacity>
            )}
            
            <TouchableOpacity style={styles.buttonContainer} onPress={startNew}>
              <View style={styles.glassButton}>
                <View style={styles.glassOverlay} />
                <View style={styles.buttonContent}>
                  <View style={styles.glassIconContainer}>
                    <Plus size={responsiveIconSize.lg} color="#FFFFFF" />
                  </View>
                  <View style={styles.textContainer}>
                    <Text style={styles.glassButtonTitle}>{t('mainMenu.newGame')}</Text>
                    <Text style={styles.glassButtonSubtitle}>{t('mainMenu.newGameSubtitle')}</Text>
                  </View>
                </View>
              </View>
            </TouchableOpacity>
            
            <TouchableOpacity style={styles.buttonContainer} onPress={() => router.push('/(onboarding)/SaveSlots')}>
              <View style={styles.glassButton}>
                <View style={styles.glassOverlay} />
                <View style={styles.buttonContent}>
                  <View style={styles.glassIconContainer}>
                    <Save size={responsiveIconSize.lg} color="#FFFFFF" />
                  </View>
                  <View style={styles.textContainer}>
                    <Text style={styles.glassButtonTitle}>{t('mainMenu.saveSlots')}</Text>
                    <Text style={styles.glassButtonSubtitle}>{t('mainMenu.saveSlotsSubtitle')}</Text>
                  </View>
                </View>
              </View>
            </TouchableOpacity>
            
            <TouchableOpacity style={styles.buttonContainer} onPress={() => setShowSettings(true)}>
              <View style={styles.glassButton}>
                <View style={styles.glassOverlay} />
                <View style={styles.buttonContent}>
                  <View style={styles.glassIconContainer}>
                    <Settings size={responsiveIconSize.lg} color="#FFFFFF" />
                  </View>
                  <View style={styles.textContainer}>
                    <Text style={styles.glassButtonTitle}>{t('mainMenu.settings')}</Text>
                    <Text style={styles.glassButtonSubtitle}>{t('mainMenu.settingsSubtitle')}</Text>
                  </View>
                </View>
              </View>
            </TouchableOpacity>
          </View>
        </Animated.View>
        
        {/* Version display in bottom left */}
        <View style={styles.versionContainer}>
          <Text style={styles.versionText}>v1.0.0</Text>
        </View>
      </View>
      
      <SettingsModal visible={showSettings} onClose={() => setShowSettings(false)} />
    </ImageBackground>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0)',
    justifyContent: 'flex-end',
    alignItems: 'center',
    paddingHorizontal: responsivePadding.large,
    paddingBottom: verticalScale(60),
  },
  content: {
    flex: 1,
    justifyContent: 'flex-end',
    alignItems: 'center',
    width: '100%',
    paddingTop: 110, // Account for status bar
  },
  menuSection: {
    width: '100%',
    maxWidth: scale(350), // Reduced from 400
    alignItems: 'center',
  },
  buttonContainer: {
    width: '100%',
    marginBottom: responsiveSpacing.lg,
    borderRadius: responsiveBorderRadius.xl,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.25,
    shadowRadius: 20,
    elevation: 15,
  },
  glassButton: {
    paddingVertical: verticalScale(18),
    paddingHorizontal: responsiveSpacing.xl,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    borderRadius: responsiveBorderRadius.xl,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.15)',
    position: 'relative',
    overflow: 'hidden',
  },
  glassOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderRadius: responsiveBorderRadius.xl,
  },
  buttonContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  iconContainer: {
    width: scale(48), // Reduced from 56
    height: scale(48), // Reduced from 56
    borderRadius: scale(24), // Reduced from 28
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: responsiveSpacing.md, // Reduced from lg
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.2)',
  },
  glassIconContainer: {
    width: scale(52),
    height: scale(52),
    borderRadius: scale(26),
    backgroundColor: 'rgba(255, 255, 255, 0.12)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: responsiveSpacing.md,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.25)',
    shadowColor: '#FFFFFF',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  textContainer: {
    flex: 1,
  },
  buttonTitle: {
    fontSize: responsiveFontSize.xl, // Reduced from 2xl
    fontWeight: 'bold',
    color: '#FFFFFF',
    marginBottom: responsiveSpacing.xs,
  },
  buttonSubtitle: {
    fontSize: responsiveFontSize.sm, // Reduced from base
    color: 'rgba(255, 255, 255, 0.8)',
  },
  glassButtonTitle: {
    fontSize: responsiveFontSize.xl,
    fontWeight: '600',
    color: '#FFFFFF',
    marginBottom: responsiveSpacing.xs,
    textShadowColor: 'rgba(0, 0, 0, 0.3)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
  glassButtonSubtitle: {
    fontSize: responsiveFontSize.sm,
    color: 'rgba(255, 255, 255, 0.85)',
    fontWeight: '400',
    textShadowColor: 'rgba(0, 0, 0, 0.2)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 1,
  },
  versionContainer: {
    position: 'absolute',
    bottom: verticalScale(20),
    left: responsivePadding.large,
  },
  versionText: {
    fontSize: responsiveFontSize.xs,
    color: 'rgba(255, 255, 255, 0.6)',
    fontWeight: '500',
  },
});
