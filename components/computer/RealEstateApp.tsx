import React, { useState, useEffect } from 'react';
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
  Animated,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
import { MotiView } from 'moti';
import { ArrowLeft, Home, MapPin, DollarSign, TrendingUp, Heart, Shield, Zap, Users, Star, Award, Building2, BarChart3, Calendar, Settings, Eye, Filter, Search, X } from 'lucide-react-native';
import { useGame } from '@/contexts/GameContext';
import { getInflatedPrice } from '@/lib/economy/inflation';

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
  // New management properties
  currentValue: number;
  managementLevel: number;
  lastMaintenance: number; // Week number
  tenantSatisfaction: number; // 0-100
  marketDemand: number; // 0-100
}

const defaultUpgrades: Upgrade[] = [
  { id: 'kitchen', name: 'Renovated Kitchen', cost: 5000, rentIncrease: 100, purchased: false },
  { id: 'bathroom', name: 'New Bathroom', cost: 4000, rentIncrease: 80, purchased: false },
  { id: 'solar', name: 'Solar Panels', cost: 8000, rentIncrease: 160, purchased: false },
  { id: 'smarthome', name: 'Smart Home System', cost: 6000, rentIncrease: 120, purchased: false },
  { id: 'landscaping', name: 'Landscaping', cost: 3000, rentIncrease: 60, purchased: false },
];

const placeholderImage = require('@/assets/images/Real Estate.png');

// Default properties that should be available in every game
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
  const { gameState, setGameState } = useGame();
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
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState<'price' | 'income' | 'value'>('price');
  const [filterBy, setFilterBy] = useState<'all' | 'affordable' | 'luxury'>('all');
  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const [settings, setSettings] = useState({
    showROI: true,
    showMarketMetrics: true,
    autoSortByROI: false,
    showPriceHistory: false,
    notifications: true,
  });
  
  // Platform-specific alert function for simple messages
  const showAlert = (title: string, message: string) => {
    if (Platform.OS === 'web') {
      window.alert(`${title}\n\n${message}`);
    } else {
      Alert.alert(title, message);
    }
  };

  const handleImageError = (id: string) => {
    setProperties(prev => prev.map(p => (p.id === id ? { ...p, image: placeholderImage } : p)));
  };

  // Initialize properties from game state or use defaults
  useEffect(() => {
    const gameProperties = gameState.realEstate || [];
    
    // Merge game state properties with defaults
    const mergedProperties = defaultProperties.map(defaultProp => {
      const gameProp = gameProperties.find(p => p.id === defaultProp.id);
      if (gameProp) {
        return {
          ...defaultProp,
          owned: gameProp.owned,
          // Restore management data from game state
          currentValue: gameProp.currentValue || defaultProp.currentValue,
          managementLevel: gameProp.upgradeLevel || defaultProp.managementLevel,
          lastMaintenance: gameProp.lastMaintenance || defaultProp.lastMaintenance,
          tenantSatisfaction: gameProp.tenantSatisfaction || defaultProp.tenantSatisfaction,
          marketDemand: gameProp.marketDemand || defaultProp.marketDemand,
          // Update daily income based on management level
          dailyIncome: defaultProp.dailyIncome + (Math.floor(defaultProp.dailyIncome * 0.2) * (gameProp.upgradeLevel || 0)),
        };
      }
      return defaultProp;
    });
    
    setProperties(mergedProperties);
    
    // If no properties exist in game state, initialize with defaults
    if (gameProperties.length === 0) {
      updateGameStateProperties(defaultProperties);
    }
  }, [gameState.realEstate]);

  // Weekly property updates
  useEffect(() => {
    if (gameState.week > 0) {
      const updatedProperties = properties.map(prop => {
        if (!prop.owned) return prop;
        
        let newValue = prop.currentValue;
        let newSatisfaction = prop.tenantSatisfaction;
        let newDemand = prop.marketDemand;
        
        // Market value changes based on demand and satisfaction
        const marketChange = (prop.marketDemand - 50) * 0.001; // -0.05% to +0.05% per week
        const satisfactionChange = (prop.tenantSatisfaction - 50) * 0.0005; // -0.025% to +0.025% per week
        
        newValue = Math.floor(prop.currentValue * (1 + marketChange + satisfactionChange));
        
        // Tenant satisfaction changes based on maintenance
        const weeksSinceMaintenance = gameState.week - prop.lastMaintenance;
        if (weeksSinceMaintenance > 4) {
          newSatisfaction = Math.max(0, prop.tenantSatisfaction - 5);
        } else if (weeksSinceMaintenance <= 2) {
          newSatisfaction = Math.min(100, prop.tenantSatisfaction + 2);
        }
        
        // Market demand changes based on overall market conditions
        const marketTrend = Math.random() > 0.5 ? 1 : -1;
        newDemand = Math.max(0, Math.min(100, prop.marketDemand + (marketTrend * Math.floor(Math.random() * 3))));
        
        return {
          ...prop,
          currentValue: newValue,
          tenantSatisfaction: newSatisfaction,
          marketDemand: newDemand,
        };
      });
      
      setProperties(updatedProperties);
      updateGameStateProperties(updatedProperties);
    }
  }, [gameState.week]);

  // Function to update game state when properties change
  const updateGameStateProperties = (updatedProperties: Property[]) => {
    console.log('updateGameStateProperties called with:', updatedProperties);
    
    const gameProperties = updatedProperties.map(prop => ({
      id: prop.id,
      name: prop.name,
      price: prop.price,
      weeklyHappiness: prop.traits.happiness || 0,
      weeklyEnergy: prop.traits.energy || 0,
      owned: prop.owned,
      interior: [],
      upgradeLevel: prop.managementLevel || 0,
      rent: prop.dailyIncome * 7,
      upkeep: 0,
      // Store additional management data
      currentValue: prop.currentValue || prop.price,
      lastMaintenance: prop.lastMaintenance || 0,
      tenantSatisfaction: prop.tenantSatisfaction || 75,
      marketDemand: prop.marketDemand || 80,
    }));

    console.log('Mapped game properties:', gameProperties);

    setGameState(prev => {
      console.log('Previous game state realEstate:', prev.realEstate);
      const newState = {
        ...prev,
        realEstate: gameProperties,
      };
      console.log('New game state realEstate:', newState.realEstate);
      return newState;
    });
  };

  const getTraitIcon = (trait: string) => {
    switch (trait) {
      case 'happiness': return Heart;
      case 'health': return Shield;
      case 'energy': return Zap;
      default: return TrendingUp;
    }
  };

  const getTraitColor = (trait: string) => {
    switch (trait) {
      case 'happiness': return '#EF4444';
      case 'health': return '#10B981';
      case 'energy': return '#F59E0B';
      default: return '#6B7280';
    }
  };

  const renderTrait = (trait: string, value: number, key: string) => {
    const IconComponent = getTraitIcon(trait);
    const color = getTraitColor(trait);
    const traitName = trait.charAt(0).toUpperCase() + trait.slice(1);
    
    return (
      <View key={key} style={styles.traitItem}>
        <View style={[styles.traitIcon, { backgroundColor: color + '20' }]}>
          <IconComponent size={14} color={color} />
        </View>
        <Text style={styles.traitText}>+{value} {traitName}</Text>
      </View>
    );
  };

  const renderPropertyCard = (property: Property, index: number) => {
    const canAfford = gameState.stats.money >= property.price;
    const totalIncome = property.dailyIncome * 7; // Weekly income
    const roi = ((totalIncome / property.price) * 100).toFixed(1);
    
    return (
      <MotiView
        key={property.id}
        from={{ opacity: 0, translateY: 50, scale: 0.9 }}
        animate={{ opacity: 1, translateY: 0, scale: 1 }}
        transition={{ 
          type: 'timing', 
          duration: 600, 
          delay: index * 100 
        }}
        style={styles.propertyCard}
      >
        <LinearGradient
          colors={property.owned ? ['#0F766E', '#064E3B', '#022C22'] : ['#1F2937', '#111827', '#0F172A']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.propertyCardGradient}
        >
          <View style={styles.propertyImageContainer}>
            <Image source={property.image} style={styles.propertyImage} />
            {property.owned && (
              <View style={styles.ownedBadge}>
                <LinearGradient
                  colors={['#059669', '#047857']}
                  style={styles.ownedBadgeGradient}
                >
                  <Text style={styles.ownedText}>OWNED</Text>
                </LinearGradient>
              </View>
            )}
          </View>

          <View style={styles.propertyInfo}>
            <View style={styles.propertyHeader}>
              <Text style={styles.propertyName}>{property.name}</Text>
              <View style={styles.locationContainer}>
                <MapPin size={14} color="#9CA3AF" />
                <Text style={styles.locationText}>{property.location}</Text>
              </View>
            </View>

            <View style={styles.propertyStats}>
              <View style={styles.statItem}>
                <DollarSign size={16} color="#F7931A" />
                <Text style={styles.statText}>
                  {property.owned ? `$${property.currentValue.toLocaleString()}` : `$${property.price.toLocaleString()}`}
                </Text>
              </View>
              <View style={styles.statItem}>
                <TrendingUp size={16} color="#10B981" />
                <Text style={styles.statText}>${totalIncome.toLocaleString()}/week</Text>
              </View>
              {settings.showROI && (
                <View style={styles.statItem}>
                  <BarChart3 size={16} color="#3B82F6" />
                  <Text style={styles.statText}>{roi}% ROI</Text>
                </View>
              )}
              {property.owned && (
                <View style={styles.statItem}>
                  <Award size={16} color="#8B5CF6" />
                  <Text style={styles.statText}>Lv.{property.managementLevel}</Text>
                </View>
              )}
            </View>

            {/* Enhanced Property Metrics */}
            {settings.showMarketMetrics && (
              <View style={styles.propertyMetrics}>
                <View style={styles.metricItem}>
                  <View style={styles.metricIcon}>
                    <Star size={14} color="#FCD34D" />
                  </View>
                  <Text style={styles.metricLabel}>Market Demand</Text>
                  <Text style={styles.metricValue}>{property.marketDemand}%</Text>
                </View>
                <View style={styles.metricItem}>
                  <View style={styles.metricIcon}>
                    <Heart size={14} color="#EF4444" />
                  </View>
                  <Text style={styles.metricLabel}>Tenant Satisfaction</Text>
                  <Text style={styles.metricValue}>{property.tenantSatisfaction}%</Text>
                </View>
              </View>
            )}

            {Object.entries(property.traits).length > 0 && (
              <View style={styles.traitsContainer}>
                <Text style={styles.traitsTitle}>Traits:</Text>
                <View style={styles.traitsList}>
                  {Object.entries(property.traits).map(([trait, value]) => 
                    renderTrait(trait, value, trait)
                  )}
                </View>
              </View>
            )}

            {!property.owned && (
              <TouchableOpacity
                style={[styles.buyButton, !canAfford && styles.disabledButton]}
                onPress={() => {
                  console.log('Button pressed for property:', property.name);
                  handleBuyProperty(property);
                }}
                onPressIn={() => console.log('Button pressed in for:', property.name)}
                onPressOut={() => console.log('Button pressed out for:', property.name)}
                disabled={!canAfford}
                activeOpacity={0.7}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              >
                <LinearGradient
                  colors={canAfford ? ['#3B82F6', '#1D4ED8'] : ['#6B7280', '#4B5563']}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={styles.buyButtonGradient}
                >
                  <Home size={16} color="#FFFFFF" />
                  <Text style={styles.buyButtonText}>
                    {canAfford ? 'Purchase Property' : 'Insufficient Funds'}
                  </Text>
                </LinearGradient>
              </TouchableOpacity>
            )}
            


            {property.owned && (
              <View style={styles.ownedActions}>
                <TouchableOpacity
                  style={styles.actionButton}
                  onPress={() => handleManageProperty(property)}
                >
                  <LinearGradient
                    colors={['#8B5CF6', '#7C3AED']}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                    style={styles.actionButtonGradient}
                  >
                    <Text style={styles.actionButtonText}>Manage</Text>
                  </LinearGradient>
                </TouchableOpacity>
                
                <TouchableOpacity
                  style={styles.actionButton}
                  onPress={() => {
                    setSelectedProperty(property);
                    setShowSellModal(true);
                  }}
                >
                  <LinearGradient
                    colors={['#EF4444', '#DC2626']}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                    style={styles.actionButtonGradient}
                  >
                    <Text style={styles.actionButtonText}>Sell</Text>
                  </LinearGradient>
                </TouchableOpacity>
              </View>
            )}
          </View>
        </LinearGradient>
      </MotiView>
    );
  };

  const handleBuyProperty = (property: Property) => {
    console.log('handleBuyProperty called for:', property.name);
    console.log('Current money:', gameState.stats.money);
    console.log('Property price:', property.price);
    
    if (gameState.stats.money < property.price) {
      console.log('Insufficient funds, showing alert...');
      showAlert('Insufficient Funds', 'You need more money to purchase this property.');
      return;
    }

    console.log('Showing purchase confirmation modal...');
    setSelectedProperty(property);
    setShowPurchaseModal(true);
  };

  const confirmPurchase = () => {
    if (!selectedProperty) return;
    
    console.log('Purchase confirmed, updating stats...');
    
    // Check if player has enough money
    if (gameState.stats.money < selectedProperty.price) {
      Alert.alert('Insufficient Funds', `You need $${selectedProperty.price.toLocaleString()} to purchase this property.`);
      return;
    }
    
    // Update money directly using setGameState
    setGameState(prev => ({
      ...prev,
      stats: { ...prev.stats, money: prev.stats.money - selectedProperty.price }
    }));
    
    const updatedProperties = properties.map(p =>
      p.id === selectedProperty.id ? { ...p, owned: true } : p
    );
    
    console.log('Updated properties:', updatedProperties);
    setProperties(updatedProperties);
    updateGameStateProperties(updatedProperties);
    
    setShowPurchaseModal(false);
    setSelectedProperty(null);
    
    setSuccessMessage(`You now own ${selectedProperty.name}!`);
    setShowSuccessModal(true);
  };

  // Property management functions
  const performMaintenance = (property: Property) => {
    const maintenanceCost = Math.floor(property.currentValue * 0.02); // 2% of property value
    const satisfactionIncrease = 15;
    const valueIncrease = Math.floor(property.currentValue * 0.05); // 5% value increase
    
    if (gameState.stats.money < maintenanceCost) {
      setShowMaintenanceModal(false);
      setSuccessMessage(`Insufficient funds! Maintenance costs $${maintenanceCost.toLocaleString()}`);
      setShowSuccessModal(true);
      return;
    }
    
    setGameState(prev => ({
      ...prev,
      stats: { ...prev.stats, money: prev.stats.money - maintenanceCost }
    }));
    
    const updatedProperties = properties.map(p =>
      p.id === property.id ? {
        ...p,
        lastMaintenance: gameState.week,
        tenantSatisfaction: Math.min(100, p.tenantSatisfaction + satisfactionIncrease),
        currentValue: p.currentValue + valueIncrease,
      } : p
    );
    
    setProperties(updatedProperties);
    updateGameStateProperties(updatedProperties);
    
    setShowMaintenanceModal(false);
    setSuccessMessage(`Maintenance completed! Property value increased by $${valueIncrease.toLocaleString()}`);
    setShowSuccessModal(true);
  };

  const upgradeManagement = (property: Property) => {
    const upgradeCost = Math.floor(property.currentValue * 0.1); // 10% of property value
    const incomeIncrease = Math.floor(property.dailyIncome * 0.2); // 20% income increase
    const valueIncrease = Math.floor(property.currentValue * 0.08); // 8% value increase
    
    if (gameState.stats.money < upgradeCost) {
      setShowUpgradeModal(false);
      setSuccessMessage(`Insufficient funds! Management upgrade costs $${upgradeCost.toLocaleString()}`);
      setShowSuccessModal(true);
      return;
    }
    
    setGameState(prev => ({
      ...prev,
      stats: { ...prev.stats, money: prev.stats.money - upgradeCost }
    }));
    
    const updatedProperties = properties.map(p =>
      p.id === property.id ? {
        ...p,
        managementLevel: p.managementLevel + 1,
        dailyIncome: p.dailyIncome + incomeIncrease,
        currentValue: p.currentValue + valueIncrease,
      } : p
    );
    
    setProperties(updatedProperties);
    updateGameStateProperties(updatedProperties);
    
    setShowUpgradeModal(false);
    setSuccessMessage(`Management upgraded! Daily income increased by $${incomeIncrease}`);
    setShowSuccessModal(true);
  };

  const sellProperty = (property: Property) => {
    const sellPrice = Math.floor(property.currentValue * 0.75); // 75% of current value
    
    const updatedProperties = properties.map(p =>
      p.id === property.id ? { ...p, owned: false, currentValue: p.price } : p
    );
    
    setProperties(updatedProperties);
    updateGameStateProperties(updatedProperties);
    
    setGameState(prev => ({
      ...prev,
      stats: { ...prev.stats, money: prev.stats.money + sellPrice }
    }));
    
    setShowSellModal(false);
    setSuccessMessage(`Property sold for $${sellPrice.toLocaleString()}!`);
    setShowSuccessModal(true);
  };

  const handleManageProperty = (property: Property) => {
    setSelectedProperty(property);
    setShowManagementModal(true);
  };

  // Calculate portfolio stats
  const ownedProperties = properties.filter(p => p.owned);
  const totalPortfolioValue = ownedProperties.reduce((sum, p) => sum + p.currentValue, 0);
  const totalWeeklyIncome = ownedProperties.reduce((sum, p) => sum + (p.dailyIncome * 7), 0);
  const averageROI = ownedProperties.length > 0 ? (totalWeeklyIncome / totalPortfolioValue) * 100 : 0;

  // Filter and sort properties
  const filteredProperties = properties.filter(property => {
    const matchesSearch = property.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         property.location.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesFilter = filterBy === 'all' || 
                         (filterBy === 'affordable' && property.price <= 300000) ||
                         (filterBy === 'luxury' && property.price > 300000);
    const matchesTab = activeTab === 'owned' ? property.owned : !property.owned;
    return matchesSearch && matchesFilter && matchesTab;
  }).sort((a, b) => {
    // Auto sort by ROI if enabled
    if (settings.autoSortByROI) {
      const aROI = (a.dailyIncome * 7) / a.price;
      const bROI = (b.dailyIncome * 7) / b.price;
      return bROI - aROI;
    }
    
    switch (sortBy) {
      case 'price': return a.price - b.price;
      case 'income': return b.dailyIncome - a.dailyIncome;
      case 'value': return b.currentValue - a.currentValue;
      default: return 0;
    }
  });

  return (
    <View style={styles.container}>
      {/* Enhanced Header with Portfolio Stats */}
      <MotiView
        from={{ opacity: 0, translateY: -20 }}
        animate={{ opacity: 1, translateY: 0 }}
        transition={{ type: 'timing', duration: 600 }}
      >
        <LinearGradient
          colors={['#0F172A', '#1E293B', '#334155']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.header}
        >
          <TouchableOpacity onPress={onBack} style={styles.backButton}>
            <LinearGradient
              colors={['#6366F1', '#4F46E5']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.backButtonGradient}
            >
              <ArrowLeft size={24} color="#FFFFFF" />
            </LinearGradient>
          </TouchableOpacity>
          
          <View style={styles.headerCenter}>
            <Text style={styles.title}>Real Estate Portfolio</Text>
            {ownedProperties.length > 0 && (
              <View style={styles.portfolioStats}>
                <View style={styles.portfolioStat}>
                  <Building2 size={16} color="#10B981" />
                  <Text style={styles.portfolioStatText}>{ownedProperties.length} Properties</Text>
                </View>
                <View style={styles.portfolioStat}>
                  <DollarSign size={16} color="#F59E0B" />
                  <Text style={styles.portfolioStatText}>${totalPortfolioValue.toLocaleString()}</Text>
                </View>
                <View style={styles.portfolioStat}>
                  <TrendingUp size={16} color="#3B82F6" />
                  <Text style={styles.portfolioStatText}>{averageROI.toFixed(1)}% ROI</Text>
                </View>
              </View>
            )}
          </View>
          
          <TouchableOpacity 
            style={styles.settingsButton}
            onPress={() => setShowSettingsModal(true)}
          >
            <LinearGradient
              colors={['#6B7280', '#4B5563']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.settingsButtonGradient}
            >
              <Settings size={20} color="#FFFFFF" />
            </LinearGradient>
          </TouchableOpacity>
        </LinearGradient>
      </MotiView>

      {/* Enhanced Tabs with Market Tab */}
      <MotiView
        from={{ opacity: 0, translateY: 20 }}
        animate={{ opacity: 1, translateY: 0 }}
        transition={{ type: 'timing', duration: 600, delay: 200 }}
        style={styles.tabContainer}
      >
        <TouchableOpacity
          style={[styles.tab, activeTab === 'browse' && styles.activeTab]}
          onPress={() => setActiveTab('browse')}
        >
          <LinearGradient
            colors={activeTab === 'browse' ? ['#3B82F6', '#1D4ED8'] : ['#374151', '#4B5563']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.tabGradient}
          >
            <Home size={18} color="#FFFFFF" />
            <Text style={[styles.tabText, activeTab === 'browse' && styles.activeTabText]}>
              Browse
            </Text>
          </LinearGradient>
        </TouchableOpacity>
        
        <TouchableOpacity
          style={[styles.tab, activeTab === 'owned' && styles.activeTab]}
          onPress={() => setActiveTab('owned')}
        >
          <LinearGradient
            colors={activeTab === 'owned' ? ['#10B981', '#059669'] : ['#374151', '#4B5563']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.tabGradient}
          >
            <Building2 size={18} color="#FFFFFF" />
            <Text style={[styles.tabText, activeTab === 'owned' && styles.activeTabText]}>
              Portfolio ({ownedProperties.length})
            </Text>
          </LinearGradient>
        </TouchableOpacity>
        
        <TouchableOpacity
          style={[styles.tab, activeTab === 'market' && styles.activeTab]}
          onPress={() => setActiveTab('market')}
        >
          <LinearGradient
            colors={activeTab === 'market' ? ['#F59E0B', '#D97706'] : ['#374151', '#4B5563']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.tabGradient}
          >
            <BarChart3 size={18} color="#FFFFFF" />
            <Text style={[styles.tabText, activeTab === 'market' && styles.activeTabText]}>
              Market
            </Text>
          </LinearGradient>
        </TouchableOpacity>
      </MotiView>

      {/* Search and Filter Bar */}
      {activeTab !== 'market' && (
        <MotiView
          from={{ opacity: 0, translateY: 20 }}
          animate={{ opacity: 1, translateY: 0 }}
          transition={{ type: 'timing', duration: 600, delay: 400 }}
          style={styles.searchContainer}
        >
          <View style={styles.searchBar}>
            <Search size={20} color="#9CA3AF" />
            <Text style={styles.searchPlaceholder}>Search properties...</Text>
          </View>
          
          <View style={styles.filterContainer}>
            <TouchableOpacity
              style={[styles.filterButton, filterBy === 'all' && styles.activeFilter]}
              onPress={() => setFilterBy('all')}
            >
              <Text style={[styles.filterText, filterBy === 'all' && styles.activeFilterText]}>All</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.filterButton, filterBy === 'affordable' && styles.activeFilter]}
              onPress={() => setFilterBy('affordable')}
            >
              <Text style={[styles.filterText, filterBy === 'affordable' && styles.activeFilterText]}>Affordable</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.filterButton, filterBy === 'luxury' && styles.activeFilter]}
              onPress={() => setFilterBy('luxury')}
            >
              <Text style={[styles.filterText, filterBy === 'luxury' && styles.activeFilterText]}>Luxury</Text>
            </TouchableOpacity>
          </View>
        </MotiView>
      )}

      <ScrollView 
        style={styles.content} 
        contentContainerStyle={styles.contentContainer}
        showsVerticalScrollIndicator={true}
      >
        {activeTab === 'market' ? (
          <View style={styles.marketContainer}>
            <MotiView
              from={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ type: 'timing', duration: 600 }}
              style={styles.marketCard}
            >
              <LinearGradient
                colors={['#1F2937', '#111827', '#0F172A']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.marketCardGradient}
              >
                <View style={styles.marketHeader}>
                  <BarChart3 size={24} color="#F59E0B" />
                  <Text style={styles.marketTitle}>Market Analysis</Text>
                </View>
                
                <View style={styles.marketStats}>
                  <View style={styles.marketStat}>
                    <Text style={styles.marketStatLabel}>Average Property Value</Text>
                    <Text style={styles.marketStatValue}>
                      ${Math.round(properties.reduce((sum, p) => sum + p.currentValue, 0) / properties.length).toLocaleString()}
                    </Text>
                  </View>
                  <View style={styles.marketStat}>
                    <Text style={styles.marketStatLabel}>Market Growth Rate</Text>
                    <Text style={styles.marketStatValue}>+12.5%</Text>
                  </View>
                  <View style={styles.marketStat}>
                    <Text style={styles.marketStatLabel}>Hot Locations</Text>
                    <Text style={styles.marketStatValue}>Uptown, Hills</Text>
                  </View>
                </View>
                
                <View style={styles.marketInsights}>
                  <Text style={styles.insightsTitle}>Market Insights</Text>
                  <View style={styles.insightItem}>
                    <TrendingUp size={16} color="#10B981" />
                    <Text style={styles.insightText}>Luxury properties showing 15% growth</Text>
                  </View>
                  <View style={styles.insightItem}>
                    <Star size={16} color="#FCD34D" />
                    <Text style={styles.insightText}>High demand in suburban areas</Text>
                  </View>
                  <View style={styles.insightItem}>
                    <Building2 size={16} color="#3B82F6" />
                    <Text style={styles.insightText}>Commercial real estate trending up</Text>
                  </View>
                </View>
              </LinearGradient>
            </MotiView>
          </View>
        ) : (
          <View style={styles.propertiesGrid}>
            {filteredProperties.map((property, index) => renderPropertyCard(property, index))}
          </View>
        )}
      </ScrollView>

      {/* Purchase Confirmation Modal */}
      {showPurchaseModal && selectedProperty && (
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <LinearGradient
              colors={['#1F2937', '#111827']}
              style={styles.modalGradient}
            >
              <Text style={styles.modalTitle}>Purchase Property</Text>
              <Text style={styles.modalMessage}>
                Are you sure you want to purchase {selectedProperty.name} for ${selectedProperty.price.toLocaleString()}?
              </Text>
              
              <View style={styles.modalButtons}>
                <TouchableOpacity
                  style={styles.modalButton}
                  onPress={() => {
                    setShowPurchaseModal(false);
                    setSelectedProperty(null);
                  }}
                >
                  <Text style={styles.modalButtonText}>Cancel</Text>
                </TouchableOpacity>
                
                <TouchableOpacity
                  style={styles.modalButton}
                  onPress={confirmPurchase}
                >
                  <LinearGradient
                    colors={['#3B82F6', '#1D4ED8']}
                    style={styles.modalButtonGradient}
                  >
                    <Text style={styles.modalButtonText}>Purchase</Text>
                  </LinearGradient>
                </TouchableOpacity>
              </View>
            </LinearGradient>
          </View>
        </View>
      )}

      {/* Success Modal */}
      {showSuccessModal && (
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <LinearGradient
              colors={['#10B981', '#059669']}
              style={styles.modalGradient}
            >
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>Success!</Text>
                <TouchableOpacity
                  style={styles.closeButton}
                  onPress={() => setShowSuccessModal(false)}
                >
                  <X size={24} color="#FFFFFF" />
                </TouchableOpacity>
              </View>
              
              <Text style={styles.modalMessage}>{successMessage}</Text>
              
              <TouchableOpacity
                style={styles.modalButton}
                onPress={() => setShowSuccessModal(false)}
              >
                <Text style={styles.modalButtonText}>OK</Text>
              </TouchableOpacity>
            </LinearGradient>
          </View>
        </View>
      )}

      {/* Property Management Modal */}
      {showManagementModal && selectedProperty && (
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <LinearGradient
              colors={['#1F2937', '#111827']}
              style={styles.modalGradient}
            >
              <Text style={styles.modalTitle}>Property Management</Text>
              
              <View style={styles.managementInfo}>
                <Text style={styles.managementPropertyName}>{selectedProperty.name}</Text>
                
                <View style={styles.managementStats}>
                  <View style={styles.managementStat}>
                    <Text style={styles.managementStatLabel}>Current Value:</Text>
                    <Text style={styles.managementStatValue}>${selectedProperty.currentValue.toLocaleString()}</Text>
                  </View>
                  
                  <View style={styles.managementStat}>
                    <Text style={styles.managementStatLabel}>Weekly Income:</Text>
                    <Text style={styles.managementStatValue}>${(selectedProperty.dailyIncome * 7).toLocaleString()}</Text>
                  </View>
                  
                  <View style={styles.managementStat}>
                    <Text style={styles.managementStatLabel}>Management Level:</Text>
                    <Text style={styles.managementStatValue}>Level {selectedProperty.managementLevel}</Text>
                  </View>
                  
                  <View style={styles.managementStat}>
                    <Text style={styles.managementStatLabel}>Tenant Satisfaction:</Text>
                    <Text style={styles.managementStatValue}>{selectedProperty.tenantSatisfaction}%</Text>
                  </View>
                  
                  <View style={styles.managementStat}>
                    <Text style={styles.managementStatLabel}>Market Demand:</Text>
                    <Text style={styles.managementStatValue}>{selectedProperty.marketDemand}%</Text>
                  </View>
                </View>
              </View>
              
              <View style={styles.managementActions}>
                <TouchableOpacity
                  style={styles.managementActionButton}
                  onPress={() => {
                    setShowManagementModal(false);
                    setShowMaintenanceModal(true);
                  }}
                >
                  <LinearGradient
                    colors={['#F59E0B', '#D97706']}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                    style={styles.managementActionGradient}
                  >
                    <Text style={styles.managementActionText}>
                      Maintenance (${Math.floor(selectedProperty.currentValue * 0.02).toLocaleString()})
                    </Text>
                  </LinearGradient>
                </TouchableOpacity>
                
                <TouchableOpacity
                  style={styles.managementActionButton}
                  onPress={() => {
                    setShowManagementModal(false);
                    setShowUpgradeModal(true);
                  }}
                >
                  <LinearGradient
                    colors={['#3B82F6', '#1D4ED8']}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                    style={styles.managementActionGradient}
                  >
                    <Text style={styles.managementActionText}>
                      Upgrade Management (${Math.floor(selectedProperty.currentValue * 0.1).toLocaleString()})
                    </Text>
                  </LinearGradient>
                </TouchableOpacity>
              </View>
              
              <TouchableOpacity
                style={styles.modalButton}
                onPress={() => setShowManagementModal(false)}
              >
                <Text style={styles.modalButtonText}>Close</Text>
              </TouchableOpacity>
            </LinearGradient>
          </View>
        </View>
      )}

      {/* Sell Property Modal */}
      {showSellModal && selectedProperty && (
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <LinearGradient
              colors={['#DC2626', '#B91C1C']}
              style={styles.modalGradient}
            >
              <Text style={styles.modalTitle}>Sell Property</Text>
              <Text style={styles.modalMessage}>
                Are you sure you want to sell {selectedProperty.name} for ${Math.floor(selectedProperty.currentValue * 0.75).toLocaleString()}?
              </Text>
              <Text style={styles.modalSubMessage}>
                (75% of current value: ${selectedProperty.currentValue.toLocaleString()})
              </Text>
              
              <View style={styles.modalButtons}>
                <TouchableOpacity
                  style={styles.modalButton}
                  onPress={() => {
                    setShowSellModal(false);
                    setSelectedProperty(null);
                  }}
                >
                  <Text style={styles.modalButtonText}>Cancel</Text>
                </TouchableOpacity>
                
                <TouchableOpacity
                  style={styles.modalButton}
                  onPress={() => sellProperty(selectedProperty)}
                >
                  <LinearGradient
                    colors={['#EF4444', '#DC2626']}
                    style={styles.modalButtonGradient}
                  >
                    <Text style={styles.modalButtonText}>Sell</Text>
                  </LinearGradient>
                </TouchableOpacity>
              </View>
            </LinearGradient>
          </View>
        </View>
      )}

      {/* Maintenance Confirmation Modal */}
      {showMaintenanceModal && selectedProperty && (
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <LinearGradient
              colors={['#F59E0B', '#D97706']}
              style={styles.modalGradient}
            >
              <Text style={styles.modalTitle}>Property Maintenance</Text>
              <Text style={styles.modalMessage}>
                Perform maintenance on {selectedProperty.name} for ${Math.floor(selectedProperty.currentValue * 0.02).toLocaleString()}?
              </Text>
              <Text style={styles.modalSubMessage}>
                Benefits: +15% tenant satisfaction, +5% property value
              </Text>
              
              <View style={styles.modalButtons}>
                <TouchableOpacity
                  style={styles.modalButton}
                  onPress={() => {
                    setShowMaintenanceModal(false);
                    setShowManagementModal(true);
                  }}
                >
                  <Text style={styles.modalButtonText}>Back</Text>
                </TouchableOpacity>
                
                <TouchableOpacity
                  style={styles.modalButton}
                  onPress={() => performMaintenance(selectedProperty)}
                >
                  <LinearGradient
                    colors={['#F59E0B', '#D97706']}
                    style={styles.modalButtonGradient}
                  >
                    <Text style={styles.modalButtonText}>Perform Maintenance</Text>
                  </LinearGradient>
                </TouchableOpacity>
              </View>
            </LinearGradient>
          </View>
        </View>
      )}

      {/* Management Upgrade Confirmation Modal */}
      {showUpgradeModal && selectedProperty && (
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <LinearGradient
              colors={['#3B82F6', '#1D4ED8']}
              style={styles.modalGradient}
            >
            <Text style={styles.modalTitle}>Management Upgrade</Text>
            <Text style={styles.modalMessage}>
              Upgrade management for {selectedProperty.name} for ${Math.floor(selectedProperty.currentValue * 0.1).toLocaleString()}?
            </Text>
            <Text style={styles.modalSubMessage}>
              Benefits: +20% daily income, +8% property value, +1 management level
            </Text>
            
                          <View style={styles.modalButtons}>
                <TouchableOpacity
                  style={styles.modalButton}
                  onPress={() => {
                    setShowUpgradeModal(false);
                    setShowManagementModal(true);
                  }}
                >
                  <Text style={styles.modalButtonText}>Back</Text>
                </TouchableOpacity>
                
                <TouchableOpacity
                  style={styles.modalButton}
                  onPress={() => upgradeManagement(selectedProperty)}
                >
                  <LinearGradient
                    colors={['#3B82F6', '#1D4ED8']}
                    style={styles.modalButtonGradient}
                  >
                    <Text style={styles.modalButtonText}>Upgrade Management</Text>
                  </LinearGradient>
                </TouchableOpacity>
              </View>
            </LinearGradient>
          </View>
        </View>
      )}

      {/* Settings Modal */}
      {showSettingsModal && (
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <LinearGradient
              colors={['#1F2937', '#111827', '#0F172A']}
              style={styles.modalGradient}
            >
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>Real Estate Settings</Text>
                <TouchableOpacity
                  style={styles.closeButton}
                  onPress={() => setShowSettingsModal(false)}
                >
                  <X size={24} color="#FFFFFF" />
                </TouchableOpacity>
              </View>
              
              <ScrollView 
                style={styles.settingsScrollView}
                showsVerticalScrollIndicator={true}
                contentContainerStyle={styles.settingsContainer}
              >
                <View style={styles.settingItem}>
                  <View style={styles.settingInfo}>
                    <Text style={styles.settingLabel}>Show ROI</Text>
                    <Text style={styles.settingDescription}>Display return on investment for properties</Text>
                  </View>
                  <TouchableOpacity
                    style={[styles.toggleButton, settings.showROI && styles.toggleButtonActive]}
                    onPress={() => setSettings(prev => ({ ...prev, showROI: !prev.showROI }))}
                  >
                    <View style={[styles.toggleCircle, settings.showROI && styles.toggleCircleActive]} />
                  </TouchableOpacity>
                </View>

                <View style={styles.settingItem}>
                  <View style={styles.settingInfo}>
                    <Text style={styles.settingLabel}>Market Metrics</Text>
                    <Text style={styles.settingDescription}>Show market demand and tenant satisfaction</Text>
                  </View>
                  <TouchableOpacity
                    style={[styles.toggleButton, settings.showMarketMetrics && styles.toggleButtonActive]}
                    onPress={() => setSettings(prev => ({ ...prev, showMarketMetrics: !prev.showMarketMetrics }))}
                  >
                    <View style={[styles.toggleCircle, settings.showMarketMetrics && styles.toggleCircleActive]} />
                  </TouchableOpacity>
                </View>

                <View style={styles.settingItem}>
                  <View style={styles.settingInfo}>
                    <Text style={styles.settingLabel}>Auto Sort by ROI</Text>
                    <Text style={styles.settingDescription}>Automatically sort properties by return on investment</Text>
                  </View>
                  <TouchableOpacity
                    style={[styles.toggleButton, settings.autoSortByROI && styles.toggleButtonActive]}
                    onPress={() => setSettings(prev => ({ ...prev, autoSortByROI: !prev.autoSortByROI }))}
                  >
                    <View style={[styles.toggleCircle, settings.autoSortByROI && styles.toggleCircleActive]} />
                  </TouchableOpacity>
                </View>

                <View style={styles.settingItem}>
                  <View style={styles.settingInfo}>
                    <Text style={styles.settingLabel}>Price History</Text>
                    <Text style={styles.settingDescription}>Show property price change history</Text>
                  </View>
                  <TouchableOpacity
                    style={[styles.toggleButton, settings.showPriceHistory && styles.toggleButtonActive]}
                    onPress={() => setSettings(prev => ({ ...prev, showPriceHistory: !prev.showPriceHistory }))}
                  >
                    <View style={[styles.toggleCircle, settings.showPriceHistory && styles.toggleCircleActive]} />
                  </TouchableOpacity>
                </View>

                <View style={styles.settingItem}>
                  <View style={styles.settingInfo}>
                    <Text style={styles.settingLabel}>Notifications</Text>
                    <Text style={styles.settingDescription}>Receive notifications for property updates</Text>
                  </View>
                  <TouchableOpacity
                    style={[styles.toggleButton, settings.notifications && styles.toggleButtonActive]}
                    onPress={() => setSettings(prev => ({ ...prev, notifications: !prev.notifications }))}
                  >
                    <View style={[styles.toggleCircle, settings.notifications && styles.toggleCircleActive]} />
                  </TouchableOpacity>
                </View>
              </ScrollView>
              
              <TouchableOpacity
                style={styles.modalButton}
                onPress={() => setShowSettingsModal(false)}
              >
                <Text style={styles.modalButtonText}>Done</Text>
              </TouchableOpacity>
            </LinearGradient>
          </View>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0F172A',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 20,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.1)',
  },
  backButton: {
    borderRadius: 12,
    overflow: 'hidden',
    shadowColor: '#6366F1',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  backButtonGradient: {
    width: 48,
    height: 48,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerCenter: {
    flex: 1,
    alignItems: 'center',
  },
  title: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#FFFFFF',
    textShadowColor: 'rgba(0, 0, 0, 0.5)',
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 4,
  },
  portfolioStats: {
    flexDirection: 'row',
    marginTop: 8,
    gap: 16,
  },
  portfolioStat: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  portfolioStatText: {
    fontSize: 12,
    color: '#E5E7EB',
    fontWeight: '600',
  },
  settingsButton: {
    borderRadius: 12,
    overflow: 'hidden',
  },
  settingsButtonGradient: {
    width: 48,
    height: 48,
    justifyContent: 'center',
    alignItems: 'center',
  },
  tabContainer: {
    flexDirection: 'row',
    paddingHorizontal: 20,
    marginBottom: 20,
    gap: 12,
  },
  tab: {
    flex: 1,
    height: 60,
    borderRadius: 12,
    overflow: 'hidden',
  },
  tabGradient: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingHorizontal: 12,
  },
  activeTab: {
    shadowColor: '#3B82F6',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.5,
    shadowRadius: 12,
    elevation: 12,
    borderWidth: 2,
    borderColor: '#3B82F6',
  },
  tabText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#D1D5DB',
  },
  activeTabText: {
    color: '#FFFFFF',
    textShadowColor: 'rgba(0, 0, 0, 0.3)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 1,
  },
  searchContainer: {
    paddingHorizontal: 20,
    marginBottom: 20,
    gap: 12,
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 12,
  },
  searchPlaceholder: {
    color: '#9CA3AF',
    fontSize: 16,
  },
  filterContainer: {
    flexDirection: 'row',
    gap: 8,
  },
  filterButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
  },
  activeFilter: {
    backgroundColor: '#3B82F6',
  },
  filterText: {
    color: '#D1D5DB',
    fontSize: 14,
    fontWeight: '600',
  },
  activeFilterText: {
    color: '#FFFFFF',
  },
  content: {
    flex: 1,
  },
  contentContainer: {
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 40,
    flexGrow: 1,
    justifyContent: 'center',
  },
  propertiesGrid: {
    gap: 16,
  },
  propertyCard: {
    marginBottom: 20,
    borderRadius: 20,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.6,
    shadowRadius: 16,
    elevation: 16,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.2)',
  },
  propertyCardGradient: {
    padding: 20,
  },
  propertyImageContainer: {
    position: 'relative',
    marginBottom: 16,
  },
  propertyImage: {
    width: '100%',
    height: 200,
    borderRadius: 12,
    resizeMode: 'cover',
  },
  ownedBadge: {
    position: 'absolute',
    top: 12,
    right: 12,
    borderRadius: 8,
    overflow: 'hidden',
  },
  ownedBadgeGradient: {
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  ownedText: {
    fontSize: 12,
    fontWeight: 'bold',
    color: '#FFFFFF',
    textShadowColor: 'rgba(0, 0, 0, 0.5)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
  propertyInfo: {
    gap: 12,
  },
  propertyHeader: {
    marginBottom: 8,
  },
  propertyName: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#FFFFFF',
    marginBottom: 4,
    textShadowColor: 'rgba(0, 0, 0, 0.5)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
  locationContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  locationText: {
    fontSize: 14,
    color: '#E5E7EB',
    fontWeight: '500',
  },
  propertyStats: {
    flexDirection: 'row',
    gap: 16,
    marginBottom: 12,
  },
  statItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  statText: {
    fontSize: 14,
    color: '#FFFFFF',
    fontWeight: '600',
    textShadowColor: 'rgba(0, 0, 0, 0.3)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 1,
  },
  traitsContainer: {
    marginBottom: 12,
  },
  traitsTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#FCD34D',
    marginBottom: 8,
    textShadowColor: 'rgba(0, 0, 0, 0.5)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
  traitsList: {
    gap: 8,
  },
  traitItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  traitIcon: {
    width: 24,
    height: 24,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
  },
  traitText: {
    fontSize: 13,
    color: '#FFFFFF',
    fontWeight: '600',
    textShadowColor: 'rgba(0, 0, 0, 0.3)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 1,
  },
  propertyMetrics: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 12,
  },
  metricItem: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    paddingHorizontal: 8,
    paddingVertical: 6,
    borderRadius: 8,
    gap: 6,
  },
  metricIcon: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  metricLabel: {
    fontSize: 10,
    color: '#9CA3AF',
    fontWeight: '500',
    flex: 1,
  },
  metricValue: {
    fontSize: 12,
    color: '#FFFFFF',
    fontWeight: '700',
  },
  // Market styles
  marketContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  marketCard: {
    width: '100%',
    maxWidth: 400,
    borderRadius: 20,
    overflow: 'hidden',
    shadowColor: '#F59E0B',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.4,
    shadowRadius: 16,
    elevation: 16,
  },
  marketCardGradient: {
    padding: 24,
  },
  marketHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    marginBottom: 24,
  },
  marketTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#FFFFFF',
    textShadowColor: 'rgba(0, 0, 0, 0.5)',
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 4,
  },
  marketStats: {
    gap: 16,
    marginBottom: 24,
  },
  marketStat: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 12,
  },
  marketStatLabel: {
    fontSize: 14,
    color: '#D1D5DB',
    fontWeight: '500',
  },
  marketStatValue: {
    fontSize: 16,
    color: '#FFFFFF',
    fontWeight: '700',
    textShadowColor: 'rgba(0, 0, 0, 0.3)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
  marketInsights: {
    gap: 12,
  },
  insightsTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#FCD34D',
    marginBottom: 8,
    textShadowColor: 'rgba(0, 0, 0, 0.5)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
  insightItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
  },
  insightText: {
    fontSize: 14,
    color: '#E5E7EB',
    fontWeight: '500',
    flex: 1,
  },
  // Settings modal styles
  settingsScrollView: {
    maxHeight: 300,
    marginBottom: 16,
  },
  settingsContainer: {
    gap: 16,
    paddingBottom: 8,
  },
  settingItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 12,
  },
  settingInfo: {
    flex: 1,
    marginRight: 16,
  },
  settingLabel: {
    fontSize: 16,
    color: '#FFFFFF',
    fontWeight: '600',
    marginBottom: 4,
  },
  settingDescription: {
    fontSize: 12,
    color: '#9CA3AF',
    fontWeight: '400',
  },
  toggleButton: {
    width: 50,
    height: 28,
    borderRadius: 14,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    justifyContent: 'center',
    paddingHorizontal: 2,
  },
  toggleButtonActive: {
    backgroundColor: '#3B82F6',
  },
  toggleCircle: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#FFFFFF',
    alignSelf: 'flex-start',
  },
  toggleCircleActive: {
    alignSelf: 'flex-end',
  },
  buyButton: {
    borderRadius: 8,
    overflow: 'hidden',
  },
  disabledButton: {
    opacity: 0.5,
  },
  buyButtonGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    gap: 6,
  },
  buyButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  ownedActions: {
    flexDirection: 'row',
    gap: 12,
  },
  actionButton: {
    flex: 1,
    borderRadius: 8,
    overflow: 'hidden',
  },
  actionButtonGradient: {
    paddingVertical: 12,
    alignItems: 'center',
  },
  actionButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#FFFFFF',
    textShadowColor: 'rgba(0, 0, 0, 0.3)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 1,
  },
  // Modal styles
  modalOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 1000,
  },
  modalContent: {
    width: screenWidth * 0.9,
    maxWidth: 400,
    borderRadius: 16,
    overflow: 'hidden',
  },
  modalGradient: {
    padding: 24,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  modalTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#FFFFFF',
    textAlign: 'center',
    flex: 1,
  },
  closeButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalMessage: {
    fontSize: 16,
    color: '#E5E7EB',
    textAlign: 'center',
    marginBottom: 24,
    lineHeight: 22,
  },
  modalButtons: {
    flexDirection: 'row',
    gap: 12,
    justifyContent: 'center',
  },
  modalButton: {
    flex: 1,
    borderRadius: 8,
    overflow: 'hidden',
  },
  modalButtonGradient: {
    paddingVertical: 12,
    alignItems: 'center',
  },
  modalButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
    textAlign: 'center',
  },
  // Management modal styles
  managementInfo: {
    marginBottom: 20,
  },
  managementPropertyName: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#FFFFFF',
    textAlign: 'center',
    marginBottom: 16,
    textShadowColor: 'rgba(0, 0, 0, 0.5)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
  managementStats: {
    gap: 8,
    marginBottom: 16,
  },
  managementStat: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 6,
  },
  managementStatLabel: {
    fontSize: 14,
    color: '#D1D5DB',
    fontWeight: '500',
  },
  managementStatValue: {
    fontSize: 14,
    color: '#FFFFFF',
    fontWeight: '600',
    textShadowColor: 'rgba(0, 0, 0, 0.3)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 1,
  },
  managementActions: {
    gap: 12,
    marginBottom: 20,
  },
  managementActionButton: {
    borderRadius: 8,
    overflow: 'hidden',
  },
  managementActionGradient: {
    paddingVertical: 12,
    alignItems: 'center',
  },
  managementActionText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#FFFFFF',
    textAlign: 'center',
    textShadowColor: 'rgba(0, 0, 0, 0.3)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 1,
  },
  modalSubMessage: {
    fontSize: 14,
    color: '#FCA5A5',
    textAlign: 'center',
    marginBottom: 20,
    fontStyle: 'italic',
  },
});
