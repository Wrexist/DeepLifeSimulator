import React from 'react';
import { View, Text, StyleSheet, Modal, TouchableOpacity, ScrollView } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { X, Gift, Calendar, Sparkles } from 'lucide-react-native';
import { SeasonalEvent } from '@/lib/events/seasonal';

interface SeasonalEventModalProps {
  visible: boolean;
  event: SeasonalEvent | null;
  onClose: () => void;
  onClaimRewards?: () => void;
}

export default function SeasonalEventModal({
  visible,
  event,
  onClose,
  onClaimRewards,
}: SeasonalEventModalProps) {
  if (!event) return null;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        <View style={styles.container}>
          <LinearGradient
            colors={['#667EEA', '#764BA2']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.header}
          >
            <View style={styles.headerContent}>
              <Sparkles size={32} color="#FFFFFF" />
              <Text style={styles.title}>{event.name}</Text>
            </View>
            <TouchableOpacity style={styles.closeButton} onPress={onClose}>
              <X size={24} color="#FFFFFF" />
            </TouchableOpacity>
          </LinearGradient>

          <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
            <View style={styles.descriptionContainer}>
              <Text style={styles.description}>{event.description}</Text>
            </View>

            {event.rewards && (
              <View style={styles.rewardsContainer}>
                <View style={styles.sectionHeader}>
                  <Gift size={20} color="#667EEA" />
                  <Text style={styles.sectionTitle}>Rewards</Text>
                </View>
                <View style={styles.rewardsList}>
                  {event.rewards.money && (
                    <View style={styles.rewardItem}>
                      <Text style={styles.rewardLabel}>💰 Money:</Text>
                      <Text style={styles.rewardValue}>${event.rewards.money.toLocaleString()}</Text>
                    </View>
                  )}
                  {event.rewards.gems && (
                    <View style={styles.rewardItem}>
                      <Text style={styles.rewardLabel}>💎 Gems:</Text>
                      <Text style={styles.rewardValue}>{event.rewards.gems}</Text>
                    </View>
                  )}
                  {event.rewards.items && event.rewards.items.length > 0 && (
                    <View style={styles.rewardItem}>
                      <Text style={styles.rewardLabel}>🎁 Items:</Text>
                      <Text style={styles.rewardValue}>{event.rewards.items.join(', ')}</Text>
                    </View>
                  )}
                </View>
              </View>
            )}

            {event.specialActions && event.specialActions.length > 0 && (
              <View style={styles.actionsContainer}>
                <View style={styles.sectionHeader}>
                  <Calendar size={20} color="#667EEA" />
                  <Text style={styles.sectionTitle}>Special Actions</Text>
                </View>
                {event.specialActions.map((action, index) => (
                  <View key={index} style={styles.actionItem}>
                    <Text style={styles.actionText}>• {formatActionName(action)}</Text>
                  </View>
                ))}
              </View>
            )}

            <View style={styles.durationContainer}>
              <Text style={styles.durationText}>
                Active: Week {event.startDate.week} of Month {event.startDate.month} - 
                Week {event.endDate.week} of Month {event.endDate.month}
              </Text>
            </View>
          </ScrollView>

          {onClaimRewards && (
            <TouchableOpacity
              style={styles.claimButton}
              onPress={onClaimRewards}
            >
              <LinearGradient
                colors={['#10B981', '#059669']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={styles.claimButtonGradient}
              >
                <Gift size={20} color="#FFFFFF" />
                <Text style={styles.claimButtonText}>Claim Rewards</Text>
              </LinearGradient>
            </TouchableOpacity>
          )}
        </View>
      </View>
    </Modal>
  );
}

function formatActionName(action: string): string {
  return action
    .split(/(?=[A-Z])/)
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  container: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    width: '100%',
    maxWidth: 400,
    maxHeight: '80%',
    overflow: 'hidden',
    boxShadow: '0px 4px 8px rgba(0, 0, 0, 0.3)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  header: {
    padding: 20,
    paddingTop: 30,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
  },
  headerContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#FFFFFF',
    flex: 1,
  },
  closeButton: {
    position: 'absolute',
    top: 20,
    right: 20,
    padding: 4,
  },
  content: {
    padding: 20,
  },
  descriptionContainer: {
    marginBottom: 20,
  },
  description: {
    fontSize: 16,
    color: '#6B7280',
    lineHeight: 24,
  },
  rewardsContainer: {
    marginBottom: 20,
  },
  actionsContainer: {
    marginBottom: 20,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1F2937',
  },
  rewardsList: {
    backgroundColor: '#F9FAFB',
    borderRadius: 12,
    padding: 16,
  },
  rewardItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
  },
  rewardLabel: {
    fontSize: 16,
    color: '#6B7280',
  },
  rewardValue: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1F2937',
  },
  actionItem: {
    paddingVertical: 8,
    paddingLeft: 8,
  },
  actionText: {
    fontSize: 16,
    color: '#6B7280',
  },
  durationContainer: {
    backgroundColor: '#F3F4F6',
    borderRadius: 8,
    padding: 12,
    marginTop: 8,
  },
  durationText: {
    fontSize: 14,
    color: '#6B7280',
    textAlign: 'center',
  },
  claimButton: {
    margin: 20,
    marginTop: 0,
    borderRadius: 12,
    overflow: 'hidden',
  },
  claimButtonGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    gap: 8,
  },
  claimButtonText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#FFFFFF',
  },
});

