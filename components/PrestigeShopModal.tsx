import React, { useState, useRef, useEffect, useMemo } from 'react';
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
import { Crown, X, Sparkles, TrendingUp, Zap, Unlock, Settings, Star, Check } from 'lucide-react-native';
import { useGame } from '@/contexts/GameContext';
import {
  PRESTIGE_BONUSES,
  getBonusesByCategory,
  getBonusLevel,
  canPurchaseBonus,
  getBonusPurchaseCost,
  PrestigeBonusCategory,
} from '@/lib/prestige/prestigeBonuses';

const { width: screenWidth } = Dimensions.get('window');

interface PrestigeShopModalProps {
  visible: boolean;
  onClose: () => void;
}

export default function PrestigeShopModal({ visible, onClose }: PrestigeShopModalProps) {
  const { gameState, purchasePrestigeBonus } = useGame();
  const [selectedCategory, setSelectedCategory] = useState<PrestigeBonusCategory>('starting');
  const [searchQuery, setSearchQuery] = useState('');

  const fadeAnim = useRef(new Animated.Value(0)).current;
  const scaleAnim = useRef(new Animated.Value(0.8)).current;

  const prestigeData = gameState.prestige;
  const prestigePoints = prestigeData?.prestigePoints || 0;
  const unlockedBonuses = prestigeData?.unlockedBonuses || [];

  const categories: PrestigeBonusCategory[] = ['starting', 'multiplier', 'unlock', 'qol', 'special'];

  const filteredBonuses = useMemo(() => {
    let bonuses = getBonusesByCategory(selectedCategory);
    
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      bonuses = bonuses.filter(
        b =>
          b.name.toLowerCase().includes(query) ||
          b.description.toLowerCase().includes(query) ||
          b.id.toLowerCase().includes(query)
      );
    }

    return bonuses;
  }, [selectedCategory, searchQuery]);

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

  const handlePurchase = (bonusId: string) => {
    const result = purchasePrestigeBonus(bonusId);
    if (result.success) {
      // Success feedback could be added here
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

  const getCategoryColor = (category: PrestigeBonusCategory) => {
    switch (category) {
      case 'starting':
        return ['#3B82F6', '#2563EB'];
      case 'multiplier':
        return ['#10B981', '#059669'];
      case 'unlock':
        return ['#8B5CF6', '#7C3AED'];
      case 'qol':
        return ['#F59E0B', '#D97706'];
      case 'special':
        return ['#EF4444', '#DC2626'];
      default:
        return ['#6B7280', '#4B5563'];
    }
  };

  const getRarityColor = (rarity?: string) => {
    switch (rarity) {
      case 'common':
        return '#9CA3AF';
      case 'uncommon':
        return '#10B981';
      case 'rare':
        return '#3B82F6';
      case 'epic':
        return '#8B5CF6';
      case 'legendary':
        return '#F59E0B';
      default:
        return '#6B7280';
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
                <View style={styles.pointsContainer}>
                  <Crown size={24} color="#F59E0B" />
                  <Text style={[styles.pointsText, gameState.settings.darkMode && styles.pointsTextDark]}>
                    {prestigePoints.toLocaleString()} Points
                  </Text>
                </View>
              </View>
              <TouchableOpacity onPress={onClose} style={styles.closeButton}>
                <X size={24} color={gameState.settings.darkMode ? '#FFFFFF' : '#1F2937'} />
              </TouchableOpacity>
            </View>

            {/* Category Tabs */}
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              style={styles.categoryTabs}
              contentContainerStyle={styles.categoryTabsContent}
            >
              {categories.map(category => {
                const Icon = getCategoryIcon(category);
                const colors = getCategoryColor(category);
                const isSelected = selectedCategory === category;
                return (
                  <TouchableOpacity
                    key={category}
                    style={[styles.categoryTab, isSelected && styles.categoryTabSelected]}
                    onPress={() => setSelectedCategory(category)}
                    activeOpacity={0.8}
                  >
                    <LinearGradient
                      colors={isSelected ? colors : ['#374151', '#1F2937']}
                      start={{ x: 0, y: 0 }}
                      end={{ x: 1, y: 1 }}
                      style={styles.categoryTabGradient}
                    >
                      <Icon size={18} color="#FFFFFF" />
                      <Text style={styles.categoryTabText}>
                        {category.charAt(0).toUpperCase() + category.slice(1)}
                      </Text>
                    </LinearGradient>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>

            {/* Bonuses List */}
            <ScrollView style={styles.bonusesList} showsVerticalScrollIndicator={false}>
              {filteredBonuses.length === 0 ? (
                <View style={styles.emptyState}>
                  <Text style={[styles.emptyText, gameState.settings.darkMode && styles.emptyTextDark]}>
                    No bonuses found
                  </Text>
                </View>
              ) : (
                filteredBonuses.map(bonus => {
                  const currentLevel = getBonusLevel(bonus.id, unlockedBonuses);
                  const canPurchase = canPurchaseBonus(bonus, unlockedBonuses);
                  const cost = getBonusPurchaseCost(bonus, unlockedBonuses);
                  const canAfford = prestigePoints >= cost;
                  const isAtMaxLevel = bonus.maxLevel ? currentLevel >= bonus.maxLevel : currentLevel > 0;
                  const hasAnyLevel = currentLevel > 0;

                  return (
                    <View
                      key={bonus.id}
                      style={[
                        styles.bonusCard,
                        gameState.settings.darkMode && styles.bonusCardDark,
                        hasAnyLevel && styles.bonusCardOwned,
                      ]}
                    >
                      <LinearGradient
                        colors={
                          isAtMaxLevel
                            ? ['#10B981', '#059669']
                            : hasAnyLevel
                            ? ['#3B82F6', '#2563EB']
                            : gameState.settings.darkMode
                            ? ['#374151', '#1F2937']
                            : ['#F3F4F6', '#E5E7EB']
                        }
                        start={{ x: 0, y: 0 }}
                        end={{ x: 1, y: 1 }}
                        style={styles.bonusGradient}
                      >
                        <View style={styles.bonusHeader}>
                          <View style={styles.bonusInfo}>
                            <View style={styles.bonusTitleRow}>
                              <Text
                                style={[
                                  styles.bonusName,
                                  gameState.settings.darkMode && styles.bonusNameDark,
                                  hasAnyLevel && styles.bonusNameOwned,
                                ]}
                              >
                                {bonus.name}
                              </Text>
                              {bonus.rarity && (
                                <View
                                  style={[
                                    styles.rarityBadge,
                                    { backgroundColor: getRarityColor(bonus.rarity) },
                                  ]}
                                >
                                  <Text style={styles.rarityText}>{bonus.rarity.toUpperCase()}</Text>
                                </View>
                              )}
                            </View>
                            <Text
                              style={[
                                styles.bonusDescription,
                                gameState.settings.darkMode && styles.bonusDescriptionDark,
                                hasAnyLevel && styles.bonusDescriptionOwned,
                              ]}
                            >
                              {bonus.description}
                            </Text>
                            {bonus.maxLevel && (
                              <Text
                                style={[
                                  styles.levelText,
                                  gameState.settings.darkMode && styles.levelTextDark,
                                ]}
                              >
                                Level {currentLevel} / {bonus.maxLevel}
                              </Text>
                            )}
                          </View>
                          {isAtMaxLevel && (
                            <View style={styles.ownedBadge}>
                              <Check size={20} color="#FFFFFF" />
                            </View>
                          )}
                        </View>

                        <View style={styles.bonusFooter}>
                          <View style={styles.costContainer}>
                            <Crown size={16} color="#F59E0B" />
                            <Text
                              style={[
                                styles.costText,
                                gameState.settings.darkMode && styles.costTextDark,
                                !canAfford && styles.costTextInsufficient,
                              ]}
                            >
                              {cost.toLocaleString()}
                            </Text>
                          </View>
                          <TouchableOpacity
                            style={[
                              styles.purchaseButton,
                              (!canPurchase || !canAfford) && styles.purchaseButtonDisabled,
                            ]}
                            onPress={() => handlePurchase(bonus.id)}
                            disabled={!canPurchase || !canAfford}
                            activeOpacity={0.8}
                          >
                            <LinearGradient
                              colors={
                                isAtMaxLevel
                                  ? ['#10B981', '#059669']
                                  : !canPurchase || !canAfford
                                  ? ['#6B7280', '#4B5563']
                                  : hasAnyLevel
                                  ? ['#3B82F6', '#2563EB']
                                  : ['#3B82F6', '#2563EB']
                              }
                              start={{ x: 0, y: 0 }}
                              end={{ x: 1, y: 1 }}
                              style={styles.purchaseButtonGradient}
                            >
                              <Text style={styles.purchaseButtonText}>
                                {isAtMaxLevel
                                  ? 'Max Level'
                                  : !canPurchase
                                  ? 'Max Level'
                                  : !canAfford
                                  ? 'Insufficient'
                                  : hasAnyLevel
                                  ? 'Upgrade'
                                  : 'Purchase'}
                              </Text>
                            </LinearGradient>
                          </TouchableOpacity>
                        </View>
                      </LinearGradient>
                    </View>
                  );
                })
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
    flex: 1,
  },
  pointsContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  pointsText: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#1F2937',
  },
  pointsTextDark: {
    color: '#FFFFFF',
    textShadowColor: 'rgba(0, 0, 0, 0.5)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
  closeButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
  },
  categoryTabs: {
    maxHeight: 60,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.1)',
  },
  categoryTabsContent: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    gap: 8,
  },
  categoryTab: {
    borderRadius: 12,
    overflow: 'hidden',
    marginRight: 8,
  },
  categoryTabSelected: {
    shadowColor: '#3B82F6',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 6,
  },
  categoryTabGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 10,
    gap: 6,
  },
  categoryTabText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#FFFFFF',
    textShadowColor: 'rgba(0, 0, 0, 0.5)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
  bonusesList: {
    maxHeight: screenWidth * 1.2,
    padding: 20,
  },
  emptyState: {
    padding: 40,
    alignItems: 'center',
  },
  emptyText: {
    fontSize: 16,
    color: '#6B7280',
  },
  emptyTextDark: {
    color: '#9CA3AF',
  },
  bonusCard: {
    marginBottom: 16,
    borderRadius: 16,
    overflow: 'hidden',
    borderWidth: 2,
    borderColor: 'transparent',
  },
  bonusCardDark: {
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  bonusCardOwned: {
    borderColor: '#10B981',
  },
  bonusGradient: {
    padding: 16,
  },
  bonusHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  bonusInfo: {
    flex: 1,
  },
  bonusTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 4,
  },
  bonusName: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#1F2937',
  },
  bonusNameDark: {
    color: '#FFFFFF',
    textShadowColor: 'rgba(0, 0, 0, 0.6)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
  },
  bonusNameOwned: {
    color: '#FFFFFF',
    textShadowColor: 'rgba(0, 0, 0, 0.7)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
    fontWeight: '700',
  },
  rarityBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 4,
  },
  rarityText: {
    fontSize: 9,
    fontWeight: 'bold',
    color: '#FFFFFF',
    letterSpacing: 0.5,
    textShadowColor: 'rgba(0, 0, 0, 0.6)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
  bonusDescription: {
    fontSize: 13,
    color: '#6B7280',
    lineHeight: 18,
    marginBottom: 4,
  },
  bonusDescriptionDark: {
    color: '#9CA3AF',
  },
  bonusDescriptionOwned: {
    color: '#FFFFFF',
    textShadowColor: 'rgba(0, 0, 0, 0.5)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
  levelText: {
    fontSize: 11,
    color: '#FFFFFF',
    marginTop: 4,
    fontWeight: '700',
    textShadowColor: 'rgba(0, 0, 0, 0.7)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
  levelTextDark: {
    color: '#FFFFFF',
    textShadowColor: 'rgba(0, 0, 0, 0.7)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
  ownedBadge: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  bonusFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.1)',
  },
  costContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  costText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#1F2937',
  },
  costTextDark: {
    color: '#FFFFFF',
    textShadowColor: 'rgba(0, 0, 0, 0.6)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
    fontWeight: '700',
  },
  costTextInsufficient: {
    color: '#EF4444',
  },
  purchaseButton: {
    minWidth: 120,
    borderRadius: 8,
    overflow: 'hidden',
  },
  purchaseButtonDisabled: {
    opacity: 0.5,
  },
  purchaseButtonGradient: {
    paddingHorizontal: 20,
    paddingVertical: 10,
    alignItems: 'center',
  },
  purchaseButtonText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#FFFFFF',
    textShadowColor: 'rgba(0, 0, 0, 0.5)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
});

