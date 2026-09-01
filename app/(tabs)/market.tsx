import React, { useState, useCallback, useMemo, useEffect } from 'react';
import { View, Text, TouchableOpacity, ScrollView } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useNavigationReady } from '@/hooks/useNavigationReady';
import { useGame } from '@/contexts/GameContext';
import { listRentalOptions, rentHome, endRental } from '@/contexts/game/actions/RentalActions';
import { getInflatedPrice } from '@/lib/economy/inflation';
import { satietyHint } from '@/lib/economy/foodSatiety';
import { getItemPurchasePrice } from '@/lib/economy/itemPricing';
import { ShoppingBag, Dumbbell, Apple, Smartphone, Heart, Layers, Package, TrendingUp, Home, Check } from 'lucide-react-native';
import { getItemBadges, getUnlockDescription } from '@/utils/marketBadges';
import { useTranslation } from '@/hooks/useTranslation';
import { useToast } from '@/contexts/ToastContext';
import ConfirmDialog from '@/components/ConfirmDialog';
import LoadingButton from '@/components/ui/LoadingButton';
import InfoButton from '@/components/ui/InfoButton';
import { getTabBarSafePadding, scale } from '@/utils/scaling';
import { clampStat, clampStatByKey } from '@/utils/statUtils';
import { formatMoney } from '@/utils/moneyFormatting';
import { accent } from '@/lib/config/theme';
import { styles } from '@/components/market/marketScreenStyles';
import StatEffectChips from '@/components/market/StatEffectChips';
import SegmentedControl from '@/components/ui/SegmentedControl';
import EconomyEventBanner from '@/components/shared/EconomyEventBanner';
import ErrorBoundary from '@/components/ErrorBoundary';

// Item category mapping - outside component for stability
//
// The eight dark-web ids that used to sit here (`gloves`, `usb`, `lockpick`,
// `slim_jim`, `drill_kit`, `explosives`, `crowbar`, `drug_supply`) are gone.
// They were unreachable in three separate ways: they live in
// `gameState.darkWebItems`, this screen only ever renders `gameState.items`,
// and `FILTER_CATEGORIES` has no 'crime' chip to select them with. They also
// cost BTC, not dollars, so they could never have been bought here.
// The gear store now lives in the Onion app's Gear tab, which spends BTC.
const ITEM_CATEGORIES: Record<string, 'electronics' | 'lifestyle'> = {
  smartphone: 'electronics',
  computer: 'electronics',
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

type MarketTab = 'items' | 'food' | 'gym' | 'housing';

// Help text, one entry per tab. This used to live as a per-segment `accessory`
// InfoButton inside the tab bar - four "?" badges competing with four labels.
// The copy is unchanged; only the affordance moved (one button beside the row,
// showing the active tab's entry).
const TAB_INFO: Record<MarketTab, { title: string; content: string }> = {
  items: {
    title: 'Market Items',
    content: "Buy essential items to improve your life! Computer unlocks mobile apps, smartphone gives you access to banking and social features, and other items provide various benefits.",
  },
  food: {
    title: 'Food & Health',
    content: 'Buy food to restore your health and energy! Different foods provide different amounts of health and energy restoration. Keep your character healthy to avoid penalties!',
  },
  housing: {
    title: 'Renting a Home',
    content: "A home gives you weekly health, happiness and energy. Rent is charged every week - fall behind for too long and you'll be evicted. Moving between tiers is free, so upgrade whenever you can afford it.",
  },
  gym: {
    title: 'Gym Training',
    content: 'Train at the gym to increase your fitness, health, and happiness! Each session costs $50 and provides +5 fitness, +3 health, and +2 happiness. Higher fitness unlocks better career opportunities.',
  },
};

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
  const [activeTab, setActiveTab] = useState<MarketTab>('items');
  const { gameState, setGameState, buyItem, sellItem, buyFood, saveGame } = useGame();

  // Prevent staying on market screen when in prison - redirect to work tab.
  // Embedded (inside the Life tab) the layout owns the jail redirect, so skip it.
  useEffect(() => {
    if (embedded || !navReady) return;
    if (gameState.jailWeeks > 0) {
      router.replace('/(tabs)/work');
    }
  }, [embedded, navReady, gameState.jailWeeks, router]);
  const { settings } = gameState;
  const { showSuccess, showError, showInfo } = useToast();
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
      const itemPrice = item ? getItemPurchasePrice(item.price, gameState.economy?.priceIndex ?? 1, gameState.prestige?.unlockedBonuses) : 0;
      if (!item || gameState.stats.money < itemPrice) {
        // Not an error - just a normal "you need more money" state. Use the
        // calmer info toast instead of the alarming red error toast.
        showInfo("Not enough money for this yet");
        setLoading(itemId, false);
        return;
      }

      // P2-8: buyItem applies its money + ownership change synchronously via
      // setGameState (and re-checks affordability atomically). Affordability is
      // already gated above, so confirm immediately - no arbitrary delay/jank.
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
      // here) BEFORE selling, then sell synchronously - no arbitrary delay, and
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



  // P1-8: scroll-indicator state was dead - the setters had been renamed with
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
  // FOOD affordability: plain inflated price - `buyFood` charges exactly this
  // (ItemActionsContext), and the Premium Access discount is an ITEM-shop
  // effect, so gating food on the discounted figure would let the gate pass a
  // price the charge then rejects.
  const canAfford = useCallback((price: number) => gameState.stats.money >= getInflatedPrice(price, gameState.economy?.priceIndex ?? 1), [gameState.stats.money, gameState.economy?.priceIndex]);
  // ITEM affordability: inflation × the prestige Premium Access discount - the
  // same helper buyItem charges with, so the card and the charge agree (§4.4).
  const canAffordItem = useCallback((price: number) => gameState.stats.money >= getItemPurchasePrice(price, gameState.economy?.priceIndex ?? 1, gameState.prestige?.unlockedBonuses), [gameState.stats.money, gameState.economy?.priceIndex, gameState.prestige?.unlockedBonuses]);
  const hasMembership = useMemo(() => {
    return gameState.items.find(item => item.id === 'gym_membership')?.owned || false;
  }, [gameState.items]);

  // Zero-gain guard: the $50 session grants +5 fitness / +3 health / +2 happiness.
  // When all three already sit at the cap every gain clamps to zero, so the visit
  // would charge money + energy for nothing. Compute the clamped deltas and treat
  // "all zero" as "already in top shape".
  const gymGainsAllZero = useMemo(() => {
    // Normalize first: a NaN/undefined stat on a corrupted save makes every
    // delta NaN, and `NaN <= 0` is false - the guard's answer would flip on
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
  // tappable - otherwise a peak-shape player silently suffers accelerated decay.
  const gymTimerStale = useMemo(
    () => (gameState.lastGymVisitWeek || 0) !== (gameState.weeksLived || 0),
    [gameState.lastGymVisitWeek, gameState.weeksLived]
  );

  const canUseGym = useMemo(() => {
    return hasMembership && gameState.stats.money >= 50 && gameState.stats.energy >= 20 && (!gymGainsAllZero || gymTimerStale);
  }, [hasMembership, gameState.stats.money, gameState.stats.energy, gymGainsAllZero, gymTimerStale]);

  // Memoized render functions with proper dependencies
  const renderItem = useCallback(({ item }: { item: typeof gameState.items[0] }) => {
    const inflatedPrice = getItemPurchasePrice(item.price, gameState.economy?.priceIndex ?? 1, gameState.prestige?.unlockedBonuses);

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
          {/* Raw interpolation printed "$20000" beside rows whose own confirm
              dialog already said "$20K" - this file imports `formatMoney` and
              uses it for rents and the purchase dialog. One convention. */}
          <Text style={styles.itemPrice}>{formatMoney(inflatedPrice)}</Text>
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
            title={`Sell (${formatMoney(getInflatedPrice(item.price, gameState.economy?.priceIndex ?? 1) * 0.5)})`}
            loading={loadingStates[item.id] || false}
            variant="secondary"
            size="small"
            style={styles.sellButton}
            loadingText="Selling..."
          />
        ) : (
          <LoadingButton
            onPress={() => {
              const itemPrice = getItemPurchasePrice(item.price, gameState.economy?.priceIndex ?? 1, gameState.prestige?.unlockedBonuses);

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
            disabled={!canAffordItem(item.price)}
            variant="success"
            size="small"
            style={styles.buyButton}
            loadingText="Buying..."
          />
        )}
      </View>
    );
  }, [settings.darkMode, gameState.economy?.priceIndex, gameState.prestige?.unlockedBonuses, gameState.items, loadingStates, canAffordItem, handleSell, handlePurchase, showError, showSuccess, showInfo, setShowSellConfirm, setShowPurchaseConfirm]);

  const renderFood = useCallback(({ item: food }: { item: typeof gameState.foods[0] }) => {
    // Calculate happiness restore based on food quality (healthRestore / 2, rounded, minimum 1)
    const happinessRestore = Math.max(1, Math.round(food.healthRestore / 2));

    return (
      <View key={food.id} style={[styles.itemCard, settings.darkMode && styles.itemCardDark]}>
        <View style={styles.itemInfo}>
          <Text style={[styles.itemName, settings.darkMode && styles.itemNameDark]}>{food.name}</Text>
          {/**
            * F5. This printed the RAW price while the button beside it was
            * disabled off `canAfford`, which inflates - so affordable food
            * showed an unusable button. Every item row on this screen already
            * displays the inflated price; food is now consistent with them and
            * with what `buyFood` charges.
            */}
          <Text style={styles.itemPrice}>
            {formatMoney(getInflatedPrice(food.price, gameState.economy?.priceIndex ?? 1))}
          </Text>

          {/* One chip per stat, in the HUD's own colors - see
              components/market/StatEffectChips.tsx. The three identical blue
              lines this replaces gave the player no way to tell at a glance
              which bar a card feeds. */}
          <StatEffectChips
            caption={t('market.restores')}
            darkMode={settings.darkMode}
            effects={[
              { key: 'health', value: food.healthRestore },
              { key: 'energy', value: food.energyRestore },
              { key: 'happiness', value: happinessRestore },
            ]}
          />
        </View>

        <LoadingButton
          onPress={() => {
            if (canAfford(food.price)) {
              // The toast reports what the purchase ACTUALLY applied - the
              // satiety curve (v48) scales restores down after the third meal
              // of the week, and a toast quoting the catalogue values would be
              // the advertised-vs-actual bug all over again.
              const result = buyFood(food.id);
              if (result.success && result.applied) {
                // One short line. The full-strength toast lists the restores;
                // once satiety kicks in, the STATE is the news (the standing
                // section hint carries the detail), so the toast leads with it
                // instead of overflowing into a truncated "until next..." tail
                // (screenshot report, 2026-08-24).
                showSuccess(
                  result.hint
                    ? `Ate ${food.name}. ${result.hint}`
                    : `Ate ${food.name}! +${result.applied.health} health, +${result.applied.happiness} happiness, +${result.applied.energy} energy`
                );
              }
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

    // The gate the PLAYER is told about, read from the committed snapshot. It is
    // a fast path for messaging only - the authoritative check is against `prev`
    // inside the updater below.
    if (gameState.stats.money < cost) return;
    if (gameState.stats.energy < energyCost) return;

    // Charge, grant and stamp the timer in ONE updater, re-checked against
    // `prev`. Two taps in the same React batch both read the same stale
    // `gameState` above and both pass, and `disabled={!canUseGym}` cannot help
    // because it is derived from that same render. What made that a real
    // exploit rather than a harmless overdraw is the clamping: `updateStats`
    // routes money through `sanitizeAmount`, which turns anything <= 0 into 0,
    // and energy through `clampStat`, which floors at 0. So the second workout
    // charged NOTHING and still paid out +5 fitness / +3 health / +2 happiness.
    // Charging against `prev` refuses it instead of forgiving the debt and
    // granting anyway. Same discipline as the quick actions in TopStatsBar.
    setGameState(prev => {
      const st = prev.stats;
      if ((st?.money ?? 0) < cost || (st?.energy ?? 0) < energyCost) return prev;
      return {
        ...prev,
        // Refresh the gym-visit timer so consistent sessions stave off the
        // accelerated fitness decay the weekly tick applies the longer you skip it.
        lastGymVisitWeek: prev.weeksLived || 0,
        stats: {
          ...st,
          money: clampStatByKey('money', (st.money ?? 0) - cost),
          energy: clampStatByKey('energy', (st.energy ?? 0) - energyCost),
          fitness: clampStatByKey('fitness', (st.fitness ?? 0) + 5),
          health: clampStatByKey('health', (st.health ?? 0) + 3),
          happiness: clampStatByKey('happiness', (st.happiness ?? 0) + 2),
        },
      };
    });
    // Persist the session - deferred one macrotask so the save captures the
    // post-commit state (repo convention). Untracked on purpose: the save must
    // survive even if the screen unmounts right after the tap.
    setTimeout(() => { void saveGame?.(); }, 0);
    // Effort → reward feedback, matching the food/buy paths on this screen. When
    // stats are already capped the session still counts - it keeps the routine up.
    showSuccess(gymGainsAllZero
      ? '💪 Workout done! Fitness routine maintained.'
      : '💪 Workout done! +5 Fitness, +3 Health');
  }, [hasMembership, gymGainsAllZero, gymTimerStale, gameState.stats.money, gameState.stats.energy, setGameState, saveGame, showSuccess]);


  // (P1-8: scroll indicator layout block removed - see comment near the dead
  // scroll-indicator state above.)

  return (
    <View style={[styles.container, settings.darkMode && styles.containerDark]}>
      {/* Fixed tab bar. Embedded in the Life tab it renders as a subordinate
          (compact) control so it doesn't mirror the primary Health/Shop/Stats
          bar sitting just above it.

          ONE info button for the row, not four. Every segment used to carry its
          own "?" accessory inside the tab, which (a) competed with the label for
          the eye and (b) ate 24pt of each slot - with four segments in the
          compact embedded bar that truncated the labels themselves. The single
          button sits outside the control and describes whichever tab is active,
          so no help text was lost.

          The row also has a solid background and its own bottom gap: the bar is
          translucent and there is no backdrop blur on native, so scrolled
          content used to ghost straight through it and the section header below
          read as sliding under the tabs. */}
      <View style={[styles.tabsRow, embedded && styles.tabsRowEmbedded]}>
        <SegmentedControl
          style={styles.tabsControl}
          compact={embedded}
          value={activeTab}
          onChange={setActiveTab}
          segments={[
            { key: 'items', label: t('market.items'), icon: ShoppingBag },
            { key: 'food', label: t('market.food'), icon: Apple },
            // HOUSING. Renting used to live as tab 2 of the Real Estate app -
            // which is DESKTOP-ONLY (a $5,000 computer) and gated at tier 3
            // ("Finish Chapter 3"). So a player in their first 30 weeks, bleeding
            // vitals and with nowhere to live, could not see that housing
            // existed at all - even though a tenancy grants weekly health,
            // happiness and energy and carries an eviction failure state.
            // Market is always reachable, needs no device and has no tier gate,
            // which is what a week-1 survival need requires.
            { key: 'housing', label: 'Housing', icon: Home },
            { key: 'gym', label: t('market.gym'), icon: Dumbbell },
          ]}
        />
        {/* Keyed on the active tab so the modal's copy follows the tab. */}
        <InfoButton
          key={activeTab}
          title={TAB_INFO[activeTab].title}
          content={TAB_INFO[activeTab].content}
          size="small"
          darkMode={settings.darkMode}
        />
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
          {/* Macro economy strip - a recession/boom/crash now affects prices,
              income, and markets, but was invisible outside buried sub-apps.
              Renders nothing in normal times. */}
          <EconomyEventBanner context="generic" />
          {activeTab === 'items' ? (
            <>
              <Text style={[styles.sectionDescription, settings.darkMode && styles.sectionDescriptionDark]}>
                {t('market.purchaseItems')}
              </Text>

              {/* Inflation indicator - surfaces the otherwise-invisible price index. */}
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

              {sortedItems.length === 0 ? (
                <View style={styles.emptyState}>
                  <Package size={scale(40)} color="rgba(226, 232, 240, 0.45)" />
                  {/* A chip that matches nothing used to render dead space under
                      the filter bar - "Owned" does that on week 1 for every new
                      character. Name the dead end and offer the way out. */}
                  <Text style={styles.emptyStateTitle}>
                    {activeFilter === 'owned' ? "You don't own anything yet" : 'Nothing here'}
                  </Text>
                  <Text style={styles.emptyStateText}>
                    {activeFilter === 'owned'
                      ? 'Buy something from All, Electronics or Lifestyle and it will show up here.'
                      : 'No items in this category yet.'}
                  </Text>
                  {activeFilter !== 'all' && (
                    <TouchableOpacity
                      onPress={() => setActiveFilter('all')}
                      accessibilityRole="button"
                      accessibilityLabel="Show all items"
                    >
                      <Text style={styles.emptyStateAction}>Show all items</Text>
                    </TouchableOpacity>
                  )}
                </View>
              ) : (
                sortedItems.map((item) => renderItem({ item }))
              )}
            </>
          ) : activeTab === 'food' ? (
            <>
              <Text style={[styles.sectionDescription, settings.darkMode && styles.sectionDescriptionDark]}>
                {t('market.buyFood')}
              </Text>
              {/* Satiety state (v48) - shown BEFORE buying, so a reduced
                  restore is never a surprise on the receipt. Absent at full
                  strength, which is the normal state. */}
              {!!satietyHint(gameState.weeklyFoodPurchases) && (
                <Text style={[styles.sectionDescription, settings.darkMode && styles.sectionDescriptionDark, { fontStyle: 'italic' }]}>
                  {satietyHint(gameState.weeklyFoodPurchases)}
                </Text>
              )}
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
                        // Full border on all four sides - Hard Rule #7.
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
                            ? 'Your home - tap to move out'
                            : disabled
                              ? option.reason || 'Not available yet'
                              : `${formatMoney(t2.weeklyRent)} / week`}
                        </Text>
                        {/* A tenancy's whole point is the weekly stat grant, and
                            the card never showed it - the same chips the food
                            and gym cards use say it in one line. */}
                        <StatEffectChips
                          caption="Per week"
                          darkMode={settings.darkMode}
                          effects={[
                            { key: 'health', value: t2.health },
                            { key: 'energy', value: t2.energy },
                            { key: 'happiness', value: t2.happiness },
                          ]}
                        />
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
                  {/* Same chip row as the food cards - the gym's three big
                      number tiles said the same thing in a third visual
                      language, and coloured health green while the HUD's
                      health bar is red. */}
                  <StatEffectChips
                    caption="Per session"
                    darkMode={settings.darkMode}
                    effects={[
                      { key: 'fitness', value: 5 },
                      { key: 'health', value: 3 },
                      { key: 'happiness', value: 2 },
                    ]}
                  />

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
                    Consistent sessions raise fitness - which unlocks better jobs.
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
            // Same value the Sell button prints, so the two must format the
            // same way - raw interpolation here read "$2500.5" under a button
            // saying "$2.5K".
            showSellConfirm.itemId === 'computer'
              ? `Are you sure you want to sell your ${showSellConfirm.itemName} for ${formatMoney(showSellConfirm.price)}?\n\nDon't worry - all your data (crypto, stocks, real estate, etc.) will be preserved and restored if you buy another computer later.`
              : showSellConfirm.itemId === 'smartphone'
                ? `Are you sure you want to sell your ${showSellConfirm.itemName} for ${formatMoney(showSellConfirm.price)}?\n\nYou'll lose access to all mobile apps until you buy another phone.`
                : `Are you sure you want to sell ${showSellConfirm.itemName} for ${formatMoney(showSellConfirm.price)}?`
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
