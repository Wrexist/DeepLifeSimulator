/**
 * AI Debug Menu Component
 * In-game debug interface for AI-assisted debugging
 * 
 * Features:
 * - Copy debug snapshots for AI analysis
 * - Run integrity checks
 * - Run fuzz test demos
 * - AI crash analysis prompt template
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
} from 'react-native';
import * as Clipboard from 'expo-clipboard';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
import {
  X,
  Copy,
  Shield,
  Bug,
  Zap,
  FileText,
  AlertTriangle,
  CheckCircle,
  ChevronDown,
  ChevronUp,
  Database,
  Activity,
} from 'lucide-react-native';
import { useGame } from '@/contexts/GameContext';
import { createDebugSnapshot, createQuickSnapshot, createFocusedSnapshot } from '@/src/debug/aiDebugSnapshot';
import { runIntegrityChecks, IntegrityReport, formatReportAsText } from '@/src/debug/aiIntegrityChecks';
import { runFuzz, FuzzResult } from '@/src/debug/fuzzEngine';
import { scale, fontScale, responsivePadding, responsiveBorderRadius, responsiveSpacing } from '@/utils/scaling';

interface AIDebugMenuProps {
  visible: boolean;
  onClose: () => void;
}

// AI Crash analysis prompt template
const CRASH_ANALYSIS_PROMPT = `You are a senior TypeScript and React Native engineer specializing in game development.

I will provide you with:
1. A debug snapshot JSON from my life simulation game (includes logs, game state, async storage, performance metrics, and errors)
2. The crash stack trace or error message
3. Relevant source files

Your task:
1. Identify the earliest ROOT CAUSE of the failure, not just where it crashes
2. Explain which state transitions, race conditions, or unhandled async flows likely led to the problem
3. Point out missing guards, null checks, or unsafe assumptions
4. Suggest exact code changes in diff format for each affected file
5. Propose permanent protections (invariant checks, runtime assertions, or tests)

Output format:
- Short root cause summary (2-4 bullet points)
- Detailed reasoning with clear chain of logic
- Code patches in diff format
- Suggested tests to prevent regression

=== DEBUG SNAPSHOT ===
[Paste snapshot JSON here]

=== ERROR/CRASH ===
[Paste error message or stack trace here]

=== RELEVANT CODE ===
[Paste relevant source files here]
`;

export default function AIDebugMenu({ visible, onClose }: AIDebugMenuProps) {
  const { gameState } = useGame();
  const darkMode = gameState?.settings?.darkMode ?? true;
  
  const [status, setStatus] = useState<string>('Ready');
  const [isLoading, setIsLoading] = useState(false);
  const [lastResult, setLastResult] = useState<string>('');
  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({
    snapshot: true,
    integrity: false,
    fuzz: false,
    prompt: false,
  });

  const toggleSection = useCallback((section: string) => {
    setExpandedSections(prev => ({ ...prev, [section]: !prev[section] }));
  }, []);

  // === Snapshot Actions ===
  const handleCopyFullSnapshot = useCallback(async () => {
    try {
      setIsLoading(true);
      setStatus('Creating full snapshot...');
      const snapshot = await createDebugSnapshot();
      const json = JSON.stringify(snapshot, null, 2);
      await Clipboard.setStringAsync(json);
      const sizeKb = (json.length / 1024).toFixed(1);
      setLastResult(`✅ Full snapshot copied to clipboard (${sizeKb} KB)\n\nPaste into AI assistant for analysis.`);
      setStatus('Ready');
      Alert.alert('Success', 'Debug snapshot copied to clipboard.\n\nPaste into Claude or ChatGPT for analysis.');
    } catch (err) {
      setStatus('Error');
      setLastResult(`❌ Failed to create snapshot: ${String(err)}`);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const handleCopyQuickSnapshot = useCallback(async () => {
    try {
      setIsLoading(true);
      setStatus('Creating quick snapshot...');
      const snapshot = await createQuickSnapshot();
      const json = JSON.stringify(snapshot, null, 2);
      await Clipboard.setStringAsync(json);
      const sizeKb = (json.length / 1024).toFixed(1);
      setLastResult(`✅ Quick snapshot copied (${sizeKb} KB)\n\nContains: meta, critical state, errors.`);
      setStatus('Ready');
    } catch (err) {
      setStatus('Error');
      setLastResult(`❌ Error: ${String(err)}`);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const handleCopyStateOnly = useCallback(async () => {
    try {
      setIsLoading(true);
      setStatus('Copying game state...');
      const snapshot = await createFocusedSnapshot('state');
      const json = JSON.stringify(snapshot, null, 2);
      await Clipboard.setStringAsync(json);
      const sizeKb = (json.length / 1024).toFixed(1);
      setLastResult(`✅ Game state copied (${sizeKb} KB)`);
      setStatus('Ready');
    } catch (err) {
      setLastResult(`❌ Error: ${String(err)}`);
      setStatus('Error');
    } finally {
      setIsLoading(false);
    }
  }, []);

  const handleCopyLogsOnly = useCallback(async () => {
    try {
      setIsLoading(true);
      setStatus('Copying logs...');
      const snapshot = await createFocusedSnapshot('logs');
      const json = JSON.stringify(snapshot, null, 2);
      await Clipboard.setStringAsync(json);
      const sizeKb = (json.length / 1024).toFixed(1);
      setLastResult(`✅ Logs copied (${sizeKb} KB)`);
      setStatus('Ready');
    } catch (err) {
      setLastResult(`❌ Error: ${String(err)}`);
      setStatus('Error');
    } finally {
      setIsLoading(false);
    }
  }, []);

  // === Integrity Actions ===
  const handleRunIntegrity = useCallback(async () => {
    setIsLoading(true);
    setStatus('Running integrity checks...');
    
    try {
      const report = runIntegrityChecks(gameState);
      
      const resultLines = [
        report.passRate === 100 ? '✅ ALL CHECKS PASSED' : `⚠️ Issues Found`,
        '',
        `Pass Rate: ${report.passRate}% (${report.passedChecks}/${report.totalChecks})`,
        '',
        `Critical: ${report.summary.critical}`,
        `High: ${report.summary.high}`,
        `Medium: ${report.summary.medium}`,
        `Low: ${report.summary.low}`,
      ];
      
      if (report.issues.length > 0) {
        resultLines.push('', '─── Top Issues ───');
        report.issues.slice(0, 5).forEach((issue, i) => {
          resultLines.push(`${i + 1}. [${issue.severity.toUpperCase()}] ${issue.message}`);
          if (issue.suggestedFix) {
            resultLines.push(`   → ${issue.suggestedFix}`);
          }
        });
        
        if (report.issues.length > 5) {
          resultLines.push(`\n... and ${report.issues.length - 5} more issues`);
        }
      }
      
      setLastResult(resultLines.join('\n'));
      setStatus('Ready');
    } catch (err) {
      setLastResult(`❌ Error running checks: ${String(err)}`);
      setStatus('Error');
    } finally {
      setIsLoading(false);
    }
  }, [gameState]);

  const handleCopyIntegrityReport = useCallback(async () => {
    try {
      setIsLoading(true);
      setStatus('Generating integrity report...');
      const report = runIntegrityChecks(gameState);
      const json = JSON.stringify(report, null, 2);
      await Clipboard.setStringAsync(json);
      setLastResult(`✅ Integrity report copied (${report.issues.length} issues found)`);
      setStatus('Ready');
    } catch (err) {
      setLastResult(`❌ Error: ${String(err)}`);
      setStatus('Error');
    } finally {
      setIsLoading(false);
    }
  }, [gameState]);

  const handleCopyIntegrityText = useCallback(async () => {
    try {
      setIsLoading(true);
      setStatus('Generating report...');
      const report = runIntegrityChecks(gameState);
      const text = formatReportAsText(report);
      await Clipboard.setStringAsync(text);
      setLastResult(`✅ Text report copied`);
      setStatus('Ready');
    } catch (err) {
      setLastResult(`❌ Error: ${String(err)}`);
      setStatus('Error');
    } finally {
      setIsLoading(false);
    }
  }, [gameState]);

  // === Fuzz Testing Actions ===
  const handleRunFuzzDemo = useCallback(async () => {
    setIsLoading(true);
    setStatus('Running fuzz test (500 steps)...');

    try {
      // Demo fuzz test with game-like state
      type DemoState = { 
        age: number; 
        money: number; 
        health: number; 
        happiness: number;
        energy: number;
        jailWeeks: number;
      };
      
      type DemoEvent =
        | { type: 'ageUp'; years: number }
        | { type: 'earn'; amount: number }
        | { type: 'spend'; amount: number }
        | { type: 'heal'; amount: number }
        | { type: 'damage'; amount: number }
        | { type: 'rest'; amount: number }
        | { type: 'tire'; amount: number }
        | { type: 'goToJail'; weeks: number }
        | { type: 'serveJail' };

      const result = runFuzz<DemoState, DemoEvent>({
        initialStateFactory: () => ({ 
          age: 18, 
          money: 200, 
          health: 100, 
          happiness: 100,
          energy: 100,
          jailWeeks: 0,
        }),
        randomEventFactory: () => {
          const r = Math.random();
          if (r < 0.10) return { type: 'ageUp', years: 1 };
          if (r < 0.25) return { type: 'earn', amount: Math.floor(Math.random() * 1000) };
          if (r < 0.40) return { type: 'spend', amount: Math.floor(Math.random() * 500) };
          if (r < 0.50) return { type: 'heal', amount: Math.floor(Math.random() * 20) };
          if (r < 0.60) return { type: 'damage', amount: Math.floor(Math.random() * 30) };
          if (r < 0.75) return { type: 'rest', amount: Math.floor(Math.random() * 40) };
          if (r < 0.90) return { type: 'tire', amount: Math.floor(Math.random() * 25) };
          if (r < 0.95) return { type: 'goToJail', weeks: Math.floor(Math.random() * 4) + 1 };
          return { type: 'serveJail' };
        },
        applyEvent: (state, event) => {
          switch (event.type) {
            case 'ageUp':
              return { ...state, age: state.age + event.years };
            case 'earn':
              return { ...state, money: state.money + event.amount };
            case 'spend':
              return { ...state, money: state.money - event.amount };
            case 'heal':
              return { ...state, health: Math.min(100, state.health + event.amount) };
            case 'damage':
              return { ...state, health: Math.max(0, state.health - event.amount) };
            case 'rest':
              return { ...state, energy: Math.min(100, state.energy + event.amount) };
            case 'tire':
              return { ...state, energy: Math.max(0, state.energy - event.amount) };
            case 'goToJail':
              return { ...state, jailWeeks: state.jailWeeks + event.weeks };
            case 'serveJail':
              return { ...state, jailWeeks: Math.max(0, state.jailWeeks - 1) };
            default:
              return state;
          }
        },
        invariants: [
          { name: 'age-non-negative', check: (s) => s.age >= 0 },
          { name: 'health-range', check: (s) => s.health >= 0 && s.health <= 100 },
          { name: 'energy-range', check: (s) => s.energy >= 0 && s.energy <= 100 },
          { name: 'money-is-finite', check: (s) => Number.isFinite(s.money) },
          { name: 'jailWeeks-non-negative', check: (s) => s.jailWeeks >= 0 },
        ],
        steps: 500,
      });

      const resultLines = [
        result.ok ? '✅ FUZZ TEST PASSED' : '❌ FUZZ TEST FAILED',
        '',
        `Steps completed: ${result.stepsRun}`,
        `Duration: ${result.duration}ms`,
        `Seed: ${result.seed}`,
      ];
      
      if (!result.ok) {
        resultLines.push(
          '',
          '─── Failure Details ───',
          `Failed at step: ${result.failedAtStep}`,
          `Invariant violated: ${result.failingInvariant}`,
          `Last event: ${JSON.stringify(result.lastEvent)}`,
          '',
          'State at failure:',
          JSON.stringify(result.stateSnapshot, null, 2),
        );
      } else {
        resultLines.push(
          '',
          'All 5 invariants held for 500 random events!',
        );
      }
      
      setLastResult(resultLines.join('\n'));
      setStatus('Ready');
    } catch (err) {
      setLastResult(`❌ Fuzz test error: ${String(err)}`);
      setStatus('Error');
    } finally {
      setIsLoading(false);
    }
  }, []);

  // === Prompt Actions ===
  const handleCopyPrompt = useCallback(async () => {
    try {
      await Clipboard.setStringAsync(CRASH_ANALYSIS_PROMPT);
      setLastResult('✅ AI crash analysis prompt copied to clipboard');
      Alert.alert('Copied', 'Paste this prompt template into Claude or ChatGPT, then add your snapshot and error details.');
    } catch (err) {
      setLastResult(`❌ Error: ${String(err)}`);
    }
  }, []);

  const styles = useMemo(() => createStyles(darkMode), [darkMode]);

  if (!visible) return null;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <BlurView intensity={20} style={styles.overlay}>
        <View style={styles.modal}>
          {/* Header */}
          <View style={styles.header}>
            <View style={styles.titleRow}>
              <Bug size={scale(24)} color={darkMode ? '#818CF8' : '#4F46E5'} />
              <Text style={styles.title}>AI Debug Suite</Text>
            </View>
            <TouchableOpacity onPress={onClose} style={styles.closeButton}>
              <X size={scale(24)} color={darkMode ? '#9CA3AF' : '#6B7280'} />
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
            {/* Status Bar */}
            <View style={styles.statusBar}>
              {isLoading && <ActivityIndicator size="small" color="#818CF8" style={{ marginRight: scale(8) }} />}
              <Text style={styles.statusText}>Status: {status}</Text>
            </View>

            {/* === Snapshot Section === */}
            <View style={styles.section}>
              <TouchableOpacity 
                style={styles.sectionHeader}
                onPress={() => toggleSection('snapshot')}
              >
                <View style={styles.sectionTitleRow}>
                  <Copy size={scale(18)} color={darkMode ? '#10B981' : '#059669'} />
                  <Text style={styles.sectionTitle}>Debug Snapshots</Text>
                </View>
                {expandedSections.snapshot ? (
                  <ChevronUp size={scale(18)} color={darkMode ? '#9CA3AF' : '#6B7280'} />
                ) : (
                  <ChevronDown size={scale(18)} color={darkMode ? '#9CA3AF' : '#6B7280'} />
                )}
              </TouchableOpacity>
              
              {expandedSections.snapshot && (
                <View style={styles.sectionContent}>
                  <Text style={styles.sectionDesc}>
                    Copy game state, logs, and metrics for AI analysis
                  </Text>
                  <View style={styles.buttonGrid}>
                    <DebugButton
                      label="Full Snapshot"
                      icon={<FileText size={scale(16)} color="#FFF" />}
                      onPress={handleCopyFullSnapshot}
                      disabled={isLoading}
                      colors={['#10B981', '#059669']}
                      darkMode={darkMode}
                    />
                    <DebugButton
                      label="Quick Snapshot"
                      icon={<Zap size={scale(16)} color="#FFF" />}
                      onPress={handleCopyQuickSnapshot}
                      disabled={isLoading}
                      colors={['#3B82F6', '#1D4ED8']}
                      darkMode={darkMode}
                    />
                    <DebugButton
                      label="State Only"
                      icon={<Database size={scale(16)} color="#FFF" />}
                      onPress={handleCopyStateOnly}
                      disabled={isLoading}
                      colors={['#8B5CF6', '#7C3AED']}
                      darkMode={darkMode}
                    />
                    <DebugButton
                      label="Logs Only"
                      icon={<Activity size={scale(16)} color="#FFF" />}
                      onPress={handleCopyLogsOnly}
                      disabled={isLoading}
                      colors={['#F59E0B', '#D97706']}
                      darkMode={darkMode}
                    />
                  </View>
                </View>
              )}
            </View>

            {/* === Integrity Section === */}
            <View style={styles.section}>
              <TouchableOpacity 
                style={styles.sectionHeader}
                onPress={() => toggleSection('integrity')}
              >
                <View style={styles.sectionTitleRow}>
                  <Shield size={scale(18)} color={darkMode ? '#F59E0B' : '#D97706'} />
                  <Text style={styles.sectionTitle}>Integrity Checks</Text>
                </View>
                {expandedSections.integrity ? (
                  <ChevronUp size={scale(18)} color={darkMode ? '#9CA3AF' : '#6B7280'} />
                ) : (
                  <ChevronDown size={scale(18)} color={darkMode ? '#9CA3AF' : '#6B7280'} />
                )}
              </TouchableOpacity>
              
              {expandedSections.integrity && (
                <View style={styles.sectionContent}>
                  <Text style={styles.sectionDesc}>
                    Validate game state for bugs and inconsistencies
                  </Text>
                  <View style={styles.buttonGrid}>
                    <DebugButton
                      label="Run Checks"
                      icon={<CheckCircle size={scale(16)} color="#FFF" />}
                      onPress={handleRunIntegrity}
                      disabled={isLoading}
                      colors={['#F59E0B', '#D97706']}
                      darkMode={darkMode}
                    />
                    <DebugButton
                      label="Copy JSON"
                      icon={<Copy size={scale(16)} color="#FFF" />}
                      onPress={handleCopyIntegrityReport}
                      disabled={isLoading}
                      colors={['#8B5CF6', '#7C3AED']}
                      darkMode={darkMode}
                    />
                    <DebugButton
                      label="Copy Text"
                      icon={<FileText size={scale(16)} color="#FFF" />}
                      onPress={handleCopyIntegrityText}
                      disabled={isLoading}
                      colors={['#6366F1', '#4F46E5']}
                      darkMode={darkMode}
                      fullWidth
                    />
                  </View>
                </View>
              )}
            </View>

            {/* === Fuzz Testing Section === */}
            <View style={styles.section}>
              <TouchableOpacity 
                style={styles.sectionHeader}
                onPress={() => toggleSection('fuzz')}
              >
                <View style={styles.sectionTitleRow}>
                  <Zap size={scale(18)} color={darkMode ? '#EF4444' : '#DC2626'} />
                  <Text style={styles.sectionTitle}>Fuzz Testing</Text>
                </View>
                {expandedSections.fuzz ? (
                  <ChevronUp size={scale(18)} color={darkMode ? '#9CA3AF' : '#6B7280'} />
                ) : (
                  <ChevronDown size={scale(18)} color={darkMode ? '#9CA3AF' : '#6B7280'} />
                )}
              </TouchableOpacity>
              
              {expandedSections.fuzz && (
                <View style={styles.sectionContent}>
                  <Text style={styles.sectionDesc}>
                    Stress-test game logic with random events to find edge cases
                  </Text>
                  <View style={styles.buttonGrid}>
                    <DebugButton
                      label="Run Demo Fuzz (500 steps)"
                      icon={<Bug size={scale(16)} color="#FFF" />}
                      onPress={handleRunFuzzDemo}
                      disabled={isLoading}
                      colors={['#EF4444', '#DC2626']}
                      darkMode={darkMode}
                      fullWidth
                    />
                  </View>
                </View>
              )}
            </View>

            {/* === AI Prompt Section === */}
            <View style={styles.section}>
              <TouchableOpacity 
                style={styles.sectionHeader}
                onPress={() => toggleSection('prompt')}
              >
                <View style={styles.sectionTitleRow}>
                  <AlertTriangle size={scale(18)} color={darkMode ? '#F97316' : '#EA580C'} />
                  <Text style={styles.sectionTitle}>AI Crash Analysis</Text>
                </View>
                {expandedSections.prompt ? (
                  <ChevronUp size={scale(18)} color={darkMode ? '#9CA3AF' : '#6B7280'} />
                ) : (
                  <ChevronDown size={scale(18)} color={darkMode ? '#9CA3AF' : '#6B7280'} />
                )}
              </TouchableOpacity>
              
              {expandedSections.prompt && (
                <View style={styles.sectionContent}>
                  <Text style={styles.promptText}>
                    How to use:{'\n'}
                    1. Copy "Full Snapshot" above{'\n'}
                    2. Copy the prompt template below{'\n'}
                    3. Paste both into Claude/ChatGPT{'\n'}
                    4. Add your error message or crash log{'\n'}
                    5. Get AI-powered root cause analysis
                  </Text>
                  <DebugButton
                    label="Copy Prompt Template"
                    icon={<Copy size={scale(16)} color="#FFF" />}
                    onPress={handleCopyPrompt}
                    disabled={isLoading}
                    colors={['#F97316', '#EA580C']}
                    darkMode={darkMode}
                    fullWidth
                  />
                </View>
              )}
            </View>

            {/* === Results === */}
            {lastResult && (
              <View style={styles.resultSection}>
                <Text style={styles.resultTitle}>Last Result</Text>
                <ScrollView style={styles.resultBox} nestedScrollEnabled>
                  <Text style={styles.resultText}>{lastResult}</Text>
                </ScrollView>
              </View>
            )}

            {/* Footer */}
            <View style={styles.footer}>
              <Text style={styles.footerText}>
                AI Debug Suite v1.0 • State v{gameState?.version || '?'}
              </Text>
            </View>
          </ScrollView>
        </View>
      </BlurView>
    </Modal>
  );
}

// === Button Component ===
interface DebugButtonProps {
  label: string;
  icon: React.ReactNode;
  onPress: () => void;
  disabled?: boolean;
  colors: [string, string];
  darkMode: boolean;
  fullWidth?: boolean;
}

function DebugButton({ label, icon, onPress, disabled, colors, darkMode, fullWidth }: DebugButtonProps) {
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
    width: '48%',
    borderRadius: responsiveBorderRadius.md,
    overflow: 'hidden',
    marginBottom: scale(8),
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
    paddingVertical: scale(12),
    paddingHorizontal: scale(12),
    gap: scale(6),
  },
  label: {
    color: '#FFFFFF',
    fontSize: fontScale(13),
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
      padding: responsivePadding.large,
      backgroundColor: 'rgba(0,0,0,0.5)',
    },
    modal: {
      backgroundColor: darkMode ? '#1F2937' : '#FFFFFF',
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
      borderBottomColor: darkMode ? '#374151' : '#E5E7EB',
      backgroundColor: darkMode ? '#111827' : '#F9FAFB',
    },
    titleRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: scale(10),
    },
    title: {
      fontSize: fontScale(20),
      fontWeight: 'bold',
      color: darkMode ? '#F9FAFB' : '#1F2937',
    },
    closeButton: {
      padding: scale(4),
    },
    content: {
      padding: responsivePadding.large,
    },
    statusBar: {
      flexDirection: 'row',
      alignItems: 'center',
      marginBottom: scale(16),
      padding: scale(12),
      backgroundColor: darkMode ? '#374151' : '#F3F4F6',
      borderRadius: responsiveBorderRadius.md,
    },
    statusText: {
      color: darkMode ? '#D1D5DB' : '#4B5563',
      fontSize: fontScale(14),
      fontWeight: '500',
    },
    section: {
      marginBottom: scale(12),
      backgroundColor: darkMode ? '#111827' : '#F9FAFB',
      borderRadius: responsiveBorderRadius.md,
      overflow: 'hidden',
      borderWidth: 1,
      borderColor: darkMode ? '#374151' : '#E5E7EB',
    },
    sectionHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      padding: scale(14),
    },
    sectionTitleRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: scale(8),
    },
    sectionTitle: {
      fontSize: fontScale(16),
      fontWeight: '600',
      color: darkMode ? '#F9FAFB' : '#1F2937',
    },
    sectionContent: {
      padding: scale(14),
      paddingTop: 0,
    },
    sectionDesc: {
      color: darkMode ? '#9CA3AF' : '#6B7280',
      fontSize: fontScale(13),
      marginBottom: scale(12),
      lineHeight: fontScale(18),
    },
    buttonGrid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      justifyContent: 'space-between',
    },
    resultSection: {
      marginTop: scale(8),
      marginBottom: scale(16),
    },
    resultTitle: {
      color: darkMode ? '#E5E7EB' : '#374151',
      fontWeight: '600',
      marginBottom: scale(8),
      fontSize: fontScale(14),
    },
    resultBox: {
      maxHeight: scale(200),
      borderRadius: responsiveBorderRadius.md,
      borderWidth: 1,
      borderColor: darkMode ? '#374151' : '#E5E7EB',
      padding: scale(12),
      backgroundColor: darkMode ? '#0F172A' : '#FFFFFF',
    },
    resultText: {
      color: darkMode ? '#E5E7EB' : '#374151',
      fontSize: fontScale(12),
      fontFamily: 'monospace',
      lineHeight: fontScale(18),
    },
    promptText: {
      color: darkMode ? '#D1D5DB' : '#4B5563',
      fontSize: fontScale(13),
      lineHeight: fontScale(20),
      marginBottom: scale(12),
    },
    footer: {
      marginTop: scale(8),
      marginBottom: scale(32),
      alignItems: 'center',
    },
    footerText: {
      color: darkMode ? '#6B7280' : '#9CA3AF',
      fontSize: fontScale(11),
    },
  });
}

