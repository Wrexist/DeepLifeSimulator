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
import LinearGradientFallback from '@/components/fallbacks/LinearGradientFallback';
const LinearGradient = LinearGradientFallback;
import { Crown, X, Sparkles, TrendingUp, Unlock, Settings, Star, Check } from 'lucide-react-native';
import { useGame } from '@/contexts/GameContext';
import {
  getBonusesByCategory,
  getBonusLevel,
  canPurchaseBonus,
  getBonusPurchaseCost,
  PrestigeBonusCategory,
} from '@/lib/prestige/prestigeBonuses';
import { scale, fontScale } from '@/utils/scaling';

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

  const prestigeData = gameState?.prestige;
  const prestigePoints = prestigeData?.prestigePoints || 0;
  const unlockedBonuses = prestigeData?.unlockedBonuses || [];
  const isDarkMode = gameState?.settings?.darkMode ?? false;

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
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 200,
        useNativeDriver: true,
      }).start();
    } else {
      fadeAnim.setValue(0);
    }
  }, [visible, fadeAnim]);

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
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <TouchableOpacity 
          style={StyleSheet.absoluteFill} 
          activeOpacity={1} 
          onPress={onClose}
        >
          <View 
            style={[StyleSheet.absoluteFill, { backgroundColor: isDarkMode ? 'rgba(0, 0, 0, 0.7)' : 'rgba(0, 0, 0, 0.5)' }]}
          />
        </TouchableOpacity>
        
        <Animated.View
          style={[
            styles.container,
            {
              opacity: fadeAnim,
            },
          ]}
        >
          <LinearGradient
            colors={isDarkMode 
              ? ['rgba(31, 41, 55, 0.95)', 'rgba(17, 24, 39, 0.98)'] 
              : ['rgba(255, 255, 255, 0.95)', 'rgba(243, 244, 246, 0.98)']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.content}
          >
            {/* Header */}
            <View style={styles.header}>
              <View style={styles.headerLeft}>
                <View style={styles.pointsContainer}>
                  <View style={styles.crownIconContainer}>
                    <Crown size={20} color="#F59E0B" />
                  </View>
                  <View>
                    <Text style={[styles.pointsLabel, isDarkMode && styles.pointsLabelDark]}>
                      Prestige Points
                    </Text>
                    <Text style={[styles.pointsText, isDarkMode && styles.pointsTextDark]}>
                      {prestigePoints.toLocaleString()}
                    </Text>
                  </View>
                </View>
              </View>
              <TouchableOpacity 
                onPress={onClose} 
                style={styles.closeButton}
                activeOpacity={0.7}
              >
                <View style={[styles.closeButtonInner, isDarkMode && styles.closeButtonInnerDark]}>
                  <X size={18} color={isDarkMode ? '#FFFFFF' : '#1F2937'} />
                </View>
              </TouchableOpacity>
            </View>

            {/* Category Tabs */}
            <View style={styles.categoryTabsContainer}>
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
                      style={styles.categoryTabWrapper}
                      onPress={() => setSelectedCategory(category)}
                      activeOpacity={0.7}
                    >
                      <LinearGradient
                        colors={isSelected 
                          ? colors 
                          : isDarkMode 
                          ? ['rgba(55, 65, 81, 0.6)', 'rgba(31, 41, 55, 0.7)'] 
                          : ['rgba(243, 244, 246, 0.8)', 'rgba(229, 231, 235, 0.9)']}
                        start={{ x: 0, y: 0 }}
                        end={{ x: 1, y: 1 }}
                        style={[styles.categoryTab, isSelected && styles.categoryTabSelected]}
                      >
                        <Icon size={16} color={isSelected ? '#FFFFFF' : (isDarkMode ? '#D1D5DB' : '#6B7280')} />
                        <Text style={[styles.categoryTabText, isSelected && styles.categoryTabTextSelected, !isSelected && isDarkMode && styles.categoryTabTextDark]}>
                          {category.charAt(0).toUpperCase() + category.slice(1)}
                        </Text>
                      </LinearGradient>
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>
            </View>

            {/* Bonuses List */}
            <ScrollView 
              style={styles.bonusesList} 
              showsVerticalScrollIndicator={false}
              contentContainerStyle={styles.bonusesListContent}
            >
              {filteredBonuses.length === 0 ? (
                <View style={styles.emptyState}>
                  <Text style={[styles.emptyText, isDarkMode && styles.emptyTextDark]}>
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
                      style={styles.bonusCard}
                    >
                      <LinearGradient
                        colors={
                          isAtMaxLevel
                            ? ['rgba(16, 185, 129, 0.4)', 'rgba(5, 150, 105, 0.5)']
                            : hasAnyLevel
                            ? ['rgba(59, 130, 246, 0.4)', 'rgba(37, 99, 235, 0.5)']
                            : isDarkMode
                            ? ['rgba(55, 65, 81, 0.3)', 'rgba(31, 41, 55, 0.4)']
                            : ['rgba(243, 244, 246, 0.6)', 'rgba(229, 231, 235, 0.7)']
                        }
                        start={{ x: 0, y: 0 }}
                        end={{ x: 1, y: 1 }}
                        style={[styles.bonusGradient, hasAnyLevel && styles.bonusGradientOwned]}
                      >
                        <View style={styles.bonusHeader}>
                          <View style={styles.bonusInfo}>
                            <View style={styles.bonusTitleRow}>
                              <Text
                                style={[
                                  styles.bonusName,
                                  isDarkMode && styles.bonusNameDark,
                                  hasAnyLevel && styles.bonusNameOwned,
                                ]}
                                numberOfLines={1}
                              >
                                {bonus.name}
                              </Text>
                              {bonus.rarity && (
                                <View
                                  style={[
                                    styles.rarityBadge,
                                    { backgroundColor: getRarityColor(bonus.rarity) + '40' },
                                  ]}
                                >
                                  <Text style={styles.rarityText}>{bonus.rarity.toUpperCase()}</Text>
                                </View>
                              )}
                            </View>
                            <Text
                              style={[
                                styles.bonusDescription,
                                isDarkMode && styles.bonusDescriptionDark,
                                hasAnyLevel && styles.bonusDescriptionOwned,
                              ]}
                              numberOfLines={2}
                            >
                              {bonus.description}
                            </Text>
                            {bonus.maxLevel && (
                              <View style={styles.levelContainer}>
                                <Text
                                  style={[
                                    styles.levelText,
                                    isDarkMode && styles.levelTextDark,
                                  ]}
                                >
                                  Level {currentLevel} / {bonus.maxLevel}
                                </Text>
                              </View>
                            )}
                          </View>
                          {isAtMaxLevel && (
                            <View style={styles.ownedBadge}>
                              <Check size={16} color="#10B981" />
                            </View>
                          )}
                        </View>

                        <View style={styles.bonusFooter}>
                          {!isAtMaxLevel && (
                            <View style={styles.costContainer}>
                              <Crown size={14} color="#F59E0B" />
                              <Text
                                style={[
                                  styles.costText,
                                  isDarkMode && styles.costTextDark,
                                  !canAfford && styles.costTextInsufficient,
                                ]}
                              >
                                {cost.toLocaleString()}
                              </Text>
                            </View>
                          )}
                          <TouchableOpacity
                            style={[styles.purchaseButtonWrapper, isAtMaxLevel && styles.purchaseButtonWrapperMaxLevel]}
                            onPress={() => handlePurchase(bonus.id)}
                            disabled={!canPurchase || !canAfford}
                            activeOpacity={0.7}
                          >
                            <LinearGradient
                              colors={
                                isAtMaxLevel
                                  ? ['rgba(16, 185, 129, 0.7)', 'rgba(5, 150, 105, 0.8)']
                                  : !canPurchase || !canAfford
                                  ? ['rgba(107, 114, 128, 0.4)', 'rgba(75, 85, 99, 0.5)']
                                  : hasAnyLevel
                                  ? ['rgba(59, 130, 246, 0.7)', 'rgba(37, 99, 235, 0.8)']
                                  : ['rgba(59, 130, 246, 0.7)', 'rgba(37, 99, 235, 0.8)']
                              }
                              start={{ x: 0, y: 0 }}
                              end={{ x: 1, y: 1 }}
                              style={styles.purchaseButton}
                            >
                              <Text style={[styles.purchaseButtonText, (!canPurchase || !canAfford) && styles.purchaseButtonTextDisabled]}>
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
    justifyContent: 'flex-end',
    alignItems: 'center',
    padding: scale(12),
    paddingBottom: scale(40),
  },
  container: {
    width: '100%',
    maxWidth: scale(700),
    height: '85%',
    maxHeight: '85%',
    borderRadius: scale(24),
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: scale(20) },
    shadowOpacity: 0.4,
    shadowRadius: scale(30),
    elevation: 20,
  },
  content: {
    flex: 1,
    borderRadius: scale(24),
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.2)',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: scale(20),
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.1)',
  },
  headerLeft: {
    flex: 1,
  },
  pointsContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: scale(12),
  },
  crownIconContainer: {
    width: scale(40),
    height: scale(40),
    borderRadius: scale(20),
    backgroundColor: 'rgba(245, 158, 11, 0.2)',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(245, 158, 11, 0.3)',
  },
  pointsLabel: {
    fontSize: fontScale(12),
    fontWeight: '600',
    color: '#6B7280',
    marginBottom: scale(2),
  },
  pointsLabelDark: {
    color: '#9CA3AF',
  },
  pointsText: {
    fontSize: fontScale(24),
    fontWeight: '800',
    color: '#1F2937',
  },
  pointsTextDark: {
    color: '#FFFFFF',
  },
  closeButton: {
    width: scale(36),
    height: scale(36),
    borderRadius: scale(18),
    overflow: 'hidden',
  },
  closeButtonInner: {
    width: '100%',
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.1)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  closeButtonInnerDark: {
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
  },
  categoryTabsContainer: {
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.1)',
  },
  categoryTabs: {
    maxHeight: scale(70),
  },
  categoryTabsContent: {
    paddingHorizontal: scale(16),
    paddingVertical: scale(12),
    gap: scale(10),
  },
  categoryTabWrapper: {
    marginRight: scale(8),
  },
  categoryTab: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: scale(16),
    paddingVertical: scale(10),
    gap: scale(8),
    borderRadius: scale(12),
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  categoryTabSelected: {
    borderColor: 'rgba(255, 255, 255, 0.3)',
    shadowColor: '#3B82F6',
    shadowOffset: { width: 0, height: scale(4) },
    shadowOpacity: 0.4,
    shadowRadius: scale(8),
    elevation: 8,
  },
  categoryTabText: {
    fontSize: fontScale(13),
    fontWeight: '600',
    color: '#6B7280',
  },
  categoryTabTextSelected: {
    color: '#FFFFFF',
    fontWeight: '700',
  },
  categoryTabTextDark: {
    color: '#D1D5DB',
  },
  bonusesList: {
    flex: 1,
  },
  bonusesListContent: {
    padding: scale(20),
    gap: scale(14),
    paddingBottom: scale(40),
  },
  emptyState: {
    padding: scale(40),
    alignItems: 'center',
  },
  emptyText: {
    fontSize: fontScale(16),
    color: '#6B7280',
  },
  emptyTextDark: {
    color: '#9CA3AF',
  },
  bonusCard: {
    marginBottom: scale(12),
    borderRadius: scale(16),
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.15)',
  },
  bonusGradient: {
    padding: scale(18),
    minHeight: scale(140),
  },
  bonusGradientOwned: {
    borderColor: 'rgba(16, 185, 129, 0.4)',
    shadowColor: '#10B981',
    shadowOffset: { width: 0, height: scale(2) },
    shadowOpacity: 0.3,
    shadowRadius: scale(8),
    elevation: 4,
  },
  bonusHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: scale(12),
  },
  bonusInfo: {
    flex: 1,
    minWidth: 0,
  },
  bonusTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: scale(8),
    marginBottom: scale(6),
    flexWrap: 'wrap',
  },
  bonusName: {
    fontSize: fontScale(18),
    fontWeight: '700',
    color: '#1F2937',
  },
  bonusNameDark: {
    color: '#FFFFFF',
  },
  bonusNameOwned: {
    color: '#FFFFFF',
  },
  rarityBadge: {
    paddingHorizontal: scale(8),
    paddingVertical: scale(3),
    borderRadius: scale(6),
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.2)',
  },
  rarityText: {
    fontSize: fontScale(9),
    fontWeight: '800',
    color: '#FFFFFF',
    letterSpacing: 0.5,
  },
  bonusDescription: {
    fontSize: fontScale(14),
    color: '#6B7280',
    lineHeight: fontScale(20),
    marginBottom: scale(8),
    marginTop: scale(4),
  },
  bonusDescriptionDark: {
    color: '#D1D5DB',
  },
  bonusDescriptionOwned: {
    color: 'rgba(255, 255, 255, 0.9)',
  },
  levelContainer: {
    marginTop: scale(4),
  },
  levelText: {
    fontSize: fontScale(11),
    color: '#6B7280',
    fontWeight: '600',
  },
  levelTextDark: {
    color: '#9CA3AF',
  },
  ownedBadge: {
    width: scale(32),
    height: scale(32),
    borderRadius: scale(16),
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(16, 185, 129, 0.2)',
    borderWidth: 1,
    borderColor: 'rgba(16, 185, 129, 0.3)',
  },
  bonusFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: scale(12),
    paddingTop: scale(12),
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.1)',
    gap: scale(12),
  },
  costContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: scale(6),
    paddingHorizontal: scale(12),
    paddingVertical: scale(8),
    borderRadius: scale(10),
    backgroundColor: 'rgba(0, 0, 0, 0.1)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  costText: {
    fontSize: fontScale(16),
    fontWeight: '700',
    color: '#1F2937',
  },
  costTextDark: {
    color: '#FFFFFF',
  },
  costTextInsufficient: {
    color: '#EF4444',
  },
  purchaseButtonWrapper: {
    minWidth: scale(110),
    borderRadius: scale(10),
    overflow: 'hidden',
  },
  purchaseButtonWrapperMaxLevel: {
    minWidth: 'auto',
    flex: 1,
  },
  purchaseButton: {
    paddingHorizontal: scale(18),
    paddingVertical: scale(10),
    alignItems: 'center',
    justifyContent: 'center',
  },
  purchaseButtonText: {
    fontSize: fontScale(13),
    fontWeight: '700',
    color: '#FFFFFF',
  },
  purchaseButtonTextDisabled: {
    color: 'rgba(255, 255, 255, 0.6)',
  },
});
