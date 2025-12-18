import React, { useState, useCallback, useEffect, useMemo } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Alert, Modal } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { ArrowLeft, PawPrint, Heart, Zap, Coffee, ShoppingCart, Plus, Settings, Stethoscope, Trophy, Clock, Star, Award, Sparkles, AlertTriangle } from 'lucide-react-native';
import { useGame } from '@/contexts/GameContext';
import { scale, fontScale } from '@/utils/scaling';

interface PetAppProps {
  onBack: () => void;
}

interface Pet {
  id: string;
  name: string;
  type: string;
  age: number;
  hunger: number;
  happiness: number;
  health: number;
  energy?: number;
  lastFed?: number;
  lastPlayed?: number;
  lastSlept?: number;
  lastVetVisit?: number;
  vaccinated?: boolean;
  competitionWins?: number;
  traits?: string[];
  isSick?: boolean;
  sickness?: string;
}

const petTypes = [
  { id: 'dog', name: 'Dog', emoji: '🐕', price: 15000, lifespan: 15 },
  { id: 'cat', name: 'Cat', emoji: '🐱', price: 12000, lifespan: 18 },
  { id: 'bird', name: 'Bird', emoji: '🐦', price: 8000, lifespan: 12 },
  { id: 'fish', name: 'Fish', emoji: '🐠', price: 5000, lifespan: 5 },
  { id: 'hamster', name: 'Hamster', emoji: '🐹', price: 3500, lifespan: 3 },
  { id: 'rabbit', name: 'Rabbit', emoji: '🐰', price: 10000, lifespan: 10 },
  { id: 'turtle', name: 'Turtle', emoji: '🐢', price: 7000, lifespan: 30 },
];

const petFoods = [
  { id: 'basic', name: 'Basic Food', price: 10, nutrition: 20 },
  { id: 'premium', name: 'Premium Food', price: 25, nutrition: 50 },
  { id: 'luxury', name: 'Luxury Food', price: 50, nutrition: 100 },
  { id: 'organic', name: 'Organic Food', price: 75, nutrition: 80, healthBonus: 5 },
];

const petToys = [
  { id: 'ball', name: 'Ball', price: 15, fun: 30 },
  { id: 'rope', name: 'Rope Toy', price: 20, fun: 40 },
  { id: 'puzzle', name: 'Puzzle Toy', price: 35, fun: 70 },
  { id: 'laser', name: 'Laser Pointer', price: 25, fun: 50 },
];

// Vet services
const vetServices = [
  { id: 'checkup', name: 'Regular Checkup', price: 100, healthBonus: 10, description: 'Basic health examination' },
  { id: 'vaccination', name: 'Vaccination', price: 200, healthBonus: 5, description: 'Protect against diseases' },
  { id: 'treatment', name: 'Illness Treatment', price: 500, healthBonus: 30, description: 'Treat sick pets' },
  { id: 'surgery', name: 'Surgery', price: 1500, healthBonus: 50, description: 'Major medical procedure' },
  { id: 'dental', name: 'Dental Cleaning', price: 150, healthBonus: 15, description: 'Oral hygiene care' },
  { id: 'grooming', name: 'Professional Grooming', price: 80, happinessBonus: 20, description: 'Full spa treatment' },
];

// Pet competitions
const petCompetitions = [
  { id: 'beauty', name: 'Beauty Contest', entryFee: 50, prize: 500, requirement: 'happiness', minValue: 70, emoji: '👑' },
  { id: 'agility', name: 'Agility Race', entryFee: 75, prize: 750, requirement: 'energy', minValue: 60, emoji: '🏃' },
  { id: 'obedience', name: 'Obedience Trial', entryFee: 100, prize: 1000, requirement: 'happiness', minValue: 80, emoji: '🎓' },
  { id: 'talent', name: 'Talent Show', entryFee: 150, prize: 1500, requirement: 'health', minValue: 70, emoji: '⭐' },
  { id: 'championship', name: 'Grand Championship', entryFee: 500, prize: 5000, requirement: 'all', minValue: 75, emoji: '🏆' },
];

// Pet sicknesses
const petSicknesses = [
  { id: 'cold', name: 'Common Cold', severity: 'mild', treatmentCost: 100, healthDrain: 2 },
  { id: 'infection', name: 'Infection', severity: 'moderate', treatmentCost: 300, healthDrain: 5 },
  { id: 'parasite', name: 'Parasites', severity: 'moderate', treatmentCost: 250, healthDrain: 3 },
  { id: 'injury', name: 'Minor Injury', severity: 'mild', treatmentCost: 150, healthDrain: 4 },
];

export default function PetApp({ onBack }: PetAppProps) {
  const { gameState, setGameState, saveGame, feedPet, buyPetFood, buyPetToy, usePetToy } = useGame();
  const { settings } = gameState;
  const [activeTab, setActiveTab] = useState<'pets' | 'shop' | 'vet' | 'competitions'>('pets');
  const [selectedPet, setSelectedPet] = useState<Pet | null>(null);
  const [showShopModal, setShowShopModal] = useState(false);
  const [shopCategory, setShopCategory] = useState<'pets' | 'food' | 'toys'>('pets');
  const [showPurchaseSuccessModal, setShowPurchaseSuccessModal] = useState(false);
  const [purchasedPet, setPurchasedPet] = useState<Pet | null>(null);
  const [showVetModal, setShowVetModal] = useState(false);
  const [showCompetitionResultModal, setShowCompetitionResultModal] = useState(false);
  const [competitionResult, setCompetitionResult] = useState<{ won: boolean; prize: number; competition: string } | null>(null);

  const pets: Pet[] = gameState.pets || [];
  const cash = gameState.stats?.money || 0;

  // Auto-dismiss the purchase success modal after 3 seconds
  useEffect(() => {
    if (showPurchaseSuccessModal && purchasedPet) {
      const timer = setTimeout(() => {
        setShowPurchaseSuccessModal(false);
        setPurchasedPet(null);
      }, 3000); // 3 seconds

      return () => clearTimeout(timer);
    }
  }, [showPurchaseSuccessModal, purchasedPet]);

  // Calculate pet bonuses
  const calculatePetBonuses = useCallback(() => {
    const happinessBonus = pets.reduce(
      (sum, pet) => (pet.hunger < 50 && pet.happiness >= 35 ? sum + 5 : sum),
      0
    );
    
    // Health bonus: pets with high health (>= 70) provide health bonus to player
    const healthBonus = pets.reduce(
      (sum, pet) => (pet.health >= 70 ? sum + 3 : sum),
      0
    );
    
    return { happinessBonus, healthBonus };
  }, [pets]);

  const petBonuses = calculatePetBonuses();

  // Calculate pet age in human years (based on weeks played)
  const getPetAgeDisplay = useCallback((pet: Pet) => {
    const ageInWeeks = pet.age || 0;
    const years = Math.floor(ageInWeeks / 52);
    const months = Math.floor((ageInWeeks % 52) / 4);
    if (years > 0) {
      return `${years}y ${months}m`;
    }
    return `${months}m`;
  }, []);

  // Check pet lifespan
  const getPetLifeStatus = useCallback((pet: Pet) => {
    const petType = petTypes.find(p => p.id === pet.type);
    const lifespan = petType?.lifespan || 10;
    const ageInYears = (pet.age || 0) / 52;
    const percentLife = (ageInYears / lifespan) * 100;
    
    if (percentLife >= 90) return { status: 'elderly', color: '#EF4444', label: 'Elderly' };
    if (percentLife >= 70) return { status: 'senior', color: '#F59E0B', label: 'Senior' };
    if (percentLife >= 30) return { status: 'adult', color: '#10B981', label: 'Adult' };
    return { status: 'young', color: '#3B82F6', label: 'Young' };
  }, []);

  // Handle vet visit
  const handleVetService = useCallback((pet: Pet, serviceId: string) => {
    const service = vetServices.find(s => s.id === serviceId);
    if (!service) return;

    if (cash < service.price) {
      Alert.alert('Insufficient Funds', `You need $${service.price} for this service.`);
      return;
    }

    Alert.alert(
      service.name,
      `This service costs $${service.price}. Proceed?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Confirm',
          onPress: () => {
            const newPets = pets.map(p => {
              if (p.id === pet.id) {
                const updates: Partial<Pet> = {
                  health: Math.min(100, (p.health || 0) + (service.healthBonus || 0)),
                  happiness: Math.min(100, (p.happiness || 0) + ((service as any).happinessBonus || 0)),
                  lastVetVisit: Date.now(),
                };
                
                if (serviceId === 'vaccination') {
                  updates.vaccinated = true;
                }
                
                if (serviceId === 'treatment' && p.isSick) {
                  updates.isSick = false;
                  updates.sickness = undefined;
                }
                
                return { ...p, ...updates };
              }
              return p;
            });

            setGameState(prev => ({
              ...prev,
              stats: { ...prev.stats, money: cash - service.price },
              pets: newPets,
            }));
            saveGame();
            Alert.alert('Success! 🏥', `${pet.name} received ${service.name}. Health improved!`);
          },
        },
      ]
    );
  }, [cash, pets, setGameState, saveGame]);

  // Handle competition entry
  const handleEnterCompetition = useCallback((pet: Pet, competitionId: string) => {
    const competition = petCompetitions.find(c => c.id === competitionId);
    if (!competition) return;

    if (cash < competition.entryFee) {
      Alert.alert('Insufficient Funds', `Entry fee is $${competition.entryFee}.`);
      return;
    }

    // Check requirements
    let canEnter = true;
    let failReason = '';

    if (competition.requirement === 'all') {
      if (pet.happiness < competition.minValue || pet.health < competition.minValue || (pet.energy || 100) < competition.minValue) {
        canEnter = false;
        failReason = `${pet.name} needs at least ${competition.minValue} in all stats.`;
      }
    } else {
      const statValue = pet[competition.requirement as keyof Pet] as number;
      if (statValue < competition.minValue) {
        canEnter = false;
        failReason = `${pet.name} needs at least ${competition.minValue} ${competition.requirement}.`;
      }
    }

    if (!canEnter) {
      Alert.alert('Requirements Not Met', failReason);
      return;
    }

    Alert.alert(
      `Enter ${competition.name}?`,
      `Entry fee: $${competition.entryFee}\nPrize: $${competition.prize}`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Enter',
          onPress: () => {
            // Calculate win chance based on pet stats
            const statAverage = ((pet.happiness || 0) + (pet.health || 0) + (pet.energy || 100)) / 3;
            const winChance = Math.min(80, statAverage - 20 + (pet.competitionWins || 0) * 5);
            const won = Math.random() * 100 < winChance;

            const newPets = pets.map(p => {
              if (p.id === pet.id) {
                return {
                  ...p,
                  energy: Math.max(0, (p.energy || 100) - 30),
                  happiness: won ? Math.min(100, (p.happiness || 0) + 10) : Math.max(0, (p.happiness || 0) - 5),
                  competitionWins: won ? (p.competitionWins || 0) + 1 : (p.competitionWins || 0),
                };
              }
              return p;
            });

            const moneyChange = won ? competition.prize - competition.entryFee : -competition.entryFee;

            setGameState(prev => ({
              ...prev,
              stats: { ...prev.stats, money: cash + moneyChange },
              pets: newPets,
            }));
            saveGame();

            setCompetitionResult({
              won,
              prize: won ? competition.prize : 0,
              competition: competition.name,
            });
            setShowCompetitionResultModal(true);
          },
        },
      ]
    );
  }, [cash, pets, setGameState, saveGame]);

  const handleFeed = useCallback((pet: Pet, foodType: string = 'basic') => {
    // Check if player has food in inventory
    const foodCount = gameState.petFood?.[foodType] || 0;
    if (foodCount <= 0) {
      Alert.alert(
        'No Food', 
        `You don't have any ${foodType} food. Buy some from the shop first!`,
        [
          { text: 'OK', style: 'default' },
          { 
            text: 'Go to Shop', 
            onPress: () => {
              setActiveTab('shop');
              setShopCategory('food');
            }
          }
        ]
      );
      return;
    }

    // Use the feedPet function from context
    feedPet(pet.id, foodType);
    
    const food = petFoods.find(f => f.id === foodType) || petFoods[0];
    Alert.alert('Fed!', `${pet.name} enjoyed the ${food.name}! Hunger decreased and happiness increased.`);
  }, [gameState.petFood, feedPet]);

  const handlePlay = useCallback((pet: Pet) => {
    const currentEnergy = pet.energy || 100;
    const playerEnergy = gameState.stats?.energy || 100;
    
    if (currentEnergy < 20) {
      Alert.alert('Too Tired', `${pet.name} is too tired to play. Let them rest first.`);
      return;
    }

    if (playerEnergy < 15) {
      Alert.alert(
        'Too Tired', 
        'You are too tired to play with your pet. Get some rest first!',
        [
          { text: 'OK', style: 'default' },
          { 
            text: 'Rest', 
            onPress: () => {
              // Could navigate to sleep/rest functionality
              Alert.alert('Tip', 'Try sleeping or taking a break to restore your energy!');
            }
          }
        ]
      );
      return;
    }

    const newPets = pets.map(p => {
      if (p.id === pet.id) {
        return {
          ...p,
          energy: Math.max(0, (p.energy || 100) - 20),
          happiness: Math.min(100, p.happiness + 25),
          lastPlayed: Date.now(),
        };
      }
      return p;
    });

    setGameState(prev => ({
      ...prev,
      stats: { 
        ...prev.stats, 
        energy: Math.max(0, playerEnergy - 15) // Player loses 15 energy
      },
      pets: newPets,
    }));
    saveGame();

    Alert.alert('Played!', `${pet.name} had a great time playing! You feel a bit tired but happy.`);
  }, [pets, gameState.stats?.energy, setGameState, saveGame]);

  const handleSleep = useCallback((pet: Pet) => {
    const newPets = pets.map(p => {
      if (p.id === pet.id) {
        return {
          ...p,
          energy: Math.min(100, (p.energy || 100) + 50),
          health: Math.min(100, p.health + 10),
          lastSlept: Date.now(),
        };
      }
      return p;
    });

    setGameState(prev => ({
      ...prev,
      pets: newPets,
    }));
    saveGame();

    Alert.alert('Slept!', `${pet.name} is well rested and healthier!`);
  }, [pets, setGameState, saveGame]);

  const handleBuyPet = useCallback((petType: typeof petTypes[0]) => {
    if (cash < petType.price) {
      Alert.alert(
        'Not enough money', 
        `You need $${petType.price} to buy a ${petType.name}.`,
        [
          { text: 'OK', style: 'default' },
          { 
            text: 'Earn Money', 
            onPress: () => {
              // Could navigate to work tab or show tips
              Alert.alert('Tips', 'Try working, investing, or completing achievements to earn more money!');
            }
          }
        ]
      );
      return;
    }

    const newPet: Pet = {
      id: `${petType.id}_${Date.now()}`,
      name: `${petType.name} #${pets.length + 1}`,
      type: petType.id,
      age: 0,
      happiness: 50,
      energy: 100,
      health: 100,
      hunger: 50,
      lastFed: Date.now(),
      lastPlayed: Date.now(),
      lastSlept: Date.now(),
    };

    setGameState(prev => ({
      ...prev,
      stats: { ...prev.stats, money: cash - petType.price },
      pets: [...pets, newPet],
    }));
    saveGame();

    // Show rich purchase success popup
    setPurchasedPet(newPet);
    setShowPurchaseSuccessModal(true);
    setShowShopModal(false);
  }, [pets, cash, setGameState, saveGame]);

  const getPetEmoji = (type: string) => {
    const petType = petTypes.find(p => p.id === type);
    return petType?.emoji || '🐾';
  };

  const getStatusColor = (value: number) => {
    if (value >= 80) return '#10B981';
    if (value >= 50) return '#F59E0B';
    return '#EF4444';
  };

  const getStatusText = (value: number) => {
    if (value >= 80) return 'Great';
    if (value >= 50) return 'Good';
    return 'Poor';
  };

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={onBack}>
          <ArrowLeft size={24} color="#FFFFFF" />
        </TouchableOpacity>
        <View style={styles.headerCenter}>
          <Text style={styles.headerTitle}>Pet Care</Text>
          <View style={styles.resourceDisplay}>
            <Text style={styles.resourceText}>💰 ${cash}</Text>
            <Text style={styles.resourceText}>⚡ {gameState.stats?.energy || 100}</Text>
          </View>
          {(petBonuses.happinessBonus > 0 || petBonuses.healthBonus > 0) && (
            <View style={styles.bonusDisplay}>
              <Text style={styles.bonusText}>
                🐾 Pet Bonuses: 
                {petBonuses.happinessBonus > 0 && ` +${petBonuses.happinessBonus} 😊`}
                {petBonuses.healthBonus > 0 && ` +${petBonuses.healthBonus} ❤️`}
              </Text>
            </View>
          )}
        </View>
        <TouchableOpacity style={styles.shopButton} onPress={() => setShowShopModal(true)}>
          <ShoppingCart size={24} color="#FFFFFF" />
        </TouchableOpacity>
      </View>

      {/* Tabs */}
      <ScrollView 
        horizontal 
        showsHorizontalScrollIndicator={false}
        style={styles.tabScrollContainer}
        contentContainerStyle={styles.tabContainer}
      >
        <TouchableOpacity
          style={[styles.tab, activeTab === 'pets' && styles.activeTab]}
          onPress={() => setActiveTab('pets')}
        >
          <PawPrint size={18} color={activeTab === 'pets' ? '#FFFFFF' : '#6B7280'} />
          <Text style={[styles.tabText, activeTab === 'pets' ? styles.tabTextActive : styles.tabTextInactive]}>
            My Pets
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'shop' && styles.activeTab]}
          onPress={() => setActiveTab('shop')}
        >
          <ShoppingCart size={18} color={activeTab === 'shop' ? '#FFFFFF' : '#6B7280'} />
          <Text style={[styles.tabText, activeTab === 'shop' ? styles.tabTextActive : styles.tabTextInactive]}>
            Shop
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'vet' && styles.activeTab]}
          onPress={() => setActiveTab('vet')}
        >
          <Stethoscope size={18} color={activeTab === 'vet' ? '#FFFFFF' : '#6B7280'} />
          <Text style={[styles.tabText, activeTab === 'vet' ? styles.tabTextActive : styles.tabTextInactive]}>
            Vet
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'competitions' && styles.activeTab]}
          onPress={() => setActiveTab('competitions')}
        >
          <Trophy size={18} color={activeTab === 'competitions' ? '#FFFFFF' : '#6B7280'} />
          <Text style={[styles.tabText, activeTab === 'competitions' ? styles.tabTextActive : styles.tabTextInactive]}>
            Compete
          </Text>
        </TouchableOpacity>
      </ScrollView>

      {/* Content */}
      <ScrollView 
        style={styles.content} 
        contentContainerStyle={styles.contentContainer}
        showsVerticalScrollIndicator={true}
      >
        {activeTab === 'pets' && (
          <View style={styles.petsContainer}>
            {pets.length === 0 ? (
              <View style={styles.emptyState}>
                <Text style={styles.emptyStateText}>No pets yet. Visit the shop to adopt one!</Text>
              </View>
            ) : (
              pets.map((pet) => (
                <View key={pet.id} style={styles.petCard}>
                  <View style={styles.petHeader}>
                    <View style={styles.petInfo}>
                      <Text style={styles.petEmoji}>{getPetEmoji(pet.type)}</Text>
                      <View>
                        <Text style={styles.petName}>{pet.name}</Text>
                        <Text style={styles.petType}>{pet.type.charAt(0).toUpperCase() + pet.type.slice(1)}</Text>
                      </View>
                    </View>
                                         <View style={styles.petStatus}>
                       <Text style={styles.statusText}>Overall: {getStatusText(Math.round((pet.happiness + pet.health + (pet.energy || 100)) / 3))}</Text>
                       {((pet.hunger < 50 && pet.happiness >= 35) || pet.health >= 70) && (
                         <View style={styles.bonusIndicator}>
                           <Text style={styles.bonusIndicatorText}>
                             🎁 Bonuses: 
                             {pet.hunger < 50 && pet.happiness >= 35 && ' +5 😊'}
                             {pet.health >= 70 && ' +3 ❤️'}
                           </Text>
                         </View>
                       )}
                     </View>
                  </View>

                  <View style={styles.statsGrid}>
                    <View style={styles.statItem}>
                      <Heart size={16} color={getStatusColor(pet.happiness)} />
                      <Text style={styles.statLabel}>Happiness</Text>
                      <Text style={[styles.statValue, { color: getStatusColor(pet.happiness) }]}>
                        {pet.happiness}%
                      </Text>
                    </View>
                                         <View style={styles.statItem}>
                       <Zap size={16} color={getStatusColor(pet.energy || 100)} />
                       <Text style={styles.statLabel}>Energy</Text>
                       <Text style={[styles.statValue, { color: getStatusColor(pet.energy || 100) }]}>
                         {pet.energy || 100}%
                       </Text>
                     </View>
                    <View style={styles.statItem}>
                      <Heart size={16} color={getStatusColor(pet.health)} />
                      <Text style={styles.statLabel}>Health</Text>
                      <Text style={[styles.statValue, { color: getStatusColor(pet.health) }]}>
                        {pet.health}%
                      </Text>
                    </View>
                    <View style={styles.statItem}>
                      <Coffee size={16} color={getStatusColor(100 - pet.hunger)} />
                      <Text style={styles.statLabel}>Hunger</Text>
                      <Text style={[styles.statValue, { color: getStatusColor(100 - pet.hunger) }]}>
                        {pet.hunger}%
                      </Text>
                    </View>
                  </View>

                  <View style={styles.petActions}>
                    <TouchableOpacity
                      style={[styles.actionButton, (gameState.petFood?.['basic'] || 0) <= 0 && styles.disabledButton]}
                      onPress={() => handleFeed(pet, 'basic')}
                      disabled={(gameState.petFood?.['basic'] || 0) <= 0}
                    >
                      <Text style={styles.actionButtonText}>
                        Feed Basic {(gameState.petFood?.['basic'] || 0) > 0 && `(${gameState.petFood['basic']})`}
                      </Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[
                        styles.actionButton, 
                        ((pet.energy || 100) < 20 || (gameState.stats?.energy || 100) < 15) && styles.disabledButton
                      ]}
                      onPress={() => handlePlay(pet)}
                      disabled={(pet.energy || 100) < 20 || (gameState.stats?.energy || 100) < 15}
                    >
                      <Text style={styles.actionButtonText}>Play (-15⚡)</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={styles.actionButton}
                      onPress={() => handleSleep(pet)}
                    >
                      <Text style={styles.actionButtonText}>Sleep</Text>
                    </TouchableOpacity>
                  </View>

                  {/* Pet Toys */}
                  {pet.toys && pet.toys.length > 0 && (
                    <View style={styles.petToysSection}>
                      <Text style={[styles.petToysTitle, settings.darkMode && styles.textDark]}>Toys</Text>
                      <View style={styles.petToysList}>
                        {pet.toys.map((toyId) => {
                          const toy = petToys.find(t => t.id === toyId);
                          if (!toy) return null;
                          return (
                            <TouchableOpacity
                              key={toyId}
                              style={styles.petToyButton}
                              onPress={() => {
                                const result = usePetToy(pet.id, toyId);
                                if (result.success) {
                                  Alert.alert('Success', result.message);
                                  saveGame();
                                } else {
                                  Alert.alert('Error', result.message);
                                }
                              }}
                            >
                              <Text style={styles.petToyEmoji}>
                                {toyId === 'ball' ? '⚽' : toyId === 'rope' ? '🪢' : '🧩'}
                              </Text>
                              <Text style={styles.petToyName}>{toy.name}</Text>
                              <Text style={styles.petToyEffect}>+{toy.fun} 😊</Text>
                            </TouchableOpacity>
                          );
                        })}
                      </View>
                    </View>
                  )}
                </View>
              ))
            )}
          </View>
        )}

        {activeTab === 'shop' && (
          <View style={styles.shopContainer}>
            <View style={styles.shopCategories}>
              <TouchableOpacity
                style={[styles.categoryButton, shopCategory === 'pets' && styles.activeCategory]}
                onPress={() => setShopCategory('pets')}
              >
                <Text style={[styles.categoryText, shopCategory === 'pets' && styles.activeCategoryText]}>
                  Pets
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.categoryButton, shopCategory === 'food' && styles.activeCategory]}
                onPress={() => setShopCategory('food')}
              >
                <Text style={[styles.categoryText, shopCategory === 'food' && styles.activeCategoryText]}>
                  Food
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.categoryButton, shopCategory === 'toys' && styles.activeCategory]}
                onPress={() => setShopCategory('toys')}
              >
                <Text style={[styles.categoryText, shopCategory === 'toys' && styles.activeCategoryText]}>
                  Toys
                </Text>
              </TouchableOpacity>
            </View>

            <View style={styles.shopItems}>
              {shopCategory === 'pets' && petTypes.map((petType) => (
                <View key={petType.id} style={styles.shopItem}>
                  <View style={styles.itemInfo}>
                    <Text style={styles.itemEmoji}>{petType.emoji}</Text>
                    <View>
                      <Text style={styles.itemName}>{petType.name}</Text>
                      <Text style={styles.itemPrice}>${petType.price}</Text>
                    </View>
                  </View>
                  <TouchableOpacity
                    style={[styles.buyButton, cash < petType.price && styles.disabledButton]}
                    onPress={() => handleBuyPet(petType)}
                    disabled={cash < petType.price}
                  >
                    <Text style={styles.buyButtonText}>Buy</Text>
                  </TouchableOpacity>
                </View>
              ))}

              {shopCategory === 'food' && petFoods.map((food) => {
                const foodCount = gameState.petFood?.[food.id] || 0;
                return (
                  <View key={food.id} style={styles.shopItem}>
                    <View style={styles.itemInfo}>
                      <Text style={styles.itemEmoji}>🍖</Text>
                      <View>
                        <Text style={styles.itemName}>{food.name}</Text>
                        <Text style={styles.itemDescription}>Nutrition: +{food.nutrition}</Text>
                        <Text style={styles.itemPrice}>${food.price}</Text>
                        <Text style={styles.itemInventory}>In inventory: {foodCount}</Text>
                      </View>
                    </View>
                    <TouchableOpacity
                      style={[styles.buyButton, cash < food.price && styles.disabledButton]}
                      onPress={() => buyPetFood(food.id, 1)}
                      disabled={cash < food.price}
                    >
                      <Text style={styles.buyButtonText}>Buy</Text>
                    </TouchableOpacity>
                  </View>
                );
              })}

              {shopCategory === 'toys' && petToys.map((toy) => (
                <View key={toy.id} style={styles.shopItem}>
                  <View style={styles.itemInfo}>
                    <Text style={styles.itemEmoji}>🎾</Text>
                    <View>
                      <Text style={styles.itemName}>{toy.name}</Text>
                      <Text style={styles.itemDescription}>Fun: +{toy.fun}</Text>
                      <Text style={styles.itemPrice}>${toy.price}</Text>
                    </View>
                  </View>
                  <TouchableOpacity
                    style={[styles.buyButton, cash < toy.price && styles.disabledButton]}
                    onPress={() => {
                      if (!selectedPet) {
                        Alert.alert('Select Pet', 'Please select a pet first to buy toys for them.');
                        return;
                      }
                      const result = buyPetToy(selectedPet.id, toy.id);
                      if (result.success) {
                        Alert.alert('Success', result.message);
                        saveGame();
                      } else {
                        Alert.alert('Error', result.message);
                      }
                    }}
                    disabled={cash < toy.price || !selectedPet}
                  >
                    <Text style={styles.buyButtonText}>Buy</Text>
                  </TouchableOpacity>
                </View>
              ))}
            </View>
          </View>
        )}

        {/* Vet Tab */}
        {activeTab === 'vet' && (
          <View style={styles.vetContainer}>
            {pets.length === 0 ? (
              <View style={styles.emptyState}>
                <Stethoscope size={48} color="#6B7280" />
                <Text style={styles.emptyStateText}>No pets to treat</Text>
                <Text style={[styles.emptyStateText, { fontSize: 14 }]}>Adopt a pet first!</Text>
              </View>
            ) : (
              <>
                <Text style={styles.vetSectionTitle}>Select a Pet</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.petSelector}>
                  {pets.map((pet) => {
                    const lifeStatus = getPetLifeStatus(pet);
                    return (
                      <TouchableOpacity
                        key={pet.id}
                        style={[
                          styles.petSelectorItem,
                          selectedPet?.id === pet.id && styles.petSelectorItemActive,
                        ]}
                        onPress={() => setSelectedPet(pet)}
                      >
                        <Text style={styles.petSelectorEmoji}>{getPetEmoji(pet.type)}</Text>
                        <Text style={styles.petSelectorName}>{pet.name}</Text>
                        <View style={[styles.petAgeBadge, { backgroundColor: lifeStatus.color }]}>
                          <Text style={styles.petAgeBadgeText}>{lifeStatus.label}</Text>
                        </View>
                        {pet.isSick && (
                          <View style={styles.sickBadge}>
                            <AlertTriangle size={12} color="#EF4444" />
                          </View>
                        )}
                      </TouchableOpacity>
                    );
                  })}
                </ScrollView>

                {selectedPet && (
                  <>
                    <View style={styles.petHealthCard}>
                      <LinearGradient
                        colors={selectedPet.isSick ? ['#EF4444', '#DC2626'] : ['#10B981', '#059669']}
                        style={styles.petHealthCardGradient}
                      >
                        <View style={styles.petHealthHeader}>
                          <Text style={styles.petHealthEmoji}>{getPetEmoji(selectedPet.type)}</Text>
                          <View style={styles.petHealthInfo}>
                            <Text style={styles.petHealthName}>{selectedPet.name}</Text>
                            <Text style={styles.petHealthAge}>Age: {getPetAgeDisplay(selectedPet)}</Text>
                          </View>
                          <View style={styles.petHealthStats}>
                            <Text style={styles.petHealthStat}>❤️ {selectedPet.health}%</Text>
                            {selectedPet.vaccinated && <Text style={styles.vaccinatedBadge}>💉 Vaccinated</Text>}
                          </View>
                        </View>
                        {selectedPet.isSick && (
                          <View style={styles.sickAlert}>
                            <AlertTriangle size={16} color="#FFF" />
                            <Text style={styles.sickAlertText}>
                              {selectedPet.name} is sick: {selectedPet.sickness}
                            </Text>
                          </View>
                        )}
                      </LinearGradient>
                    </View>

                    <Text style={styles.vetSectionTitle}>Veterinary Services</Text>
                    {vetServices.map((service) => (
                      <TouchableOpacity
                        key={service.id}
                        style={styles.vetServiceCard}
                        onPress={() => handleVetService(selectedPet, service.id)}
                        disabled={cash < service.price}
                      >
                        <View style={styles.vetServiceInfo}>
                          <Text style={styles.vetServiceName}>{service.name}</Text>
                          <Text style={styles.vetServiceDesc}>{service.description}</Text>
                          <View style={styles.vetServiceEffects}>
                            {service.healthBonus && (
                              <Text style={styles.vetServiceEffect}>+{service.healthBonus} ❤️</Text>
                            )}
                            {(service as any).happinessBonus && (
                              <Text style={styles.vetServiceEffect}>+{(service as any).happinessBonus} 😊</Text>
                            )}
                          </View>
                        </View>
                        <View style={[styles.vetServicePrice, cash < service.price && styles.disabledPrice]}>
                          <Text style={styles.vetServicePriceText}>${service.price}</Text>
                        </View>
                      </TouchableOpacity>
                    ))}
                  </>
                )}
              </>
            )}
          </View>
        )}

        {/* Competitions Tab */}
        {activeTab === 'competitions' && (
          <View style={styles.competitionsContainer}>
            {pets.length === 0 ? (
              <View style={styles.emptyState}>
                <Trophy size={48} color="#6B7280" />
                <Text style={styles.emptyStateText}>No pets to compete</Text>
                <Text style={[styles.emptyStateText, { fontSize: 14 }]}>Adopt a pet first!</Text>
              </View>
            ) : (
              <>
                <Text style={styles.vetSectionTitle}>Select a Competitor</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.petSelector}>
                  {pets.map((pet) => (
                    <TouchableOpacity
                      key={pet.id}
                      style={[
                        styles.petSelectorItem,
                        selectedPet?.id === pet.id && styles.petSelectorItemActive,
                      ]}
                      onPress={() => setSelectedPet(pet)}
                    >
                      <Text style={styles.petSelectorEmoji}>{getPetEmoji(pet.type)}</Text>
                      <Text style={styles.petSelectorName}>{pet.name}</Text>
                      {(pet.competitionWins || 0) > 0 && (
                        <View style={styles.winsBadge}>
                          <Trophy size={10} color="#F59E0B" />
                          <Text style={styles.winsBadgeText}>{pet.competitionWins}</Text>
                        </View>
                      )}
                    </TouchableOpacity>
                  ))}
                </ScrollView>

                {selectedPet && (
                  <>
                    <View style={styles.competitorStats}>
                      <LinearGradient
                        colors={['#8B5CF6', '#7C3AED']}
                        style={styles.competitorStatsGradient}
                      >
                        <Text style={styles.competitorEmoji}>{getPetEmoji(selectedPet.type)}</Text>
                        <View style={styles.competitorInfo}>
                          <Text style={styles.competitorName}>{selectedPet.name}</Text>
                          <View style={styles.competitorStatRow}>
                            <Text style={styles.competitorStat}>❤️ {selectedPet.health}</Text>
                            <Text style={styles.competitorStat}>😊 {selectedPet.happiness}</Text>
                            <Text style={styles.competitorStat}>⚡ {selectedPet.energy || 100}</Text>
                          </View>
                        </View>
                        <View style={styles.competitorTrophies}>
                          <Trophy size={24} color="#FFD700" />
                          <Text style={styles.competitorWins}>{selectedPet.competitionWins || 0}</Text>
                        </View>
                      </LinearGradient>
                    </View>

                    <Text style={styles.vetSectionTitle}>Available Competitions</Text>
                    {petCompetitions.map((comp) => {
                      const meetsRequirement = comp.requirement === 'all'
                        ? (selectedPet.happiness >= comp.minValue && selectedPet.health >= comp.minValue && (selectedPet.energy || 100) >= comp.minValue)
                        : (selectedPet[comp.requirement as keyof Pet] as number) >= comp.minValue;

                      return (
                        <TouchableOpacity
                          key={comp.id}
                          style={[styles.competitionCard, !meetsRequirement && styles.competitionCardDisabled]}
                          onPress={() => handleEnterCompetition(selectedPet, comp.id)}
                          disabled={!meetsRequirement || cash < comp.entryFee}
                        >
                          <Text style={styles.competitionEmoji}>{comp.emoji}</Text>
                          <View style={styles.competitionInfo}>
                            <Text style={styles.competitionName}>{comp.name}</Text>
                            <Text style={styles.competitionRequirement}>
                              Requires: {comp.requirement === 'all' ? 'All stats' : comp.requirement} ≥ {comp.minValue}
                            </Text>
                            <View style={styles.competitionRewards}>
                              <Text style={styles.competitionEntry}>Entry: ${comp.entryFee}</Text>
                              <Text style={styles.competitionPrize}>Prize: ${comp.prize}</Text>
                            </View>
                          </View>
                          {meetsRequirement ? (
                            <View style={styles.enterButton}>
                              <Text style={styles.enterButtonText}>Enter</Text>
                            </View>
                          ) : (
                            <View style={styles.lockedBadge}>
                              <Text style={styles.lockedText}>Locked</Text>
                            </View>
                          )}
                        </TouchableOpacity>
                      );
                    })}
                  </>
                )}
              </>
            )}
          </View>
        )}
      </ScrollView>

      {/* Shop Modal */}
      <Modal visible={showShopModal} transparent animationType="fade" onRequestClose={() => setShowShopModal(false)}>
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Pet Shop</Text>
            <Text style={styles.modalSubtitle}>Adopt a new pet or buy supplies</Text>
            
            <View style={styles.modalActions}>
              <TouchableOpacity
                style={styles.modalButton}
                onPress={() => {
                  setShowShopModal(false);
                  setActiveTab('shop');
                }}
              >
                <Text style={styles.modalButtonText}>Go to Shop</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.modalButton}
                onPress={() => setShowShopModal(false)}
              >
                <Text style={styles.modalButtonText}>Close</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Pet Purchase Success Modal */}
      <Modal visible={showPurchaseSuccessModal} transparent animationType="fade" onRequestClose={() => setShowPurchaseSuccessModal(false)}>
        <View style={styles.modalBackdrop}>
          <View style={styles.purchaseSuccessModal}>
            <LinearGradient
              colors={['#10B981', '#059669']}
              style={styles.purchaseSuccessGradient}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
            >
              <View style={styles.purchaseSuccessContent}>
                <View style={styles.purchaseSuccessIcon}>
                  <Text style={styles.purchaseSuccessEmoji}>🎉</Text>
                </View>
                
                <Text style={styles.purchaseSuccessTitle}>Pet Adopted!</Text>
                <Text style={styles.purchaseSuccessSubtitle}>
                  Welcome {purchasedPet?.name} to your family!
                </Text>
                
                <View style={styles.petInfoCard}>
                  <Text style={styles.petEmoji}>{getPetEmoji(purchasedPet?.type || '')}</Text>
                  <View style={styles.petDetails}>
                    <Text style={styles.petName}>{purchasedPet?.name}</Text>
                    <Text style={styles.petType}>{purchasedPet?.type?.charAt(0).toUpperCase()}{purchasedPet?.type?.slice(1)}</Text>
                    <View style={styles.petStats}>
                      <View style={styles.petStat}>
                        <Text style={styles.petStatLabel}>Happiness</Text>
                        <Text style={styles.petStatValue}>{purchasedPet?.happiness}%</Text>
                      </View>
                      <View style={styles.petStat}>
                        <Text style={styles.petStatLabel}>Health</Text>
                        <Text style={styles.petStatValue}>{purchasedPet?.health}%</Text>
                      </View>
                    </View>
                  </View>
                </View>
                
                <Text style={styles.purchaseSuccessTip}>
                  💡 Take good care of your new pet by feeding, playing, and letting them rest!
                </Text>
                
                <View style={styles.purchaseSuccessActions}>
                  <TouchableOpacity
                    style={styles.purchaseSuccessButton}
                    onPress={() => {
                      setShowPurchaseSuccessModal(false);
                      setPurchasedPet(null);
                      setActiveTab('pets');
                    }}
                  >
                    <Text style={styles.purchaseSuccessButtonText}>View My Pets</Text>
                  </TouchableOpacity>
                  
                  <TouchableOpacity
                    style={styles.purchaseSuccessButtonSecondary}
                    onPress={() => {
                      setShowPurchaseSuccessModal(false);
                      setPurchasedPet(null);
                    }}
                  >
                    <Text style={styles.purchaseSuccessButtonSecondaryText}>Continue Shopping</Text>
                  </TouchableOpacity>
                </View>
              </View>
            </LinearGradient>
          </View>
        </View>
      </Modal>

      {/* Competition Result Modal */}
      <Modal visible={showCompetitionResultModal} transparent animationType="fade" onRequestClose={() => setShowCompetitionResultModal(false)}>
        <View style={styles.modalBackdrop}>
          <View style={styles.competitionResultModal}>
            <LinearGradient
              colors={competitionResult?.won ? ['#F59E0B', '#D97706'] : ['#6B7280', '#4B5563']}
              style={styles.competitionResultGradient}
            >
              <View style={styles.competitionResultContent}>
                <Text style={styles.competitionResultEmoji}>
                  {competitionResult?.won ? '🏆' : '😢'}
                </Text>
                <Text style={styles.competitionResultTitle}>
                  {competitionResult?.won ? 'Victory!' : 'Better Luck Next Time'}
                </Text>
                <Text style={styles.competitionResultSubtitle}>
                  {competitionResult?.competition}
                </Text>
                {competitionResult?.won && (
                  <View style={styles.prizeDisplay}>
                    <Text style={styles.prizeLabel}>Prize Won:</Text>
                    <Text style={styles.prizeAmount}>${competitionResult.prize}</Text>
                  </View>
                )}
                <TouchableOpacity
                  style={styles.competitionResultButton}
                  onPress={() => setShowCompetitionResultModal(false)}
                >
                  <Text style={styles.competitionResultButtonText}>Continue</Text>
                </TouchableOpacity>
              </View>
            </LinearGradient>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0B0C10',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 16,
    paddingHorizontal: 16,
    paddingBottom: 10,
    backgroundColor: '#11131A',
    borderBottomColor: '#1F2230',
    borderBottomWidth: 1,
  },
  headerCenter: {
    alignItems: 'center',
    flex: 1,
  },
  headerTitle: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '800',
    marginBottom: 4,
  },
  resourceDisplay: {
    flexDirection: 'row',
    gap: 12,
  },
  resourceText: {
    color: '#9FA4B3',
    fontSize: 12,
    fontWeight: '600',
  },
  bonusDisplay: {
    marginTop: 4,
    paddingHorizontal: 8,
    paddingVertical: 2,
    backgroundColor: '#059669',
    borderRadius: 8,
  },
  bonusText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '700',
    textAlign: 'center',
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 10,
    backgroundColor: '#1A1D29',
    alignItems: 'center',
    justifyContent: 'center',
  },
  shopButton: {
    width: 40,
    height: 40,
    borderRadius: 10,
    backgroundColor: '#1A1D29',
    alignItems: 'center',
    justifyContent: 'center',
  },
  tabContainer: {
    marginHorizontal: 16,
    backgroundColor: '#0F1220',
    borderRadius: 12,
    borderColor: '#23283B',
    borderWidth: 1,
    flexDirection: 'row',
    padding: 10,
    gap: 10,
    marginBottom: 16,
  },
  tab: {
    flex: 1,
    height: 60,
    borderRadius: 10,
    backgroundColor: '#101426',
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 8,
  },
  activeTab: {
    backgroundColor: '#1E293B',
  },
  tabText: {
    fontSize: 13,
    fontWeight: '700',
  },
  tabTextActive: {
    color: '#FFFFFF',
  },
  tabTextInactive: {
    color: '#6B7280',
  },
  content: {
    flex: 1,
  },
  contentContainer: {
    paddingHorizontal: 16,
    paddingBottom: 40,
  },
  petsContainer: {
    gap: 16,
    paddingBottom: 20,
  },
  petCard: {
    backgroundColor: '#0F1220',
    borderRadius: 14,
    padding: 16,
    borderColor: '#23283B',
    borderWidth: 1,
  },
  petHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  petInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  petEmoji: {
    fontSize: 32,
  },
  petName: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 2,
  },
  petType: {
    color: '#9FA4B3',
    fontSize: 14,
  },
  petStatus: {
    backgroundColor: '#1A1D29',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    alignItems: 'flex-end',
  },
  bonusIndicator: {
    marginTop: 4,
    paddingHorizontal: 6,
    paddingVertical: 2,
    backgroundColor: '#059669',
    borderRadius: 6,
  },
  bonusIndicatorText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: '700',
  },
  statusText: {
    color: '#9FA4B3',
    fontSize: 12,
    fontWeight: '600',
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginBottom: 16,
  },
  statItem: {
    flex: 1,
    minWidth: '45%',
    backgroundColor: '#1A1D29',
    borderRadius: 8,
    padding: 12,
    alignItems: 'center',
  },
  statLabel: {
    color: '#9FA4B3',
    fontSize: 12,
    marginTop: 4,
    marginBottom: 2,
  },
  statValue: {
    fontSize: 14,
    fontWeight: '700',
  },
  petActions: {
    flexDirection: 'row',
    gap: 8,
  },
  actionButton: {
    flex: 1,
    backgroundColor: '#3B82F6',
    borderRadius: 8,
    paddingVertical: 10,
    alignItems: 'center',
  },
  actionButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
  },
  disabledButton: {
    backgroundColor: '#6B7280',
  },
  shopContainer: {
    gap: 16,
    paddingBottom: 20,
  },
  shopCategories: {
    flexDirection: 'row',
    backgroundColor: '#0F1220',
    borderRadius: 12,
    borderColor: '#23283B',
    borderWidth: 1,
    padding: 6,
    gap: 6,
  },
  categoryButton: {
    flex: 1,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  activeCategory: {
    backgroundColor: '#1E293B',
  },
  categoryText: {
    color: '#9FA4B3',
    fontSize: 14,
    fontWeight: '600',
  },
  activeCategoryText: {
    color: '#FFFFFF',
  },
  shopItems: {
    gap: 12,
  },
  shopItem: {
    backgroundColor: '#0F1220',
    borderRadius: 14,
    padding: 16,
    borderColor: '#23283B',
    borderWidth: 1,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  itemInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
  },
  itemEmoji: {
    fontSize: 24,
  },
  itemName: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 2,
  },
  itemDescription: {
    color: '#9FA4B3',
    fontSize: 12,
    marginBottom: 2,
  },
  itemPrice: {
    color: '#10B981',
    fontSize: 14,
    fontWeight: '600',
  },
  itemInventory: {
    color: '#6B7280',
    fontSize: 12,
    marginTop: 2,
  },
  buyButton: {
    backgroundColor: '#3B82F6',
    borderRadius: 8,
    paddingVertical: 8,
    paddingHorizontal: 16,
  },
  buyButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: 40,
  },
  emptyStateText: {
    color: '#9FA4B3',
    fontSize: 16,
    textAlign: 'center',
    lineHeight: 22,
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.55)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
  },
  modalCard: {
    width: '100%',
    maxWidth: 320,
    backgroundColor: '#121527',
    borderRadius: 16,
    padding: 20,
    borderColor: '#23283B',
    borderWidth: 1,
  },
  modalTitle: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '800',
    marginBottom: 4,
    textAlign: 'center',
  },
  modalSubtitle: {
    color: '#9FA4B3',
    fontSize: 14,
    marginBottom: 16,
    textAlign: 'center',
  },
  modalActions: {
    flexDirection: 'row',
    gap: 12,
  },
  modalButton: {
    flex: 1,
    backgroundColor: '#3B82F6',
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: 'center',
  },
  modalButtonText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 16,
  },

  // Purchase Success Modal Styles
  purchaseSuccessModal: {
    width: '90%',
    maxWidth: 400,
    borderRadius: 16,
    overflow: 'hidden',
    boxShadow: '0px 4px 8px rgba(0, 0, 0, 0.3)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  purchaseSuccessGradient: {
    padding: 24,
  },
  purchaseSuccessContent: {
    alignItems: 'center',
  },
  purchaseSuccessIcon: {
    marginBottom: 16,
  },
  purchaseSuccessEmoji: {
    fontSize: 48,
  },
  purchaseSuccessTitle: {
    color: '#FFFFFF',
    fontSize: 24,
    fontWeight: '700',
    marginBottom: 8,
    textAlign: 'center',
  },
  purchaseSuccessSubtitle: {
    color: 'rgba(255, 255, 255, 0.9)',
    fontSize: 16,
    marginBottom: 24,
    textAlign: 'center',
  },
  petInfoCard: {
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    borderRadius: 12,
    padding: 16,
    marginBottom: 20,
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
  },
  petStats: {
    flexDirection: 'row',
    gap: 16,
  },
  petStat: {
    flex: 1,
  },
  petStatLabel: {
    color: 'rgba(255, 255, 255, 0.7)',
    fontSize: 12,
    marginBottom: 2,
  },
  petStatValue: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
  },
  petToysSection: {
    marginTop: 16,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.1)',
  },
  petToysTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
    marginBottom: 12,
  },
  petToysList: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  petToyButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(139, 92, 246, 0.2)',
    borderRadius: 8,
    padding: 8,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: 'rgba(139, 92, 246, 0.4)',
    gap: 6,
  },
  petToyEmoji: {
    fontSize: 16,
  },
  petToyName: {
    fontSize: 12,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  petToyEffect: {
    fontSize: 11,
    color: 'rgba(255, 255, 255, 0.7)',
  },
  textDark: {
    color: '#F9FAFB',
  },
  purchaseSuccessTip: {
    color: 'rgba(255, 255, 255, 0.9)',
    fontSize: 14,
    textAlign: 'center',
    marginBottom: 24,
    lineHeight: 20,
  },
  purchaseSuccessActions: {
    width: '100%',
    gap: 12,
  },
  purchaseSuccessButton: {
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.3)',
  },
  purchaseSuccessButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  purchaseSuccessButtonSecondary: {
    backgroundColor: 'transparent',
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.3)',
  },
  purchaseSuccessButtonSecondaryText: {
    color: 'rgba(255, 255, 255, 0.8)',
    fontSize: 16,
    fontWeight: '500',
  },

  // New tab styles
  tabScrollContainer: {
    maxHeight: 80,
  },

  // Vet styles
  vetContainer: {
    gap: 16,
    paddingBottom: 20,
  },
  vetSectionTitle: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 12,
  },
  petSelector: {
    flexDirection: 'row',
    marginBottom: 16,
  },
  petSelectorItem: {
    alignItems: 'center',
    backgroundColor: '#1A1D29',
    borderRadius: 12,
    padding: 12,
    marginRight: 12,
    minWidth: 80,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  petSelectorItemActive: {
    borderColor: '#3B82F6',
    backgroundColor: '#1E293B',
  },
  petSelectorEmoji: {
    fontSize: 32,
    marginBottom: 4,
  },
  petSelectorName: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '600',
  },
  petAgeBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 8,
    marginTop: 4,
  },
  petAgeBadgeText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: '600',
  },
  sickBadge: {
    position: 'absolute',
    top: 4,
    right: 4,
    backgroundColor: '#FEE2E2',
    borderRadius: 10,
    padding: 2,
  },
  petHealthCard: {
    borderRadius: 14,
    overflow: 'hidden',
    marginBottom: 16,
  },
  petHealthCardGradient: {
    padding: 16,
  },
  petHealthHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  petHealthEmoji: {
    fontSize: 40,
    marginRight: 12,
  },
  petHealthInfo: {
    flex: 1,
  },
  petHealthName: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '700',
  },
  petHealthAge: {
    color: 'rgba(255, 255, 255, 0.8)',
    fontSize: 14,
  },
  petHealthStats: {
    alignItems: 'flex-end',
  },
  petHealthStat: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
  },
  vaccinatedBadge: {
    color: '#FFFFFF',
    fontSize: 12,
    marginTop: 4,
  },
  sickAlert: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.2)',
    borderRadius: 8,
    padding: 8,
    marginTop: 12,
  },
  sickAlertText: {
    color: '#FFFFFF',
    fontSize: 12,
    marginLeft: 8,
  },
  vetServiceCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#0F1220',
    borderRadius: 12,
    padding: 14,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#23283B',
  },
  vetServiceInfo: {
    flex: 1,
  },
  vetServiceName: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '600',
    marginBottom: 2,
  },
  vetServiceDesc: {
    color: '#9FA4B3',
    fontSize: 12,
    marginBottom: 4,
  },
  vetServiceEffects: {
    flexDirection: 'row',
    gap: 8,
  },
  vetServiceEffect: {
    color: '#10B981',
    fontSize: 12,
    fontWeight: '600',
  },
  vetServicePrice: {
    backgroundColor: '#3B82F6',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 8,
  },
  vetServicePriceText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
  },
  disabledPrice: {
    backgroundColor: '#4B5563',
  },

  // Competition styles
  competitionsContainer: {
    gap: 16,
    paddingBottom: 20,
  },
  winsBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F59E0B',
    borderRadius: 10,
    paddingHorizontal: 6,
    paddingVertical: 2,
    marginTop: 4,
  },
  winsBadgeText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: '700',
    marginLeft: 2,
  },
  competitorStats: {
    borderRadius: 14,
    overflow: 'hidden',
    marginBottom: 16,
  },
  competitorStatsGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
  },
  competitorEmoji: {
    fontSize: 40,
    marginRight: 12,
  },
  competitorInfo: {
    flex: 1,
  },
  competitorName: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '700',
  },
  competitorStatRow: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 4,
  },
  competitorStat: {
    color: 'rgba(255, 255, 255, 0.9)',
    fontSize: 12,
  },
  competitorTrophies: {
    alignItems: 'center',
  },
  competitorWins: {
    color: '#FFD700',
    fontSize: 20,
    fontWeight: '800',
    marginTop: 2,
  },
  competitionCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#0F1220',
    borderRadius: 12,
    padding: 14,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#23283B',
  },
  competitionCardDisabled: {
    opacity: 0.5,
  },
  competitionEmoji: {
    fontSize: 32,
    marginRight: 12,
  },
  competitionInfo: {
    flex: 1,
  },
  competitionName: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '600',
    marginBottom: 2,
  },
  competitionRequirement: {
    color: '#9FA4B3',
    fontSize: 11,
    marginBottom: 4,
  },
  competitionRewards: {
    flexDirection: 'row',
    gap: 12,
  },
  competitionEntry: {
    color: '#EF4444',
    fontSize: 12,
    fontWeight: '600',
  },
  competitionPrize: {
    color: '#10B981',
    fontSize: 12,
    fontWeight: '600',
  },
  enterButton: {
    backgroundColor: '#10B981',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
  },
  enterButtonText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '700',
  },
  lockedBadge: {
    backgroundColor: '#374151',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
  },
  lockedText: {
    color: '#9CA3AF',
    fontSize: 12,
    fontWeight: '600',
  },

  // Competition Result Modal
  competitionResultModal: {
    width: '85%',
    maxWidth: 350,
    borderRadius: 16,
    overflow: 'hidden',
  },
  competitionResultGradient: {
    padding: 24,
  },
  competitionResultContent: {
    alignItems: 'center',
  },
  competitionResultEmoji: {
    fontSize: 64,
    marginBottom: 16,
  },
  competitionResultTitle: {
    color: '#FFFFFF',
    fontSize: 24,
    fontWeight: '800',
    marginBottom: 4,
  },
  competitionResultSubtitle: {
    color: 'rgba(255, 255, 255, 0.8)',
    fontSize: 16,
    marginBottom: 20,
  },
  prizeDisplay: {
    alignItems: 'center',
    marginBottom: 20,
  },
  prizeLabel: {
    color: 'rgba(255, 255, 255, 0.7)',
    fontSize: 14,
  },
  prizeAmount: {
    color: '#FFFFFF',
    fontSize: 32,
    fontWeight: '800',
  },
  competitionResultButton: {
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    paddingHorizontal: 40,
    paddingVertical: 12,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.3)',
  },
  competitionResultButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
});

