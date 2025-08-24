import React from 'react';
import { View, Text, Button, StyleSheet } from 'react-native';
import { useGame } from '@/contexts/GameContext';

export default function FamilyTab() {
  const { gameState, proposeToPartner, haveChild } = useGame();
  const partner = gameState.relationships.find(r => r.type === 'partner');
  const spouse = gameState.family.spouse;
  const children = gameState.family.children;

  return (
    <View style={styles.container}>
      <Text style={styles.heading}>Family</Text>
      <Text style={styles.label}>Life Stage: {gameState.lifeStage}</Text>
      {spouse ? (
        <View style={styles.section}>
          <Text style={styles.label}>Spouse: {spouse.name}</Text>
          <Button title="Have Child" onPress={() => haveChild(spouse.id)} />
        </View>
      ) : partner ? (
        <View style={styles.section}>
          <Text style={styles.label}>Partner: {partner.name}</Text>
          <Button title="Propose" onPress={() => proposeToPartner(partner.id)} />
        </View>
      ) : (
        <Text style={styles.label}>No partner</Text>
      )}
      {children.length > 0 && (
        <View style={styles.section}>
          <Text style={styles.label}>Children:</Text>
          {children.map(child => (
            <Text key={child.id} style={styles.child}>
              {child.name} (age {Math.floor(child.age)})
            </Text>
          ))}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: 20,
  },
  heading: {
    fontSize: 20,
    fontWeight: '600',
    marginBottom: 10,
  },
  section: {
    marginVertical: 10,
  },
  label: {
    fontSize: 16,
    marginBottom: 5,
  },
  child: {
    marginLeft: 10,
    fontSize: 14,
  },
});
