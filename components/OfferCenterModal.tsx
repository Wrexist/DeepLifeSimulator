/**
 * OfferCenterModal — the weekly rotating offer, shown somewhere the player
 * chose to go.
 *
 * WHY A CENTER AND NOT A POPUP. The design constraint from the brief, and the
 * one that keeps this out of dark-pattern territory, is that the player comes
 * to the offer rather than the offer interrupting the player. Nothing in this
 * feature pops up, nothing badges the home screen, and dismissing it does
 * nothing except close it. Showing LAST / THIS / NEXT is the other half: a
 * rotation you can see ahead of is a schedule, not a scarcity tactic.
 *
 * PRICING — READ `lib/offers/pricing.ts` BEFORE CHANGING ANYTHING HERE.
 * Every price on this screen comes from the store SDK. This component never
 * computes a discounted price and never renders `regularPriceUSD` on its own.
 * A discount badge appears only when `resolveOfferPrice` proved one against the
 * live price. When the owner has not scheduled a temporary price change in App
 * Store Connect, the correct and expected rendering is a featured offer at its
 * ordinary price with no badge at all.
 */
import React, { useEffect, useMemo, useState } from 'react';
import {
  Modal,
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Alert,
} from 'react-native';
import { Clock, Gift, Sparkles, X } from 'lucide-react-native';
import { iapService } from '@/services/IAPService';
import { track } from '@/lib/analytics';
import {
  formatRotationCountdown,
  msUntilRotation,
  offerWindow,
  resolveOfferPrice,
} from '@/lib/offers';
import type { OfferDefinition, ResolvedOfferPrice } from '@/lib/offers';
import { fontScale, scale, responsiveBorderRadius } from '@/utils/scaling';

interface OfferCenterModalProps {
  visible: boolean;
  onClose: () => void;
}

function OfferCenterModal({ visible, onClose }: OfferCenterModalProps) {
  const [iapState, setIapState] = useState(() => iapService.getState());
  const [purchasingId, setPurchasingId] = useState<string | null>(null);

  useEffect(() => {
    setIapState(iapService.getState());
    return iapService.addListener((s) => setIapState(s));
  }, []);

  /**
   * `now` is sampled when the modal OPENS and then ticks once a minute.
   *
   * Not read during render: a schedule derived from `Date.now()` inline would
   * make the render impure, and the countdown would only update when something
   * unrelated re-rendered the tree. A minute is the right granularity for a
   * "3d 14h" label — a per-second timer on a shop window is pressure for its
   * own sake, and it would wake the JS thread 60× more often for no visible
   * difference.
   */
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!visible) return undefined;
    setNow(Date.now());
    const id = setInterval(() => setNow(Date.now()), 60_000);
    return () => clearInterval(id);
  }, [visible]);

  const window = useMemo(() => offerWindow(now), [now]);
  const countdown = useMemo(() => formatRotationCountdown(msUntilRotation(now)), [now]);

  const productsById = useMemo(() => {
    const map = new Map<string, unknown>();
    for (const p of iapState.products as { productId?: string }[]) {
      if (p && p.productId) map.set(p.productId, p);
    }
    return map;
  }, [iapState.products]);

  const priceFor = (offer: OfferDefinition): ResolvedOfferPrice =>
    resolveOfferPrice(offer, (productsById.get(offer.productId) ?? null) as never);

  const featured = window.current.offer;
  const featuredPrice = priceFor(featured);

  useEffect(() => {
    if (!visible) return;
    track('offer_center_opened', { offerId: featured.id, weekIndex: window.current.weekIndex });
    track('offer_shown', {
      offerId: featured.id,
      productId: featured.productId,
      purchasable: featuredPrice.purchasable,
      // The discriminator that makes the rotation measurable: a week with a
      // scheduled App Store Connect price change against one without.
      discounted: featuredPrice.discountPercent !== null,
      discountPercent: featuredPrice.discountPercent,
    });
    // Once per open, keyed on the offer — not on price, which can arrive late
    // when the catalog finishes loading and would otherwise double-report.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible, featured.id]);

  const buy = async (offer: OfferDefinition, price: ResolvedOfferPrice) => {
    // Refuse before touching iapService when this SKU did not load. The gem
    // shop takes the same stance for the same reason: a buy button next to a
    // price we could not confirm is worse than no button.
    if (!price.purchasable) {
      Alert.alert('Unavailable', 'This offer could not be loaded from the App Store right now.');
      return;
    }
    track('offer_cta_tapped', {
      offerId: offer.id,
      productId: offer.productId,
      discounted: price.discountPercent !== null,
    });
    setPurchasingId(offer.productId);
    try {
      const result = await iapService.purchaseProduct(offer.productId);
      if (!result.success && result.message) Alert.alert('Purchase', result.message);
    } finally {
      setPurchasingId(null);
    }
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <View style={styles.sheet}>
          <View style={styles.headerRow}>
            <View style={{ flex: 1 }}>
              <Text style={styles.kicker}>OFFER CENTER</Text>
              <Text style={styles.heading}>This week&apos;s offer</Text>
            </View>
            <TouchableOpacity
              onPress={onClose}
              style={styles.closeBtn}
              accessibilityRole="button"
              accessibilityLabel="Close offers"
            >
              <X size={scale(18)} color="#94A3B8" />
            </TouchableOpacity>
          </View>

          {/* `flexShrink: 1` is load-bearing: the sheet is sized by `maxHeight`
              alone, so without it the scroller keeps its content height and the
              sheet overflows past the bottom of the screen instead of scrolling.
              `__tests__/render/modalListsShrink.test.ts` enforces this. */}
          <ScrollView
            style={styles.scroll}
            contentContainerStyle={styles.body}
            showsVerticalScrollIndicator={false}
          >
            {/* ── This week ── */}
            <View style={styles.featuredCard}>
              <View style={styles.featuredHead}>
                <View style={styles.crest}>
                  <Sparkles size={scale(18)} color="#FBBF24" />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.featuredName}>{featured.name}</Text>
                  <Text style={styles.featuredBlurb}>{featured.blurb}</Text>
                </View>
                {featuredPrice.discountPercent !== null && (
                  <View style={styles.saveBadge}>
                    <Text style={styles.saveBadgeText}>
                      SAVE {featuredPrice.discountPercent}%
                    </Text>
                  </View>
                )}
              </View>

              {/* The price line is omitted entirely when the SKU did not load.
                  It used to read "Unavailable" here AND on the button below it,
                  which said the same thing twice and made the card look broken
                  rather than simply offline. The button carries that state. */}
              {featuredPrice.purchasable ? (
                <View style={styles.priceRow}>
                  {/* Only ever rendered ALONGSIDE a proven discount — the two are
                      emitted together or not at all. */}
                  {featuredPrice.strikethroughPrice && (
                    <Text style={styles.strikethrough}>{featuredPrice.strikethroughPrice}</Text>
                  )}
                  <Text style={styles.price}>{featuredPrice.displayPrice}</Text>
                </View>
              ) : (
                <Text style={styles.unavailableNote}>
                  Not available from the App Store right now.
                </Text>
              )}

              <TouchableOpacity
                style={[styles.cta, !featuredPrice.purchasable && styles.ctaDisabled]}
                onPress={() => buy(featured, featuredPrice)}
                disabled={!featuredPrice.purchasable || purchasingId === featured.productId}
                activeOpacity={0.85}
                accessibilityRole="button"
                accessibilityLabel={
                  featuredPrice.purchasable
                    ? `Buy ${featured.name} for ${featuredPrice.displayPrice}`
                    : `${featured.name}, unavailable`
                }
              >
                <Text style={styles.ctaText}>
                  {purchasingId === featured.productId
                    ? 'Processing…'
                    : featuredPrice.purchasable
                      ? `Buy · ${featuredPrice.displayPrice}`
                      : 'Unavailable'}
                </Text>
              </TouchableOpacity>

              <View style={styles.countdownRow}>
                <Clock size={scale(12)} color="#94A3B8" />
                <Text style={styles.countdownText}>Next rotation in {countdown}</Text>
              </View>
            </View>

            {/* ── The rotation, so it reads as a schedule rather than a surprise ── */}
            <Text style={styles.sectionLabel}>THE ROTATION</Text>

            <View style={styles.historyRow}>
              <Text style={styles.historyWhen}>Last week</Text>
              <Text style={styles.historyName}>{window.previous.offer.name}</Text>
            </View>
            <View style={[styles.historyRow, styles.historyRowCurrent]}>
              <Text style={[styles.historyWhen, styles.historyWhenCurrent]}>This week</Text>
              <Text style={[styles.historyName, styles.historyNameCurrent]}>{featured.name}</Text>
            </View>
            <View style={styles.historyRow}>
              <Text style={styles.historyWhen}>Next week</Text>
              <Text style={styles.historyName}>{window.next.offer.name}</Text>
            </View>

            <View style={styles.footNote}>
              <Gift size={scale(13)} color="#64748B" />
              <Text style={styles.footNoteText}>
                Offers rotate every week. Prices are set by the App Store and shown in your own
                currency — nothing here expires early or changes for you personally.
              </Text>
            </View>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(2, 6, 23, 0.72)', justifyContent: 'flex-end' },
  sheet: {
    maxHeight: '88%',
    backgroundColor: '#0F172A',
    borderTopLeftRadius: responsiveBorderRadius.xl,
    borderTopRightRadius: responsiveBorderRadius.xl,
    // Hard Rule #7 structural exception: the hairline wrapping a bottom
    // sheet's rounded top.
    borderTopWidth: 1,
    borderTopColor: 'rgba(148, 163, 184, 0.18)',
    paddingBottom: scale(20),
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: scale(18),
    paddingTop: scale(16),
    paddingBottom: scale(8),
    gap: scale(10),
  },
  kicker: { color: '#FBBF24', fontSize: fontScale(10), fontWeight: '800', letterSpacing: 0.7 },
  heading: { color: '#F8FAFC', fontSize: fontScale(18), fontWeight: '800', marginTop: scale(2) },
  closeBtn: {
    width: scale(34),
    height: scale(34),
    borderRadius: scale(17),
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(148, 163, 184, 0.12)',
  },
  scroll: { flexShrink: 1 },
  body: { paddingHorizontal: scale(18), paddingBottom: scale(12), gap: scale(10) },
  featuredCard: {
    padding: scale(16),
    borderRadius: responsiveBorderRadius.lg,
    backgroundColor: 'rgba(30, 41, 59, 0.8)',
    borderWidth: 1,
    borderColor: 'rgba(251, 191, 36, 0.35)',
    gap: scale(12),
  },
  featuredHead: { flexDirection: 'row', alignItems: 'flex-start', gap: scale(12) },
  crest: {
    width: scale(40),
    height: scale(40),
    borderRadius: scale(12),
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(251, 191, 36, 0.13)',
    borderWidth: 1,
    borderColor: 'rgba(251, 191, 36, 0.4)',
  },
  featuredName: { color: '#F8FAFC', fontSize: fontScale(16), fontWeight: '800' },
  featuredBlurb: { color: '#94A3B8', fontSize: fontScale(11.5), marginTop: scale(3) },
  saveBadge: {
    paddingHorizontal: scale(8),
    paddingVertical: scale(4),
    borderRadius: scale(8),
    backgroundColor: 'rgba(52, 211, 153, 0.14)',
    borderWidth: 1,
    borderColor: 'rgba(52, 211, 153, 0.4)',
  },
  saveBadgeText: { color: '#34D399', fontSize: fontScale(10), fontWeight: '800' },
  priceRow: { flexDirection: 'row', alignItems: 'baseline', gap: scale(8) },
  strikethrough: {
    color: '#64748B',
    fontSize: fontScale(13),
    textDecorationLine: 'line-through',
  },
  price: { color: '#F8FAFC', fontSize: fontScale(20), fontWeight: '800' },
  unavailableNote: { color: '#94A3B8', fontSize: fontScale(12) },
  cta: {
    paddingVertical: scale(12),
    borderRadius: scale(12),
    alignItems: 'center',
    backgroundColor: '#FBBF24',
  },
  ctaDisabled: { backgroundColor: 'rgba(148, 163, 184, 0.2)' },
  ctaText: { color: '#0F172A', fontSize: fontScale(14), fontWeight: '800' },
  countdownRow: { flexDirection: 'row', alignItems: 'center', gap: scale(6) },
  countdownText: { color: '#94A3B8', fontSize: fontScale(11) },
  sectionLabel: {
    color: '#64748B',
    fontSize: fontScale(10),
    fontWeight: '800',
    letterSpacing: 0.7,
    marginTop: scale(6),
  },
  historyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: scale(10),
    paddingHorizontal: scale(12),
    borderRadius: scale(10),
    backgroundColor: 'rgba(30, 41, 59, 0.55)',
    borderWidth: 1,
    borderColor: 'rgba(148, 163, 184, 0.14)',
  },
  historyRowCurrent: { borderColor: 'rgba(251, 191, 36, 0.35)' },
  historyWhen: { color: '#64748B', fontSize: fontScale(11), fontWeight: '700' },
  historyWhenCurrent: { color: '#FBBF24' },
  historyName: { color: '#CBD5E1', fontSize: fontScale(12), fontWeight: '600' },
  historyNameCurrent: { color: '#F8FAFC', fontWeight: '800' },
  footNote: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: scale(8),
    marginTop: scale(8),
    paddingHorizontal: scale(2),
  },
  footNoteText: { flex: 1, color: '#64748B', fontSize: fontScale(10.5), lineHeight: fontScale(15) },
});

export default React.memo(OfferCenterModal);
