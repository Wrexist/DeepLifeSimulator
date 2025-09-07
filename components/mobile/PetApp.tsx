import React, { useState, useCallback } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Alert, Modal } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { ArrowLeft, PawPrint, Heart, Zap, Coffee, ShoppingCart, Plus, Settings } from 'lucide-react-native';
import { useGame } from '@/contexts/GameContext';

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
}

const petTypes = [
  { id: 'dog', name: 'Dog', emoji: '🐕', price: 500 },
  { id: 'cat', name: 'Cat', emoji: '🐱', price: 400 },
  { id: 'bird', name: 'Bird', emoji: '🐦', price: 300 },
  { id: 'fish', name: 'Fish', emoji: '🐠', price: 200 },
  { id: 'hamster', name: 'Hamster', emoji: '🐹', price: 150 },
];

const petFoods = [
  { id: 'basic', name: 'Basic Food', price: 10, nutrition: 20 },
  { id: 'premium', name: 'Premium Food', price: 25, nutrition: 50 },
  { id: 'luxury', name: 'Luxury Food', price: 50, nutrition: 100 },
];

const petToys = [
  { id: 'ball', name: 'Ball', price: 15, fun: 30 },
  { id: 'rope', name: 'Rope Toy', price: 20, fun: 40 },
  { id: 'puzzle', name: 'Puzzle Toy', price: 35, fun: 70 },
];

export default function PetApp({ onBack }: PetAppProps) {
  const { gameState, setGameState, saveGame } = useGame();
  const { settings } = gameState;
  const [activeTab, setActiveTab] = useState<'pets' | 'shop'>('pets');
  const [selectedPet, setSelectedPet] = useState<Pet | null>(null);
  const [showShopModal, setShowShopModal] = useState(false);
  const [shopCategory, setShopCategory] = useState<'pets' | 'food' | 'toys'>('pets');
  const [showPurchaseSuccessModal, setShowPurchaseSuccessModal] = useState(false);
  const [purchasedPet, setPurchasedPet] = useState<Pet | null>(null);

  const pets: Pet[] = gameState.pets || [];
  const cash = gameState.stats?.money || 0;

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

  const handleFeed = useCallback((pet: Pet) => {
    const food = petFoods[0]; // Basic food
    if (cash < food.price) {
      Alert.alert(
        'Not enough money', 
        `You need $${food.price} to buy food for ${pet.name}.`,
        [
          { text: 'OK', style: 'default' },
          { 
            text: 'Earn Money', 
            onPress: () => {
              Alert.alert('Tips', 'Try working, investing, or completing achievements to earn more money!');
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
          hunger: Math.max(0, p.hunger - food.nutrition),
          happiness: Math.min(100, p.happiness + 10),
          lastFed: Date.now(),
        };
      }
      return p;
    });

    setGameState(prev => ({
      ...prev,
      stats: { ...prev.stats, money: cash - food.price },
      pets: newPets,
    }));
    saveGame();

    Alert.alert('Fed!', `${pet.name} is now less hungry and happier! Cost: $${food.price}`);
  }, [pets, cash, setGameState, saveGame]);

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
      <View style={styles.tabContainer}>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'pets' && styles.activeTab]}
          onPress={() => setActiveTab('pets')}
        >
          <PawPrint size={20} color={activeTab === 'pets' ? '#FFFFFF' : '#6B7280'} />
          <Text style={[styles.tabText, activeTab === 'pets' ? styles.tabTextActive : styles.tabTextInactive]}>
            My Pets
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'shop' && styles.activeTab]}
          onPress={() => setActiveTab('shop')}
        >
          <ShoppingCart size={20} color={activeTab === 'shop' ? '#FFFFFF' : '#6B7280'} />
          <Text style={[styles.tabText, activeTab === 'shop' ? styles.tabTextActive : styles.tabTextInactive]}>
            Shop
          </Text>
        </TouchableOpacity>
      </View>

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
                      style={[styles.actionButton, cash < petFoods[0].price && styles.disabledButton]}
                      onPress={() => handleFeed(pet)}
                      disabled={cash < petFoods[0].price}
                    >
                      <Text style={styles.actionButtonText}>Feed (${petFoods[0].price})</Text>
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

              {shopCategory === 'food' && petFoods.map((food) => (
                <View key={food.id} style={styles.shopItem}>
                  <View style={styles.itemInfo}>
                    <Text style={styles.itemEmoji}>🍖</Text>
                    <View>
                      <Text style={styles.itemName}>{food.name}</Text>
                      <Text style={styles.itemDescription}>Nutrition: +{food.nutrition}</Text>
                      <Text style={styles.itemPrice}>${food.price}</Text>
                    </View>
                  </View>
                  <TouchableOpacity
                    style={[styles.buyButton, cash < food.price && styles.disabledButton]}
                    onPress={() => Alert.alert('Coming Soon', 'Food system will be implemented soon!')}
                    disabled={cash < food.price}
                  >
                    <Text style={styles.buyButtonText}>Buy</Text>
                  </TouchableOpacity>
                </View>
              ))}

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
                    onPress={() => Alert.alert('Coming Soon', 'Toy system will be implemented soon!')}
                    disabled={cash < toy.price}
                  >
                    <Text style={styles.buyButtonText}>Buy</Text>
                  </TouchableOpacity>
                </View>
              ))}
            </View>
          </View>
        )}
      </ScrollView>

      {/* Shop Modal */}
      <Modal visible={showShopModal} transparent animationType="fade">
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
      <Modal visible={showPurchaseSuccessModal} transparent animationType="fade">
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
  petEmoji: {
    fontSize: 32,
    marginRight: 16,
  },
  petDetails: {
    flex: 1,
  },
  petName: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 4,
  },
  petType: {
    color: 'rgba(255, 255, 255, 0.8)',
    fontSize: 14,
    marginBottom: 8,
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
});

