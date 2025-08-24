import React, { useEffect, useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView, Image, ImageBackground, Dimensions } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useGame } from '@/contexts/GameContext';
import { useOnboarding } from '@/src/features/onboarding/OnboardingContext';
import { scenarios } from '@/src/features/onboarding/scenarioData';
import ConfirmDialog from '@/components/ConfirmDialog';
import { ArrowLeft, Play, Plus, Trash2, Lock } from 'lucide-react-native';

const { width: screenWidth } = Dimensions.get('window');

interface SlotData {
  firstName?: string;
  lastName?: string;
  age?: number;
  netWorth?: number;
  scenario?: string;
  sex?: string;
}

export default function SaveSlots() {
  const router = useRouter();
  const { gameState, loadGame } = useGame();
  const { setState } = useOnboarding();
  const [slots, setSlots] = useState<Record<number, SlotData>>({});
  const hasHighAchiever = gameState.progress?.achievements?.some((a: any) => a.id === 'high_achiever');

  useEffect(() => {
    (async () => {
      try {
        const loaded: Record<number, SlotData> = {};
        for (let i = 1; i <= 5; i++) {
          const raw = await AsyncStorage.getItem(`save_slot_${i}`);
          if (raw) {
            const parsed = JSON.parse(raw);
            loaded[i] = {
              firstName: parsed.userProfile?.firstName,
              lastName: parsed.userProfile?.lastName,
              age: parsed.date?.age,
              netWorth: parsed.stats?.money,
              scenario: parsed.scenarioId,
              sex: parsed.userProfile?.sex,
            };
          }
        }
        setSlots(loaded);
      } catch (error) {
        console.error('Error loading save slots:', error);
      }
    })();
  }, []);

  const startNew = (slot: number) => {
    setState(prev => ({ ...prev, slot, scenario: undefined, perks: [], firstName: '', lastName: '' }));
    router.push('/(onboarding)/Scenarios');
  };

  const continueSlot = async (slot: number) => {
    await loadGame(slot);
    router.replace('/(tabs)');
  };

  const deleteSlot = async (slot: number) => {
    try {
      await AsyncStorage.removeItem(`save_slot_${slot}`);
      const last = await AsyncStorage.getItem('lastSlot');
      if (last === String(slot)) {
        await AsyncStorage.removeItem('lastSlot');
      }
      setSlots(prev => {
        const updated = { ...prev };
        delete updated[slot];
        return updated;
      });
    } catch (error) {
      console.error('Error deleting save slot:', error);
    }
  };

  const [slotToDelete, setSlotToDelete] = useState<number | null>(null);
  const confirmDeleteSlot = (slot: number) => {
    setSlotToDelete(slot);
  };

  const handleBackPress = () => {
    // Always go back to main menu to avoid navigation issues
    router.replace('/(onboarding)/MainMenu');
  };

  const renderSlot = (slot: number) => {
    const data = slots[slot];
    let locked = false;
    let lockReason = '';
    if (slot === 2 && !hasHighAchiever) {
      locked = true;
      lockReason = 'Unlock achievement: high_achiever';
    }
    if (slot > 2) {
      locked = true;
      lockReason = 'Purchase to unlock';
    }
    const scenarioInfo = scenarios.find(s => s.id === data?.scenario);
    const faceIcon = data?.age && data.sex
      ? data.age < 13
        ? require('@/assets/images/Face/Baby.png')
        : data.age >= 60
          ? data.sex === 'male'
            ? require('@/assets/images/Face/Old_Male.png')
            : require('@/assets/images/Face/Old_Female.png')
          : data.sex === 'male'
            ? require('@/assets/images/Face/Male.png')
            : require('@/assets/images/Face/Female.png')
      : require('@/assets/images/Face/Baby.png');

    if (locked) {
      return (
        <View key={slot} style={styles.slotContainer}>
          <LinearGradient
            colors={['#374151', '#1F2937']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.slotCard}
          >
            <View style={styles.slotHeader}>
              <Text style={styles.slotNumber}>Slot {slot}</Text>
              <View style={styles.lockIconContainer}>
                <Lock size={20} color="#9CA3AF" />
              </View>
            </View>
            <View style={styles.lockContent}>
              <Text style={styles.lockText}>{lockReason}</Text>
            </View>
          </LinearGradient>
        </View>
      );
    }

    return (
      <View key={slot} style={styles.slotContainer}>
        <LinearGradient
          colors={data ? ['#1F2937', '#111827'] : ['#3B82F6', '#1D4ED8']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.slotCard}
        >
          <View style={styles.slotHeader}>
            <Text style={styles.slotNumber}>Slot {slot}</Text>
            {data && (
              <View style={styles.statusBadge}>
                <Text style={styles.statusText}>Active</Text>
              </View>
            )}
          </View>
          
          {data ? (
            <View style={styles.slotContent}>
              <View style={styles.avatarContainer}>
                <Image source={faceIcon} style={styles.avatar} />
              </View>
              <View style={styles.infoContainer}>
                <Text style={styles.characterName}>{data.firstName} {data.lastName}</Text>
                <Text style={styles.characterStats}>{`${Math.floor(data.age ?? 0)} years old`}</Text>
                <Text style={styles.characterStats}>{`$${data.netWorth?.toLocaleString()}`}</Text>
                <Text style={styles.scenarioName}>{scenarioInfo?.title}</Text>
              </View>
              <View style={styles.actionButtons}>
                <TouchableOpacity onPress={() => continueSlot(slot)} style={styles.actionButton}>
                  <LinearGradient
                    colors={['#10B981', '#059669']}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                    style={styles.buttonGradient}
                  >
                    <Play size={16} color="#FFFFFF" />
                    <Text style={styles.buttonText}>Continue</Text>
                  </LinearGradient>
                </TouchableOpacity>
                <TouchableOpacity onPress={() => startNew(slot)} style={styles.actionButton}>
                  <LinearGradient
                    colors={['#F59E0B', '#D97706']}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                    style={styles.buttonGradient}
                  >
                    <Plus size={16} color="#FFFFFF" />
                    <Text style={styles.buttonText}>New Life</Text>
                  </LinearGradient>
                </TouchableOpacity>
                <TouchableOpacity onPress={() => confirmDeleteSlot(slot)} style={styles.actionButton}>
                  <LinearGradient
                    colors={['#EF4444', '#DC2626']}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                    style={styles.buttonGradient}
                  >
                    <Trash2 size={16} color="#FFFFFF" />
                    <Text style={styles.buttonText}>Delete</Text>
                  </LinearGradient>
                </TouchableOpacity>
              </View>
            </View>
          ) : (
            <TouchableOpacity onPress={() => startNew(slot)} style={styles.emptySlot}>
              <View style={styles.emptyContent}>
                <Plus size={48} color="#FFFFFF" />
                <Text style={styles.emptyText}>Start New Life</Text>
                <Text style={styles.emptySubtext}>Create a new character</Text>
              </View>
            </TouchableOpacity>
          )}
        </LinearGradient>
      </View>
    );
  };

  return (
    <ImageBackground
      source={require('@/assets/images/background.png')}
      style={styles.bg}
      resizeMode="cover"
    >
      <View style={styles.overlay}>
        <View style={styles.header}>
          <TouchableOpacity onPress={handleBackPress} style={styles.backButton}>
            <LinearGradient
              colors={['#374151', '#1F2937']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.backButtonGradient}
            >
              <ArrowLeft size={24} color="#FFFFFF" />
            </LinearGradient>
          </TouchableOpacity>
          <Text style={styles.title}>Save Slots</Text>
          <View style={styles.placeholder} />
        </View>
        
        <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
          <View style={styles.slotsContainer}>
            {[1, 2, 3, 4, 5].map(renderSlot)}
          </View>
        </ScrollView>
      </View>
      
      <ConfirmDialog
        visible={slotToDelete !== null}
        title="Delete Save Slot"
        message="Are you sure you want to delete this save? This action cannot be undone."
        onCancel={() => setSlotToDelete(null)}
        onConfirm={() => {
          if (slotToDelete !== null) {
            deleteSlot(slotToDelete);
          }
          setSlotToDelete(null);
        }}
        confirmText="Delete"
        cancelText="Cancel"
      />
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
  slotsContainer: {
    paddingHorizontal: 20,
    paddingBottom: 40,
  },
  slotContainer: {
    marginBottom: 16,
    borderRadius: 16,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  slotCard: {
    padding: 20,
  },
  slotHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  slotNumber: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#FFFFFF',
  },
  lockIconContainer: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(156, 163, 175, 0.2)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  statusBadge: {
    backgroundColor: '#10B981',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  statusText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  lockContent: {
    alignItems: 'center',
    paddingVertical: 20,
  },
  lockText: {
    fontSize: 14,
    color: '#9CA3AF',
    textAlign: 'center',
  },
  slotContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  avatarContainer: {
    marginRight: 16,
  },
  avatar: {
    width: 60,
    height: 60,
    borderRadius: 30,
  },
  infoContainer: {
    flex: 1,
  },
  characterName: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#FFFFFF',
    marginBottom: 4,
  },
  characterStats: {
    fontSize: 14,
    color: '#D1D5DB',
    marginBottom: 2,
  },
  scenarioName: {
    fontSize: 12,
    color: '#9CA3AF',
    fontStyle: 'italic',
  },
  actionButtons: {
    gap: 8,
  },
  actionButton: {
    borderRadius: 8,
    overflow: 'hidden',
  },
  buttonGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    gap: 6,
  },
  buttonText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  emptySlot: {
    alignItems: 'center',
    paddingVertical: 40,
  },
  emptyContent: {
    alignItems: 'center',
  },
  emptyText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#FFFFFF',
    marginTop: 12,
    marginBottom: 4,
  },
  emptySubtext: {
    fontSize: 14,
    color: '#D1D5DB',
  },
});

