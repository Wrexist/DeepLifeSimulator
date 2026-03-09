import React, { useState, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  ScrollView,
  TouchableOpacity,
  TextInput,
} from 'react-native';
import LinearGradientFallback from '@/components/fallbacks/LinearGradientFallback';
const LinearGradient = LinearGradientFallback;
import { X, Plus, Trash2, Settings, Zap } from 'lucide-react-native';
import { useGame } from '@/contexts/GameContext';
import { scale, fontScale } from '@/utils/scaling';
import {
  isAutomationEnabled,
  getMaxAutomationSlots,
  isAutomationTypeUnlocked,
  validateAutomationRule,
} from '@/lib/automation/automationEngine';
import type { AutomationRule } from '@/lib/automation/automationTypes';
import { createDefaultDCARule, createDefaultPercentageRule } from '@/lib/automation/autoInvest';
import { createDefaultThresholdSaveRule } from '@/lib/automation/autoSave';
import { createDefaultAutoPayRule } from '@/lib/automation/autoPay';
import { createDefaultAutoRenewRule } from '@/lib/automation/autoRenew';

interface AutomationSettingsModalProps {
  visible: boolean;
  onClose: () => void;
}

export default function AutomationSettingsModal({
  visible,
  onClose,
}: AutomationSettingsModalProps) {
  const { gameState, setGameState } = useGame();
  
  const automation = gameState?.automation;
  const isEnabled = isAutomationEnabled(gameState!);
  const maxSlots = getMaxAutomationSlots(gameState!);
  const currentSlots = automation?.rules?.filter(r => r.enabled).length || 0;
  
  const hasAutoInvest = isAutomationTypeUnlocked(gameState!, 'invest');
  const hasAutoSave = isAutomationTypeUnlocked(gameState!, 'save');
  const hasAutoPay = isAutomationTypeUnlocked(gameState!, 'pay');
  const hasAutoRenew = isAutomationTypeUnlocked(gameState!, 'renew');
  
  const hasAnyAutomation = hasAutoInvest || hasAutoSave || hasAutoPay || hasAutoRenew;
  
  const handleToggleRule = useCallback((ruleId: string) => {
    if (!gameState || !automation) return;
    
    setGameState(prevState => {
      if (!prevState.automation) return prevState;
      
      const updatedRules = prevState.automation.rules.map(rule =>
        rule.id === ruleId ? { ...rule, enabled: !rule.enabled } : rule
      );
      
      return {
        ...prevState,
        automation: {
          ...prevState.automation,
          rules: updatedRules,
        },
      };
    });
  }, [gameState, automation, setGameState]);
  
  const handleDeleteRule = useCallback((ruleId: string) => {
    if (!gameState || !automation) return;
    
    setGameState(prevState => {
      if (!prevState.automation) return prevState;
      
      const updatedRules = prevState.automation.rules.filter(rule => rule.id !== ruleId);
      
      return {
        ...prevState,
        automation: {
          ...prevState.automation,
          rules: updatedRules,
        },
      };
    });
  }, [gameState, automation, setGameState]);
  
  const handleAddRule = useCallback((type: AutomationRule['type']) => {
    if (!gameState) return;
    
    let newRule: AutomationRule;
    switch (type) {
      case 'invest':
        newRule = createDefaultDCARule();
        break;
      case 'save':
        newRule = createDefaultThresholdSaveRule();
        break;
      case 'pay':
        newRule = createDefaultAutoPayRule();
        break;
      case 'renew':
        newRule = createDefaultAutoRenewRule();
        break;
      default:
        return;
    }
    
    setGameState(prevState => {
      const currentRules = prevState.automation?.rules || [];
      return {
        ...prevState,
        automation: {
          rules: [...currentRules, newRule],
          executionHistory: prevState.automation?.executionHistory || [],
          maxSlots: getMaxAutomationSlots(prevState),
          enabled: true,
        },
      };
    });
  }, [gameState, setGameState]);
  
  if (!hasAnyAutomation) {
    return (
      <Modal visible={visible} transparent animationType="fade">
        <View style={styles.overlay}>
          <View style={styles.modal}>
            <View style={styles.header}>
              <Text style={styles.title}>Automation</Text>
              <TouchableOpacity onPress={onClose} style={styles.closeButton}>
                <X size={scale(24)} color="#FFFFFF" />
              </TouchableOpacity>
            </View>
            <View style={styles.content}>
              <Text style={styles.lockedText}>
                Automation features are locked. Purchase automation upgrades in the Prestige Shop to unlock.
              </Text>
            </View>
          </View>
        </View>
      </Modal>
    );
  }
  
  return (
    <Modal visible={visible} transparent animationType="fade">
      <View style={styles.overlay}>
        <View style={styles.modal}>
          <View style={styles.header}>
            <View style={styles.headerContent}>
              <Settings size={scale(24)} color="#10B981" />
              <Text style={styles.title}>Automation Settings</Text>
            </View>
            <TouchableOpacity onPress={onClose} style={styles.closeButton}>
              <X size={scale(24)} color="#FFFFFF" />
            </TouchableOpacity>
          </View>
          
          <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
            {/* Status */}
            <View style={styles.statusCard}>
              <Text style={styles.statusLabel}>Automation Status</Text>
              <Text style={styles.statusValue}>
                {currentSlots} / {maxSlots} slots used
              </Text>
              {currentSlots >= maxSlots && (
                <Text style={styles.warningText}>
                  Maximum slots reached. Purchase additional slots in Prestige Shop.
                </Text>
              )}
            </View>
            
            {/* Rules List */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Active Rules</Text>
              {automation?.rules && automation.rules.length > 0 ? (
                automation.rules.map((rule) => (
                  <View key={rule.id} style={styles.ruleCard}>
                    <View style={styles.ruleHeader}>
                      <View style={styles.ruleInfo}>
                        <Text style={styles.ruleName}>{rule.name}</Text>
                        <Text style={styles.ruleType}>{rule.type}</Text>
                      </View>
                      <View style={styles.ruleActions}>
                        <TouchableOpacity
                          onPress={() => handleToggleRule(rule.id)}
                          style={[styles.toggleButton, rule.enabled && styles.toggleButtonActive]}
                        >
                          <Zap size={scale(16)} color={rule.enabled ? '#FFFFFF' : '#6B7280'} />
                        </TouchableOpacity>
                        <TouchableOpacity
                          onPress={() => handleDeleteRule(rule.id)}
                          style={styles.deleteButton}
                        >
                          <Trash2 size={scale(16)} color="#EF4444" />
                        </TouchableOpacity>
                      </View>
                    </View>
                  </View>
                ))
              ) : (
                <Text style={styles.emptyText}>No automation rules configured</Text>
              )}
            </View>
            
            {/* Add Rule Buttons */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Add Automation Rule</Text>
              <View style={styles.addRuleGrid}>
                {hasAutoInvest && (
                  <TouchableOpacity
                    onPress={() => handleAddRule('invest')}
                    style={styles.addRuleButton}
                    disabled={currentSlots >= maxSlots}
                  >
                    <Plus size={scale(20)} color="#10B981" />
                    <Text style={styles.addRuleText}>Auto-Invest</Text>
                  </TouchableOpacity>
                )}
                {hasAutoSave && (
                  <TouchableOpacity
                    onPress={() => handleAddRule('save')}
                    style={styles.addRuleButton}
                    disabled={currentSlots >= maxSlots}
                  >
                    <Plus size={scale(20)} color="#10B981" />
                    <Text style={styles.addRuleText}>Auto-Save</Text>
                  </TouchableOpacity>
                )}
                {hasAutoPay && (
                  <TouchableOpacity
                    onPress={() => handleAddRule('pay')}
                    style={styles.addRuleButton}
                    disabled={currentSlots >= maxSlots}
                  >
                    <Plus size={scale(20)} color="#10B981" />
                    <Text style={styles.addRuleText}>Auto-Pay</Text>
                  </TouchableOpacity>
                )}
                {hasAutoRenew && (
                  <TouchableOpacity
                    onPress={() => handleAddRule('renew')}
                    style={styles.addRuleButton}
                    disabled={currentSlots >= maxSlots}
                  >
                    <Plus size={scale(20)} color="#10B981" />
                    <Text style={styles.addRuleText}>Auto-Renew</Text>
                  </TouchableOpacity>
                )}
              </View>
            </View>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.7)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modal: {
    width: '90%',
    maxWidth: scale(500),
    maxHeight: '80%',
    backgroundColor: '#1F2937',
    borderRadius: scale(20),
    overflow: 'hidden',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: scale(20),
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.1)',
  },
  headerContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: scale(12),
    flex: 1,
  },
  title: {
    fontSize: fontScale(20),
    fontWeight: 'bold',
    color: '#FFFFFF',
    flexShrink: 1,
  },
  closeButton: {
    width: scale(40),
    height: scale(40),
    borderRadius: scale(20),
    backgroundColor: 'rgba(255,255,255,0.1)',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
    zIndex: 10,
  },
  content: {
    padding: scale(20),
  },
  lockedText: {
    fontSize: fontScale(14),
    color: '#9CA3AF',
    textAlign: 'center',
    padding: scale(20),
  },
  statusCard: {
    backgroundColor: 'rgba(16,185,129,0.1)',
    padding: scale(16),
    borderRadius: scale(12),
    marginBottom: scale(20),
  },
  statusLabel: {
    fontSize: fontScale(12),
    color: '#9CA3AF',
    marginBottom: scale(4),
  },
  statusValue: {
    fontSize: fontScale(18),
    fontWeight: 'bold',
    color: '#10B981',
  },
  warningText: {
    fontSize: fontScale(12),
    color: '#F59E0B',
    marginTop: scale(8),
  },
  section: {
    marginBottom: scale(24),
  },
  sectionTitle: {
    fontSize: fontScale(16),
    fontWeight: '600',
    color: '#FFFFFF',
    marginBottom: scale(12),
  },
  ruleCard: {
    backgroundColor: 'rgba(31,41,55,0.8)',
    borderRadius: scale(12),
    padding: scale(16),
    marginBottom: scale(12),
  },
  ruleHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  ruleInfo: {
    flex: 1,
  },
  ruleName: {
    fontSize: fontScale(16),
    fontWeight: '600',
    color: '#FFFFFF',
    marginBottom: scale(4),
  },
  ruleType: {
    fontSize: fontScale(12),
    color: '#9CA3AF',
    textTransform: 'capitalize',
  },
  ruleActions: {
    flexDirection: 'row',
    gap: scale(8),
  },
  toggleButton: {
    width: scale(36),
    height: scale(36),
    borderRadius: scale(18),
    backgroundColor: 'rgba(107,114,128,0.2)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  toggleButtonActive: {
    backgroundColor: '#10B981',
  },
  deleteButton: {
    width: scale(36),
    height: scale(36),
    borderRadius: scale(18),
    backgroundColor: 'rgba(239,68,68,0.2)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyText: {
    fontSize: fontScale(14),
    color: '#6B7280',
    textAlign: 'center',
    padding: scale(20),
  },
  addRuleGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: scale(12),
  },
  addRuleButton: {
    flex: 1,
    minWidth: scale(120),
    backgroundColor: 'rgba(16,185,129,0.1)',
    borderRadius: scale(12),
    padding: scale(16),
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: scale(8),
    borderWidth: 1,
    borderColor: 'rgba(16,185,129,0.3)',
  },
  addRuleText: {
    fontSize: fontScale(14),
    fontWeight: '600',
    color: '#10B981',
  },
});

