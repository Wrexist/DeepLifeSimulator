import React, { useState, useEffect, useRef } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Modal, ScrollView, Dimensions, Animated, Platform } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
import { useGame, CrimeSkillId } from '@/contexts/GameContext';
import { X, Star, Zap, Shield, TrendingUp, Lock, Users, BookOpen, Leaf, Wrench, DollarSign, Gavel, Check, Sparkles, Crown, Flame, Eye, Brain, Target, Sword } from 'lucide-react-native';

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
    description: 'Master the ancient arts of stealth and deception',
    color: ['#0F172A', '#1E293B', '#334155'],
    nodes: [
      {
        id: 'silentStep',
        name: 'Silent Step',
        description: 'Learn to move like a whisper in the wind',
        effect: '+10% stealth success rate',
        pointsCost: 1,
        level: 1,
        row: 0,
        column: 1,
        icon: Eye,
        color: ['#0F172A', '#1E293B', '#475569'],
      },
      {
        id: 'shadowBlend',
        name: 'Shadow Blend',
        description: 'Become one with the darkness itself',
        effect: '+20% stealth success rate',
        pointsCost: 1,
        level: 2,
        row: 1,
        column: 0,
        requires: ['silentStep'],
        icon: Shield,
        color: ['#1E293B', '#334155', '#475569'],
      },
      {
        id: 'ghost',
        name: 'Ghost',
        description: 'Phase through reality like a specter',
        effect: '+30% stealth success rate',
        pointsCost: 1,
        level: 3,
        row: 1,
        column: 2,
        requires: ['silentStep'],
        icon: Sparkles,
        color: ['#334155', '#475569', '#64748B'],
      },
      {
        id: 'nightMaster',
        name: 'Night Master',
        description: 'Command the shadows as your domain',
        effect: '+40% stealth success rate',
        pointsCost: 2,
        level: 4,
        row: 2,
        column: 1,
        requires: ['shadowBlend', 'ghost'],
        icon: Crown,
        color: ['#475569', '#64748B', '#94A3B8'],
      },
      {
        id: 'shadowLord',
        name: 'Shadow Lord',
        description: 'Transcend mortal limitations in darkness',
        effect: '+50% stealth success rate',
        pointsCost: 3,
        level: 5,
        row: 3,
        column: 1,
        requires: ['nightMaster'],
        icon: Flame,
        color: ['#64748B', '#94A3B8', '#CBD5E1'],
      },
    ],
  },
  hacking: {
    name: 'Digital Dominion',
    description: 'Command the infinite realm of cyberspace',
    color: ['#0C4A6E', '#075985', '#0369A1'],
    nodes: [
      {
        id: 'bruteForce',
        name: 'Brute Force',
        description: 'Unlock the secrets of digital architecture',
        effect: '+10% hacking success rate',
        pointsCost: 1,
        level: 1,
        row: 0,
        column: 1,
        icon: Brain,
        color: ['#0C4A6E', '#075985', '#0369A1'],
      },
      {
        id: 'backdoor',
        name: 'Backdoor',
        description: 'Dissolve digital barriers like mist',
        effect: '+20% hacking success rate',
        pointsCost: 1,
        level: 2,
        row: 1,
        column: 0,
        requires: ['bruteForce'],
        icon: Zap,
        color: ['#075985', '#0369A1', '#0284C7'],
      },
      {
        id: 'quantumLeap',
        name: 'Quantum Leap',
        description: 'Exist as pure data in the network',
        effect: '+30% hacking success rate',
        pointsCost: 1,
        level: 3,
        row: 1,
        column: 2,
        requires: ['bruteForce'],
        icon: Sparkles,
        color: ['#0369A1', '#0284C7', '#0EA5E9'],
      },
      {
        id: 'deepSpoof',
        name: 'Deep Spoof',
        description: 'Bend information to your will',
        effect: '+40% hacking success rate',
        pointsCost: 2,
        level: 4,
        row: 2,
        column: 1,
        requires: ['backdoor', 'quantumLeap'],
        icon: Crown,
        color: ['#0284C7', '#0EA5E9', '#38BDF8'],
      },
      {
        id: 'aiOverride',
        name: 'AI Override',
        description: 'Transcend the boundaries of reality',
        effect: '+50% hacking success rate',
        pointsCost: 3,
        level: 5,
        row: 3,
        column: 1,
        requires: ['deepSpoof'],
        icon: Flame,
        color: ['#0EA5E9', '#38BDF8', '#7DD3FC'],
      },
    ],
  },
  lockpicking: {
    name: 'Lock Mastery',
    description: 'Master the ancient art of mechanical manipulation',
    color: ['#7C2D12', '#EA580C', '#F97316'],
    nodes: [
      {
        id: 'quickPick',
        name: 'Quick Pick',
        description: 'Feel the tumblers dance to your touch',
        effect: '+10% lockpicking success rate',
        pointsCost: 1,
        level: 1,
        row: 0,
        column: 1,
        icon: Target,
        color: ['#7C2D12', '#EA580C', '#F97316'],
      },
      {
        id: 'masterKey',
        name: 'Master Key',
        description: 'Forge keys that open any door',
        effect: '+20% lockpicking success rate',
        pointsCost: 1,
        level: 2,
        row: 1,
        column: 0,
        requires: ['quickPick'],
        icon: Sword,
        color: ['#EA580C', '#F97316', '#FB923C'],
      },
      {
        id: 'phantomTouch',
        name: 'Phantom Touch',
        description: 'Become one with the mechanism',
        effect: '+30% lockpicking success rate',
        pointsCost: 1,
        level: 3,
        row: 1,
        column: 2,
        requires: ['quickPick'],
        icon: Sparkles,
        color: ['#F97316', '#FB923C', '#FDBA74'],
      },
      {
        id: 'silentDrill',
        name: 'Silent Drill',
        description: 'Command locks to surrender their secrets',
        effect: '+40% lockpicking success rate',
        pointsCost: 2,
        level: 4,
        row: 2,
        column: 1,
        requires: ['masterKey', 'phantomTouch'],
        icon: Crown,
        color: ['#FB923C', '#FDBA74', '#FED7AA'],
      },
      {
        id: 'molecularKey',
        name: 'Molecular Key',
        description: 'Transcend the physical realm of locks',
        effect: '+50% lockpicking success rate',
        pointsCost: 3,
        level: 5,
        row: 3,
        column: 1,
        requires: ['silentDrill'],
        icon: Flame,
        color: ['#FDBA74', '#FED7AA', '#FFEDD5'],
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
  const [pulseAnim] = useState(new Animated.Value(1));
  const [glowAnim] = useState(new Animated.Value(0));
  const [connectionAnim] = useState(new Animated.Value(0));
  
  // Start animations when component mounts
  useEffect(() => {
    let isMounted = true;
    
    if (visible && isMounted) {
      // Pulse animation for unlocked nodes
      const pulseAnimation = Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, {
            toValue: 1.1,
            duration: 2000,
            useNativeDriver: Platform.OS !== 'web',
          }),
          Animated.timing(pulseAnim, {
            toValue: 1,
            duration: 2000,
            useNativeDriver: Platform.OS !== 'web',
          }),
        ])
      );
      
      // Glow animation for available nodes
      const glowAnimation = Animated.loop(
        Animated.sequence([
          Animated.timing(glowAnim, {
            toValue: 1,
            duration: 1500,
            useNativeDriver: Platform.OS !== 'web', // Changed to true for consistency
          }),
          Animated.timing(glowAnim, {
            toValue: 0,
            duration: 1500,
            useNativeDriver: Platform.OS !== 'web', // Changed to true for consistency
          }),
        ])
      );
      
      // Connection flow animation
      const connectionAnimation = Animated.loop(
        Animated.timing(connectionAnim, {
          toValue: 1,
          duration: 3000,
          useNativeDriver: Platform.OS !== 'web', // Changed to true for consistency
        })
      );
      
      if (isMounted) {
        pulseAnimation.start();
        glowAnimation.start();
        connectionAnimation.start();
      }
      
      return () => {
        isMounted = false;
        pulseAnimation.stop();
        glowAnimation.stop();
        connectionAnimation.stop();
      };
    }
  }, [visible, pulseAnim, glowAnim, connectionAnim]);
  
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
        useNativeDriver: Platform.OS !== 'web',
      }),
      Animated.timing(scaleAnim, {
        toValue: 1,
        duration: 100,
        useNativeDriver: Platform.OS !== 'web',
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
            top: node.row * 90 + 20,
            left: node.column * 90 + 20,
            transform: [{ scale: isSelected ? scaleAnim : status === 'unlocked' ? pulseAnim : 1 }],
          },
        ]}
      >
        {/* Glow effect for available nodes */}
        {status === 'available' && (
          <Animated.View 
            style={[
              styles.nodeGlow,
              {
                opacity: glowAnim.interpolate({
                  inputRange: [0, 1],
                  outputRange: [0.3, 0.8],
                }),
              }
            ]}
          >
            <LinearGradient
              colors={['rgba(59, 130, 246, 0.6)', 'rgba(29, 78, 216, 0.4)', 'transparent']}
              style={styles.nodeGlowGradient}
            />
          </Animated.View>
        )}
        
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
                ? node.color.length >= 3 ? node.color : [node.color[0], node.color[1], '#047857']
                : status === 'available'
                ? ['#3B82F6', '#1D4ED8', '#1E40AF']
                : ['#374151', '#1F2937', '#111827']
            }
            style={styles.nodeGradient}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
          >
            {/* Inner glow effect */}
            <View style={styles.nodeInnerGlow}>
              <Icon size={28} color="#FFFFFF" />
            </View>
            
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
            
            {/* Sparkle effect for high-level nodes */}
            {node.level >= 4 && status === 'unlocked' && (
              <View style={styles.sparkleEffect}>
                <Sparkles size={16} color="#FBBF24" />
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
        const startX = reqNode.column * 90 + 20 + 40; // node left + half node width (80/2 = 40)
        const startY = reqNode.row * 90 + 20 + 40; // node top + half node height (80/2 = 40)
        const endX = node.column * 90 + 20 + 40; // node left + half node width
        const endY = node.row * 90 + 20 + 40; // node top + half node height
        
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
      <BlurView intensity={20} style={styles.modalOverlay}>
        <View style={[styles.modalContent, settings.darkMode && styles.modalContentDark]}>
          {/* Enhanced header with gradient background */}
          <LinearGradient
            colors={settings.darkMode ? ['#1F2937', '#111827'] : ['#F8FAFC', '#E2E8F0']}
            style={styles.headerGradient}
          >
            <View style={styles.header}>
              <View style={styles.titleContainer}>
                <Text style={[styles.title, settings.darkMode && styles.titleDark]}>
                  {tree.name}
                </Text>
                <Text style={[styles.subtitle, settings.darkMode && styles.subtitleDark]}>
                  Talent Tree
                </Text>
              </View>
              <TouchableOpacity onPress={onClose} style={styles.closeButton}>
                <X size={24} color={settings.darkMode ? '#F9FAFB' : '#111827'} />
              </TouchableOpacity>
            </View>
          </LinearGradient>
          
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
          <Text style={[styles.description, settings.darkMode && styles.descriptionDark, { fontSize: 14, marginTop: 8, color: '#10B981' }]}>
            💡 Each talent gives +5% success rate and +10% payment bonus for {skillId} jobs
          </Text>
          
          <View style={styles.treeContainer}>
            <View style={styles.treeArea}>
              {renderConnections()}
              {tree.nodes.map(renderNode)}
            </View>
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
      </BlurView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.9)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    width: screenWidth * 0.95,
    height: '90%',
    padding: 0,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.3,
    shadowRadius: 20,
    elevation: 20,
  },
  modalContentDark: {
    backgroundColor: '#1F2937',
  },
  headerGradient: {
    paddingTop: 20,
    paddingBottom: 20,
    paddingHorizontal: 20,
  },
  titleContainer: {
    flex: 1,
  },
  subtitle: {
    fontSize: 14,
    color: '#6B7280',
    fontWeight: '500',
    marginTop: 2,
  },
  subtitleDark: {
    color: '#9CA3AF',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 0,
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
    marginHorizontal: 20,
    marginTop: 20,
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

  treeArea: {
    width: screenWidth * 0.9,
    height: 400,
    position: 'relative',
    alignSelf: 'center',
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
  // Enhanced visual effects
  nodeGlow: {
    position: 'absolute',
    top: -10,
    left: -10,
    right: -10,
    bottom: -10,
    borderRadius: 50,
    zIndex: -1,
  },
  nodeGlowGradient: {
    width: '100%',
    height: '100%',
    borderRadius: 50,
  },
  nodeInnerGlow: {
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 20,
    padding: 4,
    marginBottom: 4,
  },
  sparkleEffect: {
    position: 'absolute',
    top: 4,
    left: 4,
    backgroundColor: 'rgba(251, 191, 36, 0.2)',
    borderRadius: 10,
    width: 20,
    height: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
});
