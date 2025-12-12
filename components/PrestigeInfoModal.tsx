import React, { useRef, useEffect, useMemo } from 'react';
import {
  Modal,
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Animated,
  ScrollView,
  Dimensions,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { X, Crown, Award, TrendingUp, Zap, Unlock, Settings, Star, Check, Sparkles } from 'lucide-react-native';
import { useGame } from '@/contexts/GameContext';
import { PRESTIGE_BONUSES, getBonusLevel, PrestigeBonusCategory } from '@/lib/prestige/prestigeBonuses';
import {
  getIncomeMultiplier,
  getExperienceMultiplier,
  getSkillGainMultiplier,
  getStatDecayMultiplier,
  getEnergyRegenMultiplier,
  getRelationshipGainMultiplier,
 hasImmortality } from '@/lib/prestige/applyBonuses';
import {
  hasEarlyCareerAccess,
  hasEarlyEducationAccess,
  hasEarlyRealEstateAccess,
  hasEarlyCompanyAccess,
} from '@/lib/prestige/applyUnlocks';
import {
  shouldAutoRest,
  shouldAutoCollectRent,
  shouldAutoReinvestDividends,
  getEventFrequencyModifier,
} from '@/lib/prestige/applyQOLBonuses';


const { width: screenWidth } = Dimensions.get('window');

interface PrestigeInfoModalProps {
  visible: boolean;
  onClose: () => void;
}

export default function PrestigeInfoModal({ visible, onClose }: PrestigeInfoModalProps) {
  const { gameState } = useGame();
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const scaleAnim = useRef(new Animated.Value(0.8)).current;

  const prestigeData = gameState.prestige;
  const unlockedBonuses = prestigeData?.unlockedBonuses || [];

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
    } else {
      fadeAnim.setValue(0);
      scaleAnim.setValue(0.8);
    }
  }, [visible, fadeAnim, scaleAnim]);

  // Calculate active bonuses and their effects
  const activeBonuses = useMemo(() => {
    const bonuses: {
      category: PrestigeBonusCategory;
      name: string;
      description: string;
      level?: number;
      maxLevel?: number;
      effect: string;
    }[] = [];
    
    // Track which bonuses we've already processed to avoid duplicates
    const processedBonuses = new Set<string>();

    // Get unique bonus IDs (since unlockedBonuses may contain duplicates for multi-level bonuses)
    const uniqueBonusIds = Array.from(new Set(unlockedBonuses));

    uniqueBonusIds.forEach(bonusId => {
      // Skip if we've already processed this bonus
      if (processedBonuses.has(bonusId)) {
        return;
      }
      
      const bonus = PRESTIGE_BONUSES.find(b => b.id === bonusId);
      if (bonus) {
        // Mark as processed
        processedBonuses.add(bonusId);
        
        // Get total level (counts all purchases of this bonus)
        const level = getBonusLevel(bonusId, unlockedBonuses);
        let effect = '';

        // Calculate effect based on bonus type
        switch (bonus.category) {
          case 'starting':
            if (bonus.id === 'starting_money_1') {
              const totalAmount = 10000 * level;
              effect = `+$${totalAmount.toLocaleString()} starting money`;
            } else if (bonus.id === 'starting_money_2') {
              const totalAmount = 50000 * level;
              effect = `+$${totalAmount.toLocaleString()} starting money`;
            } else if (bonus.id === 'starting_money_3') {
              const totalAmount = 250000 * level;
              effect = `+$${totalAmount.toLocaleString()} starting money`;
            } else if (bonus.id === 'starting_stats_1') {
              const totalStats = 5 * level;
              effect = `+${totalStats} to all starting stats`;
            } else if (bonus.id === 'starting_stats_2') {
              const totalStats = 10 * level;
              effect = `+${totalStats} to all starting stats`;
            } else if (bonus.id === 'starting_stats_3') {
              const totalStats = 20 * level;
              effect = `+${totalStats} to all starting stats`;
            } else if (bonus.id === 'starting_reputation') {
              effect = '+10 starting reputation';
            } else if (bonus.id === 'starting_energy') {
              effect = '+20 starting energy';
            } else if (bonus.id === 'perfect_start') {
              effect = 'Start with 100 in all stats';
            }
            break;
          case 'multiplier':
            if (bonus.id === 'income_multiplier_1') {
              const totalPercent = 5 * level;
              effect = `+${totalPercent}% to all income`;
            } else if (bonus.id === 'income_multiplier_2') {
              const totalPercent = 10 * level;
              effect = `+${totalPercent}% to all income`;
            } else if (bonus.id === 'income_multiplier_3') {
              const totalPercent = 25 * level;
              effect = `+${totalPercent}% to all income`;
            } else if (bonus.id === 'experience_multiplier_1') {
              const totalPercent = 10 * level;
              effect = `+${totalPercent}% experience gain`;
            } else if (bonus.id === 'experience_multiplier_2') {
              const totalPercent = 25 * level;
              effect = `+${totalPercent}% experience gain`;
            } else if (bonus.id === 'experience_multiplier_3') {
              const totalPercent = 50 * level;
              effect = `+${totalPercent}% experience gain`;
            } else if (bonus.id === 'skill_gain_multiplier') {
              const skillMultiplier = getSkillGainMultiplier(unlockedBonuses);
              effect = `+${Math.round((skillMultiplier - 1) * 100)}% skill gain rate`;
            } else if (bonus.id === 'stat_decay_reduction') {
              const decayMultiplier = getStatDecayMultiplier(unlockedBonuses);
              effect = `-${Math.round((1 - decayMultiplier) * 100)}% stat decay rate`;
            } else if (bonus.id === 'wealth_magnet') {
              effect = '+100% passive income';
            } else if (bonus.id === 'genius') {
              effect = '+100% learning speed';
            }
            break;
          case 'unlock':
            if (bonus.id === 'early_career_access') {
              effect = 'All careers unlocked from start';
            } else if (bonus.id === 'early_education_access') {
              effect = 'All educations completed at start';
            } else if (bonus.id === 'early_real_estate') {
              effect = 'Real estate available at age 18';
            } else if (bonus.id === 'early_company_access') {
              effect = 'Start companies without education';
            } else if (bonus.id === 'early_item_access') {
              effect = 'Premium items unlocked early';
            }
            break;
          case 'qol':
            if (bonus.id === 'auto_save_energy') {
              effect = 'Auto-rest when energy < 20%';
            } else if (bonus.id === 'auto_manage_properties') {
              effect = 'Auto-collect rent from properties';
            } else if (bonus.id === 'auto_invest_dividends') {
              effect = 'Auto-reinvest stock dividends';
            } else if (bonus.id === 'increased_energy_regen') {
              const regenMultiplier = getEnergyRegenMultiplier(unlockedBonuses);
              effect = `+${Math.round((regenMultiplier - 1) * 100)}% energy regeneration`;
            } else if (bonus.id === 'reduced_event_frequency') {
              const eventModifier = getEventFrequencyModifier(unlockedBonuses);
              effect = `-${Math.round((1 - eventModifier) * 100)}% negative events`;
            }
            break;
          case 'special':
            if (bonus.id === 'immortality') {
              effect = 'Never die from old age';
            } else if (bonus.id === 'social_master') {
              const relMultiplier = getRelationshipGainMultiplier(unlockedBonuses);
              effect = `+${Math.round((relMultiplier - 1) * 100)}% relationship gains`;
            }
            break;
        }

        bonuses.push({
          category: bonus.category,
          name: bonus.name,
          description: bonus.description,
          level: bonus.maxLevel ? level : undefined,
          maxLevel: bonus.maxLevel,
          effect,
        });
      }
    });

    return bonuses;
  }, [unlockedBonuses]);

  // Group bonuses by category
  const bonusesByCategory = useMemo(() => {
    const grouped: Record<PrestigeBonusCategory, typeof activeBonuses> = {
      starting: [],
      multiplier: [],
      unlock: [],
      qol: [],
      special: [],
    };

    activeBonuses.forEach(bonus => {
      grouped[bonus.category].push(bonus);
    });

    return grouped;
  }, [activeBonuses]);

  const getCategoryName = (category: PrestigeBonusCategory) => {
    switch (category) {
      case 'starting':
        return 'Starting Bonuses';
      case 'multiplier':
        return 'Multipliers';
      case 'unlock':
        return 'Unlocks';
      case 'qol':
        return 'Quality of Life';
      case 'special':
        return 'Special';
      default:
        return category;
    }
  };

  const getCategoryIcon = (category: PrestigeBonusCategory) => {
    switch (category) {
      case 'starting':
        return Sparkles;
      case 'multiplier':
        return TrendingUp;
      case 'unlock':
        return Unlock;
      case 'qol':
        return Settings;
      case 'special':
        return Star;
      default:
        return Crown;
    }
  };

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
                <Crown size={24} color="#F59E0B" />
                <Text style={[styles.title, gameState.settings.darkMode && styles.titleDark]}>
                  Prestige Bonuses
                </Text>
              </View>
              <TouchableOpacity onPress={onClose} style={styles.closeButton}>
                <X size={24} color={gameState.settings.darkMode ? '#FFFFFF' : '#1F2937'} />
              </TouchableOpacity>
            </View>

            {/* Summary */}
            <View style={styles.summary}>
              <View style={styles.summaryItem}>
                <Crown size={20} color="#F59E0B" />
                <Text style={[styles.summaryLabel, gameState.settings.darkMode && styles.summaryLabelDark]}>
                  Total Bonuses
                </Text>
                <Text style={[styles.summaryValue, gameState.settings.darkMode && styles.summaryValueDark]}>
                  {unlockedBonuses.length}
                </Text>
              </View>
              <View style={styles.summaryItem}>
                <Award size={20} color="#3B82F6" />
                <Text style={[styles.summaryLabel, gameState.settings.darkMode && styles.summaryLabelDark]}>
                  Prestige Level
                </Text>
                <Text style={[styles.summaryValue, gameState.settings.darkMode && styles.summaryValueDark]}>
                  {prestigeData?.prestigeLevel || 0}
                </Text>
              </View>
            </View>

            {/* Bonuses List */}
            <ScrollView style={styles.bonusesList} showsVerticalScrollIndicator={false}>
              {Object.entries(bonusesByCategory).map(([category, bonuses]) => {
                if (bonuses.length === 0) return null;

                const Icon = getCategoryIcon(category as PrestigeBonusCategory);

                return (
                  <View key={category} style={styles.categorySection}>
                    <View style={styles.categoryHeader}>
                      <Icon size={18} color="#F59E0B" />
                      <Text style={[styles.categoryTitle, gameState.settings.darkMode && styles.categoryTitleDark]}>
                        {getCategoryName(category as PrestigeBonusCategory)}
                      </Text>
                      <Text style={[styles.categoryCount, gameState.settings.darkMode && styles.categoryCountDark]}>
                        ({bonuses.length})
                      </Text>
                    </View>

                    {bonuses.map((bonus, index) => (
                      <View
                        key={`${bonus.name}-${index}`}
                        style={[
                          styles.bonusItem,
                          gameState.settings.darkMode && styles.bonusItemDark,
                        ]}
                      >
                        <View style={styles.bonusItemHeader}>
                          <Check size={16} color="#10B981" />
                          <Text style={[styles.bonusName, gameState.settings.darkMode && styles.bonusNameDark]}>
                            {bonus.name}
                            {bonus.level && bonus.maxLevel && ` (Level ${bonus.level}/${bonus.maxLevel})`}
                          </Text>
                        </View>
                        <Text style={[styles.bonusEffect, gameState.settings.darkMode && styles.bonusEffectDark]}>
                          {bonus.effect || bonus.description}
                        </Text>
                      </View>
                    ))}
                  </View>
                );
              })}

              {activeBonuses.length === 0 && (
                <View style={styles.emptyState}>
                  <Text style={[styles.emptyText, gameState.settings.darkMode && styles.emptyTextDark]}>
                    No bonuses unlocked yet. Visit the Shop to purchase bonuses!
                  </Text>
                </View>
              )}
            </ScrollView>
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
    maxWidth: 600,
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
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#1F2937',
  },
  titleDark: {
    color: '#FFFFFF',
  },
  closeButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
  },
  summary: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.1)',
  },
  summaryItem: {
    alignItems: 'center',
    gap: 8,
  },
  summaryLabel: {
    fontSize: 12,
    color: '#6B7280',
  },
  summaryLabelDark: {
    color: '#9CA3AF',
  },
  summaryValue: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#1F2937',
  },
  summaryValueDark: {
    color: '#FFFFFF',
  },
  bonusesList: {
    maxHeight: screenWidth * 1.2,
    padding: 20,
  },
  categorySection: {
    marginBottom: 24,
  },
  categoryHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 12,
  },
  categoryTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#1F2937',
  },
  categoryTitleDark: {
    color: '#FFFFFF',
  },
  categoryCount: {
    fontSize: 14,
    color: '#6B7280',
  },
  categoryCountDark: {
    color: '#9CA3AF',
  },
  bonusItem: {
    backgroundColor: 'rgba(255, 255, 255, 0.5)',
    borderRadius: 12,
    padding: 12,
    marginBottom: 8,
  },
  bonusItemDark: {
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
  },
  bonusItemHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 4,
  },
  bonusName: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1F2937',
    flex: 1,
  },
  bonusNameDark: {
    color: '#FFFFFF',
  },
  bonusEffect: {
    fontSize: 12,
    color: '#6B7280',
    marginLeft: 24,
  },
  bonusEffectDark: {
    color: '#9CA3AF',
  },
  emptyState: {
    padding: 40,
    alignItems: 'center',
  },
  emptyText: {
    fontSize: 16,
    color: '#6B7280',
    textAlign: 'center',
  },
  emptyTextDark: {
    color: '#9CA3AF',
  },
});

