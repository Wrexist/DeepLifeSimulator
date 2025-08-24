import React, { useState } from 'react';
import { Modal, View, Text, StyleSheet, TouchableOpacity, Alert } from 'react-native';
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
  const [tab, setTab] = useState<'upgrades' | 'store'>('upgrades');

  const items = [
    {
      id: 'multiplier',
      name: 'Money Multiplier',
      description: 'Increase cash by 50%',
      price: 10000,
      icon: TrendingUp,
    },
    {
      id: 'skip_week',
      name: 'Skip Week',
      description: 'Jump ahead one week',
      price: 5000,
      icon: ArrowRightCircle,
    },
    {
      id: 'youth_pill',
      name: 'Youth Pill',
      description: 'Reset age to 18',
      price: 20000,
      icon: Gift,
    },
  ];

  const storeItems = [
    {
      id: 'gems',
      name: '100 Gems',
      description: 'Instant gems for upgrades',
      price: '$4.99',
      icon: Gem,
    },
    {
      id: 'iap_youth',
      name: 'Youth Pill',
      description: 'Reset age to 18',
      price: '$9.99',
      icon: Gift,
    },
    {
      id: 'iap_multiplier',
      name: 'Money Multiplier',
      description: 'Increase cash by 50%',
      price: '$14.99',
      icon: TrendingUp,
    },
    {
      id: 'unlock_all',
      name: 'Unlock All Perks',
      description: 'Unlock everything instantly',
      price: '$29.99',
      icon: Star,
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

  const handlePurchase = (name: string, price: string) => {
    Alert.alert('Purchase', `Buy ${name} for ${price}?\n(In-app purchases not implemented)`);
  };

  const textColor = settings.darkMode ? '#F9FAFB' : '#111827';
  const backgroundColor = settings.darkMode ? '#1F2937' : '#FFFFFF';

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={[styles.modal, { backgroundColor }]}>
          <View style={styles.header}>
            <Text style={[styles.title, { color: textColor }]}>Gem Shop</Text>
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
          </View>
          <View style={styles.content}>
            {tab === 'upgrades' ? (
              <View>
                <Text style={[styles.sectionTitle, { color: textColor }]}>Gem Upgrades</Text>
                {items.map(item => {
                  const Icon = item.icon;
                  const afford = gameState.stats.gems >= item.price;
                  return (
                    <View key={item.id} style={styles.itemRow}>
                      <View style={styles.itemInfo}>
                        <Icon size={24} color={afford ? '#3B82F6' : '#6B7280'} />
                        <View style={styles.itemDetails}>
                          <Text style={[styles.itemName, { color: textColor }]}>{item.name}</Text>
                          <Text style={[styles.itemDesc, { color: settings.darkMode ? '#9CA3AF' : '#6B7280' }]}>
                            {item.description}
                          </Text>
                        </View>
                      </View>
                      <View style={styles.itemActions}>
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
                      </View>
                    </View>
                  );
                })}
              </View>
            ) : (
              <View>
                <Text style={[styles.sectionTitle, { color: textColor }]}>Premium Store</Text>
                {storeItems.map(item => {
                  const Icon = item.icon;
                  return (
                    <View key={item.id} style={styles.itemRow}>
                      <View style={styles.itemInfo}>
                        <Icon size={24} color="#3B82F6" />
                        <View style={styles.itemDetails}>
                          <Text style={[styles.itemName, { color: textColor }]}>{item.name}</Text>
                          <Text style={[styles.itemDesc, { color: settings.darkMode ? '#9CA3AF' : '#6B7280' }]}>
                            {item.description}
                          </Text>
                        </View>
                      </View>
                      <View style={styles.itemActions}>
                        <Text style={[styles.price, { color: '#3B82F6' }]}>{item.price}</Text>
                        <TouchableOpacity
                          style={styles.buyButton}
                          onPress={() => handlePurchase(item.name, item.price)}
                        >
                          <LinearGradient
                            colors={['#3B82F6', '#1D4ED8']}
                            start={{ x: 0, y: 0 }}
                            end={{ x: 1, y: 1 }}
                            style={styles.buyButtonGradient}
                          >
                            <Text style={styles.buyButtonText}>Buy</Text>
                          </LinearGradient>
                        </TouchableOpacity>
                      </View>
                    </View>
                  );
                })}
              </View>
            )}
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
  },
  tab: {
    flex: 1,
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 6,
    alignItems: 'center',
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
});
