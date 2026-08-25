/**
 * BaseModal - Unified modal component
 *
 * Provides consistent styling, animation, and structure for all modals.
 * Replaces the 43+ individually-styled modals with a shared foundation.
 *
 * Usage:
 *   <BaseModal visible={show} onClose={close} title="Settings">
 *     <Text>Content here</Text>
 *   </BaseModal>
 *
 * Variants:
 *   - "center" (default): Centered dialog
 *   - "bottom": Bottom sheet style
 *   - "fullscreen": Full-screen overlay
 */

import React, { ReactNode } from 'react';
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ViewStyle,
  Dimensions,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { X } from 'lucide-react-native';
import { colors, typography, radii, shadows } from '@/lib/config/theme';
import { responsiveSpacing, scale } from '@/utils/scaling';
import { useTheme } from '@/hooks/useTheme';

/**
 * Spacing, mapped off the theme scale BY VALUE.
 *
 * `lib/config/theme.ts`'s `spacing` was a second, raw scale used by exactly one
 * file - this one. Raw means it never ran through `scale()`, so BaseModal was
 * the only shared chassis in the app whose padding did not grow with the
 * device: 16pt of padding inside chrome scaled to 1.8x on a tablet, roughly 45%
 * too tight, and worse the larger the screen.
 *
 * Mapped by VALUE, never by key - the two scales are offset by one step
 * (theme `lg` 16 === responsive `md` 16), so a key-for-key swap would have
 * inflated every value. Three of the five steps in use (2, 12, 20) have no
 * equivalent in the target scale and become explicit `scale()` calls rather
 * than being rounded onto the nearest token, which would have moved the layout
 * for no reason.
 */
const sp = {
  xxs: scale(2),                 // was raw 2
  sm: responsiveSpacing.sm,      // scale(8)  - was raw 8
  md: scale(12),                 // was raw 12, no token at this step
  lg: responsiveSpacing.md,      // scale(16) - was raw 16
  xl: scale(20),                 // was raw 20, no token at this step
} as const;

const { height: SCREEN_HEIGHT } = Dimensions.get('window');

type ModalVariant = 'center' | 'bottom' | 'fullscreen';

interface BaseModalProps {
  visible: boolean;
  onClose: () => void;
  title?: string;
  subtitle?: string;
  children: ReactNode;
  variant?: ModalVariant;
  /** Content in the footer area (below the scrollable body) */
  footer?: ReactNode;
  /** Disable the close (X) button */
  hideCloseButton?: boolean;
  /** Additional style for the container */
  containerStyle?: ViewStyle;
  /** Whether content should scroll (default true) */
  scrollable?: boolean;
  /** Max height as fraction of screen (default 0.85) */
  maxHeightFraction?: number;
  /** Test ID for testing */
  testID?: string;
}

export default function BaseModal({
  visible,
  onClose,
  title,
  subtitle,
  children,
  variant = 'center',
  footer,
  hideCloseButton = false,
  containerStyle,
  scrollable = true,
  maxHeightFraction = 0.85,
  testID,
}: BaseModalProps) {
  const insets = useSafeAreaInsets();
  // The colour half of the stylesheet is resolved per-render from the active
  // theme. It used to be baked into StyleSheet.create against `colors.dark.*`,
  // so every consumer (all six HUD breakdown modals) rendered slate-900 chrome
  // over a white app in light mode.
  const { theme, isDark } = useTheme();
  const themed = {
    overlay: { backgroundColor: isDark ? colors.dark.overlay : colors.light.overlay },
    container: { backgroundColor: theme.surface, borderColor: theme.border },
    header: { borderBottomColor: theme.border },
    title: { color: theme.text },
    subtitle: { color: theme.textSecondary },
    footer: { borderTopColor: theme.border },
    closeButton: {
      backgroundColor: isDark ? 'rgba(255, 255, 255, 0.08)' : 'rgba(15, 23, 42, 0.06)',
    },
  };

  const isFullscreen = variant === 'fullscreen';
  const isBottom = variant === 'bottom';

  const containerMaxHeight = isFullscreen
    ? undefined
    : SCREEN_HEIGHT * maxHeightFraction;

  return (
    <Modal
      transparent
      visible={visible}
      animationType={isBottom ? 'slide' : 'fade'}
      onRequestClose={onClose}
      testID={testID}
    >
      <KeyboardAvoidingView
        style={styles.keyboardView}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        {/* Overlay - tap to close. Hidden from screen readers: announcing a
            giant unlabeled button wrapping the whole dialog only adds noise -
            VoiceOver/TalkBack users dismiss via the labelled Close button. */}
        <TouchableOpacity
          activeOpacity={1}
          accessible={false}
          importantForAccessibility="no"
          style={[
            styles.overlay,
            themed.overlay,
            isBottom && styles.overlayBottom,
            isFullscreen && styles.overlayFullscreen,
          ]}
          onPress={onClose}
        >
          {/* Container - stop propagation. accessibilityViewIsModal keeps
              VoiceOver from wandering to content behind the dialog. */}
          <TouchableOpacity
            activeOpacity={1}
            accessible={false}
            accessibilityViewIsModal
            style={[
              styles.container,
              themed.container,
              isBottom && [
                styles.containerBottom,
                { paddingBottom: insets.bottom + sp.lg },
              ],
              isFullscreen && [
                styles.containerFullscreen,
                {
                  paddingTop: insets.top + sp.sm,
                  paddingBottom: insets.bottom + sp.sm,
                },
              ],
              !isFullscreen && { maxHeight: containerMaxHeight },
              containerStyle,
            ]}
            onPress={() => {}} // prevent overlay close
          >
            {/* Header */}
            {(title || !hideCloseButton) && (
              <View style={[styles.header, themed.header]}>
                <View style={styles.headerText}>
                  {title && (
                    <Text
                      style={[styles.title, themed.title]}
                      numberOfLines={1}
                      maxFontSizeMultiplier={1.4}
                    >
                      {title}
                    </Text>
                  )}
                  {subtitle && (
                    <Text
                      style={[styles.subtitle, themed.subtitle]}
                      numberOfLines={1}
                      maxFontSizeMultiplier={1.4}
                    >
                      {subtitle}
                    </Text>
                  )}
                </View>
                {!hideCloseButton && (
                  <TouchableOpacity
                    onPress={onClose}
                    style={[styles.closeButton, themed.closeButton]}
                    hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
                    accessibilityRole="button"
                    accessibilityLabel="Close"
                    accessibilityHint="Closes this dialog"
                  >
                    <X size={20} color={theme.textSecondary} />
                  </TouchableOpacity>
                )}
              </View>
            )}

            {/* Body */}
            {scrollable ? (
              <ScrollView
                style={styles.body}
                contentContainerStyle={styles.bodyContent}
                showsVerticalScrollIndicator={false}
                keyboardShouldPersistTaps="handled"
              >
                {children}
              </ScrollView>
            ) : (
              <View style={[styles.body, styles.bodyContent]}>{children}</View>
            )}

            {/* Footer */}
            {footer && <View style={[styles.footer, themed.footer]}>{footer}</View>}
          </TouchableOpacity>
        </TouchableOpacity>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  keyboardView: {
    flex: 1,
  },

  // Overlay
  // NOTE: every colour below is supplied at render time by `themed` in the
  // component body. Do not reintroduce `colors.dark.*` here - a static value
  // wins over nothing and silently breaks light mode again.
  overlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: sp.lg,
  },
  overlayBottom: {
    justifyContent: 'flex-end',
    padding: 0,
  },
  overlayFullscreen: {
    padding: 0,
  },

  // Container
  container: {
    width: '100%',
    maxWidth: 460,
    borderRadius: radii.xl,
    borderWidth: 1,
    overflow: 'hidden',
    ...shadows.xl,
  },
  containerBottom: {
    maxWidth: '100%',
    borderBottomLeftRadius: 0,
    borderBottomRightRadius: 0,
    borderTopLeftRadius: radii.xxl,
    borderTopRightRadius: radii.xxl,
  },
  containerFullscreen: {
    flex: 1,
    maxWidth: '100%',
    borderRadius: 0,
  },

  // Header
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: sp.xl,
    paddingTop: sp.lg,
    paddingBottom: sp.md,
    borderBottomWidth: 1,
  },
  headerText: {
    flex: 1,
    marginRight: sp.md,
  },
  title: {
    fontSize: typography.size.xl,
    fontWeight: typography.weight.bold,
  },
  subtitle: {
    fontSize: typography.size.sm,
    marginTop: sp.xxs,
  },
  closeButton: {
    width: 32,
    height: 32,
    borderRadius: radii.round,
    alignItems: 'center',
    justifyContent: 'center',
  },

  // Body
  body: {
    flexShrink: 1,
  },
  bodyContent: {
    padding: sp.xl,
  },

  // Footer
  footer: {
    paddingHorizontal: sp.xl,
    paddingVertical: sp.lg,
    borderTopWidth: 1,
  },
});
