import React, { useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Modal, ScrollView } from 'react-native';
import Gradient from '@/components/ui/Gradient';
import { X, CheckCircle, Check } from 'lucide-react-native';
import { useGame } from '@/contexts/game';
import { safeSettings } from '@/utils/safeGameState';
import { useFeedback } from '@/utils/feedbackSystem';
import BlurViewFallback from '@/components/fallbacks/BlurViewFallback';
import { getPlatformShadows } from '@/utils/glassmorphismStyles';
import { fontScale, responsiveBorderRadius, responsiveSpacing, scale, verticalScale } from '@/utils/scaling';

const LinearGradient = Gradient;

// Success accent - the whole card means "cured", so it's always green.
const ACCENT = '#34D399';
const ACCENT_DEEP = '#059669';

export default function CureSuccessModal() {
  const { gameState, dismissCureSuccessModal } = useGame();
  // curedDiseases is not backfilled by repairGameState, and its `.length` is read
  // in the effect dependency array below (unconditionally, every render) - default
  // it here so an old/partial save with curedDiseases === undefined can't crash.
  const { showCureSuccessModal, week } = gameState;
  const curedDiseases = gameState.curedDiseases || [];
  const { buttonPress, haptic } = useFeedback();

  // Only show modal when in an active game (week > 0 indicates active game)
  const isInActiveGame = week > 0;

  // Auto-dismiss the modal after 8 seconds
  useEffect(() => {
    if (isInActiveGame && showCureSuccessModal && curedDiseases.length > 0) {
      const timer = setTimeout(() => {
        dismissCureSuccessModal();
      }, 8000); // 8 seconds

      return () => clearTimeout(timer);
    }
    return;
  }, [isInActiveGame, showCureSuccessModal, curedDiseases.length, dismissCureSuccessModal]);

  // Don't render if not in active game or if conditions aren't met
  if (!isInActiveGame || !showCureSuccessModal || curedDiseases.length === 0) {
    return null;
  }

  const count = curedDiseases.length;
  const dismiss = () => {
    buttonPress();
    haptic('success');
    dismissCureSuccessModal();
  };

  return (
    <Modal visible={showCureSuccessModal} transparent animationType="fade" onRequestClose={dismissCureSuccessModal}>
      <View style={styles.overlay}>
        <BlurViewFallback intensity={34} tint="dark" style={styles.card}>
          {/* Soft green glow from the top edge + thin glass highlight. */}
          <View style={styles.accentGlow} pointerEvents="none" />
          <View style={styles.topHighlight} pointerEvents="none" />

          <TouchableOpacity
            onPress={dismiss}
            style={styles.close}
            activeOpacity={0.7}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            accessibilityRole="button"
            accessibilityLabel="Dismiss"
          >
            <X size={scale(18)} color="rgba(226, 232, 240, 0.75)" />
          </TouchableOpacity>

          {/* Header (fixed) */}
          <View style={styles.header}>
            <View style={styles.iconChip}>
              <CheckCircle size={scale(26)} color={ACCENT} />
            </View>
            <Text style={styles.title}>Treatment Successful!</Text>
            <Text style={styles.subtitle}>
              {count > 1 ? 'Your conditions have been cured.' : 'Your condition has been cured.'}
            </Text>
          </View>

          {/* Cured list (scrolls only if it ever gets long - the button below
              stays put and can never be overlapped). */}
          <ScrollView
            style={styles.scroll}
            contentContainerStyle={styles.scrollContent}
            showsVerticalScrollIndicator={false}
            bounces={false}
          >
            <View style={styles.panel}>
              <Text style={styles.panelTitle}>{count > 1 ? `Cured · ${count}` : 'Cured'}</Text>
              {curedDiseases.map((diseaseName, index) => (
                <View key={index} style={styles.curedItem}>
                  <Check size={scale(16)} color={ACCENT} strokeWidth={3} />
                  <Text style={styles.curedText}>{diseaseName}</Text>
                </View>
              ))}
            </View>
            <Text style={styles.note}>
              The health, energy and happiness penalties from these are gone.
            </Text>
          </ScrollView>

          {/* Action (fixed) */}
          <TouchableOpacity style={styles.button} onPress={dismiss} activeOpacity={0.85} accessibilityRole="button" accessibilityLabel="Great">
            <LinearGradient
              colors={['#10B981', ACCENT_DEEP]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.buttonInner}
            >
              <Text style={styles.buttonText}>Great!</Text>
            </LinearGradient>
          </TouchableOpacity>
        </BlurViewFallback>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(2, 6, 23, 0.7)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: responsiveSpacing.md,
  },
  card: {
    width: '100%',
    maxWidth: scale(380),
    maxHeight: '82%',
    borderRadius: responsiveBorderRadius['2xl'],
    borderWidth: 1,
    borderColor: `${ACCENT}59`,
    overflow: 'hidden',
    // Frosted dark body (blur is faked app-wide for crash-safety), same family
    // as the weekly-event card.
    backgroundColor: 'rgba(17, 24, 39, 0.94)',
    padding: responsiveSpacing.lg,
    ...getPlatformShadows(16, 0.35, 12, 28),
    shadowColor: ACCENT,
    elevation: 16,
  },
  accentGlow: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: verticalScale(104),
    backgroundColor: `${ACCENT_DEEP}1F`,
  },
  topHighlight: {
    position: 'absolute',
    top: 0,
    left: scale(20),
    right: scale(20),
    height: StyleSheet.hairlineWidth,
    backgroundColor: 'rgba(255, 255, 255, 0.25)',
  },
  close: {
    position: 'absolute',
    top: scale(12),
    right: scale(12),
    zIndex: 10,
    width: scale(30),
    height: scale(30),
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: scale(15),
    backgroundColor: 'rgba(148, 163, 184, 0.14)',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255, 255, 255, 0.12)',
  },
  header: {
    alignItems: 'center',
    paddingTop: verticalScale(6),
    marginBottom: verticalScale(16),
  },
  iconChip: {
    width: scale(52),
    height: scale(52),
    borderRadius: scale(26),
    backgroundColor: `${ACCENT}1F`,
    borderWidth: 1,
    borderColor: `${ACCENT}55`,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: verticalScale(12),
  },
  title: {
    fontSize: fontScale(21),
    fontWeight: '800',
    color: '#F8FAFC',
    textAlign: 'center',
    letterSpacing: -0.3,
  },
  subtitle: {
    fontSize: fontScale(14),
    color: 'rgba(226, 232, 240, 0.7)',
    textAlign: 'center',
    marginTop: verticalScale(4),
  },
  scroll: {
    flexShrink: 1,
  },
  scrollContent: {
    paddingBottom: verticalScale(2),
  },
  panel: {
    backgroundColor: 'rgba(15, 23, 42, 0.55)',
    borderRadius: responsiveBorderRadius.lg,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: `${ACCENT}3D`,
    padding: responsiveSpacing.md,
  },
  panelTitle: {
    fontSize: fontScale(12),
    fontWeight: '700',
    letterSpacing: 0.6,
    textTransform: 'uppercase',
    color: `${ACCENT}`,
    marginBottom: verticalScale(10),
  },
  curedItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: scale(9),
    paddingVertical: verticalScale(4),
  },
  curedText: {
    fontSize: fontScale(15),
    fontWeight: '600',
    color: '#F1F5F9',
    flexShrink: 1,
  },
  note: {
    fontSize: fontScale(12.5),
    color: 'rgba(148, 163, 184, 0.9)',
    lineHeight: fontScale(18),
    textAlign: 'center',
    marginTop: verticalScale(12),
    paddingHorizontal: scale(4),
  },
  button: {
    borderRadius: responsiveBorderRadius.lg,
    overflow: 'hidden',
    marginTop: verticalScale(16),
    ...getPlatformShadows(6, 0.2, 3, 8),
    elevation: 3,
  },
  buttonInner: {
    paddingVertical: verticalScale(14),
    alignItems: 'center',
  },
  buttonText: {
    fontSize: fontScale(16),
    fontWeight: '700',
    color: '#FFFFFF',
  },
});
