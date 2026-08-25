import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Alert, Animated, Easing, Image, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { CloudDownload, History, Play, Trash2 } from 'lucide-react-native';
import ConfirmDialog from '@/components/ConfirmDialog';
import RestoreBackupSheet from '@/components/onboarding/RestoreBackupSheet';
import OnboardingGlassHeader from '@/components/onboarding/OnboardingGlassHeader';
import OnboardingFloatingButton from '@/components/onboarding/OnboardingFloatingButton';
import Skeleton from '@/components/anim/Skeleton';
// Leaf context, not the @/contexts/GameContext barrel - the barrel's eager
// `export * from './game'` pulled the whole provider graph into this screen's
// module init and caused a production require-cycle (undefined screen export).
import { useGameActions } from '@/contexts/game/GameActionsContext';
import { useReducedMotion } from '@/hooks/useReducedMotion';
import { useOnboarding } from '@/src/features/onboarding/OnboardingContext';
import { NEW_LIFE_SLOT_UNSET } from '@/src/features/onboarding/slotSafety';
import { isSaveFromFutureError, SAVE_FROM_FUTURE_MESSAGE } from '@/utils/saveMigrations';
import { type SaveSlotData, checkIfAllSlotsFull } from '@/src/features/onboarding/saveSlotHelpers';
import {
  readSaveSlotMeta,
  ensureSaveSlotMeta,
  deleteSaveSlotMeta,
  probeSaveSlotBlob,
} from '@/utils/saveSlotMeta';
import { logOnboardingStepView } from '@/src/features/onboarding/onboardingAnalytics';
import { logger } from '@/utils/logger';
import { MENU_BACKGROUNDS, peekMenuBackgroundIndex } from '@/utils/menuBackground';
import { useHardwareBack } from '@/hooks/useHardwareBack';
import { formatMoney } from '@/utils/moneyFormatting';
import { lazyAsyncStorage as AsyncStorage } from '@/utils/storageWrapper';
// deleteAllBackupsForSlot + clearProtectedState still run on slot delete so a
// removed slot doesn't leave orphaned backups/protected state behind. The manual
// user-facing backup UI is gone; the automatic backup machinery is untouched.
import { clearProtectedState, deleteAllBackupsForSlot } from '@/utils/saveBackup';
import { validateGameEntry, validateSaveSlot } from '@/utils/gameEntryValidation';
// Cloud device backup (flag-gated, `cloudSave`). Both helpers no-op when the
// flag is off, so nothing here can reach the network in a default build.
import { isCloudBackupEnabled, probeCloudSlot, restoreCloudSaveToSlot } from '@/services/cloudBackup';
import { getPlatformShadows } from '@/utils/glassmorphismStyles';
import {
  fontScale,
  responsiveBorderRadius,
  responsivePadding,
  responsiveSpacing,
  scale,
  verticalScale,
} from '@/utils/scaling';

// Near-black base matched to the in-game home screen (#020617) and the main
// menu so the whole pre-game flow reads as one dark aesthetic.
const PAGE_BG = '#020617';

// Slot stats come from raw persisted JSON (no repair pass has run), so a
// corrupt snapshot can carry NaN/Infinity/negative numbers - clamp for display.
const safeStatNumber = (n: unknown): number =>
  typeof n === 'number' && Number.isFinite(n) ? Math.max(0, n) : 0;

/**
 * Staggered entrance wrapper - opacity + a short translateY rise, native-driven,
 * ease-out, no bounce. Honors the OS "Reduce Motion" setting by rendering static.
 */
function RevealItem({
  index,
  reduced,
  children,
}: {
  index: number;
  reduced: boolean;
  children: React.ReactNode;
}) {
  const progress = useRef(new Animated.Value(reduced ? 1 : 0)).current;

  useEffect(() => {
    if (reduced) {
      progress.setValue(1);
      return;
    }
    const animation = Animated.timing(progress, {
      toValue: 1,
      duration: 240,
      delay: index * 55,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    });
    animation.start();
    return () => animation.stop();
  }, [index, reduced, progress]);

  const translateY = progress.interpolate({ inputRange: [0, 1], outputRange: [10, 0] });
  return <Animated.View style={{ opacity: progress, transform: [{ translateY }] }}>{children}</Animated.View>;
}

export default function SaveSlots() {
  const log = logger.scope('SaveSlots');
  const router = useRouter();
  const navigation = useNavigation();
  const insets = useSafeAreaInsets();
  const reduced = useReducedMotion();
  const { state, setState } = useOnboarding();
  const { loadGame } = useGameActions();
  const [slots, setSlots] = useState<SaveSlotData[]>([]);
  const [selectedSlot, setSelectedSlot] = useState<number | null>(state.slot || null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState<number | null>(null);
  // The slot whose restore points are open. A slot marked "Recovery Needed"
  // used to offer nothing but Delete - the button that destroyed the last copy
  // of the save the player came here to rescue (2026-07-29 audit BRC-1).
  const [restoreSlot, setRestoreSlot] = useState<number | null>(null);
  // This screen's background artwork index (null until the shared cycle counter
  // is peeked - the flat PAGE_BG shows meanwhile). PEEK, not take: the main menu
  // owns advancing the cycle, so revisiting slots never rotates the artwork.
  const [bgIndex, setBgIndex] = useState<number | null>(null);

  useEffect(() => {
    logOnboardingStepView('SaveSlots');
  }, []);

  // Mount-only: peek this launch's shared menu background. peekMenuBackgroundIndex
  // never throws (boot-safe leaf), so no catch is needed.
  useEffect(() => {
    let cancelled = false;
    void peekMenuBackgroundIndex().then((index) => {
      if (!cancelled) setBgIndex(index);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  // R3-C: Android hardware back → return to the main menu instead of leaving
  // the user on a half-loaded scene with no exit affordance.
  const handleBack = useCallback(() => {
    if (navigation.canGoBack()) {
      router.back();
      return;
    }
    // L: go straight to the menu. "/" is the boot loader, which would
    // re-mount the full loading screen + preload before bouncing here.
    router.replace('/(onboarding)/MainMenu');
  }, [navigation, router]);

  useHardwareBack(() => {
    handleBack();
    return true;
  });

  const [isBusy, setIsBusy] = useState(false);
  // Slots start empty and load async. Until the first load resolves, `selectedCard`
  // is null even for an occupied slot, so acting on the primary button in that
  // window could start a new life on top of an existing save. Gate on this flag.
  const [slotsLoaded, setSlotsLoaded] = useState(false);
  // R7 SB-6: synchronous re-entry guard. `isBusy` is a state flag - two rapid
  // taps within the same render cycle BOTH see `isBusy === false` because the
  // state update hasn't flushed yet, so both enter the load path and race for
  // `loadGame` + `router.push`. The ref short-circuits the second tap
  // synchronously; the state flag continues to drive the loading UI.
  const continueInFlightRef = useRef(false);
  // Same synchronous guard for the new-game path (previously only `isBusy`).
  const newGameInFlightRef = useRef(false);

  const selectedCard = useMemo(
    () => slots.find((slot) => slot.id === selectedSlot) ?? null,
    [selectedSlot, slots]
  );

  const loadSlots = useCallback(async () => {
    try {
      // Data-source swap: read the tiny per-slot summary cache instead of
      // HMAC-decoding + JSON.parsing all three multi-MB blobs on every visit.
      // The only decode+parse now lives inside ensureSaveSlotMeta's one-time
      // backfill (cold path), so the list paints instantly on revisits.
      const resolveSlot = async (i: number): Promise<SaveSlotData> => {
        try {
          let meta = await readSaveSlotMeta(i);
          if (!meta) meta = await ensureSaveSlotMeta(i);

          if (meta) {
            // Map the summary onto the fields the card already reads. `name` is
            // the pre-combined "First Last"; stashing it as firstName keeps the
            // existing `${firstName} ${lastName}`.trim() rendering unchanged.
            return {
              id: i,
              hasData: true,
              userProfile: { firstName: meta.name },
              stats: { money: meta.money },
              date: { age: meta.age },
              weeksLived: meta.weeksLived,
            };
          }

          // No usable summary: tell an EMPTY slot from an UNREADABLE one with a
          // raw blob-existence probe (no decode/parse). An existing-but-
          // unsummarizable blob is treated as "needs recovery" so Start New Game
          // can never silently overwrite a possibly-recoverable save.
          const probe = await probeSaveSlotBlob(i);
          // 'exists' (blob present but unsummarizable) AND 'unknown' (storage
          // read failed) both surface as recovery-needed - only a confirmed
          // 'empty' may offer Start New Game, so a transient read failure can
          // never invite overwriting recoverable data.
          return probe === 'empty' ? { id: i, hasData: false } : { id: i, hasData: false, error: true };
        } catch (slotError) {
          log.error(`Failed resolving slot ${i}`, slotError);
          return { id: i, hasData: false, error: true };
        }
      };

      const slotData = await Promise.all([1, 2, 3].map(resolveSlot));
      setSlots(slotData);
    } catch (error) {
      log.error('Failed loading slots', error);
    } finally {
      setSlotsLoaded(true);
    }
  }, [log]);

  useEffect(() => {
    void loadSlots();
  }, [loadSlots]);

  useFocusEffect(
    useCallback(() => {
      void loadSlots();
    }, [loadSlots])
  );

  // ── Cloud backup offers ──────────────────────────────────────────────────
  // Slot id → the cloud copy's `weeksLived`, present only when that copy is
  // AHEAD of the local slot. `weeksLived` is the absolute counter (§4.2), and
  // it is the same measure `hydrateRemoteState` uses to refuse a regression, so
  // an offer shown here can never be refused as "older" when it is tapped.
  const [cloudOffers, setCloudOffers] = useState<Record<number, number>>({});
  const [cloudRestoreSlot, setCloudRestoreSlot] = useState<number | null>(null);
  const cloudEnabled = isCloudBackupEnabled();

  const localWeeksForSlot = useCallback(
    (slotId: number) => {
      const slot = slots.find((s) => s.id === slotId);
      return slot?.hasData ? safeStatNumber(slot.weeksLived) : 0;
    },
    [slots]
  );

  // The probe INPUTS as one stable primitive - `id:localWeeks` per slot, which
  // is exactly what `probeCloudSlot` is given and all that can change its
  // answer. Keyed on the `slots` ARRAY instead, the probe effect re-ran on every
  // identity change, and `loadSlots` builds a fresh array on mount, on every
  // focus pass, and again after a cloud restore - so returning to this screen
  // re-downloaded every save several times over.
  const cloudProbeKey = useMemo(
    () => slots.map((slot) => `${slot.id}:${slot.hasData ? safeStatNumber(slot.weeksLived) : 0}`).join('|'),
    [slots]
  );

  // Probed AFTER the local slots have painted - each probe downloads a save, so
  // it must never be on the path that renders the list. The three probes are
  // independent, so they run CONCURRENTLY; sequencing them stacked three full
  // downloads end to end for no gain.
  useEffect(() => {
    if (!cloudEnabled || !slotsLoaded || cloudProbeKey === '') return undefined;
    let cancelled = false;
    // Rebuilt from the key rather than closed over `slots`, so the effect
    // depends only on the primitive above.
    const targets = cloudProbeKey.split('|').map((entry) => {
      const [id, localWeeks] = entry.split(':');
      return { id: Number(id), localWeeks: Number(localWeeks) };
    });
    void (async () => {
      // probeCloudSlot resolves `null` on any failure (it catches internally),
      // so one unreachable slot cannot reject the batch.
      const probes = await Promise.all(
        targets.map(async ({ id, localWeeks }) => ({ id, probe: await probeCloudSlot(id, localWeeks) }))
      );
      if (cancelled) return;
      const offers: Record<number, number> = {};
      for (const { id, probe } of probes) {
        // Only when the cloud copy is AHEAD - restoring must be able to gain
        // something, and `hydrateRemoteState` would refuse an older one anyway.
        if (probe?.newer) offers[id] = probe.remoteWeeks;
      }
      setCloudOffers(offers);
    })();
    return () => {
      cancelled = true;
    };
  }, [cloudEnabled, cloudProbeKey, slotsLoaded]);

  const restoreSlotFromCloud = useCallback(
    async (slotId: number) => {
      setIsBusy(true);
      try {
        const outcome = await restoreCloudSaveToSlot(slotId, localWeeksForSlot(slotId));
        Alert.alert(
          outcome.status === 'applied'
            ? 'Cloud Backup Restored'
            : outcome.status === 'older'
              ? 'Cloud Save Is Older'
              : 'Nothing Restored',
          outcome.message
        );
        if (outcome.status === 'applied') {
          setCloudOffers((prev) => {
            const next = { ...prev };
            delete next[slotId];
            return next;
          });
          await loadSlots();
        }
      } finally {
        setIsBusy(false);
      }
    },
    [loadSlots, localWeeksForSlot]
  );

  const selectSlot = (slotId: number) => {
    setSelectedSlot(slotId);
    setState((prev) => ({ ...prev, slot: slotId }));
  };

  const continueToGame = async () => {
    // R7 SB-6: ref guard runs BEFORE state read. Rapid double-tap can't
    // race past the state flush because the ref is mutated synchronously.
    if (continueInFlightRef.current) return;
    if (!selectedSlot || isBusy) return;

    const slot = slots.find((s) => s.id === selectedSlot);
    if (!slot || !slot.hasData) {
      continueInFlightRef.current = true;
      try {
        await startNewGame();
      } finally {
        continueInFlightRef.current = false;
      }
      return;
    }

    continueInFlightRef.current = true;
    setIsBusy(true);
    // Yield one frame so the busy spinner paints before the heavy load
    // (validate + JSON parse + migrate) blocks the JS thread.
    await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
    try {
      const slotValidation = await validateSaveSlot(selectedSlot);
      if (!slotValidation.valid) {
        const errorMessage =
          slotValidation.errors.find((e) => e.includes('version')) ||
          slotValidation.errors.find((e) => e.includes('corrupted')) ||
          slotValidation.errors[0] ||
          'This save file cannot be loaded.';

        Alert.alert('Save Unavailable', errorMessage);
        return;
      }

      const loadedState = await loadGame(selectedSlot);
      if (!loadedState) {
        Alert.alert('No Save Found', 'No save data found for this slot. Please select another slot.');
        return;
      }

      const validation = validateGameEntry(loadedState);
      if (!validation.canEnter) {
        Alert.alert('Invalid Save', validation.errors[0] || 'This save cannot be loaded right now.');
        return;
      }

      setTimeout(() => {
        router.push('/(tabs)/home');
      }, 80);
    } catch (error) {
      if (isSaveFromFutureError(error)) {
        log.warn('Save is from a newer app version', { slot: selectedSlot });
        Alert.alert('Newer Save Found', SAVE_FROM_FUTURE_MESSAGE);
        return;
      }
      log.error('Error continuing game', error);
      Alert.alert('Load Error', 'An error occurred while loading your save. Please try again.');
    } finally {
      setIsBusy(false);
      continueInFlightRef.current = false;
    }
  };

  const deleteSlot = async (slotId: number) => {
    try {
      const { deleteSaveSlot } = await import('@/utils/saveValidation');
      await deleteSaveSlot(slotId);
      await deleteAllBackupsForSlot(slotId);
      await clearProtectedState(slotId);
      // Clear the cached summary too so a stale name/age can never linger after
      // the blob is gone (loadSlots below reads the summary cache first). Awaited
      // to close the race with that reload.
      await deleteSaveSlotMeta(slotId);

      if (selectedSlot === slotId) {
        setSelectedSlot(null);
        // Deliberately UNSET, not 'slot 1'. The onboarding write refuses an
        // unset slot rather than picking one (src/features/onboarding/slotSafety.ts).
        setState((prev) => ({ ...prev, slot: NEW_LIFE_SLOT_UNSET }));
      }

      // DATA-LOSS FIX (same root cause as the currentSlot desync): if the
      // persisted slot markers point at the slot we just deleted, MainMenu's
      // Continue would try to load a now-empty slot. Repoint them to another
      // slot that still has playable data, or clear them if none remains.
      try {
        const [lastSlotRaw, currentSlotRaw] = await Promise.all([
          AsyncStorage.getItem('lastSlot'),
          AsyncStorage.getItem('currentSlot'),
        ]);
        const pointsAtDeleted = (raw: string | null) =>
          raw !== null && parseInt(raw, 10) === slotId;

        if (pointsAtDeleted(lastSlotRaw) || pointsAtDeleted(currentSlotRaw)) {
          let repointTo: number | null = null;
          for (let i = 1; i <= 3; i++) {
            if (i === slotId) continue;
            // A cached summary exists only for a meaningful, playable save, so its
            // presence is exactly the "has playable data" test the old decode+
            // parse scan performed - without touching the multi-MB blob.
            const meta = (await readSaveSlotMeta(i)) ?? (await ensureSaveSlotMeta(i));
            if (meta) {
              repointTo = i;
              break;
            }
          }

          if (repointTo !== null) {
            if (pointsAtDeleted(lastSlotRaw)) await AsyncStorage.setItem('lastSlot', String(repointTo));
            if (pointsAtDeleted(currentSlotRaw)) await AsyncStorage.setItem('currentSlot', String(repointTo));
          } else {
            const keysToClear: string[] = [];
            if (pointsAtDeleted(lastSlotRaw)) keysToClear.push('lastSlot');
            if (pointsAtDeleted(currentSlotRaw)) keysToClear.push('currentSlot');
            if (keysToClear.length > 0) await AsyncStorage.multiRemove(keysToClear);
          }
        }
      } catch (markerError) {
        log.warn('Failed to repoint slot markers after delete (non-critical)', { error: markerError });
      }

      await loadSlots();
    } catch (error) {
      log.error('Failed deleting slot', error);
      Alert.alert('Delete Failed', 'Could not delete this slot. Please try again.');
    } finally {
      setShowDeleteConfirm(null);
    }
  };

  const startNewGame = useCallback(async () => {
    if (newGameInFlightRef.current) return;
    if (isBusy) return;

    if (selectedCard?.hasData) {
      Alert.alert('Slot Occupied', 'Please pick an empty slot to start a new game.');
      return;
    }

    newGameInFlightRef.current = true;
    setIsBusy(true);
    // Yield one frame so the busy spinner paints before the slot scan.
    await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
    try {
      const allSlotsFull = await checkIfAllSlotsFull();
      if (allSlotsFull) {
        Alert.alert(
          'All Save Slots Full',
          'All 3 save slots are full. Delete one to create a new life.'
        );
        return;
      }

      router.push('/(onboarding)/Scenarios');
    } finally {
      setIsBusy(false);
      newGameInFlightRef.current = false;
    }
  }, [isBusy, router, selectedCard]);

  const primaryAction = async () => {
    if (!selectedSlot) {
      Alert.alert('Select A Slot', 'Choose a slot first to continue.');
      return;
    }
    if (selectedCard?.hasData) {
      await continueToGame();
      return;
    }
    await startNewGame();
  };

  return (
    <View style={styles.root}>
      {/* This launch's shared menu artwork behind everything (pure decoration),
          under a single flat scrim for text contrast - no gradients, so the
          fallback renderer can never reintroduce a seam. Slightly stronger scrim
          (0.6) than the menu because this screen carries denser text. */}
      {bgIndex != null && (
        <View pointerEvents="none" style={StyleSheet.absoluteFill}>
          <Image
            source={MENU_BACKGROUNDS[bgIndex]}
            resizeMode="cover"
            style={StyleSheet.absoluteFill}
            accessibilityIgnoresInvertColors
          />
          <View style={styles.bgScrim} />
        </View>
      )}

      <View style={[styles.content, { paddingTop: insets.top }]}>
        <OnboardingGlassHeader
          title="Save Slots"
          onBack={handleBack}
          onInfo={() =>
            Alert.alert(
              'Save Slots',
              'Pick an empty slot for a new life or select an existing slot to continue.'
            )
          }
        />

        <ScrollView
          style={styles.scrollContainer}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          {/* Slot metadata loads async; a blank list here is the app's highest-
              anxiety blank screen ("did my saves survive?"). Show three slot-
              shaped placeholders until the real cards arrive. */}
          {!slotsLoaded &&
            slots.length === 0 &&
            [1, 2, 3].map((id) => (
              <View key={`placeholder-${id}`} style={styles.card} accessibilityLabel="Loading save slots">
                <Skeleton height={scale(18)} radius={6} style={{ width: '35%' }} />
                <Skeleton height={scale(14)} radius={6} style={{ width: '60%' }} />
                <Skeleton height={scale(30)} radius={8} />
              </View>
            ))}
          {slots.map((slot, index) => {
            const isSelected = selectedSlot === slot.id;
            // An error slot has unreadable data (hasData=false) - it must never
            // present as empty: that path enables "Start New Game", silently
            // overwriting whatever the unreadable payload was.
            const needsRecovery = !!slot.error;
            const statusText = needsRecovery ? 'Recovery Needed' : slot.hasData ? 'Playable' : 'Empty';
            const statusColor = needsRecovery ? '#F97316' : slot.hasData ? '#60A5FA' : '#94A3B8';
            const fullName = `${slot.userProfile?.firstName || ''} ${slot.userProfile?.lastName || ''}`.trim();
            // `undefined` means "no cloud copy, or one that is not ahead of this
            // slot" - the offer is only shown when restoring can gain something.
            const cloudOffer = cloudOffers[slot.id];

            return (
              <RevealItem key={slot.id} index={index} reduced={reduced}>
                <TouchableOpacity
                  accessibilityRole="button"
                  accessibilityLabel={`Save slot ${slot.id}, ${
                    slot.hasData ? fullName || 'Unnamed Character' : needsRecovery ? 'needs recovery' : 'empty'
                  }`}
                  activeOpacity={0.9}
                  onPress={() => selectSlot(slot.id)}
                  style={[styles.card, isSelected && styles.cardSelected]}
                >
                  <View style={styles.slotHeader}>
                    <Text style={styles.slotTitle}>Slot {slot.id}</Text>
                    <View
                      style={[
                        styles.statusChip,
                        { backgroundColor: `${statusColor}1A`, borderColor: `${statusColor}44` },
                      ]}
                    >
                      <Text style={[styles.statusChipText, { color: statusColor }]}>{statusText}</Text>
                    </View>
                  </View>

                  <Text style={[styles.slotName, !slot.hasData && styles.slotNameEmpty]} numberOfLines={1}>
                    {slot.hasData
                      ? fullName || 'Unnamed Character'
                      : needsRecovery
                        ? 'Unreadable save - try Restore, or delete to reuse this slot'
                        : 'Start a new life here'}
                  </Text>

                  {slot.hasData ? (
                    <View style={styles.statsRow}>
                      <View style={styles.statBlock}>
                        <Text style={styles.statLabel}>Money</Text>
                        <Text style={styles.statValue}>{formatMoney(safeStatNumber(slot.stats?.money))}</Text>
                      </View>
                      <View style={styles.statBlock}>
                        <Text style={styles.statLabel}>Age</Text>
                        <Text style={styles.statValue}>{Math.floor(safeStatNumber(slot.date?.age))}</Text>
                      </View>
                      <View style={styles.statBlock}>
                        <Text style={styles.statLabel}>Weeks</Text>
                        <Text style={styles.statValue}>{Math.floor(safeStatNumber(slot.weeksLived))}</Text>
                      </View>
                    </View>
                  ) : null}

                  {cloudOffer !== undefined ? (
                    <Text style={styles.cloudOfferText}>
                      {`Cloud backup available - week ${Math.floor(cloudOffer)}`}
                    </Text>
                  ) : null}

                  {slot.hasData || needsRecovery || cloudOffer !== undefined ? (
                    <View style={styles.slotFooter}>
                      {cloudOffer !== undefined ? (
                        <TouchableOpacity
                          accessibilityRole="button"
                          accessibilityLabel={`Restore slot ${slot.id} from its cloud backup`}
                          onPress={() => setCloudRestoreSlot(slot.id)}
                          disabled={isBusy}
                          style={styles.cloudAction}
                          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                        >
                          <CloudDownload size={scale(14)} color="#FBBF24" />
                          <Text style={styles.cloudActionText}>Restore Cloud</Text>
                        </TouchableOpacity>
                      ) : null}
                      {slot.hasData || needsRecovery ? (
                        <>
                          <TouchableOpacity
                            accessibilityRole="button"
                            accessibilityLabel={`Restore slot ${slot.id} from an earlier point`}
                            onPress={() => setRestoreSlot(slot.id)}
                            style={styles.restoreAction}
                            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                          >
                            <History size={scale(14)} color="#38BDF8" />
                            <Text style={styles.restoreText}>Restore</Text>
                          </TouchableOpacity>
                          <TouchableOpacity
                            accessibilityRole="button"
                            accessibilityLabel={`Delete slot ${slot.id}`}
                            onPress={() => setShowDeleteConfirm(slot.id)}
                            style={styles.deleteAction}
                            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                          >
                            <Trash2 size={scale(14)} color="#F87171" />
                            <Text style={styles.deleteText}>Delete Slot</Text>
                          </TouchableOpacity>
                        </>
                      ) : null}
                    </View>
                  ) : null}
                </TouchableOpacity>
              </RevealItem>
            );
          })}

          <View style={{ height: verticalScale(140) }} />
        </ScrollView>
      </View>

      <View style={[styles.floatingWrap, { bottom: verticalScale(20) + insets.bottom }]}>
        <OnboardingFloatingButton
          title={
            selectedCard?.error && !selectedCard?.hasData
              ? 'Delete Slot to Continue'
              : selectedCard?.hasData
                ? 'Continue Game'
                : 'Start New Game'
          }
          onPress={() => {
            void primaryAction();
          }}
          disabled={!selectedSlot || isBusy || !slotsLoaded || (!!selectedCard?.error && !selectedCard?.hasData)}
          loading={isBusy}
          icon={<Play size={24} color="#FFFFFF" />}
        />
      </View>

      <RestoreBackupSheet
        visible={restoreSlot !== null}
        slot={restoreSlot}
        onClose={() => setRestoreSlot(null)}
        onRestored={(slot) => {
          // The blob changed underneath the cached summary; drop it and rescan
          // so the card shows the restored character, not the replaced one.
          void deleteSaveSlotMeta(slot)
            .catch(() => {})
            .then(() => loadSlots());
        }}
      />

      <ConfirmDialog
        visible={cloudRestoreSlot !== null}
        title="Restore Cloud Backup?"
        message="This replaces this slot's save with the cloud backup. The save currently in the slot cannot be recovered afterwards."
        confirmText="Restore"
        cancelText="Cancel"
        destructive
        type="danger"
        onConfirm={() => {
          const slotId = cloudRestoreSlot;
          setCloudRestoreSlot(null);
          if (slotId !== null) void restoreSlotFromCloud(slotId);
        }}
        onCancel={() => setCloudRestoreSlot(null)}
      />

      <ConfirmDialog
        visible={showDeleteConfirm !== null}
        title="Delete Save Slot?"
        message="This removes the selected save and its backups. This action cannot be undone."
        confirmText="Delete"
        cancelText="Cancel"
        destructive
        type="danger"
        onConfirm={() => {
          if (showDeleteConfirm !== null) {
            void deleteSlot(showDeleteConfirm);
          }
        }}
        onCancel={() => setShowDeleteConfirm(null)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: PAGE_BG,
  },
  // One flat veil over the artwork so slot cards and dense stats keep full
  // contrast on every image. Deliberately ONE layer - no gradient/stepped scrim.
  bgScrim: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(2, 6, 23, 0.6)',
  },
  content: {
    flex: 1,
  },
  scrollContainer: {
    flex: 1,
  },
  scrollContent: {
    gap: responsiveSpacing.md,
    paddingHorizontal: responsivePadding.large,
    paddingTop: responsiveSpacing.sm,
    paddingBottom: responsiveSpacing.lg,
  },
  card: {
    backgroundColor: 'rgba(30, 41, 59, 0.9)',
    borderRadius: responsiveBorderRadius.xl,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    padding: responsiveSpacing.lg,
    gap: responsiveSpacing.sm,
    ...getPlatformShadows(6, 0.25, 4, 14),
  },
  cardSelected: {
    borderColor: '#3B82F6',
    borderWidth: 1.5,
    backgroundColor: 'rgba(37, 99, 235, 0.12)',
  },
  slotHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  slotTitle: {
    fontSize: fontScale(18),
    fontWeight: '800',
    color: '#F8FAFC',
  },
  statusChip: {
    borderRadius: responsiveBorderRadius.full,
    borderWidth: 1,
    paddingHorizontal: responsiveSpacing.sm,
    paddingVertical: verticalScale(4),
  },
  statusChipText: {
    fontSize: fontScale(11),
    fontWeight: '700',
  },
  slotName: {
    fontSize: fontScale(15),
    fontWeight: '700',
    color: '#F8FAFC',
  },
  slotNameEmpty: {
    fontWeight: '500',
    color: '#94A3B8',
  },
  statsRow: {
    flexDirection: 'row',
    gap: responsiveSpacing.sm,
  },
  statBlock: {
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderRadius: responsiveBorderRadius.md,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    flex: 1,
    paddingHorizontal: responsiveSpacing.sm,
    paddingVertical: verticalScale(8),
  },
  statLabel: {
    fontSize: fontScale(10),
    fontWeight: '600',
    color: '#94A3B8',
    marginBottom: verticalScale(2),
  },
  statValue: {
    fontSize: fontScale(12.5),
    fontWeight: '800',
    color: '#FFFFFF',
  },
  slotFooter: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: scale(16),
  },
  restoreAction: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: scale(6),
    paddingVertical: verticalScale(4),
  },
  cloudOfferText: {
    color: '#FBBF24',
    fontSize: fontScale(11.5),
    fontWeight: '600',
  },
  cloudAction: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: scale(6),
    marginRight: 'auto',
    paddingVertical: verticalScale(4),
  },
  cloudActionText: {
    color: '#FBBF24',
    fontSize: fontScale(12),
    fontWeight: '700',
  },
  restoreText: {
    color: '#38BDF8',
    fontSize: fontScale(12),
    fontWeight: '700',
  },
  deleteAction: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: scale(6),
    paddingVertical: verticalScale(4),
  },
  deleteText: {
    color: '#F87171',
    fontSize: fontScale(12),
    fontWeight: '700',
  },
  floatingWrap: {
    position: 'absolute',
    left: responsivePadding.large,
    right: responsivePadding.large,
    zIndex: 10,
  },
});
