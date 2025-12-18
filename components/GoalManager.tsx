import React, { useState, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Modal,
  TextInput,
  Alert,
  Switch,
} from 'react-native';
import {
  Target,
  Plus,
  Calendar,
  TrendingUp,
  CheckCircle,
  Clock,
  AlertCircle,
  Star,
  Filter,
  Search,
  X,
  Edit3,
  Trash2,
  Play,
  Pause,
  RotateCcw,
} from 'lucide-react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useGame } from '@/contexts/GameContext';
import { GameState, GoalProgress } from '@/contexts/game/types';
import {
  Goal,
  GoalCategory,
  GoalPriority,
  GoalStatus,
  GoalTemplate,
  GOAL_TEMPLATES,
  GOAL_CATEGORIES,
  createGoalFromTemplate,
  calculateGoalProgress,
  getGoalStatus,
  getGoalPriorityColor,
  getGoalStatusColor,
  formatGoalProgress,
  getGoalTimeRemaining,
  isGoalOverdue,
} from '@/utils/goalSystem';
import { responsiveFontSize, responsiveSpacing, responsiveBorderRadius } from '@/utils/scaling';
import { logger } from '@/utils/logger';

interface GoalManagerProps {
  visible: boolean;
  onClose: () => void;
}

export default function GoalManager({ visible, onClose }: GoalManagerProps) {
  const { gameState, setGameState, saveGame } = useGame();
  const [activeTab, setActiveTab] = useState<'active' | 'completed' | 'templates'>('active');
  const [selectedCategory, setSelectedCategory] = useState<GoalCategory | 'all'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [editingGoal, setEditingGoal] = useState<Goal | null>(null);
  const [selectedTemplate, setSelectedTemplate] = useState<GoalTemplate | null>(null);

  // Get goals from game state (we'll add this to GameState interface later)
  const goals = (gameState as GameState & { goals?: Goal[]; goalProgress?: Record<string, GoalProgress> }).goals || [];
  const goalProgress = (gameState as GameState & { goals?: Goal[]; goalProgress?: Record<string, GoalProgress> }).goalProgress || {};

  const filteredGoals = useMemo(() => {
    let filtered = goals.filter((goal: Goal) => {
      const matchesTab = 
        (activeTab === 'active' && goal.status === 'active') ||
        (activeTab === 'completed' && goal.status === 'completed') ||
        activeTab === 'templates';
      
      const matchesCategory = selectedCategory === 'all' || goal.category === selectedCategory;
      const matchesSearch = goal.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
                           goal.description.toLowerCase().includes(searchQuery.toLowerCase());
      
      return matchesTab && matchesCategory && matchesSearch;
    });

    // Sort by priority and deadline
    return filtered.sort((a: Goal, b: Goal) => {
      const priorityOrder = { critical: 4, high: 3, medium: 2, low: 1 };
      const aPriority = priorityOrder[a.priority] || 0;
      const bPriority = priorityOrder[b.priority] || 0;
      
      if (aPriority !== bPriority) return bPriority - aPriority;
      
      // Then by deadline (closest first)
      if (a.deadline && b.deadline) return a.deadline - b.deadline;
      if (a.deadline) return -1;
      if (b.deadline) return 1;
      
      return 0;
    });
  }, [goals, activeTab, selectedCategory, searchQuery]);

  const createGoal = (template: GoalTemplate, customizations?: Partial<Goal>) => {
    const newGoal = createGoalFromTemplate(template, customizations);
    
    setGameState((prev: GameState) => ({
      ...prev,
      goals: [...(prev.goals || []), newGoal],
    }));
    saveGame();
    
    setShowCreateModal(false);
    setSelectedTemplate(null);
  };

  const updateGoal = (goalId: string, updates: Partial<Goal>) => {
    setGameState((prev: GameState) => ({
      ...prev,
      goals: (prev.goals || []).map((goal: Goal) =>
        goal.id === goalId ? { ...goal, ...updates } : goal
      ),
    }));
    saveGame();
  };

  const deleteGoal = (goalId: string) => {
    Alert.alert(
      'Delete Goal',
      'Are you sure you want to delete this goal? This action cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => {
            setGameState((prev: GameState) => ({
              ...prev,
              goals: (prev.goals || []).filter((goal: Goal) => goal.id !== goalId),
            }));
            saveGame();
          },
        },
      ]
    );
  };

  const completeGoal = (goal: Goal) => {
    if (goal.current < goal.target) {
      Alert.alert(
        'Goal Not Complete',
        'This goal hasn\'t reached its target yet. Would you like to mark it as complete anyway?',
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Mark Complete',
            onPress: () => {
              updateGoal(goal.id, {
                status: 'completed',
                completedAt: Date.now(),
                current: goal.target,
              });
              
              // BUG FIX: Link Life Goals completion to achievement perks
              // Check if this goal unlocks an achievement perk
              checkGoalAchievement(goal.id);
              
              // Give reward
              if (goal.reward) {
                applyGoalReward(goal.reward);
                Alert.alert(
                  '🎉 Goal Completed!',
                  `You earned ${goal.reward.amount.toLocaleString()} ${goal.reward.type}!`
                );
              }
            },
          },
        ]
      );
    } else {
      updateGoal(goal.id, {
        status: 'completed',
        completedAt: Date.now(),
      });
      
      // BUG FIX: Link Life Goals completion to achievement perks
      // Check if this goal unlocks an achievement perk
      checkGoalAchievement(goal.id);
      
      // Give reward
      if (goal.reward) {
        applyGoalReward(goal.reward);
        Alert.alert(
          '🎉 Goal Completed!',
          `You earned ${goal.reward.amount.toLocaleString()} ${goal.reward.type}!`
        );
      }
    }
  };

  // BUG FIX: Check if goal completion unlocks achievement perks
  const checkGoalAchievement = (goalId: string) => {
    setGameState((prev: GameState) => {
      // Map goal IDs to achievement IDs (if applicable)
      // This is a placeholder - you may need to adjust based on your goal/achievement mapping
      const goalToAchievementMap: Record<string, string> = {
        // Add mappings here if goals should unlock specific achievements
        // Example: 'get_job': 'first_job',
      };
      
      const achievementId = goalToAchievementMap[goalId];
      if (achievementId) {
        // Complete the achievement if it exists
        const achievement = prev.achievements?.find(a => a.id === achievementId);
        if (achievement && !achievement.completed) {
          const updatedAchievements = prev.achievements.map(a =>
            a.id === achievementId ? { ...a, completed: true } : a
          );
          
          // Check if achievement unlocks a perk
          // eslint-disable-next-line @typescript-eslint/no-require-imports
          const { perksData } = require('@/app/(onboarding)/Perks');
          const unlockedPerk = perksData.find((p: any) => p.unlock?.achievementId === achievementId);
          
          if (unlockedPerk) {
            // Save as permanent perk
            // Note: This requires access to savePermanentPerk function
            // You may need to pass it as a prop or access via context
            return {
              ...prev,
              achievements: updatedAchievements,
              perks: {
                ...prev.perks,
                [unlockedPerk.id]: true,
              },
            };
          }
          
          return {
            ...prev,
            achievements: updatedAchievements,
          };
        }
      }
      
      return prev;
    });
  };

  // Apply reward to game state
  const applyGoalReward = (reward: { type: string; amount: number }) => {
    setGameState((prev: GameState) => {
      const newStats = { ...prev.stats };
      
      switch (reward.type) {
        case 'money':
          newStats.money = (newStats.money || 0) + reward.amount;
          break;
        case 'gems':
          newStats.gems = (newStats.gems || 0) + reward.amount;
          break;
        case 'happiness':
          newStats.happiness = Math.min(100, (newStats.happiness || 0) + reward.amount);
          break;
        case 'energy':
          newStats.energy = Math.min(100, (newStats.energy || 0) + reward.amount);
          break;
        case 'health':
          newStats.health = Math.min(100, (newStats.health || 0) + reward.amount);
          break;
      }
      
      return {
        ...prev,
        stats: newStats,
      };
    });
    saveGame();
  };

  const renderGoalCard = (goal: Goal) => {
    const progress = calculateGoalProgress(goal);
    const status = getGoalStatus(goal);
    const isOverdue = isGoalOverdue(goal);
    const categoryInfo = GOAL_CATEGORIES[goal.category];

    return (
      <View key={goal.id} style={[styles.goalCard, gameState.settings.darkMode && styles.goalCardDark]}>
        <View style={styles.goalHeader}>
          <View style={styles.goalTitleRow}>
            <Text style={[styles.goalCategory, { color: categoryInfo.color }]}>
              {categoryInfo.icon} {categoryInfo.name}
            </Text>
            <View style={styles.goalActions}>
              <TouchableOpacity
                style={styles.actionButton}
                onPress={() => setEditingGoal(goal)}
              >
                <Edit3 size={16} color="#6B7280" />
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.actionButton}
                onPress={() => deleteGoal(goal.id)}
              >
                <Trash2 size={16} color="#EF4444" />
              </TouchableOpacity>
            </View>
          </View>
          
          <Text style={[styles.goalTitle, gameState.settings.darkMode && styles.goalTitleDark]}>
            {goal.title}
          </Text>
          <Text style={[styles.goalDescription, gameState.settings.darkMode && styles.goalDescriptionDark]}>
            {goal.description}
          </Text>
        </View>

        <View style={styles.goalProgress}>
          <View style={styles.progressHeader}>
            <Text style={[styles.progressText, gameState.settings.darkMode && styles.progressTextDark]}>
              {formatGoalProgress(goal)}
            </Text>
            <View style={[styles.priorityBadge, { backgroundColor: getGoalPriorityColor(goal.priority) }]}>
              <Text style={styles.priorityText}>{goal.priority.toUpperCase()}</Text>
            </View>
          </View>
          
          <View style={styles.progressBar}>
            <View style={[styles.progressFill, { width: `${progress}%`, backgroundColor: categoryInfo.color }]} />
          </View>
        </View>

        <View style={styles.goalFooter}>
          <View style={styles.goalMeta}>
            {goal.deadline && (
              <View style={styles.metaItem}>
                <Calendar size={14} color="#6B7280" />
                <Text style={[styles.metaText, gameState.settings.darkMode && styles.metaTextDark]}>
                  {getGoalTimeRemaining(goal)}
                </Text>
              </View>
            )}
            
            <View style={styles.metaItem}>
              {status === 'completed' ? (
                <CheckCircle size={14} color="#10B981" />
              ) : isOverdue ? (
                <AlertCircle size={14} color="#EF4444" />
              ) : (
                <Clock size={14} color="#6B7280" />
              )}
              <Text style={[styles.metaText, gameState.settings.darkMode && styles.metaTextDark]}>
                {status.charAt(0).toUpperCase() + status.slice(1)}
              </Text>
            </View>
          </View>

          {status === 'active' && (
            <TouchableOpacity
              style={[styles.completeButton, { backgroundColor: categoryInfo.color }]}
              onPress={() => completeGoal(goal)}
            >
              <CheckCircle size={16} color="#FFFFFF" />
              <Text style={styles.completeButtonText}>Complete</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>
    );
  };

  const renderTemplateCard = (template: GoalTemplate) => {
    const categoryInfo = GOAL_CATEGORIES[template.category];

    return (
      <TouchableOpacity
        key={template.id}
        style={[styles.templateCard, gameState.settings.darkMode && styles.templateCardDark]}
        onPress={() => {
          setSelectedTemplate(template);
          setShowCreateModal(true);
        }}
      >
        <View style={styles.templateHeader}>
          <Text style={[styles.templateCategory, { color: categoryInfo.color }]}>
            {categoryInfo.icon} {categoryInfo.name}
          </Text>
          <View style={[styles.difficultyBadge, { backgroundColor: getGoalPriorityColor(template.difficulty as GoalPriority) }]}>
            <Text style={styles.difficultyText}>{template.difficulty.toUpperCase()}</Text>
          </View>
        </View>
        
        <Text style={[styles.templateTitle, gameState.settings.darkMode && styles.templateTitleDark]}>
          {template.title}
        </Text>
        <Text style={[styles.templateDescription, gameState.settings.darkMode && styles.templateDescriptionDark]}>
          {template.description}
        </Text>
        
        <View style={styles.templateFooter}>
          <Text style={[styles.templateTarget, gameState.settings.darkMode && styles.templateTargetDark]}>
            Target: {template.suggestedTarget} {template.unit}
          </Text>
          <Text style={[styles.templateReward, gameState.settings.darkMode && styles.templateRewardDark]}>
            Reward: {template.suggestedReward.amount} {template.suggestedReward.type}
          </Text>
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <View style={[styles.container, gameState.settings.darkMode && styles.containerDark]}>
        <View style={[styles.header, gameState.settings.darkMode && styles.headerDark]}>
          <TouchableOpacity onPress={onClose} style={styles.closeButton}>
            <X size={24} color="#FFFFFF" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Goals</Text>
          <TouchableOpacity
            style={styles.addButton}
            onPress={() => setShowCreateModal(true)}
          >
            <Plus size={24} color="#FFFFFF" />
          </TouchableOpacity>
        </View>

        <View style={styles.tabs}>
          <TouchableOpacity
            style={[styles.tab, activeTab === 'active' && styles.activeTab]}
            onPress={() => setActiveTab('active')}
          >
            <Target size={20} color={activeTab === 'active' ? '#FFFFFF' : '#6B7280'} />
            <Text style={[styles.tabText, activeTab === 'active' && styles.activeTabText]}>
              Active ({goals.filter((g: Goal) => g.status === 'active').length})
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.tab, activeTab === 'completed' && styles.activeTab]}
            onPress={() => setActiveTab('completed')}
          >
            <CheckCircle size={20} color={activeTab === 'completed' ? '#FFFFFF' : '#6B7280'} />
            <Text style={[styles.tabText, activeTab === 'completed' && styles.activeTabText]}>
              Completed ({goals.filter((g: Goal) => g.status === 'completed').length})
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.tab, activeTab === 'templates' && styles.activeTab]}
            onPress={() => setActiveTab('templates')}
          >
            <Star size={20} color={activeTab === 'templates' ? '#FFFFFF' : '#6B7280'} />
            <Text style={[styles.tabText, activeTab === 'templates' && styles.activeTabText]}>
              Templates
            </Text>
          </TouchableOpacity>
        </View>

        {activeTab !== 'templates' && (
          <View style={styles.filters}>
            <View style={styles.searchContainer}>
              <Search size={16} color="#6B7280" />
              <TextInput
                style={[styles.searchInput, gameState.settings.darkMode && styles.searchInputDark]}
                placeholder="Search goals..."
                placeholderTextColor={gameState.settings.darkMode ? '#9CA3AF' : '#6B7280'}
                value={searchQuery}
                onChangeText={setSearchQuery}
              />
            </View>

            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.categoryFilter}>
              <TouchableOpacity
                style={[styles.categoryChip, selectedCategory === 'all' && styles.activeCategoryChip]}
                onPress={() => setSelectedCategory('all')}
              >
                <Text style={[styles.categoryChipText, selectedCategory === 'all' && styles.activeCategoryChipText]}>
                  All
                </Text>
              </TouchableOpacity>
              {Object.entries(GOAL_CATEGORIES).map(([key, category]) => (
                <TouchableOpacity
                  key={key}
                  style={[styles.categoryChip, selectedCategory === key && styles.activeCategoryChip]}
                  onPress={() => setSelectedCategory(key as GoalCategory)}
                >
                  <Text style={[styles.categoryChipText, selectedCategory === key && styles.activeCategoryChipText]}>
                    {category.icon} {category.name}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        )}

        <ScrollView style={styles.content} showsVerticalScrollIndicator={true}>
          {activeTab === 'templates' ? (
            <View style={styles.templatesGrid}>
              {GOAL_TEMPLATES.map(renderTemplateCard)}
            </View>
          ) : (
            <View style={styles.goalsList}>
              {filteredGoals.length > 0 ? (
                filteredGoals.map(renderGoalCard)
              ) : (
                <View style={styles.emptyState}>
                  <Target size={48} color="#6B7280" />
                  <Text style={[styles.emptyStateTitle, gameState.settings.darkMode && styles.emptyStateTitleDark]}>
                    No goals found
                  </Text>
                  <Text style={[styles.emptyStateText, gameState.settings.darkMode && styles.emptyStateTextDark]}>
                    {activeTab === 'active' 
                      ? 'Create your first goal to start tracking your progress!'
                      : 'Complete some goals to see them here.'
                    }
                  </Text>
                </View>
              )}
            </View>
          )}
        </ScrollView>

        {/* Create Goal Modal */}
        <Modal visible={showCreateModal} transparent animationType="fade" onRequestClose={() => setShowCreateModal(false)}>
          <View style={styles.modalBackdrop}>
            <View style={[styles.modalContent, gameState.settings.darkMode && styles.modalContentDark]}>
              <View style={styles.modalHeader}>
                <Text style={[styles.modalTitle, gameState.settings.darkMode && styles.modalTitleDark]}>
                  {selectedTemplate ? 'Create Goal' : 'New Goal'}
                </Text>
                <TouchableOpacity onPress={() => setShowCreateModal(false)}>
                  <X size={24} color="#6B7280" />
                </TouchableOpacity>
              </View>

              {selectedTemplate ? (
                <View style={styles.templatePreview}>
                  <Text style={[styles.previewTitle, gameState.settings.darkMode && styles.previewTitleDark]}>
                    {selectedTemplate.title}
                  </Text>
                  <Text style={[styles.previewDescription, gameState.settings.darkMode && styles.previewDescriptionDark]}>
                    {selectedTemplate.description}
                  </Text>
                  <Text style={[styles.previewTarget, gameState.settings.darkMode && styles.previewTargetDark]}>
                    Target: {selectedTemplate.suggestedTarget} {selectedTemplate.unit}
                  </Text>
                </View>
              ) : (
                <Text style={[styles.modalText, gameState.settings.darkMode && styles.modalTextDark]}>
                  Choose a goal template to get started, or create a custom goal.
                </Text>
              )}

              <View style={styles.modalActions}>
                <TouchableOpacity
                  style={styles.cancelButton}
                  onPress={() => setShowCreateModal(false)}
                >
                  <Text style={styles.cancelButtonText}>Cancel</Text>
                </TouchableOpacity>
                
                {selectedTemplate && (
                  <TouchableOpacity
                    style={[styles.createButton, { backgroundColor: GOAL_CATEGORIES[selectedTemplate.category].color }]}
                    onPress={() => createGoal(selectedTemplate)}
                  >
                    <Text style={styles.createButtonText}>Create Goal</Text>
                  </TouchableOpacity>
                )}
              </View>
            </View>
          </View>
        </Modal>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F9FAFB',
  },
  containerDark: {
    backgroundColor: '#111827',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: responsiveSpacing.lg,
    paddingVertical: responsiveSpacing.md,
    backgroundColor: '#3B82F6',
  },
  headerDark: {
    backgroundColor: '#1F2937',
  },
  closeButton: {
    padding: responsiveSpacing.sm,
  },
  headerTitle: {
    fontSize: responsiveFontSize.lg,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  addButton: {
    padding: responsiveSpacing.sm,
  },
  tabs: {
    flexDirection: 'row',
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  tab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: responsiveSpacing.md,
    gap: responsiveSpacing.sm,
  },
  activeTab: {
    backgroundColor: '#3B82F6',
  },
  tabText: {
    fontSize: responsiveFontSize.sm,
    fontWeight: '500',
    color: '#6B7280',
  },
  activeTabText: {
    color: '#FFFFFF',
  },
  filters: {
    padding: responsiveSpacing.md,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F3F4F6',
    borderRadius: responsiveBorderRadius.md,
    paddingHorizontal: responsiveSpacing.md,
    paddingVertical: responsiveSpacing.sm,
    marginBottom: responsiveSpacing.md,
    gap: responsiveSpacing.sm,
  },
  searchInput: {
    flex: 1,
    fontSize: responsiveFontSize.sm,
    color: '#374151',
  },
  searchInputDark: {
    color: '#D1D5DB',
  },
  categoryFilter: {
    flexDirection: 'row',
  },
  categoryChip: {
    paddingHorizontal: responsiveSpacing.md,
    paddingVertical: responsiveSpacing.sm,
    backgroundColor: '#F3F4F6',
    borderRadius: responsiveBorderRadius.full,
    marginRight: responsiveSpacing.sm,
  },
  activeCategoryChip: {
    backgroundColor: '#3B82F6',
  },
  categoryChipText: {
    fontSize: responsiveFontSize.xs,
    fontWeight: '500',
    color: '#6B7280',
  },
  activeCategoryChipText: {
    color: '#FFFFFF',
  },
  content: {
    flex: 1,
    padding: responsiveSpacing.md,
  },
  goalsList: {
    gap: responsiveSpacing.md,
  },
  goalCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: responsiveBorderRadius.lg,
    padding: responsiveSpacing.lg,
    boxShadow: '0px 2px 4px rgba(0, 0, 0, 0.1)',
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  goalCardDark: {
    backgroundColor: '#1F2937',
  },
  goalHeader: {
    marginBottom: responsiveSpacing.md,
  },
  goalTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: responsiveSpacing.sm,
  },
  goalCategory: {
    fontSize: responsiveFontSize.xs,
    fontWeight: '600',
  },
  goalActions: {
    flexDirection: 'row',
    gap: responsiveSpacing.sm,
  },
  actionButton: {
    padding: responsiveSpacing.sm,
  },
  goalTitle: {
    fontSize: responsiveFontSize.lg,
    fontWeight: '600',
    color: '#111827',
    marginBottom: responsiveSpacing.xs,
  },
  goalTitleDark: {
    color: '#F9FAFB',
  },
  goalDescription: {
    fontSize: responsiveFontSize.sm,
    color: '#6B7280',
    lineHeight: 20,
  },
  goalDescriptionDark: {
    color: '#9CA3AF',
  },
  goalProgress: {
    marginBottom: responsiveSpacing.md,
  },
  progressHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: responsiveSpacing.sm,
  },
  progressText: {
    fontSize: responsiveFontSize.sm,
    fontWeight: '500',
    color: '#374151',
  },
  progressTextDark: {
    color: '#D1D5DB',
  },
  priorityBadge: {
    paddingHorizontal: responsiveSpacing.sm,
    paddingVertical: responsiveSpacing.xs,
    borderRadius: responsiveBorderRadius.sm,
  },
  priorityText: {
    fontSize: responsiveFontSize.xs,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  progressBar: {
    height: 8,
    backgroundColor: '#E5E7EB',
    borderRadius: responsiveBorderRadius.sm,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: responsiveBorderRadius.sm,
  },
  goalFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  goalMeta: {
    flexDirection: 'row',
    gap: responsiveSpacing.md,
  },
  metaItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: responsiveSpacing.xs,
  },
  metaText: {
    fontSize: responsiveFontSize.xs,
    color: '#6B7280',
  },
  metaTextDark: {
    color: '#9CA3AF',
  },
  completeButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: responsiveSpacing.md,
    paddingVertical: responsiveSpacing.sm,
    borderRadius: responsiveBorderRadius.md,
    gap: responsiveSpacing.xs,
  },
  completeButtonText: {
    fontSize: responsiveFontSize.sm,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  templatesGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: responsiveSpacing.md,
  },
  templateCard: {
    width: '48%',
    backgroundColor: '#FFFFFF',
    borderRadius: responsiveBorderRadius.lg,
    padding: responsiveSpacing.md,
    boxShadow: '0px 2px 4px rgba(0, 0, 0, 0.1)',
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  templateCardDark: {
    backgroundColor: '#1F2937',
  },
  templateHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: responsiveSpacing.sm,
  },
  templateCategory: {
    fontSize: responsiveFontSize.xs,
    fontWeight: '600',
  },
  difficultyBadge: {
    paddingHorizontal: responsiveSpacing.sm,
    paddingVertical: responsiveSpacing.xs,
    borderRadius: responsiveBorderRadius.sm,
  },
  difficultyText: {
    fontSize: responsiveFontSize.xs,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  templateTitle: {
    fontSize: responsiveFontSize.base,
    fontWeight: '600',
    color: '#111827',
    marginBottom: responsiveSpacing.xs,
  },
  templateTitleDark: {
    color: '#F9FAFB',
  },
  templateDescription: {
    fontSize: responsiveFontSize.sm,
    color: '#6B7280',
    lineHeight: 18,
    marginBottom: responsiveSpacing.md,
  },
  templateDescriptionDark: {
    color: '#9CA3AF',
  },
  templateFooter: {
    gap: responsiveSpacing.xs,
  },
  templateTarget: {
    fontSize: responsiveFontSize.xs,
    color: '#374151',
    fontWeight: '500',
  },
  templateTargetDark: {
    color: '#D1D5DB',
  },
  templateReward: {
    fontSize: responsiveFontSize.xs,
    color: '#10B981',
    fontWeight: '500',
  },
  templateRewardDark: {
    color: '#34D399',
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: responsiveSpacing.xl,
  },
  emptyStateTitle: {
    fontSize: responsiveFontSize.lg,
    fontWeight: '600',
    color: '#374151',
    marginTop: responsiveSpacing.md,
    marginBottom: responsiveSpacing.sm,
  },
  emptyStateTitleDark: {
    color: '#D1D5DB',
  },
  emptyStateText: {
    fontSize: responsiveFontSize.sm,
    color: '#6B7280',
    textAlign: 'center',
    lineHeight: 20,
  },
  emptyStateTextDark: {
    color: '#9CA3AF',
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    backgroundColor: '#FFFFFF',
    borderRadius: responsiveBorderRadius.lg,
    padding: responsiveSpacing.lg,
    margin: responsiveSpacing.lg,
    maxWidth: 400,
    width: '90%',
  },
  modalContentDark: {
    backgroundColor: '#1F2937',
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: responsiveSpacing.lg,
  },
  modalTitle: {
    fontSize: responsiveFontSize.lg,
    fontWeight: '600',
    color: '#111827',
  },
  modalTitleDark: {
    color: '#F9FAFB',
  },
  modalText: {
    fontSize: responsiveFontSize.sm,
    color: '#6B7280',
    lineHeight: 20,
    marginBottom: responsiveSpacing.lg,
  },
  modalTextDark: {
    color: '#9CA3AF',
  },
  templatePreview: {
    backgroundColor: '#F3F4F6',
    borderRadius: responsiveBorderRadius.md,
    padding: responsiveSpacing.md,
    marginBottom: responsiveSpacing.lg,
  },
  previewTitle: {
    fontSize: responsiveFontSize.base,
    fontWeight: '600',
    color: '#111827',
    marginBottom: responsiveSpacing.xs,
  },
  previewTitleDark: {
    color: '#F9FAFB',
  },
  previewDescription: {
    fontSize: responsiveFontSize.sm,
    color: '#6B7280',
    lineHeight: 18,
    marginBottom: responsiveSpacing.sm,
  },
  previewDescriptionDark: {
    color: '#9CA3AF',
  },
  previewTarget: {
    fontSize: responsiveFontSize.sm,
    color: '#374151',
    fontWeight: '500',
  },
  previewTargetDark: {
    color: '#D1D5DB',
  },
  modalActions: {
    flexDirection: 'row',
    gap: responsiveSpacing.md,
  },
  cancelButton: {
    flex: 1,
    paddingVertical: responsiveSpacing.md,
    borderRadius: responsiveBorderRadius.md,
    borderWidth: 1,
    borderColor: '#D1D5DB',
    alignItems: 'center',
  },
  cancelButtonText: {
    fontSize: responsiveFontSize.sm,
    fontWeight: '600',
    color: '#374151',
  },
  createButton: {
    flex: 1,
    paddingVertical: responsiveSpacing.md,
    borderRadius: responsiveBorderRadius.md,
    alignItems: 'center',
  },
  createButtonText: {
    fontSize: responsiveFontSize.sm,
    fontWeight: '600',
    color: '#FFFFFF',
  },
});
