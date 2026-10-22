/**
 * LockedAppSheet - what a locked app says when it is tapped.
 *
 * It used to be a plain text alert, and players still did not know how to
 * reach the Dark Web (tester, 2026-10-11). This is a sheet built to be read at
 * a glance: the app's own icon behind a padlock, then "Any ONE of these unlocks
 * it" as cards - one per route `unlockTier` honours, each with a live progress
 * bar - with the closest route marked, and the active chapter's next goals.
 *
 * The routes and numbers come from `unlockGuide`, the same inputs that open
 * the app, so the sheet can never promise something the game does not honour.
 */
import React, { useEffect, useMemo, useRef } from 'react';
import {
  Animated,
  Easing,
  Image,
  ImageSourcePropType,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { BookOpen, CalendarClock, Circle, Lock, Monitor, TrendingUp } from 'lucide-react-native';
import type { UnlockGuide } from '@/lib/progress/featureUnlocks';
import { useReducedMotion } from '@/hooks/useReducedMotion';
import { haptic } from '@/utils/haptics';
import { uiPalette, withAlpha } from '@/lib/config/theme';
import { fontScale, scale } from '@/utils/scaling';

const GOLD = '#FBBF24';

export interface LockedAppInfo {
  name: string;
  icon?: ImageSourcePropType;
  /** Fallback glyph when the app has no icon image. */
  Glyph?: React.ComponentType<{ size?: number; color?: string }>;
  /** A chapter / wealth / weeks gate. */
  guide?: UnlockGuide | null;
  /** The phone-launcher preview of a computer-only app. */
  needsComputer?: boolean;
}

interface Props {
  app: LockedAppInfo | null;
  onClose: () => void;
  /** Opens Life → Market (only offered for `needsComputer`). */
  onGoToMarket?: () => void;
}

const ROUTE_ICONS = [BookOpen, TrendingUp, CalendarClock];

export default function LockedAppSheet({ app, onClose, onGoToMarket }: Props) {
  const reducedMotion = useReducedMotion();
  const slide = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (!app) return;
    haptic.light();
    slide.setValue(reducedMotion ? 1 : 0);
    if (!reducedMotion) {
      Animated.timing(slide, { toValue: 1, duration: 280, easing: Easing.out(Easing.cubic), useNativeDriver: true }).start();
    }
  }, [app, reducedMotion, slide]);

  // The route the player is closest to finishing - the one worth chasing.
  const closest = useMemo(() => {
    const routes = app?.guide?.routes ?? [];
    let best = -1;
    let bestP = -1;
    routes.forEach((r, i) => { if (r.progress > bestP) { bestP = r.progress; best = i; } });
    return best;
  }, [app]);

  if (!app) return null;
  const Glyph = app.Glyph;

  return (
    <Modal visible transparent animationType="fade" onRequestClose={onClose}>
      {/* The scrim is a SIBLING behind the sheet, hidden from screen readers.
          As the sheet's parent it was one accessible "Close" button that hid
          every route, "Go to Market" and "Got it" from VoiceOver. */}
      <View style={styles.backdrop}>
        <Pressable
          style={StyleSheet.absoluteFill}
          onPress={onClose}
          importantForAccessibility="no"
          accessibilityElementsHidden
        />
        <Animated.View
          onStartShouldSetResponder={() => true}
          style={[
            styles.sheet,
            {
              opacity: slide,
              transform: [{ translateY: slide.interpolate({ inputRange: [0, 1], outputRange: [40, 0] }) }],
            },
          ]}
          accessibilityViewIsModal
        >
          <View style={styles.handle} />

          <View style={styles.iconWrap}>
            {app.icon ? (
              <Image source={app.icon} style={styles.icon} resizeMode="cover" accessible={false} />
            ) : Glyph ? (
              <View style={[styles.icon, styles.iconFallback]}>
                <Glyph size={scale(36)} color={uiPalette.secondary} />
              </View>
            ) : null}
            <View style={styles.iconDim} pointerEvents="none" />
            <View style={styles.lockBadge}>
              <Lock size={scale(16)} color={uiPalette.navy} />
            </View>
          </View>

          <Text style={styles.eyebrow}>LOCKED</Text>
          <Text style={styles.title} accessibilityRole="header">{app.name}</Text>

          {app.needsComputer ? (
            <>
              <Text style={styles.lead}>This is a desktop app. Get a computer and it appears in your Apps.</Text>
              <View style={[styles.route, styles.routeBest]}>
                <View style={[styles.routeIcon, { backgroundColor: withAlpha(GOLD, 0.18) }]}>
                  <Monitor size={scale(18)} color={GOLD} />
                </View>
                <View style={styles.routeBody}>
                  <Text style={styles.routeLabel}>Buy a Computer</Text>
                  <Text style={styles.routeDetail}>Life → Market · about $5,000</Text>
                </View>
              </View>
              {onGoToMarket ? (
                <TouchableOpacity style={styles.primary} onPress={onGoToMarket} accessibilityRole="button" accessibilityLabel="Go to Market">
                  <Text style={styles.primaryText}>Go to Market</Text>
                </TouchableOpacity>
              ) : null}
            </>
          ) : app.guide ? (
            <>
              <Text style={styles.lead}>Any ONE of these unlocks it:</Text>
              {app.guide.routes.map((r, i) => {
                const Icon = ROUTE_ICONS[i] ?? BookOpen;
                const best = i === closest;
                const pct = Math.round(r.progress * 100);
                return (
                  <View
                    key={r.label}
                    style={[styles.route, best && styles.routeBest]}
                    accessible
                    accessibilityLabel={`${r.label}. ${r.detail}. ${pct} percent there${best ? ', closest' : ''}`}
                  >
                    <View style={[styles.routeIcon, { backgroundColor: withAlpha(best ? GOLD : uiPalette.blue, 0.16) }]}>
                      <Icon size={scale(18)} color={best ? GOLD : uiPalette.blue} />
                    </View>
                    <View style={styles.routeBody}>
                      <View style={styles.routeTop}>
                        <Text style={styles.routeLabel} numberOfLines={2}>{r.label}</Text>
                        {best ? <Text style={styles.closest}>CLOSEST</Text> : null}
                      </View>
                      <Text style={styles.routeDetail}>{r.detail}</Text>
                      <View style={styles.bar}>
                        <View style={[styles.barFill, { width: `${pct}%`, backgroundColor: best ? GOLD : uiPalette.blue }]} />
                      </View>
                    </View>
                  </View>
                );
              })}
              {app.guide.nextGoals.length > 0 ? (
                <View style={styles.goals}>
                  <Text style={styles.goalsTitle}>Your next chapter goals</Text>
                  {app.guide.nextGoals.slice(0, 4).map((g) => (
                    <View key={g} style={styles.goalRow}>
                      {/* Every goal listed here is UNFINISHED (nextGoals filters
                          completed ones out), so a green check read as done
                          (VIS-10). A hollow circle is a to-do. */}
                      <Circle size={scale(13)} color={uiPalette.secondary} />
                      <Text style={styles.goalText} numberOfLines={2}>{g}</Text>
                    </View>
                  ))}
                  <Text style={styles.goalsHint}>Track them on Home → Your Progress.</Text>
                </View>
              ) : null}
            </>
          ) : (
            <Text style={styles.lead}>Not available yet.</Text>
          )}

          <TouchableOpacity style={styles.secondary} onPress={onClose} accessibilityRole="button" accessibilityLabel="Got it">
            <Text style={styles.secondaryText}>Got it</Text>
          </TouchableOpacity>
        </Animated.View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(2, 6, 23, 0.72)', justifyContent: 'flex-end' },
  sheet: {
    backgroundColor: uiPalette.navy,
    borderTopLeftRadius: scale(26),
    borderTopRightRadius: scale(26),
    borderWidth: 1,
    borderColor: withAlpha(GOLD, 0.25),
    paddingHorizontal: scale(20),
    paddingTop: scale(10),
    paddingBottom: scale(32),
    alignItems: 'center',
    gap: scale(10),
  },
  handle: { width: scale(40), height: 4, borderRadius: 2, backgroundColor: 'rgba(148,163,184,0.4)', marginBottom: scale(6) },
  iconWrap: { width: scale(78), height: scale(78), marginTop: scale(4) },
  icon: { width: '100%', height: '100%', borderRadius: scale(20) },
  iconFallback: { backgroundColor: uiPalette.surface, alignItems: 'center', justifyContent: 'center' },
  iconDim: { ...StyleSheet.absoluteFillObject, borderRadius: scale(20), backgroundColor: 'rgba(2,6,23,0.45)' },
  lockBadge: {
    position: 'absolute',
    right: -scale(6),
    bottom: -scale(6),
    width: scale(30),
    height: scale(30),
    borderRadius: scale(15),
    backgroundColor: GOLD,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: uiPalette.navy,
  },
  eyebrow: { fontSize: fontScale(11), letterSpacing: 2, fontWeight: '600', color: GOLD, marginTop: scale(4) },
  title: { fontSize: fontScale(24), fontWeight: '600', color: uiPalette.paper, textAlign: 'center' },
  lead: { fontSize: fontScale(14), color: uiPalette.muted, textAlign: 'center', marginBottom: scale(2) },
  route: {
    alignSelf: 'stretch',
    flexDirection: 'row',
    gap: scale(12),
    padding: scale(12),
    borderRadius: scale(16),
    borderWidth: 1,
    borderColor: 'rgba(148,163,184,0.16)',
    backgroundColor: 'rgba(148,163,184,0.06)',
  },
  routeBest: { borderColor: withAlpha(GOLD, 0.5), backgroundColor: withAlpha(GOLD, 0.07) },
  routeIcon: { width: scale(36), height: scale(36), borderRadius: scale(18), alignItems: 'center', justifyContent: 'center' },
  routeBody: { flex: 1, gap: scale(4) },
  routeTop: { flexDirection: 'row', alignItems: 'center', gap: scale(8) },
  routeLabel: { flex: 1, fontSize: fontScale(14), fontWeight: '600', color: uiPalette.paper },
  closest: { fontSize: fontScale(9), fontWeight: '600', letterSpacing: 1, color: GOLD },
  routeDetail: { fontSize: fontScale(12), color: uiPalette.muted },
  bar: { height: 6, borderRadius: 3, backgroundColor: 'rgba(148,163,184,0.18)', overflow: 'hidden', marginTop: scale(2) },
  barFill: { height: '100%', borderRadius: 3 },
  goals: { alignSelf: 'stretch', gap: scale(6), marginTop: scale(4) },
  goalsTitle: { fontSize: fontScale(12), fontWeight: '600', color: uiPalette.secondary, letterSpacing: 0.5 },
  goalRow: { flexDirection: 'row', alignItems: 'center', gap: scale(8) },
  goalText: { flex: 1, fontSize: fontScale(13), color: uiPalette.paper },
  goalsHint: { fontSize: fontScale(11), color: uiPalette.muted },
  primary: {
    alignSelf: 'stretch',
    minHeight: 48,
    borderRadius: scale(14),
    backgroundColor: GOLD,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: scale(4),
  },
  primaryText: { fontSize: fontScale(15), fontWeight: '600', color: uiPalette.navy },
  secondary: {
    alignSelf: 'stretch',
    minHeight: 48,
    borderRadius: scale(14),
    borderWidth: 1,
    borderColor: 'rgba(148,163,184,0.3)',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: scale(4),
  },
  secondaryText: { fontSize: fontScale(15), fontWeight: '600', color: uiPalette.paper },
});
