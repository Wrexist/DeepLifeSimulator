/**
 * BaseModal — Unified modal component
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
import { colors, spacing, typography, radii, shadows } from '@/lib/config/theme';

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
        {/* Overlay — tap to close */}
        <TouchableOpacity
          activeOpacity={1}
          style={[
            styles.overlay,
            isBottom && styles.overlayBottom,
            isFullscreen && styles.overlayFullscreen,
          ]}
          onPress={onClose}
        >
          {/* Container — stop propagation */}
          <TouchableOpacity
            activeOpacity={1}
            style={[
              styles.container,
              isBottom && [
                styles.containerBottom,
                { paddingBottom: insets.bottom + spacing.lg },
              ],
              isFullscreen && [
                styles.containerFullscreen,
                {
                  paddingTop: insets.top + spacing.sm,
                  paddingBottom: insets.bottom + spacing.sm,
                },
              ],
              !isFullscreen && { maxHeight: containerMaxHeight },
              containerStyle,
            ]}
            onPress={() => {}} // prevent overlay close
          >
            {/* Header */}
            {(title || !hideCloseButton) && (
              <View style={styles.header}>
                <View style={styles.headerText}>
                  {title && (
                    <Text style={styles.title} numberOfLines={1}>
                      {title}
                    </Text>
                  )}
                  {subtitle && (
                    <Text style={styles.subtitle} numberOfLines={1}>
                      {subtitle}
                    </Text>
                  )}
                </View>
                {!hideCloseButton && (
                  <TouchableOpacity
                    onPress={onClose}
                    style={styles.closeButton}
                    hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
                  >
                    <X size={20} color={colors.dark.textSecondary} />
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
            {footer && <View style={styles.footer}>{footer}</View>}
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
  overlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.dark.overlay,
    padding: spacing.lg,
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
    backgroundColor: colors.palette.dark800,
    borderRadius: radii.xl,
    borderWidth: 1,
    borderColor: colors.dark.border,
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
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.lg,
    paddingBottom: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.dark.border,
  },
  headerText: {
    flex: 1,
    marginRight: spacing.md,
  },
  title: {
    fontSize: typography.size.xl,
    fontWeight: typography.weight.bold,
    color: colors.dark.text,
  },
  subtitle: {
    fontSize: typography.size.sm,
    color: colors.dark.textSecondary,
    marginTop: spacing.xxs,
  },
  closeButton: {
    width: 32,
    height: 32,
    borderRadius: radii.round,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    alignItems: 'center',
    justifyContent: 'center',
  },

  // Body
  body: {
    flexShrink: 1,
  },
  bodyContent: {
    padding: spacing.xl,
  },

  // Footer
  footer: {
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.lg,
    borderTopWidth: 1,
    borderTopColor: colors.dark.border,
  },
});
