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
import { LinearGradient } from 'expo-linear-gradient';
import { Crown, X, Sparkles, RotateCcw, Users, TrendingUp, Award, Calendar, DollarSign } from 'lucide-react-native';
import { useGame } from '@/contexts/GameContext';
import { calculatePrestigePoints } from '@/lib/prestige/prestigePoints';
import { getPrestigeThreshold } from '@/lib/prestige/prestigeTypes';
import { netWorth } from '@/lib/progress/achievements';
import { getCharacterImage } from '@/utils/characterImages';

const { width: screenWidth } = Dimensions.get('window');

interface PrestigeModalProps {
  visible: boolean;
  onClose: () => void;
}

export default function PrestigeModal({ visible, onClose }: PrestigeModalProps) {
  const { gameState, executePrestige } = useGame();
  const [selectedPath, setSelectedPath] = useState<'reset' | 'child'>('reset');
  const [selectedChildId, setSelectedChildId] = useState<string | undefined>();
  const [showConfirmation, setShowConfirmation] = useState(false);

  const fadeAnim = useRef(new Animated.Value(0)).current;
  const scaleAnim = useRef(new Animated.Value(0.8)).current;
  const glowAnim = useRef(new Animated.Value(0)).current;

  const currentNetWorth = netWorth(gameState);
  const prestigeData = gameState.prestige;
  const children = gameState.family?.children || [];

  const pointsBreakdown = useMemo(() => {
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
  }, [gameState, currentNetWorth, prestigeData, selectedPath]);

  useEffect(() => {
    if (visible) {
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
      ]).start();

      const glow = Animated.loop(
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
      glow.start();

      return () => {
        glow.stop();
      };
    } else {
      fadeAnim.setValue(0);
      scaleAnim.setValue(0.8);
      glowAnim.setValue(0);
    }
  }, [visible, fadeAnim, scaleAnim, glowAnim]);

  const handleConfirm = () => {
    if (selectedPath === 'child' && !selectedChildId && children.length > 0) {
      return; // Must select a child
    }

    // Validate net worth requirement
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
    if (amount >= 1_000) return `$${(amount / 1_000).toFixed(2)}K`;
    return `$${amount}`;
  };

  const glowOpacity = glowAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0.3, 0.6],
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
          <LinearGradient
            colors={gameState.settings.darkMode ? ['#1F2937', '#111827'] : ['#FFFFFF', '#F3F4F6']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.content}
          >
            {/* Header */}
            <View style={styles.header}>
              <View style={styles.headerLeft}>
                <Animated.View
                  style={[
                    styles.iconContainer,
                    {
                      opacity: glowOpacity,
                    },
                  ]}
                >
                  <Crown size={32} color="#F59E0B" />
                </Animated.View>
                <View>
                  <Text style={[styles.title, gameState.settings.darkMode && styles.titleDark]}>
                    Prestige Available!
                  </Text>
                  <Text style={[styles.subtitle, gameState.settings.darkMode && styles.subtitleDark]}>
                    {formatMoney(currentNetWorth)} Net Worth
                  </Text>
                </View>
              </View>
              <TouchableOpacity onPress={onClose} style={styles.closeButton}>
                <X size={24} color={gameState.settings.darkMode ? '#FFFFFF' : '#1F2937'} />
              </TouchableOpacity>
            </View>

            {!showConfirmation ? (
              <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
                {/* Prestige Points Preview */}
                <View style={styles.pointsCard}>
                  <LinearGradient
                    colors={['#F59E0B', '#D97706']}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                    style={styles.pointsGradient}
                  >
                    <View style={styles.pointsHeader}>
                      <Sparkles size={24} color="#FFFFFF" />
                      <Text style={styles.pointsTitle}>Prestige Points Earned</Text>
                    </View>
                    <Text style={styles.pointsValue}>{pointsBreakdown.total.toLocaleString()}</Text>
                    
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
                  </LinearGradient>
                </View>

                {/* Lifetime Stats */}
                <View style={[styles.statsCard, gameState.settings.darkMode && styles.statsCardDark]}>
                  <Text style={[styles.sectionTitle, gameState.settings.darkMode && styles.sectionTitleDark]}>
                    Lifetime Achievements
                  </Text>
                  <View style={styles.statsGrid}>
                    <View style={styles.statItem}>
                      <DollarSign size={16} color="#10B981" />
                      <Text style={[styles.statValue, gameState.settings.darkMode && styles.statValueDark]}>
                        {formatMoney(prestigeData?.lifetimeStats?.totalMoneyEarned || 0)}
                      </Text>
                      <Text style={[styles.statLabel, gameState.settings.darkMode && styles.statLabelDark]}>
                        Total Earned
                      </Text>
                    </View>
                    <View style={styles.statItem}>
                      <Calendar size={16} color="#3B82F6" />
                      <Text style={[styles.statValue, gameState.settings.darkMode && styles.statValueDark]}>
                        {prestigeData?.lifetimeStats?.totalWeeksLived || 0}
                      </Text>
                      <Text style={[styles.statLabel, gameState.settings.darkMode && styles.statLabelDark]}>
                        Weeks Lived
                      </Text>
                    </View>
                    <View style={styles.statItem}>
                      <Award size={16} color="#F59E0B" />
                      <Text style={[styles.statValue, gameState.settings.darkMode && styles.statValueDark]}>
                        {prestigeData?.lifetimeStats?.achievementsUnlocked || 0}
                      </Text>
                      <Text style={[styles.statLabel, gameState.settings.darkMode && styles.statLabelDark]}>
                        Achievements
                      </Text>
                    </View>
                    <View style={styles.statItem}>
                      <Users size={16} color="#8B5CF6" />
                      <Text style={[styles.statValue, gameState.settings.darkMode && styles.statValueDark]}>
                        {prestigeData?.lifetimeStats?.totalChildren || 0}
                      </Text>
                      <Text style={[styles.statLabel, gameState.settings.darkMode && styles.statLabelDark]}>
                        Children
                      </Text>
                    </View>
                  </View>
                </View>

                {/* Path Selection */}
                <Text style={[styles.sectionTitle, gameState.settings.darkMode && styles.sectionTitleDark, { marginTop: 20 }]}>
                  Choose Your Path
                </Text>

                {/* Reset Path */}
                <TouchableOpacity
                  style={[
                    styles.pathCard,
                    gameState.settings.darkMode && styles.pathCardDark,
                    selectedPath === 'reset' && styles.pathCardSelected,
                  ]}
                  onPress={() => setSelectedPath('reset')}
                  activeOpacity={0.8}
                >
                  <LinearGradient
                    colors={
                      selectedPath === 'reset'
                        ? ['#3B82F6', '#2563EB']
                        : gameState.settings.darkMode
                        ? ['#374151', '#1F2937']
                        : ['#F3F4F6', '#E5E7EB']
                    }
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                    style={styles.pathGradient}
                  >
                    <View style={styles.pathHeader}>
                      <RotateCcw size={24} color={selectedPath === 'reset' ? '#FFFFFF' : '#9CA3AF'} />
                      <View style={styles.pathTextContainer}>
                        <Text
                          style={[
                            styles.pathTitle,
                            gameState.settings.darkMode && styles.pathTitleDark,
                            selectedPath === 'reset' && styles.pathTitleSelected,
                          ]}
                        >
                          Reset to Age 18
                        </Text>
                        <Text
                          style={[
                            styles.pathDescription,
                            gameState.settings.darkMode && styles.pathDescriptionDark,
                            selectedPath === 'reset' && styles.pathDescriptionSelected,
                          ]}
                        >
                          Start fresh with a new character at age 18. All starting bonuses apply.
                        </Text>
                      </View>
                    </View>
                    <View style={styles.pathBenefits}>
                      <Text
                        style={[
                          styles.benefitText,
                          gameState.settings.darkMode && styles.benefitTextDark,
                          selectedPath === 'reset' && styles.benefitTextSelected,
                        ]}
                      >
                        ✓ Full reset
                      </Text>
                      <Text
                        style={[
                          styles.benefitText,
                          gameState.settings.darkMode && styles.benefitTextDark,
                          selectedPath === 'reset' && styles.benefitTextSelected,
                        ]}
                      >
                        ✓ All starting bonuses
                      </Text>
                      <Text
                        style={[
                          styles.benefitText,
                          gameState.settings.darkMode && styles.benefitTextDark,
                          selectedPath === 'reset' && styles.benefitTextSelected,
                        ]}
                      >
                        ✓ Clean slate
                      </Text>
                    </View>
                    {selectedPath === 'reset' && (
                      <Image
                        source={getCharacterImage(18, gameState.userProfile?.sex || 'male')}
                        style={styles.characterImage}
                      />
                    )}
                  </LinearGradient>
                </TouchableOpacity>

                {/* Child Path */}
                <TouchableOpacity
                  style={[
                    styles.pathCard,
                    gameState.settings.darkMode && styles.pathCardDark,
                    selectedPath === 'child' && styles.pathCardSelected,
                    children.length === 0 && styles.pathCardDisabled,
                  ]}
                  onPress={() => children.length > 0 && setSelectedPath('child')}
                  activeOpacity={children.length > 0 ? 0.8 : 1}
                  disabled={children.length === 0}
                >
                  <LinearGradient
                    colors={
                      children.length === 0
                        ? ['#6B7280', '#4B5563']
                        : selectedPath === 'child'
                        ? ['#8B5CF6', '#7C3AED']
                        : gameState.settings.darkMode
                        ? ['#374151', '#1F2937']
                        : ['#F3F4F6', '#E5E7EB']
                    }
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                    style={styles.pathGradient}
                  >
                    <View style={styles.pathHeader}>
                      <Users size={24} color={selectedPath === 'child' ? '#FFFFFF' : '#9CA3AF'} />
                      <View style={styles.pathTextContainer}>
                        <Text
                          style={[
                            styles.pathTitle,
                            gameState.settings.darkMode && styles.pathTitleDark,
                            selectedPath === 'child' && styles.pathTitleSelected,
                          ]}
                        >
                          Continue as Child
                        </Text>
                        <Text
                          style={[
                            styles.pathDescription,
                            gameState.settings.darkMode && styles.pathDescriptionDark,
                            selectedPath === 'child' && styles.pathDescriptionSelected,
                          ]}
                        >
                          {children.length === 0
                            ? 'Have children to unlock this path'
                            : 'Continue your legacy as one of your children. Inherit some stats and family connections.'}
                        </Text>
                      </View>
                    </View>
                    {children.length > 0 && (
                      <>
                        <View style={styles.pathBenefits}>
                          <Text
                            style={[
                              styles.benefitText,
                              gameState.settings.darkMode && styles.benefitTextDark,
                              selectedPath === 'child' && styles.benefitTextSelected,
                            ]}
                          >
                            ✓ Inherit stats
                          </Text>
                          <Text
                            style={[
                              styles.benefitText,
                              gameState.settings.darkMode && styles.benefitTextDark,
                              selectedPath === 'child' && styles.benefitTextSelected,
                            ]}
                          >
                            ✓ Family connections
                          </Text>
                          <Text
                            style={[
                              styles.benefitText,
                              gameState.settings.darkMode && styles.benefitTextDark,
                              selectedPath === 'child' && styles.benefitTextSelected,
                            ]}
                          >
                            ✓ +25% prestige points
                          </Text>
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
                                  gameState.settings.darkMode && styles.childCardDark,
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
                                <Text
                                  style={[
                                    styles.childName,
                                    gameState.settings.darkMode && styles.childNameDark,
                                    isSelected && styles.childNameSelected,
                                  ]}
                                >
                                  {child.name}
                                </Text>
                                <Text
                                  style={[
                                    styles.childAge,
                                    gameState.settings.darkMode && styles.childAgeDark,
                                  ]}
                                >
                                  Age {childAge}
                                </Text>
                              </TouchableOpacity>
                            );
                          })}
                        </ScrollView>
                      </>
                    )}
                  </LinearGradient>
                </TouchableOpacity>

                {/* Current Bonuses */}
                {prestigeData && prestigeData.unlockedBonuses.length > 0 && (
                  <View style={[styles.bonusesCard, gameState.settings.darkMode && styles.bonusesCardDark]}>
                    <Text style={[styles.sectionTitle, gameState.settings.darkMode && styles.sectionTitleDark]}>
                      Active Bonuses
                    </Text>
                    <View style={styles.bonusesList}>
                      {prestigeData.unlockedBonuses.slice(0, 5).map(bonusId => (
                        <View key={bonusId} style={styles.bonusBadge}>
                          <Text style={styles.bonusBadgeText}>{bonusId.replace(/_/g, ' ')}</Text>
                        </View>
                      ))}
                      {prestigeData.unlockedBonuses.length > 5 && (
                        <Text style={[styles.moreBonuses, gameState.settings.darkMode && styles.moreBonusesDark]}>
                          +{prestigeData.unlockedBonuses.length - 5} more
                        </Text>
                      )}
                    </View>
                  </View>
                )}

                {/* Action Buttons */}
                <View style={styles.actions}>
                  <TouchableOpacity
                    style={[styles.button, styles.cancelButton]}
                    onPress={onClose}
                    activeOpacity={0.8}
                  >
                    <Text style={styles.cancelButtonText}>Cancel</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[
                      styles.button,
                      styles.prestigeButton,
                      (selectedPath === 'child' && children.length > 0 && !selectedChildId) && styles.buttonDisabled,
                    ]}
                    onPress={() => {
                      if (selectedPath === 'child' && children.length > 0 && !selectedChildId) {
                        return;
                      }
                      setShowConfirmation(true);
                    }}
                    activeOpacity={0.8}
                    disabled={selectedPath === 'child' && children.length > 0 && !selectedChildId}
                  >
                    <LinearGradient
                      colors={
                        selectedPath === 'child' && children.length > 0 && !selectedChildId
                          ? ['#6B7280', '#4B5563']
                          : ['#F59E0B', '#D97706']
                      }
                      start={{ x: 0, y: 0 }}
                      end={{ x: 1, y: 1 }}
                      style={styles.prestigeButtonGradient}
                    >
                      <Crown size={20} color="#FFFFFF" />
                      <Text style={styles.prestigeButtonText}>Prestige Now</Text>
                    </LinearGradient>
                  </TouchableOpacity>
                </View>
              </ScrollView>
            ) : (
              // Confirmation View
              <View style={styles.confirmationView}>
                <Text style={[styles.confirmationTitle, gameState.settings.darkMode && styles.confirmationTitleDark]}>
                  Confirm Prestige
                </Text>
                <Text style={[styles.confirmationText, gameState.settings.darkMode && styles.confirmationTextDark]}>
                  You will reset your character and lose:
                </Text>
                <View style={styles.warningList}>
                  <Text style={[styles.warningItem, gameState.settings.darkMode && styles.warningItemDark]}>
                    • All money, items, properties, and companies
                  </Text>
                  <Text style={[styles.warningItem, gameState.settings.darkMode && styles.warningItemDark]}>
                    • Current career progress
                  </Text>
                  <Text style={[styles.warningItem, gameState.settings.darkMode && styles.warningItemDark]}>
                    • Current relationships (except family tree)
                  </Text>
                </View>
                <Text style={[styles.confirmationText, gameState.settings.darkMode && styles.confirmationTextDark, { marginTop: 20 }]}>
                  You will keep:
                </Text>
                <View style={styles.keepList}>
                  <Text style={[styles.keepItem, gameState.settings.darkMode && styles.keepItemDark]}>
                    • Prestige points and bonuses
                  </Text>
                  <Text style={[styles.keepItem, gameState.settings.darkMode && styles.keepItemDark]}>
                    • Achievements and gems
                  </Text>
                  <Text style={[styles.keepItem, gameState.settings.darkMode && styles.keepItemDark]}>
                    • Family tree and lineage
                  </Text>
                </View>
                <Text style={[styles.pointsEarned, gameState.settings.darkMode && styles.pointsEarnedDark]}>
                  You will earn {pointsBreakdown.total.toLocaleString()} prestige points!
                </Text>
                <View style={styles.confirmationActions}>
                  <TouchableOpacity
                    style={[styles.button, styles.cancelButton]}
                    onPress={() => setShowConfirmation(false)}
                    activeOpacity={0.8}
                  >
                    <Text style={styles.cancelButtonText}>Back</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.button, styles.confirmButton]}
                    onPress={handleConfirm}
                    activeOpacity={0.8}
                    disabled={currentNetWorth < getPrestigeThreshold(prestigeData?.prestigeLevel || 0)}
                  >
                    <LinearGradient
                      colors={currentNetWorth >= getPrestigeThreshold(prestigeData?.prestigeLevel || 0) 
                        ? ['#10B981', '#059669'] 
                        : ['#6B7280', '#4B5563']}
                      start={{ x: 0, y: 0 }}
                      end={{ x: 1, y: 1 }}
                      style={styles.confirmButtonGradient}
                    >
                      <Crown size={20} color="#FFFFFF" />
                      <Text style={styles.confirmButtonText}>
                        {currentNetWorth >= getPrestigeThreshold(prestigeData?.prestigeLevel || 0)
                          ? 'Confirm Prestige'
                          : `Need $${((getPrestigeThreshold(prestigeData?.prestigeLevel || 0) - currentNetWorth) / 1_000_000).toFixed(0)}M More`}
                      </Text>
                    </LinearGradient>
                  </TouchableOpacity>
                </View>
              </View>
            )}
          </LinearGradient>
        </Animated.View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  container: {
    width: '100%',
    maxWidth: 500,
    maxHeight: '90%',
  },
  content: {
    borderRadius: 20,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.3,
    shadowRadius: 20,
    elevation: 10,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.1)',
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
  },
  iconContainer: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: 'rgba(245, 158, 11, 0.2)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#1F2937',
  },
  titleDark: {
    color: '#FFFFFF',
  },
  subtitle: {
    fontSize: 14,
    color: '#6B7280',
    marginTop: 4,
  },
  subtitleDark: {
    color: '#9CA3AF',
  },
  closeButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
  },
  scrollView: {
    maxHeight: screenWidth * 1.2,
  },
  pointsCard: {
    margin: 20,
    borderRadius: 16,
    overflow: 'hidden',
  },
  pointsGradient: {
    padding: 20,
  },
  pointsHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 12,
  },
  pointsTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  pointsValue: {
    fontSize: 36,
    fontWeight: 'bold',
    color: '#FFFFFF',
    marginBottom: 16,
  },
  breakdown: {
    gap: 8,
  },
  breakdownRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  breakdownLabel: {
    fontSize: 13,
    color: '#FEF3C7',
  },
  breakdownValue: {
    fontSize: 13,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  statsCard: {
    marginHorizontal: 20,
    marginBottom: 20,
    padding: 16,
    borderRadius: 12,
    backgroundColor: '#F3F4F6',
  },
  statsCardDark: {
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#1F2937',
    marginBottom: 12,
  },
  sectionTitleDark: {
    color: '#FFFFFF',
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
    padding: 12,
    borderRadius: 8,
    backgroundColor: 'rgba(255, 255, 255, 0.5)',
  },
  statValue: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#1F2937',
    marginTop: 4,
  },
  statValueDark: {
    color: '#FFFFFF',
  },
  statLabel: {
    fontSize: 11,
    color: '#6B7280',
    marginTop: 2,
  },
  statLabelDark: {
    color: '#9CA3AF',
  },
  pathCard: {
    marginHorizontal: 20,
    marginBottom: 16,
    borderRadius: 16,
    overflow: 'hidden',
    borderWidth: 2,
    borderColor: 'transparent',
  },
  pathCardDark: {
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  pathCardSelected: {
    borderColor: '#F59E0B',
  },
  pathCardDisabled: {
    opacity: 0.5,
  },
  pathGradient: {
    padding: 16,
  },
  pathHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    marginBottom: 12,
  },
  pathTextContainer: {
    flex: 1,
  },
  pathTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#1F2937',
    marginBottom: 4,
  },
  pathTitleDark: {
    color: '#FFFFFF',
  },
  pathTitleSelected: {
    color: '#FFFFFF',
  },
  pathDescription: {
    fontSize: 13,
    color: '#6B7280',
    lineHeight: 18,
  },
  pathDescriptionDark: {
    color: '#9CA3AF',
  },
  pathDescriptionSelected: {
    color: '#FEF3C7',
  },
  pathBenefits: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 8,
  },
  benefitText: {
    fontSize: 12,
    color: '#6B7280',
  },
  benefitTextDark: {
    color: '#9CA3AF',
  },
  benefitTextSelected: {
    color: '#FEF3C7',
  },
  characterImage: {
    width: 80,
    height: 80,
    borderRadius: 40,
    marginTop: 12,
    alignSelf: 'center',
  },
  childrenScroll: {
    marginTop: 12,
  },
  childCard: {
    width: 100,
    marginRight: 12,
    padding: 12,
    borderRadius: 12,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: 'transparent',
  },
  childCardDark: {
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
  },
  childCardSelected: {
    borderColor: '#F59E0B',
    backgroundColor: 'rgba(245, 158, 11, 0.2)',
  },
  childImage: {
    width: 60,
    height: 60,
    borderRadius: 30,
    marginBottom: 8,
  },
  childName: {
    fontSize: 12,
    fontWeight: '600',
    color: '#1F2937',
    textAlign: 'center',
  },
  childNameDark: {
    color: '#FFFFFF',
  },
  childNameSelected: {
    color: '#F59E0B',
  },
  childAge: {
    fontSize: 10,
    color: '#6B7280',
    marginTop: 4,
  },
  childAgeDark: {
    color: '#9CA3AF',
  },
  bonusesCard: {
    marginHorizontal: 20,
    marginBottom: 20,
    padding: 16,
    borderRadius: 12,
    backgroundColor: '#F3F4F6',
  },
  bonusesCardDark: {
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
  },
  bonusesList: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  bonusBadge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: '#3B82F6',
  },
  bonusBadgeText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#FFFFFF',
    textTransform: 'capitalize',
  },
  moreBonuses: {
    fontSize: 12,
    color: '#6B7280',
    alignSelf: 'center',
  },
  moreBonusesDark: {
    color: '#9CA3AF',
  },
  actions: {
    flexDirection: 'row',
    gap: 12,
    padding: 20,
    paddingTop: 0,
  },
  button: {
    flex: 1,
    minHeight: 50,
    borderRadius: 12,
    overflow: 'hidden',
  },
  cancelButton: {
    backgroundColor: '#E5E7EB',
    justifyContent: 'center',
    alignItems: 'center',
  },
  cancelButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#374151',
  },
  prestigeButton: {
    overflow: 'hidden',
  },
  prestigeButtonGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    gap: 8,
  },
  prestigeButtonText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#FFFFFF',
  },
  buttonDisabled: {
    opacity: 0.5,
  },
  confirmationView: {
    padding: 20,
  },
  confirmationTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#1F2937',
    marginBottom: 16,
    textAlign: 'center',
  },
  confirmationTitleDark: {
    color: '#FFFFFF',
  },
  confirmationText: {
    fontSize: 16,
    color: '#374151',
    marginBottom: 12,
  },
  confirmationTextDark: {
    color: '#D1D5DB',
  },
  warningList: {
    marginLeft: 20,
    marginBottom: 20,
  },
  warningItem: {
    fontSize: 14,
    color: '#EF4444',
    marginBottom: 8,
  },
  warningItemDark: {
    color: '#F87171',
  },
  keepList: {
    marginLeft: 20,
    marginBottom: 20,
  },
  keepItem: {
    fontSize: 14,
    color: '#10B981',
    marginBottom: 8,
  },
  keepItemDark: {
    color: '#34D399',
  },
  pointsEarned: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#F59E0B',
    textAlign: 'center',
    marginVertical: 20,
  },
  pointsEarnedDark: {
    color: '#FBBF24',
  },
  confirmationActions: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 20,
  },
  confirmButton: {
    flex: 1,
    overflow: 'hidden',
  },
  confirmButtonGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    gap: 8,
  },
  confirmButtonText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#FFFFFF',
  },
});

