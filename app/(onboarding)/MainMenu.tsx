import React, { useEffect, useState, useRef } from 'react';
import { View, TouchableOpacity, StyleSheet, Text, Dimensions, Animated, Easing, ImageBackground, Platform, Alert } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useGame } from '@/contexts/GameContext';
// MAIN MENU STATE GATE FIX: Removed unused useOnboarding import to ensure no state mutations
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
  isSmallDevice,
} from '@/utils/scaling';

import { useTranslation } from '@/hooks/useTranslation';
import { logger } from '@/utils/logger';
import { validateGameEntry } from '@/utils/gameEntryValidation';

const { width: screenWidth, height: screenHeight } = Dimensions.get('window');

export default function MainMenu() {
  const log = logger.scope('MainMenu');
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { loadGame } = useGame();
  // MAIN MENU STATE GATE FIX: setState imported but never used - removed to ensure no state mutations
  // Onboarding state is managed by individual onboarding screens, not Main Menu
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
        // MAIN MENU STATE GATE FIX: Check save slots directly (not legacy 'gameState' key)
        // This ensures the Continue button only shows when there's an actual save
        const lastSlot = await AsyncStorage.getItem('lastSlot');
        
        if (isMounted && lastSlot) {
          try {
            const slotNumber = parseInt(lastSlot, 10);
            if (isNaN(slotNumber) || slotNumber < 1 || slotNumber > 3) {
              setHasSave(false);
              return;
            }
            
            // Check the actual save slot for game data
            const saveData = await AsyncStorage.getItem(`save_slot_${slotNumber}`);
            if (!saveData) {
              setHasSave(false);
              return;
            }
            
            // Parse the save data to check if it has meaningful progress
            const parsedGameState = JSON.parse(saveData);
            
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
            log.error('Failed to parse save data:', parseError);
            setHasSave(false);
          }
        } else {
          setHasSave(false);
        }
      } catch (error) {
        log.error('Error checking save data:', error);
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
      // CRITICAL: Validate save exists before attempting load
      const lastSlot = await AsyncStorage.getItem('lastSlot');
      if (!lastSlot) {
        log.error('No lastSlot found when trying to continue');
        Alert.alert(
          'No Save Found',
          'No save game found. Please start a new game.',
          [{ text: 'OK' }]
        );
        return;
      }

      const slotNumber = parseInt(lastSlot, 10);
      if (isNaN(slotNumber) || slotNumber < 1 || slotNumber > 3) {
        log.error('Invalid lastSlot value:', lastSlot);
        Alert.alert(
          'Invalid Save Slot',
          'The save slot information is invalid. Please select a save slot from the Save Slots menu.',
          [{ text: 'OK' }]
        );
        return;
      }

      // CRITICAL: Load the game data and verify success
      try {
        await loadGame(slotNumber);
      } catch (loadError) {
        log.error('loadGame threw an error:', loadError);
        Alert.alert(
          'Load Error',
          'An error occurred while loading your game. Please try again or start a new game.',
          [{ text: 'OK' }]
        );
        return;
      }
      
      // CRITICAL: Verify loadGame succeeded by checking storage
      // This ensures the state was actually loaded, not just that loadGame() returned
      const loadedData = await AsyncStorage.getItem(`save_slot_${slotNumber}`);
      if (!loadedData) {
        log.error('loadGame returned but no data found in storage - load failed silently');
        Alert.alert(
          'Load Failed',
          'Failed to load your game. The save file may be corrupted or missing. Please try loading from Save Slots or start a new game.',
          [{ text: 'OK' }]
        );
        return;
      }
      
      // CRITICAL: Validate state before entering gameplay
      // No setTimeout needed - we've already verified loadGame completed
      try {

        let loadedState;
        try {
          loadedState = JSON.parse(loadedData);
        } catch (parseError) {
          log.error('Failed to parse loaded game state:', parseError);
          Alert.alert(
            'Corrupted Save',
            'Your save file is corrupted and cannot be loaded. Please try loading from a backup or start a new game.',
            [{ text: 'OK' }]
          );
          return;
        }

        // CRITICAL: Verify loaded state structure before validation
        if (!loadedState || typeof loadedState !== 'object') {
          log.error('Loaded state is not a valid object', { loadedState });
          Alert.alert(
            'Invalid Save',
            'The loaded game state is invalid. Please try loading from a backup or start a new game.',
            [{ text: 'OK' }]
          );
          return;
        }

        // CRITICAL: Validate state before entering gameplay
        const validation = validateGameEntry(loadedState);
        
        if (!validation.canEnter) {
          log.error('Game entry validation failed', {
            reason: validation.reason,
            errors: validation.errors,
            warnings: validation.warnings,
            versionCompatible: validation.versionCompatible,
            stateComplete: validation.stateComplete,
            slot: slotNumber,
            version: loadedState.version,
          });

          // Show appropriate error message based on failure type
          if (!validation.versionCompatible) {
            const versionError = validation.errors.find(e => e.includes('version')) || 
              `This save is from version ${loadedState.version || 'unknown'}, which is incompatible with the current game version.`;
            Alert.alert(
              'Version Incompatible',
              versionError + '\n\nPlease update the game or start a new game.',
              [{ text: 'OK' }]
            );
          } else if (!validation.stateComplete) {
            Alert.alert(
              'Incomplete Save',
              validation.errors[0] || 
              'Your save file is incomplete and cannot be loaded. Please try loading from a backup or start a new game.',
              [{ text: 'OK' }]
            );
          } else {
            Alert.alert(
              'Invalid Save',
              validation.errors[0] || 
              'Your save file is invalid and cannot be loaded. Please try loading from a backup or start a new game.',
              [{ text: 'OK' }]
            );
          }
          return;
        }

        if (validation.warnings.length > 0) {
          log.warn('Game entry validation warnings', {
            warnings: validation.warnings,
            slot: slotNumber,
          });
        }

        // CRITICAL: Only navigate if validation passed
        if (router && typeof router.replace === 'function') {
          log.info('Game entry validation passed, navigating to gameplay', {
            slot: slotNumber,
            version: loadedState.version,
          });
          router.replace('/(tabs)');
        } else {
          log.error('Router not available for navigation');
          Alert.alert(
            'Navigation Error',
            'Unable to navigate to the game. Please try again.',
            [{ text: 'OK' }]
          );
        }
      } catch (validationError) {
        log.error('Error during game entry validation:', validationError);
        Alert.alert(
          'Validation Error',
          'An error occurred while validating your save. Please try again.',
          [{ text: 'OK' }]
        );
      }
    } catch (error) {
      log.error('Error in continueGame:', error);
      Alert.alert(
        'Load Error',
        'An error occurred while loading your game. Please try again or start a new game.',
        [{ text: 'OK' }]
      );
    }
  };

  const checkIfAllSlotsFull = async (): Promise<boolean> => {
    try {
      let fullSlots = 0;
      for (let i = 1; i <= 3; i++) {
        const data = await AsyncStorage.getItem(`save_slot_${i}`);
        if (data) {
          try {
            const parsed = JSON.parse(data);
            // Check if slot has actual game data (not just empty object)
            if (parsed && typeof parsed === 'object') {
              // Consider slot full if it has meaningful game data
              const hasGameData = parsed.weeksLived > 0 ||
                                 parsed.stats?.money > 0 ||
                                 (parsed.achievements && parsed.achievements.some((a: any) => a?.completed)) ||
                                 (parsed.relationships && parsed.relationships.length > 0) ||
                                 (parsed.items && parsed.items.some((item: any) => item?.owned));
              if (hasGameData) {
                fullSlots++;
              }
            }
          } catch {
            // If parsing fails, consider slot as potentially full/corrupted
            fullSlots++;
          }
        }
      }
      return fullSlots >= 3;
    } catch (error) {
      log.error('Error checking save slots:', error);
      return false; // Allow new game if check fails
    }
  };

  const startNew = async () => {
    try {
      const allSlotsFull = await checkIfAllSlotsFull();
      if (allSlotsFull) {
        Alert.alert(
          'All Save Slots Full',
          'You cannot create a new game because all 3 save slots are full. Please delete a save slot first to make room for a new game.',
          [{ text: 'OK' }]
        );
        return;
      }

      // CRITICAL: Main Menu must NOT mutate game state
      // Only reset onboarding state (which is separate from game state)
      // Navigation to Scenarios will handle onboarding state initialization
      if (router && typeof router.push === 'function') {
        router.push('/(onboarding)/Scenarios');
      } else {
        log.error('Router not available for navigation');
        Alert.alert(
          'Navigation Error',
          'Unable to start a new game. Please try again.',
          [{ text: 'OK' }]
        );
      }
    } catch (error) {
      log.error('Error starting new game:', error);
      Alert.alert(
        'Error',
        'An error occurred while starting a new game. Please try again.',
        [{ text: 'OK' }]
      );
    }
  };

  return (
    <ImageBackground
      source={selectedBackground}
      style={styles.container}
      resizeMode="cover"
    >
      <View style={[styles.overlay, { paddingBottom: verticalScale(60) + insets.bottom }]}>
        {/* Main content */}
        <Animated.View 
          style={[
            styles.content, 
            { 
              opacity: fadeAnim,
              paddingTop: 50 + insets.top,
            }
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
          <Text style={styles.versionText}>v1.2.2</Text>
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
  },
  content: {
    flex: 1,
    justifyContent: 'flex-end',
    alignItems: 'center',
    width: '100%',
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
    boxShadow: '0px 12px 20px rgba(0, 0, 0, 0.25)',
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
    boxShadow: '0px 2px 4px rgba(255, 255, 255, 0.1)',
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
    fontSize: isSmallDevice() ? responsiveFontSize.lg : responsiveFontSize.xl,
    fontWeight: '600',
    color: '#FFFFFF',
    marginBottom: responsiveSpacing.xs,
    numberOfLines: 2,
    ellipsizeMode: 'tail',
    ...Platform.select({
      web: { textShadow: '0px 1px 2px rgba(0, 0, 0, 0.3)' },
      ios: {
        textShadowColor: 'rgba(0, 0, 0, 0.3)',
        textShadowOffset: { width: 0, height: 1 },
        textShadowRadius: 2,
      },
      android: {
        textShadowColor: 'rgba(0, 0, 0, 0.3)',
        textShadowOffset: { width: 0, height: 1 },
        textShadowRadius: 2,
      },
    }),
  },
  glassButtonSubtitle: {
    fontSize: isSmallDevice() ? responsiveFontSize.xs : responsiveFontSize.sm,
    color: 'rgba(255, 255, 255, 0.85)',
    fontWeight: '400',
    numberOfLines: 2,
    ellipsizeMode: 'tail',
    ...Platform.select({
      web: { textShadow: '0px 1px 1px rgba(0, 0, 0, 0.2)' },
      default: {
        textShadowColor: 'rgba(0, 0, 0, 0.2)',
        textShadowOffset: { width: 0, height: 1 },
        textShadowRadius: 1,
      },
    }),
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
