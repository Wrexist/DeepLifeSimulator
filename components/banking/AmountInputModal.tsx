import React, { useState, useEffect } from 'react';
import { View, Text, Modal, TouchableOpacity, TextInput, StyleSheet, KeyboardAvoidingView, Platform } from 'react-native';
import { X } from 'lucide-react-native';
import { responsiveFontSize, responsiveSpacing, responsiveBorderRadius, scale, touchTargets } from '@/utils/scaling';
import { getThemeColors, accent } from '@/lib/config/theme';
import { getGlassCard, getPlatformShadows } from '@/utils/glassmorphismStyles';
import LinearGradientFallback from '@/components/fallbacks/LinearGradientFallback';

const LinearGradient = LinearGradientFallback;

interface Props {
  visible: boolean;
  title: string;
  /** Helper text shown under the title, e.g. "From: Checking Â· Available $1,200". */
  subtitle?: string;
  /** Confirm button label. Default "Confirm". */
  confirmLabel?: string;
  /** Hard cap on the entered amount (e.g. account balance). Submit is disabled above this. */
  maxAmount?: number;
  /** Suggestions shown as quick chips. */
  presets?: number[];
  darkMode: boolean;
  onConfirm: (amount: number) => void;
  onClose: () => void;
}

export default function AmountInputModal({
  visible,
  title,
  subtitle,
  confirmLabel = 'Confirm',
  maxAmount,
  presets,
  darkMode,
  onConfirm,
  onClose,
}: Props) {
  const theme = getThemeColors(darkMode);
  const [text, setText] = useState('');

  useEffect(() => {
    if (visible) setText('');
  }, [visible]);

  const amount = parseFloat(text) || 0;
  const valid = amount > 0 && (maxAmount == null || amount <= maxAmount);

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.backdrop}
      >
        <TouchableOpacity style={styles.backdropTouch} activeOpacity={1} onPress={onClose} />
        <View style={[getGlassCard(darkMode, 12), styles.sheet, { backgroundColor: theme.surface, borderColor: theme.border, borderWidth: 1 }]}>
          <View style={styles.headerRow}>
            <Text style={[styles.title, { color: theme.text }]}>{title}</Text>
            <TouchableOpacity onPress={onClose} hitSlop={10}>
              <X size={scale(20)} color={theme.textSecondary} />
            </TouchableOpacity>
          </View>
          {subtitle && <Text style={[styles.subtitle, { color: theme.textMuted }]}>{subtitle}</Text>}

          <View style={[styles.inputWrap, { borderColor: valid ? theme.border : accent.danger, backgroundColor: theme.surfaceElevated }]}>
            <Text style={[styles.currency, { color: theme.textSecondary }]}>$</Text>
            <TextInput
              value={text}
              onChangeText={setText}
              keyboardType="decimal-pad"
              placeholder="0"
              placeholderTextColor={theme.textMuted}
              style={[styles.input, { color: theme.text }]}
              autoFocus
              returnKeyType="done"
              // R3-F: disable autocorrect / autocapitalize on money inputs —
              // Samsung One UI shows the autocorrect bar above the keyboard
              // even for decimal-pad, pushing the Confirm button off-screen
              // on small devices.
              autoCorrect={false}
              autoCapitalize="none"
              spellCheck={false}
            />
          </View>

          {presets && presets.length > 0 && (
            <View style={styles.presets}>
              {presets.map((p) => (
                <TouchableOpacity
                  key={p}
                  onPress={() => setText(String(p))}
                  style={[styles.preset, { borderColor: theme.border, backgroundColor: theme.surfaceElevated }]}
                >
                  <Text style={[styles.presetText, { color: theme.text }]}>${p.toLocaleString()}</Text>
                </TouchableOpacity>
              ))}
              {maxAmount != null && maxAmount > 0 && (
                <TouchableOpacity
                  onPress={() => setText(String(Math.floor(maxAmount)))}
                  style={[styles.preset, { borderColor: theme.border, backgroundColor: theme.surfaceElevated }]}
                >
                  <Text style={[styles.presetText, { color: theme.text }]}>Max</Text>
                </TouchableOpacity>
              )}
            </View>
          )}

          {maxAmount != null && amount > maxAmount && (
            <Text style={styles.error}>Exceeds available ${maxAmount.toLocaleString()}</Text>
          )}

          <TouchableOpacity
            disabled={!valid}
            onPress={() => onConfirm(amount)}
            activeOpacity={0.7}
            style={[styles.confirmWrap, valid && getPlatformShadows(5, 0.3, 2, 8)]}
          >
            <LinearGradient
              colors={valid ? [accent.info, '#60a5fa'] : [theme.surfaceElevated, theme.surfaceElevated]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={styles.confirm}
            >
              <Text style={[styles.confirmText, !valid && { color: theme.textMuted }]}>{confirmLabel}</Text>
            </LinearGradient>
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    padding: responsiveSpacing.lg,
  },
  backdropTouch: {
    ...StyleSheet.absoluteFillObject,
  },
  sheet: {
    borderRadius: responsiveBorderRadius.xl,
    borderWidth: 1,
    padding: responsiveSpacing.lg,
    gap: responsiveSpacing.md,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  title: {
    fontSize: responsiveFontSize.lg,
    fontWeight: '700',
  },
  subtitle: {
    fontSize: responsiveFontSize.sm,
  },
  inputWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: responsiveBorderRadius.lg,
    paddingHorizontal: responsiveSpacing.md,
  },
  currency: {
    fontSize: responsiveFontSize.xl,
    fontWeight: '700',
  },
  input: {
    flex: 1,
    fontSize: responsiveFontSize['2xl'],
    fontWeight: '700',
    paddingVertical: responsiveSpacing.md,
    paddingLeft: responsiveSpacing.xs,
  },
  presets: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: responsiveSpacing.xs,
  },
  preset: {
    paddingHorizontal: responsiveSpacing.md,
    paddingVertical: responsiveSpacing.xs,
    borderRadius: responsiveBorderRadius.full,
    borderWidth: 1,
  },
  presetText: {
    fontSize: responsiveFontSize.sm,
    fontWeight: '600',
  },
  error: {
    fontSize: responsiveFontSize.sm,
    color: accent.danger,
  },
  confirmWrap: {
    borderRadius: responsiveBorderRadius.full,
  },
  confirm: {
    paddingVertical: responsiveSpacing.md,
    borderRadius: responsiveBorderRadius.full,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: touchTargets.minimum,
  },
  confirmText: {
    color: 'white',
    fontSize: responsiveFontSize.md,
    fontWeight: '700',
  },
});
