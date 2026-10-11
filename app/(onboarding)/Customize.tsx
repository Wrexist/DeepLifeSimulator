import { responsiveSpacing as layoutSpace ,
  fontScale,
  responsiveBorderRadius,
  responsiveFontSize,
  responsivePadding,
  responsiveSpacing,
  scale,
} from '@/utils/scaling';
import OnboardingGlassHeader from '@/components/onboarding/OnboardingGlassHeader';
import MotionPressable from '@/components/ui/MotionPressable';
import CollapsibleSection from '@/components/ui/CollapsibleSection';
import CharacterAvatar from '@/components/avatar/CharacterAvatar';
import PortraitPicker from '@/components/onboarding/PortraitPicker';
import SegmentedControl from '@/components/ui/SegmentedControl';
import { isPortraitId, randomPortrait, type PortraitId } from '@/lib/avatar/portraits';
import { useReducedMotion } from '@/hooks/useReducedMotion';
import { uiPalette, colors, actionColors } from '@/lib/config/theme';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Animated,
  Keyboard,
  useWindowDimensions,
  Easing,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useRouter } from 'expo-router';
import { useHardwareBack } from '@/hooks/useHardwareBack';
import { Dices, ArrowRight, Shuffle } from 'lucide-react-native';
import OnboardingScreenShellV2 from '@/components/onboarding/OnboardingScreenShellV2';
import OnboardingStepBar from '@/components/onboarding/OnboardingStepBar';
import AppearanceEditor from '@/components/onboarding/AppearanceEditor';
import VectorAvatar from '@/components/avatar/VectorAvatar';
import { generateRandomName } from '@/src/features/onboarding/nameData';
import {
  applyIdentityDraftToOnboardingState,
  canContinueFromIdentityDraft,
  IdentitySexuality,
  shouldGenerateInitialIdentityName,
  shouldRegenerateIdentityNameForSexChange,
} from '@/src/features/onboarding/customizeIdentity';
import { useOnboarding } from '@/src/features/onboarding/OnboardingContext';
import { logOnboardingStepView } from '@/src/features/onboarding/onboardingAnalytics';
import { useOnboardingFlowGuard } from '@/hooks/useOnboardingFlowGuard';
import { haptic } from '@/utils/haptics';
import { decodeAvatar, encodeAvatar } from '@/lib/avatar/encode';
import { pickersFor } from '@/lib/avatar/pickers';
import { randomAvatar } from '@/lib/avatar/random';
import type { AvatarConfig, AvatarSex } from '@/lib/avatar/types';

import { gameAlert } from '@/utils/gameAlert';


type SexualityOption = IdentitySexuality;

/**
 * Per-field cap on the player's typed name. Both fields were unbounded, so a
 * pasted paragraph became the character's name and then flowed into every
 * surface that renders it - the HUD, the ID card, the obituary, save-slot
 * metadata. Pulse caps a whole display name at 40 (ProfileEditModal); first +
 * last at 20 each keeps the same total budget. `onboardingValidation` only
 * requires the names be non-empty, so nothing downstream contradicts this.
 */
const NAME_MAX_LENGTH = 20;

const SEX_OPTIONS: { value: AvatarSex; label: string }[] = [
  { value: 'male', label: 'Male' },
  { value: 'female', label: 'Female' },
];

const SEXUALITY_OPTIONS: { value: SexualityOption; label: string }[] = [
  { value: 'straight', label: 'Straight' },
  { value: 'gay', label: 'Gay' },
  { value: 'bi', label: 'Bisexual' },
];

/**
 * "Random" is an ACTION here, not a stored value.
 *
 * The old screen persisted `sex: 'random'` and resolved it later from whichever
 * portrait the player happened to tap, which meant appearance and gameplay sex
 * could disagree and the name generator had to chase the face. A vector face
 * has to be drawn for a concrete sex anyway, so an unresolved sex has nowhere
 * to live - it is resolved once, on mount, and the Randomize button re-rolls
 * appearance WITHOUT flipping it. Sex changing under the player mid-edit reads
 * as a bug, however random they asked the rest to be.
 */
function resolveInitialSex(stored: 'male' | 'female' | 'random' | undefined): AvatarSex {
  if (stored === 'male' || stored === 'female') return stored;
  return Math.random() < 0.5 ? 'male' : 'female';
}

export default function Customize() {
  const router = useRouter();
  const { width, fontScale: systemFontScale } = useWindowDimensions();
  const wideIdentity = width >= 600 && systemFontScale <= 1.3;
  const lastNameInput = useRef<TextInput>(null);
  const navigation = useNavigation();
  const { state, setState } = useOnboarding();
  useOnboardingFlowGuard('Customize');

  useEffect(() => {
    logOnboardingStepView('Customize');
  }, []);

  const [firstName, setFirstName] = useState(state.firstName || '');
  const [lastName, setLastName] = useState(state.lastName || '');
  const reducedMotion = useReducedMotion();
  // Resolved ONCE. The portrait, the custom avatar and the generated name all
  // read from this; each used to roll its own coin, so a fresh character could
  // open with a male name over a feminine face.
  const [initialSex] = useState<AvatarSex>(() => resolveInitialSex(state.sex));
  const [portraitId, setPortraitId] = useState<PortraitId>(() => isPortraitId(state.avatarId) ? state.avatarId : randomPortrait(undefined, Math.random(), initialSex));
  // True once the player picks a portrait themselves; until then a sex change
  // re-picks a matching one rather than leaving the dice's choice behind.
  const portraitChosen = useRef(isPortraitId(state.avatarId));
  const [artMode, setArtMode] = useState<'portrait' | 'custom'>(() => state.avatar && !isPortraitId(state.avatarId) ? 'custom' : 'portrait');
  const [sex, setSex] = useState<AvatarSex>(initialSex);
  const [sexuality, setSexuality] = useState<SexualityOption>(state.sexuality || 'straight');
  const [avatar, setAvatar] = useState<AvatarConfig>(
    () => decodeAvatar(state.avatar) ?? randomAvatar(initialSex)
  );
  const [activeCategory, setActiveCategory] = useState(0);
  const lastAutoGeneratedSex = useRef<AvatarSex | null>(null);

  const categories = useMemo(() => pickersFor(sex), [sex]);

  // Facial hair drops out of the list on a feminine face, so an index held from
  // the previous sex can point past the end.
  const category = categories[Math.min(activeCategory, categories.length - 1)];

  const scenarioAge = state.scenario?.start?.age ?? 18;

  // Three checkpoints across a life, always ascending and always distinct - a
  // scenario starting at 60 must not render "60, 45, 75".
  const agePreview = useMemo(() => {
    const start = Math.max(1, Math.round(scenarioAge));
    return [start, Math.max(start + 12, 45), Math.max(start + 24, 75)];
  }, [scenarioAge]);

  /**
   * The hero pops whenever the face changes - a randomize, or any picker tap.
   * Without it a tap swaps the art instantly and the screen feels inert; the
   * pop is what makes an edit feel like it landed.
   */
  const pop = useRef(new Animated.Value(1)).current;
  const entrance = useRef(new Animated.Value(0)).current;
  const avatarKey = useMemo(() => encodeAvatar(avatar) + sex, [avatar, sex]);
  const firstRender = useRef(true);

  useEffect(() => {
    Animated.timing(entrance, {
      toValue: 1,
      duration: reducedMotion ? 0 : 240,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();
  }, [entrance, reducedMotion]);

  useEffect(() => {
    // Skip the mount, or the entrance and the pop fight each other.
    if (firstRender.current) {
      firstRender.current = false;
      return;
    }
    if (reducedMotion) { pop.setValue(1); return; }
    pop.setValue(0.97);
    Animated.spring(pop, {
      toValue: 1,
      friction: 5,
      tension: 140,
      useNativeDriver: true,
    }).start();
  }, [avatarKey, portraitId, pop, reducedMotion]);

  useEffect(() => {
    if (!shouldGenerateInitialIdentityName(firstName, lastName)) return;
    const randomName = generateRandomName(sex);
    setFirstName(randomName.firstName);
    setLastName(randomName.lastName);
    lastAutoGeneratedSex.current = sex;
  }, [firstName, lastName, sex]);

  useEffect(() => {
    if (
      !shouldRegenerateIdentityNameForSexChange({
        sex,
        firstName,
        lastName,
        lastAutoGeneratedSex: lastAutoGeneratedSex.current,
      })
    ) {
      return;
    }
    const randomName = generateRandomName(sex);
    setFirstName(randomName.firstName);
    setLastName(randomName.lastName);
    lastAutoGeneratedSex.current = sex;
  }, [firstName, lastName, sex]);

  const handleBack = useCallback(() => {
    if (navigation.canGoBack()) {
      router.back();
      return;
    }
    router.replace('/(onboarding)/MainMenu');
  }, [navigation, router]);

  // R3-C: the Android hardware back button shares the handler so a system
  // gesture doesn't drop the player onto a blank screen.
  useHardwareBack(() => {
    handleBack();
    return true;
  });

  const handleShuffleName = useCallback(() => {
    haptic.light();
    const randomName = generateRandomName(sex);
    setFirstName(randomName.firstName);
    setLastName(randomName.lastName);
    lastAutoGeneratedSex.current = sex;
  }, [sex]);

  const handleRandomizeFace = useCallback(() => {
    haptic.medium();
    if (artMode === 'portrait') setPortraitId(previous => randomPortrait(previous, Math.random(), sex));
    else setAvatar(randomAvatar(sex));
  }, [sex, artMode]);

  const handleSelectOption = useCallback(
    (index: number) => {
      haptic.selection();
      setAvatar((prev) => ({ ...prev, [category.field]: index }));
    },
    [category.field]
  );

  // The colour that belongs to the open category (hair colour on Hair, outfit
  // colour on Outfit). Writes a DIFFERENT field from `handleSelectOption`,
  // which is the whole reason it is a separate handler rather than a flag.
  const handleSelectTint = useCallback(
    (index: number) => {
      haptic.selection();
      const field = category.tint?.field;
      if (!field) return;
      setAvatar((prev) => ({ ...prev, [field]: index }));
    },
    [category.tint?.field]
  );

  const handleSexChange = useCallback((next: AvatarSex) => {
    haptic.selection();
    setSex(next);
    if (!portraitChosen.current) setPortraitId(previous => randomPortrait(previous, Math.random(), next));
    // Facial hair is never drawn on a feminine face; clearing it here stops a
    // beard chosen as male from lingering invisibly in the saved config.
    setAvatar((prev) => (next === 'female' ? { ...prev, facialHair: 0 } : prev));
  }, []);

  const handleFirstNameChange = useCallback((value: string) => {
    lastAutoGeneratedSex.current = null;
    setFirstName(value);
  }, []);

  const handleLastNameChange = useCallback((value: string) => {
    lastAutoGeneratedSex.current = null;
    setLastName(value);
  }, []);

  const handleContinue = useCallback(() => {
    if (!state.scenario) {
      haptic.error();
      gameAlert('Missing Scenario', 'Choose a scenario before customizing identity.');
      router.replace('/(onboarding)/Scenarios');
      return;
    }

    if (!canContinueFromIdentityDraft({ firstName, lastName })) {
      haptic.error();
      gameAlert('Missing Name', 'Enter both first and last name to continue.');
      return;
    }

    haptic.medium();
    setState((prev) =>
      applyIdentityDraftToOnboardingState(prev, {
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        sex,
        sexuality,
        // The legacy pool id is deliberately dropped for a new life: the face
        // is now fully described by `avatar`, and leaving a stale id behind
        // would seed the derived-face fallback with a portrait nobody chose.
        avatarId: artMode === 'portrait' ? portraitId : undefined,
        avatar: encodeAvatar(avatar),
      })
    );
    // Ambitions left the wizard: it was optional, and `AmbitionPickerCard` on
    // Home is a strictly better place to choose one - by then the player has
    // context for the choice instead of guessing at systems they have not met
    // (2026-09-01 UI audit §2 item 7). It renders whenever `ambitionId` is
    // unset, so nothing is lost by not asking here.
    router.push('/(onboarding)/Perks');
  }, [avatar, artMode, portraitId, firstName, lastName, router, setState, sex, sexuality, state.scenario]);

  const fullName = `${firstName || 'Unnamed'} ${lastName || ''}`.trim();

  return (
    <OnboardingScreenShellV2 quiet footerInFlow
      floatingButton={
        <MotionPressable accessibilityLabel="Continue To Perks" onPress={handleContinue} style={styles.continueButton}>
          <Text style={styles.continueLabel}>Continue To Perks</Text>
          <ArrowRight size={20} color={uiPalette.white} />
        </MotionPressable>
      }
    >
      {/* Same header as Choose Scenario and Choose Perks either side of it -
          this step used the in-game AppHeader and read as a different app. */}
      <OnboardingGlassHeader
        title="Create Character"
        onBack={handleBack}
        onInfo={() => gameAlert('Create your character', 'Choose an illustrated portrait or edit a custom avatar. Custom features age with your life and can be inherited by children. Name, sex and sexuality shape relationships, not difficulty.')}
      />

      <OnboardingStepBar currentStep={2} totalSteps={3} />

      <ScrollView
        style={styles.scrollContainer}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator
        keyboardShouldPersistTaps="handled"
        automaticallyAdjustKeyboardInsets
        keyboardDismissMode="on-drag"
      >
        {/* ── Hero: the live face ──────────────────────────────────────── */}
        <View style={styles.heroCard}>
              <View style={styles.previewRow}>
              <Animated.View
                style={[
                  styles.avatarRing,
                  {
                    opacity: entrance,
                    // Two stacked scales rather than Animated.multiply: they
                    // compose the same way, and multiply is not part of the
                    // React Native surface the render tests mock.
                    transform: [
                      { scale: entrance.interpolate({ inputRange: [0, 1], outputRange: [0.9, 1] }) },
                      { scale: pop },
                    ],
                  },
                ]}
              >
                <CharacterAvatar
                  source={{ avatar: encodeAvatar(avatar), avatarId: artMode === 'portrait' ? portraitId : undefined }}
                  sex={sex}
                  age={scenarioAge}
                  size={scale(88)}
                  circular
                  alive
                />
              </Animated.View>

              <View style={styles.previewCopy}>
                <Text style={styles.heroName} numberOfLines={2}>{fullName}</Text>
                <Text style={styles.heroSub}>Age {scenarioAge} | {artMode === 'portrait' ? 'Portrait' : 'Custom avatar'}</Text>
              </View>
              </View>

              <View style={styles.heroActions}>
                <TouchableOpacity
                  activeOpacity={0.75}
                  accessibilityRole="button"
                  accessibilityLabel="Randomize appearance"
                  onPress={handleRandomizeFace}
                  style={[styles.pill, styles.pillPrimary]}
                >
                  <Dices size={scale(16)} color={uiPalette.white} />
                  <Text style={styles.pillPrimaryLabel}>Randomize</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  activeOpacity={0.75}
                  accessibilityRole="button"
                  accessibilityLabel="Shuffle name"
                  onPress={handleShuffleName}
                  style={styles.pill}
                >
                  <Shuffle size={scale(16)} color={uiPalette.blue} />
                  <Text style={styles.pillLabel}>New name</Text>
                </TouchableOpacity>
              </View>
            </View>

        {/* ── Appearance editor ────────────────────────────────────────── */}
        <View style={styles.sectionCard}>
              <SegmentedControl segments={[{ key: 'portrait', label: 'Portraits' }, { key: 'custom', label: 'Custom' }]} value={artMode} onChange={setArtMode} />
              {artMode === 'portrait' ? <PortraitPicker value={portraitId} onChange={id => { haptic.selection(); portraitChosen.current = true; setPortraitId(id); }} /> : <AppearanceEditor
                  avatar={avatar} sex={sex} age={scenarioAge} categories={categories}
                  activeIndex={activeCategory} onChangeCategory={setActiveCategory}
                  onSelectOption={handleSelectOption} onSelectTint={handleSelectTint}
                />}
            </View>

        {artMode === 'custom' && (<CollapsibleSection id="creator.aging" title="Preview aging" compact defaultCollapsed><View style={styles.ageStrip}>
                {agePreview.map((previewAge, index) => (
                  <Animated.View
                    key={previewAge}
                    style={[
                      styles.agePreview,
                      {
                        opacity: entrance,
                        // Staggered: each checkpoint settles a beat after the
                        // one before, which reads as a life unrolling.
                        transform: [
                          {
                            translateY: entrance.interpolate({
                              inputRange: [0, 1],
                              outputRange: [10 + index * 5, 0],
                            }),
                          },
                        ],
                      },
                    ]}
                  >
                    <VectorAvatar
                      config={avatar}
                      sex={sex}
                      age={previewAge}
                      size={scale(44)}
                      circular
                    />
                    <Text style={styles.ageLabel}>{previewAge}</Text>
                  </Animated.View>
                ))}
              </View></CollapsibleSection>)}

        {/* ── Identity ─────────────────────────────────────────────────── */}
        <View style={styles.sectionCard}>
              <Text style={styles.sectionTitle}>Identity</Text>

              <View style={[styles.nameRow, wideIdentity && styles.nameRowWide]}>
                <View style={[styles.nameField, wideIdentity && styles.nameFieldWide]}>
                  <Text style={styles.inputLabel}>First Name</Text>
                  <View style={styles.inputWrap}>
                    <TextInput
                      accessibilityLabel="First name"
                      autoComplete="given-name"
                      autoCapitalize="words"
                      returnKeyType="next"
                      submitBehavior="submit"
                      blurOnSubmit={false}
                      onSubmitEditing={() => lastNameInput.current?.focus()}
                      placeholder="Enter first name"
                      placeholderTextColor={uiPalette.muted}
                      style={styles.inputText}
                      value={firstName}
                      onChangeText={handleFirstNameChange}
                      maxLength={NAME_MAX_LENGTH}
                    />
                  </View>
                </View>

                <View style={[styles.nameField, wideIdentity && styles.nameFieldWide]}>
                  <Text style={styles.inputLabel}>Last Name</Text>
                  <View style={styles.inputWrap}>
                    <TextInput
                      ref={lastNameInput}
                      accessibilityLabel="Last name"
                      autoComplete="family-name"
                      autoCapitalize="words"
                      returnKeyType="done"
                      onSubmitEditing={Keyboard.dismiss}
                      placeholder="Enter last name"
                      placeholderTextColor={uiPalette.muted}
                      style={styles.inputText}
                      value={lastName}
                      onChangeText={handleLastNameChange}
                      maxLength={NAME_MAX_LENGTH}
                    />
                  </View>
                </View>
              </View>

              <Text style={styles.fieldLabel}>Sex</Text>
              <View style={styles.segmentRow}>
                {SEX_OPTIONS.map((option) => {
                  const isSelected = sex === option.value;
                  return (
                    <TouchableOpacity
                      activeOpacity={0.75}
                      key={option.value}
                      accessibilityRole="button"
                      accessibilityLabel={`${option.label} sex`}
                      accessibilityState={{ selected: isSelected }}
                      onPress={() => handleSexChange(option.value)}
                      style={[styles.segment, isSelected && styles.segmentSelected]}
                    >
                      <Text style={[styles.segmentLabel, isSelected && styles.segmentLabelSelected]}>
                        {option.label}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>

              <Text style={styles.fieldLabel}>Sexuality</Text>
              <View style={styles.segmentRow}>
                {SEXUALITY_OPTIONS.map((option) => {
                  const isSelected = sexuality === option.value;
                  return (
                    <TouchableOpacity
                      activeOpacity={0.75}
                      key={option.value}
                      accessibilityRole="button"
                      accessibilityLabel={`${option.label} sexuality`}
                      accessibilityState={{ selected: isSelected }}
                      onPress={() => {
                        haptic.selection();
                        setSexuality(option.value);
                      }}
                      style={[styles.segment, isSelected && styles.segmentSelected]}
                    >
                      <Text style={[styles.segmentLabel, isSelected && styles.segmentLabelSelected]}>
                        {option.label}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>

              <Text style={styles.helperText}>
                Sex and sexuality shape your story and relationships - not difficulty.
              </Text>
            </View>

      </ScrollView>
    </OnboardingScreenShellV2>
  );
}

const styles = StyleSheet.create({
  scrollContainer: {
    flex: 1,
  },
  scrollContent: {
    gap: layoutSpace.compact,
    paddingHorizontal: responsivePadding.horizontal,
    paddingTop: responsiveSpacing.sm,
    paddingBottom: responsiveSpacing.lg,
  },
  sectionCard: {
    padding: layoutSpace.compact,
    borderRadius: responsiveBorderRadius.lg,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.dark.border,
    backgroundColor: uiPalette.surface,
    gap: layoutSpace.compact,
  },
  heroCard: {
    gap: layoutSpace.sm,
  },
  previewRow: { flexDirection: 'row', alignItems: 'center', gap: layoutSpace.md },
  previewCopy: { flex: 1, gap: layoutSpace.sm },
  continueButton: { minHeight: 48, padding: layoutSpace.compact, borderRadius: responsiveBorderRadius.md, backgroundColor: actionColors.primary, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: layoutSpace.sm },
  continueLabel: { flexShrink: 1, textAlign: 'center', fontSize: responsiveFontSize.md, fontWeight: '600', color: uiPalette.white },
  avatarRing: {
    borderRadius: scale(96),
    borderWidth: 1,
    borderColor: 'rgba(96, 165, 250, 0.35)',
    padding: layoutSpace.xs,
    backgroundColor: 'rgba(15, 23, 42, 0.55)',
  },
  heroName: {
    fontSize: responsiveFontSize.xl,
    fontWeight: '600',
    color: uiPalette.white,
    marginTop: responsiveSpacing.xs,
    textAlign: 'left',
  },
  heroSub: {
    fontSize: fontScale(11),
    fontWeight: '600',
    color: uiPalette.muted,
    textAlign: 'left',
  },
  ageStrip: {
    flexDirection: 'row',
    gap: responsiveSpacing.md,
    marginTop: responsiveSpacing.sm,
  },
  agePreview: {
    alignItems: 'center',
    gap: layoutSpace.xs,
  },
  ageLabel: {
    fontSize: fontScale(10),
    fontWeight: '700',
    color: uiPalette.lightMuted,
  },
  heroActions: {
    flexDirection: 'row',
    gap: responsiveSpacing.sm,
  },
  pill: {
    minHeight: 44,
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    borderRadius: responsiveBorderRadius.full,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.15)',
    flexDirection: 'row',
    gap: responsiveSpacing.xs,
    paddingHorizontal: responsiveSpacing.md,
    paddingVertical: layoutSpace.sm,
  },
  pillPrimary: {
    backgroundColor: 'rgba(59, 130, 246, 0.28)',
    borderColor: 'rgba(96, 165, 250, 0.85)',
  },
  pillLabel: {
    flexShrink: 1,
    textAlign: 'center',
    fontSize: fontScale(12),
    fontWeight: '700',
    color: uiPalette.blue,
  },
  pillPrimaryLabel: {
    flexShrink: 1,
    textAlign: 'center',
    fontSize: fontScale(12),
    fontWeight: '600',
    color: uiPalette.white,
  },
  appearanceToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  appearanceToggleLabel: {
    fontSize: fontScale(13),
    fontWeight: '600',
    color: uiPalette.blue,
  },
  sectionTitle: {
    fontSize: responsiveFontSize.xl,
    fontWeight: '600',
    color: uiPalette.white,
  },
  nameRowWide: { flexDirection: 'row' },
  nameFieldWide: { flex: 1, minWidth: 0 },
  nameRow: {
    gap: responsiveSpacing.sm,
  },
  nameField: {
    gap: responsiveSpacing.xs,
  },
  inputLabel: {
    fontSize: fontScale(11),
    fontWeight: '600',
    color: uiPalette.muted,
  },
  inputWrap: {
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
    borderRadius: responsiveBorderRadius.md,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.12)',
    minHeight: 44,
    justifyContent: 'center',
    paddingHorizontal: responsiveSpacing.sm,
  },
  inputText: {
    fontSize: fontScale(14),
    fontWeight: '600',
    color: uiPalette.white,
  },
  segmentRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: responsiveSpacing.sm,
  },
  segment: {
    minHeight: 44,
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
    borderRadius: responsiveBorderRadius.full,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
    flexGrow: 1,
    minWidth: scale(92),
    paddingHorizontal: responsiveSpacing.md,
    paddingVertical: layoutSpace.compact,
  },
  segmentSelected: {
    backgroundColor: 'rgba(59, 130, 246, 0.18)',
    borderColor: 'rgba(96, 165, 250, 0.85)',
  },
  segmentLabel: {
    fontSize: fontScale(12),
    fontWeight: '700',
    textAlign: 'center',
    color: uiPalette.secondary,
  },
  segmentLabelSelected: {
    color: uiPalette.white,
  },
  fieldLabel: {
    fontSize: fontScale(11),
    fontWeight: '700',
    color: uiPalette.muted,
    marginTop: responsiveSpacing.xs,
    marginBottom: layoutSpace.xs,
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  helperText: {
    fontSize: fontScale(11),
    fontWeight: '500',
    color: uiPalette.muted,
    marginTop: responsiveSpacing.xs,
  },
});
