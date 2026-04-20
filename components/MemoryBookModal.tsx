/**
 * MemoryBookModal Component
 * 
 * Enhanced memory book with gradient cards, unlock animations,
 * and memory sharing indicators
 */
import React, { useState, useRef, useEffect, useMemo } from 'react';
import {
  Modal,
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  Dimensions,
  Animated,
} from 'react-native';
import { useGame } from '@/contexts/GameContext';
import LinearGradientFallback from '@/components/fallbacks/LinearGradientFallback';
const LinearGradient = LinearGradientFallback;
import {
  X,
  BookOpen,
  Lock,
  Unlock,
  Sparkles,
  Heart,
  Star,
  Award,
  Crown,
  Users,
  Zap,
  Gift,
  ChevronRight,
} from 'lucide-react-native';
import { Memory } from '@/lib/legacy/memories';
import { scale, fontScale } from '@/utils/scaling';

const { width, height } = Dimensions.get('window');

interface Props {
  visible: boolean;
  onClose: () => void;
}

// Category colors for memory cards
const MEMORY_COLORS: Record<string, { gradient: string[]; accent: string; icon: any }> = {
  wisdom: { gradient: ['#8B5CF6', '#6366F1'], accent: '#A78BFA', icon: Star },
  skill: { gradient: ['#3B82F6', '#2563EB'], accent: '#60A5FA', icon: Zap },
  fortune: { gradient: ['#10B981', '#059669'], accent: '#34D399', icon: Gift },
  legacy: { gradient: ['#F59E0B', '#D97706'], accent: '#FBBF24', icon: Crown },
  love: { gradient: ['#EC4899', '#DB2777'], accent: '#F472B6', icon: Heart },
  default: { gradient: ['#6366F1', '#4F46E5'], accent: '#818CF8', icon: Sparkles },
};

function getMemoryStyle(memory: Memory) {
  const type = (memory as any).type || 'default';
  return MEMORY_COLORS[type] || MEMORY_COLORS.default;
}

export default function MemoryBookModal({ visible, onClose }: Props) {
  const { gameState } = useGame();
  const { settings } = gameState;
  const [filter, setFilter] = useState<'all' | 'unlocked' | 'locked'>('all');
  const [selectedMemory, setSelectedMemory] = useState<Memory | null>(null);

  // Animation refs
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(50)).current;

  const memories = gameState.memories || [];

  // Entry animation
  useEffect(() => {
    if (visible) {
      Animated.parallel([
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: 300,
          useNativeDriver: true,
        }),
        Animated.spring(slideAnim, {
          toValue: 0,
          friction: 8,
          tension: 40,
          useNativeDriver: true,
        }),
      ]).start();
    } else {
      fadeAnim.setValue(0);
      slideAnim.setValue(50);
    }
  }, [visible]);

  const filteredMemories = useMemo(() => {
    return memories.filter(m => {
      if (filter === 'unlocked') return m.unlocked;
      if (filter === 'locked') return !m.unlocked;
      return true;
    });
  }, [memories, filter]);

  // Stats
  const stats = useMemo(() => ({
    total: memories.length,
    unlocked: memories.filter(m => m.unlocked).length,
    locked: memories.filter(m => !m.unlocked).length,
  }), [memories]);

  // Check if memory is inherited by current descendants (simulated)
  const getInheritedBy = (memory: Memory) => {
    // This would be determined by game logic in a real implementation
    if (!memory.unlocked) return [];
    const chance = Math.random();
    if (chance > 0.7) return ['Current heir'];
    if (chance > 0.5) return ['Current heir', 'Second child'];
    return [];
  };

  const renderMemoryCard = (memory: Memory, index: number) => {
    const memoryStyle = getMemoryStyle(memory);
    const MemoryIcon = memoryStyle.icon;
    const inheritedBy = memory.unlocked ? getInheritedBy(memory) : [];

    return (
      <Animated.View
        key={memory.id}
        style={[
          {
            opacity: fadeAnim,
            transform: [
              {
                translateY: slideAnim.interpolate({
                  inputRange: [0, 50],
                  outputRange: [0, 20 + index * 5],
                }),
              },
            ],
          },
        ]}
      >
        <TouchableOpacity
          style={[
            styles.card,
            settings.darkMode ? styles.cardDark : styles.cardLight,
            !memory.unlocked && styles.lockedCard,
          ]}
          onPress={() => memory.unlocked && setSelectedMemory(memory)}
          activeOpacity={memory.unlocked ? 0.7 : 1}
        >
          {memory.unlocked ? (
            <LinearGradient
              colors={memoryStyle.gradient}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.cardGradientBorder}
            >
              <View style={[styles.cardInner, settings.darkMode && styles.cardInnerDark]}>
                <View style={styles.cardHeader}>
                  <View style={styles.titleContainer}>
                    <View style={[styles.iconContainer, { backgroundColor: `${memoryStyle.accent}20` }]}>
                      <MemoryIcon size={scale(16)} color={memoryStyle.accent} />
                    </View>
                    <View style={styles.titleContent}>
                      <Text style={[styles.memoryTitle, settings.darkMode && styles.textDark]}>
                        {memory.title}
                      </Text>
                      <Text style={[styles.ancestorSource, settings.darkMode && styles.textDarkSecondary]}>
                        From {memory.ancestorName}
                      </Text>
                    </View>
                  </View>
                  <View style={[styles.genTag, { backgroundColor: `${memoryStyle.accent}20` }]}>
                    <Text style={[styles.genTagText, { color: memoryStyle.accent }]}>
                      Gen {memory.generation}
                    </Text>
                  </View>
                </View>

                <Text
                  style={[styles.description, settings.darkMode && styles.textDarkSecondary]}
                  numberOfLines={2}
                >
                  {memory.description}
                </Text>

                {/* Effects */}
                {memory.effects && (
                  <View style={styles.effectsContainer}>
                    {memory.effects.happiness && (
                      <View style={[styles.effectBadge, { backgroundColor: '#EC489915' }]}>
                        <Heart size={scale(12)} color="#EC4899" />
                        <Text style={[styles.effectText, { color: '#EC4899' }]}>
                          +{memory.effects.happiness}
                        </Text>
                      </View>
                    )}
                    {memory.effects.reputation && (
                      <View style={[styles.effectBadge, { backgroundColor: '#F59E0B15' }]}>
                        <Star size={scale(12)} color="#F59E0B" />
                        <Text style={[styles.effectText, { color: '#F59E0B' }]}>
                          +{memory.effects.reputation}
                        </Text>
                      </View>
                    )}
                    {memory.effects.xpBonus && (
                      <View style={[styles.effectBadge, { backgroundColor: '#3B82F615' }]}>
                        <Zap size={scale(12)} color="#3B82F6" />
                        <Text style={[styles.effectText, { color: '#3B82F6' }]}>
                          {memory.effects.xpBonus.skillId}
                        </Text>
                      </View>
                    )}
                  </View>
                )}

                {/* Inherited By Indicator */}
                {inheritedBy.length > 0 && (
                  <View style={styles.inheritedContainer}>
                    <Users size={scale(12)} color={settings.darkMode ? '#9CA3AF' : '#6B7280'} />
                    <Text style={[styles.inheritedText, settings.darkMode && styles.textDarkSecondary]}>
                      Passed to: {inheritedBy.join(', ')}
                    </Text>
                  </View>
                )}

                <View style={styles.viewMoreContainer}>
                  <Text style={[styles.viewMoreText, { color: memoryStyle.accent }]}>
                    View Details
                  </Text>
                  <ChevronRight size={scale(14)} color={memoryStyle.accent} />
                </View>
              </View>
            </LinearGradient>
          ) : (
            <View style={[styles.lockedCardInner, settings.darkMode && styles.lockedCardInnerDark]}>
              <View style={styles.lockedContent}>
                <View style={styles.lockedIconContainer}>
                  <Lock size={scale(24)} color={settings.darkMode ? '#6B7280' : '#9CA3AF'} />
                </View>
                <View style={styles.lockedTextContainer}>
                  <Text style={[styles.lockedTitle, settings.darkMode && styles.textDark]}>
                    Locked Memory
                  </Text>
                  <Text style={[styles.lockedDescription, settings.darkMode && styles.textDarkSecondary]}>
                    {memory.unlockCondition?.age
                      ? `Requires Age ${memory.unlockCondition.age}`
                      : 'Keep playing to unlock'}
                  </Text>
                </View>
              </View>
              <View style={styles.genTagLocked}>
                <Text style={styles.genTagLockedText}>Gen {memory.generation}</Text>
              </View>
            </View>
          )}
        </TouchableOpacity>
      </Animated.View>
    );
  };

  // Memory Detail Modal
  const renderDetailModal = () => {
    if (!selectedMemory) return null;
    const memoryStyle = getMemoryStyle(selectedMemory);
    const MemoryIcon = memoryStyle.icon;

    return (
      <Modal visible={!!selectedMemory} transparent animationType="fade">
        <View style={styles.detailOverlay}>
          <View style={[styles.detailContainer, settings.darkMode && styles.detailContainerDark]}>
            <LinearGradient
              colors={memoryStyle.gradient}
              style={styles.detailHeader}
            >
              <MemoryIcon size={scale(32)} color="#FFFFFF" />
              <Text style={styles.detailTitle}>{selectedMemory.title}</Text>
              <TouchableOpacity
                style={styles.detailCloseButton}
                onPress={() => setSelectedMemory(null)}
              >
                <X size={scale(20)} color="#FFFFFF" />
              </TouchableOpacity>
            </LinearGradient>

            <ScrollView style={styles.detailContent}>
              <View style={styles.detailSection}>
                <Text style={[styles.detailLabel, settings.darkMode && styles.textDarkSecondary]}>
                  Description
                </Text>
                <Text style={[styles.detailDescription, settings.darkMode && styles.textDark]}>
                  {selectedMemory.description}
                </Text>
              </View>

              <View style={styles.detailSection}>
                <Text style={[styles.detailLabel, settings.darkMode && styles.textDarkSecondary]}>
                  Origin
                </Text>
                <View style={styles.originCard}>
                  <Crown size={scale(16)} color="#F59E0B" />
                  <Text style={[styles.originText, settings.darkMode && styles.textDark]}>
                    Inherited from {selectedMemory.ancestorName} (Generation {selectedMemory.generation})
                  </Text>
                </View>
              </View>

              {selectedMemory.effects && (
                <View style={styles.detailSection}>
                  <Text style={[styles.detailLabel, settings.darkMode && styles.textDarkSecondary]}>
                    Effects
                  </Text>
                  <View style={styles.effectsGrid}>
                    {selectedMemory.effects.happiness && (
                      <View style={styles.effectCard}>
                        <Heart size={scale(20)} color="#EC4899" />
                        <Text style={styles.effectCardValue}>+{selectedMemory.effects.happiness}</Text>
                        <Text style={styles.effectCardLabel}>Happiness</Text>
                      </View>
                    )}
                    {selectedMemory.effects.reputation && (
                      <View style={styles.effectCard}>
                        <Star size={scale(20)} color="#F59E0B" />
                        <Text style={styles.effectCardValue}>+{selectedMemory.effects.reputation}</Text>
                        <Text style={styles.effectCardLabel}>Reputation</Text>
                      </View>
                    )}
                    {selectedMemory.effects.xpBonus && (
                      <View style={styles.effectCard}>
                        <Zap size={scale(20)} color="#3B82F6" />
                        <Text style={styles.effectCardValue}>+XP</Text>
                        <Text style={styles.effectCardLabel}>{selectedMemory.effects.xpBonus.skillId}</Text>
                      </View>
                    )}
                  </View>
                </View>
              )}
            </ScrollView>
          </View>
        </View>
      </Modal>
    );
  };

  return (
    <Modal visible={visible} animationType="fade" transparent>
      <Animated.View style={[styles.container, { opacity: fadeAnim }]}>
        <LinearGradient
          colors={settings.darkMode ? ['#111827', '#1F2937'] : ['#F3F4F6', '#FFFFFF']}
          style={styles.content}
        >
          {/* Header */}
          <View style={styles.header}>
            <View style={styles.headerLeft}>
              <BookOpen size={scale(24)} color={settings.darkMode ? '#A78BFA' : '#7C3AED'} />
              <View>
                <Text style={[styles.title, settings.darkMode && styles.textDark]}>
                  Ancestral Memories
                </Text>
                <Text style={[styles.subtitle, settings.darkMode && styles.textDarkSecondary]}>
                  {stats.unlocked} of {stats.total} unlocked
                </Text>
              </View>
            </View>
            <TouchableOpacity onPress={onClose} style={styles.closeButton}>
              <X size={scale(24)} color={settings.darkMode ? '#FFFFFF' : '#000000'} />
            </TouchableOpacity>
          </View>

          {/* Stats Bar */}
          <View style={[styles.statsBar, settings.darkMode && styles.statsBarDark]}>
            <View style={styles.statItem}>
              <Unlock size={scale(16)} color="#10B981" />
              <Text style={[styles.statValue, settings.darkMode && styles.textDark]}>{stats.unlocked}</Text>
              <Text style={[styles.statLabel, settings.darkMode && styles.textDarkSecondary]}>Unlocked</Text>
            </View>
            <View style={styles.statDivider} />
            <View style={styles.statItem}>
              <Lock size={scale(16)} color="#EF4444" />
              <Text style={[styles.statValue, settings.darkMode && styles.textDark]}>{stats.locked}</Text>
              <Text style={[styles.statLabel, settings.darkMode && styles.textDarkSecondary]}>Locked</Text>
            </View>
            <View style={styles.statDivider} />
            <View style={styles.statItem}>
              <Award size={scale(16)} color="#F59E0B" />
              <Text style={[styles.statValue, settings.darkMode && styles.textDark]}>{stats.total}</Text>
              <Text style={[styles.statLabel, settings.darkMode && styles.textDarkSecondary]}>Total</Text>
            </View>
          </View>

          {/* Filters */}
          <View style={styles.filters}>
            {(['all', 'unlocked', 'locked'] as const).map((f) => (
              <TouchableOpacity
                key={f}
                style={[
                  styles.filterButton,
                  filter === f && styles.filterActive,
                  settings.darkMode && styles.filterButtonDark,
                ]}
                onPress={() => setFilter(f)}
              >
                {f === 'unlocked' && <Unlock size={scale(14)} color={filter === f ? '#FFF' : (settings.darkMode ? '#9CA3AF' : '#6B7280')} />}
                {f === 'locked' && <Lock size={scale(14)} color={filter === f ? '#FFF' : (settings.darkMode ? '#9CA3AF' : '#6B7280')} />}
                {f === 'all' && <BookOpen size={scale(14)} color={filter === f ? '#FFF' : (settings.darkMode ? '#9CA3AF' : '#6B7280')} />}
                <Text
                  style={[
                    styles.filterText,
                    filter === f && styles.filterTextActive,
                    settings.darkMode && filter !== f && styles.textDark,
                  ]}
                >
                  {f.charAt(0).toUpperCase() + f.slice(1)}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* Memory List */}
          <ScrollView style={styles.scrollContainer} showsVerticalScrollIndicator={false}>
            {filteredMemories.length > 0 ? (
              filteredMemories.map((memory, index) => renderMemoryCard(memory, index))
            ) : (
              <View style={styles.emptyState}>
                <Sparkles size={scale(48)} color={settings.darkMode ? '#6B7280' : '#D1D5DB'} />
                <Text style={[styles.emptyTitle, settings.darkMode && styles.textDark]}>
                  No Memories Found
                </Text>
                <Text style={[styles.emptyText, settings.darkMode && styles.textDarkSecondary]}>
                  {filter === 'unlocked'
                    ? 'Unlock memories by meeting conditions'
                    : filter === 'locked'
                    ? 'All your memories are unlocked!'
                    : 'Start your legacy to collect memories'}
                </Text>
              </View>
            )}
          </ScrollView>
        </LinearGradient>
      </Animated.View>

      {renderDetailModal()}
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  content: {
    width: width * 0.92,
    height: height * 0.85,
    borderRadius: scale(24),
    padding: scale(20),
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.3,
    shadowRadius: 20,
    elevation: 10,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: scale(16),
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: scale(12),
  },
  title: {
    fontSize: fontScale(22),
    fontWeight: 'bold',
    color: '#111827',
  },
  subtitle: {
    fontSize: fontScale(13),
    color: '#6B7280',
    marginTop: scale(2),
  },
  closeButton: {
    padding: scale(8),
    backgroundColor: 'rgba(0,0,0,0.05)',
    borderRadius: scale(20),
  },
  statsBar: {
    flexDirection: 'row',
    backgroundColor: '#F3F4F6',
    borderRadius: scale(16),
    padding: scale(12),
    marginBottom: scale(16),
  },
  statsBarDark: {
    backgroundColor: '#374151',
  },
  statItem: {
    flex: 1,
    alignItems: 'center',
    gap: scale(4),
  },
  statValue: {
    fontSize: fontScale(18),
    fontWeight: 'bold',
    color: '#111827',
  },
  statLabel: {
    fontSize: fontScale(11),
    color: '#6B7280',
  },
  statDivider: {
    width: 1,
    backgroundColor: 'rgba(0,0,0,0.1)',
    marginHorizontal: scale(8),
  },
  filters: {
    flexDirection: 'row',
    marginBottom: scale(16),
    gap: scale(8),
  },
  filterButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: scale(6),
    paddingVertical: scale(10),
    paddingHorizontal: scale(12),
    borderRadius: scale(12),
    backgroundColor: '#E5E7EB',
  },
  filterButtonDark: {
    backgroundColor: '#374151',
  },
  filterActive: {
    backgroundColor: '#7C3AED',
  },
  filterText: {
    fontSize: fontScale(13),
    color: '#4B5563',
    fontWeight: '500',
  },
  filterTextActive: {
    color: '#FFFFFF',
    fontWeight: '600',
  },
  scrollContainer: {
    flex: 1,
  },
  card: {
    marginBottom: scale(12),
    borderRadius: scale(16),
    overflow: 'hidden',
  },
  cardLight: {},
  cardDark: {},
  lockedCard: {
    opacity: 0.85,
  },
  cardGradientBorder: {
    padding: 2,
    borderRadius: scale(16),
  },
  cardInner: {
    backgroundColor: '#FFFFFF',
    borderRadius: scale(14),
    padding: scale(16),
  },
  cardInnerDark: {
    backgroundColor: '#1F2937',
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: scale(10),
  },
  titleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: scale(10),
    flex: 1,
  },
  iconContainer: {
    width: scale(36),
    height: scale(36),
    borderRadius: scale(10),
    alignItems: 'center',
    justifyContent: 'center',
  },
  titleContent: {
    flex: 1,
  },
  memoryTitle: {
    fontSize: fontScale(16),
    fontWeight: '600',
    color: '#111827',
  },
  ancestorSource: {
    fontSize: fontScale(12),
    color: '#6B7280',
    marginTop: scale(2),
  },
  genTag: {
    paddingHorizontal: scale(10),
    paddingVertical: scale(4),
    borderRadius: scale(10),
  },
  genTagText: {
    fontSize: fontScale(12),
    fontWeight: '600',
  },
  description: {
    fontSize: fontScale(14),
    color: '#4B5563',
    lineHeight: fontScale(20),
    marginBottom: scale(10),
  },
  effectsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: scale(8),
    marginBottom: scale(10),
  },
  effectBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: scale(4),
    paddingHorizontal: scale(10),
    paddingVertical: scale(6),
    borderRadius: scale(12),
  },
  effectText: {
    fontSize: fontScale(12),
    fontWeight: '600',
  },
  inheritedContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: scale(6),
    paddingTop: scale(10),
    borderTopWidth: 1,
    borderTopColor: 'rgba(0,0,0,0.05)',
    marginBottom: scale(8),
  },
  inheritedText: {
    fontSize: fontScale(12),
    color: '#6B7280',
  },
  viewMoreContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: scale(4),
  },
  viewMoreText: {
    fontSize: fontScale(13),
    fontWeight: '500',
  },
  lockedCardInner: {
    backgroundColor: '#F3F4F6',
    borderRadius: scale(16),
    padding: scale(16),
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  lockedCardInnerDark: {
    backgroundColor: '#374151',
  },
  lockedContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: scale(12),
    flex: 1,
  },
  lockedIconContainer: {
    width: scale(44),
    height: scale(44),
    borderRadius: scale(12),
    backgroundColor: 'rgba(156, 163, 175, 0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  lockedTextContainer: {
    flex: 1,
  },
  lockedTitle: {
    fontSize: fontScale(15),
    fontWeight: '600',
    color: '#4B5563',
  },
  lockedDescription: {
    fontSize: fontScale(12),
    color: '#9CA3AF',
    marginTop: scale(2),
  },
  genTagLocked: {
    backgroundColor: 'rgba(0,0,0,0.1)',
    paddingHorizontal: scale(8),
    paddingVertical: scale(4),
    borderRadius: scale(8),
  },
  genTagLockedText: {
    fontSize: fontScale(11),
    color: '#6B7280',
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: scale(60),
  },
  emptyTitle: {
    fontSize: fontScale(18),
    fontWeight: '600',
    color: '#4B5563',
    marginTop: scale(16),
  },
  emptyText: {
    fontSize: fontScale(14),
    color: '#9CA3AF',
    marginTop: scale(8),
    textAlign: 'center',
  },
  textDark: {
    color: '#FFFFFF',
  },
  textDarkSecondary: {
    color: '#D1D5DB',
  },
  // Detail Modal Styles
  detailOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.7)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: scale(20),
  },
  detailContainer: {
    width: '100%',
    maxWidth: scale(380),
    backgroundColor: '#FFFFFF',
    borderRadius: scale(20),
    overflow: 'hidden',
  },
  detailContainerDark: {
    backgroundColor: '#1F2937',
  },
  detailHeader: {
    padding: scale(20),
    alignItems: 'center',
    position: 'relative',
  },
  detailTitle: {
    fontSize: fontScale(20),
    fontWeight: 'bold',
    color: '#FFFFFF',
    marginTop: scale(10),
    textAlign: 'center',
  },
  detailCloseButton: {
    position: 'absolute',
    top: scale(16),
    right: scale(16),
    padding: scale(4),
    backgroundColor: 'rgba(0,0,0,0.2)',
    borderRadius: scale(16),
  },
  detailContent: {
    padding: scale(20),
    maxHeight: height * 0.5,
  },
  detailSection: {
    marginBottom: scale(20),
  },
  detailLabel: {
    fontSize: fontScale(12),
    color: '#6B7280',
    marginBottom: scale(8),
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  detailDescription: {
    fontSize: fontScale(15),
    color: '#374151',
    lineHeight: fontScale(22),
  },
  originCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: scale(10),
    backgroundColor: 'rgba(245, 158, 11, 0.1)',
    padding: scale(12),
    borderRadius: scale(12),
  },
  originText: {
    fontSize: fontScale(14),
    color: '#92400E',
    flex: 1,
  },
  effectsGrid: {
    flexDirection: 'row',
    gap: scale(10),
  },
  effectCard: {
    flex: 1,
    alignItems: 'center',
    backgroundColor: '#F9FAFB',
    padding: scale(12),
    borderRadius: scale(12),
  },
  effectCardValue: {
    fontSize: fontScale(18),
    fontWeight: 'bold',
    color: '#111827',
    marginTop: scale(6),
  },
  effectCardLabel: {
    fontSize: fontScale(11),
    color: '#6B7280',
    marginTop: scale(2),
  },
});

