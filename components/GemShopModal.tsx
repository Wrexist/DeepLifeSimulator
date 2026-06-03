import React, { useState, useRef, useEffect } from 'react';
import { Modal, View, Text, StyleSheet, TouchableOpacity, Alert, ScrollView, Image, Animated } from 'react-native';
import { useGame } from '@/contexts/GameContext';
import { safeSettings } from "@/utils/safeGameState";
import { X, TrendingUp, ArrowRightCircle, Gift, Gem, Star, Zap, Shield, Crown, CheckCircle, Sparkles, Diamond, Coins, Award, Heart, RefreshCw } from 'lucide-react-native';
import BlurViewFallback from '@/components/fallbacks/BlurViewFallback';
import { scale, fontScale, responsiveBorderRadius, responsiveSpacing, verticalScale } from '@/utils/scaling';
import { iapService } from '@/services/IAPService';
import LoadingSpinner from '@/components/LoadingSpinner';
import { IAP_PRODUCTS } from '@/utils/iapConfig';
import { logger } from '@/utils/logger';
import ShopItemCard, { ShopBadge } from '@/components/shop/ShopItemCard';

interface GemShopModalProps {
  visible: boolean;
  onClose: () => void;
}


function GemShopModal({ visible, onClose }: GemShopModalProps) {
  const { gameState, buyGoldUpgrade, saveGame } = useGame();
  const settings = safeSettings(gameState); // R3-D: defensive — see utils/safeGameState.ts
  const [tab, setTab] = useState<'upgrades' | 'store' | 'perks' | 'gems'>('upgrades');
  const [iapLoading, setIapLoading] = useState(false);
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const isDarkMode = settings.darkMode ?? false;

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

  const items = [
    {
      id: 'multiplier',
      name: 'Money Multiplier',
      description: 'All earnings increased by 50% forever',
      price: 5000, // Balanced: 50% of original (10000)
      icon: TrendingUp,
      image: require('@/assets/images/iap/upgrades/money_multiplier.png'),
      permanent: true,
      owned: gameState.goldUpgrades?.multiplier || false,
      gradient: ['#10B981', '#059669'],
      category: 'Economy',
    },
    {
      id: 'energy_boost',
      name: 'Energy Boost',
      description: 'Energy regenerates 50% faster',
      price: 7500, // Balanced: 50% of original (15000)
      icon: Zap,
      image: require('@/assets/images/iap/upgrades/energy_boost.png'),
      permanent: true,
      owned: gameState.goldUpgrades?.energy_boost || false,
      gradient: ['#F59E0B', '#D97706'],
      category: 'Stats',
    },
    {
      id: 'happiness_boost',
      name: 'Happiness Boost',
      description: 'Happiness decays 50% slower',
      price: 6000, // Balanced: 50% of original (12000)
      icon: Star,
      image: require('@/assets/images/iap/upgrades/happiness_boost.png'),
      permanent: true,
      owned: gameState.goldUpgrades?.happiness_boost || false,
      gradient: ['#8B5CF6', '#7C3AED'],
      category: 'Stats',
    },
    {
      id: 'fitness_boost',
      name: 'Fitness Boost',
      description: 'Fitness decays 50% slower',
      price: 9000, // Balanced: 50% of original (18000)
      icon: Shield,
      image: require('@/assets/images/iap/upgrades/fitness_boost.png'),
      permanent: true,
      owned: gameState.goldUpgrades?.fitness_boost || false,
      gradient: ['#EF4444', '#DC2626'],
      category: 'Stats',
    },
    {
      id: 'skill_mastery',
      name: 'Skill Mastery',
      description: 'All skills level up 50% faster',
      price: 15000, // Balanced: 50% of original (30000)
      icon: Award,
      image: require('@/assets/images/iap/upgrades/skill_mastery.png'),
      permanent: true,
      owned: gameState.goldUpgrades?.skill_mastery || false,
      gradient: ['#6366F1', '#4F46E5'],
      category: 'Skills',
    },
    {
      id: 'time_machine',
      name: 'Time Machine',
      description: 'Time-rewind costs halved',
      price: 25000, // Balanced: 50% of original (50000)
      icon: ArrowRightCircle,
      image: require('@/assets/images/iap/upgrades/time_machine.png'),
      permanent: true,
      owned: gameState.goldUpgrades?.time_machine || false,
      gradient: ['#EC4899', '#DB2777'],
      category: 'Special',
    },
    {
      id: 'immortality',
      name: 'Immortality',
      description: 'Never die of old age (skips age-80+ death rolls)',
      price: 50000, // Balanced: 50% of original (100000)
      icon: Crown,
      image: require('@/assets/images/iap/upgrades/immortality.png'),
      permanent: true,
      owned: gameState.goldUpgrades?.immortality || false,
      gradient: ['#FBBF24', '#F59E0B'],
      category: 'Special',
    },
  ];

  const gemPackItems = [
    {
      id: IAP_PRODUCTS.GEMS_100,
      name: '100 Gems',
      description: 'Small gem pack for quick purchases',
      price: '$0.99',
      gems: 100,
      icon: Gem,
      image: require('@/assets/images/iap/gems/gems_100.png'),
      gradient: ['#10B981', '#059669'],
    },
    {
      id: IAP_PRODUCTS.GEMS_500,
      name: '500 Gems',
      description: 'Medium gem pack for regular players',
      price: '$4.99',
      gems: 500,
      icon: Gem,
      image: require('@/assets/images/iap/gems/gems_500.png'),
      gradient: ['#3B82F6', '#1D4ED8'],
    },
    {
      id: IAP_PRODUCTS.GEMS_1000,
      name: '1,000 Gems',
      description: 'Large gem pack for active players',
      price: '$9.99',
      gems: 1000,
      icon: Gem,
      image: require('@/assets/images/iap/gems/gems_1000.png'),
      gradient: ['#8B5CF6', '#7C3AED'],
      popular: true,
    },
    {
      id: IAP_PRODUCTS.GEMS_5000,
      name: '5,000 Gems',
      description: 'Huge gem pack for dedicated players',
      price: '$19.99',
      gems: 5000,
      icon: Gem,
      image: require('@/assets/images/iap/gems/gems_5000.png'),
      gradient: ['#F59E0B', '#D97706'],
      bestValue: true,
    },
    {
      id: IAP_PRODUCTS.GEMS_15000,
      name: '15,000 Gems',
      description: 'Massive gem pack for power players',
      price: '$49.99',
      gems: 15000,
      icon: Diamond,
      image: require('@/assets/images/iap/gems/gems_15000.png'),
      gradient: ['#EC4899', '#DB2777'],
    },
  ];

  const storeItems = [
    {
      id: IAP_PRODUCTS.YOUTH_PILL_SINGLE,
      name: 'Youth Pill',
      description: 'Reset your age to 18',
      price: '$4.99',
      icon: Sparkles,
      gradient: ['#EC4899', '#DB2777'],
      features: ['Reset age to 18', 'Keep all progress', 'One-time use'],
      image: require('@/assets/images/iap/items/youth_pill_single.png'),
    },
    {
      id: IAP_PRODUCTS.YOUTH_PILL_PACK,
      name: 'Youth Pill Pack (5x)',
      description: '5 Youth Pills - Save 20%',
      price: '$19.99',
      icon: Sparkles,
      gradient: ['#A855F7', '#9333EA'],
      features: ['5 Youth Pills', 'Reset age 5 times', 'Save 20%'],
      image: require('@/assets/images/iap/items/youth_pill_pack.png'),
      originalPrice: '$24.95',
      savings: '20%',
    },
    {
      id: IAP_PRODUCTS.MONEY_BOOST,
      name: 'Money Boost',
      description: 'Instant $1,000,000',
      price: '$7.99',
      icon: Coins,
      gradient: ['#10B981', '#059669'],
      features: ['Instant $1M cash', 'Use for anything', 'Quick boost'],
      image: require('@/assets/images/iap/items/money_boost.png'),
    },
    {
      id: IAP_PRODUCTS.SKILL_BOOST,
      name: 'Skill Boost',
      description: '+50 levels to all skills',
      price: '$12.99',
      icon: Award,
      gradient: ['#F59E0B', '#D97706'],
      features: ['+50 all skills', 'Instant mastery', 'Better jobs'],
      image: require('@/assets/images/iap/items/skill_boost.png'),
    },
    {
      id: IAP_PRODUCTS.GEMS_STARTER,
      name: 'Starter Pack',
      description: 'Perfect for new players',
      price: '$9.99',
      icon: Gift,
      value: 'starter',
      gradient: ['#10B981', '#059669'],
      features: ['1,000 Gems', '1 Youth Pill', 'Welcome Bonus'],
      image: require('@/assets/images/iap/packs/starter_pack.png'),
    },
    {
      id: IAP_PRODUCTS.GEMS_PREMIUM,
      name: 'Premium Pack',
      description: 'Great value for active players',
      price: '$24.99',
      icon: Star,
      value: 'premium',
      gradient: ['#3B82F6', '#1D4ED8'],
      features: ['3,500 Gems', '3 Youth Pills', 'Money Multiplier'],
      originalPrice: '$44.97',
      savings: '44%',
      image: require('@/assets/images/iap/packs/premium_pack.png'),
    },
    {
      id: IAP_PRODUCTS.GEMS_ULTIMATE,
      name: 'Ultimate Pack',
      description: 'Everything you need to dominate',
      price: '$49.99',
      icon: Crown,
      value: 'ultimate',
      gradient: ['#8B5CF6', '#7C3AED'],
      features: ['12,000 Gems', '10 Youth Pills', 'All Upgrades'],
      originalPrice: '$199.90',
      savings: '75%',
      image: require('@/assets/images/iap/packs/ultimate_pack.png'),
    },
    {
      id: IAP_PRODUCTS.GEMS_MEGA,
      name: 'Mega Pack',
      description: 'Unlimited power and potential',
      price: '$99.99',
      icon: Diamond,
      value: 'mega',
      gradient: ['#F59E0B', '#D97706'],
      features: ['40,000 Gems', 'Unlimited Youth Pills', 'Everything Unlocked'],
      originalPrice: '$499.85',
      savings: '80%',
      image: require('@/assets/images/iap/packs/mega_pack.png'),
    },
  ];

  const perksItems = [
    {
      id: IAP_PRODUCTS.UNLOCK_ALL_PERKS,
      name: 'Unlock All Perks',
      description: 'All perks included - Best value',
      price: '$6.99',
      icon: Crown,
      value: 'allPerks',
      owned: gameState.perks?.workBoost && gameState.perks?.fastLearner && gameState.perks?.goodCredit || false,
      gradient: ['#FBBF24', '#F59E0B'],
      image: require('@/assets/images/iap/premium/unlock_all_perks.png'),
      popular: true,
      bestValue: true,
    },
    {
      id: IAP_PRODUCTS.WORK_BOOST,
      name: 'Work Pay Boost',
      description: '+50% earnings on all jobs',
      price: '$1.99',
      icon: TrendingUp,
      value: 'workBoost',
      owned: gameState.perks?.workBoost || false,
      gradient: ['#10B981', '#059669'],
      image: require('@/assets/images/iap/perks/work_pay_boost.png'),
    },
    {
      id: IAP_PRODUCTS.FAST_LEARNER,
      name: 'Fast Learner',
      description: '50% faster education',
      price: '$1.99',
      icon: Star,
      value: 'fastLearner',
      owned: gameState.perks?.fastLearner || false,
      gradient: ['#8B5CF6', '#7C3AED'],
      image: require('@/assets/images/iap/perks/fast_learner.png'),
    },
    {
      id: IAP_PRODUCTS.GOOD_CREDIT,
      name: 'Good Credit Score',
      description: 'Higher bank interest rates',
      price: '$1.99',
      icon: Shield,
      value: 'goodCredit',
      owned: gameState.perks?.goodCredit || false,
      gradient: ['#6366F1', '#4F46E5'],
      image: require('@/assets/images/iap/perks/good_credit_score.png'),
    },
    {
      id: IAP_PRODUCTS.REMOVE_ADS,
      name: 'Remove Ads',
      description: 'Ad-free gaming forever',
      price: '$2.99',
      icon: CheckCircle,
      value: 'removeAds',
      owned: gameState.settings?.adsRemoved || false,
      gradient: ['#06B6D4', '#0891B2'],
      image: require('@/assets/images/iap/premium/remove_ads.png'),
    },
    {
      id: IAP_PRODUCTS.REVIVAL_PACK,
      name: 'Revival Pack',
      description: 'Auto-revive on death',
      price: '$2.99',
      icon: Heart,
      value: 'revival',
      owned: gameState.settings?.hasRevivalPack || false,
      gradient: ['#EF4444', '#DC2626'],
      image: require('@/assets/images/iap/items/youth_pill_single.png'),
      popular: true,
    },
    {
      id: IAP_PRODUCTS.LIFETIME_PREMIUM,
      name: 'Lifetime Premium',
      description: 'All updates + No ads + Exclusive',
      price: '$79.99',
      icon: Crown,
      value: 'lifetimePremium',
      owned: gameState.settings?.lifetimePremium || false,
      gradient: ['#8B5CF6', '#7C3AED'],
      image: require('@/assets/images/iap/perks/mindset.png'),
    },
  ];

  const handleBuy = async (id: string, price: number) => {
    if ((gameState?.stats?.gems ?? 0) < price) {
      Alert.alert('Insufficient Gems', 'You need more gems to purchase this upgrade.');
      return;
    }
    
    // Check if already owned
    const isOwned = gameState.goldUpgrades?.[id as keyof typeof gameState.goldUpgrades];
    if (isOwned) {
      Alert.alert('Already Owned', 'You already own this upgrade.');
      return;
    }
    
    buyGoldUpgrade(id);
    await saveGame(); // Save after purchase
    Alert.alert('Purchase Successful', 'Your upgrade has been activated!');
  };

  const handlePurchase = async (item: any) => {
    if (iapLoading) {
      Alert.alert('Please Wait', 'Another purchase is in progress. Please wait for it to complete.');
      return;
    }
    
    const { name, price, id, originalPrice, savings } = item;
    
    let message = `Purchase ${name} for ${price}?`;
    if (originalPrice && savings) {
      message += `\n\nOriginal: ${originalPrice}`;
      message += `\nYou save: ${savings}`;
    }
    
    Alert.alert(
      'Confirm Purchase',
      message,
      [
        { text: 'Cancel', style: 'cancel' },
        { 
          text: 'Purchase', 
          onPress: async () => {
            setIapLoading(true);
            
            try {
              logger.info(`Attempting to purchase: ${id} (${name})`);
              
              // Use IAP service for purchase
              const result = await iapService.purchaseProduct(id);
              
              if (result.success) {
                // IAPService already applies benefits - no need to apply again
                // This prevents double application of benefits
                
                // Show success message with more details
                const successMessage = result.message || 'Purchase completed! Your items have been added to your account.';
                Alert.alert('Purchase Successful!', successMessage);
              } else {
                // Show detailed error message from IAP service
                const errorMessage = result.message || 'Unable to complete purchase. Please try again.';
                
                // Don't show error for cancelled purchases (user intentionally cancelled)
                if (!errorMessage.includes('cancelled')) {
                  Alert.alert('Purchase Failed', errorMessage);
                }
              }
            } catch (error) {
              logger.error('Purchase error:', error);
              
              // Show user-friendly error message
              let errorMsg = 'An unexpected error occurred during purchase.';
              if (error instanceof Error) {
                errorMsg = error.message;
              }
              
              Alert.alert('Error', `${errorMsg}\n\nPlease try again or contact support if the problem persists.`);
            } finally {
              setIapLoading(false);
            }
          }
        }
      ]
    );
  };

  // NOTE: applyPurchaseBenefits removed - IAPService handles all benefit application
  // This prevents double application of benefits and ensures consistency

  const handleRestorePurchases = async () => {
    if (iapLoading) {
      Alert.alert('Please Wait', 'A purchase operation is already in progress.');
      return;
    }

    setIapLoading(true);
    
    try {
      logger.info('Starting purchase restoration...');
      const success = await iapService.restorePurchases();
      
      if (success) {
        // Reload IAP state to refresh purchases
        await iapService.loadPurchases();

        Alert.alert(
          'Purchases Restored',
          'Your previous purchases have been restored successfully!',
          [{ text: 'OK', style: 'default' }]
        );
      } else {
        Alert.alert(
          'Could Not Restore',
          'Purchases could not be restored at this time. Make sure you are signed in to the App Store and try again.',
          [{ text: 'OK', style: 'default' }]
        );
      }
    } catch (error) {
      logger.error('Restore purchases error:', error);
      Alert.alert(
        'Restore Failed',
        'Unable to restore purchases. Please try again or contact support.',
        [{ text: 'OK', style: 'default' }]
      );
    } finally {
      setIapLoading(false);
    }
  };

  const tabs = [
    { id: 'upgrades' as const, label: 'Upgrades', icon: TrendingUp, colors: ['#10B981', '#059669'] },
    { id: 'gems' as const, label: 'Gems', icon: Gem, colors: ['#6366F1', '#4F46E5'] },
    { id: 'store' as const, label: 'Packs', icon: Gift, colors: ['#8B5CF6', '#7C3AED'] },
    { id: 'perks' as const, label: 'Perks', icon: Star, colors: ['#F59E0B', '#D97706'] },
  ];

  const renderUpgradeCard = (item: any) => {
    const afford = (gameState?.stats?.gems ?? 0) >= item.price;
    const isOwned = item.owned;
    const badges: ShopBadge[] = [];
    if (item.permanent) badges.push({ label: 'Permanent', color: '#A5B4FC' });
    return (
      <ShopItemCard
        key={item.id}
        accent="upgrades"
        title={item.name}
        description={item.description}
        image={item.image}
        icon={item.icon}
        priceLabel={item.price.toLocaleString()}
        priceKind="gems"
        badges={badges}
        buttonText={isOwned ? 'Owned' : afford ? 'Purchase' : 'Insufficient'}
        onPress={() => handleBuy(item.id, item.price)}
        owned={isOwned}
        locked={!afford && !isOwned}
      />
    );
  };

  const renderStoreCard = (item: any) => {
    const hasSavings = item.originalPrice && item.savings;
    const badges: ShopBadge[] = [];
    if (hasSavings) badges.push({ label: `Save ${item.savings}`, color: '#34D399' });
    return (
      <ShopItemCard
        key={item.id}
        accent="packs"
        title={item.name}
        description={item.description}
        features={item.features}
        image={item.image}
        priceLabel={item.price}
        priceKind="money"
        originalPriceLabel={hasSavings ? item.originalPrice : undefined}
        badges={badges}
        buttonText={iapLoading ? 'Processing…' : 'Purchase'}
        onPress={() => handlePurchase(item)}
        locked={iapLoading}
      />
    );
  };

  const renderPerkCard = (item: any) => {
    const isOwned = item.owned;
    return (
      <ShopItemCard
        key={item.id}
        accent="perks"
        title={item.name}
        description={item.description}
        image={item.image}
        priceLabel={item.price}
        priceKind="money"
        buttonText={isOwned ? 'Owned' : iapLoading ? 'Processing…' : 'Purchase'}
        onPress={() => handlePurchase(item)}
        owned={isOwned}
        locked={iapLoading && !isOwned}
      />
    );
  };

  const renderGemPackCard = (item: any) => {
    const badges: ShopBadge[] = [];
    if (item.bestValue) badges.push({ label: 'Best Value', color: '#FBBF24' });
    if (item.popular) badges.push({ label: 'Popular', color: '#A5B4FC' });
    return (
      <ShopItemCard
        key={item.id}
        accent="gems"
        title={item.name}
        description={`${item.gems.toLocaleString()} gems${item.description ? ` • ${item.description}` : ''}`}
        image={item.image}
        priceLabel={item.price}
        priceKind="money"
        badges={badges}
        buttonText={iapLoading ? 'Processing…' : 'Purchase'}
        onPress={() => handlePurchase(item)}
        locked={iapLoading}
      />
    );
  };

  if (!visible) return null;

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose} statusBarTranslucent>
      <View style={styles.overlay}>
        <TouchableOpacity style={StyleSheet.absoluteFill} activeOpacity={1} onPress={onClose}>
          <View style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(2, 6, 23, 0.7)' }]} />
        </TouchableOpacity>

        <Animated.View style={[styles.sheet, { opacity: fadeAnim }]}>
          <BlurViewFallback intensity={40} tint="dark" style={StyleSheet.absoluteFill} />

          {/* Pull handle */}
          <View style={styles.handle} />

          {/* Header — title + balance + close */}
          <View style={styles.headerRow}>
            <View style={{ flex: 1 }}>
              <Text style={styles.title}>Gem Shop</Text>
              <View style={styles.balanceRow}>
                <Gem size={scale(13)} color="#A5B4FC" />
                <Text style={styles.balanceText}>
                  {(gameState?.stats?.gems ?? 0).toLocaleString()}
                </Text>
                <Text style={styles.balanceLabel}>gems</Text>
              </View>
            </View>
            <TouchableOpacity onPress={onClose} style={styles.closeBtn} accessibilityLabel="Close">
              <X size={scale(18)} color="rgba(226, 232, 240, 0.7)" />
            </TouchableOpacity>
          </View>

          {/* Tabs — text + icon, accent underline only */}
          <View style={styles.tabRow}>
            {tabs.map(tabItem => {
              const Icon = tabItem.icon;
              const isSelected = tab === tabItem.id;
              return (
                <TouchableOpacity
                  key={tabItem.id}
                  onPress={() => setTab(tabItem.id)}
                  activeOpacity={0.8}
                  style={styles.tabBtn}
                >
                  <View style={styles.tabContent}>
                    <Icon size={scale(13)} color={isSelected ? '#F8FAFC' : 'rgba(226, 232, 240, 0.55)'} />
                    <Text style={[styles.tabLabel, isSelected && styles.tabLabelActive]}>
                      {tabItem.label}
                    </Text>
                  </View>
                  {isSelected ? <View style={[styles.tabUnderline, { backgroundColor: tabItem.colors[0] }]} /> : null}
                </TouchableOpacity>
              );
            })}
          </View>

          {/* Content */}
          <ScrollView
            style={styles.scroll}
            contentContainerStyle={styles.scrollContent}
            showsVerticalScrollIndicator={false}
          >
            {tab === 'upgrades' ? items.map(renderUpgradeCard) : null}
            {tab === 'gems' ? gemPackItems.map(renderGemPackCard) : null}
            {tab === 'store' ? storeItems.map(renderStoreCard) : null}
            {tab === 'perks' ? perksItems.map(renderPerkCard) : null}
          </ScrollView>

          {/* Footer — single quiet text-link to restore */}
          <View style={styles.footer}>
            <TouchableOpacity
              onPress={handleRestorePurchases}
              disabled={iapLoading}
              activeOpacity={0.7}
              style={styles.restoreBtn}
            >
              {iapLoading ? (
                <LoadingSpinner visible size="small" color="rgba(226, 232, 240, 0.6)" variant="compact" />
              ) : (
                <RefreshCw size={scale(13)} color="rgba(226, 232, 240, 0.6)" />
              )}
              <Text style={styles.restoreText}>
                {iapLoading ? 'Restoring…' : 'Restore Purchases'}
              </Text>
            </TouchableOpacity>
          </View>
        </Animated.View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  sheet: {
    height: '85%',
    backgroundColor: 'rgba(15, 23, 42, 0.94)',
    borderTopLeftRadius: responsiveBorderRadius.xl,
    borderTopRightRadius: responsiveBorderRadius.xl,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    overflow: 'hidden',
  },
  handle: {
    alignSelf: 'center',
    width: scale(40),
    height: scale(4),
    borderRadius: scale(2),
    backgroundColor: 'rgba(255, 255, 255, 0.18)',
    marginTop: verticalScale(8),
    marginBottom: verticalScale(8),
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: responsiveSpacing.md,
    paddingBottom: verticalScale(12),
    gap: scale(12),
  },
  title: {
    fontSize: fontScale(20),
    fontWeight: '700',
    color: '#F8FAFC',
    letterSpacing: -0.3,
  },
  balanceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: scale(5),
    marginTop: 2,
  },
  balanceText: {
    fontSize: fontScale(13),
    fontWeight: '700',
    color: '#A5B4FC',
    letterSpacing: -0.2,
    fontVariant: ['tabular-nums'],
  },
  balanceLabel: {
    fontSize: fontScale(11),
    fontWeight: '600',
    color: 'rgba(226, 232, 240, 0.55)',
    textTransform: 'uppercase',
    letterSpacing: 0.6,
    marginLeft: scale(2),
  },
  closeBtn: {
    width: scale(32),
    height: scale(32),
    borderRadius: scale(16),
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(15, 23, 42, 0.6)',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255, 255, 255, 0.08)',
  },
  tabRow: {
    flexDirection: 'row',
    paddingHorizontal: responsiveSpacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(255, 255, 255, 0.06)',
  },
  tabBtn: {
    flex: 1,
    paddingVertical: verticalScale(10),
    alignItems: 'center',
  },
  tabContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: scale(6),
  },
  tabLabel: {
    fontSize: fontScale(13),
    fontWeight: '600',
    color: 'rgba(226, 232, 240, 0.55)',
    letterSpacing: -0.1,
  },
  tabLabelActive: {
    color: '#F8FAFC',
    fontWeight: '700',
  },
  tabUnderline: {
    position: 'absolute',
    bottom: 0,
    left: '20%',
    right: '20%',
    height: 2,
    borderRadius: 1,
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    padding: responsiveSpacing.md,
    paddingBottom: verticalScale(24),
  },
  footer: {
    paddingHorizontal: responsiveSpacing.md,
    paddingVertical: verticalScale(12),
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: 'rgba(255, 255, 255, 0.08)',
    alignItems: 'center',
  },
  restoreBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: scale(8),
    paddingVertical: verticalScale(6),
    paddingHorizontal: scale(12),
  },
  restoreText: {
    fontSize: fontScale(12),
    fontWeight: '600',
    color: 'rgba(226, 232, 240, 0.65)',
    letterSpacing: 0.3,
  },
});

export default React.memo(GemShopModal);

