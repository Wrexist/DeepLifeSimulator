import React, { useState, useCallback, useMemo, useRef, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Animated } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { useGame } from '@/contexts/GameContext';
import { getInflatedPrice } from '@/lib/economy/inflation';
import { ShoppingBag, Dumbbell, Apple, Smartphone, Skull, Heart, Layers } from 'lucide-react-native';
import { OptimizedFlatList } from '@/components/OptimizedFlatList';
import { useTranslation } from '@/hooks/useTranslation';
import { useTutorialHighlight } from '@/contexts/TutorialHighlightContext';
import { useToast } from '@/contexts/ToastContext';
import ConfirmDialog from '@/components/ConfirmDialog';
import LoadingButton from '@/components/ui/LoadingButton';
import InfoButton from '@/components/ui/InfoButton';

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
  { id: 'crime', label: 'Crime', icon: Skull, color: '#EF4444' },
  { id: 'lifestyle', label: 'Lifestyle', icon: Heart, color: '#10B981' },
] as const;

export default function MarketScreen() {
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
  const { highlightedItem, highlightMessage, clearHighlight } = useTutorialHighlight();
  const { settings } = gameState;
  const { showSuccess, showError, showInfo } = useToast();
  const flatListRef = useRef<any>(null);
  const [showSellConfirm, setShowSellConfirm] = useState<{ itemId: string; itemName: string; price: number } | null>(null);
  const [showPurchaseConfirm, setShowPurchaseConfirm] = useState<{ itemId: string; itemName: string; price: number } | null>(null);
  const [loadingStates, setLoadingStates] = useState<{ [key: string]: boolean }>({});
  const [activeFilter, setActiveFilter] = useState<'all' | 'electronics' | 'crime' | 'lifestyle'>('all');

  const setLoading = (key: string, loading: boolean) => {
    setLoadingStates(prev => ({ ...prev, [key]: loading }));
  };

  const handlePurchase = async (itemId: string, itemName: string) => {
    setLoading(itemId, true);
    try {
      // Simulate network delay for realistic feel
      await new Promise(resolve => setTimeout(resolve, 500));
      
      // Check if player can still afford it (in case something changed)
      const item = gameState.items.find(i => i.id === itemId);
      if (!item || !canAfford(item.price)) {
        showError("Can't afford this item");
        setLoading(itemId, false);
        return;
      }
      
      // buyItem doesn't return a value, so we check if the purchase worked by checking if item is owned after
      buyItem(itemId);
      
      // Give a small delay for state to update
      await new Promise(resolve => setTimeout(resolve, 100));
      
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
      await new Promise(resolve => setTimeout(resolve, 300));
      
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
  
  // Scroll indicator state
  const scrollY = useRef(new Animated.Value(0)).current;
  const [contentHeight, setContentHeight] = useState(0);
  const [scrollViewHeight, setScrollViewHeight] = useState(0);

  // Memoized data with stable sorting and filtering
  const sortedItems = useMemo(() => {
    const filtered = activeFilter === 'all' 
      ? [...gameState.items]
      : [...gameState.items].filter(item => ITEM_CATEGORIES[item.id] === activeFilter);
    
    return filtered.sort((a, b) => {
      // Sort by price first, then by name for stability
      if (a.price !== b.price) return a.price - b.price;
      return a.name.localeCompare(b.name);
    });
  }, [gameState.items, activeFilter]);
  
  const sortedFoods = useMemo(() => 
    [...gameState.foods].sort((a, b) => {
      // Sort by price first, then by name for stability
      if (a.price !== b.price) return a.price - b.price;
      return a.name.localeCompare(b.name);
    }), 
    [gameState.foods]
  );
  
  // Memoize canAfford function
  const canAfford = useCallback((price: number) => gameState.stats.money >= price, [gameState.stats.money]);
  const canUseGym = useMemo(() => gameState.stats.money >= 50 && gameState.stats.energy >= 20, [gameState.stats.money, gameState.stats.energy]);

  // Auto-switch to items tab if tutorial is highlighting an item
  React.useEffect(() => {
    if (highlightedItem && highlightedItem !== 'stock-app') {
      setActiveTab('items');
      // Scroll to highlighted item after a delay
      setTimeout(() => {
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
    }
  }, [highlightedItem, sortedItems]);

  // Memoized render functions with proper dependencies
  const renderItem = useCallback(({ item }: { item: typeof gameState.items[0] }) => {
    const isHighlighted = highlightedItem === item.id;
    
    return (
      <View key={item.id} style={[
        styles.itemCard, 
        settings.darkMode && styles.itemCardDark,
        isHighlighted && styles.highlightedCard
      ]}>
        <View style={styles.itemInfo}>
          <Text style={[styles.itemName, settings.darkMode && styles.itemNameDark]}>{item.name}</Text>
          {item.description && (
            <Text style={[styles.itemDescription, settings.darkMode && styles.itemDescriptionDark]}>
              {item.description}
            </Text>
          )}
          <Text style={styles.itemPrice}>${item.price}</Text>
          
          {item.weeklyBonus && (
            <View style={styles.bonusInfo}>
              <Text style={[styles.bonusTitle, settings.darkMode && styles.bonusTitleDark]}>{t('market.weeklyBonus')}</Text>
              {Object.entries(item.weeklyBonus).map(([stat, bonus]) => (
                <Text key={stat} style={[styles.bonusText, settings.darkMode && styles.bonusTextDark]}>
                  +{String(bonus)} {stat.charAt(0).toUpperCase() + stat.slice(1)}
                </Text>
              ))}
            </View>
          )}
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
              if (!canAfford(item.price)) {
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

    if (gameState.stats.money < cost) return;
    if (gameState.stats.energy < energyCost) return;

    updateStats({
      money: -cost,
      energy: -energyCost,
      fitness: 5,
      health: 3,
      happiness: 2,
    });
  }, [gameState.stats.money, gameState.stats.energy, updateStats]);


  // Calculate scroll indicator position
  const scrollIndicatorHeight = Math.max(20, (scrollViewHeight / contentHeight) * scrollViewHeight);
  const scrollIndicatorTop = contentHeight > scrollViewHeight 
    ? (scrollY._value / (contentHeight - scrollViewHeight)) * (scrollViewHeight - scrollIndicatorHeight)
    : 0;

    return (
      <View style={[styles.container, settings.darkMode && styles.containerDark]}>
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

        <View style={[styles.content, settings.darkMode && styles.contentDark]}>
          {activeTab === 'items' ? (
            <View style={{ flex: 1 }}>
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

              <OptimizedFlatList
                ref={flatListRef}
                data={sortedItems}
                renderItem={renderItem}
                itemHeight={120}
                contentContainerStyle={{ paddingBottom: 20 + insets.bottom }}
                showsVerticalScrollIndicator={true}
                removeClippedSubviews={true}
                maxToRenderPerBatch={5}
                windowSize={5}
                initialNumToRender={3}
              />
            </View>
          ) : activeTab === 'food' ? (
            <View style={{ flex: 1 }}>
              <Text style={[styles.sectionDescription, settings.darkMode && styles.sectionDescriptionDark]}>
                {t('market.buyFood')}
              </Text>
              <OptimizedFlatList
                data={sortedFoods}
                renderItem={renderFood}
                itemHeight={100}
                contentContainerStyle={{ paddingBottom: 20 + insets.bottom }}
                showsVerticalScrollIndicator={true}
                removeClippedSubviews={true}
                maxToRenderPerBatch={5}
                windowSize={5}
                initialNumToRender={3}
              />
            </View>
        ) : (
          <View style={{ flex: 1, position: 'relative' }}>
            <ScrollView
              style={{ flex: 1 }}
              contentContainerStyle={{ paddingBottom: 20 + insets.bottom }}
              showsVerticalScrollIndicator={false}
              onScroll={Animated.event(
                [{ nativeEvent: { contentOffset: { y: scrollY } } }],
                { useNativeDriver: false }
              )}
              onContentSizeChange={(width, height) => setContentHeight(height)}
              onLayout={(event) => setScrollViewHeight(event.nativeEvent.layout.height)}
              scrollEventThrottle={16}
            >
              <Text style={[styles.sectionDescription, settings.darkMode && styles.sectionDescriptionDark]}>
                {t('market.trainGym')}
              </Text>

              <View style={[styles.gymCard, settings.darkMode && styles.gymCardDark]}>
                <View style={styles.gymHeader}>
                  <Dumbbell size={32} color="#3B82F6" />
                  <Text style={[styles.gymTitle, settings.darkMode && styles.gymTitleDark]}>{t('market.gymSession')}</Text>
                </View>

                <Text style={[styles.currentFitness, settings.darkMode && styles.currentFitnessDark]}>
                  {t('market.currentFitness')} {gameState.stats.fitness}
                </Text>

                <Text style={[styles.gymDescription, settings.darkMode && styles.gymDescriptionDark]}>
                  {t('market.gymDescription')}
                </Text>

                <View style={[styles.gymBenefits, settings.darkMode && styles.gymBenefitsDark]}>
                  <Text style={[styles.benefitsTitle, settings.darkMode && styles.benefitsTitleDark]}>{t('market.benefitsPerSession')}</Text>
                  <Text style={[styles.benefit, settings.darkMode && styles.benefitDark]}>+5 {t('game.fitness')}</Text>
                  <Text style={[styles.benefit, settings.darkMode && styles.benefitDark]}>+3 {t('game.health')}</Text>
                  <Text style={[styles.benefit, settings.darkMode && styles.benefitDark]}>+2 {t('game.happiness')}</Text>
                </View>

                <View style={[styles.gymCost, settings.darkMode && styles.gymCostDark]}>
                  <Text style={[styles.costTitle, settings.darkMode && styles.costTitleDark]}>{t('market.cost')}</Text>
                  <Text style={styles.cost}>$50 + 20 {t('game.energy')}</Text>
                </View>

                <LoadingButton
                  onPress={handleGym}
                  disabled={!canUseGym}
                  title={
                    gameState.stats.money < 50 ? t('market.notEnoughMoney') :
                    gameState.stats.energy < 20 ? t('market.notEnoughEnergy') :
                    t('market.startWorkout')
                  }
                  variant="primary"
                  size="medium"
                  style={styles.gymButton}
                />
              </View>

              {/* Additional gym content to make it scrollable */}
              <View style={[styles.gymCard, settings.darkMode && styles.gymCardDark]}>
                <Text style={[styles.gymTitle, settings.darkMode && styles.gymTitleDark]}>💪 Workout Tips</Text>
                <Text style={[styles.gymDescription, settings.darkMode && styles.gymDescriptionDark]}>
                  • Warm up before exercising to prevent injuries{'\n'}
                  • Stay hydrated during your workout{'\n'}
                  • Listen to your body and don't overexert yourself{'\n'}
                  • Consistency is key - regular workouts are better than intense sporadic sessions{'\n'}
                  • Mix cardio and strength training for best results{'\n'}
                  • Get enough rest between workout sessions{'\n'}
                  • Proper nutrition fuels your fitness journey
                </Text>
              </View>

              <View style={[styles.gymCard, settings.darkMode && styles.gymCardDark]}>
                <Text style={[styles.gymTitle, settings.darkMode && styles.gymTitleDark]}>🏆 Fitness Goals</Text>
                <Text style={[styles.gymDescription, settings.darkMode && styles.gymDescriptionDark]}>
                  Set realistic fitness goals and track your progress. Remember that fitness is a journey, not a destination. Every workout session brings you closer to your goals!
                </Text>
              </View>
            </ScrollView>

            {/* Scroll Indicator */}
            {contentHeight > scrollViewHeight && (
              <View style={styles.scrollIndicatorContainer}>
                <View style={[styles.scrollBar, settings.darkMode && styles.scrollBarDark]}>
                  <Animated.View
                    style={[
                      styles.scrollThumb,
                      settings.darkMode && styles.scrollThumbDark,
                      {
                        height: scrollIndicatorHeight,
                        transform: [{ translateY: scrollIndicatorTop }]
                      }
                    ]}
                  />
                </View>
              </View>
            )}
          </View>
        )}
      </View>

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
          message={`This will cost $${showPurchaseConfirm.price}. You'll have $${Math.floor(gameState.stats.money - showPurchaseConfirm.price)} remaining.${
            showPurchaseConfirm.itemId === 'computer' 
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
          type="info"
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  containerDark: {
    backgroundColor: '#111827',
  },
  tabContainer: {
    flexDirection: 'row',
    backgroundColor: '#F3F4F6',
    margin: 20,
    borderRadius: 8,
    padding: 4,
  },
  tabWithInfo: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  tabContainerDark: {
    backgroundColor: '#1F2937',
  },
  tab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    borderRadius: 6,
  },
  activeTab: {
    backgroundColor: '#3B82F6',
  },
  tabText: {
    fontSize: 12,
    fontWeight: '500',
    color: '#6B7280',
    marginLeft: 4,
    textShadowColor: 'rgba(0, 0, 0, 0.75)',
    textShadowOffset: { width: -1, height: 1 },
    textShadowRadius: 2,
  },
  tabTextDark: {
    color: '#FFFFFF',
    textShadowColor: 'rgba(0, 0, 0, 0.75)',
    textShadowOffset: { width: -1, height: 1 },
    textShadowRadius: 2,
  },
  activeTabText: {
    color: '#FFFFFF',
  },
  content: {
    flex: 1,
    paddingHorizontal: 20,
  },
  contentDark: {},
  sectionDescription: {
    fontSize: 14,
    color: '#6B7280',
    marginBottom: 20,
    lineHeight: 20,
    textShadowColor: 'rgba(0, 0, 0, 0.75)',
    textShadowOffset: { width: -1, height: 1 },
    textShadowRadius: 2,
  },
  sectionDescriptionDark: {
    color: '#FFFFFF',
    textShadowColor: 'rgba(0, 0, 0, 0.75)',
    textShadowOffset: { width: -1, height: 1 },
  },
  // Filter bar styles
  filterContainer: {
    marginBottom: 16,
    maxHeight: 44,
  },
  filterContent: {
    paddingHorizontal: 0,
    gap: 8,
  },
  filterButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: '#F3F4F6',
    borderWidth: 1.5,
    borderColor: '#E5E7EB',
    gap: 6,
  },
  filterButtonDark: {
    backgroundColor: '#374151',
    borderColor: '#4B5563',
  },
  filterButtonText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#6B7280',
  },
  filterButtonTextDark: {
    color: '#9CA3AF',
  },
  filterButtonTextActive: {
    color: '#FFFFFF',
  },
  filterCount: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 10,
    minWidth: 20,
    alignItems: 'center',
  },
  filterCountText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#FFFFFF',
    textShadowRadius: 2,
  },
  itemCard: {
    backgroundColor: '#FFFFFF',
    padding: 16,
    borderRadius: 12,
    marginBottom: 12,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    boxShadow: '0px 2px 3px rgba(0, 0, 0, 0.1)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 2,
  },
  itemCardDark: {
    backgroundColor: '#374151',
  },
  itemInfo: {
    flex: 1,
  },
  itemName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1F2937',
    marginBottom: 4,
  },
  itemNameDark: {
    color: '#F9FAFB',
  },
  itemDescription: {
    fontSize: 12,
    color: '#6B7280',
    marginBottom: 4,
    textShadowColor: 'rgba(0, 0, 0, 0.75)',
    textShadowOffset: { width: -1, height: 1 },
    textShadowRadius: 2,
  },
  itemDescriptionDark: {
    color: '#FFFFFF',
    textShadowColor: 'rgba(0, 0, 0, 0.75)',
    textShadowOffset: { width: -1, height: 1 },
    textShadowRadius: 2,
  },
  itemPrice: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#10B981',
    marginBottom: 8,
  },
  bonusInfo: {
    marginTop: 4,
  },
  bonusTitle: {
    fontSize: 12,
    fontWeight: '500',
    color: '#6B7280',
    marginBottom: 2,
  },
  bonusTitleDark: {
    color: '#9CA3AF',
  },
  bonusText: {
    fontSize: 11,
    color: '#3B82F6',
    fontWeight: '500',
  },
  bonusTextDark: {
    color: '#93C5FD',
  },
  buyButton: {
    // LoadingButton handles all styling
  },
  sellButton: {
    // LoadingButton handles all styling
  },
  ownedButton: {
    backgroundColor: '#10B981',
  },
  disabledButton: {
    backgroundColor: '#E5E7EB',
  },
  buyButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
  },
  sellButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
  },
  ownedButtonText: {
    color: '#FFFFFF',
  },
  disabledButtonText: {
    color: '#9CA3AF',
  },
  gymCard: {
    backgroundColor: '#FFFFFF',
    padding: 24,
    borderRadius: 16,
    marginBottom: 20,
    boxShadow: '0px 4px 8px rgba(0, 0, 0, 0.1)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 3,
  },
  gymCardDark: {
    backgroundColor: '#374151',
  },
  gymHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  currentFitness: {
    fontSize: 16,
    fontWeight: '600',
    color: '#3B82F6',
    marginBottom: 8,
  },
  currentFitnessDark: {
    color: '#93C5FD',
  },
  gymTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#1F2937',
    marginLeft: 12,
  },
  gymTitleDark: {
    color: '#F9FAFB',
  },
  gymDescription: {
    fontSize: 16,
    color: '#6B7280',
    marginBottom: 20,
    lineHeight: 22,
  },
  gymDescriptionDark: {
    color: '#9CA3AF',
  },
  gymBenefits: {
    backgroundColor: '#F0FDF4',
    padding: 16,
    borderRadius: 8,
    marginBottom: 16,
  },
  gymBenefitsDark: {
    backgroundColor: '#1F2937',
  },
  benefitsTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 8,
  },
  benefitsTitleDark: {
    color: '#D1D5DB',
  },
  benefit: {
    fontSize: 14,
    color: '#10B981',
    fontWeight: '500',
    marginBottom: 2,
  },
  benefitDark: {
    color: '#10B981',
  },
  gymCost: {
    backgroundColor: '#FEF3C7',
    padding: 16,
    borderRadius: 8,
    marginBottom: 20,
  },
  gymCostDark: {
    backgroundColor: '#4B5563',
  },
  costTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 4,
  },
  costTitleDark: {
    color: '#F9FAFB',
  },
  cost: {
    fontSize: 16,
    color: '#F59E0B',
    fontWeight: '600',
  },
  gymButton: {
    // LoadingButton handles all styling
  },
  scrollIndicatorContainer: {
    position: 'absolute',
    right: 10,
    top: 20,
    bottom: 20,
    width: 4,
    zIndex: 1,
  },
  scrollIndicator: {
    flex: 1,
    justifyContent: 'center',
  },
  scrollBar: {
    width: 4,
    height: 40,
    backgroundColor: '#E5E7EB',
    borderRadius: 2,
  },
  scrollBarDark: {
    backgroundColor: '#374151',
  },
  scrollThumb: {
    width: 4,
    height: 20,
    backgroundColor: '#9CA3AF',
    borderRadius: 2,
  },
  scrollThumbDark: {
    backgroundColor: '#6B7280',
  },
  highlightedCard: {
    boxShadow: '0px 0px 15px rgba(245, 158, 11, 1)',
    shadowColor: '#F59E0B',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 1,
    shadowRadius: 15,
    elevation: 12,
    transform: [{ scale: 1.02 }],
  },
});