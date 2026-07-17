import React from 'react';
import { Image, ImageSourcePropType, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import LinearGradientFallback from '@/components/fallbacks/LinearGradientFallback';
import { Check, Gem } from 'lucide-react-native';
import BlurViewFallback from '@/components/fallbacks/BlurViewFallback';
import { fontScale, responsiveBorderRadius, responsiveSpacing, scale, verticalScale } from '@/utils/scaling';

// expo-linear-gradient is a TurboModule that has crashed on iOS 26 — use the safe fallback.
const LinearGradient = LinearGradientFallback;

export type ShopAccent = 'upgrades' | 'gems' | 'packs' | 'perks';

/** Row card (grid item) or banner-size hero card for a featured offer. */
export type ShopCardVariant = 'row' | 'hero';

export interface ShopBadge {
  /** Short uppercase label, e.g., "BEST VALUE", "MOST POPULAR" */
  label: string;
  /** Accent color for the dot + text */
  color: string;
}

interface ShopItemCardProps {
  title: string;
  description: string;
  /** Bullet points shown for IAP packs that bundle multiple features. */
  features?: string[];
  /** Image takes precedence over icon. */
  image?: ImageSourcePropType;
  icon?: React.ComponentType<{ size?: number; color?: string }>;
  /** Pre-formatted price string, e.g. "$4.99" or "5,000" */
  priceLabel: string;
  /** When 'gems', a gem icon prefixes the price. When 'money', no icon. */
  priceKind: 'gems' | 'money';
  /**
   * Truthful value line rendered beneath the price — e.g. a computed
   * "≈ 300 gems / $1" for gem packs. NOT a fabricated strike-through price.
   */
  valueLine?: string;
  /** Up to two small badges; rendered top-right. */
  badges?: ShopBadge[];
  buttonText: string;
  onPress?: () => void;
  accent: ShopAccent;
  owned?: boolean;
  /** Disabled — typically insufficient funds, loading, or store unavailable. */
  locked?: boolean;
  /** 'row' (default) or 'hero' (banner-size featured card). */
  variant?: ShopCardVariant;
  /** Richer spoken label for the CTA; defaults to buttonText. */
  accessibilityLabel?: string;
}

const ACCENT_BUTTON: Record<ShopAccent, [string, string, string]> = {
  upgrades: ['#10B981', '#059669', '#047857'], // gem-purchased — green
  gems: ['#6366F1', '#4F46E5', '#4338CA'], // real-money gem packs — indigo
  packs: ['#8B5CF6', '#7C3AED', '#6D28D9'], // bundles — violet
  perks: ['#F59E0B', '#D97706', '#B45309'], // perks — amber
};

const DISABLED_GRADIENT: [string, string] = ['#1E293B', '#0F172A'];

export default function ShopItemCard({
  title,
  description,
  features,
  image,
  icon: Icon,
  priceLabel,
  priceKind,
  valueLine,
  badges,
  buttonText,
  onPress,
  accent,
  owned = false,
  locked = false,
  variant = 'row',
  accessibilityLabel,
}: ShopItemCardProps) {
  const buttonPalette = ACCENT_BUTTON[accent];
  const buttonDisabled = owned || locked || !onPress;
  const buttonGradient: [string, string, ...string[]] = buttonDisabled
    ? [DISABLED_GRADIENT[0], DISABLED_GRADIENT[1]]
    : [buttonPalette[0], buttonPalette[1], buttonPalette[2]];
  const hero = variant === 'hero';

  const badgeRow =
    badges && badges.length > 0 ? (
      <View style={styles.badgeRow}>
        {badges.map((b, i) => (
          <View key={i} style={styles.badge}>
            <View style={[styles.badgeDot, { backgroundColor: b.color }]} />
            <Text style={[styles.badgeLabel, { color: b.color }]}>{b.label}</Text>
          </View>
        ))}
      </View>
    ) : null;

  const media = image ? (
    <Image source={image} style={styles.iconImage} resizeMode="contain" />
  ) : Icon ? (
    <Icon size={scale(hero ? 30 : 22)} color={buttonPalette[1]} />
  ) : (
    <Gem size={scale(hero ? 30 : 22)} color={buttonPalette[1]} />
  );

  const featureList =
    features && features.length > 0 ? (
      <View style={styles.featureList}>
        {features.map((f, i) => (
          <View key={i} style={styles.featureRow}>
            <View style={[styles.featureDot, { backgroundColor: buttonPalette[1] }]} />
            <Text style={styles.featureText} numberOfLines={2}>
              {f}
            </Text>
          </View>
        ))}
      </View>
    ) : null;

  const priceBlock = (
    <View style={styles.priceColumn}>
      <View style={styles.priceRow}>
        {priceKind === 'gems' ? (
          <Gem size={scale(13)} color={owned ? 'rgba(226, 232, 240, 0.45)' : '#A5B4FC'} />
        ) : null}
        <Text
          style={[
            hero ? styles.heroPrice : styles.price,
            { color: owned ? 'rgba(226, 232, 240, 0.45)' : '#F8FAFC' },
          ]}
        >
          {priceLabel}
        </Text>
      </View>
      {valueLine ? <Text style={styles.valueLine}>{valueLine}</Text> : null}
    </View>
  );

  const cta = (
    <TouchableOpacity
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? buttonText}
      accessibilityState={{ disabled: buttonDisabled }}
      activeOpacity={0.85}
      disabled={buttonDisabled}
      onPress={onPress}
      style={hero ? styles.heroButtonWrap : styles.buttonWrap}
    >
      <LinearGradient
        colors={buttonGradient}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={hero ? styles.heroButton : styles.button}
      >
        {owned ? <Check size={scale(14)} color="#FFFFFF" style={{ marginRight: scale(6) }} /> : null}
        <Text style={[styles.buttonText, buttonDisabled && styles.buttonTextDisabled]}>{buttonText}</Text>
      </LinearGradient>
    </TouchableOpacity>
  );

  if (hero) {
    return (
      <View style={[styles.card, styles.heroCard, { borderColor: buttonPalette[1] + '4D' }]}>
        <LinearGradient
          colors={[buttonPalette[0] + '2E', buttonPalette[2] + '10']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={StyleSheet.absoluteFill}
        />
        <BlurViewFallback intensity={18} tint="dark" style={StyleSheet.absoluteFill} />
        {badgeRow}
        <View style={styles.heroBody}>
          <View style={styles.heroTopRow}>
            <View style={[styles.heroIconWrap, { borderColor: buttonPalette[1] + '66' }]}>{media}</View>
            <View style={styles.heroTitleColumn}>
              <Text style={styles.heroTitle} numberOfLines={2}>
                {title}
              </Text>
              {description ? (
                <Text style={styles.heroDescription} numberOfLines={2}>
                  {description}
                </Text>
              ) : null}
            </View>
          </View>
          {featureList}
          <View style={styles.heroFooter}>
            {priceBlock}
            {cta}
          </View>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.card}>
      <BlurViewFallback intensity={28} tint="dark" style={StyleSheet.absoluteFill} />

      {badgeRow}

      <View style={styles.body}>
        <View style={styles.topRow}>
          <View style={[styles.iconWrap, { borderColor: buttonPalette[1] + '55' }]}>{media}</View>

          <View style={styles.titleColumn}>
            <Text style={styles.title} numberOfLines={2}>
              {title}
            </Text>
            {description ? (
              <Text style={styles.description} numberOfLines={2}>
                {description}
              </Text>
            ) : null}
          </View>
        </View>

        {featureList}

        <View style={styles.footer}>
          {priceBlock}
          {cta}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    marginBottom: verticalScale(10),
    borderRadius: responsiveBorderRadius.md,
    overflow: 'hidden',
    backgroundColor: 'rgba(15, 23, 42, 0.55)',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255, 255, 255, 0.08)',
  },
  heroCard: {
    marginBottom: verticalScale(12),
    borderRadius: responsiveBorderRadius.lg,
    borderWidth: 1,
    backgroundColor: 'rgba(10, 14, 26, 0.7)',
  },
  badgeRow: {
    position: 'absolute',
    top: scale(10),
    right: scale(12),
    flexDirection: 'row',
    gap: scale(8),
    zIndex: 1,
  },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: scale(5),
    paddingHorizontal: scale(8),
    paddingVertical: scale(3),
    borderRadius: scale(999),
    backgroundColor: 'rgba(15, 23, 42, 0.65)',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255, 255, 255, 0.08)',
  },
  badgeDot: {
    width: scale(5),
    height: scale(5),
    borderRadius: scale(3),
  },
  badgeLabel: {
    fontSize: fontScale(10),
    fontWeight: '700',
    letterSpacing: 0.6,
    textTransform: 'uppercase',
  },
  body: {
    padding: responsiveSpacing.md,
    gap: verticalScale(12),
  },
  topRow: {
    flexDirection: 'row',
    gap: scale(12),
    paddingRight: scale(8),
  },
  iconWrap: {
    width: scale(48),
    height: scale(48),
    borderRadius: scale(12),
    backgroundColor: 'rgba(15, 23, 42, 0.55)',
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  iconImage: {
    width: '70%',
    height: '70%',
  },
  titleColumn: {
    flex: 1,
    paddingTop: scale(2),
    paddingRight: scale(70), // breathing room for the badges
  },
  title: {
    fontSize: fontScale(15),
    fontWeight: '700',
    color: '#F8FAFC',
    letterSpacing: -0.2,
  },
  description: {
    fontSize: fontScale(12),
    color: 'rgba(226, 232, 240, 0.65)',
    marginTop: 2,
    lineHeight: fontScale(17),
  },
  // ─── Hero (banner) variant ───
  heroBody: {
    padding: responsiveSpacing.md,
    gap: verticalScale(12),
  },
  heroTopRow: {
    flexDirection: 'row',
    gap: scale(14),
    paddingRight: scale(90), // breathing room for the badges
  },
  heroIconWrap: {
    width: scale(64),
    height: scale(64),
    borderRadius: scale(16),
    backgroundColor: 'rgba(15, 23, 42, 0.5)',
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  heroTitleColumn: {
    flex: 1,
    paddingTop: scale(2),
  },
  heroTitle: {
    fontSize: fontScale(18),
    fontWeight: '800',
    color: '#F8FAFC',
    letterSpacing: -0.3,
  },
  heroDescription: {
    fontSize: fontScale(12.5),
    color: 'rgba(226, 232, 240, 0.72)',
    marginTop: 3,
    lineHeight: fontScale(18),
  },
  heroFooter: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    gap: scale(12),
    paddingTop: verticalScale(4),
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: 'rgba(255, 255, 255, 0.08)',
    marginTop: verticalScale(2),
  },
  featureList: {
    gap: verticalScale(4),
    paddingTop: verticalScale(2),
    paddingHorizontal: scale(4),
  },
  featureRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: scale(8),
  },
  featureDot: {
    width: scale(4),
    height: scale(4),
    borderRadius: scale(2),
  },
  featureText: {
    flex: 1,
    fontSize: fontScale(12),
    color: 'rgba(226, 232, 240, 0.72)',
    fontWeight: '500',
  },
  footer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    paddingTop: verticalScale(2),
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: 'rgba(255, 255, 255, 0.08)',
    marginTop: verticalScale(4),
    gap: scale(12),
  },
  priceColumn: {
    flexShrink: 1,
    paddingTop: verticalScale(8),
    gap: verticalScale(2),
  },
  priceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: scale(5),
  },
  price: {
    fontSize: fontScale(16),
    fontWeight: '700',
    letterSpacing: -0.2,
    fontVariant: ['tabular-nums'],
  },
  heroPrice: {
    fontSize: fontScale(20),
    fontWeight: '800',
    letterSpacing: -0.3,
    fontVariant: ['tabular-nums'],
  },
  valueLine: {
    fontSize: fontScale(11),
    fontWeight: '600',
    color: '#A5B4FC',
    letterSpacing: 0.2,
  },
  buttonWrap: {
    borderRadius: responsiveBorderRadius.sm,
    overflow: 'hidden',
    marginTop: verticalScale(8),
  },
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: scale(18),
    paddingVertical: verticalScale(10),
    minWidth: scale(120),
  },
  heroButtonWrap: {
    borderRadius: responsiveBorderRadius.md,
    overflow: 'hidden',
  },
  heroButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: scale(22),
    paddingVertical: verticalScale(13),
    minWidth: scale(140),
  },
  buttonText: {
    fontSize: fontScale(12),
    fontWeight: '700',
    color: '#FFFFFF',
    letterSpacing: 0.6,
    textTransform: 'uppercase',
    textAlign: 'center',
  },
  buttonTextDisabled: {
    color: 'rgba(226, 232, 240, 0.55)',
  },
});
