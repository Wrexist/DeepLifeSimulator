import React, { useEffect, useState } from 'react';
import { Modal, View, Text, TouchableOpacity, StyleSheet, FlatList } from 'react-native';
import { fetchLeaderboard, LeaderboardEntry } from '@/lib/progress/cloud';

interface Props {
  visible: boolean;
  onClose: () => void;
}

export default function LeaderboardModal({ visible, onClose }: Props) {
  const categories = ['wealth', 'career', 'skills'];
  const titles: Record<string, string> = {
    wealth: 'Net Worth',
    career: 'Career Level',
    skills: 'Top Skill',
  };
  const rewards = ['🥇 +100', '🥈 +50', '🥉 +25'];

  const [selected, setSelected] = useState(categories[0]);
  const [entries, setEntries] = useState<LeaderboardEntry[]>([]);

  useEffect(() => {
    if (visible) {
      void fetchLeaderboard(selected).then(setEntries);
    }
  }, [visible, selected]);

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <View style={styles.container}>
        <Text style={styles.title}>{titles[selected]} Leaderboard</Text>
        <View style={styles.tabs}>
          {categories.map(cat => (
            <TouchableOpacity
              key={cat}
              style={[styles.tab, selected === cat && styles.tabActive]}
              onPress={() => setSelected(cat)}
            >
              <Text style={[styles.tabText, selected === cat && styles.tabTextActive]}>
                {titles[cat]}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
        <FlatList
          data={entries}
          keyExtractor={item => item.name}
          renderItem={({ item, index }) => (
            <Text style={styles.entry}>
              {index + 1}. {item.name}: {item.score} {index < 3 ? rewards[index] : ''}
            </Text>
          )}
        />
        <TouchableOpacity onPress={onClose} style={styles.closeButton}>
          <Text style={styles.closeText}>Close</Text>
        </TouchableOpacity>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 20, backgroundColor: '#fff' },
  title: { fontSize: 24, fontWeight: 'bold', marginBottom: 20 },
  tabs: { flexDirection: 'row', marginBottom: 12 },
  tab: { flex: 1, padding: 8, borderBottomWidth: 2, borderColor: '#E5E7EB', alignItems: 'center' },
  tabActive: { borderColor: '#3B82F6' },
  tabText: { fontSize: 14, color: '#6B7280' },
  tabTextActive: { color: '#1F2937', fontWeight: '600' },
  entry: { fontSize: 16, marginVertical: 4 },
  closeButton: { marginTop: 20, padding: 10, backgroundColor: '#3B82F6', borderRadius: 8 },
  closeText: { color: '#fff', fontWeight: '600' },
});
