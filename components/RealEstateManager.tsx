import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, PanResponder } from 'react-native';
import { useGame } from '@/contexts/GameContext';
import { DECOR_ITEMS, getUpgradeTier } from '@/lib/realEstate/housing';

export default function RealEstateManager() {
  const { gameState, setGameState } = useGame();
  const [dragItem, setDragItem] = useState<string | null>(null);

  const panResponder = PanResponder.create({
    onStartShouldSetPanResponder: () => !!dragItem,
    onPanResponderRelease: () => {
      if (!dragItem) return;
      const target = (gameState.realEstate || [])[0];
      if (target) {
        setGameState(prev => ({
          ...prev,
          realEstate: (prev.realEstate || []).map(p =>
            p.id === target.id ? { ...p, interior: [...p.interior, dragItem] } : p
          ),
        }));
      }
      setDragItem(null);
    },
  });

  const purchaseUpgrade = (propertyId: string) => {
    const property = (gameState.realEstate || []).find(p => p.id === propertyId);
    if (!property) return;
    const nextLevel = property.upgradeLevel + 1;
    const tier = getUpgradeTier(nextLevel);
    if (!tier) return;
    setGameState(prev => ({
      ...prev,
      stats: { ...prev.stats, money: prev.stats.money - tier.cost },
      realEstate: (prev.realEstate || []).map(p =>
        p.id === propertyId ? { ...p, upgradeLevel: nextLevel } : p
      ),
    }));
  };

  return (
    <View style={styles.container}>
      {(gameState.realEstate || []).map(property => {
        const nextTier = getUpgradeTier(property.upgradeLevel + 1);
        return (
          <View key={property.id} style={styles.property}>
            <Text style={styles.title}>{property.name}</Text>
            <Text>Upgrade Level: {property.upgradeLevel}</Text>
            {nextTier && (
              <TouchableOpacity
                style={styles.button}
                onPress={() => purchaseUpgrade(property.id)}
              >
                <Text>Upgrade (${nextTier.cost})</Text>
              </TouchableOpacity>
            )}
            <View style={styles.dropZone} {...panResponder.panHandlers}>
              {property.interior.map(itemId => {
                const item = DECOR_ITEMS.find(d => d.id === itemId);
                return (
                  <Text key={itemId} style={styles.itemText}>
                    {item?.name}
                  </Text>
                );
              })}
            </View>
          </View>
        );
      })}
      <View style={styles.items}>
        {DECOR_ITEMS.map(item => (
          <TouchableOpacity
            key={item.id}
            style={styles.item}
            onPress={() => setDragItem(item.id)}
          >
            <Text>{item.name}</Text>
          </TouchableOpacity>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 16 },
  property: { marginBottom: 20 },
  title: { fontSize: 18, fontWeight: '600' },
  button: {
    backgroundColor: '#6366F1',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 6,
    marginTop: 8,
  },
  dropZone: {
    minHeight: 80,
    marginTop: 12,
    backgroundColor: '#F3F4F6',
    alignItems: 'center',
    justifyContent: 'center',
  },
  items: { flexDirection: 'row', flexWrap: 'wrap', marginTop: 20 },
  item: {
    backgroundColor: '#E5E7EB',
    padding: 8,
    margin: 4,
    borderRadius: 4,
  },
  itemText: { fontSize: 14 },
});

