import React, { useEffect, useRef, useState } from 'react';
import { Alert, Modal, StyleSheet, View } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { Heart, ShoppingCart, Trophy, Users } from 'lucide-react-native';
import ErrorBoundary from '@/components/ErrorBoundary';
import SegmentedControl from '@/components/ui/SegmentedControl';
import { responsivePadding, scale } from '@/utils/scaling';
import { useGame } from '@/contexts/GameContext';
import { isFeatureUnlocked, unlockRequirement } from '@/lib/progress/featureUnlocks';
import { HealthScreenContent } from './health';
import { MarketScreenContent } from './market';
import { ProgressionScreenContent } from './progression';
import FamilyTab from '@/components/FamilyTab';

/**
 * Life - the merged personal tab.
 *
 * Folds the three always-on tabs the player touches least often (Health,
 * Market, Progress) into one, behind a Health / Shop / Stats segmented
 * sub-menu. Defaults to Health, so a player's vitals stay a single tap away -
 * Health simply isn't its own bottom-bar icon any more.
 *
 * A fourth "Family" entry acts as a launcher (not an inline segment): it opens
 * the full-screen FamilyTab - spouse/partner, children, heir, pregnancy - which
 * is the only surface that manages children & the heir. `haveChild` has no other
 * reachable caller, so without this the whole children/heir subsystem was
 * unreachable in shipped builds.
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
type LifeControl = LifeSegment | 'family';

function LifeScreen() {
  const [segment, setSegment] = useState<LifeSegment>('health');
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
    }
  }, [params.segment, params.ts, statsLocked]);

  return (
    <ErrorBoundary>
      <View style={styles.container}>
        <View style={styles.controlWrap}>
          <SegmentedControl<LifeControl>
            value={segment}
            onChange={(next) => {
              // 'family' is a momentary launcher, not a persisted segment: it
              // opens the full-screen modal and leaves the active segment as-is.
              if (next === 'family') {
                setShowFamily(true);
              } else {
                setSegment(next);
              }
            }}
            onLockedPress={(_key, reason) => {
              Alert.alert('Stats', reason || 'Keep playing to unlock this.');
            }}
            segments={[
              { key: 'health', label: 'Health', icon: Heart },
              { key: 'shop', label: 'Market', icon: ShoppingCart },
              { key: 'stats', label: 'Stats', icon: Trophy, locked: statsLocked, lockReason: statsReason },
              { key: 'family', label: 'Family', icon: Users },
            ]}
          />
        </View>
        <View style={styles.body}>
          {segment === 'health' ? (
            <HealthScreenContent embedded />
          ) : segment === 'shop' ? (
            <MarketScreenContent embedded />
          ) : (
            <ProgressionScreenContent embedded />
          )}
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
});

export default React.memo(LifeScreen);
