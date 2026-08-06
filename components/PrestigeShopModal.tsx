import React, { useState, useRef, useEffect, useMemo } from 'react';
import { incomeGainFromPurchase, incomeMultiplierHeadroom, isIncomeBonusWasted } from '@/lib/prestige/incomeHeadroom';
import { inertBonusReason } from '@/lib/prestige/inertBonuses';
import {
  Modal,
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Animated,
  ScrollView,
} from 'react-native';
import Gradient from '@/components/ui/Gradient';
import { Crown, X, Sparkles, TrendingUp, Unlock, Settings, Star, Check, Lock, Users } from 'lucide-react-native';
import { useGame } from '@/contexts/GameContext';
import { useMoneyActions } from '@/contexts/game/MoneyActionsContext';
import {
  getBonusesByCategory,
  getBonusLevel,
  canPurchaseBonus,
  getBonusPurchaseCost,
  PrestigeBonusCategory,
} from '@/lib/prestige/prestigeBonuses';
import {
  legacyPointsAvailable,
  LEGACY_BRANCHES,
  upgradesForBranch,
  isUpgradeUnlocked,
  getLegacyUpgrade,
} from '@/lib/legacy/legacyShop';
import { getAllContractProgress, getClaimableContracts } from '@/lib/legacy/contracts';
import { ClaimableBadge } from '@/components/ClaimableBadge';
import DynastyBoard from '@/components/prestige/DynastyBoard';
import { scale, fontScale } from '@/utils/scaling';
const LinearGradient = Gradient;


/** The shop's tab set: the prestige-point categories, plus the Legacy tree. */
type ShopTab = PrestigeBonusCategory | 'dynasty';

interface PrestigeShopModalProps {
  visible: boolean;
  onClose: () => void;
}

export default function PrestigeShopModal({ visible, onClose }: PrestigeShopModalProps) {
  const { gameState, purchasePrestigeBonus } = useGame();
  const { purchaseLegacyUpgrade: buyLegacyUpgrade, claimLegacyContract } = useMoneyActions();
  // 'dynasty' is the Legacy Points tree. It rides the same tab chrome as the
  // prestige-point categories because it is the same question — "what do I
  // spend my meta-currency on?" — just a different currency.
  const [selectedCategory, setSelectedCategory] = useState<ShopTab>('starting');
  const [searchQuery, _setSearchQuery] = useState('');

  const fadeAnim = useRef(new Animated.Value(0)).current;

  const prestigeData = gameState?.prestige;
  const prestigePoints = prestigeData?.prestigePoints || 0;
  // C-11: the spendable legacy balance — lifetime earned minus what has been
  // bought, derived rather than stored (the week loop only ever ADDS to
  // `legacyPoints`, so it is a lifetime total, not a wallet).
  const legacyAvailable = legacyPointsAvailable(gameState?.legacyPoints, gameState?.legacyUpgrades);
  const unlockedBonuses = prestigeData?.unlockedBonuses || [];
  const incomeHeadroom = incomeMultiplierHeadroom(unlockedBonuses);
  const isDarkMode = gameState?.settings?.darkMode ?? false;

  const categories: ShopTab[] = ['starting', 'multiplier', 'unlock', 'qol', 'special', 'dynasty'];

  // Legacy Contracts sit on the SIXTH of six horizontally-scrolling tabs, below
  // the Dynasty board — two or three taps and a scroll from anywhere the player
  // normally is. `getClaimableContracts` had no non-test caller at all, so a
  // completed contract announced itself nowhere in the app. It now drives a
  // count badge on the tab, matching how the Legacy Pass badges on Progress.
  const claimableContracts = useMemo(
    () => getClaimableContracts(gameState).length,
    [gameState]
  );

  const showDynasty = selectedCategory === 'dynasty';

  // Open ON the Dynasty tab when something is waiting there, so the badge that
  // brought the player here does not then ask them to go hunting for it. Keyed
  // on `visible` so it only steers a fresh open, never a tab the player picked.
  useEffect(() => {
    if (visible && claimableContracts > 0) setSelectedCategory('dynasty');
    // eslint-disable-next-line react-hooks/exhaustive-deps -- steer on open only
  }, [visible]);

  const filteredBonuses = useMemo(() => {
    // The Dynasty tab spends Legacy Points, not prestige points, so it has no
    // prestige bonuses to list.
    if (selectedCategory === 'dynasty') return [];
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

  const getCategoryIcon = (category: ShopTab) => {
    switch (category) {
      case 'dynasty':
        return Users;
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

  const getCategoryColor = (category: ShopTab) => {
    switch (category) {
      case 'dynasty':
        return ['#D97706', '#B45309'];
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
        return '#94A3B8';
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
              ? ['rgba(30, 41, 59, 0.95)', 'rgba(15, 23, 42, 0.98)']
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
                {/**
                  * C-11: Legacy Points had no readout anywhere, so a player
                  * could accrue hundreds without ever knowing the currency
                  * existed. Shown beside Prestige Points, and only once the
                  * player actually has some — an always-visible zero for a
                  * currency you cannot yet earn is noise.
                  */}
                {legacyAvailable > 0 && (
                  <Text style={[styles.pointsLabel, isDarkMode && styles.pointsLabelDark, { marginTop: 6 }]}>
                    {`Legacy Points: ${legacyAvailable.toLocaleString()}`}
                  </Text>
                )}
              </View>
              <TouchableOpacity 
                onPress={onClose} 
                style={styles.closeButton}
                activeOpacity={0.7}
              >
                <View style={[styles.closeButtonInner, isDarkMode && styles.closeButtonInnerDark]}>
                  <X size={18} color={isDarkMode ? '#FFFFFF' : '#1E293B'} />
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
                          ? ['rgba(51, 65, 85, 0.6)', 'rgba(30, 41, 59, 0.7)']
                          : ['rgba(243, 244, 246, 0.8)', 'rgba(229, 231, 235, 0.9)']}
                        start={{ x: 0, y: 0 }}
                        end={{ x: 1, y: 1 }}
                        style={[styles.categoryTab, isSelected && styles.categoryTabSelected]}
                      >
                        <Icon size={16} color={isSelected ? '#FFFFFF' : (isDarkMode ? '#CBD5E1' : '#6B7280')} />
                        <Text style={[styles.categoryTabText, isSelected && styles.categoryTabTextSelected, !isSelected && isDarkMode && styles.categoryTabTextDark]}>
                          {category.charAt(0).toUpperCase() + category.slice(1)}
                        </Text>
                      </LinearGradient>
                      {category === 'dynasty' && <ClaimableBadge count={claimableContracts} />}
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
              {showDynasty ? (
                <View>
                  {/* The Dynasty Tree. Legacy Points previously had a READOUT
                      here and nowhere to spend them: `purchaseLegacyUpgrade`
                      shipped in MoneyActionsContext with no screen calling it,
                      so the entire shop was unreachable in the app. */}
                  <Text style={[styles.emptyText, isDarkMode && styles.emptyTextDark, { textAlign: 'left', marginBottom: scale(10) }]}>
                    {legacyAvailable > 0
                      ? `${legacyAvailable.toLocaleString()} legacy points to spend on your heir's starting position.`
                      : 'Legacy points accrue as you live. Spend them here on the next generation.'}
                  </Text>

                  {/* Prestige tiers 2-5 — the Vault, the Endowment, Trials and
                      the Dynasty Seat. Rendered first because they are the
                      answer to "why prestige again?", and because two of them
                      (the Endowment, and Trials) are SOURCES of the legacy
                      points the contracts and the tree below deal in. Locked
                      tiers render padlocked rather than hidden, so the shape of
                      the late game is legible before it is earned. */}
                  <DynastyBoard gameState={gameState} />

                  {/* Contracts — the multi-life goals that PAY the points the
                      tree below spends. Rendered first so the board reads as
                      "earn, then spend" rather than two unrelated lists. */}
                  <Text style={[styles.categoryTabText, isDarkMode && styles.categoryTabTextDark, { marginBottom: scale(6) }]}>
                    CONTRACTS · Long-haul goals that pay legacy points
                  </Text>
                  {getAllContractProgress(gameState).map((p) => (
                    <TouchableOpacity
                      key={p.contract.id}
                      activeOpacity={p.claimable ? 0.8 : 1}
                      onPress={() => {
                        if (!p.claimable) return;
                        claimLegacyContract(p.contract.id);
                      }}
                      accessibilityRole="button"
                      accessibilityState={{ disabled: !p.claimable }}
                      accessibilityLabel={`${p.contract.name}: ${p.current.toLocaleString()} of ${p.target.toLocaleString()}`}
                      style={{
                        padding: scale(10),
                        marginBottom: scale(6),
                        borderRadius: scale(12),
                        // Full border all round — Hard Rule #7.
                        borderWidth: 1,
                        borderColor: p.claimable
                          ? 'rgba(16, 185, 129, 0.55)'
                          : isDarkMode ? 'rgba(255,255,255,0.10)' : 'rgba(0,0,0,0.08)',
                        backgroundColor: isDarkMode ? 'rgba(30, 41, 59, 0.6)' : 'rgba(243, 244, 246, 0.7)',
                        opacity: p.claimed ? 0.6 : 1,
                      }}
                    >
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: scale(8) }}>
                        {p.claimed ? (
                          <Check size={16} color="#10B981" />
                        ) : (
                          <Sparkles size={16} color={p.claimable ? '#10B981' : '#94A3B8'} />
                        )}
                        <View style={{ flex: 1 }}>
                          <Text style={[styles.emptyText, isDarkMode && styles.emptyTextDark, { textAlign: 'left', fontWeight: '700' }]}>
                            {p.contract.name}
                          </Text>
                          <Text style={[styles.emptyText, isDarkMode && styles.emptyTextDark, { textAlign: 'left', fontSize: fontScale(11) }]}>
                            {p.claimed
                              ? p.contract.description
                              : `${p.contract.description}  ·  ${p.current.toLocaleString()} / ${p.target.toLocaleString()}`}
                          </Text>
                        </View>
                        <Text style={[styles.emptyText, isDarkMode && styles.emptyTextDark, { fontWeight: '800', color: p.claimable ? '#10B981' : undefined }]}>
                          {p.claimed ? 'Claimed' : p.claimable ? 'Claim' : `+${p.contract.reward.toLocaleString()}`}
                        </Text>
                      </View>
                      <View style={{ height: scale(6), borderRadius: scale(3), overflow: 'hidden', marginTop: scale(8), backgroundColor: isDarkMode ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)' }}>
                        <View style={{ height: '100%', borderRadius: scale(3), width: `${Math.max(2, p.progress * 100)}%`, backgroundColor: p.complete ? '#10B981' : '#D97706' }} />
                      </View>
                    </TouchableOpacity>
                  ))}

                  {LEGACY_BRANCHES.map((branch) => (
                    <View key={branch.id} style={{ marginBottom: scale(14) }}>
                      <Text style={[styles.categoryTabText, isDarkMode && styles.categoryTabTextDark, { marginBottom: scale(6) }]}>
                        {branch.name.toUpperCase()} · {branch.blurb}
                      </Text>

                      {upgradesForBranch(branch.id).map((node) => {
                        const owned = (gameState?.legacyUpgrades ?? []).includes(node.id);
                        const unlocked = isUpgradeUnlocked(node.id, gameState?.legacyUpgrades);
                        const affordable = legacyAvailable >= node.cost;
                        const parent = node.requires ? getLegacyUpgrade(node.requires) : undefined;

                        return (
                          <TouchableOpacity
                            key={node.id}
                            activeOpacity={owned || !unlocked || !affordable ? 1 : 0.8}
                            onPress={() => {
                              if (owned || !unlocked || !affordable) return;
                              buyLegacyUpgrade(node.id);
                            }}
                            accessibilityRole="button"
                            accessibilityState={{ disabled: owned || !unlocked || !affordable }}
                            accessibilityLabel={`${node.name}, ${node.cost} legacy points`}
                            style={{
                              flexDirection: 'row',
                              alignItems: 'center',
                              gap: scale(10),
                              padding: scale(10),
                              marginBottom: scale(6),
                              borderRadius: scale(12),
                              // Full border on all four sides — a one-sided
                              // coloured stripe is banned app-wide (Hard Rule #7).
                              borderWidth: 1,
                              borderColor: owned
                                ? 'rgba(16, 185, 129, 0.5)'
                                : isDarkMode ? 'rgba(255,255,255,0.10)' : 'rgba(0,0,0,0.08)',
                              backgroundColor: isDarkMode ? 'rgba(30, 41, 59, 0.6)' : 'rgba(243, 244, 246, 0.7)',
                              opacity: unlocked ? 1 : 0.55,
                            }}
                          >
                            {owned ? (
                              <Check size={16} color="#10B981" />
                            ) : unlocked ? (
                              <Sparkles size={16} color="#D97706" />
                            ) : (
                              <Lock size={16} color={isDarkMode ? '#94A3B8' : '#6B7280'} />
                            )}
                            <View style={{ flex: 1 }}>
                              <Text style={[styles.emptyText, isDarkMode && styles.emptyTextDark, { textAlign: 'left', fontWeight: '700' }]}>
                                {node.name}
                              </Text>
                              <Text style={[styles.emptyText, isDarkMode && styles.emptyTextDark, { textAlign: 'left', fontSize: fontScale(11) }]}>
                                {owned
                                  ? node.description
                                  : unlocked
                                    ? node.description
                                    : `Needs ${parent?.name ?? 'an earlier upgrade'} first.`}
                              </Text>
                            </View>
                            <Text
                              style={[
                                styles.emptyText,
                                isDarkMode && styles.emptyTextDark,
                                { fontWeight: '800', color: owned ? '#10B981' : affordable && unlocked ? '#D97706' : undefined },
                              ]}
                            >
                              {owned ? 'Owned' : node.cost.toLocaleString()}
                            </Text>
                          </TouchableOpacity>
                        );
                      })}
                    </View>
                  ))}
                </View>
              ) : filteredBonuses.length === 0 ? (
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
                  // What this card would ACTUALLY grant. `bonus.description`
                  // is a fixed headline that ignores the income cap, so a
                  // legendary bought at the cap advertised +100% and gave 0.
                  const realIncomeGain = incomeGainFromPurchase(unlockedBonuses, bonus.id);
                  const incomeWasted = isIncomeBonusWasted(unlockedBonuses, bonus.id);
                  // Separate from the income cap: this one never does anything
                  // at any point, for any player.
                  const inertReason = inertBonusReason(bonus.id);
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
                            ? ['rgba(51, 65, 85, 0.3)', 'rgba(30, 41, 59, 0.4)']
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
                            {/* The cap is deliberate anti-snowball; the silence
                                was the bug. State the real effect whenever it
                                differs from the headline — including the case
                                where it is zero. */}
                            {inertReason ? (
                              <Text style={[styles.capNote, { color: '#f59e0b' }]}>
                                No effect — {inertReason}
                              </Text>
                            ) : incomeWasted ? (
                              <Text style={[styles.capNote, { color: '#f59e0b' }]}>
                                No effect — income bonus is already at its +{Math.round((incomeHeadroom.cap - 1) * 100)}% cap
                              </Text>
                            ) : realIncomeGain > 0 ? (
                              <Text style={[styles.capNote, { color: '#10b981' }]}>
                                Actually grants +{Math.round(realIncomeGain * 100)}% income
                              </Text>
                            ) : null}
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
    borderColor: 'rgba(255, 255, 255, 0.3)',
  },
  pointsLabel: {
    fontSize: fontScale(12),
    fontWeight: '600',
    color: '#6B7280',
    marginBottom: scale(2),
  },
  pointsLabelDark: {
    color: '#94A3B8',
  },
  pointsText: {
    fontSize: fontScale(24),
    fontWeight: '800',
    color: '#1E293B',
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
    color: '#CBD5E1',
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
    color: '#94A3B8',
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
    borderColor: 'rgba(255, 255, 255, 0.4)',
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
    color: '#1E293B',
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
  capNote: { fontSize: 11, marginTop: 4, fontWeight: '600' },
  bonusDescriptionDark: {
    color: '#CBD5E1',
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
    color: '#94A3B8',
  },
  ownedBadge: {
    width: scale(32),
    height: scale(32),
    borderRadius: scale(16),
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(16, 185, 129, 0.2)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.3)',
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
    color: '#1E293B',
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
