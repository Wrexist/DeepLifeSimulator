import React from 'react';
import { Text, TouchableOpacity, StyleSheet, ScrollView, Image, ImageBackground, View, Dimensions } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { scenarios } from '@/src/features/onboarding/scenarioData';
import { useOnboarding } from '@/src/features/onboarding/OnboardingContext';
import { useRouter } from 'expo-router';
import { ArrowLeft, Star } from 'lucide-react-native';

const { width: screenWidth } = Dimensions.get('window');

export default function Scenarios() {
  const { setState } = useOnboarding();
  const router = useRouter();

  const choose = (id: string) => {
    const scenario = scenarios.find(s => s.id === id);
    setState(prev => ({ ...prev, scenario }));
    router.push('/(onboarding)/Customize');
  };

  return (
    <ImageBackground
      source={require('@/assets/images/background.png')}
      style={styles.bg}
      resizeMode="cover"
    >
      <View style={styles.overlay}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
            <LinearGradient
              colors={['#374151', '#1F2937']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.backButtonGradient}
            >
              <ArrowLeft size={24} color="#FFFFFF" />
            </LinearGradient>
          </TouchableOpacity>
          <Text style={styles.title}>Choose Your Life Scenario</Text>
          <View style={styles.placeholder} />
        </View>
        
        <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
          <View style={styles.scenariosContainer}>
            {scenarios.map((s, index) => (
              <TouchableOpacity key={s.id} style={styles.cardContainer} onPress={() => choose(s.id)}>
                <LinearGradient
                  colors={['#1F2937', '#111827']}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={styles.card}
                >
                  <View style={styles.cardHeader}>
                    <View style={styles.iconContainer}>
                      <Image source={s.icon} style={styles.icon} />
                    </View>
                    <View style={styles.bonusBadge}>
                      <Star size={16} color="#FBBF24" />
                      <Text style={styles.bonusText}>Bonus</Text>
                    </View>
                  </View>
                  
                  <View style={styles.cardContent}>
                    <Text style={styles.cardTitle}>{s.title}</Text>
                    <Text style={styles.description}>{s.description}</Text>
                    <View style={styles.bonusContainer}>
                      <Text style={styles.bonusLabel}>Starting Bonus:</Text>
                      <Text style={styles.bonusValue}>{s.bonus}</Text>
                    </View>
                  </View>
                  
                  <View style={styles.cardFooter}>
                    <LinearGradient
                      colors={['#3B82F6', '#1D4ED8']}
                      start={{ x: 0, y: 0 }}
                      end={{ x: 1, y: 1 }}
                      style={styles.selectButton}
                    >
                      <Text style={styles.selectButtonText}>Select Scenario</Text>
                    </LinearGradient>
                  </View>
                </LinearGradient>
              </TouchableOpacity>
            ))}
          </View>
        </ScrollView>
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
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 60,
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
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#FFFFFF',
    textShadowColor: 'rgba(0, 0, 0, 0.5)',
    textShadowOffset: { width: 1, height: 1 },
    textShadowRadius: 2,
  },
  placeholder: {
    width: 48,
  },
  container: {
    flex: 1,
  },
  scenariosContainer: {
    paddingHorizontal: 20,
    paddingBottom: 40,
  },
  cardContainer: {
    marginBottom: 16,
    borderRadius: 16,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  card: {
    padding: 20,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 16,
  },
  iconContainer: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: 'rgba(59, 130, 246, 0.2)',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#3B82F6',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  icon: {
    width: 48,
    height: 48,
    borderRadius: 24,
  },
  bonusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(251, 191, 36, 0.2)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    gap: 4,
  },
  bonusText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#FBBF24',
  },
  cardContent: {
    marginBottom: 20,
  },
  cardTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#FFFFFF',
    marginBottom: 8,
  },
  description: {
    fontSize: 14,
    color: '#D1D5DB',
    lineHeight: 20,
    marginBottom: 12,
  },
  bonusContainer: {
    backgroundColor: 'rgba(16, 185, 129, 0.1)',
    padding: 12,
    borderRadius: 8,
    borderLeftWidth: 3,
    borderLeftColor: '#10B981',
  },
  bonusLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#10B981',
    marginBottom: 4,
  },
  bonusValue: {
    fontSize: 14,
    color: '#FFFFFF',
    fontStyle: 'italic',
  },
  cardFooter: {
    alignItems: 'center',
  },
  selectButton: {
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
    minWidth: 160,
    alignItems: 'center',
  },
  selectButtonText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#FFFFFF',
  },
});
