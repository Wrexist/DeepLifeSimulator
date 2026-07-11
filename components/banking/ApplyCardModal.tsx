import React, { useState, useEffect } from 'react';
import { View, Text, Modal, TouchableOpacity, StyleSheet, ScrollView } from 'react-native';
import { X, CreditCard, Gift, AlertCircle } from 'lucide-react-native';
import { CreditCardTier } from '@/contexts/game/types';
import { responsiveFontSize, responsiveSpacing, responsiveBorderRadius, scale } from '@/utils/scaling';
import { getThemeColors, accent } from '@/lib/config/theme';

interface CardProduct {
  tier: CreditCardTier;
  name: string;
  description: string;
  creditLimit: number;
  baseAPR: number;
  rewardsRate: number;
  minCreditScore: number;
  annualFee: number;
  color: string;
}

const PRODUCTS: CardProduct[] = [
  {
    tier: 'starter',
    name: 'Starter Card',
    description: 'Build credit from scratch. Low limit, no fee.',
    creditLimit: 500,
    baseAPR: 0.25,
    rewardsRate: 0.005,
    minCreditScore: 580,
    annualFee: 0,
    color: '#64748b',
  },
  {
    tier: 'standard',
    name: 'Standard Card',
    description: '1% cashback on all purchases. Solid daily driver.',
    creditLimit: 3000,
    baseAPR: 0.21,
    rewardsRate: 0.01,
    minCreditScore: 670,
    annualFee: 0,
    color: accent.info,
  },
  {
    tier: 'gold',
    name: 'Gold Card',
    description: '2% cashback. $95 annual fee. Travel perks.',
    creditLimit: 10000,
    baseAPR: 0.19,
    rewardsRate: 0.02,
    minCreditScore: 740,
    annualFee: 95,
    color: '#ca8a04',
  },
  {
    tier: 'platinum',
    name: 'Platinum Card',
    description: '3% cashback. $495 annual fee. Concierge & lounges.',
    creditLimit: 25000,
    baseAPR: 0.17,
    rewardsRate: 0.03,
    minCreditScore: 800,
    annualFee: 495,
    color: '#0f172a',
  },
];

interface Props {
  visible: boolean;
  creditScore: number;
  darkMode: boolean;
  onApply: (tier: CreditCardTier, baseAPR: number) => void;
  onClose: () => void;
}

export default function ApplyCardModal({ visible, creditScore, darkMode, onApply, onClose }: Props) {
  const theme = getThemeColors(darkMode);
  const [selected, setSelected] = useState<CardProduct | null>(null);

  useEffect(() => {
    if (!visible) setSelected(null);
  }, [visible]);

  const canApply = selected != null && creditScore >= selected.minCreditScore;

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <TouchableOpacity style={styles.backdropTouch} activeOpacity={1} onPress={onClose} />
        <View style={[styles.sheet, { backgroundColor: theme.surface, borderColor: theme.border }]}>
          <View style={styles.headerRow}>
            <Text style={[styles.title, { color: theme.text }]}>Apply for a Credit Card</Text>
            <TouchableOpacity onPress={onClose} hitSlop={10}>
              <X size={scale(20)} color={theme.textSecondary} />
            </TouchableOpacity>
          </View>

          <Text style={[styles.subtitle, { color: theme.textMuted }]}>
            Your credit score: <Text style={{ color: theme.text, fontWeight: '700' }}>{creditScore}</Text>
          </Text>

          <ScrollView style={{ maxHeight: scale(360) }} contentContainerStyle={{ gap: responsiveSpacing.sm }}>
            {PRODUCTS.map((p) => {
              const active = selected?.tier === p.tier;
              const eligible = creditScore >= p.minCreditScore;
              return (
                <TouchableOpacity
                  key={p.tier}
                  onPress={() => setSelected(p)}
                  disabled={!eligible}
                  style={[
                    styles.product,
                    {
                      backgroundColor: theme.surfaceElevated,
                      borderColor: active ? p.color : theme.border,
                      borderWidth: active ? 2 : 1,
                      opacity: eligible ? 1 : 0.5,
                    },
                  ]}
                >
                  <View style={[styles.tierStripe, { backgroundColor: p.color }]} />
                  <View style={{ flex: 1, gap: 4 }}>
                    <View style={styles.productHeader}>
                      <View style={styles.productHeadLeft}>
                        <CreditCard size={scale(16)} color={p.color} />
                        <Text style={[styles.productName, { color: theme.text }]}>{p.name}</Text>
                      </View>
                      <Text style={[styles.minScore, { color: eligible ? accent.success : accent.danger }]}>
                        Min {p.minCreditScore}
                      </Text>
                    </View>
                    <Text style={[styles.productDesc, { color: theme.textMuted }]}>{p.description}</Text>
                    <View style={styles.statsRow}>
                      <Stat label="Limit" value={`$${p.creditLimit.toLocaleString()}`} theme={theme} />
                      <Stat label="APR" value={`${(p.baseAPR * 100).toFixed(0)}%`} theme={theme} />
                      <Stat label="Rewards" value={`${(p.rewardsRate * 100).toFixed(1)}%`} theme={theme} />
                      {/* v22 Wave A honesty fix: the annual fee is never charged in
                          Wave A (the living-card loop lands in Wave B), so we no longer
                          advertise a "$X/yr" fee the player would never actually pay.
                          The annualFee data itself is untouched (ZERO REMOVAL). */}
                    </View>
                  </View>
                </TouchableOpacity>
              );
            })}
          </ScrollView>

          {selected && !canApply && (
            <View style={styles.rejected}>
              <AlertCircle size={scale(14)} color={accent.danger} />
              <Text style={styles.rejectedText}>
                Need credit score ≥ {selected.minCreditScore} (you have {creditScore})
              </Text>
            </View>
          )}

          <TouchableOpacity
            disabled={!canApply}
            onPress={() => selected && onApply(selected.tier, selected.baseAPR)}
            style={[styles.confirm, { backgroundColor: canApply ? accent.info : theme.border }]}
          >
            <Gift size={scale(16)} color="white" />
            <Text style={styles.confirmText}>Apply Now</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

function Stat({ label, value, theme }: { label: string; value: string; theme: ReturnType<typeof getThemeColors> }) {
  return (
    <View style={styles.stat}>
      <Text style={[styles.statLabel, { color: theme.textMuted }]}>{label}</Text>
      <Text style={[styles.statValue, { color: theme.text }]}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    padding: responsiveSpacing.lg,
  },
  backdropTouch: {
    ...StyleSheet.absoluteFillObject,
  },
  sheet: {
    borderRadius: responsiveBorderRadius.xl,
    borderWidth: 1,
    padding: responsiveSpacing.lg,
    gap: responsiveSpacing.md,
    maxHeight: '90%',
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  title: {
    fontSize: responsiveFontSize.lg,
    fontWeight: '700',
  },
  subtitle: {
    fontSize: responsiveFontSize.sm,
  },
  product: {
    flexDirection: 'row',
    overflow: 'hidden',
    borderRadius: responsiveBorderRadius.lg,
  },
  tierStripe: {
    width: scale(6),
  },
  productHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: responsiveSpacing.md,
    paddingBottom: 0,
  },
  productHeadLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: responsiveSpacing.xs,
  },
  productName: {
    fontSize: responsiveFontSize.md,
    fontWeight: '700',
  },
  minScore: {
    fontSize: responsiveFontSize.xs,
    fontWeight: '700',
  },
  productDesc: {
    fontSize: responsiveFontSize.sm,
    paddingHorizontal: responsiveSpacing.md,
  },
  statsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: responsiveSpacing.md,
    padding: responsiveSpacing.md,
    paddingTop: 4,
  },
  stat: {
    alignItems: 'flex-start',
  },
  statLabel: {
    fontSize: responsiveFontSize.xs,
  },
  statValue: {
    fontSize: responsiveFontSize.sm,
    fontWeight: '700',
  },
  rejected: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: responsiveSpacing.xs,
    backgroundColor: 'rgba(239, 68, 68, 0.1)',
    padding: responsiveSpacing.md,
    borderRadius: responsiveBorderRadius.lg,
  },
  rejectedText: {
    flex: 1,
    fontSize: responsiveFontSize.sm,
    color: accent.danger,
    fontWeight: '600',
  },
  confirm: {
    flexDirection: 'row',
    gap: responsiveSpacing.xs,
    paddingVertical: responsiveSpacing.md,
    borderRadius: responsiveBorderRadius.lg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  confirmText: {
    color: 'white',
    fontSize: responsiveFontSize.md,
    fontWeight: '700',
  },
});
