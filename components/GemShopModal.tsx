import React, { useState } from 'react';
import { Modal, View, Text, StyleSheet, TouchableOpacity, Alert, ScrollView } from 'react-native';
import { useGame } from '@/contexts/GameContext';
import { X, TrendingUp, ArrowRightCircle, Gift, Gem, Star } from 'lucide-react-native';
import { LinearGradient } from 'expo-linear-gradient';

interface GemShopModalProps {
  visible: boolean;
  onClose: () => void;
}

export default function GemShopModal({ visible, onClose }: GemShopModalProps) {
  const { gameState, buyGoldUpgrade } = useGame();
  const { settings } = gameState;
  const [tab, setTab] = useState<'upgrades' | 'store' | 'history'>('upgrades');

  const items = [
    {
      id: 'multiplier',
      name: 'Permanent Money Multiplier',
      description: 'All money earnings increased by 50% FOREVER! Transfers to all future lives and saves.',
      price: 10000,
      icon: TrendingUp,
      permanent: true,
      owned: gameState.goldUpgrades?.multiplier || false,
    },
    {
      id: 'energy_boost',
      name: 'Permanent Energy Boost',
      description: 'Maximum energy increased to 100. Transfers to future lives.',
      price: 15000,
      icon: TrendingUp,
      permanent: true,
      owned: gameState.goldUpgrades?.energy_boost || false,
    },
    {
      id: 'happiness_boost',
      name: 'Permanent Happiness Boost',
      description: 'Maximum happiness increased to 100. Transfers to future lives.',
      price: 12000,
      icon: TrendingUp,
      permanent: true,
      owned: gameState.goldUpgrades?.happiness_boost || false,
    },
    {
      id: 'fitness_boost',
      name: 'Permanent Fitness Boost',
      description: 'Maximum fitness increased to 100. Transfers to future lives.',
      price: 18000,
      icon: TrendingUp,
      permanent: true,
      owned: gameState.goldUpgrades?.fitness_boost || false,
    },
    {
      id: 'skill_mastery',
      name: 'Skill Mastery',
      description: 'All skills level up 50% faster. Transfers to future lives.',
      price: 30000,
      icon: TrendingUp,
      permanent: true,
      owned: gameState.goldUpgrades?.skill_mastery || false,
    },
    {
      id: 'time_machine',
      name: 'Time Machine',
      description: 'Travel back in time. Transfers to future lives.',
      price: 50000,
      icon: TrendingUp,
      permanent: true,
      owned: gameState.goldUpgrades?.time_machine || false,
    },
    {
      id: 'immortality',
      name: 'Immortality',
      description: 'Never die of old age. Transfers to all future lives.',
      price: 100000,
      icon: TrendingUp,
      permanent: true,
      owned: gameState.goldUpgrades?.immortality || false,
    },
    {
      id: 'skip_week',
      name: 'Skip Week',
      description: 'Jump ahead one week (one-time use)',
      price: 5000,
      icon: ArrowRightCircle,
      permanent: false,
      owned: false,
    },
    {
      id: 'youth_pill',
      name: 'Youth Pill',
      description: 'Reset age to 18 (one-time use)',
      price: 20000,
      icon: Gift,
      permanent: false,
      owned: false,
    },
    {
      id: 'reputation_boost',
      name: 'Reputation Boost',
      description: 'Instantly gain 100 reputation points',
      price: 25000,
      icon: TrendingUp,
      permanent: false,
      owned: false,
    },
  ];

  const storeItems = [
    {
      id: 'gems_starter',
      name: 'Starter Pack',
      description: '500 Gems + 1 Youth Pill',
      price: '$9.99',
      icon: Gem,
      value: 'starter',
      originalPrice: '$14.98',
      savings: '33%',
    },
    {
      id: 'gems_premium',
      name: 'Premium Pack',
      description: '1,500 Gems + 3 Youth Pills + Money Multiplier',
      price: '$24.99',
      icon: Gem,
      value: 'premium',
      originalPrice: '$44.97',
      savings: '44%',
    },
    {
      id: 'gems_ultimate',
      name: 'Ultimate Pack',
      description: '5,000 Gems + 10 Youth Pills + All Permanent Upgrades',
      price: '$49.99',
      icon: Star,
      value: 'ultimate',
      originalPrice: '$199.90',
      savings: '75%',
    },
    {
      id: 'gems_mega',
      name: 'Mega Pack',
      description: '15,000 Gems + Unlimited Youth Pills + Everything Unlocked',
      price: '$99.99',
      icon: Star,
      value: 'mega',
      originalPrice: '$499.85',
      savings: '80%',
    },
    {
      id: 'youth_pill_single',
      name: 'Youth Pill (Single)',
      description: 'Reset age to 18 - One time use',
      price: '$4.99',
      icon: Gift,
      value: 'single_youth',
    },
    {
      id: 'youth_pill_pack',
      name: 'Youth Pill Pack',
      description: '5 Youth Pills - Great value',
      price: '$19.99',
      icon: Gift,
      value: 'youth_pack',
      originalPrice: '$24.95',
      savings: '20%',
    },
    {
      id: 'money_boost',
      name: 'Money Boost',
      description: 'Instant $1,000,000 cash injection',
      price: '$7.99',
      icon: TrendingUp,
      value: 'money_boost',
    },
    {
      id: 'skill_boost',
      name: 'Skill Boost',
      description: 'All skills +50 levels instantly',
      price: '$12.99',
      icon: TrendingUp,
      value: 'skill_boost',
    },
    {
      id: 'lifetime_premium',
      name: 'Lifetime Premium',
      description: 'All future updates + exclusive content + no ads',
      price: '$79.99',
      icon: Star,
      value: 'lifetime',
      originalPrice: '$199.99',
      savings: '60%',
    },
  ];

  const handleBuy = (id: string, price: number) => {
    if (gameState.stats.gems < price) {
      Alert.alert('Not enough gems');
      return;
    }
    buyGoldUpgrade(id);
    Alert.alert('Purchase successful');
  };

  const handlePurchase = (item: any) => {
    const { name, price, value, originalPrice, savings } = item;
    
    let message = `Purchase ${name} for ${price}?`;
    if (originalPrice && savings) {
      message += `\n\nOriginal: ${originalPrice}`;
      message += `\nYou save: ${savings}`;
    }
    
    Alert.alert(
      'Confirm Purchase',
      message,
      [
        {
          text: 'Cancel',
          style: 'cancel',
        },
        {
          text: 'Purchase',
          onPress: () => processPurchase(value, name),
        },
      ]
    );
  };

  const processPurchase = (value: string, name: string) => {
    // Simulate purchase processing
    Alert.alert('Processing...', 'Please wait while we process your purchase.');
    
    // Simulate network delay
    setTimeout(() => {
      const result = simulatePurchaseResult(value);
      if (result.success) {
        Alert.alert(
          'Purchase Successful! 🎉',
          result.message,
          [
            {
              text: 'OK',
              onPress: () => {
                // Refresh the UI or show updated stats
                console.log('Purchase completed:', value);
              },
            },
          ]
        );
      } else {
        Alert.alert('Purchase Failed', result.message);
      }
    }, 2000);
  };

  const simulatePurchaseResult = (value: string) => {
    switch (value) {
      case 'starter':
        return {
          success: true,
          message: 'You received:\n• 500 Gems\n• 1 Youth Pill\n\nEnjoy your starter pack!',
        };
      case 'premium':
        return {
          success: true,
          message: 'You received:\n• 1,500 Gems\n• 3 Youth Pills\n• Money Multiplier\n\nPremium experience unlocked!',
        };
      case 'ultimate':
        return {
          success: true,
          message: 'You received:\n• 5,000 Gems\n• 10 Youth Pills\n• All Permanent Upgrades\n\nUltimate power achieved!',
        };
      case 'mega':
        return {
          success: true,
          message: 'You received:\n• 15,000 Gems\n• Unlimited Youth Pills\n• Everything Unlocked\n\nMega status unlocked!',
        };
      case 'single_youth':
        return {
          success: true,
          message: 'Youth Pill purchased!\nUse it to reset your age to 18.',
        };
      case 'youth_pack':
        return {
          success: true,
          message: 'Youth Pill Pack purchased!\nYou now have 5 Youth Pills.',
        };
      case 'money_boost':
        return {
          success: true,
          message: '$1,000,000 added to your account!\nYour wealth has increased significantly!',
        };
      case 'skill_boost':
        return {
          success: true,
          message: 'All skills boosted by +50 levels!\nYou are now much more skilled!',
        };
      case 'lifetime':
        return {
          success: true,
          message: 'Lifetime Premium activated!\n• No more ads\n• All future updates\n• Exclusive content\n• Priority support',
        };
      default:
        return {
          success: false,
          message: 'Unknown purchase type. Please try again.',
        };
    }
  };

  const textColor = settings.darkMode ? '#F9FAFB' : '#111827';
  const backgroundColor = settings.darkMode ? '#1F2937' : '#FFFFFF';

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={[styles.modal, { backgroundColor }]}>
          <View style={styles.header}>
            <View style={styles.headerLeft}>
              <Text style={[styles.title, { color: textColor }]}>Gem Shop</Text>
              <Text style={[styles.gemBalance, { color: settings.darkMode ? '#9CA3AF' : '#6B7280' }]}>
                💎 {gameState.stats.gems.toLocaleString()} gems
              </Text>
            </View>
            <TouchableOpacity onPress={onClose}>
              <X size={24} color={textColor} />
            </TouchableOpacity>
          </View>
                     <View style={styles.tabRow}>
             <TouchableOpacity
               style={[styles.tab, tab === 'upgrades' && styles.activeTab]}
               onPress={() => setTab('upgrades')}
             >
               <Text style={[styles.tabText, tab === 'upgrades' && styles.activeTabText]}>Upgrades</Text>
             </TouchableOpacity>
             <TouchableOpacity
               style={[styles.tab, tab === 'store' && styles.activeTab]}
               onPress={() => setTab('store')}
             >
               <Text style={[styles.tabText, tab === 'store' && styles.activeTabText]}>Store</Text>
             </TouchableOpacity>
             <TouchableOpacity
               style={[styles.tab, tab === 'history' && styles.activeTab]}
               onPress={() => setTab('history')}
             >
               <Text style={[styles.tabText, tab === 'history' && styles.activeTabText]}>History</Text>
             </TouchableOpacity>
           </View>
          <ScrollView style={styles.content} showsVerticalScrollIndicator={true}>
            {tab === 'upgrades' ? (
              <View>
                {/* Active Permanent Upgrades Section */}
                {Object.keys(gameState.goldUpgrades || {}).length > 0 && (
                  <View style={styles.activeUpgradesSection}>
                    <Text style={[styles.sectionTitle, { color: textColor }]}>Active Permanent Upgrades</Text>
                    <Text style={[styles.sectionSubtitle, { color: settings.darkMode ? '#9CA3AF' : '#6B7280' }]}>
                      These upgrades are active and will transfer to all future lives and saves
                    </Text>
                    {Object.entries(gameState.goldUpgrades || {}).map(([upgradeId, isActive]) => {
                      if (!isActive) return null;
                      const upgrade = items.find(item => item.id === upgradeId);
                      if (!upgrade) return null;
                      
                      return (
                        <View key={upgradeId} style={styles.activeUpgradeItem}>
                          <View style={styles.activeUpgradeIcon}>
                            <TrendingUp size={20} color="#10B981" />
                          </View>
                          <View style={styles.activeUpgradeDetails}>
                            <Text style={[styles.activeUpgradeName, { color: textColor }]}>
                              {upgrade.name}
                            </Text>
                            <Text style={[styles.activeUpgradeDesc, { color: settings.darkMode ? '#9CA3AF' : '#6B7280' }]}>
                              {upgrade.description}
                            </Text>
                          </View>
                        </View>
                      );
                    })}
                  </View>
                )}
                
                <Text style={[styles.sectionTitle, { color: textColor }]}>Available Upgrades</Text>
                {items.map(item => {
                  const Icon = item.icon;
                  const afford = gameState.stats.gems >= item.price;
                  const isOwned = item.owned;
                  const isPermanent = item.permanent;
                  
                  return (
                    <View key={item.id} style={[styles.itemRow, isOwned && styles.ownedItem]}>
                      <View style={styles.itemInfo}>
                        <Icon size={24} color={isOwned ? '#10B981' : afford ? '#3B82F6' : '#6B7280'} />
                        <View style={styles.itemDetails}>
                          <View style={styles.itemHeader}>
                            <Text style={[styles.itemName, { color: textColor }]}>{item.name}</Text>
                            {isPermanent && (
                              <View style={styles.permanentBadge}>
                                <Text style={styles.permanentText}>PERMANENT</Text>
                              </View>
                            )}
                            {isOwned && (
                              <View style={styles.ownedBadge}>
                                <Text style={styles.ownedText}>OWNED</Text>
                              </View>
                            )}
                          </View>
                          <Text style={[styles.itemDesc, { color: settings.darkMode ? '#9CA3AF' : '#6B7280' }]}>
                            {item.description}
                          </Text>
                        </View>
                      </View>
                      <View style={styles.itemActions}>
                        {!isOwned && (
                          <>
                            <View style={styles.priceContainer}>
                              <Gem size={16} color={afford ? '#3B82F6' : '#6B7280'} />
                              <Text style={[styles.price, { color: afford ? '#3B82F6' : '#6B7280' }]}>
                                {item.price.toLocaleString()}
                              </Text>
                            </View>
                            <TouchableOpacity
                              style={[styles.buyButton, !afford && styles.buyButtonDisabled]}
                              onPress={() => handleBuy(item.id, item.price)}
                              disabled={!afford}
                            >
                              <LinearGradient
                                colors={afford ? ['#3B82F6', '#1D4ED8'] : ['#6B7280', '#4B5563']}
                                start={{ x: 0, y: 0 }}
                                end={{ x: 1, y: 1 }}
                                style={styles.buyButtonGradient}
                              >
                                <Text style={styles.buyButtonText}>Buy</Text>
                              </LinearGradient>
                            </TouchableOpacity>
                          </>
                        )}
                        {isOwned && (
                          <View style={styles.ownedStatus}>
                            <Text style={styles.ownedStatusText}>✓ Active</Text>
                          </View>
                        )}
                      </View>
                    </View>
                  );
                                 })}
               </View>
             ) : tab === 'store' ? (
               <View>
                 <Text style={[styles.sectionTitle, { color: textColor }]}>Premium Store</Text>
                 <Text style={[styles.storeSubtitle, { color: settings.darkMode ? '#9CA3AF' : '#6B7280' }]}>
                   Premium content and exclusive upgrades
                 </Text>
                 {storeItems.map(item => {
                   const Icon = item.icon;
                   const hasSavings = item.originalPrice && item.savings;
                   
                   return (
                     <View key={item.id} style={[styles.storeItemRow, hasSavings && styles.featuredItem]}>
                       <View style={styles.itemInfo}>
                         <Icon size={24} color="#3B82F6" />
                         <View style={styles.itemDetails}>
                           <View style={styles.storeItemHeader}>
                             <Text style={[styles.itemName, { color: textColor }]}>{item.name}</Text>
                             {hasSavings && (
                               <View style={styles.savingsBadge}>
                                 <Text style={styles.savingsText}>SAVE {item.savings}</Text>
                               </View>
                             )}
                           </View>
                           <Text style={[styles.itemDesc, { color: settings.darkMode ? '#9CA3AF' : '#6B7280' }]}>
                             {item.description}
                           </Text>
                           {hasSavings && (
                             <View style={styles.priceComparison}>
                               <Text style={[styles.originalPrice, { color: settings.darkMode ? '#9CA3AF' : '#6B7280' }]}>
                                 {item.originalPrice}
                               </Text>
                               <Text style={[styles.finalPrice, { color: '#10B981' }]}>
                                 {item.price}
                               </Text>
                               </View>
                             )}
                           </View>
                         </View>
                                                 <View style={styles.itemActions}>
                          <Text style={[styles.price, { color: hasSavings ? '#10B981' : '#3B82F6' }]}>
                            {item.price}
                          </Text>
                          <TouchableOpacity
                            style={[styles.buyButton, hasSavings && styles.featuredBuyButton]}
                            onPress={() => handlePurchase(item)}
                          >
                                                         <LinearGradient
                              colors={hasSavings ? ['#F59E0B', '#D97706'] : ['#3B82F6', '#1D4ED8']}
                              start={{ x: 0, y: 0 }}
                              end={{ x: 1, y: 1 }}
                              style={styles.buyButtonGradient}
                            >
                                                            <Text style={styles.buyButtonText}>
                               Buy Now
                             </Text>
                             </LinearGradient>
                           </TouchableOpacity>
                         </View>
                       </View>
                     );
                   })}
                 </View>
               ) : tab === 'history' ? (
               <View>
                 <Text style={[styles.sectionTitle, { color: textColor }]}>Purchase History</Text>
                 <Text style={[styles.sectionSubtitle, { color: settings.darkMode ? '#9CA3AF' : '#6B7280' }]}>
                   Track your premium purchases and rewards
                 </Text>
                 
                 {/* Purchase Summary */}
                 <View style={styles.purchaseSummary}>
                   <View style={styles.summaryItem}>
                     <Text style={[styles.summaryLabel, { color: settings.darkMode ? '#9CA3AF' : '#6B7280' }]}>
                       Total Spent
                     </Text>
                     <Text style={[styles.summaryValue, { color: textColor }]}>$0.00</Text>
                   </View>
                   <View style={styles.summaryItem}>
                     <Text style={[styles.summaryLabel, { color: settings.darkMode ? '#9CA3AF' : '#6B7280' }]}>
                       Gems Purchased
                     </Text>
                     <Text style={[styles.summaryValue, { color: textColor }]}>0</Text>
                   </View>
                   <View style={styles.summaryItem}>
                     <Text style={[styles.summaryLabel, { color: settings.darkMode ? '#9CA3AF' : '#6B7280' }]}>
                       Premium Status
                     </Text>
                     <Text style={[styles.summaryValue, { color: '#10B981' }]}>Free</Text>
                   </View>
                 </View>

                 {/* Recent Purchases */}
                 <Text style={[styles.sectionTitle, { color: textColor, marginTop: 24 }]}>Recent Purchases</Text>
                 <View style={styles.noPurchases}>
                   <Text style={[styles.noPurchasesText, { color: settings.darkMode ? '#9CA3AF' : '#6B7280' }]}>
                     No purchases yet
                   </Text>
                   <Text style={[styles.noPurchasesSubtext, { color: settings.darkMode ? '#9CA3AF' : '#6B7280' }]}>
                     Make your first purchase to see it here!
                   </Text>
                 </View>

                 {/* Premium Benefits */}
                 <Text style={[styles.sectionTitle, { color: textColor, marginTop: 24 }]}>Premium Benefits</Text>
                 <View style={styles.benefitsList}>
                   <View style={styles.benefitItem}>
                     <Text style={[styles.benefitIcon, { color: '#10B981' }]}>✓</Text>
                     <Text style={[styles.benefitText, { color: textColor }]}>
                       Access to all premium content
                     </Text>
                   </View>
                   <View style={styles.benefitItem}>
                     <Text style={[styles.benefitIcon, { color: '#10B981' }]}>✓</Text>
                     <Text style={[styles.benefitText, { color: textColor }]}>
                       Exclusive upgrades and boosts
                     </Text>
                   </View>
                   <View style={styles.benefitItem}>
                     <Text style={[styles.benefitIcon, { color: '#10B981' }]}>✓</Text>
                     <Text style={[styles.benefitText, { color: textColor }]}>
                       Priority customer support
                     </Text>
                   </View>
                   <View style={styles.benefitItem}>
                     <Text style={[styles.benefitIcon, { color: '#10B981' }]}>✓</Text>
                     <Text style={[styles.benefitText, { color: textColor }]}>
                       Early access to new features
                     </Text>
                   </View>
                 </View>
               </View>
             ) : null}
          </ScrollView>
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
  },
  modal: {
    width: '90%',
    maxWidth: 400,
    maxHeight: '80%',
    borderRadius: 16,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  headerLeft: {
    flex: 1,
  },
  gemBalance: {
    fontSize: 14,
    marginTop: 4,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
  },
  tabRow: {
    flexDirection: 'row',
    marginBottom: 20,
    backgroundColor: '#F3F4F6',
    borderRadius: 8,
    padding: 4,
    gap: 4,
  },
  tab: {
    flex: 1,
    paddingVertical: 8,
    paddingHorizontal: 8,
    borderRadius: 6,
    alignItems: 'center',
    minWidth: 80,
  },
  activeTab: {
    backgroundColor: '#3B82F6',
  },
  tabText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#6B7280',
  },
  activeTabText: {
    color: '#FFFFFF',
  },
  content: {
    flex: 1,
    paddingBottom: 20,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 16,
  },
  itemRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  itemInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  itemDetails: {
    marginLeft: 12,
    flex: 1,
  },
  itemName: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 4,
  },
  itemDesc: {
    fontSize: 14,
  },
  itemActions: {
    alignItems: 'flex-end',
  },
  priceContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  price: {
    fontSize: 16,
    fontWeight: '600',
    marginLeft: 4,
  },
  buyButton: {
    borderRadius: 8,
    overflow: 'hidden',
  },
  buyButtonDisabled: {
    opacity: 0.5,
  },
  buyButtonGradient: {
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  buyButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
    textAlign: 'center',
  },
  itemHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 4,
  },
  permanentBadge: {
    backgroundColor: '#8B5CF6',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  permanentText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: '700',
  },
  ownedBadge: {
    backgroundColor: '#10B981',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  ownedText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: '700',
  },
  ownedItem: {
    backgroundColor: 'rgba(16, 185, 129, 0.1)',
    borderLeftWidth: 3,
    borderLeftColor: '#10B981',
  },
  ownedStatus: {
    backgroundColor: '#10B981',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
  },
  ownedStatusText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '600',
  },
  activeUpgradesSection: {
    backgroundColor: 'rgba(16, 185, 129, 0.1)',
    borderRadius: 12,
    padding: 16,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: 'rgba(16, 185, 129, 0.3)',
  },
  sectionSubtitle: {
    fontSize: 14,
    marginBottom: 16,
    fontStyle: 'italic',
  },
  activeUpgradeItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(16, 185, 129, 0.2)',
  },
  activeUpgradeIcon: {
    marginRight: 12,
  },
  activeUpgradeDetails: {
    flex: 1,
  },
  activeUpgradeName: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 4,
  },
  activeUpgradeDesc: {
    fontSize: 14,
  },
  storeSubtitle: {
    fontSize: 14,
    marginBottom: 20,
    fontStyle: 'italic',
    textAlign: 'center',
  },
  storeItemRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 16,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
    borderRadius: 12,
    marginBottom: 12,
    backgroundColor: 'rgba(59, 130, 246, 0.02)',
  },
  featuredItem: {
    backgroundColor: 'rgba(16, 185, 129, 0.1)',
    borderWidth: 2,
    borderColor: 'rgba(16, 185, 129, 0.3)',
  },
  storeItemHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 4,
  },
  savingsBadge: {
    backgroundColor: '#10B981',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  savingsText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: '700',
  },
  priceComparison: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 8,
  },
  originalPrice: {
    fontSize: 14,
    textDecorationLine: 'line-through',
    opacity: 0.7,
  },
  finalPrice: {
    fontSize: 18,
    fontWeight: '700',
  },
  featuredBuyButton: {
    shadowColor: '#F59E0B',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 4,
  },
  purchaseSummary: {
    backgroundColor: 'rgba(59, 130, 246, 0.1)',
    borderRadius: 12,
    padding: 16,
    marginBottom: 20,
  },
  summaryItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
  },
  summaryLabel: {
    fontSize: 14,
    fontWeight: '500',
  },
  summaryValue: {
    fontSize: 16,
    fontWeight: '700',
  },
  noPurchases: {
    alignItems: 'center',
    paddingVertical: 32,
    backgroundColor: 'rgba(156, 163, 175, 0.1)',
    borderRadius: 12,
  },
  noPurchasesText: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 8,
  },
  noPurchasesSubtext: {
    fontSize: 14,
    textAlign: 'center',
  },
  benefitsList: {
    gap: 12,
  },
  benefitItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 8,
  },
  benefitIcon: {
    fontSize: 18,
    fontWeight: 'bold',
  },
  benefitText: {
    fontSize: 14,
    flex: 1,
  },
});
