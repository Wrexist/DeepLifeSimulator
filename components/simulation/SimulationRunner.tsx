/**
 * React component for running app simulations
 */

import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator } from 'react-native';
import { useGame } from '@/contexts/GameContext';
import { AppSimulator, SimulationResult, APP_DEFINITIONS } from '@/lib/simulation/AppSimulator';
import { RealActionSimulator, RealActionResult } from '@/lib/simulation/RealActionSimulator';
import { logger } from '@/utils/logger';
import { responsivePadding, responsiveFontSize } from '@/utils/scaling';

interface SimulationRunnerProps {
  onComplete?: (results: SimulationResult[]) => void;
}

export default function SimulationRunner({ onComplete }: SimulationRunnerProps) {
  const { gameState, setGameState } = useGame();
  const [simulator, setSimulator] = useState<AppSimulator | null>(null);
  const [realActionSimulator, setRealActionSimulator] = useState<RealActionSimulator | null>(null);
  const [isRunning, setIsRunning] = useState(false);
  const [results, setResults] = useState<SimulationResult[]>([]);
  const [realActionResults, setRealActionResults] = useState<RealActionResult[]>([]);
  const [currentStep, setCurrentStep] = useState<string>('');
  const [progress, setProgress] = useState({ current: 0, total: 0, percentage: 0 });
  const [testMode, setTestMode] = useState<'ui' | 'real' | 'both'>('both');

  useEffect(() => {
    if (gameState && setGameState) {
      const sim = new AppSimulator(gameState);
      setSimulator(sim);
      
      const realSim = new RealActionSimulator(gameState, setGameState);
      setRealActionSimulator(realSim);
    }
  }, [gameState, setGameState]);

  const runSimulation = useCallback(async () => {
    if ((!simulator && testMode !== 'real') || (!realActionSimulator && testMode !== 'ui') || isRunning) return;

    setIsRunning(true);
    setResults([]);
    setRealActionResults([]);
    setCurrentStep('Initializing comprehensive simulation...');

    try {
      let totalSteps = 0;
      let currentStepNum = 0;
      const allResults: SimulationResult[] = [];
      const allRealResults: RealActionResult[] = [];

      // Run UI tests if enabled
      if (testMode === 'ui' || testMode === 'both') {
        if (simulator) {
          const steps = simulator.generateSimulationSteps();
          totalSteps += steps.length;

          for (let i = 0; i < steps.length; i++) {
            const step = steps[i];
            currentStepNum++;
            setCurrentStep(`UI Test: ${step.description}`);
            setProgress({
              current: currentStepNum,
              total: totalSteps,
              percentage: (currentStepNum / totalSteps) * 100,
            });

            const result = await simulator.simulateStep(step);
            allResults.push(result);
            setResults([...allResults]);

            await new Promise(resolve => setTimeout(resolve, 30));
          }
        }
      }

      // Run real action tests if enabled
      if (testMode === 'real' || testMode === 'both') {
        if (realActionSimulator) {
          const steps = realActionSimulator.generateRealActionSteps();
          totalSteps += steps.length;

          for (let i = 0; i < steps.length; i++) {
            const step = steps[i];
            currentStepNum++;
            setCurrentStep(`Real Action: ${step.description}`);
            setProgress({
              current: currentStepNum,
              total: totalSteps,
              percentage: (currentStepNum / totalSteps) * 100,
            });

            const result = await realActionSimulator.runStep(step);
            allRealResults.push(result);
            setRealActionResults([...allRealResults]);

            await new Promise(resolve => setTimeout(resolve, 50));
          }
        }
      }

      setResults(allResults);
      setRealActionResults(allRealResults);
      
      if (onComplete) {
        onComplete(allResults);
      }
    } catch (error) {
      logger.error('[SimulationRunner] Error:', error);
    } finally {
      setIsRunning(false);
      setCurrentStep('Complete');
    }
  }, [simulator, realActionSimulator, isRunning, onComplete, testMode]);

  // Calculate statistics from state arrays (updates in real-time)
  const calculateUIReport = () => {
    const passed = results.filter(r => r.success).length;
    const failed = results.filter(r => !r.success).length;
    const byApp: Record<string, { total: number; passed: number; failed: number }> = {};
    
    for (const result of results) {
      if (!byApp[result.appId]) {
        byApp[result.appId] = { total: 0, passed: 0, failed: 0 };
      }
      byApp[result.appId].total++;
      if (result.success) {
        byApp[result.appId].passed++;
      } else {
        byApp[result.appId].failed++;
      }
    }
    
    return {
      total: results.length,
      passed,
      failed,
      results,
      byApp,
    };
  };

  const calculateRealActionReport = () => {
    const passed = realActionResults.filter(r => r.success).length;
    const failed = realActionResults.filter(r => !r.success).length;
    const byCategory: Record<string, { total: number; passed: number; failed: number }> = {};
    
    if (realActionSimulator) {
      const steps = realActionSimulator.generateRealActionSteps();
      for (let i = 0; i < steps.length && i < realActionResults.length; i++) {
        const category = steps[i].category;
        if (!byCategory[category]) {
          byCategory[category] = { total: 0, passed: 0, failed: 0 };
        }
        byCategory[category].total++;
        if (realActionResults[i].success) {
          byCategory[category].passed++;
        } else {
          byCategory[category].failed++;
        }
      }
    }
    
    return {
      total: realActionResults.length,
      passed,
      failed,
      results: realActionResults,
      byCategory,
    };
  };

  const report = calculateUIReport();
  const realActionReport = calculateRealActionReport();
  const totalTests = report.total + realActionReport.total;
  const totalPassed = report.passed + realActionReport.passed;
  const totalFailed = report.failed + realActionReport.failed;

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Comprehensive Game Simulation</Text>
        <Text style={styles.subtitle}>
          {APP_DEFINITIONS.length} apps • {totalTests} total tests
        </Text>
        
        <View style={styles.modeSelector}>
          <TouchableOpacity
            style={[styles.modeButton, testMode === 'ui' && styles.modeButtonActive]}
            onPress={() => setTestMode('ui')}
          >
            <Text 
              style={[styles.modeButtonText, testMode === 'ui' && styles.modeButtonTextActive]}
              numberOfLines={1}
              adjustsFontSizeToFit={true}
              minimumFontScale={0.8}
            >
              UI Tests
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.modeButton, testMode === 'real' && styles.modeButtonActive]}
            onPress={() => setTestMode('real')}
          >
            <Text 
              style={[styles.modeButtonText, testMode === 'real' && styles.modeButtonTextActive]}
              numberOfLines={1}
              adjustsFontSizeToFit={true}
              minimumFontScale={0.8}
            >
              Real Actions
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.modeButton, testMode === 'both' && styles.modeButtonActive]}
            onPress={() => setTestMode('both')}
          >
            <Text 
              style={[styles.modeButtonText, testMode === 'both' && styles.modeButtonTextActive]}
              numberOfLines={1}
              adjustsFontSizeToFit={true}
              minimumFontScale={0.8}
            >
              Both
            </Text>
          </TouchableOpacity>
        </View>
      </View>

      {isRunning && (
        <View style={styles.progressContainer}>
          <View style={styles.progressBar}>
            <View style={[styles.progressFill, { width: `${progress.percentage}%` }]} />
          </View>
          <Text style={styles.progressText}>
            {progress.current} / {progress.total} ({Math.round(progress.percentage)}%)
          </Text>
          <Text style={styles.currentStep}>{currentStep}</Text>
          <ActivityIndicator size="small" color="#10B981" style={styles.loader} />
        </View>
      )}

      {!isRunning && results.length === 0 && (
        <View style={styles.startContainer}>
          <Text style={styles.startText}>
            Click &quot;Run Simulation&quot; to test all apps and features
          </Text>
          <TouchableOpacity
            style={styles.runButton}
            onPress={runSimulation}
            disabled={!simulator}
          >
            <Text style={styles.runButtonText}>Run Simulation</Text>
          </TouchableOpacity>
        </View>
      )}

      {((results.length > 0 || realActionResults.length > 0) || isRunning) && (
        <View style={styles.resultsContainer}>
          <View style={styles.summary}>
            <View style={styles.summaryItem}>
              <Text style={styles.summaryLabel}>Total</Text>
              <Text style={styles.summaryValue}>{totalTests}</Text>
            </View>
            <View style={styles.summaryItem}>
              <Text style={[styles.summaryLabel, styles.passed]}>Passed</Text>
              <Text style={[styles.summaryValue, styles.passed]}>{totalPassed}</Text>
            </View>
            <View style={styles.summaryItem}>
              <Text style={[styles.summaryLabel, styles.failed]}>Failed</Text>
              <Text style={[styles.summaryValue, styles.failed]}>{totalFailed}</Text>
            </View>
            <View style={styles.summaryItem}>
              <Text style={styles.summaryLabel}>Success Rate</Text>
              <Text style={styles.summaryValue}>
                {totalTests > 0 ? Math.round((totalPassed / totalTests) * 100) : 0}%
              </Text>
            </View>
          </View>

          {/* Real Action Results by Category */}
          {realActionResults.length > 0 && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Real Action Tests by Category</Text>
              {Object.entries(realActionReport.byCategory).map(([category, stats]) => (
                <View key={category} style={styles.categoryResult}>
                  <Text style={styles.categoryName}>{category.toUpperCase()}</Text>
                  <View style={styles.categoryStats}>
                    <Text style={[styles.categoryStatText, styles.passed]}>
                      ✓ {stats.passed}
                    </Text>
                    {stats.failed > 0 && (
                      <Text style={[styles.categoryStatText, styles.failed]}>
                        ✗ {stats.failed}
                      </Text>
                    )}
                    <Text style={styles.categoryStatText}>
                      {stats.total} total
                    </Text>
                  </View>
                </View>
              ))}
            </View>
          )}

          <ScrollView style={styles.resultsList}>
            {/* Real Action Failures */}
            {realActionResults.filter(r => !r.success).length > 0 && (
              <View style={styles.allFailuresContainer}>
                <Text style={styles.allFailuresTitle}>
                  Real Action Failures ({realActionResults.filter(r => !r.success).length})
                </Text>
                {realActionResults
                  .filter(r => !r.success)
                  .map((result, idx) => {
                    const step = realActionSimulator?.generateRealActionSteps()[idx];
                    return (
                      <View key={idx} style={styles.detailedFailure}>
                        <Text style={styles.detailedFailureApp}>
                          {step?.category || 'Unknown'} - {step?.action || 'Unknown'}
                        </Text>
                        <Text style={styles.detailedFailureFeature}>
                          {step?.description || 'No description'}
                        </Text>
                        {result.error && (
                          <Text style={styles.detailedFailureError}>
                            Error: {result.error}
                          </Text>
                        )}
                        {result.details && (
                          <Text style={styles.detailedFailureTime}>
                            {result.details}
                          </Text>
                        )}
                      </View>
                    );
                  })}
              </View>
            )}

            {/* UI Test Results */}
            {Object.entries(report.byApp).map(([appId, stats]) => {
              const app = APP_DEFINITIONS.find(a => a.id === appId);
              const appResults = report.results.filter(r => r.appId === appId);
              const failedResults = appResults.filter(r => !r.success);
              
              return (
                <View key={appId} style={styles.appResult}>
                  <View style={styles.appHeader}>
                    <Text style={styles.appName}>{app?.name || appId}</Text>
                    <View style={styles.appStats}>
                      <Text style={[styles.appStatText, styles.passed]}>
                        ✓ {stats.passed}
                      </Text>
                      {stats.failed > 0 && (
                        <Text style={[styles.appStatText, styles.failed]}>
                          ✗ {stats.failed}
                        </Text>
                      )}
                      <Text style={styles.appStatText}>
                        {stats.total} total
                      </Text>
                    </View>
                  </View>
                  
                  {failedResults.length > 0 && (
                    <View style={styles.failuresContainer}>
                      <Text style={styles.failuresTitle}>Failures:</Text>
                      {failedResults.map((result, idx) => (
                        <View key={idx} style={styles.failureItem}>
                          <Text style={styles.failureAction}>
                            {result.feature} → {result.action}
                          </Text>
                          {result.error && (
                            <Text style={styles.failureError}>
                              {result.error}
                            </Text>
                          )}
                          <Text style={styles.failureDuration}>
                            Duration: {result.duration}ms
                          </Text>
                        </View>
                      ))}
                    </View>
                  )}
                  
                  <View style={styles.appProgressBar}>
                    <View 
                      style={[
                        styles.appProgressFill, 
                        { 
                          width: `${stats.total > 0 ? (stats.passed / stats.total) * 100 : 0}%` 
                        }
                      ]} 
                    />
                  </View>
                </View>
              );
            })}
            
            {report.failed > 0 && (
              <View style={styles.allFailuresContainer}>
                <Text style={styles.allFailuresTitle}>
                  All Failed Tests ({report.failed})
                </Text>
                {report.results
                  .filter(r => !r.success)
                  .map((result, idx) => {
                    const app = APP_DEFINITIONS.find(a => a.id === result.appId);
                    return (
                      <View key={idx} style={styles.detailedFailure}>
                        <Text style={styles.detailedFailureApp}>
                          {app?.name || result.appId}
                        </Text>
                        <Text style={styles.detailedFailureFeature}>
                          Feature: {result.feature} | Action: {result.action}
                        </Text>
                        {result.error && (
                          <Text style={styles.detailedFailureError}>
                            Error: {result.error}
                          </Text>
                        )}
                        <Text style={styles.detailedFailureTime}>
                          Time: {new Date(result.timestamp).toLocaleTimeString()} | 
                          Duration: {result.duration}ms
                        </Text>
                      </View>
                    );
                  })}
              </View>
            )}
          </ScrollView>

          {!isRunning && (
            <TouchableOpacity
              style={styles.runButton}
              onPress={runSimulation}
            >
              <Text style={styles.runButtonText}>Run Again</Text>
            </TouchableOpacity>
          )}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#1F2937',
    padding: responsivePadding.medium,
  },
  header: {
    marginBottom: 20,
  },
  title: {
    fontSize: responsiveFontSize['2xl'],
    fontWeight: 'bold',
    color: '#FFFFFF',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: responsiveFontSize.base,
    color: '#9CA3AF',
  },
  progressContainer: {
    backgroundColor: '#111827',
    borderRadius: 12,
    padding: 20,
    marginBottom: 20,
  },
  progressBar: {
    height: 8,
    backgroundColor: '#374151',
    borderRadius: 4,
    overflow: 'hidden',
    marginBottom: 12,
  },
  progressFill: {
    height: '100%',
    backgroundColor: '#10B981',
  },
  progressText: {
    fontSize: responsiveFontSize.base,
    color: '#D1D5DB',
    marginBottom: 8,
  },
  currentStep: {
    fontSize: responsiveFontSize.xs,
    color: '#9CA3AF',
    fontStyle: 'italic',
  },
  loader: {
    marginTop: 12,
  },
  startContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 40,
  },
  startText: {
    fontSize: responsiveFontSize.lg,
    color: '#9CA3AF',
    marginBottom: 20,
    textAlign: 'center',
  },
  runButton: {
    backgroundColor: '#10B981',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
  },
  runButtonText: {
    color: '#FFFFFF',
    fontSize: responsiveFontSize.lg,
    fontWeight: '600',
  },
  resultsContainer: {
    flex: 1,
  },
  summary: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    backgroundColor: '#111827',
    borderRadius: 12,
    padding: 16,
    marginBottom: 20,
  },
  summaryItem: {
    alignItems: 'center',
  },
  summaryLabel: {
    fontSize: responsiveFontSize.xs,
    color: '#9CA3AF',
    marginBottom: 4,
  },
  summaryValue: {
    fontSize: responsiveFontSize['2xl'],
    fontWeight: 'bold',
    color: '#FFFFFF',
  },
  passed: {
    color: '#10B981',
  },
  failed: {
    color: '#EF4444',
  },
  resultsList: {
    flex: 1,
  },
  appResult: {
    backgroundColor: '#111827',
    borderRadius: 8,
    padding: 16,
    marginBottom: 12,
  },
  appHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  appName: {
    fontSize: responsiveFontSize.lg,
    fontWeight: '600',
    color: '#FFFFFF',
    flex: 1,
  },
  appStats: {
    flexDirection: 'row',
    gap: 12,
    alignItems: 'center',
  },
  appStatText: {
    fontSize: responsiveFontSize.sm,
    color: '#D1D5DB',
  },
  appProgressBar: {
    height: 4,
    backgroundColor: '#374151',
    borderRadius: 2,
    overflow: 'hidden',
    marginTop: 8,
  },
  appProgressFill: {
    height: '100%',
    backgroundColor: '#10B981',
  },
  failuresContainer: {
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#374151',
  },
  failuresTitle: {
    fontSize: responsiveFontSize.sm,
    fontWeight: '600',
    color: '#EF4444',
    marginBottom: 8,
  },
  failureItem: {
    backgroundColor: '#1F2937',
    borderRadius: 6,
    padding: 10,
    marginBottom: 8,
  },
  failureAction: {
    fontSize: responsiveFontSize.xs,
    color: '#FCA5A5',
    marginBottom: 4,
  },
  failureError: {
    fontSize: responsiveFontSize.xs,
    color: '#EF4444',
    fontFamily: 'monospace',
    marginTop: 4,
  },
  failureDuration: {
    fontSize: responsiveFontSize.xs,
    color: '#9CA3AF',
    marginTop: 4,
  },
  allFailuresContainer: {
    marginTop: 20,
    padding: 16,
    backgroundColor: '#1F2937',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#EF4444',
  },
  allFailuresTitle: {
    fontSize: responsiveFontSize.lg,
    fontWeight: 'bold',
    color: '#EF4444',
    marginBottom: 12,
  },
  detailedFailure: {
    backgroundColor: '#111827',
    borderRadius: 6,
    padding: 12,
    marginBottom: 10,
    borderLeftWidth: 3,
    borderLeftColor: '#EF4444',
  },
  detailedFailureApp: {
    fontSize: responsiveFontSize.base,
    fontWeight: '600',
    color: '#FFFFFF',
    marginBottom: 4,
  },
  detailedFailureFeature: {
    fontSize: responsiveFontSize.sm,
    color: '#D1D5DB',
    marginBottom: 4,
  },
  detailedFailureError: {
    fontSize: responsiveFontSize.sm,
    color: '#EF4444',
    fontFamily: 'monospace',
    marginTop: 6,
    marginBottom: 4,
  },
  detailedFailureTime: {
    fontSize: responsiveFontSize.xs,
    color: '#9CA3AF',
    marginTop: 4,
  },
  modeSelector: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 12,
    flexWrap: 'wrap',
  },
  modeButton: {
    flex: 1,
    minWidth: 100,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 6,
    backgroundColor: '#374151',
    borderWidth: 1,
    borderColor: '#4B5563',
    alignItems: 'center',
    justifyContent: 'center',
  },
  modeButtonActive: {
    backgroundColor: '#10B981',
    borderColor: '#10B981',
  },
  modeButtonText: {
    fontSize: responsiveFontSize.sm,
    color: '#9CA3AF',
    fontWeight: '600',
    textAlign: 'center',
  },
  modeButtonTextActive: {
    color: '#FFFFFF',
  },
  section: {
    marginTop: 20,
    marginBottom: 20,
  },
  sectionTitle: {
    fontSize: responsiveFontSize.lg,
    fontWeight: 'bold',
    color: '#FFFFFF',
    marginBottom: 12,
  },
  categoryResult: {
    backgroundColor: '#111827',
    borderRadius: 8,
    padding: 12,
    marginBottom: 8,
  },
  categoryName: {
    fontSize: responsiveFontSize.base,
    fontWeight: '600',
    color: '#FFFFFF',
    marginBottom: 6,
    textTransform: 'capitalize',
  },
  categoryStats: {
    flexDirection: 'row',
    gap: 12,
  },
  categoryStatText: {
    fontSize: responsiveFontSize.sm,
    color: '#D1D5DB',
  },
});

