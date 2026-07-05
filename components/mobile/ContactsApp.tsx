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
import type { Relationship } from '@/contexts/game/types';
import { aggregateContacts, ContactView, contactsNeedingAttention } from '@/lib/contacts/aggregator';
import { netMoneyPosition, openFavors, FavorLedger } from '@/lib/contacts/favors';
import { goOnDate, giveGift, proposeMarriage } from '@/contexts/game/actions/DatingActions';
import RingSelectionModal from '@/components/mobile/RingSelectionModal';
import WeddingPlanningModal from '@/components/mobile/WeddingPlanningModal';
import { redeemFavor } from '@/contexts/game/actions/ContactsActions';
import { applyMoneyDelta } from '@/contexts/game/actions/MoneyActions';
import { getRelationshipImage } from '@/utils/characterImages';
import { getThemeColors, accent } from '@/lib/config/theme';
import {
  responsiveFontSize as fs,
  responsiveSpacing as sp,
  responsiveBorderRadius as br,
  scale,
  getTabBarSafePadding,
} from '@/utils/scaling';

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
      if (rel.actions?.[action] === gameState.weeksLived) {
        flash('Already used this week.', contactId);
        return;
      }
      if (cost > 0 && gameState.stats.money < cost) {
        flash(`Need $${cost.toLocaleString()}.`, contactId);
        return;
      }
      if (cost > 0) updateMoney(-cost, `${action} with ${rel.name}`, false);
      updateRelationship(contactId, bonus);
      recordRelationshipAction(contactId, action);
      flash(`+${bonus} with ${rel.name}.`, contactId);
    },
    [gameState, updateMoney, updateRelationship, recordRelationshipAction, flash]
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
      <View
        key={c.id}
        style={[styles.card, { backgroundColor: theme.surface, borderColor: theme.border }]}
      >
        <TouchableOpacity
          style={styles.cardHeader}
          onPress={() => setExpandedId(expanded ? null : c.id)}
          activeOpacity={0.85}
        >
          <Image
            source={getRelationshipImage(r.age || 25, r.gender || 'male', r.type)}
            style={styles.avatar}
          />
          <View style={{ flex: 1 }}>
            <Text style={[styles.cardName, { color: theme.text }]}>{c.name}</Text>
            <Text style={[styles.cardSub, { color: theme.textSecondary }]}>
              {c.subtitle} {r.personality ? `· ${r.personality}` : ''}
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
          <ChevronDown
            size={scale(18)}
            color={theme.textSecondary}
            style={{ transform: [{ rotate: expanded ? '180deg' : '0deg' }] }}
          />
        </TouchableOpacity>

        {feedback?.id === c.id ? (
          <Text style={[styles.feedback, { color: accent.info }]}>{feedback.message}</Text>
        ) : null}

        {expanded && (
          <View style={styles.actionsBox}>
            <View style={styles.actionsRow}>
              <ActionBtn label="Call" Icon={Phone} color={accent.info} onPress={() => handleSimple(c.id, 'call', 0, 3)} />
              <ActionBtn label="Hang Out" Icon={Coffee} color={accent.success} onPress={() => handleSimple(c.id, 'hangout', 30, 5)} />
              <ActionBtn label="Ask $" Icon={DollarSign} color={accent.warning} onPress={() => handleAskMoney(c.id)} />
            </View>
            {isPartner && (
              <>
                <Text style={[styles.sectionLabel, { color: theme.textSecondary }]}>Dating</Text>
                <View style={styles.actionsRow}>
                  <ActionBtn label="Coffee $20" Icon={Coffee} color={accent.info} onPress={() => handleDate(c.id, 'coffee')} />
                  <ActionBtn label="Dinner $80" Icon={Heart} color={accent.danger} onPress={() => handleDate(c.id, 'dinner')} />
                  <ActionBtn label="Luxury $300" Icon={Star} color={accent.gold} onPress={() => handleDate(c.id, 'luxury')} />
                </View>
                <Text style={[styles.sectionLabel, { color: theme.textSecondary }]}>Gifts</Text>
                <View style={styles.actionsRow}>
                  <ActionBtn label="Flowers" Icon={Gift} color={accent.danger} onPress={() => handleGift(c.id, 'flowers')} />
                  <ActionBtn label="Jewelry" Icon={Gift} color={accent.purple} onPress={() => handleGift(c.id, 'jewelry')} />
                </View>
                {!r.livingTogether && (
                  <ActionBtn label="Move in together" Icon={Handshake} color={accent.success} onPress={() => handleSpecial(c.id, 'movein')} wide />
                )}
                {!r.engagementWeek && r.livingTogether && (
                  <ActionBtn label="Propose" Icon={Heart} color={accent.gold} onPress={() => handleSpecial(c.id, 'propose')} wide />
                )}
                {r.engagementWeek != null && !r.weddingPlanned && (
                  <ActionBtn label="Plan Wedding" Icon={Heart} color={accent.purple} onPress={() => setWeddingTargetId(c.id)} wide />
                )}
                <ActionBtn label="Break up" Icon={XIcon} color={accent.danger} onPress={() => handleSpecial(c.id, 'breakup')} wide subtle />
              </>
            )}
            {r.type === 'spouse' && (
              <ActionBtn label="File for divorce" Icon={XIcon} color={accent.danger} onPress={() => handleSpecial(c.id, 'divorce')} wide subtle />
            )}
          </View>
        )}
      </View>
    );
  };

  const renderNetworkCard = (c: ContactView) => {
    const { Icon, color } = kindMeta(c.kind);
    return (
      <View
        key={c.id}
        style={[styles.card, { backgroundColor: theme.surface, borderColor: theme.border }]}
      >
        <View style={styles.cardHeader}>
          <View style={[styles.networkIcon, { backgroundColor: color }]}>
            <Icon size={scale(18)} color="white" />
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
                <View key={t} style={[styles.tag, { borderColor: color }]}>
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
    <ScrollView style={styles.flex1} contentContainerStyle={[styles.scrollPad, { paddingBottom: getTabBarSafePadding(insets.bottom) }]}>
      {personalContacts.length === 0 ? (
        <EmptyHero
          Icon={Users}
          title="No relationships yet"
          subtitle="Date, befriend, or build family ties to populate this list."
          theme={theme}
        />
      ) : (
        personalContacts.map(renderPersonalCard)
      )}
    </ScrollView>
  );

  const renderNetwork = () => (
    <ScrollView style={styles.flex1} contentContainerStyle={[styles.scrollPad, { paddingBottom: getTabBarSafePadding(insets.bottom) }]}>
      <View style={[styles.statsCard, { backgroundColor: theme.surface, borderColor: theme.border }]}>
        <Text style={[styles.statsTitle, { color: theme.text }]}>Your network</Text>
        <View style={styles.statsRow}>
          <Stat label="Lobbyists" value={countByKind(networkContacts, 'lobbyist')} color={accent.purple} theme={theme} />
          <Stat label="Allies" value={countByKind(networkContacts, 'alliance')} color={accent.info} theme={theme} />
          <Stat label="Vendors" value={countByKind(networkContacts, 'vendor')} color={accent.warning} theme={theme} />
          <Stat label="Business" value={countByKind(networkContacts, 'business')} color={accent.success} theme={theme} />
        </View>
      </View>
      {networkContacts.length === 0 ? (
        <EmptyHero
          Icon={Briefcase}
          title="No network contacts yet"
          subtitle="Hire lobbyists, invest in travel businesses, or buy from dark-web vendors to build your network."
          theme={theme}
        />
      ) : (
        networkContacts.map(renderNetworkCard)
      )}
    </ScrollView>
  );

  const renderFavors = () => (
    <ScrollView style={styles.flex1} contentContainerStyle={[styles.scrollPad, { paddingBottom: getTabBarSafePadding(insets.bottom) }]}>
      <View style={[styles.statsCard, { backgroundColor: theme.surface, borderColor: theme.border }]}>
        <Text style={[styles.statsTitle, { color: theme.text }]}>IOU position</Text>
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
      </View>
      {open.length === 0 ? (
        <EmptyHero
          Icon={Handshake}
          title="No open favors"
          subtitle="Favors get added when you lend, owe, or do business with contacts. Redeem them here when you call them in."
          theme={theme}
        />
      ) : (
        open.map((f) => (
          <View key={f.id} style={[styles.card, { backgroundColor: theme.surface, borderColor: theme.border }]}>
            <View style={styles.cardHeader}>
              <View style={[styles.networkIcon, { backgroundColor: favorColor(f.kind) }]}>
                <Handshake size={scale(18)} color="white" />
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
                  <View style={[styles.tag, { borderColor: favorColor(f.kind) }]}>
                    <Text style={[styles.tagText, { color: favorColor(f.kind) }]}>
                      {f.kind === 'money' ? `$${f.value.toLocaleString()}` : `${f.value} pts`}
                    </Text>
                  </View>
                </View>
              </View>
              {f.direction === 'owed-to-player' ? (
                <TouchableOpacity
                  style={[styles.redeemBtn, { backgroundColor: accent.success }]}
                  onPress={() => handleRedeemFavor(f.id)}
                >
                  <Text style={styles.redeemText}>Redeem</Text>
                </TouchableOpacity>
              ) : null}
            </View>
          </View>
        ))
      )}
    </ScrollView>
  );

  const renderAttention = () => (
    <ScrollView style={styles.flex1} contentContainerStyle={[styles.scrollPad, { paddingBottom: getTabBarSafePadding(insets.bottom) }]}>
      {needAttention.length === 0 ? (
        <EmptyHero
          Icon={Heart}
          title="Everyone's content"
          subtitle="No stale or struggling contacts. Keep it up."
          theme={theme}
        />
      ) : (
        needAttention.map((c) => (
          <View key={c.id} style={[styles.card, { backgroundColor: theme.surface, borderColor: theme.border }]}>
            <View style={styles.cardHeader}>
              <View style={[styles.networkIcon, { backgroundColor: accent.warning }]}>
                <AlertTriangle size={scale(18)} color="white" />
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
      <View style={[styles.header, { backgroundColor: theme.surface, borderColor: theme.border }]}>
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
              activeTab === tab && { borderBottomColor: accent.info, borderBottomWidth: 2 },
            ]}
          >
            <Text
              style={[
                styles.tabText,
                { color: activeTab === tab ? accent.info : theme.textSecondary },
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
        <View style={[styles.toast, { bottom: getTabBarSafePadding(insets.bottom), backgroundColor: theme.surface, borderColor: accent.info }]}>
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
  wide,
  subtle,
}: {
  label: string;
  Icon: React.ComponentType<{ size: number; color: string }>;
  color: string;
  onPress: () => void;
  wide?: boolean;
  subtle?: boolean;
}) {
  return (
    <TouchableOpacity
      onPress={onPress}
      style={[
        styles.actionBtn,
        wide && { flexBasis: '100%' },
        subtle ? { backgroundColor: 'transparent', borderColor: color, borderWidth: 1 } : { backgroundColor: color },
      ]}
      activeOpacity={0.85}
    >
      <Icon size={scale(14)} color={subtle ? color : 'white'} />
      <Text style={[styles.actionBtnText, { color: subtle ? color : 'white' }]}>{label}</Text>
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
}: {
  Icon: React.ComponentType<{ size: number; color: string }>;
  title: string;
  subtitle: string;
  theme: ReturnType<typeof getThemeColors>;
}) {
  return (
    <View style={styles.empty}>
      <Icon size={scale(48)} color={theme.textSecondary} />
      <Text style={[styles.emptyTitle, { color: theme.text }]}>{title}</Text>
      <Text style={[styles.emptySub, { color: theme.textSecondary }]}>{subtitle}</Text>
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
  if (s >= 60) return accent.warning;
  if (s >= 40) return accent.amber;
  return accent.danger;
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  flex1: { flex: 1 },
  scrollPad: { padding: sp.md, gap: sp.md, paddingBottom: sp['3xl'] },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: sp.md,
    paddingVertical: sp.sm,
    borderBottomWidth: 1,
  },
  headerBtn: { width: scale(40), height: scale(40), alignItems: 'center', justifyContent: 'center' },
  headerTitle: { fontSize: fs.xl, fontWeight: '800' },
  tabBar: { flexDirection: 'row', borderBottomWidth: 1 },
  tabBtn: { flex: 1, paddingVertical: sp.sm, alignItems: 'center' },
  tabText: { fontSize: fs.sm, fontWeight: '700' },
  card: { padding: sp.md, borderRadius: br.lg, borderWidth: 1 },
  cardHeader: { flexDirection: 'row', alignItems: 'center', gap: sp.md },
  cardName: { fontSize: fs.md, fontWeight: '800' },
  cardSub: { fontSize: fs.xs, marginTop: 2 },
  avatar: { width: scale(48), height: scale(48), borderRadius: scale(24) },
  networkIcon: { width: scale(40), height: scale(40), borderRadius: scale(20), alignItems: 'center', justifyContent: 'center' },
  bar: { height: scale(6), borderRadius: br.full, marginTop: sp.xs, overflow: 'hidden' },
  barFill: { height: '100%', borderRadius: br.full },
  tagRow: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: sp.xs, marginTop: sp.xs },
  tag: { paddingHorizontal: sp.xs, paddingVertical: 2, borderRadius: br.full, borderWidth: 1 },
  tagText: { fontSize: fs.xs, fontWeight: '700' },
  actionsBox: { gap: sp.sm, marginTop: sp.md },
  actionsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: sp.xs },
  actionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: sp.xs,
    paddingHorizontal: sp.sm,
    paddingVertical: sp.xs,
    borderRadius: br.md,
    flex: 1,
    minWidth: scale(90),
    justifyContent: 'center',
  },
  actionBtnText: { fontSize: fs.xs, fontWeight: '700' },
  sectionLabel: { fontSize: fs.xs, fontWeight: '700', textTransform: 'uppercase' },
  feedback: { fontSize: fs.xs, fontStyle: 'italic', marginTop: sp.xs },
  statsCard: { padding: sp.md, borderRadius: br.lg, borderWidth: 1 },
  statsTitle: { fontSize: fs.sm, fontWeight: '800', marginBottom: sp.sm },
  // Wrap to handle 4-up Network row (cramped at ~85pt each) and 3-up Favors row
  // with long $-formatted values. flexBasis: 22% keeps the 4-up Network row on a
  // single line on larger phones but lets it drop to 2x2 on narrow screens; the
  // 3-up Favors row stays in one line until values get long.
  statsRow: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-around', gap: sp.xs },
  stat: { alignItems: 'center', flexBasis: '22%', flexGrow: 1, minWidth: scale(72) },
  statValue: { fontSize: fs.lg, fontWeight: '800' },
  statLabel: { fontSize: fs.xs, marginTop: 2 },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: sp.lg, gap: sp.sm },
  emptyTitle: { fontSize: fs.lg, fontWeight: '800' },
  emptySub: { fontSize: fs.sm, textAlign: 'center' },
  redeemBtn: { paddingHorizontal: sp.md, paddingVertical: sp.sm, borderRadius: br.md },
  redeemText: { color: 'white', fontSize: fs.sm, fontWeight: '700' },
  toast: {
    position: 'absolute',
    bottom: sp.lg,
    left: sp.md,
    right: sp.md,
    padding: sp.md,
    borderRadius: br.lg,
    borderWidth: 1,
  },
});
