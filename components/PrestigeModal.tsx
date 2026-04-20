import React, { useState, useRef, useEffect, useMemo } from 'react';
import {
  Modal,
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Animated,
  ScrollView,
  Image,
  Dimensions,
  Alert,
} from 'react-native';
import { Crown, X, Sparkles, RotateCcw, Users, TrendingUp, Award, Calendar, DollarSign, Check, BookOpen } from 'lucide-react-native';
import LifeStoryModal from './LifeStoryModal';
import { useGame } from '@/contexts/game';
import { calculatePrestigePoints } from '@/lib/prestige/prestigePoints';
import { getPrestigeThreshold } from '@/lib/prestige/prestigeTypes';
import { netWorth } from '@/lib/progress/achievements';
import { getCharacterImage } from '@/utils/characterImages';
import { responsiveBorderRadius, responsiveSpacing, responsiveFontSize } from '@/utils/scaling';

const { width: screenWidth } = Dimensions.get('window');

interface PrestigeModalProps {
  visible: boolean;
  onClose: () => void;
}

function PrestigeModal({ visible, onClose }: PrestigeModalProps) {
  const { gameState, executePrestige } = useGame();
  const [selectedPath, setSelectedPath] = useState<'reset' | 'child'>('reset');
  const [selectedChildId, setSelectedChildId] = useState<string | undefined>();
  const [showConfirmation, setShowConfirmation] = useState(false);
  const [showLifeStory, setShowLifeStory] = useState(false);

  const fadeAnim = useRef(new Animated.Value(0)).current;
  const scaleAnim = useRef(new Animated.Value(0.9)).current;
  const glowAnim = useRef(new Animated.Value(0)).current;
  const shimmerAnim = useRef(new Animated.Value(0)).current;

  const prestigeData = gameState?.prestige;
  const children = gameState?.family?.children || [];

  // Only calculate net worth when modal is visible to prevent unnecessary calculations
  const currentNetWorth = useMemo(() => {
    if (!gameState || !visible) return 0;
    return netWorth(gameState);
  }, [gameState, visible, gameState?.stats?.money, gameState?.bankSavings, gameState?.realEstate, gameState?.stocks]);

  const pointsBreakdown = useMemo(() => {
    if (!gameState || !visible) return null;
    return calculatePrestigePoints(
      gameState,
      currentNetWorth,
      prestigeData || { prestigeLevel: 0, prestigePoints: 0, totalPrestiges: 0, lifetimeStats: {
        totalMoneyEarned: 0,
        totalWeeksLived: 0,
        maxNetWorth: 0,
        achievementsUnlocked: 0,
        generationsCompleted: 0,
        totalChildren: 0,
        careersMaxed: 0,
        propertiesOwned: 0,
        companiesBuilt: 0,
      }, unlockedBonuses: [], prestigeHistory: [] },
      selectedPath
    );
  }, [visible, gameState, currentNetWorth, prestigeData?.prestigeLevel, prestigeData?.prestigePoints, prestigeData?.totalPrestiges, selectedPath]);

  useEffect(() => {
    if (visible) {
      Animated.parallel([
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: 400,
          useNativeDriver: true,
        }),
        Animated.spring(scaleAnim, {
          toValue: 1,
          tension: 80,
          friction: 10,
          useNativeDriver: true,
        }),
      ]).start();

      // Gentle glow animation (opacity — safe for native driver)
      const glow = Animated.loop(
        Animated.sequence([
          Animated.timing(glowAnim, {
            toValue: 1,
            duration: 3000,
            useNativeDriver: true,
          }),
          Animated.timing(glowAnim, {
            toValue: 0,
            duration: 3000,
            useNativeDriver: true,
          }),
        ])
      );
      glow.start();

      // Shimmer effect for prestige points
      const shimmer = Animated.loop(
        Animated.sequence([
          Animated.timing(shimmerAnim, {
            toValue: 1,
            duration: 2000,
            useNativeDriver: true,
          }),
          Animated.timing(shimmerAnim, {
            toValue: 0,
            duration: 2000,
            useNativeDriver: true,
          }),
        ])
      );
      shimmer.start();

      return () => {
        glow.stop();
        shimmer.stop();
      };
    } else {
      fadeAnim.setValue(0);
      scaleAnim.setValue(0.9);
      glowAnim.setValue(0);
      shimmerAnim.setValue(0);
    }
  }, [visible, fadeAnim, scaleAnim, glowAnim, shimmerAnim]);

  const handleConfirm = () => {
    if (selectedPath === 'child' && !selectedChildId && children.length > 0) {
      return;
    }

    const prestigeLevel = prestigeData?.prestigeLevel || 0;
    const threshold = getPrestigeThreshold(prestigeLevel);
    
    if (currentNetWorth < threshold) {
      Alert.alert(
        'Cannot Prestige',
        `You need at least $${(threshold / 1_000_000).toFixed(0)}M net worth to prestige.\n\nCurrent: $${(currentNetWorth / 1_000_000).toFixed(2)}M\nRequired: $${(threshold / 1_000_000).toFixed(0)}M`
      );
      return;
    }

    executePrestige(selectedPath, selectedChildId);
    setShowConfirmation(false);
    onClose();
  };

  const formatMoney = (amount: number) => {
    if (amount >= 1_000_000_000) return `$${(amount / 1_000_000_000).toFixed(2)}B`;
    if (amount >= 1_000_000) return `$${(amount / 1_000_000).toFixed(2)}M`;
    if (amount > 10_000) return `$${(amount / 1_000).toFixed(2)}K`;
    return `$${Math.floor(amount).toLocaleString()}`;
  };

  const glowOpacity = glowAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0.2, 0.4],
  });

  const shimmerTranslateX = shimmerAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [-100, 100],
  });

  if (!visible) return null;

  return (
    <Modal visible={visible} transparent animationType="none" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <Animated.View
          style={[
            styles.container,
            {
              opacity: fadeAnim,
              transform: [{ scale: scaleAnim }],
            },
          ]}
        >
          {/* Main Content */}
          <View style={styles.content}>
            {/* Elegant Header */}
            <View style={styles.header}>
              <View style={styles.headerContent}>
                <Animated.View
                  style={[
                    styles.iconContainer,
                    {
                      opacity: glowOpacity,
                    },
                  ]}
                >
                  <Crown size={28} color="#FBBF24" />
                </Animated.View>
                <View style={styles.headerText}>
                  <Text style={styles.title}>Prestige Available</Text>
                  <Text style={styles.subtitle}>{formatMoney(currentNetWorth)} Net Worth</Text>
                </View>
              </View>
              <TouchableOpacity onPress={onClose} style={styles.closeButton} activeOpacity={0.7}>
                <X size={20} color="#9CA3AF" />
              </TouchableOpacity>
            </View>

            <ScrollView 
              style={styles.scrollView} 
              showsVerticalScrollIndicator={false}
              contentContainerStyle={styles.scrollContent}
            >
            {!showConfirmation ? (
              <>
                {/* Prestige Points Card - Beautiful and Prominent */}
                <View style={styles.pointsCard}>
                  <View style={styles.pointsCardInner}>
                    <View style={styles.pointsHeader}>
                      <Sparkles size={20} color="#FBBF24" />
                      <Text style={styles.pointsTitle}>Prestige Points</Text>
                    </View>
                    <View style={styles.pointsValueContainer}>
                      <Animated.View
                        style={[
                          styles.shimmerOverlay,
                          {
                            transform: [{ translateX: shimmerTranslateX }],
                            opacity: shimmerAnim.interpolate({
                              inputRange: [0, 0.5, 1],
                              outputRange: [0, 0.3, 0],
                            }),
                          },
                        ]}
                      />
                      <Text style={styles.pointsValue}>{pointsBreakdown.total.toLocaleString()}</Text>
                    </View>
                    
                    <View style={styles.breakdown}>
                      <View style={styles.breakdownRow}>
                        <Text style={styles.breakdownLabel}>Base (Net Worth)</Text>
                        <Text style={styles.breakdownValue}>+{pointsBreakdown.basePoints.toLocaleString()}</Text>
                      </View>
                      {pointsBreakdown.achievementBonus > 0 && (
                        <View style={styles.breakdownRow}>
                          <Text style={styles.breakdownLabel}>Achievements</Text>
                          <Text style={styles.breakdownValue}>+{pointsBreakdown.achievementBonus.toLocaleString()}</Text>
                        </View>
                      )}
                      {pointsBreakdown.generationBonus > 0 && (
                        <View style={styles.breakdownRow}>
                          <Text style={styles.breakdownLabel}>Generations</Text>
                          <Text style={styles.breakdownValue}>+{pointsBreakdown.generationBonus.toLocaleString()}</Text>
                        </View>
                      )}
                      {pointsBreakdown.ageBonus > 0 && (
                        <View style={styles.breakdownRow}>
                          <Text style={styles.breakdownLabel}>Age Bonus</Text>
                          <Text style={styles.breakdownValue}>+{pointsBreakdown.ageBonus.toLocaleString()}</Text>
                        </View>
                      )}
                      {pointsBreakdown.careerBonus > 0 && (
                        <View style={styles.breakdownRow}>
                          <Text style={styles.breakdownLabel}>Maxed Careers</Text>
                          <Text style={styles.breakdownValue}>+{pointsBreakdown.careerBonus.toLocaleString()}</Text>
                        </View>
                      )}
                      {pointsBreakdown.propertyBonus > 0 && (
                        <View style={styles.breakdownRow}>
                          <Text style={styles.breakdownLabel}>Properties</Text>
                          <Text style={styles.breakdownValue}>+{pointsBreakdown.propertyBonus.toLocaleString()}</Text>
                        </View>
                      )}
                      {pointsBreakdown.companyBonus > 0 && (
                        <View style={styles.breakdownRow}>
                          <Text style={styles.breakdownLabel}>Companies</Text>
                          <Text style={styles.breakdownValue}>+{pointsBreakdown.companyBonus.toLocaleString()}</Text>
                        </View>
                      )}
                      {pointsBreakdown.childBonus > 0 && (
                        <View style={styles.breakdownRow}>
                          <Text style={styles.breakdownLabel}>Children</Text>
                          <Text style={styles.breakdownValue}>+{pointsBreakdown.childBonus.toLocaleString()}</Text>
                        </View>
                      )}
                      {pointsBreakdown.multiplier > 1 && (
                        <View style={styles.breakdownRow}>
                          <Text style={styles.breakdownLabel}>Prestige Multiplier</Text>
                          <Text style={styles.breakdownValue}>×{pointsBreakdown.multiplier.toFixed(2)}</Text>
                        </View>
                      )}
                      {selectedPath === 'child' && (
                        <View style={styles.breakdownRow}>
                          <Text style={styles.breakdownLabel}>Child Path Bonus</Text>
                          <Text style={styles.breakdownValue}>+{pointsBreakdown.childPathBonus}%</Text>
                        </View>
                      )}
                    </View>
                  </View>
                </View>

                {/* Lifetime Stats - Clean Grid */}
                <View style={styles.statsCard}>
                  <Text style={styles.sectionTitle}>Lifetime Achievements</Text>
                  <View style={styles.statsGrid}>
                    <View style={styles.statItem}>
                      <View style={[styles.statIconContainer, { backgroundColor: 'rgba(16, 185, 129, 0.15)' }]}>
                        <DollarSign size={18} color="#10B981" />
                      </View>
                      <Text style={styles.statValue}>
                        {formatMoney(prestigeData?.lifetimeStats?.totalMoneyEarned || 0)}
                      </Text>
                      <Text style={styles.statLabel}>Total Earned</Text>
                    </View>
                    <View style={styles.statItem}>
                      <View style={[styles.statIconContainer, { backgroundColor: 'rgba(59, 130, 246, 0.15)' }]}>
                        <Calendar size={18} color="#3B82F6" />
                      </View>
                      <Text style={styles.statValue}>
                        {prestigeData?.lifetimeStats?.totalWeeksLived || 0}
                      </Text>
                      <Text style={styles.statLabel}>Weeks Lived</Text>
                    </View>
                    <View style={styles.statItem}>
                      <View style={[styles.statIconContainer, { backgroundColor: 'rgba(245, 158, 11, 0.15)' }]}>
                        <Award size={18} color="#F59E0B" />
                      </View>
                      <Text style={styles.statValue}>
                        {prestigeData?.lifetimeStats?.achievementsUnlocked || 0}
                      </Text>
                      <Text style={styles.statLabel}>Achievements</Text>
                    </View>
                    <View style={styles.statItem}>
                      <View style={[styles.statIconContainer, { backgroundColor: 'rgba(139, 92, 246, 0.15)' }]}>
                        <Users size={18} color="#8B5CF6" />
                      </View>
                      <Text style={styles.statValue}>
                        {prestigeData?.lifetimeStats?.totalChildren || 0}
                      </Text>
                      <Text style={styles.statLabel}>Children</Text>
                    </View>
                  </View>
                </View>

                {/* Path Selection - Elegant Cards */}
                <Text style={[styles.sectionTitle, styles.pathSectionTitle]}>Choose Your Path</Text>

                {/* Reset Path */}
                <TouchableOpacity
                  style={[
                    styles.pathCard,
                    selectedPath === 'reset' && styles.pathCardSelected,
                  ]}
                  onPress={() => setSelectedPath('reset')}
                  activeOpacity={0.8}
                >
                  <View style={[
                    styles.pathCardInner,
                    selectedPath === 'reset' && styles.pathCardInnerSelected,
                  ]}>
                    <View style={styles.pathHeader}>
                      <View style={[
                        styles.pathIconContainer,
                        selectedPath === 'reset' && styles.pathIconContainerSelected,
                      ]}>
                        <RotateCcw size={22} color={selectedPath === 'reset' ? '#3B82F6' : '#6B7280'} />
                      </View>
                      <View style={styles.pathTextContainer}>
                        <Text style={[
                          styles.pathTitle,
                          selectedPath === 'reset' && styles.pathTitleSelected,
                        ]}>
                          Reset to Age 18
                        </Text>
                        <Text style={[
                          styles.pathDescription,
                          selectedPath === 'reset' && styles.pathDescriptionSelected,
                        ]}>
                          Start fresh with a new character at age 18. All starting bonuses apply.
                        </Text>
                      </View>
                      {selectedPath === 'reset' && (
                        <View style={styles.checkmarkContainer}>
                          <Check size={20} color="#3B82F6" />
                        </View>
                      )}
                    </View>
                    <View style={styles.pathBenefits}>
                      <View style={styles.benefitItem}>
                        <Check size={14} color={selectedPath === 'reset' ? '#60A5FA' : '#6B7280'} />
                        <Text style={[
                          styles.benefitText,
                          selectedPath === 'reset' && styles.benefitTextSelected,
                        ]}>
                          Full reset
                        </Text>
                      </View>
                      <View style={styles.benefitItem}>
                        <Check size={14} color={selectedPath === 'reset' ? '#60A5FA' : '#6B7280'} />
                        <Text style={[
                          styles.benefitText,
                          selectedPath === 'reset' && styles.benefitTextSelected,
                        ]}>
                          All starting bonuses
                        </Text>
                      </View>
                      <View style={styles.benefitItem}>
                        <Check size={14} color={selectedPath === 'reset' ? '#60A5FA' : '#6B7280'} />
                        <Text style={[
                          styles.benefitText,
                          selectedPath === 'reset' && styles.benefitTextSelected,
                        ]}>
                          Clean slate
                        </Text>
                      </View>
                    </View>
                    {selectedPath === 'reset' && (
                      <Image
                        source={getCharacterImage(18, gameState.userProfile?.sex || 'male')}
                        style={styles.characterImage}
                      />
                    )}
                  </View>
                </TouchableOpacity>

                {/* Child Path */}
                <TouchableOpacity
                  style={[
                    styles.pathCard,
                    selectedPath === 'child' && styles.pathCardSelected,
                    children.length === 0 && styles.pathCardDisabled,
                  ]}
                  onPress={() => children.length > 0 && setSelectedPath('child')}
                  activeOpacity={children.length > 0 ? 0.8 : 1}
                  disabled={children.length === 0}
                >
                  <View style={[
                    styles.pathCardInner,
                    selectedPath === 'child' && styles.pathCardInnerSelected,
                    children.length === 0 && styles.pathCardInnerDisabled,
                  ]}>
                    <View style={styles.pathHeader}>
                      <View style={[
                        styles.pathIconContainer,
                        selectedPath === 'child' && styles.pathIconContainerSelected,
                        children.length === 0 && styles.pathIconContainerDisabled,
                      ]}>
                        <Users size={22} color={selectedPath === 'child' ? '#8B5CF6' : children.length === 0 ? '#4B5563' : '#6B7280'} />
                      </View>
                      <View style={styles.pathTextContainer}>
                        <Text style={[
                          styles.pathTitle,
                          selectedPath === 'child' && styles.pathTitleSelected,
                          children.length === 0 && styles.pathTitleDisabled,
                        ]}>
                          Continue as Child
                        </Text>
                        <Text style={[
                          styles.pathDescription,
                          selectedPath === 'child' && styles.pathDescriptionSelected,
                          children.length === 0 && styles.pathDescriptionDisabled,
                        ]}>
                          {children.length === 0
                            ? 'Have children to unlock this path'
                            : 'Continue your legacy as one of your children. Inherit some stats and family connections.'}
                        </Text>
                      </View>
                      {selectedPath === 'child' && children.length > 0 && (
                        <View style={styles.checkmarkContainer}>
                          <Check size={20} color="#8B5CF6" />
                        </View>
                      )}
                    </View>
                    {children.length > 0 && (
                      <>
                        <View style={styles.pathBenefits}>
                          <View style={styles.benefitItem}>
                            <Check size={14} color={selectedPath === 'child' ? '#A78BFA' : '#6B7280'} />
                            <Text style={[
                              styles.benefitText,
                              selectedPath === 'child' && styles.benefitTextSelected,
                            ]}>
                              Inherit stats
                            </Text>
                          </View>
                          <View style={styles.benefitItem}>
                            <Check size={14} color={selectedPath === 'child' ? '#A78BFA' : '#6B7280'} />
                            <Text style={[
                              styles.benefitText,
                              selectedPath === 'child' && styles.benefitTextSelected,
                            ]}>
                              Family connections
                            </Text>
                          </View>
                          <View style={styles.benefitItem}>
                            <Check size={14} color={selectedPath === 'child' ? '#A78BFA' : '#6B7280'} />
                            <Text style={[
                              styles.benefitText,
                              selectedPath === 'child' && styles.benefitTextSelected,
                            ]}>
                              +25% prestige points
                            </Text>
                          </View>
                        </View>
                        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.childrenScroll}>
                          {children.map(child => {
                            const isSelected = selectedChildId === child.id;
                            const childAge = Math.max(18, Math.floor(child.age || 18));
                            return (
                              <TouchableOpacity
                                key={child.id}
                                style={[
                                  styles.childCard,
                                  isSelected && styles.childCardSelected,
                                ]}
                                onPress={() => {
                                  setSelectedPath('child');
                                  setSelectedChildId(child.id);
                                }}
                                activeOpacity={0.8}
                              >
                                <Image
                                  source={getCharacterImage(childAge, child.gender || 'male')}
                                  style={styles.childImage}
                                />
                                <Text style={[
                                  styles.childName,
                                  isSelected && styles.childNameSelected,
                                ]}>
                                  {child.name}
                                </Text>
                                <Text style={styles.childAge}>
                                  Age {childAge}
                                </Text>
                              </TouchableOpacity>
                            );
                          })}
                        </ScrollView>
                      </>
                    )}
                  </View>
                </TouchableOpacity>

                {/* Active Bonuses */}
                {prestigeData && prestigeData.unlockedBonuses.length > 0 && (
                  <View style={styles.bonusesCard}>
                    <Text style={styles.sectionTitle}>Active Bonuses</Text>
                    <View style={styles.bonusesList}>
                      {prestigeData.unlockedBonuses.slice(0, 5).map((bonusId, index) => (
                        <View key={`${bonusId}-${index}`} style={styles.bonusBadge}>
                          <Text style={styles.bonusBadgeText}>{bonusId.replace(/_/g, ' ')}</Text>
                        </View>
                      ))}
                      {prestigeData.unlockedBonuses.length > 5 && (
                        <Text style={styles.moreBonuses}>
                          +{prestigeData.unlockedBonuses.length - 5} more
                        </Text>
                      )}
                    </View>
                  </View>
                )}
              </>
            ) : (
              // Confirmation View
              <View style={styles.confirmationView}>
                <Text style={styles.confirmationTitle}>Prestige</Text>
                <Text style={styles.confirmationText}>
                  You will reset your character and lose:
                </Text>
                <View style={styles.warningList}>
                  <View style={styles.listItem}>
                    <Text style={styles.listBullet}>•</Text>
                    <Text style={styles.warningItem}>
                      All money, items, properties, and companies
                    </Text>
                  </View>
                  <View style={styles.listItem}>
                    <Text style={styles.listBullet}>•</Text>
                    <Text style={styles.warningItem}>Current career progress</Text>
                  </View>
                  <View style={styles.listItem}>
                    <Text style={styles.listBullet}>•</Text>
                    <Text style={styles.warningItem}>Current relationships (except family tree)</Text>
                  </View>
                </View>
                <Text style={[styles.confirmationText, styles.confirmationTextSpacing]}>
                  You will keep:
                </Text>
                <View style={styles.keepList}>
                  <View style={styles.listItem}>
                    <Text style={styles.listBullet}>•</Text>
                    <Text style={styles.keepItem}>Prestige points and bonuses</Text>
                  </View>
                  <View style={styles.listItem}>
                    <Text style={styles.listBullet}>•</Text>
                    <Text style={styles.keepItem}>Achievements and gems</Text>
                  </View>
                  <View style={styles.listItem}>
                    <Text style={styles.listBullet}>•</Text>
                    <Text style={styles.keepItem}>Family tree and lineage</Text>
                  </View>
                </View>
                <TouchableOpacity
                  style={styles.lifeStoryButton}
                  onPress={() => setShowLifeStory(true)}
                  activeOpacity={0.7}
                >
                  <BookOpen size={18} color="#8B5CF6" />
                  <Text style={styles.lifeStoryButtonText}>View Your Life Story</Text>
                </TouchableOpacity>

                <View style={styles.pointsEarnedContainer}>
                  <Text style={styles.pointsEarned}>
                    You will earn {pointsBreakdown.total.toLocaleString()} prestige points!
                  </Text>
                </View>
              </View>
            )}
            </ScrollView>

            {/* Action Buttons */}
            <View style={styles.actions}>
              <TouchableOpacity
                style={styles.cancelButton}
                onPress={showConfirmation ? () => setShowConfirmation(false) : onClose}
                activeOpacity={0.7}
              >
                <Text style={styles.cancelButtonText}>
                  {showConfirmation ? 'Back' : 'Cancel'}
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  styles.prestigeButton,
                  (selectedPath === 'child' && children.length > 0 && !selectedChildId) && styles.buttonDisabled,
                ]}
                onPress={() => {
                  if (selectedPath === 'child' && children.length > 0 && !selectedChildId) {
                    return;
                  }
                  if (showConfirmation) {
                    handleConfirm();
                  } else {
                    setShowConfirmation(true);
                  }
                }}
                activeOpacity={0.8}
                disabled={selectedPath === 'child' && children.length > 0 && !selectedChildId}
              >
                <Crown size={18} color="#FFFFFF" />
                <Text style={styles.prestigeButtonText}>
                  Prestige
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </Animated.View>
      </View>
      <LifeStoryModal visible={showLifeStory} onClose={() => setShowLifeStory(false)} />
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.85)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  container: {
    width: '100%',
    maxWidth: 500,
    height: '85%',
    maxHeight: 700,
  },
  content: {
    backgroundColor: '#111827',
    borderRadius: 24,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 20 },
    shadowOpacity: 0.5,
    shadowRadius: 30,
    elevation: 20,
    height: '100%',
    flexDirection: 'column',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 24,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.1)',
  },
  headerContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    flex: 1,
  },
  iconContainer: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: 'rgba(251, 191, 36, 0.15)',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(251, 191, 36, 0.3)',
  },
  headerText: {
    flex: 1,
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
    color: '#FFFFFF',
    letterSpacing: -0.5,
  },
  subtitle: {
    fontSize: 14,
    color: '#9CA3AF',
    marginTop: 4,
    fontWeight: '500',
  },
  closeButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 20,
  },
  pointsCard: {
    margin: 20,
    marginBottom: 24,
    borderRadius: 20,
    overflow: 'hidden',
    backgroundColor: 'rgba(251, 191, 36, 0.1)',
    borderWidth: 1,
    borderColor: 'rgba(251, 191, 36, 0.2)',
  },
  pointsCardInner: {
    padding: 24,
    position: 'relative',
    overflow: 'hidden',
  },
  shimmerOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    width: 50,
  },
  pointsHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 16,
  },
  pointsTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FBBF24',
    letterSpacing: 0.5,
  },
  pointsValueContainer: {
    position: 'relative',
    marginBottom: 20,
  },
  pointsValue: {
    fontSize: 42,
    fontWeight: '800',
    color: '#FFFFFF',
    letterSpacing: -1,
  },
  breakdown: {
    gap: 12,
    paddingTop: 20,
    borderTopWidth: 1,
    borderTopColor: 'rgba(251, 191, 36, 0.2)',
  },
  breakdownRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  breakdownLabel: {
    fontSize: 13,
    color: '#D1D5DB',
    fontWeight: '500',
  },
  breakdownValue: {
    fontSize: 13,
    fontWeight: '700',
    color: '#FBBF24',
  },
  statsCard: {
    marginHorizontal: 20,
    marginBottom: 24,
    padding: 20,
    borderRadius: 16,
    backgroundColor: 'rgba(255, 255, 255, 0.03)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.05)',
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#FFFFFF',
    marginBottom: 16,
    letterSpacing: -0.3,
  },
  pathSectionTitle: {
    marginTop: 8,
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  statItem: {
    flex: 1,
    minWidth: '45%',
    alignItems: 'center',
    padding: 16,
    borderRadius: 12,
    backgroundColor: 'rgba(255, 255, 255, 0.03)',
  },
  statIconContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
  },
  statValue: {
    fontSize: 16,
    fontWeight: '700',
    color: '#FFFFFF',
    marginTop: 4,
  },
  statLabel: {
    fontSize: 11,
    color: '#9CA3AF',
    marginTop: 4,
    fontWeight: '500',
  },
  pathCard: {
    marginHorizontal: 20,
    marginBottom: 16,
    borderRadius: 16,
    overflow: 'hidden',
    borderWidth: 2,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  pathCardSelected: {
    borderColor: 'rgba(59, 130, 246, 0.5)',
  },
  pathCardDisabled: {
    opacity: 0.5,
  },
  pathCardInner: {
    padding: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.03)',
  },
  pathCardInnerSelected: {
    backgroundColor: 'rgba(59, 130, 246, 0.1)',
  },
  pathCardInnerDisabled: {
    backgroundColor: 'rgba(75, 85, 99, 0.1)',
  },
  pathHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 16,
    marginBottom: 16,
  },
  pathIconContainer: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(107, 114, 128, 0.2)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  pathIconContainerSelected: {
    backgroundColor: 'rgba(59, 130, 246, 0.2)',
  },
  pathIconContainerDisabled: {
    backgroundColor: 'rgba(75, 85, 99, 0.2)',
  },
  pathTextContainer: {
    flex: 1,
  },
  pathTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#FFFFFF',
    marginBottom: 6,
    letterSpacing: -0.3,
  },
  pathTitleSelected: {
    color: '#60A5FA',
  },
  pathTitleDisabled: {
    color: '#6B7280',
  },
  pathDescription: {
    fontSize: 13,
    color: '#9CA3AF',
    lineHeight: 20,
  },
  pathDescriptionSelected: {
    color: '#93C5FD',
  },
  pathDescriptionDisabled: {
    color: '#6B7280',
  },
  checkmarkContainer: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(59, 130, 246, 0.2)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  pathBenefits: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginTop: 4,
  },
  benefitItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  benefitText: {
    fontSize: 12,
    color: '#9CA3AF',
    fontWeight: '500',
  },
  benefitTextSelected: {
    color: '#93C5FD',
  },
  characterImage: {
    width: 80,
    height: 80,
    borderRadius: 40,
    marginTop: 16,
    alignSelf: 'center',
    borderWidth: 2,
    borderColor: 'rgba(59, 130, 246, 0.3)',
  },
  childrenScroll: {
    marginTop: 16,
  },
  childCard: {
    width: 100,
    marginRight: 12,
    padding: 12,
    borderRadius: 12,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: 'transparent',
  },
  childCardSelected: {
    borderColor: '#8B5CF6',
    backgroundColor: 'rgba(139, 92, 246, 0.15)',
  },
  childImage: {
    width: 60,
    height: 60,
    borderRadius: 30,
    marginBottom: 8,
    borderWidth: 2,
    borderColor: 'rgba(139, 92, 246, 0.3)',
  },
  childName: {
    fontSize: 12,
    fontWeight: '600',
    color: '#FFFFFF',
    textAlign: 'center',
  },
  childNameSelected: {
    color: '#A78BFA',
  },
  childAge: {
    fontSize: 10,
    color: '#9CA3AF',
    marginTop: 4,
  },
  bonusesCard: {
    marginHorizontal: 20,
    marginBottom: 24,
    padding: 20,
    borderRadius: 16,
    backgroundColor: 'rgba(255, 255, 255, 0.03)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.05)',
  },
  bonusesList: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  bonusBadge: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: 'rgba(59, 130, 246, 0.2)',
    borderWidth: 1,
    borderColor: 'rgba(59, 130, 246, 0.3)',
  },
  bonusBadgeText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#60A5FA',
    textTransform: 'capitalize',
  },
  moreBonuses: {
    fontSize: 12,
    color: '#9CA3AF',
    alignSelf: 'center',
    fontWeight: '500',
  },
  confirmationView: {
    padding: 24,
  },
  confirmationTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: '#FFFFFF',
    marginBottom: 20,
    textAlign: 'center',
    letterSpacing: -0.5,
  },
  confirmationText: {
    fontSize: 15,
    color: '#D1D5DB',
    marginBottom: 16,
    fontWeight: '500',
    lineHeight: 22,
  },
  confirmationTextSpacing: {
    marginTop: 8,
  },
  warningList: {
    marginBottom: 20,
  },
  keepList: {
    marginBottom: 20,
  },
  listItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 10,
    gap: 8,
  },
  listBullet: {
    fontSize: 16,
    color: '#9CA3AF',
    marginTop: 2,
  },
  warningItem: {
    fontSize: 14,
    color: '#F87171',
    flex: 1,
    lineHeight: 20,
  },
  keepItem: {
    fontSize: 14,
    color: '#34D399',
    flex: 1,
    lineHeight: 20,
  },
  lifeStoryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginTop: 16,
    padding: 14,
    borderRadius: 12,
    backgroundColor: 'rgba(139, 92, 246, 0.1)',
    borderWidth: 1,
    borderColor: 'rgba(139, 92, 246, 0.3)',
  },
  lifeStoryButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#A78BFA',
  },
  pointsEarnedContainer: {
    marginTop: 24,
    marginBottom: 8,
    padding: 20,
    borderRadius: 16,
    backgroundColor: 'rgba(251, 191, 36, 0.1)',
    borderWidth: 1,
    borderColor: 'rgba(251, 191, 36, 0.2)',
  },
  pointsEarned: {
    fontSize: 20,
    fontWeight: '700',
    color: '#FBBF24',
    textAlign: 'center',
    letterSpacing: -0.3,
  },
  actions: {
    flexDirection: 'row',
    gap: 12,
    padding: 20,
    paddingTop: 0,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.1)',
  },
  cancelButton: {
    flex: 1,
    minHeight: 52,
    borderRadius: 12,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  cancelButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#9CA3AF',
  },
  prestigeButton: {
    flex: 1,
    minHeight: 52,
    borderRadius: 12,
    backgroundColor: '#F59E0B',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingHorizontal: 12,
    shadowColor: '#F59E0B',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  prestigeButtonText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#FFFFFF',
    letterSpacing: 0.2,
    flexShrink: 1,
  },
  buttonDisabled: {
    opacity: 0.5,
    backgroundColor: '#4B5563',
  },
});

export default React.memo(PrestigeModal);
