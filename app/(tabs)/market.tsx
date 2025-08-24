import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useGame } from '@/contexts/GameContext';
import { getInflatedPrice } from '@/lib/economy/inflation';
import { ShoppingBag, Dumbbell, Apple } from 'lucide-react-native';

export default function MarketScreen() {
  const [activeTab, setActiveTab] = useState<'items' | 'food' | 'gym'>('items');
  const { gameState, buyItem, sellItem, buyFood, updateStats } = useGame();
  const { settings } = gameState;

  const handleGym = () => {
    const cost = 50;
    const energyCost = 20;

    if (gameState.stats.money < cost) return;
    if (gameState.stats.energy < energyCost) return;

    updateStats({
      money: gameState.stats.money - cost,
      energy: gameState.stats.energy - energyCost,
      fitness: gameState.stats.fitness + 5,
      health: gameState.stats.health + 3,
      happiness: gameState.stats.happiness + 2,
    });
  };

  const canAfford = (price: number) => gameState.stats.money >= price;
  const canUseGym = gameState.stats.money >= 50 && gameState.stats.energy >= 20;

    return (
      <View style={[styles.container, settings.darkMode && styles.containerDark]}>
        <View style={[styles.tabContainer, settings.darkMode && styles.tabContainerDark]}>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'items' && styles.activeTab]}
          onPress={() => setActiveTab('items')}
        >
          <ShoppingBag size={18} color={activeTab === 'items' ? '#FFFFFF' : '#6B7280'} />
            <Text style={[styles.tabText, activeTab === 'items' && styles.activeTabText, settings.darkMode && styles.tabTextDark]}>
            Items
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'food' && styles.activeTab]}
          onPress={() => setActiveTab('food')}
        >
          <Apple size={18} color={activeTab === 'food' ? '#FFFFFF' : '#6B7280'} />
            <Text style={[styles.tabText, activeTab === 'food' && styles.activeTabText, settings.darkMode && styles.tabTextDark]}>
            Food
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'gym' && styles.activeTab]}
          onPress={() => setActiveTab('gym')}
        >
          <Dumbbell size={18} color={activeTab === 'gym' ? '#FFFFFF' : '#6B7280'} />
            <Text style={[styles.tabText, activeTab === 'gym' && styles.activeTabText, settings.darkMode && styles.tabTextDark]}>
            Gym
          </Text>
        </TouchableOpacity>
      </View>

        <ScrollView style={[styles.content, settings.darkMode && styles.contentDark]} showsVerticalScrollIndicator={false}>
        <View style={styles.scrollIndicatorContainer}>
          <View style={styles.scrollIndicator}>
            <View style={styles.scrollBar}>
              <View style={styles.scrollThumb} />
            </View>
          </View>
        </View>
        {activeTab === 'items' ? (
          <View>
              <Text style={[styles.sectionDescription, settings.darkMode && styles.sectionDescriptionDark]}>
              Purchase items to unlock new opportunities and daily bonuses!
            </Text>

            {[...gameState.items].sort((a, b) => a.price - b.price).map(item => (
                <View key={item.id} style={[styles.itemCard, settings.darkMode && styles.itemCardDark]}>
                  <View style={styles.itemInfo}>
                    <Text style={[styles.itemName, settings.darkMode && styles.itemNameDark]}>{item.name}</Text>
                    {item.description && (
                      <Text style={[styles.itemDescription, settings.darkMode && styles.itemDescriptionDark]}>
                        {item.description}
                      </Text>
                    )}
                  <Text style={styles.itemPrice}>${item.price}</Text>
                  
                  {item.dailyBonus && (
                    <View style={styles.bonusInfo}>
                        <Text style={[styles.bonusTitle, settings.darkMode && styles.bonusTitleDark]}>Daily Bonus:</Text>
                        {Object.entries(item.dailyBonus).map(([stat, bonus]) => (
                          <Text key={stat} style={[styles.bonusText, settings.darkMode && styles.bonusTextDark]}>
                            +{bonus} {stat.charAt(0).toUpperCase() + stat.slice(1)}
                          </Text>
                        ))}
                    </View>
                  )}
                </View>

                {item.owned ? (
                  <TouchableOpacity
                    style={styles.sellButton}
                    onPress={() => sellItem(item.id)}
                  >
                    <Text style={styles.sellButtonText}>
                      Sell (${
                        (getInflatedPrice(item.price, gameState.economy.priceIndex) * 0.5).toFixed(2)
                      })
                    </Text>
                  </TouchableOpacity>
                ) : (
                  <TouchableOpacity onPress={() => buyItem(item.id)} disabled={!canAfford(item.price)}>
                    <LinearGradient
                      colors={canAfford(item.price) ? ['#16A34A', '#4ADE80'] : ['#E5E7EB', '#E5E7EB']}
                      start={{ x: 0, y: 0 }}
                      end={{ x: 1, y: 1 }}
                      style={styles.buyButton}
                    >
                      <Text style={[styles.buyButtonText, !canAfford(item.price) && styles.disabledButtonText]}>Buy</Text>
                    </LinearGradient>
                  </TouchableOpacity>
                )}
              </View>
            ))}
          </View>
        ) : activeTab === 'food' ? (
          <View>
              <Text style={[styles.sectionDescription, settings.darkMode && styles.sectionDescriptionDark]}>
              Buy food to restore your health and energy instantly!
            </Text>

            {[...gameState.foods].sort((a, b) => a.price - b.price).map(food => (
                <View key={food.id} style={[styles.itemCard, settings.darkMode && styles.itemCardDark]}>
                  <View style={styles.itemInfo}>
                    <Text style={[styles.itemName, settings.darkMode && styles.itemNameDark]}>{food.name}</Text>
                  <Text style={styles.itemPrice}>${food.price}</Text>
                  
                  <View style={styles.bonusInfo}>
                      <Text style={[styles.bonusTitle, settings.darkMode && styles.bonusTitleDark]}>Restores:</Text>
                      <Text style={[styles.bonusText, settings.darkMode && styles.bonusTextDark]}>+{food.healthRestore} Health</Text>
                      <Text style={[styles.bonusText, settings.darkMode && styles.bonusTextDark]}>+{food.energyRestore} Energy</Text>
                  </View>
                </View>

                <TouchableOpacity onPress={() => buyFood(food.id)} disabled={!canAfford(food.price)}>
                  <LinearGradient
                    colors={canAfford(food.price) ? ['#16A34A', '#4ADE80'] : ['#E5E7EB', '#E5E7EB']}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                    style={styles.buyButton}
                  >
                    <Text style={[styles.buyButtonText, !canAfford(food.price) && styles.disabledButtonText]}>Buy</Text>
                  </LinearGradient>
                </TouchableOpacity>
              </View>
            ))}
          </View>
        ) : (
          <View>
              <Text style={[styles.sectionDescription, settings.darkMode && styles.sectionDescriptionDark]}>
              Train at the gym to improve your fitness, health, and happiness!
            </Text>

              <View style={[styles.gymCard, settings.darkMode && styles.gymCardDark]}>
                <View style={styles.gymHeader}>
                  <Dumbbell size={32} color="#3B82F6" />
                  <Text style={[styles.gymTitle, settings.darkMode && styles.gymTitleDark]}>Gym Session</Text>
                </View>

                <Text style={[styles.currentFitness, settings.darkMode && styles.currentFitnessDark]}>
                  Current Fitness: {gameState.stats.fitness}
                </Text>

                <Text style={[styles.gymDescription, settings.darkMode && styles.gymDescriptionDark]}>
                  A good workout session will boost your stats and make you feel great!
                </Text>

                <View style={[styles.gymBenefits, settings.darkMode && styles.gymBenefitsDark]}>
                  <Text style={[styles.benefitsTitle, settings.darkMode && styles.benefitsTitleDark]}>Benefits per session:</Text>
                  <Text style={[styles.benefit, settings.darkMode && styles.benefitDark]}>+5 Fitness</Text>
                  <Text style={[styles.benefit, settings.darkMode && styles.benefitDark]}>+3 Health</Text>
                  <Text style={[styles.benefit, settings.darkMode && styles.benefitDark]}>+2 Happiness</Text>
                </View>

                <View style={[styles.gymCost, settings.darkMode && styles.gymCostDark]}>
                  <Text style={[styles.costTitle, settings.darkMode && styles.costTitleDark]}>Cost:</Text>
                  <Text style={styles.cost}>$50 + 20 Energy</Text>
                </View>

              <TouchableOpacity
                style={[
                  styles.gymButton,
                  !canUseGym && styles.disabledButton
                ]}
                onPress={handleGym}
                disabled={!canUseGym}
              >
                <Text style={[
                  styles.gymButtonText,
                  !canUseGym && styles.disabledButtonText
                ]}>
                  {gameState.stats.money < 50 ? 'Not enough money' :
                   gameState.stats.energy < 20 ? 'Not enough energy' :
                   'Start Workout'}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  containerDark: {
    backgroundColor: '#111827',
  },
  tabContainer: {
    flexDirection: 'row',
    backgroundColor: '#F3F4F6',
    margin: 20,
    borderRadius: 8,
    padding: 4,
  },
  tabContainerDark: {
    backgroundColor: '#1F2937',
  },
  tab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    borderRadius: 6,
  },
  activeTab: {
    backgroundColor: '#3B82F6',
  },
  tabText: {
    fontSize: 12,
    fontWeight: '500',
    color: '#6B7280',
    marginLeft: 4,
  },
  tabTextDark: {
    color: '#D1D5DB',
  },
  activeTabText: {
    color: '#FFFFFF',
  },
  content: {
    flex: 1,
    paddingHorizontal: 20,
  },
  contentDark: {},
  sectionDescription: {
    fontSize: 14,
    color: '#6B7280',
    marginBottom: 20,
    lineHeight: 20,
  },
  sectionDescriptionDark: {
    color: '#9CA3AF',
  },
  itemCard: {
    backgroundColor: '#FFFFFF',
    padding: 16,
    borderRadius: 12,
    marginBottom: 12,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 2,
  },
  itemCardDark: {
    backgroundColor: '#374151',
  },
  itemInfo: {
    flex: 1,
  },
  itemName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1F2937',
    marginBottom: 4,
  },
  itemNameDark: {
    color: '#F9FAFB',
  },
  itemDescription: {
    fontSize: 12,
    color: '#6B7280',
    marginBottom: 4,
  },
  itemDescriptionDark: {
    color: '#9CA3AF',
  },
  itemPrice: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#10B981',
    marginBottom: 8,
  },
  bonusInfo: {
    marginTop: 4,
  },
  bonusTitle: {
    fontSize: 12,
    fontWeight: '500',
    color: '#6B7280',
    marginBottom: 2,
  },
  bonusTitleDark: {
    color: '#9CA3AF',
  },
  bonusText: {
    fontSize: 11,
    color: '#3B82F6',
    fontWeight: '500',
  },
  bonusTextDark: {
    color: '#93C5FD',
  },
  buyButton: {
    paddingVertical: 8,
    paddingHorizontal: 20,
    borderRadius: 6,
  },
  sellButton: {
    backgroundColor: '#EF4444',
    paddingVertical: 8,
    paddingHorizontal: 20,
    borderRadius: 6,
  },
  ownedButton: {
    backgroundColor: '#10B981',
  },
  disabledButton: {
    backgroundColor: '#E5E7EB',
  },
  buyButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
  },
  sellButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
  },
  ownedButtonText: {
    color: '#FFFFFF',
  },
  disabledButtonText: {
    color: '#9CA3AF',
  },
  gymCard: {
    backgroundColor: '#FFFFFF',
    padding: 24,
    borderRadius: 16,
    marginBottom: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 3,
  },
  gymCardDark: {
    backgroundColor: '#374151',
  },
  gymHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  currentFitness: {
    fontSize: 16,
    fontWeight: '600',
    color: '#3B82F6',
    marginBottom: 8,
  },
  currentFitnessDark: {
    color: '#93C5FD',
  },
  gymTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#1F2937',
    marginLeft: 12,
  },
  gymTitleDark: {
    color: '#F9FAFB',
  },
  gymDescription: {
    fontSize: 16,
    color: '#6B7280',
    marginBottom: 20,
    lineHeight: 22,
  },
  gymDescriptionDark: {
    color: '#9CA3AF',
  },
  gymBenefits: {
    backgroundColor: '#F0FDF4',
    padding: 16,
    borderRadius: 8,
    marginBottom: 16,
  },
  gymBenefitsDark: {
    backgroundColor: '#1F2937',
  },
  benefitsTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 8,
  },
  benefitsTitleDark: {
    color: '#D1D5DB',
  },
  benefit: {
    fontSize: 14,
    color: '#10B981',
    fontWeight: '500',
    marginBottom: 2,
  },
  benefitDark: {
    color: '#10B981',
  },
  gymCost: {
    backgroundColor: '#FEF3C7',
    padding: 16,
    borderRadius: 8,
    marginBottom: 20,
  },
  gymCostDark: {
    backgroundColor: '#4B5563',
  },
  costTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 4,
  },
  costTitleDark: {
    color: '#F9FAFB',
  },
  cost: {
    fontSize: 16,
    color: '#F59E0B',
    fontWeight: '600',
  },
  gymButton: {
    backgroundColor: '#3B82F6',
    paddingVertical: 16,
    borderRadius: 8,
    alignItems: 'center',
  },
  gymButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  scrollIndicatorContainer: {
    position: 'absolute',
    right: 10,
    top: 20,
    bottom: 20,
    width: 4,
    zIndex: 1,
  },
  scrollIndicator: {
    flex: 1,
    justifyContent: 'center',
  },
  scrollBar: {
    width: 4,
    height: 40,
    backgroundColor: '#E5E7EB',
    borderRadius: 2,
  },
  scrollThumb: {
    width: 4,
    height: 20,
    backgroundColor: '#9CA3AF',
    borderRadius: 2,
  },
});