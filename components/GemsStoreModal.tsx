import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  ScrollView,
  Alert,
  Platform,
  Image,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
import { Ionicons } from '@expo/vector-icons';
import { RefreshCw } from 'lucide-react-native';
import { useGame } from '@/contexts/GameContext';
import LoadingSpinner from './LoadingSpinner';
import { iapService } from '@/services/IAPService';
import { IAP_PRODUCTS, getProductConfig } from '@/utils/iapConfig';
import { responsiveFontSize, responsivePadding } from '@/utils/scaling';
import { logger } from '@/utils/logger';

interface GemsStoreModalProps {
  visible: boolean;
  onClose: () => void;
}

interface GemPackage {
  id: string;
  title: string;
  gems: number;
  price: string;
  description: string;
  popular?: boolean;
  bonus?: number;
  image: string;
}

const GEM_PACKAGES: GemPackage[] = [
  {
    id: IAP_PRODUCTS.GEMS_100,
    title: 'Starter Pack',
    gems: 100,
    price: '$0.99',
    description: 'Perfect for trying out premium features',
    image: require('@/assets/images/iap/gems/gems_100.png'),
  },
  {
    id: IAP_PRODUCTS.GEMS_500,
    title: 'Value Pack',
    gems: 500,
    price: '$4.99',
    description: 'Great value for regular players',
    popular: true,
    image: require('@/assets/images/iap/gems/gems_500.png'),
  },
  {
    id: IAP_PRODUCTS.GEMS_1000,
    title: 'Mega Pack',
    gems: 1000,
    price: '$9.99',
    description: 'Best value for active players',
    popular: false,
    image: require('@/assets/images/iap/gems/gems_1000.png'),
  },
  {
    id: IAP_PRODUCTS.GEMS_5000,
    title: 'Ultimate Pack',
    gems: 5000,
    price: '$19.99',
    description: 'Huge gem pack for dedicated players',
    popular: false,
    image: require('@/assets/images/iap/gems/gems_5000.png'),
  },
  {
    id: IAP_PRODUCTS.GEMS_15000,
    title: 'Whale Pack',
    gems: 15000,
    price: '$49.99',
    description: 'Massive gem pack for power players',
    popular: false,
    image: require('@/assets/images/iap/gems/gems_15000.png'),
  },
];

export default function GemsStoreModal({ visible, onClose }: GemsStoreModalProps) {
  const { gameState, setGameState } = useGame();
  const [isLoading, setIsLoading] = useState(false);
  const [purchasing, setPurchasing] = useState<string | null>(null);
  const [isInitializing, setIsInitializing] = useState(false);

  useEffect(() => {
    if (visible) {
      setIsInitializing(true);
      // Initialize IAP service when modal opens (non-blocking)
      iapService.initialize()
        .then(() => {
          logger.info('IAP service initialized successfully in GemsStoreModal');
        })
        .catch(error => {
          logger.error('IAP initialization failed in GemsStoreModal:', error);
          // Don't block the modal if IAP fails to initialize
        })
        .finally(() => {
          setIsInitializing(false);
        });
    }
  }, [visible]);

  const handlePurchase = async (packageId: string) => {
    try {
      setPurchasing(packageId);
      setIsLoading(true);

      const result = await iapService.purchaseProduct(packageId);
      
      if (result.success) {
        const packageData = GEM_PACKAGES.find(pkg => pkg.id === packageId);
        if (packageData) {
          const totalGems = packageData.gems + (packageData.bonus || 0);
          
          setGameState(prev => ({
            ...prev,
            stats: {
              ...prev.stats,
              gems: prev.stats.gems + totalGems,
            },
          }));

          Alert.alert(
            'Purchase Successful!',
            `You received ${totalGems} gems! ${packageData.bonus ? `(${packageData.bonus} bonus gems included)` : ''}`,
            [{ text: 'Awesome!', style: 'default' }]
          );
        }
      } else {
        Alert.alert('Purchase Failed', result.message);
      }
    } catch (error) {
      logger.error('Purchase error:', error);
      Alert.alert('Purchase Error', 'Something went wrong. Please try again.');
    } finally {
      setPurchasing(null);
      setIsLoading(false);
    }
  };

  const handleRestorePurchases = async () => {
    if (isLoading) {
      Alert.alert('Please Wait', 'A purchase operation is already in progress.');
      return;
    }

    setIsLoading(true);
    
    try {
      logger.info('Starting purchase restoration...');
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
      logger.error('Restore purchases error:', error);
      Alert.alert(
        'Restore Failed',
        'Unable to restore purchases. Please try again or contact support.',
        [{ text: 'OK', style: 'default' }]
      );
    } finally {
      setIsLoading(false);
    }
  };

  const renderPackage = (pkg: GemPackage) => {
    const isPurchasing = purchasing === pkg.id;
    const totalGems = pkg.gems + (pkg.bonus || 0);

    return (
      <View key={pkg.id} style={[styles.packageCard, pkg.popular && styles.popularPackage]}>
        {pkg.popular && (
          <View style={styles.popularBadge}>
            <Text style={styles.popularText}>MOST POPULAR</Text>
          </View>
        )}
        
        <View style={styles.packageHeader}>
          <View style={styles.packageTitleContainer}>
            <Text style={styles.packageTitle}>{pkg.title}</Text>
            <Text style={styles.packageDescription}>{pkg.description}</Text>
          </View>
          <Image source={pkg.image} style={styles.packageImage} />
        </View>

        <View style={styles.gemsContainer}>
          <Ionicons name="diamond" size={20} color="#FFD700" />
          <Text style={styles.gemsText}>{totalGems}</Text>
        </View>

        {pkg.bonus && (
          <View style={styles.bonusContainer}>
            <Ionicons name="gift" size={16} color="#4CAF50" />
            <Text style={styles.bonusText}>+{pkg.bonus} bonus gems!</Text>
          </View>
        )}

        <TouchableOpacity
          style={[styles.purchaseButton, isPurchasing && styles.purchaseButtonDisabled]}
          onPress={() => handlePurchase(pkg.id)}
          disabled={isPurchasing || isLoading}
        >
          {isPurchasing ? (
            <LoadingSpinner visible size="small" color="#FFFFFF" message="" variant="compact" />
          ) : (
            <Text style={styles.purchaseButtonText}>{pkg.price}</Text>
          )}
        </TouchableOpacity>
      </View>
    );
  };

  return (
    <Modal
      visible={visible}
      animationType="fade"
      transparent={true}
      onRequestClose={onClose}
    >
      <BlurView intensity={20} style={styles.modalOverlay}>
        <View style={styles.modalContainer}>
          <LinearGradient
            colors={['#1a1a2e', '#16213e', '#0f3460']}
            style={styles.modalContent}
          >
            {/* Header */}
            <View style={styles.header}>
              <View style={styles.headerLeft}>
                <Ionicons name="diamond" size={24} color="#FFD700" />
                <Text style={styles.headerTitle}>Gems Store</Text>
              </View>
              <TouchableOpacity onPress={onClose} style={styles.closeButton}>
                <Ionicons name="close" size={24} color="#FFFFFF" />
              </TouchableOpacity>
            </View>

            {/* Current Gems */}
            <View style={styles.currentGemsContainer}>
              <Text style={styles.currentGemsLabel}>Your Gems:</Text>
              <View style={styles.currentGemsValue}>
                <Ionicons name="diamond" size={20} color="#FFD700" />
                <Text style={styles.currentGemsText}>{gameState.stats.gems}</Text>
              </View>
            </View>

            {/* Packages */}
            <ScrollView style={styles.packagesContainer} showsVerticalScrollIndicator={false}>
              <Text style={styles.packagesTitle}>Choose Your Package</Text>
            {isInitializing ? (
              <View style={styles.loadingContainer}>
                <LoadingSpinner visible size="large" color="#FFD700" message="" variant="compact" />
                <Text style={styles.loadingText}>Loading store...</Text>
              </View>
            ) : (
                GEM_PACKAGES.map(renderPackage)
              )}
            </ScrollView>

            {/* Footer */}
            <View style={styles.footer}>
              <Text style={styles.footerText}>
                Gems are used for premium features, speeding up actions, and exclusive content.
              </Text>
              <Text style={styles.footerText}>
                All purchases are secure and processed through your app store.
              </Text>
              
              {/* Restore Purchases Button */}
              <TouchableOpacity
                style={styles.restoreButton}
                onPress={handleRestorePurchases}
                disabled={isLoading}
              >
                <RefreshCw size={16} color={isLoading ? '#9CA3AF' : '#FFD700'} />
                <Text style={[styles.restoreButtonText, isLoading && styles.restoreButtonTextDisabled]}>
                  {isLoading ? 'Restoring...' : 'Restore Purchases'}
                </Text>
              </TouchableOpacity>
            </View>
          </LinearGradient>
        </View>
      </BlurView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
  },
  modalContainer: {
    width: '90%',
    maxHeight: '80%',
    borderRadius: 20,
    overflow: 'hidden',
  },
  modalContent: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: responsivePadding.large,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.1)',
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: responsiveFontSize['2xl'],
    fontWeight: 'bold',
    color: '#FFFFFF',
    marginLeft: responsivePadding.medium,
  },
  closeButton: {
    padding: responsivePadding.small,
  },
  currentGemsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: responsivePadding.large,
    backgroundColor: 'rgba(255, 215, 0, 0.1)',
    margin: responsivePadding.large,
    borderRadius: 15,
    borderWidth: 1,
    borderColor: 'rgba(255, 215, 0, 0.3)',
  },
  currentGemsLabel: {
    fontSize: responsiveFontSize.lg,
    color: '#FFFFFF',
    fontWeight: '600',
  },
  currentGemsValue: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  currentGemsText: {
    fontSize: responsiveFontSize.xl,
    fontWeight: 'bold',
    color: '#FFD700',
    marginLeft: responsivePadding.small,
  },
  packagesContainer: {
    flex: 1,
    paddingHorizontal: responsivePadding.large,
  },
  packagesTitle: {
    fontSize: responsiveFontSize.xl,
    fontWeight: 'bold',
    color: '#FFFFFF',
    marginBottom: responsivePadding.large,
    textAlign: 'center',
  },
  packageCard: {
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 15,
    padding: responsivePadding.large,
    marginBottom: responsivePadding.large,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.2)',
    position: 'relative',
  },
  popularPackage: {
    borderColor: '#FFD700',
    borderWidth: 2,
  },
  popularBadge: {
    position: 'absolute',
    top: -10,
    left: 20,
    backgroundColor: '#FFD700',
    paddingHorizontal: responsivePadding.medium,
    paddingVertical: responsivePadding.small,
    borderRadius: 10,
  },
  popularText: {
    fontSize: responsiveFontSize.xs,
    fontWeight: 'bold',
    color: '#000000',
  },
  packageHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: responsivePadding.large,
  },
  packageTitleContainer: {
    flex: 1,
  },
  packageTitle: {
    fontSize: responsiveFontSize.xl,
    fontWeight: 'bold',
    color: '#FFFFFF',
    marginBottom: responsivePadding.small,
  },
  packageDescription: {
    fontSize: responsiveFontSize.base,
    color: '#CCCCCC',
  },
  packageImage: {
    width: 60,
    height: 60,
    marginLeft: responsivePadding.large,
    marginTop: responsivePadding.medium,
  },
  gemsContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: responsivePadding.medium,
    paddingVertical: responsivePadding.small,
    backgroundColor: 'rgba(255, 215, 0, 0.1)',
    borderRadius: 8,
  },
  gemsText: {
    fontSize: responsiveFontSize['2xl'],
    fontWeight: 'bold',
    color: '#FFD700',
    marginLeft: responsivePadding.small,
  },
  bonusContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: responsivePadding.large,
  },
  bonusText: {
    fontSize: responsiveFontSize.base,
    color: '#4CAF50',
    fontWeight: '600',
    marginLeft: responsivePadding.small,
  },
  purchaseButton: {
    backgroundColor: '#FFD700',
    borderRadius: 10,
    padding: responsivePadding.large,
    alignItems: 'center',
  },
  purchaseButtonDisabled: {
    backgroundColor: 'rgba(255, 215, 0, 0.5)',
  },
  purchaseButtonText: {
    fontSize: responsiveFontSize.lg,
    fontWeight: 'bold',
    color: '#000000',
  },
  footer: {
    padding: responsivePadding.large,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.1)',
  },
  footerText: {
    fontSize: responsiveFontSize.sm,
    color: '#CCCCCC',
    textAlign: 'center',
    marginBottom: responsivePadding.small,
  },
  loadingContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: responsivePadding.xl,
  },
  loadingText: {
    fontSize: responsiveFontSize.lg,
    color: '#FFFFFF',
    marginTop: responsivePadding.medium,
    textAlign: 'center',
  },
  restoreButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    marginTop: 12,
    gap: 8,
  },
  restoreButtonText: {
    color: '#FFD700',
    fontSize: 14,
    fontWeight: '500',
    marginLeft: 6,
  },
  restoreButtonTextDisabled: {
    color: '#9CA3AF',
  },
});