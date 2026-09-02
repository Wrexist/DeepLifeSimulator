import React, { useEffect, useRef, useState } from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { Activity, Heart, ShoppingCart, Trophy, Users } from 'lucide-react-native';
import ErrorBoundary from '@/components/ErrorBoundary';
import SegmentedControl from '@/components/ui/SegmentedControl';
import ScreenHeader from '@/components/ui/ScreenHeader';
import { fontScale, responsivePadding, scale } from '@/utils/scaling';
import { useGame } from '@/contexts/GameContext';
import { isFeatureUnlocked, unlockRequirement } from '@/lib/progress/featureUnlocks';
import { HealthScreenContent } from './health';
import { MarketScreenContent } from './market';
import { ProgressionScreenContent } from './progression';
import FamilyTab from '@/components/FamilyTab';
import { gameAlert } from '@/utils/gameAlert';

/**
 * Life - the merged personal tab.
 *
 * Folds the three always-on tabs the player touches least often (Health,
 * Market, Progress) into one, behind a Health / Shop / Stats segmented
 * sub-menu. Defaults to Health, so a player's vitals stay a single tap away -
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
 * Only the active segment is mounted (matching the layout's freezeOnBlur
 * philosophy): keeping all three heavy screens live at once would undo the
 * whole point of trimming the tab bar. Switching segments remounts, which is
 * the same reset you'd get switching bottom tabs before.
 *
 * Stats is the one segment behind a progressive-disclosure gate. It holds
 * achievements, prestige and legacy - dense, and none of it actionable in
 * week 1. Health and Market are never gated: health decays from week 1 and
 * food lives in Market, so locking either could strand a player.
 */
type LifeSegment = 'health' | 'shop' | 'stats';


function LifeScreen() {
  const [segment, setSegment] = useState<LifeSegment>('health');
  // Mount-on-first-visit: an unopened segment costs nothing.
  const [visitedSegments, setVisitedSegments] = useState<Set<LifeSegment>>(
    () => new Set<LifeSegment>(['health'])
  );
  const [showFamily, setShowFamily] = useState(false);
  // This shell re-renders with game state, but all three of its children are
  // already subscribed and only one is mounted, so the added cost is a
  // 4-segment control - not a screen's worth of work.
  const { gameState } = useGame();

  const statsLocked = !isFeatureUnlocked(gameState, 'tab:progression');
  const statsReason = unlockRequirement(gameState, 'tab:progression');

  // Deep-link support: `/(tabs)/life?segment=shop` lands on a specific segment,
  // so CTAs elsewhere ("buy a computer in the Market") can point straight at
  // the Market instead of dead-ending on this shell's default segment.
  //
  // Consume-once: the params stick to the route entry for its whole life, so
  // without the ref this effect would re-fire on unrelated re-runs (e.g. the
  // stats gate unlocking mid-game) and yank a player who had manually switched
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
    if (target === 'health' || target === 'shop' || (target === 'stats' && !statsLocked)) {
      setSegment(target);
      setVisitedSegments((prev) => (prev.has(target) ? prev : new Set(prev).add(target)));
    }
  }, [params.segment, params.ts, statsLocked]);

  return (
    <ErrorBoundary>
      <View style={styles.container}>
        {/* This shell owns the title: its three children suppress their own
            headers when embedded, which used to leave the tab with a bare
            segmented control floating over unlabelled content. */}
        <ScreenHeader
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
            onLockedPress={(_key, reason) => {
              gameAlert('Stats', reason || 'Keep playing to unlock this.');
            }}
            segments={[
              { key: 'health', label: 'Health', icon: Heart },
              { key: 'shop', label: 'Market', icon: ShoppingCart },
              { key: 'stats', label: 'Stats', icon: Trophy, locked: statsLocked, lockReason: statsReason },
            ]}
          />
        </View>
        {/* Each segment is mounted ONCE, on first visit, then kept alive but
            hidden. Switching used to unmount the outgoing screen, so Market
            lost its sub-tab and filters and Progression lost its scroll every
            time the player looked at Health. `display: none` keeps the tree
            alive without painting or laying it out, and a segment the player
            has never opened is never mounted at all. */}
        <View style={styles.body}>
          {(['health', 'shop', 'stats'] as const)
            .filter((key) => visitedSegments.has(key))
            .map((key) => (
              <View
                key={key}
                style={segment === key ? styles.segmentActive : styles.segmentHidden}
                // Hidden segments must be invisible to screen readers too,
                // otherwise VoiceOver walks three screens' worth of content.
                accessibilityElementsHidden={segment !== key}
                importantForAccessibility={segment === key ? 'auto' : 'no-hide-descendants'}
                pointerEvents={segment === key ? 'auto' : 'none'}
              >
                {key === 'health' ? (
                  <HealthScreenContent embedded />
                ) : key === 'shop' ? (
                  <MarketScreenContent embedded />
                ) : (
                  <ProgressionScreenContent embedded />
                )}
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
        </Modal>
      </View>
    </ErrorBoundary>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#020617',
  },
  controlWrap: {
    paddingHorizontal: responsivePadding.horizontal,
    paddingTop: scale(8),
    paddingBottom: scale(8),
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
    flexDirection: 'row',
    alignItems: 'center',
    gap: scale(6),
    paddingHorizontal: scale(12),
    paddingVertical: scale(8),
    borderRadius: scale(10),
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
