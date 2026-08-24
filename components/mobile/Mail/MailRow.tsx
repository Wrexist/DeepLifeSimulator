/**
 * One list row.
 *
 * Gmail's row is doing more work than it looks: the avatar circle gives the
 * sender an identity you recognise before reading, weight carries unread, and
 * the snippet is what lets you triage without opening. All three matter here -
 * the whole scam mechanic depends on the player noticing that a sender they
 * know is suddenly writing from an address they do not.
 *
 * Which is why the ADDRESS is on the row for unverified senders, not just in
 * the detail view. Hiding it until you open the message would make the tell
 * discoverable only after the decision.
 *
 * The DEADLINE is on the row for the same reason. A letter that settles itself
 * in two weeks rendered identically to a promotional email - the one row in the
 * app with a consequence attached was the one row with nothing to distinguish
 * it. Triage is the point of a list, and you cannot triage what you cannot see.
 */

import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Star, Paperclip, BadgeCheck, Clock } from 'lucide-react-native';
import type { MailMessage } from '@/contexts/game/types';
import { getThemeColors } from '@/lib/config/theme';
import { senderColor, senderInitial } from '@/lib/mail/senders';
import { docDateShort } from '@/lib/mail/format';
import { decisionDeadline } from '@/lib/mail/filters';
import { fontScale, responsiveSpacing, scale, touchTargets } from '@/utils/scaling';

interface Props {
  message: MailMessage;
  darkMode: boolean;
  /** Absolute `weeksLived`, for the deadline chip. */
  currentWeek: number;
  /**
   * Where this message lives, shown only when the list spans folders.
   *
   * Search does span them, and a result with no location is a message the
   * player cannot find again - they read "Archive" here or they go hunting.
   */
  folderLabel?: string;
  /**
   * Id-taking, so the list can hand every row the SAME two functions. Closing
   * over the id in the parent's JSX (`onPress={() => open(m.id)}`) allocates a
   * fresh pair per render and defeats the `React.memo` below for all 50 rows.
   */
  onPress: (id: string) => void;
  onToggleStar: (id: string) => void;
}

function MailRow({
  message,
  darkMode,
  currentWeek,
  folderLabel,
  onPress,
  onToggleStar,
}: Props) {
  const theme = getThemeColors(darkMode);
  const s = makeStyles(theme, darkMode);
  const unread = !message.read;
  const deadline = decisionDeadline(message, currentWeek);

  return (
    <TouchableOpacity
      style={s.row}
      onPress={() => onPress(message.id)}
      activeOpacity={0.7}
      accessibilityRole="button"
      accessibilityLabel={[
        unread ? 'Unread.' : '',
        message.senderName + '.',
        message.subject + '.',
        deadline ? `Needs a reply, ${deadline.label}.` : '',
        folderLabel ? `In ${folderLabel}.` : '',
      ]
        .filter(Boolean)
        .join(' ')}
    >
      <View style={[s.avatar, { backgroundColor: senderColor(message.senderEmail) }]}>
        <Text style={s.avatarText}>{senderInitial(message.senderName)}</Text>
      </View>

      <View style={s.body}>
        <View style={s.line}>
          <Text style={[s.sender, unread && s.strong]} numberOfLines={1}>
            {message.senderName}
          </Text>
          {message.verified ? (
            <BadgeCheck size={scale(13)} color={darkMode ? '#8AB4F8' : '#1A73E8'} />
          ) : null}
          <Text style={[s.date, unread && s.strong]}>{docDateShort(message.atWeek)}</Text>
        </View>

        <Text style={[s.subject, unread && s.strong]} numberOfLines={1}>
          {message.subject}
        </Text>

        {/* The address is shown for unverified senders only. On a verified one
            it is noise; on an unverified one it is the single most useful thing
            on the row, and it has to be visible BEFORE the message is opened. */}
        {!message.verified ? (
          <Text style={s.address} numberOfLines={1}>
            {message.senderEmail}
          </Text>
        ) : null}

        <View style={s.line}>
          <Text style={s.preview} numberOfLines={1}>
            {message.preview}
          </Text>
          {message.attachment ? (
            <Paperclip size={scale(12)} color={theme.textSecondary} />
          ) : null}
        </View>

        {/* Chips: the deadline, and where the message lives when the list spans
            folders. Full border on all four sides - Hard Rule #7 bans the
            one-sided coloured stripe, and the colour still carries the meaning
            (amber = last week to act). */}
        {deadline || folderLabel ? (
          <View style={s.chips}>
            {deadline ? (
              <View style={[s.chip, deadline.urgent ? s.chipUrgent : s.chipDue]}>
                <Clock
                  size={scale(10)}
                  color={
                    deadline.urgent
                      ? darkMode
                        ? '#FDD663'
                        : '#B06000'
                      : theme.textSecondary
                  }
                />
                <Text
                  style={[s.chipText, deadline.urgent && s.chipTextUrgent]}
                  numberOfLines={1}
                >
                  {deadline.label}
                </Text>
              </View>
            ) : null}
            {folderLabel ? (
              <View style={[s.chip, s.chipFolder]}>
                <Text style={s.chipText} numberOfLines={1}>
                  {folderLabel}
                </Text>
              </View>
            ) : null}
          </View>
        ) : null}
      </View>

      <TouchableOpacity
        onPress={() => onToggleStar(message.id)}
        style={s.star}
        hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        accessibilityRole="button"
        accessibilityLabel={message.starred ? 'Remove star' : 'Add star'}
      >
        <Star
          size={scale(17)}
          color={message.starred ? '#F9AB00' : theme.textSecondary}
          fill={message.starred ? '#F9AB00' : 'transparent'}
        />
      </TouchableOpacity>
    </TouchableOpacity>
  );
}

const makeStyles = (theme: ReturnType<typeof getThemeColors>, darkMode: boolean) =>
  StyleSheet.create({
    row: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      paddingHorizontal: responsiveSpacing.md,
      paddingVertical: responsiveSpacing.sm,
      gap: responsiveSpacing.sm,
      minHeight: touchTargets.minimum,
      // Row separators are a structural divider, which Hard Rule #7 explicitly
      // allows - they are not a decorative accent stripe.
      borderBottomWidth: 1,
      borderBottomColor: darkMode ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)',
    },
    avatar: {
      width: scale(36),
      height: scale(36),
      borderRadius: scale(18),
      alignItems: 'center',
      justifyContent: 'center',
      marginTop: scale(2),
    },
    avatarText: {
      color: '#FFFFFF',
      fontSize: fontScale(15),
      fontWeight: '600',
    },
    body: { flex: 1, gap: scale(1) },
    line: { flexDirection: 'row', alignItems: 'center', gap: scale(5) },
    sender: { flex: 1, fontSize: fontScale(13.5), color: theme.text },
    date: { fontSize: fontScale(11), color: theme.textSecondary },
    subject: { fontSize: fontScale(13), color: theme.text },
    address: { fontSize: fontScale(10.5), color: theme.textSecondary },
    preview: { flex: 1, fontSize: fontScale(12), color: theme.textSecondary },
    strong: { fontWeight: '700', color: theme.text },
    chips: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: scale(5),
      marginTop: scale(4),
    },
    chip: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: scale(3),
      paddingHorizontal: scale(7),
      paddingVertical: scale(2),
      borderRadius: scale(9),
      borderWidth: 1,
    },
    chipDue: {
      borderColor: darkMode ? '#2A3441' : '#DADCE0',
      backgroundColor: darkMode ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.02)',
    },
    chipUrgent: {
      borderColor: darkMode ? '#5C4813' : '#F9AB00',
      backgroundColor: darkMode ? 'rgba(249,171,0,0.13)' : '#FEF7E0',
    },
    chipFolder: {
      borderColor: darkMode ? '#2A3441' : '#DADCE0',
      backgroundColor: 'transparent',
    },
    chipText: { fontSize: fontScale(10), fontWeight: '600', color: theme.textSecondary },
    chipTextUrgent: { color: darkMode ? '#FDD663' : '#B06000' },
    star: {
      paddingLeft: scale(4),
      paddingTop: scale(4),
      alignSelf: 'flex-start',
    },
  });

export default React.memo(MailRow);
