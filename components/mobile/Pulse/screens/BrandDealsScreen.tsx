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
import { scale, fontScale, responsiveSpacing, touchTargets, getAppScreenBottomPadding } from '@/utils/scaling';
import SegmentedControl from '@/components/ui/SegmentedControl';
import ProgressBar from '@/components/ui/ProgressBar';
import Chip from '@/components/ui/Chip';
import StatStrip from '@/components/ui/StatStrip';
import EmptyState from '../components/EmptyState';
import { PULSE_COLORS } from '../styles/pulseTheme';
import { acceptBrandDeal, brandDealBreachPenalty, breachBrandDeal, declineBrandDeal, deliverBrandDealPost } from '@/contexts/game/actions/PulseActions';
import type { PulseBrandOffer, PulseActiveBrandDeal, PulseDealHistoryEntry, PulseRecentPost } from '@/contexts/game/types';
import { gameAlert } from '@/utils/gameAlert';

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
      <SegmentedControl
        compact
        style={styles.tabs}
        segments={[
          { key: 'inbox', label: tabCount.inbox > 0 ? `Inbox ${tabCount.inbox}` : 'Inbox' },
          { key: 'active', label: tabCount.active > 0 ? `Active ${tabCount.active}` : 'Active' },
          { key: 'history', label: tabCount.history > 0 ? `History ${tabCount.history}` : 'History' },
        ]}
        value={activeTab}
        onChange={setActiveTab}
        activeColor={PULSE_COLORS.accent}
      />

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
  const logoColor = offer.logoColor1 || PULSE_COLORS.accent;
  return (
    <View style={[styles.card, { backgroundColor: theme.surface, borderColor: theme.border }]}>
      <View style={styles.cardHeader}>
        <View style={[styles.logo, { backgroundColor: logoColor }]}>
          <Text style={styles.logoText}>{offer.brandName.slice(0, 1).toUpperCase()}</Text>
        </View>
        <View style={styles.cardHeaderText}>
          <Text style={[styles.brandName, { color: theme.text }]}>{offer.brandName}</Text>
          <Text style={[styles.brandSub, { color: theme.textSecondary }]} numberOfLines={1}>
            {offer.description}
          </Text>
        </View>
        <Chip
          label={`${offer.expiresInWeeks}w left`}
          tone={expiryTone(offer.expiresInWeeks)}
          accessibilityLabel={`Offer expires in ${offer.expiresInWeeks} weeks`}
        />
      </View>

      <StatStrip
        style={styles.metaRow}
        items={[
          { label: 'Payment', value: `$${offer.payment.toLocaleString()}`, tint: PULSE_COLORS.success },
          { label: 'Posts', value: String(offer.postsRequired) },
          { label: 'Duration', value: `${offer.duration}w` },
        ]}
      />

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
          style={[styles.btnPrimary, { backgroundColor: PULSE_COLORS.accent }]}
        >
          <Text style={styles.btnPrimaryText}>Accept</Text>
        </Pressable>
      </View>
    </View>
  );
}

function ActiveDealCard({
  deal, weeksLived, onBreach, onDeliver, theme,
}: { deal: PulseActiveBrandDeal; weeksLived: number; onBreach: () => void; onDeliver: () => void; theme: any }) {
  const logoColor = deal.logoColor1 || PULSE_COLORS.accent;
  const remaining = Math.max(0, deal.expiresAt - weeksLived);
  const delivered = deal.postsDelivered ?? 0;
  const required = deal.postsRequired ?? 1;
  const progress = Math.min(1, delivered / required);
  return (
    <View style={[styles.card, { backgroundColor: theme.surface, borderColor: theme.border }]}>
      <View style={styles.cardHeader}>
        <View style={[styles.logo, { backgroundColor: logoColor }]}>
          <Text style={styles.logoText}>{deal.brandName.slice(0, 1).toUpperCase()}</Text>
        </View>
        <View style={styles.cardHeaderText}>
          <Text style={[styles.brandName, { color: theme.text }]}>{deal.brandName}</Text>
          <Text style={[styles.brandSub, { color: theme.textSecondary }]}>
            ${(deal.weeklyPayment ?? 0).toLocaleString()}/wk · {remaining}w remaining
          </Text>
        </View>
      </View>
      <ProgressBar
        value={progress}
        color={PULSE_COLORS.success}
        label={`Posts delivered: ${delivered} of ${required}`}
        style={styles.progress}
      />
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
          style={[styles.btnPrimary, { backgroundColor: PULSE_COLORS.accent }]}
        >
          <Text style={styles.btnPrimaryText}>Deliver post</Text>
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

/** Expiry urgency as a shared Chip tone: <=1w danger, <=2w warning, else info. */
function expiryTone(weeksLeft: number): 'danger' | 'warning' | 'info' {
  if (weeksLeft <= 1) return 'danger';
  if (weeksLeft <= 2) return 'warning';
  return 'info';
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  tabs: {
    margin: responsiveSpacing.md,
    marginBottom: 0,
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
    fontWeight: '600',
  },
  cardHeaderText: {
    flex: 1,
  },
  brandName: {
    fontSize: fontScale(15),
    fontWeight: '600',
  },
  brandSub: {
    fontSize: fontScale(12),
    marginTop: 2,
  },
  metaRow: {
    marginTop: responsiveSpacing.sm,
  },
  actionRow: {
    flexDirection: 'row',
    gap: responsiveSpacing.sm,
    marginTop: responsiveSpacing.md,
  },
  btnSecondary: {
    flex: 1,
    paddingVertical: responsiveSpacing.sm,
    minHeight: touchTargets.minimum,
    borderRadius: scale(10),
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  btnSecondaryText: {
    fontSize: fontScale(13),
    fontWeight: '600',
  },
  btnPrimary: {
    flex: 1,
    paddingVertical: responsiveSpacing.sm,
    minHeight: touchTargets.minimum,
    borderRadius: scale(10),
    alignItems: 'center',
    justifyContent: 'center',
  },
  btnPrimaryText: {
    color: '#FFFFFF',
    fontSize: fontScale(13),
    fontWeight: '600',
  },
  progress: {
    marginTop: responsiveSpacing.md,
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
