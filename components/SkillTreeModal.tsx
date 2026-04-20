/**
 * Skill Tree Modal Component
 * 
 * General life skills and career skill tree system
 * Different from SkillTalentTree which is for crime skills
 */
import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  ScrollView,
  Animated,
  Dimensions,
  Alert,
} from 'react-native';
import LinearGradientFallback from '@/components/fallbacks/LinearGradientFallback';
const LinearGradient = LinearGradientFallback;
// import { BlurView } from 'expo-blur'; // Removed - TurboModule crash fix
import {
  X,
  Star,
  Lock,
  CheckCircle,
  Zap,
  Brain,
  Heart,
  DollarSign,
  Users,
  Briefcase,
  GraduationCap,
  Dumbbell,
  Sparkles,
  Crown,
  TrendingUp,
  Shield,
  Target,
  Award,
} from 'lucide-react-native';
import { useGame } from '@/contexts/GameContext';
import { scale, fontScale } from '@/utils/scaling';

const { width: screenWidth, height: screenHeight } = Dimensions.get('window');

interface SkillNode {
  id: string;
  name: string;
  description: string;
  effect: string;
  cost: number; // Money cost to unlock
  levelRequired: number; // Player age or stat level required
  row: number;
  column: number;
  requires?: string[];
  icon: any;
  color: string[];
  category: 'career' | 'social' | 'health' | 'finance' | 'education';
}

interface SkillCategory {
  id: string;
  name: string;
  description: string;
  icon: any;
  color: string[];
  nodes: SkillNode[];
}

// Define skill trees for different life aspects
const SKILL_CATEGORIES: SkillCategory[] = [
  {
    id: 'career',
    name: 'Career Mastery',
    description: 'Advance your professional skills',
    icon: Briefcase,
    color: ['#3B82F6', '#1D4ED8'],
    nodes: [
      {
        id: 'networking',
        name: 'Networking',
        description: 'Build professional connections',
        effect: '+5% job application success',
        cost: 500,
        levelRequired: 18,
        row: 0,
        column: 1,
        icon: Users,
        color: ['#3B82F6', '#60A5FA'],
        category: 'career',
      },
      {
        id: 'leadership',
        name: 'Leadership',
        description: 'Command respect and inspire others',
        effect: '+10% promotion chance',
        cost: 1500,
        levelRequired: 25,
        row: 1,
        column: 0,
        requires: ['networking'],
        icon: Crown,
        color: ['#8B5CF6', '#A78BFA'],
        category: 'career',
      },
      {
        id: 'negotiation',
        name: 'Negotiation',
        description: 'Master the art of the deal',
        effect: '+15% salary on new jobs',
        cost: 2000,
        levelRequired: 25,
        row: 1,
        column: 2,
        requires: ['networking'],
        icon: TrendingUp,
        color: ['#10B981', '#34D399'],
        category: 'career',
      },
      {
        id: 'executive',
        name: 'Executive Presence',
        description: 'Command boardrooms with confidence',
        effect: 'Unlock C-suite positions',
        cost: 5000,
        levelRequired: 35,
        row: 2,
        column: 1,
        requires: ['leadership', 'negotiation'],
        icon: Award,
        color: ['#F59E0B', '#FBBF24'],
        category: 'career',
      },
    ],
  },
  {
    id: 'social',
    name: 'Social Intelligence',
    description: 'Master interpersonal relationships',
    icon: Heart,
    color: ['#EC4899', '#DB2777'],
    nodes: [
      {
        id: 'charisma',
        name: 'Charisma',
        description: 'Natural charm and likability',
        effect: '+10% relationship gains',
        cost: 300,
        levelRequired: 16,
        row: 0,
        column: 1,
        icon: Sparkles,
        color: ['#EC4899', '#F472B6'],
        category: 'social',
      },
      {
        id: 'empathy',
        name: 'Empathy',
        description: 'Understand others deeply',
        effect: 'Relationship decay -25%',
        cost: 800,
        levelRequired: 20,
        row: 1,
        column: 0,
        requires: ['charisma'],
        icon: Heart,
        color: ['#EF4444', '#F87171'],
        category: 'social',
      },
      {
        id: 'persuasion',
        name: 'Persuasion',
        description: 'Influence minds with words',
        effect: '+20% dating success',
        cost: 1000,
        levelRequired: 20,
        row: 1,
        column: 2,
        requires: ['charisma'],
        icon: Target,
        color: ['#8B5CF6', '#A78BFA'],
        category: 'social',
      },
      {
        id: 'socialMaster',
        name: 'Social Master',
        description: 'The ultimate social butterfly',
        effect: '+5 max relationships',
        cost: 3000,
        levelRequired: 30,
        row: 2,
        column: 1,
        requires: ['empathy', 'persuasion'],
        icon: Crown,
        color: ['#F59E0B', '#FBBF24'],
        category: 'social',
      },
    ],
  },
  {
    id: 'health',
    name: 'Physical Wellness',
    description: 'Optimize your body and mind',
    icon: Dumbbell,
    color: ['#10B981', '#059669'],
    nodes: [
      {
        id: 'stamina',
        name: 'Stamina',
        description: 'Increase your energy reserves',
        effect: '+10 max energy',
        cost: 400,
        levelRequired: 16,
        row: 0,
        column: 1,
        icon: Zap,
        color: ['#F59E0B', '#FBBF24'],
        category: 'health',
      },
      {
        id: 'resilience',
        name: 'Resilience',
        description: 'Bounce back from illness faster',
        effect: 'Recovery speed +25%',
        cost: 1000,
        levelRequired: 22,
        row: 1,
        column: 0,
        requires: ['stamina'],
        icon: Shield,
        color: ['#3B82F6', '#60A5FA'],
        category: 'health',
      },
      {
        id: 'peak_performance',
        name: 'Peak Performance',
        description: 'Push your physical limits',
        effect: '+15% gym efficiency',
        cost: 1200,
        levelRequired: 22,
        row: 1,
        column: 2,
        requires: ['stamina'],
        icon: Dumbbell,
        color: ['#EF4444', '#F87171'],
        category: 'health',
      },
      {
        id: 'vitality',
        name: 'Vitality',
        description: 'The pinnacle of physical wellness',
        effect: 'Slow aging effects',
        cost: 5000,
        levelRequired: 40,
        row: 2,
        column: 1,
        requires: ['resilience', 'peak_performance'],
        icon: Sparkles,
        color: ['#10B981', '#34D399'],
        category: 'health',
      },
    ],
  },
  {
    id: 'finance',
    name: 'Financial Acumen',
    description: 'Master the art of wealth',
    icon: DollarSign,
    color: ['#10B981', '#059669'],
    nodes: [
      {
        id: 'budgeting',
        name: 'Budgeting',
        description: 'Manage money efficiently',
        effect: '-5% weekly expenses',
        cost: 500,
        levelRequired: 18,
        row: 0,
        column: 1,
        icon: DollarSign,
        color: ['#10B981', '#34D399'],
        category: 'finance',
      },
      {
        id: 'investing',
        name: 'Investing',
        description: 'Make money work for you',
        effect: '+5% stock returns',
        cost: 2000,
        levelRequired: 25,
        row: 1,
        column: 0,
        requires: ['budgeting'],
        icon: TrendingUp,
        color: ['#3B82F6', '#60A5FA'],
        category: 'finance',
      },
      {
        id: 'tax_strategy',
        name: 'Tax Strategy',
        description: 'Legally minimize taxes',
        effect: '-10% tax rate',
        cost: 2500,
        levelRequired: 28,
        row: 1,
        column: 2,
        requires: ['budgeting'],
        icon: Shield,
        color: ['#8B5CF6', '#A78BFA'],
        category: 'finance',
      },
      {
        id: 'wealth_master',
        name: 'Wealth Mastery',
        description: 'True financial freedom',
        effect: '+25% passive income',
        cost: 10000,
        levelRequired: 40,
        row: 2,
        column: 1,
        requires: ['investing', 'tax_strategy'],
        icon: Crown,
        color: ['#F59E0B', '#FBBF24'],
        category: 'finance',
      },
    ],
  },
  {
    id: 'education',
    name: 'Intellectual Growth',
    description: 'Expand your knowledge',
    icon: GraduationCap,
    color: ['#8B5CF6', '#7C3AED'],
    nodes: [
      {
        id: 'quick_learner',
        name: 'Quick Learner',
        description: 'Absorb information rapidly',
        effect: '-10% education time',
        cost: 600,
        levelRequired: 16,
        row: 0,
        column: 1,
        icon: Brain,
        color: ['#8B5CF6', '#A78BFA'],
        category: 'education',
      },
      {
        id: 'critical_thinking',
        name: 'Critical Thinking',
        description: 'Analyze and solve problems',
        effect: '+10% study effectiveness',
        cost: 1500,
        levelRequired: 22,
        row: 1,
        column: 0,
        requires: ['quick_learner'],
        icon: Target,
        color: ['#3B82F6', '#60A5FA'],
        category: 'education',
      },
      {
        id: 'memory_palace',
        name: 'Memory Palace',
        description: 'Never forget what you learn',
        effect: 'Skills decay -50%',
        cost: 1800,
        levelRequired: 22,
        row: 1,
        column: 2,
        requires: ['quick_learner'],
        icon: Sparkles,
        color: ['#EC4899', '#F472B6'],
        category: 'education',
      },
      {
        id: 'polymath',
        name: 'Polymath',
        description: 'Master of multiple disciplines',
        effect: 'Unlock all education paths',
        cost: 8000,
        levelRequired: 35,
        row: 2,
        column: 1,
        requires: ['critical_thinking', 'memory_palace'],
        icon: Crown,
        color: ['#F59E0B', '#FBBF24'],
        category: 'education',
      },
    ],
  },
];

interface SkillTreeModalProps {
  visible: boolean;
  onClose: () => void;
}

export default function SkillTreeModal({ visible, onClose }: SkillTreeModalProps) {
  const { gameState, setGameState, saveGame } = useGame();
  const { settings } = gameState;
  const [selectedCategory, setSelectedCategory] = useState<string>('career');
  const [selectedNode, setSelectedNode] = useState<SkillNode | null>(null);
  
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const scaleAnim = useRef(new Animated.Value(0.9)).current;
  const glowAnim = useRef(new Animated.Value(0)).current;

  // Get unlocked skills from game state
  const unlockedSkills = useMemo(() => {
    return gameState.unlockedLifeSkills || [];
  }, [gameState.unlockedLifeSkills]);

  // Calculate skill points (based on achievements, age, education)
  const skillPoints = useMemo(() => {
    let points = 0;
    // Base points from age
    points += Math.floor(gameState.date.age / 5);
    // Points from completed education
    const completedEducation = (gameState.educations || []).filter(e => e.completed);
    points += completedEducation.length * 2;
    // Points from achievements
    const achievements = (gameState.achievements || []).filter(a => a.completed);
    points += achievements.length;
    return points;
  }, [gameState.date.age, gameState.educations, gameState.achievements]);

  useEffect(() => {
    if (visible) {
      Animated.parallel([
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: 300,
          useNativeDriver: true,
        }),
        Animated.spring(scaleAnim, {
          toValue: 1,
          tension: 80,
          friction: 10,
          useNativeDriver: true,
        }),
      ]).start();

      // Glow animation
      const glow = Animated.loop(
        Animated.sequence([
          Animated.timing(glowAnim, {
            toValue: 1,
            duration: 1500,
            useNativeDriver: false,
          }),
          Animated.timing(glowAnim, {
            toValue: 0,
            duration: 1500,
            useNativeDriver: false,
          }),
        ])
      );
      glow.start();

      return () => {
        // Cleanup animations
        glow.stop();
        fadeAnim.setValue(0);
        scaleAnim.setValue(0);
        glowAnim.setValue(0);
      };
    } else {
      fadeAnim.setValue(0);
      scaleAnim.setValue(0.9);
      return undefined;
    }
  }, [visible, fadeAnim, scaleAnim, glowAnim]);

  const isNodeUnlocked = useCallback((nodeId: string) => {
    return unlockedSkills.includes(nodeId);
  }, [unlockedSkills]);

  const canUnlockNode = useCallback((node: SkillNode) => {
    if (isNodeUnlocked(node.id)) return false;
    if (gameState.stats.money < node.cost) return false;
    if (gameState.date.age < node.levelRequired) return false;
    
    if (node.requires) {
      return node.requires.every(req => isNodeUnlocked(req));
    }
    return true;
  }, [gameState.stats.money, gameState.date.age, isNodeUnlocked]);

  const handleUnlockNode = useCallback((node: SkillNode) => {
    if (!canUnlockNode(node)) {
      if (gameState.stats.money < node.cost) {
        Alert.alert('Insufficient Funds', `You need $${node.cost.toLocaleString()} to unlock this skill.`);
      } else if (gameState.date.age < node.levelRequired) {
        Alert.alert('Too Young', `You need to be at least ${node.levelRequired} years old.`);
      } else if (node.requires) {
        Alert.alert('Prerequisites Required', 'You must unlock the required skills first.');
      }
      return;
    }

    Alert.alert(
      `Unlock ${node.name}?`,
      `This will cost $${node.cost.toLocaleString()}\n\nEffect: ${node.effect}`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Unlock',
          onPress: () => {
            setGameState(prev => ({
              ...prev,
              stats: {
                ...prev.stats,
                money: prev.stats.money - node.cost,
              },
              unlockedLifeSkills: [...(prev.unlockedLifeSkills || []), node.id],
            }));
            saveGame();
            Alert.alert('Skill Unlocked!', `${node.name} is now active.\n\n${node.effect}`);
          },
        },
      ]
    );
  }, [canUnlockNode, setGameState, saveGame, gameState.stats.money, gameState.date.age]);

  const getNodeStatus = useCallback((node: SkillNode) => {
    if (isNodeUnlocked(node.id)) return 'unlocked';
    if (canUnlockNode(node)) return 'available';
    return 'locked';
  }, [isNodeUnlocked, canUnlockNode]);

  const currentCategory = useMemo(() => {
    return SKILL_CATEGORIES.find(c => c.id === selectedCategory) || SKILL_CATEGORIES[0];
  }, [selectedCategory]);

  const renderCategoryTabs = () => (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      style={styles.categoryTabs}
      contentContainerStyle={styles.categoryTabsContent}
    >
      {SKILL_CATEGORIES.map(category => {
        const CategoryIcon = category.icon;
        const isActive = selectedCategory === category.id;
        const unlockedCount = category.nodes.filter(n => isNodeUnlocked(n.id)).length;
        
        return (
          <TouchableOpacity
            key={category.id}
            style={[styles.categoryTab, isActive && styles.categoryTabActive]}
            onPress={() => setSelectedCategory(category.id)}
          >
            <LinearGradient
              colors={(isActive ? category.color : ['transparent', 'transparent']) as unknown as readonly [string, string, ...string[]]}
              style={styles.categoryTabGradient}
            >
              <CategoryIcon size={20} color={isActive ? '#FFF' : settings.darkMode ? '#9CA3AF' : '#6B7280'} />
              <Text style={[
                styles.categoryTabText,
                isActive && styles.categoryTabTextActive,
                settings.darkMode && !isActive && styles.textMuted,
              ]}>
                {category.name}
              </Text>
              <View style={[styles.categoryBadge, isActive && styles.categoryBadgeActive]}>
                <Text style={[styles.categoryBadgeText, isActive && styles.categoryBadgeTextActive]}>
                  {unlockedCount}/{category.nodes.length}
                </Text>
              </View>
            </LinearGradient>
          </TouchableOpacity>
        );
      })}
    </ScrollView>
  );

  const renderNode = (node: SkillNode) => {
    const status = getNodeStatus(node);
    const NodeIcon = node.icon;
    const isSelected = selectedNode?.id === node.id;

    return (
      <TouchableOpacity
        key={node.id}
        style={[
          styles.nodeWrapper,
          { top: node.row * scale(100) + scale(20), left: node.column * scale(100) + scale(20) },
        ]}
        onPress={() => {
          setSelectedNode(node);
          if (status === 'available') {
            handleUnlockNode(node);
          }
        }}
      >
        <LinearGradient
          colors={
            (status === 'unlocked' ? node.color :
            status === 'available' ? ['#374151', '#1F2937'] :
            ['#1F2937', '#111827']) as unknown as readonly [string, string, ...string[]]
          }
          style={[
            styles.node,
            status === 'locked' && styles.nodeLocked,
            isSelected && styles.nodeSelected,
          ]}
        >
          {status === 'locked' && (
            <View style={styles.lockOverlay}>
              <Lock size={16} color="#6B7280" />
            </View>
          )}
          {status === 'unlocked' && (
            <View style={styles.checkOverlay}>
              <CheckCircle size={16} color="#10B981" />
            </View>
          )}
          <NodeIcon
            size={24}
            color={status === 'unlocked' ? '#FFF' : status === 'available' ? '#60A5FA' : '#6B7280'}
          />
        </LinearGradient>
        <Text style={[
          styles.nodeName,
          status === 'unlocked' && styles.nodeNameUnlocked,
          status === 'locked' && styles.nodeNameLocked,
          settings.darkMode && styles.textDark,
        ]}>
          {node.name}
        </Text>
      </TouchableOpacity>
    );
  };

  const renderConnections = () => {
    return currentCategory.nodes.map(node => {
      if (!node.requires) return null;
      
      return node.requires.map(reqId => {
        const reqNode = currentCategory.nodes.find(n => n.id === reqId);
        if (!reqNode) return null;

        const isActive = isNodeUnlocked(reqId);
        
        return (
          <View
            key={`${reqId}-${node.id}`}
            style={[
              styles.connection,
              {
                top: reqNode.row * scale(100) + scale(55),
                left: reqNode.column * scale(100) + scale(55),
                width: Math.abs(node.column - reqNode.column) * scale(100),
                height: Math.abs(node.row - reqNode.row) * scale(100),
                borderColor: isActive ? '#10B981' : '#374151',
              },
            ]}
          />
        );
      });
    });
  };

  const renderNodeDetails = () => {
    if (!selectedNode) return null;

    const status = getNodeStatus(selectedNode);
    const NodeIcon = selectedNode.icon;

    return (
      <View style={[styles.detailsPanel, settings.darkMode && styles.detailsPanelDark]}>
        <LinearGradient
          colors={selectedNode.color as unknown as readonly [string, string, ...string[]]}
          style={styles.detailsHeader}
        >
          <NodeIcon size={32} color="#FFF" />
          <View style={styles.detailsHeaderText}>
            <Text style={styles.detailsTitle}>{selectedNode.name}</Text>
            <Text style={styles.detailsCategory}>
              {currentCategory.name}
            </Text>
          </View>
          {status === 'unlocked' && (
            <CheckCircle size={24} color="#10B981" />
          )}
        </LinearGradient>

        <View style={styles.detailsBody}>
          <Text style={[styles.detailsDescription, settings.darkMode && styles.textMuted]}>
            {selectedNode.description}
          </Text>

          <View style={styles.detailsEffect}>
            <Sparkles size={16} color="#F59E0B" />
            <Text style={[styles.detailsEffectText, settings.darkMode && styles.textDark]}>
              {selectedNode.effect}
            </Text>
          </View>

          <View style={styles.detailsRequirements}>
            <View style={styles.requirement}>
              <DollarSign size={14} color={gameState.stats.money >= selectedNode.cost ? '#10B981' : '#EF4444'} />
              <Text style={[
                styles.requirementText,
                { color: gameState.stats.money >= selectedNode.cost ? '#10B981' : '#EF4444' }
              ]}>
                ${selectedNode.cost.toLocaleString()}
              </Text>
            </View>
            <View style={styles.requirement}>
              <Star size={14} color={gameState.date.age >= selectedNode.levelRequired ? '#10B981' : '#EF4444'} />
              <Text style={[
                styles.requirementText,
                { color: gameState.date.age >= selectedNode.levelRequired ? '#10B981' : '#EF4444' }
              ]}>
                Age {selectedNode.levelRequired}+
              </Text>
            </View>
          </View>

          {status === 'available' && (
            <TouchableOpacity
              style={styles.unlockButton}
              onPress={() => handleUnlockNode(selectedNode)}
            >
              <LinearGradient
                colors={['#10B981', '#059669']}
                style={styles.unlockButtonGradient}
              >
                <Zap size={18} color="#FFF" />
                <Text style={styles.unlockButtonText}>Unlock Skill</Text>
              </LinearGradient>
            </TouchableOpacity>
          )}

          {status === 'locked' && selectedNode.requires && (
            <Text style={styles.requiresText}>
              Requires: {selectedNode.requires.map(r => 
                currentCategory.nodes.find(n => n.id === r)?.name
              ).join(', ')}
            </Text>
          )}
        </View>
      </View>
    );
  };

  if (!visible) return null;

  return (
    <Modal visible={visible} transparent animationType="none" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <Animated.View
          style={[
            styles.container,
            settings.darkMode && styles.containerDark,
            {
              opacity: fadeAnim,
              transform: [{ scale: scaleAnim }],
            },
          ]}
        >
          {/* Header */}
          <View style={styles.header}>
            <View style={styles.headerContent}>
              <Brain size={28} color={settings.darkMode ? '#60A5FA' : '#3B82F6'} />
              <Text style={[styles.headerTitle, settings.darkMode && styles.textDark]}>
                Life Skills
              </Text>
            </View>
            <View style={styles.headerStats}>
              <View style={styles.statBadge}>
                <Star size={14} color="#F59E0B" />
                <Text style={styles.statBadgeText}>{skillPoints} Points</Text>
              </View>
              <View style={styles.statBadge}>
                <CheckCircle size={14} color="#10B981" />
                <Text style={styles.statBadgeText}>{unlockedSkills.length} Unlocked</Text>
              </View>
            </View>
            <TouchableOpacity onPress={onClose} style={styles.closeButton}>
              <X size={24} color={settings.darkMode ? '#F9FAFB' : '#111827'} />
            </TouchableOpacity>
          </View>

          {/* Category Tabs */}
          {renderCategoryTabs()}

          {/* Skill Tree */}
          <View style={styles.treeContainer}>
            <ScrollView
              style={styles.treeScroll}
              contentContainerStyle={styles.treeContent}
              showsVerticalScrollIndicator={false}
            >
              <View style={styles.tree}>
                {renderConnections()}
                {currentCategory.nodes.map(renderNode)}
              </View>
            </ScrollView>
          </View>

          {/* Details Panel */}
          {renderNodeDetails()}
        </Animated.View>
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
  container: {
    width: screenWidth * 0.95,
    height: screenHeight * 0.9,
    backgroundColor: '#FFF',
    borderRadius: scale(20),
    overflow: 'hidden',
  },
  containerDark: {
    backgroundColor: '#111827',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: scale(16),
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  headerContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: fontScale(20),
    fontWeight: 'bold',
    color: '#111827',
    marginLeft: scale(10),
  },
  headerStats: {
    flexDirection: 'row',
    gap: scale(8),
  },
  statBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(59, 130, 246, 0.1)',
    paddingHorizontal: scale(10),
    paddingVertical: scale(4),
    borderRadius: scale(12),
  },
  statBadgeText: {
    fontSize: fontScale(12),
    fontWeight: '600',
    color: '#3B82F6',
    marginLeft: scale(4),
  },
  closeButton: {
    padding: scale(8),
  },
  categoryTabs: {
    maxHeight: scale(60),
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  categoryTabsContent: {
    paddingHorizontal: scale(12),
    paddingVertical: scale(8),
    gap: scale(8),
  },
  categoryTab: {
    borderRadius: scale(12),
    marginRight: scale(8),
  },
  categoryTabActive: {},
  categoryTabGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: scale(14),
    paddingVertical: scale(10),
    borderRadius: scale(12),
    gap: scale(6),
  },
  categoryTabText: {
    fontSize: fontScale(13),
    fontWeight: '600',
    color: '#6B7280',
  },
  categoryTabTextActive: {
    color: '#FFF',
  },
  categoryBadge: {
    backgroundColor: 'rgba(0,0,0,0.1)',
    paddingHorizontal: scale(6),
    paddingVertical: scale(2),
    borderRadius: scale(8),
  },
  categoryBadgeActive: {
    backgroundColor: 'rgba(255,255,255,0.2)',
  },
  categoryBadgeText: {
    fontSize: fontScale(10),
    fontWeight: '600',
    color: '#6B7280',
  },
  categoryBadgeTextActive: {
    color: '#FFF',
  },
  treeContainer: {
    flex: 1,
  },
  treeScroll: {
    flex: 1,
  },
  treeContent: {
    padding: scale(20),
    minHeight: scale(400),
  },
  tree: {
    position: 'relative',
    height: scale(350),
  },
  connection: {
    position: 'absolute',
    borderWidth: 2,
    borderStyle: 'dashed',
    borderRadius: scale(4),
  },
  nodeWrapper: {
    position: 'absolute',
    alignItems: 'center',
    width: scale(70),
  },
  node: {
    width: scale(56),
    height: scale(56),
    borderRadius: scale(28),
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
    elevation: 6,
  },
  nodeLocked: {
    opacity: 0.5,
  },
  nodeSelected: {
    borderWidth: 3,
    borderColor: '#60A5FA',
  },
  lockOverlay: {
    position: 'absolute',
    top: -6,
    right: -6,
    backgroundColor: '#1F2937',
    borderRadius: scale(10),
    padding: scale(4),
  },
  checkOverlay: {
    position: 'absolute',
    top: -6,
    right: -6,
    backgroundColor: '#FFF',
    borderRadius: scale(10),
    padding: scale(2),
  },
  nodeName: {
    marginTop: scale(6),
    fontSize: fontScale(10),
    fontWeight: '600',
    color: '#374151',
    textAlign: 'center',
    maxWidth: scale(70),
  },
  nodeNameUnlocked: {
    color: '#10B981',
  },
  nodeNameLocked: {
    color: '#6B7280',
  },
  detailsPanel: {
    backgroundColor: '#F9FAFB',
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
    maxHeight: scale(200),
  },
  detailsPanelDark: {
    backgroundColor: '#1F2937',
    borderTopColor: '#374151',
  },
  detailsHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: scale(12),
  },
  detailsHeaderText: {
    flex: 1,
    marginLeft: scale(12),
  },
  detailsTitle: {
    fontSize: fontScale(16),
    fontWeight: 'bold',
    color: '#FFF',
  },
  detailsCategory: {
    fontSize: fontScale(12),
    color: 'rgba(255,255,255,0.8)',
    marginTop: scale(2),
  },
  detailsBody: {
    padding: scale(12),
  },
  detailsDescription: {
    fontSize: fontScale(13),
    color: '#6B7280',
    marginBottom: scale(8),
  },
  detailsEffect: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(245, 158, 11, 0.1)',
    paddingHorizontal: scale(10),
    paddingVertical: scale(6),
    borderRadius: scale(8),
    marginBottom: scale(10),
  },
  detailsEffectText: {
    fontSize: fontScale(13),
    fontWeight: '600',
    color: '#92400E',
    marginLeft: scale(6),
  },
  detailsRequirements: {
    flexDirection: 'row',
    gap: scale(12),
    marginBottom: scale(10),
  },
  requirement: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  requirementText: {
    fontSize: fontScale(12),
    fontWeight: '600',
    marginLeft: scale(4),
  },
  unlockButton: {
    borderRadius: scale(10),
    overflow: 'hidden',
    marginTop: scale(4),
  },
  unlockButtonGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: scale(10),
  },
  unlockButtonText: {
    color: '#FFF',
    fontSize: fontScale(14),
    fontWeight: '600',
    marginLeft: scale(6),
  },
  requiresText: {
    fontSize: fontScale(11),
    color: '#EF4444',
    fontStyle: 'italic',
  },
  textDark: {
    color: '#F9FAFB',
  },
  textMuted: {
    color: '#9CA3AF',
  },
});

