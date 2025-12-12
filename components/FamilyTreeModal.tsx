import React, { useState, useMemo } from 'react';
import { Modal, View, Text, ScrollView, TouchableOpacity, StyleSheet, Image, Dimensions } from 'react-native';
import { useGame } from '@/contexts/GameContext';
import { FamilyTree, FamilyMemberNode } from '@/lib/legacy/familyTree';
import { LinearGradient } from 'expo-linear-gradient';
import { X, User, ChevronRight, ChevronDown } from 'lucide-react-native';
import { useTranslation } from '@/hooks/useTranslation';
import { getCharacterImage } from '@/utils/characterImages';

const { width, height } = Dimensions.get('window');

interface Props {
  visible: boolean;
  onClose: () => void;
}

export default function FamilyTreeModal({ visible, onClose }: Props) {
  const { gameState } = useGame();
  const { t } = useTranslation();
  const { settings } = gameState;
  const [selectedMemberId, setSelectedMemberId] = useState<string | null>(null);

  // Reconstruct tree from data
  const tree = useMemo(() => {
    if (!gameState.familyTreeData) return null;
    const t = new FamilyTree(gameState.familyTreeData.lineageId);
    t.members = gameState.familyTreeData.members;
    return t;
  }, [gameState.familyTreeData]);

  // Group members by generation
  const generations = useMemo(() => {
    if (!tree) return [];
    const gens: Record<number, FamilyMemberNode[]> = {};
    Object.values(tree.members).forEach(member => {
      if (!gens[member.generation]) gens[member.generation] = [];
      gens[member.generation].push(member);
    });
    
    return Object.entries(gens)
      .sort((a, b) => Number(a[0]) - Number(b[0])) // Sort by generation ascending (1, 2, 3...)
      .map(([gen, members]) => ({
        gen: Number(gen),
        members: members.sort((a, b) => a.birthYear - b.birthYear)
      }));
  }, [tree]);

  const renderMemberNode = (member: FamilyMemberNode) => {
    const isSelected = selectedMemberId === member.id;
    
    return (
      <TouchableOpacity
        key={member.id}
        style={[
          styles.nodeContainer,
          isSelected && styles.nodeSelected,
          settings.darkMode ? styles.nodeDark : styles.nodeLight
        ]}
        onPress={() => setSelectedMemberId(isSelected ? null : member.id)}
      >
        <View style={styles.avatarContainer}>
          {member.deathYear ? (
            // Calculate age at death for image
            <Image
              source={getCharacterImage(member.deathYear - member.birthYear, member.gender)}
              style={styles.avatarImage}
            />
          ) : (
            // Use current age if still alive
            <Image
              source={getCharacterImage(25, member.gender)}
              style={styles.avatarImage}
            />
          )}
        </View>
        <View style={styles.nodeInfo}>
          <Text style={[styles.nodeName, settings.darkMode && styles.textDark]}>
            {member.firstName} {member.lastName}
          </Text>
          <Text style={[styles.nodeDetails, settings.darkMode && styles.textDarkSecondary]}>
            {member.birthYear} - {member.deathYear || 'Present'}
          </Text>
        </View>
        
        {isSelected && (
          <View style={styles.expandedDetails}>
             <Text style={[styles.detailText, settings.darkMode && styles.textDarkSecondary]}>
               Net Worth: ${member.netWorth?.toLocaleString() || 0}
             </Text>
             <Text style={[styles.detailText, settings.darkMode && styles.textDarkSecondary]}>
               Occupation: {member.occupation || 'Unknown'}
             </Text>
          </View>
        )}
      </TouchableOpacity>
    );
  };

  return (
    <Modal visible={visible} animationType="slide" transparent>
      <View style={styles.container}>
        <LinearGradient
          colors={settings.darkMode ? ['#111827', '#1F2937'] : ['#F3F4F6', '#FFFFFF']}
          style={styles.content}
        >
          <View style={styles.header}>
            <Text style={[styles.title, settings.darkMode && styles.textDark]}>
              Family Tree
            </Text>
            <TouchableOpacity onPress={onClose} style={styles.closeButton}>
              <X size={24} color={settings.darkMode ? '#FFFFFF' : '#000000'} />
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.scrollContainer}>
            {generations.length === 0 ? (
              <View style={styles.emptyState}>
                <Text style={[styles.emptyText, settings.darkMode && styles.textDarkSecondary]}>
                  No family history yet. Start your legacy!
                </Text>
              </View>
            ) : (
              generations.map(({ gen, members }) => (
                <View key={gen} style={styles.generationRow}>
                  <View style={styles.generationLabel}>
                    <Text style={[styles.genText, settings.darkMode && styles.textDark]}>
                      Generation {gen}
                    </Text>
                    <View style={styles.line} />
                  </View>
                  <View style={styles.membersGrid}>
                    {members.map(renderMemberNode)}
                  </View>
                </View>
              ))
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
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 100,
  },
  emptyText: {
    fontSize: 16,
    color: '#6B7280',
  },
  generationRow: {
    marginBottom: 24,
  },
  generationLabel: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  genText: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#4B5563',
    marginRight: 10,
    width: 100,
  },
  line: {
    flex: 1,
    height: 1,
    backgroundColor: '#E5E7EB',
  },
  membersGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  nodeContainer: {
    width: '48%', // 2 columns
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    marginBottom: 8,
  },
  nodeSelected: {
    borderColor: '#3B82F6',
    backgroundColor: '#EFF6FF',
  },
  nodeLight: {
    backgroundColor: '#FFFFFF',
  },
  nodeDark: {
    backgroundColor: '#374151',
    borderColor: '#4B5563',
  },
  avatarContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#F3F4F6',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
    overflow: 'hidden',
  },
  avatarImage: {
    width: 40,
    height: 40,
    borderRadius: 20,
  },
  nodeInfo: {
    flex: 1,
  },
  nodeName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111827',
  },
  nodeDetails: {
    fontSize: 12,
    color: '#6B7280',
  },
  expandedDetails: {
    marginTop: 8,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
  },
  detailText: {
    fontSize: 12,
    color: '#4B5563',
    marginBottom: 2,
  },
  textDark: {
    color: '#FFFFFF',
  },
  textDarkSecondary: {
    color: '#9CA3AF',
  },
});

