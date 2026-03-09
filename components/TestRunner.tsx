/**
 * Test Runner Component
 * UI component to run comprehensive tests from within the app
 */

import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator } from 'react-native';
import { X } from 'lucide-react-native';
import { ComprehensiveGameSimulator, SimulationReport, BugReport } from '@/lib/simulation/ComprehensiveGameSimulator';
import { useGame } from '@/contexts/GameContext';
import { logger } from '@/utils/logger';

const log = logger.scope('TestRunner');

interface TestRunnerProps {
  onClose?: () => void;
}

export default function TestRunner({ onClose }: TestRunnerProps = {}) {
  const allGameActions = useGame();
  const { gameState, setGameState } = allGameActions;
  const [isRunning, setIsRunning] = useState(false);
  const [report, setReport] = useState<SimulationReport | null>(null);
  const [includeLongTerm, setIncludeLongTerm] = useState(false);
  const [simulationSpeed, setSimulationSpeed] = useState<'fast' | 'normal' | 'slow'>('normal');

  const runTests = async () => {
    setIsRunning(true);
    setReport(null);

    try {
      // Validate and repair game state before running tests
      const { clampRelationshipScore, clampHobbySkill, clampHobbySkillLevel } = require('@/utils/stateValidation');
      
      // Repair relationships
      if (gameState.relationships && Array.isArray(gameState.relationships)) {
        setGameState(prev => ({
          ...prev,
          relationships: prev.relationships.map((rel: any) => {
            if (!rel || typeof rel !== 'object' || !rel.id) return rel;
            const score = typeof rel.relationshipScore === 'number' && !isNaN(rel.relationshipScore) && isFinite(rel.relationshipScore)
              ? rel.relationshipScore
              : 50;
            return {
              ...rel,
              relationshipScore: clampRelationshipScore(score),
            };
          }),
        }));
      }
      
      // Repair hobbies
      if (gameState.hobbies && Array.isArray(gameState.hobbies)) {
        setGameState(prev => ({
          ...prev,
          hobbies: prev.hobbies.map((hobby: any) => {
            if (!hobby || typeof hobby !== 'object' || !hobby.id) return hobby;
            const skill = typeof hobby.skill === 'number' && !isNaN(hobby.skill) && isFinite(hobby.skill)
              ? hobby.skill
              : 0;
            const skillLevel = typeof hobby.skillLevel === 'number' && !isNaN(hobby.skillLevel) && isFinite(hobby.skillLevel)
              ? hobby.skillLevel
              : 1;
            return {
              ...hobby,
              skill: clampHobbySkill(skill),
              skillLevel: clampHobbySkillLevel(skillLevel),
            };
          }),
        }));
      }

      // Wait for state updates to complete
      await new Promise(resolve => setTimeout(resolve, 100));

      // Extract game actions from useGame hook - use REAL actions
      const gameActions = {
        buyWarehouse: allGameActions.buyWarehouse,
        upgradeWarehouse: allGameActions.upgradeWarehouse,
        buyMiner: allGameActions.buyMiner,
        sellMiner: allGameActions.sellMiner,
        selectMiningCrypto: allGameActions.selectMiningCrypto,
        buyCrypto: allGameActions.buyCrypto,
        sellCrypto: allGameActions.sellCrypto,
        swapCrypto: allGameActions.swapCrypto,
        buyItem: allGameActions.buyItem,
        applyForJob: allGameActions.applyForJob,
        promoteCareer: allGameActions.promoteCareer,
        nextWeek: allGameActions.nextWeek,
        saveGame: allGameActions.saveGame, // Real save function
        createCompany: allGameActions.createCompany, // Real company creation
        startEducation: allGameActions.startEducation, // Real education start
        goOnDate: allGameActions.goOnDate, // Real relationship action
        // Hobbies removed - trainHobby no longer available
      };

      // Create simulator
      const simulator = new ComprehensiveGameSimulator();

      // Get the latest state after repairs
      let latestState = gameState;
      setGameState(prev => {
        latestState = prev;
        return prev;
      });
      await new Promise(resolve => setTimeout(resolve, 50));

      // Run tests with options - enable saving for real simulation
      const testReport = await simulator.runComprehensiveTest(
        latestState,
        setGameState,
        gameActions,
        {
          includeLongTermSimulations: includeLongTerm,
          longTermWeeks: includeLongTerm ? [500, 1000] : [],
          includeStressTest: includeLongTerm, // Include stress test if long-term is enabled
          stressTestActions: 200,
          simulationSpeed: simulationSpeed,
          enableSaving: true, // Enable saving during simulation
          saveInterval: 10, // Save every 10 actions
        }
      );

      setReport(testReport);
      log.info('Tests completed:', testReport);
    } catch (error: any) {
      log.error('Test execution failed:', error);
      setReport({
        totalTests: 0,
        passedTests: 0,
        failedTests: 0,
        bugs: [{
          id: 'test-runner-error',
          category: 'Test Runner',
          severity: 'critical',
          description: 'Test runner failed to execute',
          stepsToReproduce: ['Open Test Runner', 'Click Run Tests'],
          expectedBehavior: 'Tests should run successfully',
          actualBehavior: `Error: ${error?.message || 'Unknown error'}`,
          affectedFeatures: ['Test Runner'],
          stackTrace: error?.stack,
        }],
        warnings: [],
        executionTime: 0,
      });
    } finally {
      setIsRunning(false);
    }
  };

  const getSeverityColor = (severity: BugReport['severity']) => {
    switch (severity) {
      case 'critical': return '#EF4444';
      case 'high': return '#F59E0B';
      case 'medium': return '#3B82F6';
      case 'low': return '#6B7280';
      default: return '#6B7280';
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View style={styles.titleContainer}>
          <Text style={styles.title}>Comprehensive Test Runner</Text>
          {onClose && (
            <TouchableOpacity onPress={onClose} style={styles.closeButton}>
              <X size={24} color="#94A3B8" />
            </TouchableOpacity>
          )}
        </View>
        <TouchableOpacity
          style={[styles.button, isRunning && styles.buttonDisabled]}
          onPress={runTests}
          disabled={isRunning}
        >
          {isRunning ? (
            <ActivityIndicator color="#FFF" />
          ) : (
            <Text style={styles.buttonText}>Run All Tests</Text>
          )}
        </TouchableOpacity>
      </View>

      {!isRunning && !report && (
        <View style={styles.optionsContainer}>
          <Text style={styles.optionsTitle}>Test Options</Text>
          
          <View style={styles.optionRow}>
            <Text style={styles.optionLabel}>Include Long-Term Simulations</Text>
            <TouchableOpacity
              style={[styles.toggle, includeLongTerm && styles.toggleActive]}
              onPress={() => setIncludeLongTerm(!includeLongTerm)}
            >
              <Text style={[styles.toggleText, includeLongTerm && styles.toggleTextActive]}>
                {includeLongTerm ? 'ON' : 'OFF'}
              </Text>
            </TouchableOpacity>
          </View>

          {includeLongTerm && (
            <View style={styles.optionRow}>
              <Text style={styles.optionLabel}>Simulation Speed</Text>
              <View style={styles.speedButtons}>
                <TouchableOpacity
                  style={[styles.speedButton, simulationSpeed === 'fast' && styles.speedButtonActive]}
                  onPress={() => setSimulationSpeed('fast')}
                >
                  <Text style={[styles.speedButtonText, simulationSpeed === 'fast' && styles.speedButtonTextActive]}>
                    Fast
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.speedButton, simulationSpeed === 'normal' && styles.speedButtonActive]}
                  onPress={() => setSimulationSpeed('normal')}
                >
                  <Text style={[styles.speedButtonText, simulationSpeed === 'normal' && styles.speedButtonTextActive]}>
                    Normal
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.speedButton, simulationSpeed === 'slow' && styles.speedButtonActive]}
                  onPress={() => setSimulationSpeed('slow')}
                >
                  <Text style={[styles.speedButtonText, simulationSpeed === 'slow' && styles.speedButtonTextActive]}>
                    Slow
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          )}

          {includeLongTerm && (
            <View style={styles.infoBox}>
              <Text style={styles.infoText}>
                ⚠️ Long-term simulations will test 500 and 1000 weeks of gameplay.
                This may take several minutes depending on speed setting.
              </Text>
            </View>
          )}
        </View>
      )}

      {isRunning && (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#10B981" />
          <Text style={styles.loadingText}>Running comprehensive tests...</Text>
        </View>
      )}

      {report && (
        <ScrollView style={styles.resultsContainer}>
          <View style={styles.summaryCard}>
            <Text style={styles.summaryTitle}>Test Summary</Text>
            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>Total Tests:</Text>
              <Text style={styles.summaryValue}>{report.totalTests}</Text>
            </View>
            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>Passed:</Text>
              <Text style={[styles.summaryValue, { color: '#10B981' }]}>
                {report.passedTests} ({((report.passedTests / report.totalTests) * 100).toFixed(1)}%)
              </Text>
            </View>
            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>Failed:</Text>
              <Text style={[styles.summaryValue, { color: '#EF4444' }]}>
                {report.failedTests} ({((report.failedTests / report.totalTests) * 100).toFixed(1)}%)
              </Text>
            </View>
            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>Execution Time:</Text>
              <Text style={styles.summaryValue}>{report.executionTime}ms</Text>
            </View>
          </View>

          <View style={styles.bugSummaryCard}>
            <Text style={styles.summaryTitle}>Bug Summary</Text>
            <View style={styles.bugCountRow}>
              <View style={[styles.bugCountBadge, { backgroundColor: '#EF4444' }]}>
                <Text style={styles.bugCountText}>
                  Critical: {report.bugs.filter(b => b.severity === 'critical').length}
                </Text>
              </View>
              <View style={[styles.bugCountBadge, { backgroundColor: '#F59E0B' }]}>
                <Text style={styles.bugCountText}>
                  High: {report.bugs.filter(b => b.severity === 'high').length}
                </Text>
              </View>
              <View style={[styles.bugCountBadge, { backgroundColor: '#3B82F6' }]}>
                <Text style={styles.bugCountText}>
                  Medium: {report.bugs.filter(b => b.severity === 'medium').length}
                </Text>
              </View>
              <View style={[styles.bugCountBadge, { backgroundColor: '#6B7280' }]}>
                <Text style={styles.bugCountText}>
                  Low: {report.bugs.filter(b => b.severity === 'low').length}
                </Text>
              </View>
            </View>
          </View>

          {report.bugs.length > 0 && (
            <View style={styles.bugsContainer}>
              <Text style={styles.bugsTitle}>Bugs Found ({report.bugs.length})</Text>
              {report.bugs.map((bug, index) => (
                <View key={bug.id} style={styles.bugCard}>
                  <View style={styles.bugHeader}>
                    <View style={[styles.severityBadge, { backgroundColor: getSeverityColor(bug.severity) }]}>
                      <Text style={styles.severityText}>{bug.severity.toUpperCase()}</Text>
                    </View>
                    <Text style={styles.bugId}>[{bug.id}]</Text>
                  </View>
                  <Text style={styles.bugDescription}>{bug.description}</Text>
                  <Text style={styles.bugCategory}>Category: {bug.category}</Text>
                  <Text style={styles.bugAffected}>Affected: {bug.affectedFeatures.join(', ')}</Text>
                  <View style={styles.bugSteps}>
                    <Text style={styles.bugStepsTitle}>Steps to Reproduce:</Text>
                    {bug.stepsToReproduce.map((step, i) => (
                      <Text key={i} style={styles.bugStep}>{i + 1}. {step}</Text>
                    ))}
                  </View>
                  <View style={styles.bugExpected}>
                    <Text style={styles.bugExpectedLabel}>Expected:</Text>
                    <Text style={styles.bugExpectedText}>{bug.expectedBehavior}</Text>
                  </View>
                  <View style={styles.bugActual}>
                    <Text style={styles.bugActualLabel}>Actual:</Text>
                    <Text style={styles.bugActualText}>{bug.actualBehavior}</Text>
                  </View>
                </View>
              ))}
            </View>
          )}

          {report.warnings.length > 0 && (
            <View style={styles.warningsContainer}>
              <Text style={styles.warningsTitle}>Warnings ({report.warnings.length})</Text>
              {report.warnings.map((warning, index) => (
                <View key={index} style={styles.warningCard}>
                  <Text style={styles.warningText}>{warning}</Text>
                </View>
              ))}
            </View>
          )}

          {report.bugs.length === 0 && report.warnings.length === 0 && (
            <View style={styles.successContainer}>
              <Text style={styles.successText}>✅ All tests passed! No bugs found.</Text>
            </View>
          )}
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0F172A',
    padding: 16,
  },
  header: {
    marginBottom: 16,
  },
  titleContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#FFF',
    flex: 1,
  },
  closeButton: {
    padding: 4,
  },
  button: {
    backgroundColor: '#10B981',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 8,
  },
  buttonDisabled: {
    backgroundColor: '#6B7280',
  },
  buttonText: {
    color: '#FFF',
    fontWeight: '600',
  },
  loadingContainer: {
    alignItems: 'center',
    padding: 32,
  },
  loadingText: {
    color: '#94A3B8',
    marginTop: 16,
  },
  resultsContainer: {
    flex: 1,
  },
  summaryCard: {
    backgroundColor: '#1E293B',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
  },
  summaryTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#FFF',
    marginBottom: 12,
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  summaryLabel: {
    color: '#94A3B8',
    fontSize: 16,
  },
  summaryValue: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: '600',
  },
  bugSummaryCard: {
    backgroundColor: '#1E293B',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
  },
  bugCountRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  bugCountBadge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
  },
  bugCountText: {
    color: '#FFF',
    fontWeight: '600',
    fontSize: 12,
  },
  bugsContainer: {
    marginBottom: 16,
  },
  bugsTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#FFF',
    marginBottom: 12,
  },
  bugCard: {
    backgroundColor: '#1E293B',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
  },
  bugHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
    gap: 8,
  },
  severityBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
  },
  severityText: {
    color: '#FFF',
    fontSize: 10,
    fontWeight: 'bold',
  },
  bugId: {
    color: '#94A3B8',
    fontSize: 12,
  },
  bugDescription: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 8,
  },
  bugCategory: {
    color: '#94A3B8',
    fontSize: 14,
    marginBottom: 4,
  },
  bugAffected: {
    color: '#94A3B8',
    fontSize: 14,
    marginBottom: 12,
  },
  bugSteps: {
    marginBottom: 12,
  },
  bugStepsTitle: {
    color: '#FFF',
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 4,
  },
  bugStep: {
    color: '#94A3B8',
    fontSize: 14,
    marginLeft: 8,
  },
  optionsContainer: {
    backgroundColor: '#1E293B',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#334155',
  },
  optionsTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#F1F5F9',
    marginBottom: 16,
  },
  optionRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  optionLabel: {
    fontSize: 14,
    color: '#CBD5E1',
    flex: 1,
  },
  toggle: {
    width: 60,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#334155',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#475569',
  },
  toggleActive: {
    backgroundColor: '#10B981',
    borderColor: '#059669',
  },
  toggleText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#94A3B8',
  },
  toggleTextActive: {
    color: '#FFFFFF',
  },
  speedButtons: {
    flexDirection: 'row',
    gap: 8,
  },
  speedButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: '#334155',
    borderWidth: 1,
    borderColor: '#475569',
  },
  speedButtonActive: {
    backgroundColor: '#3B82F6',
    borderColor: '#2563EB',
  },
  speedButtonText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#94A3B8',
  },
  speedButtonTextActive: {
    color: '#FFFFFF',
  },
  infoBox: {
    backgroundColor: '#1E3A5F',
    borderRadius: 8,
    padding: 12,
    marginTop: 8,
    borderWidth: 1,
    borderColor: '#3B82F6',
  },
  infoText: {
    fontSize: 12,
    color: '#93C5FD',
    lineHeight: 18,
    marginBottom: 2,
  },
  bugExpected: {
    marginBottom: 8,
  },
  bugExpectedLabel: {
    color: '#10B981',
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 4,
  },
  bugExpectedText: {
    color: '#94A3B8',
    fontSize: 14,
  },
  bugActual: {
    marginBottom: 8,
  },
  bugActualLabel: {
    color: '#EF4444',
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 4,
  },
  bugActualText: {
    color: '#94A3B8',
    fontSize: 14,
  },
  warningsContainer: {
    marginBottom: 16,
  },
  warningsTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#FFF',
    marginBottom: 12,
  },
  warningCard: {
    backgroundColor: '#1E293B',
    borderRadius: 12,
    padding: 16,
    marginBottom: 8,
  },
  warningText: {
    color: '#F59E0B',
    fontSize: 14,
  },
  successContainer: {
    backgroundColor: '#1E293B',
    borderRadius: 12,
    padding: 32,
    alignItems: 'center',
  },
  successText: {
    color: '#10B981',
    fontSize: 18,
    fontWeight: '600',
  },
});

