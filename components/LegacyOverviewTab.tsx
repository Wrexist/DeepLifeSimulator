import React, { useState } from 'react';
import { Modal, View, Text, TouchableOpacity, StyleSheet, ScrollView, Dimensions, Image } from 'react-native';
import { useGame } from '@/contexts/GameContext';
import LinearGradientFallback from '@/components/fallbacks/LinearGradientFallback';
const LinearGradient = LinearGradientFallback;
import { X, Users, BookOpen, Crown, TrendingUp, Activity, Shield, Brain } from 'lucide-react-native';
import FamilyTreeModal from './FamilyTreeModal';
import MemoryBookModal from './MemoryBookModal';
import { getTraitById } from '@/lib/legacy/geneticTraits';

const { width, height } = Dimensions.get('window');

interface Props {
  visible: boolean;
  onClose: () => void;
}

export default function LegacyOverviewTab({ visible, onClose }: Props) {
  const { gameState } = useGame();
  const { settings } = gameState;
  const [showTree, setShowTree] = useState(false);
  const [showMemories, setShowMemories] = useState(false);

  const traits = (gameState.activeTraits || []).map(id => getTraitById(id)).filter(Boolean);
  const bonuses = gameState.legacyBonuses || { incomeMultiplier: 1, learningMultiplier: 1, reputationBonus: 0 };

  return (
    <Modal visible={visible} animationType="slide" transparent>
      <View style={styles.container}>
        <LinearGradient
          colors={settings.darkMode ? ['#111827', '#1F2937'] : ['#F3F4F6', '#FFFFFF']}
          style={styles.content}
        >
          <View style={styles.header}>
            <Text style={[styles.title, settings.darkMode && styles.textDark]}>
              Legacy & Lineage
            </Text>
            <TouchableOpacity onPress={onClose} style={styles.closeButton}>
              <X size={24} color={settings.darkMode ? '#FFFFFF' : '#000000'} />
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.scrollContainer}>
            {/* Generation Header */}
            <LinearGradient
              colors={['#4F46E5', '#7C3AED']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.genHeader}
            >
              <View>
                <Text style={styles.genLabel}>Current Generation</Text>
                <Text style={styles.genValue}>{gameState.generationNumber || 1}</Text>
              </View>
              <Crown size={40} color="rgba(255,255,255,0.3)" />
            </LinearGradient>

            {/* Quick Actions */}
            <View style={styles.actionGrid}>
              <TouchableOpacity 
                style={[styles.actionButton, settings.darkMode && styles.actionButtonDark]}
                onPress={() => setShowTree(true)}
              >
                <Users size={24} color="#3B82F6" />
                <Text style={[styles.actionText, settings.darkMode && styles.textDark]}>Family Tree</Text>
              </TouchableOpacity>
              
              <TouchableOpacity 
                style={[styles.actionButton, settings.darkMode && styles.actionButtonDark]}
                onPress={() => setShowMemories(true)}
              >
                <BookOpen size={24} color="#8B5CF6" />
                <Text style={[styles.actionText, settings.darkMode && styles.textDark]}>Memories</Text>
              </TouchableOpacity>
            </View>

            {/* Active Traits */}
            <View style={[styles.section, settings.darkMode && styles.sectionDark]}>
              <Text style={[styles.sectionTitle, settings.darkMode && styles.textDark]}>Genetic Traits</Text>
              <View style={styles.traitsGrid}>
                {traits.length > 0 ? (
                  traits.map(trait => (
                    <View key={trait?.id} style={[styles.traitCard, settings.darkMode && styles.traitCardDark]}>
                      <View style={styles.traitHeader}>
                        {trait?.type === 'physical' && <Activity size={16} color="#EF4444" />}
                        {trait?.type === 'mental' && <Brain size={16} color="#8B5CF6" />}
                        {trait?.type === 'social' && <Users size={16} color="#3B82F6" />}
                        {trait?.type === 'economic' && <TrendingUp size={16} color="#10B981" />}
                        <Text style={[styles.traitName, settings.darkMode && styles.textDark]}>{trait?.name}</Text>
                      </View>
                      <Text style={[styles.traitDesc, settings.darkMode && styles.textDarkSecondary]}>
                        {trait?.description}
                      </Text>
                    </View>
                  ))
                ) : (
                  <Text style={[styles.emptyText, settings.darkMode && styles.textDarkSecondary]}>
                    No active genetic traits.
                  </Text>
                )}
              </View>
            </View>

            {/* Legacy Bonuses */}
            <View style={[styles.section, settings.darkMode && styles.sectionDark]}>
              <Text style={[styles.sectionTitle, settings.darkMode && styles.textDark]}>Inherited Bonuses</Text>
              <View style={styles.bonusRow}>
                <View style={styles.bonusItem}>
                  <Text style={[styles.bonusLabel, settings.darkMode && styles.textDarkSecondary]}>Income</Text>
                  <Text style={[styles.bonusValue, { color: '#10B981' }]}>
                    +{(bonuses.incomeMultiplier * 100 - 100).toFixed(1)}%
                  </Text>
                </View>
                <View style={styles.bonusItem}>
                  <Text style={[styles.bonusLabel, settings.darkMode && styles.textDarkSecondary]}>Learning</Text>
                  <Text style={[styles.bonusValue, { color: '#3B82F6' }]}>
                    +{(bonuses.learningMultiplier * 100 - 100).toFixed(1)}%
                  </Text>
                </View>
                <View style={styles.bonusItem}>
                  <Text style={[styles.bonusLabel, settings.darkMode && styles.textDarkSecondary]}>Reputation</Text>
                  <Text style={[styles.bonusValue, { color: '#F59E0B' }]}>
                    +{bonuses.reputationBonus}
                  </Text>
                </View>
              </View>
            </View>

          </ScrollView>
        </LinearGradient>

        {/* Nested Modals */}
        <FamilyTreeModal visible={showTree} onClose={() => setShowTree(false)} />
        <MemoryBookModal visible={showMemories} onClose={() => setShowMemories(false)} />
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  content: {
    width: width * 0.95,
    height: height * 0.85,
    borderRadius: 20,
    padding: 20,
    overflow: 'hidden',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#111827',
  },
  closeButton: {
    padding: 5,
  },
  scrollContainer: {
    flex: 1,
  },
  genHeader: {
    padding: 20,
    borderRadius: 16,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  genLabel: {
    color: 'rgba(255,255,255,0.8)',
    fontSize: 14,
    fontWeight: '600',
    textTransform: 'uppercase',
    marginBottom: 4,
  },
  genValue: {
    color: '#FFFFFF',
    fontSize: 32,
    fontWeight: 'bold',
  },
  actionGrid: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 24,
  },
  actionButton: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
    gap: 8,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  actionButtonDark: {
    backgroundColor: '#374151',
    borderColor: '#4B5563',
  },
  actionText: {
    fontWeight: '600',
    color: '#111827',
  },
  section: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
  },
  sectionDark: {
    backgroundColor: '#374151',
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#111827',
    marginBottom: 12,
  },
  traitsGrid: {
    gap: 8,
  },
  traitCard: {
    backgroundColor: '#F9FAFB',
    padding: 12,
    borderRadius: 8,
  },
  traitCardDark: {
    backgroundColor: 'rgba(0,0,0,0.2)',
  },
  traitHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 4,
  },
  traitName: {
    fontWeight: '600',
    color: '#111827',
  },
  traitDesc: {
    fontSize: 12,
    color: '#6B7280',
  },
  bonusRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  bonusItem: {
    alignItems: 'center',
  },
  bonusLabel: {
    fontSize: 12,
    color: '#6B7280',
    marginBottom: 4,
  },
  bonusValue: {
    fontSize: 18,
    fontWeight: 'bold',
  },
  emptyText: {
    fontStyle: 'italic',
    color: '#9CA3AF',
  },
  textDark: {
    color: '#FFFFFF',
  },
  textDarkSecondary: {
    color: '#D1D5DB',
  },
});


