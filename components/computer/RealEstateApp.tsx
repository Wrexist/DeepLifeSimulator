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
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { ArrowLeft, Home, MapPin, DollarSign, TrendingUp, Heart, Shield, Zap, Users } from 'lucide-react-native';
import { useGame } from '@/contexts/GameContext';
import { getInflatedPrice } from '@/lib/economy/inflation';
import AsyncStorage from '@react-native-async-storage/async-storage';

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
}

const defaultUpgrades: Upgrade[] = [
  { id: 'kitchen', name: 'Renovated Kitchen', cost: 5000, rentIncrease: 100, purchased: false },
  { id: 'bathroom', name: 'New Bathroom', cost: 4000, rentIncrease: 80, purchased: false },
  { id: 'solar', name: 'Solar Panels', cost: 8000, rentIncrease: 160, purchased: false },
  { id: 'smarthome', name: 'Smart Home System', cost: 6000, rentIncrease: 120, purchased: false },
  { id: 'landscaping', name: 'Landscaping', cost: 3000, rentIncrease: 60, purchased: false },
];

const placeholderImage = require('@/assets/images/Real Estate.png');

export default function RealEstateApp({ onBack }: RealEstateAppProps) {
  const { gameState, updateStats, setGameState } = useGame();
  const [activeTab, setActiveTab] = useState<'browse' | 'owned'>('browse');
  const [properties, setProperties] = useState<Property[]>([
    {
      id: 'apartment1',
      name: 'City Apartment',
      price: 150000,
      dailyIncome: 200,
      location: 'Downtown',
      image: require('@/assets/images/Real Estate/City Apartment.png'),
      owned: false,
      status: 'vacant',
      upgrades: defaultUpgrades.map(u => ({ ...u })),
      traits: { happiness: 5 },
      traitDescription: '+5 happiness when living here',
    },
    {
      id: 'house1',
      name: 'Suburban House',
      price: 250000,
      dailyIncome: 300,
      location: 'Suburbs',
      image: require('@/assets/images/Real Estate/Suburaban House.png'),
      owned: false,
      status: 'vacant',
      upgrades: defaultUpgrades.map(u => ({ ...u })),
      traits: { health: 5 },
      traitDescription: '+5 health in a calm neighborhood',
    },
    {
      id: 'condo1',
      name: 'Luxury Condo',
      price: 400000,
      dailyIncome: 500,
      location: 'Uptown',
      image: require('@/assets/images/Real Estate/Luxury Condo.png'),
      owned: false,
      status: 'vacant',
      upgrades: defaultUpgrades.map(u => ({ ...u })),
      traits: { energy: 5 },
      traitDescription: '+5 energy from modern amenities',
    },
    {
      id: 'mansion1',
      name: 'Modern Mansion',
      price: 800000,
      dailyIncome: 1000,
      location: 'Hills',
      image: require('@/assets/images/Real Estate/Modern Mansion.png'),
      owned: false,
      status: 'vacant',
      upgrades: defaultUpgrades.map(u => ({ ...u })),
      traits: { happiness: 15 },
      traitDescription: 'Lavish living grants +15 happiness',
    },
    {
      id: 'penthouse1',
      name: 'Penthouse Suite',
      price: 1200000,
      dailyIncome: 1500,
      location: 'City Center',
      image: require('@/assets/images/Real Estate/Penthouse Suite.png'),
      owned: false,
      status: 'vacant',
      upgrades: defaultUpgrades.map(u => ({ ...u })),
      traits: { happiness: 20 },
      traitDescription: 'Skyline views give +20 happiness',
    },
    {
      id: 'villa1',
      name: 'Beach Villa',
      price: 2000000,
      dailyIncome: 2500,
      location: 'Coastline',
      image: require('@/assets/images/Real Estate/Beach Villa.png'),
      owned: false,
      status: 'vacant',
      upgrades: defaultUpgrades.map(u => ({ ...u })),
      traits: { energy: 10 },
      traitDescription: 'Sea breeze restores +10 energy',
    },
    {
      id: 'estate1',
      name: 'Rural Estate',
      price: 3500000,
      dailyIncome: 4000,
      location: 'Rural Area',
      image: require('@/assets/images/Real Estate/Rural Estate.png'),
      owned: false,
      status: 'vacant',
      upgrades: defaultUpgrades.map(u => ({ ...u })),
      traits: { health: 15 },
      traitDescription: 'Quiet nature adds +15 health',
    },
    {
      id: 'tower1',
      name: 'Office Tower',
      price: 5000000,
      dailyIncome: 6000,
      location: 'Business District',
      image: require('@/assets/images/Real Estate/Office Tower.png'),
      owned: false,
      status: 'vacant',
      upgrades: defaultUpgrades.map(u => ({ ...u })),
      traits: { energy: 15 },
      traitDescription: 'Entrepreneur spirit gives +15 energy',
    },
    {
      id: 'studio1',
      name: 'Downtown Studio',
      price: 100000,
      dailyIncome: 150,
      location: 'Central',
      image: require('@/assets/images/Real Estate/Downtown Studio.png'),
      owned: false,
      status: 'vacant',
      upgrades: defaultUpgrades.map(u => ({ ...u })),
      traits: { energy: 3 },
      traitDescription: 'City convenience +3 energy',
    },
    {
      id: 'cabin1',
      name: 'Mountain Cabin',
      price: 180000,
      dailyIncome: 220,
      location: 'Mountains',
      image: require('@/assets/images/Real Estate/Mountain Cabin.png'),
      owned: false,
      status: 'vacant',
      upgrades: defaultUpgrades.map(u => ({ ...u })),
      traits: { health: 7 },
      traitDescription: 'Fresh air grants +7 health',
    },
    {
      id: 'cottage1',
      name: 'Lakeside Cottage',
      price: 320000,
      dailyIncome: 350,
      location: 'Lakeside',
      image: require('@/assets/images/Real Estate/Lakeside Cottage.png'),
      owned: false,
      status: 'vacant',
      upgrades: defaultUpgrades.map(u => ({ ...u })),
      traits: { happiness: 8 },
      traitDescription: 'Relaxing views +8 happiness',
    },
  ]);
  const [loaded, setLoaded] = useState(false);

  const handleImageError = (id: string) => {
    setProperties(prev => prev.map(p => (p.id === id ? { ...p, image: placeholderImage } : p)));
  };

  const STORAGE_KEY = 'realEstateProperties';

  useEffect(() => {
    let isMounted = true;
    const loadProperties = async () => {
      try {
        const saved = await AsyncStorage.getItem(STORAGE_KEY);
        if (saved && isMounted) {
          setProperties(JSON.parse(saved));
        }
      } catch (error) {
        console.error('Error loading properties:', error);
      } finally {
        if (isMounted) setLoaded(true);
      }
    };
    loadProperties();
    return () => {
      isMounted = false;
    };
  }, []);

  useEffect(() => {
    const saveProperties = async () => {
      if (!loaded) return;
      try {
        await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(properties));
      } catch (error) {
        console.error('Error saving properties:', error);
      }
    };
    saveProperties();
  }, [properties, loaded]);

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

  const renderTrait = (trait: string, value: number) => {
    const IconComponent = getTraitIcon(trait);
    const color = getTraitColor(trait);
    const traitName = trait.charAt(0).toUpperCase() + trait.slice(1);
    
    return (
      <View style={styles.traitItem}>
        <View style={[styles.traitIcon, { backgroundColor: color + '20' }]}>
          <IconComponent size={14} color={color} />
        </View>
        <Text style={styles.traitText}>+{value} {traitName}</Text>
      </View>
    );
  };

  const renderPropertyCard = (property: Property) => {
    const canAfford = gameState.stats.money >= property.price;
    const totalIncome = property.dailyIncome * 7; // Weekly income
    
    return (
      <View key={property.id} style={styles.propertyCard}>
        <LinearGradient
          colors={property.owned ? ['#10B981', '#059669'] : ['#1F2937', '#111827']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.propertyCardGradient}
        >
          <View style={styles.propertyImageContainer}>
            <Image source={property.image} style={styles.propertyImage} />
            {property.owned && (
              <View style={styles.ownedBadge}>
                <Text style={styles.ownedText}>OWNED</Text>
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
                <Text style={styles.statText}>${property.price.toLocaleString()}</Text>
              </View>
              <View style={styles.statItem}>
                <TrendingUp size={16} color="#10B981" />
                <Text style={styles.statText}>${totalIncome.toLocaleString()}/week</Text>
              </View>
            </View>

            {Object.entries(property.traits).length > 0 && (
              <View style={styles.traitsContainer}>
                <Text style={styles.traitsTitle}>Traits:</Text>
                <View style={styles.traitsList}>
                  {Object.entries(property.traits).map(([trait, value]) => 
                    renderTrait(trait, value)
                  )}
                </View>
              </View>
            )}

            {!property.owned && (
              <TouchableOpacity
                style={styles.buyButton}
                onPress={() => handleBuyProperty(property)}
                disabled={!canAfford}
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
              </View>
            )}
          </View>
        </LinearGradient>
      </View>
    );
  };

    const handleBuyProperty = (property: Property) => {
    if (gameState.stats.money < property.price) {
      Alert.alert('Insufficient Funds', `You need $${property.price.toLocaleString()} to buy ${property.name}. You currently have $${gameState.stats.money.toLocaleString()}.`);
      return;
    }
    
    Alert.alert(
      'Confirm Purchase',
      `Are you sure you want to buy ${property.name} for $${property.price.toLocaleString()}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Buy',
          onPress: () => {
            const updatedProperties = properties.map(p =>
              p.id === property.id ? { ...p, owned: true, status: 'owner' as const } : p
            );
            setProperties(updatedProperties);
            updateStats({ money: -property.price });
            Alert.alert('Success', `You now own ${property.name}!`);
          },
        },
      ]
    );
  };

  const handleManageProperty = (property: Property) => {
    Alert.alert(
      'Property Management',
      `${property.name}\n\nWeekly Income: $${(property.dailyIncome * 7).toLocaleString()}\nStatus: ${property.status}`,
      [
        { text: 'Close', style: 'default' },
        {
          text: 'Sell Property',
          style: 'destructive',
          onPress: () => {
            Alert.alert(
              'Confirm Sale',
              `Sell ${property.name} for $${Math.floor(property.price * 0.8).toLocaleString()}?`,
              [
                { text: 'Cancel', style: 'cancel' },
                {
                  text: 'Sell',
                                     onPress: () => {
                     const updatedProperties = properties.map(p =>
                       p.id === property.id ? { ...p, owned: false, status: 'vacant' as const } : p
                     );
                     setProperties(updatedProperties);
                     updateStats({ money: Math.floor(property.price * 0.8) });
                     Alert.alert('Sold', `You sold ${property.name}!`);
                   },
                },
              ]
            );
          },
        },
      ]
    );
  };

  const ownedProperties = properties.filter(p => p.owned);
  const availableProperties = properties.filter(p => !p.owned);
  const totalValue = ownedProperties.reduce((sum, p) => sum + p.price, 0);
  const weeklyIncome = ownedProperties.reduce((sum, p) => sum + (p.dailyIncome * 7), 0);

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={onBack} style={styles.backButton}>
          <LinearGradient
            colors={['#374151', '#1F2937']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.backButtonGradient}
          >
            <ArrowLeft size={24} color="#FFFFFF" />
          </LinearGradient>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Real Estate</Text>
        <View style={styles.placeholder} />
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.summaryContainer}>
          <LinearGradient
            colors={['#1F2937', '#111827']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.summaryCard}
          >
            <View style={styles.summaryRow}>
              <View style={styles.summaryItem}>
                <DollarSign size={20} color="#F7931A" />
                <Text style={styles.summaryLabel}>Portfolio Value</Text>
                <Text style={styles.summaryValue}>${totalValue.toLocaleString()}</Text>
              </View>
              <View style={styles.summaryItem}>
                <TrendingUp size={20} color="#10B981" />
                <Text style={styles.summaryLabel}>Weekly Income</Text>
                <Text style={styles.summaryValue}>${weeklyIncome.toLocaleString()}</Text>
              </View>
              <View style={styles.summaryItem}>
                <Home size={20} color="#3B82F6" />
                <Text style={styles.summaryLabel}>Properties</Text>
                <Text style={styles.summaryValue}>{ownedProperties.length}</Text>
              </View>
            </View>
          </LinearGradient>
        </View>

        <View style={styles.tabContainer}>
          <TouchableOpacity
            style={[styles.tab, activeTab === 'browse' && styles.activeTab]}
            onPress={() => setActiveTab('browse')}
          >
            <LinearGradient
              colors={activeTab === 'browse' ? ['#3B82F6', '#1D4ED8'] : ['#374151', '#1F2937']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.tabGradient}
            >
              <Home size={16} color="#FFFFFF" />
              <Text style={styles.tabText}>Browse ({availableProperties.length})</Text>
            </LinearGradient>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.tab, activeTab === 'owned' && styles.activeTab]}
            onPress={() => setActiveTab('owned')}
          >
            <LinearGradient
              colors={activeTab === 'owned' ? ['#3B82F6', '#1D4ED8'] : ['#374151', '#1F2937']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.tabGradient}
            >
              <Users size={16} color="#FFFFFF" />
              <Text style={styles.tabText}>Owned ({ownedProperties.length})</Text>
            </LinearGradient>
          </TouchableOpacity>
        </View>

        <View style={styles.propertiesContainer}>
          {(activeTab === 'browse' ? availableProperties : ownedProperties).map(renderPropertyCard)}
        </View>
      </ScrollView>
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
  },
  backButton: {
    borderRadius: 12,
    overflow: 'hidden',
  },
  backButtonGradient: {
    width: 48,
    height: 48,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#FFFFFF',
  },
  placeholder: {
    width: 48,
  },
  summaryContainer: {
    paddingHorizontal: 20,
    marginBottom: 20,
  },
  summaryCard: {
    padding: 20,
    borderRadius: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  summaryItem: {
    alignItems: 'center',
    flex: 1,
  },
  summaryLabel: {
    fontSize: 12,
    color: '#9CA3AF',
    marginTop: 4,
    marginBottom: 2,
  },
  summaryValue: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#FFFFFF',
  },
  tabContainer: {
    flexDirection: 'row',
    paddingHorizontal: 20,
    marginBottom: 20,
    gap: 12,
  },
  tab: {
    flex: 1,
    borderRadius: 12,
    overflow: 'hidden',
  },
  activeTab: {
    shadowColor: '#3B82F6',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  tabGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    gap: 8,
  },
  tabText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  content: {
    flex: 1,
    paddingHorizontal: 20,
  },
  propertiesContainer: {
    gap: 16,
    paddingBottom: 40,
  },
  propertyCard: {
    borderRadius: 16,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
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
    backgroundColor: '#10B981',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  ownedText: {
    fontSize: 10,
    fontWeight: 'bold',
    color: '#FFFFFF',
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
  },
  locationContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  locationText: {
    fontSize: 14,
    color: '#9CA3AF',
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
    color: '#E5E7EB',
    fontWeight: '500',
  },
  traitsContainer: {
    marginBottom: 12,
  },
  traitsTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#F59E0B',
    marginBottom: 6,
  },
  traitsList: {
    gap: 6,
  },
  traitItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  traitIcon: {
    width: 20,
    height: 20,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
  },
  traitText: {
    fontSize: 12,
    color: '#D1D5DB',
  },
  buyButton: {
    borderRadius: 8,
    overflow: 'hidden',
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
  },
});
