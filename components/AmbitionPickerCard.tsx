/**
 * AmbitionPickerCard — a way into the ambition system for lives that skipped it.
 *
 * `ambitionId` was written in exactly two places outside tests: the onboarding
 * draft, and the dev tools. The onboarding screen offers an explicit skip whose
 * own copy says the choice is optional, and `getAmbitionCompletion` returns
 * `null` for an absent id — so `AmbitionCard` renders nothing, permanently.
 *
 * The result: an entire progression system (8 ambitions × 4 milestones, payoffs
 * up to $300,000 + 260 gems + 900 prestige points + a badge) was invisible and
 * unobtainable for any player who took the optional skip, and for EVERY save
 * predating the feature — with no in-game affordance to pick one later.
 * 2026-07-30 audit GP-9.
 *
 * Picking later is not a farm: `getAmbitionCompletion` reports `alreadyClaimed`
 * when either the per-life `ambitionRewardClaimed` flag or
 * `prestige.claimedAmbitions` contains the id, and `grantAmbitionPayout` sets
 * that flag on payout — so a life that has claimed once cannot claim again by
 * switching. Milestone ids are ambition-prefixed and unique, so stale progress
 * cannot cross-satisfy a different ambition either.
 */
import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView } from 'react-native';
import { Check, Compass, Gem, Star } from 'lucide-react-native';
import { useGameSelector, useSetGameState } from '@/contexts/game/useGameSelector';
import { useGameActions } from '@/contexts/game/GameActionsContext';
import { haptic } from '@/utils/haptics';
import { formatMoney } from '@/utils/moneyFormatting';
import { LIFE_AMBITIONS } from '@/lib/ambitions';
import { fontScale, scale, responsiveBorderRadius } from '@/utils/scaling';

/** One line describing what an ambition pays, for the picker rows. */
export function payoffLine(payoff: {
  money?: number;
  gems?: number;
  prestigePoints?: number;
}): string {
  const parts: string[] = [];
  if (payoff.money) parts.push(formatMoney(payoff.money));
  if (payoff.gems) parts.push(`${payoff.gems} gems`);
  if (payoff.prestigePoints) parts.push(`${payoff.prestigePoints} prestige`);
  return parts.join(' · ');
}

function AmbitionPickerCard() {
  const ambitionId = useGameSelector((s) => s?.ambitionId);
  const setGameState = useSetGameState();
  const { saveGame } = useGameActions();
  const [expanded, setExpanded] = useState(false);

  // A life that already has one is served by AmbitionCard, not this.
  if (ambitionId) return null;

  const choose = (id: string) => {
    haptic.success();
    setGameState((prev) => {
      // Re-check inside the updater: two taps in the same batch must not both
      // write, and a life that somehow gained an ambition meanwhile keeps it.
      if (prev.ambitionId) return prev;
      return { ...prev, ambitionId: id };
    });
    setExpanded(false);
    // Deferred to a macrotask, not called inline. `saveGame` reads
    // `gameStateRef.current`, which is synced to state in a POST-COMMIT effect,
    // so a synchronous call here persists the snapshot from BEFORE the pick —
    // the ambition would be silently lost on reload. Same pattern as
    // BrandDealsScreen's `persist`.
    setTimeout(() => { void saveGame?.(false); }, 0);
  };

  return (
    <View style={styles.card}>
      <View style={styles.header}>
        <View style={styles.crest}>
          <Compass size={scale(18)} color="#60A5FA" />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.kicker}>LIFE AMBITION</Text>
          <Text style={styles.title}>Choose what this life is for</Text>
          <Text style={styles.sub}>
            A lifelong goal in four stages, with a one-time payoff when you finish it.
          </Text>
        </View>
      </View>

      {!expanded ? (
        <TouchableOpacity
          accessibilityRole="button"
          accessibilityLabel="Choose a life ambition"
          style={styles.cta}
          onPress={() => {
            haptic.light();
            setExpanded(true);
          }}
          activeOpacity={0.85}
        >
          <Star size={scale(15)} color="#0F172A" />
          <Text style={styles.ctaText}>Pick an Ambition</Text>
        </TouchableOpacity>
      ) : (
        <ScrollView style={styles.list} nestedScrollEnabled contentContainerStyle={styles.listContent}>
          {LIFE_AMBITIONS.map((a) => (
            <TouchableOpacity
              key={a.id}
              accessibilityRole="button"
              accessibilityLabel={`Choose ${a.name}`}
              style={[styles.option, { borderColor: `${a.color}55` }]}
              onPress={() => choose(a.id)}
              activeOpacity={0.85}
            >
              <View style={[styles.optionCrest, { backgroundColor: `${a.color}22` }]}>
                <Text style={styles.optionEmoji}>{a.emoji}</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.optionTitle} numberOfLines={1}>
                  {a.name}
                </Text>
                <Text style={styles.optionSub} numberOfLines={1}>
                  {a.milestones.length} milestones · {payoffLine(a.payoff)}
                </Text>
              </View>
              {a.payoff.gems ? (
                <View style={styles.gemChip}>
                  <Gem size={scale(11)} color="#FBBF24" />
                  <Text style={styles.gemChipText}>{a.payoff.gems}</Text>
                </View>
              ) : (
                <Check size={scale(14)} color="#64748B" />
              )}
            </TouchableOpacity>
          ))}
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    marginHorizontal: scale(16),
    marginBottom: scale(12),
    padding: scale(14),
    borderRadius: responsiveBorderRadius.lg,
    backgroundColor: 'rgba(30, 41, 59, 0.75)',
    borderWidth: 1,
    borderColor: 'rgba(59, 130, 246, 0.3)',
    gap: scale(12),
  },
  header: { flexDirection: 'row', alignItems: 'center', gap: scale(12) },
  crest: {
    width: scale(40),
    height: scale(40),
    borderRadius: scale(12),
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(59, 130, 246, 0.14)',
    borderWidth: 1,
    borderColor: 'rgba(59, 130, 246, 0.4)',
  },
  kicker: { color: '#60A5FA', fontSize: fontScale(10), fontWeight: '800', letterSpacing: 0.6 },
  title: { color: '#F8FAFC', fontSize: fontScale(15), fontWeight: '700', marginTop: scale(1) },
  sub: { color: '#94A3B8', fontSize: fontScale(11), marginTop: scale(2), lineHeight: fontScale(15) },
  cta: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: scale(7),
    paddingVertical: scale(11),
    borderRadius: scale(12),
    backgroundColor: '#60A5FA',
  },
  ctaText: { color: '#0F172A', fontSize: fontScale(13), fontWeight: '800' },
  list: { maxHeight: scale(280) },
  listContent: { gap: scale(8) },
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: scale(11),
    padding: scale(11),
    borderRadius: scale(12),
    backgroundColor: 'rgba(15, 23, 42, 0.5)',
    borderWidth: 1,
  },
  optionCrest: {
    width: scale(34),
    height: scale(34),
    borderRadius: scale(10),
    alignItems: 'center',
    justifyContent: 'center',
  },
  optionEmoji: { fontSize: fontScale(17) },
  optionTitle: { color: '#E2E8F0', fontSize: fontScale(13), fontWeight: '700' },
  optionSub: { color: '#94A3B8', fontSize: fontScale(10.5), marginTop: scale(2) },
  gemChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: scale(3),
    paddingHorizontal: scale(7),
    paddingVertical: scale(4),
    borderRadius: scale(8),
    backgroundColor: 'rgba(251, 191, 36, 0.12)',
  },
  gemChipText: { color: '#FBBF24', fontSize: fontScale(11), fontWeight: '800' },
});

export default React.memo(AmbitionPickerCard);
