/**
 * ContactsApp — full rewrite (Remake 10).
 *
 * Previously: only `gameState.relationships` (family/partners/friends).
 * Now: the network spine. Personal + lobbyists + alliances + vendors + biz +
 * employees, all surfaced through the `aggregateContacts` lib. Adds a Favors
 * IOU ledger across systems.
 *
 * Tabs:
 *   Personal — family/partners/friends with the existing action surface
 *   Network  — political/business/underground/employee contacts (read-only summary)
 *   Favors   — open IOUs the player can redeem
 *   Attention— stale + weak contacts the player has been neglecting
 */

import React, { useCallback, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Alert,
  Image,
} from 'react-native';
import {
  ArrowLeft,
  Heart,
  Phone,
  Gift,
  DollarSign,
  Coffee,
  Users,
  Vote,
  ShieldAlert,
  Briefcase,
  Building2,
  Star,
  ChevronDown,
  AlertTriangle,
  Handshake,
  X as XIcon,
} from 'lucide-react-native';
import { useGame } from '@/contexts/GameContext';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTimerManager } from '@/hooks/useTimerManager';
import type { Relationship, GameState } from '@/contexts/game/types';
import { aggregateContacts, ContactView, contactsNeedingAttention } from '@/lib/contacts/aggregator';
import { netMoneyPosition, openFavors, FavorLedger } from '@/lib/contacts/favors';
import { goOnDate, giveGift, proposeMarriage } from '@/contexts/game/actions/DatingActions';
import RingSelectionModal from '@/components/mobile/RingSelectionModal';
import WeddingPlanningModal from '@/components/mobile/WeddingPlanningModal';
import { redeemFavor } from '@/contexts/game/actions/ContactsActions';
import { applyMoneyDelta } from '@/contexts/game/actions/MoneyActions';
import { getRelationshipImage } from '@/utils/characterImages';
import { getMoodLabel } from '@/lib/social/npcDepth';
import { getThemeColors, accent } from '@/lib/config/theme';
import {
  getGlassCard,
  getGlassIconContainer,
  getGlassButton,
  getPlatformShadows,
} from '@/utils/glassmorphismStyles';
import LinearGradientFallback from '@/components/fallbacks/LinearGradientFallback';
import {
  responsiveFontSize as fs,
  responsiveSpacing as sp,
  responsiveBorderRadius as br,
  scale,
  fontScale,
  touchTargets,
  getAppScreenBottomPadding,
} from '@/utils/scaling';

const LinearGradient = LinearGradientFallback;

type TabType = 'personal' | 'network' | 'favors' | 'attention';

interface ContactsAppProps {
  onBack: () => void;
}

export default function ContactsApp({ onBack }: ContactsAppProps) {
  const {
    gameState,
    setGameState,
    updateMoney,
    updateStats,
    updateRelationship,
    recordRelationshipAction,
    breakUpWithPartner,
    moveInTogether,
    fileDivorce,
    saveGame,
  } = useGame();
  // Auto-cleaned timers so the feedback-clear flash can't setState after unmount.
  const timers = useTimerManager();
  const insets = useSafeAreaInsets();
  const darkMode = !!gameState.settings?.darkMode;
  const theme = getThemeColors(darkMode);

  // Recipe A — the standard elevated card surface shared by every contact row:
  // solid fill (contrast + Android elevation), one thin border, friendly 16pt radius.
  const cardSurface = [
    styles.card,
    getGlassCard(darkMode, 6),
    { backgroundColor: theme.surface, borderColor: theme.border, borderWidth: 1, borderRadius: br.xl },
  ];

  // Recipe B — the single focal amber hero per tab-view (Network / Favors). Depth is
  // faked with a flat tint wash + one glow blob (the LinearGradient fallback renders
  // only colors[0]); the passed-in stat row is the hero content, unchanged.
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
        <LinearGradient
          pointerEvents="none"
          colors={['rgba(249, 115, 22, 0.14)', 'rgba(249, 115, 22, 0.03)']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={StyleSheet.absoluteFill}
        />
        <View pointerEvents="none" style={styles.heroGlow} />
        {darkMode && <View pointerEvents="none" style={styles.heroHairline} />}
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

  // aggregateContacts walks 5+ arrays. Only re-run when the underlying source
  // arrays actually change — not on every gameState mutation (e.g., stat ticks).
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

  const ledger: FavorLedger = gameState.favorLedger ?? { favors: [] };
  const open = useMemo(() => openFavors(ledger), [ledger]);
  const moneyPos = useMemo(() => netMoneyPosition(ledger), [ledger]);

  const flash = useCallback((message: string, id?: string) => {
    setFeedback({ id, message });
    timers.setTimeout(() => setFeedback(null), 2800);
  }, [timers]);

  const updateMoneyDep = useCallback(
    (_set: any, amount: number, reason: string) => updateMoney(amount, reason),
    [updateMoney]
  );
  const updateStatsDep = useCallback((_set: any, stats: any) => updateStats(stats), [updateStats]);

  const handleDate = useCallback(
    (contactId: string, dateType: 'coffee' | 'dinner' | 'luxury') => {
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
      if (r.success) saveGame();
      flash(r.message, contactId);
    },
    [gameState, setGameState, updateMoneyDep, updateStatsDep, saveGame, flash]
  );

  const handleSimple = useCallback(
    (contactId: string, action: string, cost: number, bonus: number) => {
      const rel = gameState.relationships?.find((r) => r.id === contactId);
      if (!rel) return;
      const ws = gameState.weeksLived ?? 0;
      // Pre-checks for immediate feedback; the authoritative re-check is inside
      // the updater below.
      if (rel.actions?.[action] === ws) {
        flash('Already used this week.', contactId);
        return;
      }
      if (cost > 0 && (gameState.stats?.money ?? 0) < cost) {
        flash(`Need $${cost.toLocaleString()}.`, contactId);
        return;
      }

      // Single atomic updater — the once-per-week gate, the affordability check,
      // the money leg, the relationship bump, and the action record all happen
      // against `prev` so a same-batch double-tap can't charge/grant twice.
      // (Previously three separate imperative updaters read a stale snapshot.)
      let applied = false;
      setGameState((prev) => {
        const rels = prev.relationships ?? [];
        const idx = rels.findIndex((r) => r.id === contactId);
        if (idx === -1) return prev;
        const target = rels[idx];
        const prevWs = prev.weeksLived ?? 0;
        if (target.actions?.[action] === prevWs) return prev; // already used this week
        if (cost > 0 && (prev.stats?.money ?? 0) < cost) return prev; // can't afford

        const updatedRel: Relationship = {
          ...target,
          relationshipScore: Math.max(0, Math.min(100, (target.relationshipScore ?? 0) + bonus)),
          actions: { ...(target.actions ?? {}), [action]: prevWs },
        };
        const newRels = [...rels];
        newRels[idx] = updatedRel;
        let next: GameState = { ...prev, relationships: newRels };
        if (cost > 0) {
          const paid = applyMoneyDelta(next, -cost, `${action} with ${target.name}`);
          if (!paid) return prev; // affordability failed inside the delta — abort
          next = { ...next, ...paid };
        }
        applied = true;
        return next;
      });
      if (applied) flash(`+${bonus} with ${rel.name}.`, contactId);
    },
    [gameState, setGameState, flash]
  );


  // "Ask $" — the button previously cost 5 relationship points and granted
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
        const updatedRel: Relationship = {
          ...target,
          relationshipScore: Math.max(0, (target.relationshipScore ?? 0) + (granted ? -3 : -5)),
          actions: { ...(target.actions ?? {}), askmoney: prevWs },
          moneyRequestAttempts: granted ? 0 : (target.moneyRequestAttempts ?? 0) + 1,
          lastMoneyRequest: prevWs,
        };
        const newRels = [...rels];
        newRels[idx] = updatedRel;
        if (!granted) return { ...prev, relationships: newRels };
        const grant = applyMoneyDelta(prev, amount, `Borrowed from ${target.name}`);
        if (!grant) return { ...prev, relationships: newRels };
        return { ...prev, ...grant, relationships: newRels };
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

  const handleRedeemFavor = useCallback(
    (favorId: string) => {
      const r = redeemFavor(gameState, setGameState, favorId);
      if (r.success) {
        saveGame();
        flash(r.message);
      } else {
        Alert.alert('Cannot redeem', r.message);
      }
    },
    [gameState, setGameState, saveGame, flash]
  );

  const handleSpecial = useCallback(
    (contactId: string, action: 'propose' | 'movein' | 'breakup' | 'divorce') => {
      if (action === 'propose') {
        // Ring-selection flow → canonical proposeMarriage (the old
        // proposeToPartner stub charged a flat $5k and had no ring).
        setRingTargetId(contactId);
        return;
      }
      const fn =
        action === 'movein' ? moveInTogether :
        action === 'breakup' ? breakUpWithPartner :
        () => fileDivorce(contactId);
      const r: any = fn(contactId);
      if (r) {
        if (r.success) saveGame();
        flash(r.message, contactId);
      }
    },
    [moveInTogether, breakUpWithPartner, fileDivorce, saveGame, flash]
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
        Alert.alert('Congratulations! 💍', `${r.message}\n\nNext step: plan the wedding!`);
      } else {
        flash(r.message, contactId);
      }
    },
    [ringTargetId, gameState, setGameState, updateMoneyDep, updateStatsDep, saveGame, flash]
  );

  const renderPersonalCard = (c: ContactView) => {
    const r = c.raw as Relationship;
    const expanded = expandedId === c.id;
    const isPartner = c.kind === 'partner';
    return (
      <View key={c.id} style={cardSurface}>
        <TouchableOpacity
          style={styles.cardHeader}
          onPress={() => setExpandedId(expanded ? null : c.id)}
          activeOpacity={0.85}
        >
          <Image
            source={getRelationshipImage(r.age || 25, r.gender || 'male', r.type)}
            style={[styles.avatar, { borderColor: theme.glassBorder }]}
          />
          <View style={{ flex: 1 }}>
            <Text style={[styles.cardName, { color: theme.text }]}>{c.name}</Text>
            <Text style={[styles.cardSub, { color: theme.textSecondary }]}>
              {c.subtitle}{r.personality ? ` · ${r.personality}` : ''}
              {r.npcMood ? ` · ${getMoodLabel(r.npcMood)}` : ''}
            </Text>
            <View style={[styles.bar, { backgroundColor: theme.surfaceElevated }]}>
              <View
                style={[
                  styles.barFill,
                  {
                    width: `${Math.max(0, Math.min(100, c.strength))}%`,
                    backgroundColor: strengthColor(c.strength),
                  },
                ]}
              />
            </View>
          </View>
          <Text style={[styles.cardScore, { color: strengthColor(c.strength) }]}>
            {Math.round(c.strength)}
          </Text>
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
            {/* Inner life: the weekly NPC-depth tick evolves opinion (trust/
                attraction/respect), goals, gift tastes, and memories — but none
                of it was rendered, so relationships read as one static bar.
                Surface it compactly here. */}
            {r.npcOpinion ? (
              <View style={styles.opinionRow}>
                <Text style={[styles.opinionStat, { color: theme.textSecondary }]}>
                  🤝 Trust <Text style={{ color: theme.text, fontWeight: '700' }}>{Math.round(r.npcOpinion.trust ?? 0)}</Text>
                </Text>
                <Text style={[styles.opinionStat, { color: theme.textSecondary }]}>
                  💘 Attraction <Text style={{ color: theme.text, fontWeight: '700' }}>{Math.round(r.npcOpinion.attraction ?? 0)}</Text>
                </Text>
                <Text style={[styles.opinionStat, { color: theme.textSecondary }]}>
                  🎖️ Respect <Text style={{ color: theme.text, fontWeight: '700' }}>{Math.round(r.npcOpinion.respect ?? 0)}</Text>
                </Text>
              </View>
            ) : null}
            {(() => {
              const goal = (r.npcGoals ?? []).find((g) => !g.fulfilled);
              return goal ? (
                <Text style={[styles.innerLifeLine, { color: theme.textSecondary }]} numberOfLines={1}>
                  🎯 Dreams of: {goal.label}
                </Text>
              ) : null;
            })()}
            {r.giftPreferences && r.giftPreferences.length > 0 ? (
              <Text style={[styles.innerLifeLine, { color: theme.textSecondary }]} numberOfLines={1}>
                🎁 Loves: {r.giftPreferences.slice(0, 3).join(', ')}
              </Text>
            ) : null}
            {r.npcMemories && r.npcMemories.length > 0 ? (
              <Text
                style={{ fontSize: fontScale(11.5), color: theme.textSecondary, fontStyle: 'italic', marginBottom: scale(8) }}
                numberOfLines={2}
              >
                Remembers: {r.npcMemories[r.npcMemories.length - 1].description}
              </Text>
            ) : null}
            <View style={styles.actionsRow}>
              <ActionBtn label="Call" Icon={Phone} color={accent.info} onPress={() => handleSimple(c.id, 'call', 0, 3)} darkMode={darkMode} />
              <ActionBtn label="Hang Out" Icon={Coffee} color={accent.success} onPress={() => handleSimple(c.id, 'hangout', 30, 5)} darkMode={darkMode} />
              <ActionBtn label="Ask $" Icon={DollarSign} color={accent.warning} onPress={() => handleAskMoney(c.id)} darkMode={darkMode} />
            </View>
            {isPartner && (
              <>
                <Text style={[styles.sectionLabel, { color: theme.textSecondary }]}>Dating</Text>
                <View style={styles.actionsRow}>
                  <ActionBtn label="Coffee $20" Icon={Coffee} color={accent.info} onPress={() => handleDate(c.id, 'coffee')} darkMode={darkMode} />
                  <ActionBtn label="Dinner $80" Icon={Heart} color={accent.danger} onPress={() => handleDate(c.id, 'dinner')} darkMode={darkMode} />
                  <ActionBtn label="Luxury $300" Icon={Star} color={accent.gold} onPress={() => handleDate(c.id, 'luxury')} darkMode={darkMode} />
                </View>
                <Text style={[styles.sectionLabel, { color: theme.textSecondary }]}>Gifts</Text>
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
          </View>
        )}
      </View>
    );
  };

  const renderNetworkCard = (c: ContactView) => {
    const { Icon, color } = kindMeta(c.kind);
    return (
      <View key={c.id} style={cardSurface}>
        <View style={styles.cardHeader}>
          <View style={[getGlassIconContainer(darkMode, 40), { backgroundColor: hexToRgba(color, 0.15), borderWidth: 1, borderColor: hexToRgba(color, 0.3) }]}>
            <Icon size={scale(20)} color={color} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={[styles.cardName, { color: theme.text }]}>{c.name}</Text>
            {c.subtitle ? <Text style={[styles.cardSub, { color: theme.textSecondary }]}>{c.subtitle}</Text> : null}
            <View style={[styles.bar, { backgroundColor: theme.surfaceElevated }]}>
              <View
                style={[
                  styles.barFill,
                  { width: `${Math.max(0, Math.min(100, c.strength))}%`, backgroundColor: color },
                ]}
              />
            </View>
            <View style={styles.tagRow}>
              {c.tags.slice(0, 3).map((t) => (
                <View key={t} style={[styles.tag, { backgroundColor: hexToRgba(color, 0.12) }]}>
                  <Text style={[styles.tagText, { color }]}>{t}</Text>
                </View>
              ))}
              {c.costPerWeek ? (
                <Text style={[styles.cardSub, { color: accent.warning }]}>
                  ${c.costPerWeek.toLocaleString()}/wk
                </Text>
              ) : null}
            </View>
          </View>
        </View>
      </View>
    );
  };

  const renderPersonal = () => (
    <ScrollView style={styles.flex1} contentContainerStyle={[styles.scrollPad, { paddingBottom: getAppScreenBottomPadding(insets.bottom) }]}>
      {personalContacts.length === 0 ? (
        <EmptyHero
          Icon={Users}
          title="No relationships yet"
          subtitle="Date, befriend, or build family ties to populate this list."
          theme={theme}
          darkMode={darkMode}
        />
      ) : (
        personalContacts.map(renderPersonalCard)
      )}
    </ScrollView>
  );

  const renderNetwork = () => (
    <ScrollView style={styles.flex1} contentContainerStyle={[styles.scrollPad, { paddingBottom: getAppScreenBottomPadding(insets.bottom) }]}>
      {statsHero('Your network', (
        <View style={styles.statsRow}>
          <Stat label="Lobbyists" value={countByKind(networkContacts, 'lobbyist')} color={accent.purple} theme={theme} />
          <Stat label="Allies" value={countByKind(networkContacts, 'alliance')} color={accent.info} theme={theme} />
          <Stat label="Vendors" value={countByKind(networkContacts, 'vendor')} color={accent.warning} theme={theme} />
          <Stat label="Business" value={countByKind(networkContacts, 'business')} color={accent.success} theme={theme} />
        </View>
      ))}
      {networkContacts.length === 0 ? (
        <EmptyHero
          Icon={Briefcase}
          title="No network contacts yet"
          subtitle="Hire lobbyists, invest in travel businesses, or buy from dark-web vendors to build your network."
          theme={theme}
          darkMode={darkMode}
        />
      ) : (
        networkContacts.map(renderNetworkCard)
      )}
    </ScrollView>
  );

  const renderFavors = () => (
    <ScrollView style={styles.flex1} contentContainerStyle={[styles.scrollPad, { paddingBottom: getAppScreenBottomPadding(insets.bottom) }]}>
      {statsHero('IOU position', (
        <View style={styles.statsRow}>
          <Stat label="Owed to you" value={`$${moneyPos.owedToPlayer.toLocaleString()}`} color={accent.success} theme={theme} />
          <Stat label="You owe" value={`$${moneyPos.owedByPlayer.toLocaleString()}`} color={accent.danger} theme={theme} />
          <Stat
            label="Net"
            value={`${moneyPos.net >= 0 ? '+' : '−'}$${Math.abs(moneyPos.net).toLocaleString()}`}
            color={moneyPos.net >= 0 ? accent.success : accent.danger}
            theme={theme}
          />
        </View>
      ))}
      {open.length === 0 ? (
        <EmptyHero
          Icon={Handshake}
          title="No open favors"
          subtitle="Favors get added when you lend, owe, or do business with contacts. Redeem them here when you call them in."
          theme={theme}
          darkMode={darkMode}
        />
      ) : (
        open.map((f) => (
          <View key={f.id} style={cardSurface}>
            <View style={styles.cardHeader}>
              <View style={[getGlassIconContainer(darkMode, 40), { backgroundColor: hexToRgba(favorColor(f.kind), 0.15), borderWidth: 1, borderColor: hexToRgba(favorColor(f.kind), 0.3) }]}>
                <Handshake size={scale(20)} color={favorColor(f.kind)} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[styles.cardName, { color: theme.text }]}>
                  {f.direction === 'owed-to-player' ? 'You hold' : 'You owe'}: {f.kind}
                </Text>
                <Text style={[styles.cardSub, { color: theme.textSecondary }]}>
                  Contact: {f.contactId} · since week {f.createdWeek}
                  {f.expiresWeek ? ` · expires week ${f.expiresWeek}` : ''}
                </Text>
                {f.note ? (
                  <Text style={[styles.cardSub, { color: theme.textSecondary }]}>{f.note}</Text>
                ) : null}
                <View style={styles.tagRow}>
                  <View style={[styles.tag, { backgroundColor: hexToRgba(favorColor(f.kind), 0.12) }]}>
                    <Text style={[styles.tagText, { color: favorColor(f.kind) }]}>
                      {f.kind === 'money' ? `$${f.value.toLocaleString()}` : `${f.value} pts`}
                    </Text>
                  </View>
                </View>
              </View>
              {f.direction === 'owed-to-player' ? (
                <TouchableOpacity
                  style={[styles.redeemBtn, { backgroundColor: hexToRgba(accent.success, 0.16) }]}
                  onPress={() => handleRedeemFavor(f.id)}
                  accessibilityRole="button"
                  accessibilityLabel="Redeem favor"
                >
                  <Text style={[styles.redeemText, { color: accent.success }]}>Redeem</Text>
                </TouchableOpacity>
              ) : null}
            </View>
          </View>
        ))
      )}
    </ScrollView>
  );

  const renderAttention = () => (
    <ScrollView style={styles.flex1} contentContainerStyle={[styles.scrollPad, { paddingBottom: getAppScreenBottomPadding(insets.bottom) }]}>
      {needAttention.length === 0 ? (
        <EmptyHero
          Icon={Heart}
          title="Everyone's content"
          subtitle="No stale or struggling contacts. Keep it up."
          theme={theme}
          darkMode={darkMode}
        />
      ) : (
        needAttention.map((c) => (
          <View key={c.id} style={cardSurface}>
            <View style={styles.cardHeader}>
              <View style={[getGlassIconContainer(darkMode, 40), { backgroundColor: hexToRgba(accent.warning, 0.15), borderWidth: 1, borderColor: hexToRgba(accent.warning, 0.3) }]}>
                <AlertTriangle size={scale(20)} color={accent.warning} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[styles.cardName, { color: theme.text }]}>{c.name}</Text>
                <Text style={[styles.cardSub, { color: theme.textSecondary }]}>
                  {c.subtitle} · last contact {c.weeksSinceContact ?? '?'} weeks ago · strength {Math.round(c.strength)}
                </Text>
              </View>
            </View>
          </View>
        ))
      )}
    </ScrollView>
  );

  return (
    <View style={[styles.root, { backgroundColor: theme.background }]}>
      <View style={[styles.header, { backgroundColor: theme.surface }]}>
        <TouchableOpacity onPress={onBack} style={styles.headerBtn}>
          <ArrowLeft size={scale(18)} color={theme.text} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: theme.text }]}>Contacts</Text>
        <View style={styles.headerBtn} />
      </View>

      <View style={[styles.tabBar, { backgroundColor: theme.surface, borderColor: theme.border }]}>
        {(['personal', 'network', 'favors', 'attention'] as TabType[]).map((tab) => (
          <TouchableOpacity
            key={tab}
            onPress={() => setActiveTab(tab)}
            style={[
              styles.tabBtn,
              activeTab === tab && { borderBottomColor: accent.amber, borderBottomWidth: 2 },
            ]}
          >
            <Text
              style={[
                styles.tabText,
                { color: activeTab === tab ? accent.amber : theme.textMuted },
              ]}
            >
              {tab[0].toUpperCase() + tab.slice(1)}
              {tab === 'attention' && needAttention.length > 0 ? ` · ${needAttention.length}` : ''}
              {tab === 'favors' && open.length > 0 ? ` · ${open.length}` : ''}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {activeTab === 'personal' && renderPersonal()}
      {activeTab === 'network' && renderNetwork()}
      {activeTab === 'favors' && renderFavors()}
      {activeTab === 'attention' && renderAttention()}

      {feedback && !feedback.id ? (
        <View style={[styles.toast, getPlatformShadows(8, 0.2, 0, 16), { bottom: getAppScreenBottomPadding(insets.bottom), backgroundColor: theme.surface, borderColor: accent.amber }]}>
          <Text style={{ color: theme.text }}>{feedback.message}</Text>
        </View>
      ) : null}

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
  // danger-colored LABEL only — never a filled red button.
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
  // Standard action: a soft same-hue tinted chip — saturated glyph + label, no border.
  return (
    <TouchableOpacity
      onPress={onPress}
      style={[styles.actionChip, { backgroundColor: hexToRgba(color, 0.14) }]}
      activeOpacity={0.85}
      accessibilityRole="button"
      accessibilityLabel={label}
    >
      <Icon size={scale(14)} color={color} />
      <Text style={[styles.actionBtnText, { color }]}>{label}</Text>
    </TouchableOpacity>
  );
}

function Stat({
  label,
  value,
  color,
  theme,
}: {
  label: string;
  value: number | string;
  color: string;
  theme: ReturnType<typeof getThemeColors>;
}) {
  return (
    <View style={styles.stat}>
      <Text
        style={[styles.statValue, { color }]}
        numberOfLines={1}
        adjustsFontSizeToFit
        minimumFontScale={0.6}
      >
        {value}
      </Text>
      <Text style={[styles.statLabel, { color: theme.textSecondary }]}>{label}</Text>
    </View>
  );
}

function EmptyHero({
  Icon,
  title,
  subtitle,
  theme,
  darkMode,
}: {
  Icon: React.ComponentType<{ size: number; color: string }>;
  title: string;
  subtitle: string;
  theme: ReturnType<typeof getThemeColors>;
  darkMode: boolean;
}) {
  return (
    <View
      style={[
        getGlassCard(darkMode, 6),
        styles.emptyCard,
        { backgroundColor: theme.surface, borderColor: theme.border, borderWidth: 1, borderRadius: br.xl },
      ]}
    >
      <View style={styles.emptyContent}>
        <Icon size={scale(44)} color={theme.textSecondary} />
        <Text style={[styles.emptyTitle, { color: theme.text }]}>{title}</Text>
        <Text style={[styles.emptySub, { color: theme.textSecondary }]}>{subtitle}</Text>
      </View>
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

/** #RRGGBB → rgba(). Every accent token fed here is a 6-digit hex, so a simple parse is safe. */
function hexToRgba(hex: string, alpha: number): string {
  const h = hex.replace('#', '');
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  flex1: { flex: 1 },
  scrollPad: { padding: sp.md, gap: sp.lg, paddingBottom: sp['3xl'] },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: sp.md,
    paddingVertical: sp.sm,
  },
  headerBtn: { width: scale(40), height: scale(40), alignItems: 'center', justifyContent: 'center' },
  headerTitle: { fontSize: fs.lg, fontWeight: '700' },
  tabBar: { flexDirection: 'row', borderBottomWidth: 1 },
  tabBtn: { flex: 1, paddingVertical: sp.sm, alignItems: 'center' },
  tabText: { fontSize: fs.sm, fontWeight: '700' },
  card: { padding: sp.md },
  cardHeader: { flexDirection: 'row', alignItems: 'center', gap: sp.md },
  cardName: { fontSize: fs.md, fontWeight: '800' },
  cardSub: { fontSize: fs.sm, marginTop: 2 },
  cardScore: { fontSize: fs.md, fontWeight: '800', fontVariant: ['tabular-nums'] },
  avatar: { width: scale(48), height: scale(48), borderRadius: scale(24), borderWidth: 1 },
  bar: { height: scale(6), borderRadius: br.full, marginTop: sp.xs, overflow: 'hidden' },
  barFill: { height: '100%', borderRadius: br.full },
  tagRow: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: sp.xs, marginTop: sp.xs },
  tag: { paddingHorizontal: sp.sm, paddingVertical: 2, borderRadius: br.full },
  tagText: { fontSize: fs.xs, fontWeight: '700' },
  actionsBox: { gap: sp.sm, marginTop: sp.md },
  actionsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: sp.xs },
  opinionRow: { flexDirection: 'row', flexWrap: 'wrap', gap: sp.sm },
  opinionStat: { fontSize: fontScale(11) },
  innerLifeLine: { fontSize: fontScale(11.5) },
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
  },
  // Destructive glass button (danger label rides on top, set inline).
  actionGlassBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: sp.xs,
    paddingHorizontal: sp.md,
    paddingVertical: sp.sm,
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
  ctaLabel: { color: 'white', fontSize: fs.md, fontWeight: '700' },
  actionBtnText: { fontSize: fs.xs, fontWeight: '700' },
  sectionLabel: { fontSize: fs.xs, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.6, marginTop: sp.xs },
  feedback: { fontSize: fs.xs, fontStyle: 'italic', marginTop: sp.xs },
  // Recipe B hero interior: clipped so the tint wash + glow blob stay inside the radius.
  heroInner: { borderRadius: br['2xl'], overflow: 'hidden', padding: sp.lg },
  heroGlow: {
    position: 'absolute',
    top: -scale(48),
    right: -scale(36),
    width: scale(150),
    height: scale(150),
    borderRadius: scale(75),
    backgroundColor: 'rgba(249, 115, 22, 0.10)',
  },
  heroHairline: { position: 'absolute', top: 0, left: 0, right: 0, height: 1, backgroundColor: 'rgba(255, 255, 255, 0.08)' },
  statsTitle: { fontSize: fs.xs, fontWeight: '600', letterSpacing: 0.8, textTransform: 'uppercase', marginBottom: sp.sm },
  // Wrap to handle 4-up Network row (cramped at ~85pt each) and 3-up Favors row
  // with long $-formatted values. flexBasis: 22% keeps the 4-up Network row on a
  // single line on larger phones but lets it drop to 2x2 on narrow screens; the
  // 3-up Favors row stays in one line until values get long.
  statsRow: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-around', gap: sp.xs },
  stat: { alignItems: 'center', flexBasis: '22%', flexGrow: 1, minWidth: scale(72) },
  statValue: { fontSize: fs.lg, fontWeight: '800', fontVariant: ['tabular-nums'] },
  statLabel: { fontSize: fs.xs, marginTop: 2 },
  emptyCard: { paddingVertical: sp['2xl'], paddingHorizontal: sp.lg, alignItems: 'center' },
  emptyContent: { alignItems: 'center', gap: sp.sm, opacity: 0.6 },
  emptyTitle: { fontSize: fs.lg, fontWeight: '800' },
  emptySub: { fontSize: fs.sm, textAlign: 'center' },
  redeemBtn: { paddingHorizontal: sp.md, paddingVertical: sp.sm, borderRadius: br.full },
  redeemText: { fontSize: fs.sm, fontWeight: '700' },
  toast: {
    position: 'absolute',
    bottom: sp.lg,
    left: sp.md,
    right: sp.md,
    padding: sp.md,
    borderRadius: br.xl,
    borderWidth: 1,
  },
});
