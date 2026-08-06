import React, { useState } from 'react';
import { Modal, View, Text, TouchableOpacity, StyleSheet, ScrollView, Dimensions } from 'react-native';
import { useGameSelector, shallowEqual } from '@/contexts/game/useGameSelector';
import { safeSettings } from "@/utils/safeGameState";
import Gradient from '@/components/ui/Gradient';
import { X, Users, BookOpen, Crown, TrendingUp, Activity, Brain } from 'lucide-react-native';
import FamilyTreeModal from './FamilyTreeModal';
import MemoryBookModal from './MemoryBookModal';
import { getTraitById } from '@/lib/legacy/geneticTraits';
import { getDynastyProgress } from '@/lib/legacy/dynasty';
const LinearGradient = Gradient;

const { width, height } = Dimensions.get('window');

interface Props {
  visible: boolean;
  onClose: () => void;
}

export default function LegacyOverviewTab({ visible, onClose }: Props) {
  const activeTraits = useGameSelector((s) => s.activeTraits);
  const legacyBonuses = useGameSelector((s) => s.legacyBonuses);
  const generationNumber = useGameSelector((s) => s.generationNumber);
  const dynastyStats = useGameSelector((s) => s.dynastyStats);
  const settings = useGameSelector((s) => safeSettings(s), shallowEqual); // R3-D: defensive — see utils/safeGameState.ts
  const [showTree, setShowTree] = useState(false);
  const [showMemories, setShowMemories] = useState(false);

  const traits = (activeTraits || []).map(id => getTraitById(id)).filter(Boolean);
  // The dynasty rank. `getDynastyTier` shipped with six ranks and ZERO
  // consumers — a working, persisted, cross-life progression score no player
  // had ever seen. This is its first readout.
  const dynasty = dynastyStats ? getDynastyProgress(dynastyStats) : null;
  const bonuses = legacyBonuses || { incomeMultiplier: 1, learningMultiplier: 1, reputationBonus: 0 };

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.container}>
        <LinearGradient
          colors={settings.darkMode ? ['#0F172A', '#1E293B'] : ['#F3F4F6', '#FFFFFF']}
          style={styles.content}
        >
          <View style={styles.header}>
            <Text style={[styles.title, settings.darkMode && styles.textDark]}>
              Legacy & Lineage
            </Text>
            <TouchableOpacity onPress={onClose} style={styles.closeButton} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }} accessibilityRole="button" accessibilityLabel="Close">
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
                <Text style={styles.genValue}>{generationNumber || 1}</Text>
              </View>
              <Crown size={40} color="rgba(255,255,255,0.3)" />
            </LinearGradient>

            {/* Dynasty rank — the cross-life ladder. */}
            {dynasty && (
              <View style={[styles.rankCard, settings.darkMode && styles.rankCardDark]}>
                <View style={styles.rankHead}>
                  <Text style={[styles.rankTitle, settings.darkMode && styles.textDark]}>
                    {dynasty.rank.title}
                  </Text>
                  <Text style={[styles.rankScore, settings.darkMode && styles.textDark]}>
                    {dynasty.score.toLocaleString()}
                  </Text>
                </View>
                <Text style={[styles.rankDesc, settings.darkMode && styles.rankDescDark]}>
                  {dynasty.rank.description}
                </Text>
                <View style={[styles.rankTrack, settings.darkMode && styles.rankTrackDark]}>
                  <View
                    style={[
                      styles.rankFill,
                      { width: `${Math.max(3, dynasty.progress * 100)}%` },
                    ]}
                  />
                </View>
                <Text style={[styles.rankDesc, settings.darkMode && styles.rankDescDark]}>
                  {dynasty.next
                    ? `${(dynasty.next.minScore - dynasty.score).toLocaleString()} to ${dynasty.next.title}`
                    : 'The highest rank a family can reach.'}
                </Text>
              </View>
            )}

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
    color: '#0F172A',
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
  rankCard: {
    marginTop: 12,
    padding: 14,
    borderRadius: 14,
    backgroundColor: '#FFFFFF',
    // Full border on all four sides — a one-sided coloured stripe is banned
    // app-wide (Hard Rule #7).
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.08)',
  },
  rankCardDark: {
    backgroundColor: '#1E293B',
    borderColor: 'rgba(255,255,255,0.10)',
  },
  rankHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  rankTitle: { fontSize: 16, fontWeight: '800', color: '#0F172A' },
  rankScore: { fontSize: 15, fontWeight: '800', color: '#0F172A', fontVariant: ['tabular-nums'] },
  rankDesc: { fontSize: 12, color: '#64748B', marginTop: 4 },
  rankDescDark: { color: '#94A3B8' },
  rankTrack: {
    height: 8,
    borderRadius: 4,
    overflow: 'hidden',
    backgroundColor: 'rgba(0,0,0,0.08)',
    marginTop: 8,
    marginBottom: 6,
  },
  rankTrackDark: { backgroundColor: 'rgba(255,255,255,0.10)' },
  rankFill: { height: '100%', borderRadius: 4, backgroundColor: '#7C3AED' },
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
    backgroundColor: '#334155',
    borderColor: '#4B5563',
  },
  actionText: {
    fontWeight: '600',
    color: '#0F172A',
  },
  section: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
  },
  sectionDark: {
    backgroundColor: '#334155',
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#0F172A',
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
    color: '#0F172A',
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
    color: '#94A3B8',
  },
  textDark: {
    color: '#FFFFFF',
  },
  textDarkSecondary: {
    color: '#D1D5DB',
  },
});


