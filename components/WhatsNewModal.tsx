import React, { useEffect, useRef } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
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
 * "What's New" update log. A clean, player-friendly changelog popup opened from
 * the Main Menu (top-right button) and Settings.
 *
 * Uses a plain <Modal> so it works BOTH at the root (Main Menu) and NESTED
 * inside the already-presented Settings Modal — the same iOS-safe nesting
 * RedeemCodeModal/DevToolsModal rely on (never a sibling root Modal on iOS).
 *
 * The card is anchored to the top and animates out of the top-right corner
 * (where the Main Menu button lives) so it reads as popping from that button.
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

  const handleClose = () => {
    haptic.light();
    onClose();
  };

  // Entrance: fade + a small scale/translate originating from the top-right.
  const opacity = progress;
  const scale = progress.interpolate({ inputRange: [0, 1], outputRange: [0.94, 1] });
  const translateY = progress.interpolate({ inputRange: [0, 1], outputRange: [-14, 0] });
  const translateX = progress.interpolate({ inputRange: [0, 1], outputRange: [16, 0] });

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <TouchableOpacity
        style={styles.overlay}
        activeOpacity={1}
        onPress={handleClose}
        accessibilityRole="button"
        accessibilityLabel="Close What's New"
      >
        <Animated.View
          style={[
            styles.cardWrap,
            { marginTop: insets.top + 12, opacity, transform: [{ translateX }, { translateY }, { scale }] },
          ]}
        >
          {/* Stop taps on the card from bubbling to the dismiss overlay. */}
          <TouchableOpacity activeOpacity={1} style={styles.card} onPress={() => {}}>
            {/* Header */}
            <View style={styles.header}>
              <View style={styles.titleRow}>
                <View style={styles.iconChip}>
                  <Megaphone size={18} color="#60A5FA" />
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
                <X size={18} color="#F9FAFB" />
              </TouchableOpacity>
            </View>

            <ScrollView
              style={styles.scroll}
              contentContainerStyle={styles.scrollContent}
              showsVerticalScrollIndicator={false}
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
                            <TagIcon size={11} color={meta.color} />
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
          </TouchableOpacity>
        </Animated.View>
      </TouchableOpacity>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'flex-start',
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    paddingHorizontal: 18,
  },
  cardWrap: {
    width: '100%',
    maxWidth: 460,
  },
  card: {
    width: '100%',
    maxHeight: '82%',
    backgroundColor: '#1E293B',
    borderRadius: 22,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    paddingTop: 18,
    paddingBottom: 8,
    paddingHorizontal: 18,
    overflow: 'hidden',
    // Soft lift so the popup reads as floating above the menu.
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.4,
    shadowRadius: 24,
    elevation: 16,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 14,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
  },
  headerTextWrap: {
    flex: 1,
  },
  eyebrow: {
    color: '#60A5FA',
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 1.5,
    marginBottom: 2,
  },
  iconChip: {
    width: 40,
    height: 40,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(96, 165, 250, 0.13)',
    borderWidth: 1,
    borderColor: 'rgba(96, 165, 250, 0.33)',
  },
  title: {
    fontSize: 18,
    fontWeight: '800',
    color: '#F9FAFB',
  },
  subtitle: {
    fontSize: 12,
    fontWeight: '500',
    color: '#94A3B8',
    marginTop: 1,
  },
  closeButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(148, 163, 184, 0.15)',
  },
  scroll: {
    flexGrow: 0,
  },
  scrollContent: {
    paddingBottom: 8,
  },
  versionBlock: {
    paddingTop: 4,
  },
  versionBlockDivider: {
    marginTop: 18,
    paddingTop: 18,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: 'rgba(255, 255, 255, 0.08)',
  },
  verbar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 6,
  },
  versionText: {
    fontSize: 16,
    fontWeight: '800',
    color: '#F8FAFC',
  },
  latestChip: {
    backgroundColor: 'rgba(52, 211, 153, 0.16)',
    borderColor: 'rgba(52, 211, 153, 0.4)',
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  latestChipText: {
    color: '#6EE7B7',
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  verbarSpacer: {
    flex: 1,
  },
  versionDate: {
    fontSize: 12,
    fontWeight: '600',
    color: '#64748B',
  },
  headline: {
    fontSize: 16,
    fontWeight: '800',
    lineHeight: 21,
    color: '#F8FAFC',
    marginBottom: 4,
  },
  summary: {
    fontSize: 13,
    lineHeight: 18,
    color: '#94A3B8',
    marginBottom: 14,
  },
  changeRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    marginBottom: 12,
  },
  tag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 4,
    marginTop: 1,
    minWidth: 78,
    justifyContent: 'center',
  },
  tagText: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.4,
  },
  changeTextWrap: {
    flex: 1,
  },
  changeTitle: {
    fontSize: 14.5,
    fontWeight: '700',
    color: '#F1F5F9',
    marginBottom: 2,
  },
  changeDescription: {
    fontSize: 13,
    lineHeight: 18,
    color: '#94A3B8',
  },
  footer: {
    textAlign: 'center',
    color: '#64748B',
    fontSize: 12,
    fontWeight: '600',
    marginTop: 10,
    marginBottom: 6,
  },
});

export default React.memo(WhatsNewModal);
