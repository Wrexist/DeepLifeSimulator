import React, { useCallback, useEffect, useRef } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  Pressable,
  Modal,
  ScrollView,
  StyleSheet,
  Animated,
  Easing,
} from 'react-native';
import { Megaphone, X, Sparkles, TrendingUp, Wrench } from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { CHANGELOG, LATEST_VERSION, type ChangeCategory } from '@/lib/config/changelog';
import { markWhatsNewSeen } from '@/utils/whatsNewSeen';
import { haptic } from '@/utils/haptics';
import { scale, fontScale } from '@/utils/scaling';

interface WhatsNewModalProps {
  visible: boolean;
  onClose: () => void;
}

// Per-category styling for the little tag next to each change line.
const CATEGORY: Record<
  ChangeCategory,
  { label: string; color: string; tint: string; icon: React.ComponentType<{ size?: number; color?: string }> }
> = {
  new: { label: 'NEW', color: '#34D399', tint: 'rgba(52, 211, 153, 0.14)', icon: Sparkles },
  improved: { label: 'IMPROVED', color: '#60A5FA', tint: 'rgba(96, 165, 250, 0.14)', icon: TrendingUp },
  fixed: { label: 'FIXED', color: '#FBBF24', tint: 'rgba(251, 191, 36, 0.14)', icon: Wrench },
};

/**
 * "What's New" NEWS & UPDATES feed. A clean, player-friendly changelog popup
 * opened from the Main Menu (top-right button) and Settings.
 *
 * Uses a plain <Modal> so it works BOTH at the root (Main Menu) and NESTED
 * inside the already-presented Settings Modal — the same iOS-safe nesting
 * RedeemCodeModal/DevToolsModal rely on (never a sibling root Modal on iOS).
 *
 * Layout: a tall sheet that fills the screen between the safe-area insets, with
 * a fixed header and a scrolling body. Tap-to-dismiss lives on a backdrop
 * BEHIND the sheet so the ScrollView keeps its gestures (a ScrollView wrapped
 * in a Touchable loses scrolling to the touchable's press responder).
 */
function WhatsNewModal({ visible, onClose }: WhatsNewModalProps) {
  const insets = useSafeAreaInsets();
  const progress = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (!visible) return;
    // Opening the log counts as "seen" — clears the Main Menu NEW badge.
    void markWhatsNewSeen();
    progress.setValue(0);
    const animation = Animated.timing(progress, {
      toValue: 1,
      duration: 220,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    });
    animation.start();
    return () => animation.stop();
  }, [visible, progress]);

  const handleClose = useCallback(() => {
    haptic.light();
    onClose();
  }, [onClose]);

  // Entrance: fade + a small rise/scale so the sheet settles into place.
  const opacity = progress;
  const scaleAnim = progress.interpolate({ inputRange: [0, 1], outputRange: [0.97, 1] });
  const translateY = progress.interpolate({ inputRange: [0, 1], outputRange: [scale(12), 0] });

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.overlay}>
        {/* Dismiss backdrop — sits BEHIND the sheet so taps outside close the
            popup while the ScrollView inside keeps full gesture control. */}
        <Pressable
          style={StyleSheet.absoluteFill}
          onPress={handleClose}
          accessibilityRole="button"
          accessibilityLabel="Close What's New"
        />
        <Animated.View
          style={[
            styles.cardWrap,
            {
              marginTop: insets.top + scale(10),
              marginBottom: insets.bottom + scale(10),
              opacity,
              transform: [{ translateY }, { scale: scaleAnim }],
            },
          ]}
        >
          <View style={styles.card}>
            {/* Header (fixed) */}
            <View style={styles.header}>
              <View style={styles.titleRow}>
                <View style={styles.iconChip}>
                  <Megaphone size={scale(18)} color="#60A5FA" />
                </View>
                <View style={styles.headerTextWrap}>
                  <Text style={styles.eyebrow}>NEWS &amp; UPDATES</Text>
                  <Text style={styles.title}>What's New</Text>
                  <Text style={styles.subtitle}>The latest features, fixes &amp; improvements</Text>
                </View>
              </View>
              <TouchableOpacity
                onPress={handleClose}
                style={styles.closeButton}
                accessibilityRole="button"
                accessibilityLabel="Close"
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                testID="whats-new-close"
              >
                <X size={scale(18)} color="#F9FAFB" />
              </TouchableOpacity>
            </View>

            {/* Scrolling body (fills the rest of the sheet) */}
            <ScrollView
              style={styles.scroll}
              contentContainerStyle={styles.scrollContent}
              showsVerticalScrollIndicator
            >
              {CHANGELOG.map((entry, entryIndex) => {
                const isLatest = entry.version === LATEST_VERSION;
                return (
                  <View
                    key={entry.version}
                    style={[styles.versionBlock, entryIndex > 0 && styles.versionBlockDivider]}
                  >
                    <View style={styles.verbar}>
                      <Text style={styles.versionText}>v{entry.version}</Text>
                      {isLatest ? (
                        <View style={styles.latestChip}>
                          <Text style={styles.latestChipText}>LATEST</Text>
                        </View>
                      ) : null}
                      <View style={styles.verbarSpacer} />
                      <Text style={styles.versionDate}>{entry.date}</Text>
                    </View>

                    {entry.headline ? <Text style={styles.headline}>{entry.headline}</Text> : null}
                    {entry.summary ? <Text style={styles.summary}>{entry.summary}</Text> : null}

                    {entry.changes.map((change, changeIndex) => {
                      const meta = CATEGORY[change.category];
                      const TagIcon = meta.icon;
                      return (
                        <View key={changeIndex} style={styles.changeRow}>
                          <View style={[styles.tag, { backgroundColor: meta.tint }]}>
                            <TagIcon size={scale(11)} color={meta.color} />
                            <Text style={[styles.tagText, { color: meta.color }]}>{meta.label}</Text>
                          </View>
                          <View style={styles.changeTextWrap}>
                            <Text style={styles.changeTitle}>{change.title}</Text>
                            <Text style={styles.changeDescription}>{change.description}</Text>
                          </View>
                        </View>
                      );
                    })}
                  </View>
                );
              })}

              <Text style={styles.footer}>Thanks for playing DeepLife 💙</Text>
            </ScrollView>
          </View>
        </Animated.View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    paddingHorizontal: scale(16),
  },
  // Fills the vertical space between the safe-area insets (margins applied
  // inline) so the sheet is a tall, screen-filling panel rather than a small
  // floating card. flex:1 gives the ScrollView a definite height to scroll in.
  cardWrap: {
    width: '100%',
    maxWidth: scale(520),
    flex: 1,
  },
  card: {
    flex: 1,
    backgroundColor: '#1E293B',
    borderRadius: scale(22),
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    paddingTop: scale(18),
    paddingHorizontal: scale(18),
    overflow: 'hidden',
    // Soft lift so the popup reads as floating above the menu.
    shadowColor: '#000',
    shadowOffset: { width: 0, height: scale(12) },
    shadowOpacity: 0.4,
    shadowRadius: scale(24),
    elevation: 16,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingBottom: scale(14),
    marginBottom: scale(4),
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(255, 255, 255, 0.08)',
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: scale(12),
    flex: 1,
  },
  headerTextWrap: {
    flex: 1,
  },
  eyebrow: {
    color: '#60A5FA',
    fontSize: fontScale(10),
    fontWeight: '800',
    letterSpacing: scale(1.5),
    marginBottom: scale(2),
  },
  iconChip: {
    width: scale(40),
    height: scale(40),
    borderRadius: scale(14),
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(96, 165, 250, 0.13)',
    borderWidth: 1,
    borderColor: 'rgba(96, 165, 250, 0.33)',
  },
  title: {
    fontSize: fontScale(18),
    fontWeight: '800',
    color: '#F9FAFB',
  },
  subtitle: {
    fontSize: fontScale(12),
    fontWeight: '500',
    color: '#94A3B8',
    marginTop: scale(1),
  },
  closeButton: {
    width: scale(36),
    height: scale(36),
    borderRadius: scale(18),
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(148, 163, 184, 0.15)',
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingTop: scale(14),
    paddingBottom: scale(20),
  },
  versionBlock: {
    paddingTop: scale(4),
  },
  versionBlockDivider: {
    marginTop: scale(18),
    paddingTop: scale(18),
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: 'rgba(255, 255, 255, 0.08)',
  },
  verbar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: scale(8),
    marginBottom: scale(6),
  },
  versionText: {
    fontSize: fontScale(16),
    fontWeight: '800',
    color: '#F8FAFC',
  },
  latestChip: {
    backgroundColor: 'rgba(52, 211, 153, 0.16)',
    borderColor: 'rgba(52, 211, 153, 0.4)',
    borderWidth: 1,
    borderRadius: scale(8),
    paddingHorizontal: scale(8),
    paddingVertical: scale(2),
  },
  latestChipText: {
    color: '#6EE7B7',
    fontSize: fontScale(10),
    fontWeight: '800',
    letterSpacing: scale(0.5),
  },
  verbarSpacer: {
    flex: 1,
  },
  versionDate: {
    fontSize: fontScale(12),
    fontWeight: '600',
    color: '#64748B',
  },
  headline: {
    fontSize: fontScale(16),
    fontWeight: '800',
    lineHeight: fontScale(21),
    color: '#F8FAFC',
    marginBottom: scale(4),
  },
  summary: {
    fontSize: fontScale(13),
    lineHeight: fontScale(18),
    color: '#94A3B8',
    marginBottom: scale(14),
  },
  changeRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: scale(10),
    marginBottom: scale(12),
  },
  tag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: scale(4),
    borderRadius: scale(8),
    paddingHorizontal: scale(8),
    paddingVertical: scale(4),
    marginTop: scale(1),
    minWidth: scale(78),
    justifyContent: 'center',
  },
  tagText: {
    fontSize: fontScale(10),
    fontWeight: '800',
    letterSpacing: scale(0.4),
  },
  changeTextWrap: {
    flex: 1,
  },
  changeTitle: {
    fontSize: fontScale(14.5),
    fontWeight: '700',
    color: '#F1F5F9',
    marginBottom: scale(2),
  },
  changeDescription: {
    fontSize: fontScale(13),
    lineHeight: fontScale(18),
    color: '#94A3B8',
  },
  footer: {
    textAlign: 'center',
    color: '#64748B',
    fontSize: fontScale(12),
    fontWeight: '600',
    marginTop: scale(14),
    marginBottom: scale(4),
  },
});

export default React.memo(WhatsNewModal);
