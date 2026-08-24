/**
 * TransportCard - rent your way into delivery work.
 *
 * Delivery is the best early gig in the game ($180 a run) and it was gated on
 * owning a $450 bike, against a $200 starting wallet. So for the first stretch
 * of a life it was a job the player could see, wanted, and could not reach.
 *
 * This card is the way in. A scooter pass costs a few dollars to sign and a
 * small weekly fee after that - cheap to start, expensive to hold, which is the
 * exact opposite curve to buying and exactly right for someone broke. It shows
 * what the player is currently riding, what delivery pays at that tier, and
 * (bluntly) when the rental has become pure waste because they now own
 * something better.
 */

import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Bike, Zap, TrendingUp, X } from 'lucide-react-native';
import { fontScale, scale } from '@/utils/scaling';
import {
  SCOOTER_RENTAL_PLANS,
  getActiveRental,
  getTransportProfile,
  getRentalAdvice,
  type ScooterRentalPlan,
} from '@/lib/vehicles/scooterRental';
import type { GameState } from '@/contexts/game/types';

export interface TransportCardProps {
  gameState: GameState;
  onRent: (planId: string) => void;
  onEndRental: () => void;
}

export default function TransportCard({ gameState, onRent, onEndRental }: TransportCardProps) {
  const active = getActiveRental(gameState);
  const profile = getTransportProfile(gameState);
  const advice = getRentalAdvice(gameState);
  const money = gameState?.stats?.money ?? 0;

  const deliveryLine =
    profile.tier === 'none'
      ? 'No wheels - delivery work is closed to you.'
      : `Delivery pays ${Math.round(profile.deliveryMultiplier * 100)}% · ${profile.energyPerRun} energy a run`;

  return (
    <View style={styles.card}>
      <View style={styles.headerRow}>
        <Bike size={scale(16)} color="#7DD3A0" strokeWidth={2.4} />
        <Text style={styles.header}>Getting around</Text>
        <Text style={styles.tierLabel}>{profile.label}</Text>
      </View>

      <Text style={[styles.deliveryLine, profile.tier === 'none' && styles.deliveryLineNone]}>
        {deliveryLine}
      </Text>

      {advice ? <Text style={styles.advice}>{advice}</Text> : null}

      {active ? (
        <View style={styles.activeRow}>
          <View style={styles.activeInfo}>
            <Text style={styles.activeName}>{active.plan.name}</Text>
            <Text style={styles.activeCost}>${active.plan.weeklyPrice}/wk · billed weekly</Text>
          </View>
          <TouchableOpacity
            style={styles.endButton}
            onPress={onEndRental}
            activeOpacity={0.85}
            accessibilityRole="button"
            accessibilityLabel={`End ${active.plan.name}`}
          >
            <X size={scale(13)} color="#FCA5A5" strokeWidth={2.6} />
            <Text style={styles.endButtonText}>End rental</Text>
          </TouchableOpacity>
        </View>
      ) : (
        SCOOTER_RENTAL_PLANS.map((plan: ScooterRentalPlan) => {
          const affordable = money >= plan.signupFee;
          return (
            <TouchableOpacity
              key={plan.id}
              style={[styles.planRow, !affordable && styles.planRowLocked]}
              onPress={affordable ? () => onRent(plan.id) : undefined}
              activeOpacity={affordable ? 0.85 : 1}
              disabled={!affordable}
              accessibilityRole="button"
              accessibilityLabel={`Rent ${plan.name}`}
            >
              <View style={styles.planInfo}>
                <Text style={styles.planName}>{plan.name}</Text>
                <Text style={styles.planBlurb} numberOfLines={2}>
                  {plan.blurb}
                </Text>
                <View style={styles.planMeta}>
                  <TrendingUp size={scale(11)} color="rgba(226, 232, 240, 0.6)" />
                  <Text style={styles.planMetaText}>${plan.weeklyPrice}/wk</Text>
                  <Zap size={scale(11)} color="rgba(226, 232, 240, 0.6)" />
                  <Text style={styles.planMetaText}>
                    {plan.signupFee > 0 ? `$${plan.signupFee} to start` : 'free to start'}
                  </Text>
                </View>
              </View>
              <Text style={[styles.planCta, !affordable && styles.planCtaLocked]}>
                {affordable ? 'Rent' : `Need $${plan.signupFee}`}
              </Text>
            </TouchableOpacity>
          );
        })
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: scale(14),
    padding: scale(14),
    marginBottom: scale(12),
    backgroundColor: 'rgba(15, 23, 42, 0.6)',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(125, 211, 160, 0.28)',
  },
  headerRow: { flexDirection: 'row', alignItems: 'center', gap: scale(7) },
  header: { color: '#F8FAFC', fontSize: fontScale(14), fontWeight: '800', flex: 1 },
  tierLabel: { color: '#7DD3A0', fontSize: fontScale(12), fontWeight: '700' },
  deliveryLine: {
    color: 'rgba(226, 232, 240, 0.7)',
    fontSize: fontScale(12),
    fontWeight: '600',
    marginTop: scale(5),
  },
  deliveryLineNone: { color: 'rgba(248, 113, 113, 0.85)' },
  advice: {
    color: 'rgba(251, 191, 36, 0.95)',
    fontSize: fontScale(11.5),
    fontWeight: '700',
    marginTop: scale(6),
  },
  activeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: scale(10),
    gap: scale(10),
  },
  activeInfo: { flex: 1 },
  activeName: { color: '#F8FAFC', fontSize: fontScale(13), fontWeight: '800' },
  activeCost: { color: 'rgba(226, 232, 240, 0.6)', fontSize: fontScale(11.5), fontWeight: '600' },
  endButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: scale(4),
    paddingHorizontal: scale(10),
    paddingVertical: scale(7),
    borderRadius: scale(9),
    backgroundColor: 'rgba(248, 113, 113, 0.12)',
  },
  endButtonText: { color: '#FCA5A5', fontSize: fontScale(12), fontWeight: '700' },
  planRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: scale(10),
    marginTop: scale(10),
    paddingTop: scale(10),
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: 'rgba(148, 163, 184, 0.18)',
  },
  planRowLocked: { opacity: 0.5 },
  planInfo: { flex: 1 },
  planName: { color: '#F8FAFC', fontSize: fontScale(13), fontWeight: '800' },
  planBlurb: {
    color: 'rgba(226, 232, 240, 0.6)',
    fontSize: fontScale(11.5),
    fontWeight: '600',
    marginTop: scale(2),
  },
  planMeta: { flexDirection: 'row', alignItems: 'center', gap: scale(4), marginTop: scale(5) },
  planMetaText: {
    color: 'rgba(226, 232, 240, 0.6)',
    fontSize: fontScale(11),
    fontWeight: '700',
    marginRight: scale(6),
  },
  planCta: { color: '#7DD3A0', fontSize: fontScale(13), fontWeight: '800' },
  planCtaLocked: { color: 'rgba(226, 232, 240, 0.45)', fontSize: fontScale(11.5) },
});
