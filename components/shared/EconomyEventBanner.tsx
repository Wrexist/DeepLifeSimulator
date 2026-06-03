/**
 * EconomyEventBanner — shared in-app banner that surfaces the current
 * macro-economy state (recession, boom, crash, normal).
 *
 * Reads from `gameState.economy.economyEvents.currentState`, which is driven by
 * `lib/events/economyEvents.ts` and ticked in GameActionsContext.nextWeek.
 *
 * Returns null when the state is `normal` or `undefined` — no banner needed.
 * Used by AdvancedBankApp (rate context), BitcoinMiningApp (regime context),
 * and OnionApp (general macro framing for heat / job timing).
 */

import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { TrendingDown, TrendingUp, Activity, Zap } from 'lucide-react-native';
import { useGame } from '@/contexts/GameContext';
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
        case 'recession': return 'Lenders tighten — loan APRs are higher; savings yields drift down.';
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
      switch (state) {
        case 'recession': return 'Police budgets pinched — heat decays a touch faster.';
        case 'crash':     return 'Crackdowns rise with public anger. Higher police-event risk.';
        case 'boom':      return 'Attention turned elsewhere. Marketplace traffic high.';
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
  const { gameState } = useGame();
  const darkMode = !!gameState.settings?.darkMode;
  const theme = getThemeColors(darkMode);
  const state = (gameState.economy?.economyEvents?.currentState ?? 'normal') as EconomyState;

  // Don't show a banner during normal conditions — keeps the UI quiet.
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
