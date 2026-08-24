/**
 * WatchAdRewardButton - a reusable, self-contained "watch ad → reward" CTA that
 * any in-app screen can drop in to offer an optional rewarded ad.
 *
 * Behaviour:
 *  - Renders nothing when the player owns Remove Ads / DeepLife+ (`areAdsRemoved`).
 *  - On press, funnels through the shared `runRewardedAd` helper: shows a real
 *    rewarded video when AdMob is live, otherwise grants directly. The `onReward`
 *    mutation runs ONLY when the reward is actually earned.
 *  - Guards against double-taps while an ad is in flight, and can be `disabled`
 *    (e.g. a once-per-week cooldown) with its own label.
 */
import React, { useCallback, useState } from 'react';
import { Pressable, StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';
import { Play } from 'lucide-react-native';
import Gradient from '@/components/ui/Gradient';
import { useGame } from '@/contexts/GameContext';
import { areAdsRemoved, runRewardedAd, isGranted } from '@/lib/ads/rewardedAd';
import { scale, fontScale, responsiveSpacing } from '@/utils/scaling';
import { haptic } from '@/utils/haptics';

const LinearGradient = Gradient;
const DEFAULT_COLORS = ['#6366F1', '#4338CA'] as const;

// Matches the lucide-react-native icon call signature we rely on here.
type IconComponent = React.ComponentType<{
  size?: number;
  color?: string;
  strokeWidth?: number;
  fill?: string;
}>;

/**
 * PLACEMENT CONSTRAINT: never render this button inside a react-native
 * `Modal`. It presents a fullscreen ad directly on tap, and showing an ad over
 * an open RN Modal is unsupported by the ad SDK (iOS freezes with an invisible
 * touch-blocking modal window and the reward is lost - see `adsAvailable` in
 * lib/ads/rewardedAd.ts). Modal hosts must dismiss their sheet first and run
 * the ad themselves, like AdRewardOrb / Pulse RewardedAdModal do.
 */
interface WatchAdRewardButtonProps {
  /** Primary CTA text, e.g. "Watch ad → cash bonus". */
  label: string;
  /** Optional secondary line, e.g. "+$500 to your wallet". */
  sublabel?: string;
  /** Applies the reward. Called exactly once, only when the ad is earned. */
  onReward: () => void;
  /** Optional side-effect after a successful grant (e.g. queue a save). */
  onGranted?: () => void;
  /** Gradient for the pill. Defaults to indigo. */
  colors?: readonly [string, string];
  /** Leading icon. Defaults to a Play glyph. */
  icon?: IconComponent;
  /** When true, the button is shown but not tappable (e.g. cooldown). */
  disabled?: boolean;
  /** Label to show while disabled, e.g. "Come back next week". */
  disabledLabel?: string;
  style?: StyleProp<ViewStyle>;
}

export default function WatchAdRewardButton({
  label,
  sublabel,
  onReward,
  onGranted,
  colors = DEFAULT_COLORS,
  icon: Icon = Play,
  disabled = false,
  disabledLabel,
  style,
}: WatchAdRewardButtonProps) {
  const { gameState } = useGame();
  const [busy, setBusy] = useState(false);

  const adsRemoved = areAdsRemoved(gameState);

  const handlePress = useCallback(async () => {
    if (busy || disabled) return;
    setBusy(true);
    haptic.medium();
    try {
      const outcome = await runRewardedAd(onReward, { adsRemoved });
      if (isGranted(outcome)) {
        haptic.success();
        onGranted?.();
      } else {
        haptic.error(); // no-fill / error - reward NOT granted
      }
    } finally {
      setBusy(false);
    }
  }, [busy, disabled, adsRemoved, onReward, onGranted]);

  // A paid ad-free player never sees a "watch ad" affordance.
  if (adsRemoved) return null;

  const inactive = disabled || busy;
  const gradient = (inactive ? ['#9CA3AF', '#6B7280'] : colors) as unknown as string[];
  const primaryText = busy ? 'Loading ad…' : disabled && disabledLabel ? disabledLabel : label;

  return (
    <Pressable
      onPress={handlePress}
      disabled={inactive}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled: inactive, busy }}
      style={[styles.wrap, style]}
    >
      <LinearGradient colors={gradient} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.fill}>
        <Icon size={fontScale(18)} color="#FFFFFF" strokeWidth={2.3} fill={Icon === Play ? '#FFFFFF' : 'none'} />
        <View style={styles.textWrap}>
          <Text style={styles.label} numberOfLines={1}>{primaryText}</Text>
          {sublabel && !busy ? (
            <Text style={styles.sublabel} numberOfLines={1}>{sublabel}</Text>
          ) : null}
        </View>
      </LinearGradient>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  wrap: {
    borderRadius: scale(14),
    overflow: 'hidden',
  },
  fill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: scale(10),
    paddingVertical: responsiveSpacing.sm,
    paddingHorizontal: responsiveSpacing.md,
  },
  textWrap: {
    flex: 1,
  },
  label: {
    color: '#FFFFFF',
    fontSize: fontScale(14),
    fontWeight: '800',
  },
  sublabel: {
    color: 'rgba(255,255,255,0.85)',
    fontSize: fontScale(11),
    fontWeight: '600',
    marginTop: 1,
  },
});
