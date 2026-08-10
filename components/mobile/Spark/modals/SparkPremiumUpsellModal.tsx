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
import React, { useCallback, useState } from 'react';
import { Alert, Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { X, Check, Crown, Zap, type LucideIcon } from 'lucide-react-native';
import Gradient from '@/components/ui/Gradient';
import { useGame } from '@/contexts/GameContext';
import { useTheme } from '@/hooks/useTheme';
import { scale, fontScale, responsiveSpacing, touchTargets } from '@/utils/scaling';
import { formatMoney } from '@/utils/moneyFormatting';
import { Z_INDEX } from '@/utils/zIndexConstants';
import { subscribeSparkPremium, cancelSparkPremium } from '@/contexts/game/actions/SparkActions';
import { SPARK_TIER_PRICING } from '@/lib/dating/sparkLogic';
import { SPARK_GRADIENT, SPARK_GRADIENT_GOLD, SPARK_COLORS } from '../styles/sparkTheme';
import { sparkHaptics } from '../utils/sparkHaptics';

const LinearGradient = Gradient;

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

  // Billing cadence — annual is a prepaid 52-week block (~17% cheaper) that
  // subscribeSparkPremium fully supports; without this toggle it was
  // unreachable (the modal always passed 'weekly').
  const [plan, setPlan] = useState<'weekly' | 'annual'>('weekly');

  const handleSubscribe = useCallback(
    (tier: 'plus' | 'ultra') => {
      const result = subscribeSparkPremium(setGameState, gameState, tier, plan);
      if (result.success) {
        sparkHaptics.boost();
        saveGame();
        onDismiss();
      } else {
        Alert.alert('Spark Premium', result.message);
      }
    },
    [setGameState, gameState, saveGame, onDismiss, plan],
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

          {/* Billing cadence toggle — hidden while a plan is active (you can't
              switch cadence without cancelling first). */}
          {!activeTier ? (
            <View style={[styles.planToggle, { borderColor: theme.border }]}>
              {(['weekly', 'annual'] as const).map((p) => {
                const selected = plan === p;
                return (
                  <Pressable
                    key={p}
                    onPress={() => setPlan(p)}
                    accessibilityRole="button"
                    accessibilityLabel={p === 'annual' ? 'Bill annually, prepaid 52 weeks — save 17%' : 'Bill weekly'}
                    accessibilityState={{ selected }}
                    style={[
                      styles.planToggleBtn,
                      selected && { backgroundColor: SPARK_COLORS.accent },
                    ]}
                  >
                    <Text
                      style={[
                        styles.planToggleText,
                        { color: selected ? '#FFFFFF' : theme.textSecondary },
                      ]}
                    >
                      {p === 'annual' ? 'Annual · Save 17%' : 'Weekly'}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          ) : null}

          <ScrollView showsVerticalScrollIndicator={false} style={{ flexShrink: 1 }}>
            <TierCard
              icon={Zap}
              gradient={SPARK_GRADIENT as unknown as readonly [string, string]}
              name="Plus"
              price={plan === 'annual'
                ? `$${SPARK_TIER_PRICING.plus.annual.toLocaleString()}/yr`
                : `$${SPARK_TIER_PRICING.plus.weekly}/wk`}
              perks={PLUS_PERKS}
              onPress={() => handleSubscribe('plus')}
              theme={theme}
              active={activeTier === 'plus'}
              anyTierActive={activeTier !== null}
              affordable={money >= SPARK_TIER_PRICING.plus[plan]}
            />
            <TierCard
              icon={Crown}
              gradient={SPARK_GRADIENT_GOLD as unknown as readonly [string, string]}
              name="Ultra"
              price={plan === 'annual'
                ? `$${SPARK_TIER_PRICING.ultra.annual.toLocaleString()}/yr`
                : `$${SPARK_TIER_PRICING.ultra.weekly}/wk`}
              perks={ULTRA_PERKS}
              onPress={() => handleSubscribe('ultra')}
              theme={theme}
              recommended
              active={activeTier === 'ultra'}
              anyTierActive={activeTier !== null}
              affordable={money >= SPARK_TIER_PRICING.ultra[plan]}
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
              ? premium?.plan === 'annual'
                ? 'Prepaid for 52 weeks. After the term it renews weekly from your in-game cash; lapses if you run out of money.'
                : 'Auto-renews weekly until cancelled; lapses if you run out of money.'
              : plan === 'annual'
                ? `Prepaid 52 weeks from your in-game cash (${formatMoney(money)} available), then renews weekly. Save ~17% vs weekly.`
                : `Paid from your in-game cash (${formatMoney(money)} available). Auto-renews weekly until cancelled.`}
          </Text>
        </View>
      </View>
    </Modal>
  );
}

interface TierCardProps {
  icon: LucideIcon;
  gradient: readonly [string, string];
  name: string;
  price: string;
  perks: readonly string[];
  onPress: () => void;
  theme: ReturnType<typeof useTheme>['theme'];
  recommended?: boolean;
  active: boolean;
  /** Any tier (this or the other) is currently active — blocks buying a second tier. */
  anyTierActive: boolean;
  affordable: boolean;
}

function TierCard({
  icon: Icon, gradient, name, price, perks, onPress, theme, recommended, active, anyTierActive, affordable,
}: TierCardProps): React.ReactElement {
  // While ANY tier is active, no tier is buyable: the active one shows CURRENT
  // PLAN; the other is disabled (no silent full-price plan swap / double charge).
  const buyable = !anyTierActive && affordable;
  return (
    <Pressable
      onPress={buyable ? onPress : undefined}
      disabled={!buyable}
      accessibilityRole="button"
      accessibilityLabel={active ? `Spark ${name} is your current plan` : `Subscribe to Spark ${name}, ${price}`}
      style={({ pressed }) => [
        styles.tierCard,
        { borderColor: active ? SPARK_COLORS.success : theme.border, opacity: !buyable && !active ? 0.55 : pressed ? 0.92 : 1 },
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
  // `maxHeight` + `flexShrink` on the list below, together. A bottom sheet with
  // no height bound grows to fit its content, so on a short screen its footer
  // button lands off the bottom of the SCREEN — and the sheet itself does not
  // scroll, so nothing can reach it. Bounding the sheet is what gives the list
  // something to shrink within. Same fix as ApplyCardModal (2026-08-02).
  sheet: {
    borderTopLeftRadius: scale(24),
    borderTopRightRadius: scale(24),
    padding: responsiveSpacing.lg,
    paddingBottom: responsiveSpacing.xl,
    maxHeight: '90%',
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
  planToggle: {
    flexDirection: 'row',
    borderRadius: scale(12),
    borderWidth: StyleSheet.hairlineWidth,
    padding: scale(3),
    marginBottom: responsiveSpacing.md,
    gap: scale(3),
  },
  planToggleBtn: {
    flex: 1,
    paddingVertical: responsiveSpacing.sm,
    borderRadius: scale(9),
    alignItems: 'center',
  },
  planToggleText: {
    fontSize: fontScale(12),
    fontWeight: '700',
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
