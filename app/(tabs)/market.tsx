import React, { useState, useCallback, useMemo, useRef, useEffect } from 'react';
import { View, Text, TouchableOpacity, ScrollView } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useNavigationReady } from '@/hooks/useNavigationReady';
import { useGame } from '@/contexts/GameContext';
import { listRentalOptions, rentHome, endRental } from '@/contexts/game/actions/RentalActions';
import { getInflatedPrice } from '@/lib/economy/inflation';
import { ShoppingBag, Dumbbell, Apple, Smartphone, Heart, Layers, Package, TrendingUp, Home, Check } from 'lucide-react-native';
import { getItemBadges, getUnlockDescription } from '@/utils/marketBadges';
import { useTranslation } from '@/hooks/useTranslation';
import { useTutorialHighlight } from '@/contexts/TutorialHighlightContext';
import { useToast } from '@/contexts/ToastContext';
import ConfirmDialog from '@/components/ConfirmDialog';
import LoadingButton from '@/components/ui/LoadingButton';
import InfoButton from '@/components/ui/InfoButton';
import { getTabBarSafePadding, scale } from '@/utils/scaling';
import { clampStat } from '@/utils/statUtils';
import { formatMoney } from '@/utils/moneyFormatting';
import { accent } from '@/lib/config/theme';
import { styles } from '@/components/market/marketScreenStyles';
import SegmentedControl from '@/components/ui/SegmentedControl';
import EconomyEventBanner from '@/components/shared/EconomyEventBanner';
import ErrorBoundary from '@/components/ErrorBoundary';

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
  { id: 'owned', label: 'Owned', icon: Package, color: '#F59E0B' },
] as const;

type MarketFilter = (typeof FILTER_CATEGORIES)[number]['id'];

function MarketScreen() {
  return (
    <ErrorBoundary>
      <MarketScreenContent />
    </ErrorBoundary>
  );
}

export function MarketScreenContent({ embedded = false }: { embedded?: boolean }) {
  const insets = useSafeAreaInsets();
  const { t } = useTranslation();
  const router = useRouter();
  // Redirects that run on this screen's first commit throw "Attempted to
  // navigate before mounting the Root Layout component" when this screen IS
  // the entry route (restored URL / deep link), which surfaces as the crash
  // screen. See hooks/useNavigationReady.ts.
  const navReady = useNavigationReady();
  const [activeTab, setActiveTab] = useState<'items' | 'food' | 'gym' | 'housing'>('items');
  const { gameState, setGameState, buyItem, sellItem, buyFood, updateStats, saveGame } = useGame();

  // Prevent staying on market screen when in prison - redirect to work tab.
  // Embedded (inside the Life tab) the layout owns the jail redirect, so skip it.
  useEffect(() => {
    if (embedded || !navReady) return;
    if (gameState.jailWeeks > 0) {
      router.replace('/(tabs)/work');
    }
  }, [embedded, navReady, gameState.jailWeeks, router]);
  const { highlightedItem, clearHighlight } = useTutorialHighlight();
  const { settings } = gameState;
  const { showSuccess, showError, showInfo } = useToast();
  const flatListRef = useRef<any>(null);
  const [showSellConfirm, setShowSellConfirm] = useState<{ itemId: string; itemName: string; price: number } | null>(null);
  const [showPurchaseConfirm, setShowPurchaseConfirm] = useState<{ itemId: string; itemName: string; price: number } | null>(null);
  const [loadingStates, setLoadingStates] = useState<{ [key: string]: boolean }>({});
  const [activeFilter, setActiveFilter] = useState<MarketFilter>('all');

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
        // Not an error — just a normal "you need more money" state. Use the
        // calmer info toast instead of the alarming red error toast.
        showInfo("Not enough money for this yet");
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
    const all = [...(gameState.items || [])];
    const filtered = activeFilter === 'all'
      ? all
      : activeFilter === 'owned'
        ? all.filter(item => item.owned)
        : all.filter(item => ITEM_CATEGORIES[item.id] === activeFilter);

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

  // Zero-gain guard: the $50 session grants +5 fitness / +3 health / +2 happiness.
  // When all three already sit at the cap every gain clamps to zero, so the visit
  // would charge money + energy for nothing. Compute the clamped deltas and treat
  // "all zero" as "already in top shape".
  const gymGainsAllZero = useMemo(() => {
    // Normalize first: a NaN/undefined stat on a corrupted save makes every
    // delta NaN, and `NaN <= 0` is false — the guard's answer would flip on
    // garbage input instead of being computed from a real baseline.
    const fitness = Number.isFinite(gameState.stats.fitness) ? gameState.stats.fitness : 0;
    const health = Number.isFinite(gameState.stats.health) ? gameState.stats.health : 0;
    const happiness = Number.isFinite(gameState.stats.happiness) ? gameState.stats.happiness : 0;
    const fitnessGain = clampStat(fitness + 5) - fitness;
    const healthGain = clampStat(health + 3) - health;
    const happinessGain = clampStat(happiness + 2) - happiness;
    return fitnessGain <= 0 && healthGain <= 0 && happinessGain <= 0;
  }, [gameState.stats.fitness, gameState.stats.health, gameState.stats.happiness]);

  // A gym session also refreshes the gym-visit timer the weekly tick reads to
  // scale fitness decay. When that timer is stale (behind the current week) a
  // workout is still worth doing even at capped stats, so the card must stay
  // tappable — otherwise a peak-shape player silently suffers accelerated decay.
  const gymTimerStale = useMemo(
    () => (gameState.lastGymVisitWeek || 0) !== (gameState.weeksLived || 0),
    [gameState.lastGymVisitWeek, gameState.weeksLived]
  );

  const canUseGym = useMemo(() => {
    return hasMembership && gameState.stats.money >= 50 && gameState.stats.energy >= 20 && (!gymGainsAllZero || gymTimerStale);
  }, [hasMembership, gameState.stats.money, gameState.stats.energy, gymGainsAllZero, gymTimerStale]);

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
                showInfo("Not enough money for this yet");
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
          {/**
            * F5. This printed the RAW price while the button beside it was
            * disabled off `canAfford`, which inflates — so affordable food
            * showed an unusable button. Every item row on this screen already
            * displays the inflated price; food is now consistent with them and
            * with what `buyFood` charges.
            */}
          <Text style={styles.itemPrice}>
            ${getInflatedPrice(food.price, gameState.economy?.priceIndex ?? 1).toFixed(2)}
          </Text>

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
              showInfo("Not enough money for this yet");
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

    // Refuse only when nothing would change: every stat gain clamps to zero AND
    // the gym-visit timer is already current. When the timer is stale the workout
    // still refreshes it (staving off accelerated fitness decay), so allow it.
    if (gymGainsAllZero && !gymTimerStale) return;

    if (gameState.stats.money < cost) return;
    if (gameState.stats.energy < energyCost) return;

    updateStats({
      money: -cost,
      energy: -energyCost,
      fitness: 5,
      health: 3,
      happiness: 2,
    });
    // Refresh the gym-visit timer so consistent sessions stave off the
    // accelerated fitness decay the weekly tick applies the longer you skip it.
    // (React batches this with the updateStats commit above — one render.)
    setGameState(prev => ({ ...prev, lastGymVisitWeek: prev.weeksLived || 0 }));
    // Persist the session — deferred one macrotask so the save captures the
    // post-commit state (repo convention). Untracked on purpose: the save must
    // survive even if the screen unmounts right after the tap.
    setTimeout(() => { void saveGame?.(); }, 0);
    // Effort → reward feedback, matching the food/buy paths on this screen. When
    // stats are already capped the session still counts — it keeps the routine up.
    showSuccess(gymGainsAllZero
      ? '💪 Workout done! Fitness routine maintained.'
      : '💪 Workout done! +5 Fitness, +3 Health');
  }, [hasMembership, gymGainsAllZero, gymTimerStale, gameState.stats.money, gameState.stats.energy, updateStats, setGameState, saveGame, showSuccess]);


  // (P1-8: scroll indicator layout block removed — see comment near the dead
  // scroll-indicator state above.)

  return (
    <View style={[styles.container, settings.darkMode && styles.containerDark]}>
      {/* Fixed Tab Bar. Embedded in the Life tab it renders as a subordinate
          (compact) control so it doesn't mirror the primary Health/Shop/Stats
          bar sitting just above it. */}
      <SegmentedControl
        style={embedded ? styles.marketTabsEmbedded : styles.marketTabs}
        compact={embedded}
        value={activeTab}
        onChange={setActiveTab}
        segments={[
          {
            key: 'items',
            label: t('market.items'),
            icon: ShoppingBag,
            accessory: (
              <InfoButton
                title="Market Items"
                content="Buy essential items to improve your life! Computer unlocks mobile apps, smartphone gives you access to banking and social features, and other items provide various benefits."
                size="small"
                darkMode={settings.darkMode}
              />
            ),
          },
          {
            key: 'food',
            label: t('market.food'),
            icon: Apple,
            accessory: (
              <InfoButton
                title="Food & Health"
                content="Buy food to restore your health and energy! Different foods provide different amounts of health and energy restoration. Keep your character healthy to avoid penalties!"
                size="small"
                darkMode={settings.darkMode}
              />
            ),
          },
          {
            // HOUSING. Renting used to live as tab 2 of the Real Estate app —
            // which is DESKTOP-ONLY (a $5,000 computer) and gated at tier 3
            // ("Finish Chapter 3"). So a player in their first 30 weeks, bleeding
            // vitals and with nowhere to live, could not see that housing
            // existed at all — even though a tenancy grants weekly health,
            // happiness and energy and carries an eviction failure state.
            // Market is always reachable, needs no device and has no tier gate,
            // which is what a week-1 survival need requires.
            key: 'housing',
            label: 'Housing',
            icon: Home,
            accessory: (
              <InfoButton
                title="Renting a Home"
                content="A home gives you weekly health, happiness and energy. Rent is charged every week — fall behind for too long and you'll be evicted. Moving between tiers is free, so upgrade whenever you can afford it."
                size="small"
                darkMode={settings.darkMode}
              />
            ),
          },
          {
            key: 'gym',
            label: t('market.gym'),
            icon: Dumbbell,
            accessory: (
              <InfoButton
                title="Gym Training"
                content="Train at the gym to increase your fitness, health, and happiness! Each session costs $50 and provides +5 fitness, +3 health, and +2 happiness. Higher fitness unlocks better career opportunities."
                size="small"
                darkMode={settings.darkMode}
              />
            ),
          },
        ]}
      />

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
          {/* Macro economy strip — a recession/boom/crash now affects prices,
              income, and markets, but was invisible outside buried sub-apps.
              Renders nothing in normal times. */}
          <EconomyEventBanner context="generic" />
          {activeTab === 'items' ? (
            <>
              <Text style={[styles.sectionDescription, settings.darkMode && styles.sectionDescriptionDark]}>
                {t('market.purchaseItems')}
              </Text>

              {/* Inflation indicator — surfaces the otherwise-invisible price index. */}
              {(gameState.economy?.priceIndex ?? 1) > 1.001 && (
                <View style={styles.inflationChip}>
                  <TrendingUp size={scale(12)} color={accent.amber} />
                  <Text style={styles.inflationChipText}>
                    Prices +{Math.round(((gameState.economy?.priceIndex ?? 1) - 1) * 100)}% from inflation
                  </Text>
                </View>
              )}

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
                      onPress={() => setActiveFilter(category.id)}
                      activeOpacity={0.7}
                    >
                      <IconComponent
                        size={scale(14)}
                        color={isActive ? '#FFFFFF' : 'rgba(226, 232, 240, 0.45)'}
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
                              : category.id === 'owned'
                                ? gameState.items.filter(item => item.owned).length
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
          ) : activeTab === 'housing' ? (
            <>
              <Text style={[styles.sectionDescription, settings.darkMode && styles.sectionDescriptionDark]}>
                A roof gives you weekly health, happiness and energy. Rent is charged every week.
              </Text>
              {listRentalOptions(gameState).map((option) => {
                const t2 = option.tier;
                const disabled = !option.current && !option.allowed;
                return (
                  <TouchableOpacity
                    key={t2.id}
                    activeOpacity={disabled ? 1 : 0.85}
                    onPress={() => {
                      if (option.current) {
                        const r = endRental(setGameState, gameState);
                        if (r.message) showInfo(r.message);
                        return;
                      }
                      if (disabled) {
                        showError(option.reason || 'You cannot rent this yet.');
                        return;
                      }
                      const r = rentHome(setGameState, gameState, t2.id);
                      if (r.success) showSuccess(r.message);
                      else showError(r.message);
                    }}
                    accessibilityRole="button"
                    accessibilityState={{ disabled, selected: option.current }}
                    accessibilityLabel={`${t2.name}, ${formatMoney(t2.weeklyRent)} per week`}
                    style={[
                      styles.gymCard,
                      {
                        // Full border on all four sides — Hard Rule #7.
                        borderWidth: 1,
                        borderColor: option.current
                          ? accent.success
                          : settings.darkMode ? 'rgba(255,255,255,0.10)' : 'rgba(0,0,0,0.08)',
                        opacity: disabled ? 0.55 : 1,
                        marginBottom: 10,
                      },
                    ]}
                  >
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                      {option.current ? <Check size={18} color={accent.success} /> : <Home size={18} color={accent.info} />}
                      <View style={{ flex: 1 }}>
                        <Text style={styles.gymCardTitle}>{t2.name}</Text>
                        <Text style={styles.gymCardSubtitle}>
                          {option.current
                            ? 'Your home — tap to move out'
                            : disabled
                              ? option.reason || 'Not available yet'
                              : `${formatMoney(t2.weeklyRent)} / week`}
                        </Text>
                      </View>
                    </View>
                  </TouchableOpacity>
                );
              })}
            </>
          ) : (
            <View style={styles.gymCard}>
              <View style={styles.gymCardHeader}>
                <View style={styles.gymIconContainer}>
                  <Dumbbell size={scale(22)} color={accent.info} />
                </View>
                <View style={styles.gymTitleContainer}>
                  <Text style={styles.gymCardTitle}>{t('market.gymSession')}</Text>
                  <Text style={styles.gymCardSubtitle}>
                    Current Fitness: {Math.floor(gameState.stats.fitness)}
                  </Text>
                </View>
              </View>

              {!hasMembership ? (
                <View style={styles.membershipWarningContainer}>
                  <Text style={styles.membershipWarningText}>Gym Membership Required</Text>
                  <Text style={styles.membershipWarningSubtext}>
                    Buy a Gym Membership from the Items tab to access the gym.
                  </Text>
                </View>
              ) : (
                <>
                  <View style={styles.gymStatsContainer}>
                    <View style={styles.gymStatChip}>
                      <Text style={[styles.gymStatValue, { color: accent.purple }]}>+5</Text>
                      <Text style={styles.gymStatLabel}>{t('game.fitness')}</Text>
                    </View>
                    <View style={styles.gymStatChip}>
                      <Text style={[styles.gymStatValue, { color: accent.success }]}>+3</Text>
                      <Text style={styles.gymStatLabel}>{t('game.health')}</Text>
                    </View>
                    <View style={styles.gymStatChip}>
                      <Text style={[styles.gymStatValue, { color: accent.warning }]}>+2</Text>
                      <Text style={styles.gymStatLabel}>{t('game.happiness')}</Text>
                    </View>
                  </View>

                  <View style={styles.gymCostRow}>
                    <Text style={styles.gymCostLabel}>Session Cost</Text>
                    <Text style={styles.gymCostValue}>$50 · 20 {t('game.energy')}</Text>
                  </View>

                  <TouchableOpacity
                    onPress={handleGym}
                    disabled={!canUseGym}
                    activeOpacity={0.85}
                    style={[styles.gymButton, !canUseGym && styles.gymButtonDisabled]}
                  >
                    <Text style={[styles.gymButtonText, !canUseGym && styles.gymButtonTextDisabled]}>
                      {gymGainsAllZero && !gymTimerStale ? "You're in top shape" :
                        gameState.stats.money < 50 ? t('market.notEnoughMoney') :
                          gameState.stats.energy < 20 ? t('market.notEnoughEnergy') :
                            t('market.startWorkout')}
                    </Text>
                  </TouchableOpacity>

                  <Text style={styles.gymTip}>
                    Consistent sessions raise fitness — which unlocks better jobs.
                  </Text>
                </>
              )}
            </View>
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
          message={`This will cost ${formatMoney(showPurchaseConfirm.price)}. You'll have ${formatMoney(gameState.stats.money - showPurchaseConfirm.price)} remaining.${showPurchaseConfirm.itemId === 'computer'
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
