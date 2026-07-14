/**
 * SparkPremiumUpsellModal — Spark Plus / Ultra, IN-GAME cash subscriptions.
 *
 * The player pays with the in-game money they earn from jobs — NOT a real App
 * Store IAP. Tapping a tier subscribes weekly: subscribeSparkPremium debits
 * `stats.money` immediately (canonical applyMoneyDelta, overdraft-reject) and the
 * fee auto-renews weekly on the game tick (applySubscriptionsForWeek), lapsing if
 * the player can't afford a renewal. When already subscribed the modal shows the
 * active tier and a Cancel control.
 */
import React, { useCallback } from 'react';
import { Alert, Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { X, Check, Crown, Zap } from 'lucide-react-native';
import LinearGradientFallback from '@/components/fallbacks/LinearGradientFallback';
import { useGame } from '@/contexts/GameContext';
import { useTheme } from '@/hooks/useTheme';
import { scale, fontScale, responsiveSpacing, touchTargets } from '@/utils/scaling';
import { Z_INDEX } from '@/utils/zIndexConstants';
import { subscribeSparkPremium, cancelSparkPremium } from '@/contexts/game/actions/SparkActions';
import { SPARK_TIER_PRICING } from '@/lib/dating/sparkLogic';
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
  const { gameState, setGameState, saveGame } = useGame();
  const { theme } = useTheme();

  const premium = gameState.sparkApp?.premium;
  const activeTier = premium?.active === true ? premium.tier : null;
  const money = gameState.stats?.money ?? 0;

  const handleSubscribe = useCallback(
    (tier: 'plus' | 'ultra') => {
      const result = subscribeSparkPremium(setGameState, tier, 'weekly');
      if (result.success) {
        sparkHaptics.boost();
        saveGame();
        onDismiss();
      } else {
        Alert.alert('Spark Premium', result.message);
      }
    },
    [setGameState, saveGame, onDismiss],
  );

  const handleCancel = useCallback(() => {
    Alert.alert(
      'Cancel Spark Premium?',
      'You will drop back to the free tier and lose your premium perks. You can resubscribe any time.',
      [
        { text: 'Keep it', style: 'cancel' },
        {
          text: 'Cancel subscription',
          style: 'destructive',
          onPress: () => {
            cancelSparkPremium(setGameState);
            saveGame();
            onDismiss();
          },
        },
      ],
    );
  }, [setGameState, saveGame, onDismiss]);

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

          <Text style={[styles.title, { color: theme.text }]}>
            {activeTier ? `Spark ${activeTier === 'ultra' ? 'Ultra' : 'Plus'} active` : 'Upgrade Spark'}
          </Text>
          <Text style={[styles.subtitle, { color: theme.textSecondary }]}>
            {activeTier
              ? 'Billed weekly from your in-game cash.'
              : 'Unlock unlimited swipes and see who likes you.'}
          </Text>

          <ScrollView showsVerticalScrollIndicator={false} style={{ maxHeight: scale(440) }}>
            <TierCard
              icon={Zap}
              gradient={SPARK_GRADIENT as unknown as readonly [string, string]}
              name="Plus"
              price={`$${SPARK_TIER_PRICING.plus.weekly}/wk`}
              perks={PLUS_PERKS}
              onPress={() => handleSubscribe('plus')}
              theme={theme}
              active={activeTier === 'plus'}
              affordable={money >= SPARK_TIER_PRICING.plus.weekly}
            />
            <TierCard
              icon={Crown}
              gradient={SPARK_GRADIENT_GOLD as unknown as readonly [string, string]}
              name="Ultra"
              price={`$${SPARK_TIER_PRICING.ultra.weekly}/wk`}
              perks={ULTRA_PERKS}
              onPress={() => handleSubscribe('ultra')}
              theme={theme}
              recommended
              active={activeTier === 'ultra'}
              affordable={money >= SPARK_TIER_PRICING.ultra.weekly}
            />
          </ScrollView>

          {activeTier ? (
            <Pressable
              onPress={handleCancel}
              accessibilityRole="button"
              accessibilityLabel="Cancel Spark Premium subscription"
              style={[styles.cancelBtn, { borderColor: theme.border }]}
            >
              <Text style={[styles.cancelLabel, { color: theme.textSecondary }]}>Cancel subscription</Text>
            </Pressable>
          ) : null}

          <Text style={[styles.legal, { color: theme.textMuted }]}>
            {activeTier
              ? 'Auto-renews weekly until cancelled; lapses if you run out of money.'
              : `Paid from your in-game cash ($${money.toLocaleString()} available). Auto-renews weekly until cancelled.`}
          </Text>
        </View>
      </View>
    </Modal>
  );
}

function TierCard({
  icon: Icon, gradient, name, price, perks, onPress, theme, recommended, active, affordable,
}: any) {
  return (
    <Pressable
      onPress={active ? undefined : onPress}
      disabled={active || !affordable}
      accessibilityRole="button"
      accessibilityLabel={active ? `Spark ${name} is your current plan` : `Subscribe to Spark ${name}, ${price}`}
      style={({ pressed }) => [
        styles.tierCard,
        { borderColor: active ? SPARK_COLORS.success : theme.border, opacity: !active && !affordable ? 0.55 : pressed ? 0.92 : 1 },
      ]}
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
        {active ? (
          <View style={styles.recBadge}>
            <Text style={styles.recBadgeText}>CURRENT PLAN</Text>
          </View>
        ) : recommended ? (
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
  cancelBtn: {
    paddingVertical: responsiveSpacing.md,
    borderRadius: scale(14),
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: 'center',
    marginTop: responsiveSpacing.xs,
    marginBottom: responsiveSpacing.sm,
  },
  cancelLabel: {
    fontSize: fontScale(14),
    fontWeight: '600',
  },
  legal: {
    fontSize: fontScale(10),
    textAlign: 'center',
    marginTop: responsiveSpacing.sm,
  },
});
