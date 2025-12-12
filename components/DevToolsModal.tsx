import React, { useState, useEffect, useRef } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Modal, ScrollView, Alert, TextInput, Switch } from 'react-native';
import { BlurView } from 'expo-blur';
import { useGame } from '@/contexts/GameContext';
import { X, DollarSign, Heart, Zap, Clock, Shield, Briefcase, Gift, Skull, Database, RefreshCw, Save, FileText, Package, Users, Building2, GraduationCap, CreditCard, Star, Award, Bug } from 'lucide-react-native';
import { responsivePadding, responsiveFontSize, responsiveSpacing, responsiveBorderRadius, scale } from '@/utils/scaling';
import { LinearGradient } from 'expo-linear-gradient';
import AsyncStorage from '@react-native-async-storage/async-storage';
import LogViewer from '@/components/dev/LogViewer';
import AIDebugMenu from '@/components/debug/AIDebugMenu';

interface DevToolsModalProps {
  visible: boolean;
  onClose: () => void;
}

export default function DevToolsModal({ visible, onClose }: DevToolsModalProps) {
  const { gameState, setGameState, nextWeek, saveGame, restartGame } = useGame();
  const [customMoney, setCustomMoney] = useState('');
  const [preventDrain, setPreventDrain] = useState(false);
  const [showLogViewer, setShowLogViewer] = useState(false);
  const [showAIDebug, setShowAIDebug] = useState(false);
  
  // Target week for time travel loop
  const [targetWeek, setTargetWeek] = useState<number | null>(null);
  const initialStatsRef = useRef<any>(null);
  const isProcessingRef = useRef(false);

  // Add null check for gameState
  if (!gameState) {
    return null;
  }

  // Main Game Loop for Time Travel
  useEffect(() => {
    if (targetWeek === null || !gameState) return;

    // Stop conditions
    if (gameState.week >= targetWeek) {
      setTargetWeek(null);
      isProcessingRef.current = false;
      Alert.alert('Time Travel', 'Travel complete.');
      return;
    }

    if (gameState.date?.age >= 100) {
        setTargetWeek(null);
        isProcessingRef.current = false;
        Alert.alert('Stopped', 'Reached age 100.');
        return;
    }

    if (gameState.showDeathPopup) {
        setTargetWeek(null);
        isProcessingRef.current = false;
        return;
    }

    // Function to execute one step
    const step = async () => {
        if (isProcessingRef.current) return; // Prevent overlaps
        isProcessingRef.current = true;

        // 1. Restore Stats (God Mode) BEFORE advancing
        // This ensures we start the week with full health/energy so we don't die from the drain calculation
        if (preventDrain && initialStatsRef.current) {
            // We need to cheat a bit and update the state immediately for the nextWeek call if possible,
            // but since nextWeek uses closure state, we have to rely on the cycle.
            // However, if we update stats here, we trigger a render.
            // So we apply the fix to the PREVIOUS state result effectively.
            
            setGameState(prev => ({
                ...prev,
                stats: {
                    ...prev.stats,
                    health: initialStatsRef.current.health,
                    happiness: initialStatsRef.current.happiness,
                    energy: initialStatsRef.current.energy,
                    fitness: initialStatsRef.current.fitness
                }
            }));
            
            // Small delay to let state flush if needed, though in React Native batching might hide it.
            // We rely on the fact that the NEXT render triggers the effect again.
        }

        // 2. Advance Week
        // We use a timeout to break the stack and allow UI/State to settle
        nextWeek();
        isProcessingRef.current = false;
    };

    // Use a timeout to break the stack and allow UI/State to settle
    const timeoutId = setTimeout(() => {
        step();
    }, 10);
    
    // Cleanup timeout on unmount or when effect re-runs
    return () => {
        clearTimeout(timeoutId);
        isProcessingRef.current = false;
    };

  }, [gameState.week, targetWeek, preventDrain, nextWeek, setGameState]); // Re-run whenever week changes or target changes

  const updateStats = (updates: Partial<typeof gameState.stats>) => {
    setGameState(prev => ({
      ...prev,
      stats: {
        ...prev.stats,
        ...updates,
      },
    }));
    saveGame();
    Alert.alert('Success', 'Stats updated');
  };

  const addMoney = (amount: number) => {
    if (!gameState?.stats) return;
    updateStats({ money: (gameState.stats.money || 0) + amount });
  };

  const addGems = (amount: number) => {
    if (!gameState?.stats) return;
    updateStats({ gems: (gameState.stats.gems || 0) + amount });
  };

  const maxStats = () => {
    updateStats({
      health: 100,
      happiness: 100,
      energy: 100,
      fitness: 100,
    });
  };

  const startSkipping = (weeksToSkip: number) => {
    if (targetWeek !== null) return; // Already skipping

    // Capture stats for God Mode
    if (preventDrain && gameState?.stats) {
        initialStatsRef.current = { 
            health: Math.max(100, gameState.stats.health || 100), // Force max if starting god mode
            happiness: Math.max(100, gameState.stats.happiness || 100),
            energy: Math.max(100, gameState.stats.energy || 100),
            fitness: Math.max(100, gameState.stats.fitness || 100)
        };
        // Apply max immediately so we start strong
        setGameState(prev => ({
            ...prev,
            stats: {
                ...prev.stats,
                ...initialStatsRef.current
            }
        }));
    } else {
        initialStatsRef.current = null;
    }
    
    // Calculate target absolute week number
    // Note: gameState.week is cyclic (1-48 or 1-52 usually, but looks like it might be absolute in some contexts?)
    // GameContext seems to treat date.week as 1-4 and increments weeksLived.
    // Using weeksLived is safer for absolute targeting.
    if (!gameState) return;
    const currentTotal = gameState.weeksLived || 0;
    const target = currentTotal + weeksToSkip;
    
    // We'll use a hack: setTargetWeek to the 'weeksLived' target
    // But wait, the effect depends on gameState.week? No, gameState.week cycles 1-4.
    // Let's change the dependency to weeksLived or just use a counter.
    // Actually, let's change the effect to depend on `gameState.weeksLived`.
    
    setTargetWeek(target);
  };
  
  // Override the effect logic slightly to use weeksLived for robust tracking
  useEffect(() => {
    if (targetWeek === null || !gameState) return;

    const currentTotal = gameState.weeksLived || 0;

    if (currentTotal >= targetWeek) {
      setTargetWeek(null);
      isProcessingRef.current = false;
      Alert.alert('Time Travel', `Travelled ${targetWeek - (targetWeek - 20)} weeks.`); // Approximate message
      return;
    }
    
    // ... rest of stop conditions ...
    if ((gameState.date?.age || 0) >= 100 || gameState.showDeathPopup) {
        setTargetWeek(null);
        isProcessingRef.current = false;
        return;
    }

    const step = () => {
        if (isProcessingRef.current) return;
        isProcessingRef.current = true;

        if (preventDrain && initialStatsRef.current) {
             setGameState(prev => ({
                ...prev,
                stats: {
                    ...prev.stats,
                    ...initialStatsRef.current
                }
            }));
        }

        setTimeout(() => {
            nextWeek();
            isProcessingRef.current = false;
        }, 50);
    };

    step();

  }, [gameState.weeksLived, targetWeek, preventDrain]);


  const setAge = (age: number) => {
    setGameState(prev => {
      // Calculate birth year from current age and year
      const currentAge = prev.date.age;
      const currentYear = prev.date.year;
      const birthYear = currentYear - Math.floor(currentAge);
      
      // Calculate new year based on birth year and new age
      const newYear = birthYear + Math.floor(age);
      
      return {
        ...prev,
        date: {
          ...prev.date,
          age: age,
          year: Math.max(2025, newYear), // Ensure year doesn't go below 2025
        },
      };
    });
    Alert.alert('Age Set', `Age set to ${age}`);
  };

  const triggerDeath = () => {
    setGameState(prev => ({
      ...prev,
      stats: { ...prev.stats, health: 0 },
      showDeathPopup: true,
      deathReason: 'health',
    }));
    onClose();
  };

  const clearStorage = async () => {
     Alert.alert(
      'Clear Storage',
      'This will wipe all local data including saves. Are you sure?',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Wipe', onPress: async () => {
            await AsyncStorage.clear();
            restartGame();
        }}
      ]
    );
  };

  const unlockAllItems = () => {
    const commonItemIds = ['smartphone', 'computer', 'bike', 'car', 'guitar', 'gym_membership', 'netflix', 'spotify', 'gloves', 'usb', 'lockpick', 'slim_jim', 'drug_supply', 'suit', 'basic_bed'];
    setGameState(prev => ({
      ...prev,
      items: (prev.items || []).map(item => 
        commonItemIds.includes(item.id) 
          ? { ...item, owned: true }
          : item
      ),
    }));
    Alert.alert('Success', 'All common items unlocked!');
    saveGame();
  };

  const maxRelationships = () => {
    setGameState(prev => ({
      ...prev,
      relationships: (prev.relationships || []).map(rel => ({
        ...rel,
        affection: 100,
        trust: 100,
        respect: 100,
      })),
    }));
    Alert.alert('Success', 'All relationships maxed!');
    saveGame();
  };

  const createTestCompany = () => {
    // Add money for company creation
    Alert.alert('Info', 'Added $1M for company creation. Use the Company App to create companies.');
    addMoney(1000000);
  };

  const unlockAllCareers = () => {
    setGameState(prev => ({
      ...prev,
      careers: (prev.careers || []).map(career => ({
        ...career,
        applied: true,
        accepted: true,
        level: Math.max(0, (career.levels?.length || 1) - 1),
        progress: 100,
      })),
    }));
    Alert.alert('Success', 'All careers unlocked and maxed!');
    saveGame();
  };

  const addEducation = () => {
    setGameState(prev => {
      const existingIds = new Set((prev.education || []).map(e => e.id));
      const newEducation = [
        { id: 'highSchool', name: 'High School', completed: true },
        { id: 'university', name: 'University', completed: true },
        { id: 'masters', name: 'Masters Degree', completed: true },
        { id: 'phd', name: 'PhD', completed: true },
      ].filter(e => !existingIds.has(e.id));
      
      return {
        ...prev,
        education: [...(prev.education || []), ...newEducation],
      };
    });
    Alert.alert('Success', 'All education levels added!');
    saveGame();
  };

  const setBankSavings = (amount: number) => {
    setGameState(prev => ({
      ...prev,
      bankSavings: amount,
    }));
    Alert.alert('Success', `Bank savings set to $${amount.toLocaleString()}`);
  };

  const unlockAllAchievements = () => {
    setGameState(prev => {
      const existingIds = new Set((prev.progress?.achievements || []).map(a => a.id));
      const newAchievements = [
        { id: 'first_million', name: 'First Million', desc: 'Reach a net worth of $1,000,000.', unlockedAt: prev.week },
        { id: 'debt_free', name: 'Debt Free', desc: 'Have no outstanding debts.', unlockedAt: prev.week },
        { id: 'healthy_lifestyle', name: 'Healthy Lifestyle', desc: 'Maintain 90+ health for 10 consecutive weeks.', unlockedAt: prev.week },
        { id: 'social_star', name: 'Social Star', desc: 'Maintain 10 relationships with affection over 70.', unlockedAt: prev.week },
      ].filter(a => !existingIds.has(a.id));
      
      return {
        ...prev,
        progress: {
          ...prev.progress,
          achievements: [...(prev.progress?.achievements || []), ...newAchievements],
        },
      };
    });
    Alert.alert('Success', 'All basic achievements unlocked!');
    saveGame();
  };

  const maxReputation = () => {
    updateStats({ reputation: 100 });
  };

  const addCustomGems = () => {
    const amount = parseInt(customMoney);
    if (!isNaN(amount)) {
      addGems(amount);
      setCustomMoney('');
    }
  };

  const tools = [
    {
      category: 'Resources',
      items: [
        { label: '+ $1M', icon: DollarSign, action: () => addMoney(1000000), color: ['#10B981', '#059669'] },
        { label: '+ $1B', icon: DollarSign, action: () => addMoney(1000000000), color: ['#10B981', '#059669'] },
        { label: '+ $1T', icon: DollarSign, action: () => addMoney(1000000000000), color: ['#10B981', '#059669'] },
        { label: '+ 100 Gems', icon: Gift, action: () => addGems(100), color: ['#8B5CF6', '#7C3AED'] },
        { label: '+ 1000 Gems', icon: Gift, action: () => addGems(1000), color: ['#8B5CF6', '#7C3AED'] },
        { label: 'Bank $1B', icon: CreditCard, action: () => setBankSavings(1000000000), color: ['#10B981', '#059669'] },
      ]
    },
    {
      category: 'Stats',
      items: [
        { label: 'Max Stats', icon: Heart, action: maxStats, color: ['#EF4444', '#DC2626'] },
        { label: 'Max Reputation', icon: Star, action: maxReputation, color: ['#F59E0B', '#D97706'] },
        { label: 'Zero Health', icon: Skull, action: () => updateStats({ health: 0 }), color: ['#EF4444', '#DC2626'] },
        { label: 'Zero Happiness', icon: Skull, action: () => updateStats({ happiness: 0 }), color: ['#F59E0B', '#D97706'] },
        { label: 'Zero Energy', icon: Zap, action: () => updateStats({ energy: 0 }), color: ['#F59E0B', '#D97706'] },
      ]
    },
    {
      category: 'Items & Unlocks',
      items: [
        { label: 'Unlock All Items', icon: Package, action: unlockAllItems, color: ['#6366F6', '#4F46E5'] },
        { label: 'Max Relationships', icon: Users, action: maxRelationships, color: ['#EC4899', '#DB2777'] },
        { label: 'Unlock All Careers', icon: Briefcase, action: unlockAllCareers, color: ['#8B5CF6', '#7C3AED'] },
        { label: 'Add All Education', icon: GraduationCap, action: addEducation, color: ['#10B981', '#059669'] },
        { label: 'Unlock Achievements', icon: Award, action: unlockAllAchievements, color: ['#F59E0B', '#D97706'] },
        { label: 'Company Money', icon: Building2, action: createTestCompany, color: ['#3B82F6', '#1D4ED8'] },
      ]
    },
    {
      category: 'Time & Life',
      items: [
        { label: '+ 20 Weeks', icon: Clock, action: () => startSkipping(20), color: ['#3B82F6', '#1D4ED8'] },
        { label: '+ 1 Year', icon: Clock, action: () => startSkipping(52), color: ['#3B82F6', '#1D4ED8'] },
        { label: 'Set Age 18', icon: Clock, action: () => setAge(18), color: ['#3B82F6', '#1D4ED8'] },
        { label: 'Set Age 50', icon: Clock, action: () => setAge(50), color: ['#3B82F6', '#1D4ED8'] },
        { label: 'Set Age 90', icon: Clock, action: () => setAge(90), color: ['#3B82F6', '#1D4ED8'] },
        { label: 'Trigger Death', icon: Skull, action: triggerDeath, color: ['#1F2937', '#000000'] },
      ]
    },
    {
      category: 'System',
      items: [
        { label: 'Save Game', icon: Save, action: saveGame, color: ['#6366F1', '#4F46E5'] },
        { label: 'Clear Storage', icon: Database, action: clearStorage, color: ['#9CA3AF', '#4B5563'] },
        { label: 'Restart Game', icon: RefreshCw, action: restartGame, color: ['#EF4444', '#B91C1C'] },
        { label: 'View Logs', icon: FileText, action: () => setShowLogViewer(true), color: ['#4B5563', '#374151'] },
        { label: 'AI Debug Suite', icon: Bug, action: () => setShowAIDebug(true), color: ['#818CF8', '#6366F1'] },
      ]
    }
  ];

  return (
    <Modal
      visible={visible}
      transparent={true}
      animationType="slide"
      onRequestClose={onClose}
    >
      <BlurView intensity={20} style={styles.overlay}>
        <View style={styles.modal}>
          <View style={styles.header}>
            <View style={styles.titleContainer}>
               <Shield size={24} color="#4F46E5" />
               <Text style={styles.title}>Developer Tools</Text>
            </View>
            <TouchableOpacity onPress={onClose} style={styles.closeButton}>
              <X size={24} color="#6B7280" />
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
            
            {/* Custom Money Input */}
            <View style={styles.section}>
                <Text style={styles.sectionTitle}>Custom Amount</Text>
                <View style={styles.inputRow}>
                    <TextInput 
                        style={styles.input} 
                        placeholder="Amount" 
                        keyboardType="numeric"
                        value={customMoney}
                        onChangeText={setCustomMoney}
                    />
                    <TouchableOpacity 
                        style={styles.addButton}
                        onPress={() => {
                            const amount = parseInt(customMoney);
                            if (!isNaN(amount)) {
                                addMoney(amount);
                                setCustomMoney('');
                            }
                        }}
                    >
                        <Text style={styles.addButtonText}>Add Money</Text>
                    </TouchableOpacity>
                </View>
                <View style={[styles.inputRow, { marginTop: 8 }]}>
                    <TouchableOpacity 
                        style={[styles.addButton, { flex: 1, backgroundColor: '#8B5CF6' }]}
                        onPress={addCustomGems}
                    >
                        <Text style={styles.addButtonText}>Add Gems</Text>
                    </TouchableOpacity>
                </View>
            </View>

            {/* Prevent Drain Toggle */}
            <View style={styles.toggleSection}>
                <View style={styles.toggleRow}>
                    <Text style={styles.toggleLabel}>Prevent Stat Drain (God Mode)</Text>
                    <Switch
                        value={preventDrain}
                        onValueChange={setPreventDrain}
                        trackColor={{ false: '#E5E7EB', true: '#10B981' }}
                        thumbColor={preventDrain ? '#FFFFFF' : '#F3F4F6'}
                    />
                </View>
                <Text style={styles.toggleDesc}>
                    When enabled, health, happiness, and energy won't decrease when using time travel skips.
                </Text>
            </View>

            {tools.map((section, index) => (
              <View key={index} style={styles.section}>
                <Text style={styles.sectionTitle}>{section.category}</Text>
                <View style={styles.grid}>
                  {section.items.map((item, idx) => (
                    <TouchableOpacity
                      key={idx}
                      style={styles.toolButton}
                      onPress={item.action}
                      disabled={targetWeek !== null}
                    >
                      <LinearGradient
                        colors={targetWeek !== null ? ['#D1D5DB', '#9CA3AF'] : item.color}
                        style={styles.buttonGradient}
                        start={{ x: 0, y: 0 }}
                        end={{ x: 1, y: 1 }}
                      >
                        <item.icon size={20} color="#FFFFFF" style={styles.buttonIcon} />
                        <Text style={styles.buttonText}>
                            {targetWeek !== null && section.category === 'Time & Life' && item.label.includes('Time') 
                                ? 'Skipping...' 
                                : item.label}
                        </Text>
                      </LinearGradient>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>
            ))}
            
            <View style={styles.footer}>
                <Text style={styles.footerText}>
                    GameState Version: {gameState?.version || 'N/A'} | Lineage: {gameState?.lineageId ? gameState.lineageId.substring(0, 8) : 'N/A'}...
                </Text>
            </View>

          </ScrollView>
        </View>
      </BlurView>
      
      <LogViewer visible={showLogViewer} onClose={() => setShowLogViewer(false)} />
      <AIDebugMenu visible={showAIDebug} onClose={() => setShowAIDebug(false)} />
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: responsivePadding.large,
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  modal: {
    backgroundColor: '#FFFFFF',
    borderRadius: responsiveBorderRadius.xl,
    width: '100%',
    maxHeight: '90%',
    maxWidth: scale(500),
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.25,
    shadowRadius: 20,
    elevation: 10,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: responsivePadding.large,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
    backgroundColor: '#F9FAFB',
  },
  titleContainer: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
  },
  title: {
    fontSize: responsiveFontSize.lg,
    fontWeight: 'bold',
    color: '#1F2937',
  },
  closeButton: {
    padding: 4,
  },
  content: {
    padding: responsivePadding.large,
  },
  section: {
    marginBottom: responsiveSpacing.xl,
  },
  toggleSection: {
      marginBottom: responsiveSpacing.xl,
      backgroundColor: '#F3F4F6',
      padding: responsiveSpacing.md,
      borderRadius: responsiveBorderRadius.md,
  },
  toggleRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: 4,
  },
  toggleLabel: {
      fontSize: responsiveFontSize.base,
      fontWeight: '600',
      color: '#1F2937',
  },
  toggleDesc: {
      fontSize: responsiveFontSize.xs,
      color: '#6B7280',
  },
  sectionTitle: {
    fontSize: responsiveFontSize.base,
    fontWeight: '600',
    color: '#4B5563',
    marginBottom: responsiveSpacing.md,
    marginLeft: responsiveSpacing.xs,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: responsiveSpacing.sm,
  },
  toolButton: {
    width: '48%',
    marginBottom: responsiveSpacing.sm,
    borderRadius: responsiveBorderRadius.md,
    overflow: 'hidden',
  },
  buttonGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: responsiveSpacing.md,
    paddingHorizontal: responsiveSpacing.md,
  },
  buttonIcon: {
    marginRight: responsiveSpacing.sm,
  },
  buttonText: {
    color: '#FFFFFF',
    fontSize: responsiveFontSize.sm,
    fontWeight: '600',
  },
  inputRow: {
      flexDirection: 'row',
      gap: 10,
  },
  input: {
      flex: 1,
      borderWidth: 1,
      borderColor: '#D1D5DB',
      borderRadius: responsiveBorderRadius.md,
      padding: 10,
      backgroundColor: '#F9FAFB',
  },
  addButton: {
      backgroundColor: '#4F46E5',
      justifyContent: 'center',
      paddingHorizontal: 20,
      borderRadius: responsiveBorderRadius.md,
  },
  addButtonText: {
      color: 'white',
      fontWeight: '600',
  },
  footer: {
      marginTop: 20,
      marginBottom: 40,
      alignItems: 'center',
  },
  footerText: {
      color: '#9CA3AF',
      fontSize: 10,
  },
});
