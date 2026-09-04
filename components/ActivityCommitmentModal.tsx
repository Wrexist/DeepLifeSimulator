import React, { useState, useMemo } from 'react';
import { Platform, View, Text, TouchableOpacity, Pressable, StyleSheet, Modal, ScrollView } from 'react-native';
import Gradient from '@/components/ui/Gradient';
import BlurViewFallback from '@/components/fallbacks/BlurViewFallback';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useGame } from '@/contexts/GameContext';
import { safeSettings } from "@/utils/safeGameState";
import { X, Target, Briefcase, Heart, Dumbbell, GraduationCap, Clock, TrendingUp, AlertCircle } from 'lucide-react-native';
import { scale, fontScale, responsivePadding } from '@/utils/scaling';
import { CLOSE_BUTTON_A11Y, hitSlopToMinTarget, minTouchTargetStyle } from '@/utils/touchTargets';
import { getCommitmentBonuses, getCommitmentPenalties, canChangeCommitments, type CommitmentArea } from '@/lib/commitments/commitmentSystem';
import { gameAlert } from '@/utils/gameAlert';
import { tier1Title } from '@/lib/config/hierarchy';
import AlertHost from '@/components/ui/AlertHost';
const LinearGradient = Gradient;
const BlurView = BlurViewFallback;

interface ActivityCommitmentModalProps {
  visible: boolean;
  onClose: () => void;
}

const AREA_CONFIG: Record<CommitmentArea, { label: string; icon: typeof Briefcase; color: string; description: string }> = {
  career: {
    label: 'Career',
    icon: Briefcase,
    color: '#3B82F6',
    description: 'Focus on work and career advancement',
  },
  // Internal key stays 'hobbies' (avoids a save migration), but hobbies were
  // removed - this axis is now "Skills": committing here boosts studying /
  // education / self-improvement (see getSystemFromAction routing).
  hobbies: {
    label: 'Skills',
    icon: GraduationCap,
    color: '#8B5CF6',
    description: 'Focus on learning, education and self-improvement',
  },
  relationships: {
    label: 'Relationships',
    icon: Heart,
    color: '#EF4444',
    description: 'Focus on social connections and relationships',
  },
  health: {
    label: 'Health',
    icon: Dumbbell,
    color: '#10B981',
    description: 'Focus on fitness and health activities',
  },
};

export default function ActivityCommitmentModal({ visible, onClose }: ActivityCommitmentModalProps) {
  const { gameState, setGameState } = useGame();
  const insets = useSafeAreaInsets();
  const settings = safeSettings(gameState); // R3-D: defensive - see utils/safeGameState.ts
  const commitments = gameState.activityCommitments;
  
  const [selectedPrimary, setSelectedPrimary] = useState<CommitmentArea | undefined>(commitments?.primary);
  const [selectedSecondary, setSelectedSecondary] = useState<CommitmentArea | undefined>(commitments?.secondary);

  // Reset selections when modal opens
  React.useEffect(() => {
    if (visible) {
      setSelectedPrimary(commitments?.primary);
      setSelectedSecondary(commitments?.secondary);
    }
  }, [visible, commitments]);

  const { canChange, weeksUntilChange } = useMemo(() => {
    return canChangeCommitments(gameState);
  }, [gameState]);

  const commitmentLevels = commitments?.commitmentLevels || {
    career: 0,
    hobbies: 0,
    relationships: 0,
    health: 0,
  };

  const handleSave = () => {
    // Validate: secondary cannot be same as primary
    if (selectedPrimary && selectedSecondary && selectedPrimary === selectedSecondary) {
      gameAlert('Invalid Selection', 'Primary and secondary commitments must be different.');
      return;
    }

    // The previous \`useGame().changeActivityCommitment\` was undefined and
    // would have thrown TypeError on tap. Inline the state mutation here
    // (the canChange validation already ran in the useMemo above).
    if (!canChange) {
      gameAlert(
        'Cannot Change',
        `Commitments locked. ${weeksUntilChange} week${weeksUntilChange === 1 ? '' : 's'} until you can change them again.`
      );
      return;
    }

    setGameState(prev => ({
      ...prev,
      activityCommitments: {
        ...prev.activityCommitments,
        primary: selectedPrimary,
        secondary: selectedSecondary,
        lastChangedWeek: prev.weeksLived,
      },
    }));
    gameAlert('Success', 'Activity commitments updated.');
    onClose();
  };

  const getAreaBonuses = (area: CommitmentArea) => {
    const bonuses = getCommitmentBonuses(gameState, area);
    const penalties = getCommitmentPenalties(gameState, area);
    return { bonuses, penalties };
  };

  const renderAreaCard = (area: CommitmentArea) => {
    const config = AREA_CONFIG[area];
    const Icon = config.icon;
    const isPrimary = selectedPrimary === area;
    const isSecondary = selectedSecondary === area;
    const level = commitmentLevels[area] || 0;
    const { bonuses, penalties } = getAreaBonuses(area);

    return (
      <TouchableOpacity
        key={area}
        style={[
          styles.areaCard,
          settings.darkMode && styles.areaCardDark,
          isPrimary && { borderColor: config.color, borderWidth: 3 },
          isSecondary && !isPrimary && { borderColor: config.color, borderWidth: 2, borderStyle: 'dashed' },
        ]}
        onPress={() => {
          if (isPrimary) {
            setSelectedPrimary(undefined);
          } else if (isSecondary) {
            setSelectedSecondary(undefined);
          } else {
            // Set as primary if none selected, otherwise as secondary
            if (!selectedPrimary) {
              setSelectedPrimary(area);
            } else if (!selectedSecondary) {
              setSelectedSecondary(area);
            } else {
              // Replace secondary
              setSelectedSecondary(area);
            }
          }
        }}
      >
        <View style={styles.areaHeader}>
          <View style={[styles.iconContainer, { backgroundColor: config.color + '20' }]}>
            <Icon size={24} color={config.color} />
          </View>
          <View style={styles.areaInfo}>
            <Text style={[styles.areaLabel, settings.darkMode && styles.textDark]}>
              {config.label}
            </Text>
            <Text style={[styles.areaDescription, settings.darkMode && styles.textDarkSecondary]}>
              {config.description}
            </Text>
          </View>
          {isPrimary && (
            <View style={[styles.badge, { backgroundColor: config.color }]}>
              <Text style={styles.badgeText}>PRIMARY</Text>
            </View>
          )}
          {isSecondary && !isPrimary && (
            <View style={[styles.badge, styles.badgeSecondary, { borderColor: config.color }]}>
              <Text style={[styles.badgeText, { color: config.color }]}>SECONDARY</Text>
            </View>
          )}
        </View>

        {/* Commitment Level */}
        <View style={styles.levelSection}>
          <Text style={[styles.levelLabel, settings.darkMode && styles.textDarkSecondary]}>
            Commitment Level: {level}/100
          </Text>
          <View style={styles.levelBar}>
            <View
              style={[
                styles.levelFill,
                { width: `${level}%`, backgroundColor: config.color },
              ]}
            />
          </View>
        </View>

        {/* Bonuses/Penalties */}
        <View style={styles.bonusSection}>
          {isPrimary && (
            <View style={styles.bonusRow}>
              <TrendingUp size={16} color="#10B981" />
              <Text style={[styles.bonusText, settings.darkMode && styles.textDark]}>
                +{Math.round(bonuses.progressBonus)}% progress, -{Math.round(bonuses.energyReduction)}% energy cost
              </Text>
            </View>
          )}
          {isSecondary && !isPrimary && (
            <View style={styles.bonusRow}>
              <TrendingUp size={16} color="#10B981" />
              <Text style={[styles.bonusText, settings.darkMode && styles.textDark]}>
                +{Math.round(bonuses.progressBonus)}% progress, -{Math.round(bonuses.energyReduction)}% energy cost
              </Text>
            </View>
          )}
          {!isPrimary && !isSecondary && penalties.progressPenalty > 0 && (
            <View style={styles.bonusRow}>
              <AlertCircle size={16} color="#EF4444" />
              <Text style={[styles.penaltyText, settings.darkMode && styles.textDark]}>
                -{Math.round(penalties.progressPenalty)}% progress, +{Math.round(penalties.energyIncrease)}% energy cost
              </Text>
            </View>
          )}
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <Modal
      visible={visible}
      transparent={true}
      animationType="fade"
      statusBarTranslucent
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        {/* Dismiss backdrop - sits BEHIND the sheet, so a tap anywhere outside
            closes the modal. A transparent RN Modal owns every touch in its
            window, so without this the ONLY way out is the sheet's own buttons;
            when the sheet mislaid itself (it used to render as a clipped sliver
            under the status bar) that left the whole game unreachable. Same
            pattern, and the same reason, as WhatsNewModal: the Pressable is a
            sibling BEHIND the sheet rather than a wrapper, because a ScrollView
            inside a Touchable loses its gestures to the press responder. */}
        <Pressable
          style={StyleSheet.absoluteFill}
          onPress={onClose}
          accessibilityRole="button"
          accessibilityLabel="Close Activity Commitments"
        >
          <BlurView intensity={20} style={StyleSheet.absoluteFill} />
        </Pressable>

        {/* Centering layer. Absolute + `box-none` so it can carry the safe-area
            padding (which the sheet's `maxHeight: '100%'` then resolves
            against) without masking the backdrop behind it. */}
        <View
          style={[
            styles.centering,
            { paddingTop: insets.top + scale(12), paddingBottom: insets.bottom + scale(12) },
          ]}
          pointerEvents="box-none"
        >
          <LinearGradient
            colors={settings.darkMode ? ['#1E293B', '#0F172A'] : ['#FFFFFF', '#F8FAFC']}
            style={styles.modal}
          >
            {/* Header */}
            <View style={styles.header}>
              <View style={styles.headerLeft}>
                <View style={[styles.headerIcon, { backgroundColor: '#F59E0B20' }]}>
                  <Target size={24} color="#F59E0B" />
                </View>
                <View>
                  <Text style={[styles.title, settings.darkMode && styles.textDark]}>
                    Activity Commitments
                  </Text>
                  <Text style={[styles.subtitle, settings.darkMode && styles.textDarkSecondary]}>
                    Focus on specific areas for bonuses
                  </Text>
                </View>
              </View>
              <TouchableOpacity
                onPress={onClose}
                style={[styles.closeButton, minTouchTargetStyle]}
                hitSlop={hitSlopToMinTarget(scale(24))}
                {...CLOSE_BUTTON_A11Y}
              >
                <X size={24} color={settings.darkMode ? '#FFFFFF' : '#1E293B'} />
              </TouchableOpacity>
            </View>

            <ScrollView
              style={styles.content}
              contentContainerStyle={styles.contentInner}
              showsVerticalScrollIndicator={true}
            >
              {/* Cooldown Warning */}
              {!canChange && (
                <View style={[styles.warningCard, settings.darkMode && styles.warningCardDark]}>
                  <Clock size={20} color="#F59E0B" />
                  <Text style={[styles.warningText, settings.darkMode && styles.textDark]}>
                    You can change commitments in {weeksUntilChange} week(s)
                  </Text>
                </View>
              )}

              {/* Info Card */}
              <View style={[styles.infoCard, settings.darkMode && styles.infoCardDark]}>
                <Text style={[styles.infoTitle, settings.darkMode && styles.textDark]}>
                  How It Works
                </Text>
                <Text style={[styles.infoText, settings.darkMode && styles.textDarkSecondary]}>
                  • Choose up to 2 focus areas (Primary & Secondary){'\n'}
                  • Committed areas get bonuses: +30-50% progress, -20-30% energy cost{'\n'}
                  • Neglected areas get penalties: -15% progress, +15% energy cost{'\n'}
                  • Commitment levels increase with activity, decay when neglected{'\n'}
                  • You can change commitments once every 4 weeks
                </Text>
              </View>

              {/* Area Cards */}
              <View style={styles.areasContainer}>
                {(['career', 'hobbies', 'relationships', 'health'] as CommitmentArea[]).map(area =>
                  renderAreaCard(area)
                )}
              </View>
            </ScrollView>

            {/* Footer */}
            <View style={styles.footer}>
              <TouchableOpacity
                style={[styles.cancelButton, settings.darkMode && styles.cancelButtonDark]}
                onPress={onClose}
              >
                <Text style={[styles.cancelButtonText, settings.darkMode && styles.textDark]}>
                  Cancel
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  styles.saveButton,
                  (!canChange || (selectedPrimary === commitments?.primary && selectedSecondary === commitments?.secondary)) && styles.saveButtonDisabled,
                ]}
                onPress={handleSave}
                disabled={!canChange || (selectedPrimary === commitments?.primary && selectedSecondary === commitments?.secondary)}
              >
                <LinearGradient
                  colors={(!canChange || (selectedPrimary === commitments?.primary && selectedSecondary === commitments?.secondary)) 
                    ? ['#94A3B8', '#64748B'] 
                    : ['#10B981', '#059669']}
                  style={styles.saveButtonGradient}
                >
                  <Text style={styles.saveButtonText}>Save Changes</Text>
                </LinearGradient>
              </TouchableOpacity>
            </View>
          </LinearGradient>
        </View>
      </View>
      {/* iOS presents an RN Modal from the view controller nearest its mount
          point, so the ROOT AlertHost's dialog cannot present while this Modal
          covers the screen - the tap that raised it looks dead. This nested
          host registers on top of the gameAlert stack while this Modal is up.
          See __tests__/tooling/nestedAlertHosts.test.ts. */}
      <AlertHost />
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    // A real dim. The blur fallback resolves to ~8% alpha, which read as "the
    // game screen, but frozen" rather than "a modal is open".
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
  },
  centering: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
  },
  modal: {
    width: '90%',
    maxWidth: 600,
    // `maxHeight` is the ONLY height bound here, so the sheet is content-sized
    // and `flexShrink` is what lets it clamp - see `content` below, which must
    // NOT be `flex: 1` for the same reason.
    maxHeight: '100%',
    flexShrink: 1,
    borderRadius: 20,
    overflow: 'hidden',
    ...Platform.select({
      web: { boxShadow: '0px 4px 8px rgba(0, 0, 0, 0.3)' } as any,
      default: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 8,
      },
    }),
    elevation: 8,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: responsivePadding.horizontal,
    paddingTop: 20,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  headerIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  title: {
    ...tier1Title,
    color: '#1E293B',
  },
  subtitle: {
    fontSize: fontScale(14),
    color: '#64748B',
    marginTop: scale(2),
  },
  closeButton: {
    padding: scale(8),
  },
  content: {
    // NOT `flex: 1`. The sheet above is bounded by `maxHeight` only, so its own
    // height is content-driven - and `flex: 1` means `flexBasis: 0`, which in a
    // content-sized column contributes nothing to that measurement and then has
    // no free space to grow back into. The list resolved to ZERO height and the
    // modal shipped as a header-and-footer sliver with the whole body missing.
    // `flexShrink: 1` keeps the list's measured height and lets it give space
    // back when the column exceeds the sheet's bound. Same pair as the banking
    // sheets - see __tests__/render/modalListsShrink.test.ts.
    flexShrink: 1,
  },
  contentInner: {
    // Padding belongs on the content container, not the scroll frame, so it
    // scrolls with the content instead of shrinking the visible viewport.
    padding: responsivePadding.horizontal,
  },
  warningCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FEF3C7',
    padding: scale(12),
    borderRadius: scale(8),
    marginBottom: scale(16),
    gap: scale(8),
  },
  warningCardDark: {
    backgroundColor: '#78350F',
  },
  warningText: {
    fontSize: fontScale(14),
    color: '#92400E',
    flex: 1,
  },
  infoCard: {
    backgroundColor: '#F1F5F9',
    padding: scale(16),
    borderRadius: scale(12),
    marginBottom: scale(20),
  },
  infoCardDark: {
    backgroundColor: '#334155',
  },
  infoTitle: {
    fontSize: fontScale(16),
    fontWeight: '600',
    color: '#1E293B',
    marginBottom: scale(8),
  },
  infoText: {
    fontSize: fontScale(14),
    color: '#64748B',
    lineHeight: fontScale(20),
  },
  areasContainer: {
    gap: scale(12),
    marginBottom: scale(16),
  },
  areaCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: scale(12),
    padding: scale(16),
    borderWidth: 2,
    borderColor: '#E2E8F0',
  },
  areaCardDark: {
    backgroundColor: '#334155',
    borderColor: '#475569',
  },
  areaHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: scale(12),
  },
  iconContainer: {
    width: scale(48),
    height: scale(48),
    borderRadius: scale(24),
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: scale(12),
  },
  areaInfo: {
    flex: 1,
  },
  areaLabel: {
    fontSize: fontScale(18),
    fontWeight: '600',
    color: '#1E293B',
    marginBottom: scale(2),
  },
  areaDescription: {
    fontSize: fontScale(12),
    color: '#64748B',
  },
  badge: {
    paddingHorizontal: scale(8),
    paddingVertical: scale(4),
    borderRadius: scale(4),
  },
  badgeSecondary: {
    backgroundColor: 'transparent',
    borderWidth: 1,
  },
  badgeText: {
    fontSize: fontScale(10),
    fontWeight: '700',
    color: '#FFFFFF',
    letterSpacing: 0.5,
  },
  levelSection: {
    marginBottom: scale(12),
  },
  levelLabel: {
    fontSize: fontScale(12),
    color: '#64748B',
    marginBottom: scale(4),
  },
  levelBar: {
    height: scale(8),
    backgroundColor: '#E2E8F0',
    borderRadius: scale(4),
    overflow: 'hidden',
  },
  levelFill: {
    height: '100%',
    borderRadius: scale(4),
  },
  bonusSection: {
    gap: scale(4),
  },
  bonusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: scale(6),
  },
  bonusText: {
    fontSize: fontScale(12),
    color: '#10B981',
    fontWeight: '500',
  },
  penaltyText: {
    fontSize: fontScale(12),
    color: '#EF4444',
    fontWeight: '500',
  },
  footer: {
    flexDirection: 'row',
    gap: scale(12),
    padding: responsivePadding.horizontal,
    paddingTop: scale(16),
    paddingBottom: scale(20),
    borderTopWidth: 1,
    borderTopColor: '#E2E8F0',
  },
  cancelButton: {
    flex: 1,
    paddingVertical: scale(14),
    borderRadius: scale(12),
    backgroundColor: '#F1F5F9',
    alignItems: 'center',
    justifyContent: 'center',
  },
  cancelButtonDark: {
    backgroundColor: '#334155',
  },
  cancelButtonText: {
    fontSize: fontScale(16),
    fontWeight: '600',
    color: '#64748B',
  },
  saveButton: {
    flex: 1,
    borderRadius: scale(12),
    overflow: 'hidden',
  },
  saveButtonDisabled: {
    opacity: 0.5,
  },
  saveButtonGradient: {
    paddingVertical: scale(14),
    alignItems: 'center',
    justifyContent: 'center',
  },
  saveButtonText: {
    fontSize: fontScale(16),
    fontWeight: '600',
    color: '#FFFFFF',
  },
  textDark: {
    color: '#F8FAFC',
  },
  textDarkSecondary: {
    color: '#CBD5E1',
  },
});

