import React, { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView, Image, ImageBackground, Dimensions } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useRouter } from 'expo-router';
import { perks } from '@/src/features/onboarding/perksData';
import { useOnboarding } from '@/src/features/onboarding/OnboardingContext';
import { useGame } from '@/contexts/GameContext';
import { Lock, Check, Star, TrendingUp, Heart, Zap, DollarSign, Shield, Users } from 'lucide-react-native';

const { width: screenWidth } = Dimensions.get('window');

export default function Perks() {
  const { state, setState } = useOnboarding();
  const { gameState, loadGame } = useGame();
  const router = useRouter();
  const [selected, setSelected] = useState<string[]>(state.perks);

  const toggle = (id: string) => {
    setSelected(prev => {
      if (prev.includes(id)) return prev.filter(p => p !== id);
      if (prev.length >= 2) return prev; // max 2
      return [...prev, id];
    });
  };

  const start = async () => {
    const scenario = state.scenario!;
    const sex =
      state.sex === 'random'
        ? Math.random() < 0.5
          ? 'male'
          : 'female'
        : state.sex;
    const seekingGender =
      state.sexuality === 'straight'
        ? sex === 'male'
          ? 'female'
          : 'male'
        : state.sexuality === 'gay'
        ? sex
        : sex === 'male'
        ? 'female'
        : 'male';
    const newState: any = {
      ...gameState,
      stats: {
        ...gameState.stats,
        money: scenario.start.cash + (selected.includes('legacy_builder') ? 5000 : 0),
        reputation: gameState.stats.reputation + (selected.includes('legacy_builder') ? 5 : 0),
        energy: gameState.stats.energy + (selected.includes('astute_planner') ? 10 : 0),
      },
      date: { ...gameState.date, age: scenario.start.age },
      userProfile: {
        ...gameState.userProfile,
        firstName: state.firstName,
        lastName: state.lastName,
        sex,
        sexuality: state.sexuality,
        gender: sex,
        seekingGender,
      },
      perks: selected.reduce((acc, id) => ({ ...acc, [id]: true }), {}),
      scenarioId: scenario.id,
    };
    await AsyncStorage.setItem(`save_slot_${state.slot}`, JSON.stringify({ ...newState, version: 5 }));
    await AsyncStorage.setItem('lastSlot', String(state.slot));
    setState(prev => ({ ...prev, perks: selected }));
    await loadGame(state.slot);
    router.replace('/(tabs)');
  };

  const getStatIcon = (stat: string) => {
    switch (stat) {
      case 'happiness': return Heart;
      case 'health': return Shield;
      case 'energy': return Zap;
      case 'fitness': return TrendingUp;
      case 'reputation': return Users;
      case 'money': return DollarSign;
      default: return TrendingUp;
    }
  };

  const getStatColor = (stat: string) => {
    switch (stat) {
      case 'happiness': return '#EF4444';
      case 'health': return '#10B981';
      case 'energy': return '#F59E0B';
      case 'fitness': return '#3B82F6';
      case 'reputation': return '#8B5CF6';
      case 'money': return '#F7931A';
      default: return '#6B7280';
    }
  };

  const renderBenefits = (perk: typeof perks[0]) => {
    const benefits = [];
    
    // Income multiplier
    if (perk.effects.incomeMultiplier && perk.effects.incomeMultiplier > 1) {
      const percentage = Math.round((perk.effects.incomeMultiplier - 1) * 100);
      benefits.push({
        icon: TrendingUp,
        color: '#10B981',
        text: `+${percentage}% Salary`,
        value: `${percentage}%`
      });
    }
    
    // Stat boosts
    Object.entries(perk.effects.statBoosts || {}).forEach(([stat, value]) => {
      if (value > 0) {
        const IconComponent = getStatIcon(stat);
        const color = getStatColor(stat);
        const statName = stat.charAt(0).toUpperCase() + stat.slice(1);
        benefits.push({
          icon: IconComponent,
          color,
          text: `+${value} ${statName}`,
          value: `+${value}`
        });
      }
    });

    if (benefits.length === 0) return null;

    return (
      <View style={styles.benefitsContainer}>
        <Text style={styles.benefitsTitle}>Benefits:</Text>
        <View style={styles.benefitsList}>
          {benefits.map((benefit, index) => (
            <View key={index} style={styles.benefitItem}>
              <View style={[styles.benefitIcon, { backgroundColor: benefit.color + '20' }]}>
                <benefit.icon size={12} color={benefit.color} />
              </View>
              <Text style={styles.benefitText}>{benefit.text}</Text>
            </View>
          ))}
        </View>
      </View>
    );
  };

  const renderPerk = (p: typeof perks[0]) => {
    const unlocked =
      !p.unlock ||
      gameState.achievements.some(
        a => p.unlock && a.id === p.unlock.achievementId && a.completed,
      );
    const locked = !unlocked;
    const isSelected = selected.includes(p.id);
    
    return (
      <TouchableOpacity
        key={p.id}
        style={styles.perkContainer}
        disabled={locked}
        onPress={() => toggle(p.id)}
      >
        <LinearGradient
          colors={
            locked 
              ? ['#374151', '#1F2937'] 
              : isSelected 
                ? ['#3B82F6', '#1D4ED8'] 
                : ['#1F2937', '#111827']
          }
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.perkCard}
        >
          <View style={styles.perkHeader}>
            <View style={styles.iconContainer}>
              <Image source={p.icon} style={styles.perkIcon} />
            </View>
            <View style={styles.perkInfo}>
              <View style={styles.perkTitleRow}>
                <Text style={styles.perkTitle}>{p.title}</Text>
                <View style={[styles.rarityBadge, { backgroundColor: getRarityColor(p.rarity) }]}>
                  <Text style={styles.rarityText}>{p.rarity}</Text>
                </View>
              </View>
              <Text style={styles.perkDesc}>{p.description}</Text>
            </View>
            <View style={styles.perkActions}>
              {locked ? (
                <View style={styles.lockContainer}>
                  <Lock size={20} color="#9CA3AF" />
                </View>
              ) : isSelected ? (
                <View style={styles.selectedContainer}>
                  <Check size={20} color="#FFFFFF" />
                </View>
              ) : (
                <View style={styles.selectContainer}>
                  <Star size={20} color="#6B7280" />
                </View>
              )}
            </View>
          </View>
          
          {!locked && renderBenefits(p)}
          
          {locked && (
            <View style={styles.lockMessage}>
              <Text style={styles.lockText}>Requires achievement: {p.unlock?.achievementId}</Text>
            </View>
          )}
        </LinearGradient>
      </TouchableOpacity>
    );
  };

  const getRarityColor = (rarity: string) => {
    switch (rarity.toLowerCase()) {
      case 'common': return '#6B7280';
      case 'uncommon': return '#10B981';
      case 'rare': return '#3B82F6';
      case 'epic': return '#8B5CF6';
      case 'legendary': return '#F59E0B';
      default: return '#6B7280';
    }
  };

  const disabled = selected.length > 2;

  return (
    <ImageBackground
      source={require('@/assets/images/background.png')}
      style={styles.bg}
      resizeMode="cover"
    >
      <View style={styles.overlay}>
        <View style={styles.header}>
          <Text style={styles.title}>Select Perks</Text>
          <Text style={styles.subtitle}>Choose up to 2 perks to start your journey</Text>
        </View>
        
        <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
          <View style={styles.perksContainer}>
            {perks.map(renderPerk)}
          </View>
        </ScrollView>
        
        <View style={styles.footer}>
          <TouchableOpacity
            style={styles.startButton}
            disabled={disabled}
            onPress={start}
          >
            <LinearGradient
              colors={disabled ? ['#6B7280', '#4B5563'] : ['#10B981', '#059669']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.startButtonGradient}
            >
              <Text style={styles.startText}>
                {disabled ? 'Too Many Perks Selected' : 'Start Your Life'}
              </Text>
            </LinearGradient>
          </TouchableOpacity>
        </View>
      </View>
    </ImageBackground>
  );
}

const styles = StyleSheet.create({
  bg: { 
    flex: 1, 
    width: '100%', 
    height: '100%' 
  },
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.4)',
  },
  header: {
    paddingHorizontal: 20,
    paddingTop: 60,
    paddingBottom: 20,
    alignItems: 'center',
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#FFFFFF',
    textShadowColor: 'rgba(0, 0, 0, 0.5)',
    textShadowOffset: { width: 1, height: 1 },
    textShadowRadius: 3,
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: '#E5E7EB',
    textAlign: 'center',
    textShadowColor: 'rgba(0, 0, 0, 0.5)',
    textShadowOffset: { width: 1, height: 1 },
    textShadowRadius: 2,
  },
  container: {
    flex: 1,
    paddingHorizontal: 20,
  },
  perksContainer: {
    gap: 16,
    paddingBottom: 20,
  },
  perkContainer: {
    borderRadius: 16,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  perkCard: {
    padding: 20,
  },
  perkHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 16,
  },
  iconContainer: {
    width: 60,
    height: 60,
    borderRadius: 12,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  perkIcon: {
    width: 40,
    height: 40,
    borderRadius: 8,
  },
  perkInfo: {
    flex: 1,
  },
  perkTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  perkTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#FFFFFF',
    flex: 1,
  },
  rarityBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    marginLeft: 8,
  },
  rarityText: {
    fontSize: 10,
    fontWeight: 'bold',
    color: '#FFFFFF',
  },
  perkDesc: {
    fontSize: 14,
    color: '#D1D5DB',
    lineHeight: 20,
  },
  perkActions: {
    marginLeft: 12,
  },
  lockContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(156, 163, 175, 0.2)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  selectedContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(59, 130, 246, 0.3)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  selectContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(107, 114, 128, 0.2)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  benefitsContainer: {
    marginTop: 8,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.1)',
  },
  benefitsTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#F59E0B',
    marginBottom: 8,
  },
  benefitsList: {
    gap: 8,
  },
  benefitItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  benefitIcon: {
    width: 24,
    height: 24,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  benefitText: {
    fontSize: 13,
    color: '#E5E7EB',
    fontWeight: '500',
  },
  lockMessage: {
    marginTop: 16,
    padding: 12,
    backgroundColor: 'rgba(156, 163, 175, 0.1)',
    borderRadius: 8,
    borderLeftWidth: 3,
    borderLeftColor: '#9CA3AF',
  },
  lockText: {
    fontSize: 12,
    color: '#9CA3AF',
    fontStyle: 'italic',
  },
  footer: {
    paddingHorizontal: 20,
    paddingBottom: 40,
  },
  startButton: {
    borderRadius: 12,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  startButtonGradient: {
    paddingVertical: 16,
    alignItems: 'center',
  },
  startText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#FFFFFF',
  },
});
