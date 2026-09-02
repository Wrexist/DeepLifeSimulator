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
import { ShoppingBag, Apple, TrendingUp, Home, Check } from 'lucide-react-native';
import { getItemBadges, getUnlockDescription } from '@/utils/marketBadges';
import { useTranslation } from '@/hooks/useTranslation';
import { useToast } from '@/contexts/ToastContext';
import ConfirmDialog from '@/components/ConfirmDialog';
import LoadingButton from '@/components/ui/LoadingButton';
import CollapsibleSection from '@/components/ui/CollapsibleSection';
import { getTabBarSafePadding, scale } from '@/utils/scaling';
import { CRITICAL_VITAL } from '@/lib/config/hierarchy';
import { formatMoney } from '@/utils/moneyFormatting';
import { accent } from '@/lib/config/theme';
import { styles } from '@/components/market/marketScreenStyles';
import StatEffectChips from '@/components/market/StatEffectChips';
import EconomyEventBanner from '@/components/shared/EconomyEventBanner';
import ErrorBoundary from '@/components/ErrorBoundary';

function MarketScreen() {
  return (
    <ErrorBoundary>
      <MarketScreenContent />
    </ErrorBoundary>
  );
}

/**
 * One scrolling shop: Items → Food → Housing, under collapsible section
 * headers (the house pattern - persisted ids, live collapsed summaries).
 *
 * This replaces a 4-segment control that, embedded in the Life tab, stacked
 * directly under Life's own Health/Market/Stats control - 8 pills of chrome
 * before any content (UI overhaul audit, navigation problem #2). The Items
 * filter bar is gone with it: 4 chips filtering ~8 items, with a bespoke
 * empty-state escape because "Owned" reliably matched nothing on week 1.
 * Sections need neither - everything is on one shelf, reachable by scrolling.
 *
 * Gym is not here any more: a workout is an activity, not shopping, so the
 * card lives with the other activities on Health (components/health/GymCard).
 * The membership ITEM is still bought here.
 */
export function MarketScreenContent({ embedded = false }: { embedded?: boolean }) {
  const insets = useSafeAreaInsets();
  const { t } = useTranslation();
  const router = useRouter();
  // Redirects that run on this screen's first commit throw "Attempted to
  // navigate before mounting the Root Layout component" when this screen IS
  // the entry route (restored URL / deep link), which surfaces as the crash
  // screen. See hooks/useNavigationReady.ts.
  const navReady = useNavigationReady();
  const { gameState, setGameState, buyItem, sellItem, buyFood } = useGame();

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

  // Memoized data with stable sorting. No filtering: the filter bar offered
  // four chips over ~8 items and is deleted (audit finding #2).
  const sortedItems = useMemo(() =>
    [...(gameState.items || [])].sort((a, b) => {
      // Sort by price first, then by name for stability
      if (a.price !== b.price) return a.price - b.price;
      return a.name.localeCompare(b.name);
    }),
    [gameState.items]
  );

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

  const ownedCount = useMemo(
    () => (gameState.items || []).filter(item => item.owned).length,
    [gameState.items]
  );

  // Memoized render functions with proper dependencies
  const renderItem = useCallback(({ item }: { item: typeof gameState.items[0] }) => {
    const inflatedPrice = getItemPurchasePrice(item.price, gameState.economy?.priceIndex ?? 1, gameState.prestige?.unlockedBonuses);

    // At most ONE badge now - 'Recommended', plain text. The 5-type emoji
    // taxonomy (Best Value / You Can Afford! / Popular / …) is deleted
    // (audit finding #3): four of five said nothing the card didn't.
    const badges = getItemBadges(
      { id: item.id, name: item.name, price: item.price, owned: item.owned, description: item.description },
      {
        money: gameState.stats.money,
        ownsSmartphone: gameState.items.some(i => i.id === 'smartphone' && i.owned),
        ownsComputer: gameState.items.some(i => i.id === 'computer' && i.owned),
        hasGymMembership: gameState.items.some(i => i.id === 'gym_membership' && i.owned),
      }
    );

    // Get unlock description for feature items
    const unlockDesc = getUnlockDescription(item.id);

    return (
      <View key={item.id} style={[
        styles.itemCard,
        settings.darkMode && styles.itemCardDark,
        badges.length > 0 && styles.recommendedCard,
      ]}>
        <View style={styles.itemInfo}>
          {/* Badge Row */}
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

  // Pure and cheap over ~5 tiers; called once per render, used by both the
  // section body and the collapsed summary.
  const rentalOptions = listRentalOptions(gameState);
  const currentRental = rentalOptions.find((option) => option.current);

  const foodFirst = (gameState.stats?.energy ?? 100) <= CRITICAL_VITAL;

  const itemsSection = (
    <>
    {/* ITEMS */}
    <CollapsibleSection
      id="market.items"
      title={t('market.items')}
      icon={<ShoppingBag size={scale(15)} color={accent.info} />}
      tint={accent.info}
      summary={`${ownedCount}/${sortedItems.length} owned`}
    >
      <Text style={[styles.sectionDescription, settings.darkMode && styles.sectionDescriptionDark]}>
        {t('market.purchaseItems')}
      </Text>
      {sortedItems.map((item) => renderItem({ item }))}
    </CollapsibleSection>

    </>
  );

  const foodSection = (
    <>
    {/* FOOD */}
    <CollapsibleSection
      id="market.food"
      title={t('market.food')}
      icon={<Apple size={scale(15)} color="#34D399" />}
      tint="#34D399"
      summary={`${sortedFoods.length} meals`}
    >
      {foodFirst && (
        <Text style={styles.leadNote}>Energy is critical - eat before anything else.</Text>
      )}
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
    </CollapsibleSection>

    </>
  );

  return (
    <View style={[styles.container, settings.darkMode && styles.containerDark]}>
      {/* Scrollable Content - one list, three sections, no sub-tab bar. */}
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

          {/* Inflation indicator - surfaces the otherwise-invisible price index.
              At the top of the list because it moves EVERY price below it,
              food and housing included, not just the items. */}
          {(gameState.economy?.priceIndex ?? 1) > 1.001 && (
            <View style={styles.inflationChip}>
              <TrendingUp size={scale(12)} color={accent.amber} />
              <Text style={styles.inflationChipText}>
                Prices +{Math.round(((gameState.economy?.priceIndex ?? 1) - 1) * 100)}% from inflation
              </Text>
            </View>
          )}

          {/* FOOD LEADS WHEN ENERGY IS CRITICAL. Three sections of identical
              weight in a fixed order told a player running on empty to look
              at gym memberships first. The one state this screen can answer
              picks the order; nothing else about the sections changes, and
              their collapse state is remembered per id either way. */}
          {foodFirst ? foodSection : itemsSection}
          {foodFirst ? itemsSection : foodSection}

          {/* HOUSING. Renting used to live as tab 2 of the Real Estate app -
              which is DESKTOP-ONLY (a $5,000 computer) and gated at tier 3
              ("Finish Chapter 3"). So a player in their first 30 weeks, bleeding
              vitals and with nowhere to live, could not see that housing
              existed at all - even though a tenancy grants weekly health,
              happiness and energy and carries an eviction failure state.
              Market is always reachable, needs no device and has no tier gate,
              which is what a week-1 survival need requires. */}
          <CollapsibleSection
            id="market.housing"
            title="Housing"
            icon={<Home size={scale(15)} color="#60A5FA" />}
            tint="#60A5FA"
            summary={currentRental ? currentRental.tier.name : 'Not renting'}
          >
            <Text style={[styles.sectionDescription, settings.darkMode && styles.sectionDescriptionDark]}>
              A roof gives you weekly health, happiness and energy. Rent is charged every week.
            </Text>
            {rentalOptions.map((option) => {
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
                    styles.housingCard,
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
                      <Text style={styles.housingCardTitle}>{t2.name}</Text>
                      <Text style={styles.housingCardSubtitle}>
                        {option.current
                          ? 'Your home - tap to move out'
                          : disabled
                            ? option.reason || 'Not available yet'
                            : `${formatMoney(t2.weeklyRent)} / week`}
                      </Text>
                      {/* A tenancy's whole point is the weekly stat grant, and
                          the card never showed it - the same chips the food
                          cards use say it in one line. */}
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
          </CollapsibleSection>
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
