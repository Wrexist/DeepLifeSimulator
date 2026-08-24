import React, { useCallback, useEffect, useState } from 'react';
import {
  Alert,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useRouter } from 'expo-router';
import { useHardwareBack } from '@/hooks/useHardwareBack';
import {
  Building2,
  Check,
  Clapperboard,
  Coins,
  Compass,
  Crown,
  Fingerprint,
  Gem,
  GraduationCap,
  Heart,
  Landmark,
  Play,
  Sparkles,
  Star,
  Trophy,
  type LucideIcon,
} from 'lucide-react-native';
import Gradient from '@/components/ui/Gradient';
import BlurViewFallback from '@/components/fallbacks/BlurViewFallback';
import OnboardingScreenShellV2 from '@/components/onboarding/OnboardingScreenShellV2';
import OnboardingGlassHeader from '@/components/onboarding/OnboardingGlassHeader';
import OnboardingFloatingButton from '@/components/onboarding/OnboardingFloatingButton';
import OnboardingStepBar from '@/components/onboarding/OnboardingStepBar';
import { useOnboarding } from '@/src/features/onboarding/OnboardingContext';
import { useOnboardingFlowGuard } from '@/hooks/useOnboardingFlowGuard';
import { logOnboardingStepView } from '@/src/features/onboarding/onboardingAnalytics';
import { LIFE_AMBITIONS, type LifeAmbition } from '@/lib/ambitions';
import { haptic } from '@/utils/haptics';
import { formatMoney } from '@/utils/moneyFormatting';
import {
  fontScale,
  responsiveBorderRadius,
  responsiveFontSize,
  responsivePadding,
  responsiveSpacing,
  scale,
  verticalScale,
} from '@/utils/scaling';

const LinearGradient = Gradient;
const BlurView = BlurViewFallback;

/** Sentinel for the "no ambition" (freeform) choice. */
const FREEFORM_ID = '__freeform__';

// Lucide crest per ambition - the game's crisp line-icon language (tinted by
// each ambition's accent color) instead of platform emoji, which render
// inconsistently across devices and clash with the dark design.
const AMBITION_ICONS: Record<string, LucideIcon> = {
  business_empire: Building2,
  global_celebrity: Clapperboard,
  raise_dynasty: Crown,
  rule_politics: Landmark,
  master_craft: GraduationCap,
  amass_fortune: Coins,
  life_of_crime: Fingerprint,
  true_love: Heart,
};

interface AmbitionCardViewProps {
  ambition: LifeAmbition;
  isSelected: boolean;
  onSelect: (id: string) => void;
}

// Memoized so selecting one card doesn't re-render the whole list (each card is
// a BlurView + LinearGradient - same perf pattern as the Scenarios cards).
const AmbitionCardView = React.memo(function AmbitionCardView({
  ambition,
  isSelected,
  onSelect,
}: AmbitionCardViewProps) {
  const { payoff } = ambition;
  const accent = ambition.color;
  const CrestIcon = AMBITION_ICONS[ambition.id] ?? Star;
  const lastIndex = ambition.milestones.length - 1;
  return (
    <TouchableOpacity
      activeOpacity={0.92}
      style={styles.cardContainer}
      onPress={() => onSelect(ambition.id)}
      accessibilityRole="button"
      accessibilityLabel={`${ambition.name}${isSelected ? ', selected' : ''}`}
    >
      <BlurView intensity={20} style={styles.cardBlur}>
        <LinearGradient
          colors={
            isSelected
              ? ['rgba(59, 130, 246,0.22)', 'rgba(37, 99, 235,0.22)']
              : ['rgba(30, 41, 59, 0.9)', 'rgba(15, 23, 42, 0.8)']
          }
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={[styles.card, isSelected && styles.cardSelected]}
        >
          {/* Header - tinted lucide crest + name + fantasy tagline. */}
          <View style={styles.cardHeader}>
            <View style={[styles.crest, { backgroundColor: `${accent}22`, borderColor: `${accent}66` }]}>
              <CrestIcon size={scale(24)} color={accent} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.cardTitle} numberOfLines={2}>
                {ambition.name}
              </Text>
              <Text style={styles.cardTagline} numberOfLines={2}>
                {ambition.tagline}
              </Text>
            </View>
            {isSelected ? (
              <View style={styles.selectedDot}>
                <Check size={scale(14)} color="#3B82F6" />
              </View>
            ) : null}
          </View>

          {/* Milestone path - a connected timeline in the ambition's accent,
              capped with a trophy on the final milestone. */}
          <View style={styles.pathWrap}>
            <Text style={styles.pathHeading}>MILESTONES</Text>
            {ambition.milestones.map((m, i) => (
              <View key={m.id} style={styles.pathRow}>
                <View style={styles.pathRail}>
                  <View
                    style={[
                      styles.pathIndexBubble,
                      { backgroundColor: `${accent}22`, borderColor: `${accent}80` },
                    ]}
                  >
                    {i === lastIndex ? (
                      <Trophy size={scale(10)} color={accent} />
                    ) : (
                      <Text style={[styles.pathIndexText, { color: accent }]}>{i + 1}</Text>
                    )}
                  </View>
                  {i < lastIndex ? (
                    <View style={[styles.pathConnector, { backgroundColor: `${accent}44` }]} />
                  ) : null}
                </View>
                <Text
                  style={[styles.pathText, i === lastIndex && styles.pathTextFinal]}
                  numberOfLines={1}
                >
                  {m.title}
                </Text>
              </View>
            ))}
          </View>

          {/* Payoff - labeled reward cells, same visual as the Scenarios stat
              cells, instead of the old inline chip row. */}
          <View style={styles.rewardRow}>
            {payoff.gems ? (
              <View style={styles.rewardCell}>
                <Text style={styles.rewardLabel}>Gems</Text>
                <View style={styles.rewardValueRow}>
                  <Gem size={scale(12)} color="#FBBF24" />
                  <Text style={styles.rewardValue}>{payoff.gems}</Text>
                </View>
              </View>
            ) : null}
            {payoff.money ? (
              <View style={styles.rewardCell}>
                <Text style={styles.rewardLabel}>Cash</Text>
                <View style={styles.rewardValueRow}>
                  <Text style={styles.rewardValue}>{formatMoney(payoff.money)}</Text>
                </View>
              </View>
            ) : null}
            {payoff.prestigePoints ? (
              <View style={styles.rewardCell}>
                <Text style={styles.rewardLabel}>Prestige</Text>
                <View style={styles.rewardValueRow}>
                  <Star size={scale(12)} color="#A855F7" />
                  <Text style={styles.rewardValue}>{payoff.prestigePoints}</Text>
                </View>
              </View>
            ) : null}
          </View>

          {/* Themed nudge - a direction, not a stat bonus. */}
          <View style={styles.hintRow}>
            <Sparkles size={scale(12)} color="#60A5FA" />
            <Text style={styles.hintText} numberOfLines={2}>
              {ambition.hint}
            </Text>
          </View>
        </LinearGradient>
      </BlurView>
    </TouchableOpacity>
  );
});

export default function Ambitions() {
  const router = useRouter();
  const navigation = useNavigation();
  const { state, setState } = useOnboarding();
  useOnboardingFlowGuard('Ambitions');

  // null = nothing touched yet; FREEFORM_ID = explicitly skipped.
  const [selectedId, setSelectedId] = useState<string | null>(state.ambitionId ?? null);

  useEffect(() => {
    logOnboardingStepView('Ambitions');
  }, []);

  const handleBack = useCallback(() => {
    if (navigation.canGoBack()) {
      router.back();
      return;
    }
    router.replace('/(onboarding)/MainMenu');
  }, [navigation, router]);

  useHardwareBack(() => {
    handleBack();
    return true;
  });

  const onSelect = useCallback(
    (id: string) => {
      haptic.selection();
      setSelectedId(id);
      // Persist immediately into the onboarding draft. FREEFORM clears the id.
      setState((prev) => ({ ...prev, ambitionId: id === FREEFORM_ID ? undefined : id }));
    },
    [setState]
  );

  const continueToPerks = useCallback(() => {
    // Ambition is optional - a life with no chosen ambition is valid, so
    // Continue is always allowed (freeform if nothing was picked).
    haptic.medium();
    router.push('/(onboarding)/Perks');
  }, [router]);

  const freeformSelected = selectedId === FREEFORM_ID;

  return (
    <OnboardingScreenShellV2
      floatingButton={
        <OnboardingFloatingButton
          title="Continue To Perks"
          onPress={continueToPerks}
          icon={<Play size={24} color="#FFFFFF" />}
        />
      }
    >
      <OnboardingGlassHeader
        title="Life Ambition"
        onBack={handleBack}
        onInfo={() =>
          Alert.alert(
            'Life Ambition',
            'An ambition is a lifelong goal with staged milestones and a one-time reward when you fulfil it. It only points you in a direction - it changes no starting stats. Optional: tap "Continue" to play freeform.'
          )
        }
      />

      <OnboardingStepBar currentStep={3} totalSteps={4} />

      <Text style={styles.guidanceText}>
        Pick a lifelong ambition for direction and a payoff - or skip it and play freeform.
      </Text>

      <ScrollView
        style={styles.scrollContainer}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator
      >
        {/* Freeform (skip) option - an ambition-free life is fully valid. */}
        <TouchableOpacity
          activeOpacity={0.92}
          style={styles.cardContainer}
          onPress={() => onSelect(FREEFORM_ID)}
          accessibilityRole="button"
          accessibilityLabel={`Freeform, no ambition${freeformSelected ? ', selected' : ''}`}
        >
          <BlurView intensity={20} style={styles.cardBlur}>
            <LinearGradient
              colors={
                freeformSelected
                  ? ['rgba(59, 130, 246,0.22)', 'rgba(37, 99, 235,0.22)']
                  : ['rgba(30, 41, 59, 0.9)', 'rgba(15, 23, 42, 0.8)']
              }
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={[styles.card, styles.freeformCard, freeformSelected && styles.cardSelected]}
            >
              <View style={styles.cardHeader}>
                <View style={[styles.crest, { backgroundColor: 'rgba(148,163,184,0.15)', borderColor: 'rgba(148,163,184,0.4)' }]}>
                  <Compass size={scale(22)} color="#94A3B8" />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.cardTitle} numberOfLines={1}>
                    Freeform Life
                  </Text>
                  <Text style={styles.cardTagline} numberOfLines={2}>
                    No set ambition - write your own story with no fixed goal.
                  </Text>
                </View>
                {freeformSelected ? (
                  <View style={styles.selectedDot}>
                    <Check size={scale(14)} color="#3B82F6" />
                  </View>
                ) : null}
              </View>
            </LinearGradient>
          </BlurView>
        </TouchableOpacity>

        {LIFE_AMBITIONS.map((ambition) => (
          <AmbitionCardView
            key={ambition.id}
            ambition={ambition}
            isSelected={ambition.id === selectedId}
            onSelect={onSelect}
          />
        ))}

        <View style={{ height: 140 }} />
      </ScrollView>
    </OnboardingScreenShellV2>
  );
}

const styles = StyleSheet.create({
  guidanceText: {
    fontSize: fontScale(13),
    fontWeight: '500',
    color: '#94A3B8',
    textAlign: 'center',
    paddingHorizontal: responsivePadding.large,
    paddingVertical: responsiveSpacing.sm,
  },
  scrollContainer: {
    flex: 1,
  },
  scrollContent: {
    gap: responsiveSpacing.lg,
    paddingHorizontal: responsivePadding.large,
    paddingTop: 8,
    paddingBottom: responsiveSpacing.lg,
  },
  cardContainer: {
    borderRadius: 16,
    overflow: 'hidden',
    ...Platform.select({
      web: { boxShadow: '0px 8px 16px rgba(0, 0, 0, 0.3)' } as any,
      default: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.3,
        shadowRadius: 16,
      },
    }),
    elevation: 12,
  },
  cardBlur: {
    borderRadius: 16,
    overflow: 'hidden',
  },
  card: {
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    overflow: 'hidden',
    padding: 16,
    gap: responsiveSpacing.md,
  },
  freeformCard: {
    gap: 0,
  },
  cardSelected: {
    borderColor: 'rgba(96, 165, 250, 0.85)',
    borderWidth: 2,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: responsiveSpacing.sm,
  },
  crest: {
    width: scale(48),
    height: scale(48),
    borderRadius: scale(14),
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
  },
  cardTitle: {
    fontSize: responsiveFontSize.lg,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  cardTagline: {
    fontSize: fontScale(12),
    fontWeight: '500',
    color: '#CBD5E1',
    lineHeight: fontScale(16),
    marginTop: verticalScale(2),
  },
  selectedDot: {
    alignItems: 'center',
    backgroundColor: 'rgba(15, 23, 42, 0.85)',
    borderRadius: 20,
    borderWidth: 2,
    borderColor: 'rgba(96, 165, 250, 0.85)',
    height: scale(28),
    justifyContent: 'center',
    width: scale(28),
  },
  pathWrap: {
    backgroundColor: 'rgba(15, 23, 42, 0.4)',
    borderRadius: responsiveBorderRadius.md,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.06)',
    padding: responsiveSpacing.sm,
  },
  pathHeading: {
    fontSize: fontScale(9),
    fontWeight: '800',
    color: '#94A3B8',
    letterSpacing: 0.8,
    marginBottom: verticalScale(6),
  },
  pathRow: {
    flexDirection: 'row',
    alignItems: 'stretch',
    gap: responsiveSpacing.sm,
  },
  pathRail: {
    alignItems: 'center',
    width: scale(18),
  },
  pathIndexBubble: {
    width: scale(18),
    height: scale(18),
    borderRadius: scale(9),
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pathConnector: {
    flex: 1,
    width: scale(2),
    minHeight: verticalScale(8),
    marginVertical: verticalScale(2),
    borderRadius: scale(1),
  },
  pathIndexText: {
    fontSize: fontScale(9.5),
    fontWeight: '800',
  },
  pathText: {
    flex: 1,
    fontSize: fontScale(12),
    fontWeight: '600',
    color: '#E2E8F0',
    lineHeight: fontScale(18),
  },
  pathTextFinal: {
    fontWeight: '800',
    color: '#FFFFFF',
  },
  rewardRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: responsiveSpacing.xs,
  },
  rewardCell: {
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    borderRadius: responsiveBorderRadius.md,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
    flex: 1,
    minWidth: scale(70),
    paddingHorizontal: responsiveSpacing.xs,
    paddingVertical: verticalScale(8),
  },
  rewardLabel: {
    fontSize: fontScale(10),
    fontWeight: '600',
    color: '#94A3B8',
    marginBottom: verticalScale(2),
  },
  rewardValueRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: scale(4),
  },
  rewardValue: {
    fontSize: fontScale(11),
    fontWeight: '800',
    color: '#FFFFFF',
  },
  hintRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: scale(6),
  },
  hintText: {
    flex: 1,
    fontSize: fontScale(11),
    fontWeight: '500',
    color: '#94A3B8',
    fontStyle: 'italic',
  },
});
