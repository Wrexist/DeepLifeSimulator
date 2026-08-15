/**
 * DeepMail — the game's paper trail, and the one channel the player has to judge.
 *
 * ## Shape
 *
 * Gmail's, because players already know it and none of it is arbitrary: a
 * search pill instead of a title bar, a filter chip strip under it, category
 * tabs that separate money from marketing from people, a dense list where
 * weight carries unread, and a folder drawer behind the hamburger. Copying a
 * layout this well-worn means the player spends their attention on the
 * CONTENT — which is the part that can cost them money — instead of on
 * learning a mail client.
 *
 * ## Navigation, and what it costs to get it wrong
 *
 * The chip strip is Gmail's own current design and it earns its place here for
 * a reason a mail client does not have: this inbox contains decisions that
 * EXPIRE. Everything else in the app can be found by scrolling; a summons that
 * settles itself in two weeks has to be findable on purpose. So "Needs reply"
 * is a chip, its badge counts across every folder, and the row carries the
 * deadline. A chip is also a question you can answer by looking — unlike a
 * search operator, which you have to know exists before you can discover it.
 *
 * The current folder is the FIRST chip whenever it is not the Inbox, and it is
 * dismissable. Location is then always visible, and getting back is one tap
 * rather than a hamburger-tap-close round trip.
 *
 * ## What is not decoration
 *
 * - The unverified-sender warning shows on every unverified message, not only
 *   the fraudulent ones. A warning that fires exactly on scams is the answer,
 *   not a warning. The Unverified CHIP is the same idea promoted to a filter:
 *   never "here are the scams", only "here is who nobody vouched for".
 * - Search spans folders. This screen's stated reason for having search is that
 *   "did my bank really write from that address?" should be answerable inside
 *   it — and a folder-scoped search told a player who had archived the message
 *   "No matches", which does not fail to answer that, it answers it wrongly.
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
  Mail as MailIcon,
  Clock,
  Paperclip,
  ShieldOff,
} from 'lucide-react-native';
import type { MailFolder, MailMessage } from '@/contexts/game/types';
import ErrorBoundary from '@/components/ErrorBoundary';
import { shallowEqual, useGameSelector, useSetGameState, useGameStateGetter } from '@/contexts/game/useGameSelector';
import { useGameActions } from '@/contexts/GameContext';
import { getThemeColors } from '@/lib/config/theme';
import {
  deriveAddress,
  findMessage,
  getMailState,
  messagesInFolder,
  unreadByCategory,
} from '@/lib/mail/state';
import {
  FILTER_EMPTY_TEXT,
  FILTER_LABELS,
  MAIL_FILTERS,
  filterCounts,
  folderCounts,
  matchesFilter,
  pendingDecisions,
  searchMessages,
  type MailFilter,
} from '@/lib/mail/filters';
import { scamLossSummary, scamRisk } from '@/lib/mail/scam';
import { protections } from '@/lib/mail/security';
import { modalEventCount } from '@/lib/events/routing';
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

const FILTER_ICONS: Record<MailFilter, typeof Inbox> = {
  unread: MailIcon,
  decisions: Clock,
  documents: Paperclip,
  unverified: ShieldOff,
};

interface Props {
  onBack: () => void;
}

function MailAppInner({ onBack }: Props) {
  const insets = useSafeAreaInsets();
  const setGameState = useSetGameState();
  // Non-subscribing accessor: the decision resolvers need the whole state to
  // compute their outcome copy, and subscribing this screen to all of it is the
  // perf regression CLAUDE.md 4.1 documents.
  const getGameState = useGameStateGetter();
  // The one resolver. Mail delegates event-backed choices to it rather than
  // reimplementing effect application — see `MailResolver`.
  const { resolveEvent } = useGameActions();

  // Narrow subscription: the mail slice and the two booleans that style it.
  const mail = useGameSelector((s) => s?.mail);
  // Narrow: `scamLossFor` scales the loss off cash on hand.
  const money = useGameSelector((s) => s?.stats?.money ?? 0);
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
  // `modalEventCount`, not `pendingEvents.length` — the pill stopped counting
  // mail-routed letters when routing landed, so reserving space for it on the
  // raw count would leave a dead strip whenever the only pending event was a
  // letter the player is already reading.
  const decisionPending = useGameSelector((s) => modalEventCount(s) > 0);
  const currentWeek = useGameSelector((s) => s?.weeksLived ?? 0);
  // The From line. Derived from the CHARACTER, so it follows a prestige into
  // the next life instead of carrying the previous one's name. Selected as a
  // string rather than by passing `userProfile` through `getMailState`, which
  // would re-render this screen on every profile field that changes.
  const address = useGameSelector((st) => deriveAddress(st));
  const pillClearance = decisionPending ? scale(110) : 0;

  const theme = getThemeColors(darkMode);
  const s = useMemo(() => makeStyles(theme, darkMode), [theme, darkMode]);

  const [folder, setFolder] = useState<View_>('inbox');
  const [category, setCategory] = useState<(typeof CATEGORIES)[number]['key']>('primary');
  const [filter, setFilter] = useState<MailFilter | null>(null);
  const [query, setQuery] = useState('');
  const [openId, setOpenId] = useState<string | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [banner, setBanner] = useState<string | null>(null);

  // `getMailState` is the safe read layer — a partial or absent slice degrades
  // to an empty inbox rather than throwing.
  const state = useMemo(() => getMailState({ mail } as never), [mail]);
  const counts = useMemo(() => folderCounts({ mail } as never), [mail]);
  const catUnread = useMemo(() => unreadByCategory({ mail } as never), [mail]);
  // Counted across EVERY folder, unlike the chip badges. Archiving a summons
  // does not stop it lapsing, so a badge that only looked in the Inbox would
  // under-report the one thing here with a consequence attached.
  const waiting = useMemo(() => pendingDecisions({ mail } as never).length, [mail]);
  const risk = useMemo(() => scamRisk(riskState as never, currentWeek), [riskState, currentWeek]);
  // What is holding the risk DOWN. Shown next to what pushed it up, because a
  // player who paid to rotate their credentials should be able to see it
  // working — otherwise the purchase is an act of faith.
  const defences = useMemo(
    () => protections({ mail } as never, currentWeek),
    [mail, currentWeek]
  );

  const searching = query.trim().length > 0;

  /**
   * The messages the list shows.
   *
   * Two modes, kept apart deliberately. SEARCHING spans folders — see the
   * header note; intersecting it with the current folder and the category tab
   * would silently exclude most of the mailbox from a query the player typed
   * expecting it to look everywhere. BROWSING is folder-scoped, then narrowed
   * by the chip, then (in the Inbox only) by the category tab.
   */
  const visible = useMemo(() => {
    if (searching) {
      const found = searchMessages({ mail } as never, query);
      return filter ? found.filter((m) => matchesFilter(m, filter)) : found;
    }
    // `messagesInFolder` owns the folder rule (including that Starred is a VIEW
    // across folders, not a folder). It existed and this screen re-implemented
    // it inline, which is how the two would have disagreed the first time
    // either changed — and how the helper ended up looking like dead code.
    return messagesInFolder({ mail } as never, folder).filter((m) => {
      if (filter && !matchesFilter(m, filter)) return false;
      // Category tabs are an INBOX affordance. Applying them to Archive or
      // Spam would hide messages inside a folder the player opened precisely
      // to find one specific thing — and applying them under an active chip
      // would silently intersect two filters the player set one of.
      if (folder === 'inbox' && !filter && (m.category ?? 'primary') !== category) {
        return false;
      }
      return true;
    });
  }, [mail, folder, category, filter, query, searching]);

  /** Chip badges, counted over what the player is actually looking at. */
  const chipCounts = useMemo(
    () =>
      filterCounts(
        searching ? searchMessages({ mail } as never, query) : messagesInFolder({ mail } as never, folder)
      ),
    [mail, folder, query, searching]
  );

  /**
   * Which chips are worth showing.
   *
   * A chip that leads to "Nothing here" is a dead end the player had to tap to
   * discover. The active one always stays, or clearing it would mean finding a
   * control that just vanished.
   */
  const chips = useMemo(
    () => MAIL_FILTERS.filter((f) => chipCounts[f] > 0 || f === filter),
    [chipCounts, filter]
  );

  const open: MailMessage | null = useMemo(
    () => (openId ? findMessage({ mail } as never, openId) : null),
    [openId, mail]
  );

  /** Earlier messages in the open message's thread, oldest first. */
  const thread = useMemo(() => {
    if (!open?.threadId) return [];
    return state.messages
      .filter((m) => m.threadId === open.threadId && m.id !== open.id)
      .sort((a, b) => (a.atWeek ?? 0) - (b.atWeek ?? 0));
  }, [open, state.messages]);

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
    // `scamLossSummary` owns this copy. It was exported, unused, and duplicated
    // verbatim here — two sources for one sentence.
    actOnScamMail({ mail, money }, setGameState, open.id, ({ lost }) => setBanner(scamLossSummary(lost)));
  }, [open, mail, money, setGameState]);

  const handleDispute = useCallback(() => {
    if (!open) return;
    disputeMailCharge({ mail, money }, setGameState, open.id, ({ recovered, refused }) => {
      setBanner(refused ?? `The bank recovered ${docMoney(recovered)} of the loss.`);
    });
  }, [open, mail, money, setGameState]);

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
      chooseMailDecision(getGameState(), setGameState, open.id, choiceId, ({ outcome, delegateToEvent }) => {
        if (delegateToEvent) {
          resolveEvent(delegateToEvent.eventId, delegateToEvent.choiceId);
        }
        if (outcome) setBanner(outcome);
      });
    },
    [open, getGameState, setGameState, resolveEvent]
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
          thread={thread}
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
            placeholder="Search all mail"
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

      {/* Filter chips. The location chip comes first whenever the player is
          not in the Inbox, so where they are is always on screen and getting
          back costs one tap instead of a drawer round trip. */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        // `style`, not just `contentContainerStyle`. A ScrollView inside a flex
        // COLUMN stretches to fill the cross axis, so a horizontal one with no
        // height cap claimed ~380px of vertical space: the chips floated in the
        // middle of the screen and the message list was squashed to the bottom.
        // Nothing in the test suite could see it — the tree was correct, only
        // the pixels were wrong.
        style={s.chipScroll}
        contentContainerStyle={s.chipRow}
        keyboardShouldPersistTaps="handled"
      >
        {folder !== 'inbox' && !searching ? (
          <TouchableOpacity
            style={[s.chip, s.chipLocation]}
            onPress={() => {
              setFolder('inbox');
              setFilter(null);
            }}
            accessibilityRole="button"
            accessibilityLabel={`In ${folderLabel}. Back to inbox`}
          >
            <Text style={[s.chipText, s.chipTextLocation]}>{folderLabel}</Text>
            <X size={scale(12)} color={darkMode ? '#8AB4F8' : '#1A73E8'} />
          </TouchableOpacity>
        ) : null}

        {chips.map((key) => {
          const active = key === filter;
          const Icon = FILTER_ICONS[key];
          const count = chipCounts[key];
          return (
            <TouchableOpacity
              key={key}
              style={[s.chip, active && s.chipActive]}
              onPress={() => setFilter(active ? null : key)}
              accessibilityRole="button"
              accessibilityState={{ selected: active }}
              accessibilityLabel={`${FILTER_LABELS[key]}${count > 0 ? `, ${count}` : ''}`}
            >
              <Icon
                size={scale(12)}
                color={active ? (darkMode ? '#8AB4F8' : '#1A73E8') : theme.textSecondary}
              />
              <Text style={[s.chipText, active && s.chipTextActive]}>
                {FILTER_LABELS[key]}
                {count > 0 ? ` ${count}` : ''}
              </Text>
              {active ? (
                <X size={scale(12)} color={darkMode ? '#8AB4F8' : '#1A73E8'} />
              ) : null}
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      {/* Category tabs — inbox only, hidden while searching or filtering. A
          search that silently excluded three quarters of the mailbox would be
          the most confusing thing in the app, and a chip intersected with a
          tab is the same problem with two controls instead of one. */}
      {folder === 'inbox' && !searching && !filter ? (
        <View style={s.tabs}>
          {CATEGORIES.map((c) => {
            const active = c.key === category;
            return (
              <TouchableOpacity
                key={c.key}
                style={[s.tab, active && s.tabActive]}
                onPress={() => setCategory(c.key)}
                accessibilityRole="button"
                accessibilityState={{ selected: active }}
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
          <Text style={s.folderHeaderText}>
            {searching
              ? `${visible.length} result${visible.length === 1 ? '' : 's'}`
              : folderLabel}
          </Text>
          {/* Scoped to the folder in view. This emptied Spam AND Trash
              together whichever one you were standing in, behind a button
              that just said "Empty". */}
          {(folder === 'spam' || folder === 'trash') && !searching && visible.length > 0 ? (
            <TouchableOpacity
              onPress={() => emptyMailBin(setGameState, folder)}
              accessibilityRole="button"
              accessibilityLabel={`Empty ${folderLabel.toLowerCase()}`}
            >
              <Text style={s.folderAction}>Empty {folderLabel.toLowerCase()}</Text>
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
            {/* Named dead ends. "Nothing here" under an active filter reads as
                an empty mailbox, which sends the player looking for a message
                that is one tap away in the folder behind the chip. */}
            <Text style={s.emptyTitle}>
              {searching
                ? 'No matches'
                : filter
                  ? `No ${FILTER_LABELS[filter].toLowerCase()} mail`
                  : 'Nothing here'}
            </Text>
            <Text style={s.emptyText}>
              {searching
                ? 'Search covers every folder except Trash. Try a sender, an address or a word from the subject.'
                : filter
                  ? FILTER_EMPTY_TEXT[filter]
                  : 'Payslips, statements and invoices arrive as the weeks pass.'}
            </Text>
            {filter ? (
              <TouchableOpacity
                onPress={() => setFilter(null)}
                accessibilityRole="button"
                accessibilityLabel="Clear filter"
              >
                <Text style={s.emptyAction}>Clear filter</Text>
              </TouchableOpacity>
            ) : null}
          </View>
        ) : (
          visible.map((m) => (
            <MailRow
              key={m.id}
              message={m}
              darkMode={darkMode}
              currentWeek={currentWeek}
              // Only on results from somewhere else — labelling every row
              // "Inbox" while standing in the Inbox is noise, and the label
              // exists so a search hit can be found again afterwards.
              folderLabel={
                searching && (m.folder ?? 'inbox') !== 'inbox'
                  ? FOLDERS.find((f) => f.key === m.folder)?.label
                  : undefined
              }
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
            <Text style={s.drawerAddress}>{address}</Text>

            {/* One tap to everything that is waiting on an answer, from
                anywhere. This is the only queue in the app that expires, and
                until now the drawer said nothing about it at all. */}
            {waiting > 0 ? (
              <TouchableOpacity
                style={[s.drawerRow, s.drawerRowWaiting]}
                onPress={() => {
                  setFolder('inbox');
                  setFilter('decisions');
                  setQuery('');
                  setDrawerOpen(false);
                }}
                accessibilityRole="button"
                accessibilityLabel={`${waiting} waiting on a reply`}
              >
                <Clock size={scale(18)} color={darkMode ? '#FDD663' : '#B06000'} />
                <Text style={[s.drawerRowText, s.drawerRowTextWaiting]}>
                  Waiting on a reply
                </Text>
                <Text style={[s.drawerCount, s.drawerRowTextWaiting]}>{waiting}</Text>
              </TouchableOpacity>
            ) : null}

            {/* Every folder carries its count. Showing one for the Inbox alone
                made Spam and Archive read as permanently empty. */}
            {FOLDERS.map(({ key, label, Icon }) => {
              const active = key === folder;
              const count = counts[key];
              return (
                <TouchableOpacity
                  key={key}
                  style={[s.drawerRow, active && s.drawerRowActive]}
                  onPress={() => {
                    setFolder(key);
                    setFilter(null);
                    setQuery('');
                    setDrawerOpen(false);
                  }}
                  accessibilityRole="button"
                  accessibilityState={{ selected: active }}
                  accessibilityLabel={
                    count > 0
                      ? `${label}, ${count}${key === 'inbox' ? ' unread' : ''}`
                      : label
                  }
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
              {defences.map((d) => (
                <Text key={d} style={s.riskDefence}>
                  ✓ {d}
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
    // Height-capped so the strip occupies exactly its own row. See the note at
    // the ScrollView: without this it stretches down the cross axis.
    chipScroll: { flexGrow: 0, flexShrink: 0 },
    chipRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: responsiveSpacing.xs,
      paddingHorizontal: responsiveSpacing.sm,
      paddingBottom: responsiveSpacing.sm,
    },
    // Full border on all four sides. Hard Rule #7 bans a one-sided coloured
    // stripe; a pill outlined the whole way round is the sanctioned form, and
    // RN will not curl it against the radius.
    chip: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: scale(5),
      paddingHorizontal: responsiveSpacing.sm,
      height: scale(30),
      borderRadius: responsiveBorderRadius.full,
      borderWidth: 1,
      borderColor: darkMode ? '#2A3441' : '#DADCE0',
    },
    chipActive: {
      borderColor: darkMode ? '#4A6E9E' : '#1A73E8',
      backgroundColor: darkMode ? 'rgba(138,180,248,0.14)' : '#E8F0FE',
    },
    chipLocation: {
      borderColor: darkMode ? '#4A6E9E' : '#1A73E8',
      backgroundColor: darkMode ? 'rgba(138,180,248,0.14)' : '#E8F0FE',
    },
    chipText: { fontSize: fontScale(12), fontWeight: '600', color: theme.textSecondary },
    chipTextActive: { color: darkMode ? '#8AB4F8' : '#1A73E8' },
    chipTextLocation: { color: darkMode ? '#8AB4F8' : '#1A73E8', fontWeight: '700' },
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
    emptyAction: {
      marginTop: responsiveSpacing.sm,
      fontSize: fontScale(13),
      fontWeight: '700',
      color: darkMode ? '#8AB4F8' : '#1A73E8',
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
    drawerRowWaiting: {
      backgroundColor: darkMode ? 'rgba(249,171,0,0.13)' : '#FEF7E0',
      marginBottom: scale(4),
    },
    drawerRowText: { flex: 1, fontSize: fontScale(13.5), color: theme.text },
    drawerRowTextActive: { color: darkMode ? '#8AB4F8' : '#1A73E8', fontWeight: '700' },
    drawerRowTextWaiting: { color: darkMode ? '#FDD663' : '#B06000', fontWeight: '700' },
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
    riskDefence: {
      fontSize: fontScale(11),
      lineHeight: fontScale(16),
      color: darkMode ? '#81C995' : '#188038',
    },
  });

export default function MailApp({ onBack }: Props) {
  return (
    <ErrorBoundary>
      <MailAppInner onBack={onBack} />
    </ErrorBoundary>
  );
}
