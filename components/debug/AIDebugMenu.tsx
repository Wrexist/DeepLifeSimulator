/**
 * AI Debug Menu Component
 * Simplified and powerful debug interface for testing game mechanics
 *
 * Features:
 * - Quick Actions: Common debugging tasks
 * - Action Testing: Test individual game actions with filters
 * - Life Simulation: Run complete life scenarios
 * - State Monitor: Real-time game state overview
 */

import React, { useState, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  Modal,
  Alert,
  ActivityIndicator,
  TextInput,
} from 'react-native';
import LinearGradientFallback from '@/components/fallbacks/LinearGradientFallback';
const LinearGradient = LinearGradientFallback;
import {
  X,
  Play,
  Pause,
  Square,
  Filter,
  Target,
  Eye,
  Zap,
  RotateCcw,
  Save,
  Upload,
  TrendingUp,
  DollarSign,
  Heart,
  Clock,
  Shield,
  Monitor,
} from 'lucide-react-native';
import { useGame } from '@/contexts/GameContext';
import { createQuickSnapshot } from '@/src/debug/aiDebugSnapshot';
import { runIntegrityChecks } from '@/src/debug/aiIntegrityChecks';
import {
  generateActionSimulations,
  generateLifeScenarios,
  runActionSimulation,
  type SimulatedAction,
  type LifeScenario,
} from '@/src/debug/actionSimulator';
import { exportViaShare } from '@/src/debug/reportExporter';
import {
  responsiveBorderRadius,
  responsiveSpacing,
  responsiveFontSize,
  responsiveIconSize
} from '@/utils/scaling';
import { formatMoney } from '@/utils/moneyFormatting';
import SimulationRunner from '@/components/simulation/SimulationRunner';

interface AIDebugMenuProps {
  visible: boolean;
  onClose: () => void;
}

type TabType = 'quick' | 'actions' | 'simulation' | 'monitor' | 'apps';

interface SimulationState {
  isRunning: boolean;
  isPaused: boolean;
  currentScenario: LifeScenario | null;
  progress: {
    current: number;
    total: number;
    currentAction: string;
  };
}

export default function AIDebugMenu({ visible, onClose }: AIDebugMenuProps) {
  const { gameState, setGameState } = useGame();
  const darkMode = gameState?.settings?.darkMode ?? true;

  // Main state
  const [activeTab, setActiveTab] = useState<TabType>('quick');
  const [isLoading, setIsLoading] = useState(false);
  const [status, setStatus] = useState<string>('Ready');

  // Action testing state
  const [actions, setActions] = useState<SimulatedAction[]>([]);
  const [filteredActions, setFilteredActions] = useState<SimulatedAction[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');

  // Life simulation state
  const [scenarios, setScenarios] = useState<LifeScenario[]>([]);
  const [simulation, setSimulation] = useState<SimulationState>({
    isRunning: false,
    isPaused: false,
    currentScenario: null,
    progress: { current: 0, total: 0, currentAction: '' }
  });

  // Initialize data
  React.useEffect(() => {
    if (visible) {
      setActions(generateActionSimulations());
      setScenarios(generateLifeScenarios());
    }
  }, [visible]);

  // Filter actions
  React.useEffect(() => {
    let filtered = actions;

    if (selectedCategory !== 'all') {
      filtered = filtered.filter(action => action.category === selectedCategory);
    }

    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(action =>
        action.name.toLowerCase().includes(query) ||
        action.category.toLowerCase().includes(query)
      );
    }

    setFilteredActions(filtered);
  }, [actions, selectedCategory, searchQuery]);

  // === Quick Actions ===
  const handleQuickSnapshot = useCallback(async () => {
    try {
      setIsLoading(true);
      setStatus('Creating snapshot...');
      const snapshot = await createQuickSnapshot();
      const json = JSON.stringify(snapshot, null, 2);

      await exportViaShare({
        data: json,
        filename: 'debug-snapshot',
        format: 'json',
      });
      setStatus('Ready');
    } catch (err) {
      setStatus('Error');
      Alert.alert('Error', `Failed to create snapshot: ${String(err)}`);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const handleRunIntegrityCheck = useCallback(async () => {
    console.log('[DEBUG INTEGRITY] Starting integrity check...');

    try {
      setIsLoading(true);
      setStatus('Checking integrity...');
      const report = runIntegrityChecks(gameState);

      console.log(`[DEBUG INTEGRITY] Check completed: ${report.passRate}% pass rate`);
      console.log(`[DEBUG INTEGRITY] Total checks: ${report.totalChecks}, Passed: ${report.passedChecks}, Issues: ${report.issues.length}`);
      console.log(`[DEBUG INTEGRITY] Severity breakdown - Critical: ${report.summary.critical}, High: ${report.summary.high}, Medium: ${report.summary.medium}, Low: ${report.summary.low}`);

      if (report.issues.length > 0) {
        console.log('[DEBUG INTEGRITY] Issues found:');
        report.issues.forEach((issue, index) => {
          console.log(`  ${index + 1}. [${issue.severity.toUpperCase()}] ${issue.category}: ${issue.message}`);
          if (issue.suggestedFix) {
            console.log(`     Suggested fix: ${issue.suggestedFix}`);
          }
        });
      } else {
        console.log('[DEBUG INTEGRITY] ✅ No issues found - all checks passed!');
      }

      const message = report.passRate === 100
        ? '✅ All checks passed!'
        : `⚠️ Found ${report.issues.length} issues (${report.passRate}% pass rate)\nCheck console for details.`;

      Alert.alert('Integrity Check', message);
      setStatus('Ready');
    } catch (err) {
      console.error(`[DEBUG INTEGRITY] Error during integrity check: ${String(err)}`);
      setStatus('Error');
      Alert.alert('Error', `Integrity check failed: ${String(err)}`);
    } finally {
      setIsLoading(false);
    }
  }, [gameState]);

  const handleResetGame = useCallback(() => {
    Alert.alert(
      'Reset Game',
      'This will reset all game progress. Are you sure?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Reset',
          style: 'destructive',
          onPress: () => {
            console.log('[DEBUG RESET] Game state before reset:', gameState);
            setGameState(prev => ({
              ...prev,
              stats: {
                health: 100,
                happiness: 100,
                energy: 100,
                fitness: 50,
                money: 0,
                gems: 0,
                reputation: 0,
              },
              date: {
                week: 1,
                age: 18,
                year: 2025,
                month: 'January',
              },
              achievements: [],
              unlockedItems: [],
              settings: prev.settings || { darkMode: true },
            }));
            console.log('[DEBUG RESET] Game reset to starting state');
            Alert.alert('Reset Complete', 'Game has been reset to starting state.');
          }
        }
      ]
    );
  }, [setGameState, gameState]);

  const handleSaveState = useCallback(() => {
    if (!gameState) return;

    try {
      const stateJson = JSON.stringify(gameState);
      // In a real app, this would save to AsyncStorage or a file
      // For now, just show it can be copied
      Alert.alert(
        'Save State',
        'State saved to memory. In a full implementation, this would persist the state.',
        [
          {
            text: 'Copy JSON',
            onPress: () => exportViaShare({
              data: stateJson,
              filename: 'saved-game-state',
              format: 'json'
            })
          },
          { text: 'OK' }
        ]
      );
    } catch (err) {
      Alert.alert('Error', `Failed to save state: ${String(err)}`);
    }
  }, [gameState]);

  const handleLoadPreset = useCallback((preset: string) => {
    console.log(`[DEBUG PRESET] Loading preset: ${preset}`);
    console.log('[DEBUG PRESET] Game state before preset:', gameState);

    let newState;
    let presetDescription = '';

    switch (preset) {
      case 'broke':
        newState = {
          ...gameState,
          stats: { ...gameState?.stats, money: 100, health: 50, happiness: 30 }
        };
        presetDescription = 'Broke student (low money, struggling health/happiness)';
        break;
      case 'millionaire':
        newState = {
          ...gameState,
          stats: { ...gameState?.stats, money: 1000000, health: 90, happiness: 80 }
        };
        presetDescription = 'Millionaire (wealthy, healthy, happy)';
        break;
      case 'student':
        newState = {
          ...gameState,
          stats: { ...gameState?.stats, money: 500, energy: 60 }
        };
        presetDescription = 'Student (moderate money, decent energy)';
        break;
      default:
        return;
    }

    setGameState(newState);
    console.log(`[DEBUG PRESET] Preset "${preset}" applied: ${presetDescription}`);
    console.log('[DEBUG PRESET] New game state:', newState);
    Alert.alert('Preset Loaded', `${preset.charAt(0).toUpperCase() + preset.slice(1)} preset applied!\n${presetDescription}`);
  }, [gameState, setGameState]);

  // === Action Testing ===
  const handleRunSingleAction = useCallback(async (action: SimulatedAction) => {
    if (!gameState || !setGameState) return;

    console.log(`[DEBUG ACTION] Running: ${action.name} (${action.category})`);

    try {
      const wrappedSetGameState = (updater: (prev: any) => any) => setGameState(updater);
      const result = await action.execute(gameState, wrappedSetGameState);

      if (result.success) {
        console.log(`✅ [DEBUG ACTION] SUCCESS: ${action.name} - ${result.message}`);
      } else {
        console.log(`❌ [DEBUG ACTION] FAILED: ${action.name} - ${result.message}`);
      }

      Alert.alert(
        result.success ? 'Success' : 'Failed',
        result.message
      );
    } catch (err) {
      console.error(`💥 [DEBUG ACTION] ERROR: ${action.name} - ${String(err)}`);
      Alert.alert('Error', `Action failed: ${String(err)}`);
    }
  }, [gameState, setGameState]);

  const handleRunFilteredActions = useCallback(async () => {
    if (!gameState || !setGameState || filteredActions.length === 0) {
      Alert.alert('No Actions', 'No actions match the current filters.');
      return;
    }

    console.log(`[DEBUG SIMULATION] Starting batch action test with ${filteredActions.length} actions`);
    console.log(`[DEBUG SIMULATION] Filters: ${selectedCategory === 'all' ? 'All categories' : selectedCategory}${searchQuery ? `, Search: "${searchQuery}"` : ''}`);

    setIsLoading(true);
    setStatus(`Running ${filteredActions.length} actions...`);

    try {
      const results = await runActionSimulation(
        filteredActions,
        () => gameState,
        setGameState,
        (current, total, action) => {
          setStatus(`Running ${current}/${total}: ${action.name}`);
        }
      );

      console.log(`[DEBUG SIMULATION] Batch test completed: ${results.success} successful, ${results.failed} failed`);

      // Log detailed results
      console.log('[DEBUG SIMULATION] Detailed Results:');
      results.results.forEach((result, index) => {
        if (result.result.success) {
          console.log(`✅ ${index + 1}. ${result.action.name} (${result.action.category}) - SUCCESS: ${result.result.message}`);
        } else {
          console.log(`❌ ${index + 1}. ${result.action.name} (${result.action.category}) - FAILED: ${result.result.message}`);
        }
      });

      // Log failure summary
      if (results.failed > 0) {
        console.log(`[DEBUG SIMULATION] Failed Actions Summary:`);
        results.results
          .filter(r => !r.result.success)
          .forEach((result, index) => {
            console.log(`  ${index + 1}. ${result.action.name}: ${result.result.message}`);
          });
      }

      Alert.alert(
        'Actions Complete',
        `${results.success} successful, ${results.failed} failed\nCheck console for detailed results.`
      );
    } catch (err) {
      console.error(`[DEBUG SIMULATION] Batch test error: ${String(err)}`);
      Alert.alert('Error', `Action testing failed: ${String(err)}`);
    } finally {
      setIsLoading(false);
      setStatus('Ready');
    }
  }, [filteredActions, gameState, setGameState, selectedCategory, searchQuery]);

  // === Life Simulation ===
  const handleStartScenario = useCallback(async (scenario: LifeScenario) => {
    if (!gameState || !setGameState) return;

    console.log(`[DEBUG SCENARIO] Starting life scenario: ${scenario.name}`);
    console.log(`[DEBUG SCENARIO] Description: ${scenario.description}`);
    console.log(`[DEBUG SCENARIO] Total actions: ${scenario.actions.length}`);

    setSimulation(prev => ({
      ...prev,
      isRunning: true,
      isPaused: false,
      currentScenario: scenario,
      progress: { current: 0, total: scenario.actions.length, currentAction: '' }
    }));

    const actionMap = new Map(actions.map(a => [a.id, a]));
    const wrappedSetGameState = (updater: (prev: any) => any) => setGameState(updater);
    const scenarioResults = [];

    try {
      for (let i = 0; i < scenario.actions.length; i++) {
        if (!simulation.isRunning) {
          console.log(`[DEBUG SCENARIO] Scenario stopped early at action ${i + 1}`);
          break; // Check if stopped
        }

        const scenarioAction = scenario.actions[i];
        const action = actionMap.get(scenarioAction.actionId);

        if (!action) {
          console.warn(`[DEBUG SCENARIO] Action ${scenarioAction.actionId} not found, skipping`);
          continue;
        }

        console.log(`[DEBUG SCENARIO] Running action ${i + 1}/${scenario.actions.length}: ${action.name} (${action.category})`);

        setSimulation(prev => ({
          ...prev,
          progress: {
            current: i + 1,
            total: scenario.actions.length,
            currentAction: action.name
          }
        }));

        try {
          const result = await action.execute(gameState, wrappedSetGameState);
          scenarioResults.push({ action, result, index: i + 1 });

          if (result.success) {
            console.log(`✅ [DEBUG SCENARIO] SUCCESS: ${action.name} - ${result.message}`);
          } else {
            console.log(`❌ [DEBUG SCENARIO] FAILED: ${action.name} - ${result.message}`);
          }
        } catch (actionError) {
          console.error(`💥 [DEBUG SCENARIO] ERROR in ${action.name}: ${String(actionError)}`);
          scenarioResults.push({ action, result: { success: false, message: `Error: ${String(actionError)}` }, index: i + 1 });
        }

        await new Promise(resolve => setTimeout(resolve, 200)); // Delay between actions
      }

      const successCount = scenarioResults.filter(r => r.result.success).length;
      const failCount = scenarioResults.filter(r => !r.result.success).length;

      console.log(`[DEBUG SCENARIO] Completed: ${scenario.name}`);
      console.log(`[DEBUG SCENARIO] Results: ${successCount} successful, ${failCount} failed`);

      if (failCount > 0) {
        console.log(`[DEBUG SCENARIO] Failed Actions:`);
        scenarioResults
          .filter(r => !r.result.success)
          .forEach(r => {
            console.log(`  Action ${r.index}: ${r.action.name} - ${r.result.message}`);
          });
      }

      Alert.alert('Scenario Complete', `${scenario.name} finished!\n${successCount} successful, ${failCount} failed\nCheck console for details.`);
    } catch (err) {
      console.error(`[DEBUG SCENARIO] Fatal error in scenario ${scenario.name}: ${String(err)}`);
      Alert.alert('Error', `Scenario failed: ${String(err)}`);
    } finally {
      setSimulation(prev => ({
        ...prev,
        isRunning: false,
        currentScenario: null,
        progress: { current: 0, total: 0, currentAction: '' }
      }));
    }
  }, [gameState, setGameState, actions, simulation.isRunning]);

  const handleStopScenario = useCallback(() => {
    setSimulation(prev => ({
      ...prev,
      isRunning: false,
      isPaused: false,
    }));
  }, []);

  const handlePauseScenario = useCallback(() => {
    setSimulation(prev => ({
      ...prev,
      isPaused: !prev.isPaused,
    }));
  }, []);

  const styles = useMemo(() => createStyles(darkMode), [darkMode]);

  if (!visible) return null;

  const tabs = [
    { key: 'quick', label: 'Quick', icon: Zap },
    { key: 'actions', label: 'Actions', icon: Target },
    { key: 'simulation', label: 'Life Sim', icon: Play },
    { key: 'apps', label: 'Apps', icon: Monitor },
    { key: 'monitor', label: 'Monitor', icon: Eye },
  ] as const;

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={styles.modal}>
          {/* Header */}
          <View style={styles.header}>
            <Text style={styles.title}>Debug Suite</Text>
            <TouchableOpacity onPress={onClose} style={styles.closeButton}>
              <X size={responsiveIconSize.xl} color={darkMode ? '#9CA3AF' : '#6B7280'} />
            </TouchableOpacity>
          </View>

          {/* Tab Bar */}
          <View style={styles.tabBar}>
            {tabs.map(tab => {
              const Icon = tab.icon;
              const isActive = activeTab === tab.key;
              return (
                <TouchableOpacity
                  key={tab.key}
                  style={[styles.tab, isActive && styles.activeTab]}
                  onPress={() => setActiveTab(tab.key)}
                >
                  <Icon size={responsiveIconSize.sm} color={isActive ? '#FFF' : (darkMode ? '#9CA3AF' : '#6B7280')} />
                  <Text style={[styles.tabText, isActive && styles.activeTabText]}>
                    {tab.label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>

          {/* Status Bar */}
          <View style={styles.statusBar}>
            {isLoading && <ActivityIndicator size="small" color="#818CF8" style={{ marginRight: responsiveSpacing.sm }} />}
            <Text style={styles.statusText}>{status}</Text>
          </View>

          {/* Tab Content */}
          <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
            {activeTab === 'quick' && (
              <View style={styles.tabContent}>
                <Text style={styles.sectionTitle}>Quick Actions</Text>

                {/* Main Actions */}
                <View style={styles.buttonGrid}>
                  <QuickButton
                    label="Snapshot"
                    icon={<Upload size={responsiveIconSize.sm} color="#FFF" />}
                    onPress={handleQuickSnapshot}
                    disabled={isLoading}
                    colors={['#10B981', '#059669']}
                  />
                  <QuickButton
                    label="Check Integrity"
                    icon={<Shield size={responsiveIconSize.sm} color="#FFF" />}
                    onPress={handleRunIntegrityCheck}
                    disabled={isLoading}
                    colors={['#F59E0B', '#D97706']}
                  />
                  <QuickButton
                    label="Reset Game"
                    icon={<RotateCcw size={responsiveIconSize.sm} color="#FFF" />}
                    onPress={handleResetGame}
                    disabled={isLoading}
                    colors={['#EF4444', '#DC2626']}
                  />
                  <QuickButton
                    label="Save State"
                    icon={<Save size={responsiveIconSize.sm} color="#FFF" />}
                    onPress={handleSaveState}
                    disabled={isLoading}
                    colors={['#8B5CF6', '#7C3AED']}
                  />
                </View>

                {/* Preset States */}
                <Text style={[styles.sectionTitle, { marginTop: responsiveSpacing.xl, fontSize: responsiveFontSize.lg }]}>
                  Load Preset States
                </Text>
                <View style={styles.buttonGrid}>
                  <QuickButton
                    label="Broke Student"
                    icon={<DollarSign size={responsiveIconSize.xs} color="#FFF" />}
                    onPress={() => handleLoadPreset('broke')}
                    disabled={isLoading}
                    colors={['#6B7280', '#4B5563']}
                  />
                  <QuickButton
                    label="Millionaire"
                    icon={<DollarSign size={responsiveIconSize.xs} color="#FFF" />}
                    onPress={() => handleLoadPreset('millionaire')}
                    disabled={isLoading}
                    colors={['#10B981', '#059669']}
                  />
                  <QuickButton
                    label="Smart Student"
                    icon={<TrendingUp size={responsiveIconSize.xs} color="#FFF" />}
                    onPress={() => handleLoadPreset('student')}
                    disabled={isLoading}
                    colors={['#3B82F6', '#1D4ED8']}
                  />
                </View>
              </View>
            )}

            {activeTab === 'actions' && (
              <View style={styles.tabContent}>
                <Text style={styles.sectionTitle}>Action Testing</Text>

                {/* Filters */}
                <View style={styles.filterRow}>
                  <TextInput
                    style={styles.searchInput}
                    placeholder="Search actions..."
                    value={searchQuery}
                    onChangeText={setSearchQuery}
                    placeholderTextColor={darkMode ? '#9CA3AF' : '#6B7280'}
                  />
                  <TouchableOpacity
                    style={[styles.filterButton, selectedCategory === 'all' && styles.activeFilter]}
                    onPress={() => setSelectedCategory('all')}
                  >
                    <Filter size={responsiveIconSize.xs} color={selectedCategory === 'all' ? '#FFF' : (darkMode ? '#9CA3AF' : '#6B7280')} />
                  </TouchableOpacity>
                </View>

                {/* Category Filters */}
                <View style={styles.categoryRow}>
                  {['money', 'job', 'social', 'item', 'stats', 'progression'].map(category => (
                    <TouchableOpacity
                      key={category}
                      style={[styles.categoryButton, selectedCategory === category && styles.activeCategory]}
                      onPress={() => setSelectedCategory(selectedCategory === category ? 'all' : category)}
                    >
                      <Text style={[styles.categoryText, selectedCategory === category && styles.activeCategoryText]}>
                        {category}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>

                {/* Run All Button */}
                <QuickButton
                  label={`Run ${filteredActions.length} Actions`}
                  icon={<Zap size={responsiveIconSize.sm} color="#FFF" />}
                  onPress={handleRunFilteredActions}
                  disabled={isLoading || filteredActions.length === 0}
                  colors={['#8B5CF6', '#7C3AED']}
                  fullWidth
                />

                {/* Action List */}
                <View style={styles.actionList}>
                  {filteredActions.slice(0, 20).map((item) => (
                    <TouchableOpacity
                      key={item.id}
                      style={styles.actionItem}
                      onPress={() => handleRunSingleAction(item)}
                    >
                      <View style={styles.actionHeader}>
                        <Text style={styles.actionName}>{item.name}</Text>
                        <Text style={styles.actionCategory}>{item.category}</Text>
                      </View>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>
            )}

            {activeTab === 'simulation' && (
              <View style={styles.tabContent}>
                <Text style={styles.sectionTitle}>Life Simulation</Text>

                {/* Current Simulation Status */}
                {simulation.isRunning && (
                  <View style={styles.simulationStatus}>
                    <Text style={styles.simulationTitle}>
                      Running: {simulation.currentScenario?.name}
                    </Text>
                    <Text style={styles.simulationProgress}>
                      {simulation.progress.current}/{simulation.progress.total} - {simulation.progress.currentAction}
                    </Text>
                    <View style={styles.simulationControls}>
                      <TouchableOpacity
                        style={[styles.controlButton, simulation.isPaused && styles.activeControl]}
                        onPress={handlePauseScenario}
                      >
                        {simulation.isPaused ? <Play size={responsiveIconSize.sm} color="#FFF" /> : <Pause size={responsiveIconSize.sm} color="#FFF" />}
                      </TouchableOpacity>
                      <TouchableOpacity style={styles.controlButton} onPress={handleStopScenario}>
                        <Square size={responsiveIconSize.sm} color="#FFF" />
                      </TouchableOpacity>
                    </View>
                  </View>
                )}

                {/* Scenario List */}
                {scenarios.map(scenario => (
                  <TouchableOpacity
                    key={scenario.id}
                    style={styles.scenarioItem}
                    onPress={() => handleStartScenario(scenario)}
                    disabled={simulation.isRunning}
                  >
                    <View style={styles.scenarioHeader}>
                      <Text style={styles.scenarioName}>{scenario.name}</Text>
                      <Text style={styles.scenarioCount}>{scenario.actions.length} actions</Text>
                    </View>
                    <Text style={styles.scenarioDesc}>{scenario.description}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            )}

            {activeTab === 'apps' && (
              <View style={styles.tabContent}>
                <SimulationRunner
                  onComplete={(results) => {
                    console.log('[AppSimulation] Complete:', results.length, 'tests');
                    setStatus(`App simulation complete: ${results.length} tests`);
                  }}
                />
              </View>
            )}

            {activeTab === 'monitor' && (
              <View style={styles.tabContent}>
                <Text style={styles.sectionTitle}>State Monitor</Text>

                {gameState && (
                  <View style={styles.monitorGrid}>
                    <View style={styles.monitorItem}>
                      <DollarSign size={responsiveIconSize.md} color={darkMode ? '#10B981' : '#059669'} />
                      <Text style={styles.monitorLabel}>Money</Text>
                      <Text style={styles.monitorValue}>
                        {formatMoney(gameState.stats?.money || 0)}
                      </Text>
                    </View>

                    <View style={styles.monitorItem}>
                      <Heart size={responsiveIconSize.md} color={darkMode ? '#EF4444' : '#DC2626'} />
                      <Text style={styles.monitorLabel}>Health</Text>
                      <Text style={styles.monitorValue}>{gameState.stats?.health || 0}%</Text>
                    </View>

                    <View style={styles.monitorItem}>
                      <TrendingUp size={responsiveIconSize.md} color={darkMode ? '#8B5CF6' : '#7C3AED'} />
                      <Text style={styles.monitorLabel}>Happiness</Text>
                      <Text style={styles.monitorValue}>{gameState.stats?.happiness || 0}%</Text>
                    </View>

                    <View style={styles.monitorItem}>
                      <Clock size={responsiveIconSize.md} color={darkMode ? '#F59E0B' : '#D97706'} />
                      <Text style={styles.monitorLabel}>Age</Text>
                      <Text style={styles.monitorValue}>
                        {gameState.date?.age?.toFixed(1) || 18} years
                      </Text>
                    </View>
                  </View>
                )}
              </View>
            )}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

// === Button Components ===
interface QuickButtonProps {
  label: string;
  icon: React.ReactNode;
  onPress: () => void;
  disabled?: boolean;
  colors: [string, string];
  fullWidth?: boolean;
}

function QuickButton({ label, icon, onPress, disabled, colors, fullWidth }: QuickButtonProps) {
  return (
    <TouchableOpacity
      style={[
        buttonStyles.button,
        fullWidth && buttonStyles.fullWidth,
        disabled && buttonStyles.disabled,
      ]}
      onPress={onPress}
      disabled={disabled}
      activeOpacity={0.7}
    >
      <LinearGradient
        colors={disabled ? ['#6B7280', '#4B5563'] : colors}
        style={buttonStyles.gradient}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
      >
        {icon}
        <Text style={buttonStyles.label}>{label}</Text>
      </LinearGradient>
    </TouchableOpacity>
  );
}

const buttonStyles = StyleSheet.create({
  button: {
    borderRadius: responsiveBorderRadius.md,
    overflow: 'hidden',
    marginBottom: responsiveSpacing.sm,
  },
  fullWidth: {
    width: '100%',
  },
  disabled: {
    opacity: 0.6,
  },
  gradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
      paddingVertical: responsiveSpacing.md,
      paddingHorizontal: responsiveSpacing.lg,
      gap: responsiveSpacing.sm,
  },
  label: {
    color: '#FFFFFF',
    fontSize: responsiveFontSize.base,
    fontWeight: '600',
  },
});

// === Dynamic Styles ===
function createStyles(darkMode: boolean) {
  return StyleSheet.create({
    overlay: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
      padding: responsiveSpacing.xl,
      backgroundColor: darkMode ? 'rgba(0,0,0,0.6)' : 'rgba(255,255,255,0.9)',
    },
    modal: {
      backgroundColor: darkMode ? '#1F2937' : '#FFFFFF',
      borderRadius: responsiveBorderRadius.xl,
      width: '100%',
      maxHeight: '85%',
      maxWidth: 480,
      overflow: 'hidden',
      shadowColor: darkMode ? '#000' : 'rgba(0,0,0,0.15)',
      shadowOffset: { width: 0, height: 8 },
      shadowOpacity: darkMode ? 0.25 : 0.1,
      shadowRadius: 16,
      elevation: darkMode ? 10 : 8,
      // Light mode: subtle border for definition
      borderWidth: darkMode ? 0 : 1,
      borderColor: darkMode ? 'transparent' : 'rgba(0,0,0,0.05)',
      // Light mode: subtle inner shadow for depth
      ...(darkMode ? {} : {
        shadowColor: 'rgba(0,0,0,0.08)',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 1,
        shadowRadius: 8,
      }),
    },
    header: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      padding: responsiveSpacing.xl,
      borderBottomWidth: 1,
      borderBottomColor: darkMode ? '#374151' : 'rgba(0,0,0,0.08)',
      backgroundColor: darkMode ? '#111827' : '#FAFAFA',
      // Light mode: subtle gradient for elegance
      ...(!darkMode && {
        backgroundColor: 'linear-gradient(135deg, #FFFFFF 0%, #F8FAFC 100%)',
      }),
    },
    title: {
      fontSize: responsiveFontSize['2xl'],
      fontWeight: 'bold',
      color: darkMode ? '#F9FAFB' : '#0F172A',
    },
    closeButton: {
      padding: responsiveSpacing.xs,
      borderRadius: responsiveBorderRadius.md,
      backgroundColor: darkMode ? 'rgba(55, 65, 81, 0.5)' : 'rgba(0,0,0,0.04)',
      borderWidth: darkMode ? 0 : 1,
      borderColor: darkMode ? 'transparent' : 'rgba(0,0,0,0.06)',
    },
    tabBar: {
      flexDirection: 'row',
      borderBottomWidth: 1,
      borderBottomColor: darkMode ? '#374151' : 'rgba(0,0,0,0.06)',
      backgroundColor: darkMode ? '#111827' : '#F8FAFC',
    },
    tab: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      paddingVertical: responsiveSpacing.md,
      paddingHorizontal: responsiveSpacing.sm,
      gap: responsiveSpacing.xs,
      // Light mode: subtle hover/press effect
      backgroundColor: darkMode ? 'transparent' : 'rgba(0,0,0,0.02)',
    },
    activeTab: {
      backgroundColor: darkMode ? '#3B82F6' : '#3B82F6',
      shadowColor: darkMode ? '#3B82F6' : '#3B82F6',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: darkMode ? 0.3 : 0.2,
      shadowRadius: 4,
      elevation: 3,
    },
    tabText: {
      fontSize: responsiveFontSize.xs,
      fontWeight: '500',
      color: darkMode ? '#9CA3AF' : '#64748B',
    },
    activeTabText: {
      color: '#FFFFFF',
      fontWeight: '600',
    },
    statusBar: {
      flexDirection: 'row',
      alignItems: 'center',
      marginHorizontal: responsiveSpacing.xl,
      marginTop: responsiveSpacing.md,
      padding: responsiveSpacing.sm,
      backgroundColor: darkMode ? '#374151' : '#F1F5F9',
      borderRadius: responsiveBorderRadius.md,
      borderWidth: darkMode ? 0 : 1,
      borderColor: darkMode ? 'transparent' : 'rgba(0,0,0,0.04)',
    },
    statusText: {
      color: darkMode ? '#D1D5DB' : '#334155',
      fontSize: responsiveFontSize.sm,
      fontWeight: '500',
    },
    content: {
      padding: responsiveSpacing.xl,
      backgroundColor: darkMode ? 'transparent' : '#FAFAFA',
    },
    tabContent: {
      minHeight: 300,
    },
    sectionTitle: {
      fontSize: responsiveFontSize.xl,
      fontWeight: '600',
      color: darkMode ? '#F9FAFB' : '#0F172A',
      marginBottom: responsiveSpacing.lg,
      // Light mode: subtle text shadow for depth
      ...(darkMode ? {} : {
        textShadowColor: 'rgba(0,0,0,0.1)',
        textShadowOffset: { width: 0, height: 1 },
        textShadowRadius: 2,
      }),
    },
    buttonGrid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      justifyContent: 'space-between',
      gap: responsiveSpacing.sm,
    },

    // Action testing styles
    filterRow: {
      flexDirection: 'row',
      gap: responsiveSpacing.sm,
      marginBottom: responsiveSpacing.md,
    },
    searchInput: {
      flex: 1,
      borderWidth: 1,
      borderColor: darkMode ? '#374151' : 'rgba(0,0,0,0.12)',
      borderRadius: responsiveBorderRadius.lg,
      paddingHorizontal: responsiveSpacing.md,
      paddingVertical: responsiveSpacing.sm,
      fontSize: responsiveFontSize.base,
      color: darkMode ? '#F9FAFB' : '#0F172A',
      backgroundColor: darkMode ? '#111827' : '#FFFFFF',
      shadowColor: darkMode ? 'transparent' : 'rgba(0,0,0,0.08)',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 1,
      shadowRadius: 4,
      elevation: darkMode ? 0 : 2,
    },
    filterButton: {
      padding: responsiveSpacing.sm,
      borderRadius: responsiveBorderRadius.lg,
      borderWidth: 1,
      borderColor: darkMode ? '#374151' : 'rgba(0,0,0,0.12)',
      backgroundColor: darkMode ? '#111827' : '#FFFFFF',
      alignItems: 'center',
      justifyContent: 'center',
      shadowColor: darkMode ? 'transparent' : 'rgba(0,0,0,0.06)',
      shadowOffset: { width: 0, height: 1 },
      shadowOpacity: 1,
      shadowRadius: 2,
      elevation: darkMode ? 0 : 1,
    },
    activeFilter: {
      backgroundColor: darkMode ? '#3B82F6' : '#3B82F6',
      borderColor: darkMode ? '#3B82F6' : '#3B82F6',
      shadowColor: darkMode ? '#3B82F6' : '#3B82F6',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: darkMode ? 0.3 : 0.2,
      shadowRadius: 4,
      elevation: 3,
    },
    categoryRow: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: responsiveSpacing.xs,
      marginBottom: responsiveSpacing.lg,
    },
    categoryButton: {
      paddingHorizontal: responsiveSpacing.md,
      paddingVertical: responsiveSpacing.xs,
      borderRadius: responsiveBorderRadius.lg,
      borderWidth: 1,
      borderColor: darkMode ? '#374151' : 'rgba(0,0,0,0.12)',
      backgroundColor: darkMode ? '#111827' : '#F8FAFC',
      shadowColor: darkMode ? 'transparent' : 'rgba(0,0,0,0.04)',
      shadowOffset: { width: 0, height: 1 },
      shadowOpacity: 1,
      shadowRadius: 2,
      elevation: darkMode ? 0 : 1,
    },
    activeCategory: {
      backgroundColor: darkMode ? '#8B5CF6' : '#8B5CF6',
      borderColor: darkMode ? '#8B5CF6' : '#8B5CF6',
      shadowColor: darkMode ? '#8B5CF6' : '#8B5CF6',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: darkMode ? 0.3 : 0.2,
      shadowRadius: 4,
      elevation: 3,
    },
    categoryText: {
      fontSize: responsiveFontSize.xs,
      color: darkMode ? '#9CA3AF' : '#475569',
      fontWeight: '500',
    },
    activeCategoryText: {
      color: '#FFFFFF',
      fontWeight: '600',
    },
    actionList: {
      maxHeight: 300,
      borderWidth: 1,
      borderColor: darkMode ? '#374151' : 'rgba(0,0,0,0.08)',
      borderRadius: responsiveBorderRadius.lg,
      backgroundColor: darkMode ? '#111827' : '#FFFFFF',
      padding: responsiveSpacing.sm,
      shadowColor: darkMode ? 'transparent' : 'rgba(0,0,0,0.06)',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 1,
      shadowRadius: 4,
      elevation: darkMode ? 0 : 2,
    },
    actionItem: {
      padding: responsiveSpacing.md,
      borderBottomWidth: 1,
      borderBottomColor: darkMode ? '#374151' : 'rgba(0,0,0,0.06)',
      borderRadius: responsiveBorderRadius.sm,
      marginBottom: responsiveSpacing.xs,
      backgroundColor: darkMode ? 'transparent' : 'rgba(0,0,0,0.01)',
    },
    actionHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
    },
    actionName: {
      fontSize: responsiveFontSize.base,
      fontWeight: '500',
      color: darkMode ? '#F9FAFB' : '#0F172A',
    },
    actionCategory: {
      fontSize: responsiveFontSize.xs,
      color: darkMode ? '#8B5CF6' : '#7C3AED',
      fontWeight: '600',
      textTransform: 'uppercase',
      backgroundColor: darkMode ? 'rgba(139, 92, 246, 0.2)' : 'rgba(124, 58, 237, 0.1)',
      paddingHorizontal: responsiveSpacing.xs,
      paddingVertical: 2,
      borderRadius: responsiveBorderRadius.sm,
    },

    // Simulation styles
    simulationStatus: {
      backgroundColor: darkMode ? '#111827' : '#F0F9FF',
      borderRadius: responsiveBorderRadius.lg,
      padding: responsiveSpacing.lg,
      marginBottom: responsiveSpacing.lg,
      borderWidth: 1,
      borderColor: darkMode ? '#374151' : 'rgba(59, 130, 246, 0.2)',
      shadowColor: darkMode ? 'transparent' : 'rgba(59, 130, 246, 0.1)',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 1,
      shadowRadius: 4,
      elevation: darkMode ? 0 : 2,
    },
    simulationTitle: {
      fontSize: responsiveFontSize.lg,
      fontWeight: '600',
      color: darkMode ? '#F9FAFB' : '#0F172A',
      marginBottom: responsiveSpacing.xs,
    },
    simulationProgress: {
      fontSize: responsiveFontSize.sm,
      color: darkMode ? '#9CA3AF' : '#64748B',
      marginBottom: responsiveSpacing.md,
      fontWeight: '500',
    },
    simulationControls: {
      flexDirection: 'row',
      gap: responsiveSpacing.sm,
    },
    controlButton: {
      backgroundColor: darkMode ? '#374151' : '#E2E8F0',
      borderRadius: responsiveBorderRadius.md,
      padding: responsiveSpacing.sm,
      alignItems: 'center',
      justifyContent: 'center',
      shadowColor: darkMode ? 'transparent' : 'rgba(0,0,0,0.1)',
      shadowOffset: { width: 0, height: 1 },
      shadowOpacity: 1,
      shadowRadius: 2,
      elevation: darkMode ? 0 : 1,
      borderWidth: darkMode ? 0 : 1,
      borderColor: darkMode ? 'transparent' : 'rgba(0,0,0,0.05)',
    },
    activeControl: {
      backgroundColor: darkMode ? '#10B981' : '#10B981',
      shadowColor: darkMode ? '#10B981' : '#10B981',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: darkMode ? 0.3 : 0.2,
      shadowRadius: 4,
      elevation: 3,
    },
    scenarioItem: {
      backgroundColor: darkMode ? '#111827' : '#FEFEFE',
      borderRadius: responsiveBorderRadius.lg,
      padding: responsiveSpacing.lg,
      marginBottom: responsiveSpacing.md,
      borderWidth: 1,
      borderColor: darkMode ? '#374151' : 'rgba(0,0,0,0.08)',
      shadowColor: darkMode ? 'transparent' : 'rgba(0,0,0,0.06)',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 1,
      shadowRadius: 4,
      elevation: darkMode ? 0 : 2,
    },
    scenarioHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: responsiveSpacing.sm,
    },
    scenarioName: {
      fontSize: responsiveFontSize.lg,
      fontWeight: '600',
      color: darkMode ? '#F9FAFB' : '#0F172A',
    },
    scenarioCount: {
      fontSize: responsiveFontSize.xs,
      color: darkMode ? '#8B5CF6' : '#7C3AED',
      fontWeight: '600',
      backgroundColor: darkMode ? 'rgba(139, 92, 246, 0.2)' : 'rgba(124, 58, 237, 0.1)',
      paddingHorizontal: responsiveSpacing.xs,
      paddingVertical: 2,
      borderRadius: responsiveBorderRadius.sm,
    },
    scenarioDesc: {
      fontSize: responsiveFontSize.sm,
      color: darkMode ? '#9CA3AF' : '#64748B',
      lineHeight: responsiveFontSize.lg,
    },

    // Monitor styles
    monitorGrid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: responsiveSpacing.md,
    },
    monitorItem: {
      flex: 1,
      minWidth: 120,
      backgroundColor: darkMode ? '#111827' : '#FEFEFE',
      borderRadius: responsiveBorderRadius.lg,
      padding: responsiveSpacing.lg,
      alignItems: 'center',
      borderWidth: 1,
      borderColor: darkMode ? '#374151' : 'rgba(0,0,0,0.08)',
      shadowColor: darkMode ? 'transparent' : 'rgba(0,0,0,0.06)',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 1,
      shadowRadius: 4,
      elevation: darkMode ? 0 : 2,
    },
    monitorLabel: {
      fontSize: responsiveFontSize.xs,
      color: darkMode ? '#9CA3AF' : '#64748B',
      marginTop: responsiveSpacing.sm,
      fontWeight: '500',
      textTransform: 'uppercase',
      letterSpacing: 0.5,
    },
    monitorValue: {
      fontSize: responsiveFontSize.xl,
      fontWeight: 'bold',
      color: darkMode ? '#F9FAFB' : '#0F172A',
      marginTop: responsiveSpacing.xs,
      // Light mode: subtle text shadow for important values
      ...(darkMode ? {} : {
        textShadowColor: 'rgba(0,0,0,0.1)',
        textShadowOffset: { width: 0, height: 1 },
        textShadowRadius: 2,
      }),
    },
  });
}


