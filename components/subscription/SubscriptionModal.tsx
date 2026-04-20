import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, Modal, TouchableOpacity, ScrollView, Alert } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { X, Crown, Check, Star, Zap } from 'lucide-react-native';
import { subscriptionService, Subscription, SubscriptionTier } from '@/services/SubscriptionService';
import { IAP_PRODUCTS } from '@/utils/iapConfig';
import LoadingButton from '@/components/ui/LoadingButton';

interface SubscriptionModalProps {
  visible: boolean;
  onClose: () => void;
}

export default function SubscriptionModal({ visible, onClose }: SubscriptionModalProps) {
  const [subscriptions, setSubscriptions] = useState<Subscription[]>([]);
  const [currentTier, setCurrentTier] = useState<SubscriptionTier>('free');
  const [loading, setLoading] = useState<string | null>(null);

  useEffect(() => {
    const unsubscribe = subscriptionService.addListener((subs) => {
      setSubscriptions(subs);
      setCurrentTier(subscriptionService.getSubscriptionTier());
    });

    // Load initial state
    setSubscriptions(subscriptionService.getActiveSubscriptions());
    setCurrentTier(subscriptionService.getSubscriptionTier());

    return unsubscribe;
  }, []);

  const handlePurchase = async (productId: string) => {
    setLoading(productId);
    try {
      const result = await subscriptionService.purchaseSubscription(productId);
      if (result.success) {
        Alert.alert('Success', result.message);
      } else {
        Alert.alert('Error', result.message);
      }
    } catch (error) {
      Alert.alert('Error', 'Failed to purchase subscription');
    } finally {
      setLoading(null);
    }
  };

  const handleRestore = async () => {
    setLoading('restore');
    try {
      await subscriptionService.restoreSubscriptions();
      Alert.alert('Success', 'Subscriptions restored successfully');
    } catch (error) {
      Alert.alert('Error', 'Failed to restore subscriptions');
    } finally {
      setLoading(null);
    }
  };

  const subscriptionProducts = Object.values(IAP_PRODUCTS).filter(
    product => product.type === 'subscription'
  );

  const features = {
    free: [
      'Basic gameplay',
      'Limited save slots',
      'Standard themes',
    ],
    premium: [
      'Everything in Free',
      'Ad-free experience',
      'Unlimited save slots',
      'Cloud sync',
      'Premium themes',
      'Priority support',
    ],
    ultimate: [
      'Everything in Premium',
      'Advanced analytics',
      'Early access to features',
      'Exclusive content',
      'VIP support',
    ],
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        <View style={styles.container}>
          <LinearGradient
            colors={['#667EEA', '#764BA2']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.header}
          >
            <View style={styles.headerContent}>
              <Crown size={32} color="#FFFFFF" />
              <Text style={styles.title}>Premium Subscriptions</Text>
            </View>
            <TouchableOpacity style={styles.closeButton} onPress={onClose}>
              <X size={24} color="#FFFFFF" />
            </TouchableOpacity>
          </LinearGradient>

          <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
            <View style={styles.currentTierContainer}>
              <Text style={styles.currentTierLabel}>Current Plan:</Text>
              <Text style={styles.currentTierValue}>
                {currentTier.charAt(0).toUpperCase() + currentTier.slice(1)}
              </Text>
            </View>

            <View style={styles.featuresContainer}>
              <Text style={styles.sectionTitle}>Features</Text>
              {Object.entries(features).map(([tier, tierFeatures]) => (
                <View key={tier} style={styles.tierFeatures}>
                  <Text style={styles.tierName}>
                    {tier.charAt(0).toUpperCase() + tier.slice(1)}:
                  </Text>
                  {tierFeatures.map((feature, index) => (
                    <View key={index} style={styles.featureItem}>
                      <Check size={16} color="#10B981" />
                      <Text style={styles.featureText}>{feature}</Text>
                    </View>
                  ))}
                </View>
              ))}
            </View>

            <View style={styles.productsContainer}>
              <Text style={styles.sectionTitle}>Available Plans</Text>
              {subscriptionProducts.map((product) => {
                const isActive = subscriptions.some(sub => 
                  sub.productId === product.id && sub.isActive
                );
                
                return (
                  <View key={product.id} style={styles.productCard}>
                    <View style={styles.productHeader}>
                      <Star size={24} color="#F59E0B" />
                      <View style={styles.productInfo}>
                        <Text style={styles.productName}>{product.name}</Text>
                        <Text style={styles.productPrice}>{product.price}</Text>
                      </View>
                      {isActive && (
                        <View style={styles.activeBadge}>
                          <Text style={styles.activeBadgeText}>Active</Text>
                        </View>
                      )}
                    </View>
                    {product.description && (
                      <Text style={styles.productDescription}>{product.description}</Text>
                    )}
                    <LoadingButton
                      title={isActive ? 'Active' : 'Subscribe'}
                      onPress={() => handlePurchase(product.id)}
                      loading={loading === product.id}
                      disabled={isActive}
                      variant={isActive ? 'secondary' : 'primary'}
                      style={styles.subscribeButton}
                    />
                  </View>
                );
              })}
            </View>

            <TouchableOpacity
              style={styles.restoreButton}
              onPress={handleRestore}
              disabled={loading === 'restore'}
            >
              <Text style={styles.restoreButtonText}>
                {loading === 'restore' ? 'Restoring...' : 'Restore Purchases'}
              </Text>
            </TouchableOpacity>
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
    justifyContent: 'flex-end',
  },
  container: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '90%',
  },
  header: {
    padding: 20,
    paddingTop: 30,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  headerContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#FFFFFF',
  },
  closeButton: {
    padding: 4,
  },
  content: {
    padding: 20,
  },
  currentTierContainer: {
    backgroundColor: '#F3F4F6',
    borderRadius: 12,
    padding: 16,
    marginBottom: 24,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  currentTierLabel: {
    fontSize: 16,
    color: '#6B7280',
  },
  currentTierValue: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1F2937',
  },
  featuresContainer: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#1F2937',
    marginBottom: 16,
  },
  tierFeatures: {
    marginBottom: 16,
  },
  tierName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 8,
  },
  featureItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 6,
    gap: 8,
  },
  featureText: {
    fontSize: 14,
    color: '#6B7280',
  },
  productsContainer: {
    marginBottom: 24,
  },
  productCard: {
    backgroundColor: '#F9FAFB',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
  },
  productHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
    gap: 12,
  },
  productInfo: {
    flex: 1,
  },
  productName: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1F2937',
    marginBottom: 4,
  },
  productPrice: {
    fontSize: 16,
    color: '#10B981',
    fontWeight: '600',
  },
  activeBadge: {
    backgroundColor: '#10B981',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
  },
  activeBadgeText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '600',
  },
  productDescription: {
    fontSize: 14,
    color: '#6B7280',
    marginBottom: 12,
    lineHeight: 20,
  },
  subscribeButton: {
    marginTop: 8,
  },
  restoreButton: {
    padding: 16,
    alignItems: 'center',
    marginBottom: 20,
  },
  restoreButtonText: {
    fontSize: 16,
    color: '#3B82F6',
    fontWeight: '600',
  },
});

