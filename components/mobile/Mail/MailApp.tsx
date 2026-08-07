/**
 * DeepMail — the game's paper trail, and the one channel the player has to judge.
 *
 * ## Shape
 *
 * Gmail's, because players already know it and none of it is arbitrary: a
 * search pill instead of a title bar, category tabs that separate money from
 * marketing from people, a dense list where weight carries unread, and a folder
 * drawer behind the hamburger. Copying a layout this well-worn means the player
 * spends their attention on the CONTENT — which is the part that can cost them
 * money — instead of on learning a mail client.
 *
 * ## What is not decoration
 *
 * - The unverified-sender warning shows on every unverified message, not only
 *   the fraudulent ones. A warning that fires exactly on scams is the answer,
 *   not a warning.
 * - Search covers sender, address, subject and body, so "did my bank really
 *   write from that address?" is answerable inside the app.
 * - The risk panel in the drawer says WHY the player's exposure is what it is.
 *   Being phished more often because you shopped an untrusted vendor is a
 *   consequence; being phished more often for no visible reason is a bug report.
 *
 * Subscribes narrowly (§4.1): the mail slice plus the two settings booleans,
 * not the whole state, so an open inbox does not re-render on every decay tick.
 */

import React, { useCallback, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Modal,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  ArrowLeft,
  Menu,
  Search,
  Inbox,
  Star,
  Archive,
  ShieldAlert,
  Trash2,
  MailCheck,
  X,
  ShieldQuestion,
} from 'lucide-react-native';
import type { MailFolder, MailMessage } from '@/contexts/game/types';
import ErrorBoundary from '@/components/ErrorBoundary';
import { shallowEqual, useGameSelector, useSetGameState } from '@/contexts/game/useGameSelector';
import { useGameActions } from '@/contexts/GameContext';
import { getThemeColors } from '@/lib/config/theme';
import { getMailState, unreadByCategory, unreadCount } from '@/lib/mail/state';
import { scamRisk } from '@/lib/mail/scam';
import { docMoney } from '@/lib/mail/format';
import {
  actOnScamMail,
  chooseMailDecision,
  disputeMailCharge,
  emptyMailBin,
  markFolderRead,
  markMailRead,
  moveMail,
  reportMailPhishing,
  toggleMailStar,
} from '@/contexts/game/actions/MailActions';
import MailRow from './MailRow';
import MailDetail from './MailDetail';
import {
  fontScale,
  responsiveSpacing,
  responsiveBorderRadius,
  scale,
  touchTargets,
  getAppScreenBottomPadding,
} from '@/utils/scaling';

type View_ = MailFolder | 'starred';

const CATEGORIES = [
  { key: 'primary', label: 'Primary' },
  { key: 'finance', label: 'Finance' },
  { key: 'promotions', label: 'Promotions' },
  { key: 'social', label: 'Social' },
] as const;

const FOLDERS: { key: View_; label: string; Icon: typeof Inbox }[] = [
  { key: 'inbox', label: 'Inbox', Icon: Inbox },
  { key: 'starred', label: 'Starred', Icon: Star },
  { key: 'archive', label: 'Archive', Icon: Archive },
  { key: 'spam', label: 'Spam', Icon: ShieldAlert },
  { key: 'trash', label: 'Trash', Icon: Trash2 },
];

interface Props {
  onBack: () => void;
}

function MailAppInner({ onBack }: Props) {
  const insets = useSafeAreaInsets();
  const setGameState = useSetGameState();
  // The one resolver. Mail delegates event-backed choices to it rather than
  // reimplementing effect application — see `MailResolver`.
  const { resolveEvent } = useGameActions();

  // Narrow subscription: the mail slice and the two booleans that style it.
  const mail = useGameSelector((s) => s?.mail);
  const darkMode = useGameSelector((s) => s?.settings?.darkMode !== false);
  // Risk inputs, read separately so the panel stays live without subscribing to
  // the whole state. `shallowEqual` is not optional here: the selector builds a
  // fresh object every call, so without it this component would re-render on
  // every mutation in the game — the documented regression in CLAUDE.md §4.1.
  const riskState = useGameSelector(
    (s) => ({ darkWeb: s?.darkWeb, stats: s?.stats, bankSavings: s?.bankSavings }),
    shallowEqual
  );
  // The tab layout floats a "N decisions waiting" pill at `bottom: scale(88)`
  // and keeps it up while a sub-app is open. Reserve room for it only while it
  // is actually there — see the note on `MailDetail`'s `pillClearance`.
  const decisionPending = useGameSelector((s) => (s?.pendingEvents?.length ?? 0) > 0);
  const currentWeek = useGameSelector((s) => s?.weeksLived ?? 0);
  const pillClearance = decisionPending ? scale(110) : 0;

  const theme = getThemeColors(darkMode);
  const s = useMemo(() => makeStyles(theme, darkMode), [theme, darkMode]);

  const [folder, setFolder] = useState<View_>('inbox');
  const [category, setCategory] = useState<(typeof CATEGORIES)[number]['key']>('primary');
  const [query, setQuery] = useState('');
  const [openId, setOpenId] = useState<string | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [banner, setBanner] = useState<string | null>(null);

  // `getMailState` is the safe read layer — a partial or absent slice degrades
  // to an empty inbox rather than throwing.
  const state = useMemo(() => getMailState({ mail } as never), [mail]);
  const unreadInbox = useMemo(() => unreadCount({ mail } as never, 'inbox'), [mail]);
  const catUnread = useMemo(() => unreadByCategory({ mail } as never), [mail]);
  const risk = useMemo(() => scamRisk(riskState as never), [riskState]);

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    return state.messages
      .filter((m) => {
        const inFolder =
          folder === 'starred'
            ? m.starred && m.folder !== 'trash'
            : (m.folder ?? 'inbox') === folder;
        if (!inFolder) return false;
        // Category tabs are an INBOX affordance. Applying them to Archive or
        // Spam would hide messages inside a folder the player opened precisely
        // to find one specific thing.
        if (folder === 'inbox' && !q && (m.category ?? 'primary') !== category) return false;
        if (!q) return true;
        return (
          m.senderName.toLowerCase().includes(q) ||
          m.senderEmail.toLowerCase().includes(q) ||
          m.subject.toLowerCase().includes(q) ||
          (m.body ?? '').toLowerCase().includes(q)
        );
      })
      .sort((a, b) => (b.atWeek ?? 0) - (a.atWeek ?? 0));
  }, [state.messages, folder, category, query]);

  const open: MailMessage | null = useMemo(
    () => (openId ? state.messages.find((m) => m.id === openId) ?? null : null),
    [openId, state.messages]
  );

  const openMessage = useCallback(
    (id: string) => {
      setOpenId(id);
      markMailRead(setGameState, id);
    },
    [setGameState]
  );

  const closeMessage = useCallback(() => {
    setOpenId(null);
    setBanner(null);
  }, []);

  const handleAct = useCallback(() => {
    if (!open) return;
    actOnScamMail(setGameState, open.id, ({ lost }) => {
      setBanner(
        lost > 0
          ? `${docMoney(lost)} left your account.`
          : 'Nothing was taken — there was nothing to take.'
      );
    });
  }, [open, setGameState]);

  const handleDispute = useCallback(() => {
    if (!open) return;
    disputeMailCharge(setGameState, open.id, ({ recovered, refused }) => {
      setBanner(refused ?? `The bank recovered ${docMoney(recovered)} of the loss.`);
    });
  }, [open, setGameState]);

  /**
   * Take a choice on a decision.
   *
   * Event-backed letters come back with a delegation instruction rather than an
   * applied effect: `resolveEvent` owns money, karma, follow-ups and
   * affordability, and mail must not grow a second copy of any of that. The
   * stamp is one-shot, so the delegation can only be issued once however many
   * times the button is pressed.
   */
  const handleChoose = useCallback(
    (choiceId: string) => {
      if (!open) return;
      chooseMailDecision(setGameState, open.id, choiceId, ({ outcome, delegateToEvent }) => {
        if (delegateToEvent) {
          resolveEvent(delegateToEvent.eventId, delegateToEvent.choiceId);
        }
        if (outcome) setBanner(outcome);
      });
    },
    [open, setGameState, resolveEvent]
  );

  const handleReport = useCallback(() => {
    if (!open) return;
    reportMailPhishing(setGameState, open.id);
    setBanner('Reported. Moved to Spam.');
  }, [open, setGameState]);

  // ---------------------------------------------------------------- detail
  if (open) {
    return (
      <View style={s.container}>
        {banner ? (
          <View style={s.banner}>
            <Text style={s.bannerText}>{banner}</Text>
          </View>
        ) : null}
        <MailDetail
          message={open}
          darkMode={darkMode}
          bottomInset={insets.bottom}
          pillClearance={pillClearance}
          onBack={closeMessage}
          onToggleStar={() => toggleMailStar(setGameState, open.id)}
          onArchive={() => {
            moveMail(setGameState, open.id, 'archive');
            closeMessage();
          }}
          onDelete={() => {
            moveMail(setGameState, open.id, 'trash');
            closeMessage();
          }}
          onReport={handleReport}
          onAct={handleAct}
          onDispute={handleDispute}
          onChoose={handleChoose}
          currentWeek={currentWeek}
        />
      </View>
    );
  }

  // ------------------------------------------------------------------ list
  const folderLabel = FOLDERS.find((f) => f.key === folder)?.label ?? 'Inbox';

  return (
    <View style={s.container}>
      {/* Gmail's search bar IS the header — there is no separate title. */}
      <View style={s.searchWrap}>
        <TouchableOpacity
          onPress={() => setDrawerOpen(true)}
          style={s.iconBtn}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          accessibilityRole="button"
          accessibilityLabel="Open mail folders"
        >
          <Menu size={scale(20)} color={theme.text} />
        </TouchableOpacity>

        <View style={s.searchField}>
          <Search size={scale(16)} color={theme.textSecondary} />
          <TextInput
            style={s.searchInput}
            value={query}
            onChangeText={setQuery}
            placeholder={`Search ${folderLabel.toLowerCase()}`}
            placeholderTextColor={theme.textSecondary}
            returnKeyType="search"
            accessibilityLabel="Search mail"
          />
          {query.length > 0 ? (
            <TouchableOpacity
              onPress={() => setQuery('')}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              accessibilityRole="button"
              accessibilityLabel="Clear search"
            >
              <X size={scale(15)} color={theme.textSecondary} />
            </TouchableOpacity>
          ) : null}
        </View>

        <TouchableOpacity
          onPress={onBack}
          style={s.iconBtn}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          accessibilityRole="button"
          accessibilityLabel="Close mail"
        >
          <ArrowLeft size={scale(20)} color={theme.text} />
        </TouchableOpacity>
      </View>

      {/* Category tabs — inbox only, and hidden while searching, because a
          search that silently excluded three quarters of the mailbox would be
          the most confusing thing in the app. */}
      {folder === 'inbox' && query.trim().length === 0 ? (
        <View style={s.tabs}>
          {CATEGORIES.map((c) => {
            const active = c.key === category;
            return (
              <TouchableOpacity
                key={c.key}
                style={[s.tab, active && s.tabActive]}
                onPress={() => setCategory(c.key)}
                accessibilityRole="button"
                accessibilityLabel={`${c.label} category`}
              >
                <Text style={[s.tabText, active && s.tabTextActive]}>{c.label}</Text>
                {catUnread[c.key] > 0 ? (
                  <View style={s.tabDot}>
                    <Text style={s.tabDotText}>{catUnread[c.key]}</Text>
                  </View>
                ) : null}
              </TouchableOpacity>
            );
          })}
        </View>
      ) : (
        <View style={s.folderHeader}>
          <Text style={s.folderHeaderText}>{folderLabel}</Text>
          {(folder === 'spam' || folder === 'trash') && visible.length > 0 ? (
            <TouchableOpacity
              onPress={() => emptyMailBin(setGameState)}
              accessibilityRole="button"
              accessibilityLabel="Empty spam and trash"
            >
              <Text style={s.folderAction}>Empty</Text>
            </TouchableOpacity>
          ) : null}
        </View>
      )}

      <ScrollView
        contentContainerStyle={{
          paddingBottom: getAppScreenBottomPadding(insets.bottom) + pillClearance,
        }}
        showsVerticalScrollIndicator={false}
      >
        {visible.length === 0 ? (
          <View style={s.empty}>
            <MailCheck size={scale(44)} color={theme.textSecondary} />
            <Text style={s.emptyTitle}>
              {query.trim() ? 'No matches' : 'Nothing here'}
            </Text>
            <Text style={s.emptyText}>
              {query.trim()
                ? 'Try a sender, an address or a word from the subject.'
                : 'Payslips, statements and invoices arrive as the weeks pass.'}
            </Text>
          </View>
        ) : (
          visible.map((m) => (
            <MailRow
              key={m.id}
              message={m}
              darkMode={darkMode}
              onPress={() => openMessage(m.id)}
              onToggleStar={() => toggleMailStar(setGameState, m.id)}
            />
          ))
        )}
      </ScrollView>

      {/* Folder drawer */}
      <Modal
        visible={drawerOpen}
        transparent
        animationType="fade"
        onRequestClose={() => setDrawerOpen(false)}
      >
        <TouchableOpacity
          style={s.scrim}
          activeOpacity={1}
          onPress={() => setDrawerOpen(false)}
          accessibilityRole="button"
          accessibilityLabel="Close folders"
        >
          <TouchableOpacity activeOpacity={1} style={[s.drawer, { paddingTop: insets.top + scale(12) }]}>
            <Text style={s.drawerTitle}>DeepMail</Text>
            <Text style={s.drawerAddress}>{state.address ?? 'me@deepmail.com'}</Text>

            {FOLDERS.map(({ key, label, Icon }) => {
              const active = key === folder;
              const count = key === 'inbox' ? unreadInbox : 0;
              return (
                <TouchableOpacity
                  key={key}
                  style={[s.drawerRow, active && s.drawerRowActive]}
                  onPress={() => {
                    setFolder(key);
                    setQuery('');
                    setDrawerOpen(false);
                  }}
                  accessibilityRole="button"
                  accessibilityLabel={label}
                >
                  <Icon size={scale(18)} color={active ? '#1A73E8' : theme.text} />
                  <Text style={[s.drawerRowText, active && s.drawerRowTextActive]}>{label}</Text>
                  {count > 0 ? <Text style={s.drawerCount}>{count}</Text> : null}
                </TouchableOpacity>
              );
            })}

            <TouchableOpacity
              style={s.drawerRow}
              onPress={() => {
                markFolderRead(setGameState, 'inbox');
                setDrawerOpen(false);
              }}
              accessibilityRole="button"
              accessibilityLabel="Mark inbox read"
            >
              <MailCheck size={scale(18)} color={theme.text} />
              <Text style={s.drawerRowText}>Mark inbox read</Text>
            </TouchableOpacity>

            {/* Exposure panel. The player should always be able to find out why
                they are getting targeted — a hidden risk multiplier reads as
                the game being unfair rather than the game responding. */}
            <View style={s.riskCard}>
              <View style={s.riskHead}>
                <ShieldQuestion size={scale(16)} color={theme.text} />
                <Text style={s.riskTitle}>Fraud exposure</Text>
                <Text style={s.riskValue}>{Math.round(risk.chance * 100)}%</Text>
              </View>
              {risk.reasons.map((r) => (
                <Text key={r} style={s.riskReason}>
                  • {r}
                </Text>
              ))}
            </View>
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>
    </View>
  );
}

const makeStyles = (theme: ReturnType<typeof getThemeColors>, darkMode: boolean) =>
  StyleSheet.create({
    container: { flex: 1, backgroundColor: darkMode ? '#0F141A' : '#FFFFFF' },
    banner: {
      paddingHorizontal: responsiveSpacing.md,
      paddingVertical: responsiveSpacing.sm,
      backgroundColor: darkMode ? '#202B37' : '#E8F0FE',
    },
    bannerText: { fontSize: fontScale(12.5), color: theme.text, fontWeight: '600' },
    searchWrap: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: responsiveSpacing.xs,
      paddingHorizontal: responsiveSpacing.sm,
      paddingVertical: responsiveSpacing.sm,
    },
    iconBtn: {
      minWidth: touchTargets.minimum,
      minHeight: touchTargets.minimum,
      alignItems: 'center',
      justifyContent: 'center',
    },
    searchField: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      gap: responsiveSpacing.xs,
      paddingHorizontal: responsiveSpacing.sm,
      height: scale(42),
      borderRadius: responsiveBorderRadius.full,
      backgroundColor: darkMode ? '#1C2530' : '#F1F3F4',
    },
    searchInput: { flex: 1, fontSize: fontScale(13), color: theme.text, padding: 0 },
    tabs: {
      flexDirection: 'row',
      paddingHorizontal: responsiveSpacing.sm,
      gap: responsiveSpacing.xs,
      // Structural divider under the tab strip — allowed by Hard Rule #7.
      borderBottomWidth: 1,
      borderBottomColor: darkMode ? 'rgba(255,255,255,0.07)' : 'rgba(0,0,0,0.07)',
    },
    tab: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: scale(4),
      paddingVertical: responsiveSpacing.sm,
      paddingHorizontal: responsiveSpacing.sm,
      // Active-tab underline — the other structural exception in Hard Rule #7.
      borderBottomWidth: 2,
      borderBottomColor: 'transparent',
    },
    tabActive: { borderBottomColor: '#1A73E8' },
    tabText: { fontSize: fontScale(12.5), color: theme.textSecondary, fontWeight: '600' },
    tabTextActive: { color: darkMode ? '#8AB4F8' : '#1A73E8' },
    tabDot: {
      minWidth: scale(16),
      height: scale(16),
      borderRadius: scale(8),
      paddingHorizontal: scale(4),
      backgroundColor: '#1A73E8',
      alignItems: 'center',
      justifyContent: 'center',
    },
    tabDotText: { color: '#FFFFFF', fontSize: fontScale(9.5), fontWeight: '700' },
    folderHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: responsiveSpacing.md,
      paddingBottom: responsiveSpacing.sm,
    },
    folderHeaderText: { fontSize: fontScale(15), fontWeight: '700', color: theme.text },
    folderAction: {
      fontSize: fontScale(12.5),
      fontWeight: '700',
      color: darkMode ? '#8AB4F8' : '#1A73E8',
    },
    empty: {
      alignItems: 'center',
      gap: responsiveSpacing.xs,
      paddingHorizontal: responsiveSpacing.xl,
      paddingTop: scale(80),
    },
    emptyTitle: { fontSize: fontScale(15), fontWeight: '700', color: theme.text },
    emptyText: {
      fontSize: fontScale(12.5),
      color: theme.textSecondary,
      textAlign: 'center',
      lineHeight: fontScale(18),
    },
    scrim: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', flexDirection: 'row' },
    drawer: {
      width: '78%',
      maxWidth: scale(320),
      backgroundColor: darkMode ? '#151B23' : '#FFFFFF',
      paddingHorizontal: responsiveSpacing.md,
      paddingBottom: responsiveSpacing.md,
      borderTopRightRadius: responsiveBorderRadius.lg,
      borderBottomRightRadius: responsiveBorderRadius.lg,
    },
    drawerTitle: { fontSize: fontScale(18), fontWeight: '800', color: theme.text },
    drawerAddress: {
      fontSize: fontScale(11.5),
      color: theme.textSecondary,
      marginBottom: responsiveSpacing.md,
    },
    drawerRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: responsiveSpacing.sm,
      minHeight: touchTargets.minimum,
      paddingHorizontal: responsiveSpacing.sm,
      borderRadius: responsiveBorderRadius.full,
    },
    drawerRowActive: { backgroundColor: darkMode ? 'rgba(138,180,248,0.14)' : '#E8F0FE' },
    drawerRowText: { flex: 1, fontSize: fontScale(13.5), color: theme.text },
    drawerRowTextActive: { color: darkMode ? '#8AB4F8' : '#1A73E8', fontWeight: '700' },
    drawerCount: { fontSize: fontScale(12), fontWeight: '700', color: theme.textSecondary },
    riskCard: {
      marginTop: responsiveSpacing.md,
      padding: responsiveSpacing.sm,
      borderRadius: responsiveBorderRadius.md,
      borderWidth: 1,
      borderColor: darkMode ? '#2A3441' : '#DADCE0',
      gap: scale(3),
    },
    riskHead: { flexDirection: 'row', alignItems: 'center', gap: scale(6) },
    riskTitle: { flex: 1, fontSize: fontScale(12.5), fontWeight: '700', color: theme.text },
    riskValue: { fontSize: fontScale(13), fontWeight: '800', color: theme.text },
    riskReason: {
      fontSize: fontScale(11),
      lineHeight: fontScale(16),
      color: theme.textSecondary,
    },
  });

export default function MailApp({ onBack }: Props) {
  return (
    <ErrorBoundary>
      <MailAppInner onBack={onBack} />
    </ErrorBoundary>
  );
}
