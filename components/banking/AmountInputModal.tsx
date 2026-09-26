import { uiPalette , getThemeColors, accent } from '@/lib/config/theme';
import React, { useState, useEffect } from 'react';
import { View, Text, Modal, TouchableOpacity, TextInput, StyleSheet, KeyboardAvoidingView, Platform } from 'react-native';
import { X } from 'lucide-react-native';
import { responsiveFontSize, responsiveSpacing, responsiveBorderRadius, scale, touchTargets } from '@/utils/scaling';
import { hitSlopToMinTarget, minTouchTargetStyle } from '@/utils/touchTargets';

import { getGlassCard, getPlatformShadows } from '@/utils/glassmorphismStyles';
import Gradient from '@/components/ui/Gradient';
import { parseAmount } from '@/utils/parseAmount';
import { useReducedMotion } from '@/hooks/useReducedMotion';

const LinearGradient = Gradient;

interface Props {
  visible: boolean;
  title: string;
  /** Helper text shown under the title, e.g. "From: Checking · Available $1,200". */
  subtitle?: string;
  /** Confirm button label. Default "Confirm". */
  confirmLabel?: string;
  /** Hard cap on the entered amount (e.g. account balance). Submit is disabled above this. */
  maxAmount?: number;
  /** Suggestions shown as quick chips. */
  presets?: number[];
  /** Allow confirming 0 (e.g. "enter 0 to clear a budget cap"). Default false. */
  allowZero?: boolean;
  /**
   * Unit the amount is denominated in. 'usd' (default) renders $-prefixed
   * presets and a floored Max; 'btc' renders ₿ amounts with decimals kept -
   * flooring a sub-1 BTC Max to 0 made the chip a no-op.
   */
  currency?: 'usd' | 'btc';
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
  allowZero = false,
  currency = 'usd',
  darkMode,
  onConfirm,
  onClose,
}: Props) {
  const isBtc = currency === 'btc';
  const unitPrefix = isBtc ? '₿' : '$';
  const formatAmount = (n: number) => `${unitPrefix}${n.toLocaleString('en-US', { maximumFractionDigits: 20 })}`;
  const theme = getThemeColors(darkMode);
  const [text, setText] = useState('');
  const reducedMotion = useReducedMotion();

  useEffect(() => {
    if (visible) setText('');
  }, [visible]);

  const amount = parseAmount(text);
  const valid = amount !== null && (allowZero ? amount >= 0 : amount > 0) && (maxAmount == null || amount <= maxAmount);

  return (
    <Modal visible={visible} transparent animationType={reducedMotion ? 'none' : 'fade'} onRequestClose={onClose}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.backdrop}
      >
        <TouchableOpacity
          style={styles.backdropTouch}
          activeOpacity={1}
          onPress={onClose}
          importantForAccessibility="no"
          accessibilityElementsHidden
        />
        <View style={[getGlassCard(darkMode, 12), styles.sheet, { backgroundColor: theme.surface, borderColor: theme.border, borderWidth: 1 }]}>
          <View style={styles.headerRow}>
            <Text style={[styles.title, { color: theme.text }]}>{title}</Text>
            <TouchableOpacity onPress={onClose} hitSlop={hitSlopToMinTarget(scale(20))} style={minTouchTargetStyle} accessibilityRole="button" accessibilityLabel="Close">
              <X size={scale(20)} color={theme.textSecondary} />
            </TouchableOpacity>
          </View>
          {subtitle && <Text style={[styles.subtitle, { color: theme.textMuted }]}>{subtitle}</Text>}

          <View style={[styles.inputWrap, { borderColor: valid || text === '' ? theme.border : accent.danger, backgroundColor: theme.surfaceElevated }]}>
            <Text style={[styles.currency, { color: theme.textSecondary }]}>{unitPrefix}</Text>
            <TextInput
              value={text}
              onChangeText={setText}
              keyboardType="decimal-pad"
              accessibilityLabel={`${title} amount in ${isBtc ? 'bitcoin' : 'dollars'}`}
              accessibilityHint="Use a period for decimals and optional commas for thousands."
              placeholder="0"
              placeholderTextColor={theme.textMuted}
              style={[styles.input, { color: theme.text }]}
              autoFocus
              returnKeyType="done"
              // R3-F: disable autocorrect / autocapitalize on money inputs -
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
                  accessibilityRole="button"
                  accessibilityLabel={`Set amount to ${formatAmount(p)}`}
                  onPress={() => setText(String(p))}
                  style={[styles.preset, { borderColor: theme.border, backgroundColor: theme.surfaceElevated }]}
                >
                  <Text style={[styles.presetText, { color: theme.text }]}>{isBtc ? `₿${p}` : `$${p.toLocaleString()}`}</Text>
                </TouchableOpacity>
              ))}
              {maxAmount != null && maxAmount > 0 && (
                <TouchableOpacity
                  accessibilityRole="button"
                  accessibilityLabel="Set maximum amount"
                  onPress={() => setText(isBtc ? String(Number(maxAmount.toFixed(6))) : String(Math.floor(maxAmount)))}
                  style={[styles.preset, { borderColor: theme.border, backgroundColor: theme.surfaceElevated }]}
                >
                  <Text style={[styles.presetText, { color: theme.text }]}>Max</Text>
                </TouchableOpacity>
              )}
            </View>
          )}

          {text.trim() !== '' && amount === null && (
            <Text accessibilityRole="alert" style={styles.error}>Enter a valid amount, such as 1,000.50.</Text>
          )}
          {maxAmount != null && amount !== null && amount > maxAmount && (
            <Text accessibilityRole="alert" style={styles.error}>Exceeds available {formatAmount(maxAmount)}</Text>
          )}

          <TouchableOpacity
            disabled={!valid}
            accessibilityRole="button"
            accessibilityLabel={valid ? `${confirmLabel} ${formatAmount(amount!)}` : confirmLabel}
            accessibilityState={{ disabled: !valid }}
            onPress={() => { if (valid && amount !== null) onConfirm(amount); }}
            activeOpacity={0.7}
            style={[styles.confirmWrap, valid && getPlatformShadows(5, 0.3, 2, 8)]}
          >
            <LinearGradient
              colors={valid ? [accent.info, uiPalette.blue] : [theme.surfaceElevated, theme.surfaceElevated]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={styles.confirm}
            >
              <Text style={[styles.confirmText, !valid && { color: theme.textMuted }]}>{valid && amount !== null ? `${confirmLabel} ${formatAmount(amount)}` : confirmLabel}</Text>
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
    minHeight: touchTargets.minimum,
    justifyContent: 'center',
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
