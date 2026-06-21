import React, { useState, useCallback, useMemo, useRef, useEffect } from 'react';
import { View, Text, TouchableOpacity, ScrollView, Animated } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import LinearGradientFallback from '@/components/fallbacks/LinearGradientFallback';
import { useRouter } from 'expo-router';
import { useGame } from '@/contexts/GameContext';
import { getInflatedPrice } from '@/lib/economy/inflation';
import { ShoppingBag, Dumbbell, Apple, Smartphone, Heart, Layers } from 'lucide-react-native';
import { getItemBadges, getUnlockDescription, type ItemBadgeInfo } from '@/utils/marketBadges';
import { useTranslation } from '@/hooks/useTranslation';
import { useTutorialHighlight } from '@/contexts/TutorialHighlightContext';
import { useToast } from '@/contexts/ToastContext';
import ConfirmDialog from '@/components/ConfirmDialog';
import LoadingButton from '@/components/ui/LoadingButton';
import InfoButton from '@/components/ui/InfoButton';
import { getTabBarSafePadding } from '@/utils/scaling';
import { styles } from '@/components/market/marketScreenStyles';
import ErrorBoundary from '@/components/ErrorBoundary';
const LinearGradient = LinearGradientFallback;

// Item category mapping - outside component for stability
const ITEM_CATEGORIES: Record<string, 'electronics' | 'crime' | 'lifestyle'> = {
  smartphone: 'electronics',
  computer: 'electronics',
  gloves: 'crime',
  usb: 'crime',
  lockpick: 'crime',
  slim_jim: 'crime',
  drill_kit: 'crime',
  explosives: 'crime',
  crowbar: 'crime',
  drug_supply: 'crime',
  guitar: 'lifestyle',
  bike: 'lifestyle',
  suit: 'lifestyle',
  basic_bed: 'lifestyle',
  gym_membership: 'lifestyle',
  passport: 'lifestyle',
};

// Filter categories config
const FILTER_CATEGORIES = [
  { id: 'all', label: 'All', icon: Layers, color: '#6366F1' },
  { id: 'electronics', label: 'Electronics', icon: Smartphone, color: '#3B82F6' },
  { id: 'lifestyle', label: 'Lifestyle', icon: Heart, color: '#10B981' },
] as const;

function MarketScreen() {
  return (
    <ErrorBoundary>
      <MarketScreenContent />
    </ErrorBoundary>
  );
}

function MarketScreenContent() {
  const insets = useSafeAreaInsets();
  const { t } = useTranslation();
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<'items' | 'food' | 'gym'>('items');
  const { gameState, buyItem, sellItem, buyFood, updateStats } = useGame();

  // Prevent staying on market screen when in prison - redirect to work tab
  useEffect(() => {
    if (gameState.jailWeeks > 0) {
      router.replace('/(tabs)/work');
    }
  }, [gameState.jailWeeks, router]);
  const { highlightedItem, clearHighlight } = useTutorialHighlight();
  const { settings } = gameState;
  const { showSuccess, showError, showInfo } = useToast();
  const flatListRef = useRef<any>(null);
  const [showSellConfirm, setShowSellConfirm] = useState<{ itemId: string; itemName: string; price: number } | null>(null);
  const [showPurchaseConfirm, setShowPurchaseConfirm] = useState<{ itemId: string; itemName: string; price: number } | null>(null);
  const [loadingStates, setLoadingStates] = useState<{ [key: string]: boolean }>({});
  const [activeFilter, setActiveFilter] = useState<'all' | 'electronics' | 'lifestyle'>('all');

  const setLoading = (key: string, loading: boolean) => {
    setLoadingStates(prev => ({ ...prev, [key]: loading }));
  };

  const handlePurchase = async (itemId: string, itemName: string) => {
    setLoading(itemId, true);
    try {
      // Check if player can still afford it (in case something changed)
      const item = gameState.items.find(i => i.id === itemId);
      const itemPrice = item ? getInflatedPrice(item.price, gameState.economy?.priceIndex ?? 1) : 0;
      if (!item || gameState.stats.money < itemPrice) {
        showError("Can't afford this item");
        setLoading(itemId, false);
        return;
      }

      // P2-8: buyItem applies its money + ownership change synchronously via
      // setGameState (and re-checks affordability atomically). Affordability is
      // already gated above, so confirm immediately — no arbitrary delay/jank.
      buyItem(itemId);
      showSuccess(`Purchased ${itemName}!`);
    } catch (error) {
      showError("Purchase failed");
    } finally {
      setLoading(itemId, false);
    }
  };

  const handleSell = async (itemId: string, itemName: string) => {
    setLoading(itemId, true);
    try {
      // P2-8: compute the sale price from CURRENT state (the item is still owned
      // here) BEFORE selling, then sell synchronously — no arbitrary delay, and
      // the "$0" race (reading the item after it's removed) can't happen.
      const sellPrice = parseFloat((getInflatedPrice(
        gameState.items.find(i => i.id === itemId)?.price || 0,
        gameState.economy?.priceIndex ?? 1
      ) * 0.5).toFixed(2));

      sellItem(itemId);
      showInfo(`Sold ${itemName} for $${sellPrice}`);
    } catch (error) {
      showError("Sale failed");
    } finally {
      setLoading(itemId, false);
    }
  };



  // Clear highlight when highlighted item is purchased
  React.useEffect(() => {
    if (highlightedItem && gameState.items.find(item => item.id === highlightedItem)?.owned) {
      clearHighlight();
    }
  }, [gameState.items, highlightedItem, clearHighlight]);

  // P1-8: scroll-indicator state was dead — the setters had been renamed with
  // an underscore by an unused-variable lint sweep, so `contentHeight` and
  // `scrollViewHeight` stayed at 0 forever, producing NaN/Infinity in the
  // derived layout. The feature was never wired to a real scroll handler;
  // removed entirely until someone re-implements it intentionally.

  // Memoized data with stable sorting and filtering
  const sortedItems = useMemo(() => {
    const filtered = activeFilter === 'all'
      ? [...(gameState.items || [])]
      : [...(gameState.items || [])].filter(item => ITEM_CATEGORIES[item.id] === activeFilter);

    return filtered.sort((a, b) => {
      // Sort by price first, then by name for stability
      if (a.price !== b.price) return a.price - b.price;
      return a.name.localeCompare(b.name);
    });
  }, [gameState.items, activeFilter]);

  const sortedFoods = useMemo(() =>
    [...(gameState.foods || [])].sort((a, b) => {
      // Sort by price first, then by name for stability
      if (a.price !== b.price) return a.price - b.price;
      return a.name.localeCompare(b.name);
    }),
    [gameState.foods]
  );

  // Memoize canAfford function
  const canAfford = useCallback((price: number) => gameState.stats.money >= getInflatedPrice(price, gameState.economy?.priceIndex ?? 1), [gameState.stats.money, gameState.economy?.priceIndex]);
  const hasMembership = useMemo(() => {
    return gameState.items.find(item => item.id === 'gym_membership')?.owned || false;
  }, [gameState.items]);

  const canUseGym = useMemo(() => {
    return hasMembership && gameState.stats.money >= 50 && gameState.stats.energy >= 20;
  }, [hasMembership, gameState.stats.money, gameState.stats.energy]);

  // Auto-switch to items tab if tutorial is highlighting an item
  React.useEffect(() => {
    if (highlightedItem && highlightedItem !== 'stock-app') {
      setActiveTab('items');
      // Scroll to highlighted item after a delay. Capture + clear the timer so it
      // can't fire setState/scroll after unmount or after deps change.
      const id = setTimeout(() => {
        if (flatListRef.current && highlightedItem) {
          const itemIndex = sortedItems.findIndex(item => item.id === highlightedItem);
          if (itemIndex !== -1) {
            flatListRef.current.scrollToOffset({
              offset: itemIndex * 120, // 120 is itemHeight
              animated: true
            });
          }
        }
      }, 300);
      return () => clearTimeout(id);
    }
    return undefined;
  }, [highlightedItem, sortedItems]);

  // Memoized render functions with proper dependencies
  const renderItem = useCallback(({ item }: { item: typeof gameState.items[0] }) => {
    const isHighlighted = highlightedItem === item.id;
    const inflatedPrice = getInflatedPrice(item.price, gameState.economy?.priceIndex ?? 1);

    // Get badges for this item
    const badges = getItemBadges(
      { id: item.id, name: item.name, price: item.price, owned: item.owned, description: item.description },
      {
        money: gameState.stats.money,
        ownsSmartphone: gameState.items.some(i => i.id === 'smartphone' && i.owned),
        ownsComputer: gameState.items.some(i => i.id === 'computer' && i.owned),
        hasGymMembership: gameState.items.some(i => i.id === 'gym_membership' && i.owned),
      },
      inflatedPrice
    );

    // Get unlock description for feature items
    const unlockDesc = getUnlockDescription(item.id);

    return (
      <View key={item.id} style={[
        styles.itemCard,
        settings.darkMode && styles.itemCardDark,
        isHighlighted && styles.highlightedCard,
        badges.some(b => b.type === 'recommended') && styles.recommendedCard,
      ]}>
        <View style={styles.itemInfo}>
          {/* Badges Row */}
          {badges.length > 0 && !item.owned && (
            <View style={styles.badgesRow}>
              {badges.map((badge) => (
                <View key={badge.type} style={styles.itemBadge}>
                  <View style={[styles.badgeDot, { backgroundColor: badge.color }]} />
                  <Text style={[styles.badgeLabel, { color: badge.color }]}>
                    {badge.label}
                  </Text>
                </View>
              ))}
            </View>
          )}

          <Text style={[styles.itemName, settings.darkMode && styles.itemNameDark]}>{item.name}</Text>

          {/* Show unlock description for feature items */}
          {unlockDesc && !item.owned && (
            <Text style={[styles.unlockDescription, settings.darkMode && styles.unlockDescriptionDark]}>
              {unlockDesc}
            </Text>
          )}

          {item.description && !unlockDesc && (
            <Text style={[styles.itemDescription, settings.darkMode && styles.itemDescriptionDark]}>
              {item.description}
            </Text>
          )}
          <Text style={styles.itemPrice}>${inflatedPrice}</Text>
        </View>

        {item.owned ? (
          <LoadingButton
            onPress={() => {
              const sellPrice = parseFloat((getInflatedPrice(item.price, gameState.economy?.priceIndex ?? 1) * 0.5).toFixed(2));
              const importantItems = ['computer', 'smartphone', 'suit'];

              // Show confirmation for important items or expensive items (>$500)
              if (importantItems.includes(item.id) || sellPrice > 500) {
                setShowSellConfirm({ itemId: item.id, itemName: item.name, price: sellPrice });
              } else {
                handleSell(item.id, item.name);
              }
            }}
            title={`Sell ($${(getInflatedPrice(item.price, gameState.economy?.priceIndex ?? 1) * 0.5).toFixed(2)})`}
            loading={loadingStates[item.id] || false}
            variant="secondary"
            size="small"
            style={styles.sellButton}
            loadingText="Selling..."
          />
        ) : (
          <LoadingButton
            onPress={() => {
              const itemPrice = getInflatedPrice(item.price, gameState.economy?.priceIndex ?? 1);

              // Check if can afford before doing anything
              if (gameState.stats.money < itemPrice) {
                showError("Can't afford this item");
                return;
              }

              // Show confirmation for expensive items (>$1000)
              if (itemPrice > 1000) {
                setShowPurchaseConfirm({ itemId: item.id, itemName: item.name, price: itemPrice });
              } else {
                handlePurchase(item.id, item.name);
              }
            }}
            title={t('market.buy')}
            loading={loadingStates[item.id] || false}
            disabled={!canAfford(item.price)}
            variant="success"
            size="small"
            style={styles.buyButton}
            loadingText="Buying..."
          />
        )}
      </View>
    );
  }, [settings.darkMode, gameState.economy?.priceIndex, gameState.items, highlightedItem, loadingStates, canAfford, handleSell, handlePurchase, showError, showSuccess, showInfo, setShowSellConfirm, setShowPurchaseConfirm]);

  const renderFood = useCallback(({ item: food }: { item: typeof gameState.foods[0] }) => {
    // Calculate happiness restore based on food quality (healthRestore / 2, rounded, minimum 1)
    const happinessRestore = Math.max(1, Math.round(food.healthRestore / 2));

    return (
      <View key={food.id} style={[styles.itemCard, settings.darkMode && styles.itemCardDark]}>
        <View style={styles.itemInfo}>
          <Text style={[styles.itemName, settings.darkMode && styles.itemNameDark]}>{food.name}</Text>
          <Text style={styles.itemPrice}>${food.price}</Text>

          <View style={styles.bonusInfo}>
            <Text style={[styles.bonusTitle, settings.darkMode && styles.bonusTitleDark]}>{t('market.restores')}</Text>
            <Text style={[styles.bonusText, settings.darkMode && styles.bonusTextDark]}>+{food.healthRestore} {t('game.health')}</Text>
            <Text style={[styles.bonusText, settings.darkMode && styles.bonusTextDark]}>+{food.energyRestore} {t('game.energy')}</Text>
            <Text style={[styles.bonusText, settings.darkMode && styles.bonusTextDark]}>+{happinessRestore} {t('game.happiness')}</Text>
          </View>
        </View>

        <LoadingButton
          onPress={() => {
            if (canAfford(food.price)) {
              buyFood(food.id);
              showSuccess(`Ate ${food.name}! +${food.healthRestore} health, +${happinessRestore} happiness, +${food.energyRestore} energy`);
            } else {
              showError("Can't afford this food");
            }
          }}
          title={t('market.buy')}
          disabled={!canAfford(food.price)}
          variant="success"
          size="small"
          style={styles.buyButton}
        />
      </View>
    );
  }, [settings.darkMode, buyFood, canAfford, showSuccess, showError, t]);

  const handleGym = useCallback(() => {
    const cost = 50;
    const energyCost = 20;

    if (!hasMembership) return;

    if (gameState.stats.money < cost) return;
    if (gameState.stats.energy < energyCost) return;

    updateStats({
      money: -cost,
      energy: -energyCost,
      fitness: 5,
      health: 3,
      happiness: 2,
    });
  }, [hasMembership, gameState.stats.money, gameState.stats.energy, updateStats]);


  // (P1-8: scroll indicator layout block removed — see comment near the dead
  // scroll-indicator state above.)

  return (
    <View style={[styles.container, settings.darkMode && styles.containerDark]}>
      {/* Fixed Tab Bar */}
      <View style={[styles.tabContainer, settings.darkMode && styles.tabContainerDark]}>
        <View style={styles.tabWithInfo}>
          <TouchableOpacity
            style={[styles.tab, activeTab === 'items' && styles.activeTab]}
            onPress={() => setActiveTab('items')}
          >
            <ShoppingBag size={18} color={activeTab === 'items' ? '#FFFFFF' : '#6B7280'} />
            <Text style={[styles.tabText, activeTab === 'items' && styles.activeTabText, settings.darkMode && styles.tabTextDark]}>
              {t('market.items')}
            </Text>
          </TouchableOpacity>
          <InfoButton
            title="Market Items"
            content="Buy essential items to improve your life! Computer unlocks mobile apps, smartphone gives you access to banking and social features, and other items provide various benefits."
            size="small"
            darkMode={settings.darkMode}
          />
        </View>
        <View style={styles.tabWithInfo}>
          <TouchableOpacity
            style={[styles.tab, activeTab === 'food' && styles.activeTab]}
            onPress={() => setActiveTab('food')}
          >
            <Apple size={18} color={activeTab === 'food' ? '#FFFFFF' : '#6B7280'} />
            <Text style={[styles.tabText, activeTab === 'food' && styles.activeTabText, settings.darkMode && styles.tabTextDark]}>
              {t('market.food')}
            </Text>
          </TouchableOpacity>
          <InfoButton
            title="Food & Health"
            content="Buy food to restore your health and energy! Different foods provide different amounts of health and energy restoration. Keep your character healthy to avoid penalties!"
            size="small"
            darkMode={settings.darkMode}
          />
        </View>
        <View style={styles.tabWithInfo}>
          <TouchableOpacity
            style={[styles.tab, activeTab === 'gym' && styles.activeTab]}
            onPress={() => setActiveTab('gym')}
          >
            <Dumbbell size={18} color={activeTab === 'gym' ? '#FFFFFF' : '#6B7280'} />
            <Text style={[styles.tabText, activeTab === 'gym' && styles.activeTabText, settings.darkMode && styles.tabTextDark]}>
              {t('market.gym')}
            </Text>
          </TouchableOpacity>
          <InfoButton
            title="Gym Training"
            content="Train at the gym to increase your fitness, health, and happiness! Each session costs $50 and provides +5 fitness, +3 health, and +2 happiness. Higher fitness unlocks better career opportunities."
            size="small"
            darkMode={settings.darkMode}
          />
        </View>
      </View>

      {/* Scrollable Content */}
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={[
          styles.scrollContent,
          settings.darkMode && styles.scrollContentDark,
          { paddingBottom: getTabBarSafePadding(insets.bottom) },
        ]}
        showsVerticalScrollIndicator={true}
      >
        <View style={[styles.content, settings.darkMode && styles.contentDark]}>
          {activeTab === 'items' ? (
            <>
              <Text style={[styles.sectionDescription, settings.darkMode && styles.sectionDescriptionDark]}>
                {t('market.purchaseItems')}
              </Text>

              {/* Filter Bar */}
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                style={styles.filterContainer}
                contentContainerStyle={styles.filterContent}
              >
                {FILTER_CATEGORIES.map((category) => {
                  const isActive = activeFilter === category.id;
                  const IconComponent = category.icon;
                  return (
                    <TouchableOpacity
                      key={category.id}
                      style={[
                        styles.filterButton,
                        settings.darkMode && styles.filterButtonDark,
                        isActive && { backgroundColor: category.color, borderColor: category.color },
                      ]}
                      onPress={() => setActiveFilter(category.id as typeof activeFilter)}
                      activeOpacity={0.7}
                    >
                      <IconComponent
                        size={14}
                        color={isActive ? '#FFFFFF' : (settings.darkMode ? '#9CA3AF' : '#6B7280')}
                      />
                      <Text style={[
                        styles.filterButtonText,
                        settings.darkMode && styles.filterButtonTextDark,
                        isActive && styles.filterButtonTextActive,
                      ]}>
                        {category.label}
                      </Text>
                      {isActive && (
                        <View style={[styles.filterCount, { backgroundColor: 'rgba(255,255,255,0.3)' }]}>
                          <Text style={styles.filterCountText}>
                            {category.id === 'all'
                              ? gameState.items.length
                              : gameState.items.filter(item => ITEM_CATEGORIES[item.id] === category.id).length
                            }
                          </Text>
                        </View>
                      )}
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>

              {sortedItems.map((item) => renderItem({ item }))}
            </>
          ) : activeTab === 'food' ? (
            <>
              <Text style={[styles.sectionDescription, settings.darkMode && styles.sectionDescriptionDark]}>
                {t('market.buyFood')}
              </Text>
              {sortedFoods.map((food) => renderFood({ item: food }))}
            </>
          ) : (
            <>
              {/* Main Gym Session Card */}
              <View style={styles.gymCardWrapper}>
                <LinearGradient
                  colors={hasMembership
                    ? settings.darkMode
                      ? ['rgba(31, 41, 55, 0.7)', 'rgba(17, 24, 39, 0.8)']
                      : ['rgba(255, 255, 255, 0.8)', 'rgba(243, 244, 246, 0.9)']
                    : settings.darkMode
                      ? ['rgba(55, 65, 81, 0.3)', 'rgba(31, 41, 55, 0.4)']
                      : ['rgba(243, 244, 246, 0.6)', 'rgba(229, 231, 235, 0.7)']}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={styles.gymCardGradient}
                >
                  <View style={styles.gymCardHeader}>
                    <View style={styles.gymIconContainer}>
                      <Dumbbell size={28} color="#3B82F6" />
                    </View>
                    <View style={styles.gymTitleContainer}>
                      <Text style={[styles.gymCardTitle, settings.darkMode && styles.gymCardTitleDark]}>
                        {t('market.gymSession')}
                      </Text>
                      <Text style={[styles.gymCardSubtitle, settings.darkMode && styles.gymCardSubtitleDark]}>
                        Current Fitness: {Math.floor(gameState.stats.fitness)}
                      </Text>
                    </View>
                  </View>

                  {!hasMembership && (
                    <View style={styles.membershipWarningContainer}>
                      <Text style={[styles.membershipWarningText, settings.darkMode && styles.membershipWarningTextDark]}>
                        Gym Membership Required
                      </Text>
                      <Text style={[styles.membershipWarningSubtext, settings.darkMode && styles.membershipWarningSubtextDark]}>
                        Buy a Gym Membership from the Items tab to access the gym
                      </Text>
                    </View>
                  )}

                  {hasMembership && (
                    <>
                      <Text style={[styles.gymCardDescription, settings.darkMode && styles.gymCardDescriptionDark]}>
                        {t('market.gymDescription')}
                      </Text>

                      <View style={styles.gymStatsContainer}>
                        <View style={styles.gymStatCard}>
                          <LinearGradient
                            colors={settings.darkMode
                              ? ['rgba(16, 185, 129, 0.4)', 'rgba(5, 150, 105, 0.5)']
                              : ['rgba(16, 185, 129, 0.3)', 'rgba(5, 150, 105, 0.4)']}
                            start={{ x: 0, y: 0 }}
                            end={{ x: 1, y: 1 }}
                            style={styles.gymStatGradient}
                          >
                            <Text style={styles.gymStatValue}>+5</Text>
                            <Text
                              style={[styles.gymStatLabel, settings.darkMode && styles.gymStatLabelDark]}
                              numberOfLines={1}
                              adjustsFontSizeToFit
                              minimumFontScale={0.8}
                            >
                              {t('game.fitness')}
                            </Text>
                          </LinearGradient>
                        </View>

                        <View style={styles.gymStatCard}>
                          <LinearGradient
                            colors={settings.darkMode
                              ? ['rgba(59, 130, 246, 0.4)', 'rgba(37, 99, 235, 0.5)']
                              : ['rgba(59, 130, 246, 0.3)', 'rgba(37, 99, 235, 0.4)']}
                            start={{ x: 0, y: 0 }}
                            end={{ x: 1, y: 1 }}
                            style={styles.gymStatGradient}
                          >
                            <Text style={styles.gymStatValue}>+3</Text>
                            <Text
                              style={[styles.gymStatLabel, settings.darkMode && styles.gymStatLabelDark]}
                              numberOfLines={1}
                              adjustsFontSizeToFit
                              minimumFontScale={0.8}
                            >
                              {t('game.health')}
                            </Text>
                          </LinearGradient>
                        </View>

                        <View style={styles.gymStatCard}>
                          <LinearGradient
                            colors={settings.darkMode
                              ? ['rgba(245, 158, 11, 0.4)', 'rgba(217, 119, 6, 0.5)']
                              : ['rgba(245, 158, 11, 0.3)', 'rgba(217, 119, 6, 0.4)']}
                            start={{ x: 0, y: 0 }}
                            end={{ x: 1, y: 1 }}
                            style={styles.gymStatGradient}
                          >
                            <Text style={styles.gymStatValue}>+2</Text>
                            <Text
                              style={[styles.gymStatLabel, settings.darkMode && styles.gymStatLabelDark]}
                              numberOfLines={1}
                              adjustsFontSizeToFit
                              minimumFontScale={0.8}
                            >
                              {t('game.happiness')}
                            </Text>
                          </LinearGradient>
                        </View>
                      </View>

                      <View style={styles.gymCostCard}>
                        <LinearGradient
                          colors={settings.darkMode
                            ? ['rgba(107, 114, 128, 0.3)', 'rgba(75, 85, 99, 0.4)']
                            : ['rgba(243, 244, 246, 0.5)', 'rgba(229, 231, 235, 0.6)']}
                          start={{ x: 0, y: 0 }}
                          end={{ x: 1, y: 1 }}
                          style={styles.gymCostGradient}
                        >
                          <Text style={[styles.gymCostLabel, settings.darkMode && styles.gymCostLabelDark]}>
                            Session Cost
                          </Text>
                          <Text style={[styles.gymCostValue, settings.darkMode && styles.gymCostValueDark]}>
                            $50 + 20 {t('game.energy')}
                          </Text>
                        </LinearGradient>
                      </View>

                      <TouchableOpacity
                        onPress={handleGym}
                        disabled={!canUseGym}
                        activeOpacity={0.7}
                        style={styles.gymButtonContainer}
                      >
                        <LinearGradient
                          colors={canUseGym
                            ? ['rgba(59, 130, 246, 0.7)', 'rgba(37, 99, 235, 0.8)']
                            : settings.darkMode
                              ? ['rgba(107, 114, 128, 0.4)', 'rgba(75, 85, 99, 0.5)']
                              : ['rgba(229, 231, 235, 0.6)', 'rgba(209, 213, 219, 0.7)']}
                          start={{ x: 0, y: 0 }}
                          end={{ x: 1, y: 1 }}
                          style={styles.gymButtonGradient}
                        >
                          <Text style={[styles.gymButtonText, !canUseGym && styles.gymButtonTextDisabled]}>
                            {gameState.stats.money < 50 ? t('market.notEnoughMoney') :
                              gameState.stats.energy < 20 ? t('market.notEnoughEnergy') :
                                t('market.startWorkout')}
                          </Text>
                        </LinearGradient>
                      </TouchableOpacity>
                    </>
                  )}
                </LinearGradient>
              </View>

              {/* Workout Tips Card */}
              <View style={styles.gymCardWrapper}>
                <LinearGradient
                  colors={settings.darkMode
                    ? ['rgba(55, 65, 81, 0.3)', 'rgba(31, 41, 55, 0.4)']
                    : ['rgba(243, 244, 246, 0.6)', 'rgba(229, 231, 235, 0.7)']}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={styles.gymCardGradient}
                >
                  <View style={styles.gymCardHeader}>
                    <Dumbbell size={16} color="#34D399" style={{ marginRight: 8 }} />
                    <Text style={[styles.gymCardTitle, settings.darkMode && styles.gymCardTitleDark]}>
                      Why Work Out?
                    </Text>
                  </View>
                  <Text style={[styles.gymCardDescription, settings.darkMode && styles.gymCardDescriptionDark]}>
                    Working out a little each week pays off:{'\n\n'}
                    • More energy and better health{'\n'}
                    • Higher fitness unlocks better jobs{'\n'}
                    • A quick happiness boost{'\n\n'}
                    Keep it consistent — small sessions add up.
                  </Text>
                </LinearGradient>
              </View>
            </>
          )}
        </View>
      </ScrollView>

      {/* Sell Confirmation Dialog */}
      {showSellConfirm && (
        <ConfirmDialog
          visible={true}
          title={`Sell ${showSellConfirm.itemName}?`}
          message={
            showSellConfirm.itemId === 'computer'
              ? `Are you sure you want to sell your ${showSellConfirm.itemName} for $${showSellConfirm.price}?\n\nDon't worry - all your data (crypto, stocks, real estate, etc.) will be preserved and restored if you buy another computer later.`
              : showSellConfirm.itemId === 'smartphone'
                ? `Are you sure you want to sell your ${showSellConfirm.itemName} for $${showSellConfirm.price}?\n\nYou'll lose access to all mobile apps until you buy another phone.`
                : `Are you sure you want to sell ${showSellConfirm.itemName} for $${showSellConfirm.price}?`
          }
          confirmText="Sell"
          cancelText="Cancel"
          onConfirm={async () => {
            await handleSell(showSellConfirm.itemId, showSellConfirm.itemName);
            setShowSellConfirm(null);
          }}
          onCancel={() => setShowSellConfirm(null)}
          type="warning"
        />
      )}

      {/* Purchase Confirmation Dialog */}
      {showPurchaseConfirm && (
        <ConfirmDialog
          visible={true}
          title={`Purchase ${showPurchaseConfirm.itemName}?`}
          message={`This will cost $${showPurchaseConfirm.price}. You'll have $${Math.floor(gameState.stats.money - showPurchaseConfirm.price)} remaining.${showPurchaseConfirm.itemId === 'computer'
            ? '\n\nThis will unlock computer apps including Crypto Mining, Real Estate, and Gaming!'
            : showPurchaseConfirm.itemId === 'smartphone'
              ? '\n\nThis will unlock mobile apps including Banking, Dating, and Social Media!'
              : ''
            }`}
          confirmText="Purchase"
          cancelText="Cancel"
          onConfirm={async () => {
            await handlePurchase(showPurchaseConfirm.itemId, showPurchaseConfirm.itemName);
            setShowPurchaseConfirm(null);
          }}
          onCancel={() => setShowPurchaseConfirm(null)}
          type="default"
        />
      )}
    </View>
  );
}


export default React.memo(MarketScreen);
