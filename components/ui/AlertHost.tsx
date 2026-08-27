/**
 * AlertHost - renders the app's in-game alerts, one at a time.
 *
 * Mounted once at the root, plus once INSIDE each full-screen RN Modal that
 * raises alerts (death screen, gem shop). iOS presents an RN Modal from the
 * view controller nearest its mount point, so the root host's dialog cannot
 * present while another Modal covers the screen - the nested copy registers
 * on top of the handler stack and presents from the covering Modal's own VC.
 * Everything else calls `gameAlert(...)` from `@/utils/gameAlert`, which
 * mirrors `Alert.alert`'s signature; this component is what makes those calls
 * look like the game instead of the OS.
 *
 * Visual language is deliberately the same as `ConfirmDialog` (gradient badge,
 * hairline-bordered elevated card, filled primary next to a ghost cancel) so
 * the two read as one family - an alert IS a confirm dialog with N buttons.
 *
 * Queued rather than replaced: a second alert raised while one is open waits
 * its turn, so a decision can never be silently clobbered by a later message.
 */
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Animated, Easing, Modal, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { AlertCircle, AlertTriangle, CheckCircle, HelpCircle } from 'lucide-react-native';
import Gradient from '@/components/ui/Gradient';
import { useTheme } from '@/hooks/useTheme';
import { useReducedMotion } from '@/hooks/useReducedMotion';
import { fontScale, responsiveSpacing, scale, touchTargets } from '@/utils/scaling';
import { Z_INDEX } from '@/utils/zIndexConstants';
import { haptic } from '@/utils/haptics';
import {
  registerAlertHandler,
  type GameAlertButton,
  type GameAlertRequest,
} from '@/utils/gameAlert';

const LinearGradient = Gradient;

const ENTER_SCALE = 0.94;
const DURATION_BASE = 220;
const DURATION_FAST = 160;
const EASE_OUT = Easing?.bezier ? Easing.bezier(0.23, 1, 0.32, 1) : undefined;

type Tone = 'default' | 'warning' | 'danger' | 'success';

const TONE_ACCENT: Record<Tone, readonly [string, string]> = {
  default: ['#3B82F6', '#60A5FA'],
  warning: ['#F59E0B', '#FBBF24'],
  danger: ['#EF4444', '#F87171'],
  success: ['#10B981', '#34D399'],
};

const TONE_ICON = {
  default: HelpCircle,
  warning: AlertTriangle,
  danger: AlertCircle,
  success: CheckCircle,
} as const;

/** A destructive button makes the whole dialog read as danger unless told otherwise. */
function inferTone(request: GameAlertRequest): Tone {
  if (request.options?.tone) return request.options.tone;
  if (request.buttons.some((b) => b.style === 'destructive')) return 'danger';
  return 'default';
}

export default function AlertHost() {
  const { theme } = useTheme();
  const reducedMotion = useReducedMotion();
  const [queue, setQueue] = useState<GameAlertRequest[]>([]);
  const current = queue[0] ?? null;

  useEffect(
    () => registerAlertHandler((request) => setQueue((prev) => [...prev, request])),
    []
  );

  const scaleAnim = useRef(new Animated.Value(ENTER_SCALE)).current;
  // Keyed on the id alone, deliberately: the entrance should replay when a
  // DIFFERENT alert takes the screen, not when this one's object identity
  // happens to change. Reading only `currentId` here is what makes that
  // dependency list honest rather than suppressed.
  const currentId = current?.id;
  useEffect(() => {
    if (currentId === undefined) return;
    scaleAnim.setValue(reducedMotion ? 1 : ENTER_SCALE);
    const anim = Animated.timing(scaleAnim, {
      toValue: 1,
      duration: reducedMotion ? DURATION_FAST : DURATION_BASE,
      easing: EASE_OUT,
      useNativeDriver: true,
    });
    anim.start();
    return () => anim.stop();
  }, [currentId, reducedMotion, scaleAnim]);

  // Dismiss FIRST, then run the handler: a handler that raises another alert
  // must land behind this one in the queue, not be dropped by this shift.
  const dismiss = useCallback((onPress?: () => void) => {
    setQueue((prev) => prev.slice(1));
    onPress?.();
  }, []);

  const handleRequestClose = useCallback(() => {
    if (!current) return;
    const cancel = current.buttons.find((b) => b.style === 'cancel');
    if (cancel) {
      dismiss(cancel.onPress);
      return;
    }
    // No cancel button: only dismiss when the caller allowed it, so a forced
    // decision cannot be escaped with the back gesture.
    if (current.options?.cancelable) dismiss();
  }, [current, dismiss]);

  if (!current) return null;

  const tone = inferTone(current);
  const accent = TONE_ACCENT[tone];
  const BadgeIcon = TONE_ICON[tone];
  const buttons = current.buttons;
  // Two buttons sit side by side (the familiar cancel/confirm pair); one or
  // three-plus stack, because a squeezed third label wraps to two lines.
  const sideBySide = buttons.length === 2;

  const renderButton = (button: GameAlertButton, index: number) => {
    const isCancel = button.style === 'cancel';
    const isDestructive = button.style === 'destructive';
    const fill: readonly [string, string] = isDestructive ? TONE_ACCENT.danger : accent;

    if (isCancel) {
      return (
        <TouchableOpacity
          key={`${button.text}-${index}`}
          onPress={() => {
            haptic.light();
            dismiss(button.onPress);
          }}
          accessibilityRole="button"
          accessibilityLabel={button.text}
          activeOpacity={0.8}
          style={[
            styles.ghostBtn,
            { borderColor: theme.borderStrong },
            sideBySide && styles.flexBtn,
          ]}
        >
          <Text style={[styles.ghostText, { color: theme.text }]}>{button.text}</Text>
        </TouchableOpacity>
      );
    }

    return (
      <TouchableOpacity
        key={`${button.text}-${index}`}
        onPress={() => {
          if (isDestructive) haptic.warning();
          else haptic.light();
          dismiss(button.onPress);
        }}
        accessibilityRole="button"
        accessibilityLabel={button.text}
        activeOpacity={0.85}
        style={[styles.filledBtn, sideBySide && styles.flexBtn]}
      >
        <LinearGradient
          colors={fill}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.filledFill}
        >
          <Text style={styles.filledText}>{button.text}</Text>
        </LinearGradient>
      </TouchableOpacity>
    );
  };

  return (
    <Modal transparent visible animationType="fade" onRequestClose={handleRequestClose}>
      <View style={[styles.overlay, { backgroundColor: theme.overlay }]}>
        <Animated.View
          accessibilityViewIsModal
          style={[
            styles.card,
            {
              backgroundColor: theme.surface,
              borderColor: theme.border,
              transform: [{ scale: scaleAnim }],
            },
          ]}
        >
          <LinearGradient
            colors={accent}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.badge}
          >
            <BadgeIcon size={scale(28)} color="#FFFFFF" strokeWidth={2.2} />
          </LinearGradient>

          <Text style={[styles.title, { color: theme.text }]} maxFontSizeMultiplier={1.6}>
            {current.title}
          </Text>
          {current.message ? (
            <Text
              style={[styles.message, { color: theme.textSecondary }]}
              maxFontSizeMultiplier={1.6}
            >
              {current.message}
            </Text>
          ) : null}

          <View style={[styles.actions, sideBySide ? styles.actionsRow : styles.actionsColumn]}>
            {buttons.map(renderButton)}
          </View>
        </Animated.View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: responsiveSpacing.lg,
    zIndex: Z_INDEX.MODAL,
  },
  card: {
    width: '85%',
    maxWidth: scale(400),
    borderRadius: scale(20),
    borderWidth: StyleSheet.hairlineWidth,
    padding: responsiveSpacing.lg,
    shadowColor: '#000',
    shadowOpacity: 0.35,
    shadowOffset: { width: 0, height: 8 },
    shadowRadius: 20,
    elevation: 12,
  },
  badge: {
    alignSelf: 'center',
    width: scale(60),
    height: scale(60),
    borderRadius: scale(30),
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: responsiveSpacing.md,
  },
  title: {
    fontSize: fontScale(20),
    fontWeight: '800',
    textAlign: 'center',
    marginBottom: responsiveSpacing.sm,
  },
  message: {
    fontSize: fontScale(14),
    lineHeight: fontScale(20),
    textAlign: 'center',
    marginBottom: responsiveSpacing.lg,
  },
  actions: {
    gap: responsiveSpacing.sm,
  },
  actionsRow: {
    flexDirection: 'row',
  },
  actionsColumn: {
    flexDirection: 'column',
  },
  flexBtn: {
    flex: 1,
  },
  ghostBtn: {
    minHeight: touchTargets.minimum,
    borderRadius: scale(14),
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: responsiveSpacing.md,
  },
  ghostText: {
    fontSize: fontScale(15),
    fontWeight: '600',
  },
  filledBtn: {
    minHeight: touchTargets.minimum,
    borderRadius: scale(14),
    overflow: 'hidden',
  },
  filledFill: {
    flex: 1,
    minHeight: touchTargets.minimum,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: responsiveSpacing.md,
  },
  filledText: {
    color: '#FFFFFF',
    fontSize: fontScale(15),
    fontWeight: '700',
  },
});
