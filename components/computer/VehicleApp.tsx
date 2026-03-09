/**
 * Vehicle App Component
 * 
 * Complete garage management: purchase/sell vehicles, refuel, repair, insurance, and driver's license
 */
import React, { useState, useMemo, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  Dimensions,
  Modal,
  Image,
} from 'react-native';
import LinearGradientFallback from '@/components/fallbacks/LinearGradientFallback';
const LinearGradient = LinearGradientFallback;
import {
  ArrowLeft,
  Car,
  Bike,
  Fuel,
  Wrench,
  Shield,
  CreditCard,
  ShoppingCart,
  DollarSign,
  Star,
  Gauge,
  MapPin,
  CheckCircle,
  XCircle,
  Award,
  AlertTriangle,
  Settings,
} from 'lucide-react-native';
import { useGame } from '@/contexts/GameContext';
import EmptyState from '@/components/ui/EmptyState';
import {
  VEHICLE_TEMPLATES,
  INSURANCE_PLANS,
  DRIVERS_LICENSE,
  VehicleTemplate,
  calculateVehicleSellPrice,
  calculateRepairCost,
  calculateFuelCost,
} from '@/lib/vehicles/vehicles';
import {
  getDriversLicense,
  purchaseVehicle,
  sellVehicle,
  refuelVehicle,
  repairVehicle,
  purchaseInsurance,
  cancelInsurance,
  setActiveVehicle,
} from '@/contexts/game/actions/VehicleActions';
import { updateMoney } from '@/contexts/game/actions/MoneyActions';
import { updateStats } from '@/contexts/game/actions/StatsActions';
import { scale, fontScale } from '@/utils/scaling';
import { Vehicle, VehicleInsurance } from '@/contexts/game/types';

const { width: screenWidth } = Dimensions.get('window');

interface VehicleAppProps {
  onBack: () => void;
}

type TabType = 'garage' | 'dealership' | 'insurance';

export default function VehicleApp({ onBack }: VehicleAppProps) {
  const { gameState, setGameState, saveGame } = useGame();
  const [activeTab, setActiveTab] = useState<TabType>('garage');
  const [selectedVehicleType, setSelectedVehicleType] = useState<'all' | 'car' | 'motorcycle' | 'luxury' | 'sports'>('all');
  const [showInsuranceModal, setShowInsuranceModal] = useState(false);
  const [insuranceVehicleId, setInsuranceVehicleId] = useState<string | null>(null);
  const { settings } = gameState;

  const ownedVehicles = gameState.vehicles || [];
  const hasLicense = gameState.hasDriversLicense || false;

  // Filter vehicles for dealership
  const availableVehicles = useMemo(() => {
    const owned = new Set(ownedVehicles.map(v => v.id));
    let filtered = VEHICLE_TEMPLATES.filter(v => !owned.has(v.id));
    if (selectedVehicleType !== 'all') {
      filtered = filtered.filter(v => v.type === selectedVehicleType);
    }
    return filtered;
  }, [ownedVehicles, selectedVehicleType]);

  // Get active vehicle
  const activeVehicle = useMemo(() => {
    if (!gameState.activeVehicleId) return null;
    return ownedVehicles.find(v => v.id === gameState.activeVehicleId) || null;
  }, [gameState.activeVehicleId, ownedVehicles]);

  const handleGetLicense = useCallback(() => {
    Alert.alert(
      "Get Driver's License",
      `Visit the DMV to get your driver's license for $${DRIVERS_LICENSE.cost}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Get License',
          onPress: () => {
            const result = getDriversLicense(gameState, setGameState, { updateMoney });
            if (result.success) {
              saveGame();
              Alert.alert('Success!', result.message);
            } else {
              Alert.alert('Cannot Get License', result.message);
            }
          },
        },
      ]
    );
  }, [gameState, setGameState, saveGame]);

  const handlePurchaseVehicle = useCallback((template: VehicleTemplate) => {
    if (!hasLicense) {
      Alert.alert('License Required', "You need a driver's license before purchasing a vehicle.");
      return;
    }

    if (template.requiredReputation && gameState.stats.reputation < template.requiredReputation) {
      Alert.alert('Reputation Required', `You need ${template.requiredReputation} reputation to purchase this vehicle.`);
      return;
    }

    if (gameState.stats.money < template.price) {
      Alert.alert('Insufficient Funds', `You need $${template.price.toLocaleString()} to purchase this vehicle.`);
      return;
    }

    Alert.alert(
      `Purchase ${template.name}`,
      `Are you sure you want to buy a ${template.name} for $${template.price.toLocaleString()}?\n\nWeekly costs: ~$${(template.weeklyMaintenanceCost + template.weeklyFuelCost).toLocaleString()}`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Buy',
          onPress: () => {
            const result = purchaseVehicle(gameState, setGameState, template.id, { updateMoney, updateStats });
            if (result.success) {
              saveGame();
              Alert.alert('Congratulations!', result.message);
            } else {
              Alert.alert('Purchase Failed', result.message);
            }
          },
        },
      ]
    );
  }, [hasLicense, gameState, setGameState, saveGame]);

  const handleSellVehicle = useCallback((vehicle: Vehicle) => {
    const sellPrice = calculateVehicleSellPrice(vehicle);

    Alert.alert(
      `Sell ${vehicle.name}`,
      `Sell your ${vehicle.name} for $${sellPrice.toLocaleString()}?\n\nOriginal price: $${vehicle.price.toLocaleString()}\nCondition: ${vehicle.condition}%`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Sell',
          style: 'destructive',
          onPress: () => {
            const result = sellVehicle(gameState, setGameState, vehicle.id, { updateMoney, updateStats });
            if (result.success) {
              saveGame();
              Alert.alert('Sold!', result.message);
            } else {
              Alert.alert('Sale Failed', result.message);
            }
          },
        },
      ]
    );
  }, [gameState, setGameState, saveGame]);

  const handleRefuel = useCallback((vehicle: Vehicle) => {
    const fuelCost = calculateFuelCost(vehicle);
    if (fuelCost === 0) {
      Alert.alert('Tank Full', 'Your tank is already full!');
      return;
    }

    const result = refuelVehicle(gameState, setGameState, vehicle.id, { updateMoney });
    if (result.success) {
      saveGame();
      Alert.alert('Refueled!', result.message);
    } else {
      Alert.alert('Refuel Failed', result.message);
    }
  }, [gameState, setGameState, saveGame]);

  const handleRepair = useCallback((vehicle: Vehicle) => {
    const repairCost = calculateRepairCost(vehicle);
    if (repairCost === 0) {
      Alert.alert('Perfect Condition', 'Your vehicle is already in perfect condition!');
      return;
    }

    // Apply insurance discount
    let adjustedCost = repairCost;
    if (vehicle.insurance?.active) {
      adjustedCost = Math.floor(repairCost * (1 - vehicle.insurance.coveragePercent / 100));
    }

    Alert.alert(
      `Repair ${vehicle.name}`,
      `Repair your ${vehicle.name} for $${adjustedCost.toLocaleString()}?${vehicle.insurance?.active ? `\n\nInsurance covers ${vehicle.insurance.coveragePercent}%!` : ''}`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Repair',
          onPress: () => {
            const result = repairVehicle(gameState, setGameState, vehicle.id, { updateMoney });
            if (result.success) {
              saveGame();
              Alert.alert('Repaired!', result.message);
            } else {
              Alert.alert('Repair Failed', result.message);
            }
          },
        },
      ]
    );
  }, [gameState, setGameState, saveGame]);

  const handleSetActive = useCallback((vehicle: Vehicle) => {
    const result = setActiveVehicle(gameState, setGameState, vehicle.id);
    if (result.success) {
      saveGame();
    }
  }, [gameState, setGameState, saveGame]);

  const openInsuranceModal = useCallback((vehicleId: string) => {
    setInsuranceVehicleId(vehicleId);
    setShowInsuranceModal(true);
  }, []);

  const handlePurchaseInsurance = useCallback((type: VehicleInsurance['type']) => {
    if (!insuranceVehicleId) return;

    const plan = INSURANCE_PLANS.find(p => p.type === type);
    if (!plan) return;

    const premiumCost = plan.monthlyCost * 6;

    Alert.alert(
      `${type.charAt(0).toUpperCase() + type.slice(1)} Insurance`,
      `6-month premium: $${premiumCost.toLocaleString()}\nCoverage: ${plan.coveragePercent}% of repair costs`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Purchase',
          onPress: () => {
            const result = purchaseInsurance(gameState, setGameState, insuranceVehicleId, type, { updateMoney });
            if (result.success) {
              saveGame();
              setShowInsuranceModal(false);
              Alert.alert('Insurance Active!', result.message);
            } else {
              Alert.alert('Purchase Failed', result.message);
            }
          },
        },
      ]
    );
  }, [insuranceVehicleId, gameState, setGameState, saveGame]);

  const handleCancelInsurance = useCallback((vehicleId: string) => {
    Alert.alert(
      'Cancel Insurance',
      'Cancel your insurance? You will not receive a refund.',
      [
        { text: 'Keep Insurance', style: 'cancel' },
        {
          text: 'Cancel',
          style: 'destructive',
          onPress: () => {
            const result = cancelInsurance(gameState, setGameState, vehicleId);
            if (result.success) {
              saveGame();
            }
          },
        },
      ]
    );
  }, [gameState, setGameState, saveGame]);

  const getVehicleIcon = (type: string) => {
    switch (type) {
      case 'motorcycle':
        return Bike;
      default:
        return Car;
    }
  };

  const getConditionColor = (condition: number) => {
    if (condition >= 80) return '#22C55E';
    if (condition >= 50) return '#F59E0B';
    if (condition >= 25) return '#F97316';
    return '#EF4444';
  };

  const getFuelColor = (fuel: number) => {
    if (fuel >= 60) return '#22C55E';
    if (fuel >= 30) return '#F59E0B';
    return '#EF4444';
  };

  const renderHeader = () => (
    <View style={styles.header}>
      <TouchableOpacity onPress={onBack} style={styles.backButton}>
        <ArrowLeft size={scale(24)} color={settings.darkMode ? '#F9FAFB' : '#111827'} />
      </TouchableOpacity>
      <Text style={[styles.headerTitle, settings.darkMode && styles.textDark]}>
        Garage
      </Text>
      <View style={styles.headerRight}>
        <Text style={[styles.moneyText, settings.darkMode && styles.textDark]}>
          ${gameState.stats.money.toLocaleString()}
        </Text>
      </View>
    </View>
  );

  const renderLicensePrompt = () => (
    <View style={[styles.licenseCard, settings.darkMode && styles.cardDark]}>
      <View style={styles.licenseHeader}>
        <CreditCard size={scale(32)} color="#3B82F6" />
        <View style={styles.licenseInfo}>
          <Text style={[styles.licenseTitle, settings.darkMode && styles.textDark]}>
            Driver&apos;s License Required
          </Text>
          <Text style={[styles.licenseDesc, settings.darkMode && styles.textMuted]}>
            Get your license to start driving!
          </Text>
        </View>
      </View>
      <TouchableOpacity
        style={styles.getLicenseButton}
        onPress={handleGetLicense}
      >
        <Text style={styles.getLicenseText}>
          Get License - ${DRIVERS_LICENSE.cost}
        </Text>
      </TouchableOpacity>
    </View>
  );

  const renderTabs = () => (
    <View style={[styles.tabContainer, settings.darkMode && styles.tabContainerDark]}>
      {(['garage', 'dealership', 'insurance'] as TabType[]).map(tab => (
        <TouchableOpacity
          key={tab}
          style={[
            styles.tab,
            activeTab === tab && styles.tabActive,
            activeTab === tab && settings.darkMode && styles.tabActiveDark,
          ]}
          onPress={() => setActiveTab(tab)}
        >
          <Text
            style={[
              styles.tabText,
              activeTab === tab && styles.tabTextActive,
              settings.darkMode && styles.textMuted,
              activeTab === tab && settings.darkMode && styles.tabTextActiveDark,
            ]}
          >
            {tab.charAt(0).toUpperCase() + tab.slice(1)}
          </Text>
        </TouchableOpacity>
      ))}
    </View>
  );

  const renderGarage = () => (
    <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
      {ownedVehicles.length === 0 ? (
        <EmptyState
          icon="🚗"
          title="No Vehicles"
          description="Visit a dealership to buy your first car. Vehicles can improve your commute and lifestyle."
          darkMode={settings?.darkMode ?? true}
        />
      ) : (
        ownedVehicles.map(vehicle => {
          const VehicleIcon = getVehicleIcon(vehicle.type);
          const isActive = gameState.activeVehicleId === vehicle.id;
          const sellPrice = calculateVehicleSellPrice(vehicle);
          const vehicleTemplate = VEHICLE_TEMPLATES.find(t => t.id === vehicle.id);

          return (
            <View
              key={vehicle.id}
              style={[
                styles.vehicleCard,
                settings.darkMode && styles.cardDark,
                isActive && styles.vehicleCardActive,
              ]}
            >
              <TouchableOpacity
                style={styles.vehicleHeader}
                onPress={() => handleSetActive(vehicle)}
              >
                <View style={styles.vehicleIconContainer}>
                  {vehicleTemplate?.image ? (
                    <Image source={vehicleTemplate.image} style={styles.vehicleImage} resizeMode="contain" />
                  ) : (
                    <VehicleIcon size={scale(32)} color={isActive ? '#3B82F6' : (settings.darkMode ? '#9CA3AF' : '#6B7280')} />
                  )}
                </View>
                <View style={styles.vehicleInfo}>
                  <View style={styles.vehicleNameRow}>
                    <Text style={[styles.vehicleName, settings.darkMode && styles.textDark]}>
                      {vehicle.name}
                    </Text>
                    {isActive && (
                      <View style={styles.activeBadge}>
                        <CheckCircle size={scale(14)} color="#22C55E" />
                        <Text style={styles.activeBadgeText}>Active</Text>
                      </View>
                    )}
                  </View>
                  <Text style={[styles.vehicleType, settings.darkMode && styles.textMuted]}>
                    {vehicle.type.charAt(0).toUpperCase() + vehicle.type.slice(1)} • {vehicle.mileage.toLocaleString()} mi
                  </Text>
                </View>
              </TouchableOpacity>

              {/* Status Bars */}
              <View style={styles.statusBars}>
                {/* Fuel */}
                <View style={styles.statusRow}>
                  <Fuel size={scale(16)} color={getFuelColor(vehicle.fuelLevel)} />
                  <View style={styles.statusBarContainer}>
                    <View
                      style={[
                        styles.statusBar,
                        { width: `${vehicle.fuelLevel}%`, backgroundColor: getFuelColor(vehicle.fuelLevel) },
                      ]}
                    />
                  </View>
                  <Text style={[styles.statusText, settings.darkMode && styles.textMuted]}>
                    {vehicle.fuelLevel}%
                  </Text>
                </View>

                {/* Condition */}
                <View style={styles.statusRow}>
                  <Wrench size={scale(16)} color={getConditionColor(vehicle.condition)} />
                  <View style={styles.statusBarContainer}>
                    <View
                      style={[
                        styles.statusBar,
                        { width: `${vehicle.condition}%`, backgroundColor: getConditionColor(vehicle.condition) },
                      ]}
                    />
                  </View>
                  <Text style={[styles.statusText, settings.darkMode && styles.textMuted]}>
                    {vehicle.condition}%
                  </Text>
                </View>
              </View>

              {/* Insurance Badge */}
              {vehicle.insurance?.active && (
                <View style={styles.insuranceBadge}>
                  <Shield size={scale(14)} color="#8B5CF6" />
                  <Text style={styles.insuranceBadgeText}>
                    {vehicle.insurance.type.charAt(0).toUpperCase() + vehicle.insurance.type.slice(1)} • {vehicle.insurance.coveragePercent}% coverage
                  </Text>
                </View>
              )}

              {/* Action Buttons */}
              <View style={styles.vehicleActions}>
                <TouchableOpacity
                  style={[styles.actionButton, { backgroundColor: '#3B82F6' }]}
                  onPress={() => handleRefuel(vehicle)}
                >
                  <Fuel size={scale(14)} color="#FFFFFF" />
                  <Text style={styles.actionButtonText}>Refuel</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.actionButton, { backgroundColor: '#F59E0B' }]}
                  onPress={() => handleRepair(vehicle)}
                >
                  <Wrench size={scale(14)} color="#FFFFFF" />
                  <Text style={styles.actionButtonText}>Repair</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.actionButton, { backgroundColor: '#8B5CF6' }]}
                  onPress={() => openInsuranceModal(vehicle.id)}
                >
                  <Shield size={scale(14)} color="#FFFFFF" />
                  <Text style={styles.actionButtonText}>Insure</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.actionButton, { backgroundColor: '#EF4444' }]}
                  onPress={() => handleSellVehicle(vehicle)}
                >
                  <DollarSign size={scale(14)} color="#FFFFFF" />
                  <Text style={styles.actionButtonText}>Sell</Text>
                </TouchableOpacity>
              </View>
            </View>
          );
        })
      )}
    </ScrollView>
  );

  const renderDealership = () => (
    <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
      {/* Type Filter */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.typeFilter}
        contentContainerStyle={styles.typeFilterContent}
      >
        {(['all', 'car', 'motorcycle', 'sports', 'luxury'] as const).map(type => (
          <TouchableOpacity
            key={type}
            style={[
              styles.typeButton,
              selectedVehicleType === type && styles.typeButtonActive,
            ]}
            onPress={() => setSelectedVehicleType(type)}
          >
            <Text
              style={[
                styles.typeButtonText,
                selectedVehicleType === type && styles.typeButtonTextActive,
              ]}
            >
              {type.charAt(0).toUpperCase() + type.slice(1)}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {/* Available Vehicles */}
      {availableVehicles.map(template => {
        const VehicleIcon = getVehicleIcon(template.type);
        const canAfford = gameState.stats.money >= template.price;
        const meetsRepReq = !template.requiredReputation || gameState.stats.reputation >= template.requiredReputation;

        return (
          <TouchableOpacity
            key={template.id}
            style={[
              styles.dealerCard,
              settings.darkMode && styles.cardDark,
              !canAfford && styles.dealerCardDisabled,
            ]}
            onPress={() => handlePurchaseVehicle(template)}
            disabled={!canAfford || !hasLicense}
          >
            <View style={styles.dealerHeader}>
              <View style={styles.dealerIconContainer}>
                {template.image ? (
                  <Image source={template.image} style={styles.dealerImage} resizeMode="contain" />
                ) : (
                  <VehicleIcon
                    size={scale(28)}
                    color={template.type === 'luxury' ? '#F59E0B' : '#3B82F6'}
                  />
                )}
              </View>
              <View style={styles.dealerInfo}>
                <Text style={[styles.dealerName, settings.darkMode && styles.textDark]}>
                  {template.name}
                </Text>
                <Text style={[styles.dealerType, settings.darkMode && styles.textMuted]}>
                  {template.type.charAt(0).toUpperCase() + template.type.slice(1)}
                </Text>
              </View>
              <View style={styles.dealerPrice}>
                <Text style={[styles.priceText, !canAfford && styles.priceTextDisabled]}>
                  ${template.price.toLocaleString()}
                </Text>
              </View>
            </View>

            <Text style={[styles.dealerDesc, settings.darkMode && styles.textMuted]} numberOfLines={2}>
              {template.description}
            </Text>

            <View style={styles.dealerStats}>
              <View style={styles.statItem}>
                <Star size={scale(14)} color="#F59E0B" />
                <Text style={[styles.statText, settings.darkMode && styles.textMuted]}>
                  +{template.reputationBonus} Rep
                </Text>
              </View>
              <View style={styles.statItem}>
                <Gauge size={scale(14)} color="#3B82F6" />
                <Text style={[styles.statText, settings.darkMode && styles.textMuted]}>
                  {template.speedBonus}% faster
                </Text>
              </View>
              <View style={styles.statItem}>
                <DollarSign size={scale(14)} color="#EF4444" />
                <Text style={[styles.statText, settings.darkMode && styles.textMuted]}>
                  ~${template.weeklyMaintenanceCost + template.weeklyFuelCost}/wk
                </Text>
              </View>
            </View>

            {template.requiredReputation && !meetsRepReq && (
              <View style={styles.reqBadge}>
                <AlertTriangle size={scale(14)} color="#F59E0B" />
                <Text style={styles.reqText}>
                  Requires {template.requiredReputation} reputation
                </Text>
              </View>
            )}
          </TouchableOpacity>
        );
      })}
    </ScrollView>
  );

  const renderInsuranceTab = () => (
    <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
      <View style={[styles.infoCard, settings.darkMode && styles.cardDark]}>
        <Shield size={scale(32)} color="#8B5CF6" />
        <Text style={[styles.infoTitle, settings.darkMode && styles.textDark]}>
          Vehicle Insurance
        </Text>
        <Text style={[styles.infoDesc, settings.darkMode && styles.textMuted]}>
          Protect your vehicles from accidents and theft. Higher coverage means lower repair costs!
        </Text>
      </View>

      {INSURANCE_PLANS.map(plan => (
        <View key={plan.id} style={[styles.insurancePlanCard, settings.darkMode && styles.cardDark]}>
          <View style={styles.planHeader}>
            <Text style={[styles.planName, settings.darkMode && styles.textDark]}>
              {plan.type.charAt(0).toUpperCase() + plan.type.slice(1)}
            </Text>
            <Text style={[styles.planPrice, settings.darkMode && styles.textDark]}>
              ${plan.monthlyCost}/mo
            </Text>
          </View>
          <View style={styles.planDetails}>
            <View style={styles.planStat}>
              <CheckCircle size={scale(16)} color="#22C55E" />
              <Text style={[styles.planStatText, settings.darkMode && styles.textMuted]}>
                {plan.coveragePercent}% repair coverage
              </Text>
            </View>
            <View style={styles.planStat}>
              <CreditCard size={scale(16)} color="#3B82F6" />
              <Text style={[styles.planStatText, settings.darkMode && styles.textMuted]}>
                6-month premium: ${plan.monthlyCost * 6}
              </Text>
            </View>
          </View>
        </View>
      ))}
    </ScrollView>
  );

  // Insurance Modal
  const renderInsuranceModal = () => {
    const vehicle = ownedVehicles.find(v => v.id === insuranceVehicleId);
    if (!vehicle) return null;

    return (
      <Modal
        visible={showInsuranceModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowInsuranceModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContentDark}>
            <Text style={[styles.modalTitle, styles.textDark]}>
              Insurance for {vehicle.name}
            </Text>

            {vehicle.insurance?.active ? (
              <View style={styles.currentInsurance}>
                <Shield size={scale(40)} color="#8B5CF6" />
                <Text style={[styles.currentInsuranceText, styles.textDark]}>
                  {vehicle.insurance.type.charAt(0).toUpperCase() + vehicle.insurance.type.slice(1)} Insurance Active
                </Text>
                <Text style={[styles.currentInsuranceDesc, styles.textMuted]}>
                  Expires in {Math.max(0, vehicle.insurance.expiresWeek - gameState.weeksLived)} weeks
                </Text>
                <TouchableOpacity
                  style={styles.cancelInsuranceButton}
                  onPress={() => {
                    handleCancelInsurance(vehicle.id);
                    setShowInsuranceModal(false);
                  }}
                >
                  <Text style={styles.cancelInsuranceText}>Cancel Insurance</Text>
                </TouchableOpacity>
              </View>
            ) : (
              <>
                {INSURANCE_PLANS.map(plan => (
                  <TouchableOpacity
                    key={plan.id}
                    style={styles.insuranceOptionDark}
                    onPress={() => handlePurchaseInsurance(plan.type)}
                  >
                    <View style={styles.insuranceOptionHeader}>
                      <Text style={[styles.insuranceOptionName, styles.textDark]}>
                        {plan.type.charAt(0).toUpperCase() + plan.type.slice(1)}
                      </Text>
                      <Text style={styles.insuranceOptionPrice}>
                        ${plan.monthlyCost * 6} / 6 mo
                      </Text>
                    </View>
                    <Text style={[styles.insuranceOptionCoverage, styles.textMuted]}>
                      {plan.coveragePercent}% coverage
                    </Text>
                  </TouchableOpacity>
                ))}
              </>
            )}

            <TouchableOpacity
              style={styles.modalCloseButtonDark}
              onPress={() => setShowInsuranceModal(false)}
            >
              <Text style={[styles.modalCloseText, styles.textDark]}>Close</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    );
  };

  return (
    <LinearGradient
      colors={settings.darkMode ? ['#1F2937', '#111827'] : ['#FFFFFF', '#F8FAFC']}
      style={styles.container}
    >
      {renderHeader()}
      
      {!hasLicense && renderLicensePrompt()}
      
      {hasLicense && renderTabs()}
      
      {hasLicense && activeTab === 'garage' && renderGarage()}
      {hasLicense && activeTab === 'dealership' && renderDealership()}
      {hasLicense && activeTab === 'insurance' && renderInsuranceTab()}
      
      {renderInsuranceModal()}
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: scale(16),
    paddingTop: scale(48),
    paddingBottom: scale(16),
  },
  backButton: {
    padding: scale(8),
  },
  headerTitle: {
    fontSize: fontScale(20),
    fontWeight: '700',
    color: '#111827',
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  moneyText: {
    fontSize: fontScale(14),
    fontWeight: '600',
    color: '#22C55E',
  },
  textDark: {
    color: '#F9FAFB',
  },
  textMuted: {
    color: '#9CA3AF',
  },
  licenseCard: {
    backgroundColor: '#FFFFFF',
    margin: scale(16),
    padding: scale(20),
    borderRadius: scale(16),
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  cardDark: {
    backgroundColor: '#374151',
  },
  licenseHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: scale(16),
  },
  licenseInfo: {
    marginLeft: scale(12),
    flex: 1,
  },
  licenseTitle: {
    fontSize: fontScale(16),
    fontWeight: '700',
    color: '#111827',
  },
  licenseDesc: {
    fontSize: fontScale(14),
    color: '#6B7280',
    marginTop: scale(2),
  },
  getLicenseButton: {
    backgroundColor: '#3B82F6',
    paddingVertical: scale(12),
    borderRadius: scale(12),
    alignItems: 'center',
  },
  getLicenseText: {
    color: '#FFFFFF',
    fontSize: fontScale(16),
    fontWeight: '600',
  },
  tabContainer: {
    flexDirection: 'row',
    marginHorizontal: scale(16),
    backgroundColor: '#F3F4F6',
    borderRadius: scale(12),
    padding: scale(4),
  },
  tabContainerDark: {
    backgroundColor: '#374151',
  },
  tab: {
    flex: 1,
    paddingVertical: scale(10),
    alignItems: 'center',
    borderRadius: scale(8),
  },
  tabActive: {
    backgroundColor: '#FFFFFF',
  },
  tabActiveDark: {
    backgroundColor: '#4B5563',
  },
  tabText: {
    fontSize: fontScale(14),
    fontWeight: '500',
    color: '#6B7280',
  },
  tabTextActive: {
    color: '#111827',
    fontWeight: '600',
  },
  tabTextActiveDark: {
    color: '#F9FAFB',
  },
  content: {
    flex: 1,
    paddingHorizontal: scale(16),
    paddingTop: scale(16),
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: scale(60),
  },
  emptyTitle: {
    fontSize: fontScale(18),
    fontWeight: '600',
    color: '#111827',
    marginTop: scale(16),
  },
  emptyDesc: {
    fontSize: fontScale(14),
    color: '#6B7280',
    marginTop: scale(8),
    textAlign: 'center',
  },
  vehicleCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: scale(16),
    padding: scale(16),
    marginBottom: scale(12),
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  vehicleCardActive: {
    borderWidth: 2,
    borderColor: '#3B82F6',
  },
  vehicleHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: scale(12),
  },
  vehicleIconContainer: {
    width: scale(96),
    height: scale(96),
    borderRadius: scale(12),
    backgroundColor: 'transparent',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  vehicleImage: {
    width: scale(96),
    height: scale(96),
  },
  vehicleInfo: {
    flex: 1,
    marginLeft: scale(12),
  },
  vehicleNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  vehicleName: {
    fontSize: fontScale(16),
    fontWeight: '600',
    color: '#111827',
  },
  activeBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#22C55E20',
    paddingHorizontal: scale(8),
    paddingVertical: scale(2),
    borderRadius: scale(8),
    marginLeft: scale(8),
  },
  activeBadgeText: {
    fontSize: fontScale(11),
    fontWeight: '600',
    color: '#22C55E',
    marginLeft: scale(4),
  },
  vehicleType: {
    fontSize: fontScale(13),
    color: '#6B7280',
    marginTop: scale(2),
  },
  statusBars: {
    marginBottom: scale(12),
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: scale(8),
  },
  statusBarContainer: {
    flex: 1,
    height: scale(8),
    backgroundColor: '#E5E7EB',
    borderRadius: scale(4),
    marginHorizontal: scale(8),
    overflow: 'hidden',
  },
  statusBar: {
    height: '100%',
    borderRadius: scale(4),
  },
  statusText: {
    fontSize: fontScale(12),
    fontWeight: '500',
    color: '#6B7280',
    width: scale(36),
    textAlign: 'right',
  },
  insuranceBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#8B5CF620',
    paddingHorizontal: scale(10),
    paddingVertical: scale(6),
    borderRadius: scale(8),
    alignSelf: 'flex-start',
    marginBottom: scale(12),
  },
  insuranceBadgeText: {
    fontSize: fontScale(12),
    fontWeight: '500',
    color: '#8B5CF6',
    marginLeft: scale(6),
  },
  vehicleActions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'flex-start',
    gap: scale(6),
    marginTop: scale(4),
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: scale(6),
    paddingHorizontal: scale(10),
    borderRadius: scale(8),
    minWidth: scale(70),
  },
  actionButtonText: {
    color: '#FFFFFF',
    fontSize: fontScale(11),
    fontWeight: '600',
    marginLeft: scale(3),
  },
  typeFilter: {
    marginBottom: scale(12),
  },
  typeFilterContent: {
    gap: scale(8),
  },
  typeButton: {
    paddingHorizontal: scale(16),
    paddingVertical: scale(8),
    borderRadius: scale(20),
    backgroundColor: '#F3F4F6',
    marginRight: scale(8),
  },
  typeButtonActive: {
    backgroundColor: '#3B82F6',
  },
  typeButtonText: {
    fontSize: fontScale(14),
    fontWeight: '500',
    color: '#6B7280',
  },
  typeButtonTextActive: {
    color: '#FFFFFF',
  },
  dealerCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: scale(16),
    padding: scale(16),
    marginBottom: scale(12),
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  dealerCardDisabled: {
    opacity: 0.6,
  },
  dealerHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: scale(8),
  },
  dealerIconContainer: {
    width: scale(88),
    height: scale(88),
    borderRadius: scale(12),
    backgroundColor: 'transparent',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  dealerImage: {
    width: scale(88),
    height: scale(88),
  },
  dealerInfo: {
    flex: 1,
    marginLeft: scale(12),
  },
  dealerName: {
    fontSize: fontScale(16),
    fontWeight: '600',
    color: '#111827',
  },
  dealerType: {
    fontSize: fontScale(13),
    color: '#6B7280',
  },
  dealerPrice: {
    alignItems: 'flex-end',
  },
  priceText: {
    fontSize: fontScale(16),
    fontWeight: '700',
    color: '#22C55E',
  },
  priceTextDisabled: {
    color: '#EF4444',
  },
  dealerDesc: {
    fontSize: fontScale(13),
    color: '#6B7280',
    marginBottom: scale(12),
    lineHeight: fontScale(18),
  },
  dealerStats: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: scale(12),
  },
  statItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: scale(4),
  },
  statText: {
    fontSize: fontScale(12),
    color: '#6B7280',
  },
  reqBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F59E0B20',
    paddingHorizontal: scale(10),
    paddingVertical: scale(6),
    borderRadius: scale(8),
    marginTop: scale(12),
    alignSelf: 'flex-start',
  },
  reqText: {
    fontSize: fontScale(12),
    fontWeight: '500',
    color: '#F59E0B',
    marginLeft: scale(6),
  },
  infoCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: scale(16),
    padding: scale(20),
    alignItems: 'center',
    marginBottom: scale(16),
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  infoTitle: {
    fontSize: fontScale(18),
    fontWeight: '700',
    color: '#111827',
    marginTop: scale(12),
  },
  infoDesc: {
    fontSize: fontScale(14),
    color: '#6B7280',
    textAlign: 'center',
    marginTop: scale(8),
    lineHeight: fontScale(20),
  },
  insurancePlanCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: scale(16),
    padding: scale(16),
    marginBottom: scale(12),
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  planHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: scale(12),
  },
  planName: {
    fontSize: fontScale(16),
    fontWeight: '600',
    color: '#111827',
  },
  planPrice: {
    fontSize: fontScale(16),
    fontWeight: '700',
    color: '#8B5CF6',
  },
  planDetails: {
    gap: scale(8),
  },
  planStat: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: scale(8),
  },
  planStatText: {
    fontSize: fontScale(14),
    color: '#6B7280',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: scale(24),
    borderTopRightRadius: scale(24),
    padding: scale(24),
    maxHeight: '80%',
  },
  modalContentDark: {
    backgroundColor: '#1F2937',
    borderTopLeftRadius: scale(24),
    borderTopRightRadius: scale(24),
    padding: scale(24),
    maxHeight: '80%',
  },
  modalTitle: {
    fontSize: fontScale(20),
    fontWeight: '700',
    color: '#111827',
    marginBottom: scale(20),
    textAlign: 'center',
  },
  currentInsurance: {
    alignItems: 'center',
    paddingVertical: scale(20),
  },
  currentInsuranceText: {
    fontSize: fontScale(18),
    fontWeight: '600',
    color: '#111827',
    marginTop: scale(12),
  },
  currentInsuranceDesc: {
    fontSize: fontScale(14),
    color: '#6B7280',
    marginTop: scale(4),
  },
  cancelInsuranceButton: {
    marginTop: scale(20),
    paddingVertical: scale(12),
    paddingHorizontal: scale(24),
    backgroundColor: '#EF444420',
    borderRadius: scale(12),
  },
  cancelInsuranceText: {
    fontSize: fontScale(14),
    fontWeight: '600',
    color: '#EF4444',
  },
  insuranceOption: {
    backgroundColor: '#F3F4F6',
    borderRadius: scale(12),
    padding: scale(16),
    marginBottom: scale(12),
  },
  insuranceOptionDark: {
    backgroundColor: '#374151',
    borderRadius: scale(12),
    padding: scale(16),
    marginBottom: scale(12),
  },
  insuranceOptionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: scale(4),
  },
  insuranceOptionName: {
    fontSize: fontScale(16),
    fontWeight: '600',
    color: '#111827',
  },
  insuranceOptionPrice: {
    fontSize: fontScale(14),
    fontWeight: '700',
    color: '#8B5CF6',
  },
  insuranceOptionCoverage: {
    fontSize: fontScale(13),
    color: '#6B7280',
  },
  modalCloseButton: {
    backgroundColor: '#F3F4F6',
    paddingVertical: scale(14),
    borderRadius: scale(12),
    alignItems: 'center',
    marginTop: scale(8),
  },
  modalCloseButtonDark: {
    backgroundColor: '#374151',
    paddingVertical: scale(14),
    borderRadius: scale(12),
    alignItems: 'center',
    marginTop: scale(8),
  },
  modalCloseText: {
    fontSize: fontScale(16),
    fontWeight: '600',
    color: '#6B7280',
  },
});


