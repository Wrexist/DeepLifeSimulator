/**
 * The one line shown when a story run stops.
 *
 * ── What this replaced, and why ───────────────────────────────────────────
 * Story mode used to run 52 weeks blocked behind a spinner and then explain
 * them in a 370-line Year in Review modal, backed by a digest that collected
 * and deduped notes and a summary that joined the digest to live state. That
 * was roughly 680 lines whose entire purpose was to describe what the player
 * had not been allowed to watch.
 *
 * Now the run PLAYS — the HUD updates as money climbs and age ticks — so there
 * is nothing to recap. What is left is the only thing the player cannot infer
 * from the numbers moving: WHY it stopped, and what to do about it. That is one
 * sentence, so it is one banner.
 *
 * It doubles as the DeepLife+ surface. The offer used to live in the recap at
 * what was measured as the day-0 peak; deleting the recap without rehoming it
 * would have quietly removed a revenue surface. It shows only after a run that
 * went well (`wasAGoodRun`), because asking for money right after handing back
 * a life in trouble is the worst possible moment.
 *
 * Styling: full `borderWidth` on all four sides, never a one-sided stripe —
 * Hard Rule #7 in CLAUDE.md.
 */

import React, { useEffect, useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Bell, Crown, X } from 'lucide-react-native';
import { describePause, wasAGoodRun, type StoryPause } from '@/lib/gameMode/mode';
import { getThemeColors, accent } from '@/lib/config/theme';
import { scale, fontScale, responsiveSpacing } from '@/utils/scaling';
import { useDeepLifePlusUpsell } from '@/hooks/useDeepLifePlusUpsell';
import { DEEP_LIFE_PLUS_FREE_TRIAL_DAYS } from '@/lib/subscription/deepLifePlus';
import SubscriptionModal from '@/components/SubscriptionModal';

interface StoryPauseBannerProps {
  pause: StoryPause | null;
  darkMode?: boolean;
  onDismiss: () => void;
}

/**
 * Once-per-app-session latch for the offer. Module scope, so it resets on cold
 * start — exactly the lifetime wanted. A player who ignores it once should not
 * be asked again while they keep playing.
 */
let offerShownThisSession = false;

/** Border colour by severity, so the reason reads before the words do. */
function toneFor(pause: StoryPause): string {
  switch (pause.reason) {
    case 'danger':
      return accent.danger;
    case 'illness':
      return accent.warning;
    case 'halted':
      return accent.warning;
    default:
      return accent.success;
  }
}

export function StoryPauseBanner({ pause, darkMode = true, onDismiss }: StoryPauseBannerProps) {
  const {
    active: isMember,
    present: openPlus,
    open: plusOpen,
    close: closePlus,
  } = useDeepLifePlusUpsell('story_pause');

  // Decided in an EFFECT, never during render. Two reasons, both load-bearing:
  // React 19 StrictMode renders twice, so latching `offerShownThisSession`
  // inline would burn the once-per-session flag on a render that never
  // committed; and this component is mounted persistently by the HUD with
  // `pause` null between runs, so a mount-time decision would be made against
  // no pause and the offer would never appear at all.
  const [showOffer, setShowOffer] = useState(false);
  useEffect(() => {
    if (!pause || isMember || offerShownThisSession || !wasAGoodRun(pause)) {
      setShowOffer(false);
      return;
    }
    offerShownThisSession = true;
    setShowOffer(true);
  }, [pause, isMember]);

  const c = getThemeColors(darkMode);
  if (!pause) return null;

  const tone = toneFor(pause);
  const message = describePause(pause);

  return (
    <View
      accessibilityRole="alert"
      accessibilityLabel={message}
      style={[styles.wrap, { backgroundColor: c.surfaceElevated, borderColor: tone }]}
    >
      <View style={styles.row}>
        <Bell size={scale(15)} color={tone} />
        <Text style={[styles.text, { color: c.text }]}>{message}</Text>
        <TouchableOpacity
          onPress={onDismiss}
          accessibilityRole="button"
          accessibilityLabel="Dismiss"
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <X size={scale(15)} color={c.textSecondary} />
        </TouchableOpacity>
      </View>

      {showOffer ? (
        <TouchableOpacity
          onPress={openPlus}
          activeOpacity={0.85}
          accessibilityRole="button"
          accessibilityLabel={
            DEEP_LIFE_PLUS_FREE_TRIAL_DAYS > 0
              ? `DeepLife Plus, ${DEEP_LIFE_PLUS_FREE_TRIAL_DAYS}-day free trial`
              : 'DeepLife Plus'
          }
          style={[styles.offer, { borderColor: accent.gold }]}
        >
          <Crown size={scale(14)} color={accent.gold} />
          <Text style={[styles.offerText, { color: c.text }]}>
            {DEEP_LIFE_PLUS_FREE_TRIAL_DAYS > 0
              ? `Good run. DeepLife+ — ad-free, weekly gems. ${DEEP_LIFE_PLUS_FREE_TRIAL_DAYS} days free.`
              : 'Good run. DeepLife+ — ad-free, weekly gems.'}
          </Text>
        </TouchableOpacity>
      ) : null}

      <SubscriptionModal visible={plusOpen} onClose={closePlus} />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    marginHorizontal: responsiveSpacing.md,
    marginTop: responsiveSpacing.sm,
    padding: responsiveSpacing.sm,
    borderRadius: scale(12),
    borderWidth: 1,
    gap: scale(8),
  },
  row: { flexDirection: 'row', alignItems: 'center', gap: scale(8) },
  text: { flex: 1, fontSize: fontScale(13), lineHeight: fontScale(18) },
  offer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: scale(8),
    borderWidth: 1,
    borderRadius: scale(10),
    padding: scale(8),
  },
  offerText: { flex: 1, fontSize: fontScale(12), lineHeight: fontScale(16) },
});

export default StoryPauseBanner;
