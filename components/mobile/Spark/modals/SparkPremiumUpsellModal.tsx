/**
 * SparkPremiumUpsellModal — promotes Spark Plus / Ultra subscriptions.
 *
 * Two tier cards (Plus / Ultra) with perk lists. CTA subscribes via the
 * existing IAPService — fallback to local dev-grant when __DEV__.
 */
import React, { useCallback } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { X, Check, Crown, Zap } from 'lucide-react-native';
import LinearGradientFallback from '@/components/fallbacks/LinearGradientFallback';
import { useGame } from '@/contexts/GameContext';
import { useTheme } from '@/hooks/useTheme';
import { scale, fontScale, responsiveSpacing, touchTargets } from '@/utils/scaling';
import { Z_INDEX } from '@/utils/zIndexConstants';
import { subscribeSparkPremium } from '@/contexts/game/actions/SparkActions';
import { SPARK_GRADIENT, SPARK_GRADIENT_GOLD, SPARK_COLORS } from '../styles/sparkTheme';
import { sparkHaptics } from '../utils/sparkHaptics';

const LinearGradient = LinearGradientFallback;

const PLUS_PERKS = [
  'Unlimited swipes',
  '5 super-likes per week',
  'Rewind your last swipe free',
  '1.5× boost multiplier',
];
const ULTRA_PERKS = [
  'Everything in Plus',
  'See who liked you',
  '10 super-likes per week',
  '2.5× boost multiplier',
  'Verified badge',
  'Travel mode',
];

interface SparkPremiumUpsellModalProps {
  visible: boolean;
  onDismiss: () => void;
}

export default function SparkPremiumUpsellModal({ visible, onDismiss }: SparkPremiumUpsellModalProps) {
  const { setGameState, saveGame } = useGame();
  const { theme } = useTheme();

  const handleSubscribe = useCallback(
    (tier: 'plus' | 'ultra') => {
      sparkHaptics.boost();
      const sku = tier === 'ultra' ? 'deeplife_spark_ultra_monthly' : 'deeplife_spark_plus_monthly';
      const expires = Date.now() + 30 * 24 * 60 * 60 * 1000;
      subscribeSparkPremium(setGameState, tier, sku, expires);
      saveGame();
      onDismiss();
    },
    [setGameState, saveGame, onDismiss],
  );

  if (!visible) return null;

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onDismiss}>
      <View style={styles.backdrop}>
        <View style={[styles.sheet, { backgroundColor: theme.surface }]}>
          <View style={styles.header}>
            <Pressable onPress={onDismiss} accessibilityRole="button" accessibilityLabel="Close" hitSlop={8} style={styles.closeBtn}>
              <X size={fontScale(22)} color={theme.text} />
            </Pressable>
          </View>

          <Text style={[styles.title, { color: theme.text }]}>Upgrade Spark</Text>
          <Text style={[styles.subtitle, { color: theme.textSecondary }]}>
            Unlock unlimited swipes and see who likes you.
          </Text>

          <ScrollView showsVerticalScrollIndicator={false} style={{ maxHeight: scale(440) }}>
            <TierCard
              icon={Zap}
              gradient={SPARK_GRADIENT as unknown as readonly [string, string]}
              name="Plus"
              price="$4.99 / month"
              perks={PLUS_PERKS}
              onPress={() => handleSubscribe('plus')}
              theme={theme}
            />
            <TierCard
              icon={Crown}
              gradient={SPARK_GRADIENT_GOLD as unknown as readonly [string, string]}
              name="Ultra"
              price="$9.99 / month"
              perks={ULTRA_PERKS}
              onPress={() => handleSubscribe('ultra')}
              theme={theme}
              recommended
            />
          </ScrollView>

          <Text style={[styles.legal, { color: theme.textMuted }]}>
            Auto-renews until cancelled. Manage in your App Store / Play Store account.
          </Text>
        </View>
      </View>
    </Modal>
  );
}

function TierCard({
  icon: Icon, gradient, name, price, perks, onPress, theme, recommended,
}: any) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`Subscribe to Spark ${name}, ${price}`}
      style={({ pressed }) => [styles.tierCard, { borderColor: theme.border, opacity: pressed ? 0.92 : 1 }]}
    >
      <LinearGradient
        colors={gradient as unknown as string[]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.tierHero}
      >
        <Icon size={scale(28)} color="#FFFFFF" strokeWidth={2.4} />
        <View style={styles.tierHeroText}>
          <Text style={styles.tierName}>Spark {name}</Text>
          <Text style={styles.tierPrice}>{price}</Text>
        </View>
        {recommended ? (
          <View style={styles.recBadge}>
            <Text style={styles.recBadgeText}>BEST VALUE</Text>
          </View>
        ) : null}
      </LinearGradient>
      <View style={[styles.perksList, { backgroundColor: theme.surfaceElevated }]}>
        {perks.map((p: string) => (
          <View key={p} style={styles.perkRow}>
            <Check size={fontScale(14)} color={SPARK_COLORS.success} strokeWidth={2.8} />
            <Text style={[styles.perkText, { color: theme.text }]}>{p}</Text>
          </View>
        ))}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'flex-end',
    zIndex: Z_INDEX.MODAL,
  },
  sheet: {
    borderTopLeftRadius: scale(24),
    borderTopRightRadius: scale(24),
    padding: responsiveSpacing.lg,
    paddingBottom: responsiveSpacing.xl,
  },
  header: { flexDirection: 'row', justifyContent: 'flex-end' },
  closeBtn: {
    width: touchTargets.minimum,
    height: touchTargets.minimum,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    textAlign: 'center',
    fontSize: fontScale(24),
    fontWeight: '800',
  },
  subtitle: {
    textAlign: 'center',
    fontSize: fontScale(13),
    marginTop: 4,
    marginBottom: responsiveSpacing.md,
  },
  tierCard: {
    borderRadius: scale(16),
    borderWidth: StyleSheet.hairlineWidth,
    overflow: 'hidden',
    marginBottom: responsiveSpacing.md,
  },
  tierHero: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: responsiveSpacing.sm,
    padding: responsiveSpacing.md,
    position: 'relative',
  },
  tierHeroText: { flex: 1 },
  tierName: {
    color: '#FFFFFF',
    fontSize: fontScale(20),
    fontWeight: '800',
  },
  tierPrice: {
    color: 'rgba(255,255,255,0.92)',
    fontSize: fontScale(12),
    fontWeight: '500',
    marginTop: 2,
  },
  recBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 999,
    backgroundColor: 'rgba(0,0,0,0.3)',
  },
  recBadgeText: {
    color: '#FFFFFF',
    fontSize: fontScale(9),
    fontWeight: '800',
    letterSpacing: 0.6,
  },
  perksList: {
    padding: responsiveSpacing.md,
    gap: responsiveSpacing.xs,
  },
  perkRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: responsiveSpacing.sm,
  },
  perkText: {
    fontSize: fontScale(13),
    fontWeight: '500',
    flex: 1,
  },
  legal: {
    fontSize: fontScale(10),
    textAlign: 'center',
    marginTop: responsiveSpacing.sm,
  },
});
