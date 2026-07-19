import React, { useState } from 'react';
import { Modal, StyleSheet, View } from 'react-native';
import { Heart, ShoppingCart, Trophy, Users } from 'lucide-react-native';
import ErrorBoundary from '@/components/ErrorBoundary';
import SegmentedControl from '@/components/ui/SegmentedControl';
import { responsivePadding, scale } from '@/utils/scaling';
import { HealthScreenContent } from './health';
import { MarketScreenContent } from './market';
import { ProgressionScreenContent } from './progression';
import FamilyTab from '@/components/FamilyTab';

/**
 * Life — the merged personal tab.
 *
 * Folds the three always-on tabs the player touches least often (Health,
 * Market, Progress) into one, behind a Health / Shop / Stats segmented
 * sub-menu. Defaults to Health, so a player's vitals stay a single tap away —
 * Health simply isn't its own bottom-bar icon any more.
 *
 * A fourth "Family" entry acts as a launcher (not an inline segment): it opens
 * the full-screen FamilyTab — spouse/partner, children, heir, pregnancy — which
 * is the only surface that manages children & the heir. `haveChild` has no other
 * reachable caller, so without this the whole children/heir subsystem was
 * unreachable in shipped builds.
 *
 * Only the active segment is mounted (matching the layout's freezeOnBlur
 * philosophy): keeping all three heavy screens live at once would undo the
 * whole point of trimming the tab bar. Switching segments remounts, which is
 * the same reset you'd get switching bottom tabs before.
 */
type LifeSegment = 'health' | 'shop' | 'stats';
type LifeControl = LifeSegment | 'family';

function LifeScreen() {
  const [segment, setSegment] = useState<LifeSegment>('health');
  const [showFamily, setShowFamily] = useState(false);

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
            segments={[
              { key: 'health', label: 'Health', icon: Heart },
              { key: 'shop', label: 'Market', icon: ShoppingCart },
              { key: 'stats', label: 'Stats', icon: Trophy },
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
        <Modal
          visible={showFamily}
          animationType="slide"
          presentationStyle="fullScreen"
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
