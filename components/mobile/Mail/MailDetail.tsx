/**
 * One open message.
 *
 * The layout follows Gmail's: subject first, then a sender block with an avatar
 * and the full address, then the body, then anything attached.
 *
 * Two things are deliberate and specific to this game:
 *
 * **The address is always shown in full**, never collapsed behind the display
 * name. A lookalike domain is the primary tell, and hiding it one tap deeper
 * would make the mechanic a trivia question rather than an observation.
 *
 * **The tells are revealed after resolution either way** — whether the player
 * fell for it or reported it. Showing them only on a loss would make the
 * feature feel like a punishment with a lecture attached; showing them on a
 * correct call is what tells a careful player their care was real.
 */

import React from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import {
  ArrowLeft,
  Archive,
  BadgeCheck,
  Star,
  Trash2,
  ShieldAlert,
  ShieldCheck,
  TriangleAlert,
} from 'lucide-react-native';
import type { MailMessage } from '@/contexts/game/types';
import { getThemeColors } from '@/lib/config/theme';
import { senderColor, senderInitial } from '@/lib/mail/senders';
import { docDate, docMoney } from '@/lib/mail/format';
import MailDocument from './MailDocument';
import {
  fontScale,
  responsiveSpacing,
  scale,
  responsiveBorderRadius,
  touchTargets,
  getAppScreenBottomPadding,
} from '@/utils/scaling';

interface Props {
  message: MailMessage;
  darkMode: boolean;
  bottomInset: number;
  /**
   * Extra bottom clearance for the tab layout's floating "N decisions waiting"
   * pill, which is rendered by `(tabs)/_layout.tsx` at `bottom: scale(88)` and
   * is NOT hidden while a sub-app is open. `getAppScreenBottomPadding` reserves
   * only the home indicator — deliberately, so sticky composers can sit against
   * it — so nothing in the shared helper accounts for the pill, and it landed
   * directly on top of this screen's dispute button.
   *
   * Passed in rather than assumed so the space is only reserved when a decision
   * is actually pending; otherwise every message would end in a blank strip.
   */
  pillClearance: number;
  onBack: () => void;
  onToggleStar: () => void;
  onArchive: () => void;
  onDelete: () => void;
  onReport: () => void;
  onAct: () => void;
  onDispute: () => void;
  /** Take one of the decision's choices. */
  onChoose: (choiceId: string) => void;
  /** Current absolute week, for the countdown on an open decision. */
  currentWeek: number;
}

function MailDetail({
  message,
  darkMode,
  bottomInset,
  pillClearance,
  onBack,
  onToggleStar,
  onArchive,
  onDelete,
  onReport,
  onAct,
  onDispute,
  onChoose,
  currentWeek,
}: Props) {
  const theme = getThemeColors(darkMode);
  const s = makeStyles(theme, darkMode);

  const resolved = !!message.actionTaken;
  const lost = message.lostAmount ?? 0;

  return (
    <View style={s.container}>
      <View style={s.toolbar}>
        <TouchableOpacity
          onPress={onBack}
          style={s.toolBtn}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          accessibilityRole="button"
          accessibilityLabel="Back to inbox"
        >
          <ArrowLeft size={scale(21)} color={theme.text} />
        </TouchableOpacity>
        <View style={s.toolSpacer} />
        <TouchableOpacity
          onPress={onArchive}
          style={s.toolBtn}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          accessibilityRole="button"
          accessibilityLabel="Archive"
        >
          <Archive size={scale(19)} color={theme.text} />
        </TouchableOpacity>
        <TouchableOpacity
          onPress={onDelete}
          style={s.toolBtn}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          accessibilityRole="button"
          accessibilityLabel="Delete"
        >
          <Trash2 size={scale(19)} color={theme.text} />
        </TouchableOpacity>
        <TouchableOpacity
          onPress={onToggleStar}
          style={s.toolBtn}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          accessibilityRole="button"
          accessibilityLabel={message.starred ? 'Remove star' : 'Add star'}
        >
          <Star
            size={scale(19)}
            color={message.starred ? '#F9AB00' : theme.text}
            fill={message.starred ? '#F9AB00' : 'transparent'}
          />
        </TouchableOpacity>
      </View>

      <ScrollView
        contentContainerStyle={[
          s.scroll,
          { paddingBottom: getAppScreenBottomPadding(bottomInset) + pillClearance },
        ]}
        showsVerticalScrollIndicator={false}
      >
        <Text style={s.subject}>{message.subject}</Text>

        <View style={s.senderRow}>
          <View style={[s.avatar, { backgroundColor: senderColor(message.senderEmail) }]}>
            <Text style={s.avatarText}>{senderInitial(message.senderName)}</Text>
          </View>
          <View style={s.senderBody}>
            <View style={s.senderLine}>
              <Text style={s.senderName} numberOfLines={1}>
                {message.senderName}
              </Text>
              {message.verified ? (
                <BadgeCheck size={scale(14)} color={darkMode ? '#8AB4F8' : '#1A73E8'} />
              ) : null}
            </View>
            <Text style={s.senderEmail} numberOfLines={1}>
              {message.senderEmail}
            </Text>
            <Text style={s.date}>{docDate(message.atWeek)}</Text>
          </View>
        </View>

        {/* An unverified sender gets a standing, neutral note — on EVERY
            unverified message, not only the fraudulent ones. A warning that
            appears exactly when something is a scam is not a warning, it is
            the answer. */}
        {!message.verified ? (
          <View style={s.unverified}>
            <ShieldAlert size={scale(15)} color={darkMode ? '#FDD663' : '#B06000'} />
            <Text style={s.unverifiedText}>
              This sender is not verified. Check the address against mail you know is genuine.
            </Text>
          </View>
        ) : null}

        <Text style={s.body}>{message.body}</Text>

        {message.attachment ? (
          <MailDocument attachment={message.attachment} darkMode={darkMode} />
        ) : null}

        {/* The scam's call to action, before resolution. */}
        {message.action && !resolved ? (
          <View style={s.actions}>
            <TouchableOpacity
              style={[s.actionBtn, message.action.kind === 'danger' ? s.dangerBtn : s.safeBtn]}
              onPress={onAct}
              accessibilityRole="button"
              accessibilityLabel={message.action.label}
            >
              <Text style={s.actionBtnText}>{message.action.label}</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[s.actionBtn, s.reportBtn]}
              onPress={onReport}
              accessibilityRole="button"
              accessibilityLabel="Report phishing"
            >
              <ShieldCheck size={scale(15)} color={darkMode ? '#81C995' : '#188038'} />
              <Text style={s.reportBtnText}>Report phishing</Text>
            </TouchableOpacity>
          </View>
        ) : null}

        {/* Reporting stays available on ordinary mail too — a mechanic that only
            offers the button on the scam has already given the game away. */}
        {!message.action && message.folder !== 'spam' ? (
          <TouchableOpacity
            style={[s.actionBtn, s.reportBtn, s.reportAlone]}
            onPress={onReport}
            accessibilityRole="button"
            accessibilityLabel="Report phishing"
          >
            <ShieldCheck size={scale(15)} color={darkMode ? '#81C995' : '#188038'} />
            <Text style={s.reportBtnText}>Report phishing</Text>
          </TouchableOpacity>
        ) : null}

        {/* A decision with a deadline — the thing mail can do that no other
            surface in this game can. Every other decision channel covers the
            screen and demands an answer; this one waits. */}
        {message.decision && !message.decision.chosenId ? (
          <View style={s.decision}>
            <Text style={s.deadline}>
              {(() => {
                const left = message.decision.expiresAtWeek - currentWeek;
                if (left <= 0) return 'Answer due this week';
                return `${left} week${left === 1 ? '' : 's'} to reply`;
              })()}
            </Text>
            {message.decision.choices.map((choice) => (
              <TouchableOpacity
                key={choice.id}
                style={[
                  s.choiceBtn,
                  choice.kind === 'primary' && s.choicePrimary,
                ]}
                onPress={() => onChoose(choice.id)}
                accessibilityRole="button"
                accessibilityLabel={choice.label}
              >
                <Text
                  style={[
                    s.choiceLabel,
                    choice.kind === 'primary' && s.choiceLabelPrimary,
                  ]}
                >
                  {choice.label}
                </Text>
                {choice.detail ? (
                  <Text
                    style={[
                      s.choiceDetail,
                      choice.kind === 'primary' && s.choiceDetailPrimary,
                    ]}
                  >
                    {choice.detail}
                  </Text>
                ) : null}
              </TouchableOpacity>
            ))}
            {/* Naming the default is the whole point of a deadline. A silent
                lapse would be a trap; a stated one is a choice to make later. */}
            <Text style={s.lapseNote}>
              If you do not reply:{' '}
              {message.decision.choices.find((c) => c.id === message.decision!.lapseChoiceId)
                ?.label ?? 'nothing happens'}
              .
            </Text>
          </View>
        ) : null}

        {message.decision?.chosenId ? (
          <View style={s.outcome}>
            <View style={s.outcomeHead}>
              <ShieldCheck size={scale(16)} color={darkMode ? '#81C995' : '#188038'} />
              <Text style={s.outcomeTitle}>
                {message.decision.resolvedAs === 'lapsed' ? 'Expired' : 'Answered'}
              </Text>
            </View>
            <Text style={s.tellText}>{message.decision.outcome}</Text>
          </View>
        ) : null}

        {/* Outcome + the tells, once resolved either way. */}
        {resolved && message.scam ? (
          <View style={s.outcome}>
            <View style={s.outcomeHead}>
              {message.actionTaken === 'accepted' ? (
                <TriangleAlert size={scale(16)} color={darkMode ? '#F28B82' : '#C5221F'} />
              ) : (
                <ShieldCheck size={scale(16)} color={darkMode ? '#81C995' : '#188038'} />
              )}
              <Text style={s.outcomeTitle}>
                {message.actionTaken === 'accepted'
                  ? lost > 0
                    ? `This was a scam. ${docMoney(lost)} was taken.`
                    : 'This was a scam. There was nothing to take.'
                  : 'Correct — this was a scam. Nothing was taken.'}
              </Text>
            </View>

            <Text style={s.tellsHead}>What gave it away</Text>
            {message.scam.tells.map((tell) => (
              <View key={tell} style={s.tellRow}>
                <Text style={s.tellBullet}>•</Text>
                <Text style={s.tellText}>{tell}</Text>
              </View>
            ))}

            {message.actionTaken === 'accepted' && lost > 0 && !message.disputed ? (
              <TouchableOpacity
                style={[s.actionBtn, s.disputeBtn]}
                onPress={onDispute}
                accessibilityRole="button"
                accessibilityLabel="Dispute the charge with your bank"
              >
                <Text style={s.disputeBtnText}>Dispute the charge with your bank</Text>
              </TouchableOpacity>
            ) : null}

            {message.disputed ? (
              <Text style={s.disputedNote}>
                Disputed. The bank recovered part of the loss — a dispute can only be
                filed once per charge.
              </Text>
            ) : null}
          </View>
        ) : null}
      </ScrollView>
    </View>
  );
}

const makeStyles = (theme: ReturnType<typeof getThemeColors>, darkMode: boolean) =>
  StyleSheet.create({
    container: { flex: 1, backgroundColor: darkMode ? '#0F141A' : '#FFFFFF' },
    toolbar: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: responsiveSpacing.sm,
      paddingVertical: responsiveSpacing.sm,
      gap: responsiveSpacing.xs,
    },
    toolBtn: {
      minWidth: touchTargets.minimum,
      minHeight: touchTargets.minimum,
      alignItems: 'center',
      justifyContent: 'center',
    },
    toolSpacer: { flex: 1 },
    scroll: { paddingHorizontal: responsiveSpacing.md },
    subject: {
      fontSize: fontScale(20),
      fontWeight: '600',
      color: theme.text,
      marginBottom: responsiveSpacing.md,
    },
    senderRow: { flexDirection: 'row', gap: responsiveSpacing.sm, alignItems: 'center' },
    avatar: {
      width: scale(40),
      height: scale(40),
      borderRadius: scale(20),
      alignItems: 'center',
      justifyContent: 'center',
    },
    avatarText: { color: '#FFFFFF', fontSize: fontScale(17), fontWeight: '600' },
    senderBody: { flex: 1 },
    senderLine: { flexDirection: 'row', alignItems: 'center', gap: scale(5) },
    senderName: { fontSize: fontScale(14), fontWeight: '700', color: theme.text },
    senderEmail: { fontSize: fontScale(11.5), color: theme.textSecondary },
    date: { fontSize: fontScale(11), color: theme.textSecondary, marginTop: scale(1) },
    unverified: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      gap: responsiveSpacing.xs,
      marginTop: responsiveSpacing.md,
      padding: responsiveSpacing.sm,
      borderRadius: responsiveBorderRadius.sm,
      borderWidth: 1,
      borderColor: darkMode ? 'rgba(253,214,99,0.35)' : 'rgba(176,96,0,0.3)',
      backgroundColor: darkMode ? 'rgba(253,214,99,0.08)' : 'rgba(176,96,0,0.06)',
    },
    unverifiedText: {
      flex: 1,
      fontSize: fontScale(11.5),
      lineHeight: fontScale(16),
      color: darkMode ? '#FDD663' : '#B06000',
    },
    body: {
      marginTop: responsiveSpacing.md,
      fontSize: fontScale(13.5),
      lineHeight: fontScale(21),
      color: theme.text,
    },
    actions: { marginTop: responsiveSpacing.md, gap: responsiveSpacing.sm },
    actionBtn: {
      minHeight: touchTargets.minimum,
      borderRadius: responsiveBorderRadius.full,
      alignItems: 'center',
      justifyContent: 'center',
      flexDirection: 'row',
      gap: scale(6),
      paddingHorizontal: responsiveSpacing.md,
    },
    dangerBtn: { backgroundColor: '#1A73E8' },
    safeBtn: { backgroundColor: '#1A73E8' },
    actionBtnText: { color: '#FFFFFF', fontSize: fontScale(14), fontWeight: '700' },
    reportBtn: {
      borderWidth: 1,
      borderColor: darkMode ? 'rgba(129,201,149,0.4)' : 'rgba(24,128,56,0.35)',
      backgroundColor: 'transparent',
    },
    reportAlone: { marginTop: responsiveSpacing.md },
    reportBtnText: {
      color: darkMode ? '#81C995' : '#188038',
      fontSize: fontScale(13),
      fontWeight: '600',
    },
    decision: {
      marginTop: responsiveSpacing.md,
      gap: responsiveSpacing.sm,
    },
    deadline: {
      fontSize: fontScale(11),
      letterSpacing: 0.8,
      fontWeight: '700',
      color: darkMode ? '#FDD663' : '#B06000',
    },
    choiceBtn: {
      minHeight: touchTargets.minimum,
      justifyContent: 'center',
      paddingHorizontal: responsiveSpacing.md,
      paddingVertical: responsiveSpacing.sm,
      borderRadius: responsiveBorderRadius.md,
      borderWidth: 1,
      borderColor: darkMode ? '#2A3441' : '#DADCE0',
    },
    choicePrimary: { backgroundColor: '#1A73E8', borderColor: '#1A73E8' },
    choiceLabel: { fontSize: fontScale(13.5), fontWeight: '700', color: theme.text },
    choiceLabelPrimary: { color: '#FFFFFF' },
    choiceDetail: {
      marginTop: scale(2),
      fontSize: fontScale(11.5),
      lineHeight: fontScale(16),
      color: theme.textSecondary,
    },
    choiceDetailPrimary: { color: 'rgba(255,255,255,0.85)' },
    lapseNote: {
      fontSize: fontScale(11),
      lineHeight: fontScale(16),
      color: theme.textSecondary,
      fontStyle: 'italic',
    },
    outcome: {
      marginTop: responsiveSpacing.md,
      padding: responsiveSpacing.md,
      borderRadius: responsiveBorderRadius.md,
      borderWidth: 1,
      borderColor: darkMode ? '#2A3441' : '#DADCE0',
      backgroundColor: darkMode ? '#151B23' : '#F8F9FA',
      gap: responsiveSpacing.xs,
    },
    outcomeHead: { flexDirection: 'row', alignItems: 'center', gap: scale(6) },
    outcomeTitle: { flex: 1, fontSize: fontScale(13.5), fontWeight: '700', color: theme.text },
    tellsHead: {
      marginTop: responsiveSpacing.sm,
      fontSize: fontScale(11),
      letterSpacing: 0.8,
      fontWeight: '700',
      color: theme.textSecondary,
    },
    tellRow: { flexDirection: 'row', gap: scale(6), paddingRight: scale(4) },
    tellBullet: { fontSize: fontScale(12), color: theme.textSecondary },
    tellText: {
      flex: 1,
      fontSize: fontScale(12),
      lineHeight: fontScale(18),
      color: theme.text,
    },
    disputeBtn: {
      marginTop: responsiveSpacing.sm,
      borderWidth: 1,
      borderColor: darkMode ? 'rgba(138,180,248,0.45)' : 'rgba(26,115,232,0.4)',
    },
    disputeBtnText: {
      color: darkMode ? '#8AB4F8' : '#1A73E8',
      fontSize: fontScale(13),
      fontWeight: '700',
    },
    disputedNote: {
      marginTop: responsiveSpacing.xs,
      fontSize: fontScale(11.5),
      lineHeight: fontScale(17),
      color: theme.textSecondary,
    },
  });

export default React.memo(MailDetail);
