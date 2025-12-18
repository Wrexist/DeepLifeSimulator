import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Dimensions,
  Animated,
  Image,
  ImageSourcePropType,
  TextInput,
  Platform,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { MotiView, MotiText } from '@/components/anim/MotiStub';
import { useRouter, type Href } from 'expo-router';
import { useGame } from '@/contexts/GameContext';
import { useTutorialHighlight } from '@/contexts/TutorialHighlightContext';
import { logger } from '@/utils/logger';
import { getShadow } from '@/utils/shadow';
import { 
  MessageCircle, 
  ArrowRight, 
  X, 
  Sparkles, 
  Target, 
  Zap,
  Heart,
  Users,
  Smartphone,
  Laptop,
  TrendingUp,
  Settings,
  Play,
  SkipForward,
  Briefcase
} from 'lucide-react-native';
import { TutorialStep } from '@/types/tutorial';

// Import tutorial step images
const WelcomeIcon = require('@/assets/images/tutorial/icons/welcome.png');
const AgeProgressionIcon = require('@/assets/images/tutorial/icons/age-progression.png');
const MainActivitiesIcon = require('@/assets/images/tutorial/icons/main-activities.png');
const FirstJobApplicationIcon = require('@/assets/images/tutorial/icons/first-job-application.png');

// Enhanced tutorial step interface for advanced features
interface EnhancedTutorialStep extends TutorialStep {
  detailedDescription?: string;
  category?: string;
  importance?: 'low' | 'medium' | 'high' | 'critical';
  interactive?: boolean;
  requiresAction?: string;
  tips?: string[];
  warnings?: string[];
}

// Screen dimensions removed - not used

interface ImmersiveTutorialProps {
  visible: boolean;
  steps: TutorialStep[] | EnhancedTutorialStep[];
  onComplete: () => void;
  onSkip: () => void;
  currentStep?: number;
  highlightTargets?: { [key: string]: any }; // Component references to highlight
}

interface ChatBubbleProps {
  message: string;
  isUser?: boolean;
  delay?: number;
  onComplete?: () => void;
}

function ChatBubble({ message, isUser = false, delay = 0, onComplete }: ChatBubbleProps) {
  // ChatBubble component - styles need to be added
  const [visible, setVisible] = useState(false);
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const scaleAnim = useRef(new Animated.Value(0.8)).current;

  useEffect(() => {
    const timer = setTimeout(() => {
      setVisible(true);
      Animated.parallel([
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: 300,
          useNativeDriver: true,
        }),
        Animated.spring(scaleAnim, {
          toValue: 1,
          tension: 100,
          friction: 8,
          useNativeDriver: true,
        }),
      ]).start(() => {
        onComplete?.();
      });
    }, delay);

    return () => clearTimeout(timer);
  }, [delay, fadeAnim, scaleAnim, onComplete]);

  if (!visible) return null;

  return (
    <Animated.View
      style={[
        styles.chatBubble,
        isUser ? styles.userBubble : styles.guideBubble,
        {
          opacity: fadeAnim,
          transform: [{ scale: scaleAnim }],
        },
      ]}
    >
      <LinearGradient
        colors={isUser ? ['#3B82F6', '#1D4ED8'] : ['#10B981', '#059669']}
        style={styles.bubbleGradient}
      >
        <Text style={[styles.bubbleText, isUser && styles.userBubbleText]}>
          {message}
        </Text>
      </LinearGradient>
      {!isUser && (
        <View style={styles.bubbleAvatar}>
          <Image
            source={require('@/assets/images/Face/Male.png')}
            style={styles.avatarImage}
          />
        </View>
      )}
    </Animated.View>
  );
}

interface HighlightOverlayProps {
  target: any;
  visible: boolean;
  message: string;
  position?: 'top' | 'bottom' | 'left' | 'right';
}

function HighlightOverlay({ target, visible, message, position = 'bottom' }: HighlightOverlayProps) {
  const [targetLayout, setTargetLayout] = useState<any>(null);
  const pulseAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    if (visible && target) {
      target.measure((x: number, y: number, width: number, height: number) => {
        setTargetLayout({ x, y, width, height });
        
        // Start pulsing animation
        Animated.loop(
          Animated.sequence([
            Animated.timing(pulseAnim, {
              toValue: 1.1,
              duration: 800,
              useNativeDriver: true,
            }),
            Animated.timing(pulseAnim, {
              toValue: 1,
              duration: 800,
              useNativeDriver: true,
            }),
          ])
        ).start();
      });
    }
  }, [visible, target, pulseAnim]);

  if (!visible || !targetLayout) return null;

  return (
    <View style={styles.highlightContainer}>
      {/* Dark overlay with cutout */}
      <View style={styles.darkOverlay}>
        <View
          style={[
            styles.cutout,
            {
              left: targetLayout.x,
              top: targetLayout.y,
              width: targetLayout.width,
              height: targetLayout.height,
            },
          ]}
        />
      </View>

      {/* Highlight ring */}
      <Animated.View
        style={[
          styles.highlightRing,
          {
            left: targetLayout.x - 8,
            top: targetLayout.y - 8,
            width: targetLayout.width + 16,
            height: targetLayout.height + 16,
            transform: [{ scale: pulseAnim }],
          },
        ]}
      >
        <LinearGradient
          colors={['#3B82F6', '#10B981', '#F59E0B', '#EF4444']}
          style={styles.ringGradient}
        />
      </Animated.View>

      {/* Tooltip */}
      <View
        style={[
          styles.tooltip,
          getTooltipPosition(targetLayout, position),
        ]}
      >
        <LinearGradient
          colors={['#1F2937', '#111827']}
          style={styles.tooltipGradient}
        >
          <Sparkles size={16} color="#F59E0B" style={styles.tooltipIcon} />
          <Text style={styles.tooltipText}>{message}</Text>
        </LinearGradient>
        <View style={[styles.tooltipArrow, getArrowStyle(position)]} />
      </View>
    </View>
  );
}

function getTooltipPosition(targetLayout: any, position: string) {
  const tooltipWidth = 250;
  const tooltipHeight = 60;
  
  switch (position) {
    case 'top':
      return {
        left: targetLayout.x + (targetLayout.width - tooltipWidth) / 2,
        top: targetLayout.y - tooltipHeight - 20,
      };
    case 'bottom':
      return {
        left: targetLayout.x + (targetLayout.width - tooltipWidth) / 2,
        top: targetLayout.y + targetLayout.height + 20,
      };
    case 'left':
      return {
        left: targetLayout.x - tooltipWidth - 20,
        top: targetLayout.y + (targetLayout.height - tooltipHeight) / 2,
      };
    case 'right':
      return {
        left: targetLayout.x + targetLayout.width + 20,
        top: targetLayout.y + (targetLayout.height - tooltipHeight) / 2,
      };
    default:
      return {
        left: targetLayout.x + (targetLayout.width - tooltipWidth) / 2,
        top: targetLayout.y + targetLayout.height + 20,
      };
  }
}

function getArrowStyle(position: string): {
  bottom?: number;
  top?: number | string;
  left?: number | string;
  right?: number;
  marginLeft?: number;
  marginTop?: number;
  borderTopColor?: string;
  borderBottomColor?: string;
  borderLeftColor?: string;
  borderRightColor?: string;
} {
  switch (position) {
    case 'top':
      return {
        bottom: -6,
        left: '50%',
        marginLeft: -6,
        borderTopColor: '#1F2937',
      };
    case 'bottom':
      return {
        top: -6,
        left: '50%',
        marginLeft: -6,
        borderBottomColor: '#1F2937',
      };
    case 'left':
      return {
        top: '50%',
        right: -6,
        marginTop: -6,
        borderLeftColor: '#1F2937',
      };
    case 'right':
      return {
        top: '50%',
        left: -6,
        marginTop: -6,
        borderRightColor: '#1F2937',
      };
    default:
      return {
        top: -6,
        left: '50%',
        marginLeft: -6,
        borderBottomColor: '#1F2937',
      };
  }
}

export default function ImmersiveTutorial({
  visible,
  steps,
  onComplete,
  onSkip,
  currentStep = 0,
  highlightTargets = {},
}: ImmersiveTutorialProps) {
  const router = useRouter();
  const { gameState } = useGame();
  const { setHighlight, clearHighlight } = useTutorialHighlight();
  const [currentStepIndex, setCurrentStepIndex] = useState(currentStep);
  // Chat bubbles removed to prevent duplicates
  const [isHighlighting, setIsHighlighting] = useState(false);
  const focusInputRef = useRef<TextInput | null>(null);
  
  // Web focus guard: ensure no focused element remains inside hidden overlay
  useEffect(() => {
    if (!visible && typeof document !== 'undefined') {
      const active = document.activeElement as HTMLElement | null;
      if (active && typeof active.blur === 'function') {
        try { active.blur(); } catch {}
      }
    }
  }, [visible]);

  // When opening on web, move focus into the tutorial to avoid aria-hidden warnings
  useEffect(() => {
    if (visible && Platform.OS === 'web') {
      // Defer to next tick so DOM is mounted
      const id = setTimeout(() => {
        try { focusInputRef.current?.focus(); } catch {}
      }, 0);
      return () => clearTimeout(id);
    }
    return undefined;
  }, [visible]);
  
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(50)).current;
  const progressAnim = useRef(new Animated.Value(0)).current;

  const currentStepData = steps && steps.length > 0 && currentStepIndex >= 0 && currentStepIndex < steps.length 
    ? steps[currentStepIndex] 
    : null;
  const isLastStep = currentStepIndex === steps.length - 1;

  useEffect(() => {
    const stepData = steps && steps.length > 0 && currentStepIndex >= 0 && currentStepIndex < steps.length 
      ? steps[currentStepIndex] 
      : null;
    if (visible && stepData) {
      // Animate in
      Animated.parallel([
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: 500,
          useNativeDriver: true,
        }),
        Animated.spring(slideAnim, {
          toValue: 0,
          tension: 100,
          friction: 8,
          useNativeDriver: true,
        }),
      ]).start();

      // Chat sequence removed

      // Show highlights if target exists
      if (stepData.target && highlightTargets[stepData.target]) {
        setTimeout(() => {
          setIsHighlighting(true);
        }, 1000);
      }
    }
  }, [visible, currentStepIndex, steps, fadeAnim, slideAnim, highlightTargets]);

  useEffect(() => {
    // Update progress bar
    if (steps.length > 0) {
      Animated.timing(progressAnim, {
        toValue: ((currentStepIndex + 1) / steps.length) * 100,
        duration: 300,
        useNativeDriver: false,
      }).start();
    }
  }, [currentStepIndex, steps.length, progressAnim]);

  const handleSmartNavigation = (action: string) => {
    try {
      const homeTab: Href = '/';
      const workTab: Href = '/(tabs)/work';
      const marketTab: Href = '/(tabs)/market';
      const computerTab: Href = '/(tabs)/computer';
      const mobileTab: Href = '/(tabs)/mobile';
      const healthTab: Href = '/(tabs)/health';

      switch (action) {
        case 'navigate_to_work':
          router.push(workTab);
          break;
        
        case 'navigate_to_market':
          // Check if player has computer for stock market
          if (!gameState.items?.some(item => item.id === 'computer' && item.owned)) {
            // Navigate to market to buy computer
            router.push(marketTab);
            // Delay highlighting to allow navigation to complete
            setTimeout(() => {
              try {
                setHighlight('computer', 'computer-item', 'Buy a computer to access the stock market!');
              } catch (error) {
                logger.warn('Failed to set highlight:', { error: String(error) });
              }
            }, 500);
          } else {
            // Navigate to computer tab then stock app
            router.push(computerTab);
            // Delay highlighting to allow navigation to complete
            setTimeout(() => {
              try {
                setHighlight('stock-app', 'stock-app', 'Click here to access the stock market!');
              } catch (error) {
                logger.warn('Failed to set highlight:', { error: String(error) });
              }
            }, 500);
          }
          break;
        
        case 'open_mobile':
          // Check if player has smartphone
          if (!gameState.items?.some(item => item.id === 'smartphone' && item.owned)) {
            // Navigate to market to buy smartphone
            router.push(marketTab);
            // Delay highlighting to allow navigation to complete
            setTimeout(() => {
              try {
                setHighlight('smartphone', 'smartphone-item', 'Buy a smartphone to access mobile apps!');
              } catch (error) {
                logger.warn('Failed to set highlight:', { error: String(error) });
              }
            }, 500);
          } else {
            // Navigate to mobile tab
            router.push(mobileTab);
          }
          break;
        
        case 'open_computer':
          // Check if player has computer
          if (!gameState.items?.some(item => item.id === 'computer' && item.owned)) {
            // Navigate to market to buy computer
            router.push(marketTab);
            // Delay highlighting to allow navigation to complete
            setTimeout(() => {
              try {
                setHighlight('computer', 'computer-item', 'Buy a computer to access advanced features!');
              } catch (error) {
                logger.warn('Failed to set highlight:', { error: String(error) });
              }
            }, 500);
          } else {
            // Navigate to computer tab
            router.push(computerTab);
          }
          break;
        
        case 'improve_health':
          // Navigate to health tab for medical care
          router.push(healthTab);
          // Delay highlighting to allow navigation to complete
          setTimeout(() => {
            try {
              setHighlight('health-tab', 'health-tab', 'Visit a doctor or exercise to improve your health!');
            } catch (error) {
              logger.warn('Failed to set highlight:', { error: String(error) });
            }
          }, 500);
          break;
        
        case 'rest_energy':
          // Navigate to home tab for rest
          router.push(homeTab);
          // Delay highlighting to allow navigation to complete
          setTimeout(() => {
            try {
              setHighlight('rest-activity', 'rest-activity', 'Use the Rest activity to recover energy!');
            } catch (error) {
              logger.warn('Failed to set highlight:', { error: String(error) });
            }
          }, 500);
          break;
        
        case 'manage_money':
          // Check if player has smartphone for banking
          if (gameState.items?.some(item => item.id === 'smartphone' && item.owned)) {
            router.push(mobileTab);
            // Delay highlighting to allow navigation to complete
            setTimeout(() => {
              try {
                setHighlight('banking-app', 'banking-app', 'Use the Banking app to manage your money!');
              } catch (error) {
                logger.warn('Failed to set highlight:', { error: String(error) });
              }
            }, 500);
          } else {
            // Navigate to market to buy smartphone for banking
            router.push(marketTab);
            // Delay highlighting to allow navigation to complete
            setTimeout(() => {
              try {
                setHighlight('smartphone', 'smartphone-item', 'Buy a smartphone to access banking!');
              } catch (error) {
                logger.warn('Failed to set highlight:', { error: String(error) });
              }
            }, 500);
          }
          break;

        case 'view_stats':
          // Navigate to home tab to view stats
          router.push(homeTab);
          break;

        case 'perform_activity':
          // Navigate to home tab for main activities
          router.push(homeTab);
          break;

        case 'view_achievements':
          // Navigate to home tab to view achievements
          router.push(homeTab);
          break;

        case 'open_settings':
          // Navigate to settings (this would need to be implemented)
          // For now, just navigate to home
          router.push(homeTab);
          break;
        
        default:
          // No navigation needed
          break;
      }
    } catch (error) {
      logger.warn('Tutorial navigation failed:', { error: String(error) });
      // Continue with tutorial even if navigation fails
    }
  };

  const handleNext = () => {
    try {
      setIsHighlighting(false);

      // Handle special navigation actions
      if (currentStepData && 'requiresAction' in currentStepData && currentStepData.requiresAction) {
        handleSmartNavigation(String(currentStepData.requiresAction));
      }

      if (isLastStep) {
        clearHighlight();
        onComplete();
      } else {
        setCurrentStepIndex(currentStepIndex + 1);
      }
    } catch (error) {
      logger.error('Tutorial next step failed:', error);
      // Fallback: just complete the tutorial to prevent infinite crash loop
      onComplete();
    }
  };



  const getStepIcon = (stepId: string) => {
    const iconMap: { [key: string]: any } = {
      // Main Tutorial Steps (using tutorial step images)
      'welcome': WelcomeIcon,
      'character-stats': Heart, // Using Lucide Heart icon
      'age-progression': AgeProgressionIcon,
      'main-activities': MainActivitiesIcon,
      'first-job-application': FirstJobApplicationIcon,
      
      // Additional Tutorial Steps (using Lucide icons)
      'market-place': TrendingUp,
      'mobile-phone': Smartphone,
      'computer-activities': Laptop,
      'health-wellness': Heart,
      'social-relationships': Users,
      'achievements-goals': Target,
      'settings-customization': Settings,
      'ready-to-play': Play,
      
      // Extended Tutorial Steps (using Lucide icons)
      'market-investments': TrendingUp,
      'advanced-features': Zap,
      'scenario-selection': Target,
      'character-customization': Users,
      'perks-selection': Sparkles,
      'save-slot': Briefcase,
    };
    return iconMap[stepId] || MessageCircle;
  };

  const getStepColor = (stepId: string) => {
    const colorMap: { [key: string]: string } = {
      'welcome': '#3B82F6',
      'character-stats': '#EF4444',
      'age-progression': '#10B981',
      'main-activities': '#F59E0B',
      'mobile-phone': '#8B5CF6',
      'computer-activities': '#06B6D4',
      'market-investments': '#10B981',
      'health-wellness': '#EF4444',
      'social-relationships': '#F59E0B',
      'achievements-goals': '#8B5CF6',
      'settings-customization': '#6B7280',
      'ready-to-play': '#10B981',
    };
    return colorMap[stepId] || '#3B82F6';
  };

  if (!visible || steps.length === 0 || !currentStepData) return null;

  const StepIcon = getStepIcon(currentStepData?.id || 'default');
  const stepColor = getStepColor(currentStepData?.id || 'default');

  // Web-safe icon renderer: handles images (number on native, object on web) and components
  const renderStepIcon = () => {
    const iconValue: any = StepIcon;
    if (!iconValue) {
      return <MessageCircle size={24} color={stepColor} />;
    }
    // Image source handling: native returns number, web may return string or object
    if (typeof iconValue === 'number') {
      return (
        <Image
          source={iconValue}
          style={[styles.stepImage, { tintColor: stepColor }]}
          resizeMode="contain"
        />
      );
    }
    if (typeof iconValue === 'string') {
      return (
        <Image
          source={{ uri: iconValue }}
          style={[styles.stepImage, { tintColor: stepColor }]}
          resizeMode="contain"
        />
      );
    }
    if (typeof iconValue === 'object') {
      const src = (iconValue && (iconValue.uri || iconValue.default || iconValue.src)) || iconValue;
      return (
        <Image
          source={typeof src === 'string' ? { uri: src } : (src as ImageSourcePropType)}
          style={[styles.stepImage, { tintColor: stepColor }]}
          resizeMode="contain"
        />
      );
    }
    if (typeof iconValue === 'function') {
      const IconComponent = iconValue as React.ComponentType<{ size?: number; color?: string }>;
      return <IconComponent size={24} color={stepColor} />;
    }
    return <MessageCircle size={24} color={stepColor} />;
  };

  return (
    <View style={styles.overlay}>
      {/* Background without shade */}
      <View style={styles.background}>
        {/* Focus trap (web only) */}
        {Platform.OS === 'web' && (
          <TextInput
            ref={focusInputRef}
            value=""
            onChangeText={() => {}}
            style={styles.srOnlyInput}
            autoCapitalize="none"
            autoCorrect={false}
            underlineColorAndroid="transparent"
          />
        )}
        {/* Skip button */}
        <TouchableOpacity onPress={onSkip} style={styles.skipButton}>
          <LinearGradient
            colors={['rgba(255,255,255,0.1)', 'rgba(255,255,255,0.05)']}
            style={styles.skipButtonGradient}
          >
            <SkipForward size={18} color="#fff" />
            <Text style={styles.skipText}>Skip Tutorial</Text>
          </LinearGradient>
        </TouchableOpacity>

        {/* Progress indicator */}
        <View style={styles.progressContainer}>
          <View style={styles.progressBar}>
            <Animated.View
              style={[
                styles.progressFill,
                {
                  width: progressAnim.interpolate({
                    inputRange: [0, 100],
                    outputRange: ['0%', '100%'],
                  }),
                },
              ]}
            >
              <LinearGradient
                colors={[stepColor, `${stepColor}80`]}
                style={styles.progressGradient}
              />
            </Animated.View>
          </View>
          <Text style={styles.progressText}>
            {currentStepIndex + 1} of {steps.length}
          </Text>
          
          {/* Action buttons moved under progress bar */}
          <View style={styles.actions}>
            <TouchableOpacity
              onPress={onSkip}
              style={styles.actionButton}
            >
              <LinearGradient
                colors={['#DC2626', '#EF4444']}
                style={styles.actionButtonGradient}
              >
                <X size={16} color="#FFFFFF" />
                <Text style={styles.actionButtonText}>Skip</Text>
              </LinearGradient>
            </TouchableOpacity>

            <TouchableOpacity onPress={handleNext} style={styles.primaryButton}>
              <LinearGradient
                colors={['#10B981', '#059669']}
                style={styles.primaryButtonGradient}
              >
                {isLastStep ? (
                  <>
                    <Play size={18} color="#FFFFFF" />
                    <Text style={styles.primaryButtonText}>Start Playing</Text>
                  </>
                ) : (
                  <>
                    <Text style={styles.primaryButtonText}>Next</Text>
                    <ArrowRight size={18} color="#FFFFFF" />
                  </>
                )}
              </LinearGradient>
            </TouchableOpacity>
          </View>
        </View>

        {/* Highlight overlay */}
        {currentStepData?.target && highlightTargets[currentStepData.target] && (
          <HighlightOverlay
            target={highlightTargets[currentStepData.target]}
            visible={isHighlighting}
            message={currentStepData?.title || 'Tutorial Step'}
            position={(currentStepData?.position as 'top' | 'bottom' | 'left' | 'right') || 'bottom'}
          />
        )}

        {/* Chat bubbles removed to prevent duplicates */}

        {/* Main tutorial card - slimmer with liquid glass theme */}
        <Animated.View
          style={[
            styles.cardContainer,
            {
              opacity: fadeAnim,
              transform: [{ translateY: slideAnim }],
            },
          ]}
        >
          <MotiView
            from={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ type: 'spring', damping: 15 }}
            style={styles.card}
          >
            <LinearGradient
              colors={['rgba(255,255,255,0.85)', 'rgba(255,255,255,0.75)']}
              style={styles.cardGradient}
            >
              {/* Header */}
              <View style={styles.header}>
                <View style={[styles.iconContainer, { backgroundColor: `${stepColor}30` }]}>
                  {renderStepIcon()}
                </View>
                <View style={styles.headerContent}>
                  <Text style={styles.stepNumber}>
                    Step {currentStepIndex + 1}
                  </Text>
                  <Text style={styles.title}>{currentStepData?.title || 'Tutorial Step'}</Text>
                </View>
              </View>

              {/* Description */}
              {currentStepData?.description && (
                <View style={styles.descriptionContainer}>
                  <LinearGradient
                    colors={['rgba(16, 185, 129, 0.2)', 'rgba(5, 150, 105, 0.15)']}
                    style={styles.descriptionBubble}
                  >
                    <Text style={styles.descriptionText}>
                      {currentStepData.description}
                    </Text>
                  </LinearGradient>
                </View>
              )}
            </LinearGradient>
          </MotiView>
        </Animated.View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 3000,
  },
  background: {
    flex: 1,
    backgroundColor: 'transparent',
  },
  skipButton: {
    position: 'absolute',
    top: 60,
    right: 20,
    zIndex: 3100,
  },
  skipButtonGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.3)',
    backdropFilter: 'blur(10px)',
  },
  skipText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
    marginLeft: 6,
  },
  progressContainer: {
    position: 'absolute',
    top: 100,
    left: 20,
    right: 20,
    zIndex: 3100,
  },
  progressBar: {
    height: 6,
    backgroundColor: 'rgba(255,255,255,0.2)',
    borderRadius: 3,
    overflow: 'hidden',
    backdropFilter: 'blur(10px)',
  },
  progressFill: {
    height: '100%',
    borderRadius: 3,
  },
  progressGradient: {
    flex: 1,
  },
  progressText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '600',
    textAlign: 'center',
    marginTop: 8,
    textShadowColor: 'rgba(0,0,0,0.5)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
  highlightContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 3200,
  },
  darkOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.7)',
  },
  cutout: {
    position: 'absolute',
    backgroundColor: 'transparent',
    borderWidth: 2,
    borderColor: '#3B82F6',
    borderRadius: 8,
  },
  highlightRing: {
    position: 'absolute',
    borderRadius: 8,
    borderWidth: 3,
    borderColor: 'transparent',
  },
  ringGradient: {
    flex: 1,
    borderRadius: 8,
  },
  tooltip: {
    position: 'absolute',
    backgroundColor: '#1F2937',
    borderRadius: 12,
    padding: 12,
    minWidth: 200,
    maxWidth: 280,
    ...getShadow(8, '#000'),
  },
  tooltipGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: 12,
  },
  tooltipIcon: {
    marginRight: 8,
  },
  tooltipText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
    flex: 1,
  },
  tooltipArrow: {
    position: 'absolute',
    width: 0,
    height: 0,
    borderWidth: 6,
    borderColor: 'transparent',
  },
  // Chat container removed
  // Chat bubble styles removed
  cardContainer: {
    position: 'absolute',
    top: 200,
    left: 30,
    right: 30,
    zIndex: 3400,
  },
  card: {
    borderRadius: 16,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 8,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
    backdropFilter: 'blur(20px)',
  },
  cardGradient: {
    padding: 16,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 0,
  },
  iconContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
    backdropFilter: 'blur(10px)',
  },
  stepImage: {
    width: 20,
    height: 20,
  },
  headerContent: {
    flex: 1,
  },
  stepNumber: {
    fontSize: 10,
    color: '#6B7280',
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: 2,
  },
  title: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#1F2937',
    lineHeight: 22,
  },
  descriptionContainer: {
    marginTop: 12,
  },
  descriptionBubble: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(16, 185, 129, 0.2)',
    backdropFilter: 'blur(10px)',
  },
  descriptionText: {
    fontSize: 14,
    color: '#1F2937',
    lineHeight: 20,
    fontWeight: '500',
  },
  actions: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 12,
    marginTop: 16,
  },
  actionButton: {
    borderRadius: 12,
    overflow: 'hidden',
  },
  actionButtonDisabled: {
    opacity: 0.5,
  },
  actionButtonGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
    backdropFilter: 'blur(10px)',
  },
  actionButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
    marginLeft: 8,
  },
  actionButtonTextDisabled: {
    color: '#9CA3AF',
  },
  primaryButton: {
    borderRadius: 12,
    overflow: 'hidden',
    shadowColor: '#3B82F6',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 6,
  },
  primaryButtonGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
    backdropFilter: 'blur(10px)',
  },
  primaryButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: 'bold',
    marginHorizontal: 8,
  },
  srOnlyInput: {
    position: 'absolute',
    width: 1,
    height: 1,
    margin: -1,
    borderWidth: 0,
    padding: 0,
    // Web-only: hide visually while keeping focusable
    clipPath: 'inset(50%)',
    outlineWidth: 0,
    opacity: 0,
  },
  // Chat bubble styles
  chatBubble: {
    marginBottom: 12,
    maxWidth: '80%',
  },
  userBubble: {
    alignSelf: 'flex-end',
  },
  guideBubble: {
    alignSelf: 'flex-start',
  },
  bubbleGradient: {
    padding: 12,
    borderRadius: 16,
  },
  bubbleText: {
    color: '#FFFFFF',
    fontSize: 14,
    lineHeight: 20,
  },
  userBubbleText: {
    color: '#FFFFFF',
  },
  bubbleAvatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    marginRight: 8,
    overflow: 'hidden',
  },
  avatarImage: {
    width: '100%',
    height: '100%',
  },
});
