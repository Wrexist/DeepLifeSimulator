import React, { useEffect, useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Modal, ScrollView, Alert, Image } from 'react-native';
import FadeInUp from '@/components/anim/FadeInUp';
import { useGame } from '@/contexts/GameContext';
import { X, Zap, TrendingUp, GraduationCap, Banknote, Gift, Gamepad2, Unlock, Gem, RefreshCw } from 'lucide-react-native';
import usePressableScale from '@/hooks/usePressableScale';
import Skeleton from '@/components/anim/Skeleton';
import { iapService } from '@/services/IAPService';
import { IAP_PRODUCTS, getProductConfig } from '@/utils/iapConfig';

interface ScaleButtonProps {
  onPress: () => void;
  style: any;
  disabled?: boolean;
  children: React.ReactNode;
}

const ScaleButton: React.FC<ScaleButtonProps> = ({ onPress, style, disabled, children }) => {
  const { AnimatedView, animatedStyle, onPressIn, onPressOut, onHaptic } = usePressableScale();
  return (
    <AnimatedView style={animatedStyle}>
      <TouchableOpacity
        onPress={() => {
          onHaptic();
          onPress();
        }}
        onPressIn={onPressIn}
        onPressOut={onPressOut}
        style={style}
        disabled={disabled}
      >
        {children}
      </TouchableOpacity>
    </AnimatedView>
  );
};

interface ShopModalProps {
  visible: boolean;
  onClose: () => void;
}

export default function ShopModal({ visible, onClose }: ShopModalProps) {
  const { gameState, setGameState, saveGame, savePermanentPerk, hasPermanentPerk } = useGame();
  const { settings, perks } = gameState;
  const [activeTab, setActiveTab] = useState<'perks' | 'packs' | 'special' | 'gold'>('perks');
  const [loading, setLoading] = useState(true);
  const [iapLoading, setIapLoading] = useState(false);

  useEffect(() => {
    if (visible) {
      setLoading(true);
      const t = setTimeout(() => setLoading(false), 500);
      return () => clearTimeout(t);
    }
  }, [visible]);

  const perkItems = [
    {
      id: IAP_PRODUCTS.WORK_BOOST,
      name: 'Work Pay Boost',
      description: '+50% earnings on all jobs',
      price: '$1.99',
      icon: Zap,
      owned: perks?.workBoost || false,
    },
    {
      id: IAP_PRODUCTS.MINDSET,
      name: 'Mindset',
      description: '50% faster promotions',
      price: '$1.99',
      icon: TrendingUp,
      owned: perks?.mindset || false,
    },
    {
      id: IAP_PRODUCTS.FAST_LEARNER,
      name: 'Fast Learner',
      description: '50% faster education',
      price: '$1.99',
      icon: GraduationCap,
      owned: perks?.fastLearner || false,
    },
    {
      id: IAP_PRODUCTS.GOOD_CREDIT,
      name: 'Good Credit Score',
      description: 'Higher bank interest rates',
      price: '$1.99',
      icon: Banknote,
      owned: perks?.goodCredit || false,
    },
    {
      id: IAP_PRODUCTS.UNLOCK_ALL_PERKS,
      name: 'Unlock All Perks',
      description: 'Includes all perks above',
      price: '$6.99',
      icon: Gift,
      owned: perks?.unlockAllPerks || false,
    },
  ];

  const starterPacks = [
    { id: 'starter', name: 'Starter Pack', amount: 50000, price: '$1' },
    { id: 'booster', name: 'Booster Pack', amount: 250000, price: '$5' },
    { id: 'mega', name: 'Mega Pack', amount: 2000000, price: '$20' },
    { id: 'crypto', name: 'Crypto Miner Pack', amount: 10000000, price: '$50' },
  ];

  const goldPacks = [
    { id: IAP_PRODUCTS.GEMS_100, name: '100 Gems', amount: 100, price: '$0.99' },
    { id: IAP_PRODUCTS.GEMS_500, name: '500 Gems', amount: 500, price: '$4.99' },
    { id: IAP_PRODUCTS.GEMS_1000, name: '1,000 Gems', amount: 1000, price: '$9.99' },
    { id: IAP_PRODUCTS.GEMS_5000, name: '5,000 Gems', amount: 5000, price: '$19.99' },
  ];

  const specialItems = [
    {
      id: IAP_PRODUCTS.YOUTH_PILL_SINGLE,
      name: 'Youth Pill',
      description: 'Resets your age to 18',
      price: '$4.99',
      icon: Gift,
      image: require('@/assets/images/iap/items/youth_pill_single.png'),
    },
    {
      id: IAP_PRODUCTS.MONEY_BOOST,
      name: 'Money Boost',
      description: 'Instant $1,000,000 cash injection',
      price: '$7.99',
      icon: Banknote,
    },
    {
      id: IAP_PRODUCTS.LIFETIME_PREMIUM,
      name: 'Lifetime Premium',
      description: 'All future updates + exclusive content + no ads',
      price: '$79.99',
      icon: Unlock,
    },
  ];

  const handlePurchase = async (itemId: string, type: 'perk' | 'pack' | 'special' | 'gold') => {
    if (iapLoading) return;
    
    setIapLoading(true);
    
    try {
      console.log(`Attempting to purchase: ${itemId} (${type})`);
      
      // Use IAP service for purchase
      const result = await iapService.purchaseProduct(itemId);
      
      if (result.success) {
        // Apply the purchase benefits locally for immediate feedback
        await applyPurchaseBenefits(itemId, type);
        
        Alert.alert('Success', 'Purchase completed! Your items have been added to your account.');
      } else {
        Alert.alert('Purchase Failed', result.message || 'Unable to complete purchase. Please try again.');
      }
    } catch (error) {
      console.error('Purchase error:', error);
      Alert.alert('Error', 'An error occurred during purchase. Please try again.');
    } finally {
      setIapLoading(false);
    }
  };

  const applyPurchaseBenefits = async (itemId: string, type: 'perk' | 'pack' | 'special' | 'gold') => {
    const config = getProductConfig(itemId);
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

    if (config.money) {
      setGameState(prev => ({
        ...prev,
        stats: {
          ...prev.stats,
          money: prev.stats.money + config.money
        }
      }));
    }

    // Handle special products - Save as permanent perks
    if (config.workBoost) {
      await savePermanentPerk('workBoost');
      setGameState(prev => ({
        ...prev,
        perks: { ...prev.perks, workBoost: true }
      }));
    }

    if (config.mindset) {
      await savePermanentPerk('mindset');
      setGameState(prev => ({
        ...prev,
        perks: { ...prev.perks, mindset: true }
      }));
    }

    if (config.fastLearner) {
      await savePermanentPerk('fastLearner');
      setGameState(prev => ({
        ...prev,
        perks: { ...prev.perks, fastLearner: true }
      }));
    }

    if (config.goodCredit) {
      await savePermanentPerk('goodCredit');
      setGameState(prev => ({
        ...prev,
        perks: { ...prev.perks, goodCredit: true }
      }));
    }

    if (config.allPerks) {
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
          goodCredit: true,
          unlockAllPerks: true
        }
      }));
    }

    if (config.removeAds) {
      setGameState(prev => ({
        ...prev,
        settings: { ...prev.settings, adsRemoved: true }
      }));
    }

    if (config.lifetimePremium) {
      setGameState(prev => ({
        ...prev,
        settings: { ...prev.settings, lifetimePremium: true }
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

  const overlayStyle = [
    styles.overlay,
    settings.darkMode && styles.overlayDark
  ];

  const modalStyle = [
    styles.modal,
    settings.darkMode && styles.modalDark
  ];

  return (
    <Modal
      visible={visible}
      transparent={true}
      animationType="slide"
      onRequestClose={onClose}
    >
      <View style={overlayStyle}>
        <View style={modalStyle}>
          <View style={styles.header}>
            <Text style={[styles.title, settings.darkMode && styles.titleDark]}>Shop</Text>
            <TouchableOpacity onPress={onClose} style={styles.closeButton}>
              <X size={24} color={settings.darkMode ? '#D1D5DB' : '#6B7280'} />
            </TouchableOpacity>
          </View>

          <View style={styles.tabContainer}>
            <TouchableOpacity
              style={[styles.tab, activeTab === 'perks' && styles.activeTab]}
              onPress={() => setActiveTab('perks')}
            >
              <Text style={[styles.tabText, activeTab === 'perks' && styles.activeTabText]}>
                Perks
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.tab, activeTab === 'packs' && styles.activeTab]}
              onPress={() => setActiveTab('packs')}
            >
              <Text style={[styles.tabText, activeTab === 'packs' && styles.activeTabText]}>
                Starter Packs
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.tab, activeTab === 'gold' && styles.activeTab]}
              onPress={() => setActiveTab('gold')}
            >
              <Text style={[styles.tabText, activeTab === 'gold' && styles.activeTabText]}>
                Gems
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.tab, activeTab === 'special' && styles.activeTab]}
              onPress={() => setActiveTab('special')}
            >
              <Text style={[styles.tabText, activeTab === 'special' && styles.activeTabText]}>
                Special
              </Text>
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.content} showsVerticalScrollIndicator={true}>
          {activeTab === 'perks' && (
              <View>
                {loading
                  ? Array.from({ length: 3 }).map((_, i) => (
                      <Skeleton key={i} height={60} radius={8} />
                    ))
                  : perkItems.map((item, index) => (
                      <FadeInUp key={item.id} delay={index * 40}>
                        <View style={[
                          styles.shopItem, 
                          settings.darkMode && styles.shopItemDark,
                          item.owned && styles.ownedItem,
                          item.owned && settings.darkMode && styles.ownedItemDark
                        ]}>
                          {item.owned && (
                            <View style={styles.ownedOverlay}>
                              <View style={styles.ownedGradient} />
                            </View>
                          )}
                          <View style={styles.itemInfo}>
                            <View style={styles.itemHeader}>
                              <item.icon size={20} color={item.owned ? '#FFFFFF' : (settings.darkMode ? '#D1D5DB' : '#374151')} />
                              <Text style={[
                                styles.itemName, 
                                settings.darkMode && styles.itemNameDark,
                                item.owned && styles.ownedItemText
                              ]}>
                                {item.name}
                              </Text>
                              {item.owned && (
                                <View style={styles.ownedBadge}>
                                  <Text style={styles.ownedBadgeText}>✓</Text>
                                </View>
                              )}
                              {item.owned && (
                                <View style={styles.ownedLabel}>
                                  <Text style={styles.ownedLabelText}>OWNED</Text>
                                </View>
                              )}
                            </View>
                            <Text style={[
                              styles.itemDescription, 
                              settings.darkMode && styles.itemDescriptionDark,
                              item.owned && styles.ownedItemDescription
                            ]}>
                              {item.description}
                            </Text>
                          </View>
                          <ScaleButton
                            style={[styles.purchaseButton, item.owned && styles.ownedButton]}
                            onPress={() => handlePurchase(item.id, 'perk')}
                            disabled={item.owned}
                          >
                            {item.owned ? (
                              <Text style={styles.ownedButtonText}>✓ OWNED</Text>
                            ) : (
                              <Text style={styles.purchaseButtonText}>{item.price}</Text>
                            )}
                          </ScaleButton>
                        </View>
                      </FadeInUp>
                    ))}
              </View>
            )}

          {activeTab === 'packs' && (
              <View>
                {loading
                  ? Array.from({ length: 3 }).map((_, i) => (
                      <Skeleton key={i} height={60} radius={8} />
                    ))
                  : starterPacks.map((pack, index) => (
                      <FadeInUp key={pack.id} delay={index * 40}>
                        <View style={[styles.shopItem, settings.darkMode && styles.shopItemDark]}>
                          <View style={styles.itemInfo}>
                            <Text style={[styles.itemName, settings.darkMode && styles.itemNameDark]}>
                              {pack.name}
                            </Text>
                            <Text style={[styles.itemDescription, settings.darkMode && styles.itemDescriptionDark]}>
                              ${pack.amount.toLocaleString()} in-game money
                            </Text>
                          </View>
                          <ScaleButton
                            style={styles.purchaseButton}
                            onPress={() => handlePurchase(pack.id, 'pack')}
                          >
                            <Text style={styles.purchaseButtonText}>{pack.price}</Text>
                          </ScaleButton>
                        </View>
                      </FadeInUp>
                    ))}
              </View>
            )}

          {activeTab === 'gold' && (
            <ScrollView style={styles.content} showsVerticalScrollIndicator={true}>
              {loading
                ? Array.from({ length: 3 }).map((_, i) => (
                    <Skeleton key={i} height={60} radius={8} />
                  ))
                : goldPacks.map((pack, index) => (
                    <FadeInUp key={pack.id} delay={index * 40}>
                      <View style={styles.packCard}>
                        <View style={styles.packInfo}>
                                                      <Gem size={20} color="#3B82F6" />
                          <Text style={styles.packName}>{pack.name}</Text>
                          <Text style={styles.packAmount}>{pack.amount} Gems</Text>
                        </View>
                        <ScaleButton
                          style={styles.packButton}
                          onPress={() => handlePurchase(pack.id, 'gold')}
                        >
                          <Text style={styles.packButtonText}>{pack.price}</Text>
                        </ScaleButton>
                      </View>
                    </FadeInUp>
                  ))}
            </ScrollView>
          )}

          {activeTab === 'special' && (
              <View>
                {loading
                  ? Array.from({ length: 3 }).map((_, i) => (
                      <Skeleton key={i} height={60} radius={8} />
                    ))
                  : specialItems.map((item, index) => (
                      <FadeInUp key={item.id} delay={index * 40}>
                        <View style={[styles.shopItem, settings.darkMode && styles.shopItemDark]}>
                          <View style={styles.itemInfo}>
                            <View style={styles.itemHeader}>
                              {item.image ? (
                                <Image source={item.image} style={styles.itemImage} />
                              ) : (
                                <item.icon size={20} color={settings.darkMode ? '#D1D5DB' : '#374151'} />
                              )}
                              <Text style={[styles.itemName, settings.darkMode && styles.itemNameDark]}>
                                {item.name}
                              </Text>
                            </View>
                            <Text style={[styles.itemDescription, settings.darkMode && styles.itemDescriptionDark]}>
                              {item.description}
                            </Text>
                          </View>
                          <ScaleButton
                            style={styles.purchaseButton}
                            onPress={() => handlePurchase(item.id, 'special')}
                          >
                            <Text style={styles.purchaseButtonText}>{item.price}</Text>
                          </ScaleButton>
                        </View>
                      </FadeInUp>
                    ))}
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
  container: {
    backgroundColor: '#FFFFFF',
    paddingTop: 55,
    paddingHorizontal: 20,
    paddingBottom: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
    boxShadow: '0px 2px 4px rgba(0, 0, 0, 0.1)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  containerDark: {
    backgroundColor: '#1F2937',
    borderBottomColor: '#374151',
  },
  topRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 15,
  },
  headerButtons: {
    flexDirection: 'row',
  },
  headerButton: {
    marginLeft: 12,
    padding: 4,
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  statItem: {
    alignItems: 'center',
    marginBottom: 8,
    width: '31%',
  },
  statHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 6,
  },
  statValue: {
    fontSize: 16,
    fontWeight: 'bold',
    marginLeft: 8,
    minWidth: 50,
    textAlign: 'center',
  },
  progressBar: {
    height: 6,
    width: '100%',
    backgroundColor: '#E5E7EB',
    borderRadius: 3,
    overflow: 'hidden',
  },
  progressBarDark: {
    backgroundColor: '#374151',
  },
  progressFill: {
    height: '100%',
    borderRadius: 3,
  },
  dayText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#3B82F6',
    letterSpacing: 0.5,
  },
  dayTextDark: {
    color: '#60A5FA',
  },
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  overlayDark: {
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
  },
  modal: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    maxWidth: 450,
    width: '100%',
    maxHeight: '85%',
    boxShadow: '0px 10px 20px rgba(0, 0, 0, 0.25)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.25,
    shadowRadius: 20,
    elevation: 10,
  },
  modalDark: {
    backgroundColor: '#1F2937',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 24,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#1F2937',
  },
  titleDark: {
    color: '#F9FAFB',
  },
  closeButton: {
    padding: 4,
  },
  tabContainer: {
    flexDirection: 'row',
    backgroundColor: '#F3F4F6',
    margin: 20,
    marginBottom: 0,
    borderRadius: 8,
    padding: 4,
  },
  tab: {
    flex: 1,
    paddingVertical: 10,
    alignItems: 'center',
    borderRadius: 6,
  },
  activeTab: {
    backgroundColor: '#3B82F6',
  },
  tabText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#6B7280',
  },
  activeTabText: {
    color: '#FFFFFF',
  },
  content: {
    padding: 20,
  },
  shopItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 16,
    paddingHorizontal: 16,
    backgroundColor: '#F8FAFC',
    borderRadius: 12,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  shopItemDark: {
    backgroundColor: '#374151',
    borderColor: '#4B5563',
  },
  itemInfo: {
    flex: 1,
    marginRight: 16,
  },
  itemHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  itemImage: {
    width: 20,
    height: 20,
  },
  itemName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1F2937',
    marginLeft: 8,
  },
  itemNameDark: {
    color: '#F9FAFB',
  },
  itemDescription: {
    fontSize: 14,
    color: '#6B7280',
    lineHeight: 18,
  },
  itemDescriptionDark: {
    color: '#9CA3AF',
  },
  purchaseButton: {
    backgroundColor: '#3B82F6',
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 8,
  },
  ownedButton: {
    backgroundColor: '#10B981',
  },
  purchaseButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
  },
  ownedButtonText: {
    color: '#FFFFFF',
  },
  ownedItem: {
    backgroundColor: '#10B981',
    borderColor: '#059669',
    borderWidth: 3,
    shadowColor: '#10B981',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
    transform: [{ scale: 1.02 }],
  },
  ownedItemDark: {
    backgroundColor: '#059669',
    borderColor: '#047857',
    shadowColor: '#059669',
  },
  ownedItemText: {
    color: '#FFFFFF',
    fontWeight: '700',
    textShadow: '1px 1px 2px rgba(0, 0, 0, 0.3)',
  },
  ownedItemDescription: {
    color: '#D1FAE5',
    fontWeight: '500',
  },
  ownedOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    borderRadius: 12,
    overflow: 'hidden',
  },
  ownedGradient: {
    flex: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 12,
  },
  ownedBadge: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    width: 24,
    height: 24,
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 4,
  },
  ownedBadgeText: {
    color: '#10B981',
    fontSize: 14,
    fontWeight: 'bold',
  },
  ownedLabel: {
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 12,
    marginLeft: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 2,
    elevation: 2,
  },
  ownedLabelText: {
    color: '#10B981',
    fontSize: 10,
    fontWeight: 'bold',
    letterSpacing: 0.5,
  },

  packCard: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    padding: 16,
    borderRadius: 8,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  packInfo: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  packName: {
    fontSize: 16,
    fontWeight: '600',
    marginLeft: 8,
    color: '#1F2937',
  },
  packAmount: {
    marginLeft: 8,
    color: '#6B7280',
  },
  packButton: {
    backgroundColor: '#3B82F6',
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 8,
  },
  packButtonText: {
    color: '#FFFFFF',
    fontWeight: '600',
  },
  
  // Footer and Restore Button
  footer: {
    paddingHorizontal: 20,
    paddingVertical: 12,
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
    paddingVertical: 8,
    gap: 8,
  },
  restoreButtonText: {
    color: '#6B7280',
    fontSize: 14,
    fontWeight: '500',
    marginLeft: 6,
  },
  restoreButtonTextDisabled: {
    color: '#9CA3AF',
  },
});