import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { ShoppingBag, AlertTriangle, Star } from 'lucide-react-native';
import { DarkWebMarketListing, DarkWebVendor } from '@/contexts/game/types';
import { vendorScamProbability } from '@/lib/darkweb/marketplace';
import { responsiveFontSize, responsiveSpacing, responsiveBorderRadius, scale } from '@/utils/scaling';
import { getThemeColors, accent } from '@/lib/config/theme';

interface Props {
  listing: DarkWebMarketListing;
  vendor: DarkWebVendor;
  darkMode: boolean;
  affordable: boolean;
  meetsRep: boolean;
  onPress?: () => void;
}

const TIER_COLOR: Record<string, string> = {
  common: '#94a3b8',
  pro: accent.info,
  elite: '#a855f7',
};

const CATEGORY_LABEL: Record<string, string> = {
  stolenAccounts: 'Stolen Accounts',
  cardedItems: 'Carded Goods',
  fakeIds: 'Fake IDs',
  hackingTools: 'Hacking Tools',
  services: 'Services',
  data: 'Data',
  gear: 'Gear',
};

export default function MarketListingRow({ listing, vendor, darkMode, affordable, meetsRep, onPress }: Props) {
  const theme = getThemeColors(darkMode);
  const color = TIER_COLOR[listing.tier];
  const scamPct = vendorScamProbability(vendor.reputation) * 100;
  const disabled = !affordable || !meetsRep;

  return (
    <TouchableOpacity
      onPress={onPress}
      disabled={disabled}
      activeOpacity={onPress ? 0.7 : 1}
      style={[
        styles.card,
        {
          backgroundColor: theme.surfaceElevated,
          borderColor: theme.border,
          opacity: disabled ? 0.55 : 1,
        },
      ]}
    >
      <View style={[styles.tierStripe, { backgroundColor: color }]} />
      <View style={styles.body}>
        <View style={styles.headerRow}>
          <View style={[styles.iconBubble, { backgroundColor: theme.surface }]}>
            <ShoppingBag size={scale(14)} color={color} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={[styles.title, { color: theme.text }]} numberOfLines={1}>
              {listing.title}
            </Text>
            <Text style={[styles.sub, { color: theme.textMuted }]}>
              {CATEGORY_LABEL[listing.category] ?? listing.category} · {vendor.handle}
            </Text>
          </View>
          <View style={{ alignItems: 'flex-end' }}>
            <Text style={[styles.price, { color: theme.text }]}>{listing.costBtc.toFixed(4)} ₿</Text>
            <View style={styles.repRow}>
              <Star size={scale(10)} color={accent.gold} fill={accent.gold} />
              <Text style={[styles.repText, { color: theme.textMuted }]}>
                {vendor.reputation}/100
              </Text>
            </View>
          </View>
        </View>
        <View style={styles.footRow}>
          <Text style={[styles.foot, { color: theme.textMuted }]}>
            +{listing.heatCost} heat · Tier {listing.tier}
            {listing.minBuyerRep > 0 ? ` · Buyer rep ≥ ${listing.minBuyerRep}` : ''}
          </Text>
          {scamPct > 20 && (
            <View style={styles.warningRow}>
              <AlertTriangle size={scale(10)} color={accent.danger} />
              <Text style={styles.warningText}>{Math.round(scamPct)}% scam risk</Text>
            </View>
          )}
        </View>
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    borderRadius: responsiveBorderRadius.lg,
    borderWidth: 1,
    overflow: 'hidden',
  },
  tierStripe: { width: scale(4) },
  body: {
    flex: 1,
    padding: responsiveSpacing.md,
    gap: 4,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: responsiveSpacing.sm,
  },
  iconBubble: {
    width: scale(32),
    height: scale(32),
    borderRadius: scale(16),
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: { fontSize: responsiveFontSize.md, fontWeight: '700' },
  sub: { fontSize: responsiveFontSize.xs, marginTop: 2 },
  price: { fontSize: responsiveFontSize.md, fontWeight: '800' },
  repRow: { flexDirection: 'row', alignItems: 'center', gap: 2, marginTop: 2 },
  repText: { fontSize: responsiveFontSize.xs },
  footRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  foot: { fontSize: responsiveFontSize.xs },
  warningRow: { flexDirection: 'row', alignItems: 'center', gap: 2 },
  warningText: { fontSize: responsiveFontSize.xs, color: accent.danger, fontWeight: '700' },
});
