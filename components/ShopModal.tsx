import React, { useEffect, useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Modal, ScrollView, Alert } from 'react-native';
import FadeInUp from '@/components/anim/FadeInUp';
import { useGame } from '@/contexts/GameContext';
import { X, Zap, TrendingUp, GraduationCap, Banknote, Gift, Gamepad2, Unlock, Gem } from 'lucide-react-native';
import usePressableScale from '@/hooks/usePressableScale';
import Skeleton from '@/components/anim/Skeleton';

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
  const { gameState, buyPerk, buyStarterPack, buyGoldPack } = useGame();
  const { settings, perks } = gameState;
  const [activeTab, setActiveTab] = useState<'perks' | 'packs' | 'special' | 'gold'>('perks');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (visible) {
      setLoading(true);
      const t = setTimeout(() => setLoading(false), 500);
      return () => clearTimeout(t);
    }
  }, [visible]);

  const perkItems = [
    {
      id: 'work_boost',
      name: 'Work Pay Boost',
      description: '+50% earnings on all jobs',
      price: '$1',
      icon: Zap,
      owned: perks?.workBoost || false,
    },
    {
      id: 'mindset',
      name: 'Mindset',
      description: '50% faster promotions',
      price: '$1',
      icon: TrendingUp,
      owned: perks?.mindset || false,
    },
    {
      id: 'fast_learner',
      name: 'Fast Learner',
      description: '50% faster education',
      price: '$1',
      icon: GraduationCap,
      owned: perks?.fastLearner || false,
    },
    {
      id: 'good_credit',
      name: 'Good Credit Score',
      description: 'Higher bank interest rates',
      price: '$1',
      icon: Banknote,
      owned: perks?.goodCredit || false,
    },
    {
      id: 'unlock_all_perks',
      name: 'Unlock All Perks',
      description: 'Includes all perks above',
      price: '$4',
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
    { id: 'small', name: 'Small Gold Pack', amount: 10, price: '$1' },
    { id: 'medium', name: 'Medium Gold Pack', amount: 55, price: '$5' },
    { id: 'large', name: 'Large Gold Pack', amount: 120, price: '$10' },
  ];

  const specialItems = [
    {
      id: 'youth_pill',
      name: 'Youth Pill',
      description: 'Resets your age to 18',
      price: '$10',
      icon: Gift,
    },
    {
      id: 'sandbox_mode',
      name: 'Unlock Sandbox Mode',
      description: 'Free unlimited mode',
      price: '$15',
      icon: Gamepad2,
    },
    {
      id: 'unlock_all',
      name: 'Unlock All Features',
      description: 'Instantly unlock everything',
      price: '$25',
      icon: Unlock,
    },
  ];

  const handlePurchase = (itemId: string, type: 'perk' | 'pack' | 'special' | 'gold') => {
    // In a real app, this would trigger the platform's in-app purchase system
    Alert.alert(
      'Purchase',
      'This would trigger the in-app purchase system in a real app.',
      [
        { text: 'Cancel', style: 'cancel' },
        { 
          text: 'Simulate Purchase', 
          onPress: () => {
            if (type === 'perk') {
              buyPerk(itemId);
            } else if (type === 'pack') {
              buyStarterPack(itemId);
            } else if (type === 'gold') {
              buyGoldPack(itemId);
            }
            Alert.alert('Success', 'Purchase completed!');
          }
        }
      ]
    );
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

          <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
          {activeTab === 'perks' && (
              <View>
                {loading
                  ? Array.from({ length: 3 }).map((_, i) => (
                      <Skeleton key={i} height={60} radius={8} />
                    ))
                  : perkItems.map((item, index) => (
                      <FadeInUp key={item.id} delay={index * 40}>
                        <View style={[styles.shopItem, settings.darkMode && styles.shopItemDark]}>
                          <View style={styles.itemInfo}>
                            <View style={styles.itemHeader}>
                              <item.icon size={20} color={settings.darkMode ? '#D1D5DB' : '#374151'} />
                              <Text style={[styles.itemName, settings.darkMode && styles.itemNameDark]}>
                                {item.name}
                              </Text>
                            </View>
                            <Text style={[styles.itemDescription, settings.darkMode && styles.itemDescriptionDark]}>
                              {item.description}
                            </Text>
                          </View>
                          <ScaleButton
                            style={[styles.purchaseButton, item.owned && styles.ownedButton]}
                            onPress={() => handlePurchase(item.id, 'perk')}
                            disabled={item.owned}
                          >
                            <Text style={[styles.purchaseButtonText, item.owned && styles.ownedButtonText]}>
                              {item.owned ? 'Owned' : item.price}
                            </Text>
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
            <ScrollView style={styles.tabContent} showsVerticalScrollIndicator={false}>
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
                              <item.icon size={20} color={settings.darkMode ? '#D1D5DB' : '#374151'} />
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
});