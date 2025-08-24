import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useGame } from '@/contexts/GameContext';

export default function ProgressOverview() {
  const { gameState } = useGame();
  const achievements = gameState.progress.achievements;

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Achievements</Text>
      {achievements.length === 0 && (
        <Text style={styles.empty}>No achievements yet.</Text>
      )}
      {achievements.map(ach => (
        <View key={ach.id} style={styles.item}>
          <Text style={styles.name}>{ach.name}</Text>
          {ach.unlockedAt && (
            <Text style={styles.when}>Week {ach.unlockedAt}</Text>
          )}
          <Text style={styles.desc}>{ach.desc}</Text>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginBottom: 20,
    padding: 16,
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
  },
  title: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 10,
  },
  empty: {
    color: '#6B7280',
  },
  item: {
    marginBottom: 12,
  },
  name: {
    fontWeight: '500',
  },
  when: {
    color: '#6B7280',
    fontSize: 12,
  },
  desc: {
    color: '#4B5563',
    fontSize: 14,
  },
});
