/**
 * GymCard - the $50 gym session, on the Health screen with the other
 * activities.
 *
 * Moved from the Market screen (UI overhaul, Phase 5): a workout is an
 * activity, not shopping - it lived on Market only because the membership
 * ITEM is sold there. The membership stays purchasable in the Market's Items
 * section; this card is the thing the membership unlocks.
 *
 * The gate/label/charge logic is carried over EXACTLY - the zero-gain guard,
 * the gym-timer staleness escape, the membership requirement, and the
 * charge-inside-one-updater discipline that __tests__/economy/gymAtomicity
 * pins (it reads this file's source).
 */
import React, { useCallback, useMemo } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Dumbbell } from 'lucide-react-native';
import { useGame } from '@/contexts/GameContext';
import { useToast } from '@/contexts/ToastContext';
import { useTranslation } from '@/hooks/useTranslation';
import StatEffectChips from '@/components/market/StatEffectChips';
import { clampStat, clampStatByKey } from '@/utils/statUtils';
import { fontScale, responsiveBorderRadius, responsiveSpacing, scale } from '@/utils/scaling';
import { accent } from '@/lib/config/theme';

const GLASS_BG = 'rgba(15, 23, 42, 0.55)';
const GLASS_BORDER = 'rgba(255, 255, 255, 0.08)';
const TEXT = '#F8FAFC';
const TEXT_MUTED = 'rgba(226, 232, 240, 0.45)';

export default function GymCard() {
  const { t } = useTranslation();
  const { gameState, setGameState, saveGame } = useGame();
  const { settings } = gameState;
  const { showSuccess } = useToast();

  const hasMembership = useMemo(() => {
    return gameState.items.find(item => item.id === 'gym_membership')?.owned || false;
  }, [gameState.items]);

  // Zero-gain guard: the $50 session grants +5 fitness / +3 health / +2 happiness.
  // When all three already sit at the cap every gain clamps to zero, so the visit
  // would charge money + energy for nothing. Compute the clamped deltas and treat
  // "all zero" as "already in top shape".
  const gymGainsAllZero = useMemo(() => {
    // Normalize first: a NaN/undefined stat on a corrupted save makes every
    // delta NaN, and `NaN <= 0` is false - the guard's answer would flip on
    // garbage input instead of being computed from a real baseline.
    const fitness = Number.isFinite(gameState.stats.fitness) ? gameState.stats.fitness : 0;
    const health = Number.isFinite(gameState.stats.health) ? gameState.stats.health : 0;
    const happiness = Number.isFinite(gameState.stats.happiness) ? gameState.stats.happiness : 0;
    const fitnessGain = clampStat(fitness + 5) - fitness;
    const healthGain = clampStat(health + 3) - health;
    const happinessGain = clampStat(happiness + 2) - happiness;
    return fitnessGain <= 0 && healthGain <= 0 && happinessGain <= 0;
  }, [gameState.stats.fitness, gameState.stats.health, gameState.stats.happiness]);

  // A gym session also refreshes the gym-visit timer the weekly tick reads to
  // scale fitness decay. When that timer is stale (behind the current week) a
  // workout is still worth doing even at capped stats, so the card must stay
  // tappable - otherwise a peak-shape player silently suffers accelerated decay.
  const gymTimerStale = useMemo(
    () => (gameState.lastGymVisitWeek || 0) !== (gameState.weeksLived || 0),
    [gameState.lastGymVisitWeek, gameState.weeksLived]
  );

  const canUseGym = useMemo(() => {
    return hasMembership && gameState.stats.money >= 50 && gameState.stats.energy >= 20 && (!gymGainsAllZero || gymTimerStale);
  }, [hasMembership, gameState.stats.money, gameState.stats.energy, gymGainsAllZero, gymTimerStale]);

  const handleGym = useCallback(() => {
    const cost = 50;
    const energyCost = 20;

    if (!hasMembership) return;

    // Refuse only when nothing would change: every stat gain clamps to zero AND
    // the gym-visit timer is already current. When the timer is stale the workout
    // still refreshes it (staving off accelerated fitness decay), so allow it.
    if (gymGainsAllZero && !gymTimerStale) return;

    // The gate the PLAYER is told about, read from the committed snapshot. It is
    // a fast path for messaging only - the authoritative check is against `prev`
    // inside the updater below.
    if (gameState.stats.money < cost) return;
    if (gameState.stats.energy < energyCost) return;

    // Charge, grant and stamp the timer in ONE updater, re-checked against
    // `prev`. Two taps in the same React batch both read the same stale
    // `gameState` above and both pass, and `disabled={!canUseGym}` cannot help
    // because it is derived from that same render. What made that a real
    // exploit rather than a harmless overdraw is the clamping: `updateStats`
    // routes money through `sanitizeAmount`, which turns anything <= 0 into 0,
    // and energy through `clampStat`, which floors at 0. So the second workout
    // charged NOTHING and still paid out +5 fitness / +3 health / +2 happiness.
    // Charging against `prev` refuses it instead of forgiving the debt and
    // granting anyway. Same discipline as the quick actions in TopStatsBar.
    setGameState(prev => {
      const st = prev.stats;
      if ((st?.money ?? 0) < cost || (st?.energy ?? 0) < energyCost) return prev;
      return {
        ...prev,
        // Refresh the gym-visit timer so consistent sessions stave off the
        // accelerated fitness decay the weekly tick applies the longer you skip it.
        lastGymVisitWeek: prev.weeksLived || 0,
        stats: {
          ...st,
          money: clampStatByKey('money', (st.money ?? 0) - cost),
          energy: clampStatByKey('energy', (st.energy ?? 0) - energyCost),
          fitness: clampStatByKey('fitness', (st.fitness ?? 0) + 5),
          health: clampStatByKey('health', (st.health ?? 0) + 3),
          happiness: clampStatByKey('happiness', (st.happiness ?? 0) + 2),
        },
      };
    });
    // Persist the session - deferred one macrotask so the save captures the
    // post-commit state (repo convention). Untracked on purpose: the save must
    // survive even if the screen unmounts right after the tap.
    setTimeout(() => { void saveGame?.(); }, 0);
    // Effort → reward feedback, matching the food/buy paths on the Market. When
    // stats are already capped the session still counts - it keeps the routine up.
    showSuccess(gymGainsAllZero
      ? '💪 Workout done! Fitness routine maintained.'
      : '💪 Workout done! +5 Fitness, +3 Health');
  }, [hasMembership, gymGainsAllZero, gymTimerStale, gameState.stats.money, gameState.stats.energy, setGameState, saveGame, showSuccess]);

  return (
    <View style={styles.gymCard}>
      <View style={styles.gymCardHeader}>
        <View style={styles.gymIconContainer}>
          <Dumbbell size={scale(22)} color={accent.info} />
        </View>
        <View style={styles.gymTitleContainer}>
          <Text style={styles.gymCardTitle}>{t('market.gymSession')}</Text>
          <Text style={styles.gymCardSubtitle}>
            Current Fitness: {Math.floor(gameState.stats.fitness)}
          </Text>
        </View>
      </View>

      {!hasMembership ? (
        <View style={styles.membershipWarningContainer}>
          <Text style={styles.membershipWarningText}>Gym Membership Required</Text>
          <Text style={styles.membershipWarningSubtext}>
            Buy a Gym Membership in Life → Market to access the gym.
          </Text>
        </View>
      ) : (
        <>
          {/* Same chip row as the food cards - the gym's three big
              number tiles said the same thing in a third visual
              language, and coloured health green while the HUD's
              health bar is red. */}
          <StatEffectChips
            caption="Per session"
            darkMode={settings.darkMode}
            effects={[
              { key: 'fitness', value: 5 },
              { key: 'health', value: 3 },
              { key: 'happiness', value: 2 },
            ]}
          />

          <View style={styles.gymCostRow}>
            <Text style={styles.gymCostLabel}>Session Cost</Text>
            <Text style={styles.gymCostValue}>$50 · 20 {t('game.energy')}</Text>
          </View>

          <TouchableOpacity
            onPress={handleGym}
            disabled={!canUseGym}
            activeOpacity={0.85}
            style={[styles.gymButton, !canUseGym && styles.gymButtonDisabled]}
          >
            <Text style={[styles.gymButtonText, !canUseGym && styles.gymButtonTextDisabled]}>
              {gymGainsAllZero && !gymTimerStale ? "You're in top shape" :
                gameState.stats.money < 50 ? t('market.notEnoughMoney') :
                  gameState.stats.energy < 20 ? t('market.notEnoughEnergy') :
                    t('market.startWorkout')}
            </Text>
          </TouchableOpacity>

          <Text style={styles.gymTip}>
            Consistent sessions raise fitness - which unlocks better jobs.
          </Text>
        </>
      )}
    </View>
  );
}

// Carried over from marketScreenStyles verbatim - single dark-glass card,
// no gradients, full hairline borders (Hard Rule #7).
const styles = StyleSheet.create({
  gymCard: {
    backgroundColor: GLASS_BG,
    borderRadius: responsiveBorderRadius.lg,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: GLASS_BORDER,
    padding: responsiveSpacing.md,
    gap: responsiveSpacing.md,
  },
  gymCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: scale(12),
  },
  gymIconContainer: {
    width: scale(44),
    height: scale(44),
    borderRadius: scale(13),
    backgroundColor: 'rgba(59, 130, 246, 0.15)',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(59, 130, 246, 0.4)',
  },
  gymTitleContainer: {
    flex: 1,
  },
  // The one >600 weight on this card: the card's own heading.
  gymCardTitle: {
    fontSize: fontScale(18),
    fontWeight: '700',
    color: TEXT,
    letterSpacing: -0.3,
    marginBottom: scale(2),
  },
  gymCardSubtitle: {
    fontSize: fontScale(13),
    fontWeight: '600',
    color: '#93C5FD',
  },
  membershipWarningContainer: {
    backgroundColor: 'rgba(245, 158, 11, 0.1)',
    padding: responsiveSpacing.md,
    borderRadius: responsiveBorderRadius.md,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(245, 158, 11, 0.35)',
  },
  membershipWarningText: {
    fontSize: fontScale(14),
    fontWeight: '700',
    color: '#FCD34D',
    marginBottom: scale(3),
  },
  membershipWarningSubtext: {
    fontSize: fontScale(12),
    color: 'rgba(252, 211, 77, 0.75)',
    lineHeight: fontScale(17),
  },
  gymCostRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: responsiveSpacing.sm,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: GLASS_BORDER,
  },
  gymCostLabel: {
    fontSize: fontScale(11),
    fontWeight: '600',
    color: TEXT_MUTED,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  gymCostValue: {
    fontSize: fontScale(15),
    fontWeight: '600',
    color: TEXT,
    fontVariant: ['tabular-nums'],
  },
  gymButton: {
    borderRadius: responsiveBorderRadius.md,
    paddingVertical: responsiveSpacing.sm,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: accent.info,
  },
  gymButtonDisabled: {
    backgroundColor: 'rgba(148, 163, 184, 0.15)',
  },
  gymButtonText: {
    fontSize: fontScale(15),
    fontWeight: '600',
    color: '#FFFFFF',
  },
  gymButtonTextDisabled: {
    color: TEXT_MUTED,
  },
  gymTip: {
    fontSize: fontScale(11.5),
    color: TEXT_MUTED,
    lineHeight: fontScale(16),
    textAlign: 'center',
  },
});
