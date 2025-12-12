import React, { useState } from 'react';
import { View, Text, StyleSheet, Modal, TouchableOpacity, ScrollView, Alert, Image } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Plane, X, MapPin, Heart, Zap, Battery } from 'lucide-react-native';
import { useGame } from '@/contexts/GameContext';
import { DESTINATIONS, TravelDestination } from '@/lib/travel/destinations';
import { responsivePadding, responsiveFontSize, responsiveSpacing, responsiveBorderRadius, scale } from '@/utils/scaling';

interface TravelModalProps {
  visible: boolean;
  onClose: () => void;
}

export default function TravelModal({ visible, onClose }: TravelModalProps) {
  const { gameState, travelTo } = useGame();
  const { settings } = gameState;
  const [selectedDestination, setSelectedDestination] = useState<TravelDestination | null>(null);

  const handleTravel = (destination: TravelDestination) => {
    if (gameState.stats.money < destination.cost) {
      Alert.alert('Insufficient Funds', `You need $${destination.cost} to travel to ${destination.name}.`);
      return;
    }

    Alert.alert(
      `Travel to ${destination.name}`,
      `Are you sure you want to spend $${destination.cost} to visit ${destination.name}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Let\'s Go!',
          onPress: () => {
            const result = travelTo(destination.id);
            if (result.success) {
              Alert.alert('Bon Voyage!', result.message);
              onClose();
            } else {
              Alert.alert('Error', result.message);
            }
          },
        },
      ]
    );
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={[styles.container, settings.darkMode && styles.containerDark]}>
          <View style={styles.header}>
            <Text style={[styles.title, settings.darkMode && styles.textDark]}>Travel the World</Text>
            <TouchableOpacity 
              onPress={onClose} 
              style={styles.closeButton}
              accessibilityLabel="Close travel modal"
              accessibilityRole="button"
            >
              <X size={24} color={settings.darkMode ? '#fff' : '#000'} />
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.content}>
            <Text style={[styles.subtitle, settings.darkMode && styles.textDark]}>
              Select a destination to relax and recharge.
            </Text>

            {DESTINATIONS.map((dest) => (
              <TouchableOpacity
                key={dest.id}
                style={[styles.card, settings.darkMode && styles.cardDark]}
                onPress={() => handleTravel(dest)}
                accessibilityLabel={`Travel to ${dest.name}, ${dest.country}`}
                accessibilityHint={`Cost $${dest.cost}. Double tap to travel.`}
                accessibilityRole="button"
              >
                <LinearGradient
                  colors={['rgba(59, 130, 246, 0.1)', 'rgba(59, 130, 246, 0.05)']}
                  style={styles.cardGradient}
                >
                  <View style={styles.cardHeader}>
                    <View>
                      <Text style={[styles.destName, settings.darkMode && styles.textDark]}>{dest.name}</Text>
                      <View style={styles.locationRow}>
                        <MapPin size={14} color="#6B7280" />
                        <Text style={styles.destCountry}>{dest.country}</Text>
                      </View>
                    </View>
                    <View style={styles.priceTag}>
                      <Text style={styles.priceText}>${dest.cost.toLocaleString()}</Text>
                    </View>
                  </View>

                  <Text style={styles.description}>{dest.description}</Text>

                  <View style={styles.benefitsRow}>
                    <View style={styles.benefit}>
                      <Heart size={14} color="#EF4444" />
                      <Text style={styles.benefitText}>+{dest.benefits.happiness}</Text>
                    </View>
                    <View style={styles.benefit}>
                      <Battery size={14} color="#10B981" />
                      <Text style={styles.benefitText}>+{dest.benefits.health}</Text>
                    </View>
                    <View style={styles.benefit}>
                      <Zap size={14} color="#F59E0B" />
                      <Text style={styles.benefitText}>+{dest.benefits.energy}</Text>
                    </View>
                  </View>
                </LinearGradient>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: responsivePadding.large,
  },
  container: {
    width: '100%',
    maxHeight: '80%',
    backgroundColor: '#fff',
    borderRadius: responsiveBorderRadius.xl,
    overflow: 'hidden',
  },
  containerDark: {
    backgroundColor: '#1F2937',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: responsiveSpacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0,0,0,0.1)',
  },
  title: {
    fontSize: responsiveFontSize.xl,
    fontWeight: 'bold',
    color: '#111827',
  },
  textDark: {
    color: '#F9FAFB',
  },
  closeButton: {
    padding: 4,
  },
  content: {
    padding: responsiveSpacing.lg,
  },
  subtitle: {
    fontSize: responsiveFontSize.md,
    color: '#6B7280',
    marginBottom: responsiveSpacing.lg,
  },
  card: {
    marginBottom: responsiveSpacing.md,
    borderRadius: responsiveBorderRadius.lg,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.05)',
  },
  cardDark: {
    borderColor: 'rgba(255,255,255,0.1)',
    backgroundColor: '#374151',
  },
  cardGradient: {
    padding: responsiveSpacing.md,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: responsiveSpacing.sm,
  },
  destName: {
    fontSize: responsiveFontSize.lg,
    fontWeight: '600',
    color: '#111827',
  },
  locationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
    gap: 4,
  },
  destCountry: {
    fontSize: responsiveFontSize.sm,
    color: '#6B7280',
  },
  priceTag: {
    backgroundColor: '#10B981',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  priceText: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: responsiveFontSize.sm,
  },
  description: {
    fontSize: responsiveFontSize.sm,
    color: '#6B7280',
    marginBottom: responsiveSpacing.md,
    lineHeight: 20,
  },
  benefitsRow: {
    flexDirection: 'row',
    gap: 12,
  },
  benefit: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(255,255,255,0.5)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  benefitText: {
    fontSize: responsiveFontSize.sm,
    fontWeight: '600',
    color: '#374151',
  },
});

