import React, { useState } from 'react';
import { Modal, View, Text, StyleSheet, TouchableOpacity, Alert, ScrollView, Dimensions, Image } from 'react-native';
import { useGame } from '@/contexts/GameContext';
import { X, TrendingUp, ArrowRightCircle, Gift, Gem, Star, Zap, Shield, Crown, CheckCircle, Sparkles, Diamond, Coins, Award, Heart, RefreshCw } from 'lucide-react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
import { responsivePadding, responsiveFontSize, responsiveSpacing, responsiveBorderRadius, scale, verticalScale } from '@/utils/scaling';
import { iapService } from '@/services/IAPService';
import { IAP_PRODUCTS, getProductConfig } from '@/utils/iapConfig';

interface GemShopModalProps {
  visible: boolean;
  onClose: () => void;
}

const { width } = Dimensions.get('window');

export default function GemShopModal({ visible, onClose }: GemShopModalProps) {
  const { gameState, buyGoldUpgrade, setGameState, saveGame } = useGame();
  const { settings } = gameState;
  const [tab, setTab] = useState<'upgrades' | 'store' | 'perks' | 'gems'>('upgrades');
  const [iapLoading, setIapLoading] = useState(false);

  const items = [
    {
      id: 'multiplier',
      name: 'Money Multiplier',
      description: 'All earnings increased by 50% forever',
      price: 10000,
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
      price: 15000,
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
      price: 12000,
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
      price: 18000,
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
      price: 30000,
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
      price: 50000,
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
      price: 100000,
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
      description: 'All 4 perks - Save 12%',
      price: '$6.99',
      icon: Crown,
      value: 'allPerks',
      owned: gameState.goldUpgrades?.work_boost && gameState.goldUpgrades?.mindset && gameState.goldUpgrades?.fast_learner && gameState.goldUpgrades?.good_credit || false,
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
      owned: gameState.goldUpgrades?.work_boost || false,
      gradient: ['#10B981', '#059669'],
      image: require('@/assets/images/iap/perks/work_pay_boost.png'),
    },
    {
      id: IAP_PRODUCTS.MINDSET,
      name: 'Mindset',
      description: '50% faster promotions',
      price: '$1.99',
      icon: Zap,
      value: 'mindset',
      owned: gameState.goldUpgrades?.mindset || false,
      gradient: ['#F59E0B', '#D97706'],
      image: require('@/assets/images/iap/perks/mindset.png'),
    },
    {
      id: IAP_PRODUCTS.FAST_LEARNER,
      name: 'Fast Learner',
      description: '50% faster education',
      price: '$1.99',
      icon: Star,
      value: 'fastLearner',
      owned: gameState.goldUpgrades?.fast_learner || false,
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
      owned: gameState.goldUpgrades?.good_credit || false,
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

  const handleBuy = (id: string, price: number) => {
    if (gameState.stats.gems < price) {
      Alert.alert('Insufficient Gems', 'You need more gems to purchase this upgrade.');
      return;
    }
    buyGoldUpgrade(id);
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
              console.log(`Attempting to purchase: ${id} (${name})`);
              
              // Use IAP service for purchase
              const result = await iapService.purchaseProduct(id);
              
              if (result.success) {
                // Apply the purchase benefits locally for immediate feedback
                await applyPurchaseBenefits(id);
                
                // Show success message with more details
                const successMessage = result.message || 'Purchase completed! Your items have been added to your account.';
                Alert.alert('Purchase Successful! 🎉', successMessage);
              } else {
                // Show detailed error message from IAP service
                const errorMessage = result.message || 'Unable to complete purchase. Please try again.';
                
                // Don't show error for cancelled purchases (user intentionally cancelled)
                if (!errorMessage.includes('cancelled')) {
                  Alert.alert('Purchase Failed', errorMessage);
                }
              }
            } catch (error) {
              console.error('Purchase error:', error);
              
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

  const applyPurchaseBenefits = async (productId: string) => {
    const config = getProductConfig(productId);
    if (!config) return;

    // Apply benefits based on product type
    if (config.gems) {
      setGameState(prev => ({
        ...prev,
        stats: {
          ...prev.stats,
          gems: prev.stats.gems + config.gems
        }
      }));
    }

    if (config.youthPills) {
      setGameState(prev => ({
        ...prev,
        youthPills: (prev.youthPills || 0) + config.youthPills
      }));
    }

    if (config.moneyMultiplier) {
      setGameState(prev => ({
        ...prev,
        settings: { ...prev.settings, moneyMultiplier: true }
      }));
    }

    if (config.allUpgrades) {
      setGameState(prev => ({
        ...prev,
        goldUpgrades: {
          ...prev.goldUpgrades,
          multiplier: true,
          energy_boost: true,
          happiness_boost: true,
          fitness_boost: true,
          skill_mastery: true,
          time_machine: true,
          immortality: true,
        }
      }));
    }

    if (config.everythingUnlocked) {
      setGameState(prev => ({
        ...prev,
        settings: { 
          ...prev.settings, 
          everythingUnlocked: true,
          adsRemoved: true,
          lifetimePremium: true
        },
        goldUpgrades: {
          ...prev.goldUpgrades,
          multiplier: true,
          energy_boost: true,
          happiness_boost: true,
          fitness_boost: true,
          skill_mastery: true,
          time_machine: true,
          immortality: true,
        }
      }));
    }

    // Save the game state
    await saveGame();
  };

  const handleRestorePurchases = async () => {
    if (iapLoading) {
      Alert.alert('Please Wait', 'A purchase operation is already in progress.');
      return;
    }

    setIapLoading(true);
    
    try {
      console.log('Starting purchase restoration...');
      const success = await iapService.restorePurchases();
      
      if (success) {
        // Reload IAP state to refresh purchases
        await iapService.loadPurchases();
        
        // Show success message
        Alert.alert(
          'Purchases Restored',
          'Your previous purchases have been restored successfully!',
          [{ text: 'OK', style: 'default' }]
        );
      }
    } catch (error) {
      console.error('Restore purchases error:', error);
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
    { id: 'upgrades', label: 'Upgrades', icon: TrendingUp },
    { id: 'gems', label: 'Gems', icon: Gem },
    { id: 'store', label: 'Packs', icon: Gift },
    { id: 'perks', label: 'Perks', icon: Star },
  ];

  const renderUpgradeCard = (item: any) => {
    const Icon = item.icon;
    const afford = gameState.stats.gems >= item.price;
    const isOwned = item.owned;
    
    return (
      <View key={item.id} style={[styles.upgradeCard, settings.darkMode && styles.upgradeCardDark]}>
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
      <View key={item.id} style={[styles.storeCard, settings.darkMode && styles.storeCardDark]}>
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
      <View key={item.id} style={[styles.perkCard, settings.darkMode && styles.perkCardDark]}>
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
      <View key={item.id} style={[styles.gemPackCard, settings.darkMode && styles.gemPackCardDark]}>
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

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={[styles.modal, settings.darkMode && styles.modalDark]}>
          {/* Header */}
          <BlurView intensity={20} style={styles.headerBlur}>
            <LinearGradient
              colors={settings.darkMode ? ['rgba(99, 102, 241, 0.1)', 'rgba(79, 70, 229, 0.1)'] : ['rgba(99, 102, 241, 0.05)', 'rgba(79, 70, 229, 0.05)']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.headerGradient}
            >
              <View style={styles.header}>
                <View style={styles.headerLeft}>
                  <View style={styles.headerIconContainer}>
                    <Gem size={24} color="#6366F1" />
                    <Sparkles size={12} color="#6366F1" style={styles.sparkleIcon} />
                  </View>
                  <View>
                    <Text style={[styles.title, settings.darkMode && styles.titleDark]}>Gem Shop</Text>
                    <View style={styles.gemBalance}>
                      <Gem size={16} color="#6366F1" />
                      <Text style={[styles.gemBalanceText, settings.darkMode && styles.gemBalanceTextDark]}>
                        {gameState.stats.gems.toLocaleString()}
                      </Text>
                    </View>
                  </View>
                </View>
                <TouchableOpacity onPress={onClose} style={styles.closeButton}>
                  <X size={24} color={settings.darkMode ? '#D1D5DB' : '#6B7280'} />
                </TouchableOpacity>
              </View>
            </LinearGradient>
          </BlurView>

          {/* Tabs */}
          <View style={[styles.tabsContainer, settings.darkMode && styles.tabsContainerDark]}>
            {tabs.map((tabItem) => {
              const Icon = tabItem.icon;
              const isActive = tab === tabItem.id;
              
              return (
                <TouchableOpacity
                  key={tabItem.id}
                  style={[styles.tab, isActive && styles.activeTab]}
                  onPress={() => setTab(tabItem.id as any)}
                >
                  <Icon size={20} color={isActive ? '#6366F1' : (settings.darkMode ? '#9CA3AF' : '#6B7280')} />
                  <Text style={[
                    styles.tabText,
                    isActive && styles.activeTabText,
                    settings.darkMode && styles.tabTextDark
                  ]}>
                    {tabItem.label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>

          {/* Content */}
          <ScrollView 
            style={styles.content}
            showsVerticalScrollIndicator={true}
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
          <View style={[styles.footer, settings.darkMode && styles.footerDark]}>
            <TouchableOpacity
              style={styles.restoreButton}
              onPress={handleRestorePurchases}
              disabled={iapLoading}
            >
              <RefreshCw size={18} color={iapLoading ? '#9CA3AF' : '#6B7280'} />
              <Text style={[styles.restoreButtonText, iapLoading && styles.restoreButtonTextDisabled]}>
                {iapLoading ? 'Restoring...' : 'Restore Purchases'}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: responsivePadding.horizontal,
  },
  modal: {
    backgroundColor: '#FFFFFF',
    borderRadius: responsiveBorderRadius.lg,
    width: '95%',
    height: '90%',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.25,
    shadowRadius: 20,
    elevation: 10,
  },
  modalDark: {
    backgroundColor: '#1F2937',
  },
  headerBlur: {
    borderTopLeftRadius: responsiveBorderRadius.lg,
    borderTopRightRadius: responsiveBorderRadius.lg,
    overflow: 'hidden',
  },
  headerGradient: {
    padding: responsiveSpacing.lg,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  headerIconContainer: {
    position: 'relative',
    marginRight: responsiveSpacing.md,
  },
  sparkleIcon: {
    position: 'absolute',
    top: -2,
    right: -2,
    backgroundColor: '#FFFFFF',
    borderRadius: 8,
    padding: 2,
  },
  title: {
    fontSize: responsiveFontSize.xl,
    fontWeight: '700',
    color: '#1F2937',
  },
  titleDark: {
    color: '#FFFFFF',
  },
  gemBalance: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: responsiveSpacing.xs,
  },
  gemBalanceText: {
    fontSize: responsiveFontSize.sm,
    color: '#6B7280',
    marginLeft: responsiveSpacing.xs,
    fontWeight: '600',
  },
  gemBalanceTextDark: {
    color: '#9CA3AF',
  },
  closeButton: {
    padding: responsiveSpacing.sm,
  },
  tabsContainer: {
    flexDirection: 'row',
    backgroundColor: '#F9FAFB',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  tabsContainerDark: {
    backgroundColor: '#374151',
    borderBottomColor: '#4B5563',
  },
  tab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: responsiveSpacing.md,
    paddingHorizontal: responsiveSpacing.xs,
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  activeTab: {
    borderBottomColor: '#6366F1',
    backgroundColor: 'rgba(99, 102, 241, 0.05)',
  },
  tabText: {
    fontSize: responsiveFontSize.sm,
    fontWeight: '600',
    color: '#6B7280',
    marginLeft: responsiveSpacing.xs,
    flexShrink: 1,
    textAlign: 'center',
  },
  tabTextDark: {
    color: '#9CA3AF',
  },
  activeTabText: {
    color: '#6366F1',
  },
  content: {
    flex: 1,
  },
  scrollContent: {
    padding: responsiveSpacing.lg,
  },
  
  // Upgrades Grid
  upgradesGrid: {
    gap: responsiveSpacing.md,
  },
  upgradeCard: {
    borderRadius: responsiveBorderRadius.lg,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  upgradeCardDark: {
    shadowColor: '#6366F1',
    shadowOpacity: 0.2,
  },
  upgradeCardGradient: {
    padding: responsiveSpacing.lg,
  },
  upgradeCardContent: {
    flex: 1,
  },
  upgradeHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: responsiveSpacing.md,
  },
  upgradeTitleContainer: {
    flex: 1,
    marginLeft: responsiveSpacing.md,
  },
  upgradeIconContainer: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  upgradeImage: {
    width: 32,
    height: 32,
    resizeMode: 'contain',
  },
  upgradeActions: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  permanentBadgeTopLeft: {
    position: 'absolute',
    top: responsiveSpacing.sm,
    left: responsiveSpacing.md,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    paddingHorizontal: responsiveSpacing.sm,
    paddingVertical: 4,
    borderRadius: responsiveBorderRadius.sm,
    zIndex: 10,
  },
  permanentText: {
    color: '#FFFFFF',
    fontSize: responsiveFontSize.xs,
    fontWeight: '700',
  },
  ownedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(16, 185, 129, 0.2)',
    paddingHorizontal: responsiveSpacing.xs,
    paddingVertical: 2,
    borderRadius: responsiveBorderRadius.sm,
  },
  ownedText: {
    color: '#10B981',
    fontSize: responsiveFontSize.xs,
    fontWeight: '700',
    marginLeft: 4,
  },
  upgradeName: {
    fontSize: responsiveFontSize.lg,
    fontWeight: '700',
    color: '#FFFFFF',
    marginBottom: responsiveSpacing.xs,
  },
  upgradeDescription: {
    fontSize: responsiveFontSize.sm,
    color: 'rgba(255, 255, 255, 0.8)',
    lineHeight: responsiveFontSize.sm * 1.4,
  },
  upgradeCategory: {
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    paddingHorizontal: responsiveSpacing.sm,
    paddingVertical: 4,
    borderRadius: responsiveBorderRadius.sm,
  },
  upgradeCategoryText: {
    color: '#FFFFFF',
    fontSize: responsiveFontSize.xs,
    fontWeight: '600',
  },
  upgradeFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  priceContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  price: {
    fontSize: responsiveFontSize.base,
    fontWeight: '700',
    marginLeft: responsiveSpacing.xs,
  },
  buyButton: {
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    paddingHorizontal: responsiveSpacing.md,
    paddingVertical: responsiveSpacing.sm,
    borderRadius: responsiveBorderRadius.md,
  },
  buyButtonDisabled: {
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
  },
  buyButtonText: {
    color: '#FFFFFF',
    fontSize: responsiveFontSize.sm,
    fontWeight: '600',
  },
  buyButtonTextDisabled: {
    color: 'rgba(255, 255, 255, 0.5)',
  },
  
  // Store Grid
  storeGrid: {
    gap: responsiveSpacing.md,
  },
  storeCard: {
    borderRadius: responsiveBorderRadius.lg,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  storeCardDark: {
    shadowColor: '#6366F1',
    shadowOpacity: 0.2,
  },
  storeCardGradient: {
    padding: responsiveSpacing.lg,
    position: 'relative',
  },
  savingsBadgeTopLeft: {
    position: 'absolute',
    top: responsiveSpacing.sm,
    left: responsiveSpacing.md,
    backgroundColor: '#EF4444',
    paddingHorizontal: responsiveSpacing.sm,
    paddingVertical: 4,
    borderRadius: responsiveBorderRadius.sm,
    zIndex: 10,
  },
  savingsText: {
    color: '#FFFFFF',
    fontSize: responsiveFontSize.xs,
    fontWeight: '700',
  },
  storeCardContent: {
    flex: 1,
  },
  storeHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: responsiveSpacing.md,
  },
  storeIconContainer: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: responsiveSpacing.md,
  },
  storeTitleContainer: {
    flex: 1,
  },
  storeName: {
    fontSize: responsiveFontSize.xl,
    fontWeight: '700',
    color: '#FFFFFF',
    marginBottom: responsiveSpacing.xs,
  },
  storeDescription: {
    fontSize: responsiveFontSize.sm,
    color: 'rgba(255, 255, 255, 0.8)',
    marginBottom: responsiveSpacing.xs,
  },
  storeImage: {
    width: 48,
    height: 48,
    resizeMode: 'contain',
  },
  storeFeatures: {
    marginTop: responsiveSpacing.xs,
  },
  featureItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
  },
  featureText: {
    color: 'rgba(255, 255, 255, 0.9)',
    fontSize: responsiveFontSize.xs,
    marginLeft: responsiveSpacing.xs,
  },
  storeFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  storePriceContainer: {
    flex: 1,
  },
  originalPrice: {
    color: 'rgba(255, 255, 255, 0.6)',
    fontSize: responsiveFontSize.sm,
    textDecorationLine: 'line-through',
  },
  storePrice: {
    color: '#FFFFFF',
    fontSize: responsiveFontSize.xxl,
    fontWeight: '700',
  },
  storeBuyButton: {
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    paddingHorizontal: responsiveSpacing.lg,
    paddingVertical: responsiveSpacing.md,
    borderRadius: responsiveBorderRadius.md,
  },
  storeBuyButtonText: {
    color: '#FFFFFF',
    fontSize: responsiveFontSize.base,
    fontWeight: '600',
  },
  
  // Perks Grid
  perksGrid: {
    gap: responsiveSpacing.md,
  },
  perkCard: {
    borderRadius: responsiveBorderRadius.lg,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  perkCardDark: {
    shadowColor: '#6366F1',
    shadowOpacity: 0.2,
  },
  perkCardGradient: {
    padding: responsiveSpacing.lg,
  },
  perkCardContent: {
    flex: 1,
  },
  perkHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: responsiveSpacing.md,
  },
  perkTitleContainer: {
    flex: 1,
  },
  perkIconContainer: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: responsiveSpacing.md,
  },
  perkImage: {
    width: 48,
    height: 48,
    resizeMode: 'contain',
  },
  perkOwnedBadgeTopRight: {
    position: 'absolute',
    top: responsiveSpacing.sm,
    right: responsiveSpacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(16, 185, 129, 0.2)',
    paddingHorizontal: responsiveSpacing.xs,
    paddingVertical: 2,
    borderRadius: responsiveBorderRadius.sm,
    zIndex: 10,
  },
  perkOwnedText: {
    color: '#10B981',
    fontSize: responsiveFontSize.xs,
    fontWeight: '700',
    marginLeft: 4,
  },
  perkName: {
    fontSize: responsiveFontSize.xl,
    fontWeight: '700',
    color: '#FFFFFF',
    marginBottom: responsiveSpacing.xs,
  },
  perkDescription: {
    fontSize: responsiveFontSize.sm,
    color: 'rgba(255, 255, 255, 0.8)',
    lineHeight: responsiveFontSize.sm * 1.4,
  },
  perkFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  perkPrice: {
    color: '#FFFFFF',
    fontSize: responsiveFontSize.xxl,
    fontWeight: '700',
    flex: 1,
  },
  perkBuyButton: {
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    paddingHorizontal: responsiveSpacing.lg,
    paddingVertical: responsiveSpacing.md,
    borderRadius: responsiveBorderRadius.md,
  },
  perkBuyButtonText: {
    color: '#FFFFFF',
    fontSize: responsiveFontSize.base,
    fontWeight: '600',
  },
  
  // Gem Packs Grid
  gemPacksGrid: {
    gap: responsiveSpacing.md,
  },
  gemPackCard: {
    borderRadius: responsiveBorderRadius.lg,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  gemPackCardDark: {
    shadowColor: '#6366F1',
    shadowOpacity: 0.2,
  },
  gemPackCardGradient: {
    padding: responsiveSpacing.lg,
    position: 'relative',
  },
  popularBadgeTopLeft: {
    position: 'absolute',
    top: responsiveSpacing.sm,
    left: responsiveSpacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#8B5CF6',
    paddingHorizontal: responsiveSpacing.sm,
    paddingVertical: 4,
    borderRadius: responsiveBorderRadius.sm,
    zIndex: 10,
  },
  popularText: {
    color: '#FFFFFF',
    fontSize: responsiveFontSize.xs,
    fontWeight: '700',
    marginLeft: 4,
  },
  bestValueBadgeTopLeft: {
    position: 'absolute',
    top: responsiveSpacing.sm,
    left: responsiveSpacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F59E0B',
    paddingHorizontal: responsiveSpacing.sm,
    paddingVertical: 4,
    borderRadius: responsiveBorderRadius.sm,
    zIndex: 10,
  },
  bestValueText: {
    color: '#FFFFFF',
    fontSize: responsiveFontSize.xs,
    fontWeight: '700',
    marginLeft: 4,
  },
  gemPackContent: {
    flex: 1,
  },
  gemPackHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: responsiveSpacing.md,
  },
  gemPackIconContainer: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: responsiveSpacing.md,
  },
  gemPackImageIcon: {
    width: 48,
    height: 48,
    resizeMode: 'contain',
  },
  gemPackInfo: {
    flex: 1,
  },
  gemPackName: {
    fontSize: responsiveFontSize.xl,
    fontWeight: '700',
    color: '#FFFFFF',
    marginBottom: responsiveSpacing.xs,
  },
  gemPackDescription: {
    fontSize: responsiveFontSize.sm,
    color: 'rgba(255, 255, 255, 0.8)',
    lineHeight: responsiveFontSize.sm * 1.4,
  },
  gemPackFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  gemPackPriceContainer: {
    flex: 1,
  },
  gemPackPrice: {
    color: '#FFFFFF',
    fontSize: responsiveFontSize.xxl,
    fontWeight: '700',
    marginBottom: responsiveSpacing.xs,
  },
  gemPackGemsDisplay: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  gemPackGemsText: {
    color: 'rgba(255, 255, 255, 0.9)',
    fontSize: responsiveFontSize.sm,
    fontWeight: '600',
    marginLeft: responsiveSpacing.xs,
  },
  gemPackBuyButton: {
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    paddingHorizontal: responsiveSpacing.lg,
    paddingVertical: responsiveSpacing.md,
    borderRadius: responsiveBorderRadius.md,
  },
  gemPackBuyButtonText: {
    color: '#FFFFFF',
    fontSize: responsiveFontSize.base,
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
    paddingHorizontal: responsivePadding.lg,
    paddingVertical: responsivePadding.md,
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
    backgroundColor: '#FFFFFF',
  },
  footerDark: {
    borderTopColor: '#374151',
    backgroundColor: '#1F2937',
  },
  restoreButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: responsivePadding.sm,
    gap: responsiveSpacing.sm,
  },
  restoreButtonText: {
    color: '#6B7280',
    fontSize: responsiveFontSize.sm,
    fontWeight: '500',
    marginLeft: responsiveSpacing.xs,
  },
  restoreButtonTextDisabled: {
    color: '#9CA3AF',
  },
});