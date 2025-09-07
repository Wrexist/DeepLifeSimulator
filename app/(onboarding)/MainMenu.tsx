import React, { useEffect, useState, useRef } from 'react';
import { View, TouchableOpacity, StyleSheet, Text, Dimensions, Animated, Easing, ImageBackground } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
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

  useEffect(() => {
    let isMounted = true;
    
    (async () => {
      try {
        const last = await AsyncStorage.getItem('lastSlot');
        if (isMounted && last) {
          setHasSave(true);
        }
      } catch (error) {
        console.error('Error checking last save slot:', error);
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
      router.replace('/(tabs)');
    } catch (error) {
      console.error('Navigation error:', error);
    }
  };

  const startNew = () => {
    setState(prev => ({ ...prev, slot: 1, scenario: undefined, perks: [], firstName: '', lastName: '' }));
    router.push('/(onboarding)/Scenarios');
  };

  return (
    <ImageBackground
      source={require('@/assets/images/Main_Menu.png')}
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
                <LinearGradient
                  colors={['rgba(59, 130, 246, 0.7)', 'rgba(99, 102, 241, 0.7)']}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={styles.button}
                >
                  <View style={styles.buttonContent}>
                    <View style={styles.iconContainer}>
                      <Play size={responsiveIconSize.lg} color="#3B82F6" />
                    </View>
                    <View style={styles.textContainer}>
                      <Text style={styles.buttonTitle}>{t('mainMenu.continue')}</Text>
                      <Text style={styles.buttonSubtitle}>{t('mainMenu.continueSubtitle')}</Text>
                    </View>
                  </View>
                </LinearGradient>
              </TouchableOpacity>
            )}
            
            <TouchableOpacity style={styles.buttonContainer} onPress={startNew}>
              <LinearGradient
                colors={['rgba(16, 185, 129, 0.7)', 'rgba(5, 150, 105, 0.7)']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.button}
              >
                <View style={styles.buttonContent}>
                                      <View style={styles.iconContainer}>
                      <Plus size={responsiveIconSize.lg} color="#10B981" />
                    </View>
                  <View style={styles.textContainer}>
                    <Text style={styles.buttonTitle}>{t('mainMenu.newGame')}</Text>
                    <Text style={styles.buttonSubtitle}>{t('mainMenu.newGameSubtitle')}</Text>
                  </View>
                </View>
              </LinearGradient>
            </TouchableOpacity>
            
            <TouchableOpacity style={styles.buttonContainer} onPress={() => router.push('/(onboarding)/SaveSlots')}>
              <LinearGradient
                colors={['rgba(245, 158, 11, 0.7)', 'rgba(217, 119, 6, 0.7)']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.button}
              >
                <View style={styles.buttonContent}>
                  <View style={styles.iconContainer}>
                    <Save size={responsiveIconSize.lg} color="#F59E0B" />
                  </View>
                  <View style={styles.textContainer}>
                    <Text style={styles.buttonTitle}>{t('mainMenu.saveSlots')}</Text>
                    <Text style={styles.buttonSubtitle}>{t('mainMenu.saveSlotsSubtitle')}</Text>
                  </View>
                </View>
              </LinearGradient>
            </TouchableOpacity>
            
            <TouchableOpacity style={styles.buttonContainer} onPress={() => setShowSettings(true)}>
              <LinearGradient
                colors={['rgba(107, 114, 128, 0.7)', 'rgba(75, 85, 99, 0.7)']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.button}
              >
                <View style={styles.buttonContent}>
                                      <View style={styles.iconContainer}>
                      <Settings size={responsiveIconSize.lg} color="#6B7280" />
                    </View>
                  <View style={styles.textContainer}>
                    <Text style={styles.buttonTitle}>{t('mainMenu.settings')}</Text>
                    <Text style={styles.buttonSubtitle}>{t('mainMenu.settingsSubtitle')}</Text>
                  </View>
                </View>
              </LinearGradient>
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
    width: '100%',
    height: '100%',
    marginTop: -50, // Extend background to cover status bar
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
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.3,
    shadowRadius: 16,
    elevation: 12,
  },
  button: {
    paddingVertical: verticalScale(16), // Reduced from 20
    paddingHorizontal: responsiveSpacing.xl, // Reduced from 2xl
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
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
