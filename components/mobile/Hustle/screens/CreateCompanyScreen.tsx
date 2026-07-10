/**
 * CreateCompanyScreen — pick an industry to found a company.
 *
 * Delegates to existing `createCompany` action so all the canonical logic
 * (inflation, prestige unlock, education requirement, $$ cost) stays intact.
 */
import React, { useCallback, useState } from 'react';
import { Alert, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { ArrowLeft, Briefcase, Building2, Factory, Utensils, Landmark } from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import LinearGradientFallback from '@/components/fallbacks/LinearGradientFallback';
import { useGame } from '@/contexts/GameContext';
import { useTheme } from '@/hooks/useTheme';
import { scale, fontScale, responsiveSpacing, responsiveBorderRadius, touchTargets, getAppScreenBottomPadding } from '@/utils/scaling';
import { getGlassCard, getPlatformShadows } from '@/utils/glassmorphismStyles';
import { createCompany } from '@/contexts/game/actions/CompanyActions';
import { updateMoney } from '@/contexts/game/actions/MoneyActions';
import { HUSTLE_GRADIENT, industryColor } from '../styles/hustleTheme';
import { hustleHaptics } from '../utils/hustleHaptics';
import type { HustleIndustry } from '@/contexts/game/types';

const LinearGradient = LinearGradientFallback;

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
        <Text style={[styles.intro, { color: theme.textSecondary }]}>
          Pick your industry. Founding cost is paid up front; you'll have weekly revenue once operational.
        </Text>

        {INDUSTRIES.map((ind) => {
          const Icon = ind.icon;
          const color = industryColor(ind.id);
          const isSelected = selected === ind.id;
          const canAfford = playerMoney >= ind.cost;
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
                  opacity: canAfford ? 1 : 0.55,
                },
              ]}
            >
              <View style={[styles.industryIcon, { backgroundColor: color + '26', borderColor: color + '4D' }]}>
                <Icon size={fontScale(22)} color={color} strokeWidth={2.2} />
              </View>
              <View style={styles.industryText}>
                <Text style={[styles.industryName, { color: theme.text }]}>{ind.name}</Text>
                <Text style={[styles.industryDesc, { color: theme.textSecondary }]} numberOfLines={2}>
                  {ind.description}
                </Text>
              </View>
              <Text style={[styles.industryCost, { color: canAfford ? theme.text : theme.textMuted }]}>
                ${ind.cost.toLocaleString()}
              </Text>
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
  intro: {
    fontSize: fontScale(13),
    marginBottom: responsiveSpacing.md,
  },
  industryCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: responsiveSpacing.sm,
    borderRadius: responsiveBorderRadius.xl,
    padding: responsiveSpacing.md,
    marginBottom: responsiveSpacing.sm,
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
  industryCost: {
    fontSize: fontScale(14),
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
