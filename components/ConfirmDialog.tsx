/**
 * ConfirmDialog — the game's shared confirm/deny popup (purchases, selling,
 * quitting a job, deleting a save). Redesigned to match the in-game sheet
 * language: dark elevated surface, hairline border, a gradient icon badge and
 * a filled gradient primary CTA next to a quiet ghost cancel.
 *
 * The public prop API is backward-compatible with every existing call site —
 * `showIcon` now defaults to showing the badge, and `icon` is an optional
 * override. The confirm accent is derived from `type` (destructive/danger force
 * red) so cautionary and destructive flows keep their visual distinction.
 */
import React, { useEffect, useRef } from 'react';
import { Modal, View, Text, TouchableOpacity, StyleSheet, Animated, Easing } from 'react-native';
import { AlertTriangle, AlertCircle, CheckCircle, HelpCircle } from 'lucide-react-native';
import LinearGradientFallback from '@/components/fallbacks/LinearGradientFallback';
import { useTheme } from '@/hooks/useTheme';
import { useReducedMotion } from '@/hooks/useReducedMotion';
import { scale, fontScale, responsiveSpacing, touchTargets } from '@/utils/scaling';
import { Z_INDEX } from '@/utils/zIndexConstants';

const LinearGradient = LinearGradientFallback;

// Entrance motion mirrors the shared house tokens (src/utils/animated MOTION):
// a gentle 0.94→1 scale reveal on an ease-out curve, kept under the 300ms UI
// budget. Easing is resolved defensively so environments without the native
// Easing module (e.g. the render-test RN mock) can't crash at load.
const ENTER_SCALE = 0.94;
const DURATION_BASE = 220;
const DURATION_FAST = 160;
const EASE_OUT = Easing?.bezier ? Easing.bezier(0.23, 1, 0.32, 1) : undefined;

type DialogType = 'default' | 'warning' | 'danger' | 'success';

interface ConfirmDialogProps {
  visible: boolean;
  title: string;
  message: string;
  onConfirm: () => void;
  onCancel: () => void;
  confirmText?: string;
  cancelText?: string;
  type?: DialogType;
  /** Show the gradient icon badge (default true). */
  showIcon?: boolean;
  destructive?: boolean;
  /** Override the badge glyph; falls back to a sensible icon per `type`. */
  icon?: React.ReactNode;
}

// LinearGradientFallback paints the FIRST color as a solid fill, so the
// saturated shade leads each pair. Values mirror the semantic palette.
const TYPE_ACCENT: Record<DialogType, readonly [string, string]> = {
  default: ['#3B82F6', '#60A5FA'],
  warning: ['#F59E0B', '#FBBF24'],
  danger: ['#EF4444', '#F87171'],
  success: ['#10B981', '#34D399'],
};

const TYPE_ICON = {
  default: HelpCircle,
  warning: AlertTriangle,
  danger: AlertCircle,
  success: CheckCircle,
} as const;

export default function ConfirmDialog({
  visible,
  title,
  message,
  onConfirm,
  onCancel,
  confirmText = 'OK',
  cancelText = 'Cancel',
  type = 'default',
  showIcon = true,
  destructive = false,
  icon,
}: ConfirmDialogProps) {
  const { theme } = useTheme();
  const reducedMotion = useReducedMotion();

  // Native `animationType="fade"` handles the backdrop + graceful exit both
  // ways; this drives only the card's 0.94→1 scale reveal on entrance.
  const scaleAnim = useRef(new Animated.Value(ENTER_SCALE)).current;
  useEffect(() => {
    if (!visible) return;
    scaleAnim.setValue(reducedMotion ? 1 : ENTER_SCALE);
    const anim = Animated.timing(scaleAnim, {
      toValue: 1,
      duration: reducedMotion ? DURATION_FAST : DURATION_BASE,
      easing: EASE_OUT,
      useNativeDriver: true,
    });
    anim.start();
    return () => anim.stop();
  }, [visible, reducedMotion, scaleAnim]);

  const resolvedType: DialogType = destructive ? 'danger' : type;
  const accent = TYPE_ACCENT[resolvedType];
  const BadgeIcon = TYPE_ICON[resolvedType];

  return (
    <Modal transparent visible={visible} animationType="fade" onRequestClose={onCancel}>
      <View style={[styles.overlay, { backgroundColor: theme.overlay }]}>
        <Animated.View
          style={[
            styles.card,
            { backgroundColor: theme.surface, borderColor: theme.border, transform: [{ scale: scaleAnim }] },
          ]}
        >
          {showIcon && (
            <LinearGradient
              colors={accent}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.badge}
            >
              {icon ?? <BadgeIcon size={scale(28)} color="#FFFFFF" strokeWidth={2.2} />}
            </LinearGradient>
          )}

          <Text style={[styles.title, { color: theme.text }]}>{title}</Text>
          <Text style={[styles.message, { color: theme.textSecondary }]}>{message}</Text>

          <View style={styles.actions}>
            <TouchableOpacity
              onPress={onCancel}
              accessibilityRole="button"
              accessibilityLabel={cancelText}
              activeOpacity={0.8}
              style={[styles.cancelBtn, { borderColor: theme.borderStrong }]}
            >
              <Text style={[styles.cancelText, { color: theme.text }]}>{cancelText}</Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={onConfirm}
              accessibilityRole="button"
              accessibilityLabel={confirmText}
              activeOpacity={0.85}
              style={styles.confirmBtn}
            >
              <LinearGradient
                colors={accent}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.confirmFill}
              >
                <Text style={styles.confirmText}>{confirmText}</Text>
              </LinearGradient>
            </TouchableOpacity>
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
    boxShadow: '0px 8px 20px rgba(0, 0, 0, 0.35)',
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
    flexDirection: 'row',
    gap: responsiveSpacing.sm,
  },
  cancelBtn: {
    flex: 1,
    minHeight: touchTargets.minimum,
    borderRadius: scale(14),
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: responsiveSpacing.md,
  },
  cancelText: {
    fontSize: fontScale(15),
    fontWeight: '600',
  },
  confirmBtn: {
    flex: 1,
    minHeight: touchTargets.minimum,
    borderRadius: scale(14),
    overflow: 'hidden',
  },
  confirmFill: {
    flex: 1,
    minHeight: touchTargets.minimum,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: responsiveSpacing.md,
  },
  confirmText: {
    color: '#FFFFFF',
    fontSize: fontScale(15),
    fontWeight: '700',
  },
});
