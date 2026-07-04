/**
 * Ring selection for marriage proposals.
 *
 * Surfaces the engagement-ring catalog (lib/dating/engagementRings) that the
 * canonical proposeMarriage action prices in — the previous UI propose flow
 * charged a flat $5,000 and never offered a ring at all.
 */
import React, { useMemo, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Modal, ScrollView } from 'react-native';
import LinearGradientFallback from '@/components/fallbacks/LinearGradientFallback';
import { X, Gem, Heart } from 'lucide-react-native';
import { useGame } from '@/contexts/GameContext';
import { safeSettings } from '@/utils/safeGameState';
import {
  ENGAGEMENT_RINGS,
  calculateProposalSuccessRate,
  getTierColor,
  getTierGradient,
} from '@/lib/dating/engagementRings';
import { scale, fontScale } from '@/utils/scaling';

const LinearGradient = LinearGradientFallback;

interface RingSelectionModalProps {
  visible: boolean;
  onClose: () => void;
  partnerName: string;
  relationshipScore: number;
  datesCount: number;
  livingTogether: boolean;
  /** Called with the chosen ring id; the caller runs proposeMarriage. */
  onPropose: (ringId: string) => void;
}

export default function RingSelectionModal({
  visible,
  onClose,
  partnerName,
  relationshipScore,
  datesCount,
  livingTogether,
  onPropose,
}: RingSelectionModalProps) {
  const { gameState } = useGame();
  const settings = safeSettings(gameState);
  const darkMode = settings?.darkMode ?? false;
  const money = gameState.stats?.money ?? 0;

  const [selectedRingId, setSelectedRingId] = useState<string | null>(null);

  const rings = useMemo(
    () =>
      ENGAGEMENT_RINGS.map((ring) => ({
        ring,
        affordable: money >= ring.price,
        successRate: calculateProposalSuccessRate(relationshipScore, ring, datesCount, livingTogether),
      })),
    [money, relationshipScore, datesCount, livingTogether]
  );

  const selected = rings.find((r) => r.ring.id === selectedRingId);

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={[styles.content, darkMode && styles.contentDark]}>
          <View style={styles.header}>
            <View style={styles.headerTitleRow}>
              <Gem size={22} color="#8B5CF6" />
              <Text style={[styles.title, darkMode && styles.textDark]}>Choose a Ring</Text>
            </View>
            <TouchableOpacity onPress={onClose} hitSlop={10}>
              <X size={24} color={darkMode ? '#F9FAFB' : '#111827'} />
            </TouchableOpacity>
          </View>

          <Text style={[styles.subtitle, darkMode && styles.textMuted]}>
            Proposing to {partnerName} — the ring affects your chances of a “yes”.
          </Text>

          <ScrollView style={styles.list} showsVerticalScrollIndicator={false}>
            {rings.map(({ ring, affordable, successRate }) => {
              const isSelected = ring.id === selectedRingId;
              return (
                <TouchableOpacity
                  key={ring.id}
                  disabled={!affordable}
                  onPress={() => setSelectedRingId(ring.id)}
                  style={[
                    styles.ringCard,
                    darkMode && styles.ringCardDark,
                    isSelected && { borderColor: getTierColor(ring.qualityTier), borderWidth: 2 },
                    !affordable && styles.ringCardDisabled,
                  ]}
                >
                  <View style={[styles.tierDot, { backgroundColor: getTierColor(ring.qualityTier) }]} />
                  <View style={styles.ringInfo}>
                    <Text style={[styles.ringName, darkMode && styles.textDark]}>{ring.name}</Text>
                    <Text style={[styles.ringDescription, darkMode && styles.textMuted]} numberOfLines={2}>
                      {ring.description}
                    </Text>
                    <View style={styles.ringStatsRow}>
                      <Text style={[styles.ringPrice, !affordable && styles.priceUnaffordable]}>
                        ${ring.price.toLocaleString()}
                      </Text>
                      <View style={styles.successChip}>
                        <Heart size={12} color="#EC4899" />
                        <Text style={styles.successText}>{Math.round(successRate)}% yes</Text>
                      </View>
                    </View>
                  </View>
                </TouchableOpacity>
              );
            })}
          </ScrollView>

          <TouchableOpacity
            disabled={!selected}
            onPress={() => {
              if (selected) onPropose(selected.ring.id);
            }}
            style={[styles.proposeButton, !selected && { opacity: 0.5 }]}
          >
            <LinearGradient
              colors={selected ? getTierGradient(selected.ring.qualityTier) : ['#6B7280', '#4B5563']}
              style={styles.proposeGradient}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
            >
              <Gem size={18} color="#FFF" />
              <Text style={styles.proposeText}>
                {selected
                  ? `Propose with ${selected.ring.name} ($${selected.ring.price.toLocaleString()})`
                  : 'Select a ring'}
              </Text>
            </LinearGradient>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.55)',
    justifyContent: 'flex-end',
  },
  content: {
    maxHeight: '85%',
    backgroundColor: '#FFF',
    borderTopLeftRadius: scale(24),
    borderTopRightRadius: scale(24),
    padding: scale(20),
  },
  contentDark: {
    backgroundColor: '#1F2937',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: scale(4),
  },
  headerTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: scale(8),
  },
  title: {
    fontSize: fontScale(20),
    fontWeight: 'bold',
    color: '#111827',
  },
  subtitle: {
    fontSize: fontScale(13),
    color: '#6B7280',
    marginBottom: scale(12),
  },
  list: {
    marginBottom: scale(12),
  },
  ringCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F9FAFB',
    borderRadius: scale(12),
    borderWidth: 1,
    borderColor: '#E5E7EB',
    padding: scale(12),
    marginBottom: scale(8),
  },
  ringCardDark: {
    backgroundColor: '#111827',
    borderColor: '#374151',
  },
  ringCardDisabled: {
    opacity: 0.45,
  },
  tierDot: {
    width: scale(10),
    height: scale(10),
    borderRadius: scale(5),
    marginRight: scale(10),
  },
  ringInfo: {
    flex: 1,
  },
  ringName: {
    fontSize: fontScale(15),
    fontWeight: '600',
    color: '#111827',
  },
  ringDescription: {
    fontSize: fontScale(11),
    color: '#6B7280',
    marginTop: scale(2),
  },
  ringStatsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: scale(6),
  },
  ringPrice: {
    fontSize: fontScale(13),
    fontWeight: '700',
    color: '#10B981',
  },
  priceUnaffordable: {
    color: '#EF4444',
  },
  successChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: scale(4),
    backgroundColor: 'rgba(236, 72, 153, 0.1)',
    paddingHorizontal: scale(8),
    paddingVertical: scale(2),
    borderRadius: scale(8),
  },
  successText: {
    fontSize: fontScale(11),
    fontWeight: '600',
    color: '#EC4899',
  },
  proposeButton: {
    borderRadius: scale(12),
    overflow: 'hidden',
  },
  proposeGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: scale(8),
    paddingVertical: scale(14),
  },
  proposeText: {
    color: '#FFF',
    fontSize: fontScale(14),
    fontWeight: '700',
  },
  textDark: {
    color: '#F9FAFB',
  },
  textMuted: {
    color: '#9CA3AF',
  },
});
