import React from 'react';
import { Modal, View, Text, ScrollView, TouchableOpacity, StyleSheet, Dimensions } from 'react-native';
import { FamilyMemberNode } from '@/lib/legacy/familyTree';
import LinearGradientFallback from '@/components/fallbacks/LinearGradientFallback';
const LinearGradient = LinearGradientFallback;
import { X, User, Star, Briefcase, Heart, Brain } from 'lucide-react-native';
import { useGame } from '@/contexts/GameContext';

const { width, height } = Dimensions.get('window');

interface Props {
  member: FamilyMemberNode | null;
  visible: boolean;
  onClose: () => void;
}

export default function AncestorProfileModal({ member, visible, onClose }: Props) {
  const { gameState } = useGame();
  const { settings } = gameState;

  if (!member) return null;

  return (
    <Modal visible={visible} animationType="slide" transparent>
      <View style={styles.container}>
        <LinearGradient
           colors={settings.darkMode ? ['#111827', '#1F2937'] : ['#F3F4F6', '#FFFFFF']}
           style={styles.content}
        >
          {/* Header */}
          <View style={styles.header}>
            <View style={styles.headerTitle}>
               <User size={24} color={settings.darkMode ? '#9CA3AF' : '#4B5563'} />
               <Text style={[styles.title, settings.darkMode && styles.textDark]}>
                 {member.firstName} {member.lastName}
               </Text>
            </View>
            <TouchableOpacity onPress={onClose} style={styles.closeButton}>
              <X size={24} color={settings.darkMode ? '#FFFFFF' : '#000000'} />
            </TouchableOpacity>
          </View>
          
          <ScrollView style={styles.scrollContainer}>
            {/* Basic Info Card */}
            <View style={[styles.card, settings.darkMode && styles.cardDark]}>
               <Text style={[styles.sectionTitle, settings.darkMode && styles.textDark]}>Life Summary</Text>
               <View style={styles.row}>
                 <Text style={[styles.label, settings.darkMode && styles.textDarkSecondary]}>Generation:</Text>
                 <Text style={[styles.value, settings.darkMode && styles.textDark]}>{member.generation}</Text>
               </View>
               <View style={styles.row}>
                 <Text style={[styles.label, settings.darkMode && styles.textDarkSecondary]}>Lived:</Text>
                 <Text style={[styles.value, settings.darkMode && styles.textDark]}>
                   {member.birthYear} - {member.deathYear || 'Present'}
                 </Text>
               </View>
               <View style={styles.row}>
                 <Text style={[styles.label, settings.darkMode && styles.textDarkSecondary]}>Occupation:</Text>
                 <Text style={[styles.value, settings.darkMode && styles.textDark]}>{member.occupation || 'Unknown'}</Text>
               </View>
               <View style={styles.row}>
                 <Text style={[styles.label, settings.darkMode && styles.textDarkSecondary]}>Net Worth:</Text>
                 <Text style={[styles.value, settings.darkMode && styles.textDark]}>
                   ${member.netWorth?.toLocaleString() || 0}
                 </Text>
               </View>
               {member.causeOfDeath && (
                 <View style={styles.row}>
                   <Text style={[styles.label, settings.darkMode && styles.textDarkSecondary]}>Cause of Death:</Text>
                   <Text style={[styles.value, settings.darkMode && styles.textDark]}>{member.causeOfDeath}</Text>
                 </View>
               )}
            </View>

            {/* Traits */}
            {member.traits && member.traits.length > 0 && (
              <View style={[styles.card, settings.darkMode && styles.cardDark]}>
                 <View style={styles.sectionHeader}>
                    <Brain size={20} color="#8B5CF6" />
                    <Text style={[styles.sectionTitle, settings.darkMode && styles.textDark, { marginLeft: 8 }]}>
                      Genetic Traits
                    </Text>
                 </View>
                 <View style={styles.tagsContainer}>
                   {member.traits.map(traitId => (
                     <View key={traitId} style={[styles.tag, { backgroundColor: '#EDE9FE' }]}>
                       <Text style={[styles.tagText, { color: '#7C3AED' }]}>
                         {traitId.replace('_', ' ')}
                       </Text>
                     </View>
                   ))}
                 </View>
              </View>
            )}
            
            {/* Achievements / Legacy */}
            <View style={[styles.card, settings.darkMode && styles.cardDark]}>
               <View style={styles.sectionHeader}>
                  <Star size={20} color="#F59E0B" />
                  <Text style={[styles.sectionTitle, settings.darkMode && styles.textDark, { marginLeft: 8 }]}>
                    Legacy & Achievements
                  </Text>
               </View>
               {member.achievements && member.achievements.length > 0 ? (
                 member.achievements.map((ach, index) => (
                   <View key={index} style={styles.achievementRow}>
                     <View style={styles.bullet} />
                     <Text style={[styles.achievementText, settings.darkMode && styles.textDark]}>
                       {ach}
                     </Text>
                   </View>
                 ))
               ) : (
                 <Text style={[styles.emptyText, settings.darkMode && styles.textDarkSecondary]}>
                   No major achievements recorded.
                 </Text>
               )}
            </View>
            
            <View style={{ height: 40 }} />
          </ScrollView>
        </LinearGradient>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'flex-end',
  },
  content: {
    height: height * 0.9,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 20,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 24,
    paddingHorizontal: 4,
  },
  headerTitle: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#111827',
  },
  closeButton: {
    padding: 8,
    backgroundColor: 'rgba(0,0,0,0.05)',
    borderRadius: 20,
  },
  scrollContainer: {
    flex: 1,
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  cardDark: {
    backgroundColor: '#374151',
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#111827',
    marginBottom: 12,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
    paddingBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0,0,0,0.05)',
  },
  label: {
    fontSize: 15,
    color: '#6B7280',
  },
  value: {
    fontSize: 15,
    fontWeight: '500',
    color: '#111827',
  },
  tagsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  tag: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  tagText: {
    fontSize: 12,
    fontWeight: '600',
    textTransform: 'capitalize',
  },
  achievementRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  bullet: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#F59E0B',
    marginRight: 10,
  },
  achievementText: {
    fontSize: 15,
    color: '#374151',
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


