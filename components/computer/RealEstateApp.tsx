import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Image,
  Alert,
  ImageSourcePropType,
  Dimensions,
  Platform,
  TextInput,
  Modal,
} from 'react-native';
import { MotiView } from '@/components/anim/MotiStub';
import { ArrowLeft, Home, MapPin, TrendingUp, Heart, Shield, Zap, Building2, BarChart3, Settings, Search, X } from 'lucide-react-native';
import { useGame, RealEstate as GameRealEstate } from '@/contexts/GameContext';
import EmptyState from '@/components/ui/EmptyState';
import { logger } from '@/utils/logger';
import { useMemoryCleanup } from '@/utils/performanceOptimization';
import { scale, fontScale } from '@/utils/scaling';
import { formatMoney } from '@/utils/moneyFormatting';
import { PLAYER_RENT_RATE_WEEKLY } from '@/lib/economy/constants';
import { RENT_INCOME_RATE } from '@/lib/config/gameConstants';
import { resolveAbsoluteWeek } from '@/utils/weekCounters';
import { updateTenantSatisfactionForWeek } from '@/utils/realEstateWeekly';

const { width: screenWidth } = Dimensions.get('window');

interface RealEstateAppProps {
  onBack: () => void;
}

interface Upgrade {
  id: string;
  name: string;
  cost: number;
  rentIncrease: number;
  purchased: boolean;
}

interface Property {
  id: string;
  name: string;
  price: number;
  dailyIncome: number;
  location: string;
  image: ImageSourcePropType;
  owned: boolean;
  status: 'vacant' | 'owner' | 'rented';
  upgrades: Upgrade[];
  traits: { happiness?: number; health?: number; energy?: number };
  traitDescription: string;
  currentValue: number;
  managementLevel: number;
  lastMaintenance: number;
  tenantSatisfaction: number;
  marketDemand: number;
}

const defaultUpgrades: Upgrade[] = [
  { id: 'kitchen', name: 'Renovated Kitchen', cost: 5000, rentIncrease: 100, purchased: false },
  { id: 'bathroom', name: 'New Bathroom', cost: 4000, rentIncrease: 80, purchased: false },
  { id: 'solar', name: 'Solar Panels', cost: 8000, rentIncrease: 160, purchased: false },
  { id: 'smarthome', name: 'Smart Home System', cost: 6000, rentIncrease: 120, purchased: false },
  { id: 'landscaping', name: 'Landscaping', cost: 3000, rentIncrease: 60, purchased: false },
];

const placeholderImage = require('@/assets/images/Real Estate.png');

// Type guard helpers for RealEstate properties
function hasStatus(prop: GameRealEstate | Property): prop is GameRealEstate & { status: 'vacant' | 'owner' | 'rented' } {
  return 'status' in prop && (prop.status === 'vacant' || prop.status === 'owner' || prop.status === 'rented');
}

function hasCurrentResidence(prop: GameRealEstate | Property): prop is GameRealEstate & { currentResidence: boolean } {
  return 'currentResidence' in prop && typeof prop.currentResidence === 'boolean';
}

function hasCurrentValue(prop: GameRealEstate | Property): prop is GameRealEstate & { currentValue: number } {
  return 'currentValue' in prop && typeof prop.currentValue === 'number';
}

function hasLastMaintenance(prop: GameRealEstate | Property): prop is GameRealEstate & { lastMaintenance: number } {
  return 'lastMaintenance' in prop && typeof prop.lastMaintenance === 'number';
}

function hasTenantSatisfaction(prop: GameRealEstate | Property): prop is GameRealEstate & { tenantSatisfaction: number } {
  return 'tenantSatisfaction' in prop && typeof prop.tenantSatisfaction === 'number';
}

function hasMarketDemand(prop: GameRealEstate | Property): prop is GameRealEstate & { marketDemand: number } {
  return 'marketDemand' in prop && typeof prop.marketDemand === 'number';
}

const defaultProperties: Property[] = [
  {
    id: 'apartment1',
    name: 'City Apartment',
    price: 150000,
    dailyIncome: 100,
    location: 'Downtown',
    image: require('@/assets/images/Real Estate/City Apartment.png'),
    owned: false,
    status: 'vacant',
    upgrades: defaultUpgrades.map(u => ({ ...u })),
    traits: { happiness: 5 },
    traitDescription: '+5 happiness when living here',
    currentValue: 150000,
    managementLevel: 0,
    lastMaintenance: 0,
    tenantSatisfaction: 75,
    marketDemand: 80,
  },
  {
    id: 'house1',
    name: 'Suburban House',
    price: 250000,
    dailyIncome: 150,
    location: 'Suburbs',
    image: require('@/assets/images/Real Estate/Suburaban House.png'),
    owned: false,
    status: 'vacant',
    upgrades: defaultUpgrades.map(u => ({ ...u })),
    traits: { health: 5 },
    traitDescription: '+5 health in a calm neighborhood',
    currentValue: 250000,
    managementLevel: 0,
    lastMaintenance: 0,
    tenantSatisfaction: 80,
    marketDemand: 85,
  },
  {
    id: 'condo1',
    name: 'Luxury Condo',
    price: 400000,
    dailyIncome: 250,
    location: 'Uptown',
    image: require('@/assets/images/Real Estate/Luxury Condo.png'),
    owned: false,
    status: 'vacant',
    upgrades: defaultUpgrades.map(u => ({ ...u })),
    traits: { energy: 5 },
    traitDescription: '+5 energy from modern amenities',
    currentValue: 400000,
    managementLevel: 0,
    lastMaintenance: 0,
    tenantSatisfaction: 85,
    marketDemand: 90,
  },
  {
    id: 'mansion1',
    name: 'Modern Mansion',
    price: 800000,
    dailyIncome: 500,
    location: 'Hills',
    image: require('@/assets/images/Real Estate/Modern Mansion.png'),
    owned: false,
    status: 'vacant',
    upgrades: defaultUpgrades.map(u => ({ ...u })),
    traits: { happiness: 15 },
    traitDescription: 'Lavish living grants +15 happiness',
    currentValue: 800000,
    managementLevel: 0,
    lastMaintenance: 0,
    tenantSatisfaction: 90,
    marketDemand: 95,
  },
  {
    id: 'penthouse1',
    name: 'Penthouse Suite',
    price: 1200000,
    dailyIncome: 750,
    location: 'City Center',
    image: require('@/assets/images/Real Estate/Penthouse Suite.png'),
    owned: false,
    status: 'vacant',
    upgrades: defaultUpgrades.map(u => ({ ...u })),
    traits: { happiness: 20 },
    traitDescription: 'Skyline views give +20 happiness',
    currentValue: 1200000,
    managementLevel: 0,
    lastMaintenance: 0,
    tenantSatisfaction: 95,
    marketDemand: 98,
  },
  {
    id: 'villa1',
    name: 'Beach Villa',
    price: 2000000,
    dailyIncome: 1250,
    location: 'Coastline',
    image: require('@/assets/images/Real Estate/Beach Villa.png'),
    owned: false,
    status: 'vacant',
    upgrades: defaultUpgrades.map(u => ({ ...u })),
    traits: { energy: 10 },
    traitDescription: 'Sea breeze restores +10 energy',
    currentValue: 2000000,
    managementLevel: 0,
    lastMaintenance: 0,
    tenantSatisfaction: 92,
    marketDemand: 96,
  },
  {
    id: 'estate1',
    name: 'Rural Estate',
    price: 3500000,
    dailyIncome: 2000,
    location: 'Rural Area',
    image: require('@/assets/images/Real Estate/Rural Estate.png'),
    owned: false,
    status: 'vacant',
    upgrades: defaultUpgrades.map(u => ({ ...u })),
    traits: { energy: 15 },
    traitDescription: 'Quiet nature adds +15 health',
    currentValue: 3500000,
    managementLevel: 0,
    lastMaintenance: 0,
    tenantSatisfaction: 88,
    marketDemand: 92,
  },
  {
    id: 'tower1',
    name: 'Office Tower',
    price: 5000000,
    dailyIncome: 3000,
    location: 'Business District',
    image: require('@/assets/images/Real Estate/Office Tower.png'),
    owned: false,
    status: 'vacant',
    upgrades: defaultUpgrades.map(u => ({ ...u })),
    traits: { energy: 15 },
    traitDescription: 'Entrepreneur spirit gives +15 energy',
    currentValue: 5000000,
    managementLevel: 0,
    lastMaintenance: 0,
    tenantSatisfaction: 85,
    marketDemand: 90,
  },
  {
    id: 'studio1',
    name: 'Downtown Studio',
    price: 100000,
    dailyIncome: 75,
    location: 'Central',
    image: require('@/assets/images/Real Estate/Downtown Studio.png'),
    owned: false,
    status: 'vacant',
    upgrades: defaultUpgrades.map(u => ({ ...u })),
    traits: { energy: 3 },
    traitDescription: 'City convenience +3 energy',
    currentValue: 100000,
    managementLevel: 0,
    lastMaintenance: 0,
    tenantSatisfaction: 70,
    marketDemand: 75,
  },
  {
    id: 'cabin1',
    name: 'Mountain Cabin',
    price: 180000,
    dailyIncome: 110,
    location: 'Mountains',
    image: require('@/assets/images/Real Estate/Mountain Cabin.png'),
    owned: false,
    status: 'vacant',
    upgrades: defaultUpgrades.map(u => ({ ...u })),
    traits: { health: 7 },
    traitDescription: 'Fresh air grants +7 health',
    currentValue: 180000,
    managementLevel: 0,
    lastMaintenance: 0,
    tenantSatisfaction: 75,
    marketDemand: 78,
  },
  {
    id: 'cottage1',
    name: 'Lakeside Cottage',
    price: 320000,
    dailyIncome: 175,
    location: 'Lakeside',
    image: require('@/assets/images/Real Estate/Lakeside Cottage.png'),
    owned: false,
    status: 'vacant',
    upgrades: defaultUpgrades.map(u => ({ ...u })),
    traits: { happiness: 8 },
    traitDescription: 'Relaxing views +8 happiness',
    currentValue: 320000,
    managementLevel: 0,
    lastMaintenance: 0,
    tenantSatisfaction: 82,
    marketDemand: 85,
  },
];

export default function RealEstateApp({ onBack }: RealEstateAppProps) {
  const { gameState, setGameState, saveGame } = useGame();
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { hasEarlyRealEstateAccess } = require('@/lib/prestige/applyUnlocks');
  const unlockedBonuses = gameState.prestige?.unlockedBonuses || [];
  const hasEarlyAccess = hasEarlyRealEstateAccess(unlockedBonuses);
  const playerAge = gameState.date?.age || 18;
  const { addCleanup } = useMemoryCleanup();
  
  const realEstate = gameState.realEstate || [];
  const money = gameState.stats.money;
  const currentWeekOfMonth = gameState.week;
  const absoluteWeek = resolveAbsoluteWeek(gameState.weeksLived, currentWeekOfMonth);
  const darkMode = !!gameState.settings?.darkMode;
  
  const realEstateEffects = gameState.politics?.activePolicyEffects?.realEstate;
  
  const getAdjustedProperty = useCallback((property: Property) => {
    const priceModifier = realEstateEffects?.priceModifier ?? 1;
    const rentModifier = realEstateEffects?.rentModifier ?? 1;
    
    return {
      ...property,
      price: Math.round(property.price * priceModifier),
      dailyIncome: Math.round(property.dailyIncome * rentModifier),
    };
  }, [realEstateEffects]);
  
  const [activeTab, setActiveTab] = useState<'browse' | 'owned' | 'market'>('browse');
  const [properties, setProperties] = useState<Property[]>(defaultProperties);
  const [showPurchaseModal, setShowPurchaseModal] = useState(false);
  const [selectedProperty, setSelectedProperty] = useState<Property | null>(null);
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');
  const [showManagementModal, setShowManagementModal] = useState(false);
  const [showSellModal, setShowSellModal] = useState(false);
  const [showMaintenanceModal, setShowMaintenanceModal] = useState(false);
  const [showUpgradeModal, setShowUpgradeModal] = useState(false);
  const [showRentOutModal, setShowRentOutModal] = useState(false);
  const [showMoveInModal, setShowMoveInModal] = useState(false);
  const [showEndRentalModal, setShowEndRentalModal] = useState(false);
  const [showKickTenantsModal, setShowKickTenantsModal] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  
  // Get current residence from game state - find property where player is living
  const currentResidenceId = useMemo(() => {
    const ownedProps = (gameState.realEstate || []).filter(p => p.owned && hasStatus(p) && p.status === 'owner');
    // Find property marked as currentResidence
    const currentResidence = ownedProps.find(p => hasCurrentResidence(p) && p.currentResidence === true);
    return currentResidence?.id;
  }, [gameState.realEstate]);
  const [filterBy, setFilterBy] = useState<'all' | 'affordable' | 'luxury'>('all');
  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const [settings, setSettings] = useState({
    showROI: true,
    showMarketMetrics: true,
    autoSortByROI: false,
  });
  
  const lastWeekRef = useRef(absoluteWeek);
  const timeoutRefs = useRef<ReturnType<typeof setTimeout>[]>([]);
  
  const createTimeout = useCallback((callback: () => void, delay: number) => {
    const timeoutId = setTimeout(() => {
      callback();
      timeoutRefs.current = timeoutRefs.current.filter(id => id !== timeoutId);
    }, delay);
    timeoutRefs.current.push(timeoutId);
    addCleanup(() => {
      clearTimeout(timeoutId);
      timeoutRefs.current = timeoutRefs.current.filter(id => id !== timeoutId);
    });
    return timeoutId;
  }, [addCleanup]);
  
  const showAlert = useCallback((title: string, message: string) => {
    if (Platform.OS === 'web') {
      window.alert(`${title}\n\n${message}`);
    } else {
      Alert.alert(title, message);
    }
  }, []);


  const propertyToGameState = useCallback((prop: Property) => {
    return {
      id: prop.id,
      name: prop.name,
      price: prop.price,
      weeklyHappiness: prop.traits.happiness || 0,
      weeklyEnergy: prop.traits.energy || 0,
      owned: prop.owned,
      interior: [],
      upgradeLevel: prop.managementLevel || 0,
      rent: Math.round(prop.currentValue * RENT_INCOME_RATE),
      upkeep: 0,
      status: hasStatus(prop) ? prop.status : (prop.owned ? 'owner' : 'vacant'),
      currentValue: hasCurrentValue(prop) ? prop.currentValue : prop.price,
      lastMaintenance: hasLastMaintenance(prop) ? prop.lastMaintenance : 0,
      tenantSatisfaction: hasTenantSatisfaction(prop) ? prop.tenantSatisfaction : 75,
      marketDemand: hasMarketDemand(prop) ? prop.marketDemand : 80,
    };
  }, []);

  const gameStateToProperty = useCallback((gameProp: GameRealEstate, defaultProp: Property): Property => {
    const preservedName = gameProp.name && 
      gameProp.name !== 'Realestatte' && 
      !gameProp.name.toLowerCase().includes('realestatte') &&
      gameProp.name.length > 0
      ? gameProp.name 
      : defaultProp.name;
    
    return {
      ...defaultProp,
      name: preservedName,
      owned: gameProp.owned || false,
      status: hasStatus(gameProp) ? gameProp.status : (gameProp.owned ? 'owner' : 'vacant'),
      currentValue: hasCurrentValue(gameProp) ? gameProp.currentValue : defaultProp.currentValue,
      managementLevel: gameProp.upgradeLevel || defaultProp.managementLevel,
      lastMaintenance: hasLastMaintenance(gameProp) ? gameProp.lastMaintenance : defaultProp.lastMaintenance,
      tenantSatisfaction: hasTenantSatisfaction(gameProp) ? gameProp.tenantSatisfaction : defaultProp.tenantSatisfaction,
      marketDemand: hasMarketDemand(gameProp) ? gameProp.marketDemand : defaultProp.marketDemand,
      dailyIncome: defaultProp.dailyIncome + (Math.floor(defaultProp.dailyIncome * 0.2) * (gameProp.upgradeLevel || 0)),
    };
  }, []);

  const syncPropertiesFromGameState = useCallback(() => {
    const syncedProperties = defaultProperties.map(defaultProp => {
      const gameProp = realEstate.find(p => p.id === defaultProp.id);
      if (gameProp) {
        const property = gameStateToProperty(gameProp, defaultProp);
        // Preserve currentResidence flag if it exists
        if (hasCurrentResidence(gameProp) && gameProp.currentResidence === true) {
          (property as Property & { currentResidence?: boolean }).currentResidence = true;
        }
        return property;
      }
      return defaultProp;
    });
    
    setProperties(syncedProperties);
    return syncedProperties;
  }, [realEstate, gameStateToProperty]);

  useEffect(() => {
    syncPropertiesFromGameState();
  }, [realEstate, syncPropertiesFromGameState]);

  useEffect(() => {
    if (absoluteWeek > 0 && absoluteWeek !== lastWeekRef.current) {
      lastWeekRef.current = absoluteWeek;
      
      setGameState(prev => {
        const prevAbsoluteWeek = resolveAbsoluteWeek(prev.weeksLived, prev.week);
        const prevWeekOfMonth = typeof prev.week === 'number' ? prev.week : currentWeekOfMonth;
        let totalRentIncome = 0;
        let healthBoost = 0;
        let happinessBoost = 0;
        
        const updatedRealEstate = (prev.realEstate || []).map(gameProp => {
          // Handle owned properties (rented out to tenants)
          if (gameProp.owned) {
            // Add weekly rent income for rented out properties
            if (gameProp.status === 'rented' && gameProp.rent) {
              totalRentIncome += gameProp.rent;
            }
            
            let newValue = hasCurrentValue(gameProp) ? gameProp.currentValue : gameProp.price;
            let newSatisfaction = hasTenantSatisfaction(gameProp) ? gameProp.tenantSatisfaction : 75;
            let newDemand = hasMarketDemand(gameProp) ? gameProp.marketDemand : 80;
            
            const marketChange = (newDemand - 50) * 0.001;
            const satisfactionChange = (newSatisfaction - 50) * 0.0005;
            
            newValue = Math.floor(newValue * (1 + marketChange + satisfactionChange));
            
            newSatisfaction = updateTenantSatisfactionForWeek({
              tenantSatisfaction: newSatisfaction,
              lastMaintenance: hasLastMaintenance(gameProp) ? gameProp.lastMaintenance : 0,
              currentAbsoluteWeek: prevAbsoluteWeek,
              currentWeekOfMonth: prevWeekOfMonth,
            });
            
            const marketTrend = Math.random() > 0.5 ? 1 : -1;
            newDemand = Math.max(0, Math.min(100, newDemand + (marketTrend * Math.floor(Math.random() * 3))));
            
            return {
              ...gameProp,
              currentValue: newValue,
              tenantSatisfaction: newSatisfaction,
              marketDemand: newDemand,
            };
          }
          
          // Handle properties player is renting (not owned, status is 'rented')
          if (!gameProp.owned && hasStatus(gameProp) && gameProp.status === 'rented') {
            // Apply small weekly health and happiness boosts for rented properties
            // Base boost: +2 health, +3 happiness per week
            healthBoost += 2;
            happinessBoost += 3;
          }
          
          return gameProp;
        });
        
        // Apply boosts (capped at 100)
        const newHealth = Math.min(100, prev.stats.health + healthBoost);
        const newHappiness = Math.min(100, prev.stats.happiness + happinessBoost);
        
        return {
          ...prev,
          stats: { 
            ...prev.stats, 
            money: prev.stats.money + totalRentIncome,
            health: newHealth,
            happiness: newHappiness,
          },
          realEstate: updatedRealEstate,
        };
      });
      
      createTimeout(() => {
        syncPropertiesFromGameState();
        saveGame();
      }, 0);
    }
  }, [absoluteWeek, currentWeekOfMonth, saveGame, syncPropertiesFromGameState, createTimeout, setGameState]);

  const getTraitIcon = useCallback((trait: string) => {
    switch (trait) {
      case 'happiness': return Heart;
      case 'health': return Shield;
      case 'energy': return Zap;
      default: return TrendingUp;
    }
  }, []);

  const getTraitColor = useCallback((trait: string) => {
    switch (trait) {
      case 'happiness': return '#F472B6';
      case 'health': return '#34D399';
      case 'energy': return '#FBBF24';
      default: return '#94A3B8';
    }
  }, []);

  const renderTrait = useCallback((trait: string, value: number, key: string) => {
    const IconComponent = getTraitIcon(trait);
    const color = getTraitColor(trait);
    
    return (
      <View key={key} style={[styles.traitBadge, { borderColor: color + '40', backgroundColor: color + '10' }]}>
        <IconComponent size={12} color={color} />
        <Text style={[styles.traitText, { color }]}>+{value}</Text>
      </View>
    );
  }, [getTraitIcon, getTraitColor]);

  const handleBuyProperty = useCallback((property: Property) => {
    if (!hasEarlyAccess && playerAge < 25) {
      showAlert('Age Restriction', 'You must be at least 25 years old to purchase real estate.');
      return;
    }
    
    if (money < property.price) {
      showAlert('Insufficient Funds', 'You need more money to purchase this property.');
      return;
    }

    setSelectedProperty(property);
    setShowPurchaseModal(true);
  }, [money, showAlert, hasEarlyAccess, playerAge]);

  const handleRentProperty = useCallback((property: Property) => {
    const adjusted = getAdjustedProperty(property);
    const weeklyRent = Math.round(adjusted.price * PLAYER_RENT_RATE_WEEKLY);
    
    // Check if player is already renting another property
    const alreadyRenting = (realEstate || []).some(p => 
      !p.owned && hasStatus(p) && p.status === 'rented'
    );
    
    if (alreadyRenting) {
      showAlert('Already Renting', 'You can only rent one property at a time. Please end your current rental first.');
      return;
    }
    
    if (money < weeklyRent) {
      showAlert('Insufficient Funds', `You need ${formatMoney(weeklyRent)} for the first week's rent.`);
      return;
    }
    
    Alert.alert(
      'Rent Property',
      `Rent ${property.name} for ${formatMoney(weeklyRent)} per week?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Rent',
          onPress: async () => {
            const existingPropIndex = realEstate.findIndex(p => p.id === property.id);
            const propertyGameState = propertyToGameState({
              ...adjusted,
              owned: false,
              status: 'rented' as const,
            });
            
            setGameState(prev => {
              const updatedRealEstate = [...(prev.realEstate || [])];
              
              if (existingPropIndex >= 0) {
                updatedRealEstate[existingPropIndex] = {
                  ...propertyGameState,
                  status: 'rented' as const,
                };
              } else {
                updatedRealEstate.push({
                  ...propertyGameState,
                  status: 'rented' as const,
                });
              }
              
              return {
                ...prev,
                stats: { ...prev.stats, money: prev.stats.money - weeklyRent },
                realEstate: updatedRealEstate,
              };
            });
            
            setProperties(prevProperties => 
              prevProperties.map(prop => 
                prop.id === property.id ? { ...prop, status: 'rented' as const } : prop
              )
            );
            
            await saveGame();
            setSuccessMessage(`You're now renting ${property.name} for ${formatMoney(weeklyRent)}/week! You'll receive small health and happiness boosts each week.`);
            setShowSuccessModal(true);
          },
        },
      ]
    );
  }, [money, realEstate, setGameState, saveGame, propertyToGameState, getAdjustedProperty, showAlert]);

  const handleManageProperty = useCallback((property: Property) => {
    setSelectedProperty(property);
    setShowManagementModal(true);
  }, []);

  const renderPropertyCard = useCallback((property: Property, index: number) => {
    const adjusted = getAdjustedProperty(property);
    const canAfford = money >= adjusted.price;
    const ageRestriction = hasEarlyAccess || playerAge >= 25;
    const canPurchase = canAfford && ageRestriction;
    const totalIncome = Math.round(adjusted.price * RENT_INCOME_RATE);
    const roi = (RENT_INCOME_RATE * 100).toFixed(1);
    
    return (
      <MotiView
        key={property.id}
        from={{ opacity: 0, translateY: 20 }}
        animate={{ opacity: 1, translateY: 0 }}
        transition={{ type: 'timing', duration: 400, delay: index * 50 }}
        style={styles.propertyCard}
      >
        <View style={[styles.cardContent, property.owned && styles.cardContentOwned, darkMode && styles.cardContentDark]}>
          <View style={styles.imageContainer}>
            <Image source={property.image} style={styles.propertyImage} />
            {property.owned && (
              <View style={styles.ownedBadge}>
                <Text style={styles.ownedBadgeText}>Owned</Text>
              </View>
            )}
            {property.status === 'rented' && (
              <View style={styles.rentedBadge}>
                <Text style={styles.rentedBadgeText}>Rented</Text>
              </View>
            )}
          </View>

          <View style={styles.cardBody}>
            <View style={styles.cardHeader}>
              <Text style={[styles.propertyName, darkMode && styles.propertyNameDark]}>{property.name}</Text>
              <View style={styles.locationRow}>
                <MapPin size={14} color="#94A3B8" />
                <Text style={[styles.locationText, darkMode && styles.locationTextDark]}>{property.location}</Text>
              </View>
            </View>

            <View style={styles.priceRow}>
              <Text style={[styles.price, darkMode && styles.priceDark]}>
                {property.owned ? formatMoney(property.currentValue) : formatMoney(adjusted.price)}
              </Text>
              {property.owned && (
                <View style={styles.levelBadge}>
                  <Text style={styles.levelText}>Lv.{property.managementLevel}</Text>
                </View>
              )}
            </View>

            <View style={styles.statsRow}>
              <View style={[styles.stat, darkMode && styles.statDark]}>
                <TrendingUp size={14} color="#60A5FA" />
                <Text style={[styles.statText, darkMode && styles.statTextDark]}>{formatMoney(totalIncome)}/week</Text>
              </View>
              {settings.showROI && (
                <View style={[styles.stat, darkMode && styles.statDark]}>
                  <BarChart3 size={14} color="#A78BFA" />
                  <Text style={[styles.statText, darkMode && styles.statTextDark]}>{roi}% ROI</Text>
                </View>
              )}
            </View>

            {settings.showMarketMetrics && property.owned && (
              <View style={styles.metricsRow}>
                <View style={[styles.metric, darkMode && styles.metricDark]}>
                  <Text style={[styles.metricLabel, darkMode && styles.metricLabelDark]}>Demand</Text>
                  <Text style={[styles.metricValue, darkMode && styles.metricValueDark]}>{property.marketDemand}%</Text>
                </View>
                <View style={[styles.metric, darkMode && styles.metricDark]}>
                  <Text style={[styles.metricLabel, darkMode && styles.metricLabelDark]}>Satisfaction</Text>
                  <Text style={[styles.metricValue, darkMode && styles.metricValueDark]}>{property.tenantSatisfaction}%</Text>
                </View>
              </View>
            )}

            {Object.entries(property.traits).length > 0 && (
              <View style={styles.traitsRow}>
                {Object.entries(property.traits).map(([trait, value]) => 
                  renderTrait(trait, value, trait)
                )}
              </View>
            )}

            {!property.owned && property.status !== 'rented' && (
              <View style={styles.actionButtons}>
                <TouchableOpacity
                  style={[styles.buyButton, !canPurchase && styles.buyButtonDisabled]}
                  onPress={() => handleBuyProperty(property)}
                  disabled={!canPurchase}
                  activeOpacity={0.7}
                >
                  <Text style={[styles.buyButtonText, !canPurchase && styles.buyButtonTextDisabled]}>
                    {!ageRestriction ? 'Age 25+ Required' : canAfford ? 'Purchase' : 'Insufficient Funds'}
                  </Text>
                </TouchableOpacity>
                
                <TouchableOpacity
                  style={[styles.rentButton, money < (adjusted.price * PLAYER_RENT_RATE_WEEKLY) && styles.rentButtonDisabled]}
                  onPress={() => handleRentProperty(property)}
                  disabled={money < (adjusted.price * PLAYER_RENT_RATE_WEEKLY)}
                  activeOpacity={0.7}
                >
                  <Text style={[styles.rentButtonText, money < (adjusted.price * PLAYER_RENT_RATE_WEEKLY) && styles.rentButtonTextDisabled]}>
                    Rent {formatMoney(Math.round(adjusted.price * PLAYER_RENT_RATE_WEEKLY))}/week
                  </Text>
                </TouchableOpacity>
              </View>
            )}

            {!property.owned && property.status === 'rented' && (
              <View style={styles.rentedActions}>
                <View style={[styles.rentedBadgeInfo, darkMode && styles.rentedBadgeInfoDark]}>
                  <Text style={[styles.rentedInfoText, darkMode && styles.rentedInfoTextDark]}>
                    You're renting this property
                  </Text>
                  <Text style={[styles.rentedInfoSubtext, darkMode && styles.rentedInfoSubtextDark]}>
                    Weekly boosts: +2 health, +3 happiness
                  </Text>
                </View>
                <TouchableOpacity
                  style={styles.endRentalButton}
                  onPress={() => {
                    setSelectedProperty(property);
                    setShowEndRentalModal(true);
                  }}
                >
                  <Text style={styles.endRentalButtonText}>End Rental</Text>
                </TouchableOpacity>
              </View>
            )}

            {property.owned && (
              <View style={styles.ownedActions}>
                <View style={styles.actionRow}>
                  <TouchableOpacity
                    style={styles.manageButton}
                    onPress={() => handleManageProperty(property)}
                  >
                    <Text style={styles.manageButtonText}>Manage</Text>
                  </TouchableOpacity>
                  {property.status !== 'rented' && currentResidenceId !== property.id && !('currentResidence' in property && property.currentResidence) && (
                    <TouchableOpacity
                      style={styles.moveInButton}
                      onPress={() => {
                        setSelectedProperty(property);
                        setShowMoveInModal(true);
                      }}
                    >
                      <Text style={styles.moveInButtonText}>Move In</Text>
                    </TouchableOpacity>
                  )}
                  {property.status !== 'rented' && currentResidenceId !== property.id && !('currentResidence' in property && property.currentResidence) && (
                    <TouchableOpacity
                      style={styles.rentOutButton}
                      onPress={() => {
                        setSelectedProperty(property);
                        setShowRentOutModal(true);
                      }}
                    >
                      <Text style={styles.rentOutButtonText}>Rent Out</Text>
                    </TouchableOpacity>
                  )}
                  {property.status === 'rented' && (
                    <TouchableOpacity
                      style={styles.kickTenantsButton}
                      onPress={() => {
                        setSelectedProperty(property);
                        setShowKickTenantsModal(true);
                      }}
                    >
                      <Text style={styles.kickTenantsButtonText}>Kick Out</Text>
                    </TouchableOpacity>
                  )}
                  <TouchableOpacity
                    style={styles.sellButton}
                    onPress={() => {
                      setSelectedProperty(property);
                      setShowSellModal(true);
                    }}
                  >
                    <Text style={styles.sellButtonText}>Sell</Text>
                  </TouchableOpacity>
                </View>
                {((('currentResidence' in property && property.currentResidence === true) || currentResidenceId === property.id) && property.owned && property.status === 'owner') && (
                  <View style={styles.livingBadge}>
                    <Text style={styles.livingBadgeText}>🏠 Living Here</Text>
                  </View>
                )}
              </View>
            )}
          </View>
        </View>
      </MotiView>
    );
  }, [money, renderTrait, getAdjustedProperty, hasEarlyAccess, playerAge, settings, darkMode, handleBuyProperty, handleManageProperty, handleRentProperty]);

  const confirmPurchase = useCallback(async () => {
    if (!selectedProperty) return;
    
    const adjusted = getAdjustedProperty(selectedProperty);
    
    if (money < adjusted.price) {
      Alert.alert('Insufficient Funds', `You need ${formatMoney(adjusted.price)} to purchase this property.`);
      return;
    }
    
    const existingPropIndex = realEstate.findIndex(p => p.id === selectedProperty.id);
    const propertyGameState = propertyToGameState({
      ...adjusted,
      owned: true,
    });
    
    let updatedRealEstate: GameRealEstate[] = [];
    setGameState(prev => {
      updatedRealEstate = [...(prev.realEstate || [])];
      
      if (existingPropIndex >= 0) {
        updatedRealEstate[existingPropIndex] = propertyGameState;
      } else {
        updatedRealEstate.push(propertyGameState);
      }
      
      defaultProperties.forEach(defaultProp => {
        if (!updatedRealEstate.find(p => p.id === defaultProp.id)) {
          updatedRealEstate.push(propertyToGameState(defaultProp));
        }
      });
      
      return {
        ...prev,
        stats: { ...prev.stats, money: prev.stats.money - adjusted.price },
        realEstate: updatedRealEstate,
      };
    });
    
    setProperties(prevProperties => {
      return prevProperties.map(prop => {
        if (prop.id === selectedProperty.id) {
          const gameProp = updatedRealEstate.find(p => p.id === selectedProperty.id);
          if (gameProp) {
            return gameStateToProperty(gameProp, prop);
          }
          return { ...prop, owned: true };
        }
        return prop;
      });
    });
    
    try {
      await saveGame();
    } catch (error) {
      logger.error('Failed to save game after purchase:', error);
    }
    
    setShowPurchaseModal(false);
    setSelectedProperty(null);
    setSuccessMessage(`You now own ${selectedProperty.name}!`);
    setShowSuccessModal(true);
  }, [selectedProperty, money, realEstate, setGameState, saveGame, propertyToGameState, gameStateToProperty, getAdjustedProperty]);

  const performMaintenance = useCallback(async (property: Property) => {
    const maintenanceCost = Math.floor(property.currentValue * 0.02);
    const satisfactionIncrease = 15;
    const valueIncrease = Math.floor(property.currentValue * 0.05);
    
    if (money < maintenanceCost) {
      setShowMaintenanceModal(false);
      setSuccessMessage(`Insufficient funds! Maintenance costs ${formatMoney(maintenanceCost)}`);
      setShowSuccessModal(true);
      return;
    }
    
    setGameState(prev => {
      const prevAbsoluteWeek = resolveAbsoluteWeek(prev.weeksLived, prev.week);
      const updatedRealEstate = (prev.realEstate || []).map(p => {
        if (p.id === property.id) {
          return {
            ...p,
            lastMaintenance: prevAbsoluteWeek,
            tenantSatisfaction: Math.min(100, (hasTenantSatisfaction(p) ? p.tenantSatisfaction : 75) + satisfactionIncrease),
            currentValue: (hasCurrentValue(p) ? p.currentValue : p.price) + valueIncrease,
          };
        }
        return p;
      });
      
      return {
        ...prev,
        stats: { ...prev.stats, money: prev.stats.money - maintenanceCost },
        realEstate: updatedRealEstate,
      };
    });
    
    createTimeout(() => {
      syncPropertiesFromGameState();
    }, 0);
    
    try {
      await saveGame();
    } catch (error) {
      logger.error('Failed to save game after maintenance:', error);
    }
    
    setShowMaintenanceModal(false);
    setSuccessMessage(`Maintenance completed! Property value increased by ${formatMoney(valueIncrease)}`);
    setShowSuccessModal(true);
  }, [money, setGameState, saveGame, syncPropertiesFromGameState, createTimeout]);

  const upgradeManagement = useCallback(async (property: Property) => {
    const upgradeCost = Math.floor(property.currentValue * 0.1);
    const incomeIncrease = Math.floor(property.dailyIncome * 0.2);
    const valueIncrease = Math.floor(property.currentValue * 0.08);
    
    if (money < upgradeCost) {
      setShowUpgradeModal(false);
      setSuccessMessage(`Insufficient funds! Management upgrade costs ${formatMoney(upgradeCost)}`);
      setShowSuccessModal(true);
      return;
    }
    
    setGameState(prev => {
      const updatedRealEstate = (prev.realEstate || []).map(p => {
        if (p.id === property.id) {
          const newUpgradeLevel = (p.upgradeLevel || 0) + 1;
          const newValue = (hasCurrentValue(p) ? p.currentValue : p.price) + valueIncrease;
          return {
            ...p,
            upgradeLevel: newUpgradeLevel,
            rent: Math.round(newValue * RENT_INCOME_RATE),
            currentValue: newValue,
          };
        }
        return p;
      });
      
      return {
        ...prev,
        stats: { ...prev.stats, money: prev.stats.money - upgradeCost },
        realEstate: updatedRealEstate,
      };
    });
    
    createTimeout(() => {
      syncPropertiesFromGameState();
    }, 0);
    
    try {
      await saveGame();
    } catch (error) {
      logger.error('Failed to save game after upgrade:', error);
    }
    
    setShowUpgradeModal(false);
    setSuccessMessage(`Management upgraded! Daily income increased by ${formatMoney(incomeIncrease)}`);
    setShowSuccessModal(true);
  }, [money, setGameState, saveGame, syncPropertiesFromGameState, createTimeout]);

  const handleMoveIn = useCallback(async (property: Property) => {
    if (!property.owned) {
      setShowMoveInModal(false);
      setSuccessMessage('You must own this property to move in.');
      setShowSuccessModal(true);
      return;
    }

    if (property.status === 'rented') {
      setShowMoveInModal(false);
      setSuccessMessage('You cannot move into a property that is rented out.');
      setShowSuccessModal(true);
      return;
    }

    // Calculate health and happiness boosts from property traits
    const healthBoost = property.traits.health || 0;
    const happinessBoost = property.traits.happiness || 0;
    
    // Set property as current residence
    setGameState(prev => {
      // Update all properties - set the selected one as current residence, others stay as owned but not current residence
      const updatedRealEstate = (prev.realEstate || []).map(p => {
        if (p.id === property.id && p.owned) {
          return {
            ...p,
            status: 'owner' as const,
            // Mark this as the current residence
            currentResidence: true,
          };
        }
        // Remove currentResidence flag from other properties
        if (p.owned && p.id !== property.id) {
          const rest = hasCurrentResidence(p) ? (() => {
            const { currentResidence, ...rest } = p;
            return rest;
          })() : p;
          return {
            ...rest,
            status: hasStatus(p) && p.status === 'rented' ? 'rented' as const : 'owner' as const,
          };
        }
        return p;
      });
      
      // Apply health and happiness boosts
      const newHealth = Math.min(100, prev.stats.health + healthBoost);
      const newHappiness = Math.min(100, prev.stats.happiness + happinessBoost);
      
      return {
        ...prev,
        realEstate: updatedRealEstate,
        stats: {
          ...prev.stats,
          health: newHealth,
          happiness: newHappiness,
        },
      };
    });
    
    syncPropertiesFromGameState();
    
    try {
      await saveGame();
    } catch (error) {
      logger.error('Failed to save game after moving in:', error);
    }
    
    setShowMoveInModal(false);
    setSelectedProperty(null);
    const boostText = [];
    if (healthBoost > 0) boostText.push(`+${healthBoost} health`);
    if (happinessBoost > 0) boostText.push(`+${happinessBoost} happiness`);
    setSuccessMessage(`Moved into ${property.name}!${boostText.length > 0 ? ` (${boostText.join(', ')})` : ''}`);
    setShowSuccessModal(true);
  }, [setGameState, saveGame, syncPropertiesFromGameState]);

  const handleEndRental = useCallback(async (property: Property) => {
    if (property.owned || property.status !== 'rented') {
      setShowEndRentalModal(false);
      setSuccessMessage('This property is not being rented.');
      setShowSuccessModal(true);
      return;
    }

    setGameState(prev => {
      const updatedRealEstate = (prev.realEstate || []).filter(p => 
        !(p.id === property.id && !p.owned && hasStatus(p) && p.status === 'rented')
      );
      
      return {
        ...prev,
        realEstate: updatedRealEstate,
      };
    });
    
    setProperties(prevProperties => 
      prevProperties.map(prop => 
        prop.id === property.id ? { ...prop, status: 'vacant' as const } : prop
      )
    );
    
    try {
      await saveGame();
    } catch (error) {
      logger.error('Failed to save game after ending rental:', error);
    }
    
    setShowEndRentalModal(false);
    setSelectedProperty(null);
    setSuccessMessage(`Rental ended for ${property.name}.`);
    setShowSuccessModal(true);
  }, [setGameState, saveGame]);

  const handleKickTenantsOut = useCallback(async (property: Property) => {
    if (!property.owned || property.status !== 'rented') {
      setShowKickTenantsModal(false);
      setSuccessMessage('This property is not rented out.');
      setShowSuccessModal(true);
      return;
    }

    setGameState(prev => {
      const updatedRealEstate = (prev.realEstate || []).map(p => {
        if (p.id === property.id && p.owned && hasStatus(p) && p.status === 'rented') {
          return {
            ...p,
            status: 'owner' as const,
            rent: undefined,
          };
        }
        return p;
      });
      
      return {
        ...prev,
        realEstate: updatedRealEstate,
      };
    });
    
    syncPropertiesFromGameState();
    
    try {
      await saveGame();
    } catch (error) {
      logger.error('Failed to save game after kicking tenants out:', error);
    }
    
    setShowKickTenantsModal(false);
    setSelectedProperty(null);
    setSuccessMessage(`Tenants have been kicked out of ${property.name}.`);
    setShowSuccessModal(true);
  }, [setGameState, saveGame, syncPropertiesFromGameState, currentResidenceId]);

  const handleRentOutProperty = useCallback(async (property: Property) => {
    if (!property.owned) {
      setShowRentOutModal(false);
      setSuccessMessage('You must own this property to rent it out.');
      setShowSuccessModal(true);
      return;
    }

    if (property.status === 'rented') {
      setShowRentOutModal(false);
      setSuccessMessage('This property is already rented out.');
      setShowSuccessModal(true);
      return;
    }

    // Check if this is the current residence
    const isCurrentResidence = currentResidenceId === property.id || ('currentResidence' in property && property.currentResidence === true);
    if (isCurrentResidence) {
      setShowRentOutModal(false);
      setSuccessMessage('You cannot rent out a property you are currently living in. Move out first.');
      setShowSuccessModal(true);
      return;
    }

    const weeklyRent = Math.round(property.currentValue * RENT_INCOME_RATE);

    setGameState(prev => {
      const updatedRealEstate = (prev.realEstate || []).map(p => {
        if (p.id === property.id && p.owned) {
          // Remove currentResidence flag when renting out
          const rest = hasCurrentResidence(p) ? (() => {
            const { currentResidence, ...rest } = p;
            return rest;
          })() : p;
          return {
            ...rest,
            status: 'rented' as const,
            rent: weeklyRent,
          };
        }
        return p;
      });
      
      return {
        ...prev,
        realEstate: updatedRealEstate,
      };
    });
    
    syncPropertiesFromGameState();
    
    try {
      await saveGame();
    } catch (error) {
      logger.error('Failed to save game after renting out:', error);
    }
    
    setShowRentOutModal(false);
    setSelectedProperty(null);
    setSuccessMessage(`${property.name} is now rented out! You'll earn ${formatMoney(weeklyRent)}/week.`);
    setShowSuccessModal(true);
  }, [setGameState, saveGame, syncPropertiesFromGameState]);

  const sellProperty = useCallback(async (property: Property) => {
    if (!property.owned) {
      setShowSellModal(false);
      setSuccessMessage('This property is not owned and cannot be sold.');
      setShowSuccessModal(true);
      return;
    }
    
    const sellPrice = Math.floor(property.currentValue * 0.75);
    
    setGameState(prev => {
      const updatedRealEstate = (prev.realEstate || []).map(p => {
        if (p.id === property.id && p.owned) {
          return {
            ...p,
            owned: false,
            currentValue: p.price,
            rent: 0,
            upkeep: 0,
          };
        }
        return p;
      });
      
      return {
        ...prev,
        stats: { ...prev.stats, money: prev.stats.money + sellPrice },
        realEstate: updatedRealEstate,
      };
    });
    
    syncPropertiesFromGameState();
    
    try {
      await saveGame();
    } catch (error) {
      logger.error('Failed to save game after selling:', error);
    }
    
    setShowSellModal(false);
    setSelectedProperty(null);
    setSuccessMessage(`Property sold for ${formatMoney(sellPrice)}!`);
    setShowSuccessModal(true);
  }, [setGameState, saveGame, syncPropertiesFromGameState]);

  const ownedProperties = useMemo(() => properties.filter(p => p.owned), [properties]);
  const totalPortfolioValue = useMemo(() => 
    ownedProperties.reduce((sum, p) => sum + p.currentValue, 0), 
    [ownedProperties]
  );

  const filteredProperties = properties.filter(property => {
    const matchesSearch = property.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         property.location.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesFilter = filterBy === 'all' || 
                         (filterBy === 'affordable' && property.price <= 300000) ||
                         (filterBy === 'luxury' && property.price > 300000);
    const matchesTab = activeTab === 'owned' ? property.owned : !property.owned;
    return matchesSearch && matchesFilter && matchesTab;
  }).sort((a, b) => {
    if (settings.autoSortByROI) {
      const aROI = (a.currentValue * RENT_INCOME_RATE) / a.price;
      const bROI = (b.currentValue * RENT_INCOME_RATE) / b.price;
      return bROI - aROI;
    }
    return a.price - b.price;
  });

  return (
    <View style={[styles.container, darkMode && styles.containerDark]}>
      <ScrollView 
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        bounces={true}
      >
      <View style={[styles.header, darkMode && styles.headerDark]}>
        <TouchableOpacity onPress={onBack} style={[styles.backButton, darkMode && styles.backButtonDark]}>
          <ArrowLeft size={24} color={darkMode ? "#E5E7EB" : "#475569"} />
        </TouchableOpacity>
        
        <View style={styles.headerCenter}>
          <Text style={[styles.title, darkMode && styles.titleDark]}>Real Estate</Text>
          {ownedProperties.length > 0 && (
            <View style={styles.portfolioSummary}>
              <Text style={[styles.portfolioText, darkMode && styles.portfolioTextDark]}>
                {ownedProperties.length} properties • {formatMoney(totalPortfolioValue)}
              </Text>
            </View>
          )}
        </View>
        
        <TouchableOpacity 
          style={[styles.settingsButton, darkMode && styles.settingsButtonDark]}
          onPress={() => setShowSettingsModal(true)}
        >
          <Settings size={22} color={darkMode ? "#E5E7EB" : "#475569"} />
        </TouchableOpacity>
      </View>

      <View style={[styles.tabBar, darkMode && styles.tabBarDark]}>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'browse' && styles.tabActive]}
          onPress={() => setActiveTab('browse')}
        >
          <Home size={20} color={activeTab === 'browse' ? '#3B82F6' : '#94A3B8'} />
          <Text style={[styles.tabText, darkMode && styles.tabTextDark, activeTab === 'browse' && styles.tabTextActive]}>Browse</Text>
        </TouchableOpacity>
        
        <TouchableOpacity
          style={[styles.tab, activeTab === 'owned' && styles.tabActive]}
          onPress={() => setActiveTab('owned')}
        >
          <Building2 size={20} color={activeTab === 'owned' ? '#3B82F6' : '#94A3B8'} />
          <Text style={[styles.tabText, darkMode && styles.tabTextDark, activeTab === 'owned' && styles.tabTextActive]}>Owned</Text>
          {ownedProperties.length > 0 && (
            <View style={styles.tabBadge}>
              <Text style={styles.tabBadgeText}>{ownedProperties.length}</Text>
            </View>
          )}
        </TouchableOpacity>
        
        <TouchableOpacity
          style={[styles.tab, activeTab === 'market' && styles.tabActive]}
          onPress={() => setActiveTab('market')}
        >
          <BarChart3 size={20} color={activeTab === 'market' ? '#3B82F6' : '#94A3B8'} />
          <Text style={[styles.tabText, darkMode && styles.tabTextDark, activeTab === 'market' && styles.tabTextActive]}>Market</Text>
        </TouchableOpacity>
      </View>

      {activeTab !== 'market' && (
        <View style={[styles.searchSection, darkMode && styles.searchSectionDark]}>
          <View style={[styles.searchBar, darkMode && styles.searchBarDark]}>
            <Search size={18} color={darkMode ? "#94A3B8" : "#94A3B8"} />
            <TextInput
              style={[styles.searchInput, darkMode && styles.searchInputDark]}
              placeholder="Search properties..."
              placeholderTextColor={darkMode ? "#64748B" : "#CBD5E1"}
              value={searchQuery}
              onChangeText={setSearchQuery}
            />
            {searchQuery.length > 0 && (
              <TouchableOpacity onPress={() => setSearchQuery('')}>
                <X size={18} color={darkMode ? "#94A3B8" : "#94A3B8"} />
              </TouchableOpacity>
            )}
          </View>
          
          <View style={styles.filterBar}>
            <TouchableOpacity
              style={[
                styles.filterChip, 
                darkMode && styles.filterChipDark,
                filterBy === 'all' && styles.filterChipActive,
                darkMode && filterBy === 'all' && styles.filterChipActiveDark
              ]}
              onPress={() => setFilterBy('all')}
            >
              <Text style={[
                styles.filterText, 
                darkMode && styles.filterTextDark,
                filterBy === 'all' && styles.filterTextActive
              ]}>All</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[
                styles.filterChip, 
                darkMode && styles.filterChipDark,
                filterBy === 'affordable' && styles.filterChipActive,
                darkMode && filterBy === 'affordable' && styles.filterChipActiveDark
              ]}
              onPress={() => setFilterBy('affordable')}
            >
              <Text style={[
                styles.filterText, 
                darkMode && styles.filterTextDark,
                filterBy === 'affordable' && styles.filterTextActive
              ]}>Affordable</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[
                styles.filterChip, 
                darkMode && styles.filterChipDark,
                filterBy === 'luxury' && styles.filterChipActive,
                darkMode && filterBy === 'luxury' && styles.filterChipActiveDark
              ]}
              onPress={() => setFilterBy('luxury')}
            >
              <Text style={[
                styles.filterText, 
                darkMode && styles.filterTextDark,
                filterBy === 'luxury' && styles.filterTextActive
              ]}>Luxury</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

      <View style={styles.content}>
        {activeTab === 'market' ? (
          <View style={styles.marketView}>
            <View style={[styles.marketCard, darkMode && styles.marketCardDark]}>
              <BarChart3 size={32} color="#3B82F6" />
              <Text style={[styles.marketTitle, darkMode && styles.marketTitleDark]}>Market Overview</Text>
              <View style={styles.marketStats}>
                <View style={styles.marketStatItem}>
                  <Text style={[styles.marketStatLabel, darkMode && styles.marketStatLabelDark]}>Avg. Property Value</Text>
                  <Text style={[styles.marketStatValue, darkMode && styles.marketStatValueDark]}>
                    {formatMoney(Math.round(properties.reduce((sum, p) => sum + p.currentValue, 0) / properties.length))}
                  </Text>
                </View>
                <View style={styles.marketStatItem}>
                  <Text style={[styles.marketStatLabel, darkMode && styles.marketStatLabelDark]}>Market Growth</Text>
                  <Text style={[styles.marketStatValue, darkMode && styles.marketStatValueDark]}>+12.5%</Text>
                </View>
              </View>
            </View>
          </View>
        ) : (
          <View style={styles.propertiesList}>
            {activeTab === 'owned' && filteredProperties.length === 0 ? (
              <EmptyState
                icon="🏠"
                title="No Properties"
                description="Browse available properties and invest in real estate to build your portfolio."
                darkMode={settings?.darkMode ?? true}
              />
            ) : (
              filteredProperties.map((property, index) => renderPropertyCard(property, index))
            )}
          </View>
        )}
      </View>
      </ScrollView>

      {/* Modals - Using React Native Modal component */}
      <Modal
        visible={showPurchaseModal}
        transparent={true}
        animationType="fade"
        onRequestClose={() => {
          setShowPurchaseModal(false);
          setSelectedProperty(null);
        }}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modal, darkMode && styles.modalDark]}>
            <Text style={[styles.modalTitle, darkMode && styles.modalTitleDark]}>Purchase Property</Text>
            <Text style={[styles.modalMessage, darkMode && styles.modalMessageDark]}>
              Purchase {selectedProperty?.name} for {selectedProperty ? formatMoney(getAdjustedProperty(selectedProperty).price) : ''}?
            </Text>
            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={[styles.modalButton, styles.modalButtonSecondary, darkMode && styles.modalButtonSecondaryDark]}
                onPress={() => {
                  setShowPurchaseModal(false);
                  setSelectedProperty(null);
                }}
              >
                <Text style={[styles.modalButtonSecondaryText, darkMode && styles.modalButtonSecondaryTextDark]}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalButton, styles.modalButtonPrimary]}
                onPress={confirmPurchase}
              >
                <Text style={styles.modalButtonPrimaryText}>Purchase</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      <Modal
        visible={showSuccessModal}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setShowSuccessModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modal, darkMode && styles.modalDark]}>
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, darkMode && styles.modalTitleDark]}>Success!</Text>
              <TouchableOpacity onPress={() => setShowSuccessModal(false)}>
                <X size={20} color={darkMode ? "#E5E7EB" : "#64748B"} />
              </TouchableOpacity>
            </View>
            <Text style={[styles.modalMessage, darkMode && styles.modalMessageDark]}>{successMessage}</Text>
            <TouchableOpacity
              style={[styles.modalButton, styles.modalButtonPrimary, styles.modalButtonFullWidth]}
              onPress={() => setShowSuccessModal(false)}
            >
              <Text style={styles.modalButtonPrimaryText}>OK</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      <Modal
        visible={showManagementModal}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setShowManagementModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modal, darkMode && styles.modalDark]}>
            <Text style={[styles.modalTitle, darkMode && styles.modalTitleDark]}>Manage Property</Text>
            <Text style={[styles.propertyNameInModal, darkMode && styles.propertyNameInModalDark]}>{selectedProperty?.name}</Text>
            
            <View style={styles.managementStats}>
              <View style={[styles.managementStatRow, darkMode && styles.managementStatRowDark]}>
                <Text style={[styles.managementLabel, darkMode && styles.managementLabelDark]}>Current Value</Text>
                <Text style={[styles.managementValue, darkMode && styles.managementValueDark]}>{selectedProperty ? formatMoney(selectedProperty.currentValue) : ''}</Text>
              </View>
              <View style={[styles.managementStatRow, darkMode && styles.managementStatRowDark]}>
                <Text style={[styles.managementLabel, darkMode && styles.managementLabelDark]}>Weekly Income</Text>
                <Text style={[styles.managementValue, darkMode && styles.managementValueDark]}>{selectedProperty ? formatMoney(Math.round(selectedProperty.currentValue * RENT_INCOME_RATE)) : ''}</Text>
              </View>
              <View style={[styles.managementStatRow, darkMode && styles.managementStatRowDark]}>
                <Text style={[styles.managementLabel, darkMode && styles.managementLabelDark]}>Management Level</Text>
                <Text style={[styles.managementValue, darkMode && styles.managementValueDark]}>Level {selectedProperty?.managementLevel || 0}</Text>
              </View>
              {selectedProperty?.status === 'rented' && (
                <View style={[styles.managementStatRow, darkMode && styles.managementStatRowDark]}>
                  <Text style={[styles.managementLabel, darkMode && styles.managementLabelDark]}>Status</Text>
                  <Text style={[styles.managementValue, darkMode && styles.managementValueDark]}>Rented Out</Text>
                </View>
              )}
            </View>
            
            <View style={styles.managementActions}>
              <TouchableOpacity
                style={[styles.managementActionButton, styles.maintenanceButton]}
                onPress={() => {
                  setShowManagementModal(false);
                  setShowMaintenanceModal(true);
                }}
              >
                <Text style={styles.managementActionText}>
                  Maintenance ({selectedProperty ? formatMoney(Math.floor(selectedProperty.currentValue * 0.02)) : ''})
                </Text>
              </TouchableOpacity>
              
              <TouchableOpacity
                style={[styles.managementActionButton, styles.upgradeButton]}
                onPress={() => {
                  setShowManagementModal(false);
                  setShowUpgradeModal(true);
                }}
              >
                <Text style={styles.managementActionText}>
                  Upgrade ({selectedProperty ? formatMoney(Math.floor(selectedProperty.currentValue * 0.1)) : ''})
                </Text>
              </TouchableOpacity>
            </View>
            
            <TouchableOpacity
              style={[styles.modalButton, styles.modalButtonSecondary, darkMode && styles.modalButtonSecondaryDark]}
              onPress={() => setShowManagementModal(false)}
            >
              <Text style={[styles.modalButtonSecondaryText, darkMode && styles.modalButtonSecondaryTextDark]}>Close</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      <Modal
        visible={showSellModal}
        transparent={true}
        animationType="fade"
        onRequestClose={() => {
          setShowSellModal(false);
          setSelectedProperty(null);
        }}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modal, darkMode && styles.modalDark]}>
            <Text style={[styles.modalTitle, darkMode && styles.modalTitleDark]}>Sell Property</Text>
            <Text style={[styles.modalMessage, darkMode && styles.modalMessageDark]}>
              Sell {selectedProperty?.name} for {selectedProperty ? formatMoney(Math.floor(selectedProperty.currentValue * 0.75)) : ''}?
            </Text>
            <Text style={[styles.modalSubtext, darkMode && styles.modalSubtextDark]}>
              (75% of current value: {selectedProperty ? formatMoney(selectedProperty.currentValue) : ''})
            </Text>
            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={[styles.modalButton, styles.modalButtonSecondary, darkMode && styles.modalButtonSecondaryDark]}
                onPress={() => {
                  setShowSellModal(false);
                  setSelectedProperty(null);
                }}
              >
                <Text style={[styles.modalButtonSecondaryText, darkMode && styles.modalButtonSecondaryTextDark]}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalButton, styles.modalButtonDanger]}
                onPress={() => selectedProperty && sellProperty(selectedProperty)}
              >
                <Text style={styles.modalButtonDangerText}>Sell</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      <Modal
        visible={showMaintenanceModal}
        transparent={true}
        animationType="fade"
        onRequestClose={() => {
          setShowMaintenanceModal(false);
          setShowManagementModal(true);
        }}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modal, darkMode && styles.modalDark]}>
            <Text style={[styles.modalTitle, darkMode && styles.modalTitleDark]}>Property Maintenance</Text>
            <Text style={[styles.modalMessage, darkMode && styles.modalMessageDark]}>
              Perform maintenance for {selectedProperty ? formatMoney(Math.floor(selectedProperty.currentValue * 0.02)) : ''}?
            </Text>
            <Text style={[styles.modalSubtext, darkMode && styles.modalSubtextDark]}>
              Benefits: +15% satisfaction, +5% value
            </Text>
            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={[styles.modalButton, styles.modalButtonSecondary, darkMode && styles.modalButtonSecondaryDark]}
                onPress={() => {
                  setShowMaintenanceModal(false);
                  setShowManagementModal(true);
                }}
              >
                <Text style={[styles.modalButtonSecondaryText, darkMode && styles.modalButtonSecondaryTextDark]}>Back</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalButton, styles.maintenanceButton]}
                onPress={() => selectedProperty && performMaintenance(selectedProperty)}
              >
                <Text style={styles.managementActionText}>Perform Maintenance</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      <Modal
        visible={showUpgradeModal}
        transparent={true}
        animationType="fade"
        onRequestClose={() => {
          setShowUpgradeModal(false);
          setShowManagementModal(true);
        }}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modal, darkMode && styles.modalDark]}>
            <Text style={[styles.modalTitle, darkMode && styles.modalTitleDark]}>Management Upgrade</Text>
            <Text style={[styles.modalMessage, darkMode && styles.modalMessageDark]}>
              Upgrade for {selectedProperty ? formatMoney(Math.floor(selectedProperty.currentValue * 0.1)) : ''}?
            </Text>
            <Text style={[styles.modalSubtext, darkMode && styles.modalSubtextDark]}>
              Benefits: +20% income, +8% value, +1 level
            </Text>
            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={[styles.modalButton, styles.modalButtonSecondary, darkMode && styles.modalButtonSecondaryDark]}
                onPress={() => {
                  setShowUpgradeModal(false);
                  setShowManagementModal(true);
                }}
              >
                <Text style={[styles.modalButtonSecondaryText, darkMode && styles.modalButtonSecondaryTextDark]}>Back</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalButton, styles.upgradeButton]}
                onPress={() => selectedProperty && upgradeManagement(selectedProperty)}
              >
                <Text style={styles.managementActionText}>Upgrade</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      <Modal
        visible={showMoveInModal}
        transparent={true}
        animationType="fade"
        onRequestClose={() => {
          setShowMoveInModal(false);
          setSelectedProperty(null);
        }}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modal, darkMode && styles.modalDark]}>
            <Text style={[styles.modalTitle, darkMode && styles.modalTitleDark]}>Move In</Text>
            <Text style={[styles.modalMessage, darkMode && styles.modalMessageDark]}>
              Move into {selectedProperty?.name}?
            </Text>
            {selectedProperty && (selectedProperty.traits.health || selectedProperty.traits.happiness) && (
              <Text style={[styles.modalSubtext, darkMode && styles.modalSubtextDark]}>
                Benefits: {selectedProperty.traits.health ? `+${selectedProperty.traits.health} health` : ''}{selectedProperty.traits.health && selectedProperty.traits.happiness ? ', ' : ''}{selectedProperty.traits.happiness ? `+${selectedProperty.traits.happiness} happiness` : ''}
              </Text>
            )}
            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={[styles.modalButton, styles.modalButtonSecondary, darkMode && styles.modalButtonSecondaryDark]}
                onPress={() => {
                  setShowMoveInModal(false);
                  setSelectedProperty(null);
                }}
              >
                <Text style={[styles.modalButtonSecondaryText, darkMode && styles.modalButtonSecondaryTextDark]}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalButton, styles.moveInButton]}
                onPress={() => selectedProperty && handleMoveIn(selectedProperty)}
              >
                <Text style={styles.moveInButtonText}>Move In</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      <Modal
        visible={showEndRentalModal}
        transparent={true}
        animationType="fade"
        onRequestClose={() => {
          setShowEndRentalModal(false);
          setSelectedProperty(null);
        }}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modal, darkMode && styles.modalDark]}>
            <Text style={[styles.modalTitle, darkMode && styles.modalTitleDark]}>End Rental</Text>
            <Text style={[styles.modalMessage, darkMode && styles.modalMessageDark]}>
              End your rental of {selectedProperty?.name}?
            </Text>
            <Text style={[styles.modalSubtext, darkMode && styles.modalSubtextDark]}>
              You will no longer receive weekly health and happiness boosts from this property.
            </Text>
            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={[styles.modalButton, styles.modalButtonSecondary, darkMode && styles.modalButtonSecondaryDark]}
                onPress={() => {
                  setShowEndRentalModal(false);
                  setSelectedProperty(null);
                }}
              >
                <Text style={[styles.modalButtonSecondaryText, darkMode && styles.modalButtonSecondaryTextDark]}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalButton, styles.sellButton]}
                onPress={() => selectedProperty && handleEndRental(selectedProperty)}
              >
                <Text style={styles.sellButtonText}>End Rental</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      <Modal
        visible={showRentOutModal}
        transparent={true}
        animationType="fade"
        onRequestClose={() => {
          setShowRentOutModal(false);
          setSelectedProperty(null);
        }}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modal, darkMode && styles.modalDark]}>
            <Text style={[styles.modalTitle, darkMode && styles.modalTitleDark]}>Rent Out Property</Text>
            <Text style={[styles.modalMessage, darkMode && styles.modalMessageDark]}>
              Rent out {selectedProperty?.name} to tenants?
            </Text>
            <Text style={[styles.modalSubtext, darkMode && styles.modalSubtextDark]}>
              Weekly income: {selectedProperty ? formatMoney(Math.round(selectedProperty.currentValue * RENT_INCOME_RATE)) : ''}
            </Text>
            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={[styles.modalButton, styles.modalButtonSecondary, darkMode && styles.modalButtonSecondaryDark]}
                onPress={() => {
                  setShowRentOutModal(false);
                  setSelectedProperty(null);
                }}
              >
                <Text style={[styles.modalButtonSecondaryText, darkMode && styles.modalButtonSecondaryTextDark]}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalButton, styles.rentOutButton]}
                onPress={() => selectedProperty && handleRentOutProperty(selectedProperty)}
              >
                <Text style={styles.rentOutButtonText}>Rent Out</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      <Modal
        visible={showKickTenantsModal}
        transparent={true}
        animationType="fade"
        onRequestClose={() => {
          setShowKickTenantsModal(false);
          setSelectedProperty(null);
        }}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modal, darkMode && styles.modalDark]}>
            <Text style={[styles.modalTitle, darkMode && styles.modalTitleDark]}>Kick Tenants Out</Text>
            <Text style={[styles.modalMessage, darkMode && styles.modalMessageDark]}>
              Kick tenants out of {selectedProperty?.name}?
            </Text>
            <Text style={[styles.modalSubtext, darkMode && styles.modalSubtextDark]}>
              You will stop receiving rental income from this property.
            </Text>
            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={[styles.modalButton, styles.modalButtonSecondary, darkMode && styles.modalButtonSecondaryDark]}
                onPress={() => {
                  setShowKickTenantsModal(false);
                  setSelectedProperty(null);
                }}
              >
                <Text style={[styles.modalButtonSecondaryText, darkMode && styles.modalButtonSecondaryTextDark]}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalButton, styles.kickTenantsButton]}
                onPress={() => selectedProperty && handleKickTenantsOut(selectedProperty)}
              >
                <Text style={styles.kickTenantsButtonText}>Kick Out</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      <Modal
        visible={showKickTenantsModal}
        transparent={true}
        animationType="fade"
        onRequestClose={() => {
          setShowKickTenantsModal(false);
          setSelectedProperty(null);
        }}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modal, darkMode && styles.modalDark]}>
            <Text style={[styles.modalTitle, darkMode && styles.modalTitleDark]}>Kick Tenants Out</Text>
            <Text style={[styles.modalMessage, darkMode && styles.modalMessageDark]}>
              Kick tenants out of {selectedProperty?.name}?
            </Text>
            <Text style={[styles.modalSubtext, darkMode && styles.modalSubtextDark]}>
              You will stop receiving rental income from this property.
            </Text>
            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={[styles.modalButton, styles.modalButtonSecondary, darkMode && styles.modalButtonSecondaryDark]}
                onPress={() => {
                  setShowKickTenantsModal(false);
                  setSelectedProperty(null);
                }}
              >
                <Text style={[styles.modalButtonSecondaryText, darkMode && styles.modalButtonSecondaryTextDark]}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalButton, styles.kickTenantsButton]}
                onPress={() => selectedProperty && handleKickTenantsOut(selectedProperty)}
              >
                <Text style={styles.kickTenantsButtonText}>Kick Out</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      <Modal
        visible={showSettingsModal}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setShowSettingsModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modal, darkMode && styles.modalDark]}>
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, darkMode && styles.modalTitleDark]}>Settings</Text>
              <TouchableOpacity onPress={() => setShowSettingsModal(false)}>
                <X size={20} color={darkMode ? "#E5E7EB" : "#64748B"} />
              </TouchableOpacity>
            </View>
            
            <View style={styles.settingsList}>
              <TouchableOpacity
                style={styles.settingItem}
                onPress={() => setSettings(prev => ({ ...prev, showROI: !prev.showROI }))}
              >
                <Text style={[styles.settingLabel, darkMode && styles.settingLabelDark]}>Show ROI</Text>
                <View style={[styles.toggle, settings.showROI && styles.toggleActive]}>
                  <View style={[styles.toggleCircle, settings.showROI && styles.toggleCircleActive]} />
                </View>
              </TouchableOpacity>
              
              <TouchableOpacity
                style={styles.settingItem}
                onPress={() => setSettings(prev => ({ ...prev, showMarketMetrics: !prev.showMarketMetrics }))}
              >
                <Text style={[styles.settingLabel, darkMode && styles.settingLabelDark]}>Market Metrics</Text>
                <View style={[styles.toggle, settings.showMarketMetrics && styles.toggleActive]}>
                  <View style={[styles.toggleCircle, settings.showMarketMetrics && styles.toggleCircleActive]} />
                </View>
              </TouchableOpacity>
              
              <TouchableOpacity
                style={styles.settingItem}
                onPress={() => setSettings(prev => ({ ...prev, autoSortByROI: !prev.autoSortByROI }))}
              >
                <Text style={[styles.settingLabel, darkMode && styles.settingLabelDark]}>Auto Sort by ROI</Text>
                <View style={[styles.toggle, settings.autoSortByROI && styles.toggleActive]}>
                  <View style={[styles.toggleCircle, settings.autoSortByROI && styles.toggleCircleActive]} />
                </View>
              </TouchableOpacity>
            </View>
            
            <TouchableOpacity
              style={[styles.modalButton, styles.modalButtonPrimary]}
              onPress={() => setShowSettingsModal(false)}
            >
              <Text style={styles.modalButtonPrimaryText}>Done</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  containerDark: {
    backgroundColor: '#0F172A',
  },
  scrollView: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: scale(20),
    paddingTop: scale(16),
    paddingBottom: scale(16),
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
  },
  headerDark: {
    backgroundColor: '#0F172A',
    borderBottomColor: 'rgba(255, 255, 255, 0.1)',
  },
  backButton: {
    width: scale(40),
    height: scale(40),
    borderRadius: scale(20),
    backgroundColor: '#F1F5F9',
    justifyContent: 'center',
    alignItems: 'center',
  },
  backButtonDark: {
    backgroundColor: '#1E293B',
  },
  headerCenter: {
    flex: 1,
    alignItems: 'center',
    marginHorizontal: scale(12),
  },
  title: {
    fontSize: fontScale(24),
    fontWeight: '700',
    color: '#1E293B',
    letterSpacing: -0.5,
  },
  titleDark: {
    color: '#E5E7EB',
  },
  portfolioSummary: {
    marginTop: scale(4),
  },
  portfolioText: {
    fontSize: fontScale(12),
    color: '#64748B',
    fontWeight: '500',
  },
  portfolioTextDark: {
    color: '#94A3B8',
  },
  settingsButton: {
    width: scale(40),
    height: scale(40),
    borderRadius: scale(20),
    backgroundColor: '#F1F5F9',
    justifyContent: 'center',
    alignItems: 'center',
  },
  settingsButtonDark: {
    backgroundColor: '#1E293B',
  },
  tabBar: {
    flexDirection: 'row',
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
    paddingHorizontal: scale(16),
  },
  tabBarDark: {
    backgroundColor: '#0F172A',
    borderBottomColor: 'rgba(255, 255, 255, 0.1)',
  },
  tab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: scale(16),
    gap: scale(6),
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  tabActive: {
    borderBottomColor: '#3B82F6',
  },
  tabText: {
    fontSize: fontScale(14),
    fontWeight: '600',
    color: '#94A3B8',
  },
  tabTextDark: {
    color: '#64748B',
  },
  tabTextActive: {
    color: '#3B82F6',
  },
  tabBadge: {
    backgroundColor: '#EF4444',
    borderRadius: scale(10),
    minWidth: scale(18),
    height: scale(18),
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: scale(4),
  },
  tabBadgeText: {
    fontSize: fontScale(10),
    fontWeight: '700',
    color: '#FFFFFF',
  },
  searchSection: {
    backgroundColor: '#FFFFFF',
    paddingHorizontal: scale(16),
    paddingTop: scale(12),
    paddingBottom: scale(12),
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
  },
  searchSectionDark: {
    backgroundColor: '#0F172A',
    borderBottomColor: 'rgba(255, 255, 255, 0.1)',
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F1F5F9',
    borderRadius: scale(12),
    paddingHorizontal: scale(16),
    paddingVertical: scale(12),
    gap: scale(10),
    marginBottom: scale(10),
  },
  searchBarDark: {
    backgroundColor: '#1E293B',
  },
  searchInput: {
    flex: 1,
    fontSize: fontScale(15),
    color: '#1E293B',
  },
  searchInputDark: {
    color: '#E5E7EB',
  },
  filterBar: {
    flexDirection: 'row',
    gap: scale(8),
  },
  filterChip: {
    paddingHorizontal: scale(16),
    paddingVertical: scale(8),
    borderRadius: scale(20),
    backgroundColor: '#F1F5F9',
  },
  filterChipDark: {
    backgroundColor: '#1E293B',
  },
  filterChipActive: {
    backgroundColor: '#DBEAFE',
  },
  filterChipActiveDark: {
    backgroundColor: '#1E3A8A',
  },
  filterText: {
    fontSize: fontScale(13),
    fontWeight: '600',
    color: '#64748B',
  },
  filterTextDark: {
    color: '#94A3B8',
  },
  filterTextActive: {
    color: '#3B82F6',
  },
  scrollContent: {
    paddingBottom: scale(100),
  },
  content: {
    padding: scale(16),
  },
  propertiesList: {
    gap: scale(16),
  },
  propertyCard: {
    marginBottom: scale(16),
  },
  cardContent: {
    backgroundColor: '#FFFFFF',
    borderRadius: scale(16),
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  cardContentDark: {
    backgroundColor: '#1E293B',
    borderColor: 'rgba(255, 255, 255, 0.1)',
    shadowOpacity: 0.2,
  },
  cardContentOwned: {
    borderColor: '#3B82F6',
    borderWidth: 2,
  },
  imageContainer: {
    position: 'relative',
    width: '100%',
    height: scale(200),
  },
  propertyImage: {
    width: '100%',
    height: '100%',
    resizeMode: 'cover',
  },
  ownedBadge: {
    position: 'absolute',
    top: scale(12),
    right: scale(12),
    backgroundColor: '#3B82F6',
    paddingHorizontal: scale(12),
    paddingVertical: scale(6),
    borderRadius: scale(20),
  },
  ownedBadgeText: {
    fontSize: fontScale(11),
    fontWeight: '700',
    color: '#FFFFFF',
  },
  rentedBadge: {
    position: 'absolute',
    top: scale(12),
    right: scale(12),
    backgroundColor: '#10B981',
    paddingHorizontal: scale(12),
    paddingVertical: scale(6),
    borderRadius: scale(20),
  },
  rentedBadgeText: {
    fontSize: fontScale(11),
    fontWeight: '700',
    color: '#FFFFFF',
  },
  cardBody: {
    padding: scale(16),
  },
  cardHeader: {
    marginBottom: scale(8),
  },
  propertyName: {
    fontSize: fontScale(20),
    fontWeight: '700',
    color: '#1E293B',
    marginBottom: scale(4),
  },
  propertyNameDark: {
    color: '#E5E7EB',
  },
  locationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: scale(4),
  },
  locationText: {
    fontSize: fontScale(13),
    color: '#64748B',
    fontWeight: '500',
  },
  locationTextDark: {
    color: '#94A3B8',
  },
  priceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: scale(12),
  },
  price: {
    fontSize: fontScale(24),
    fontWeight: '700',
    color: '#1E293B',
  },
  priceDark: {
    color: '#E5E7EB',
  },
  levelBadge: {
    backgroundColor: '#F1F5F9',
    paddingHorizontal: scale(10),
    paddingVertical: scale(4),
    borderRadius: scale(12),
  },
  levelText: {
    fontSize: fontScale(11),
    fontWeight: '700',
    color: '#475569',
  },
  statsRow: {
    flexDirection: 'row',
    gap: scale(12),
    marginBottom: scale(12),
  },
  stat: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: scale(6),
    backgroundColor: '#F8FAFC',
    paddingHorizontal: scale(12),
    paddingVertical: scale(6),
    borderRadius: scale(8),
  },
  statDark: {
    backgroundColor: '#1E293B',
  },
  statText: {
    fontSize: fontScale(13),
    fontWeight: '600',
    color: '#475569',
  },
  statTextDark: {
    color: '#CBD5E1',
  },
  metricsRow: {
    flexDirection: 'row',
    gap: scale(12),
    marginBottom: scale(12),
  },
  metric: {
    flex: 1,
    backgroundColor: '#F8FAFC',
    padding: scale(10),
    borderRadius: scale(8),
  },
  metricDark: {
    backgroundColor: '#1E293B',
  },
  metricLabel: {
    fontSize: fontScale(11),
    color: '#94A3B8',
    marginBottom: scale(4),
  },
  metricLabelDark: {
    color: '#64748B',
  },
  metricValue: {
    fontSize: fontScale(14),
    fontWeight: '700',
    color: '#1E293B',
  },
  metricValueDark: {
    color: '#E5E7EB',
  },
  traitsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: scale(8),
    marginBottom: scale(12),
  },
  traitBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: scale(4),
    paddingHorizontal: scale(10),
    paddingVertical: scale(6),
    borderRadius: scale(12),
    borderWidth: 1,
  },
  traitText: {
    fontSize: fontScale(12),
    fontWeight: '600',
  },
  buyButton: {
    backgroundColor: '#3B82F6',
    paddingVertical: scale(10),
    borderRadius: scale(8),
    alignItems: 'center',
  },
  buyButtonDisabled: {
    backgroundColor: '#E2E8F0',
  },
  buyButtonText: {
    fontSize: fontScale(13),
    fontWeight: '600',
    color: '#FFFFFF',
  },
  buyButtonTextDisabled: {
    color: '#94A3B8',
  },
  actionButtons: {
    gap: scale(10),
  },
  rentButton: {
    backgroundColor: '#10B981',
    paddingVertical: scale(10),
    borderRadius: scale(8),
    alignItems: 'center',
  },
  rentButtonDisabled: {
    backgroundColor: '#E2E8F0',
  },
  rentButtonText: {
    fontSize: fontScale(13),
    fontWeight: '600',
    color: '#FFFFFF',
  },
  rentButtonTextDisabled: {
    color: '#94A3B8',
  },
  ownedActions: {
    flexDirection: 'column',
    gap: scale(8),
  },
  actionRow: {
    flexDirection: 'row',
    gap: scale(6),
    flexWrap: 'wrap',
  },
  manageButton: {
    backgroundColor: '#8B5CF6',
    paddingVertical: scale(6),
    paddingHorizontal: scale(10),
    borderRadius: scale(6),
    alignItems: 'center',
  },
  manageButtonText: {
    fontSize: fontScale(11),
    fontWeight: '600',
    color: '#FFFFFF',
  },
  moveInButton: {
    backgroundColor: '#10B981',
    paddingVertical: scale(6),
    paddingHorizontal: scale(10),
    borderRadius: scale(6),
    alignItems: 'center',
  },
  moveInButtonText: {
    fontSize: fontScale(11),
    fontWeight: '600',
    color: '#FFFFFF',
  },
  rentOutButton: {
    backgroundColor: '#3B82F6',
    paddingVertical: scale(6),
    paddingHorizontal: scale(10),
    borderRadius: scale(6),
    alignItems: 'center',
  },
  rentOutButtonText: {
    fontSize: fontScale(11),
    fontWeight: '600',
    color: '#FFFFFF',
  },
  sellButton: {
    backgroundColor: '#EF4444',
    paddingVertical: scale(6),
    paddingHorizontal: scale(10),
    borderRadius: scale(6),
    alignItems: 'center',
  },
  sellButtonText: {
    fontSize: fontScale(11),
    fontWeight: '600',
    color: '#FFFFFF',
  },
  kickTenantsButton: {
    backgroundColor: '#DC2626',
    paddingVertical: scale(6),
    paddingHorizontal: scale(10),
    borderRadius: scale(6),
    alignItems: 'center',
  },
  kickTenantsButtonText: {
    fontSize: fontScale(11),
    fontWeight: '600',
    color: '#FFFFFF',
  },
  rentedActions: {
    flexDirection: 'column',
    gap: scale(10),
    marginTop: scale(8),
  },
  rentedBadgeInfo: {
    backgroundColor: '#F0FDF4',
    padding: scale(12),
    borderRadius: scale(8),
    borderWidth: 1,
    borderColor: '#10B981',
  },
  rentedBadgeInfoDark: {
    backgroundColor: '#064E3B',
    borderColor: '#10B981',
  },
  rentedInfoText: {
    fontSize: fontScale(13),
    fontWeight: '600',
    color: '#166534',
    marginBottom: scale(4),
  },
  rentedInfoTextDark: {
    color: '#86EFAC',
  },
  rentedInfoSubtext: {
    fontSize: fontScale(11),
    color: '#15803D',
  },
  rentedInfoSubtextDark: {
    color: '#4ADE80',
  },
  endRentalButton: {
    backgroundColor: '#EF4444',
    paddingVertical: scale(10),
    borderRadius: scale(8),
    alignItems: 'center',
  },
  endRentalButtonText: {
    fontSize: fontScale(13),
    fontWeight: '600',
    color: '#FFFFFF',
  },
  marketView: {
    alignItems: 'center',
  },
  marketCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: scale(16),
    padding: scale(24),
    width: '100%',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  marketCardDark: {
    backgroundColor: '#1E293B',
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  marketTitle: {
    fontSize: fontScale(20),
    fontWeight: '700',
    color: '#1E293B',
    marginTop: scale(12),
    marginBottom: scale(20),
  },
  marketTitleDark: {
    color: '#E5E7EB',
  },
  marketStats: {
    width: '100%',
    gap: scale(16),
  },
  marketStatItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: scale(12),
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  marketStatLabel: {
    fontSize: fontScale(14),
    color: '#64748B',
  },
  marketStatLabelDark: {
    color: '#94A3B8',
  },
  marketStatValue: {
    fontSize: fontScale(16),
    fontWeight: '700',
    color: '#1E293B',
  },
  marketStatValueDark: {
    color: '#E5E7EB',
  },
  modalOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 1000,
  },
  modal: {
    width: screenWidth * 0.9,
    maxWidth: scale(400),
    backgroundColor: '#FFFFFF',
    borderRadius: scale(24),
    padding: scale(28),
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.2,
    shadowRadius: 20,
    elevation: 10,
  },
  modalDark: {
    backgroundColor: '#1E293B',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: scale(16),
  },
  modalTitle: {
    fontSize: fontScale(24),
    fontWeight: '700',
    color: '#1E293B',
    marginBottom: scale(20),
    textAlign: 'center',
  },
  modalTitleDark: {
    color: '#E5E7EB',
  },
  modalMessage: {
    fontSize: fontScale(16),
    color: '#475569',
    lineHeight: fontScale(24),
    marginBottom: scale(24),
    textAlign: 'center',
  },
  modalMessageDark: {
    color: '#CBD5E1',
  },
  modalSubtext: {
    fontSize: fontScale(14),
    color: '#94A3B8',
    marginBottom: scale(24),
    fontStyle: 'italic',
    textAlign: 'center',
  },
  modalSubtextDark: {
    color: '#64748B',
  },
  modalButtons: {
    flexDirection: 'row',
    gap: scale(12),
    marginTop: scale(8),
  },
  modalButton: {
    flex: 1,
    paddingVertical: scale(16),
    borderRadius: scale(14),
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: scale(50),
  },
  modalButtonFullWidth: {
    flex: 1,
    width: '100%',
  },
  modalButtonPrimary: {
    backgroundColor: '#3B82F6',
  },
  modalButtonSecondary: {
    backgroundColor: '#F1F5F9',
  },
  modalButtonSecondaryDark: {
    backgroundColor: '#1E293B',
  },
  modalButtonDanger: {
    backgroundColor: '#EF4444',
  },
  modalButtonPrimaryText: {
    fontSize: fontScale(15),
    fontWeight: '700',
    color: '#FFFFFF',
  },
  modalButtonSecondaryText: {
    fontSize: fontScale(15),
    fontWeight: '700',
    color: '#475569',
  },
  modalButtonSecondaryTextDark: {
    color: '#E5E7EB',
  },
  modalButtonDangerText: {
    fontSize: fontScale(15),
    fontWeight: '700',
    color: '#FFFFFF',
  },
  propertyNameInModal: {
    fontSize: fontScale(18),
    fontWeight: '700',
    color: '#1E293B',
    marginBottom: scale(20),
    textAlign: 'center',
  },
  propertyNameInModalDark: {
    color: '#E5E7EB',
  },
  managementStats: {
    marginBottom: scale(24),
    gap: scale(12),
  },
  managementStatRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: scale(14),
    paddingHorizontal: scale(12),
    backgroundColor: '#F8FAFC',
    borderRadius: scale(12),
  },
  managementStatRowDark: {
    backgroundColor: '#0F172A',
  },
  managementLabel: {
    fontSize: fontScale(14),
    color: '#64748B',
    fontWeight: '500',
  },
  managementLabelDark: {
    color: '#94A3B8',
  },
  managementValue: {
    fontSize: fontScale(15),
    fontWeight: '700',
    color: '#1E293B',
  },
  managementValueDark: {
    color: '#E5E7EB',
  },
  managementActions: {
    gap: scale(12),
    marginBottom: scale(24),
  },
  managementActionButton: {
    paddingVertical: scale(16),
    borderRadius: scale(14),
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: scale(50),
  },
  maintenanceButton: {
    backgroundColor: '#F59E0B',
  },
  upgradeButton: {
    backgroundColor: '#3B82F6',
  },
  managementActionText: {
    fontSize: fontScale(14),
    fontWeight: '700',
    color: '#FFFFFF',
  },
  settingsList: {
    marginBottom: scale(20),
    gap: scale(12),
  },
  settingItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: scale(12),
  },
  settingLabel: {
    fontSize: fontScale(15),
    fontWeight: '600',
    color: '#1E293B',
  },
  settingLabelDark: {
    color: '#E5E7EB',
  },
  toggle: {
    width: scale(50),
    height: scale(28),
    borderRadius: scale(14),
    backgroundColor: '#E2E8F0',
    justifyContent: 'center',
    paddingHorizontal: scale(2),
  },
  toggleActive: {
    backgroundColor: '#3B82F6',
  },
  toggleCircle: {
    width: scale(24),
    height: scale(24),
    borderRadius: scale(12),
    backgroundColor: '#FFFFFF',
    alignSelf: 'flex-start',
  },
  toggleCircleActive: {
    alignSelf: 'flex-end',
  },
});
