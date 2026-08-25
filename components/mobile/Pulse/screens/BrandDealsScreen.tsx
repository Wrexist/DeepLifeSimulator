/**
 * BrandDealsScreen - three-tab inbox: Inbox / Active / History.
 *
 * Inbox shows pending offers with accept/decline. Active shows current deals
 * with their progress and a "deliver post" button (composes a sponsored post).
 * History shows completed/failed/breached deals.
 */
import React, { useCallback, useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View  } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useGame } from '@/contexts/GameContext';
import { useTheme } from '@/hooks/useTheme';
import { scale, fontScale, responsiveSpacing, getAppScreenBottomPadding } from '@/utils/scaling';
import Gradient from '@/components/ui/Gradient';
import EmptyState from '../components/EmptyState';
import { PULSE_GRADIENT, PULSE_COLORS } from '../styles/pulseTheme';
import { acceptBrandDeal, brandDealBreachPenalty, breachBrandDeal, declineBrandDeal, deliverBrandDealPost } from '@/contexts/game/actions/PulseActions';
import type { PulseBrandOffer, PulseActiveBrandDeal, PulseDealHistoryEntry, PulseRecentPost } from '@/contexts/game/types';
import { gameAlert } from '@/utils/gameAlert';

const LinearGradient = Gradient;

type BrandTab = 'inbox' | 'active' | 'history';

interface BrandDealsScreenProps {
  onBack?: () => void;
}

export default function BrandDealsScreen({ onBack }: BrandDealsScreenProps) {
  const { gameState, setGameState, saveGame } = useGame();
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();
  const [activeTab, setActiveTab] = useState<BrandTab>('inbox');

  const sm = gameState.socialMedia;
  const pending: PulseBrandOffer[] = useMemo(() => sm?.brandInbox?.pending ?? [], [sm?.brandInbox?.pending]);
  const active: PulseActiveBrandDeal[] = useMemo(() => sm?.activeBrandDeals ?? [], [sm?.activeBrandDeals]);
  const history: PulseDealHistoryEntry[] = useMemo(() => sm?.brandInbox?.history ?? [], [sm?.brandInbox?.history]);

  // Every mutation below persists via the codebase's post-commit pattern: the
  // action commits through setGameState, but saveGame reads gameStateRef.current
  // which is synced to state in a POST-COMMIT effect. A synchronous saveGame()
  // would persist the PRE-action snapshot, so accept/decline/deliver/breach
  // progress was silently dropped on reload. Deferring to a macrotask lets the
  // commit + parent ref-sync run first, so the mutated brand-deal state is saved.
  const persist = useCallback(() => {
    setTimeout(() => { void saveGame?.(); }, 0);
  }, [saveGame]);

  const handleAccept = useCallback((id: string) => { acceptBrandDeal(gameState, setGameState, id); persist(); }, [gameState, setGameState, persist]);
  const handleDecline = useCallback((id: string) => { declineBrandDeal(setGameState, id); persist(); }, [setGameState, persist]);

  // Destructive: confirm before applying the 50% penalty. Tapping the breach
  // button on an active deal opens a 2-button alert; only the "Breach" choice
  // calls the action.
  const handleBreach = useCallback(
    (id: string) => {
      const deal = active.find((d) => d.id === id);
      const name = deal?.brandName ?? 'this brand';
      // The real charge, from the same helper the action uses. The dialog used
      // to quote `payment * 0.5` while the action charged
      // `remaining weekly payments * 1.5` - a different, usually much larger
      // number. And since the action now REFUSES a penalty the player cannot
      // afford, confirming an amount they don't have would end in silence:
      // `breachBrandDeal` reports its outcome from inside a setGameState
      // updater, which React may run after this callback has returned.
      const penalty = brandDealBreachPenalty(gameState, id) ?? 0;

      if ((gameState.stats?.money ?? 0) < penalty) {
        gameAlert(
          'Not enough cash',
          `Breaching ${name} costs $${penalty.toLocaleString()}. Withdraw from your bank or sell something first.`,
          [{ text: 'OK' }],
        );
        return;
      }

      gameAlert(
        `Breach ${name}?`,
        `You'll lose $${penalty.toLocaleString()} and the deal will be marked as breached in your history.`,
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Breach', style: 'destructive', onPress: () => { breachBrandDeal(gameState, setGameState, id); persist(); } },
        ],
      );
    },
    [setGameState, active, persist, gameState],
  );

  // Deliver-post handler: tags the player's most recent un-sponsored post as
  // fulfilling this deal. Requires the player to have composed something first;
  // surface a helpful prompt otherwise.
  const handleDeliver = useCallback(
    (dealId: string) => {
      const recent: PulseRecentPost[] = sm?.recentPosts ?? [];
      const candidate = recent.find((p) => !p.sponsoredByDealId);
      if (!candidate) {
        gameAlert(
          'No post to deliver',
          'Compose a post first, then return here to tag it as the sponsored delivery.',
        );
        return;
      }
      const r = deliverBrandDealPost(gameState, setGameState, dealId, candidate.id);
      if (!r.success) {
        gameAlert('Delivery failed', r.message);
        return;
      }
      persist();
    },
    // `gameState` is a real dependency now that the action reports from the
    // snapshot it is handed - a stale one would preview a delivery against an
    // out-of-date post list.
    [gameState, setGameState, sm?.recentPosts, persist],
  );

  const tabCount = {
    inbox: pending.length,
    active: active.length,
    history: history.length,
  };

  return (
    <View style={styles.root}>
      <View style={[styles.tabRow, { borderBottomColor: theme.border }]}>
        {(['inbox', 'active', 'history'] as BrandTab[]).map((t) => (
          <Pressable
            key={t}
            onPress={() => setActiveTab(t)}
            accessibilityRole="tab"
            accessibilityState={{ selected: activeTab === t }}
            style={styles.tabBtn}
          >
            <Text
              style={[
                styles.tabLabel,
                {
                  color: activeTab === t ? theme.text : theme.textSecondary,
                  fontWeight: activeTab === t ? '700' : '500',
                },
              ]}
            >
              {t.charAt(0).toUpperCase() + t.slice(1)}
              {tabCount[t] > 0 ? <Text style={[styles.tabCount, { color: theme.textSecondary }]}> {tabCount[t]}</Text> : null}
            </Text>
            {activeTab === t ? (
              <LinearGradient
                colors={PULSE_GRADIENT as unknown as string[]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={styles.indicator}
              />
            ) : null}
          </Pressable>
        ))}
      </View>

      <ScrollView contentContainerStyle={[styles.scroll, { paddingBottom: getAppScreenBottomPadding(insets.bottom) }]} showsVerticalScrollIndicator={false}>
        {activeTab === 'inbox' && pending.length === 0 && (
          <EmptyState
            observation="No offers yet."
            nudge="Hit 10K followers and brands will start to notice."
          />
        )}
        {activeTab === 'inbox' &&
          pending.map((o) => (
            <BrandOfferCard
              key={o.id}
              offer={o}
              onAccept={() => handleAccept(o.id)}
              onDecline={() => handleDecline(o.id)}
              theme={theme}
            />
          ))}

        {activeTab === 'active' && active.length === 0 && (
          <EmptyState observation="No active deals." nudge="Accept an offer from your inbox." />
        )}
        {activeTab === 'active' &&
          active.map((d) => (
            <ActiveDealCard
              key={d.id}
              deal={d}
              weeksLived={gameState.weeksLived ?? 0}
              onBreach={() => handleBreach(d.id)}
              onDeliver={() => handleDeliver(d.id)}
              theme={theme}
            />
          ))}

        {activeTab === 'history' && history.length === 0 && (
          <EmptyState observation="No past deals." nudge="Completed and failed deals land here." />
        )}
        {activeTab === 'history' &&
          history
            .slice()
            .reverse()
            .map((h) => <HistoryRow key={h.id + h.completedWeek} entry={h} theme={theme} />)}
      </ScrollView>
    </View>
  );
}

function BrandOfferCard({
  offer, onAccept, onDecline, theme,
}: {
  offer: PulseBrandOffer; onAccept: () => void; onDecline: () => void; theme: any;
}) {
  const c1 = offer.logoColor1 || PULSE_GRADIENT[0];
  const c2 = offer.logoColor2 || PULSE_GRADIENT[1];
  return (
    <View style={[styles.card, { backgroundColor: theme.surface, borderColor: theme.border }]}>
      <View style={styles.cardHeader}>
        <LinearGradient
          colors={[c1, c2]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.logo}
        >
          <Text style={styles.logoText}>{offer.brandName.slice(0, 1).toUpperCase()}</Text>
        </LinearGradient>
        <View style={styles.cardHeaderText}>
          <Text style={[styles.brandName, { color: theme.text }]}>{offer.brandName}</Text>
          <Text style={[styles.brandSub, { color: theme.textSecondary }]} numberOfLines={1}>
            {offer.description}
          </Text>
        </View>
        <View style={[styles.expiryChip, expiryStyle(offer.expiresInWeeks)]}>
          <Text style={styles.expiryText}>{offer.expiresInWeeks}w left</Text>
        </View>
      </View>

      <View style={styles.metaRow}>
        <Meta label="Payment" value={`$${offer.payment.toLocaleString()}`} theme={theme} highlight />
        <Meta label="Posts" value={String(offer.postsRequired)} theme={theme} />
        <Meta label="Duration" value={`${offer.duration}w`} theme={theme} />
      </View>

      <View style={styles.actionRow}>
        <Pressable
          onPress={onDecline}
          accessibilityRole="button"
          accessibilityLabel={`Decline ${offer.brandName}`}
          style={[styles.btnSecondary, { borderColor: theme.border }]}
        >
          <Text style={[styles.btnSecondaryText, { color: theme.text }]}>Decline</Text>
        </Pressable>
        <Pressable
          onPress={onAccept}
          accessibilityRole="button"
          accessibilityLabel={`Accept ${offer.brandName}`}
          style={styles.btnPrimaryWrap}
        >
          <LinearGradient
            colors={PULSE_GRADIENT as unknown as string[]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={styles.btnPrimary}
          >
            <Text style={styles.btnPrimaryText}>Accept</Text>
          </LinearGradient>
        </Pressable>
      </View>
    </View>
  );
}

function ActiveDealCard({
  deal, weeksLived, onBreach, onDeliver, theme,
}: { deal: PulseActiveBrandDeal; weeksLived: number; onBreach: () => void; onDeliver: () => void; theme: any }) {
  const c1 = deal.logoColor1 || PULSE_GRADIENT[0];
  const c2 = deal.logoColor2 || PULSE_GRADIENT[1];
  const remaining = Math.max(0, deal.expiresAt - weeksLived);
  const delivered = deal.postsDelivered ?? 0;
  const required = deal.postsRequired ?? 1;
  const progress = Math.min(1, delivered / required);
  return (
    <View style={[styles.card, { backgroundColor: theme.surface, borderColor: theme.border }]}>
      <View style={styles.cardHeader}>
        <LinearGradient
          colors={[c1, c2]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.logo}
        >
          <Text style={styles.logoText}>{deal.brandName.slice(0, 1).toUpperCase()}</Text>
        </LinearGradient>
        <View style={styles.cardHeaderText}>
          <Text style={[styles.brandName, { color: theme.text }]}>{deal.brandName}</Text>
          <Text style={[styles.brandSub, { color: theme.textSecondary }]}>
            ${(deal.weeklyPayment ?? 0).toLocaleString()}/wk · {remaining}w remaining
          </Text>
        </View>
      </View>
      <View style={[styles.progress, { backgroundColor: theme.border }]}>
        <View style={[styles.progressFill, { width: `${progress * 100}%`, backgroundColor: PULSE_COLORS.success }]} />
      </View>
      <Text style={[styles.progressText, { color: theme.textSecondary }]}>
        Posts delivered: {delivered}/{required}
      </Text>
      <View style={styles.actionRow}>
        <Pressable
          onPress={onBreach}
          accessibilityRole="button"
          accessibilityLabel={`Breach contract with ${deal.brandName}`}
          style={[styles.btnSecondary, { borderColor: PULSE_COLORS.danger }]}
        >
          <Text style={[styles.btnSecondaryText, { color: PULSE_COLORS.danger }]}>Breach (penalty)</Text>
        </Pressable>
        <Pressable
          onPress={onDeliver}
          accessibilityRole="button"
          accessibilityLabel={`Deliver post for ${deal.brandName}`}
          style={styles.btnPrimaryWrap}
        >
          <LinearGradient
            colors={PULSE_GRADIENT as unknown as string[]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={styles.btnPrimary}
          >
            <Text style={styles.btnPrimaryText}>Deliver post</Text>
          </LinearGradient>
        </Pressable>
      </View>
    </View>
  );
}

function HistoryRow({ entry, theme }: { entry: PulseDealHistoryEntry; theme: any }) {
  const color =
    entry.result === 'success'
      ? PULSE_COLORS.success
      : entry.result === 'failed'
      ? PULSE_COLORS.warning
      : PULSE_COLORS.danger;
  return (
    <View style={[styles.histRow, { borderBottomColor: theme.border }]}>
      <View style={[styles.histDot, { backgroundColor: color }]} />
      <View style={styles.histText}>
        <Text style={[styles.histBrand, { color: theme.text }]}>{entry.brandName}</Text>
        <Text style={[styles.histSub, { color: theme.textSecondary }]}>
          {entry.result.toUpperCase()} · ${entry.totalPaid.toLocaleString()} · week {entry.completedWeek}
        </Text>
      </View>
    </View>
  );
}

function Meta({ label, value, theme, highlight }: { label: string; value: string; theme: any; highlight?: boolean }) {
  return (
    <View style={styles.metaItem}>
      <Text style={[styles.metaLabel, { color: theme.textSecondary }]}>{label}</Text>
      <Text
        style={[
          styles.metaValue,
          { color: highlight ? PULSE_COLORS.success : theme.text, fontWeight: highlight ? '700' : '600' },
        ]}
      >
        {value}
      </Text>
    </View>
  );
}

function expiryStyle(weeksLeft: number) {
  if (weeksLeft <= 1) return { backgroundColor: 'rgba(239, 68, 68, 0.18)' };
  if (weeksLeft <= 2) return { backgroundColor: 'rgba(245, 158, 11, 0.18)' };
  return { backgroundColor: 'rgba(99, 102, 241, 0.18)' };
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  tabRow: {
    flexDirection: 'row',
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  tabBtn: {
    flex: 1,
    paddingVertical: responsiveSpacing.md,
    alignItems: 'center',
    position: 'relative',
  },
  tabLabel: { fontSize: fontScale(13) },
  tabCount: { fontSize: fontScale(11) },
  indicator: {
    position: 'absolute',
    bottom: 0,
    left: '25%',
    right: '25%',
    height: 3,
    borderRadius: 999,
  },
  scroll: {
    paddingBottom: scale(140),
    padding: responsiveSpacing.md,
    gap: responsiveSpacing.md,
  },
  card: {
    borderRadius: scale(14),
    borderWidth: StyleSheet.hairlineWidth,
    padding: responsiveSpacing.md,
    marginBottom: responsiveSpacing.md,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: responsiveSpacing.sm,
  },
  logo: {
    width: scale(44),
    height: scale(44),
    borderRadius: scale(10),
    alignItems: 'center',
    justifyContent: 'center',
  },
  logoText: {
    color: '#FFFFFF',
    fontSize: fontScale(20),
    fontWeight: '700',
  },
  cardHeaderText: {
    flex: 1,
  },
  brandName: {
    fontSize: fontScale(15),
    fontWeight: '700',
  },
  brandSub: {
    fontSize: fontScale(12),
    marginTop: 2,
  },
  expiryChip: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  expiryText: {
    color: '#FFFFFF',
    fontSize: fontScale(10),
    fontWeight: '600',
  },
  metaRow: {
    flexDirection: 'row',
    marginTop: responsiveSpacing.md,
    gap: responsiveSpacing.md,
  },
  metaItem: {
    flex: 1,
  },
  metaLabel: {
    fontSize: fontScale(10),
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  metaValue: {
    fontSize: fontScale(14),
    marginTop: 2,
  },
  actionRow: {
    flexDirection: 'row',
    gap: responsiveSpacing.sm,
    marginTop: responsiveSpacing.md,
  },
  btnSecondary: {
    flex: 1,
    paddingVertical: responsiveSpacing.sm,
    borderRadius: scale(10),
    borderWidth: 1,
    alignItems: 'center',
  },
  btnSecondaryText: {
    fontSize: fontScale(13),
    fontWeight: '600',
  },
  btnPrimaryWrap: {
    flex: 1,
    borderRadius: scale(10),
    overflow: 'hidden',
  },
  btnPrimary: {
    paddingVertical: responsiveSpacing.sm,
    alignItems: 'center',
  },
  btnPrimaryText: {
    color: '#FFFFFF',
    fontSize: fontScale(13),
    fontWeight: '700',
  },
  progress: {
    height: 6,
    borderRadius: 3,
    overflow: 'hidden',
    marginTop: responsiveSpacing.md,
  },
  progressFill: {
    height: '100%',
  },
  progressText: {
    fontSize: fontScale(11),
    marginTop: 4,
  },
  histRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: responsiveSpacing.sm,
    paddingVertical: responsiveSpacing.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  histDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  histText: {
    flex: 1,
  },
  histBrand: {
    fontSize: fontScale(13),
    fontWeight: '600',
  },
  histSub: {
    fontSize: fontScale(11),
    marginTop: 2,
  },
});
