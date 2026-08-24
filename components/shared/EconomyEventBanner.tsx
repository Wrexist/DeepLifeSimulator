/**
 * EconomyEventBanner - shared in-app banner that surfaces the current
 * macro-economy state (recession, boom, crash, normal).
 *
 * Reads from `gameState.economy.economyEvents.currentState`, which is driven by
 * `lib/events/economyEvents.ts` and ticked in GameActionsContext.nextWeek.
 *
 * Returns null when the state is `normal` or `undefined` - no banner needed.
 * Used by AdvancedBankApp (rate context), BitcoinMiningApp (regime context),
 * and OnionApp (general macro framing for heat / job timing).
 */

import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { TrendingDown, TrendingUp, Activity, Zap } from 'lucide-react-native';
import { useGameSelector } from '@/contexts/game/useGameSelector';
import { responsiveFontSize, responsiveSpacing, responsiveBorderRadius, scale } from '@/utils/scaling';
import { getThemeColors, accent } from '@/lib/config/theme';

type EconomyState = 'normal' | 'recession' | 'boom' | 'crash';

interface Props {
  /**
   * When provided, the banner contextualizes its copy to that app (Banking talks about
   * APRs, Crypto about regimes, Onion about heat). Defaults to a generic message.
   */
  context?: 'banking' | 'crypto' | 'darkweb' | 'travel' | 'generic';
}

const META: Record<EconomyState, { icon: React.ComponentType<{ size: number; color: string }>; color: string; title: string }> = {
  normal:    { icon: Activity,     color: accent.info, title: 'Markets normal' },
  recession: { icon: TrendingDown, color: accent.warning, title: 'Recession' },
  boom:      { icon: TrendingUp,   color: accent.success, title: 'Economic boom' },
  crash:     { icon: Zap,          color: accent.danger, title: 'Market crash' },
};

function contextCopy(state: EconomyState, ctx: Props['context']): string {
  switch (ctx) {
    case 'banking':
      switch (state) {
        case 'recession': return 'Lenders tighten - loan APRs are higher; savings yields drift down.';
        case 'crash':     return 'Credit freezes. Premium products are pulled. APRs spike across the board.';
        case 'boom':      return 'Cheap money. Loan offers improve; savings yields tick up.';
        case 'normal':    return 'Rates back to baseline.';
      }
      break;
    case 'crypto':
      switch (state) {
        case 'recession': return 'Volatility regimes dominate. Spreads widen.';
        case 'crash':     return 'Bear regimes forced across the board. Brace.';
        case 'boom':      return 'Bull regimes forced. Bull-tier setups pay best.';
        case 'normal':    return 'Regimes evolving naturally.';
      }
      break;
    case 'darkweb':
      /**
       * R3-C7: these used to promise three mechanics that do not exist.
       *
       * The copy told the player that a recession made heat decay faster, a
       * crash raised police-event risk, and a boom lifted marketplace traffic.
       * `DarkWebWeeklyTickInput` takes only `{ darkWeb, currentWeek,
       * relationships, rollFor, inJail }` - no economy state - and the call site
       * passes nothing economic; `grep economy lib/darkweb/` returns zero hits.
       * `decayHeat` and `policeEventProbability` take only heat and opsec, and
       * `refreshMarketplace` has a fixed per-vendor listing cap. So during a
       * crash the player was told to expect higher raid risk and managed heat
       * accordingly, while the curve was identical to normal.
       *
       * The sibling contexts ARE wired (banking via `rateEnvironment`, crypto
       * via `marketModel`), so the honest fix here is to stop claiming an effect
       * rather than to invent one. Wiring the dark web to `economyState` is a
       * design change, recorded in the round 3 findings file.
       */
      switch (state) {
        case 'recession': return 'Money is tight. The street trades on regardless.';
        case 'crash':     return 'Public anger is up, but the market runs as ever.';
        case 'boom':      return 'Everyone is flush. The street trades on regardless.';
        case 'normal':    return 'Status quo on the streets.';
      }
      break;
    case 'travel':
      switch (state) {
        case 'recession': return 'Airlines slash fares. Off-season prices on most routes.';
        case 'crash':     return 'Carriers ground capacity. Expect chaos and surge prices on the way back.';
        case 'boom':      return 'Tourism booming. Premium destinations command premium prices.';
        case 'normal':    return 'Travel conditions stable.';
      }
      break;
    default:
      return 'Macro conditions shifting.';
  }
  return 'Macro conditions shifting.';
}

export default function EconomyEventBanner({ context = 'generic' }: Props) {
  const darkMode = useGameSelector((s) => !!s.settings?.darkMode);
  const theme = getThemeColors(darkMode);
  const state = useGameSelector((s) => (s.economy?.economyEvents?.currentState ?? 'normal') as EconomyState);

  // Don't show a banner during normal conditions - keeps the UI quiet.
  if (state === 'normal') return null;

  const meta = META[state];
  const Icon = meta.icon;
  const copy = contextCopy(state, context);

  return (
    <View
      style={[
        styles.card,
        { backgroundColor: theme.surfaceElevated, borderColor: meta.color },
      ]}
    >
      <View style={[styles.iconBubble, { backgroundColor: meta.color }]}>
        <Icon size={scale(14)} color="white" />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={[styles.title, { color: meta.color }]}>{meta.title}</Text>
        <Text style={[styles.copy, { color: theme.textSecondary }]}>{copy}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: responsiveSpacing.sm,
    padding: responsiveSpacing.md,
    borderRadius: responsiveBorderRadius.lg,
    borderWidth: 1,
  },
  iconBubble: {
    width: scale(28),
    height: scale(28),
    borderRadius: scale(14),
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: { fontSize: responsiveFontSize.sm, fontWeight: '800' },
  copy: { fontSize: responsiveFontSize.xs, marginTop: 2 },
});
