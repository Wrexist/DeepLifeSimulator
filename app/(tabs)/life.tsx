import React, { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { Heart, ShoppingCart, Trophy } from 'lucide-react-native';
import ErrorBoundary from '@/components/ErrorBoundary';
import SegmentedControl from '@/components/ui/SegmentedControl';
import { responsivePadding, scale } from '@/utils/scaling';
import { HealthScreenContent } from './health';
import { MarketScreenContent } from './market';
import { ProgressionScreenContent } from './progression';

/**
 * Life — the merged personal tab.
 *
 * Folds the three always-on tabs the player touches least often (Health,
 * Market, Progress) into one, behind a Health / Shop / Stats segmented
 * sub-menu. Defaults to Health, so a player's vitals stay a single tap away —
 * Health simply isn't its own bottom-bar icon any more.
 *
 * Only the active segment is mounted (matching the layout's freezeOnBlur
 * philosophy): keeping all three heavy screens live at once would undo the
 * whole point of trimming the tab bar. Switching segments remounts, which is
 * the same reset you'd get switching bottom tabs before.
 */
type LifeSegment = 'health' | 'shop' | 'stats';

function LifeScreen() {
  const [segment, setSegment] = useState<LifeSegment>('health');

  return (
    <ErrorBoundary>
      <View style={styles.container}>
        <View style={styles.controlWrap}>
          <SegmentedControl<LifeSegment>
            value={segment}
            onChange={setSegment}
            segments={[
              { key: 'health', label: 'Health', icon: Heart },
              { key: 'shop', label: 'Shop', icon: ShoppingCart },
              { key: 'stats', label: 'Stats', icon: Trophy },
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
      </View>
    </ErrorBoundary>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0F172A',
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
