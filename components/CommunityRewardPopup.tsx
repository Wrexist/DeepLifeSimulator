/**
 * CommunityRewardPopup — the one-time "join our Discord for a cash reward"
 * invite, shown once early in a life and never again.
 *
 * ## Shape
 *
 * A bottom SHEET, deliberately built in the same visual language as the
 * rewarded-ad sheet the side orb opens (`components/AdRewardOrb.tsx`): dimmed
 * backdrop, rounded top corners, a close affordance top-right, a gradient hero
 * badge, one reward card stating exactly what is paid, and a single full-width
 * gradient CTA. Rewards in this game are offered in one consistent frame, so a
 * player who has tapped an ad orb already knows how to read this.
 *
 * What differs from the ad sheet, on purpose:
 *   - the hero carries Discord's OWN mark in brand blurple, not a generic chat
 *     bubble, so the destination is recognizable before any text is read;
 *   - the invite URL is PRINTED under the CTA. The button leaves the app, and a
 *     button that leaves the app without naming where it goes is the shape of a
 *     scam. Showing `discord.gg/…` is also the fallback for a player whose
 *     device cannot open the link.
 *
 * ## Ownership
 *
 * Presentational only. The parent owns the grant and the durable exactly-once
 * marker (`utils/discordRewardClaim.ts`, shared with the Settings entry point),
 * so this file can never double-pay. Its own re-entrancy guard is narrower: it
 * stops ONE tap from firing `onJoin` twice while the sheet is closing.
 */
import React, { useCallback, useEffect, useRef } from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { X, DollarSign, ExternalLink } from 'lucide-react-native';
import Gradient from '@/components/ui/Gradient';
import DiscordLogo, { DISCORD_BLURPLE } from '@/components/ui/DiscordLogo';
import { useTheme } from '@/hooks/useTheme';
import { DISCORD_INVITE_LABEL } from '@/lib/config/appConfig';
import { formatMoney } from '@/utils/moneyFormatting';
import { haptic } from '@/utils/haptics';
import { scale, fontScale, responsiveSpacing, touchTargets } from '@/utils/scaling';

const LinearGradient = Gradient;
// Blurple → the lighter brand tint. Same two-stop treatment as the ad sheet's
// money/vitality gradients, so the CTA and hero read as the same component family.
const DISCORD_GRADIENT = [DISCORD_BLURPLE, '#7B87FF'] as const;
const MONEY_GREEN = '#10B981';

/** Stable no-op so the sheet's tap-swallowing Pressable keeps one identity. */
const noop = () => {};

interface CommunityRewardPopupProps {
  visible: boolean;
  /** One-time cash reward granted on join. */
  rewardAmount: number;
  /** Claim the reward + open Discord. */
  onJoin: () => void;
  /** Quietly dismiss ("Maybe later") — won't nag again this install. */
  onDismiss: () => void;
}

/** What the player gets, beyond the cash. Three lines, no scrolling. */
const PERKS = [
  'Patch notes and sneak peeks before release',
  'Report a bug straight to the devs',
  'Giveaways, codes and community events',
] as const;

export default function CommunityRewardPopup({
  visible,
  rewardAmount,
  onJoin,
  onDismiss,
}: CommunityRewardPopupProps) {
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();

  const safeRewardAmount =
    typeof rewardAmount === 'number' && Number.isFinite(rewardAmount) && rewardAmount >= 0
      ? rewardAmount
      : 0;
  const rewardLabel = formatMoney(safeRewardAmount);

  // Re-entrancy guard: one tap must fire exactly one callback, even while the
  // sheet is animating out and still mounted.
  const actionInProgressRef = useRef(false);
  useEffect(() => {
    if (visible) actionInProgressRef.current = false;
  }, [visible]);

  const handleJoin = useCallback(() => {
    if (actionInProgressRef.current) return;
    actionInProgressRef.current = true;
    haptic.success();
    onJoin();
  }, [onJoin]);

  const handleDismiss = useCallback(() => {
    if (actionInProgressRef.current) return;
    actionInProgressRef.current = true;
    onDismiss();
  }, [onDismiss]);

  const joinLabel =
    safeRewardAmount > 0 ? `Join Discord & claim ${rewardLabel}` : 'Join our Discord';

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={handleDismiss}>
      {/* Tapping the dimmed area is the same quiet "not now" as the X. */}
      <Pressable
        style={styles.backdrop}
        onPress={handleDismiss}
        accessibilityRole="button"
        accessibilityLabel="Close"
      >
        {/* Swallow taps inside the sheet so they never reach the backdrop. */}
        <Pressable
          onPress={noop}
          accessible={false}
          style={[
            styles.sheet,
            {
              backgroundColor: theme.surface,
              paddingBottom: responsiveSpacing.lg + insets.bottom,
            },
          ]}
        >
          <View style={styles.sheetHeader}>
            <Pressable
              onPress={handleDismiss}
              hitSlop={8}
              accessibilityRole="button"
              accessibilityLabel="Close"
              style={styles.closeBtn}
            >
              <X size={fontScale(22)} color={theme.text} />
            </Pressable>
          </View>

          <LinearGradient
            colors={DISCORD_GRADIENT as unknown as string[]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.heroBadge}
          >
            <DiscordLogo size={scale(38)} color="#FFFFFF" />
          </LinearGradient>

          <Text style={[styles.title, { color: theme.text }]}>Join our Discord</Text>
          <Text style={[styles.subtitle, { color: theme.textSecondary }]}>
            Hang out with other players and the devs — and take a one-time welcome bonus with you.
          </Text>

          {safeRewardAmount > 0 && (
            <View
              style={[
                styles.rewardCard,
                { backgroundColor: theme.surfaceElevated, borderColor: theme.border },
              ]}
            >
              <View style={styles.rewardRow}>
                <DollarSign size={fontScale(20)} color={MONEY_GREEN} />
                <Text style={[styles.rewardValue, { color: theme.text }]}>+{rewardLabel}</Text>
                <Text style={[styles.rewardUnit, { color: theme.textSecondary }]}>cash</Text>
              </View>
              <Text style={[styles.note, { color: theme.textSecondary }]}>
                Added instantly · one time only
              </Text>
            </View>
          )}

          <View style={styles.perks}>
            {PERKS.map((perk) => (
              <View key={perk} style={styles.perkRow}>
                <View style={[styles.perkDot, { backgroundColor: DISCORD_BLURPLE }]} />
                <Text style={[styles.perkText, { color: theme.textSecondary }]}>{perk}</Text>
              </View>
            ))}
          </View>

          <Pressable
            onPress={handleJoin}
            accessibilityRole="button"
            accessibilityLabel={
              safeRewardAmount > 0
                ? `Join our Discord and claim ${rewardLabel}`
                : 'Join our Discord'
            }
            style={styles.cta}
          >
            <LinearGradient
              colors={DISCORD_GRADIENT as unknown as string[]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={styles.ctaFill}
            >
              <DiscordLogo size={scale(20)} color="#FFFFFF" />
              <Text style={styles.ctaText}>{joinLabel}</Text>
            </LinearGradient>
          </Pressable>

          {/* The destination, in plain sight. Tapping it does exactly what the
              CTA does — the reward is granted either way, so a player who aims
              for the link instead of the button is never shortchanged. */}
          <Pressable
            onPress={handleJoin}
            accessibilityRole="link"
            accessibilityLabel={`Open ${DISCORD_INVITE_LABEL}`}
            hitSlop={6}
            style={styles.linkRow}
          >
            <ExternalLink size={fontScale(12)} color={theme.textSecondary} />
            <Text style={[styles.linkText, { color: theme.textSecondary }]} numberOfLines={1}>
              {DISCORD_INVITE_LABEL}
            </Text>
          </Pressable>

          <Pressable
            onPress={handleDismiss}
            accessibilityRole="button"
            accessibilityLabel="Maybe later"
            style={styles.dismissBtn}
          >
            <Text style={[styles.dismissText, { color: theme.textSecondary }]}>Maybe later</Text>
          </Pressable>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'flex-end',
  },
  sheet: {
    borderTopLeftRadius: scale(24),
    borderTopRightRadius: scale(24),
    padding: responsiveSpacing.lg,
  },
  sheetHeader: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
  },
  closeBtn: {
    width: touchTargets.minimum,
    height: touchTargets.minimum,
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroBadge: {
    alignSelf: 'center',
    width: scale(72),
    height: scale(72),
    borderRadius: scale(36),
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: responsiveSpacing.md,
  },
  title: {
    textAlign: 'center',
    fontSize: fontScale(22),
    fontWeight: '800',
  },
  subtitle: {
    textAlign: 'center',
    fontSize: fontScale(13),
    marginTop: responsiveSpacing.xs,
    marginBottom: responsiveSpacing.lg,
    paddingHorizontal: responsiveSpacing.sm,
  },
  rewardCard: {
    borderRadius: scale(14),
    borderWidth: StyleSheet.hairlineWidth,
    padding: responsiveSpacing.md,
    alignItems: 'center',
    marginBottom: responsiveSpacing.md,
    gap: 4,
  },
  rewardRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 6,
  },
  rewardValue: {
    fontSize: fontScale(28),
    fontWeight: '800',
    fontVariant: ['tabular-nums'],
  },
  rewardUnit: {
    fontSize: fontScale(13),
  },
  note: {
    fontSize: fontScale(11),
    marginTop: 4,
    textAlign: 'center',
  },
  perks: {
    alignSelf: 'stretch',
    gap: responsiveSpacing.xs,
    marginBottom: responsiveSpacing.lg,
    paddingHorizontal: responsiveSpacing.xs,
  },
  perkRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: scale(8),
  },
  perkDot: {
    width: scale(5),
    height: scale(5),
    borderRadius: scale(2.5),
  },
  perkText: {
    flex: 1,
    fontSize: fontScale(12),
    fontWeight: '500',
  },
  cta: {
    borderRadius: scale(14),
    overflow: 'hidden',
  },
  ctaFill: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: scale(8),
    paddingVertical: responsiveSpacing.md,
    paddingHorizontal: responsiveSpacing.md,
  },
  ctaText: {
    color: '#FFFFFF',
    fontSize: fontScale(15),
    fontWeight: '800',
  },
  linkRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: scale(5),
    marginTop: responsiveSpacing.sm,
  },
  linkText: {
    fontSize: fontScale(12),
    fontWeight: '600',
    letterSpacing: 0.2,
  },
  dismissBtn: {
    alignItems: 'center',
    paddingVertical: responsiveSpacing.sm,
    marginTop: scale(2),
  },
  dismissText: {
    fontSize: fontScale(13),
    fontWeight: '600',
  },
});
