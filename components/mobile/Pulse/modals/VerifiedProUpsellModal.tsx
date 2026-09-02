/**
 * VerifiedProUpsellModal - Pulse Verified Pro, an IN-GAME cash subscription.
 *
 * The player pays with the in-game money they earn from jobs - NOT a real App
 * Store IAP. Buying debits `stats.money` immediately (via subscribeVerifiedPro →
 * canonical applyMoneyDelta, overdraft-reject) and the fee auto-renews weekly on
 * the game tick (applySubscriptionsForWeek); it lapses if the player can't afford
 * a renewal. When already subscribed the modal shows the active state and a
 * Cancel control.
 */
import React, { useCallback } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Check, Crown } from 'lucide-react-native';
import BaseModal from '@/components/ui/BaseModal';
import Chip from '@/components/ui/Chip';
import { useGame } from '@/contexts/GameContext';
import { useTheme } from '@/hooks/useTheme';
import { scale, fontScale, responsiveSpacing, touchTargets } from '@/utils/scaling';
import { formatMoney } from '@/utils/moneyFormatting';
import {
  VERIFIED_PRO_WEEKLY_PRICE,
  VERIFIED_PRO_ANNUAL_PRICE,
} from '@/lib/social/socialMedia';
import { subscribeVerifiedPro, cancelVerifiedPro } from '@/contexts/game/actions/PulseActions';
import { PULSE_COLORS } from '../styles/pulseTheme';
import { pulseHaptics } from '../utils/pulseHaptics';
import { gameAlert } from '@/utils/gameAlert';

/**
 * F7. "No ads in feed - Cleaner browsing experience" used to sit in this list.
 *
 * There are no ads in the Pulse feed. `PulseApp` renders posts, stories and
 * trending chips; there is no ad unit, sponsored row or promoted post anywhere
 * in the feed to remove. The one ad in Pulse is the OPT-IN rewarded video in
 * `RewardedAdModal`, which Verified Pro does not remove - it triples its
 * reward, and that perk really is implemented.
 *
 * Removed rather than delivered: adding an in-feed ad so a subscription could
 * take it away would be inventing an ad placement to justify the copy, which
 * is worse than the bug. The other four perks below are all real - the badge,
 * the 1.25x tick multiplier and reduced follower decay, the analytics screen,
 * and the 500-character compose limit.
 */
const PERKS: { title: string; subtitle: string }[] = [
  { title: 'Blue checkmark', subtitle: 'Verified across every Pulse surface' },
  { title: '+25% post boost', subtitle: 'More followers and revenue per post' },
  { title: 'Advanced analytics', subtitle: 'See per-post performance trends' },
  { title: 'Slower follower decay', subtitle: 'Your audience sticks around longer' },
  { title: 'Longer posts', subtitle: '500-character limit vs 280' },
];

interface VerifiedProUpsellModalProps {
  visible: boolean;
  onDismiss: () => void;
}

export default function VerifiedProUpsellModal({ visible, onDismiss }: VerifiedProUpsellModalProps) {
  const { gameState, setGameState, saveGame } = useGame();
  const { theme } = useTheme();

  const verifiedPro = gameState.socialMedia?.verifiedPro;
  const isActive = verifiedPro?.active === true;
  const money = gameState.stats?.money ?? 0;

  const handleSubscribe = useCallback(
    (plan: 'weekly' | 'annual') => {
      const result = subscribeVerifiedPro(setGameState, gameState, plan);
      if (result.success) {
        pulseHaptics.success();
        saveGame();
        onDismiss();
      } else {
        pulseHaptics.error?.();
        gameAlert('Verified Pro', result.message);
      }
    },
    [setGameState, gameState, saveGame, onDismiss],
  );

  const handleCancel = useCallback(() => {
    gameAlert(
      'Cancel Verified Pro?',
      // F7: "ad-free feed" removed here too - there is no in-feed ad to lose.
      'You will lose the blue check, post boost, analytics, slower follower decay, and longer posts. You can resubscribe any time.',
      [
        { text: 'Keep it', style: 'cancel' },
        {
          text: 'Cancel subscription',
          style: 'destructive',
          onPress: () => {
            cancelVerifiedPro(setGameState);
            saveGame();
            onDismiss();
          },
        },
      ],
    );
  }, [setGameState, saveGame, onDismiss]);

  const canAffordWeekly = money >= VERIFIED_PRO_WEEKLY_PRICE;
  const canAffordAnnual = money >= VERIFIED_PRO_ANNUAL_PRICE;

  return (
    <BaseModal
      visible={visible}
      onClose={onDismiss}
      variant="bottom"
      title="Pulse Verified Pro"
      subtitle={isActive ? "You're a Verified Pro member." : 'Unlock the blue check and creator perks.'}
      footer={
        <Text style={[styles.legal, { color: theme.textMuted }]}>
          {isActive
            ? verifiedPro?.plan === 'annual'
              ? 'Prepaid for 52 weeks. After the term it renews weekly from your in-game cash; lapses if you run out of money.'
              : 'Billed weekly from your in-game cash. Auto-renews until cancelled; lapses if you run out of money.'
            : `Paid from your in-game cash (${formatMoney(money)} available). Auto-renews weekly until cancelled.`}
        </Text>
      }
    >
      <View style={[styles.badge, { backgroundColor: PULSE_COLORS.accent }]}>
        <Crown size={scale(28)} color="#FFFFFF" strokeWidth={2.4} />
      </View>

      <View style={styles.perksList}>
        {PERKS.map((p) => (
          <View key={p.title} style={styles.perkRow}>
            <View style={[styles.perkIcon, { backgroundColor: theme.surfaceElevated }]}>
              <Check size={fontScale(14)} color={PULSE_COLORS.accent} strokeWidth={3} />
            </View>
            <View style={styles.perkText}>
              <Text style={[styles.perkTitle, { color: theme.text }]}>{p.title}</Text>
              <Text style={[styles.perkSubtitle, { color: theme.textSecondary }]}>{p.subtitle}</Text>
            </View>
          </View>
        ))}
      </View>

      {isActive ? (
        <>
          <View style={styles.activeRow}>
            <Chip label="Active" tint={PULSE_COLORS.accent} size="md" />
            <Text style={[styles.activeInfo, { color: theme.text }]}>
              {verifiedPro?.plan === 'annual'
                ? `Prepaid annual plan · then $${VERIFIED_PRO_WEEKLY_PRICE}/week`
                : `$${VERIFIED_PRO_WEEKLY_PRICE}/week · auto-renews from your cash`}
            </Text>
          </View>
          <Pressable
            onPress={handleCancel}
            accessibilityRole="button"
            accessibilityLabel="Cancel Verified Pro subscription"
            style={[styles.cancelBtn, { borderColor: theme.border }]}
          >
            <Text style={[styles.cancelLabel, { color: theme.textSecondary }]}>Cancel subscription</Text>
          </Pressable>
        </>
      ) : (
        <View style={styles.ctaRow}>
          <Pressable
            onPress={() => handleSubscribe('weekly')}
            disabled={!canAffordWeekly}
            style={[styles.planBtn, { borderColor: theme.border, opacity: canAffordWeekly ? 1 : 0.5 }]}
            accessibilityRole="button"
            accessibilityState={{ disabled: !canAffordWeekly }}
            accessibilityLabel={`Subscribe weekly, $${VERIFIED_PRO_WEEKLY_PRICE} per week`}
          >
            <Text style={[styles.planLabel, { color: theme.text }]}>Weekly</Text>
            <Text style={[styles.planPrice, { color: theme.text }]}>${VERIFIED_PRO_WEEKLY_PRICE}/wk</Text>
          </Pressable>
          <Pressable
            onPress={() => handleSubscribe('annual')}
            disabled={!canAffordAnnual}
            accessibilityRole="button"
            accessibilityState={{ disabled: !canAffordAnnual }}
            accessibilityLabel={`Subscribe annually, $${VERIFIED_PRO_ANNUAL_PRICE} for 52 weeks - save 17%`}
            style={[
              styles.planBtnPrimary,
              { backgroundColor: PULSE_COLORS.accent, opacity: canAffordAnnual ? 1 : 0.5 },
            ]}
          >
            <Text style={styles.planLabelPrimary}>Annual · Save 17%</Text>
            <Text style={styles.planPricePrimary}>${VERIFIED_PRO_ANNUAL_PRICE.toLocaleString()}/yr</Text>
          </Pressable>
        </View>
      )}
    </BaseModal>
  );
}

const styles = StyleSheet.create({
  badge: {
    alignSelf: 'center',
    width: scale(56),
    height: scale(56),
    borderRadius: scale(28),
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: responsiveSpacing.md,
  },
  perksList: {
    gap: responsiveSpacing.sm,
    marginBottom: responsiveSpacing.lg,
  },
  perkRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: responsiveSpacing.sm,
  },
  perkIcon: {
    width: scale(28),
    height: scale(28),
    borderRadius: scale(14),
    alignItems: 'center',
    justifyContent: 'center',
  },
  perkText: {
    flex: 1,
  },
  perkTitle: {
    fontSize: fontScale(14),
    fontWeight: '600',
  },
  perkSubtitle: {
    fontSize: fontScale(11),
    marginTop: 2,
  },
  ctaRow: {
    flexDirection: 'row',
    gap: responsiveSpacing.sm,
    marginBottom: responsiveSpacing.md,
  },
  planBtn: {
    flex: 1,
    paddingVertical: responsiveSpacing.md,
    paddingHorizontal: responsiveSpacing.md,
    minHeight: touchTargets.minimum,
    borderRadius: scale(14),
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: 'center',
    justifyContent: 'center',
  },
  planLabel: {
    fontSize: fontScale(13),
    fontWeight: '500',
  },
  planPrice: {
    fontSize: fontScale(16),
    fontWeight: '600',
    marginTop: 2,
  },
  planBtnPrimary: {
    flex: 1.4,
    paddingVertical: responsiveSpacing.md,
    paddingHorizontal: responsiveSpacing.md,
    minHeight: touchTargets.minimum,
    borderRadius: scale(14),
    alignItems: 'center',
    justifyContent: 'center',
  },
  planLabelPrimary: {
    color: '#FFFFFF',
    fontSize: fontScale(13),
    fontWeight: '600',
  },
  planPricePrimary: {
    color: '#FFFFFF',
    fontSize: fontScale(16),
    fontWeight: '600',
    marginTop: 2,
  },
  activeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: responsiveSpacing.sm,
    marginBottom: responsiveSpacing.md,
  },
  activeInfo: {
    flex: 1,
    fontSize: fontScale(13),
    fontWeight: '600',
  },
  cancelBtn: {
    paddingVertical: responsiveSpacing.md,
    minHeight: touchTargets.minimum,
    justifyContent: 'center',
    borderRadius: scale(14),
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: 'center',
    marginBottom: responsiveSpacing.md,
  },
  cancelLabel: {
    fontSize: fontScale(14),
    fontWeight: '600',
  },
  legal: {
    fontSize: fontScale(10),
    textAlign: 'center',
  },
});
