import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Wallet, PiggyBank, Landmark, Lock, ChevronRight, TrendingUp, Clock } from 'lucide-react-native';
import { BankAccount } from '@/contexts/game/types';
import { responsiveFontSize, responsiveSpacing, responsiveBorderRadius, scale } from '@/utils/scaling';
import { getThemeColors, accent } from '@/lib/config/theme';
import { getGlassCard, getGlassIconContainer, getGlassButton } from '@/utils/glassmorphismStyles';
import { isReadOnlyMirror, canCloseAccount } from '@/lib/banking/operations';

interface Props {
  account: BankAccount;
  currentWeek: number;
  darkMode: boolean;
  /** Row tap — opens the deposit flow (kept for backwards compat). */
  onPress?: () => void;
  /** Explicit action buttons. Hidden for mirrored (read-only) accounts. */
  onWithdraw?: () => void;
  onClose?: () => void;
  /**
   * Presentation. `'row'` (default) = the compact list row shared with
   * AdvancedBankApp; `'card'` = the full-width Apple-Wallet card face used by the
   * phone BankApp's account deck. Adding this as an optional prop keeps every
   * existing call site (which omits it) rendering exactly as before.
   */
  variant?: 'row' | 'card';
  /** Card variant only: open the full-screen account detail page. */
  onDetail?: () => void;
}

function formatMoney(n: number): string {
  if (!isFinite(n)) return '$0';
  return `$${Math.round(n).toLocaleString()}`;
}

export function accountTypeLabel(type: BankAccount['type']): string {
  switch (type) {
    case 'checking':
      return 'Checking';
    case 'savings':
      return 'Savings';
    case 'highYieldSavings':
      return 'High-Yield Savings';
    case 'cd':
      return 'Certificate of Deposit';
    case 'moneyMarket':
      return 'Money Market';
  }
}

/**
 * Apple-Wallet per-type card tint. checking = blue (identity), CD = violet,
 * every savings flavour = green. RGB triplet feeds the flat wash / bubble / chip;
 * hex feeds the glyph + label. Kept as a helper so the row and card variants and
 * the detail page all read from one source.
 */
export function accountPalette(type: BankAccount['type']): { rgb: string; hex: string } {
  switch (type) {
    case 'checking':
      return { rgb: '59, 130, 246', hex: accent.info };
    case 'cd':
      return { rgb: '168, 85, 247', hex: '#a855f7' };
    default:
      // savings, highYieldSavings, moneyMarket
      return { rgb: '16, 185, 129', hex: accent.success };
  }
}

function accountGlyph(type: BankAccount['type']) {
  if (type === 'checking') return Wallet;
  if (type === 'cd' || type === 'moneyMarket') return Landmark;
  return PiggyBank;
}

export default function AccountRow({
  account,
  currentWeek,
  darkMode,
  onPress,
  onWithdraw,
  onClose,
  variant = 'row',
  onDetail,
}: Props) {
  const theme = getThemeColors(darkMode);
  const isLocked = account.lockUntilWeek != null && currentWeek < account.lockUntilWeek;
  const weeksUntilUnlock = isLocked ? account.lockUntilWeek! - currentWeek : 0;
  const Icon = variant === 'card' ? accountGlyph(account.type) : account.type === 'checking' ? Wallet : PiggyBank;
  // `checking-default` is a read-only view of cash — deposit/withdraw/close are
  // all rejected by the action layer, so don't offer them at all.
  //
  // `savings-default` is NOT in that bucket any more. It is the account behind
  // the HUD's gold chip, and hiding its controls was half of why that chip could
  // never move (BBQ, 2026-08-11). Its deposits and withdrawals route through
  // `bankSavings` — see LEGACY_SAVINGS_ACCOUNT_ID. Close stays unavailable: it is
  // a primary account, not something the player opened.
  // Both rules come from `lib/banking/operations` rather than being re-derived
  // here. Three components asked the same two questions inline, this change had
  // to edit all three when the answer moved, and a future edit that misses one
  // leaves them disagreeing about whether the gold piggy takes deposits.
  const isMirrored = isReadOnlyMirror(account.id);
  // `closeAccount` refuses every mirror ("Your primary checking and savings
  // accounts cannot be closed"), so offering the button would render a control
  // that always fails.
  const closeAction = canCloseAccount(account.id) ? onClose : undefined;
  // `onPress` counts: it is the deposit affordance. Gating solely on withdraw
  // and close meant a caller passing only `onPress` got the "read-only" chip on
  // an account this change makes depositable.
  const showActions = !isMirrored && (!!onPress || !!onWithdraw || !!closeAction);

  // ── Apple-Wallet card face ────────────────────────────────────────────────
  if (variant === 'card') {
    const pal = accountPalette(account.type);
    const ageWeeks = Math.max(0, currentWeek - account.openedWeek);
    const cardTap = onDetail ?? onPress;
    return (
      /**
       * A View, not a Pressable.
       *
       * The whole card used to be one `TouchableOpacity` with the Deposit /
       * Withdraw / Close buttons rendered INSIDE it. Nested interactive controls
       * are invalid on web — RN-Web logs "<button> cannot contain a nested
       * <button>" — and the outer control wins the hit test, so the inner
       * buttons were unreliable to tap and ambiguous to a screen reader, which
       * sees a button inside a button.
       *
       * The tap-to-detail affordance now wraps only the INFORMATIONAL part of
       * the card, and the action row is its sibling. Same look, one interactive
       * control per thing you can actually do.
       */
      <View
        // Recipe-B anatomy: outer view carries shadow + radius + border + solid
        // fill (no overflow here or the shadow clips on iOS); inner view clips the
        // tint wash + glow blob. Elevation 10 lifts the deck above the L1 rows.
        style={[
          getGlassCard(darkMode, 10),
          {
            backgroundColor: theme.surface,
            borderColor: darkMode ? theme.glassBorder : theme.border,
            borderWidth: 1,
            borderRadius: responsiveBorderRadius['2xl'],
          },
        ]}
      >
        <View style={styles.cardInner}>
          {/* per-type flat tint wash (a plain View — no gradient needed / spent) */}
          <View
            pointerEvents="none"
            style={[StyleSheet.absoluteFill, { backgroundColor: `rgba(${pal.rgb}, ${darkMode ? 0.14 : 0.1})` }]}
          />
          {/* one soft glow blob */}
          <View
            pointerEvents="none"
            style={{
              position: 'absolute',
              top: -scale(40),
              right: -scale(30),
              width: scale(140),
              height: scale(140),
              borderRadius: scale(70),
              backgroundColor: `rgba(${pal.rgb}, 0.10)`,
            }}
          />
          {darkMode && (
            <View
              pointerEvents="none"
              style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 1, backgroundColor: 'rgba(255, 255, 255, 0.08)' }}
            />
          )}

          {/* The tap-to-detail region: everything ABOVE the action row. Kept as
              its own pressable so the buttons below are siblings, not children,
              of an interactive element. */}
          <TouchableOpacity
            activeOpacity={cardTap ? 0.85 : 1}
            onPress={cardTap}
            disabled={!cardTap}
            accessibilityRole={cardTap ? 'button' : undefined}
            accessibilityLabel={
              cardTap
                ? `${account.name}, ${accountTypeLabel(account.type)}, balance ${formatMoney(account.balance)}`
                : undefined
            }
          >
          {/* top: bubble + type eyebrow / name + tappable chevron */}
          <View style={styles.cardTop}>
            <View
              style={[
                getGlassIconContainer(darkMode, 40),
                { backgroundColor: `rgba(${pal.rgb}, 0.15)`, borderWidth: 1, borderColor: `rgba(${pal.rgb}, 0.30)` },
              ]}
            >
              <Icon size={scale(20)} color={pal.hex} />
            </View>
            <View style={styles.cardHeadText}>
              <Text style={[styles.cardType, { color: theme.textMuted }]} numberOfLines={1}>
                {accountTypeLabel(account.type).toUpperCase()}
              </Text>
              <Text style={[styles.cardName, { color: theme.text }]} numberOfLines={1}>
                {account.name}
              </Text>
            </View>
            {cardTap && <ChevronRight size={scale(18)} color={theme.textMuted} />}
          </View>

          {/* big tabular balance + APR chip */}
          <View style={styles.cardBalanceRow}>
            <Text
              style={[styles.cardBalance, { color: theme.text }]}
              numberOfLines={1}
              adjustsFontSizeToFit
              minimumFontScale={0.6}
            >
              {formatMoney(account.balance)}
            </Text>
            {account.baseAPR > 0 && (
              <View style={[styles.aprChipLg, { backgroundColor: `rgba(${pal.rgb}, 0.15)`, borderColor: `rgba(${pal.rgb}, 0.30)` }]}>
                <TrendingUp size={scale(11)} color={pal.hex} />
                <Text style={[styles.aprTextLg, { color: pal.hex }]}>{(account.baseAPR * 100).toFixed(2)}% APR</Text>
              </View>
            )}
          </View>

          {/* meta: age + optional min balance */}
          <View style={styles.cardMetaRow}>
            <Clock size={scale(11)} color={theme.textMuted} />
            <Text style={[styles.cardMeta, { color: theme.textMuted }]} numberOfLines={1}>
              Opened wk {account.openedWeek} · {ageWeeks}w old
              {account.minBalance ? ` · min ${formatMoney(account.minBalance)}` : ''}
            </Text>
          </View>
          {isLocked && (
            <View style={styles.cardMetaRow}>
              <Lock size={scale(11)} color={accent.warning} />
              <Text style={[styles.cardMeta, { color: accent.warning }]} numberOfLines={1}>
                Locked until week {account.lockUntilWeek} ({weeksUntilUnlock} more {weeksUntilUnlock === 1 ? 'week' : 'weeks'})
              </Text>
            </View>
          )}
          </TouchableOpacity>

          {/* actions — labeled + >=36pt; mirrored accounts stay read-only */}
          {showActions ? (
            <View style={styles.cardActions}>
              {onPress && (
                <TouchableOpacity
                  onPress={onPress}
                  accessibilityRole="button"
                  accessibilityLabel={`Deposit to ${account.name}`}
                  style={[styles.cardBtn, { backgroundColor: `rgba(${pal.rgb}, 0.15)`, borderColor: `rgba(${pal.rgb}, 0.30)`, borderWidth: 1 }]}
                >
                  <Text style={[styles.cardBtnText, { color: pal.hex }]}>Deposit</Text>
                </TouchableOpacity>
              )}
              {onWithdraw && (
                <TouchableOpacity
                  onPress={onWithdraw}
                  disabled={isLocked}
                  accessibilityRole="button"
                  accessibilityLabel={`Withdraw from ${account.name}`}
                  accessibilityState={{ disabled: isLocked }}
                  style={[getGlassButton(darkMode), styles.cardBtn, isLocked && styles.actionDisabled]}
                >
                  <Text style={[styles.cardBtnText, { color: theme.text }]}>Withdraw</Text>
                </TouchableOpacity>
              )}
              {closeAction && (
                <TouchableOpacity
                  onPress={closeAction}
                  disabled={isLocked}
                  accessibilityRole="button"
                  accessibilityLabel={`Close ${account.name}`}
                  accessibilityState={{ disabled: isLocked }}
                  style={[getGlassButton(darkMode), styles.cardBtn, isLocked && styles.actionDisabled]}
                >
                  <Text style={[styles.cardBtnText, { color: accent.danger }]}>Close</Text>
                </TouchableOpacity>
              )}
            </View>
          ) : (
            <View style={[styles.roChip, { borderColor: theme.border }]}>
              <Lock size={scale(10)} color={theme.textMuted} />
              <Text style={[styles.roText, { color: theme.textMuted }]}>Primary account · read-only</Text>
            </View>
          )}
        </View>
      </View>
    );
  }

  // ── Compact list row (default — unchanged contract) ───────────────────────
  // Recipe C tinted bubble: checking = identity info, savings variants get a
  // small semantic success tint (matches the green APR chip they carry).
  const isChecking = account.type === 'checking';
  const bubbleRGB = isChecking ? '59, 130, 246' : '16, 185, 129';
  const bubbleColor = isChecking ? accent.info : accent.success;

  return (
    <TouchableOpacity
      activeOpacity={onPress ? 0.7 : 1}
      onPress={onPress}
      style={[getGlassCard(darkMode, 6), styles.card, { backgroundColor: theme.surface, borderColor: theme.border, borderWidth: 1, borderRadius: responsiveBorderRadius.xl }]}
    >
      <View style={styles.mainRow}>
        <View style={[getGlassIconContainer(darkMode, 40), { backgroundColor: `rgba(${bubbleRGB}, 0.15)`, borderWidth: 1, borderColor: `rgba(${bubbleRGB}, 0.30)` }]}>
          <Icon size={scale(20)} color={bubbleColor} />
        </View>
        <View style={styles.body}>
          <View style={styles.row}>
            <Text style={[styles.name, { color: theme.text }]} numberOfLines={1}>
              {account.name}
            </Text>
            {account.baseAPR > 0 && (
              <View style={styles.aprChip}>
                <TrendingUp size={scale(10)} color={accent.success} />
                <Text style={styles.aprText}>{(account.baseAPR * 100).toFixed(2)}% APR</Text>
              </View>
            )}
          </View>
          <Text style={[styles.type, { color: theme.textMuted }]}>{accountTypeLabel(account.type)}</Text>
          {isLocked && (
            <View style={styles.lockRow}>
              <Lock size={scale(10)} color={theme.textMuted} />
              <Text style={[styles.lockText, { color: theme.textMuted }]}>
                Locked until week {account.lockUntilWeek} ({weeksUntilUnlock} more{' '}
                {weeksUntilUnlock === 1 ? 'week' : 'weeks'})
              </Text>
            </View>
          )}
        </View>
        <View style={styles.tail}>
          <Text style={[styles.balance, { color: theme.text }]}>{formatMoney(account.balance)}</Text>
          {onPress && <ChevronRight size={scale(16)} color={theme.textMuted} />}
        </View>
      </View>

      {showActions && (
        <View style={styles.actionsRow}>
          {onPress && (
            <TouchableOpacity
              onPress={onPress}
              style={[getGlassButton(darkMode), styles.actionBtn]}
            >
              <Text style={[styles.actionText, { color: theme.text }]}>Deposit</Text>
            </TouchableOpacity>
          )}
          {onWithdraw && (
            <TouchableOpacity
              onPress={onWithdraw}
              disabled={isLocked}
              style={[getGlassButton(darkMode), styles.actionBtn, isLocked && styles.actionDisabled]}
            >
              <Text style={[styles.actionText, { color: theme.text }]}>Withdraw</Text>
            </TouchableOpacity>
          )}
          {closeAction && (
            <TouchableOpacity
              onPress={closeAction}
              disabled={isLocked}
              style={[getGlassButton(darkMode), styles.actionBtn, isLocked && styles.actionDisabled]}
            >
              <Text style={[styles.actionText, { color: accent.danger }]}>Close</Text>
            </TouchableOpacity>
          )}
        </View>
      )}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: {
    padding: responsiveSpacing.md,
    gap: responsiveSpacing.sm,
  },
  mainRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: responsiveSpacing.md,
  },
  body: {
    flex: 1,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: responsiveSpacing.xs,
  },
  name: {
    fontSize: responsiveFontSize.md,
    fontWeight: '700',
  },
  type: {
    fontSize: responsiveFontSize.sm,
    marginTop: 2,
  },
  aprChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    backgroundColor: 'rgba(16, 185, 129, 0.15)',
    paddingHorizontal: responsiveSpacing.xs,
    paddingVertical: 2,
    borderRadius: responsiveBorderRadius.sm,
  },
  aprText: {
    fontSize: responsiveFontSize.xs,
    color: accent.success,
    fontWeight: '700',
  },
  lockRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    marginTop: 2,
  },
  lockText: {
    fontSize: responsiveFontSize.xs,
  },
  tail: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: responsiveSpacing.xs,
  },
  balance: {
    fontSize: responsiveFontSize.lg,
    fontWeight: '800',
    fontVariant: ['tabular-nums'],
  },
  actionsRow: {
    flexDirection: 'row',
    gap: responsiveSpacing.xs,
  },
  actionBtn: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: responsiveSpacing.xs,
    borderRadius: responsiveBorderRadius.full,
  },
  actionDisabled: {
    opacity: 0.4,
  },
  actionText: {
    fontSize: responsiveFontSize.xs,
    fontWeight: '700',
  },

  // ── Card face ─────────────────────────────────────────────────────────────
  cardInner: {
    borderRadius: responsiveBorderRadius['2xl'],
    overflow: 'hidden',
    padding: responsiveSpacing.md,
    gap: responsiveSpacing.sm,
  },
  cardTop: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: responsiveSpacing.sm,
  },
  cardHeadText: {
    flex: 1,
  },
  cardType: {
    fontSize: responsiveFontSize.xs,
    fontWeight: '600',
    letterSpacing: 0.8,
  },
  cardName: {
    fontSize: responsiveFontSize.lg,
    fontWeight: '700',
    marginTop: 1,
  },
  cardBalanceRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    gap: responsiveSpacing.sm,
  },
  cardBalance: {
    flexShrink: 1,
    fontSize: responsiveFontSize['3xl'],
    fontWeight: '800',
    fontVariant: ['tabular-nums'],
  },
  aprChipLg: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    paddingHorizontal: responsiveSpacing.sm,
    paddingVertical: 3,
    borderRadius: responsiveBorderRadius.full,
    borderWidth: 1,
    marginBottom: 2,
  },
  aprTextLg: {
    fontSize: responsiveFontSize.xs,
    fontWeight: '700',
    fontVariant: ['tabular-nums'],
  },
  cardMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  cardMeta: {
    flex: 1,
    fontSize: responsiveFontSize.xs,
    fontVariant: ['tabular-nums'],
  },
  cardActions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: responsiveSpacing.xs,
    marginTop: 2,
  },
  cardBtn: {
    flexGrow: 1,
    flexBasis: scale(88),
    minHeight: scale(38),
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: responsiveSpacing.sm,
    borderRadius: responsiveBorderRadius.full,
  },
  cardBtnText: {
    fontSize: responsiveFontSize.sm,
    fontWeight: '700',
  },
  roChip: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: 4,
    paddingHorizontal: responsiveSpacing.sm,
    paddingVertical: 4,
    borderRadius: responsiveBorderRadius.full,
    borderWidth: 1,
    marginTop: 2,
  },
  roText: {
    fontSize: responsiveFontSize.xs,
    fontWeight: '600',
  },
});
