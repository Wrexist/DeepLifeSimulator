/**
 * The attachment card - a payslip, invoice, statement or receipt rendered as a
 * document rather than described as one.
 *
 * The layout is deliberately plain: a header block, ruled label/value rows with
 * right-aligned figures, and a heavier total. That is what makes it read as
 * paperwork instead of another game card, and it is the reason every figure is
 * formatted exactly (`$1,234.56`) rather than abbreviated.
 *
 * Hard Rule #7: full `borderWidth: 1` on all four sides. A document with a
 * coloured stripe down one edge is exactly the decorative side-accent the rule
 * bans, and it would also fight the rounded corners.
 */

import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import type { MailAttachment } from '@/contexts/game/types';
import { getThemeColors } from '@/lib/config/theme';
import { fontScale, responsiveSpacing, scale, responsiveBorderRadius } from '@/utils/scaling';

interface Props {
  attachment: MailAttachment;
  darkMode: boolean;
}

const KIND_LABEL: Record<MailAttachment['kind'], string> = {
  payslip: 'PAYSLIP',
  invoice: 'INVOICE',
  receipt: 'RECEIPT',
  statement: 'STATEMENT',
  notice: 'NOTICE',
  contract: 'CONTRACT',
};

function MailDocument({ attachment, darkMode }: Props) {
  const theme = getThemeColors(darkMode);
  const s = makeStyles(theme, darkMode);

  return (
    <View style={s.doc}>
      <View style={s.header}>
        <Text style={s.kind}>{KIND_LABEL[attachment.kind] ?? 'DOCUMENT'}</Text>
        <Text style={s.reference}>{attachment.reference}</Text>
      </View>

      <Text style={s.title}>{attachment.title}</Text>
      <Text style={s.issuer}>{attachment.issuer}</Text>

      <View style={s.rule} />

      {attachment.rows.map((row, i) => (
        <View key={`${row.label}-${i}`} style={s.row}>
          <Text style={[s.rowLabel, row.muted && s.muted]} numberOfLines={2}>
            {row.label}
          </Text>
          <Text style={[s.rowValue, row.muted && s.muted, row.negative && s.negative]}>
            {row.value}
          </Text>
        </View>
      ))}

      {attachment.total ? (
        <>
          <View style={s.totalRule} />
          <View style={s.row}>
            <Text style={s.totalLabel}>{attachment.total.label}</Text>
            <Text style={s.totalValue}>{attachment.total.value}</Text>
          </View>
        </>
      ) : null}

      {attachment.note ? <Text style={s.note}>{attachment.note}</Text> : null}
    </View>
  );
}

const makeStyles = (theme: ReturnType<typeof getThemeColors>, darkMode: boolean) =>
  StyleSheet.create({
    doc: {
      borderWidth: 1,
      borderColor: darkMode ? '#2A3441' : '#DADCE0',
      borderRadius: responsiveBorderRadius.md,
      backgroundColor: darkMode ? '#151B23' : '#FFFFFF',
      padding: responsiveSpacing.md,
      marginTop: responsiveSpacing.md,
    },
    header: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: scale(6),
    },
    kind: {
      fontSize: fontScale(10),
      letterSpacing: 1.2,
      fontWeight: '700',
      color: darkMode ? '#8AB4F8' : '#1A73E8',
    },
    reference: {
      fontSize: fontScale(10),
      color: theme.textSecondary,
      fontVariant: ['tabular-nums'],
    },
    title: {
      fontSize: fontScale(15),
      fontWeight: '700',
      color: theme.text,
    },
    issuer: {
      fontSize: fontScale(11),
      color: theme.textSecondary,
      marginTop: scale(2),
    },
    rule: {
      height: 1,
      backgroundColor: darkMode ? '#2A3441' : '#E8EAED',
      marginVertical: responsiveSpacing.sm,
    },
    row: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      justifyContent: 'space-between',
      paddingVertical: scale(5),
      gap: responsiveSpacing.sm,
    },
    rowLabel: {
      flex: 1,
      fontSize: fontScale(12),
      color: theme.text,
    },
    rowValue: {
      fontSize: fontScale(12),
      fontWeight: '600',
      color: theme.text,
      fontVariant: ['tabular-nums'],
    },
    muted: { color: theme.textSecondary, fontWeight: '400' },
    negative: { color: darkMode ? '#F28B82' : '#C5221F' },
    totalRule: {
      height: 1,
      backgroundColor: darkMode ? '#3C4A5A' : '#BDC1C6',
      marginTop: responsiveSpacing.sm,
      marginBottom: scale(2),
    },
    totalLabel: {
      flex: 1,
      fontSize: fontScale(13),
      fontWeight: '700',
      color: theme.text,
    },
    totalValue: {
      fontSize: fontScale(15),
      fontWeight: '800',
      color: theme.text,
      fontVariant: ['tabular-nums'],
    },
    note: {
      marginTop: responsiveSpacing.sm,
      fontSize: fontScale(10.5),
      lineHeight: fontScale(15),
      color: theme.textSecondary,
      fontStyle: 'italic',
    },
  });

export default React.memo(MailDocument);
