import React, { useState, useEffect, useRef } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Modal, ScrollView, Alert, TextInput, Switch } from 'react-native';
import { useGame } from '@/contexts/GameContext';
import { X, DollarSign, Heart, Zap, Clock, Shield, Briefcase, Gift, Skull, Database, RefreshCw, Save, FileText, Package, Users, Building2, GraduationCap, CreditCard, Star, Award, Bug, ClipboardCheck, AlertTriangle, Activity } from 'lucide-react-native';
import { responsivePadding, responsiveFontSize, responsiveSpacing, responsiveBorderRadius, scale } from '@/utils/scaling';
import LinearGradientFallback from '@/components/fallbacks/LinearGradientFallback';
const LinearGradient = LinearGradientFallback;
import BlurViewFallback from '@/components/fallbacks/BlurViewFallback';
const BlurView = BlurViewFallback;
import AsyncStorage from '@react-native-async-storage/async-storage';
import LogViewer from '@/components/dev/LogViewer';
import AIDebugMenu from '@/components/debug/AIDebugMenu';
import TestRunner from '@/components/TestRunner';
import { generateSpecificDisease } from '@/lib/diseases/diseaseGenerator';
import { DISEASE_DEFINITIONS } from '@/lib/diseases/diseaseDefinitions';

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
  const [showTestRunner, setShowTestRunner] = useState(false);
  
  // Target week for time travel loop
  const [targetWeek, setTargetWeek] = useState<number | null>(null);
  const isProcessingRef = useRef(false);
  const godModeStatsRef = useRef<{ health: number; happiness: number; energy: number; fitness: number } | null>(null);
  const lastWeekRef = useRef<number>(0);

  // Initialize lastWeekRef when gameState is available
  useEffect(() => {
    if (gameState?.weeksLived !== undefined && lastWeekRef.current === 0) {
      lastWeekRef.current = gameState.weeksLived || 0;
    }
  }, [gameState?.weeksLived]);

  // God Mode: Restore stats after week progression
  useEffect(() => {
    if (!preventDrain || !gameState) return;
    
    // Capture stats when god mode is first enabled
    if (!godModeStatsRef.current && gameState.stats) {
      godModeStatsRef.current = {
        health: Math.max(100, gameState.stats.health || 100),
        happiness: Math.max(100, gameState.stats.happiness || 100),
        energy: Math.max(100, gameState.stats.energy || 100),
        fitness: Math.max(100, gameState.stats.fitness || 100),
      };
    }

    // Check if week has changed (normal progression or time travel)
    const currentWeek = gameState.weeksLived || 0;
    if (currentWeek !== lastWeekRef.current && godModeStatsRef.current) {
      // Week has progressed, restore stats to god mode values
      setGameState(prev => {
        if (!prev.stats || !godModeStatsRef.current) return prev;
        
        return {
          ...prev,
          stats: {
            ...prev.stats,
            health: godModeStatsRef.current.health,
            happiness: godModeStatsRef.current.happiness,
            energy: godModeStatsRef.current.energy,
            fitness: godModeStatsRef.current.fitness,
          },
        };
      });
      lastWeekRef.current = currentWeek;
    }
  }, [gameState?.weeksLived, gameState?.week, preventDrain, setGameState]);

  // Handle god mode toggle
  const handleGodModeToggle = (enabled: boolean) => {
    setPreventDrain(enabled);
    
    if (enabled && gameState?.stats) {
      // Capture current stats when enabling
      godModeStatsRef.current = {
        health: Math.max(100, gameState.stats.health || 100),
        happiness: Math.max(100, gameState.stats.happiness || 100),
        energy: Math.max(100, gameState.stats.energy || 100),
        fitness: Math.max(100, gameState.stats.fitness || 100),
      };
      
      // Immediately apply max stats
      setGameState(prev => ({
        ...prev,
        stats: {
          ...prev.stats,
          ...godModeStatsRef.current,
        },
      }));
      saveGame();
      Alert.alert('God Mode', 'Enabled! Stats will not decrease.');
    } else {
      // Clear god mode stats when disabling
      godModeStatsRef.current = null;
      Alert.alert('God Mode', 'Disabled. Stats will decrease normally.');
    }
  };

  // Main Game Loop for Time Travel
  useEffect(() => {
    if (targetWeek === null || !gameState) return;

    const currentTotal = gameState.weeksLived || 0;

    // Stop conditions
    if (currentTotal >= targetWeek) {
      setTargetWeek(null);
      isProcessingRef.current = false;
      Alert.alert('Time Travel', 'Travel complete.');
      return;
    }

    if ((gameState.date?.age || 0) >= 100) {
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
    const step = () => {
        if (isProcessingRef.current) return; // Prevent overlaps
        isProcessingRef.current = true;

        // Advance Week (god mode is handled by the separate useEffect)
        setTimeout(() => {
            nextWeek();
            isProcessingRef.current = false;
        }, 50);
    };

    step();

  }, [gameState.weeksLived, targetWeek, nextWeek]);

  if (!gameState) {
    return null;
  }

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
    setGameState(prev => {
      if (!prev.stats) return prev;
      const currentMoney = prev.stats.money ?? 0;
      return {
        ...prev,
        stats: {
          ...prev.stats,
          money: currentMoney + amount,
        },
      };
    });
    saveGame();
  };

  const addGems = (amount: number) => {
    if (!gameState?.stats) return;
    updateStats({ gems: (gameState?.stats?.gems ?? 0) + amount });
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
    
    // Calculate target absolute week number
    if (!gameState) return;
    const currentTotal = gameState.weeksLived || 0;
    const target = currentTotal + weeksToSkip;
    
    setTargetWeek(target);
  };


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
    saveGame();
    Alert.alert('Age Set', `Age set to ${age}`);
  };

  const triggerDeath = () => {
    setGameState(prev => ({
      ...prev,
      stats: { ...prev.stats, health: 0 },
      showDeathPopup: true,
      deathReason: 'health',
    }));
    saveGame();
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
    setGameState(prev => ({
      ...prev,
      items: (prev.items || []).map(item => ({
        ...item,
        owned: true,
      })),
      darkWebItems: (prev.darkWebItems || []).map(item => ({
        ...item,
        owned: true,
      })),
    }));
    Alert.alert('Success', 'All items and dark web items unlocked!');
    saveGame();
  };

  const maxRelationships = () => {
    setGameState(prev => ({
      ...prev,
      relationships: (prev.relationships || []).map(rel => ({
        ...rel,
        relationshipScore: 100,
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
      const existingIds = new Set((prev.educations || []).map(e => e.id));
      const allEducations = [
        { id: 'high_school', name: 'High School Diploma', duration: 104, cost: 0, completed: true, weeksRemaining: 0 },
        { id: 'police_academy', name: 'Police Academy', duration: 30, cost: 12000, completed: true, weeksRemaining: 0 },
        { id: 'legal_studies', name: 'Legal Studies', duration: 46, cost: 18000, completed: true, weeksRemaining: 0 },
        { id: 'entrepreneurship', name: 'Entrepreneurship Course', duration: 72, cost: 30000, completed: true, weeksRemaining: 0 },
        { id: 'business_degree', name: 'Business Degree', duration: 90, cost: 48000, completed: true, weeksRemaining: 0 },
        { id: 'computer_science', name: 'Computer Science', duration: 104, cost: 72000, completed: true, weeksRemaining: 0 },
        { id: 'masters_degree', name: "Master's Degree", duration: 120, cost: 90000, completed: true, weeksRemaining: 0 },
        { id: 'mba', name: 'MBA', duration: 150, cost: 120000, completed: true, weeksRemaining: 0 },
        { id: 'medical_school', name: 'Medical School', duration: 180, cost: 150000, completed: true, weeksRemaining: 0 },
        { id: 'law_school', name: 'Law School', duration: 156, cost: 132000, completed: true, weeksRemaining: 0 },
        { id: 'phd', name: 'PhD', duration: 208, cost: 180000, completed: true, weeksRemaining: 0 },
      ].filter(e => !existingIds.has(e.id));
      
      return {
        ...prev,
        educations: [...(prev.educations || []), ...allEducations],
      };
    });
    Alert.alert('Success', 'All education levels added and completed!');
    saveGame();
  };

  const setBankSavings = (amount: number) => {
    setGameState(prev => ({
      ...prev,
      bankSavings: amount,
    }));
    saveGame();
    Alert.alert('Success', `Bank savings set to $${amount.toLocaleString()}`);
  };

  const unlockAllAchievements = () => {
    setGameState(prev => {
      // Import comprehensive achievements
      const { achievements: comprehensiveAchievements } = require('@/src/features/onboarding/achievementsData');
      
      // Unlock all comprehensive achievements (progress achievements)
      const existingProgressIds = new Set((prev.progress?.achievements || []).map(a => a.id));
      const newProgressAchievements = comprehensiveAchievements
        .filter((a: any) => !existingProgressIds.has(a.id))
        .map((a: any) => ({
          id: a.id,
          name: a.title,
          desc: a.description,
          unlockedAt: prev.weeksLived || 0,
        }));
      
      // Unlock all legacy achievements (GameState.achievements)
      const existingLegacyIds = new Set((prev.achievements || []).map(a => a.id));
      const updatedLegacyAchievements = (prev.achievements || []).map(ach => ({
        ...ach,
        completed: true,
      }));
      
      // Add any missing legacy achievements from initialState
      const legacyAchievementIds = [
        'first_dollar', 'hundred_dollars', 'thousand_dollars', 'ten_thousand', 
        'hundred_thousand', 'millionaire', 'deca_millionaire', 'first_job',
        'street_worker', 'career_starter', 'promotion', 'entrepreneur',
        'first_upgrade', 'all_upgrades', 'first_worker',
      ];
      
      legacyAchievementIds.forEach(id => {
        if (!existingLegacyIds.has(id)) {
          updatedLegacyAchievements.push({
            id,
            name: id.split('_').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' '),
            description: `Unlocked achievement: ${id}`,
            category: 'dev',
            completed: true,
          });
        }
      });
      
      // Mark all claimed progress achievements
      const allAchievementIds = new Set([
        ...comprehensiveAchievements.map((a: any) => a.id),
        ...legacyAchievementIds,
      ]);
      
      return {
        ...prev,
        progress: {
          ...prev.progress,
          achievements: [...(prev.progress?.achievements || []), ...newProgressAchievements],
        },
        achievements: updatedLegacyAchievements,
        claimedProgressAchievements: Array.from(allAchievementIds),
      };
    });
    Alert.alert('Success', 'All achievements unlocked!');
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

  // Disease Testing Functions
  const addDisease = (diseaseId: string) => {
    if (!gameState) return;
    
    try {
      // Check if disease already exists BEFORE generating
      const existingDiseases = gameState.diseases || [];
      if (existingDiseases.some(d => d.id === diseaseId)) {
        Alert.alert('Info', 'You already have this disease!');
        return;
      }

      const newDisease = generateSpecificDisease(diseaseId, gameState);
      if (!newDisease) {
        Alert.alert('Error', `Could not generate disease: ${diseaseId}`);
        return;
      }

      // Ensure diseaseHistory is properly initialized
      const currentHistory = gameState.diseaseHistory || {
        diseases: [],
        totalDiseases: 0,
        totalCured: 0,
        deathsFromDisease: 0,
      };

      // Use requestAnimationFrame to ensure UI is ready, then update state
      requestAnimationFrame(() => {
        setTimeout(() => {
          setGameState(prev => {
            const updatedDiseases = [...(prev.diseases || []), newDisease];
            return {
              ...prev,
              diseases: updatedDiseases,
              showSicknessModal: true,
              lastDiseaseWeek: prev.weeksLived || 0,
              diseaseHistory: {
                diseases: [
                  ...(currentHistory.diseases || []),
                  {
                    id: newDisease.id,
                    name: newDisease.name,
                    contractedWeek: prev.weeksLived || 0,
                    severity: newDisease.severity,
                  },
                ],
                totalDiseases: (currentHistory.totalDiseases || 0) + 1,
                totalCured: currentHistory.totalCured || 0,
                deathsFromDisease: currentHistory.deathsFromDisease || 0,
              },
            };
          });
          
          // Save and show success message asynchronously
          setTimeout(() => {
            saveGame();
            Alert.alert('Success', `Added disease: ${newDisease.name}`);
          }, 100);
        }, 50);
      });
    } catch (error) {
      console.error('Error adding disease:', error);
      Alert.alert('Error', `Failed to add disease: ${error instanceof Error ? error.message : String(error)}`);
    }
  };

  const clearAllDiseases = () => {
    Alert.alert(
      'Clear All Diseases',
      'This will remove all active diseases. Are you sure?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Clear',
          onPress: () => {
            setGameState(prev => ({
              ...prev,
              diseases: [],
              showSicknessModal: false,
            }));
            saveGame();
            Alert.alert('Success', 'All diseases cleared!');
          },
        },
      ]
    );
  };

  const setLowHealthForTesting = () => {
    updateStats({ health: 20, fitness: 15 });
    Alert.alert('Info', 'Health and fitness set low to increase disease risk. Progress weeks to test disease generation.');
  };

  const resetDiseaseCooldown = () => {
    setGameState(prev => ({
      ...prev,
      lastDiseaseWeek: 0, // Reset cooldown
    }));
    Alert.alert('Success', 'Disease cooldown reset. Diseases can now generate immediately.');
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
      category: 'Disease Testing',
      items: [
        { label: 'Common Cold', icon: Activity, action: () => addDisease('common_cold'), color: ['#10B981', '#059669'] },
        { label: 'Flu', icon: Activity, action: () => addDisease('flu'), color: ['#F59E0B', '#D97706'] },
        { label: 'Pneumonia', icon: AlertTriangle, action: () => addDisease('pneumonia'), color: ['#EF4444', '#DC2626'] },
        { label: 'Cancer', icon: Skull, action: () => addDisease('cancer'), color: ['#991B1B', '#7F1D1D'] },
        { label: 'Diabetes', icon: Heart, action: () => addDisease('diabetes'), color: ['#8B5CF6', '#7C3AED'] },
        { label: 'Clear All', icon: X, action: clearAllDiseases, color: ['#6B7280', '#4B5563'] },
        { label: 'Low Health Test', icon: Heart, action: setLowHealthForTesting, color: ['#EF4444', '#DC2626'] },
        { label: 'Reset Cooldown', icon: RefreshCw, action: resetDiseaseCooldown, color: ['#6366F1', '#4F46E5'] },
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
        { label: 'Comprehensive Tests', icon: ClipboardCheck, action: () => setShowTestRunner(true), color: ['#10B981', '#059669'] },
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
                        onValueChange={handleGodModeToggle}
                        trackColor={{ false: '#E5E7EB', true: '#10B981' }}
                        thumbColor={preventDrain ? '#FFFFFF' : '#F3F4F6'}
                    />
                </View>
                <Text style={styles.toggleDesc}>
                    When enabled, health, happiness, energy, and fitness will be locked at maximum values and won't decrease during week progression or time travel.
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
      <Modal
        visible={showTestRunner}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setShowTestRunner(false)}
      >
        <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.9)' }}>
          <TestRunner onClose={() => setShowTestRunner(false)} />
        </View>
      </Modal>
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
    maxWidth: 500,
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

