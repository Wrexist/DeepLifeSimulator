import React, { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Modal, ScrollView, Dimensions, Animated } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useGame, CrimeSkillId } from '@/contexts/GameContext';
import { X, Star, Zap, Shield, TrendingUp, Lock, Users, BookOpen, Leaf, Wrench, DollarSign, Gavel, Check } from 'lucide-react-native';

const { width: screenWidth } = Dimensions.get('window');

interface TalentNode {
  id: string;
  name: string;
  description: string;
  effect: string;
  pointsCost: number;
  level: number;
  row: number;
  column: number;
  requires?: string[];
  icon: any;
  color: string[];
}

interface TalentTree {
  name: string;
  description: string;
  nodes: TalentNode[];
  color: string[];
}

const TALENT_TREES: Record<CrimeSkillId, TalentTree> = {
  stealth: {
    name: 'Shadow Arts',
    description: 'Master the art of stealth and deception',
    color: ['#059669', '#10B981'],
    nodes: [
      {
        id: 'silentStep',
        name: 'Silent Step',
        description: 'Learn to move silently',
        effect: '+10% stealth success rate',
        pointsCost: 1,
        level: 1,
        row: 0,
        column: 1,
        icon: Shield,
        color: ['#059669', '#10B981'],
      },
      {
        id: 'shadowBlend',
        name: 'Shadow Blend',
        description: 'Master the art of blending into shadows',
        effect: '+20% stealth success rate',
        pointsCost: 1,
        level: 2,
        row: 1,
        column: 0,
        requires: ['silentStep'],
        icon: Shield,
        color: ['#059669', '#10B981'],
      },
      {
        id: 'ghost',
        name: 'Ghost',
        description: 'Become nearly invisible in darkness',
        effect: '+30% stealth success rate',
        pointsCost: 1,
        level: 3,
        row: 1,
        column: 2,
        requires: ['silentStep'],
        icon: Shield,
        color: ['#059669', '#10B981'],
      },
      {
        id: 'nightMaster',
        name: 'Night Master',
        description: 'Complete mastery of night operations',
        effect: '+40% stealth success rate',
        pointsCost: 2,
        level: 4,
        row: 2,
        column: 1,
        requires: ['shadowBlend', 'ghost'],
        icon: Shield,
        color: ['#059669', '#10B981'],
      },
      {
        id: 'shadowLord',
        name: 'Shadow Lord',
        description: 'Legendary stealth abilities',
        effect: '+50% stealth success rate',
        pointsCost: 3,
        level: 5,
        row: 3,
        column: 1,
        requires: ['nightMaster'],
        icon: Shield,
        color: ['#059669', '#10B981'],
      },
    ],
  },
  hacking: {
    name: 'Digital Dominion',
    description: 'Control the digital realm',
    color: ['#3B82F6', '#60A5FA'],
    nodes: [
      {
        id: 'bruteForce',
        name: 'Brute Force',
        description: 'Basic password cracking techniques',
        effect: '+10% hacking success rate',
        pointsCost: 1,
        level: 1,
        row: 0,
        column: 1,
        icon: Zap,
        color: ['#3B82F6', '#60A5FA'],
      },
      {
        id: 'backdoor',
        name: 'Backdoor',
        description: 'Create hidden system access points',
        effect: '+20% hacking success rate',
        pointsCost: 1,
        level: 2,
        row: 1,
        column: 0,
        requires: ['bruteForce'],
        icon: Zap,
        color: ['#3B82F6', '#60A5FA'],
      },
      {
        id: 'quantumLeap',
        name: 'Quantum Leap',
        description: 'Advanced quantum computing techniques',
        effect: '+30% hacking success rate',
        pointsCost: 1,
        level: 3,
        row: 1,
        column: 2,
        requires: ['bruteForce'],
        icon: Zap,
        color: ['#3B82F6', '#60A5FA'],
      },
      {
        id: 'deepSpoof',
        name: 'Deep Spoof',
        description: 'Master identity spoofing',
        effect: '+40% hacking success rate',
        pointsCost: 2,
        level: 4,
        row: 2,
        column: 1,
        requires: ['backdoor', 'quantumLeap'],
        icon: Zap,
        color: ['#3B82F6', '#60A5FA'],
      },
      {
        id: 'aiOverride',
        name: 'AI Override',
        description: 'Control AI systems directly',
        effect: '+50% hacking success rate',
        pointsCost: 3,
        level: 5,
        row: 3,
        column: 1,
        requires: ['deepSpoof'],
        icon: Zap,
        color: ['#3B82F6', '#60A5FA'],
      },
    ],
  },
  lockpicking: {
    name: 'Lock Mastery',
    description: 'Become the ultimate lock breaker',
    color: ['#F59E0B', '#FBBF24'],
    nodes: [
      {
        id: 'quickPick',
        name: 'Quick Pick',
        description: 'Fast lock picking techniques',
        effect: '+10% lockpicking success rate',
        pointsCost: 1,
        level: 1,
        row: 0,
        column: 1,
        icon: Lock,
        color: ['#F59E0B', '#FBBF24'],
      },
      {
        id: 'masterKey',
        name: 'Master Key',
        description: 'Create universal keys',
        effect: '+20% lockpicking success rate',
        pointsCost: 1,
        level: 2,
        row: 1,
        column: 0,
        requires: ['quickPick'],
        icon: Lock,
        color: ['#F59E0B', '#FBBF24'],
      },
      {
        id: 'phantomTouch',
        name: 'Phantom Touch',
        description: 'Feel locks without touching them',
        effect: '+30% lockpicking success rate',
        pointsCost: 1,
        level: 3,
        row: 1,
        column: 2,
        requires: ['quickPick'],
        icon: Lock,
        color: ['#F59E0B', '#FBBF24'],
      },
      {
        id: 'silentDrill',
        name: 'Silent Drill',
        description: 'Silent drilling techniques',
        effect: '+40% lockpicking success rate',
        pointsCost: 2,
        level: 4,
        row: 2,
        column: 1,
        requires: ['masterKey', 'phantomTouch'],
        icon: Lock,
        color: ['#F59E0B', '#FBBF24'],
      },
      {
        id: 'molecularKey',
        name: 'Molecular Key',
        description: 'Molecular-level lock manipulation',
        effect: '+50% lockpicking success rate',
        pointsCost: 3,
        level: 5,
        row: 3,
        column: 1,
        requires: ['silentDrill'],
        icon: Lock,
        color: ['#F59E0B', '#FBBF24'],
      },
    ],
  },
};

interface SkillTalentTreeProps {
  skillId: CrimeSkillId;
  visible: boolean;
  onClose: () => void;
}

export default function SkillTalentTree({ skillId, visible, onClose }: SkillTalentTreeProps) {
  const { gameState, unlockCrimeSkillUpgrade } = useGame();
  const [selectedNode, setSelectedNode] = useState<TalentNode | null>(null);
  const [scaleAnim] = useState(new Animated.Value(1));
  
  const tree = TALENT_TREES[skillId];
  const skill = gameState.crimeSkills[skillId];
  const { settings } = gameState;

  // Calculate available talent points (1 point per level, starting from level 1)
  const availablePoints = Math.max(0, skill.level - 1); // Start from level 1, so level 1 = 0 points, level 2 = 1 point, etc.
  const spentPoints = skill.upgrades?.length || 0;
  const remainingPoints = availablePoints - spentPoints;

  const isNodeUnlocked = (nodeId: string) => {
    return skill.upgrades?.includes(nodeId) || false;
  };

  const canUnlockNode = (node: TalentNode) => {
    if (isNodeUnlocked(node.id)) return false;
    if (remainingPoints < node.pointsCost) return false;
    if (skill.level < node.level) return false;
    
    if (node.requires) {
      return node.requires.every(req => isNodeUnlocked(req));
    }
    
    return true;
  };

  const handleNodePress = (node: TalentNode) => {
    // Animate the press
    Animated.sequence([
      Animated.timing(scaleAnim, {
        toValue: 0.95,
        duration: 100,
        useNativeDriver: true,
      }),
      Animated.timing(scaleAnim, {
        toValue: 1,
        duration: 100,
        useNativeDriver: true,
      }),
    ]).start();

    if (canUnlockNode(node)) {
      // Convert points cost to money cost (1 point = 100 money)
      const moneyCost = node.pointsCost * 100;
      unlockCrimeSkillUpgrade(skillId, node.id, moneyCost, node.level);
    }
    setSelectedNode(node);
  };

  const getNodeStatus = (node: TalentNode) => {
    if (isNodeUnlocked(node.id)) return 'unlocked';
    if (canUnlockNode(node)) return 'available';
    return 'locked';
  };

  const renderNode = (node: TalentNode) => {
    const status = getNodeStatus(node);
    const Icon = node.icon;
    const isSelected = selectedNode?.id === node.id;
    
    return (
      <Animated.View
        key={node.id}
        style={[
          styles.nodeContainer,
          {
            top: node.row * 120 + 50,
            left: node.column * 120 + 20,
            transform: [{ scale: isSelected ? scaleAnim : 1 }],
          },
        ]}
      >
        <TouchableOpacity
          style={[
            styles.node,
            status === 'unlocked' ? styles.nodeUnlocked : 
            status === 'available' ? styles.nodeAvailable : 
            styles.nodeLocked,
            isSelected && styles.nodeSelected,
          ]}
          onPress={() => handleNodePress(node)}
          disabled={status === 'locked'}
          activeOpacity={0.8}
        >
          <LinearGradient
            colors={
              status === 'unlocked'
                ? [node.color[0], node.color[1]]
                : status === 'available'
                ? ['#3B82F6', '#60A5FA']
                : ['#6B7280', '#9CA3AF']
            }
            style={styles.nodeGradient}
          >
            <Icon size={24} color="#FFFFFF" />
            <Text style={styles.nodeName}>{node.name}</Text>
            <Text style={styles.nodeLevel}>Level {node.level}</Text>
            {node.pointsCost > 1 && (
              <Text style={styles.nodeCost}>{node.pointsCost} pts</Text>
            )}
            
            {/* Check mark for unlocked talents */}
            {status === 'unlocked' && (
              <View style={styles.checkMark}>
                <Check size={16} color="#FFFFFF" />
              </View>
            )}
          </LinearGradient>
          
          {/* Selection indicator */}
          {isSelected && (
            <View style={styles.selectionRing}>
              <View style={styles.selectionRingInner} />
            </View>
          )}
        </TouchableOpacity>
      </Animated.View>
    );
  };

  const renderConnections = () => {
    return tree.nodes.map(node => {
      if (!node.requires) return null;
      
      return node.requires.map(reqId => {
        const reqNode = tree.nodes.find(n => n.id === reqId);
        if (!reqNode) return null;
        
        const isUnlocked = isNodeUnlocked(reqId) && isNodeUnlocked(node.id);
        
        // Calculate connection line properties - match node positioning
        const startX = reqNode.column * 120 + 20 + 40; // node left + half node width (80/2 = 40)
        const startY = reqNode.row * 120 + 50 + 40; // node top + half node height (80/2 = 40)
        const endX = node.column * 120 + 20 + 40; // node left + half node width
        const endY = node.row * 120 + 50 + 40; // node top + half node height
        
        // Calculate line length and angle
        const deltaX = endX - startX;
        const deltaY = endY - startY;
        const length = Math.sqrt(deltaX * deltaX + deltaY * deltaY);
        const angle = Math.atan2(deltaY, deltaX) * 180 / Math.PI;
        
        return (
          <View
            key={`${reqId}-${node.id}`}
            style={[
              styles.connection,
              isUnlocked && styles.connectionUnlocked,
              {
                position: 'absolute',
                left: startX,
                top: startY,
                width: length,
                height: 2,
                transformOrigin: '0 0',
                transform: [
                  { rotate: `${angle}deg` },
                ],
              },
            ]}
          />
        );
      });
    });
  };

  return (
    <Modal visible={visible} transparent animationType="fade">
      <View style={styles.modalOverlay}>
        <View style={[styles.modalContent, settings.darkMode && styles.modalContentDark]}>
          <View style={styles.header}>
            <Text style={[styles.title, settings.darkMode && styles.titleDark]}>
              {tree.name} - Talent Tree
            </Text>
            <TouchableOpacity onPress={onClose} style={styles.closeButton}>
              <X size={24} color={settings.darkMode ? '#F9FAFB' : '#111827'} />
            </TouchableOpacity>
          </View>
          
          <View style={styles.pointsDisplay}>
            <View style={styles.pointsInfo}>
              <Text style={[styles.pointsText, settings.darkMode && styles.pointsTextDark]}>
                Talent Points: {remainingPoints}/{availablePoints}
              </Text>
              <Text style={[styles.levelText, settings.darkMode && styles.levelTextDark]}>
                Skill Level: {skill.level}
              </Text>
            </View>
            <View style={styles.progressBar}>
              <View 
                style={[
                  styles.progressFill, 
                  { width: `${(remainingPoints / availablePoints) * 100}%` }
                ]} 
              />
            </View>
          </View>
          
          <Text style={[styles.description, settings.darkMode && styles.descriptionDark]}>
            {tree.description}
          </Text>
          
          <View style={styles.treeContainer}>
            <ScrollView 
              horizontal 
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.treeScrollContent}
            >
              <View style={styles.treeArea}>
                {renderConnections()}
                {tree.nodes.map(renderNode)}
              </View>
            </ScrollView>
          </View>
          
          {selectedNode && (
            <View style={[styles.nodeInfo, settings.darkMode && styles.nodeInfoDark]}>
              <View style={styles.nodeInfoHeader}>
                <Text style={[styles.nodeInfoTitle, settings.darkMode && styles.nodeInfoTitleDark]}>
                  {selectedNode.name}
                </Text>
                <View style={[
                  styles.nodeInfoBadge,
                  getNodeStatus(selectedNode) === 'unlocked' && styles.nodeInfoBadgeUnlocked,
                  getNodeStatus(selectedNode) === 'available' && styles.nodeInfoBadgeAvailable,
                  getNodeStatus(selectedNode) === 'locked' && styles.nodeInfoBadgeLocked,
                ]}>
                  <Text style={styles.nodeInfoBadgeText}>
                    {getNodeStatus(selectedNode).toUpperCase()}
                  </Text>
                </View>
              </View>
              
              <Text style={[styles.nodeInfoDesc, settings.darkMode && styles.nodeInfoDescDark]}>
                {selectedNode.description}
              </Text>
              
              <View style={styles.nodeInfoStats}>
                <View style={styles.nodeInfoStat}>
                  <Text style={[styles.nodeInfoStatLabel, settings.darkMode && styles.nodeInfoStatLabelDark]}>
                    Effect:
                  </Text>
                  <Text style={[styles.nodeInfoEffect, settings.darkMode && styles.nodeInfoEffectDark]}>
                    {selectedNode.effect}
                  </Text>
                </View>
                
                <View style={styles.nodeInfoStat}>
                  <Text style={[styles.nodeInfoStatLabel, settings.darkMode && styles.nodeInfoStatLabelDark]}>
                    Cost:
                  </Text>
                  <Text style={[styles.nodeInfoCost, settings.darkMode && styles.nodeInfoCostDark]}>
                    {selectedNode.pointsCost} talent point{selectedNode.pointsCost > 1 ? 's' : ''}
                  </Text>
                </View>
                
                <View style={styles.nodeInfoStat}>
                  <Text style={[styles.nodeInfoStatLabel, settings.darkMode && styles.nodeInfoStatLabelDark]}>
                    Required Level:
                  </Text>
                  <Text style={[styles.nodeInfoLevel, settings.darkMode && styles.nodeInfoLevelDark]}>
                    {selectedNode.level}
                  </Text>
                </View>
              </View>
              
              {getNodeStatus(selectedNode) === 'available' && (
                <TouchableOpacity
                  style={styles.unlockButton}
                  onPress={() => handleNodePress(selectedNode)}
                  activeOpacity={0.8}
                >
                  <Text style={styles.unlockButtonText}>Unlock Talent</Text>
                </TouchableOpacity>
              )}
              
              {getNodeStatus(selectedNode) === 'locked' && (
                <View style={styles.lockedInfo}>
                  <Text style={[styles.lockedText, settings.darkMode && styles.lockedTextDark]}>
                    Requires level {selectedNode.level} and prerequisites
                  </Text>
                </View>
              )}
              
              {getNodeStatus(selectedNode) === 'unlocked' && (
                <View style={styles.unlockedInfo}>
                  <Text style={[styles.unlockedText, settings.darkMode && styles.unlockedTextDark]}>
                    ✓ Talent unlocked and active
                  </Text>
                </View>
              )}
            </View>
          )}
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    width: screenWidth * 0.95,
    height: '90%',
    padding: 20,
  },
  modalContentDark: {
    backgroundColor: '#1F2937',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#111827',
  },
  titleDark: {
    color: '#F9FAFB',
  },
  closeButton: {
    padding: 8,
  },
  pointsDisplay: {
    backgroundColor: '#F3F4F6',
    padding: 16,
    borderRadius: 12,
    marginBottom: 16,
  },
  pointsInfo: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  pointsText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#3B82F6',
  },
  pointsTextDark: {
    color: '#60A5FA',
  },
  levelText: {
    fontSize: 14,
    color: '#6B7280',
  },
  levelTextDark: {
    color: '#9CA3AF',
  },
  progressBar: {
    height: 6,
    backgroundColor: '#E5E7EB',
    borderRadius: 3,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: '#3B82F6',
    borderRadius: 3,
  },
  description: {
    fontSize: 16,
    color: '#6B7280',
    marginBottom: 20,
  },
  descriptionDark: {
    color: '#9CA3AF',
  },
  treeContainer: {
    flex: 1,
    marginBottom: 20,
  },
  treeScrollContent: {
    minWidth: 400,
  },
  treeArea: {
    width: 400,
    height: 500,
    position: 'relative',
  },
  connection: {
    position: 'absolute',
    backgroundColor: '#9CA3AF',
    opacity: 0.3,
    height: 2,
    borderRadius: 1,
  },
  connectionUnlocked: {
    backgroundColor: '#10B981',
    opacity: 0.8,
  },
  nodeContainer: {
    position: 'absolute',
  },
  node: {
    width: 80,
    height: 80,
    borderRadius: 40,
    position: 'relative',
  },
  nodeGradient: {
    width: '100%',
    height: '100%',
    borderRadius: 40,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 5,
  },
  nodeUnlocked: {
    shadowColor: '#10B981',
    shadowOpacity: 0.5,
  },
  nodeAvailable: {
    shadowColor: '#3B82F6',
    shadowOpacity: 0.5,
  },
  nodeLocked: {
    opacity: 0.5,
  },
  nodeSelected: {
    shadowColor: '#F59E0B',
    shadowOpacity: 0.8,
    shadowRadius: 8,
  },
  nodeName: {
    fontSize: 10,
    fontWeight: '600',
    color: '#FFFFFF',
    textAlign: 'center',
    marginTop: 2,
  },
  nodeLevel: {
    fontSize: 8,
    color: '#FFFFFF',
    opacity: 0.8,
  },
  nodeCost: {
    fontSize: 8,
    color: '#FFFFFF',
    fontWeight: '600',
    marginTop: 2,
  },
  checkMark: {
    position: 'absolute',
    top: 4,
    right: 4,
    backgroundColor: 'rgba(0, 0, 0, 0.3)',
    borderRadius: 10,
    width: 20,
    height: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  selectionRing: {
    position: 'absolute',
    top: -4,
    left: -4,
    right: -4,
    bottom: -4,
    borderRadius: 44,
    borderWidth: 3,
    borderColor: '#F59E0B',
    borderStyle: 'dashed',
  },
  selectionRingInner: {
    position: 'absolute',
    top: 2,
    left: 2,
    right: 2,
    bottom: 2,
    borderRadius: 40,
    borderWidth: 1,
    borderColor: '#F59E0B',
  },
  nodeInfo: {
    backgroundColor: '#F3F4F6',
    padding: 16,
    borderRadius: 12,
    marginTop: 10,
  },
  nodeInfoDark: {
    backgroundColor: '#374151',
  },
  nodeInfoHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  nodeInfoTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#111827',
    flex: 1,
  },
  nodeInfoTitleDark: {
    color: '#F9FAFB',
  },
  nodeInfoBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    marginLeft: 8,
  },
  nodeInfoBadgeUnlocked: {
    backgroundColor: '#10B981',
  },
  nodeInfoBadgeAvailable: {
    backgroundColor: '#3B82F6',
  },
  nodeInfoBadgeLocked: {
    backgroundColor: '#6B7280',
  },
  nodeInfoBadgeText: {
    fontSize: 10,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  nodeInfoDesc: {
    fontSize: 14,
    color: '#6B7280',
    marginBottom: 12,
    lineHeight: 20,
  },
  nodeInfoDescDark: {
    color: '#9CA3AF',
  },
  nodeInfoStats: {
    marginBottom: 16,
  },
  nodeInfoStat: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  nodeInfoStatLabel: {
    fontSize: 14,
    color: '#6B7280',
    fontWeight: '500',
  },
  nodeInfoStatLabelDark: {
    color: '#9CA3AF',
  },
  nodeInfoEffect: {
    fontSize: 14,
    fontWeight: '600',
    color: '#059669',
  },
  nodeInfoEffectDark: {
    color: '#10B981',
  },
  nodeInfoCost: {
    fontSize: 14,
    color: '#F59E0B',
    fontWeight: '600',
  },
  nodeInfoCostDark: {
    color: '#FBBF24',
  },
  nodeInfoLevel: {
    fontSize: 14,
    color: '#3B82F6',
    fontWeight: '600',
  },
  nodeInfoLevelDark: {
    color: '#60A5FA',
  },
  unlockButton: {
    backgroundColor: '#3B82F6',
    padding: 12,
    borderRadius: 8,
    alignItems: 'center',
    marginBottom: 8,
  },
  unlockButtonText: {
    color: '#FFFFFF',
    fontWeight: '600',
    fontSize: 16,
  },
  lockedInfo: {
    backgroundColor: '#FEF3C7',
    padding: 12,
    borderRadius: 8,
    borderLeftWidth: 4,
    borderLeftColor: '#F59E0B',
  },
  lockedText: {
    fontSize: 14,
    color: '#92400E',
    fontStyle: 'italic',
  },
  lockedTextDark: {
    color: '#FBBF24',
  },
  unlockedInfo: {
    backgroundColor: '#D1FAE5',
    padding: 12,
    borderRadius: 8,
    borderLeftWidth: 4,
    borderLeftColor: '#10B981',
  },
  unlockedText: {
    fontSize: 14,
    color: '#065F46',
    fontWeight: '500',
  },
  unlockedTextDark: {
    color: '#10B981',
  },
});
