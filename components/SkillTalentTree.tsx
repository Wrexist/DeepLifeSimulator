import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Modal, ScrollView, Dimensions, Animated, Platform } from 'react-native';
import LinearGradientFallback from '@/components/fallbacks/LinearGradientFallback';
const LinearGradient = LinearGradientFallback;
import { useGame, CrimeSkillId } from '@/contexts/GameContext';
import { X, Star, Zap, Shield, Lock, Check, Sparkles, Crown, Flame, Eye, Brain, Target, Sword, ChevronRight, AlertCircle } from 'lucide-react-native';

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
  
  const tree = TALENT_TREES[skillId];
  const skill = gameState.crimeSkills[skillId];
  const { settings } = gameState;

  // Calculate available talent points (1 point per level, starting from level 1)
  const availablePoints = Math.max(0, skill.level - 1);
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
      const moneyCost = node.pointsCost * 100;
      unlockCrimeSkillUpgrade(skillId, node.id, moneyCost, node.level);
      setSelectedNode(null);
    } else {
      setSelectedNode(node);
    }
  };

  const getNodeStatus = (node: TalentNode) => {
    if (isNodeUnlocked(node.id)) return 'unlocked';
    if (canUnlockNode(node)) return 'available';
    return 'locked';
  };

  // Sort nodes by level for better display
  const sortedNodes = [...tree.nodes].sort((a, b) => {
    if (a.level !== b.level) return a.level - b.level;
    return a.row - b.row;
  });

  const renderTalentCard = (node: TalentNode) => {
    const status = getNodeStatus(node);
    const Icon = node.icon;
    const isUnlocked = status === 'unlocked';
    const isAvailable = status === 'available';
    const isLocked = status === 'locked';

    return (
      <TouchableOpacity
        key={node.id}
        style={[
          styles.talentCard,
          settings.darkMode && styles.talentCardDark,
          isUnlocked && styles.talentCardUnlocked,
          isAvailable && styles.talentCardAvailable,
          isLocked && styles.talentCardLocked,
        ]}
        onPress={() => handleNodePress(node)}
        activeOpacity={0.7}
        disabled={isLocked && !selectedNode}
      >
        <View style={styles.talentCardContent}>
          {/* Icon Container */}
          <View style={[
            styles.iconContainer,
            isUnlocked && styles.iconContainerUnlocked,
            isAvailable && styles.iconContainerAvailable,
            isLocked && styles.iconContainerLocked,
          ]}>
            {isLocked ? (
              <Lock size={28} color={settings.darkMode ? '#6B7280' : '#9CA3AF'} />
            ) : (
              <Icon size={28} color="#FFFFFF" />
            )}
          </View>

          {/* Talent Info */}
          <View style={styles.talentInfo}>
            <View style={styles.talentHeader}>
              <Text style={[
                styles.talentName,
                settings.darkMode && styles.talentNameDark,
                isLocked && styles.talentNameLocked,
              ]}>
                {node.name}
              </Text>
              {isUnlocked && (
                <View style={styles.unlockedBadge}>
                  <Check size={14} color="#FFFFFF" />
                </View>
              )}
            </View>
            
            <Text style={[
              styles.talentDescription,
              settings.darkMode && styles.talentDescriptionDark,
              isLocked && styles.talentDescriptionLocked,
            ]} numberOfLines={2}>
              {node.description}
            </Text>

            <View style={styles.talentMeta}>
              <View style={styles.metaItem}>
                <Star size={14} color={isLocked ? '#9CA3AF' : '#F59E0B'} />
                <Text style={[
                  styles.metaText,
                  settings.darkMode && styles.metaTextDark,
                  isLocked && styles.metaTextLocked,
                ]}>
                  Level {node.level}
                </Text>
              </View>
              
              <View style={styles.metaItem}>
                <Text style={[
                  styles.metaText,
                  settings.darkMode && styles.metaTextDark,
                  isLocked && styles.metaTextLocked,
                ]}>
                  {node.pointsCost} point{node.pointsCost > 1 ? 's' : ''}
                </Text>
              </View>
            </View>

            {/* Effect Badge */}
            {!isLocked && (
              <View style={[
                styles.effectBadge,
                isUnlocked && styles.effectBadgeUnlocked,
                isAvailable && styles.effectBadgeAvailable,
              ]}>
                <Text style={styles.effectBadgeText}>{node.effect}</Text>
              </View>
            )}
          </View>

          {/* Arrow indicator */}
          {!isLocked && (
            <ChevronRight size={20} color={settings.darkMode ? '#9CA3AF' : '#6B7280'} />
          )}
        </View>

        {/* Prerequisites indicator */}
        {node.requires && node.requires.length > 0 && isLocked && (
          <View style={styles.prerequisitesContainer}>
            <Text style={[
              styles.prerequisitesText,
              settings.darkMode && styles.prerequisitesTextDark,
            ]}>
              Requires: {node.requires.map(r => {
                const reqNode = tree.nodes.find(n => n.id === r);
                return reqNode?.name || r;
              }).join(', ')}
            </Text>
          </View>
        )}
      </TouchableOpacity>
    );
  };

  if (!visible) return null;

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={[
          styles.container,
          settings.darkMode && styles.containerDark,
        ]}>
          {/* Header */}
          <View style={[
            styles.header,
            settings.darkMode && styles.headerDark,
          ]}>
            <View style={styles.headerLeft}>
              <View style={[
                styles.headerIconContainer,
                { backgroundColor: `${tree.color[0]}20` },
              ]}>
                  {skillId === 'stealth' && <Eye size={28} color={tree.color[1]} />}
                {skillId === 'hacking' && <Brain size={28} color={tree.color[1]} />}
                {skillId === 'lockpicking' && <Target size={28} color={tree.color[1]} />}
              </View>
              <View style={styles.headerText}>
                <Text style={[
                  styles.title,
                  settings.darkMode && styles.titleDark,
                ]}>
                  {tree.name}
                </Text>
                <Text style={[
                  styles.subtitle,
                  settings.darkMode && styles.subtitleDark,
                ]}>
                  Talent Tree
                </Text>
              </View>
            </View>
            <TouchableOpacity onPress={onClose} style={styles.closeButton}>
              <X size={24} color={settings.darkMode ? '#9CA3AF' : '#6B7280'} />
            </TouchableOpacity>
          </View>

          {/* Stats Bar */}
          <View style={[
            styles.statsBar,
            settings.darkMode && styles.statsBarDark,
          ]}>
            <View style={styles.statItem}>
              <View style={styles.statIconContainer}>
                <Star size={16} color="#F59E0B" />
              </View>
              <View style={styles.statContent}>
                <Text style={[
                  styles.statLabel,
                  settings.darkMode && styles.statLabelDark,
                ]}>
                  Talent Points
                </Text>
                <Text style={[
                  styles.statValue,
                  settings.darkMode && styles.statValueDark,
                ]}>
                  {remainingPoints} / {availablePoints}
                </Text>
              </View>
            </View>

            <View style={styles.statDivider} />

            <View style={styles.statItem}>
              <View style={styles.statIconContainer}>
                <Crown size={16} color="#8B5CF6" />
              </View>
              <View style={styles.statContent}>
                <Text style={[
                  styles.statLabel,
                  settings.darkMode && styles.statLabelDark,
                ]}>
                  Skill Level
                </Text>
                <Text style={[
                  styles.statValue,
                  settings.darkMode && styles.statValueDark,
                ]}>
                  {skill.level}
                </Text>
              </View>
            </View>

            <View style={styles.statDivider} />

            <View style={styles.statItem}>
              <View style={styles.statIconContainer}>
                <Check size={16} color="#10B981" />
              </View>
              <View style={styles.statContent}>
                <Text style={[
                  styles.statLabel,
                  settings.darkMode && styles.statLabelDark,
                ]}>
                  Unlocked
                </Text>
                <Text style={[
                  styles.statValue,
                  settings.darkMode && styles.statValueDark,
                ]}>
                  {spentPoints} / {tree.nodes.length}
                </Text>
              </View>
            </View>
          </View>

          {/* Description */}
          <View style={styles.descriptionContainer}>
            <Text style={[
              styles.description,
              settings.darkMode && styles.descriptionDark,
            ]}>
              {tree.description}
            </Text>
            <View style={[
              styles.benefitBox,
              settings.darkMode && styles.benefitBoxDark,
            ]}>
              <Sparkles size={16} color="#10B981" />
              <Text style={[
                styles.benefitText,
                settings.darkMode && styles.benefitTextDark,
              ]}>
                Each talent gives +5% success rate and +10% payment bonus
              </Text>
            </View>
          </View>

          {/* Talent List */}
          <ScrollView
            style={styles.talentsList}
            contentContainerStyle={styles.talentsListContent}
            showsVerticalScrollIndicator={false}
          >
            {sortedNodes.map(renderTalentCard)}
          </ScrollView>

          {/* Selected Node Details */}
          {selectedNode && (
            <View style={[
              styles.detailsPanel,
              settings.darkMode && styles.detailsPanelDark,
            ]}>
              <View style={styles.detailsHeader}>
                <View style={styles.detailsHeaderLeft}>
                  <View style={[
                    styles.detailsIconContainer,
                    getNodeStatus(selectedNode) === 'locked' && styles.detailsIconContainerLocked,
                  ]}>
                    {getNodeStatus(selectedNode) === 'locked' ? (
                      <Lock size={24} color={settings.darkMode ? '#6B7280' : '#9CA3AF'} />
                    ) : (
                      <selectedNode.icon size={24} color="#FFFFFF" />
                    )}
                  </View>
                  <Text style={[
                    styles.detailsTitle,
                    settings.darkMode && styles.detailsTitleDark,
                  ]}>
                    {selectedNode.name}
                  </Text>
                </View>
                <TouchableOpacity onPress={() => setSelectedNode(null)}>
                  <X size={20} color={settings.darkMode ? '#9CA3AF' : '#6B7280'} />
                </TouchableOpacity>
              </View>

              <Text style={[
                styles.detailsDescription,
                settings.darkMode && styles.detailsDescriptionDark,
              ]}>
                {selectedNode.description}
              </Text>

              <View style={styles.detailsGrid}>
                <View style={[
                  styles.detailItem,
                  settings.darkMode && styles.detailItemDark,
                ]}>
                  <Text style={[
                    styles.detailLabel,
                    settings.darkMode && styles.detailLabelDark,
                  ]}>
                    Effect
                  </Text>
                  <Text style={[
                    styles.detailValue,
                    settings.darkMode && styles.detailValueDark,
                  ]}>
                    {selectedNode.effect}
                  </Text>
                </View>

                <View style={[
                  styles.detailItem,
                  settings.darkMode && styles.detailItemDark,
                ]}>
                  <Text style={[
                    styles.detailLabel,
                    settings.darkMode && styles.detailLabelDark,
                  ]}>
                    Cost
                  </Text>
                  <Text style={[
                    styles.detailValue,
                    settings.darkMode && styles.detailValueDark,
                  ]}>
                    {selectedNode.pointsCost} point{selectedNode.pointsCost > 1 ? 's' : ''}
                  </Text>
                </View>

                <View style={[
                  styles.detailItem,
                  settings.darkMode && styles.detailItemDark,
                ]}>
                  <Text style={[
                    styles.detailLabel,
                    settings.darkMode && styles.detailLabelDark,
                  ]}>
                    Required Level
                  </Text>
                  <Text style={[
                    styles.detailValue,
                    settings.darkMode && styles.detailValueDark,
                  ]}>
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
                  <LinearGradient
                    colors={['#3B82F6', '#2563EB', '#1D4ED8']}
                    style={styles.unlockButtonGradient}
                  >
                    <Text style={styles.unlockButtonText}>
                      Unlock for {selectedNode.pointsCost * 100} money
                    </Text>
                  </LinearGradient>
                </TouchableOpacity>
              )}

              {getNodeStatus(selectedNode) === 'locked' && (
                <View style={[
                  styles.lockedMessage,
                  settings.darkMode && styles.lockedMessageDark,
                ]}>
                  <AlertCircle size={16} color="#F59E0B" />
                  <Text style={[
                    styles.lockedMessageText,
                    settings.darkMode && styles.lockedMessageTextDark,
                  ]}>
                    {remainingPoints < selectedNode.pointsCost && `Need ${selectedNode.pointsCost - remainingPoints} more point${selectedNode.pointsCost - remainingPoints > 1 ? 's' : ''}. `}
                    {skill.level < selectedNode.level && `Reach level ${selectedNode.level}. `}
                    {selectedNode.requires && selectedNode.requires.some(req => !isNodeUnlocked(req)) && 'Unlock prerequisites first.'}
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
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 8,
  },
  container: {
    width: '100%',
    maxWidth: screenWidth * 0.95,
    maxHeight: '95%',
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 20 },
    shadowOpacity: 0.3,
    shadowRadius: 30,
    elevation: 20,
  },
  containerDark: {
    backgroundColor: '#1F2937',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0, 0, 0, 0.06)',
    backgroundColor: '#FAFBFC',
  },
  headerDark: {
    backgroundColor: '#111827',
    borderBottomColor: 'rgba(255, 255, 255, 0.1)',
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  headerIconContainer: {
    width: 56,
    height: 56,
    borderRadius: 28,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  headerText: {
    flex: 1,
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 4,
  },
  titleDark: {
    color: '#F9FAFB',
  },
  subtitle: {
    fontSize: 15,
    color: '#6B7280',
    fontWeight: '500',
  },
  subtitleDark: {
    color: '#9CA3AF',
  },
  closeButton: {
    padding: 8,
    borderRadius: 8,
  },
  statsBar: {
    flexDirection: 'row',
    padding: 16,
    backgroundColor: '#F9FAFB',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0, 0, 0, 0.06)',
  },
  statsBarDark: {
    backgroundColor: '#111827',
    borderBottomColor: 'rgba(255, 255, 255, 0.1)',
  },
  statItem: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
  },
  statIconContainer: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(245, 158, 11, 0.1)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 8,
  },
  statContent: {
    flex: 1,
  },
  statLabel: {
    fontSize: 11,
    color: '#6B7280',
    fontWeight: '500',
    marginBottom: 2,
  },
  statLabelDark: {
    color: '#9CA3AF',
  },
  statValue: {
    fontSize: 16,
    fontWeight: '700',
    color: '#111827',
  },
  statValueDark: {
    color: '#F9FAFB',
  },
  statDivider: {
    width: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.1)',
    marginHorizontal: 12,
  },
  descriptionContainer: {
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0, 0, 0, 0.06)',
  },
  description: {
    fontSize: 16,
    color: '#4B5563',
    lineHeight: 24,
    marginBottom: 14,
  },
  descriptionDark: {
    color: '#D1D5DB',
  },
  benefitBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ECFDF5',
    padding: 12,
    borderRadius: 12,
    gap: 8,
  },
  benefitBoxDark: {
    backgroundColor: 'rgba(16, 185, 129, 0.15)',
  },
  benefitText: {
    fontSize: 14,
    color: '#065F46',
    fontWeight: '500',
    flex: 1,
  },
  benefitTextDark: {
    color: '#10B981',
  },
  talentsList: {
    flex: 1,
  },
  talentsListContent: {
    padding: 20,
    gap: 16,
  },
  talentCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    borderWidth: 2,
    borderColor: '#E5E7EB',
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  talentCardDark: {
    backgroundColor: '#1F2937',
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  talentCardUnlocked: {
    borderColor: '#10B981',
    backgroundColor: '#F0FDF4',
  },
  talentCardAvailable: {
    borderColor: '#3B82F6',
    backgroundColor: '#EFF6FF',
  },
  talentCardLocked: {
    opacity: 0.6,
    borderColor: '#D1D5DB',
  },
  talentCardContent: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 20,
    gap: 20,
  },
  iconContainer: {
    width: 64,
    height: 64,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
  },
  iconContainerUnlocked: {
    backgroundColor: '#10B981',
  },
  iconContainerAvailable: {
    backgroundColor: '#3B82F6',
  },
  iconContainerLocked: {
    backgroundColor: '#E5E7EB',
  },
  talentInfo: {
    flex: 1,
  },
  talentHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 6,
    gap: 8,
  },
  talentName: {
    fontSize: 18,
    fontWeight: '700',
    color: '#111827',
    flex: 1,
  },
  talentNameDark: {
    color: '#F9FAFB',
  },
  talentNameLocked: {
    color: '#6B7280',
  },
  unlockedBadge: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: '#10B981',
    justifyContent: 'center',
    alignItems: 'center',
  },
  talentDescription: {
    fontSize: 14,
    color: '#6B7280',
    lineHeight: 20,
    marginBottom: 10,
  },
  talentDescriptionDark: {
    color: '#9CA3AF',
  },
  talentDescriptionLocked: {
    color: '#9CA3AF',
  },
  talentMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    marginBottom: 8,
  },
  metaItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  metaText: {
    fontSize: 12,
    color: '#6B7280',
    fontWeight: '500',
  },
  metaTextDark: {
    color: '#9CA3AF',
  },
  metaTextLocked: {
    color: '#9CA3AF',
  },
  effectBadge: {
    alignSelf: 'flex-start',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
    marginTop: 4,
  },
  effectBadgeUnlocked: {
    backgroundColor: '#D1FAE5',
  },
  effectBadgeAvailable: {
    backgroundColor: '#DBEAFE',
  },
  effectBadgeText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#065F46',
  },
  prerequisitesContainer: {
    paddingHorizontal: 16,
    paddingBottom: 12,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
  },
  prerequisitesText: {
    fontSize: 11,
    color: '#6B7280',
    fontStyle: 'italic',
  },
  prerequisitesTextDark: {
    color: '#9CA3AF',
  },
  detailsPanel: {
    backgroundColor: '#F9FAFB',
    borderTopWidth: 1,
    borderTopColor: 'rgba(0, 0, 0, 0.06)',
    padding: 20,
  },
  detailsPanelDark: {
    backgroundColor: '#111827',
    borderTopColor: 'rgba(255, 255, 255, 0.1)',
  },
  detailsHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  detailsHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    gap: 12,
  },
  detailsIconContainer: {
    width: 48,
    height: 48,
    borderRadius: 14,
    backgroundColor: '#3B82F6',
    justifyContent: 'center',
    alignItems: 'center',
  },
  detailsIconContainerLocked: {
    backgroundColor: '#E5E7EB',
  },
  detailsTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#111827',
    flex: 1,
  },
  detailsTitleDark: {
    color: '#F9FAFB',
  },
  detailsDescription: {
    fontSize: 15,
    color: '#4B5563',
    lineHeight: 22,
    marginBottom: 18,
  },
  detailsDescriptionDark: {
    color: '#D1D5DB',
  },
  detailsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginBottom: 16,
  },
  detailItem: {
    flex: 1,
    minWidth: '45%',
    backgroundColor: '#FFFFFF',
    padding: 16,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  detailItemDark: {
    backgroundColor: '#1F2937',
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  detailLabel: {
    fontSize: 11,
    color: '#6B7280',
    fontWeight: '500',
    marginBottom: 4,
  },
  detailLabelDark: {
    color: '#9CA3AF',
  },
  detailValue: {
    fontSize: 15,
    fontWeight: '700',
    color: '#111827',
  },
  detailValueDark: {
    color: '#F9FAFB',
  },
  unlockButton: {
    borderRadius: 12,
    overflow: 'hidden',
  },
  unlockButtonGradient: {
    padding: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  unlockButtonText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  lockedMessage: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FEF3C7',
    padding: 12,
    borderRadius: 12,
    gap: 8,
  },
  lockedMessageDark: {
    backgroundColor: 'rgba(251, 191, 36, 0.15)',
  },
  lockedMessageText: {
    fontSize: 13,
    color: '#92400E',
    flex: 1,
    fontWeight: '500',
  },
  lockedMessageTextDark: {
    color: '#FBBF24',
  },
});
