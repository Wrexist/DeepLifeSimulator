/**
 * One list row.
 *
 * Gmail's row is doing more work than it looks: the avatar circle gives the
 * sender an identity you recognise before reading, weight carries unread, and
 * the snippet is what lets you triage without opening. All three matter here —
 * the whole scam mechanic depends on the player noticing that a sender they
 * know is suddenly writing from an address they do not.
 *
 * Which is why the ADDRESS is on the row for unverified senders, not just in
 * the detail view. Hiding it until you open the message would make the tell
 * discoverable only after the decision.
 */

import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Star, Paperclip, BadgeCheck } from 'lucide-react-native';
import type { MailMessage } from '@/contexts/game/types';
import { getThemeColors } from '@/lib/config/theme';
import { senderColor, senderInitial } from '@/lib/mail/senders';
import { docDateShort } from '@/lib/mail/format';
import { fontScale, responsiveSpacing, scale, touchTargets } from '@/utils/scaling';

interface Props {
  message: MailMessage;
  darkMode: boolean;
  onPress: () => void;
  onToggleStar: () => void;
}

function MailRow({ message, darkMode, onPress, onToggleStar }: Props) {
  const theme = getThemeColors(darkMode);
  const s = makeStyles(theme, darkMode);
  const unread = !message.read;

  return (
    <TouchableOpacity
      style={s.row}
      onPress={onPress}
      activeOpacity={0.7}
      accessibilityRole="button"
      accessibilityLabel={`${unread ? 'Unread. ' : ''}${message.senderName}. ${message.subject}`}
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
      </View>

      <TouchableOpacity
        onPress={onToggleStar}
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
      // allows — they are not a decorative accent stripe.
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
    star: {
      paddingLeft: scale(4),
      paddingTop: scale(4),
      alignSelf: 'flex-start',
    },
  });

export default React.memo(MailRow);
