import React, { useState, useRef, useEffect } from 'react';
import { Modal, View, Text, StyleSheet, TouchableOpacity, Alert, ScrollView, Image, Animated } from 'react-native';
import { useGame } from '@/contexts/GameContext';
import { X, TrendingUp, ArrowRightCircle, Gift, Gem, Star, Zap, Shield, Crown, CheckCircle, Sparkles, Diamond, Coins, Award, Heart, RefreshCw } from 'lucide-react-native';
import LinearGradientFallback from '@/components/fallbacks/LinearGradientFallback';
const LinearGradient = LinearGradientFallback;
import { responsivePadding, responsiveFontSize, responsiveSpacing, responsiveBorderRadius, scale, fontScale } from '@/utils/scaling';
import { iapService } from '@/services/IAPService';
import LoadingSpinner from '@/components/LoadingSpinner';
import { IAP_PRODUCTS, getProductConfig } from '@/utils/iapConfig';
import { logger } from '@/utils/logger';

interface GemShopModalProps {
  visible: boolean;
  onClose: () => void;
}


function GemShopModal({ visible, onClose }: GemShopModalProps) {
  const { gameState, buyGoldUpgrade, setGameState, saveGame } = useGame();
  const { settings } = gameState;
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
      description: 'Maximum energy increased to 100',
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
      description: 'Maximum happiness increased to 100',
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
      description: 'Maximum fitness increased to 100',
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
      description: 'Travel back in time',
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
      description: 'Never die of old age',
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
    const Icon = item.icon;
    const afford = (gameState?.stats?.gems ?? 0) >= item.price;
    const isOwned = item.owned;
    
    return (
      <View key={item.id} style={[styles.upgradeCard, isDarkMode && styles.upgradeCardDark]}>
        <LinearGradient
          colors={item.gradient}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.upgradeCardGradient}
        >
          {item.permanent && (
            <View style={styles.permanentBadgeTopLeft}>
              <Text style={styles.permanentText}>PERMANENT</Text>
            </View>
          )}
          
          <View style={styles.upgradeCardContent}>
            <View style={styles.upgradeHeader}>
              <View style={styles.upgradeIconContainer}>
                {item.image ? (
                  <Image source={item.image} style={styles.upgradeImage} />
                ) : (
                  <Icon size={28} color="#FFFFFF" />
                )}
              </View>
              <View style={styles.upgradeTitleContainer}>
                <Text style={styles.upgradeName}>{item.name}</Text>
                <Text style={styles.upgradeDescription}>{item.description}</Text>
              </View>
              {isOwned && (
                <View style={styles.ownedBadge}>
                  <CheckCircle size={16} color="#10B981" />
                  <Text style={styles.ownedText}>OWNED</Text>
                </View>
              )}
            </View>
            
            <View style={styles.upgradeFooter}>
              <View style={styles.upgradeCategory}>
                <Text style={styles.upgradeCategoryText}>{item.category}</Text>
              </View>
              
              {!isOwned && (
                <View style={styles.upgradeActions}>
                  <View style={styles.priceContainer}>
                    <Gem size={20} color={afford ? '#FFFFFF' : '#9CA3AF'} />
                    <Text style={[styles.price, { color: afford ? '#FFFFFF' : '#9CA3AF' }]}>
                      {item.price.toLocaleString()}
                    </Text>
                  </View>
                  <TouchableOpacity
                    style={[styles.buyButton, !afford && styles.buyButtonDisabled]}
                    onPress={() => handleBuy(item.id, item.price)}
                    disabled={!afford}
                  >
                    <Text style={[styles.buyButtonText, !afford && styles.buyButtonTextDisabled]}>
                      {afford ? 'Purchase' : 'Insufficient'}
                    </Text>
                  </TouchableOpacity>
                </View>
              )}
            </View>
          </View>
        </LinearGradient>
      </View>
    );
  };

  const renderStoreCard = (item: any) => {
    const hasSavings = item.originalPrice && item.savings;
    
    return (
      <View key={item.id} style={[styles.storeCard, isDarkMode && styles.storeCardDark]}>
        <LinearGradient
          colors={item.gradient}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.storeCardGradient}
        >
          {hasSavings && (
            <View style={styles.savingsBadgeTopLeft}>
              <Text style={styles.savingsText}>SAVE {item.savings}</Text>
            </View>
          )}
          
          <View style={styles.storeCardContent}>
            <View style={styles.storeHeader}>
              <View style={styles.storeIconContainer}>
                <Image source={item.image} style={styles.storeImage} />
              </View>
              <View style={styles.storeTitleContainer}>
                <Text style={styles.storeName}>{item.name}</Text>
                <Text style={styles.storeDescription}>{item.description}</Text>
                <View style={styles.storeFeatures}>
                  {item.features.map((feature: string, index: number) => (
                    <View key={index} style={styles.featureItem}>
                      <Sparkles size={12} color="#FFFFFF" />
                      <Text style={styles.featureText}>{feature}</Text>
                    </View>
                  ))}
                </View>
              </View>
            </View>
            
            <View style={styles.storeFooter}>
              <View style={styles.storePriceContainer}>
                {hasSavings && (
                  <Text style={styles.originalPrice}>{item.originalPrice}</Text>
                )}
                <Text style={styles.storePrice}>{item.price}</Text>
              </View>
              <TouchableOpacity
                style={[styles.storeBuyButton, iapLoading && styles.storeBuyButtonDisabled]}
                onPress={() => handlePurchase(item)}
                disabled={iapLoading}
              >
                <Text style={styles.storeBuyButtonText}>{iapLoading ? 'Processing...' : 'Purchase'}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </LinearGradient>
      </View>
    );
  };

  const renderPerkCard = (item: any) => {
    const isOwned = item.owned;
    
    return (
      <View key={item.id} style={[styles.perkCard, isDarkMode && styles.perkCardDark]}>
        <LinearGradient
          colors={item.gradient}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.perkCardGradient}
        >
          {isOwned && (
            <View style={styles.perkOwnedBadgeTopRight}>
              <CheckCircle size={16} color="#10B981" />
              <Text style={styles.perkOwnedText}>OWNED</Text>
            </View>
          )}
          
          <View style={styles.perkCardContent}>
            <View style={styles.perkHeader}>
              <View style={styles.perkIconContainer}>
                <Image source={item.image} style={styles.perkImage} />
              </View>
              <View style={styles.perkTitleContainer}>
                <Text style={styles.perkName}>{item.name}</Text>
                <Text style={styles.perkDescription}>{item.description}</Text>
              </View>
            </View>
            
            <View style={styles.perkFooter}>
              <Text style={styles.perkPrice}>{item.price}</Text>
              {!isOwned && (
                <TouchableOpacity
                  style={[styles.perkBuyButton, iapLoading && styles.perkBuyButtonDisabled]}
                  onPress={() => handlePurchase(item)}
                  disabled={iapLoading}
                >
                  <Text style={styles.perkBuyButtonText}>{iapLoading ? 'Processing...' : 'Purchase'}</Text>
                </TouchableOpacity>
              )}
            </View>
          </View>
        </LinearGradient>
      </View>
    );
  };

  const renderGemPackCard = (item: any) => {
    const isPopular = item.popular;
    const isBestValue = item.bestValue;
    
    return (
      <View key={item.id} style={[styles.gemPackCard, isDarkMode && styles.gemPackCardDark]}>
        <LinearGradient
          colors={item.gradient}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.gemPackCardGradient}
        >
          {isPopular && (
            <View style={styles.popularBadgeTopLeft}>
              <Star size={12} color="#FFFFFF" />
              <Text style={styles.popularText}>POPULAR</Text>
            </View>
          )}
          {isBestValue && (
            <View style={styles.bestValueBadgeTopLeft}>
              <Crown size={12} color="#FFFFFF" />
              <Text style={styles.bestValueText}>BEST VALUE</Text>
            </View>
          )}
          
          <View style={styles.gemPackContent}>
            <View style={styles.gemPackHeader}>
              <View style={styles.gemPackIconContainer}>
                {item.image ? (
                  <Image source={item.image} style={styles.gemPackImageIcon} />
                ) : (
                  <Gem size={32} color="#FFFFFF" />
                )}
              </View>
              <View style={styles.gemPackInfo}>
                <Text style={styles.gemPackName}>{item.name}</Text>
                <Text style={styles.gemPackDescription}>{item.description}</Text>
              </View>
            </View>
            
            <View style={styles.gemPackFooter}>
              <View style={styles.gemPackPriceContainer}>
                <Text style={styles.gemPackPrice}>{item.price}</Text>
                <View style={styles.gemPackGemsDisplay}>
                  <Gem size={16} color="#FFFFFF" />
                  <Text style={styles.gemPackGemsText}>{item.gems.toLocaleString()} Gems</Text>
                </View>
              </View>
              <TouchableOpacity
                style={[styles.gemPackBuyButton, iapLoading && styles.gemPackBuyButtonDisabled]}
                onPress={() => handlePurchase(item)}
                disabled={iapLoading}
              >
                <Text style={styles.gemPackBuyButtonText}>{iapLoading ? 'Processing...' : 'Purchase'}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </LinearGradient>
      </View>
    );
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
                <View style={styles.gemBalanceContainer}>
                  <View style={styles.gemIconContainer}>
                    <Gem size={20} color="#6366F1" />
                  </View>
                  <View>
                    <Text style={[styles.balanceLabel, isDarkMode && styles.balanceLabelDark]}>
                      Gems
                    </Text>
                    <Text style={[styles.balanceText, isDarkMode && styles.balanceTextDark]}>
                      {(gameState?.stats?.gems ?? 0).toLocaleString()}
                    </Text>
                  </View>
                </View>
              </View>
              <View style={styles.headerRight}>
                <Text style={[styles.title, isDarkMode && styles.titleDark]}>Gem Shop</Text>
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
            </View>

            {/* Category Tabs */}
            <View style={styles.categoryTabsContainer}>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                style={styles.categoryTabs}
                contentContainerStyle={styles.categoryTabsContent}
              >
                {tabs.map(tabItem => {
                  const Icon = tabItem.icon;
                  const isSelected = tab === tabItem.id;
                  return (
                    <TouchableOpacity
                      key={tabItem.id}
                      style={styles.categoryTabWrapper}
                      onPress={() => setTab(tabItem.id)}
                      activeOpacity={0.7}
                    >
                      <LinearGradient
                        colors={isSelected 
                          ? tabItem.colors
                          : isDarkMode 
                          ? ['rgba(55, 65, 81, 0.6)', 'rgba(31, 41, 55, 0.7)'] 
                          : ['rgba(243, 244, 246, 0.8)', 'rgba(229, 231, 235, 0.9)']}
                        start={{ x: 0, y: 0 }}
                        end={{ x: 1, y: 1 }}
                        style={[styles.categoryTab, isSelected && styles.categoryTabSelected]}
                      >
                        <Icon size={16} color={isSelected ? '#FFFFFF' : (isDarkMode ? '#D1D5DB' : '#6B7280')} />
                        <Text style={[styles.categoryTabText, isSelected && styles.categoryTabTextSelected, !isSelected && isDarkMode && styles.categoryTabTextDark]}>
                          {tabItem.label}
                        </Text>
                      </LinearGradient>
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>
            </View>

            {/* Content */}
            <ScrollView 
              style={styles.scrollView}
              showsVerticalScrollIndicator={false}
              contentContainerStyle={styles.scrollContent}
            >
              {tab === 'upgrades' && (
                <View style={styles.upgradesGrid}>
                  {items.map(renderUpgradeCard)}
                </View>
              )}
              
              {tab === 'gems' && (
                <View style={styles.gemPacksGrid}>
                  {gemPackItems.map(renderGemPackCard)}
                </View>
              )}
              
              {tab === 'store' && (
                <View style={styles.storeGrid}>
                  {storeItems.map(renderStoreCard)}
                </View>
              )}
              
              {tab === 'perks' && (
                <View style={styles.perksGrid}>
                  {perksItems.map(renderPerkCard)}
                </View>
              )}
            </ScrollView>

            {/* Footer with Restore Purchases Button */}
            <View style={[styles.footer, isDarkMode && styles.footerDark]}>
              <TouchableOpacity
                style={styles.restoreButton}
                onPress={handleRestorePurchases}
                disabled={iapLoading}
                activeOpacity={0.7}
              >
                {iapLoading ? (
                  <LoadingSpinner visible size="small" color={isDarkMode ? '#9CA3AF' : '#6B7280'} variant="compact" />
                ) : (
                  <RefreshCw size={18} color={isDarkMode ? '#9CA3AF' : '#6B7280'} />
                )}
                <Text style={[styles.restoreButtonText, iapLoading && styles.restoreButtonTextDisabled, isDarkMode && styles.restoreButtonTextDark]}>
                  {iapLoading ? 'Restoring...' : 'Restore Purchases'}
                </Text>
              </TouchableOpacity>
            </View>
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
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: scale(12),
  },
  gemBalanceContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: scale(12),
  },
  gemIconContainer: {
    width: scale(40),
    height: scale(40),
    borderRadius: scale(20),
    backgroundColor: 'rgba(99, 102, 241, 0.2)',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(99, 102, 241, 0.3)',
  },
  balanceLabel: {
    fontSize: fontScale(12),
    fontWeight: '600',
    color: '#6B7280',
    marginBottom: scale(2),
  },
  balanceLabelDark: {
    color: '#9CA3AF',
  },
  balanceText: {
    fontSize: fontScale(24),
    fontWeight: '800',
    color: '#1F2937',
  },
  balanceTextDark: {
    color: '#FFFFFF',
  },
  title: {
    fontSize: fontScale(24),
    fontWeight: '700',
    color: '#1F2937',
    letterSpacing: -0.5,
  },
  titleDark: {
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
    shadowColor: '#6366F1',
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
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: scale(20),
    paddingBottom: scale(40),
  },
  
  // Upgrades Grid
  upgradesGrid: {
    gap: scale(14),
  },
  upgradeCard: {
    borderRadius: scale(16),
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.15)',
  },
  upgradeCardDark: {
    // Additional dark mode styles if needed
  },
  upgradeCardGradient: {
    padding: scale(18),
  },
  upgradeCardContent: {
    flex: 1,
  },
  upgradeHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: scale(12),
  },
  upgradeTitleContainer: {
    flex: 1,
    marginLeft: scale(12),
  },
  upgradeIconContainer: {
    width: scale(56),
    height: scale(56),
    borderRadius: scale(28),
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  upgradeImage: {
    width: scale(32),
    height: scale(32),
    resizeMode: 'contain',
  },
  upgradeActions: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  permanentBadgeTopLeft: {
    position: 'absolute',
    top: scale(12),
    left: scale(18),
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    paddingHorizontal: scale(8),
    paddingVertical: 4,
    borderRadius: scale(6),
    zIndex: 10,
  },
  permanentText: {
    color: '#FFFFFF',
    fontSize: fontScale(10),
    fontWeight: '700',
  },
  ownedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(16, 185, 129, 0.2)',
    paddingHorizontal: scale(8),
    paddingVertical: 2,
    borderRadius: scale(6),
  },
  ownedText: {
    color: '#10B981',
    fontSize: fontScale(10),
    fontWeight: '700',
    marginLeft: 4,
  },
  upgradeName: {
    fontSize: fontScale(18),
    fontWeight: '700',
    color: '#FFFFFF',
    marginBottom: scale(4),
  },
  upgradeDescription: {
    fontSize: fontScale(14),
    color: 'rgba(255, 255, 255, 0.8)',
    lineHeight: fontScale(20),
  },
  upgradeCategory: {
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    paddingHorizontal: scale(8),
    paddingVertical: 4,
    borderRadius: scale(6),
  },
  upgradeCategoryText: {
    color: '#FFFFFF',
    fontSize: fontScale(11),
    fontWeight: '600',
  },
  upgradeFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: scale(12),
    paddingTop: scale(12),
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.1)',
  },
  priceContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  price: {
    fontSize: fontScale(16),
    fontWeight: '700',
    marginLeft: scale(6),
  },
  buyButton: {
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    paddingHorizontal: scale(16),
    paddingVertical: scale(10),
    borderRadius: scale(10),
  },
  buyButtonDisabled: {
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
  },
  buyButtonText: {
    color: '#FFFFFF',
    fontSize: fontScale(13),
    fontWeight: '600',
  },
  buyButtonTextDisabled: {
    color: 'rgba(255, 255, 255, 0.5)',
  },
  
  // Store Grid
  storeGrid: {
    gap: scale(14),
  },
  storeCard: {
    borderRadius: scale(16),
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.15)',
  },
  storeCardDark: {
    // Additional dark mode styles if needed
  },
  storeCardGradient: {
    padding: scale(18),
    position: 'relative',
  },
  savingsBadgeTopLeft: {
    position: 'absolute',
    top: scale(12),
    left: scale(18),
    backgroundColor: '#EF4444',
    paddingHorizontal: scale(8),
    paddingVertical: 4,
    borderRadius: scale(6),
    zIndex: 10,
  },
  savingsText: {
    color: '#FFFFFF',
    fontSize: fontScale(10),
    fontWeight: '700',
  },
  storeCardContent: {
    flex: 1,
  },
  storeHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: scale(12),
  },
  storeIconContainer: {
    width: scale(64),
    height: scale(64),
    borderRadius: scale(32),
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: scale(12),
  },
  storeTitleContainer: {
    flex: 1,
  },
  storeName: {
    fontSize: fontScale(18),
    fontWeight: '700',
    color: '#FFFFFF',
    marginBottom: scale(4),
  },
  storeDescription: {
    fontSize: fontScale(14),
    color: 'rgba(255, 255, 255, 0.8)',
    marginBottom: scale(4),
  },
  storeImage: {
    width: scale(48),
    height: scale(48),
    resizeMode: 'contain',
  },
  storeFeatures: {
    marginTop: scale(4),
  },
  featureItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
  },
  featureText: {
    color: 'rgba(255, 255, 255, 0.9)',
    fontSize: fontScale(12),
    marginLeft: scale(6),
  },
  storeFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: scale(12),
    paddingTop: scale(12),
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.1)',
  },
  storePriceContainer: {
    flex: 1,
  },
  originalPrice: {
    color: 'rgba(255, 255, 255, 0.6)',
    fontSize: fontScale(12),
    textDecorationLine: 'line-through',
  },
  storePrice: {
    color: '#FFFFFF',
    fontSize: fontScale(20),
    fontWeight: '700',
  },
  storeBuyButton: {
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    paddingHorizontal: scale(18),
    paddingVertical: scale(10),
    borderRadius: scale(10),
  },
  storeBuyButtonText: {
    color: '#FFFFFF',
    fontSize: fontScale(13),
    fontWeight: '600',
  },
  
  // Perks Grid
  perksGrid: {
    gap: scale(14),
  },
  perkCard: {
    borderRadius: scale(16),
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.15)',
  },
  perkCardDark: {
    // Additional dark mode styles if needed
  },
  perkCardGradient: {
    padding: scale(18),
  },
  perkCardContent: {
    flex: 1,
  },
  perkHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: scale(12),
  },
  perkTitleContainer: {
    flex: 1,
  },
  perkIconContainer: {
    width: scale(64),
    height: scale(64),
    borderRadius: scale(32),
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: scale(12),
  },
  perkImage: {
    width: scale(48),
    height: scale(48),
    resizeMode: 'contain',
  },
  perkOwnedBadgeTopRight: {
    position: 'absolute',
    top: scale(12),
    right: scale(18),
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(16, 185, 129, 0.2)',
    paddingHorizontal: scale(8),
    paddingVertical: 2,
    borderRadius: scale(6),
    zIndex: 10,
  },
  perkOwnedText: {
    color: '#10B981',
    fontSize: fontScale(10),
    fontWeight: '700',
    marginLeft: 4,
  },
  perkName: {
    fontSize: fontScale(18),
    fontWeight: '700',
    color: '#FFFFFF',
    marginBottom: scale(4),
  },
  perkDescription: {
    fontSize: fontScale(14),
    color: 'rgba(255, 255, 255, 0.8)',
    lineHeight: fontScale(20),
  },
  perkFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: scale(12),
    paddingTop: scale(12),
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.1)',
  },
  perkPrice: {
    color: '#FFFFFF',
    fontSize: fontScale(20),
    fontWeight: '700',
    flex: 1,
  },
  perkBuyButton: {
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    paddingHorizontal: scale(18),
    paddingVertical: scale(10),
    borderRadius: scale(10),
  },
  perkBuyButtonText: {
    color: '#FFFFFF',
    fontSize: fontScale(13),
    fontWeight: '600',
  },
  
  // Gem Packs Grid
  gemPacksGrid: {
    gap: scale(14),
  },
  gemPackCard: {
    borderRadius: scale(16),
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.15)',
  },
  gemPackCardDark: {
    // Additional dark mode styles if needed
  },
  gemPackCardGradient: {
    padding: scale(18),
    position: 'relative',
  },
  popularBadgeTopLeft: {
    position: 'absolute',
    top: scale(12),
    left: scale(18),
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#8B5CF6',
    paddingHorizontal: scale(8),
    paddingVertical: 4,
    borderRadius: scale(6),
    zIndex: 10,
  },
  popularText: {
    color: '#FFFFFF',
    fontSize: fontScale(10),
    fontWeight: '700',
    marginLeft: 4,
  },
  bestValueBadgeTopLeft: {
    position: 'absolute',
    top: scale(12),
    left: scale(18),
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F59E0B',
    paddingHorizontal: scale(8),
    paddingVertical: 4,
    borderRadius: scale(6),
    zIndex: 10,
  },
  bestValueText: {
    color: '#FFFFFF',
    fontSize: fontScale(10),
    fontWeight: '700',
    marginLeft: 4,
  },
  gemPackContent: {
    flex: 1,
  },
  gemPackHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: scale(12),
  },
  gemPackIconContainer: {
    width: scale(64),
    height: scale(64),
    borderRadius: scale(32),
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: scale(12),
  },
  gemPackImageIcon: {
    width: scale(48),
    height: scale(48),
    resizeMode: 'contain',
  },
  gemPackInfo: {
    flex: 1,
  },
  gemPackName: {
    fontSize: fontScale(18),
    fontWeight: '700',
    color: '#FFFFFF',
    marginBottom: scale(4),
  },
  gemPackDescription: {
    fontSize: fontScale(14),
    color: 'rgba(255, 255, 255, 0.8)',
    lineHeight: fontScale(20),
  },
  gemPackFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: scale(12),
    paddingTop: scale(12),
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.1)',
  },
  gemPackPriceContainer: {
    flex: 1,
  },
  gemPackPrice: {
    color: '#FFFFFF',
    fontSize: fontScale(20),
    fontWeight: '700',
    marginBottom: scale(4),
  },
  gemPackGemsDisplay: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  gemPackGemsText: {
    color: 'rgba(255, 255, 255, 0.9)',
    fontSize: fontScale(12),
    fontWeight: '600',
    marginLeft: scale(6),
  },
  gemPackBuyButton: {
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    paddingHorizontal: scale(18),
    paddingVertical: scale(10),
    borderRadius: scale(10),
  },
  gemPackBuyButtonText: {
    color: '#FFFFFF',
    fontSize: fontScale(13),
    fontWeight: '600',
  },
  storeBuyButtonDisabled: {
    backgroundColor: 'rgba(128, 128, 128, 0.3)',
    opacity: 0.6,
  },
  perkBuyButtonDisabled: {
    backgroundColor: 'rgba(128, 128, 128, 0.3)',
    opacity: 0.6,
  },
  gemPackBuyButtonDisabled: {
    backgroundColor: 'rgba(128, 128, 128, 0.3)',
    opacity: 0.6,
  },
  
  // Footer and Restore Button
  footer: {
    paddingHorizontal: scale(20),
    paddingVertical: scale(16),
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.1)',
  },
  footerDark: {
    // Additional dark mode styles if needed
  },
  restoreButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: scale(12),
    gap: scale(8),
  },
  restoreButtonText: {
    color: '#6B7280',
    fontSize: fontScale(14),
    fontWeight: '500',
  },
  restoreButtonTextDisabled: {
    color: '#9CA3AF',
  },
  restoreButtonTextDark: {
    color: '#9CA3AF',
  },
});

export default React.memo(GemShopModal);

