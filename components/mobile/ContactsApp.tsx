/**
 * ContactsApp - Social-CRM remake (Remake 11, on top of Slate Glass).
 *
 * The network spine, now with a personal-CRM body instead of uniform rows:
 *   - Personal → contact rows with an AVATAR + strength RING + last-contact
 *     recency dot, a "relationship portfolio" hero (inner-circle avatar stack +
 *     summary), and a densified expanded profile (job, income, dates, gifts,
 *     milestones, goals, gift tastes/dislikes, borrowing streak, life events).
 *   - Network  → company-badge TILES (2-up grid) + a read-only detail page
 *     (list → detail) surfacing every ContactView field.
 *   - Favors   → a LEDGER: signed +/- transaction rows in one grouped card,
 *     plus a settled-history section.
 *   - Attention→ TRIAGE cards, each with one clear primary action (Call to
 *     reconnect for personal, View profile for network allies).
 *
 * Slate Glass tokens stay binding: amber identity, Recipe A/B/C/D, crash-safe
 * `Gradient` (react-native-svg) + getPlatformShadows only. ZERO REMOVAL - every action
 * and readout the old file had is still reachable.
 */

import React, { useCallback, useMemo, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, FlatList } from 'react-native';
import {
  ArrowLeft,
  Heart,
  Phone,
  Gift,
  DollarSign,
  Coffee,
  MessageCircle,
  Sparkles,
  Users,
  Vote,
  ShieldAlert,
  Briefcase,
  Building2,
  Star,
  ChevronDown,
  ChevronRight,
  AlertTriangle,
  Handshake,
  Award,
  Baby,
  Ban,
  Gem,
  UserMinus,
  UserPlus,
  Pin,
  Target,
  X as XIcon,
} from 'lucide-react-native';
import { useGame } from '@/contexts/GameContext';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTimerManager } from '@/hooks/useTimerManager';
import type { Relationship } from '@/contexts/game/types';
import { aggregateContacts, ContactView, contactsNeedingAttention } from '@/lib/contacts/aggregator';
import { netMoneyPosition, openFavors, FavorLedger, Favor, addFavor } from '@/lib/contacts/favors';
import { goOnDate, giveGift, proposeMarriage, calculateDivorceCosts, DATE_CONFIGS, type DateType } from '@/contexts/game/actions/DatingActions';
import {
  currentIntroduction,
  meetBlockedReason,
  MEET_ENERGY_COST,
} from '@/lib/social/meetPeople';
import RingSelectionModal from '@/components/mobile/RingSelectionModal';
import WeddingPlanningModal from '@/components/mobile/WeddingPlanningModal';
import DivorceConfirmModal from '@/components/mobile/DivorceConfirmModal';
import {
  redeemFavor,
  repayFavor,
  recordInteraction,
  lendMoney,
  recordFavor,
  askNetworkFavor,
  meetSomeone,
  removeContact as removeContactAction,
  raiseRelationship as raiseRelationshipAction,
  relationshipBondCost,
  isFamilyRelationship,
  FAVOR_KIND_BY_CONTACT,
  NETWORK_FAVOR_MIN_STRENGTH,
} from '@/contexts/game/actions/ContactsActions';
import { applyMoneyDelta } from '@/contexts/game/actions/MoneyActions';
import CharacterAvatar from '@/components/avatar/CharacterAvatar';
import { childParentSources } from '@/lib/avatar/family';
import { getMoodLabel } from '@/lib/social/npcDepth';
import { getThemeColors, accent, withAlpha } from '@/lib/config/theme';
import { kicker, rhythm } from '@/lib/config/hierarchy';
import {
  getGlassCard,
  getGlassButton,
  getPlatformShadows,
} from '@/utils/glassmorphismStyles';
import Gradient from '@/components/ui/Gradient';
import ProgressRing from '@/components/ui/ProgressRing';
import {
  responsiveFontSize as fs,
  responsiveSpacing as sp,
  responsiveBorderRadius as br,
  scale,
  fontScale,
  touchTargets,
  getAppScreenBottomPadding,
} from '@/utils/scaling';
import { gameAlert } from '@/utils/gameAlert';
import AppHeader from '@/components/ui/AppHeader';
import SegmentedControl from '@/components/ui/SegmentedControl';
import StatStrip from '@/components/ui/StatStrip';
import Chip from '@/components/ui/Chip';
import SectionTitle from '@/components/ui/SectionTitle';
import EmptyState from '@/components/ui/EmptyState';
import CollapsibleSection from '@/components/ui/CollapsibleSection';
import { IconBubble } from '@/components/ui/Card';
import { useToast } from '@/contexts/ToastContext';

const LinearGradient = Gradient;

type TabType = 'personal' | 'network' | 'favors' | 'attention';

// Date sheet metadata - icon + one-line vibe per tier. Prices are read from
// DATE_CONFIGS (the single source of truth in DatingActions) so the sheet can
// never drift from what goOnDate actually charges. Order: cheapest → most
// lavish. `chat` is the free maintain-the-bond option for broke players.
const DATE_TIER_META: {
  type: DateType;
  label: string;
  vibe: string;
  Icon: React.ComponentType<{ size: number; color: string }>;
  color: string;
}[] = [
  { type: 'chat', label: 'Chat', vibe: 'Free catch-up to keep things warm', Icon: MessageCircle, color: accent.muted },
  { type: 'casual', label: 'Casual hangout', vibe: 'Low-key time together', Icon: Coffee, color: accent.info },
  { type: 'coffee', label: 'Coffee', vibe: 'Quick, cheap and easy', Icon: Coffee, color: accent.info },
  { type: 'dinner', label: 'Dinner', vibe: 'A proper sit-down date', Icon: Heart, color: accent.danger },
  { type: 'romantic', label: 'Romantic', vibe: 'Candlelight and full attention', Icon: Heart, color: accent.purple },
  { type: 'adventure', label: 'Adventure', vibe: 'A big day out to remember', Icon: Sparkles, color: accent.success },
  { type: 'luxury', label: 'Luxury', vibe: 'Spare no expense', Icon: Star, color: accent.gold },
];

interface ContactsAppProps {
  onBack: () => void;
}

/** Module scope, so it is genuinely stable across renders. */
const personalKeyExtractor = (c: ContactView) => c.id;

export default function ContactsApp({ onBack }: ContactsAppProps) {
  const {
    gameState,
    setGameState,
    updateMoney,
    updateStats,
    breakUpWithPartner,
    moveInTogether,
    fileDivorce,
    saveGame,
  } = useGame();
  // Auto-cleaned timers so the feedback-clear flash can't setState after unmount.
  const timers = useTimerManager();
  const { showToast } = useToast();
  const insets = useSafeAreaInsets();
  const darkMode = !!gameState.settings?.darkMode;
  const theme = getThemeColors(darkMode);

  // Recipe A - the standard elevated card surface shared by every contact row:
  // solid fill (contrast + Android elevation), one thin border, friendly 16pt radius.
  const cardSurface = [
    styles.card,
    getGlassCard(darkMode, 6),
    { backgroundColor: theme.surface, borderColor: theme.border, borderWidth: 1, borderRadius: br.xl },
  ];

  // The summary card each tab opens with. One flat surface and one label: the
  // glow blob and the lit hairline it used to carry were decoration on a card
  // whose whole job is to hold three numbers, and the numbers now come from the
  // shared StatStrip - so what a player reads here is the same shape as every
  // other strip in the app.
  const statsHero = (title: string, children: React.ReactNode) => (
    <View
      style={[
        getGlassCard(darkMode, 12),
        {
          backgroundColor: theme.surface,
          borderColor: darkMode ? theme.glassBorder : theme.border,
          borderWidth: 1,
          borderRadius: br['2xl'],
        },
      ]}
    >
      <View style={styles.heroInner}>
        <Text style={[styles.statsTitle, { color: theme.textMuted }]}>{title}</Text>
        {children}
      </View>
    </View>
  );

  const [activeTab, setActiveTab] = useState<TabType>('personal');
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<{ id?: string; message: string } | null>(null);
  const [ringTargetId, setRingTargetId] = useState<string | null>(null);
  const [weddingTargetId, setWeddingTargetId] = useState<string | null>(null);
  const [divorceTargetId, setDivorceTargetId] = useState<string | null>(null);
  // list → detail routing: the network/ally ContactView shown on its own page.
  const [networkDetailId, setNetworkDetailId] = useState<string | null>(null);
  const [showSettled, setShowSettled] = useState(false);

  // Whose faces the children inherit. Memoized because it is passed to every
  // child avatar, and a fresh object each render would defeat their memoization.
  //
  // Narrowed to the two fields `childParentSources` actually reads. Keyed on
  // the whole `gameState` it would return a new object on every stat tick, so
  // every child avatar would rebuild its SVG each week - the exact cost this
  // memo exists to avoid.
  const parentSources = useMemo(
    () => childParentSources(gameState),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [gameState.userProfile, gameState.relationships]
  );

  // aggregateContacts walks 5+ arrays. Only re-run when the underlying source
  // arrays actually change - not on every gameState mutation (e.g., stat ticks).
  const allContacts = useMemo(
    () => aggregateContacts(gameState),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [
      gameState.relationships,
      gameState.politics?.lobbyists,
      gameState.politics?.alliances,
      gameState.darkWeb?.vendors,
      gameState.travel?.businessOpportunities,
      gameState.companies,
    ]
  );
  const personalContacts = useMemo(
    () => allContacts.filter((c) => c.kind === 'family' || c.kind === 'partner' || c.kind === 'friend'),
    [allContacts]
  );
  const networkContacts = useMemo(
    () => allContacts.filter((c) => c.kind !== 'family' && c.kind !== 'partner' && c.kind !== 'friend'),
    [allContacts]
  );
  const needAttention = useMemo(() => contactsNeedingAttention(allContacts), [allContacts]);

  // Top of the personal book by bond strength - powers the hero avatar stack.
  const topPersonal = useMemo(
    () => [...personalContacts].sort((a, b) => b.strength - a.strength).slice(0, 4),
    [personalContacts]
  );
  const personalCount = personalContacts.length;
  const avgStrength = personalCount
    ? Math.round(personalContacts.reduce((s, c) => s + c.strength, 0) / personalCount)
    : 0;
  const strongCount = personalContacts.filter((c) => c.strength >= 70).length;
  // The at-risk contacts the Personal tab can actually act on (a network
  // contact's triage action is "View profile", which belongs on Attention).
  // Sorted worst-first - weakest bond, then longest silence - because the tab
  // promotes exactly ONE of them to its lead slot: the one closest to being lost.
  const personalAtRisk = useMemo(
    () =>
      needAttention
        .filter((c) => c.kind === 'family' || c.kind === 'partner' || c.kind === 'friend')
        .sort((a, b) => a.strength - b.strength || (b.weeksSinceContact ?? 0) - (a.weeksSinceContact ?? 0)),
    [needAttention]
  );
  const worstAtRisk = personalAtRisk[0];

  /**
   * Who is around to meet this week, and why not if nobody is.
   *
   * Derived, never stored: `currentIntroduction` is a pure function of the life
   * and the week (`lib/social/meetPeople.ts`), so rendering it every frame costs
   * nothing and a reload cannot change who is standing there.
   */
  const introduction = useMemo(
    () => currentIntroduction(gameState),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [
      gameState.weeksLived,
      gameState.lifeStartWeek,
      gameState.relationships,
      gameState.currentJob,
      gameState.educations,
      gameState.rental,
      gameState.stats?.fitness,
    ]
  );
  const meetBlocked = introduction ? meetBlockedReason(gameState) : null;

  const networkCost = useMemo(
    () => networkContacts.reduce((s, c) => s + (c.costPerWeek ?? 0), 0),
    [networkContacts]
  );

  const ledger: FavorLedger = gameState.favorLedger ?? { favors: [] };
  const open = useMemo(() => openFavors(ledger), [ledger]);
  const settled = useMemo(() => ledger.favors.filter((f) => f.status !== 'open'), [ledger]);
  const moneyPos = useMemo(() => netMoneyPosition(ledger), [ledger]);

  // Map a favor's contactId to a friendly display name where we can resolve it.
  const nameForContactId = useCallback(
    (id: string) => allContacts.find((c) => c.id === id)?.name ?? id,
    [allContacts]
  );

  const detailContact = networkDetailId ? allContacts.find((c) => c.id === networkDetailId) : undefined;
  const inDetail = !!detailContact;

  const handleBack = useCallback(() => {
    if (networkDetailId) setNetworkDetailId(null);
    else onBack();
  }, [networkDetailId, onBack]);

  const flash = useCallback((message: string, id?: string) => {
    setFeedback({ id, message });
    timers.setTimeout(() => setFeedback(null), 2800);
  }, [timers]);

  const updateMoneyDep = useCallback(
    (_set: any, amount: number, reason: string) => updateMoney(amount, reason),
    [updateMoney]
  );
  const updateStatsDep = useCallback((_set: any, stats: any) => updateStats(stats), [updateStats]);

  // ANNIVERSARY: the grant (happiness + milestone + Pulse post) now runs in the
  // weekly tick (contexts/game/actions/weekly/applyAnniversaries.ts) for every
  // married player regardless of which screen is open - the old ContactsApp
  // useEffect only fired when Contacts happened to be mounted on the exact
  // anniversary week, silently missing the reward otherwise. Removed to keep a
  // single, deterministic code path.

  const handleDate = useCallback(
    (contactId: string, dateType: DateType) => {
      const r = goOnDate(gameState, setGameState, contactId, dateType, {
        updateMoney: updateMoneyDep,
        updateStats: updateStatsDep,
      });
      if (r.success) saveGame();
      flash(r.message, contactId);
    },
    [gameState, setGameState, updateMoneyDep, updateStatsDep, saveGame, flash]
  );

  const handleGift = useCallback(
    (contactId: string, giftType: 'flowers' | 'jewelry' | 'luxury') => {
      const r = giveGift(gameState, setGameState, contactId, giftType, {
        updateMoney: updateMoneyDep,
        updateStats: updateStatsDep,
      });
      if (r.success) {
        saveGame();
        // A generous gift at a strong bond leaves them owing you one - a natural
        // producer of an owed-to-player (non-money) favor, so the Redeem side of
        // the ledger actually populates. Deduped to one open goodwill favor per
        // contact (recordFavor is also id-idempotent).
        const rel = gameState.relationships?.find((x) => x.id === contactId);
        const bond = rel?.relationshipScore ?? 0;
        const ledger = gameState.favorLedger ?? { favors: [] };
        const alreadyOwes = ledger.favors.some(
          (f) => f.contactId === contactId && f.direction === 'owed-to-player' && f.status === 'open'
        );
        if (bond >= 70 && !alreadyOwes) {
          const ws = gameState.weeksLived ?? 0;
          recordFavor(setGameState, {
            id: `goodwill-${contactId}-${ws}`,
            contactId,
            direction: 'owed-to-player',
            kind: 'intro',
            value: 25,
            createdWeek: ws,
            note: `${rel?.name ?? 'They'} owes you a favor after your generosity`,
          });
        }
      }
      flash(r.message, contactId);
    },
    [gameState, setGameState, updateMoneyDep, updateStatsDep, saveGame, flash]
  );

  // Call / Hang Out - routes through the ContactsActions.recordInteraction
  // helper so the UI never mutates state inline (mechanics ground rule #3). The
  // helper stamps lastInteractionWeek + bumps weeklyInteractions atomically, so
  // this warms the recency dot, lights the "This wk" chip, and clears the
  // Attention tab.
  const handleSimple = useCallback(
    (contactId: string, action: string, cost: number, bonus: number) => {
      const r = recordInteraction(gameState, setGameState, contactId, action, cost, bonus);
      flash(r.message, contactId);
    },
    [gameState, setGameState, flash]
  );

  // Bond / Remove - PLAYER REPORT (BBQ, 2026-08-21): "there needs to be a way
  // to remove or make inactive [contacts]" and "options … to raise the
  // relationship or remove them." Both route through ContactsActions so state
  // is never mutated inline; the action module owns the family guard, the
  // once-per-week gate and the atomic money leg.
  const handleBond = useCallback(
    (contactId: string) => {
      const r = raiseRelationshipAction(gameState, setGameState, contactId);
      flash(r.message, contactId);
    },
    [gameState, setGameState, flash]
  );

  /**
   * Meet the person this week is offering (Program 11).
   *
   * The card this drives is the only tier-1 way anybody new enters a life -
   * Spark is tier 2 and the network `intro` favour needs a travel contact. It
   * is deliberately on the PERSONAL tab, above the portfolio: the question
   * "where do people come from?" should be answered on the screen that lists
   * the people.
   */
  const handleMeet = useCallback(() => {
    const r = meetSomeone(gameState, setGameState);
    flash(r.message);
    if (r.success) showToast(r.message, 'success');
  }, [gameState, setGameState, flash, showToast]);

  const handleRemoveContact = useCallback(
    (rel: Relationship) => {
      gameAlert(
        'Remove contact',
        `Cut ${rel.name} out of your life? This cannot be undone.`,
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Remove',
            style: 'destructive',
            onPress: () => {
              const r = removeContactAction(gameState, setGameState, rel.id);
              if (r.success) saveGame();
              flash(r.message, rel.id);
            },
          },
        ]
      );
    },
    [gameState, setGameState, flash, saveGame]
  );


  // "Ask $" - the button previously cost 5 relationship points and granted
  // NOTHING (the money leg was never wired; the pity-system fields on
  // Relationship existed but were unused). Success scales with relationship
  // score, with a guaranteed grant after 5 straight refusals. Gate re-check +
  // relationship update + money grant happen in ONE updater; the roll is
  // pre-rolled so the updater stays StrictMode-pure.
  const askOutcome = useCallback((rel: Relationship, roll: number) => {
    const score = rel.relationshipScore ?? 0;
    const attempts = rel.moneyRequestAttempts ?? 0;
    const granted = attempts >= 5 || roll < Math.min(0.85, score / 150);
    const amount = granted ? Math.round(25 + score * 1.5) : 0;
    return { granted, amount };
  }, []);

  const handleAskMoney = useCallback(
    (contactId: string) => {
      const rel = gameState.relationships?.find((r) => r.id === contactId);
      if (!rel) return;
      const ws = gameState.weeksLived ?? 0;
      if (rel.actions?.['askmoney'] === ws) {
        flash('Already asked this week.', contactId);
        return;
      }
      const roll = Math.random();
      setGameState((prev) => {
        const rels = prev.relationships ?? [];
        const idx = rels.findIndex((r) => r.id === contactId);
        if (idx === -1) return prev;
        const target = rels[idx];
        const prevWs = prev.weeksLived ?? 0;
        if (target.actions?.['askmoney'] === prevWs) return prev;
        const { granted, amount } = askOutcome(target, roll);
        // Asking counts as a contact - stamp recency so the dot warms and the
        // Attention tab clears (weeklyInteractions resets in a fresh week).
        const weeklyInteractions =
          target.lastInteractionWeek === prevWs ? (target.weeklyInteractions ?? 0) + 1 : 1;
        const updatedRel: Relationship = {
          ...target,
          relationshipScore: Math.max(0, (target.relationshipScore ?? 0) + (granted ? -3 : -5)),
          actions: { ...(target.actions ?? {}), askmoney: prevWs },
          moneyRequestAttempts: granted ? 0 : (target.moneyRequestAttempts ?? 0) + 1,
          lastMoneyRequest: prevWs,
          lastInteractionWeek: prevWs,
          weeklyInteractions,
        };
        const newRels = [...rels];
        newRels[idx] = updatedRel;
        if (!granted) return { ...prev, relationships: newRels };
        const grant = applyMoneyDelta(prev, amount, `Borrowed from ${target.name}`);
        if (!grant) return { ...prev, relationships: newRels };
        // A granted loan becomes a real owed-by-player IOU in the Favors ledger,
        // so borrowing has a consequence (repay it later - a pure money sink).
        // No expiresWeek: the debt persists until repaid rather than lapsing into
        // free money. Stable id (once-per-week askmoney gate) keeps a same-batch
        // double-tap from ever minting two IOUs.
        const iouId = `iou-${contactId}-${prevWs}`;
        const ledger = prev.favorLedger ?? { favors: [] };
        const nextLedger = ledger.favors.some((f) => f.id === iouId)
          ? ledger
          : addFavor(ledger, {
              id: iouId,
              contactId,
              direction: 'owed-by-player',
              kind: 'money',
              value: amount,
              createdWeek: prevWs,
              note: `Borrowed $${amount.toLocaleString()} from ${target.name}`,
            });
        return { ...prev, ...grant, relationships: newRels, favorLedger: nextLedger };
      });
      // Message from the snapshot + the same pre-rolled RNG (updater is
      // authoritative for state; this only phrases the feedback).
      const { granted, amount } = askOutcome(rel, roll);
      flash(
        granted
          ? `${rel.name} lent you $${amount.toLocaleString()}. (-3)`
          : `${rel.name} said no this time. (-5)`,
        contactId
      );
      saveGame();
    },
    [gameState, setGameState, saveGame, flash, askOutcome]
  );

  // "Lend $" - the producer for owed-to-player money favors. Debits the player
  // now and books an IOU the contact repays via the Redeem button (which credits
  // the cash back). Routed through the ContactsActions.lendMoney helper so the UI
  // never mutates state inline.
  const handleLendMoney = useCallback(
    (contactId: string, amount: number) => {
      const r = lendMoney(gameState, setGameState, contactId, amount);
      if (r.success) saveGame();
      flash(r.message, contactId);
    },
    [gameState, setGameState, saveGame, flash]
  );

  /**
   * X-2: the network half of Contacts had no action at all - hero, Overview,
   * Tags, "Back to network". `askNetworkFavor` is its producer, and the favor it
   * books is redeemed from the Favors tab like any other.
   */
  const handleAskFavor = useCallback(
    (c: ContactView) => {
      const r = askNetworkFavor(gameState, setGameState, {
        id: c.id,
        name: c.name,
        kind: c.kind,
        strength: c.strength,
      });
      if (r.success) saveGame();
      flash(r.message, c.id);
    },
    [gameState, setGameState, saveGame, flash]
  );

  const handleRedeemFavor = useCallback(
    (favorId: string) => {
      const r = redeemFavor(gameState, setGameState, favorId);
      if (r.success) {
        saveGame();
        showToast(r.message, 'success');
      } else {
        gameAlert('Cannot redeem', r.message);
      }
    },
    [gameState, setGameState, saveGame, showToast]
  );

  const handleRepayFavor = useCallback(
    (favorId: string) => {
      const r = repayFavor(gameState, setGameState, favorId);
      if (r.success) {
        saveGame();
        showToast(r.message, 'success');
      } else {
        gameAlert('Cannot repay', r.message);
      }
    },
    [gameState, setGameState, saveGame, showToast]
  );

  const handleSpecial = useCallback(
    (contactId: string, action: 'propose' | 'movein' | 'breakup' | 'divorce') => {
      if (action === 'propose') {
        // Ring-selection flow → canonical proposeMarriage (the old
        // proposeToPartner stub charged a flat $5k and had no ring).
        setRingTargetId(contactId);
        return;
      }
      if (action === 'divorce') {
        // Divorce-confirmation flow → DivorceConfirmModal, where the player can
        // hire a lawyer to fight the settlement. The actual fileDivorce call
        // (with the chosen lawyerId) happens in handleConfirmDivorce on confirm.
        setDivorceTargetId(contactId);
        return;
      }
      const fn = action === 'movein' ? moveInTogether : breakUpWithPartner;
      const r: any = fn(contactId);
      if (r) {
        if (r.success) saveGame();
        flash(r.message, contactId);
      }
    },
    [moveInTogether, breakUpWithPartner, saveGame, flash]
  );

  const handleProposeWithRing = useCallback(
    (ringId: string) => {
      const contactId = ringTargetId;
      setRingTargetId(null);
      if (!contactId) return;
      const r = proposeMarriage(gameState, setGameState, contactId, ringId, {
        updateMoney: updateMoneyDep,
        updateStats: updateStatsDep,
      });
      if (r.success) saveGame();
      if (r.accepted) {
        gameAlert('Congratulations!', `${r.message}\n\nNext step: plan the wedding!`);
      } else {
        flash(r.message, contactId);
      }
    },
    [ringTargetId, gameState, setGameState, updateMoneyDep, updateStatsDep, saveGame, flash]
  );

  // Divorce confirmation → fileDivorce(spouseId, lawyerId). The useGame() wrapper
  // forwards lawyerId to the backend, so "Fight the Settlement" (lawyer choice in
  // the modal) actually reduces the settlement; a bare confirm passes undefined
  // and divorces at the base settlement. onClose just clears the target.
  const handleConfirmDivorce = useCallback(
    (lawyerId?: string) => {
      const contactId = divorceTargetId;
      setDivorceTargetId(null);
      if (!contactId) return;
      const r: any = fileDivorce(contactId, lawyerId);
      if (r) {
        if (r.success) saveGame();
        flash(r.message, contactId);
      }
    },
    [divorceTargetId, fileDivorce, saveGame, flash]
  );

  // ---- Personal: CRM row (avatar + recency dot + strength ring) --------------
/**
 * A ContactView carries only an opaque `raw` reference, so the face has to be
 * read out of it defensively - `raw` is genuinely `unknown` and may be any of
 * the source systems' records. Guarded rather than cast (Hard Rule #2); a
 * contact with no usable shape still gets a stable face seeded from its id.
 */
function faceTraitsOf(raw: unknown): { sex?: string; age?: number } {
  if (!raw || typeof raw !== 'object') return {};
  const sex = 'gender' in raw && typeof raw.gender === 'string' ? raw.gender : undefined;
  const age = 'age' in raw && typeof raw.age === 'number' ? raw.age : undefined;
  return { sex, age };
}

  const renderPersonalCard = (c: ContactView) => {
    const r = c.raw as Relationship;
    const expanded = expandedId === c.id;
    const isPartner = c.kind === 'partner';
    const rec = recencyMeta(c.weeksSinceContact, theme);
    const sColor = strengthColor(c.strength);
    const innerLine = [styles.innerLifeLine, { color: theme.textSecondary }];
    const milestone =
      r.marriageWeek != null
        ? `Married since wk ${r.marriageWeek}${r.anniversaryWeek ? ` · anniversary wk ${r.anniversaryWeek}` : ''}`
        : r.engagementWeek != null
          ? `Engaged since wk ${r.engagementWeek}`
          : null;
    return (
      <View key={c.id} style={cardSurface}>
        <TouchableOpacity
          style={styles.cardHeader}
          onPress={() => setExpandedId(expanded ? null : c.id)}
          activeOpacity={0.85}
          accessibilityRole="button"
          accessibilityLabel={`${c.name}, ${expanded ? 'collapse' : 'expand'} profile`}
        >
          <View style={styles.avatarWrap}>
            <View style={[styles.avatar, { borderColor: theme.glassBorder }]}>
              <CharacterAvatar
                seed={r.id}
                sex={r.gender || 'male'}
                age={r.age || 25}
                // A child's face is INHERITED, and this screen was resolving it
                // from the seed alone - so the same child had one face here and
                // a different one on the Family tab, which passes this. One
                // person with two faces depending on the screen is the exact
                // defect the parameterised avatar exists to remove.
                parents={r.type === 'child' ? parentSources : undefined}
                size={scale(46)}
              />
            </View>
            <View style={[styles.recencyDot, { backgroundColor: rec.color, borderColor: theme.surface }]} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={[styles.cardName, { color: theme.text }]} numberOfLines={1}>{c.name}</Text>
            <Text style={[styles.cardSub, { color: theme.textSecondary }]} numberOfLines={1}>
              {c.subtitle}{r.personality ? ` · ${r.personality}` : ''}
              {r.npcMood ? ` · ${getMoodLabel(r.npcMood)}` : ''}
            </Text>
            <View style={styles.recencyRow}>
              <View style={[styles.recencyDotInline, { backgroundColor: rec.color }]} />
              <Text style={[styles.recencyText, { color: theme.textMuted }]} numberOfLines={1}>{rec.label}</Text>
            </View>
            {c.tags && c.tags.length > 0 ? (
              <View style={styles.tagRow}>
                {c.tags.slice(0, 3).map((t) => (
                  <Chip key={t} label={t} tint={accent.amber} />
                ))}
              </View>
            ) : null}
          </View>
          <ProgressRing
            value={c.strength}
            size={46}
            strokeWidth={5}
            ambient={false}
            showPill={false}
            accentColor={sColor}
            trackColor={theme.surfaceElevated}
            label={`${c.name} relationship strength`}
          >
            <Text style={[styles.ringNum, { color: sColor }]}>{Math.round(c.strength)}</Text>
          </ProgressRing>
          <ChevronDown
            size={scale(18)}
            color={theme.textSecondary}
            style={{ transform: [{ rotate: expanded ? '180deg' : '0deg' }] }}
          />
        </TouchableOpacity>

        {feedback?.id === c.id ? (
          <Text style={[styles.feedback, { color: accent.amber }]}>{feedback.message}</Text>
        ) : null}

        {expanded && (
          <View style={styles.actionsBox}>
            {/* An expanded card used to open on twenty controls at one weight.
                It opens on TWO now - the things you do with a person - with the
                rest grouped behind their own headings below. Every action, cost
                and gate is exactly what it was; only the order changed. */}
            <View style={styles.actionsRow}>
              <ActionBtn label="Call" Icon={Phone} color={accent.info} onPress={() => handleSimple(c.id, 'call', 0, 3)} darkMode={darkMode} />
              <ActionBtn label="Hang Out" Icon={Coffee} color={accent.success} onPress={() => handleSimple(c.id, 'hangout', 30, 5)} darkMode={darkMode} />
            </View>
            {/* The money and bond moves, one step quieter than the two above. */}
            <View style={styles.actionsRow}>
              <Chip label="Ask $" size="md" tone="warning" onPress={() => handleAskMoney(c.id)} accessibilityLabel={`Ask ${c.name} for money`} />
              <Chip label="Lend $100" size="md" tint={accent.purple} onPress={() => handleLendMoney(c.id, 100)} accessibilityLabel={`Lend ${c.name} $100`} />
              {!isFamilyRelationship(r) ? (
                <Chip
                  label={`Bond · $${relationshipBondCost(r.relationshipScore ?? 0).toLocaleString()}`}
                  size="md"
                  tone="info"
                  onPress={() => handleBond(c.id)}
                  accessibilityLabel={`Raise your bond with ${c.name} for $${relationshipBondCost(r.relationshipScore ?? 0).toLocaleString()}`}
                />
              ) : null}
            </View>
            {/* Who they are: nine readouts the NPC-depth tick keeps current.
                All real, none of it a decision - so it folds away by default. */}
            <CollapsibleSection id={`contact-about-${c.id}`} title="About them" defaultCollapsed compact>
            <View style={styles.factRow}>
              {/* Where the story started. `metAt` (v50) is stamped once, when
                  the relationship is created, and never touched again - unlike
                  `npcMemories`, which `decayMemories` drops after a year, so
                  the one fact a player most wants back was the first thing the
                  game forgot. */}
              {r.metAt ? <Chip label={`Met ${r.metAt.label} · week ${r.metAt.week}`} tint={accent.success} /> : null}
              {r.job ? <Chip label={`Job · ${r.job}`} /> : null}
              {/* "/yr". `Relationship.income` is an annual salary copied from the
                  Spark profile; it read "/wk" here and in FamilyTab while the
                  tick added a quarter of it to a WEEKLY total - see
                  `householdPartnerIncome`. */}
              {r.income ? <Chip label={`Income · $${r.income.toLocaleString()}/yr`} /> : null}
              {typeof r.datesCount === 'number' && r.datesCount > 0 ? <Chip label={`Dates · ${r.datesCount}`} /> : null}
              {typeof r.giftsReceived === 'number' && r.giftsReceived > 0 ? <Chip label={`Gifts · ${r.giftsReceived}`} /> : null}
              {typeof r.weeklyInteractions === 'number' && r.weeklyInteractions > 0 ? <Chip label={`This week · ${r.weeklyInteractions}`} /> : null}
            </View>
            {/* Inner life: the weekly NPC-depth tick evolves opinion (trust/
                attraction/respect), goals, gift tastes, and memories. */}
            {r.npcOpinion ? (
              <View style={styles.opinionRow}>
                <View style={styles.innerLifeRow}>
                  <Handshake size={fontScale(12)} color={theme.textSecondary} />
                  <Text style={[styles.opinionStat, { color: theme.textSecondary }]}>
                    Trust <Text style={{ color: theme.text, fontWeight: '600' }}>{Math.round(r.npcOpinion.trust ?? 0)}</Text>
                  </Text>
                </View>
                <View style={styles.innerLifeRow}>
                  <Heart size={fontScale(12)} color={theme.textSecondary} />
                  <Text style={[styles.opinionStat, { color: theme.textSecondary }]}>
                    Attraction <Text style={{ color: theme.text, fontWeight: '600' }}>{Math.round(r.npcOpinion.attraction ?? 0)}</Text>
                  </Text>
                </View>
                <View style={styles.innerLifeRow}>
                  <Award size={fontScale(12)} color={theme.textSecondary} />
                  <Text style={[styles.opinionStat, { color: theme.textSecondary }]}>
                    Respect <Text style={{ color: theme.text, fontWeight: '600' }}>{Math.round(r.npcOpinion.respect ?? 0)}</Text>
                  </Text>
                </View>
              </View>
            ) : null}
            {milestone ? (
              <View style={styles.innerLifeRow}>
                <Gem size={fontScale(12)} color={theme.textSecondary} />
                <Text style={innerLine} numberOfLines={1}>{milestone}</Text>
              </View>
            ) : null}
            {r.isPregnant ? (
              <View style={styles.innerLifeRow}>
                <Baby size={fontScale(12)} color={theme.textSecondary} />
                <Text style={innerLine} numberOfLines={1}>
                  Expecting{r.pregnancyChildName ? ` · ${r.pregnancyChildName}` : ''}
                </Text>
              </View>
            ) : null}
            {/* Current WANT - the actionable "right now" ask (rotates over time).
                Satisfying it via the matching action below gives a bond boost. */}
            {r.npcWant ? (
              <View style={styles.innerLifeRow}>
                <MessageCircle size={fontScale(12)} color={theme.textSecondary} />
                <Text style={innerLine} numberOfLines={1}>
                  Right now: <Text style={{ color: theme.text, fontWeight: '600' }}>{r.npcWant.label}</Text>
                </Text>
              </View>
            ) : null}
            {(r.npcGoals ?? []).filter((g) => !g.fulfilled).slice(0, 3).map((g) => (
              <View key={g.id} style={styles.innerLifeRow}>
                <Target size={fontScale(12)} color={theme.textSecondary} />
                <Text style={innerLine} numberOfLines={1}>Dreams of: {g.label}</Text>
              </View>
            ))}
            {r.giftPreferences && r.giftPreferences.length > 0 ? (
              <View style={styles.innerLifeRow}>
                <Gift size={fontScale(12)} color={theme.textSecondary} />
                <Text style={innerLine} numberOfLines={1}>
                  Loves: {r.giftPreferences.slice(0, 3).join(', ')}
                </Text>
              </View>
            ) : null}
            {r.giftDislikes && r.giftDislikes.length > 0 ? (
              <View style={styles.innerLifeRow}>
                <Ban size={fontScale(12)} color={theme.textSecondary} />
                <Text style={innerLine} numberOfLines={1}>
                  Dislikes: {r.giftDislikes.slice(0, 3).join(', ')}
                </Text>
              </View>
            ) : null}
            {typeof r.moneyRequestAttempts === 'number' && r.moneyRequestAttempts > 0 ? (
              <View style={styles.innerLifeRow}>
                <DollarSign size={fontScale(12)} color={theme.textSecondary} />
                <Text style={innerLine} numberOfLines={1}>
                  Asked for money {r.moneyRequestAttempts}× recently{r.moneyRequestAttempts >= 5 ? " · can't refuse next time" : ''}
                </Text>
              </View>
            ) : null}
            {r.lastLifeEvent ? (
              <View style={styles.innerLifeRow}>
                <Pin size={fontScale(12)} color={theme.textSecondary} />
                <Text style={innerLine} numberOfLines={1}>
                  {r.lastLifeEvent.event} (wk {r.lastLifeEvent.weeksLived})
                </Text>
              </View>
            ) : null}
            {r.npcMemories && r.npcMemories.length > 0 ? (
              <Text
                style={{ fontSize: fontScale(11.5), color: theme.textSecondary, fontStyle: 'italic', marginBottom: scale(8) }}
                numberOfLines={2}
              >
                Remembers: {r.npcMemories[r.npcMemories.length - 1].description}
              </Text>
            ) : null}
            </CollapsibleSection>
            {isPartner && (
              <CollapsibleSection id={`contact-dates-${c.id}`} title="Plan a date" defaultCollapsed compact>
                <View style={styles.dateList}>
                  {DATE_TIER_META.map((t) => {
                    const cost = DATE_CONFIGS[t.type].cost;
                    const canAfford = (gameState.stats?.money ?? 0) >= cost;
                    const DIcon = t.Icon;
                    return (
                      <TouchableOpacity
                        key={t.type}
                        style={[styles.dateRow, { backgroundColor: theme.surfaceElevated }]}
                        onPress={() => handleDate(c.id, t.type)}
                        activeOpacity={0.85}
                        accessibilityRole="button"
                        accessibilityLabel={`${t.label} date, ${cost === 0 ? 'free' : `$${cost}`} - ${t.vibe}`}
                      >
                        <IconBubble color={t.color} style={styles.bubble34}>
                          <DIcon size={scale(16)} color={t.color} />
                        </IconBubble>
                        <View style={styles.dateRowBody}>
                          <Text style={[styles.dateRowName, { color: theme.text }]} numberOfLines={1}>{t.label}</Text>
                          <Text style={[styles.dateRowVibe, { color: theme.textMuted }]} numberOfLines={1}>{t.vibe}</Text>
                        </View>
                        <Text
                          style={[
                            styles.dateRowPrice,
                            { color: cost === 0 ? accent.success : canAfford ? theme.textSecondary : accent.warning },
                          ]}
                        >
                          {cost === 0 ? 'Free' : `$${cost}`}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </CollapsibleSection>
            )}
            {/* Where the relationship itself changes shape. Grouped because
                these are the moves you make once, not the ones you make weekly
                - and a "Break up" sitting next to "Hang Out" at the same weight
                is how a mis-tap happens. */}
            {isPartner || r.type === 'spouse' || !isFamilyRelationship(r) ? (
              <CollapsibleSection id={`contact-relationship-${c.id}`} title="Relationship" defaultCollapsed compact>
                <View style={styles.groupBody}>
                  {isPartner && (
                    <>
                      <View style={styles.actionsRow}>
                        <ActionBtn label="Flowers" Icon={Gift} color={accent.danger} onPress={() => handleGift(c.id, 'flowers')} darkMode={darkMode} />
                        <ActionBtn label="Jewelry" Icon={Gift} color={accent.purple} onPress={() => handleGift(c.id, 'jewelry')} darkMode={darkMode} />
                      </View>
                      {!r.livingTogether && (
                        <ActionBtn label="Move in together" Icon={Handshake} color={accent.success} onPress={() => handleSpecial(c.id, 'movein')} darkMode={darkMode} wide />
                      )}
                      {!r.engagementWeek && r.livingTogether && (
                        <ActionBtn label="Propose" Icon={Heart} color={accent.gold} onPress={() => handleSpecial(c.id, 'propose')} darkMode={darkMode} wide />
                      )}
                      {r.engagementWeek != null && !r.weddingPlanned && (
                        <ActionBtn label="Plan Wedding" Icon={Heart} color={accent.purple} onPress={() => setWeddingTargetId(c.id)} darkMode={darkMode} wide />
                      )}
                      <ActionBtn label="Break up" Icon={XIcon} color={accent.danger} onPress={() => handleSpecial(c.id, 'breakup')} darkMode={darkMode} wide subtle />
                    </>
                  )}
                  {r.type === 'spouse' && (
                    <ActionBtn label="File for divorce" Icon={XIcon} color={accent.danger} onPress={() => handleSpecial(c.id, 'divorce')} darkMode={darkMode} wide subtle />
                  )}
                  {!isFamilyRelationship(r) && (
                    <ActionBtn label="Remove contact" Icon={UserMinus} color={accent.danger} onPress={() => handleRemoveContact(r)} darkMode={darkMode} wide subtle />
                  )}
                </View>
              </CollapsibleSection>
            ) : null}
          </View>
        )}
      </View>
    );
  };

  // ---- Network: company-badge tile ------------------------------------------
  const renderNetworkTile = (c: ContactView) => {
    const { Icon, color } = kindMeta(c.kind);
    return (
      <TouchableOpacity
        key={c.id}
        style={[cardSurface, styles.tile]}
        onPress={() => setNetworkDetailId(c.id)}
        activeOpacity={0.85}
        accessibilityRole="button"
        accessibilityLabel={`View ${c.name}`}
      >
        <View style={styles.tileTop}>
          <IconBubble color={color}>
            <Icon size={scale(20)} color={color} />
          </IconBubble>
          <ProgressRing
            value={c.strength}
            size={40}
            strokeWidth={5}
            ambient={false}
            showPill={false}
            accentColor={color}
            trackColor={theme.surfaceElevated}
            label={`${c.name} strength`}
          >
            <Text style={[styles.ringNum, { color }]}>{Math.round(c.strength)}</Text>
          </ProgressRing>
        </View>
        <Text style={[styles.cardName, { color: theme.text }]} numberOfLines={1}>{c.name}</Text>
        {c.subtitle ? (
          <Text style={[styles.cardSub, { color: theme.textSecondary }]} numberOfLines={2}>{c.subtitle}</Text>
        ) : null}
        <View style={styles.tagRow}>
          {c.tags.slice(0, 2).map((t) => (
            <Chip key={t} label={t} tint={color} />
          ))}
          {c.costPerWeek ? (
            <Chip label={`$${c.costPerWeek.toLocaleString()}/wk`} tone="warning" />
          ) : null}
        </View>
        <View style={styles.tileFooter}>
          <Text style={[styles.viewLink, { color: accent.amber }]}>View</Text>
          <ChevronRight size={scale(14)} color={accent.amber} />
        </View>
      </TouchableOpacity>
    );
  };

  // ---- Network detail (list → detail page) ----------------------------------
  const renderNetworkDetail = (c: ContactView) => {
    const { Icon, color } = kindMeta(c.kind);
    // Derived once, before the JSX - an IIFE in the tree recomputed these on
    // every render and rebuilt the press handler with them.
    const favorKind = FAVOR_KIND_BY_CONTACT[c.kind];
    const owedFavor = open.find((f) => f.contactId === c.id);
    const tooDistant = c.strength < NETWORK_FAVOR_MIN_STRENGTH;
    const askDisabled = !!owedFavor || tooDistant;
    const onAskFavor = () => handleAskFavor(c);
    return (
      <ScrollView
        style={styles.flex1}
        contentContainerStyle={[styles.scrollPad, { paddingBottom: getAppScreenBottomPadding(insets.bottom) }]}
      >
        {statsHero(kindLabel(c.kind), (
          <View style={styles.detailHeroRow}>
            <IconBubble color={color} style={styles.bubble56}>
              <Icon size={scale(26)} color={color} />
            </IconBubble>
            <View style={{ flex: 1 }}>
              <Text style={[styles.detailName, { color: theme.text }]} numberOfLines={2}>{c.name}</Text>
              {c.subtitle ? (
                <Text style={[styles.cardSub, { color: theme.textSecondary }]} numberOfLines={2}>{c.subtitle}</Text>
              ) : null}
            </View>
            <ProgressRing
              value={c.strength}
              size={64}
              strokeWidth={7}
              accentColor={color}
              trackColor={theme.surfaceElevated}
              surfaceColor={theme.surface}
              borderColor={theme.border}
              inkColor={theme.text}
              label={`${c.name} strength`}
            />
          </View>
        ))}
        <View style={cardSurface}>
          <SectionTitle title="Overview" />
          <DetailRow label="Relationship strength" value={`${Math.round(c.strength)} / 100`} theme={theme} />
          <DetailRow label="Category" value={kindLabel(c.kind)} theme={theme} />
          <DetailRow label="Managed in" value={sourceLabel(c.sourceApp)} theme={theme} />
          {c.costPerWeek ? <DetailRow label="Weekly cost" value={`$${c.costPerWeek.toLocaleString()}`} theme={theme} /> : null}
          {c.weeksSinceContact != null ? <DetailRow label="Last contact" value={`${c.weeksSinceContact}w ago`} theme={theme} /> : null}
        </View>
        {c.tags.length > 0 ? (
          <View style={cardSurface}>
            <SectionTitle title="Tags" />
            <View style={styles.tagRow}>
              {c.tags.map((t) => (
                <Chip key={t} label={t} tint={color} />
              ))}
            </View>
          </View>
        ) : null}
        {/* X-2: the one thing you can actually DO with a network contact.
            Everything above this was read-only - the report's complaint was
            that vendors and politicals "can't [be] associate[d] with". */}
        {favorKind ? (
          <View style={cardSurface}>
            <SectionTitle title="Call in a favour" />
            <Text style={[styles.cardSub, { color: theme.textSecondary }]}>
              {owedFavor
                ? `${c.name} already owes you a ${owedFavor.kind}. Redeem it from the Favors tab.`
                : tooDistant
                  ? `Needs ${NETWORK_FAVOR_MIN_STRENGTH} standing - you are at ${Math.round(c.strength)}.`
                  : `${c.name} can owe you a ${favorKind}. One at a time.`}
            </Text>
            <TouchableOpacity
              style={[styles.triageBtn, getGlassButton(darkMode), askDisabled && { opacity: 0.5 }]}
              onPress={onAskFavor}
              disabled={askDisabled}
              activeOpacity={0.7}
              accessibilityRole="button"
              accessibilityLabel={`Ask ${c.name} for a ${favorKind}`}
              accessibilityState={{ disabled: askDisabled }}
            >
              <Handshake size={scale(15)} color={theme.text} />
              <Text style={[styles.triageBtnText, { color: theme.text }]}>
                {owedFavor ? 'Favour outstanding' : `Ask for a ${favorKind}`}
              </Text>
            </TouchableOpacity>
          </View>
        ) : null}
        <TouchableOpacity
          style={[styles.triageBtn, getGlassButton(darkMode)]}
          onPress={handleBack}
          activeOpacity={0.7}
          accessibilityRole="button"
          accessibilityLabel="Back to network"
        >
          <ArrowLeft size={scale(15)} color={theme.text} />
          <Text style={[styles.triageBtnText, { color: theme.text }]}>Back to network</Text>
        </TouchableOpacity>
      </ScrollView>
    );
  };

  // ---- Favors: signed ledger row --------------------------------------------
  const renderFavorRow = (f: Favor, isSettled: boolean) => {
    const amt = favorAmount(f);
    return (
      <View style={styles.ledgerRow}>
        <IconBubble color={favorColor(f.kind)} style={styles.bubble36}>
          <Handshake size={scale(16)} color={favorColor(f.kind)} />
        </IconBubble>
        <View style={{ flex: 1 }}>
          <Text style={[styles.ledgerTitle, { color: isSettled ? theme.textSecondary : theme.text }]}>
            {f.direction === 'owed-to-player' ? 'You hold' : 'You owe'} · {f.kind}
          </Text>
          <Text style={[styles.cardSub, { color: theme.textMuted }]} numberOfLines={1}>
            {nameForContactId(f.contactId)} · wk {f.createdWeek}{f.expiresWeek ? ` · exp wk ${f.expiresWeek}` : ''}
          </Text>
          {f.note ? (
            <Text style={[styles.cardSub, { color: theme.textSecondary }]} numberOfLines={1}>{f.note}</Text>
          ) : null}
        </View>
        <View style={styles.ledgerRight}>
          <Text style={[styles.ledgerAmount, { color: isSettled ? theme.textMuted : amt.color }]}>{amt.text}</Text>
          {isSettled ? (
            <Chip label={f.status} />
          ) : f.direction === 'owed-to-player' ? (
            <TouchableOpacity
              style={[styles.redeemBtn, { backgroundColor: withAlpha(accent.success, 0.16) }]}
              onPress={() => handleRedeemFavor(f.id)}
              accessibilityRole="button"
              accessibilityLabel="Redeem favor"
            >
              <Text style={[styles.redeemText, { color: accent.success }]}>Redeem</Text>
            </TouchableOpacity>
          ) : f.kind === 'money' ? (
            <TouchableOpacity
              style={[styles.redeemBtn, { backgroundColor: withAlpha(accent.warning, 0.16) }]}
              onPress={() => handleRepayFavor(f.id)}
              accessibilityRole="button"
              accessibilityLabel="Repay debt"
            >
              <Text style={[styles.redeemText, { color: accent.warning }]}>Repay</Text>
            </TouchableOpacity>
          ) : null}
        </View>
      </View>
    );
  };

  // ---- Attention: triage card with one primary action -----------------------
  /**
   * "Somebody new" - the tier-1 door into a social life.
   *
   * Renders only when there is actually a person around, so it is not a
   * standing chore: `currentIntroduction` returns null between windows and once
   * the cap is reached, and the card disappears with it. When somebody IS
   * around but the player cannot afford the moment, the button stays visible
   * and says why - a visible gate is a goal, an absent button is a mystery.
   */
  const renderMeetCard = () => {
    if (!introduction) return null;
    const disabled = !!meetBlocked;
    return (
      <View style={cardSurface}>
        <View style={styles.cardHeader}>
          <IconBubble color={accent.success} style={styles.bubble44}>
            <UserPlus size={scale(20)} color={accent.success} />
          </IconBubble>
          <View style={{ flex: 1 }}>
            <Text style={[styles.cardName, { color: theme.text }]} numberOfLines={2}>
              {introduction.venue.invitation}
            </Text>
            <Text style={[styles.cardSub, { color: theme.textSecondary }]} numberOfLines={2}>
              {introduction.name} · {introduction.job} · {introduction.age}
            </Text>
          </View>
        </View>
        <TouchableOpacity
          style={[
            styles.triageBtn,
            {
              backgroundColor: withAlpha(disabled ? theme.textMuted : accent.success, 0.16),
              borderColor: withAlpha(disabled ? theme.textMuted : accent.success, 0.34),
            },
          ]}
          onPress={handleMeet}
          disabled={disabled}
          activeOpacity={0.85}
          accessibilityRole="button"
          accessibilityState={{ disabled }}
          accessibilityLabel={
            disabled ? (meetBlocked ?? 'Cannot say hello right now') : `Say hello to ${introduction.name}`
          }
        >
          <UserPlus size={scale(15)} color={disabled ? theme.textMuted : accent.success} />
          <Text style={[styles.triageBtnText, { color: disabled ? theme.textMuted : accent.success }]} numberOfLines={2}>
            {disabled
              ? meetBlocked
              : `Say hello · ${MEET_ENERGY_COST} energy${introduction.venue.cost > 0 ? ` · $${introduction.venue.cost}` : ''}`}
          </Text>
        </TouchableOpacity>
      </View>
    );
  };

  const renderTriageCard = (c: ContactView) => {
    const rec = recencyMeta(c.weeksSinceContact, theme);
    const isPersonal = c.kind === 'family' || c.kind === 'partner' || c.kind === 'friend';
    const sColor = strengthColor(c.strength);
    return (
      <View key={c.id} style={cardSurface}>
        <View style={styles.cardHeader}>
          <IconBubble color={rec.color} style={styles.bubble44}>
            <AlertTriangle size={scale(20)} color={rec.color} />
          </IconBubble>
          <View style={{ flex: 1 }}>
            <Text style={[styles.cardName, { color: theme.text }]} numberOfLines={1}>{c.name}</Text>
            <Text style={[styles.cardSub, { color: theme.textSecondary }]} numberOfLines={2}>{c.subtitle}</Text>
            <View style={styles.recencyRow}>
              <View style={[styles.recencyDotInline, { backgroundColor: rec.color }]} />
              <Text style={[styles.recencyText, { color: rec.color }]} numberOfLines={1}>
                {rec.label} · strength {Math.round(c.strength)}
              </Text>
            </View>
          </View>
          <ProgressRing
            value={c.strength}
            size={44}
            strokeWidth={5}
            ambient={false}
            showPill={false}
            accentColor={sColor}
            trackColor={theme.surfaceElevated}
            label={`${c.name} strength`}
          >
            <Text style={[styles.ringNum, { color: sColor }]}>{Math.round(c.strength)}</Text>
          </ProgressRing>
        </View>
        {isPersonal ? (
          <TouchableOpacity
            style={[styles.triageBtn, { backgroundColor: withAlpha(accent.amber, 0.16), borderColor: withAlpha(accent.amber, 0.34) }]}
            onPress={() => handleSimple(c.id, 'call', 0, 3)}
            activeOpacity={0.85}
            accessibilityRole="button"
            accessibilityLabel={`Call ${c.name} to reconnect`}
          >
            <Phone size={scale(15)} color={accent.amber} />
            <Text style={[styles.triageBtnText, { color: accent.amber }]}>Call to reconnect · +3 bond</Text>
          </TouchableOpacity>
        ) : (
          <TouchableOpacity
            style={[styles.triageBtn, { backgroundColor: withAlpha(accent.info, 0.16), borderColor: withAlpha(accent.info, 0.34) }]}
            onPress={() => setNetworkDetailId(c.id)}
            activeOpacity={0.85}
            accessibilityRole="button"
            accessibilityLabel={`View ${c.name}`}
          >
            <ChevronRight size={scale(15)} color={accent.info} />
            <Text style={[styles.triageBtnText, { color: accent.info }]}>View profile</Text>
          </TouchableOpacity>
        )}
        {feedback?.id === c.id ? (
          <Text style={[styles.feedback, { color: accent.amber }]}>{feedback.message}</Text>
        ) : null}
      </View>
    );
  };

  // The personal tab is the one list on this screen with NO upper bound: every
  // friend, colleague, ex, child and grandchild a long life accumulates lands
  // here, and `.map()` inside a ScrollView mounted the lot - each row an avatar,
  // a strength ring and, when expanded, a dense profile. Mount cost tracked
  // relationship count, so it grew for the whole life and never came back down.
  //
  // A FlatList, and it is the tab's OUTER scroller - never nested inside another
  // scroll view - so virtualization actually engages rather than warning. That is
  // only possible because the tab has exactly ONE section above the list: the
  // portfolio hero moves to `ListHeaderComponent` verbatim and the empty state to
  // `ListEmptyComponent`, so no restructuring of the screen was needed. The header
  // stays suppressed at zero contacts (a portfolio summary of nothing), which is
  // what the old `length === 0` branch did.
  //
  // `renderItem` is deliberately NOT wrapped in `useCallback`: `renderPersonalCard`
  // closes over `expandedId`, the theme and every handler, so its identity turns
  // over on most renders and a memo around it would carry the same churn behind
  // one more indirection. Virtualization is the win; `keyExtractor` is hoisted to
  // module scope, where stability is real.
  const renderPersonal = () => (
    <FlatList
      style={styles.flex1}
      contentContainerStyle={[styles.scrollPad, { paddingBottom: getAppScreenBottomPadding(insets.bottom) }]}
      data={personalContacts}
      keyExtractor={personalKeyExtractor}
      renderItem={({ item }) => renderPersonalCard(item)}
      ListEmptyComponent={
        <EmptyState
          icon={<Users size={scale(28)} color={theme.textSecondary} />}
          observation="No relationships yet"
          // Was "Date, befriend, or build family ties" while nothing in the game
          // could create a friend. Now it can - and the nudge says WHERE,
          // because naming an action without naming its home is how the old copy
          // read as a missing feature rather than a hidden one.
          nudge="Match on Spark, then start dating or add them as a friend."
        />
      }
      ListHeaderComponent={
        (
          /* The header no longer suppresses itself at zero contacts: the
             "meet someone" card has to be reachable exactly when the book is
             empty. The portfolio hero below still is, because a summary of
             nothing was the reason for the old blanket suppression. */
          <View style={styles.leadWrap}>
            {renderMeetCard()}
            {/* The lead slot. "At risk" used to be a number whose only
                affordance was a tab switch; the worst at-risk contact now
                opens the tab with the same triage card - and the same
                "Call to reconnect" - that Attention renders, so the decision
                the count implied is one tap away instead of two. */}
            {worstAtRisk ? (
              <View>
                <Text style={[styles.leadKicker, { color: theme.textMuted }]} numberOfLines={1}>
                  {personalAtRisk.length > 1
                    ? `Needs a call · ${personalAtRisk.length - 1} more on Attention`
                    : 'Needs a call'}
                </Text>
                {renderTriageCard(worstAtRisk)}
              </View>
            ) : null}
            {personalContacts.length === 0 ? null : statsHero('Relationship portfolio', (
              <>
                {topPersonal.length > 0 ? (
                  <View style={styles.clusterRow}>
                    <View style={styles.avatarStack}>
                      {topPersonal.map((c, i) => {
                        const rr = c.raw as Relationship;
                        return (
                          <View
                            key={c.id}
                            style={[
                              styles.clusterAvatar,
                              { marginLeft: i === 0 ? 0 : -scale(12), borderColor: theme.surface, zIndex: 10 - i },
                            ]}
                          >
                            <CharacterAvatar
                              seed={c.id}
                              sex={faceTraitsOf(c.raw).sex}
                              age={faceTraitsOf(c.raw).age ?? 30}
                              parents={rr?.type === 'child' ? parentSources : undefined}
                              size={scale(34)}
                            />
                          </View>
                        );
                      })}
                    </View>
                    <Text style={[styles.clusterLabel, { color: theme.textSecondary }]} numberOfLines={2}>
                      Your inner circle · top {topPersonal.length} by bond
                    </Text>
                  </View>
                ) : null}
                {/* Two numbers, not four: "Strong" is a slice of the average
                    it sits next to, so it rides as that tile's sub-line rather
                    than competing with it for a decision - and "At risk" is no
                    longer a tile because the lead slot above IS the at-risk
                    contact, with the remainder counted in its kicker and on
                    the Attention segment. A zero here was reassurance with no
                    decision behind it; the segment reading plain "Attention"
                    already says the same thing. */}
                <StatStrip
                  items={[
                    { label: 'People', value: personalCount, tint: accent.amber },
                    {
                      label: 'Avg bond',
                      value: avgStrength,
                      tint: strengthColor(avgStrength),
                      sub: `${strongCount} strong`,
                    },
                  ]}
                />
              </>
            ))}
          </View>
        )
      }
    />
  );

  const renderNetwork = () => (
    <ScrollView style={styles.flex1} contentContainerStyle={[styles.scrollPad, { paddingBottom: getAppScreenBottomPadding(insets.bottom) }]}>
      {statsHero('Your network', (
        /* Six per-kind counters were a census, not a decision. The tiles the
           player acts on are how many people there are, what they cost, and
           how many can be leaned on; the per-kind breakdown is on the tiles
           below, which carry the kind on every badge. */
        <StatStrip
          items={[
            { label: 'People', value: networkContacts.length, tint: accent.amber },
            {
              label: 'Cost per week',
              value: networkCost > 0 ? `$${networkCost.toLocaleString()}` : '$0',
              tint: networkCost > 0 ? accent.warning : undefined,
            },
            {
              label: 'Allies',
              value: countByKind(networkContacts, 'alliance') + countByKind(networkContacts, 'lobbyist'),
              tint: accent.info,
            },
          ]}
        />
      ))}
      {networkContacts.length === 0 ? (
        <EmptyState
          icon={<Briefcase size={scale(28)} color={theme.textSecondary} />}
          observation="No network contacts yet"
          nudge="Hire lobbyists, invest in travel businesses, or buy from dark-web vendors to build your network."
        />
      ) : (
        <View style={styles.grid}>{networkContacts.map(renderNetworkTile)}</View>
      )}
    </ScrollView>
  );

  const renderFavors = () => (
    <ScrollView style={styles.flex1} contentContainerStyle={[styles.scrollPad, { paddingBottom: getAppScreenBottomPadding(insets.bottom) }]}>
      {statsHero('IOU position', (
        /* "Open" is the tab's own badge, so it does not need a tile too. */
        <StatStrip
          items={[
            { label: 'Owed to you', value: `$${moneyPos.owedToPlayer.toLocaleString()}`, tint: accent.success },
            { label: 'You owe', value: `$${moneyPos.owedByPlayer.toLocaleString()}`, tint: accent.danger },
            {
              label: 'Net',
              value: `${moneyPos.net >= 0 ? '+' : '−'}$${Math.abs(moneyPos.net).toLocaleString()}`,
              tint: moneyPos.net >= 0 ? accent.success : accent.danger,
            },
          ]}
        />
      ))}
      {open.length === 0 ? (
        <EmptyState
          icon={<Handshake size={scale(28)} color={theme.textSecondary} />}
          observation="No open favors"
          nudge="Favors get added when you lend, owe, or do business with contacts. Redeem them here when you call them in."
        />
      ) : (
        <View style={cardSurface}>
          {open.map((f, i) => (
            <React.Fragment key={f.id}>
              {i > 0 && <View style={[styles.ledgerDivider, { backgroundColor: theme.border }]} />}
              {renderFavorRow(f, false)}
            </React.Fragment>
          ))}
        </View>
      )}
      {settled.length > 0 ? (
        <View>
          <TouchableOpacity
            style={[styles.toggleBtn, getGlassButton(darkMode)]}
            onPress={() => setShowSettled((s) => !s)}
            activeOpacity={0.7}
            accessibilityRole="button"
            accessibilityLabel={showSettled ? 'Hide settled favors' : 'Show settled favors'}
          >
            <Text style={[styles.toggleText, { color: theme.textSecondary }]}>
              {showSettled ? 'Hide' : 'Show'} settled history · {settled.length}
            </Text>
            <ChevronDown
              size={scale(16)}
              color={theme.textSecondary}
              style={{ transform: [{ rotate: showSettled ? '180deg' : '0deg' }] }}
            />
          </TouchableOpacity>
          {showSettled ? (
            <View style={[cardSurface, { marginTop: sp.sm }]}>
              {settled.map((f, i) => (
                <React.Fragment key={f.id}>
                  {i > 0 && <View style={[styles.ledgerDivider, { backgroundColor: theme.border }]} />}
                  {renderFavorRow(f, true)}
                </React.Fragment>
              ))}
            </View>
          ) : null}
        </View>
      ) : null}
    </ScrollView>
  );

  const renderAttention = () => {
    const coldest = needAttention.reduce((m, c) => Math.max(m, c.weeksSinceContact ?? 0), 0);
    const attnAvg = needAttention.length
      ? Math.round(needAttention.reduce((s, c) => s + c.strength, 0) / needAttention.length)
      : 0;
    return (
      <ScrollView style={styles.flex1} contentContainerStyle={[styles.scrollPad, { paddingBottom: getAppScreenBottomPadding(insets.bottom) }]}>
        {needAttention.length === 0 ? (
          <EmptyState
            icon={<Heart size={scale(28)} color={theme.textSecondary} />}
            observation="Everyone's content"
            nudge="No stale or struggling contacts. Keep it up."
          />
        ) : (
          <>
            {statsHero('Triage queue', (
              <StatStrip
                items={[
                  { label: 'At risk', value: needAttention.length, tint: accent.warning },
                  { label: 'Coldest', value: `${coldest}w`, tint: accent.danger },
                  { label: 'Avg bond', value: attnAvg, tint: strengthColor(attnAvg) },
                ]}
              />
            ))}
            {needAttention.map(renderTriageCard)}
          </>
        )}
      </ScrollView>
    );
  };

  return (
    <View style={[styles.root, { backgroundColor: theme.background }]}>
      <AppHeader
        centered
        title={inDetail && detailContact ? detailContact.name : 'Contacts'}
        onBack={handleBack}
        backLabel={inDetail ? 'Back to contacts' : 'Back'}
        style={{ backgroundColor: theme.surface }}
      />

      {inDetail && detailContact ? (
        renderNetworkDetail(detailContact)
      ) : (
        <>
          {/* The count rides in the label ("Favors 2") rather than as a "· 2"
              suffix: the shared control reads its label out to screen readers
              verbatim, and a middot is not a word. */}
          <SegmentedControl
            style={styles.tabs}
            activeColor={accent.amber}
            value={activeTab}
            onChange={setActiveTab}
            segments={[
              { key: 'personal' as TabType, label: 'Personal' },
              { key: 'network' as TabType, label: 'Network' },
              { key: 'favors' as TabType, label: open.length > 0 ? `Favors ${open.length}` : 'Favors' },
              {
                key: 'attention' as TabType,
                label: needAttention.length > 0 ? `Attention ${needAttention.length}` : 'Attention',
              },
            ]}
          />

          {activeTab === 'personal' && renderPersonal()}
          {activeTab === 'network' && renderNetwork()}
          {activeTab === 'favors' && renderFavors()}
          {activeTab === 'attention' && renderAttention()}
        </>
      )}

      {(() => {
        const ringTarget = ringTargetId
          ? gameState.relationships?.find((rel) => rel.id === ringTargetId)
          : undefined;
        return ringTarget ? (
          <RingSelectionModal
            visible
            onClose={() => setRingTargetId(null)}
            partnerName={ringTarget.name}
            relationshipScore={ringTarget.relationshipScore}
            datesCount={ringTarget.datesCount || 0}
            livingTogether={ringTarget.livingTogether || false}
            onPropose={handleProposeWithRing}
          />
        ) : null;
      })()}
      {(() => {
        const weddingTarget = weddingTargetId
          ? gameState.relationships?.find((rel) => rel.id === weddingTargetId)
          : undefined;
        return weddingTarget ? (
          <WeddingPlanningModal
            visible
            onClose={() => setWeddingTargetId(null)}
            partnerId={weddingTarget.id}
            partnerName={weddingTarget.name}
          />
        ) : null;
      })()}
      {(() => {
        // Only actual spouses can be divorced (fileDivorce requires type
        // 'spouse'); the "File for divorce" button is already gated the same way.
        const divorceTarget = divorceTargetId
          ? gameState.relationships?.find((rel) => rel.id === divorceTargetId && rel.type === 'spouse')
          : undefined;
        if (!divorceTarget) return null;
        // Preview numbers come from calculateDivorceCosts - the SAME helper path
        // fileDivorce uses for its base settlement (calculateDivorceNetWorth ×
        // the deterministic spouse-hash ratio) and base lawyer fee
        // (DIVORCE_LAWYER_BASE_FEE), so the modal's estimate matches the actual
        // divorce. No formula is duplicated here.
        const costs = calculateDivorceCosts(gameState, divorceTarget.id);
        if (!costs) return null;
        return (
          <DivorceConfirmModal
            visible
            onClose={() => setDivorceTargetId(null)}
            onConfirm={handleConfirmDivorce}
            spouseName={divorceTarget.name}
            estimatedSettlement={costs.settlement}
            lawyerFees={costs.lawyerFees}
            currentMoney={gameState.stats.money}
            currentGems={gameState.stats.gems}
            netWorth={costs.netWorth}
            isDarkMode={darkMode}
          />
        );
      })()}
    </View>
  );
}

function ActionBtn({
  label,
  Icon,
  color,
  onPress,
  darkMode,
  wide,
  subtle,
}: {
  label: string;
  Icon: React.ComponentType<{ size: number; color: string }>;
  color: string;
  onPress: () => void;
  darkMode: boolean;
  wide?: boolean;
  subtle?: boolean;
}) {
  // Destructive (Break up / File for divorce): a quiet glass button with a
  // danger-colored LABEL only - never a filled red button.
  if (subtle) {
    return (
      <TouchableOpacity
        onPress={onPress}
        style={[styles.actionGlassBtn, getGlassButton(darkMode), { flexBasis: '100%' }]}
        activeOpacity={0.7}
        accessibilityRole="button"
        accessibilityLabel={label}
      >
        <Icon size={scale(14)} color={color} />
        <Text style={[styles.actionBtnText, { color }]}>{label}</Text>
      </TouchableOpacity>
    );
  }
  // The single loud action per expanded card (Move in / Propose / Plan Wedding):
  // one solid amber identity CTA (Recipe D). Shadow rides the outer Touchable;
  // the gradient inner clips to the pill.
  if (wide) {
    return (
      <TouchableOpacity
        onPress={onPress}
        style={[styles.ctaWrap, getPlatformShadows(5, 0.3, 2, 8)]}
        activeOpacity={0.7}
        accessibilityRole="button"
        accessibilityLabel={label}
      >
        <LinearGradient
          colors={[accent.amber, accent.amber]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          style={styles.ctaInner}
        >
          <Icon size={scale(16)} color="white" />
          <Text style={styles.ctaLabel}>{label}</Text>
        </LinearGradient>
      </TouchableOpacity>
    );
  }
  // Standard action: a soft same-hue tinted chip - saturated glyph + label, no border.
  return (
    <TouchableOpacity
      onPress={onPress}
      style={[styles.actionChip, { backgroundColor: withAlpha(color, 0.14) }]}
      activeOpacity={0.85}
      accessibilityRole="button"
      accessibilityLabel={label}
    >
      <Icon size={scale(14)} color={color} />
      <Text style={[styles.actionBtnText, { color }]}>{label}</Text>
    </TouchableOpacity>
  );
}

/** Key/value row for the network detail page. */
function DetailRow({
  label,
  value,
  theme,
}: {
  label: string;
  value: string;
  theme: ReturnType<typeof getThemeColors>;
}) {
  return (
    <View style={styles.detailRow}>
      <Text style={[styles.detailKey, { color: theme.textSecondary }]}>{label}</Text>
      <Text style={[styles.detailVal, { color: theme.text }]} numberOfLines={1}>{value}</Text>
    </View>
  );
}

function countByKind(contacts: ContactView[], kind: ContactView['kind']): number {
  return contacts.filter((c) => c.kind === kind).length;
}

function kindMeta(kind: ContactView['kind']): {
  Icon: React.ComponentType<{ size: number; color: string }>;
  color: string;
} {
  switch (kind) {
    case 'lobbyist':
    case 'alliance':
      return { Icon: Vote, color: accent.purple };
    case 'vendor':
      return { Icon: ShieldAlert, color: accent.warning };
    case 'business':
      return { Icon: Briefcase, color: accent.success };
    case 'employee':
      return { Icon: Building2, color: accent.info };
    case 'family':
    case 'partner':
    case 'friend':
    default:
      return { Icon: Users, color: accent.info };
  }
}

function kindLabel(kind: ContactView['kind']): string {
  switch (kind) {
    case 'lobbyist': return 'Lobbyist';
    case 'alliance': return 'Political ally';
    case 'vendor': return 'Dark-web vendor';
    case 'business': return 'Business partner';
    case 'employee': return 'Company team';
    case 'family': return 'Family';
    case 'partner': return 'Partner';
    case 'friend': return 'Friend';
    default: return 'Contact';
  }
}

function sourceLabel(source: ContactView['sourceApp']): string {
  switch (source) {
    case 'politics': return 'Politics';
    case 'darkweb': return 'Onion (dark web)';
    case 'travel': return 'Travel';
    case 'company': return 'Companies';
    default: return 'Contacts';
  }
}

/** Signed +/- transaction amount for the favor ledger. */
function favorAmount(f: Favor): { text: string; color: string } {
  const sign = f.direction === 'owed-to-player' ? '+' : '−';
  const color = f.direction === 'owed-to-player' ? accent.success : accent.danger;
  const val = f.kind === 'money' ? `$${f.value.toLocaleString()}` : `${f.value} pts`;
  return { text: `${sign}${val}`, color };
}

/** Last-contact recency → dot color + label (the CRM "warmth" signal). */
function recencyMeta(
  weeks: number | undefined,
  theme: ReturnType<typeof getThemeColors>
): { color: string; label: string } {
  if (weeks === undefined) return { color: theme.textMuted, label: 'No recent contact' };
  if (weeks <= 0) return { color: accent.success, label: 'Contacted this week' };
  if (weeks <= 3) return { color: accent.success, label: `Contacted ${weeks}w ago` };
  if (weeks <= 8) return { color: accent.warning, label: `${weeks}w since contact` };
  return { color: accent.danger, label: `${weeks}w - going cold` };
}

function favorColor(kind: string): string {
  switch (kind) {
    case 'money': return accent.success;
    case 'influence': return accent.purple;
    case 'discount': return accent.info;
    case 'safety': return accent.warning;
    case 'intro': return accent.gold;
    default: return accent.muted;
  }
}

function strengthColor(s: number): string {
  if (s >= 80) return accent.success;
  if (s >= 60) return accent.gold;
  if (s >= 40) return accent.warning;
  return accent.danger;
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  flex1: { flex: 1 },
  scrollPad: { padding: sp.md, gap: sp.lg, paddingBottom: sp['3xl'] },
  tabs: { marginHorizontal: sp.md, marginBottom: sp.sm },
  card: { padding: sp.md },
  cardHeader: { flexDirection: 'row', alignItems: 'center', gap: sp.md },
  cardName: { fontSize: fs.md, fontWeight: '600' },
  cardSub: { fontSize: fs.sm, marginTop: 2 },
  avatarWrap: { position: 'relative' },
  avatar: { alignItems: 'center', justifyContent: 'center', overflow: 'hidden', width: scale(48), height: scale(48), borderRadius: scale(24), borderWidth: 1 },
  // Online-status-style recency dot pinned to the avatar corner.
  recencyDot: { position: 'absolute', bottom: 0, right: 0, width: scale(13), height: scale(13), borderRadius: scale(6.5), borderWidth: 2 },
  recencyDotInline: { width: scale(8), height: scale(8), borderRadius: scale(4) },
  recencyRow: { flexDirection: 'row', alignItems: 'center', gap: sp.xs, marginTop: sp.xs },
  recencyText: { fontSize: fs.xs, fontWeight: '600' },
  // Number that sits inside a compact strength ring (row/tile/triage).
  ringNum: { fontSize: fontScale(13), fontWeight: '600', fontVariant: ['tabular-nums'] },
  tagRow: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: sp.xs, marginTop: sp.xs },
  actionsBox: { gap: sp.sm, marginTop: sp.md },
  actionsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: sp.xs },
  // Body of a folded group inside an expanded card.
  groupBody: { gap: sp.sm },
  // Date sheet: one tappable row per tier (icon + name/vibe + price).
  dateList: { gap: sp.xs },
  dateRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: sp.md,
    paddingHorizontal: sp.sm,
    paddingVertical: sp.sm,
    borderRadius: br.md,
    minHeight: touchTargets.minimum,
  },
  dateRowBody: { flex: 1 },
  dateRowName: { fontSize: fs.sm, fontWeight: '600' },
  dateRowVibe: { fontSize: fs.xs, marginTop: 1 },
  dateRowPrice: { fontSize: fs.sm, fontWeight: '600', fontVariant: ['tabular-nums'] },
  opinionRow: { flexDirection: 'row', flexWrap: 'wrap', gap: sp.sm },
  opinionStat: { fontSize: fontScale(11) },
  innerLifeLine: { flex: 1, fontSize: fontScale(11.5) },
  // Icon + text row for the inner-life readouts (lucide glyphs, not emoji).
  innerLifeRow: { flexDirection: 'row', alignItems: 'center', gap: scale(5) },
  // Fact chips (job / income / dates / gifts) inside "About them".
  factRow: { flexDirection: 'row', flexWrap: 'wrap', gap: sp.xs },
  // Tinted icon bubbles at the sizes this screen uses; IconBubble owns the
  // fill/rim recipe, these only set the box.
  bubble34: { width: scale(34), height: scale(34) },
  bubble36: { width: scale(36), height: scale(36) },
  bubble44: { width: scale(44), height: scale(44) },
  bubble56: { width: scale(56), height: scale(56) },
  // Standard tinted action chip: same-hue soft fill, no border (de-noise).
  actionChip: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: sp.xs,
    paddingHorizontal: sp.md,
    paddingVertical: sp.sm,
    borderRadius: br.full,
    flex: 1,
    minWidth: scale(90),
    minHeight: touchTargets.minimum,
  },
  // Destructive glass button (danger label rides on top, set inline).
  actionGlassBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: sp.xs,
    paddingHorizontal: sp.md,
    paddingVertical: sp.sm,
    minHeight: touchTargets.minimum,
  },
  // Recipe D primary CTA: outer carries shadow + solid fill; inner gradient clips.
  ctaWrap: { flexBasis: '100%', borderRadius: br.full, backgroundColor: accent.amber },
  ctaInner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: sp.xs,
    minHeight: touchTargets.minimum,
    paddingHorizontal: sp.md,
    borderRadius: br.full,
    overflow: 'hidden',
  },
  ctaLabel: { color: 'white', fontSize: fs.md, fontWeight: '600' },
  actionBtnText: { fontSize: fs.xs, fontWeight: '600' },
  feedback: { fontSize: fs.xs, fontStyle: 'italic', marginTop: sp.xs },
  // Summary-card interior: clipped so the fill stays inside the radius.
  heroInner: { borderRadius: br['2xl'], overflow: 'hidden', padding: sp.lg },
  // The Personal tab's lead slot: the kicker sits `micro` off the card it
  // labels, and the whole promotion sits `major` off the portfolio strip - a
  // hierarchy change, not another card in the band.
  leadWrap: { gap: rhythm.major },
  leadKicker: { ...kicker, marginBottom: rhythm.micro },
  statsTitle: { fontSize: fs.xs, fontWeight: '600', letterSpacing: 0.8, textTransform: 'uppercase', marginBottom: sp.sm },
  // Inner-circle avatar stack in the personal hero.
  clusterRow: { flexDirection: 'row', alignItems: 'center', gap: sp.md, marginBottom: sp.md },
  avatarStack: { flexDirection: 'row' },
  clusterAvatar: { alignItems: 'center', justifyContent: 'center', overflow: 'hidden', width: scale(38), height: scale(38), borderRadius: scale(19), borderWidth: 2 },
  clusterLabel: { flex: 1, fontSize: fs.sm, fontWeight: '600' },
  // Network badge-tile grid.
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: sp.md },
  tile: { flexBasis: '47%', flexGrow: 1, minWidth: scale(150), gap: sp.xs },
  tileTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  tileFooter: { flexDirection: 'row', alignItems: 'center', gap: scale(2), marginTop: sp.xs },
  viewLink: { fontSize: fs.sm, fontWeight: '600' },
  // Favor ledger rows.
  ledgerRow: { flexDirection: 'row', alignItems: 'center', gap: sp.md, paddingVertical: sp.sm },
  ledgerDivider: { height: StyleSheet.hairlineWidth },
  ledgerTitle: { fontSize: fs.md, fontWeight: '600', textTransform: 'capitalize' },
  ledgerRight: { alignItems: 'flex-end', gap: sp.xs },
  ledgerAmount: { fontSize: fs.md, fontWeight: '600', fontVariant: ['tabular-nums'] },
  toggleBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: sp.xs, paddingVertical: sp.sm, paddingHorizontal: sp.md, borderRadius: br.full, minHeight: touchTargets.minimum },
  toggleText: { fontSize: fs.sm, fontWeight: '600' },
  // Triage / detail-page shared prominent button.
  triageBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: sp.xs, minHeight: touchTargets.minimum, borderRadius: br.full, borderWidth: 1, marginTop: sp.sm, paddingHorizontal: sp.md },
  triageBtnText: { fontSize: fs.sm, fontWeight: '600' },
  // Network detail page.
  detailHeroRow: { flexDirection: 'row', alignItems: 'center', gap: sp.md },
  detailName: { fontSize: fs.xl, fontWeight: '700' },
  detailRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: sp.md, paddingVertical: sp.sm },
  detailKey: { fontSize: fs.sm },
  detailVal: { fontSize: fs.sm, fontWeight: '600', flexShrink: 1, textAlign: 'right' },
  redeemBtn: { paddingHorizontal: sp.md, paddingVertical: sp.sm, borderRadius: br.full, minHeight: touchTargets.minimum, justifyContent: 'center' },
  redeemText: { fontSize: fs.sm, fontWeight: '600' },
});
