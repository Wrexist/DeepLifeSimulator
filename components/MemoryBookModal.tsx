import React, { useState } from 'react';
import { Modal, View, Text, ScrollView, TouchableOpacity, StyleSheet, Dimensions } from 'react-native';
import { useGame } from '@/contexts/GameContext';
import { LinearGradient } from 'expo-linear-gradient';
import { X, BookOpen, Lock, Unlock } from 'lucide-react-native';
import { Memory } from '@/lib/legacy/memories';

const { width, height } = Dimensions.get('window');

interface Props {
  visible: boolean;
  onClose: () => void;
}

export default function MemoryBookModal({ visible, onClose }: Props) {
  const { gameState } = useGame();
  const { settings } = gameState;
  const [filter, setFilter] = useState<'all' | 'unlocked' | 'locked'>('all');

  const memories = gameState.memories || [];

  const filteredMemories = memories.filter(m => {
    if (filter === 'unlocked') return m.unlocked;
    if (filter === 'locked') return !m.unlocked;
    return true;
  });

  const renderMemoryCard = (memory: Memory) => {
    return (
      <View 
        key={memory.id} 
        style={[
          styles.card, 
          settings.darkMode ? styles.cardDark : styles.cardLight,
          !memory.unlocked && styles.lockedCard
        ]}
      >
        <View style={styles.cardHeader}>
           <View style={styles.titleContainer}>
             {memory.unlocked ? (
               <Unlock size={16} color={settings.darkMode ? '#A78BFA' : '#7C3AED'} />
             ) : (
               <Lock size={16} color="#9CA3AF" />
             )}
             <Text style={[styles.memoryTitle, settings.darkMode && styles.textDark]}>
               {memory.unlocked ? memory.title : 'Locked Memory'}
             </Text>
           </View>
           <Text style={[styles.genTag, settings.darkMode && styles.textDarkSecondary]}>
             Gen {memory.generation}
           </Text>
        </View>

        {memory.unlocked ? (
          <>
            <Text style={[styles.description, settings.darkMode && styles.textDarkSecondary]}>
              {memory.description}
            </Text>
            <Text style={styles.ancestorSource}>
              Inherited from: {memory.ancestorName}
            </Text>
            {memory.effects && (
               <View style={styles.effectsContainer}>
                 {memory.effects.happiness && (
                   <Text style={styles.effectText}>+{memory.effects.happiness} Happiness</Text>
                 )}
                 {memory.effects.reputation && (
                   <Text style={styles.effectText}>+{memory.effects.reputation} Reputation</Text>
                 )}
                 {memory.effects.xpBonus && (
                   <Text style={styles.effectText}>Skill Bonus: {memory.effects.xpBonus.skillId}</Text>
                 )}
               </View>
            )}
          </>
        ) : (
          <Text style={[styles.lockedText, settings.darkMode && styles.textDarkSecondary]}>
            This memory is currently inaccessible. 
            {memory.unlockCondition?.age && ` Requires Age ${memory.unlockCondition.age}.`}
          </Text>
        )}
      </View>
    );
  };

  return (
    <Modal visible={visible} animationType="fade" transparent>
      <View style={styles.container}>
        <LinearGradient
          colors={settings.darkMode ? ['#111827', '#1F2937'] : ['#F3F4F6', '#FFFFFF']}
          style={styles.content}
        >
          <View style={styles.header}>
             <View style={{flexDirection: 'row', alignItems: 'center', gap: 10}}>
               <BookOpen size={24} color={settings.darkMode ? '#FFFFFF' : '#000000'} />
               <Text style={[styles.title, settings.darkMode && styles.textDark]}>
                 Ancestral Memories
               </Text>
             </View>
             <TouchableOpacity onPress={onClose} style={styles.closeButton}>
               <X size={24} color={settings.darkMode ? '#FFFFFF' : '#000000'} />
             </TouchableOpacity>
          </View>

          <View style={styles.filters}>
            {(['all', 'unlocked', 'locked'] as const).map((f) => (
              <TouchableOpacity
                key={f}
                style={[
                  styles.filterButton,
                  filter === f && styles.filterActive,
                  settings.darkMode && styles.filterButtonDark
                ]}
                onPress={() => setFilter(f)}
              >
                <Text style={[
                  styles.filterText,
                  filter === f && styles.filterTextActive,
                  settings.darkMode && filter !== f && styles.textDark
                ]}>
                  {f.charAt(0).toUpperCase() + f.slice(1)}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          <ScrollView style={styles.scrollContainer}>
            {filteredMemories.length > 0 ? (
              filteredMemories.map(renderMemoryCard)
            ) : (
              <View style={styles.emptyState}>
                <Text style={[styles.emptyText, settings.darkMode && styles.textDarkSecondary]}>
                  No memories found.
                </Text>
              </View>
            )}
          </ScrollView>
        </LinearGradient>
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
    width: width * 0.9,
    height: height * 0.8,
    borderRadius: 20,
    padding: 20,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  title: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#111827',
  },
  closeButton: {
    padding: 5,
  },
  filters: {
    flexDirection: 'row',
    marginBottom: 16,
    gap: 10,
  },
  filterButton: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 20,
    backgroundColor: '#E5E7EB',
  },
  filterButtonDark: {
    backgroundColor: '#374151',
  },
  filterActive: {
    backgroundColor: '#7C3AED',
  },
  filterText: {
    fontSize: 14,
    color: '#4B5563',
  },
  filterTextActive: {
    color: '#FFFFFF',
    fontWeight: '600',
  },
  scrollContainer: {
    flex: 1,
  },
  card: {
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
  },
  cardLight: {
    backgroundColor: '#FFFFFF',
    borderColor: '#E5E7EB',
  },
  cardDark: {
    backgroundColor: '#1F2937',
    borderColor: '#374151',
  },
  lockedCard: {
    opacity: 0.7,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  titleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  memoryTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111827',
  },
  genTag: {
    fontSize: 12,
    color: '#6B7280',
    backgroundColor: 'rgba(0,0,0,0.05)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  description: {
    fontSize: 14,
    color: '#4B5563',
    marginBottom: 8,
    lineHeight: 20,
  },
  ancestorSource: {
    fontSize: 12,
    color: '#9CA3AF',
    fontStyle: 'italic',
  },
  lockedText: {
    fontSize: 14,
    color: '#6B7280',
    fontStyle: 'italic',
  },
  effectsContainer: {
    marginTop: 8,
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  effectText: {
    fontSize: 12,
    color: '#059669',
    fontWeight: '500',
  },
  emptyState: {
    marginTop: 50,
    alignItems: 'center',
  },
  emptyText: {
    color: '#6B7280',
  },
  textDark: {
    color: '#FFFFFF',
  },
  textDarkSecondary: {
    color: '#D1D5DB',
  },
});

