/**
 * Family Tree Visualization Component
 * 
 * Interactive family tree showing multiple generations
 * with tap-to-view details and color-coding by wealth
 */
import React, { useState, useMemo, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Modal,
  Dimensions,
} from 'react-native';
import LinearGradientFallback from '@/components/fallbacks/LinearGradientFallback';
const LinearGradient = LinearGradientFallback;
import {
  User,
  Crown,
  Star,
  Heart,
  Calendar,
  DollarSign,
  Trophy,
  X,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react-native';
import { scale, fontScale } from '@/utils/scaling';
import type { GameState, DynastyStats, Heirloom } from '@/contexts/game/types';

const { width: screenWidth } = Dimensions.get('window');

interface Ancestor {
  id: string;
  name: string;
  birthYear: number;
  deathYear?: number;
  peakNetWorth: number;
  achievements: string[];
  generation: number;
  isCurrentPlayer?: boolean;
}

interface FamilyTreeVisualizationProps {
  ancestors: Ancestor[];
  currentPlayer: {
    name: string;
    age: number;
    netWorth: number;
    achievements: string[];
  };
  dynastyStats?: DynastyStats;
  generation: number;
  onClose?: () => void;
}

// Get color based on wealth level
const getWealthColor = (netWorth: number): string => {
  if (netWorth >= 100000000) return '#FFD700'; // Gold - $100M+
  if (netWorth >= 10000000) return '#C0C0C0'; // Silver - $10M+
  if (netWorth >= 1000000) return '#CD7F32'; // Bronze - $1M+
  if (netWorth >= 100000) return '#10B981'; // Green - $100K+
  if (netWorth >= 10000) return '#3B82F6'; // Blue - $10K+
  return '#6B7280'; // Gray - Less than $10K
};

// Format large numbers
const formatWealth = (amount: number): string => {
  if (amount >= 1000000000) return `$${(amount / 1000000000).toFixed(1)}B`;
  if (amount >= 1000000) return `$${(amount / 1000000).toFixed(1)}M`;
  if (amount >= 1000) return `$${(amount / 1000).toFixed(0)}K`;
  return `$${amount.toFixed(0)}`;
};

// Node in the family tree
const FamilyNode = ({
  ancestor,
  isSelected,
  onPress,
  isCurrentPlayer,
}: {
  ancestor: Ancestor;
  isSelected: boolean;
  onPress: () => void;
  isCurrentPlayer?: boolean;
}) => {
  const wealthColor = getWealthColor(ancestor.peakNetWorth);
  
  return (
    <TouchableOpacity
      style={[
        styles.nodeContainer,
        isSelected && styles.nodeSelected,
        isCurrentPlayer && styles.nodeCurrentPlayer,
      ]}
      onPress={onPress}
    >
      <View
        style={[
          styles.nodeAvatar,
          { borderColor: wealthColor },
        ]}
      >
        {isCurrentPlayer ? (
          <Star size={scale(24)} color={wealthColor} fill={wealthColor} />
        ) : (
          <User size={scale(24)} color={wealthColor} />
        )}
      </View>
      <Text style={styles.nodeName} numberOfLines={1}>
        {ancestor.name}
      </Text>
      <Text style={styles.nodeWealth}>
        {formatWealth(ancestor.peakNetWorth)}
      </Text>
      {isCurrentPlayer && (
        <View style={styles.currentBadge}>
          <Text style={styles.currentBadgeText}>You</Text>
        </View>
      )}
    </TouchableOpacity>
  );
};

// Detail modal for selected ancestor
const AncestorDetailModal = ({
  visible,
  ancestor,
  onClose,
}: {
  visible: boolean;
  ancestor: Ancestor | null;
  onClose: () => void;
}) => {
  if (!ancestor) return null;
  
  const wealthColor = getWealthColor(ancestor.peakNetWorth);
  
  return (
    <Modal
      visible={visible}
      animationType="fade"
      transparent
      onRequestClose={onClose}
    >
      <View style={styles.modalOverlay}>
        <View style={styles.modalContent}>
          <TouchableOpacity style={styles.modalClose} onPress={onClose}>
            <X size={scale(24)} color="#E7E9EA" />
          </TouchableOpacity>
          
          <View style={[styles.modalAvatar, { borderColor: wealthColor }]}>
            {ancestor.isCurrentPlayer ? (
              <Star size={scale(40)} color={wealthColor} fill={wealthColor} />
            ) : (
              <User size={scale(40)} color={wealthColor} />
            )}
          </View>
          
          <Text style={styles.modalName}>{ancestor.name}</Text>
          <Text style={styles.modalGeneration}>Generation {ancestor.generation}</Text>
          
          <View style={styles.modalStats}>
            <View style={styles.modalStat}>
              <Calendar size={scale(16)} color="#71767B" />
              <Text style={styles.modalStatText}>
                {ancestor.birthYear} - {ancestor.deathYear || 'Present'}
              </Text>
            </View>
            <View style={styles.modalStat}>
              <DollarSign size={scale(16)} color={wealthColor} />
              <Text style={[styles.modalStatText, { color: wealthColor }]}>
                Peak: {formatWealth(ancestor.peakNetWorth)}
              </Text>
            </View>
          </View>
          
          {ancestor.achievements.length > 0 && (
            <View style={styles.modalAchievements}>
              <Text style={styles.modalSectionTitle}>Achievements</Text>
              {ancestor.achievements.slice(0, 5).map((achievement, index) => (
                <View key={index} style={styles.achievementItem}>
                  <Trophy size={scale(14)} color="#F59E0B" />
                  <Text style={styles.achievementText}>{achievement}</Text>
                </View>
              ))}
            </View>
          )}
        </View>
      </View>
    </Modal>
  );
};

export default function FamilyTreeVisualization({
  ancestors,
  currentPlayer,
  dynastyStats,
  generation,
  onClose,
}: FamilyTreeVisualizationProps) {
  const [selectedAncestor, setSelectedAncestor] = useState<Ancestor | null>(null);
  const [viewingGeneration, setViewingGeneration] = useState(generation);
  
  // Group ancestors by generation
  const ancestorsByGeneration = useMemo(() => {
    const grouped: Record<number, Ancestor[]> = {};
    
    // Add current player
    const currentPlayerAncestor: Ancestor = {
      id: 'current',
      name: currentPlayer.name,
      birthYear: 2025 - currentPlayer.age,
      peakNetWorth: currentPlayer.netWorth,
      achievements: currentPlayer.achievements,
      generation: generation,
      isCurrentPlayer: true,
    };
    
    grouped[generation] = [currentPlayerAncestor];
    
    // Add ancestors
    ancestors.forEach(ancestor => {
      if (!grouped[ancestor.generation]) {
        grouped[ancestor.generation] = [];
      }
      grouped[ancestor.generation].push(ancestor);
    });
    
    return grouped;
  }, [ancestors, currentPlayer, generation]);
  
  const generations = useMemo(() => {
    return Object.keys(ancestorsByGeneration)
      .map(Number)
      .sort((a, b) => b - a); // Most recent first
  }, [ancestorsByGeneration]);
  
  const handleNavigateGeneration = useCallback((direction: 'prev' | 'next') => {
    const currentIndex = generations.indexOf(viewingGeneration);
    if (direction === 'prev' && currentIndex < generations.length - 1) {
      setViewingGeneration(generations[currentIndex + 1]);
    } else if (direction === 'next' && currentIndex > 0) {
      setViewingGeneration(generations[currentIndex - 1]);
    }
  }, [generations, viewingGeneration]);
  
  const visibleAncestors = ancestorsByGeneration[viewingGeneration] || [];
  
  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={onClose} style={styles.closeButton}>
          <X size={scale(24)} color="#E7E9EA" />
        </TouchableOpacity>
        <View style={styles.headerContent}>
          <Crown size={scale(24)} color="#F59E0B" />
          <Text style={styles.headerTitle}>Family Dynasty</Text>
        </View>
        <View style={styles.headerRight} />
      </View>
      
      {/* Dynasty Stats */}
      {dynastyStats && (
        <View style={styles.dynastyStats}>
          <View style={styles.dynastyStat}>
            <Text style={styles.dynastyStatValue}>{dynastyStats.totalGenerations}</Text>
            <Text style={styles.dynastyStatLabel}>Generations</Text>
          </View>
          <View style={styles.dynastyStat}>
            <Text style={styles.dynastyStatValue}>{formatWealth(dynastyStats.totalWealth)}</Text>
            <Text style={styles.dynastyStatLabel}>Total Wealth</Text>
          </View>
          <View style={styles.dynastyStat}>
            <Text style={styles.dynastyStatValue}>{dynastyStats.heirlooms.length}</Text>
            <Text style={styles.dynastyStatLabel}>Heirlooms</Text>
          </View>
        </View>
      )}
      
      {/* Generation Navigation */}
      <View style={styles.generationNav}>
        <TouchableOpacity
          style={[
            styles.navButton,
            generations.indexOf(viewingGeneration) >= generations.length - 1 && styles.navButtonDisabled
          ]}
          onPress={() => handleNavigateGeneration('prev')}
          disabled={generations.indexOf(viewingGeneration) >= generations.length - 1}
        >
          <ChevronLeft size={scale(24)} color="#E7E9EA" />
        </TouchableOpacity>
        
        <Text style={styles.generationTitle}>
          Generation {viewingGeneration}
        </Text>
        
        <TouchableOpacity
          style={[
            styles.navButton,
            generations.indexOf(viewingGeneration) <= 0 && styles.navButtonDisabled
          ]}
          onPress={() => handleNavigateGeneration('next')}
          disabled={generations.indexOf(viewingGeneration) <= 0}
        >
          <ChevronRight size={scale(24)} color="#E7E9EA" />
        </TouchableOpacity>
      </View>
      
      {/* Family Tree */}
      <ScrollView
        style={styles.treeContainer}
        contentContainerStyle={styles.treeContent}
        horizontal
        showsHorizontalScrollIndicator={false}
      >
        <View style={styles.generationRow}>
          {visibleAncestors.map((ancestor) => (
            <FamilyNode
              key={ancestor.id}
              ancestor={ancestor}
              isSelected={selectedAncestor?.id === ancestor.id}
              onPress={() => setSelectedAncestor(ancestor)}
              isCurrentPlayer={ancestor.isCurrentPlayer}
            />
          ))}
        </View>
      </ScrollView>
      
      {/* Legend */}
      <View style={styles.legend}>
        <Text style={styles.legendTitle}>Wealth Legend</Text>
        <View style={styles.legendItems}>
          <View style={styles.legendItem}>
            <View style={[styles.legendDot, { backgroundColor: '#FFD700' }]} />
            <Text style={styles.legendText}>$100M+</Text>
          </View>
          <View style={styles.legendItem}>
            <View style={[styles.legendDot, { backgroundColor: '#C0C0C0' }]} />
            <Text style={styles.legendText}>$10M+</Text>
          </View>
          <View style={styles.legendItem}>
            <View style={[styles.legendDot, { backgroundColor: '#CD7F32' }]} />
            <Text style={styles.legendText}>$1M+</Text>
          </View>
          <View style={styles.legendItem}>
            <View style={[styles.legendDot, { backgroundColor: '#10B981' }]} />
            <Text style={styles.legendText}>$100K+</Text>
          </View>
        </View>
      </View>
      
      {/* Heirlooms Section */}
      {dynastyStats && dynastyStats.heirlooms.length > 0 && (
        <View style={styles.heirloomsSection}>
          <Text style={styles.heirloomsSectionTitle}>Family Heirlooms</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            {dynastyStats.heirlooms.map((heirloom, index) => (
              <View key={index} style={styles.heirloomCard}>
                <Text style={styles.heirloomIcon}>{heirloom.icon}</Text>
                <Text style={styles.heirloomName}>{heirloom.name}</Text>
                <Text style={styles.heirloomRarity}>{heirloom.rarity}</Text>
              </View>
            ))}
          </ScrollView>
        </View>
      )}
      
      {/* Detail Modal */}
      <AncestorDetailModal
        visible={!!selectedAncestor}
        ancestor={selectedAncestor}
        onClose={() => setSelectedAncestor(null)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000000',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: scale(16),
    paddingVertical: scale(12),
    borderBottomWidth: 1,
    borderBottomColor: '#2F3336',
  },
  closeButton: {
    padding: scale(4),
  },
  headerContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: scale(8),
  },
  headerTitle: {
    fontSize: fontScale(18),
    fontWeight: 'bold',
    color: '#E7E9EA',
  },
  headerRight: {
    width: scale(32),
  },
  dynastyStats: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    padding: scale(16),
    backgroundColor: '#16181C',
    marginHorizontal: scale(16),
    marginTop: scale(16),
    borderRadius: scale(12),
  },
  dynastyStat: {
    alignItems: 'center',
  },
  dynastyStatValue: {
    fontSize: fontScale(20),
    fontWeight: 'bold',
    color: '#F59E0B',
  },
  dynastyStatLabel: {
    fontSize: fontScale(12),
    color: '#71767B',
    marginTop: scale(4),
  },
  generationNav: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: scale(16),
    paddingVertical: scale(12),
  },
  navButton: {
    padding: scale(8),
    backgroundColor: '#16181C',
    borderRadius: scale(8),
  },
  navButtonDisabled: {
    opacity: 0.3,
  },
  generationTitle: {
    fontSize: fontScale(16),
    fontWeight: 'bold',
    color: '#E7E9EA',
  },
  treeContainer: {
    flex: 1,
  },
  treeContent: {
    padding: scale(16),
    minWidth: screenWidth,
  },
  generationRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: scale(16),
    flexWrap: 'wrap',
  },
  nodeContainer: {
    alignItems: 'center',
    padding: scale(12),
    backgroundColor: '#16181C',
    borderRadius: scale(12),
    borderWidth: 2,
    borderColor: 'transparent',
    width: scale(100),
  },
  nodeSelected: {
    borderColor: '#1D9BF0',
    backgroundColor: '#1D9BF020',
  },
  nodeCurrentPlayer: {
    backgroundColor: '#F59E0B10',
  },
  nodeAvatar: {
    width: scale(50),
    height: scale(50),
    borderRadius: scale(25),
    borderWidth: 3,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#0F172A',
    marginBottom: scale(8),
  },
  nodeName: {
    fontSize: fontScale(12),
    fontWeight: '600',
    color: '#E7E9EA',
    textAlign: 'center',
  },
  nodeWealth: {
    fontSize: fontScale(11),
    color: '#71767B',
    marginTop: scale(2),
  },
  currentBadge: {
    position: 'absolute',
    top: scale(4),
    right: scale(4),
    backgroundColor: '#F59E0B',
    paddingHorizontal: scale(6),
    paddingVertical: scale(2),
    borderRadius: scale(4),
  },
  currentBadgeText: {
    fontSize: fontScale(9),
    color: '#000000',
    fontWeight: 'bold',
  },
  legend: {
    padding: scale(16),
    borderTopWidth: 1,
    borderTopColor: '#2F3336',
  },
  legendTitle: {
    fontSize: fontScale(14),
    fontWeight: '600',
    color: '#E7E9EA',
    marginBottom: scale(8),
  },
  legendItems: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: scale(12),
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: scale(4),
  },
  legendDot: {
    width: scale(12),
    height: scale(12),
    borderRadius: scale(6),
  },
  legendText: {
    fontSize: fontScale(12),
    color: '#71767B',
  },
  heirloomsSection: {
    padding: scale(16),
    borderTopWidth: 1,
    borderTopColor: '#2F3336',
  },
  heirloomsSectionTitle: {
    fontSize: fontScale(14),
    fontWeight: '600',
    color: '#E7E9EA',
    marginBottom: scale(12),
  },
  heirloomCard: {
    backgroundColor: '#16181C',
    padding: scale(12),
    borderRadius: scale(8),
    alignItems: 'center',
    marginRight: scale(12),
    minWidth: scale(80),
  },
  heirloomIcon: {
    fontSize: fontScale(24),
    marginBottom: scale(4),
  },
  heirloomName: {
    fontSize: fontScale(12),
    color: '#E7E9EA',
    fontWeight: '500',
  },
  heirloomRarity: {
    fontSize: fontScale(10),
    color: '#F59E0B',
    textTransform: 'capitalize',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    backgroundColor: '#16181C',
    borderRadius: scale(16),
    padding: scale(24),
    width: screenWidth - scale(48),
    alignItems: 'center',
  },
  modalClose: {
    position: 'absolute',
    top: scale(12),
    right: scale(12),
    padding: scale(4),
  },
  modalAvatar: {
    width: scale(80),
    height: scale(80),
    borderRadius: scale(40),
    borderWidth: 4,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#0F172A',
    marginBottom: scale(16),
  },
  modalName: {
    fontSize: fontScale(20),
    fontWeight: 'bold',
    color: '#E7E9EA',
    marginBottom: scale(4),
  },
  modalGeneration: {
    fontSize: fontScale(14),
    color: '#71767B',
    marginBottom: scale(16),
  },
  modalStats: {
    flexDirection: 'row',
    gap: scale(20),
    marginBottom: scale(16),
  },
  modalStat: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: scale(6),
  },
  modalStatText: {
    fontSize: fontScale(14),
    color: '#E7E9EA',
  },
  modalAchievements: {
    width: '100%',
    paddingTop: scale(16),
    borderTopWidth: 1,
    borderTopColor: '#2F3336',
  },
  modalSectionTitle: {
    fontSize: fontScale(14),
    fontWeight: '600',
    color: '#E7E9EA',
    marginBottom: scale(12),
  },
  achievementItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: scale(8),
    marginBottom: scale(8),
  },
  achievementText: {
    fontSize: fontScale(13),
    color: '#E7E9EA',
    flex: 1,
  },
});


