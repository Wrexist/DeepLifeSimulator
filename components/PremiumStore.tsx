import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  Dimensions,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { 
  Crown, 
  Gem, 
  Star, 
  Zap, 
  Shield, 
  Gift,
  X,
  RefreshCw,
  CheckCircle,
  TrendingUp,
  ArrowRightCircle,
} from 'lucide-react-native';
import { iapService, IAPState } from '@/services/IAPService';
import { getProductConfig, IAP_PRODUCTS, isPopularProduct, isBestValueProduct } from '@/utils/iapConfig';
import { useGame } from '@/contexts/GameContext';

const { width: screenWidth } = Dimensions.get('window');

interface PremiumStoreProps {
  visible: boolean;
  onClose: () => void;
}

export default function PremiumStore({ visible, onClose }: PremiumStoreProps) {
  const [iapState, setIapState] = useState<IAPState>(iapService.getState());
  const [purchasingProduct, setPurchasingProduct] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'iap' | 'gems' | 'perks'>('iap');
  const { gameState, buyGoldUpgrade, setGameState, savePermanentPerk, hasPermanentPerk } = useGame();

  useEffect(() => {
    const unsubscribe = iapService.addListener(setIapState);
    return unsubscribe;
  }, []);

  const handlePurchase = async (productId: string) => {
    try {
      setPurchasingProduct(productId);
      
      const result = await iapService.purchaseProduct(productId);
      
      if (result.success) {
        Alert.alert(
          'Purchase Successful!',
          'Thank you for your purchase! Your items have been added to your account.',
          [{ text: 'OK', onPress: onClose }]
        );
      } else {
        Alert.alert(
          'Purchase Failed',
          result.message || 'Something went wrong with your purchase. Please try again.',
          [{ text: 'OK' }]
        );
      }
    } catch (error) {
      console.error('Purchase error:', error);
      Alert.alert(
        'Purchase Error',
        'An unexpected error occurred. Please try again.',
        [{ text: 'OK' }]
      );
    } finally {
      setPurchasingProduct(null);
    }
  };

  const handleGemPurchase = (upgradeId: string, price: number) => {
    if (gameState.stats.gems < price) {
      Alert.alert('Not enough gems', 'You need more gems to purchase this upgrade.');
      return;
    }
    
    buyGoldUpgrade(upgradeId);
    Alert.alert('Purchase successful', 'Your upgrade has been applied!');
  };

  const handlePerkPurchase = async (productId: string) => {
    try {
      // Check if perk is already owned (permanent perks)
      const config = getProductConfig(productId);
      const perkIds: string[] = [];
      
      if (config?.workBoost) perkIds.push('workBoost');
      if (config?.mindset) perkIds.push('mindset');
      if (config?.fastLearner) perkIds.push('fastLearner');
      if (config?.goodCredit) perkIds.push('goodCredit');
      if (config?.allPerks) perkIds.push('workBoost', 'mindset', 'fastLearner', 'goodCredit');
      
      // Check if any of these perks are already owned
      const alreadyOwned = await Promise.all(perkIds.map(id => hasPermanentPerk(id)));
      if (alreadyOwned.some(owned => owned)) {
        Alert.alert(
          'Already Owned',
          'You already own this perk! It will carry over to all your lives automatically.',
          [{ text: 'OK' }]
        );
        return;
      }
      
      setPurchasingProduct(productId);
      
      const result = await iapService.purchaseProduct(productId);
      
      if (result.success) {
        // Apply the perk to the game state AND save as permanent
        if (config?.workBoost) {
          await savePermanentPerk('workBoost');
          setGameState(prev => ({
            ...prev,
            perks: { ...prev.perks, workBoost: true }
          }));
        } else if (config?.mindset) {
          await savePermanentPerk('mindset');
          setGameState(prev => ({
            ...prev,
            perks: { ...prev.perks, mindset: true }
          }));
        } else if (config?.fastLearner) {
          await savePermanentPerk('fastLearner');
          setGameState(prev => ({
            ...prev,
            perks: { ...prev.perks, fastLearner: true }
          }));
        } else if (config?.goodCredit) {
          await savePermanentPerk('goodCredit');
          setGameState(prev => ({
            ...prev,
            perks: { ...prev.perks, goodCredit: true }
          }));
        } else if (config?.allPerks) {
          await Promise.all([
            savePermanentPerk('workBoost'),
            savePermanentPerk('mindset'),
            savePermanentPerk('fastLearner'),
            savePermanentPerk('goodCredit')
          ]);
          setGameState(prev => ({
            ...prev,
            perks: { 
              ...prev.perks, 
              workBoost: true, 
              mindset: true, 
              fastLearner: true, 
              goodCredit: true 
            }
          }));
        }
        
        Alert.alert(
          'Purchase Successful!',
          'Your perk has been unlocked permanently! It will carry over to all future lives.',
          [{ text: 'OK' }]
        );
      } else {
        Alert.alert(
          'Purchase Failed',
          result.message || 'Something went wrong with your purchase. Please try again.',
          [{ text: 'OK' }]
        );
      }
    } catch (error) {
      console.error('Perk purchase error:', error);
      Alert.alert(
        'Purchase Error',
        'An unexpected error occurred. Please try again.',
        [{ text: 'OK' }]
      );
    } finally {
      setPurchasingProduct(null);
    }
  };

  const handleRestorePurchases = async () => {
    try {
      const success = await iapService.restorePurchases();
      if (success) {
        onClose();
      }
    } catch (error) {
      console.error('Restore error:', error);
    }
  };

  const renderProductCard = (productId: string) => {
    const product = iapState.products.find(p => p.productId === productId);
    const config = getProductConfig(productId);
    const isPopular = isPopularProduct(productId);
    const isBestValue = isBestValueProduct(productId);
    const hasPurchased = iapService.hasPurchased(productId);

    if (!config) return null;

    return (
      <View key={productId} style={styles.productCard}>
        <LinearGradient
          colors={isPopular ? ['#FFD700', '#FFA500'] : ['#1F2937', '#374151']}
          style={styles.productGradient}
        >
          {/* Popular/Best Value Badge */}
          {(isPopular || isBestValue) && (
            <View style={styles.badgeContainer}>
              <LinearGradient
                colors={isPopular ? ['#FF6B6B', '#FF8E53'] : ['#4ECDC4', '#44A08D']}
                style={styles.badge}
              >
                <Text style={styles.badgeText}>
                  {isPopular ? 'POPULAR' : 'BEST VALUE'}
                </Text>
              </LinearGradient>
            </View>
          )}

          {/* Product Icon */}
          <View style={styles.productIconContainer}>
            {productId.includes('gems') && <Gem size={32} color="#FFD700" />}
            {productId.includes('premium') && <Crown size={32} color="#FFD700" />}
            {productId.includes('starter') && <Gift size={32} color="#FF6B6B" />}
            {productId.includes('remove_ads') && <Shield size={32} color="#4ECDC4" />}
            {productId.includes('double_money') && <Zap size={32} color="#FFD93D" />}
            {productId.includes('unlimited_energy') && <Star size={32} color="#6C5CE7" />}
            {productId.includes('work_boost') && <TrendingUp size={32} color="#10B981" />}
            {productId.includes('mindset') && <Zap size={32} color="#F59E0B" />}
            {productId.includes('fast_learner') && <Star size={32} color="#3B82F6" />}
            {productId.includes('good_credit') && <Shield size={32} color="#8B5CF6" />}
            {productId.includes('unlock_all_perks') && <Crown size={32} color="#EF4444" />}
          </View>

          {/* Product Info */}
          <View style={styles.productInfo}>
            <Text style={styles.productName}>{config.name}</Text>
            <Text style={styles.productDescription}>{config.description}</Text>
            
            {/* Product Features */}
            {config.features && (
              <View style={styles.featuresContainer}>
                {config.features.map((feature, index) => (
                  <View key={index} style={styles.featureItem}>
                    <CheckCircle size={16} color="#10B981" />
                    <Text style={styles.featureText}>{feature}</Text>
                  </View>
                ))}
              </View>
            )}

            {/* Product Rewards */}
            {(config.gems || config.money) && (
              <View style={styles.rewardsContainer}>
                {config.gems && (
                  <View style={styles.rewardItem}>
                    <Gem size={20} color="#FFD700" />
                    <Text style={styles.rewardText}>{config.gems} Gems</Text>
                  </View>
                )}
                {config.money && (
                  <View style={styles.rewardItem}>
                    <Text style={styles.moneyIcon}>$</Text>
                    <Text style={styles.rewardText}>{config.money.toLocaleString()}</Text>
                  </View>
                )}
              </View>
            )}
          </View>

          {/* Purchase Button */}
          <TouchableOpacity
            style={[
              styles.purchaseButton,
              hasPurchased && styles.purchasedButton
            ]}
            onPress={() => {
              if (!hasPurchased) {
                // Check if this is a perk
                const isPerk = config?.workBoost || config?.mindset || config?.fastLearner || 
                              config?.goodCredit || config?.allPerks;
                if (isPerk) {
                  handlePerkPurchase(productId);
                } else {
                  handlePurchase(productId);
                }
              }
            }}
            disabled={hasPurchased || purchasingProduct === productId}
          >
            <LinearGradient
              colors={hasPurchased ? ['#10B981', '#059669'] : ['#3B82F6', '#1D4ED8']}
              style={styles.purchaseButtonGradient}
            >
              {purchasingProduct === productId ? (
                <ActivityIndicator color="#FFFFFF" size="small" />
              ) : hasPurchased ? (
                <>
                  <CheckCircle size={20} color="#FFFFFF" />
                  <Text style={styles.purchaseButtonText}>Purchased</Text>
                </>
              ) : (
                <>
                  <Text style={styles.purchaseButtonText}>
                    {product?.localizedPrice || config.price}
                  </Text>
                </>
              )}
            </LinearGradient>
          </TouchableOpacity>
        </LinearGradient>
      </View>
    );
  };

  const renderGemUpgradeCard = (upgradeId: string) => {
    const config = getProductConfig(upgradeId);
    if (!config || config.type !== 'gem_upgrade') return null;

    const canAfford = gameState.stats.gems >= config.gems;
    const Icon = upgradeId === 'multiplier' ? TrendingUp : 
                 upgradeId === 'skip_week' ? ArrowRightCircle : Gift;

    return (
      <View key={upgradeId} style={styles.productCard}>
        <LinearGradient
          colors={['#1F2937', '#374151']}
          style={styles.productGradient}
        >
          {/* Product Icon */}
          <View style={styles.productIconContainer}>
            <Icon size={32} color="#FFD700" />
          </View>

          {/* Product Info */}
          <View style={styles.productInfo}>
            <Text style={styles.productName}>{config.name}</Text>
            <Text style={styles.productDescription}>{config.description}</Text>
          </View>

          {/* Purchase Button */}
          <TouchableOpacity
            style={[
              styles.purchaseButton,
              !canAfford && styles.disabledButton
            ]}
            onPress={() => canAfford && handleGemPurchase(upgradeId, config.gems)}
            disabled={!canAfford}
          >
            <LinearGradient
              colors={canAfford ? ['#FFD700', '#FFA500'] : ['#6B7280', '#4B5563']}
              style={styles.purchaseButtonGradient}
            >
              <Gem size={20} color="#FFFFFF" />
              <Text style={styles.purchaseButtonText}>
                {config.gems.toLocaleString()} Gems
              </Text>
            </LinearGradient>
          </TouchableOpacity>
        </LinearGradient>
      </View>
    );
  };

  if (!visible) return null;

  return (
    <View style={styles.container}>
      <LinearGradient
        colors={['#0F172A', '#1E293B']}
        style={styles.background}
      >
        {/* Header */}
        <View style={styles.header}>
          <View style={styles.headerContent}>
            <Crown size={32} color="#FFD700" />
            <Text style={styles.headerTitle}>Premium Store</Text>
          </View>
          <TouchableOpacity style={styles.closeButton} onPress={onClose}>
            <X size={24} color="#FFFFFF" />
          </TouchableOpacity>
        </View>

        {/* Current Balance */}
        <View style={styles.balanceContainer}>
          <LinearGradient
            colors={['#FFD700', '#FFA500']}
            style={styles.balanceGradient}
          >
            <View style={styles.balanceItem}>
              <Gem size={24} color="#FFFFFF" />
              <Text style={styles.balanceText}>{gameState.stats.gems || 0}</Text>
            </View>
            <View style={styles.balanceItem}>
              <Text style={styles.moneyIcon}>$</Text>
              <Text style={styles.balanceText}>
                {(gameState.stats.money || 0).toLocaleString()}
              </Text>
            </View>
          </LinearGradient>
        </View>

        {/* Tabs */}
        <View style={styles.tabContainer}>
          <TouchableOpacity
            style={[styles.tab, activeTab === 'iap' && styles.activeTab]}
            onPress={() => setActiveTab('iap')}
          >
            <Text style={[styles.tabText, activeTab === 'iap' && styles.activeTabText]}>
              Premium Store
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.tab, activeTab === 'gems' && styles.activeTab]}
            onPress={() => setActiveTab('gems')}
          >
            <Text style={[styles.tabText, activeTab === 'gems' && styles.activeTabText]}>
              Gem Upgrades
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.tab, activeTab === 'perks' && styles.activeTab]}
            onPress={() => setActiveTab('perks')}
          >
            <Text style={[styles.tabText, activeTab === 'perks' && styles.activeTabText]}>
              Perks
            </Text>
          </TouchableOpacity>
        </View>

        {/* Products */}
        <ScrollView style={styles.productsContainer} showsVerticalScrollIndicator={false}>
          <View style={styles.productsGrid}>
            {activeTab === 'iap' ? (
              // IAP Products (excluding perks and gem upgrades)
              Object.values(IAP_PRODUCTS)
                .filter(productId => {
                  const config = getProductConfig(productId);
                  return !config?.type && !config?.workBoost && !config?.mindset && 
                         !config?.fastLearner && !config?.goodCredit && !config?.allPerks;
                })
                .map(productId => renderProductCard(productId))
            ) : activeTab === 'gems' ? (
              // Gem Upgrades
              Object.values(IAP_PRODUCTS)
                .filter(productId => getProductConfig(productId)?.type === 'gem_upgrade')
                .map(productId => renderGemUpgradeCard(productId))
            ) : (
              // Perks IAP
              Object.values(IAP_PRODUCTS)
                .filter(productId => {
                  const config = getProductConfig(productId);
                  return config?.workBoost || config?.mindset || config?.fastLearner || 
                         config?.goodCredit || config?.allPerks;
                })
                .map(productId => renderProductCard(productId))
            )}
          </View>
        </ScrollView>

        {/* Footer */}
        <View style={styles.footer}>
          <TouchableOpacity
            style={styles.restoreButton}
            onPress={handleRestorePurchases}
            disabled={iapState.isLoading}
          >
            <RefreshCw size={20} color="#6B7280" />
            <Text style={styles.restoreButtonText}>Restore Purchases</Text>
          </TouchableOpacity>
          
          {iapState.error && (
            <Text style={styles.errorText}>{iapState.error}</Text>
          )}
        </View>
      </LinearGradient>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 1000,
  },
  background: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 60,
    paddingBottom: 20,
  },
  headerContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#FFFFFF',
    marginLeft: 12,
  },
  closeButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  balanceContainer: {
    paddingHorizontal: 20,
    marginBottom: 20,
  },
  balanceGradient: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingVertical: 16,
    paddingHorizontal: 20,
    borderRadius: 16,
  },
  balanceItem: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  balanceText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#FFFFFF',
    marginLeft: 8,
  },
  moneyIcon: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#FFFFFF',
  },
  tabContainer: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingHorizontal: 20,
    marginBottom: 20,
  },
  tab: {
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  activeTab: {
    borderColor: '#FFD700',
    borderWidth: 1,
  },
  tabText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#D1D5DB',
  },
  activeTabText: {
    color: '#FFD700',
  },
  productsContainer: {
    flex: 1,
    paddingHorizontal: 20,
  },
  productsGrid: {
    gap: 16,
  },
  productCard: {
    borderRadius: 16,
    overflow: 'hidden',
    boxShadow: '0px 4px 8px rgba(0, 0, 0, 0.3)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  productGradient: {
    padding: 20,
  },
  badgeContainer: {
    position: 'absolute',
    top: 12,
    right: 12,
    zIndex: 1,
  },
  badge: {
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
  },
  badgeText: {
    fontSize: 10,
    fontWeight: 'bold',
    color: '#FFFFFF',
  },
  productIconContainer: {
    alignItems: 'center',
    marginBottom: 16,
  },
  productInfo: {
    marginBottom: 20,
  },
  productName: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#FFFFFF',
    textAlign: 'center',
    marginBottom: 8,
  },
  productDescription: {
    fontSize: 14,
    color: '#D1D5DB',
    textAlign: 'center',
    marginBottom: 12,
  },
  featuresContainer: {
    marginBottom: 12,
  },
  featureItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  featureText: {
    fontSize: 12,
    color: '#D1D5DB',
    marginLeft: 8,
  },
  rewardsContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 20,
  },
  rewardItem: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  rewardText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#FFD700',
    marginLeft: 4,
  },
  purchaseButton: {
    borderRadius: 12,
    overflow: 'hidden',
  },
  purchasedButton: {
    opacity: 0.7,
  },
  purchaseButtonGradient: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 20,
  },
  purchaseButtonText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#FFFFFF',
    marginLeft: 8,
  },
  disabledButton: {
    opacity: 0.5,
  },
  footer: {
    paddingHorizontal: 20,
    paddingBottom: 40,
    alignItems: 'center',
  },
  restoreButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 20,
  },
  restoreButtonText: {
    fontSize: 14,
    color: '#6B7280',
    marginLeft: 8,
  },
  errorText: {
    fontSize: 12,
    color: '#EF4444',
    textAlign: 'center',
    marginTop: 8,
  },
});
