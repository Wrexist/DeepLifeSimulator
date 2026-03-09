import React, { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Modal, Animated, Dimensions } from 'react-native';
import LinearGradientFallback from '@/components/fallbacks/LinearGradientFallback';
const LinearGradient = LinearGradientFallback;
import { Target, CheckCircle, Star, DollarSign, Gem, TrendingUp, Award } from 'lucide-react-native';
import { responsiveFontSize, responsiveSpacing, responsiveBorderRadius, scale } from '@/utils/scaling';

interface GoalReward {
  type: 'money' | 'gems' | 'happiness' | 'energy' | 'health';
  amount: number;
  icon: React.ComponentType<any>;
  color: string;
}

interface CompletedGoal {
  id: string;
  title: string;
  description: string;
  reward: GoalReward;
}

interface NextGoal {
  id: string;
  title: string;
  description: string;
  progress: number;
}

interface GoalCompletionPopupProps {
  visible: boolean;
  completedGoal: CompletedGoal | null;
  nextGoal: NextGoal | null;
  onClose: () => void;
  darkMode?: boolean;
}

const { width } = Dimensions.get('window');

export default function GoalCompletionPopup({ 
  visible, 
  completedGoal, 
  nextGoal, 
  onClose, 
  darkMode = false 
}: GoalCompletionPopupProps) {
  const scaleAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(50)).current;
  const fadeAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (visible) {
      // Entrance animation
      Animated.parallel([
        Animated.spring(scaleAnim, {
          toValue: 1,
          useNativeDriver: true,
          tension: 100,
          friction: 8,
        }),
        Animated.timing(slideAnim, {
          toValue: 0,
          duration: 300,
          useNativeDriver: true,
        }),
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: 300,
          useNativeDriver: true,
        }),
      ]).start();

      // Auto close after 4 seconds
      const timer = setTimeout(() => {
        handleClose();
      }, 4000);

      return () => clearTimeout(timer);
    } else {
      // Reset animations
      scaleAnim.setValue(0);
      slideAnim.setValue(50);
      fadeAnim.setValue(0);
    }
  }, [visible]);

  const handleClose = () => {
    Animated.parallel([
      Animated.timing(scaleAnim, {
        toValue: 0,
        duration: 200,
        useNativeDriver: true,
      }),
      Animated.timing(slideAnim, {
        toValue: 50,
        duration: 200,
        useNativeDriver: true,
      }),
      Animated.timing(fadeAnim, {
        toValue: 0,
        duration: 200,
        useNativeDriver: true,
      }),
    ]).start(() => {
      onClose();
    });
  };

  if (!visible || !completedGoal) return null;

  const RewardIcon = completedGoal.reward.icon;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="none"
      onRequestClose={handleClose}
    >
      <Animated.View 
        style={[
          styles.overlay,
          { opacity: fadeAnim }
        ]}
      >
        <Animated.View
          style={[
            styles.container,
            {
              transform: [
                { scale: scaleAnim },
                { translateY: slideAnim }
              ]
            }
          ]}
        >
          <LinearGradient
            colors={darkMode ? ['#1F2937', '#374151'] : ['#FFFFFF', '#F8FAFC']}
            style={styles.popup}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
          >
            {/* Header */}
            <View style={styles.header}>
              <View style={[styles.iconContainer, { backgroundColor: completedGoal.reward.color + '20' }]}>
                <CheckCircle size={32} color={completedGoal.reward.color} />
              </View>
              <Text style={[styles.title, darkMode && styles.titleDark]}>
                Goal Completed!
              </Text>
            </View>

            {/* Completed Goal */}
            <View style={styles.completedGoalSection}>
              <View style={styles.goalHeader}>
                <Target size={20} color="#10B981" />
                <Text style={[styles.goalTitle, darkMode && styles.goalTitleDark]}>
                  {completedGoal.title}
                </Text>
              </View>
              <Text style={[styles.goalDescription, darkMode && styles.goalDescriptionDark]}>
                {completedGoal.description}
              </Text>
            </View>

            {/* Reward */}
            <View style={styles.rewardSection}>
              <Text style={[styles.rewardLabel, darkMode && styles.rewardLabelDark]}>
                Reward Earned:
              </Text>
              <View style={styles.rewardContainer}>
                <View style={[styles.rewardIcon, { backgroundColor: completedGoal.reward.color + '20' }]}>
                  <RewardIcon size={24} color={completedGoal.reward.color} />
                </View>
                <Text style={[styles.rewardText, darkMode && styles.rewardTextDark]}>
                  +{completedGoal.reward.amount} {completedGoal.reward.type === 'money' ? '$' : 
                    completedGoal.reward.type === 'gems' ? 'gems' : 
                    completedGoal.reward.type}
                </Text>
              </View>
            </View>

            {/* Next Goal Preview */}
            {nextGoal && (
              <View style={styles.nextGoalSection}>
                <View style={styles.nextGoalHeader}>
                  <Star size={16} color="#F59E0B" />
                  <Text style={[styles.nextGoalLabel, darkMode && styles.nextGoalLabelDark]}>
                    Next Goal:
                  </Text>
                </View>
                <Text style={[styles.nextGoalTitle, darkMode && styles.nextGoalTitleDark]}>
                  {nextGoal.title}
                </Text>
                <View style={styles.nextGoalProgress}>
                  <View style={[styles.nextGoalProgressBar, darkMode && styles.nextGoalProgressBarDark]}>
                    <View 
                      style={[
                        styles.nextGoalProgressFill, 
                        { width: `${nextGoal.progress}%` }
                      ]} 
                    />
                  </View>
                  <Text style={[styles.nextGoalProgressText, darkMode && styles.nextGoalProgressTextDark]}>
                    {Math.round(nextGoal.progress)}%
                  </Text>
                </View>
              </View>
            )}

            {/* Close Button */}
            <View style={styles.closeButton} onTouchEnd={handleClose}>
              <Text style={[styles.closeButtonText, darkMode && styles.closeButtonTextDark]}>
                Tap to continue
              </Text>
            </View>
          </LinearGradient>
        </Animated.View>
      </Animated.View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: responsiveSpacing.lg,
  },
  container: {
    width: width * 0.9,
    maxWidth: scale(400),
  },
  popup: {
    borderRadius: responsiveBorderRadius.xl,
    padding: responsiveSpacing.xl,
    boxShadow: '0px 4px 8px rgba(0, 0, 0, 0.3)',
    elevation: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
  },
  header: {
    alignItems: 'center',
    marginBottom: responsiveSpacing.lg,
  },
  iconContainer: {
    width: scale(64),
    height: scale(64),
    borderRadius: scale(32),
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: responsiveSpacing.sm,
  },
  title: {
    fontSize: responsiveFontSize['2xl'],
    fontWeight: '700',
    color: '#1F2937',
    textAlign: 'center',
  },
  titleDark: {
    color: '#F9FAFB',
  },
  completedGoalSection: {
    marginBottom: responsiveSpacing.lg,
    padding: responsiveSpacing.md,
    backgroundColor: 'rgba(16, 185, 129, 0.1)',
    borderRadius: responsiveBorderRadius.md,
    borderLeftWidth: 4,
    borderLeftColor: '#10B981',
  },
  goalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: responsiveSpacing.xs,
  },
  goalTitle: {
    fontSize: responsiveFontSize.lg,
    fontWeight: '600',
    color: '#1F2937',
    marginLeft: responsiveSpacing.sm,
  },
  goalTitleDark: {
    color: '#F9FAFB',
  },
  goalDescription: {
    fontSize: responsiveFontSize.sm,
    color: '#4B5563',
    lineHeight: 20,
  },
  goalDescriptionDark: {
    color: '#D1D5DB',
  },
  rewardSection: {
    marginBottom: responsiveSpacing.lg,
    padding: responsiveSpacing.md,
    backgroundColor: 'rgba(245, 158, 11, 0.1)',
    borderRadius: responsiveBorderRadius.md,
    borderLeftWidth: 4,
    borderLeftColor: '#F59E0B',
  },
  rewardLabel: {
    fontSize: responsiveFontSize.sm,
    fontWeight: '600',
    color: '#374151',
    marginBottom: responsiveSpacing.sm,
  },
  rewardLabelDark: {
    color: '#D1D5DB',
  },
  rewardContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  rewardIcon: {
    width: scale(40),
    height: scale(40),
    borderRadius: scale(20),
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: responsiveSpacing.sm,
  },
  rewardText: {
    fontSize: responsiveFontSize.lg,
    fontWeight: '700',
    color: '#1F2937',
  },
  rewardTextDark: {
    color: '#F9FAFB',
  },
  nextGoalSection: {
    marginBottom: responsiveSpacing.lg,
    padding: responsiveSpacing.md,
    backgroundColor: 'rgba(59, 130, 246, 0.1)',
    borderRadius: responsiveBorderRadius.md,
    borderLeftWidth: 4,
    borderLeftColor: '#3B82F6',
  },
  nextGoalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: responsiveSpacing.xs,
  },
  nextGoalLabel: {
    fontSize: responsiveFontSize.sm,
    fontWeight: '600',
    color: '#374151',
    marginLeft: responsiveSpacing.xs,
  },
  nextGoalLabelDark: {
    color: '#D1D5DB',
  },
  nextGoalTitle: {
    fontSize: responsiveFontSize.base,
    fontWeight: '600',
    color: '#1F2937',
    marginBottom: responsiveSpacing.sm,
  },
  nextGoalTitleDark: {
    color: '#F9FAFB',
  },
  nextGoalProgress: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  nextGoalProgressBar: {
    flex: 1,
    height: 6,
    backgroundColor: '#E5E7EB',
    borderRadius: responsiveBorderRadius.sm,
    marginRight: responsiveSpacing.sm,
    overflow: 'hidden',
  },
  nextGoalProgressBarDark: {
    backgroundColor: '#4B5563',
  },
  nextGoalProgressFill: {
    height: '100%',
    backgroundColor: '#3B82F6',
    borderRadius: responsiveBorderRadius.sm,
  },
  nextGoalProgressText: {
    fontSize: responsiveFontSize.sm,
    fontWeight: '600',
    color: '#374151',
  },
  nextGoalProgressTextDark: {
    color: '#D1D5DB',
  },
  closeButton: {
    alignItems: 'center',
    paddingVertical: responsiveSpacing.sm,
  },
  closeButtonText: {
    fontSize: responsiveFontSize.sm,
    color: '#6B7280',
    fontStyle: 'italic',
  },
  closeButtonTextDark: {
    color: '#9CA3AF',
  },
});

