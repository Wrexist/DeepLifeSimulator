import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useGame } from '@/contexts/GameContext';

export default function Journal() {
  const { gameState } = useGame();
  const entries = gameState.journal;

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Journal</Text>
      {entries.length === 0 && (
        <Text style={styles.empty}>No journal entries yet.</Text>
      )}
      {entries.map(entry => (
        <View key={entry.id} style={styles.entry}>
          <Text style={styles.entryTitle}>{entry.title}</Text>
          <Text style={styles.entryMeta}>Week {entry.atWeek}</Text>
          <Text style={styles.entryDetails}>{entry.details}</Text>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginTop: 20,
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
  entry: {
    marginBottom: 12,
  },
  entryTitle: {
    fontWeight: '500',
  },
  entryMeta: {
    fontSize: 12,
    color: '#6B7280',
  },
  entryDetails: {
    color: '#4B5563',
    fontSize: 14,
  },
});
