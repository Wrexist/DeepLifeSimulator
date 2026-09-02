import React, { useState, useMemo } from 'react';
import { scale, fontScale } from '@/utils/scaling';
import { CLOSE_BUTTON_A11Y, hitSlopToMinTarget, minTouchTargetStyle } from '@/utils/touchTargets';
import { Modal, View, Text, SectionList, TouchableOpacity, StyleSheet, Dimensions } from 'react-native';
import { useGameSelector, shallowEqual } from '@/contexts/game/useGameSelector';
import { safeSettings } from '@/utils/safeGameState';
import { FamilyTree, FamilyMemberNode } from '@/lib/legacy/familyTree';
import Gradient from '@/components/ui/Gradient';
import { X } from 'lucide-react-native';
import CharacterAvatar from '@/components/avatar/CharacterAvatar';
import { getPlatformShadows } from '@/utils/glassmorphismStyles';
import { tier1Title, tier2 } from '@/lib/config/hierarchy';
const LinearGradient = Gradient;

const { width, height } = Dimensions.get('window');

interface Props {
  visible: boolean;
  onClose: () => void;
}

export default function FamilyTreeModal({ visible, onClose }: Props) {
  const familyTreeData = useGameSelector((s) => s.familyTreeData);
  const settings = useGameSelector((s) => safeSettings(s), shallowEqual);
  const [selectedMemberId, setSelectedMemberId] = useState<string | null>(null);

  // Reconstruct tree from data
  const tree = useMemo(() => {
    if (!familyTreeData) return null;
    const t = new FamilyTree(familyTreeData.lineageId);
    t.members = familyTreeData.members;
    return t;
  }, [familyTreeData]);

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
        title: `Generation ${gen}`,
        data: members.sort((a, b) => a.birthYear - b.birthYear),
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
          {/* A dead ancestor is drawn at the age they died; the living at a
              default adult age. One component either way - the branch is only
              about which age to pass. */}
          <CharacterAvatar
            seed={member.id}
            sex={member.gender}
            age={member.deathYear ? member.deathYear - member.birthYear : 25}
            size={40}
          />
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
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.container}>
        <LinearGradient
          colors={settings.darkMode ? ['#0F172A', '#1E293B'] : ['#F1F5F9', '#FFFFFF']}
          style={styles.content}
        >
          <View style={styles.header}>
            <Text style={[styles.title, settings.darkMode && styles.textDark]}>
              Family Tree
            </Text>
            <TouchableOpacity
                onPress={onClose}
                style={[styles.closeButton, minTouchTargetStyle]}
                hitSlop={hitSlopToMinTarget(scale(24))}
                {...CLOSE_BUTTON_A11Y}
              >
              <X size={24} color={settings.darkMode ? '#FFFFFF' : '#000000'} />
            </TouchableOpacity>
          </View>

          {/* C-2: Virtualized with SectionList to prevent OOM on large family trees */}
          {generations.length === 0 ? (
            <View style={[styles.scrollContainer, styles.emptyState]}>
              <Text style={[styles.emptyText, settings.darkMode && styles.textDarkSecondary]}>
                No family history yet. Start your legacy!
              </Text>
            </View>
          ) : (
            <SectionList
              style={styles.scrollContainer}
              sections={generations}
              keyExtractor={(item) => item.id}
              initialNumToRender={15}
              maxToRenderPerBatch={10}
              windowSize={5}
              renderSectionHeader={({ section }) => (
                <View style={styles.generationLabel}>
                  <Text style={[styles.genText, settings.darkMode && styles.textDark]}>
                    {section.title}
                  </Text>
                  <View style={styles.line} />
                </View>
              )}
              renderItem={({ item }) => (
                <View style={styles.membersGrid}>
                  {renderMemberNode(item)}
                </View>
              )}
            />
          )}
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
    ...getPlatformShadows(6, 0.25, 4, 14),
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  title: {
    ...tier1Title,
    color: '#0F172A',
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
    fontSize: fontScale(16),
    color: '#64748B',
  },
  generationLabel: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  genText: {
    fontSize: fontScale(14),
    fontWeight: 'bold',
    color: '#475569',
    marginRight: 10,
    width: 100,
  },
  line: {
    flex: 1,
    height: 1,
    backgroundColor: '#475569',
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
    borderColor: '#E2E8F0',
    marginBottom: 8,
  },
  nodeSelected: {
    borderColor: '#3B82F6',
    backgroundColor: '#EFF6FF',
  },
  nodeLight: {
    backgroundColor: '#FFFFFF',
  },
  avatarContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#334155',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
    overflow: 'hidden',
  },
  nodeInfo: {
    flex: 1,
  },
  nodeName: {
    ...tier2,
    color: '#0F172A',
  },
  nodeDetails: {
    fontSize: fontScale(12),
    color: '#64748B',
  },
  expandedDetails: {
    marginTop: 8,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#475569',
  },
  detailText: {
    fontSize: fontScale(12),
    color: '#475569',
    marginBottom: 2,
  },
  textDark: {
    color: '#FFFFFF',
  },
  textDarkSecondary: {
    color: '#94A3B8',
  },
  nodeDark: {
    backgroundColor: '#334155',
    borderColor: '#475569',
  },
});
