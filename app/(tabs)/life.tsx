import { responsiveSpacing as layoutSpace, responsiveBorderRadius as layoutRadius , fontScale, responsivePadding, scale, touchTargets } from '@/utils/scaling';
import { uiPalette } from '@/lib/config/theme';
import React, { useEffect, useRef, useState } from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Activity, Heart, ShoppingCart, Users } from 'lucide-react-native';
import ErrorBoundary from '@/components/ErrorBoundary';
import SegmentedControl from '@/components/ui/SegmentedControl';
import Freeze from '@/components/ui/Freeze';
import ScreenHeader from '@/components/ui/ScreenHeader';

import { HealthScreenContent } from './health';
import { MarketScreenContent } from './market';
import FamilyTab from '@/components/FamilyTab';
import AlertHost from '@/components/ui/AlertHost';

/**
 * Life - the merged personal tab.
 *
 * Folds the two always-on tabs the player touches least often (Health and
 * Market) into one, behind a Health / Market segmented sub-menu. Defaults to Health, so a player's vitals stay a single tap away -
 * Health simply isn't its own bottom-bar icon any more.
 *
 * Family opens from a HEADER ACTION, not a segment. It used to sit in the
 * segmented control as a fourth pill that opened a modal and left the
 * selection unchanged - an affordance lie the UI overhaul audit called out
 * (navigation problem #3: "a fake segment"). The full-screen FamilyTab -
 * spouse/partner, children, heir, pregnancy - is still the only surface that
 * manages children & the heir. `haveChild` has no other reachable caller, so
 * without this the whole children/heir subsystem was unreachable in shipped
 * builds.
 *
 * A segment mounts on its first visit and then stays mounted but hidden and
 * FROZEN (matching the layout's freezeOnBlur philosophy): it keeps its scroll
 * and sub-tab, and only the visible segment re-renders with game state.
 *
 * There is no Stats segment any more (TAB-3, owner decision 2026-10-22).
 * Achievements, prestige and legacy live on the Profile tab, the one door and
 * the one name for that screen; a gated copy here, beside an ungated tab-bar
 * button, read as a broken lock. Health and Market are never gated: health
 * decays from week 1 and food lives in Market, so locking either could strand
 * a player.
 */
type LifeSegment = 'health' | 'shop';


function LifeScreen() {
  const [segment, setSegment] = useState<LifeSegment>('health');
  // Mount-on-first-visit: an unopened segment costs nothing.
  const [visitedSegments, setVisitedSegments] = useState<Set<LifeSegment>>(
    () => new Set<LifeSegment>(['health'])
  );
  const [showFamily, setShowFamily] = useState(false);
  const router = useRouter();

  // Deep-link support: `/(tabs)/life?segment=shop` lands on a specific segment,
  // so CTAs elsewhere ("buy a computer in the Market") can point straight at
  // the Market instead of dead-ending on this shell's default segment.
  //
  // Consume-once: the params stick to the route entry for its whole life, so
  // without the ref this effect would re-fire on unrelated re-runs and yank a player who had manually switched
  // segments back to the deep-linked one. Senders include a `ts` nonce so a
  // REPEATED tap of the same CTA still lands.
  const params = useLocalSearchParams<{ segment?: string; ts?: string }>();
  const consumedDeepLinkRef = useRef<string | null>(null);
  useEffect(() => {
    const target = params.segment;
    if (!target) return;
    const key = `${target}|${params.ts ?? ''}`;
    if (consumedDeepLinkRef.current === key) return;
    consumedDeepLinkRef.current = key;
    if (target === 'health' || target === 'shop') {
      setSegment(target);
      setVisitedSegments((prev) => (prev.has(target) ? prev : new Set(prev).add(target)));
    } else if (target === 'stats') {
      // TAB-3: the Stats segment moved to the Profile tab. A link written
      // before that (an old goal row, a notification) still lands there.
      router.navigate('/(tabs)/progression');
    }
  }, [params.segment, params.ts, router]);

  return (
    <ErrorBoundary>
      <View style={styles.container}>
        {/* This shell owns the title: its children suppress their own
            headers when embedded, which used to leave the tab with a bare
            segmented control floating over unlabelled content. */}
        <ScreenHeader
          style={styles.header}
          title="Your Life"
          icon={<Activity size={scale(18)} color="#F472B6" />}
          tint="#F472B6"
          right={
            // Family is a LAUNCHER, so it lives with the header actions rather
            // than inside the segmented control, where a pill that opens a
            // modal without becoming selected reads as a broken tab (audit,
            // navigation problem #3).
            <Pressable
              onPress={() => setShowFamily(true)}
              style={({ pressed }) => [styles.familyAction, pressed && styles.familyActionPressed]}
              accessibilityRole="button"
              accessibilityLabel="Family"
              accessibilityHint="Opens your family - partner, children and heir"
            >
              <Users size={scale(14)} color="#F472B6" />
              <Text style={styles.familyActionLabel}>Family</Text>
            </Pressable>
          }
        />
        <View style={styles.controlWrap}>
          <SegmentedControl<LifeSegment>
            value={segment}
            onChange={(next) => {
              setSegment(next);
              setVisitedSegments((prev) =>
                prev.has(next) ? prev : new Set(prev).add(next)
              );
            }}
            segments={[
              { key: 'health', label: 'Health', icon: Heart },
              { key: 'shop', label: 'Market', icon: ShoppingCart },
            ]}
          />
        </View>
        {/* Each segment is mounted ONCE, on first visit, then kept alive but
            hidden. Switching used to unmount the outgoing screen, so Market
            lost its sub-tab and filters every time the player looked at
            Health. `display: none` keeps the tree
            alive without painting or laying it out, and a segment the player
            has never opened is never mounted at all.
            PERF-3: a hidden segment is also FROZEN. Each one subscribes to the
            whole game state, so `display: none` alone still re-rendered the
            invisible ones on every tap. Freeze keeps their
            state and skips their renders until they are shown again. */}
        <View style={styles.body}>
          {(['health', 'shop'] as const)
            .filter((key) => visitedSegments.has(key))
            .map((key) => (
              <View
                key={key}
                style={segment === key ? styles.segmentActive : styles.segmentHidden}
                // Hidden segments must be invisible to screen readers too,
                // otherwise VoiceOver walks every screen's content.
                accessibilityElementsHidden={segment !== key}
                importantForAccessibility={segment === key ? 'auto' : 'no-hide-descendants'}
                pointerEvents={segment === key ? 'auto' : 'none'}
              >
                <Freeze freeze={segment !== key}>
                  {key === 'health' ? (
                    <HealthScreenContent embedded />
                  ) : (
                    <MarketScreenContent embedded />
                  )}
                </Freeze>
              </View>
            ))}
        </View>
        {/*
          `statusBarTranslucent` so Android matches iOS's fullScreen
          presentation: the modal owns the full window and FamilyTab pads its
          own header by `insets.top`. Without it Android would inset the modal
          AND FamilyTab would inset again, double-padding the header.
        */}
        <Modal
          visible={showFamily}
          animationType="slide"
          presentationStyle="fullScreen"
          statusBarTranslucent
          onRequestClose={() => setShowFamily(false)}
        >
          <FamilyTab onClose={() => setShowFamily(false)} />
          {/* iOS presents an RN Modal from the view controller nearest its mount
              point, so the ROOT AlertHost's dialog cannot present while this Modal
              covers the screen - the tap that raised it looks dead. This nested
              host registers on top of the gameAlert stack while this Modal is up.
              See __tests__/tooling/nestedAlertHosts.test.ts. */}
          <AlertHost />
        </Modal>
      </View>
    </ErrorBoundary>
  );
}

const styles = StyleSheet.create({
  header: {
    paddingTop: layoutSpace.sm,
  },
  container: {
    flex: 1,
    backgroundColor: uiPalette.navy,
  },
  controlWrap: {
    paddingHorizontal: responsivePadding.horizontal,
    paddingTop: layoutSpace.xs,
    paddingBottom: layoutSpace.xs,
  },
  body: {
    flex: 1,
  },
  segmentActive: {
    flex: 1,
  },
  segmentHidden: {
    display: 'none',
  },
  // Header launcher chip - tinted like the screen's own accent, full border on
  // all four sides (Hard Rule #7).
  familyAction: {
    minHeight: touchTargets.minimum,
    minWidth: touchTargets.minimum,
    flexDirection: 'row',
    alignItems: 'center',
    gap: layoutSpace.xs,
    paddingHorizontal: layoutSpace.compact,
    paddingVertical: layoutSpace.sm,
    borderRadius: layoutRadius.md,
    backgroundColor: 'rgba(244, 114, 182, 0.12)',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(244, 114, 182, 0.35)',
  },
  familyActionPressed: {
    opacity: 0.72,
  },
  familyActionLabel: {
    fontSize: fontScale(12.5),
    fontWeight: '600',
    color: '#F472B6',
  },
});

export default React.memo(LifeScreen);
