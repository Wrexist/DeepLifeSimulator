import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Animated,
  Dimensions,
  Modal,
  ScrollView,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
import { MotiView } from 'moti';
import {
  Trophy,
  Star,
  Lock,
  Eye,
  EyeOff,
  Clock,
  Target,
  Zap,
  Crown,
  Gem,
  Award,
  TrendingUp,
  Users,
  Heart,
  Home,
  Coins,
  Briefcase,
  GraduationCap,
  Baby,
  Bitcoin,
  Building,
  Sparkles,
  Info,
  CheckCircle,
  XCircle,
} from 'lucide-react-native';
import { EnhancedAchievement, AchievementProgress } from '@/utils/enhancedAchievements';
import {
  getRarityColor,
  getRarityGlow,
  getDifficultyText,
  getDifficultyColor,
  calculateAchievementProgress,
} from '@/utils/enhancedAchievements';
import { useFeedback } from '@/utils/feedbackSystem';
import { DesignSystem } from '@/utils/designSystem';

interface EnhancedAchievementCardProps {
  achievement: EnhancedAchievement;
  progress: AchievementProgress;
  gameState: any;
  onClaim?: (achievementId: string) => void;
  onHint?: (achievementId: string) => void;
  darkMode?: boolean;
  compact?: boolean;
}

const { width } = Dimensions.get('window');

export default function EnhancedAchievementCard({
  achievement,
  progress,
  gameState,
  onClaim,
  onHint,
  darkMode = false,
  compact = false,
}: EnhancedAchievementCardProps) {
  const [showDetails, setShowDetails] = useState(false);
  const [showHint, setShowHint] = useState(false);
  const { buttonPress, haptic } = useFeedback(gameState?.settings?.hapticFeedback || false);
  
  const progressValue = calculateAchievementProgress(achievement, gameState);
  const isCompleted = progressValue >= 1;
  const isClaimed = progress.claimed;
  const isHidden = achievement.hidden && !isCompleted;
  
  const scaleAnim = useRef(new Animated.Value(1)).current;
  const glowAnim = useRef(new Animated.Value(0)).current;
  const progressAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    // Animate progress bar
    Animated.timing(progressAnim, {
      toValue: progressValue,
      duration: 1000,
      useNativeDriver: false,
    }).start();

    // Glow animation for completed achievements
    if (isCompleted && !isClaimed) {
      const glowLoop = Animated.loop(
        Animated.sequence([
          Animated.timing(glowAnim, {
            toValue: 1,
            duration: 2000,
            useNativeDriver: false,
          }),
          Animated.timing(glowAnim, {
            toValue: 0,
            duration: 2000,
            useNativeDriver: false,
          }),
        ])
      );
      glowLoop.start();
      return () => glowLoop.stop();
    }
  }, [progressValue, isCompleted, isClaimed]);

  const handlePress = () => {
    buttonPress();
    haptic('light');
    setShowDetails(true);
  };

  const handleClaim = () => {
    if (isCompleted && !isClaimed && onClaim) {
      buttonPress();
      haptic('success');
      onClaim(achievement.id);
      setShowDetails(false);
    }
  };

  const handleHint = () => {
    if (achievement.hidden && !isCompleted && onHint) {
      buttonPress();
      haptic('light');
      onHint(achievement.id);
      setShowHint(true);
    }
  };

  const getCategoryIcon = () => {
    switch (achievement.category) {
      case 'wealth': return <Coins size={20} color="#10B981" />;
      case 'career': return <Briefcase size={20} color="#F59E0B" />;
      case 'social': return <Users size={20} color="#EF4444" />;
      case 'health': return <Heart size={20} color="#06B6D4" />;
      case 'family': return <Baby size={20} color="#8B5CF6" />;
      case 'crypto': return <Bitcoin size={20} color="#F97316" />;
      case 'real_estate': return <Home size={20} color="#84CC16" />;
      case 'special': return <Star size={20} color="#F59E0B" />;
      default: return <Trophy size={20} color="#6B7280" />;
    }
  };

  const getRarityIcon = () => {
    switch (achievement.rarity) {
      case 'common': return <Award size={16} color="#6B7280" />;
      case 'uncommon': return <Star size={16} color="#10B981" />;
      case 'rare': return <Zap size={16} color="#3B82F6" />;
      case 'epic': return <Crown size={16} color="#8B5CF6" />;
      case 'legendary': return <Trophy size={16} color="#F59E0B" />;
      case 'mythic': return <Sparkles size={16} color="#EF4444" />;
      default: return <Award size={16} color="#6B7280" />;
    }
  };

  const renderCompactCard = () => (
    <TouchableOpacity
      style={[
        styles.compactCard,
        darkMode && styles.compactCardDark,
        isCompleted && !isClaimed && styles.completedCard,
      ]}
      onPress={handlePress}
      activeOpacity={0.8}
    >
      <LinearGradient
        colors={darkMode ? ['#1F2937', '#111827'] : ['#FFFFFF', '#F9FAFB']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.compactGradient}
      >
        <View style={styles.compactHeader}>
          <View style={styles.compactIconContainer}>
            {isHidden ? (
              <Lock size={20} color="#6B7280" />
            ) : (
              getCategoryIcon()
            )}
          </View>
          <View style={styles.compactInfo}>
            <Text style={[styles.compactTitle, darkMode && styles.compactTitleDark]}>
              {isHidden ? 'Hidden Achievement' : achievement.title}
            </Text>
            <View style={styles.compactMeta}>
              {getRarityIcon()}
              <Text style={[styles.compactRarity, { color: getRarityColor(achievement.rarity) }]}>
                {achievement.rarity}
              </Text>
            </View>
          </View>
          <View style={styles.compactStatus}>
            {isClaimed ? (
              <CheckCircle size={24} color="#10B981" />
            ) : isCompleted ? (
              <MotiView
                from={{ scale: 1 }}
                animate={{ scale: [1, 1.2, 1] }}
                transition={{ type: 'timing', duration: 1000, loop: true }}
              >
                <Trophy size={24} color="#F59E0B" />
              </MotiView>
            ) : (
              <XCircle size={24} color="#6B7280" />
            )}
          </View>
        </View>
        
        {!isHidden && (
          <View style={styles.compactProgress}>
            <View style={[styles.compactProgressBar, darkMode && styles.compactProgressBarDark]}>
              <Animated.View
                style={[
                  styles.compactProgressFill,
                  {
                    width: progressAnim.interpolate({
                      inputRange: [0, 1],
                      outputRange: ['0%', '100%'],
                    }),
                    backgroundColor: getRarityColor(achievement.rarity),
                  },
                ]}
              />
            </View>
            <Text style={[styles.compactProgressText, darkMode && styles.compactProgressTextDark]}>
              {Math.round(progressValue * 100)}%
            </Text>
          </View>
        )}
      </LinearGradient>
    </TouchableOpacity>
  );

  const renderFullCard = () => (
    <TouchableOpacity
      style={[
        styles.fullCard,
        darkMode && styles.fullCardDark,
        isCompleted && !isClaimed && styles.completedCard,
      ]}
      onPress={handlePress}
      activeOpacity={0.8}
    >
      <LinearGradient
        colors={darkMode ? ['#1F2937', '#111827'] : ['#FFFFFF', '#F9FAFB']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.fullGradient}
      >
        <View style={styles.fullHeader}>
          <View style={styles.fullIconContainer}>
            {isHidden ? (
              <Lock size={32} color="#6B7280" />
            ) : (
              getCategoryIcon()
            )}
          </View>
          <View style={styles.fullInfo}>
            <Text style={[styles.fullTitle, darkMode && styles.fullTitleDark]}>
              {isHidden ? 'Hidden Achievement' : achievement.title}
            </Text>
            <Text style={[styles.fullDescription, darkMode && styles.fullDescriptionDark]}>
              {isHidden ? 'Complete this achievement to reveal its details' : achievement.description}
            </Text>
            <View style={styles.fullMeta}>
              <View style={styles.fullMetaItem}>
                {getRarityIcon()}
                <Text style={[styles.fullMetaText, { color: getRarityColor(achievement.rarity) }]}>
                  {achievement.rarity}
                </Text>
              </View>
              <View style={styles.fullMetaItem}>
                <Target size={16} color={getDifficultyColor(achievement.difficulty)} />
                <Text style={[styles.fullMetaText, { color: getDifficultyColor(achievement.difficulty) }]}>
                  {getDifficultyText(achievement.difficulty)}
                </Text>
              </View>
              {achievement.estimatedTime && (
                <View style={styles.fullMetaItem}>
                  <Clock size={16} color="#6B7280" />
                  <Text style={[styles.fullMetaText, darkMode && styles.fullMetaTextDark]}>
                    {achievement.estimatedTime}
                  </Text>
                </View>
              )}
            </View>
          </View>
        </View>

        {!isHidden && (
          <View style={styles.fullProgress}>
            <View style={styles.fullProgressHeader}>
              <Text style={[styles.fullProgressLabel, darkMode && styles.fullProgressLabelDark]}>
                Progress
              </Text>
              <Text style={[styles.fullProgressPercent, darkMode && styles.fullProgressPercentDark]}>
                {Math.round(progressValue * 100)}%
              </Text>
            </View>
            <View style={[styles.fullProgressBar, darkMode && styles.fullProgressBarDark]}>
              <Animated.View
                style={[
                  styles.fullProgressFill,
                  {
                    width: progressAnim.interpolate({
                      inputRange: [0, 1],
                      outputRange: ['0%', '100%'],
                    }),
                    backgroundColor: getRarityColor(achievement.rarity),
                  },
                ]}
              />
            </View>
          </View>
        )}

        <View style={styles.fullRewards}>
          <Text style={[styles.fullRewardsLabel, darkMode && styles.fullRewardsLabelDark]}>
            Rewards
          </Text>
          <View style={styles.fullRewardsList}>
            <View style={styles.fullRewardItem}>
              <Gem size={16} color="#F59E0B" />
              <Text style={[styles.fullRewardText, darkMode && styles.fullRewardTextDark]}>
                {achievement.rewards.gems} gems
              </Text>
            </View>
            {achievement.rewards.experience && (
              <View style={styles.fullRewardItem}>
                <TrendingUp size={16} color="#10B981" />
                <Text style={[styles.fullRewardText, darkMode && styles.fullRewardTextDark]}>
                  {achievement.rewards.experience} XP
                </Text>
              </View>
            )}
            {achievement.rewards.title && (
              <View style={styles.fullRewardItem}>
                <Crown size={16} color="#8B5CF6" />
                <Text style={[styles.fullRewardText, darkMode && styles.fullRewardTextDark]}>
                  {achievement.rewards.title}
                </Text>
              </View>
            )}
          </View>
        </View>

        <View style={styles.fullActions}>
          {isCompleted && !isClaimed ? (
            <TouchableOpacity
              style={styles.claimButton}
              onPress={handleClaim}
              activeOpacity={0.8}
            >
              <LinearGradient
                colors={['#10B981', '#059669']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.claimButtonGradient}
              >
                <Trophy size={20} color="#FFFFFF" />
                <Text style={styles.claimButtonText}>Claim Reward</Text>
              </LinearGradient>
            </TouchableOpacity>
          ) : achievement.hidden && !isCompleted ? (
            <TouchableOpacity
              style={styles.hintButton}
              onPress={handleHint}
              activeOpacity={0.8}
            >
              <Eye size={20} color="#6B7280" />
              <Text style={[styles.hintButtonText, darkMode && styles.hintButtonTextDark]}>
                Get Hint
              </Text>
            </TouchableOpacity>
          ) : isClaimed ? (
            <View style={styles.claimedBadge}>
              <CheckCircle size={20} color="#10B981" />
              <Text style={styles.claimedText}>Claimed</Text>
            </View>
          ) : null}
        </View>
      </LinearGradient>
    </TouchableOpacity>
  );

  return (
    <>
      {compact ? renderCompactCard() : renderFullCard()}
      
      {/* Details Modal */}
      <Modal
        visible={showDetails}
        transparent
        animationType="fade"
        onRequestClose={() => setShowDetails(false)}
      >
        <View style={styles.modalOverlay}>
          <BlurView intensity={20} style={styles.modalBlur}>
            <View style={[styles.modalContainer, darkMode && styles.modalContainerDark]}>
              <ScrollView style={styles.modalContent} showsVerticalScrollIndicator={false}>
                <View style={styles.modalHeader}>
                  <Text style={[styles.modalTitle, darkMode && styles.modalTitleDark]}>
                    {achievement.title}
                  </Text>
                  <TouchableOpacity
                    onPress={() => setShowDetails(false)}
                    style={styles.modalCloseButton}
                  >
                    <XCircle size={24} color={darkMode ? '#FFFFFF' : '#374151'} />
                  </TouchableOpacity>
                </View>

                <View style={styles.modalDescription}>
                  <Text style={[styles.modalDescriptionText, darkMode && styles.modalDescriptionTextDark]}>
                    {achievement.description}
                  </Text>
                </View>

                {achievement.tips && achievement.tips.length > 0 && (
                  <View style={styles.modalTips}>
                    <Text style={[styles.modalTipsTitle, darkMode && styles.modalTipsTitleDark]}>
                      Tips
                    </Text>
                    {achievement.tips.map((tip, index) => (
                      <View key={index} style={styles.modalTipItem}>
                        <Info size={16} color="#3B82F6" />
                        <Text style={[styles.modalTipText, darkMode && styles.modalTipTextDark]}>
                          {tip}
                        </Text>
                      </View>
                    ))}
                  </View>
                )}

                <View style={styles.modalRewards}>
                  <Text style={[styles.modalRewardsTitle, darkMode && styles.modalRewardsTitleDark]}>
                    Rewards
                  </Text>
                  <View style={styles.modalRewardsList}>
                    <View style={styles.modalRewardItem}>
                      <Gem size={20} color="#F59E0B" />
                      <Text style={[styles.modalRewardText, darkMode && styles.modalRewardTextDark]}>
                        {achievement.rewards.gems} gems
                      </Text>
                    </View>
                    {achievement.rewards.experience && (
                      <View style={styles.modalRewardItem}>
                        <TrendingUp size={20} color="#10B981" />
                        <Text style={[styles.modalRewardText, darkMode && styles.modalRewardTextDark]}>
                          {achievement.rewards.experience} experience
                        </Text>
                      </View>
                    )}
                    {achievement.rewards.title && (
                      <View style={styles.modalRewardItem}>
                        <Crown size={20} color="#8B5CF6" />
                        <Text style={[styles.modalRewardText, darkMode && styles.modalRewardTextDark]}>
                          Title: {achievement.rewards.title}
                        </Text>
                      </View>
                    )}
                  </View>
                </View>
              </ScrollView>
            </View>
          </BlurView>
        </View>
      </Modal>

      {/* Hint Modal */}
      <Modal
        visible={showHint}
        transparent
        animationType="fade"
        onRequestClose={() => setShowHint(false)}
      >
        <View style={styles.modalOverlay}>
          <BlurView intensity={20} style={styles.modalBlur}>
            <View style={[styles.modalContainer, darkMode && styles.modalContainerDark]}>
              <View style={styles.modalHeader}>
                <Text style={[styles.modalTitle, darkMode && styles.modalTitleDark]}>
                  Achievement Hint
                </Text>
                <TouchableOpacity
                  onPress={() => setShowHint(false)}
                  style={styles.modalCloseButton}
                >
                  <XCircle size={24} color={darkMode ? '#FFFFFF' : '#374151'} />
                </TouchableOpacity>
              </View>
              <View style={styles.modalDescription}>
                <Text style={[styles.modalDescriptionText, darkMode && styles.modalDescriptionTextDark]}>
                  {achievement.unlockHint || 'This achievement is hidden. Keep playing to discover it!'}
                </Text>
              </View>
            </View>
          </BlurView>
        </View>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  // Compact Card Styles
  compactCard: {
    marginVertical: 4,
    borderRadius: 12,
    overflow: 'hidden',
    boxShadow: '0px 2px 4px rgba(0, 0, 0, 0.1)',
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  compactCardDark: {
    elevation: 4,
    shadowOpacity: 0.3,
  },
  completedCard: {
    elevation: 8,
    shadowOpacity: 0.2,
    shadowRadius: 8,
  },
  compactGradient: {
    padding: 12,
  },
  compactHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  compactIconContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(59, 130, 246, 0.1)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  compactInfo: {
    flex: 1,
  },
  compactTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1F2937',
    marginBottom: 2,
  },
  compactTitleDark: {
    color: '#FFFFFF',
  },
  compactMeta: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  compactRarity: {
    fontSize: 12,
    fontWeight: '500',
    marginLeft: 4,
    textTransform: 'capitalize',
  },
  compactStatus: {
    marginLeft: 8,
  },
  compactProgress: {
    marginTop: 8,
    flexDirection: 'row',
    alignItems: 'center',
  },
  compactProgressBar: {
    flex: 1,
    height: 4,
    backgroundColor: '#E5E7EB',
    borderRadius: 2,
    marginRight: 8,
  },
  compactProgressBarDark: {
    backgroundColor: '#374151',
  },
  compactProgressFill: {
    height: '100%',
    borderRadius: 2,
  },
  compactProgressText: {
    fontSize: 12,
    fontWeight: '500',
    color: '#6B7280',
    minWidth: 35,
    textAlign: 'right',
  },
  compactProgressTextDark: {
    color: '#9CA3AF',
  },

  // Full Card Styles
  fullCard: {
    marginVertical: 8,
    borderRadius: 16,
    overflow: 'hidden',
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
  },
  fullCardDark: {
    elevation: 8,
    shadowOpacity: 0.3,
  },
  fullGradient: {
    padding: 16,
  },
  fullHeader: {
    flexDirection: 'row',
    marginBottom: 16,
  },
  fullIconContainer: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: 'rgba(59, 130, 246, 0.1)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  fullInfo: {
    flex: 1,
  },
  fullTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#1F2937',
    marginBottom: 4,
  },
  fullTitleDark: {
    color: '#FFFFFF',
  },
  fullDescription: {
    fontSize: 14,
    color: '#6B7280',
    lineHeight: 20,
    marginBottom: 8,
  },
  fullDescriptionDark: {
    color: '#9CA3AF',
  },
  fullMeta: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  fullMetaItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(59, 130, 246, 0.1)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  fullMetaText: {
    fontSize: 12,
    fontWeight: '500',
    marginLeft: 4,
    textTransform: 'capitalize',
  },
  fullMetaTextDark: {
    color: '#D1D5DB',
  },
  fullProgress: {
    marginBottom: 16,
  },
  fullProgressHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  fullProgressLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#374151',
  },
  fullProgressLabelDark: {
    color: '#D1D5DB',
  },
  fullProgressPercent: {
    fontSize: 14,
    fontWeight: '600',
    color: '#6B7280',
  },
  fullProgressPercentDark: {
    color: '#9CA3AF',
  },
  fullProgressBar: {
    height: 8,
    backgroundColor: '#E5E7EB',
    borderRadius: 4,
  },
  fullProgressBarDark: {
    backgroundColor: '#374151',
  },
  fullProgressFill: {
    height: '100%',
    borderRadius: 4,
  },
  fullRewards: {
    marginBottom: 16,
  },
  fullRewardsLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 8,
  },
  fullRewardsLabelDark: {
    color: '#D1D5DB',
  },
  fullRewardsList: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  fullRewardItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(16, 185, 129, 0.1)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  fullRewardText: {
    fontSize: 12,
    fontWeight: '500',
    color: '#374151',
    marginLeft: 4,
  },
  fullRewardTextDark: {
    color: '#D1D5DB',
  },
  fullActions: {
    alignItems: 'center',
  },
  claimButton: {
    borderRadius: 12,
    overflow: 'hidden',
  },
  claimButtonGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingVertical: 12,
  },
  claimButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
    marginLeft: 8,
  },
  hintButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#D1D5DB',
  },
  hintButtonText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#6B7280',
    marginLeft: 4,
  },
  hintButtonTextDark: {
    color: '#9CA3AF',
  },
  claimedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: 'rgba(16, 185, 129, 0.1)',
  },
  claimedText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#10B981',
    marginLeft: 4,
  },

  // Modal Styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalBlur: {
    width: '90%',
    maxHeight: '80%',
    borderRadius: 20,
    overflow: 'hidden',
  },
  modalContainer: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    overflow: 'hidden',
  },
  modalContainerDark: {
    backgroundColor: '#1F2937',
  },
  modalContent: {
    maxHeight: 400,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#1F2937',
    flex: 1,
  },
  modalTitleDark: {
    color: '#FFFFFF',
  },
  modalCloseButton: {
    padding: 4,
  },
  modalDescription: {
    padding: 20,
  },
  modalDescriptionText: {
    fontSize: 16,
    color: '#6B7280',
    lineHeight: 24,
  },
  modalDescriptionTextDark: {
    color: '#9CA3AF',
  },
  modalTips: {
    padding: 20,
    paddingTop: 0,
  },
  modalTipsTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 12,
  },
  modalTipsTitleDark: {
    color: '#D1D5DB',
  },
  modalTipItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 8,
  },
  modalTipText: {
    fontSize: 14,
    color: '#6B7280',
    lineHeight: 20,
    marginLeft: 8,
    flex: 1,
  },
  modalTipTextDark: {
    color: '#9CA3AF',
  },
  modalRewards: {
    padding: 20,
    paddingTop: 0,
  },
  modalRewardsTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 12,
  },
  modalRewardsTitleDark: {
    color: '#D1D5DB',
  },
  modalRewardsList: {
    gap: 8,
  },
  modalRewardItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
  },
  modalRewardText: {
    fontSize: 14,
    color: '#374151',
    marginLeft: 8,
  },
  modalRewardTextDark: {
    color: '#D1D5DB',
  },
});
