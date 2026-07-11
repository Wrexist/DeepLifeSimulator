/**
 * CreateCompanyScreen — pick an industry to found a company.
 *
 * Framed as an opportunity board: each industry is a market card with a
 * growth / volatility / moat profile strip, an affordability read against the
 * player's cash, and a clear selected state. Presentational only — delegates to
 * the existing `createCompany` action so all canonical logic (inflation,
 * prestige unlock, education requirement, $$ cost) stays intact.
 */
import React, { useCallback, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { ArrowLeft, Briefcase, Building2, Check, DollarSign, Factory, Utensils, Landmark } from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import LinearGradientFallback from '@/components/fallbacks/LinearGradientFallback';
import { useGame } from '@/contexts/GameContext';
import { useTheme } from '@/hooks/useTheme';
import { scale, fontScale, responsiveSpacing, responsiveBorderRadius, touchTargets, getAppScreenBottomPadding } from '@/utils/scaling';
import { getGlassCard, getPlatformShadows } from '@/utils/glassmorphismStyles';
import { createCompany } from '@/contexts/game/actions/CompanyActions';
import { updateMoney } from '@/contexts/game/actions/MoneyActions';
import { HUSTLE_GRADIENT, HUSTLE_COLORS, industryColor } from '../styles/hustleTheme';
import { hustleHaptics } from '../utils/hustleHaptics';
import type { HustleIndustry } from '@/contexts/game/types';

const LinearGradient = LinearGradientFallback;

// Presentational profile labels — mirror each industry's existing description
// (no new mechanics; createCompany remains the single source of economy truth).
const PROFILE: Record<HustleIndustry, { growth: string; volatility: string; moat: string }> = {
  factory: { growth: 'Slow', volatility: 'Low', moat: 'Med' },
  ai: { growth: 'Fast', volatility: 'High', moat: 'Low' },
  restaurant: { growth: 'Medium', volatility: 'Medium', moat: 'Low' },
  realestate: { growth: 'Medium', volatility: 'Low', moat: 'High' },
  bank: { growth: 'Slow', volatility: 'Low', moat: 'High' },
};

const INDUSTRIES: Array<{
  id: HustleIndustry;
  name: string;
  icon: any;
  description: string;
  cost: number;
}> = [
  { id: 'factory', name: 'Manufacturing', icon: Factory, description: 'Industrial production, hard assets, slow & steady growth.', cost: 50_000 },
  { id: 'ai', name: 'AI / Tech', icon: Briefcase, description: 'High R&D leverage, fast scale, prone to media swings.', cost: 90_000 },
  { id: 'restaurant', name: 'Restaurant', icon: Utensils, description: 'Brand-driven, local footprint, sensitive to reviews.', cost: 130_000 },
  { id: 'realestate', name: 'Real Estate', icon: Building2, description: 'Capital-heavy, durable income, regulator exposure.', cost: 200_000 },
  { id: 'bank', name: 'Bank', icon: Landmark, description: 'Massive moat, complex compliance, premium endgame play.', cost: 2_000_000 },
];

interface CreateCompanyScreenProps {
  onBack: () => void;
  onCreated: (companyId: string) => void;
}

export default function CreateCompanyScreen({ onBack, onCreated }: CreateCompanyScreenProps) {
  const { gameState, setGameState, saveGame } = useGame();
  const { theme, isDark } = useTheme();
  const insets = useSafeAreaInsets();
  const [selected, setSelected] = useState<HustleIndustry | null>(null);
  const [error, setError] = useState<string | null>(null);
  // Tab bar (in app/(tabs)/_layout.tsx) is absolute-positioned and floats over
  // this screen; getAppScreenBottomPadding reserves its height + inset + breathing room
  // on BOTH platforms (the old Android-only offset left the CTA covered on iOS).
  const tabBarOffset = getAppScreenBottomPadding(insets.bottom);

  const playerMoney = gameState.stats?.money ?? 0;
  const affordableCount = INDUSTRIES.filter((i) => playerMoney >= i.cost).length;

  const handleConfirm = useCallback(() => {
    if (!selected) return;
    const result = createCompany(gameState, setGameState, selected, { updateMoney });
    if (result.success) {
      hustleHaptics.success();
      saveGame?.();
      onCreated((result as any).companyId ?? selected);
    } else {
      hustleHaptics.error();
      setError(result.message ?? 'Could not found company');
    }
  }, [selected, gameState, setGameState, saveGame, onCreated]);

  return (
    <View style={[styles.root, { backgroundColor: theme.background }]}>
      <View style={styles.header}>
        <Pressable onPress={onBack} accessibilityRole="button" accessibilityLabel="Back" hitSlop={8} style={styles.headerBtn}>
          <ArrowLeft size={fontScale(22)} color={theme.text} />
        </Pressable>
        <Text style={[styles.headerTitle, { color: theme.text }]}>Found a company</Text>
        <View style={styles.headerBtn} />
      </View>

      <ScrollView
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
      >
        {/* Available-cash chip + affordability read */}
        <View style={styles.introRow}>
          <View style={[styles.cashChip, { backgroundColor: HUSTLE_COLORS.accent + '24', borderColor: HUSTLE_COLORS.accent + '4D' }]}>
            <DollarSign size={fontScale(13)} color={HUSTLE_COLORS.accent} strokeWidth={2.6} />
            <Text style={[styles.cashChipText, { color: theme.text }]}>${playerMoney.toLocaleString()}</Text>
          </View>
          <Text style={[styles.affordText, { color: theme.textSecondary }]}>
            {affordableCount} of {INDUSTRIES.length} within budget
          </Text>
        </View>

        <Text style={[styles.intro, { color: theme.textSecondary }]}>
          Pick your industry. Founding cost is paid up front; you'll have weekly revenue once operational.
        </Text>

        {INDUSTRIES.map((ind) => {
          const Icon = ind.icon;
          const color = industryColor(ind.id);
          const isSelected = selected === ind.id;
          const canAfford = playerMoney >= ind.cost;
          const shortfall = Math.max(0, ind.cost - playerMoney);
          const profile = PROFILE[ind.id];
          return (
            <Pressable
              key={ind.id}
              onPress={() => {
                if (!canAfford) {
                  hustleHaptics.error();
                  return;
                }
                hustleHaptics.tap();
                setSelected(ind.id);
                setError(null);
              }}
              accessibilityRole="radio"
              accessibilityState={{ selected: isSelected, disabled: !canAfford }}
              accessibilityLabel={`${ind.name}: $${ind.cost.toLocaleString()}`}
              style={[
                getGlassCard(isDark, 6),
                styles.industryCard,
                {
                  backgroundColor: theme.surface,
                  borderColor: isSelected ? color : theme.border,
                  borderWidth: isSelected ? 2 : 1,
                  opacity: canAfford ? 1 : 0.6,
                },
              ]}
            >
              <View style={styles.industryHeader}>
                <View style={[styles.industryIcon, { backgroundColor: color + '26', borderColor: color + '4D' }]}>
                  <Icon size={fontScale(22)} color={color} strokeWidth={2.2} />
                </View>
                <View style={styles.industryText}>
                  <Text style={[styles.industryName, { color: theme.text }]}>{ind.name}</Text>
                  <Text style={[styles.industryDesc, { color: theme.textSecondary }]} numberOfLines={2}>
                    {ind.description}
                  </Text>
                </View>
                <View style={styles.industryRight}>
                  <Text style={[styles.industryCostLabel, { color: theme.textMuted }]}>Startup</Text>
                  <Text style={[styles.industryCost, { color: canAfford ? theme.text : theme.textMuted }]}>
                    ${ind.cost.toLocaleString()}
                  </Text>
                  {isSelected ? (
                    <View style={[styles.selectedTick, { backgroundColor: color }]}>
                      <Check size={fontScale(12)} color="#FFFFFF" strokeWidth={3} />
                    </View>
                  ) : null}
                </View>
              </View>

              {/* Profile strip — presentational market descriptors */}
              <View style={styles.profileRow}>
                <ProfileChip label="Growth" value={profile.growth} theme={theme} />
                <ProfileChip label="Volatility" value={profile.volatility} theme={theme} />
                <ProfileChip label="Moat" value={profile.moat} theme={theme} />
                {canAfford ? (
                  <View style={[styles.statusChip, { backgroundColor: HUSTLE_COLORS.success + '1F' }]}>
                    <Text style={[styles.statusChipText, { color: HUSTLE_COLORS.success }]}>Affordable</Text>
                  </View>
                ) : (
                  <View style={[styles.statusChip, { backgroundColor: theme.surfaceElevated }]}>
                    <Text style={[styles.statusChipText, { color: theme.textMuted }]}>Need ${shortfall.toLocaleString()} more</Text>
                  </View>
                )}
              </View>
            </Pressable>
          );
        })}

        {error ? <Text style={[styles.errorText, { color: '#EF4444' }]}>{error}</Text> : null}
      </ScrollView>

      <View
        style={[
          styles.footer,
          {
            borderTopColor: theme.border,
            backgroundColor: theme.surface,
            paddingBottom: tabBarOffset,
          },
        ]}
      >
        <Pressable
          onPress={handleConfirm}
          disabled={!selected}
          accessibilityRole="button"
          accessibilityLabel="Found this company"
          style={({ pressed }) => [
            styles.cta,
            selected && getPlatformShadows(5, 0.3, 2, 8),
            !selected && styles.ctaDisabled,
            pressed && { transform: [{ scale: 0.98 }] },
          ]}
        >
          <LinearGradient
            colors={
              selected
                ? (HUSTLE_GRADIENT as unknown as string[])
                : [theme.border, theme.border]
            }
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={styles.ctaFill}
          >
            <Text style={styles.ctaText}>{selected ? `Found ${INDUSTRIES.find((i) => i.id === selected)?.name}` : 'Pick an industry'}</Text>
          </LinearGradient>
        </Pressable>
      </View>
    </View>
  );
}

function ProfileChip({ label, value, theme }: { label: string; value: string; theme: any }) {
  return (
    <View style={[styles.profileChip, { backgroundColor: theme.surfaceElevated }]}>
      <Text style={[styles.profileChipLabel, { color: theme.textMuted }]}>{label}</Text>
      <Text style={[styles.profileChipValue, { color: theme.text }]}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: responsiveSpacing.md,
    paddingVertical: responsiveSpacing.sm,
  },
  headerBtn: {
    width: touchTargets.minimum,
    height: touchTargets.minimum,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    flex: 1,
    textAlign: 'center',
    fontSize: fontScale(16),
    fontWeight: '700',
  },
  scroll: {
    padding: responsiveSpacing.md,
    paddingBottom: scale(120),
  },
  introRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: responsiveSpacing.sm,
    marginBottom: responsiveSpacing.sm,
  },
  cashChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: responsiveSpacing.sm,
    paddingVertical: 5,
    borderRadius: responsiveBorderRadius.full,
    borderWidth: 1,
  },
  cashChipText: {
    fontSize: fontScale(13),
    fontWeight: '800',
    fontVariant: ['tabular-nums'],
  },
  affordText: {
    fontSize: fontScale(12),
    fontWeight: '600',
    flexShrink: 1,
  },
  intro: {
    fontSize: fontScale(13),
    marginBottom: responsiveSpacing.md,
  },
  industryCard: {
    borderRadius: responsiveBorderRadius.xl,
    padding: responsiveSpacing.md,
    marginBottom: responsiveSpacing.sm,
    gap: responsiveSpacing.sm,
  },
  industryHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: responsiveSpacing.sm,
  },
  industryIcon: {
    width: scale(44),
    height: scale(44),
    borderRadius: scale(10),
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  industryText: {
    flex: 1,
  },
  industryName: {
    fontSize: fontScale(15),
    fontWeight: '700',
  },
  industryDesc: {
    fontSize: fontScale(11),
    marginTop: 2,
  },
  industryRight: {
    alignItems: 'flex-end',
    gap: 2,
  },
  industryCostLabel: {
    fontSize: fontScale(9),
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  industryCost: {
    fontSize: fontScale(14),
    fontWeight: '800',
    fontVariant: ['tabular-nums'],
  },
  selectedTick: {
    width: scale(20),
    height: scale(20),
    borderRadius: scale(10),
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 2,
  },
  profileRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  profileChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 999,
  },
  profileChipLabel: {
    fontSize: fontScale(9),
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.3,
  },
  profileChipValue: {
    fontSize: fontScale(11),
    fontWeight: '700',
  },
  statusChip: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 999,
  },
  statusChipText: {
    fontSize: fontScale(10),
    fontWeight: '700',
    fontVariant: ['tabular-nums'],
  },
  errorText: {
    fontSize: fontScale(12),
    textAlign: 'center',
    marginTop: responsiveSpacing.sm,
  },
  footer: {
    padding: responsiveSpacing.md,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  cta: {
    borderRadius: responsiveBorderRadius.full,
  },
  ctaDisabled: { opacity: 0.6 },
  ctaFill: {
    borderRadius: responsiveBorderRadius.full,
    overflow: 'hidden',
    paddingVertical: responsiveSpacing.md,
    minHeight: touchTargets.minimum,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ctaText: {
    color: '#FFFFFF',
    fontSize: fontScale(15),
    fontWeight: '700',
  },
});
